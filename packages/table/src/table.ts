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
  /**
   * A person's seat. `handedOver`: the chef de table gave it to the computer at this strength while
   * its person is away (D-04); null (or absent in a snapshot from before plan 02-06) otherwise.
   */
  | { kind: "human"; who: string; handedOver?: BotLevel | null }
  | { kind: "bot"; name: string };

/** Test-only options, honoured only when the Worker runs with TOC_TEST_MODE=1 (T-02-07). */
export type TestOptions = {
  /** `zero`: the computer players act at once instead of waiting for the animations. */
  pace: "zero" | "normal";
  /** The strength of computer seats, until the waiting room's picker exists (plan 02-05). */
  levels?: Partial<Record<Color, BotLevel>>;
  /** The pause's minute, shortened for the end-to-end tests (plan 02-06). */
  pauseMs?: number;
};

/**
 * The pause (plan 02-06, D-04): the seats whose people are missing (in the order they went), when it
 * began, when the host may choose, and whether the host is choosing now.
 */
export type Pause = {
  missing: Color[];
  since: number;
  choiceAt: number;
  choosing: boolean;
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
  /**
   * lobby → playing (start) → paused (a seated person is missing, D-04) → playing (back, or handed
   * to the computer) or saved (« Sauvegarder et arrêter », or nobody online at the end of the
   * minute) → playing or paused (« Reprendre la partie »).
   */
  status: "lobby" | "playing" | "paused" | "saved";
  createdAt: number;
  lastActivity: number;
  tableId: string;
  /**
   * The first person who said hello: the creator. The host (« chef de table ») is derived from it on
   * every change (presence.ts hostOf, D-05), never stored.
   */
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
  /**
   * The table's deadlines, one alarm for all (02-RESEARCH Pattern 3): when the computer player due
   * must next be ticked (decide, a slice, or play) for `seq`; when the pause's minute is over; when
   * the silent sockets are next swept (presence.ts).
   */
  deadlines: {
    bot?: { at: number; seq: number };
    pauseChoice?: { at: number };
    sweep?: { at: number };
  };
  /** The pause while the status is "paused"; else null. */
  pause: Pause | null;
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
    pause: null,
    thinking: null,
    test: options.test ?? null,
  };
}

/** A deep copy: the table is plain JSON (it is stored as such), so the reducer never edits its input. */
export function copyTable(table: Table): Table {
  const copy = JSON.parse(JSON.stringify(table)) as Table;
  // A snapshot written before plan 02-03 has no pending think, before plan 02-06 no pause.
  copy.thinking ??= null;
  copy.pause ??= null;
  return copy;
}

export function personOf(table: Table, who: string): Person | undefined {
  return table.people.find((person) => person.who === who);
}

/** The earliest deadline of the table, or null: the Durable Object arms its one alarm at it. */
export function nextDeadline(table: Table): number | null {
  const { bot, pauseChoice, sweep } = table.deadlines;
  const times = [bot?.at, pauseChoice?.at, sweep?.at].filter(
    (at): at is number => at !== undefined,
  );
  return times.length === 0 ? null : Math.min(...times);
}

/**
 * The strength the computer plays `color` at: a computer seat's level, or the level a person's seat
 * was handed over at (D-04); null for a person playing their own seat and for a free seat.
 */
export function computerLevel(table: Table, color: Color): BotLevel | null {
  const seat = table.seats[color];
  if (seat.kind === "bot") return table.levels[color];
  if (seat.kind === "human") return seat.handedOver ?? null;
  return null;
}

/**
 * The computer player that must act now: during the exchange the first computer seat (COLORS order)
 * that has not given yet, in play the turn seat when a computer holds it; else null. A seat handed
 * over to the computer counts as a computer seat; nobody is due while the game is paused or saved.
 */
export function dueBot(table: Table): Color | null {
  const game = table.game;
  if (table.status !== "playing" || game === null || game.phase === "won") return null;
  const isBot = (color: Color) => computerLevel(table, color) !== null;
  if (game.phase === "exchange") {
    return (
      COLORS.find((c) => isBot(c) && game.given[c] === null && game.hands[c].length > 0) ?? null
    );
  }
  return isBot(game.turn) ? game.turn : null;
}
