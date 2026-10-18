// When the app may show the card of a notice from its PlayerHub (plan 04-06, D-08; 04-UI-SPEC
// « In-app card »). Pure: the hub connection (hub.svelte.ts) feeds it the notices and the place the
// player is at, and asks GET /api/tables/:id when a held card may come back.
//   decide(notice, place)   « hold » during a game (#/partie, or a table playing, paused or saved), on
//                           the backup-code screen, during a sign-up or a recovery; else « show »
//   release(held, status)   after GET /api/tables/:id: an invite while the table waits in its lobby,
//                           a turn while it is paused → « show »; anything else (404, offline) → « drop »
//   the slot                only the latest notice is kept: a newer one replaces a held or shown one

import type { NoticeFrame, TableStatus } from "@toc/protocol";

/** Where the player is: the hash route (no query), the status of the table at that route if any. */
export type NoticePlace = {
  route: string;
  tableStatus?: TableStatus | null;
  /** A screen that must not be interrupted (sign-up, recovery, the backup code shown once). */
  flow?: "signup" | "recover" | "backup" | null;
};

/** The latest notice and whether it waits (held) or shows; null when there is none. */
export type NoticeSlot = { notice: NoticeFrame; held: boolean } | null;

const GAME_STATUSES: ReadonlySet<TableStatus> = new Set(["playing", "paused", "saved"]);

export function decide(_notice: NoticeFrame, place: NoticePlace): "hold" | "show" {
  if (place.flow !== undefined && place.flow !== null) return "hold";
  if (place.route === "#/partie") return "hold";
  if (place.tableStatus !== undefined && place.tableStatus !== null) {
    if (GAME_STATUSES.has(place.tableStatus)) return "hold";
  }
  return "show";
}

/** A held notice once the table's status is known ("gone": 404, "unknown": no answer). */
export function release(
  held: NoticeFrame,
  status: TableStatus | "gone" | "unknown",
): "show" | "drop" {
  if (held.kind === "invite") return status === "lobby" ? "show" : "drop";
  return status === "paused" ? "show" : "drop";
}

/** A notice arrived: it replaces whatever the slot held, shown or held where the player is. */
export function receive(_slot: NoticeSlot, notice: NoticeFrame, place: NoticePlace): NoticeSlot {
  return { notice, held: decide(notice, place) === "hold" };
}

/**
 * The player moved (or the table's status changed): a shown card is held on entering a game; a held
 * card out of one stays held, and `check` names it so that the table's status is asked first.
 */
export function placeChanged(
  slot: NoticeSlot,
  place: NoticePlace,
): { slot: NoticeSlot; check: NoticeFrame | null } {
  if (slot === null) return { slot, check: null };
  const verdict = decide(slot.notice, place);
  if (verdict === "hold") return { slot: slot.held ? slot : { ...slot, held: true }, check: null };
  return slot.held ? { slot, check: slot.notice } : { slot, check: null };
}

/**
 * The status of a checked notice's table came back: shown or dropped, unless a newer notice replaced
 * it meanwhile (the slot is kept as is) or the player went back into a game (still held).
 */
export function settle(
  slot: NoticeSlot,
  checked: NoticeFrame,
  status: TableStatus | "gone" | "unknown",
  place: NoticePlace,
): NoticeSlot {
  if (slot === null || slot.notice !== checked || !slot.held) return slot;
  if (decide(checked, place) === "hold") return slot;
  return release(checked, status) === "show" ? { notice: checked, held: false } : null;
}
