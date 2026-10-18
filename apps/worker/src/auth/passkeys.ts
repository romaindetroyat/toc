// The passkeys of a signed-in account and a new backup code (plan 04-02, ACCT-01, D-02; 04-RESEARCH
// Patterns 1 and 3, T-04-06, T-04-30, T-04-31). Every route needs the session cookie (401
// signed-out without it) and, through the router, our own non-null Origin; the POSTs a JSON body.
//   POST   /api/auth/passkeys/options      {} → creation options for this device: the account's
//                                          WebAuthn handle, excludeCredentials = its passkeys (a device
//                                          that already holds one says so: InvalidStateError), and a
//                                          stored challenge of purpose add bound to the account
//   POST   /api/auth/passkeys/verify       { response } → the new passkey (201 { passkey }); this
//                                          device's session now counts as opened with it, so removing
//                                          the key it signed in with (another device's) keeps it signed
//                                          in; 409 already-here for a credential TOC already has
//   DELETE /api/auth/passkeys/:id          one's own passkey, never the last (409 last); the sessions
//                                          opened with it end (ON DELETE CASCADE: a lost phone is
//                                          signed out), and so does their push subscription; 404 for
//                                          a key that is not the account's
//   POST   /api/auth/backup-code/options   {} → authentication options limited to the account's
//                                          passkeys, and a stored challenge of purpose stepup bound to
//                                          the account (5 minutes)
//   POST   /api/auth/backup-code/verify    { response } → the step-up and the regeneration in one call:
//                                          the assertion must be one of the account's own passkeys;
//                                          then a new code (shown once), its MAC, backup_at and the
//                                          session's auth_at in one batch. The old code stops working.

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import {
  AddPasskeyVerifyBody,
  BackupCodeVerifyBody,
  deviceLabel,
  EmptyBody,
  newBackupCode,
  type PasskeyInfo,
} from "@toc/protocol";
import type { Meter } from "../db.ts";
import { json, readJson } from "../http.ts";
import { macOf } from "./backup.ts";
import {
  CEREMONY_TIMEOUT_MS,
  challengeOf,
  pepperOf,
  storeChallenge,
  takeChallenge,
} from "./challenge.ts";
import { ownedPasskey, transportsOf } from "./login.ts";
import { clearCookie, type SessionUser, sessionUser } from "./session.ts";
import { rpFor } from "./webauthn.ts";

/** A credential id as it may appear in a path: base64url, at most the body's own cap. */
const CREDENTIAL_ID_RE = /^[A-Za-z0-9_-]{1,1024}$/;

type Handler = (
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
  user: SessionUser,
) => Promise<Response>;

/** The handler, run only for a signed-in request (401 signed-out otherwise). */
export function signedIn(handler: Handler) {
  return async (
    request: Request,
    env: Env,
    url: URL,
    meter: Meter,
    now: number,
  ): Promise<Response> => {
    const user = await sessionUser(request, url, env, meter, now);
    if (user === null) return json({ error: "signed-out" }, 401);
    return handler(request, env, url, meter, now, user);
  };
}

type KeyRow = { id: string; transports: string | null };

/**
 * The account's passkeys, as WebAuthn descriptors (excludeCredentials, allowCredentials; the recovery's
 * excludeCredentials too, plan 04-03).
 */
export async function keysOf(
  meter: Meter,
  userId: string,
): Promise<{ id: string; transports: string[] }[]> {
  const keys = await meter.all<KeyRow>(
    meter
      .prepare("SELECT id, transports FROM passkeys WHERE user_id = ? ORDER BY created_at, id")
      .bind(userId),
  );
  return keys.results.map((row) => ({ id: row.id, transports: transportsOf(row.transports) }));
}

/** POST /api/auth/passkeys/options. */
export const addOptions = signedIn(async (request, env, url, meter, now, user) => {
  const read = await readJson(request, EmptyBody);
  if (!read.ok) return read.response;
  const handle = await meter.first<{ webauthn_user_id: string }>(
    meter.prepare("SELECT webauthn_user_id FROM users WHERE id = ?").bind(user.id),
  );
  if (handle === null) return json({ error: "signed-out" }, 401);
  const rp = rpFor(url, env);
  const options = await generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    userName: user.pseudo,
    userDisplayName: user.pseudo,
    userID: isoBase64URL.toBuffer(handle.webauthn_user_id),
    timeout: CEREMONY_TIMEOUT_MS,
    attestationType: "none",
    excludeCredentials: await keysOf(meter, user.id),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  await storeChallenge(
    meter,
    { challenge: options.challenge, purpose: "add", userId: user.id },
    now,
  );
  return json(options, 200);
});

/** POST /api/auth/passkeys/verify. */
export const addVerify = signedIn(async (request, env, url, meter, now, user) => {
  const read = await readJson(request, AddPasskeyVerifyBody);
  if (!read.ok) return read.response;
  const response = read.body.response;
  const challenge = challengeOf(response.response.clientDataJSON);
  if (challenge === null) return json({ error: "body" }, 400);
  // Single use, this account's, of this purpose: whatever comes next.
  if ((await takeChallenge(meter, challenge, "add", user.id, now)) === undefined) {
    return json({ error: "expired" }, 400);
  }

  const rp = rpFor(url, env);
  let verified: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
  try {
    verified = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.id,
      requireUserVerification: false,
    });
  } catch {
    return json({ error: "refused" }, 400);
  }
  if (!verified.verified) return json({ error: "refused" }, 400);
  const info = verified.registrationInfo;
  const credential = info.credential;
  const label = deviceLabel(request.headers.get("User-Agent"));

  try {
    await meter.batch([
      meter
        .prepare(
          `INSERT INTO passkeys (id, user_id, rp_id, public_key, counter, transports, device_type,
                                 backed_up, label, created_at, last_used_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
        )
        .bind(
          credential.id,
          user.id,
          rp.id,
          credential.publicKey,
          credential.counter,
          JSON.stringify(credential.transports ?? response.response.transports ?? []),
          info.credentialDeviceType,
          info.credentialBackedUp ? 1 : 0,
          label,
          now,
        ),
      // This device now counts as signed in with its own key.
      meter
        .prepare("UPDATE sessions SET passkey_id = ? WHERE id_hash = ?")
        .bind(credential.id, user.sessionHash),
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/passkeys\.id|UNIQUE|PRIMARY/i.test(message)) {
      return json({ error: "already-here" }, 409);
    }
    console.error("add passkey batch failed", message);
    return json({ error: "server" }, 500);
  }

  const passkey: PasskeyInfo = {
    id: credential.id,
    label,
    createdAt: now,
    lastUsedAt: null,
    backedUp: info.credentialBackedUp,
    current: true,
  };
  return json({ passkey }, 201);
});

/** DELETE /api/auth/passkeys/:id (the router has checked the Origin; there is no body). */
export function removePasskey(id: string) {
  return signedIn(async (_request, env, url, meter, _now, user) => {
    if (!CREDENTIAL_ID_RE.test(id)) return json({ error: "not-found" }, 404);
    // Never the last: the guard and the delete are one statement. (RETURNING, not meta.changes,
    // which also counts the sessions the cascade removed.)
    const removed = await meter.first(
      meter
        .prepare(
          `DELETE FROM passkeys
            WHERE id = ? AND user_id = ? AND (SELECT COUNT(*) FROM passkeys WHERE user_id = ?) > 1
           RETURNING id`,
        )
        .bind(id, user.id, user.id),
    );
    if (removed !== null) {
      // The sessions opened with it went too (cascade); this one among them, its cookie goes.
      const headers: HeadersInit = { "cache-control": "no-store" };
      if (id === user.passkeyId) headers["set-cookie"] = clearCookie(url, env);
      return new Response(null, { status: 204, headers });
    }
    const own = await meter.first(
      meter.prepare("SELECT 1 AS one FROM passkeys WHERE id = ? AND user_id = ?").bind(id, user.id),
    );
    return own === null ? json({ error: "not-found" }, 404) : json({ error: "last" }, 409);
  });
}

/** POST /api/auth/backup-code/options. */
export const backupCodeOptions = signedIn(async (request, env, url, meter, now, user) => {
  const read = await readJson(request, EmptyBody);
  if (!read.ok) return read.response;
  const options = await generateAuthenticationOptions({
    rpID: rpFor(url, env).id,
    allowCredentials: await keysOf(meter, user.id),
    userVerification: "preferred",
    timeout: CEREMONY_TIMEOUT_MS,
  });
  await storeChallenge(
    meter,
    { challenge: options.challenge, purpose: "stepup", userId: user.id },
    now,
  );
  return json(options, 200);
});

/** POST /api/auth/backup-code/verify: the step-up and the new code in one call (T-04-30). */
export async function backupCodeVerify(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
): Promise<Response> {
  const pepper = pepperOf(env);
  if (pepper instanceof Response) return pepper;
  return signedIn(async (_request, _env, _url, _meter, _now, user) => {
    const read = await readJson(request, BackupCodeVerifyBody);
    if (!read.ok) return read.response;
    const response = read.body.response;
    const challenge = challengeOf(response.response.clientDataJSON);
    if (challenge === null) return json({ error: "body" }, 400);
    if ((await takeChallenge(meter, challenge, "stepup", user.id, now)) === undefined) {
      return json({ error: "expired" }, 400);
    }

    // One of the account's own passkeys, and nobody else's.
    const passkey = await ownedPasskey(meter, response.id);
    if (
      passkey === null ||
      passkey.user_id !== user.id ||
      (response.response.userHandle !== undefined &&
        response.response.userHandle !== passkey.webauthn_user_id)
    ) {
      return json({ error: "refused" }, 400);
    }
    const rp = rpFor(url, env);
    let newCounter: number;
    try {
      const verified = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: rp.origin,
        expectedRPID: rp.id,
        credential: {
          id: passkey.id,
          publicKey: new Uint8Array(passkey.public_key),
          counter: passkey.counter,
          transports: transportsOf(passkey.transports),
        },
        requireUserVerification: false,
      });
      if (!verified.verified) return json({ error: "refused" }, 400);
      newCounter = verified.authenticationInfo.newCounter;
    } catch {
      return json({ error: "refused" }, 400);
    }

    const backupCode = newBackupCode();
    const backupMac = await macOf(pepper, user.id, backupCode);
    await meter.batch([
      meter
        .prepare("UPDATE users SET backup_mac = ?, backup_at = ? WHERE id = ?")
        .bind(backupMac, now, user.id),
      meter
        .prepare("UPDATE sessions SET auth_at = ? WHERE id_hash = ?")
        .bind(now, user.sessionHash),
      meter
        .prepare("UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?")
        .bind(newCounter, now, passkey.id),
    ]);
    return json({ backupCode }, 200);
  })(request, env, url, meter, now);
}
