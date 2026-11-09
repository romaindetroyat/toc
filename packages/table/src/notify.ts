// « C’est ton tour » (plan 04-07, CONTEXT addendum, 04-RESEARCH Pattern 10). Pure: the clock is the
// caller's `now`. A human who leaves pauses the table for everyone (D-04), so « ton tour » means « the
// table is waiting for you »:
//
// - A seat of the pause's missing list whose person has an account gets notifyAt[seat] = the time it
//   was first seen missing + NOTIFY_AFTER_MS (the test option notifyMs shortens it). A guest's seat
//   gets nothing (no account, no hub, no push).
// - The table's notify deadline is the earliest pending time. At the alarm's tick at or after it
//   (due when at ≤ now: production runs an alarm at exactly its time), each due seat still missing
//   gives one outbox item and its entry becomes null (told, for this absence): never a second time.
// - A seat that stops being missing (its person came back, the chef de table handed it over to the
//   computer, the game was saved or ended) loses its entry, so a pending notice is cancelled.
// - A saved game resumed while account seats are missing tells them at once (resumed), with no 30 s
//   entry for that pause.
// - Nobody who is at the table is ever told: only missing seats (person offline) have entries, and
//   the due check reads the table as it is.
//
// reduce.ts runs settleNotify after every command, so every path that changes the missing list
// (presence.ts startPause, onGone, onHello, applyChoice, resume, stop; a reclaim) is covered in one
// place. The items carry the account ids for the Durable Object only (Reduced.notify, never a frame).

import { COLORS, type Color } from "@toc/engine";
import { hostOf } from "./presence.ts";
import { personOf, type Table } from "./table.ts";

/** The delay before a missing player is told « C’est ton tour » (CONTEXT addendum, à confirmer at UAT). */
export const NOTIFY_AFTER_MS = 30_000;

/**
 * One turn notice for the Durable Object to give to the account's PlayerHub after the commit: the
 * chef de table's name (the creator's pseudo or first name), whether the missing person is the
 * creator (« Ta table t’attend »), whether a saved game was just resumed, and the dedupe key (the
 * table and its pause).
 */
export type TurnNotice = {
  account: string;
  kind: "turn";
  from: string;
  own: boolean;
  resumed: boolean;
  key: string;
};

/** The notice delay of this table (the test option shortens it). */
export function notifyMsOf(table: Table): number {
  return table.test?.notifyMs ?? NOTIFY_AFTER_MS;
}

/** The account of the person of a missing seat, or null (a guest, a free or computer seat). */
function missingAccount(table: Table, color: Color): string | null {
  const seat = table.seats[color];
  if (seat.kind !== "human" || (seat.handedOver ?? null) !== null) return null;
  const person = personOf(table, seat.who);
  if (person === undefined || person.online) return null;
  return person.account ?? null;
}

/**
 * The notice of a missing seat. `from` is the creator (« La table de Marie t’attend »), or for a
 * resumed game the chef de table who resumed it (« Ben a repris la partie »): the creator when they
 * are here, never the missing person themself.
 */
function noticeFor(table: Table, account: string, color: Color, resumed: boolean): TurnNotice {
  const named = resumed ? (hostOf(table) ?? table.creator) : table.creator;
  const person = named === null ? undefined : personOf(table, named);
  const seat = table.seats[color];
  const own = seat.kind === "human" && seat.who === table.creator;
  return {
    account,
    kind: "turn",
    from: person?.name || "TOC",
    own,
    resumed,
    key: `${table.tableId}:${table.pause?.since ?? 0}`,
  };
}

/**
 * The notice schedule after one command, from the table before it and after it. `tick`: the command
 * is the alarm's, the only one that sends due notices. Returns the table to keep (`after` itself when
 * nothing changed, else `after` edited, or a copy of it when it is still `before`) and the items.
 */
export function settleNotify(
  before: Table,
  after: Table,
  now: number,
  tick: boolean,
  copy: (table: Table) => Table,
): { table: Table; notify: TurnNotice[] } {
  const previous = after.notifyAt ?? {};
  const resumed = before.status === "saved" && after.status === "paused";
  const paused = after.status === "paused" && after.pause !== null;
  const wanted: Partial<Record<Color, number | null>> = {};
  const due: Array<{ color: Color; account: string; resumed: boolean }> = [];
  for (const color of COLORS) {
    if (!paused || !after.pause?.missing.includes(color)) continue;
    const account = missingAccount(after, color);
    if (account === null) continue;
    const was = previous[color];
    if (resumed) {
      due.push({ color, account, resumed: true });
      wanted[color] = null;
    } else if (was === undefined) {
      wanted[color] = now + notifyMsOf(after);
    } else if (was !== null && tick && was <= now) {
      due.push({ color, account, resumed: false });
      wanted[color] = null;
    } else {
      wanted[color] = was;
    }
  }
  const times = COLORS.map((color) => wanted[color]).filter(
    (at): at is number => typeof at === "number",
  );
  const deadline = times.length === 0 ? undefined : Math.min(...times);
  const same =
    COLORS.every((color) => previous[color] === wanted[color]) &&
    after.deadlines.notify?.at === deadline;
  if (same && due.length === 0) return { table: after, notify: [] };
  const table = after === before ? copy(after) : after;
  table.notifyAt = wanted;
  if (deadline === undefined) delete table.deadlines.notify;
  else table.deadlines.notify = { at: deadline };
  return {
    table,
    notify: due.map(({ color, account, resumed: again }) =>
      noticeFor(table, account, color, again),
    ),
  };
}
