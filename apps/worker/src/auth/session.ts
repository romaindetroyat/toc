// Sessions (plan 04-01, ACCT-02; 04-RESEARCH Pattern 4, Pitfall 12). A signed-in browser holds one
// HttpOnly cookie: 32 random bytes in base64url, never readable by a script, never in a URL or an
// answer's body. D1 keeps only SHA-256 of it (sessions.id_hash), so a copy of the database opens no
// account. The cookie is `__Host-toc_session` (Path=/, Secure, no Domain), HttpOnly, SameSite=Lax,
// for 400 days (the longest a browser keeps one). Only under TOC_TEST_MODE over plain http
// (wrangler dev on localhost for Playwright) is it `toc_session` without Secure.
//   createSession(…)   the INSERT for the caller's batch, and the Set-Cookie value
//   sessionUser(…)     the account of the request's cookie, or null (unknown, expired, malformed)
//   clearCookie(…)     the Set-Cookie that expires it (an answer 401 to a dead session, a logout)
//   refresh(…)         the sliding session (plan 04-02, Pattern 4): a session last seen more than
//                      REFRESH_AFTER_MS ago gets seen_at = now, 400 days more and its cookie again;
//                      at most one row written per device per week, so a player who opens the game
//                      once a year never signs in again (ACCT-02)
//   endSession(…)      the logout: this device's row goes (its push subscription with it, cascade)

import { isDeviceToken } from "@toc/protocol";
import type { Meter } from "../db.ts";
import { randomUrl, sha256Url } from "../http.ts";

export const SESSION_DAYS = 400;
/** A session lives 400 days after it was last refreshed (the longest a browser keeps a cookie). */
export const SESSION_TTL_MS = SESSION_DAYS * 24 * 3600 * 1000;
/** A session seen more recently than this is not refreshed (no write). */
export const REFRESH_AFTER_MS = 7 * 24 * 3600 * 1000;
const MAX_AGE = SESSION_DAYS * 24 * 3600;

/** The cookie's name: `__Host-` everywhere but test-mode plain http (Pitfall 12). */
export function cookieName(url: URL, env: Env): string {
  return env.TOC_TEST_MODE === "1" && url.protocol === "http:"
    ? "toc_session"
    : "__Host-toc_session";
}

function attributes(url: URL, env: Env, maxAge: number): string {
  const secure = cookieName(url, env).startsWith("__Host-") ? "; Secure" : "";
  return `Path=/${secure}; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

export function sessionCookie(token: string, url: URL, env: Env): string {
  return `${cookieName(url, env)}=${token}; ${attributes(url, env, MAX_AGE)}`;
}

export function clearCookie(url: URL, env: Env): string {
  return `${cookieName(url, env)}=; ${attributes(url, env, 0)}`;
}

/** The session token of the request's cookie, when it has the shape of one (43 base64url). */
export function readToken(request: Request, url: URL, env: Env): string | null {
  const name = cookieName(url, env);
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const at = part.indexOf("=");
    if (at === -1 || part.slice(0, at).trim() !== name) continue;
    const value = part.slice(at + 1).trim();
    return isDeviceToken(value) ? value : null;
  }
  return null;
}

/** Whether the request carries a session cookie at all (to expire a dead one). */
export function hasCookie(request: Request, url: URL, env: Env): boolean {
  const name = cookieName(url, env);
  return (request.headers.get("cookie") ?? "")
    .split(";")
    .some((part) => part.split("=")[0]?.trim() === name);
}

export type NewSession = { statement: D1PreparedStatement; cookie: string; hash: string };

/** A new session of `userId`, opened with `passkeyId`: the INSERT (for a batch) and the cookie. */
export async function createSession(
  meter: Meter,
  userId: string,
  passkeyId: string,
  now: number,
  url: URL,
  env: Env,
): Promise<NewSession> {
  const token = randomUrl(32);
  const hash = await sha256Url(token);
  const statement = meter
    .prepare(
      `INSERT INTO sessions (id_hash, user_id, passkey_id, created_at, seen_at, expires_at, auth_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(hash, userId, passkeyId, now, now, now + SESSION_TTL_MS, now);
  return { statement, cookie: sessionCookie(token, url, env), hash };
}

export type SessionUser = {
  id: string;
  pseudo: string;
  createdAt: number;
  sessionHash: string;
  passkeyId: string | null;
  authAt: number;
  seenAt: number;
  hasBackupCode: boolean;
  backupAt: number | null;
};

type SessionRow = {
  id_hash: string;
  passkey_id: string | null;
  auth_at: number;
  seen_at: number;
  id: string;
  pseudo: string;
  created_at: number;
  has_backup: number;
  backup_at: number | null;
};

/** The account of the request's session cookie, or null: one D1 read, nothing written. */
export async function sessionUser(
  request: Request,
  url: URL,
  env: Env,
  meter: Meter,
  now: number,
): Promise<SessionUser | null> {
  const token = readToken(request, url, env);
  if (token === null) return null;
  const row = await meter.first<SessionRow>(
    meter
      .prepare(
        `SELECT s.id_hash, s.passkey_id, s.auth_at, s.seen_at, u.id, u.pseudo, u.created_at,
                u.backup_mac IS NOT NULL AS has_backup, u.backup_at
           FROM sessions s JOIN users u ON u.id = s.user_id
          WHERE s.id_hash = ? AND s.expires_at > ?`,
      )
      .bind(await sha256Url(token), now),
  );
  if (row === null) return null;
  return {
    id: row.id,
    pseudo: row.pseudo,
    createdAt: row.created_at,
    sessionHash: row.id_hash,
    passkeyId: row.passkey_id,
    authAt: row.auth_at,
    seenAt: row.seen_at,
    hasBackupCode: row.has_backup === 1,
    backupAt: row.backup_at,
  };
}

/**
 * The sliding refresh of the request's session (`user` from sessionUser): when it was last seen more
 * than REFRESH_AFTER_MS ago, one UPDATE (seen_at = now, expires_at = now + SESSION_TTL_MS) and the
 * Set-Cookie that renews the same token for 400 days; otherwise null and nothing written.
 */
export async function refresh(
  meter: Meter,
  request: Request,
  url: URL,
  env: Env,
  user: SessionUser,
  now: number,
): Promise<string | null> {
  if (now - user.seenAt <= REFRESH_AFTER_MS) return null;
  const token = readToken(request, url, env);
  if (token === null) return null;
  await meter.run(
    meter
      .prepare("UPDATE sessions SET seen_at = ?, expires_at = ? WHERE id_hash = ?")
      .bind(now, now + SESSION_TTL_MS, user.sessionHash),
  );
  return sessionCookie(token, url, env);
}

/** The logout: the request's session row goes (its push subscriptions with it, ON DELETE CASCADE). */
export async function endSession(
  meter: Meter,
  request: Request,
  url: URL,
  env: Env,
): Promise<void> {
  const token = readToken(request, url, env);
  if (token === null) return;
  await meter.run(
    meter.prepare("DELETE FROM sessions WHERE id_hash = ?").bind(await sha256Url(token)),
  );
}
