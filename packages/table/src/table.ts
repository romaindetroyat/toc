// The table: everything one online table remembers, as plain JSON (it is the Durable Object's SQLite
// snapshot). Pure, no I/O: the clock and the seeds come from the reducer's context.
//
// A person is known by `who`, the SHA-256 of the table id and the device token, computed by the
// Durable Object: the token itself never reaches the table, and `who` never leaves the server. Plan
// 04-04 adds the account a person is linked to (accounts.ts), server-only too.

import { type BotLevel, DEFAULT_BOT_LEVEL, type ThinkerCheckpoint, type Thought } from "@toc/bots";
import {
  COLORS,
  type Color,
  type GameState,
  type Rng,
  type Scenario,
  upgradeState,
} from "@toc/engine";
import type { ChatEntry } from "@toc/protocol";
import type { GameRecord } from "./record.ts";

export type Person = {
  who: string;
  name: string;
  seat: Color | null;
  /** The person has an open socket on the table. */
  online: boolean;
  /**
   * The account the person is linked to (plan 04-04, D-05), or null for a guest. Server-only: never
   * put in a frame. Absent in a snapshot from before plan 04-04 (copyTable sets null).
   */
  account: string | null;
};

export type Seat =
  | { kind: "free" }
  /**
   * A person's seat. `handedOver`: the chef de table gave it to the computer at this strength while
   * its person is away (D-04); null (or absent in a snapshot from before plan 02-06) otherwise.
   */
  | { kind: "human"; who: string; handedOver?: BotLevel | null }
  | { kind: "bot"; name: string };

/**
 * A table with no activity for this long is deleted by its own alarm (D-06): 30 days. Activity is a
 * person's hello or any of their frames the table accepted; never an alarm or a socket closing.
 */
export const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * A pending reclaim of a seat (plan 02-07, D-12): the person without a seat who asked, the first
 * name they typed, when. One per seat; dropped when the seat's person comes back or the host answers.
 */
export type Reclaim = { who: string; name: string; since: number };

/** Test-only options, honoured only when the Worker runs with TOC_TEST_MODE=1 (T-02-07). */
export type TestOptions = {
  /** `zero`: the computer players act at once instead of waiting for the animations. */
  pace: "zero" | "normal";
  /** The strength of computer seats, until the waiting room's picker exists (plan 02-05). */
  levels?: Partial<Record<Color, BotLevel>>;
  /** The pause's minute, shortened for the end-to-end tests (plan 02-06). */
  pauseMs?: number;
  /**
   * The first game starts from this position instead of a deal (plan 02-09, a near-end table for the
   * end plank and the rematch). A rematch always deals a real game.
   */
  before?: Scenario["before"];
  /** « C’est ton tour » sooner than NOTIFY_AFTER_MS, for the tests (plan 04-07, notify.ts). */
  notifyMs?: number;
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
   * minute) → playing or paused (« Reprendre la partie »). playing → finished when the game is won
   * (plan 02-09) → playing again when the rematch starts (rematch.ts).
   */
  status: "lobby" | "playing" | "paused" | "saved" | "finished";
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
  /** The first dealer of the current game (the rematch's is the seat after it, A6); null before. */
  firstDealer: Color | null;
  /** When the current game started and ended (server time); null before its start, before its end. */
  startedAt: number | null;
  endedAt: number | null;
  /**
   * The seats whose person agreed to « Revanche » (plan 02-09), while the status is "finished".
   * Computer seats always agree and are not listed; a person who goes offline loses their vote.
   */
  rematch: Partial<Record<Color, true>>;
  /** The computer players' random stream: first dealer, horse names, then their choices. */
  botRng: Rng;
  /**
   * The table's deadlines, one alarm for all (02-RESEARCH Pattern 3): when the computer player due
   * must next be ticked (decide, a slice, or play) for `seq`; when the pause's minute is over; when
   * the silent sockets are next swept (presence.ts); when the 30 idle days may be over (expire: not
   * moved by each activity, re-armed when it fires early, plan 02-07); when the pending game records
   * go to D1 again (d1Retry, `attempt` the tries so far, plan 02-09, record.ts); when the next
   * « C’est ton tour » is due (notify, the earliest of notifyAt, plan 04-07, notify.ts).
   */
  deadlines: {
    bot?: { at: number; seq: number };
    pauseChoice?: { at: number };
    sweep?: { at: number };
    expire?: { at: number };
    d1Retry?: { at: number; attempt: number };
    notify?: { at: number };
  };
  /**
   * Server-only (plan 04-07, notify.ts): per missing seat whose person has an account, when they are
   * told « C’est ton tour », or null once told for this absence. Absent in a snapshot from before
   * plan 04-07 (copyTable sets {}). Never put in a frame.
   */
  notifyAt: Partial<Record<Color, number | null>>;
  /**
   * Server-only: the records of finished games not yet written to D1 (plan 02-09, record.ts), at
   * most one per game number. Never put in a frame.
   */
  records: GameRecord[];
  /** The pending reclaims by seat (plan 02-07); server-only: `who` never leaves the table. */
  reclaims: Partial<Record<Color, Reclaim>>;
  /** The pause while the status is "paused"; else null. */
  pause: Pause | null;
  /** The computer player due and its decision, or null (its seat is TablePublic.thinking). */
  thinking: PendingThink | null;
  /** The last quick messages (plan 02-08, chat.ts): at most CHAT_KEEP, oldest first. */
  chat: ChatEntry[];
  /**
   * Server-only: the times of each person's accepted messages inside the rate window, by `who`
   * (chat.ts). Never put in a frame.
   */
  chatTimes: Record<string, number[]>;
  /**
   * The table's « Avance rapide » (plan 02-10b): set by the chef de table, off by default, kept by the
   * rematch. The computers think at the fast pace and wait for the fast animations (bots.ts speedOf).
   */
  fast: boolean;
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
    firstDealer: null,
    startedAt: null,
    endedAt: null,
    rematch: {},
    records: [],
    botRng: [options.seed[0], options.seed[1], options.seed[2], options.seed[3]],
    deadlines: { expire: { at: options.now + EXPIRY_MS } },
    notifyAt: {},
    reclaims: {},
    pause: null,
    thinking: null,
    chat: [],
    chatTimes: {},
    fast: false,
    test: options.test ?? null,
  };
}

/** A deep copy: the table is plain JSON (it is stored as such), so the reducer never edits its input. */
export function copyTable(table: Table): Table {
  const copy = JSON.parse(JSON.stringify(table)) as Table;
  // A snapshot written before plan 02-03 has no pending think, before plan 02-06 no pause, before
  // plan 02-07 no reclaims and no expiry, before plan 02-08 no messages.
  copy.thinking ??= null;
  copy.chat ??= [];
  copy.chatTimes ??= {};
  copy.pause ??= null;
  copy.reclaims ??= {};
  copy.deadlines.expire ??= { at: copy.lastActivity + EXPIRY_MS };
  // Before plan 02-09 a won game stayed « playing », without votes or times.
  copy.rematch ??= {};
  copy.records ??= [];
  copy.firstDealer ??= null;
  copy.startedAt ??= null;
  copy.endedAt ??= null;
  // Before plan 02-10b a table had no « Avance rapide ».
  copy.fast ??= false;
  // Before plan 04-04 nobody was linked to an account.
  for (const person of copy.people) person.account ??= null;
  // Before plan 04-07 nobody was told « C’est ton tour ».
  copy.notifyAt ??= {};
  // Before plan 04-14 (G18) a game had no EXIT_ONLY_PROTECTION switch and no flag on its knights: the
  // missing switches take DEFAULT_RULES, a knight on its own losange at progress 0 is the one just out.
  if (copy.game !== null) {
    const beforeG18 = copy.game.rules.EXIT_ONLY_PROTECTION === undefined;
    copy.game = upgradeState(copy.game);
    // A computer's decision (or search) made under the old protection may not be legal any more (a
    // knight back on its 18 no longer blocks, so a 7 may now have to bring a knight home): it decides
    // again, from the start, under G18.
    if (beforeG18 && copy.thinking !== null) {
      copy.thinking.thought = null;
      copy.thinking.checkpoint = null;
      copy.thinking.playAt = null;
    }
  }
  if (copy.status === "playing" && copy.game?.phase === "won") copy.status = "finished";
  return copy;
}

export function personOf(table: Table, who: string): Person | undefined {
  return table.people.find((person) => person.who === who);
}

/** The earliest deadline of the table, or null: the Durable Object arms its one alarm at it. */
export function nextDeadline(table: Table): number | null {
  const { bot, pauseChoice, sweep, expire, d1Retry, notify } = table.deadlines;
  const times = [bot?.at, pauseChoice?.at, sweep?.at, expire?.at, d1Retry?.at, notify?.at].filter(
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
