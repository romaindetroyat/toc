// The table: everything one online table remembers, as plain JSON (it is the Durable Object's SQLite
// snapshot). Pure, no I/O: the clock and the seeds come from the reducer's context.
//
// A person is known by `who`, the SHA-256 of the table id and the device token, computed by the
// Durable Object: the token itself never reaches the table, and `who` never leaves the server.

import { type BotLevel, DEFAULT_BOT_LEVEL, type ThinkerCheckpoint, type Thought } from "@toc/bots";
import { COLORS, type Color, type GameState, type Rng } from "@toc/engine";

export type Person = {
  who: string;
  name: string;
  seat: Color | null;
  /** The person has an open socket on the table. */
  online: boolean;
};

export type Seat =
  | { kind: "free" }
  | { kind: "human"; who: string }
  | { kind: "bot"; name: string };

/** Test-only options, honoured only when the Worker runs with TOC_TEST_MODE=1 (T-02-07). */
export type TestOptions = {
  /** `zero`: the computer players act at once instead of waiting for the animations. */
  pace: "zero" | "normal";
  /** The strength of computer seats, until the waiting room's picker exists (plan 02-05). */
  levels?: Partial<Record<Color, BotLevel>>;
};

/**
 * The decision of the computer player that is due (plan 02-03, packages/table/src/bots.ts), kept with
 * the table so it survives eviction: decided first, played when its think time is over. Server-only:
 * never put in a frame (the checkpoint holds the bot's own candidate actions).
 */
export type PendingThink = {
  seat: Color;
  /** The seq it was due at in play; "exchange" while it gives (seq moves with every give). */
  base: number | "exchange";
  level: BotLevel;
  /** When it became due (the commit that made it due). */
  dueAt: number;
  /** The animation of the batch that made it due, in ms (0 under the zero test pace). */
  waitMs: number;
  /** The Champion's search so far (null before its first slice and for every other think). */
  checkpoint: ThinkerCheckpoint;
  /** Ticks spent on the decision so far. */
  slices: number;
  /** The decision, once fixed. */
  thought: Thought | null;
  /** When the decision is played, once fixed. */
  playAt: number | null;
  /** The decision was made at level 1 because the alarm was retried (D-11). */
  fallback: boolean;
};

export type Table = {
  status: "lobby" | "playing";
  createdAt: number;
  lastActivity: number;
  tableId: string;
  /** The first person who said hello: the creator, and the host (plan 02-06 adds the hand-over). */
  creator: string | null;
  people: Person[];
  seats: Record<Color, Seat>;
  /** The strength of each computer seat (the free seats' planned one). */
  levels: Record<Color, BotLevel>;
  game: GameState | null;
  /** Bumped by every change of the game; an act must name it as its base. */
  seq: number;
  gameNo: number;
  /** The computer players' random stream: first dealer, horse names, then their choices. */
  botRng: Rng;
  /** When the computer player due must next be ticked (decide, a slice, or play), for `seq`. */
  deadlines: { bot?: { at: number; seq: number } };
  /** The computer player due and its decision, or null (its seat is TablePublic.thinking). */
  thinking: PendingThink | null;
  test: TestOptions | null;
};

export function createTable(options: {
  tableId: string;
  now: number;
  seed: Rng;
  test?: TestOptions | null;
}): Table {
  return {
    status: "lobby",
    createdAt: options.now,
    lastActivity: options.now,
    tableId: options.tableId,
    creator: null,
    people: [],
    seats: {
      bleu: { kind: "free" },
      jaune: { kind: "free" },
      rouge: { kind: "free" },
      vert: { kind: "free" },
    },
    levels: {
      bleu: options.test?.levels?.bleu ?? DEFAULT_BOT_LEVEL,
      jaune: options.test?.levels?.jaune ?? DEFAULT_BOT_LEVEL,
      rouge: options.test?.levels?.rouge ?? DEFAULT_BOT_LEVEL,
      vert: options.test?.levels?.vert ?? DEFAULT_BOT_LEVEL,
    },
    game: null,
    seq: 0,
    gameNo: 0,
    botRng: [options.seed[0], options.seed[1], options.seed[2], options.seed[3]],
    deadlines: {},
    thinking: null,
    test: options.test ?? null,
  };
}

/** A deep copy: the table is plain JSON (it is stored as such), so the reducer never edits its input. */
export function copyTable(table: Table): Table {
  const copy = JSON.parse(JSON.stringify(table)) as Table;
  // A snapshot written before plan 02-03 has no pending think.
  copy.thinking ??= null;
  return copy;
}

/** The earliest deadline of the table, or null: the Durable Object arms its one alarm at it. */
export function nextDeadline(table: Table): number | null {
  return table.deadlines.bot?.at ?? null;
}

/**
 * The computer player that must act now: during the exchange the first computer seat (COLORS order)
 * that has not given yet, in play the turn seat when a computer holds it; else null.
 */
export function dueBot(table: Table): Color | null {
  const game = table.game;
  if (table.status !== "playing" || game === null || game.phase === "won") return null;
  const isBot = (color: Color) => table.seats[color].kind === "bot";
  if (game.phase === "exchange") {
    return (
      COLORS.find((c) => isBot(c) && game.given[c] === null && game.hands[c].length > 0) ?? null
    );
  }
  return isBot(game.turn) ? game.turn : null;
}
