import { eventsDuration } from "@toc/board";
import { BOT_NAMES } from "@toc/bots";
import {
  type Action,
  type CardId,
  COLORS,
  type Color,
  type GameEvent,
  type GameState,
  legalActions,
  type Rng,
  viewFor,
} from "@toc/engine";
import type { ServerFrame } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { createTable, nextDeadline, type Out, reduce, type Table } from "./index.ts";

const ID = "abcdefghijklmnopqrstuv";
const ANA = "who-ana";
const BEN = "who-ben";
const CLO = "who-clo";
const DECK: Rng = [11, 22, 33, 44];
const ctx = (now = 2000) => ({ now, seed: (): Rng => [...DECK] });

function fresh(pace: "zero" | "normal" = "zero"): Table {
  return createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8], test: { pace } });
}

function run(table: Table, commands: Parameters<typeof reduce>[1][], now = 2000) {
  let t = table;
  let out: Out[] = [];
  for (const command of commands) {
    const result = reduce(t, command, ctx(now));
    t = result.table;
    out = result.out;
  }
  return { table: t, out };
}

const to = (out: Out[], who: string): ServerFrame[] =>
  out.filter((each) => each.to === who).map((each) => each.frame);

/** The game of a started table. */
function gameOf(table: Table): GameState {
  if (table.game === null) throw new Error("no game");
  return table.game;
}

/** Ana (creator) on bleu and Ben on jaune, in the waiting room. */
function lobby(pace: "zero" | "normal" = "zero"): Table {
  return run(fresh(pace), [
    { t: "hello", who: ANA, name: "Ana" },
    { t: "hello", who: BEN, name: "Ben" },
    { t: "client", who: ANA, frame: { t: "sit", seat: "bleu" } },
    { t: "client", who: BEN, frame: { t: "sit", seat: "jaune" } },
  ]).table;
}

function started(pace: "zero" | "normal" = "zero") {
  return reduce(lobby(pace), { t: "client", who: ANA, frame: { t: "start" } }, ctx());
}

describe("hello and seats", () => {
  it("makes the first person the creator and host; the second is unseated", () => {
    const first = reduce(fresh(), { t: "hello", who: ANA, name: "Ana" }, ctx());
    expect(first.table.creator).toBe(ANA);
    expect(to(first.out, ANA)).toMatchObject([
      { t: "welcome", you: { seat: null, host: true }, view: null, seq: 0 },
    ]);
    const second = reduce(first.table, { t: "hello", who: BEN, name: "Ben" }, ctx());
    expect(second.table.creator).toBe(ANA);
    expect(to(second.out, BEN)).toMatchObject([{ t: "welcome", you: { seat: null, host: false } }]);
    // Nothing public changed: an unseated person is not part of the public table yet.
    expect(to(second.out, ANA)).toEqual([]);
    expect(second.table.people.map((p) => [p.who, p.seat])).toEqual([
      [ANA, null],
      [BEN, null],
    ]);
  });

  it("seats a person on a free colour and refuses a taken one", () => {
    const { table } = run(fresh(), [
      { t: "hello", who: ANA, name: "Ana" },
      { t: "hello", who: BEN, name: "Ben" },
      { t: "client", who: ANA, frame: { t: "sit", seat: "bleu" } },
    ]);
    expect(table.seats.bleu).toEqual({ kind: "human", who: ANA });
    const taken = reduce(
      table,
      { t: "client", who: BEN, frame: { t: "sit", seat: "bleu" } },
      ctx(),
    );
    expect(to(taken.out, BEN)).toEqual([{ t: "error", code: "seat-taken" }]);
    expect(taken.table).toEqual(table);
    const moved = reduce(
      table,
      { t: "client", who: ANA, frame: { t: "sit", seat: "rouge" } },
      ctx(),
    );
    expect(moved.table.seats.bleu).toEqual({ kind: "free" });
    expect(moved.table.seats.rouge).toEqual({ kind: "human", who: ANA });
    expect(to(moved.out, ANA)).toMatchObject([{ t: "welcome", you: { seat: "rouge" } }]);
    expect(to(moved.out, BEN)).toMatchObject([{ t: "table" }]);
  });

  it("refuses a seat once the game has started", () => {
    const { table } = started();
    const late = run(table, [
      { t: "hello", who: CLO, name: "Clo" },
      { t: "client", who: CLO, frame: { t: "sit", seat: "rouge" } },
    ]);
    expect(to(late.out, CLO)).toEqual([{ t: "error", code: "started" }]);
  });

  it("never puts a token, a hash or a GameState in the public table", () => {
    const welcome = to(started().out, BEN).find((frame) => frame.t === "table");
    const text = JSON.stringify(welcome);
    expect(text).not.toContain(ANA);
    expect(text).not.toContain(BEN);
    expect(text).not.toContain('"state"');
    expect(text).not.toContain("rng");
  });
});

describe("start", () => {
  it("is refused to anyone but the seated host", () => {
    const table = lobby();
    const byBen = reduce(table, { t: "client", who: BEN, frame: { t: "start" } }, ctx());
    expect(to(byBen.out, BEN)).toEqual([{ t: "error", code: "not-host" }]);
    expect(byBen.table).toEqual(table);
    const unseated = run(fresh(), [
      { t: "hello", who: ANA, name: "Ana" },
      { t: "client", who: ANA, frame: { t: "start" } },
    ]);
    expect(to(unseated.out, ANA)).toEqual([{ t: "error", code: "not-host" }]);
    expect(unseated.table.status).toBe("lobby");
  });

  it("seats Galopeur horses on the free seats and deals each person only their own hand", () => {
    const withClo = run(lobby(), [{ t: "hello", who: CLO, name: "Clo" }]).table;
    const { table, out, log } = reduce(
      withClo,
      { t: "client", who: ANA, frame: { t: "start" } },
      ctx(),
    );
    expect(table.status).toBe("playing");
    expect(table.gameNo).toBe(1);
    expect(table.game?.phase).toBe("exchange");
    const bots = (["rouge", "vert"] as const).map((c) => table.seats[c]);
    for (const seat of bots) {
      expect(seat.kind).toBe("bot");
      if (seat.kind === "bot") expect(BOT_NAMES).toContain(seat.name);
    }
    expect(new Set(bots.map((s) => (s.kind === "bot" ? s.name : ""))).size).toBe(2);
    expect(table.levels.rouge).toBe(3);
    expect(table.levels.vert).toBe(3);
    expect(log).toHaveLength(1);

    for (const [who, seat] of [
      [ANA, "bleu"],
      [BEN, "jaune"],
    ] as const) {
      const frames = to(out, who);
      const events = frames.filter((frame) => frame.t === "events");
      expect(events).toHaveLength(1);
      const frame = events[0];
      if (frame?.t !== "events") throw new Error("no events frame");
      const dealt = frame.events.filter(
        (e): e is Extract<GameEvent, { t: "handDealt" }> => e.t === "handDealt",
      );
      expect(dealt).toHaveLength(4);
      for (const each of dealt) {
        if (each.seat === seat) expect(each.cards).toEqual(table.game?.hands[seat]);
        else expect(each.cards).toBeNull();
      }
      expect(frame.view).toEqual(viewFor(gameOf(table), seat));
      expect(frames.map((f) => f.t)).toContain("table");
    }
    expect(to(out, CLO).map((frame) => frame.t)).toEqual(["table"]);
  });
});

describe("act", () => {
  it("answers a stale base with an error and a welcome to that person only", () => {
    const { table } = started();
    const card = gameOf(table).hands.bleu[0] as CardId;
    const result = reduce(
      table,
      {
        t: "client",
        who: ANA,
        frame: { t: "act", base: table.seq + 5, action: { t: "give", card } },
      },
      ctx(),
    );
    expect(to(result.out, ANA)).toMatchObject([
      { t: "error", code: "stale" },
      { t: "welcome", seq: table.seq, you: { seat: "bleu" } },
    ]);
    expect(to(result.out, BEN)).toEqual([]);
    expect(result.table).toEqual(table);
  });

  it("refuses an illegal action and leaves the table as it was", () => {
    const { table } = started();
    const before = JSON.parse(JSON.stringify(table)) as Table;
    const notHeld = gameOf(table).hands.jaune[0] as CardId;
    const result = reduce(
      table,
      {
        t: "client",
        who: ANA,
        frame: { t: "act", base: table.seq, action: { t: "give", card: notHeld } },
      },
      ctx(),
    );
    expect(to(result.out, ANA)).toEqual([{ t: "error", code: "illegal" }]);
    expect(result.table).toEqual(before);
    expect(result.log).toEqual([]);
  });

  it("applies a legal action, logs it and sends each seated person their own projection", () => {
    const { table } = started();
    const action: Action = { t: "give", card: gameOf(table).hands.bleu[0] as CardId };
    const result = reduce(
      table,
      { t: "client", who: ANA, frame: { t: "act", base: table.seq, action } },
      ctx(),
    );
    expect(result.table.seq).toBe(table.seq + 1);
    expect(result.log).toEqual([
      { seq: table.seq + 1, gameNo: 1, seat: "bleu", action, events: expect.any(Array) },
    ]);
    for (const [who, seat] of [
      [ANA, "bleu"],
      [BEN, "jaune"],
    ] as const) {
      const frame = to(result.out, who).find((f) => f.t === "events");
      expect(frame).toEqual({
        t: "events",
        seq: table.seq + 1,
        events: expect.any(Array),
        view: viewFor(gameOf(result.table), seat),
      });
    }
    expect(gameOf(result.table).given.bleu).toBe(action.card);
  });

  it("refuses an act from a person without a seat", () => {
    const withClo = run(started().table, [{ t: "hello", who: CLO, name: "Clo" }]).table;
    const result = reduce(
      withClo,
      { t: "client", who: CLO, frame: { t: "act", base: withClo.seq, action: { t: "discard" } } },
      ctx(),
    );
    expect(to(result.out, CLO)).toEqual([{ t: "error", code: "illegal" }]);
    expect(result.table).toEqual(withClo);
  });
});

describe("computer players", () => {
  it("arms a bot deadline at once under the zero test pace, and a tick plays one bot action", () => {
    const { table } = started();
    expect(table.deadlines.bot).toEqual({ at: 2000, seq: table.seq });
    expect(nextDeadline(table)).toBe(2000);
    const early = reduce(table, { t: "tick", retry: false }, ctx(1999));
    expect(early.table).toBe(table);
    const ticked = reduce(table, { t: "tick", retry: false }, ctx(2000));
    expect(ticked.table.seq).toBe(table.seq + 1);
    // The first bot in COLORS order whose give is missing: rouge.
    expect(ticked.log).toMatchObject([{ seat: "rouge", action: { t: "give" } }]);
    expect(gameOf(ticked.table).given.rouge).not.toBeNull();
    expect(to(ticked.out, ANA).filter((f) => f.t === "events")).toHaveLength(1);
  });

  it("decides at once and plays after the animation of the last batch under the normal pace", () => {
    const { table, log } = started("normal");
    const deal = log[0]?.events as GameEvent[];
    expect(eventsDuration(deal, "normal")).toBeGreaterThan(0);
    // Decide first (plan 02-03): the decision is due at once, the play once the deal is animated.
    expect(table.deadlines.bot?.at).toBe(2000);
    const decided = reduce(table, { t: "tick", retry: false }, ctx(2000)).table;
    expect(decided.seq).toBe(table.seq);
    expect(decided.deadlines.bot?.at).toBeGreaterThanOrEqual(2000 + eventsDuration(deal, "normal"));
  });

  it("does nothing on a tick for a stale seq", () => {
    const { table } = started();
    const stale: Table = { ...table, deadlines: { bot: { at: 0, seq: table.seq - 1 } } };
    const result = reduce(stale, { t: "tick", retry: false }, ctx());
    expect(result.table.game).toEqual(stale.game);
    expect(result.table.seq).toBe(stale.seq);
    expect(result.out).toEqual([]);
    expect(result.log).toEqual([]);
  });

  it("plays a whole game: two people and two Galopeurs, every move through reduce", () => {
    let { table } = started();
    const humans: Record<string, Color> = { [ANA]: "bleu", [BEN]: "jaune" };
    let now = 2000;
    for (let step = 0; step < 5000 && gameOf(table).phase !== "won"; step++) {
      now += 1;
      if (table.deadlines.bot !== undefined) {
        table = reduce(table, { t: "tick", retry: false }, ctx(now)).table;
        continue;
      }
      const game = gameOf(table);
      const who = Object.keys(humans).find((w) => {
        const seat = humans[w] as Color;
        return game.phase === "exchange" ? game.given[seat] === null : game.turn === seat;
      });
      if (who === undefined) throw new Error("nobody is due");
      const seat = humans[who] as Color;
      const action = legalActions(viewFor(game, seat), seat)[0] as Action;
      const result = reduce(
        table,
        { t: "client", who, frame: { t: "act", base: table.seq, action } },
        ctx(now),
      );
      expect(result.table.seq).toBe(table.seq + 1);
      table = result.table;
    }
    expect(gameOf(table).phase).toBe("won");
    expect(table.deadlines.bot).toBeUndefined();
    expect(COLORS.every((c) => table.seats[c].kind !== "free")).toBe(true);
  });
});
