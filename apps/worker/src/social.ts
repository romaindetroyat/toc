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
// A friendship is two rows of `friendships`, one per direction (D-06). Nothing here searches a pseudo:
// a friendship needs a link, a code or a sign-up through an invitation.

import {
  EmptyBody,
  type FriendEntry,
  INVITATION_RE,
  INVITE_TTL_MS,
  MAX_PENDING_INVITATIONS,
  type PendingInvitation,
} from "@toc/protocol";
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
