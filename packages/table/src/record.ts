// The record of a finished game (plan 02-09, HIST-01 support for phase 5, D-14; 02-RESEARCH Pattern
// 12). When a game is won the table keeps one record per game number, pending until the Durable
// Object says it is written (or that there is no database: D1 not created yet). The winning step
// carries it to the object, which writes it after the SQLite commit; a failed write leaves it pending
// and the d1Retry deadline brings it back after 1 minute, then 10, then every hour. Pure: the clock is
// the caller's `now`.
//
// A record holds only what phase 5's history needs and nothing secret (T-02-36): the game number, the
// start and end times, the winning team, each seat's colour, kind, first name or horse name, level and
// hand-over, the number of deals and the captures per team. No table id (the Durable Object stores a
// hash of it), no person id, no token, no card.

import type { BotLevel } from "@toc/bots";
import { COLORS, type Color, type Team } from "@toc/engine";
import { personOf, type Table } from "./table.ts";

export type RecordSeat = {
  colour: Color;
  kind: "human" | "bot";
  /** The person's first name or the computer's horse name. */
  name: string;
  /** A computer seat's strength, or the strength a person's seat was handed over at; else null. */
  level: BotLevel | null;
  /** The computer played this person's seat when the game ended. */
  handedOver: boolean;
};

export type GameRecord = {
  gameNo: number;
  startedAt: number;
  endedAt: number;
  winner: Team;
  seats: RecordSeat[];
  deals: number;
  captures: Record<Team, number>;
};

/** The retry delays of a pending record: 1 minute, 10 minutes, then every hour. */
export const D1_RETRY_MS = [60_000, 600_000, 3_600_000] as const;

function retryDelay(attempt: number): number {
  return D1_RETRY_MS[Math.min(attempt, D1_RETRY_MS.length - 1)] as number;
}

/** The record of the table's finished game. */
export function gameRecordOf(table: Table): GameRecord {
  const game = table.game;
  if (game === null || game.winner === null) throw new Error("gameRecordOf: no game won");
  const seats: RecordSeat[] = COLORS.map((colour) => {
    const seat = table.seats[colour];
    if (seat.kind === "human") {
      const handedOver = seat.handedOver ?? null;
      return {
        colour,
        kind: "human",
        name: personOf(table, seat.who)?.name ?? "",
        level: handedOver,
        handedOver: handedOver !== null,
      };
    }
    return {
      colour,
      kind: "bot",
      name: seat.kind === "bot" ? seat.name : "",
      level: table.levels[colour],
      handedOver: false,
    };
  });
  return {
    gameNo: table.gameNo,
    startedAt: table.startedAt ?? table.createdAt,
    endedAt: table.endedAt ?? table.lastActivity,
    winner: game.winner,
    seats,
    deals: game.dealsPlayed,
    captures: { ...game.captures },
  };
}

/**
 * The game was just won: its record is pending (once per game number) and the retry deadline armed.
 * Returns the record for the step to carry, or null when this game was already recorded or pending.
 */
export function keepRecord(table: Table, now: number): GameRecord | null {
  if (table.records.some((each) => each.gameNo === table.gameNo)) return null;
  const record = gameRecordOf(table);
  table.records.push(record);
  table.deadlines.d1Retry = { at: now + retryDelay(0), attempt: 1 };
  return record;
}

/** The Durable Object wrote (or had no database for) game `gameNo`: no longer pending. */
export function recorded(table: Table, gameNo: number): boolean {
  if (!table.records.some((each) => each.gameNo === gameNo)) return false;
  table.records = table.records.filter((each) => each.gameNo !== gameNo);
  if (table.records.length === 0) delete table.deadlines.d1Retry;
  return true;
}

/**
 * The d1Retry deadline is due: every pending record goes again and the next try is armed later (or
 * the deadline goes when nothing is pending). Returns the records to write.
 */
export function onD1RetryDue(table: Table, now: number): GameRecord[] {
  const due = table.deadlines.d1Retry;
  if (due === undefined) return [];
  if (table.records.length === 0) {
    delete table.deadlines.d1Retry;
    return [];
  }
  table.deadlines.d1Retry = { at: now + retryDelay(due.attempt), attempt: due.attempt + 1 };
  return table.records.map((record) => ({ ...record }));
}
