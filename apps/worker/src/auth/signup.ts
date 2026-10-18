// Sign-up by invitation (plan 04-01, ACCT-01, D-02, D-03, D-04, D-06, D-11; 04-RESEARCH Patterns 1,
// 3 and 5, Pitfall 6). There is no e-mail (D-01): an account is a pseudo and a passkey.
//   GET  /api/invitations/:code      the state of an invitation: ok (with its inviter and expiry),
//                                    used, expired or unknown; the bootstrap code is ok while no
//                                    account exists (Romain's first account, D-03), then unknown
//   POST /api/auth/signup/options    { invitation, pseudo } → the passkey's creation options and a
//                                    challenge row holding the pending sign-up (5 minutes)
//   POST /api/auth/signup/verify     { response } → the account, its passkey, the friendship with
//                                    the inviter (D-06), the session cookie and the backup code,
//                                    shown once (D-02)
//   POST /api/test/invitation        TOC_TEST_MODE only: a fresh, used or expired invitation with no
//                                    inviter, for the browser tests
//
// Verify runs in this order: the challenge is taken from clientDataJSON and its row deleted (single
// use); SimpleWebAuthn checks the answer against the pending data and the relying party; then the
// invitation is claimed by a guarded UPDATE (used_at, only while unused and unexpired), or for the
// bootstrap the user row is inserted only while users is empty; then one D1 batch writes the rest. A
// batch cannot fail on « 0 rows changed », hence the separate claim (Pitfall 6). A batch that fails
// on the unique pseudo key (two sign-ups racing for one pseudo) releases the claim and answers 409.
//
// What D1 never holds: the invitation code (SHA-256 only), the session token (SHA-256 only), the
// backup code (an HMAC under TOC_PEPPER only), the bootstrap code (a secret, never in a config).

import { generateRegistrationOptions, verifyRegistrationResponse } from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import {
  deviceLabel,
  INVITE_TTL_MS,
  type InvitationState,
  isInvitationCode,
  type MeAccount,
  newBackupCode,
  normalizePseudo,
  pseudoKey,
  SignupOptionsBody,
  SignupVerifyBody,
  TestInvitationBody,
} from "@toc/protocol";
import type { Meter } from "../db.ts";
import { json, randomUrl, readJson, sha256Url } from "../http.ts";
import { macOf, sameSecret } from "./backup.ts";
import {
  CEREMONY_TIMEOUT_MS,
  challengeOf,
  pepperOf,
  storeChallenge,
  takeChallenge,
} from "./challenge.ts";
import { createSession } from "./session.ts";
import { rpFor } from "./webauthn.ts";

/** The bootstrap code is ours: compared in constant time on SHA-256 digests (T-04-11). */
async function isBootstrap(code: string, env: Env): Promise<boolean> {
  const secret = env.TOC_BOOTSTRAP;
  if (secret === undefined || secret === "") return false;
  return sameSecret(code, secret);
}

async function noAccountYet(meter: Meter): Promise<boolean> {
  return (await meter.first(meter.prepare("SELECT 1 AS one FROM users LIMIT 1"))) === null;
}

type InvitationRow = { expires_at: number; used_at: number | null; inviter: string | null };

/** What a code opens: an invitation's state, or the bootstrap; resolves without a D1 read when malformed. */
async function stateOf(
  code: string,
  env: Env,
  meter: Meter,
  now: number,
): Promise<InvitationState & { hash?: string; inviterId?: string | null }> {
  if (!isInvitationCode(code)) return { state: "unknown" };
  if (await isBootstrap(code, env)) {
    return (await noAccountYet(meter))
      ? { state: "ok", bootstrap: true, inviter: null }
      : { state: "unknown" };
  }
  const hash = await sha256Url(code);
  const row = await meter.first<InvitationRow & { inviter_id: string | null }>(
    meter
      .prepare(
        `SELECT i.expires_at, i.used_at, i.inviter_id, u.pseudo AS inviter
           FROM invitations i LEFT JOIN users u ON u.id = i.inviter_id
          WHERE i.code_hash = ?`,
      )
      .bind(hash),
  );
  if (row === null) return { state: "unknown" };
  if (row.used_at !== null) return { state: "used", inviter: row.inviter };
  if (row.expires_at <= now) return { state: "expired", inviter: row.inviter };
  return {
    state: "ok",
    inviter: row.inviter,
    expiresAt: row.expires_at,
    hash,
    inviterId: row.inviter_id,
  };
}

/** GET /api/invitations/:code. */
export async function invitationRoute(
  code: string,
  env: Env,
  meter: Meter,
  now: number,
): Promise<Response> {
  const { hash: _hash, inviterId: _inviterId, ...state } = await stateOf(code, env, meter, now);
  return json(state, 200);
}

/** What the challenge row keeps between the two calls of a sign-up (our own JSON, checked anyway). */
type Pending = {
  pseudo: string;
  key: string;
  invitation: string | null;
  inviterId: string | null;
  bootstrap: boolean;
  userId: string;
  handle: string;
};

function readPending(text: string | null): Pending | null {
  if (text === null) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const p = data as Record<string, unknown>;
  const isText = (v: unknown): v is string => typeof v === "string";
  const orNull = (v: unknown): v is string | null => v === null || typeof v === "string";
  if (
    !isText(p.pseudo) ||
    !isText(p.key) ||
    !orNull(p.invitation) ||
    !orNull(p.inviterId) ||
    typeof p.bootstrap !== "boolean" ||
    !isText(p.userId) ||
    !isText(p.handle)
  ) {
    return null;
  }
  return {
    pseudo: p.pseudo,
    key: p.key,
    invitation: p.invitation,
    inviterId: p.inviterId,
    bootstrap: p.bootstrap,
    userId: p.userId,
    handle: p.handle,
  };
}

/** POST /api/auth/signup/options (the router has checked the Origin). */
export async function signupOptions(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
): Promise<Response> {
  const pepper = pepperOf(env);
  if (pepper instanceof Response) return pepper;
  const read = await readJson(request, SignupOptionsBody);
  if (!read.ok) return read.response;
  const pseudo = normalizePseudo(read.body.pseudo);
  if (!pseudo.ok) return json({ error: "pseudo", reason: pseudo.reason }, 400);

  // The invitation first: only its holder learns whether a pseudo is taken (T-04-25), and nothing
  // is written for a caller without one (T-04-27).
  const state = await stateOf(read.body.invitation, env, meter, now);
  if (state.state !== "ok") return json({ error: state.state }, 410);

  const key = pseudoKey(pseudo.pseudo);
  const taken = await meter.first(
    meter.prepare("SELECT 1 AS one FROM users WHERE pseudo_key = ?").bind(key),
  );
  if (taken !== null) return json({ error: "taken" }, 409);

  const rp = rpFor(url, env);
  const handle = crypto.getRandomValues(new Uint8Array(32));
  const options = await generateRegistrationOptions({
    rpName: rp.name,
    rpID: rp.id,
    userName: pseudo.pseudo,
    userDisplayName: pseudo.pseudo,
    userID: handle,
    timeout: CEREMONY_TIMEOUT_MS,
    attestationType: "none",
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
  const pending: Pending = {
    pseudo: pseudo.pseudo,
    key,
    invitation: state.bootstrap === true ? null : (state.hash ?? null),
    inviterId: state.inviterId ?? null,
    bootstrap: state.bootstrap === true,
    userId: randomUrl(16),
    handle: isoBase64URL.fromBuffer(handle),
  };
  await storeChallenge(
    meter,
    {
      challenge: options.challenge,
      purpose: "register",
      userId: null,
      pending: JSON.stringify(pending),
    },
    now,
  );
  return json(options, 200);
}

/** The claim failed: why, from the invitation's state now (410 used / expired / unknown). */
async function gone(pending: Pending, meter: Meter): Promise<Response> {
  if (pending.invitation === null) return json({ error: "unknown" }, 410);
  const row = await meter.first<InvitationRow>(
    meter
      .prepare("SELECT expires_at, used_at, NULL AS inviter FROM invitations WHERE code_hash = ?")
      .bind(pending.invitation),
  );
  if (row === null) return json({ error: "unknown" }, 410);
  return json({ error: row.used_at !== null ? "used" : "expired" }, 410);
}

/** POST /api/auth/signup/verify (the router has checked the Origin). */
export async function signupVerify(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
): Promise<Response> {
  const pepper = pepperOf(env);
  if (pepper instanceof Response) return pepper;
  const read = await readJson(request, SignupVerifyBody);
  if (!read.ok) return read.response;
  const response = read.body.response;

  const challenge = challengeOf(response.response.clientDataJSON);
  if (challenge === null) return json({ error: "body" }, 400);

  // Single use: the row goes now, whatever comes next.
  const pending = readPending(
    (await takeChallenge(meter, challenge, "register", null, now)) ?? null,
  );
  if (pending === null) return json({ error: "expired" }, 400);

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

  // The claim (Pitfall 6): the invitation, or the bootstrap's user row while users is empty.
  if (pending.bootstrap) {
    const inserted = await meter.run(
      meter
        .prepare(
          `INSERT INTO users (id, pseudo, pseudo_key, webauthn_user_id, created_at)
           SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM users)`,
        )
        .bind(pending.userId, pending.pseudo, pending.key, pending.handle, now),
    );
    if (inserted.meta.changes !== 1) return json({ error: "unknown" }, 410);
  } else if (pending.invitation !== null) {
    const claimed = await meter.run(
      meter
        .prepare(
          `UPDATE invitations SET used_at = ?
            WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?`,
        )
        .bind(now, pending.invitation, now),
    );
    if (claimed.meta.changes !== 1) return gone(pending, meter);
  } else {
    return json({ error: "unknown" }, 410);
  }

  const backupCode = newBackupCode();
  const backupMac = await macOf(pepper, pending.userId, backupCode);
  const label = deviceLabel(request.headers.get("User-Agent"));
  const credential = info.credential;
  const session = await createSession(meter, pending.userId, credential.id, now, url, env);
  const statements: D1PreparedStatement[] = [];
  if (pending.bootstrap) {
    statements.push(
      meter
        .prepare("UPDATE users SET backup_mac = ?, backup_at = ? WHERE id = ?")
        .bind(backupMac, now, pending.userId),
    );
  } else {
    statements.push(
      meter
        .prepare(
          `INSERT INTO users
             (id, pseudo, pseudo_key, webauthn_user_id, backup_mac, backup_at, invited_by, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          pending.userId,
          pending.pseudo,
          pending.key,
          pending.handle,
          backupMac,
          now,
          pending.inviterId,
          now,
        ),
    );
  }
  statements.push(
    meter
      .prepare(
        `INSERT INTO passkeys (id, user_id, rp_id, public_key, counter, transports, device_type,
                               backed_up, label, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
      )
      .bind(
        credential.id,
        pending.userId,
        rp.id,
        credential.publicKey,
        credential.counter,
        JSON.stringify(credential.transports ?? response.response.transports ?? []),
        info.credentialDeviceType,
        info.credentialBackedUp ? 1 : 0,
        label,
        now,
      ),
  );
  if (pending.inviterId !== null) {
    const friendship = meter.prepare(
      "INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)",
    );
    statements.push(friendship.bind(pending.inviterId, pending.userId, now));
    statements.push(friendship.bind(pending.userId, pending.inviterId, now));
  }
  if (pending.invitation !== null) {
    statements.push(
      meter
        .prepare("UPDATE invitations SET used_by = ? WHERE code_hash = ?")
        .bind(pending.userId, pending.invitation),
    );
  }
  statements.push(session.statement);

  try {
    await meter.batch(statements);
  } catch (error) {
    // Nothing of the batch was written: give the claim back.
    await release(pending, meter);
    const message = error instanceof Error ? error.message : String(error);
    if (/users\.pseudo_key/.test(message)) return json({ error: "taken" }, 409);
    console.error("sign-up batch failed", message);
    return json({ error: "server" }, 500);
  }

  const me: MeAccount = {
    id: pending.userId,
    pseudo: pending.pseudo,
    createdAt: now,
    passkeys: [
      {
        id: credential.id,
        label,
        createdAt: now,
        lastUsedAt: null,
        backedUp: info.credentialBackedUp,
        current: true,
      },
    ],
    hasBackupCode: true,
    backupAt: now,
  };
  return json({ me, backupCode }, 201, { "set-cookie": session.cookie });
}

/** Undoes a claim whose batch failed: the invitation is free again, the bootstrap row goes. */
async function release(pending: Pending, meter: Meter): Promise<void> {
  if (pending.bootstrap) {
    await meter.run(meter.prepare("DELETE FROM users WHERE id = ?").bind(pending.userId));
  } else if (pending.invitation !== null) {
    await meter.run(
      meter
        .prepare("UPDATE invitations SET used_at = NULL WHERE code_hash = ? AND used_by IS NULL")
        .bind(pending.invitation),
    );
  }
}

/** POST /api/test/invitation (TOC_TEST_MODE only, the router checks): an invitation with no inviter. */
export async function mintInvitation(
  request: Request,
  meter: Meter,
  now: number,
): Promise<Response> {
  const read = await readJson(request, TestInvitationBody);
  if (!read.ok) return read.response;
  const code = randomUrl(16);
  await meter.run(
    meter
      .prepare(
        `INSERT INTO invitations (code_hash, id, kind, inviter_id, created_at, expires_at, used_at)
         VALUES (?, ?, 'link', NULL, ?, ?, ?)`,
      )
      .bind(
        await sha256Url(code),
        randomUrl(16),
        now,
        read.body.expired === true ? now - 1 : now + INVITE_TTL_MS,
        read.body.used === true ? now : null,
      ),
  );
  return json({ code }, 201);
}
