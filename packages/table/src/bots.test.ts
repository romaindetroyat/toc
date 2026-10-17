// The computer players of an online table (plan 02-03, D-11, 02-RESEARCH Pattern 8): decide first, play
// when the natural think time is over; the Champion in slices of SLICE_UNITS units, one alarm each, its
// checkpoint kept with the table; the best move so far at HARD_CAP_MS; a retried alarm decides at level 1;
// a deadline is re-checked when it fires. Pure: every `now` is explicit.

import { eventsDuration } from "@toc/board";
import {
  type BotLevel,
  CHAMPION_BUDGET,
  chooseAction,
  createThinker,
  HARD_CAP_MS,
  paceFor,
  type ThinkerCheckpoint,
} from "@toc/bots";
import {
  type Action,
  type Color,
  type GameEvent,
  type GameState,
  legalActions,
  next,
  type Rng,
  viewFor,
} from "@toc/engine";
import { describe, expect, it } from "vitest";
import { SLICE_UNITS } from "./bots.ts";
import {
  createTable,
  nextDeadline,
  type Reduced,
  reduce,
  type Table,
  tablePublic,
} from "./index.ts";

const ID = "abcdefghijklmnopqrstuv";
const ANA = "who-ana";
const BEN = "who-ben";
const DECK: Rng = [11, 22, 33, 44];
const ctx = (now: number) => ({ now, seed: (): Rng => [...DECK] });
const HUMANS: Record<string, Color> = { [ANA]: "bleu", [BEN]: "jaune" };

function gameOf(table: Table): GameState {
  if (table.game === null) throw new Error("no game");
  return table.game;
}

/** Ana (bleu) and Ben (jaune) seated, rouge and vert computers at `levels`, started at `now`. */
function started(
  pace: "zero" | "normal",
  levels: Partial<Record<Color, BotLevel>> = {},
  now = 2000,
): Reduced {
  let table = createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8], test: { pace, levels } });
  for (const command of [
    { t: "hello", who: ANA, name: "Ana" },
    { t: "hello", who: BEN, name: "Ben" },
    { t: "client", who: ANA, frame: { t: "sit", seat: "bleu" } },
    { t: "client", who: BEN, frame: { t: "sit", seat: "jaune" } },
  ] as const) {
    table = reduce(table, command, ctx(now)).table;
  }
  return reduce(table, { t: "client", who: ANA, frame: { t: "start" } }, ctx(now));
}

const tick = (table: Table, now: number, retry = false) =>
  reduce(table, { t: "tick", retry }, ctx(now));

/** The person whose move is due, if any. */
function humanDue(table: Table): string | undefined {
  const game = gameOf(table);
  return Object.keys(HUMANS).find((who) => {
    const seat = HUMANS[who] as Color;
    return game.phase === "exchange" ? game.given[seat] === null : game.turn === seat;
  });
}

function humanAct(table: Table, now: number): Reduced {
  const who = humanDue(table);
  if (who === undefined) throw new Error("no person due");
  const seat = HUMANS[who] as Color;
  const action = legalActions(viewFor(gameOf(table), seat), seat)[0] as Action;
  return reduce(
    table,
    { t: "client", who, frame: { t: "act", base: table.seq, action } },
    ctx(now),
  );
}

/**
 * Plays the game (people with their first legal action, computers by ticks at their deadlines) until
 * `stop` holds before a step. Returns the table and the clock.
 */
function playUntil(
  start: Table,
  stop: (table: Table) => boolean,
  now0 = 2000,
): { table: Table; now: number } {
  let table = start;
  let now = now0;
  for (let step = 0; step < 20_000; step++) {
    if (stop(table)) return { table, now };
    if (gameOf(table).phase === "won") break;
    const at = nextDeadline(table);
    if (at !== null && humanDue(table) === undefined) {
      now = Math.max(now, at);
      table = tick(table, now).table;
    } else {
      now += 1;
      table = humanAct(table, now).table;
    }
  }
  throw new Error("the stop condition never held");
}

/** A Champion's turn in the play phase, before its first slice. */
function championDue(): { table: Table; now: number; seat: Color } {
  const { table, now } = playUntil(
    started("zero", { rouge: 5, vert: 5 }).table,
    (t) =>
      gameOf(t).phase === "play" &&
      t.thinking !== null &&
      t.thinking.thought === null &&
      t.thinking.checkpoint === null &&
      // A real search: three slices do not finish it.
      !createThinker(viewFor(gameOf(t), gameOf(t).turn), gameOf(t).turn, 5, t.botRng).step(
        SLICE_UNITS * 3,
      ),
  );
  return { table, now, seat: gameOf(table).turn };
}

describe("which computer player is due", () => {
  it("in the exchange the first computer seat whose give is missing, its seat in tablePublic", () => {
    const { table } = started("normal");
    expect(table.thinking).toMatchObject({ seat: "rouge", base: "exchange", dueAt: 2000 });
    expect(tablePublic(table).thinking).toBe("rouge");
    // Decide first: the decision is due at once, the play later.
    expect(nextDeadline(table)).toBe(2000);
  });

  it("in play the turn seat when a computer holds it, with the seq as its base", () => {
    const { table } = playUntil(
      started("zero").table,
      (t) => gameOf(t).phase === "play" && t.thinking !== null,
    );
    expect(table.thinking).toMatchObject({ seat: gameOf(table).turn, base: table.seq });
    expect(tablePublic(table).thinking).toBe(gameOf(table).turn);
  });

  it("no thinking sign while a person is due", () => {
    const { table } = playUntil(
      started("zero").table,
      (t) => gameOf(t).phase === "play" && humanDue(t) !== undefined,
    );
    expect(table.thinking).toBeNull();
    expect(tablePublic(table).thinking).toBeNull();
    // No computer deadline; only the silence sweep (plan 02-06) is armed while people play.
    expect(table.deadlines.bot).toBeUndefined();
    expect(nextDeadline(table)).toBe(table.deadlines.sweep?.at);
  });
});

describe("levels 1 to 4: decide in one tick, play at the natural pace", () => {
  it("playAt = dueAt + the last batch's animation + paceFor(thought, normal, u)", () => {
    const { table, log } = started("normal");
    const deal = log[0]?.events as GameEvent[];
    const decided = tick(table, 2000);
    // The decision tick plays nothing and sends nothing.
    expect(decided.log).toEqual([]);
    expect(decided.table.seq).toBe(table.seq);
    const pending = decided.table.thinking;
    const thought = chooseAction(viewFor(gameOf(table), "rouge"), "rouge", 3, table.botRng);
    const [u] = next(thought.rng);
    const playAt = 2000 + eventsDuration(deal, "normal") + paceFor(thought, "normal", u);
    expect(pending?.thought).toEqual(thought);
    expect(pending?.playAt).toBe(playAt);
    expect(nextDeadline(decided.table)).toBe(playAt);
    expect(tablePublic(decided.table).thinking).toBe("rouge");

    // A tick before playAt only re-arms.
    expect(tick(decided.table, playAt - 1).table).toBe(decided.table);
    const played = tick(decided.table, playAt);
    expect(played.log).toMatchObject([{ seat: "rouge", action: thought.action }]);
    expect(played.log[0]?.bot).toEqual({ level: 3, slices: 1, fallback: false });
    expect(gameOf(played.table).given.rouge).not.toBeNull();
  });

  it("the computer gives of the exchange are staggered, at least 300 ms apart", () => {
    let { table } = started("normal");
    let now = 2000;
    const gives: { seat: Color; at: number }[] = [];
    for (let i = 0; i < 20 && gives.length < 2; i++) {
      now = Math.max(now, nextDeadline(table) as number);
      const result = tick(table, now);
      for (const entry of result.log) gives.push({ seat: entry.seat as Color, at: now });
      table = result.table;
    }
    expect(gives.map((g) => g.seat)).toEqual(["rouge", "vert"]);
    expect((gives[1]?.at as number) - (gives[0]?.at as number)).toBeGreaterThanOrEqual(300);
  });

  it("a person's give during the exchange keeps the pending decision and its time", () => {
    const { table } = started("normal");
    const decided = tick(table, 2000).table;
    const gave = humanAct(decided, 2100).table;
    expect(gave.seq).toBe(decided.seq + 1);
    expect(gave.thinking).toEqual(decided.thinking);
    expect(nextDeadline(gave)).toBe(decided.thinking?.playAt);
    expect(gave.deadlines.bot?.seq).toBe(gave.seq);
  });

  it("under the zero test pace the decision tick also plays", () => {
    const { table } = started("zero");
    const ticked = tick(table, 2000);
    expect(ticked.log).toMatchObject([{ seat: "rouge", action: { t: "give" } }]);
  });
});

describe("the Champion in slices", () => {
  it("one slice per tick, the checkpoint kept in the table, the one-go decision at the end", () => {
    const { table: due, now, seat } = championDue();
    const view = viewFor(gameOf(due), seat);
    const whole = chooseAction(view, seat, 5, due.botRng);
    let table = due;
    let ticks = 0;
    let played: Reduced | null = null;
    const checkpoints: ThinkerCheckpoint[] = [];
    while (played === null && ticks < 1000) {
      const result = tick(table, now);
      ticks += 1;
      if (result.log.length > 0) played = result;
      else {
        expect(result.table.seq).toBe(table.seq);
        expect(result.out).toEqual([]);
        expect(nextDeadline(result.table)).toBe(now);
        expect(tablePublic(result.table).thinking).toBe(seat);
        checkpoints.push(result.table.thinking?.checkpoint ?? null);
        // The bot rng moves only once the decision is fixed.
        expect(result.table.botRng).toEqual(due.botRng);
      }
      table = result.table;
    }
    if (played === null) throw new Error("the Champion never played");
    expect(played.log).toMatchObject([{ seat, action: whole.action }]);
    expect(played.log[0]?.bot).toEqual({ level: 5, slices: ticks, fallback: false });
    expect(ticks).toBeGreaterThan(1);
    expect(ticks).toBeLessThanOrEqual(Math.ceil(CHAMPION_BUDGET.plies / SLICE_UNITS));
    for (const checkpoint of checkpoints) {
      expect(checkpoint).not.toBeNull();
      expect(JSON.stringify(checkpoint).length).toBeLessThan(4096);
    }
  });

  it("plays its best move so far HARD_CAP_MS after it became due", () => {
    const { table: zero, seat } = championDue();
    // The same position under the normal pace.
    const due: Table = { ...zero, test: { pace: "normal", levels: { rouge: 5, vert: 5 } } };
    const dueAt = due.thinking?.dueAt as number;
    const first = tick(due, dueAt).table;
    const second = tick(first, dueAt + 10).table;
    expect(second.thinking?.thought).toBeNull();
    const capped = tick(second, dueAt + HARD_CAP_MS);
    const view = viewFor(gameOf(due), seat);
    const sofar = createThinker(view, seat, 5, due.botRng, undefined, second.thinking?.checkpoint);
    // Fixed at the cap without another slice; its think time (at most 2 s) is already over, and the
    // batch before it had no animation (the zero pace made it due), so it is played in this tick.
    expect(capped.log).toMatchObject([{ seat, action: sofar.result().action }]);
    expect(capped.log[0]?.bot).toEqual({ level: 5, slices: 3, fallback: false });
  });

  it("a retried alarm decides at level 1 and the log marks the fallback", () => {
    const { table: due, now, seat } = championDue();
    const sliced = tick(due, now).table;
    expect(sliced.thinking?.checkpoint).not.toBeNull();
    const retried = tick(sliced, now, true);
    const fallback = chooseAction(viewFor(gameOf(due), seat), seat, 1, due.botRng);
    expect(retried.log).toMatchObject([{ seat, action: fallback.action }]);
    expect(retried.log[0]?.bot).toEqual({ level: 1, slices: 2, fallback: true });
  });
});

describe("deadlines re-checked when they fire", () => {
  it("a deadline for another seq plays nothing and is recomputed", () => {
    const { table } = started("zero");
    const stale: Table = {
      ...table,
      deadlines: { bot: { at: 0, seq: table.seq - 1 } },
    };
    const result = tick(stale, 2000);
    expect(result.log).toEqual([]);
    expect(result.table.seq).toBe(stale.seq);
    expect(result.table.deadlines.bot).toEqual({ at: 2000, seq: stale.seq });
  });

  it("an exchange decision whose give is no longer missing is dropped", () => {
    const { table } = started("normal");
    const decided = tick(table, 2000).table;
    const game = gameOf(decided);
    // rouge's give already recorded (a duplicated alarm after the play, for instance).
    const gaveAlready: Table = {
      ...decided,
      game: { ...game, given: { ...game.given, rouge: game.hands.rouge[0] ?? null } },
    };
    const at = decided.thinking?.playAt as number;
    const result = tick(gaveAlready, at);
    expect(result.log).toEqual([]);
    expect(result.table.thinking?.seat).toBe("vert");
  });

  it("a duplicated tick after the play does not play twice", () => {
    const { table } = started("zero");
    const once = tick(table, 2000);
    const twice = tick(once.table, 2000);
    expect(once.log).toHaveLength(1);
    // The second tick is the next computer's own decision (vert), never rouge again.
    for (const entry of twice.log) expect(entry.seat).not.toBe("rouge");
  });
});
