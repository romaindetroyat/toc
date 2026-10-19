// Signing in and out (plan 04-02, ACCT-01, ACCT-02, D-12; 04-RESEARCH Patterns 1 and 4, Pitfall 10,
// A15, T-04-28, T-04-29). The login is usernameless: the passkey is discoverable, so nobody types a
// pseudo and nobody can learn which pseudos exist from it.
//   POST /api/auth/login/options   {} → authentication options with no allowCredentials and a signed
//                                  challenge (auth/challenge.ts): nothing is written to D1
//   POST /api/auth/login/verify    { response } → a new session on this device and { me }
//   POST /api/auth/logout          {} → this device's session row goes (its push subscription with it,
//                                  cascade, D-12), 204 and the cookie expired; the account's other
//                                  devices stay signed in
//
// Verify runs in this order, and answers:
//   400 body      the clientDataJSON cannot be read
//   400 expired   the challenge is not one we signed, is over 5 minutes old, or was already spent
//   400 unknown   no passkey of TOC has this credential id, or the user handle is not its owner's
//   400 refused   SimpleWebAuthn refuses the assertion (signature, origin, RP ID, counter)
// and only then one batch: the challenge recorded as spent (its primary key refuses a second use),
// the passkey's counter and last use, the new session. User verification is preferred, not required
// (a platform without it still signs in); a synced passkey keeps reporting counter 0, which
// SimpleWebAuthn accepts (0 → 0).

import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { EmptyBody, LoginVerifyBody } from "@toc/protocol";
import type { Meter } from "../db.ts";
import { json, readJson } from "../http.ts";
import { accountOf } from "../me.ts";
import {
  CEREMONY_TIMEOUT_MS,
  challengeOf,
  checkLoginChallenge,
  isSpent,
  loginChallenge,
  pepperOf,
  spentStatement,
  sweep,
} from "./challenge.ts";
import { clearCookie, createSession, endSession } from "./session.ts";
import { rpFor } from "./webauthn.ts";

/** A passkey row with what its owner's answer needs. */
export type OwnedPasskey = {
  id: string;
  user_id: string;
  public_key: ArrayBuffer;
  counter: number;
  transports: string | null;
  webauthn_user_id: string;
  pseudo: string;
  created_at: number;
  has_backup: number;
  backup_at: number | null;
};

/** The passkey of this credential id with its owner (one read), or null. */
export async function ownedPasskey(
  meter: Meter,
  credentialId: string,
): Promise<OwnedPasskey | null> {
  return meter.first<OwnedPasskey>(
    meter
      .prepare(
        `SELECT p.id, p.user_id, p.public_key, p.counter, p.transports, u.webauthn_user_id,
                u.pseudo, u.created_at, u.backup_mac IS NOT NULL AS has_backup, u.backup_at
           FROM passkeys p JOIN users u ON u.id = p.user_id
          WHERE p.id = ?`,
      )
      .bind(credentialId),
  );
}

/** The stored transports of a passkey (our own JSON), as SimpleWebAuthn wants them. */
export function transportsOf(text: string | null): string[] {
  try {
    const value: unknown = JSON.parse(text ?? "[]");
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

/** POST /api/auth/login/options (the router has checked the Origin). Writes nothing. */
export async function loginOptions(
  request: Request,
  env: Env,
  url: URL,
  now: number,
): Promise<Response> {
  const pepper = pepperOf(env);
  if (pepper instanceof Response) return pepper;
  const read = await readJson(request, EmptyBody);
  if (!read.ok) return read.response;
  const challenge = await loginChallenge(pepper, now);
  const options = await generateAuthenticationOptions({
    rpID: rpFor(url, env).id,
    userVerification: "preferred",
    timeout: CEREMONY_TIMEOUT_MS,
    // The bytes, which it encodes back to the same base64url (a string would be taken as UTF-8).
    challenge: new Uint8Array(isoBase64URL.toBuffer(challenge)),
  });
  return json(options, 200);
}

/** POST /api/auth/login/verify (the router has checked the Origin). */
export async function loginVerify(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
): Promise<Response> {
  const pepper = pepperOf(env);
  if (pepper instanceof Response) return pepper;
  const read = await readJson(request, LoginVerifyBody);
  if (!read.ok) return read.response;
  const response = read.body.response;

  const challenge = challengeOf(response.response.clientDataJSON);
  if (challenge === null) return json({ error: "body" }, 400);
  const expiresAt = await checkLoginChallenge(pepper, challenge, now);
  if (expiresAt === null) return json({ error: "expired" }, 400);
  if (await isSpent(meter, challenge)) return json({ error: "expired" }, 400);

  const passkey = await ownedPasskey(meter, response.id);
  if (passkey === null || response.response.userHandle !== passkey.webauthn_user_id) {
    return json({ error: "unknown" }, 400);
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

  const session = await createSession(meter, passkey.user_id, passkey.id, now, url, env);
  try {
    await meter.batch([
      spentStatement(meter, challenge, expiresAt),
      meter
        .prepare("UPDATE passkeys SET counter = ?, last_used_at = ? WHERE id = ?")
        .bind(newCounter, now, passkey.id),
      session.statement,
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Two verifies of one assertion racing: the second finds the challenge spent.
    if (/challenges\.challenge|UNIQUE|PRIMARY/i.test(message)) {
      return json({ error: "expired" }, 400);
    }
    console.error("login batch failed", message);
    return json({ error: "server" }, 500);
  }
  await sweep(meter, now);

  const me = await accountOf(
    meter,
    {
      id: passkey.user_id,
      pseudo: passkey.pseudo,
      createdAt: passkey.created_at,
      hasBackupCode: passkey.has_backup === 1,
      backupAt: passkey.backup_at,
    },
    passkey.id,
  );
  return json({ me }, 200, { "set-cookie": session.cookie });
}

/** POST /api/auth/logout (the router has checked the Origin): 204, whether a session was there or not. */
export async function logout(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
): Promise<Response> {
  const read = await readJson(request, EmptyBody);
  if (!read.ok) return read.response;
  await endSession(meter, request, url, env);
  return new Response(null, {
    status: 204,
    headers: { "cache-control": "no-store", "set-cookie": clearCookie(url, env) },
  });
}
