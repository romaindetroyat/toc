// Friends (plan 04-05, ACCT-03, D-03, D-06, D-11; 04-RESEARCH Pattern 5, T-04-04). Every write needs
// our own non-null Origin (the router) and a session; every POST a JSON body (readJson).
//   POST   /api/invitations              a new link: 16 random bytes for its code (22 characters)
//                                        and as many for its opaque id; D1 keeps SHA-256 of the code
//                                        only; 7 days, single use; at most MAX_PENDING_INVITATIONS
//                                        pending per account, checked inside the INSERT itself so two
//                                        parallel calls cannot pass the limit (409 limit)
//   GET    /api/invitations              the caller's pending links { id, createdAt, expiresAt },
//                                        newest first (the codes cannot be shown again: hashes only)
//   DELETE /api/invitations/:id          one of the caller's pending links goes (its code is then
//                                        unknown); 404 for anything else
//   GET    /api/invitations/:code        the state (auth/signup.ts invitationRoute)
//   POST   /api/invitations/:code/accept a signed-in proche opens someone else's link: the same
//                                        guarded claim as the sign-up (used_at), then one batch with
//                                        the two friendship rows and used_by; one's own link (409 own)
//                                        and a friend's link (200 already) are not spent
//   POST   /api/friends/code             the caller's friend code: 8 Crockford symbols (40 bits),
//                                        24 hours, kept in `invitations` (kind 'code') as an HMAC
//                                        under the TOC_PEPPER secret, never in clear; the newest
//                                        replaces the older one (201 { code, expiresAt })
//   POST   /api/friends/code/redeem      { code } typed by another signed-in player: 400 format (not
//                                        counted); the requester's PlayerHub allows 10 failures an
//                                        hour, charged before the lookup (429 rate, nothing looked
//                                        up) and given back unless the code was unknown or expired
//                                        (404 unknown); 409 own; 200 { already, friend }; 200 { friend }
//                                        with the two rows. The code stays valid until it expires.
//   GET    /api/friends                  the caller's friends { id, pseudo, since }, in French
//                                        alphabetical order (localeCompare fr, base)
//   DELETE /api/friends/:id              the friendship goes, both directions in one statement (204)
// A friendship is two rows of `friendships`, one per direction (D-06). Nothing here searches a pseudo:
// a friendship needs a link, a code or a sign-up through an invitation.

import {
  EmptyBody,
  FRIEND_CODE_TTL_MS,
  FriendCodeRedeemBody,
  type FriendEntry,
  INVITATION_RE,
  INVITE_TTL_MS,
  MAX_PENDING_INVITATIONS,
  newFriendCode,
  normalizeFriendCode,
  type PendingInvitation,
  toBase64Url,
} from "@toc/protocol";
import { pepperOf } from "./auth/challenge.ts";
import { sessionUser } from "./auth/session.ts";
import { stateOf } from "./auth/signup.ts";
import type { Meter } from "./db.ts";
import { json, notAllowed, randomUrl, readJson, sha256Url, writeAllowed } from "./http.ts";

const noContent = () =>
  new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
const signedOut = () => json({ error: "signed-out" }, 401);

type Route = (request: Request, env: Env, url: URL, meter: Meter, now: number) => Promise<Response>;

/** POST /api/invitations: 201 { id, code, expiresAt }, or 409 { error: "limit" }. */
export const createInvitation: Route = async (request, env, url, meter, now) => {
  const read = await readJson(request, EmptyBody);
  if (!read.ok) return read.response;
  const user = await sessionUser(request, url, env, meter, now);
  if (user === null) return signedOut();
  const code = randomUrl(16);
  const id = randomUrl(16);
  const expiresAt = now + INVITE_TTL_MS;
  // One statement: D1 runs it alone, so the count and the insert cannot interleave with another call.
  const inserted = await meter.run(
    meter
      .prepare(
        `INSERT INTO invitations (code_hash, id, kind, inviter_id, created_at, expires_at)
         SELECT ?, ?, 'link', ?, ?, ?
          WHERE (SELECT COUNT(*) FROM invitations
                  WHERE inviter_id = ? AND kind = 'link' AND used_at IS NULL AND expires_at > ?) < ?`,
      )
      .bind(
        await sha256Url(code),
        id,
        user.id,
        now,
        expiresAt,
        user.id,
        now,
        MAX_PENDING_INVITATIONS,
      ),
  );
  if (inserted.meta.changes !== 1) return json({ error: "limit" }, 409);
  return json({ id, code, expiresAt }, 201);
};

type PendingRow = { id: string; created_at: number; expires_at: number };

/** GET /api/invitations: the caller's pending links, newest first. */
export const listInvitations: Route = async (request, env, url, meter, now) => {
  const user = await sessionUser(request, url, env, meter, now);
  if (user === null) return signedOut();
  const found = await meter.all<PendingRow>(
    meter
      .prepare(
        `SELECT id, created_at, expires_at FROM invitations
          WHERE inviter_id = ? AND kind = 'link' AND used_at IS NULL AND expires_at > ?
          ORDER BY created_at DESC, id DESC LIMIT ?`,
      )
      .bind(user.id, now, MAX_PENDING_INVITATIONS),
  );
  const pending: PendingInvitation[] = found.results.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  }));
  return json(pending, 200);
};

/** DELETE /api/invitations/:id (the router checked our Origin): 204, or 404. */
function disableInvitation(id: string): Route {
  return async (request, env, url, meter, now) => {
    const user = await sessionUser(request, url, env, meter, now);
    if (user === null) return signedOut();
    if (!INVITATION_RE.test(id)) return json({ error: "not-found" }, 404);
    const removed = await meter.run(
      meter
        .prepare(
          `DELETE FROM invitations
            WHERE id = ? AND inviter_id = ? AND kind = 'link' AND used_at IS NULL`,
        )
        .bind(id, user.id),
    );
    return removed.meta.changes === 1 ? noContent() : json({ error: "not-found" }, 404);
  };
}

/** The friendship of `userId` with `friendId`, as `userId` sees it, or null. */
async function friendOf(
  meter: Meter,
  userId: string,
  friendId: string,
): Promise<FriendEntry | null> {
  const row = await meter.first<{ id: string; pseudo: string; since: number }>(
    meter
      .prepare(
        `SELECT u.id, u.pseudo, f.created_at AS since
           FROM friendships f JOIN users u ON u.id = f.friend_id
          WHERE f.user_id = ? AND f.friend_id = ?`,
      )
      .bind(userId, friendId),
  );
  return row === null ? null : { id: row.id, pseudo: row.pseudo, since: row.since };
}

/** The two rows of a friendship (INSERT OR IGNORE: a row already there stays as it was). */
function befriend(meter: Meter, a: string, b: string, now: number): D1PreparedStatement[] {
  const insert = meter.prepare(
    "INSERT OR IGNORE INTO friendships (user_id, friend_id, created_at) VALUES (?, ?, ?)",
  );
  return [insert.bind(a, b, now), insert.bind(b, a, now)];
}

/** POST /api/invitations/:code/accept (the router checked our Origin). */
function acceptInvitation(code: string): Route {
  return async (request, env, url, meter, now) => {
    const read = await readJson(request, EmptyBody);
    if (!read.ok) return read.response;
    const user = await sessionUser(request, url, env, meter, now);
    if (user === null) return signedOut();
    const state = await stateOf(code, env, meter, now);
    if (state.state !== "ok" || state.bootstrap === true) {
      return json({ error: state.state === "ok" ? "unknown" : state.state }, 410);
    }
    const inviterId = state.inviterId;
    // A test invitation (TOC_TEST_MODE) has no inviter: nobody to befriend.
    if (typeof inviterId !== "string" || state.hash === undefined) {
      return json({ error: "unknown" }, 410);
    }
    if (inviterId === user.id) return json({ error: "own" }, 409);
    const known = await friendOf(meter, user.id, inviterId);
    if (known !== null) return json({ already: true, friend: known }, 200);

    // The claim (Pitfall 6), as at the sign-up: only while unused and unexpired.
    const claimed = await meter.run(
      meter
        .prepare(
          `UPDATE invitations SET used_at = ?
            WHERE code_hash = ? AND used_at IS NULL AND expires_at > ?`,
        )
        .bind(now, state.hash, now),
    );
    if (claimed.meta.changes !== 1) {
      const after = await stateOf(code, env, meter, now);
      return json(
        {
          error:
            after.state === "expired" ? "expired" : after.state === "unknown" ? "unknown" : "used",
        },
        410,
      );
    }
    try {
      await meter.batch([
        ...befriend(meter, inviterId, user.id, now),
        meter
          .prepare("UPDATE invitations SET used_by = ? WHERE code_hash = ?")
          .bind(user.id, state.hash),
      ]);
    } catch (error) {
      // Nothing of the batch was written: the link is free again.
      await meter.run(
        meter
          .prepare("UPDATE invitations SET used_at = NULL WHERE code_hash = ? AND used_by IS NULL")
          .bind(state.hash),
      );
      console.error("accept batch failed", error instanceof Error ? error.message : String(error));
      return json({ error: "server" }, 500);
    }
    return json(
      { friend: { id: inviterId, pseudo: state.inviter ?? "", since: now } satisfies FriendEntry },
      200,
    );
  };
}

// --- Friend codes, the list, the removal ---

/** Failed friend codes allowed per requester and hour (T-04-44). */
export const CODE_FAILURES = 10;
const CODE_WINDOW_MS = 3600_000;
const CODE_FAIL = "code-fail";

/** How a friend code is kept: base64url HMAC-SHA-256 under the pepper (40 bits: a bare hash is guessable). */
async function codeMac(pepper: string, code: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`friend-code:${code}`));
  return toBase64Url(new Uint8Array(mac));
}

/** POST /api/friends/code: 201 { code, expiresAt }; the caller's older code stops working. */
const createFriendCode: Route = async (request, env, url, meter, now) => {
  const read = await readJson(request, EmptyBody);
  if (!read.ok) return read.response;
  const user = await sessionUser(request, url, env, meter, now);
  if (user === null) return signedOut();
  const pepper = pepperOf(env);
  if (pepper instanceof Response) return pepper;
  const expiresAt = now + FRIEND_CODE_TTL_MS;
  // Two codes of 40 bits may meet (the primary key refuses the second): draw again, a few times.
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = newFriendCode();
    try {
      await meter.batch([
        meter
          .prepare("DELETE FROM invitations WHERE inviter_id = ? AND kind = 'code'")
          .bind(user.id),
        meter
          .prepare(
            `INSERT INTO invitations (code_hash, id, kind, inviter_id, created_at, expires_at)
             VALUES (?, ?, 'code', ?, ?, ?)`,
          )
          .bind(await codeMac(pepper, code), randomUrl(16), user.id, now, expiresAt),
      ]);
      return json({ code, expiresAt }, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/UNIQUE|constraint/i.test(message)) {
        console.error("friend code failed", message);
        return json({ error: "server" }, 500);
      }
    }
  }
  return json({ error: "server" }, 500);
};

type CodeRow = { inviter_id: string | null; expires_at: number; pseudo: string | null };

/** POST /api/friends/code/redeem (the router checked our Origin). */
const redeemFriendCode: Route = async (request, env, url, meter, now) => {
  const read = await readJson(request, FriendCodeRedeemBody);
  if (!read.ok) return read.response;
  const user = await sessionUser(request, url, env, meter, now);
  if (user === null) return signedOut();
  const pepper = pepperOf(env);
  if (pepper instanceof Response) return pepper;
  const code = normalizeFriendCode(read.body.code);
  if (code === null) return json({ error: "format" }, 400);

  // Charged before the lookup, so the eleventh failure in the hour is never looked up, even in
  // parallel; given back below when the code was not a failure.
  const hub = env.PLAYER_HUB.getByName(user.id);
  if (!(await hub.allow({ kind: CODE_FAIL, max: CODE_FAILURES, windowMs: CODE_WINDOW_MS, now }))) {
    return json({ error: "rate" }, 429);
  }
  const row = await meter.first<CodeRow>(
    meter
      .prepare(
        `SELECT i.inviter_id, i.expires_at, u.pseudo
           FROM invitations i JOIN users u ON u.id = i.inviter_id
          WHERE i.code_hash = ? AND i.kind = 'code'`,
      )
      .bind(await codeMac(pepper, code)),
  );
  if (row === null || row.inviter_id === null || row.expires_at <= now) {
    return json({ error: "unknown" }, 404);
  }
  await hub.release({ kind: CODE_FAIL, at: now });
  const friendId = row.inviter_id;
  if (friendId === user.id) return json({ error: "own" }, 409);
  const known = await friendOf(meter, user.id, friendId);
  if (known !== null) return json({ already: true, friend: known }, 200);
  await meter.batch(befriend(meter, friendId, user.id, now));
  const friend: FriendEntry = { id: friendId, pseudo: row.pseudo ?? "", since: now };
  return json({ friend }, 200);
};

type FriendRow = { id: string; pseudo: string; since: number };

/** The most friends GET /api/friends answers (a family circle is far below). */
const MAX_FRIENDS = 500;

/** GET /api/friends: the caller's friends, in French alphabetical order. */
const listFriends: Route = async (request, env, url, meter, now) => {
  const user = await sessionUser(request, url, env, meter, now);
  if (user === null) return signedOut();
  const found = await meter.all<FriendRow>(
    meter
      .prepare(
        `SELECT u.id, u.pseudo, f.created_at AS since
           FROM friendships f JOIN users u ON u.id = f.friend_id
          WHERE f.user_id = ? LIMIT ?`,
      )
      .bind(user.id, MAX_FRIENDS),
  );
  const list: FriendEntry[] = found.results.map((row) => ({
    id: row.id,
    pseudo: row.pseudo,
    since: row.since,
  }));
  list.sort(
    (a, b) =>
      a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" }) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  return json(list, 200);
};

/** DELETE /api/friends/:id (the router checked our Origin): 204, or 404 when not a friend. */
function removeFriend(id: string): Route {
  return async (request, env, url, meter, now) => {
    const user = await sessionUser(request, url, env, meter, now);
    if (user === null) return signedOut();
    if (!INVITATION_RE.test(id)) return json({ error: "not-found" }, 404);
    const removed = await meter.run(
      meter
        .prepare(
          `DELETE FROM friendships
            WHERE (user_id = ?1 AND friend_id = ?2) OR (user_id = ?2 AND friend_id = ?1)`,
        )
        .bind(user.id, id),
    );
    return removed.meta.changes > 0 ? noContent() : json({ error: "not-found" }, 404);
  };
}

/** A write route: our own non-null Origin first (403). */
function guarded(request: Request, url: URL, route: Route): Route | Response {
  return writeAllowed(request, url) ? route : json({ error: "origin" }, 403);
}

/** The route of a friends path and method, a Response (405, 403) or null for another path. */
function pick(request: Request, url: URL): Route | Response | null {
  const path = url.pathname;
  const method = request.method;
  const read = method === "GET" || method === "HEAD";
  if (path === "/api/invitations") {
    if (method === "POST") return guarded(request, url, createInvitation);
    return read ? listInvitations : notAllowed("GET, POST");
  }
  const accept = /^\/api\/invitations\/([^/]*)\/accept$/.exec(path);
  if (accept !== null) {
    if (method !== "POST") return notAllowed("POST");
    return guarded(request, url, acceptInvitation(accept[1] ?? ""));
  }
  if (path === "/api/friends") return read ? listFriends : notAllowed("GET");
  if (path === "/api/friends/code") {
    return method === "POST" ? guarded(request, url, createFriendCode) : notAllowed("POST");
  }
  if (path === "/api/friends/code/redeem") {
    return method === "POST" ? guarded(request, url, redeemFriendCode) : notAllowed("POST");
  }
  const friend = /^\/api\/friends\/([^/]*)$/.exec(path);
  if (friend !== null) {
    return method === "DELETE"
      ? guarded(request, url, removeFriend(friend[1] ?? ""))
      : notAllowed("DELETE");
  }
  const one = /^\/api\/invitations\/([^/]*)$/.exec(path);
  if (one !== null) {
    if (method === "DELETE") return guarded(request, url, disableInvitation(one[1] ?? ""));
    if (!read) return notAllowed("GET, DELETE");
    return null;
  }
  return null;
}

/**
 * The friends routes (plan 04-05), or null for a path that is not one of them. GET
 * /api/invitations/:code (the state) stays with the sign-up (index.ts → invitationRoute).
 */
export async function socialRoute(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
): Promise<Response | null> {
  const route = pick(request, url);
  if (route === null || route instanceof Response) return route;
  return route(request, env, url, meter, now);
}
