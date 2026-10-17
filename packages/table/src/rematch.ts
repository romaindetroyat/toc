// The end of an online game and the rematch (plan 02-09, D-08, PLAY-07; 02-RESEARCH Pattern 11, A6).
// Pure: the clock and the deck seed come from the reducer's context; every function edits a table the
// reducer already copied.
//
// - onGameWon: a play that ends in gameWon makes the table « finished »: the winner goes in every
//   table frame (frames.ts), no computer is due any more, the votes start empty, the end time is kept.
// - vote: a seated person agrees to « Revanche » or withdraws; anyone else, or before the end, is
//   refused by the reducer. A person who goes offline (a socket closing, « Quitter la table ») loses
//   their vote and is shown offline.
// - maybeStartRematch: when every seated person online agrees (at least one), a new game starts at the
//   same table: gameNo + 1, the same seats, names and computer strengths, a fresh deck seed (ctx.seed,
//   crypto.getRandomValues in the Durable Object), the seat after the previous first dealer dealing
//   (A6). A person offline at that moment has their seat played by the computer at Galopeur until they
//   come back (onHello gives it back, as after a pause's hand-over; UI-SPEC « à confirmer »).

import {
  COLORS,
  type Color,
  type GameEvent,
  type GameState,
  nextColor,
  type Rng,
  startGame,
} from "@toc/engine";
import type { RematchVote } from "@toc/protocol";
import { HANDOVER_LEVEL } from "./presence.ts";
import { personOf, type Table } from "./table.ts";

/** Whether the person on `color` is at the table now. */
function online(table: Table, color: Color): boolean {
  const seat = table.seats[color];
  return seat.kind === "human" && personOf(table, seat.who)?.online === true;
}

/** After a play: when the game is now won, the table is finished (call before scheduling a computer). */
export function onGameWon(table: Table, now: number): void {
  if (table.game?.phase !== "won" || table.status === "finished") return;
  table.status = "finished";
  table.endedAt = now;
  table.rematch = {};
  table.pause = null;
  delete table.deadlines.pauseChoice;
}

/** Each seat's answer to « Revanche » for the public table, or null when the game is not finished. */
export function rematchVotes(table: Table): Record<Color, RematchVote> | null {
  if (table.status !== "finished") return null;
  const votes = {} as Record<Color, RematchVote>;
  for (const color of COLORS) {
    const seat = table.seats[color];
    if (seat.kind !== "human") votes[color] = "bot";
    else if (!online(table, color)) votes[color] = "offline";
    else votes[color] = table.rematch[color] === true ? "yes" : "no";
  }
  return votes;
}

/**
 * A seated person's vote. Returns false when it is refused: the game is not finished, or `who` has no
 * seat. The vote may be unchanged (the reducer then sends nothing).
 */
export function vote(table: Table, who: string, agree: boolean): boolean {
  if (table.status !== "finished") return false;
  const seat = personOf(table, who)?.seat ?? null;
  if (seat === null) return false;
  if (agree) table.rematch[seat] = true;
  else delete table.rematch[seat];
  return true;
}

/** After `who` went offline at a finished table: their vote is gone (they are shown offline). */
export function dropVote(table: Table, who: string): void {
  const seat = personOf(table, who)?.seat ?? null;
  if (table.status === "finished" && seat !== null) delete table.rematch[seat];
}

/** Whether every seated person online agrees, and there is at least one. */
export function everyoneAgrees(table: Table): boolean {
  if (table.status !== "finished") return false;
  const present = COLORS.filter((color) => online(table, color));
  return present.length > 0 && present.every((color) => table.rematch[color] === true);
}

/**
 * The rematch when everyone online agrees: the new game's state and opening events (the caller
 * commits them as a play), or null when it does not start. Edits `table`: the seats of people offline
 * are handed to the computer at Galopeur, the counters, the times, the status.
 */
export function maybeStartRematch(
  table: Table,
  seed: () => Rng,
  now: number,
): { state: GameState; events: GameEvent[] } | null {
  if (!everyoneAgrees(table)) return null;
  const previous = table.firstDealer ?? table.game?.dealer ?? COLORS[0];
  for (const color of COLORS) {
    const seat = table.seats[color];
    if (seat.kind === "human" && !online(table, color)) {
      seat.handedOver = seat.handedOver ?? HANDOVER_LEVEL;
    }
  }
  const firstDealer = nextColor(previous);
  table.firstDealer = firstDealer;
  table.gameNo += 1;
  table.status = "playing";
  table.startedAt = now;
  table.endedAt = null;
  table.rematch = {};
  table.thinking = null;
  return startGame({ firstDealer }, seed());
}
