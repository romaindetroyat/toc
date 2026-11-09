// The frames of the app's own socket to its PlayerHub (GET /ws/me, plan 04-06, D-07, D-08;
// 04-RESEARCH Pattern 6). The app keeps this socket open on every screen while signed in:
//   client → hub   hi { v }          always first: the hub's own version (a table socket has its own)
//                  vis { visible }   on open after hi, then on every visibility change of the page
//   hub → client   notice { kind, table, from, own?, resumed?, at }   « Romain t’invite à sa table »,
//                  « La table de Romain t’attend » — only to a socket the hub finds present
// The heartbeat is the text "ping", answered "pong" by the runtime without waking the hub. A notice
// carries only the table id (a link the friend may hold anyway), the sender's pseudo (or the table's
// creator for a turn) and the kind: never an account id, a pseudo key or a friend list (T-04-51).

import * as z from "zod/mini";
import { TABLE_ID_RE } from "./names.ts";

/**
 * Bumped when a hub frame changes shape: the hub closes an older app's socket with CLOSE_VERSION
 * (4002), and that app updates (plan 04-08). 1 (plan 04-06): hi, vis, notice.
 */
export const HUB_VERSION = 1;

/** The longest client frame of the hub, in characters, checked before JSON.parse. */
export const MAX_HUB_FRAME_CHARS = 256;

/** The longest `from` of a notice, in code points (a pseudo, or a guest's first name). */
export const NOTICE_FROM_MAX = 20;

export type HubHiFrame = { t: "hi"; v: number };
export type HubVisFrame = { t: "vis"; visible: boolean };
export type HubClientFrame = HubHiFrame | HubVisFrame;

/** invite: a friend invites you to their table (D-07); turn: a table paused for you (Pattern 10). */
export type NoticeKind = "invite" | "turn";

export type NoticeFrame = {
  t: "notice";
  kind: NoticeKind;
  /** The table's id: the friend opens #/table/<id>. */
  table: string;
  /** Who invites, or the creator of the table that waits. */
  from: string;
  /** A turn at the player's own table (« Ta table t’attend »). */
  own?: boolean;
  /** A turn because a saved game was resumed without the player. */
  resumed?: boolean;
  /** The hub's clock when it sent the notice (ms since the epoch). */
  at: number;
};

export type HubServerFrame = NoticeFrame;

const hubClientSchema = z.discriminatedUnion("t", [
  z.strictObject({ t: z.literal("hi"), v: z.int() }),
  z.strictObject({ t: z.literal("vis"), visible: z.boolean() }),
]);

const from = z
  .string()
  .check(z.refine((value) => value.length > 0 && [...value].length <= NOTICE_FROM_MAX));

const hubServerSchema = z.discriminatedUnion("t", [
  z.object({
    t: z.literal("notice"),
    kind: z.enum(["invite", "turn"]),
    table: z.string().check(z.regex(TABLE_ID_RE)),
    from,
    own: z.optional(z.boolean()),
    resumed: z.optional(z.boolean()),
    at: z.int().check(z.minimum(0)),
  }),
]);

function parseText(raw: unknown, max: number): unknown {
  if (typeof raw !== "string" || raw.length > max) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

/** A frame the app sent to its hub, or null (the hub ignores it). */
export function parseHubClientFrame(raw: unknown): HubClientFrame | null {
  const data = parseText(raw, MAX_HUB_FRAME_CHARS);
  if (data === undefined) return null;
  const parsed = hubClientSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}

/** A frame the hub sent to the app, or null (the app ignores it). */
export function parseHubServerFrame(raw: unknown): HubServerFrame | null {
  // A notice is far below the table frames' limit; anything longer is not one.
  const data = parseText(raw, 4 * MAX_HUB_FRAME_CHARS);
  if (data === undefined) return null;
  const parsed = hubServerSchema.safeParse(data);
  return parsed.success ? (parsed.data as HubServerFrame) : null;
}
