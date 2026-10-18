// The challenges of the passkey ceremonies (plans 04-01 and 04-02; 04-RESEARCH Pattern 1, Pitfall 10,
// T-04-28, T-04-29). Two kinds:
//   stored     one D1 row per ceremony (sign-up, adding a passkey, the step-up of a new backup code):
//              purpose, the account it is bound to, the pending data, 5 minutes; taken by a DELETE
//              that must remove exactly that row (single use) — storeChallenge / takeChallenge
//   signed     the login's, which writes nothing when it is handed out: an anonymous caller may ask
//              for as many as they like without spending the Free plan's 100 000 rows written a day.
//              32 random bytes, the purpose and the expiry, tagged with HMAC-SHA-256 under the
//              pepper — loginChallenge / checkLoginChallenge. Once an assertion over it has
//              verified, it is recorded as spent: a row of purpose login keyed by the challenge, so a
//              second use fails on the primary key (spentStatement, in the login's own batch).
// Expired challenges and sessions are swept at most once an hour per isolate (no cron, Pattern 9).

import { decodeClientDataJSON, isoBase64URL } from "@simplewebauthn/server/helpers";
import { toBase64Url } from "@toc/protocol";
import type { Meter } from "../db.ts";
import { json } from "../http.ts";

/** How long a challenge may be answered. */
export const CHALLENGE_MS = 5 * 60_000;
/** How long the system dialog may stay up (the challenge lives longer). */
export const CEREMONY_TIMEOUT_MS = 120_000;
const SWEEP_EVERY_MS = 3600_000;

export type Purpose = "register" | "login" | "add" | "recover" | "stepup";

let lastSweep = 0;
let configLogged = false;

/** The pepper secret, or the 503 answer when it is missing (logged once per isolate, never its value). */
export function pepperOf(env: Env): string | Response {
  if (env.TOC_PEPPER !== undefined && env.TOC_PEPPER !== "") return env.TOC_PEPPER;
  if (!configLogged) {
    configLogged = true;
    console.error(
      "TOC_PEPPER is not set: accounts are closed until `wrangler secret put TOC_PEPPER`",
    );
  }
  return json({ error: "config" }, 503);
}

/** The challenge a ceremony's answer signed (its clientDataJSON), or null when it cannot be read. */
export function challengeOf(clientDataJSON: string): string | null {
  let challenge: unknown;
  try {
    challenge = decodeClientDataJSON(clientDataJSON).challenge;
  } catch {
    return null;
  }
  if (typeof challenge !== "string" || challenge.length === 0 || challenge.length > 128) {
    return null;
  }
  return challenge;
}

/** At most once an hour per isolate: the expired challenges and sessions go. */
export async function sweep(meter: Meter, now: number): Promise<void> {
  if (now - lastSweep < SWEEP_EVERY_MS) return;
  lastSweep = now;
  await meter.batch([
    meter.prepare("DELETE FROM challenges WHERE expires_at < ?").bind(now),
    meter.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now),
  ]);
}

// --- Stored challenges ---

export type StoredChallenge = {
  challenge: string;
  purpose: Exclude<Purpose, "login">;
  /** The account the ceremony is bound to; null for a sign-up (no account yet). */
  userId: string | null;
  pending?: string | null;
};

/** Writes a ceremony's challenge row, valid CHALLENGE_MS (and sweeps the old ones first). */
export async function storeChallenge(
  meter: Meter,
  stored: StoredChallenge,
  now: number,
): Promise<void> {
  await sweep(meter, now);
  await meter.run(
    meter
      .prepare(
        `INSERT INTO challenges (challenge, purpose, user_id, pending, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(
        stored.challenge,
        stored.purpose,
        stored.userId,
        stored.pending ?? null,
        now + CHALLENGE_MS,
      ),
  );
}

/**
 * Takes (deletes) the challenge row of this purpose and account, still valid: single use, whatever
 * comes next. Its pending data (null when it has none), or undefined when there is no such row (spent,
 * expired, another purpose, another account).
 */
export async function takeChallenge(
  meter: Meter,
  challenge: string,
  purpose: Exclude<Purpose, "login">,
  userId: string | null,
  now: number,
): Promise<string | null | undefined> {
  const taken = await meter.first<{ pending: string | null }>(
    meter
      .prepare(
        `DELETE FROM challenges
          WHERE challenge = ? AND purpose = ? AND user_id IS ? AND expires_at > ?
         RETURNING pending`,
      )
      .bind(challenge, purpose, userId, now),
  );
  return taken === null ? undefined : taken.pending;
}

// --- The signed login challenge ---

const VERSION = 1;
const PURPOSE_LOGIN = 1;
const NONCE_BYTES = 32;
const TAG_BYTES = 32;
/** version, purpose, expiry (8 bytes), nonce. */
const BODY_BYTES = 2 + 8 + NONCE_BYTES;
const LABEL = new TextEncoder().encode("toc.challenge.v1:");

async function tagOf(pepper: string, body: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = new Uint8Array(LABEL.length + body.length);
  data.set(LABEL, 0);
  data.set(body, LABEL.length);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, data));
}

/** A login challenge made at `now`, valid CHALLENGE_MS: base64url of body || tag. */
export async function loginChallenge(pepper: string, now: number): Promise<string> {
  const bytes = new Uint8Array(BODY_BYTES + TAG_BYTES);
  const view = new DataView(bytes.buffer);
  bytes[0] = VERSION;
  bytes[1] = PURPOSE_LOGIN;
  view.setBigUint64(2, BigInt(Math.floor(now + CHALLENGE_MS)));
  crypto.getRandomValues(bytes.subarray(10, BODY_BYTES));
  bytes.set(await tagOf(pepper, bytes.subarray(0, BODY_BYTES)), BODY_BYTES);
  return toBase64Url(bytes);
}

/**
 * The expiry of a login challenge we signed, still valid at `now`; null for anything else (another
 * shape, a tag that does not match, expired). Checked before any D1 read.
 */
export async function checkLoginChallenge(
  pepper: string,
  challenge: string,
  now: number,
): Promise<number | null> {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(isoBase64URL.toBuffer(challenge));
  } catch {
    return null;
  }
  if (bytes.length !== BODY_BYTES + TAG_BYTES || toBase64Url(bytes) !== challenge) return null;
  if (bytes[0] !== VERSION || bytes[1] !== PURPOSE_LOGIN) return null;
  const expected = await tagOf(pepper, bytes.subarray(0, BODY_BYTES));
  const given = bytes.slice(BODY_BYTES);
  if (!crypto.subtle.timingSafeEqual(expected, given)) return null;
  const expiresAt = Number(new DataView(bytes.buffer, bytes.byteOffset).getBigUint64(2));
  return expiresAt > now ? expiresAt : null;
}

/** Whether a login challenge was already spent (one read; the batch's primary key closes the race). */
export async function isSpent(meter: Meter, challenge: string): Promise<boolean> {
  const row = await meter.first(
    meter.prepare("SELECT 1 AS one FROM challenges WHERE challenge = ?").bind(challenge),
  );
  return row !== null;
}

/** The row that marks a login challenge as spent, for the login's batch (fails if already there). */
export function spentStatement(
  meter: Meter,
  challenge: string,
  expiresAt: number,
): D1PreparedStatement {
  return meter
    .prepare(
      `INSERT INTO challenges (challenge, purpose, user_id, pending, expires_at)
       VALUES (?, 'login', NULL, NULL, ?)`,
    )
    .bind(challenge, expiresAt);
}
