// Presence, the pause and the chef de table (plan 02-06, D-04, D-05, NET-03, NET-04; 02-RESEARCH
// Patterns 6 and 7, Pitfall 5). Pure: the clock is the caller's `now`; every function edits a table the
// reducer already copied.
//
// - A seated person whose seat is not handed over goes missing (their last socket closed, or the
//   Durable Object's sweep found it silent for SILENCE_MS) while a game runs → the game is paused for
//   everyone, in every phase (PAUSE_IN_ALL_PHASES): the computer's pending move is dropped, acts are
//   refused, and the pauseChoice deadline is armed one minute later. Another missing seat joins the
//   list; the minute does not move.
// - At pauseChoice (the alarm's tick) the host is choosing, unless no seated person is online: then
//   the game is saved by itself.
// - The host's choices: wait (a fresh minute), bot (every missing seat handed over to the computer at
//   the chosen level, Galopeur by default, and play goes on), save (status saved, nothing runs).
// - A missing person's hello: online again; when nobody is missing any more the game goes on. A
//   handed-over seat is given back at once and a pending computer move for it is dropped.
// - Resume (host, saved only): play goes on when every seated person is online, else the pause flow
//   starts at once with a fresh minute.
// - The host is derived, never stored (Pattern 6): in the waiting room the creator; in a game the
//   creator while online, else the first seated person online clockwise from the creator's seat
//   (COLORS order), else nobody. It returns to the creator by itself.
// - The sweep deadline wakes the Durable Object every SWEEP_MS while a game runs or waits with a
//   seated person online, so silent sockets are found (the object closes them; its tick here only
//   re-arms itself).
// - Stop (plan 02-07, SC4): the host saves a running or paused game at any moment, in any phase.
// - Expiry (plan 02-07, D-06; 02-RESEARCH Pattern 3): the expire deadline is not moved by each
//   activity. When it fires before lastActivity + EXPIRY_MS it is re-armed at that time; at or after
//   it the table is purged (the Durable Object deletes its whole storage and closes every socket).

import type { BotLevel } from "@toc/bots";
import { COLORS, type Color, nextColor } from "@toc/engine";
import type { PauseChoice } from "@toc/protocol";
import { scheduleBot } from "./bots.ts";
import { EXPIRY_MS, personOf, type Table } from "./table.ts";

/** The pause's minute before the host may choose (D-04). */
export const PAUSE_MS = 60_000;
/** How often the Durable Object looks for silent sockets while a game runs or waits (A3). */
export const SWEEP_MS = 30_000;
/**
 * A socket with no sign of life (no ping answered, no hello) for this long is closed and its person
 * is gone (A3: the client pings every 20 s; hidden tabs' timers may slow to one a minute). To tune at
 * UAT on real phones.
 */
export const SILENCE_MS = 75_000;

/** The computer's level for a handed-over seat when the host does not choose one (A5): Galopeur. */
export const HANDOVER_LEVEL: BotLevel = 3;

/** The pause's minute of this table (the test option shortens it). */
export function pauseMsOf(table: Table): number {
  return table.test?.pauseMs ?? PAUSE_MS;
}

/** Whether the seat's person is at the table now. */
function seatOnline(table: Table, color: Color): boolean {
  const seat = table.seats[color];
  return seat.kind === "human" && personOf(table, seat.who)?.online === true;
}

/** A person's seat whose person is away and that the computer does not play: the game waits for it. */
function missingSeat(table: Table, color: Color): boolean {
  const seat = table.seats[color];
  return seat.kind === "human" && (seat.handedOver ?? null) === null && !seatOnline(table, color);
}

/** Some seated person is online. */
function anyoneSeatedOnline(table: Table): boolean {
  return COLORS.some((color) => seatOnline(table, color));
}

/** The `who` of the chef de table now, or null (D-05). */
export function hostOf(table: Table): string | null {
  const creatorId = table.creator;
  if (creatorId === null) return null;
  const creator = personOf(table, creatorId);
  if (table.status === "lobby" || creator?.online === true) return creatorId;
  let color = creator?.seat ?? COLORS[0];
  for (let i = 0; i < COLORS.length; i++) {
    color = nextColor(color);
    const seat = table.seats[color];
    if (seat.kind === "human" && seatOnline(table, color)) return seat.who;
  }
  return null;
}

function setChoiceAt(table: Table, at: number): void {
  if (table.pause !== null) table.pause.choiceAt = at;
  table.deadlines.pauseChoice = { at };
}

/** Pauses the game for `missing` from `now`: no computer runs, the minute starts. */
function startPause(table: Table, missing: Color[], now: number): void {
  table.status = "paused";
  table.pause = { missing, since: now, choiceAt: now + pauseMsOf(table), choosing: false };
  setChoiceAt(table, table.pause.choiceAt);
  scheduleBot(table, [], now);
}

/** Back to play: no pause, no minute, the computer due (if any) from `now`. */
function play(table: Table, now: number): void {
  table.status = "playing";
  table.pause = null;
  delete table.deadlines.pauseChoice;
  scheduleBot(table, [], now);
}

/** Saved: nothing runs until the host resumes. */
function save(table: Table, now: number): void {
  table.status = "saved";
  table.pause = null;
  delete table.deadlines.pauseChoice;
  scheduleBot(table, [], now);
}

/** After `who` went offline (their last socket closed or was swept). */
export function onGone(table: Table, who: string, now: number): void {
  const seat = personOf(table, who)?.seat ?? null;
  if (seat === null || !missingSeat(table, seat)) return;
  if (table.status === "playing") {
    // Nothing to wait for once the game is won (02-09 brings the rematch).
    if (table.game === null || table.game.phase === "won") return;
    startPause(table, [seat], now);
    return;
  }
  if (table.status !== "paused" || table.pause === null) return;
  if (!table.pause.missing.includes(seat)) table.pause.missing.push(seat);
  // The host is choosing and nobody is left to choose: the game is kept.
  if (table.pause.choosing && !anyoneSeatedOnline(table)) save(table, now);
}

/**
 * After `who` said hello (online again). Returns whether their seat was handed over and is theirs
 * again (« Tu reprends ta place. »).
 */
export function onHello(table: Table, who: string, now: number): { regained: boolean } {
  const color = personOf(table, who)?.seat ?? null;
  if (color === null || table.status === "lobby") return { regained: false };
  const seat = table.seats[color];
  let regained = false;
  if (seat.kind === "human" && (seat.handedOver ?? null) !== null) {
    seat.handedOver = null;
    regained = true;
  }
  if (table.status === "paused" && table.pause !== null) {
    table.pause.missing = table.pause.missing.filter((each) => missingSeat(table, each));
    if (table.pause.missing.length === 0) play(table, now);
    return { regained };
  }
  // A computer's pending move for a seat given back is dropped (scheduleBot re-checks it).
  if (regained && table.status === "playing") scheduleBot(table, [], now);
  return { regained };
}

/** The pauseChoice deadline is due: the host chooses, or the game is saved when nobody is online. */
export function onPauseChoiceDue(table: Table, now: number): void {
  delete table.deadlines.pauseChoice;
  if (table.status !== "paused" || table.pause === null || table.pause.choosing) return;
  if (!anyoneSeatedOnline(table)) {
    save(table, now);
    return;
  }
  table.pause.choosing = true;
}

/** The host's choice once the minute is over (the reducer checked the host and `choosing`). */
export function applyChoice(
  table: Table,
  choice: PauseChoice,
  level: BotLevel | undefined,
  now: number,
): void {
  const pause = table.pause;
  if (pause === null) return;
  if (choice === "wait") {
    pause.choosing = false;
    setChoiceAt(table, now + pauseMsOf(table));
    return;
  }
  if (choice === "save") {
    save(table, now);
    return;
  }
  for (const color of pause.missing) {
    const seat = table.seats[color];
    if (seat.kind === "human") seat.handedOver = level ?? HANDOVER_LEVEL;
  }
  play(table, now);
}

/** « Reprendre la partie » (the reducer checked the host and the saved status). */
export function resume(table: Table, now: number): void {
  const missing = COLORS.filter((color) => missingSeat(table, color));
  if (missing.length === 0) play(table, now);
  else startPause(table, missing, now);
}

/** « Arrêter la partie » (the reducer checked the host and that a game runs or is paused). */
export function stopGame(table: Table, now: number): void {
  save(table, now);
}

/**
 * The expire deadline is due: true when the table has been idle for EXPIRY_MS (it must be purged);
 * else the deadline moves to lastActivity + EXPIRY_MS and false.
 */
export function onExpireDue(table: Table, now: number): boolean {
  const end = table.lastActivity + EXPIRY_MS;
  if (now >= end) return true;
  table.deadlines.expire = { at: end };
  return false;
}

/** Whether the sweep deadline should be armed: a game runs or waits with a seated person online. */
export function wantsSweep(table: Table): boolean {
  return (table.status === "playing" || table.status === "paused") && anyoneSeatedOnline(table);
}
