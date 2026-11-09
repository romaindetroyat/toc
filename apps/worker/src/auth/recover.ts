// Recovering an account with its backup code (plan 04-03, ACCT-01, D-02, SC1; 04-RESEARCH Patterns 1
// and 3, Pitfall 9, T-04-03, T-04-05, T-04-06). A player who lost every device types their pseudo and
// their backup code on a new one, creates a passkey there, and finds the account again; the lost
// devices are signed out and a new code is shown once. No session is needed; the router checks our
// own non-null Origin and readJson a JSON body, as for every account write.
//   POST /api/auth/recover           { pseudo, code } →
//                                    400 format   the code is not 20 symbols once read back (no D1 read)
//                                    400 wrong    no account has this pseudo, or this is not its code:
//                                                 the same status, body and HMAC work for both, so a
//                                                 recovery never tells whether a pseudo exists
//                                    429 locked   { until }: too many wrong codes (the account's
//                                                 PlayerHub, T-04-34)
//                                    200          the passkey's creation options for the account
//                                                 (excludeCredentials = its passkeys) and a stored
//                                                 challenge of purpose recover, bound to the account,
//                                                 holding the MAC of the code given (5 minutes)
//   POST /api/auth/recover/verify    { response } → 200 { me, backupCode } and the session cookie, or
//                                    400 body / expired / refused, 409 already-here
//
// The hub is asked only for an existing account: an unknown pseudo is answered after the same MAC
// computation, under a fixed id that no account can have, and never names a Durable Object (Pitfall 9).
// Its wrong codes count nowhere. Failed attempts write nothing to D1: the counting lives in the hub's
// own SQLite (no D1 row per failure, T-04-27).
//
// The code is spent only when the new passkey is saved: the verify's batch, in this order,
//   1. replaces the backup MAC, only while it is still the one the challenge holds (a code changed
//      meanwhile, or a second recovery racing with the same code, changes nothing: 400 expired);
//   2. inserts the new passkey,   3. deletes every session of the account (their push subscriptions
//      go by cascade: the lost phone is signed out, T-04-37),   4. inserts this device's session;
// statements 2 to 4 run only when statement 1 wrote the new MAC, so the batch is all or nothing. A
// recovery whose 5-minute challenge expired can start again with the same code.

import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import {
  deviceLabel,
  newBackupCode,
  normalizeBackupCode,
  normalizePseudo,
  pseudoKey,
  RecoverBody,
  RecoverVerifyBody,
} from "@toc/protocol";
import type { Meter } from "../db.ts";
import { json, readJson } from "../http.ts";
import { accountOf } from "../me.ts";
import { macOf, sameMac } from "./backup.ts";
import {
  CEREMONY_TIMEOUT_MS,
  challengeOf,
  pepperOf,
  storeChallenge,
  takeBoundChallenge,
} from "./challenge.ts";
import { keysOf } from "./passkeys.ts";
import { createSession, SESSION_TTL_MS } from "./session.ts";
import { rpFor } from "./webauthn.ts";

/** The id under which an unknown pseudo's code is MACed: not base64url of 16 bytes, so no account's. */
const NOBODY = "~nobody~";

type UserRow = {
  id: string;
  pseudo: string;
  webauthn_user_id: string;
  backup_mac: string | null;
  created_at: number;
};

const wrong = () => json({ error: "wrong" }, 400);

/** POST /api/auth/recover (the router has checked the Origin). */
export async function recoverOptions(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
): Promise<Response> {
  const pepper = pepperOf(env);
  if (pepper instanceof Response) return pepper;
  const read = await readJson(request, RecoverBody);
  if (!read.ok) return read.response;
  const code = normalizeBackupCode(read.body.code);
  if (code === null) return json({ error: "format" }, 400);

  // A pseudo that cannot be one is looked up all the same (under a key no account has): one read,
  // one MAC, the same answer as an unknown pseudo or a wrong code.
  const pseudo = normalizePseudo(read.body.pseudo);
  const key = pseudo.ok ? pseudoKey(pseudo.pseudo) : "";
  const user = await meter.first<UserRow>(
    meter
      .prepare(
        `SELECT id, pseudo, webauthn_user_id, backup_mac, created_at FROM users
          WHERE pseudo_key = ?`,
      )
      .bind(key),
  );
  const given = await macOf(pepper, user?.id ?? NOBODY, code);
  if (user === null) return wrong();

  // The account's own hub compares the MACs and counts the wrong ones (an account without a code
  // yet, the bootstrap's first instants, has nothing to match).
  const check = await env.PLAYER_HUB.getByName(user.id).checkBackupCode({
    expected: user.backup_mac ?? "",
    given,
    now,
  });
  if (!check.ok) {
    if (check.reason === "wrong") return wrong();
    const seconds = Math.max(1, Math.ceil((check.until - now) / 1000));
    return json({ error: "locked", until: check.until }, 429, { "retry-after": String(seconds) });
  }

  const rp = rpFor(url, env);
  const options = await generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    userName: user.pseudo,
    userDisplayName: user.pseudo,
    userID: isoBase64URL.toBuffer(user.webauthn_user_id),
    timeout: CEREMONY_TIMEOUT_MS,
    attestationType: "none",
    excludeCredentials: await keysOf(meter, user.id),
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  await storeChallenge(
    meter,
    {
      challenge: options.challenge,
      purpose: "recover",
      userId: user.id,
      pending: JSON.stringify({ mac: given }),
    },
    now,
  );
  return json(options, 200);
}

/** The MAC a recover challenge holds (our own JSON, checked anyway). */
function pendingMac(text: string | null): string | null {
  if (text === null) return null;
  try {
    const data = JSON.parse(text) as { mac?: unknown };
    return typeof data.mac === "string" && data.mac !== "" ? data.mac : null;
  } catch {
    return null;
  }
}

/** POST /api/auth/recover/verify (the router has checked the Origin). */
export async function recoverVerify(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
): Promise<Response> {
  const pepper = pepperOf(env);
  if (pepper instanceof Response) return pepper;
  const read = await readJson(request, RecoverVerifyBody);
  if (!read.ok) return read.response;
  const response = read.body.response;
  const challenge = challengeOf(response.response.clientDataJSON);
  if (challenge === null) return json({ error: "body" }, 400);

  // Single use: the row goes now, whatever comes next. Its account is the one recovered.
  const taken = await takeBoundChallenge(meter, challenge, "recover", now);
  const mac = pendingMac(taken?.pending ?? null);
  if (taken === undefined || mac === null) return json({ error: "expired" }, 400);
  const userId = taken.userId;

  // The code must still be the account's (a new code made meanwhile makes this recovery stale).
  const user = await meter.first<UserRow>(
    meter
      .prepare(
        "SELECT id, pseudo, webauthn_user_id, backup_mac, created_at FROM users WHERE id = ?",
      )
      .bind(userId),
  );
  if (user === null || user.backup_mac === null || !sameMac(user.backup_mac, mac)) {
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

  const backupCode = newBackupCode();
  const newMac = await macOf(pepper, userId, backupCode);
  const session = await createSession(meter, userId, credential.id, now, url, env);
  // Statements 2 to 4 run only once statement 1 has put the new MAC in place.
  const won = "EXISTS (SELECT 1 FROM users WHERE id = ? AND backup_mac = ?)";
  let results: D1Result[];
  try {
    results = await meter.batch([
      meter
        .prepare("UPDATE users SET backup_mac = ?, backup_at = ? WHERE id = ? AND backup_mac = ?")
        .bind(newMac, now, userId, mac),
      meter
        .prepare(
          `INSERT INTO passkeys (id, user_id, rp_id, public_key, counter, transports, device_type,
                                 backed_up, label, created_at, last_used_at)
           SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL WHERE ${won}`,
        )
        .bind(
          credential.id,
          userId,
          rp.id,
          credential.publicKey,
          credential.counter,
          JSON.stringify(credential.transports ?? response.response.transports ?? []),
          info.credentialDeviceType,
          info.credentialBackedUp ? 1 : 0,
          label,
          now,
          userId,
          newMac,
        ),
      meter
        .prepare(`DELETE FROM sessions WHERE user_id = ? AND ${won}`)
        .bind(userId, userId, newMac),
      meter
        .prepare(
          `INSERT INTO sessions (id_hash, user_id, passkey_id, created_at, seen_at, expires_at, auth_at)
           SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${won}`,
        )
        .bind(
          session.hash,
          userId,
          credential.id,
          now,
          now,
          now + SESSION_TTL_MS,
          now,
          userId,
          newMac,
        ),
    ]);
  } catch (error) {
    // Nothing of the batch was written. A credential TOC already has: this device holds a key.
    const message = error instanceof Error ? error.message : String(error);
    if (/passkeys\.id|UNIQUE|PRIMARY/i.test(message)) {
      return json({ error: "already-here" }, 409);
    }
    console.error("recovery batch failed", message);
    return json({ error: "server" }, 500);
  }
  if (results[0]?.meta.changes !== 1) return json({ error: "expired" }, 400);

  const me = await accountOf(
    meter,
    {
      id: userId,
      pseudo: user.pseudo,
      createdAt: user.created_at,
      hasBackupCode: true,
      backupAt: now,
    },
    credential.id,
  );
  return json({ me, backupCode }, 200, { "set-cookie": session.cookie });
}
