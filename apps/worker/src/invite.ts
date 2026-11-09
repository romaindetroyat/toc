// « Inviter » a friend to one's table (plan 04-06, D-07, ACCT-04; 04-RESEARCH Pattern 10, T-04-09,
// T-04-50). From a waiting room, any signed-in person at the table invites one of their friends in
// one call:
//   POST /api/tables/:id/invite { friendId }
// The checks, in this order (the cheap ones first, nothing written before the last two):
//   our own non-null Origin (403 origin), a JSON body of that shape (415, 413, 400), a session (401),
//   the table id's format (404), the friendship in D1 (403 not-friend: oneself, a stranger, an id of
//   no one), the table's GameRoom.inviteInfo (404 no table; 403 not-here: the caller is no person of
//   it; 409 started: playing, paused, saved or finished), the friend already there (200 here, no
//   notice), the caller's PlayerHub allow({ kind: "invite", max: 30, windowMs: 1 hour }) (429 rate),
//   then the friend's PlayerHub notify({ kind: "invite", table, from: pseudo, key: sender:table }).
// The hub answers notice (the app is open and visible), away (plan 04-07 sends a push) or dup (the
// same invite within 10 minutes): all three are « sent » to the caller. The notice carries the
// table id, the caller's pseudo and the kind, never an account id (T-04-51).

import { isTableId, type TableInviteAnswer, TableInviteBody } from "@toc/protocol";
import { sessionUser } from "./auth/session.ts";
import type { Meter } from "./db.ts";
import { json, notAllowed, readJson, writeAllowed } from "./http.ts";

/** Invites one sender may send in INVITE_WINDOW_MS (the same one again counts too). */
export const INVITES_PER_HOUR = 30;
const INVITE_WINDOW_MS = 3600_000;

/** POST /api/tables/:id/invite (the router matched the path). */
export async function inviteRoute(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  id: string,
): Promise<Response> {
  if (request.method !== "POST") return notAllowed("POST");
  if (!writeAllowed(request, url)) return json({ error: "origin" }, 403);
  const read = await readJson(request, TableInviteBody);
  if (!read.ok) return read.response;
  const now = Date.now();
  const user = await sessionUser(request, url, env, meter, now);
  if (user === null) return json({ error: "signed-out" }, 401);
  if (!isTableId(id)) return json({ error: "not-found" }, 404);

  const friendId = read.body.friendId;
  const friendship =
    friendId === user.id
      ? null
      : await meter.first<{ one: number }>(
          meter
            .prepare("SELECT 1 AS one FROM friendships WHERE user_id = ? AND friend_id = ?")
            .bind(user.id, friendId),
        );
  if (friendship === null) return json({ error: "not-friend" }, 403);

  const info = await env.GAME_ROOM.getByName(id).inviteInfo({ sender: user.id, friend: friendId });
  if (info === null) return json({ error: "not-found" }, 404);
  if (!info.senderHere) return json({ error: "not-here" }, 403);
  if (info.status !== "lobby") return json({ error: "started" }, 409);
  if (info.friendHere) return json({ state: "here" } satisfies TableInviteAnswer, 200);

  const allowed = await env.PLAYER_HUB.getByName(user.id).allow({
    kind: "invite",
    max: INVITES_PER_HOUR,
    windowMs: INVITE_WINDOW_MS,
    now,
  });
  if (!allowed) return json({ error: "rate" }, 429);

  try {
    await env.PLAYER_HUB.getByName(friendId).notify({
      kind: "invite",
      table: id,
      from: user.pseudo,
      key: `${user.id}:${id}`,
      account: friendId,
      now,
    });
  } catch (error) {
    console.error(
      "table invite: the friend's hub failed",
      error instanceof Error ? error.message : error,
    );
    return json({ error: "server" }, 500);
  }
  return json({ state: "sent" } satisfies TableInviteAnswer, 200);
}
