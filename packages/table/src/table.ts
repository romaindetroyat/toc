// The table: everything one online table remembers, as plain JSON (it is the Durable Object's SQLite
// snapshot). Pure, no I/O: the clock and the seeds come from the reducer's context.
//
// A person is known by `who`, the SHA-256 of the table id and the device token, computed by the
// Durable Object: the token itself never reaches the table, and `who` never leaves the server.

import { type BotLevel, DEFAULT_BOT_LEVEL } from "@toc/bots";
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
  /** When the next computer action is due, for the game at `seq`. */
  deadlines: { bot?: { at: number; seq: number } };
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
      bleu: DEFAULT_BOT_LEVEL,
      jaune: DEFAULT_BOT_LEVEL,
      rouge: DEFAULT_BOT_LEVEL,
      vert: DEFAULT_BOT_LEVEL,
    },
    game: null,
    seq: 0,
    gameNo: 0,
    botRng: [options.seed[0], options.seed[1], options.seed[2], options.seed[3]],
    deadlines: {},
    test: options.test ?? null,
  };
}

/** A deep copy: the table is plain JSON (it is stored as such), so the reducer never edits its input. */
export function copyTable(table: Table): Table {
  return JSON.parse(JSON.stringify(table)) as Table;
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
