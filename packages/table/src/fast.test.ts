// The table's « Avance rapide » (plan 02-10b, Romain 2026-10-17: « Oui, ajoute l’avance rapide »).
// The chef de table switches it with a speed frame, anyone else is refused; it is in the public table
// for everyone and in the snapshot; the rematch keeps it. While it is on, the computers think at the
// fast pace (paceFor "fast", at most FAST_CEILING_MS), wait for the fast animations
// (eventsDuration "fast") and a Champion stops at FAST_HARD_CAP_MS. The zero test pace stays "test".

import { eventsDuration } from "@toc/board";
import {
  type BotLevel,
  chooseAction,
  createThinker,
  FAST_CEILING_MS,
  FAST_HARD_CAP_MS,
  paceFor,
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
import type { ServerFrame, TableFrame, TablePublic, WelcomeFrame } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { SLICE_UNITS } from "./bots.ts";
import {
  copyTable,
  createTable,
  nextDeadline,
  type Out,
  type Reduced,
  reduce,
  speedOf,
  type Table,
  tablePublic,
} from "./index.ts";

const ID = "abcdefghijklmnopqrstuv";
const ANA = "who-ana";
const BEN = "who-ben";
/** At the table without a seat. */
const DAN = "who-dan";
const DECK: Rng = [11, 22, 33, 44];
const ctx = (now: number) => ({ now, seed: (): Rng => [...DECK] });
const HUMANS: Record<string, Color> = { [ANA]: "bleu", [BEN]: "jaune" };

type Command = Parameters<typeof reduce>[1];
type ClientFrameOf = Extract<Command, { t: "client" }>["frame"];
const client = (who: string, frame: ClientFrameOf): Command => ({ t: "client", who, frame });
const speed = (table: Table, who: string, fast: boolean, now = 3000) =>
  reduce(table, client(who, { t: "speed", fast }), ctx(now));
const tick = (table: Table, now: number) => reduce(table, { t: "tick", retry: false }, ctx(now));

function gameOf(table: Table): GameState {
  if (table.game === null) throw new Error("no game");
  return table.game;
}

const to = (out: Out[], who: string): ServerFrame[] =>
  out.filter((each) => each.to === who).map((each) => each.frame);

/** The last public table sent to `who` (a table frame or a welcome), or null. */
function seen(out: Out[], who: string): TablePublic | null {
  const frames = to(out, who).filter(
    (frame): frame is TableFrame | WelcomeFrame => frame.t === "table" || frame.t === "welcome",
  );
  return frames[frames.length - 1]?.table ?? null;
}

/** Ana (creator) and Ben in the waiting room, Dan without a seat; computers at `levels`. */
function lobby(pace: "zero" | "normal", levels: Partial<Record<Color, BotLevel>> = {}): Table {
  let table = createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8], test: { pace, levels } });
  for (const command of [
    { t: "hello", who: ANA, name: "Ana" },
    { t: "hello", who: BEN, name: "Ben" },
    { t: "hello", who: DAN, name: "Dan" },
    client(ANA, { t: "sit", seat: "bleu" }),
    client(BEN, { t: "sit", seat: "jaune" }),
  ] as Command[]) {
    table = reduce(table, command, ctx(1000)).table;
  }
  return table;
}

function start(table: Table, now = 2000): Reduced {
  return reduce(table, client(ANA, { t: "start" }), ctx(now));
}

/** The person whose move is due, if any. */
function humanDue(table: Table): string | undefined {
  const game = gameOf(table);
  return Object.keys(HUMANS).find((who) => {
    const seat = HUMANS[who] as Color;
    return game.phase === "exchange" ? game.given[seat] === null : game.turn === seat;
  });
}

/** Plays (people their first legal action, computers at their deadlines) until `stop` holds. */
function playUntil(
  start: Table,
  stop: (table: Table) => boolean,
  now0 = 2000,
): { table: Table; now: number; events: GameEvent[] } {
  let table = start;
  let now = now0;
  let events: GameEvent[] = [];
  for (let step = 0; step < 20_000; step++) {
    if (stop(table)) return { table, now, events };
    if (gameOf(table).phase === "won") break;
    const at = nextDeadline(table);
    let result: Reduced;
    if (at !== null && humanDue(table) === undefined) {
      now = Math.max(now, at);
      result = tick(table, now);
    } else {
      now += 1;
      const who = humanDue(table) as string;
      const seat = HUMANS[who] as Color;
      const action = legalActions(viewFor(gameOf(table), seat), seat)[0] as Action;
      result = reduce(table, client(who, { t: "act", base: table.seq, action }), ctx(now));
    }
    if (result.log.length > 0) events = result.log[result.log.length - 1]?.events ?? [];
    table = result.table;
  }
  throw new Error("the stop condition never held");
}

describe("who switches « Avance rapide » (plan 02-10b)", () => {
  it("a new table is not fast, and its public table says so", () => {
    const table = createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8] });
    expect(table.fast).toBe(false);
    expect(tablePublic(table).fast).toBe(false);
  });

  it("a snapshot written before plan 02-10b reads as not fast", () => {
    const old = lobby("zero") as Partial<Table>;
    delete old.fast;
    expect(copyTable(old as Table).fast).toBe(false);
    expect(tablePublic(old as Table).fast).toBe(false);
  });

  it("the chef de table switches it in the waiting room: everyone online sees it", () => {
    const table = lobby("zero");
    const on = speed(table, ANA, true);
    expect(on.table.fast).toBe(true);
    for (const who of [ANA, BEN, DAN]) expect(seen(on.out, who)?.fast).toBe(true);
    const off = speed(on.table, ANA, false);
    expect(off.table.fast).toBe(false);
    for (const who of [ANA, BEN, DAN]) expect(seen(off.out, who)?.fast).toBe(false);
  });

  it("anyone else is refused with not-host and nothing changes", () => {
    const table = lobby("zero");
    for (const who of [BEN, DAN]) {
      const refused = speed(table, who, true);
      expect(refused.table).toBe(table);
      expect(refused.out).toEqual([{ to: who, frame: { t: "error", code: "not-host" } }]);
    }
  });

  it("the same value again sends nothing", () => {
    const table = lobby("zero");
    const same = speed(table, ANA, false);
    expect(same.table).toBe(table);
    expect(same.out).toEqual([]);
  });

  it("in the game too, and by the derived host while the creator is away", () => {
    const playing = start(lobby("zero")).table;
    const on = speed(playing, ANA, true);
    expect(on.table.fast).toBe(true);
    expect(seen(on.out, BEN)?.fast).toBe(true);
    // Ana goes: the game pauses, Ben holds the role and switches it; Ana's own frame is refused.
    const away = reduce(on.table, { t: "gone", who: ANA }, ctx(3000)).table;
    expect(tablePublic(away).host).toBe("jaune");
    expect(speed(away, ANA, false, 3050).out).toEqual([
      { to: ANA, frame: { t: "error", code: "not-host" } },
    ]);
    const byBen = speed(away, BEN, false, 3100);
    expect(byBen.table.fast).toBe(false);
    expect(seen(byBen.out, BEN)?.fast).toBe(false);
    expect(byBen.table.status).toBe("paused");
  });

  it("a saved game and a finished one may be switched too", () => {
    const playing = start(lobby("zero")).table;
    const saved = reduce(playing, client(ANA, { t: "stop" }), ctx(3000)).table;
    expect(saved.status).toBe("saved");
    expect(speed(saved, ANA, true).table.fast).toBe(true);
    const { table: won } = playUntil(playing, (t) => t.status === "finished");
    expect(speed(won, ANA, true).table.fast).toBe(true);
  });
});

describe("the computers follow it (plan 02-10b)", () => {
  it("speedOf: fast when on, normal when off, test under the zero pace whatever the flag", () => {
    const normal = lobby("normal");
    expect(speedOf(normal)).toBe("normal");
    expect(speedOf({ ...normal, fast: true })).toBe("fast");
    const zero = lobby("zero");
    expect(speedOf(zero)).toBe("test");
    expect(speedOf({ ...zero, fast: true })).toBe("test");
  });

  it("waits for the fast animation and thinks at the fast pace, at most 300 ms", () => {
    const fast = speed(lobby("normal"), ANA, true, 1500).table;
    const { table, log } = start(fast);
    const deal = log[0]?.events as GameEvent[];
    expect(table.thinking).toMatchObject({ seat: "rouge", dueAt: 2000 });
    expect(table.thinking?.waitMs).toBe(eventsDuration(deal, "fast"));
    expect(eventsDuration(deal, "fast")).toBeLessThan(eventsDuration(deal, "normal"));
    const decided = tick(table, 2000).table;
    const thought = chooseAction(viewFor(gameOf(table), "rouge"), "rouge", 3, table.botRng);
    const [u] = next(thought.rng);
    const playAt = 2000 + eventsDuration(deal, "fast") + paceFor(thought, "fast", u);
    expect(decided.thinking?.playAt).toBe(playAt);
    expect(playAt - 2000 - eventsDuration(deal, "fast")).toBeLessThanOrEqual(FAST_CEILING_MS);
  });

  it("every computer turn of a game in play: at most the fast animation plus 300 ms", () => {
    const fast = speed(lobby("normal"), ANA, true, 1500).table;
    let table = start(fast).table;
    let now = 2000;
    let turns = 0;
    let last: GameEvent[] = [];
    for (let step = 0; step < 2000 && turns < 12; step++) {
      if (gameOf(table).phase === "won") break;
      const at = nextDeadline(table);
      if (humanDue(table) === undefined && at !== null) {
        const pending = table.thinking;
        now = Math.max(now, at);
        const result = tick(table, now);
        if (result.log.length > 0 && pending !== null && pending.base !== "exchange") {
          turns += 1;
          expect(now - pending.dueAt).toBeLessThanOrEqual(
            eventsDuration(last, "fast") + FAST_CEILING_MS,
          );
        }
        if (result.log.length > 0) last = result.log[0]?.events ?? [];
        table = result.table;
      } else {
        now += 1;
        const who = humanDue(table) as string;
        const seat = HUMANS[who] as Color;
        const action = legalActions(viewFor(gameOf(table), seat), seat)[0] as Action;
        const result = reduce(table, client(who, { t: "act", base: table.seq, action }), ctx(now));
        last = result.log[0]?.events ?? [];
        table = result.table;
      }
    }
    expect(turns).toBeGreaterThanOrEqual(4);
  });

  it("a Champion plays its best move so far FAST_HARD_CAP_MS after it became due", () => {
    const { table: zero } = playUntil(
      start(lobby("zero", { rouge: 5, vert: 5 })).table,
      (t) =>
        gameOf(t).phase === "play" &&
        t.thinking !== null &&
        t.thinking.thought === null &&
        t.thinking.checkpoint === null &&
        !createThinker(viewFor(gameOf(t), gameOf(t).turn), gameOf(t).turn, 5, t.botRng).step(
          SLICE_UNITS * 3,
        ),
    );
    const seat = gameOf(zero).turn;
    // The same position under the normal pace, the table fast.
    const due: Table = {
      ...zero,
      fast: true,
      test: { pace: "normal", levels: { rouge: 5, vert: 5 } },
    };
    const dueAt = due.thinking?.dueAt as number;
    const first = tick(due, dueAt).table;
    const second = tick(first, dueAt + 10).table;
    expect(second.thinking?.thought).toBeNull();
    const capped = tick(second, dueAt + FAST_HARD_CAP_MS);
    const view = viewFor(gameOf(due), seat);
    const sofar = createThinker(view, seat, 5, due.botRng, undefined, second.thinking?.checkpoint);
    const thought = capped.table.thinking?.thought ?? null;
    if (capped.log.length > 0) {
      expect(capped.log).toMatchObject([{ seat, action: sofar.result().action }]);
    } else {
      expect(thought?.action).toEqual(sofar.result().action);
      expect(capped.table.thinking?.playAt).toBeLessThanOrEqual(dueAt + FAST_HARD_CAP_MS + 300);
    }
  });

  it("the rematch keeps it", () => {
    const fast = speed(lobby("zero"), ANA, true, 1500).table;
    const { table: won } = playUntil(start(fast).table, (t) => t.status === "finished");
    expect(won.fast).toBe(true);
    let table = reduce(won, client(ANA, { t: "rematch", agree: true }), ctx(900_000)).table;
    const again = reduce(table, client(BEN, { t: "rematch", agree: true }), ctx(900_001));
    table = again.table;
    expect(table.status).toBe("playing");
    expect(table.gameNo).toBe(2);
    expect(table.fast).toBe(true);
    expect(seen(again.out, BEN)?.fast).toBe(true);
  });
});
