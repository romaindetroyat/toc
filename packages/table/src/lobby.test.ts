// The waiting room's server rules (plan 02-05, D-03, D-10, D-12): who may sit, stand, move people, set
// the computers' strength, leave and start. Every refusal is a code, never a message.

import type { Rng } from "@toc/engine";
import type { ServerFrame, TableFrame } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { createTable, type Out, reduce, type Table, tablePublic } from "./index.ts";

const ID = "abcdefghijklmnopqrstuv";
const ANA = "who-ana";
const BEN = "who-ben";
const CLO = "who-clo";
const DAN = "who-dan";
const EVE = "who-eve";
const ctx = (now = 2000) => ({ now, seed: (): Rng => [11, 22, 33, 44] });

type Command = Parameters<typeof reduce>[1];

function run(table: Table, commands: Command[]) {
  let t = table;
  let out: Out[] = [];
  for (const command of commands) {
    const result = reduce(t, command, ctx());
    t = result.table;
    out = result.out;
  }
  return { table: t, out };
}

const to = (out: Out[], who: string): ServerFrame[] =>
  out.filter((each) => each.to === who).map((each) => each.frame);

const client = (who: string, frame: Extract<Command, { t: "client" }>["frame"]): Command => ({
  t: "client",
  who,
  frame,
});

/** Ana (creator, bleu), Ben (jaune) and Clo (no seat) in the waiting room. */
function lobby(): Table {
  return run(createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8], test: { pace: "zero" } }), [
    { t: "hello", who: ANA, name: "Ana" },
    { t: "hello", who: BEN, name: "Ben" },
    { t: "hello", who: CLO, name: "Clo" },
    client(ANA, { t: "sit", seat: "bleu" }),
    client(BEN, { t: "sit", seat: "jaune" }),
  ]).table;
}

function started(): Table {
  return reduce(lobby(), client(ANA, { t: "start" }), ctx()).table;
}

/** The last table frame sent to `who`. */
function lastTable(out: Out[], who: string): TableFrame["table"] {
  const frames = to(out, who).filter((frame): frame is TableFrame => frame.t === "table");
  const last = frames[frames.length - 1];
  if (last === undefined) throw new Error(`no table frame for ${who}`);
  return last.table;
}

describe("the public table", () => {
  it("lists the unseated people who are online by first name, and nobody's id", () => {
    const table = lobby();
    expect(tablePublic(table).unseated).toEqual(["Clo"]);
    const gone = reduce(table, { t: "gone", who: CLO }, ctx()).table;
    expect(tablePublic(gone).unseated).toEqual([]);
    const text = JSON.stringify(tablePublic(table));
    for (const who of [ANA, BEN, CLO]) expect(text).not.toContain(who);
  });

  it("tells the others when someone without a seat arrives", () => {
    const { out } = run(lobby(), [{ t: "hello", who: DAN, name: "Dan" }]);
    expect(lastTable(out, ANA).unseated).toEqual(["Clo", "Dan"]);
    expect(lastTable(out, CLO).unseated).toEqual(["Clo", "Dan"]);
    expect(to(out, DAN)).toMatchObject([{ t: "welcome", you: { seat: null, host: false } }]);
  });
});

describe("stand and sit", () => {
  it("stand frees the person's seat; without a seat it changes nothing", () => {
    const table = lobby();
    const stood = reduce(table, client(BEN, { t: "stand" }), ctx());
    expect(stood.table.seats.jaune).toEqual({ kind: "free" });
    expect(stood.table.people.find((p) => p.who === BEN)?.seat).toBeNull();
    expect(to(stood.out, BEN)).toMatchObject([{ t: "welcome", you: { seat: null } }]);
    expect(lastTable(stood.out, ANA).seats.jaune).toMatchObject({ kind: "free", level: 3 });
    expect(lastTable(stood.out, ANA).unseated).toEqual(["Ben", "Clo"]);
    const nothing = reduce(table, client(CLO, { t: "stand" }), ctx());
    expect(nothing.table).toEqual(table);
    expect(nothing.out).toEqual([]);
  });

  it("sit from a seat moves the person; the old seat is free at the table's level for it", () => {
    const { table, out } = run(lobby(), [client(BEN, { t: "sit", seat: "vert" })]);
    expect(table.seats.jaune).toEqual({ kind: "free" });
    expect(table.seats.vert).toEqual({ kind: "human", who: BEN });
    expect(tablePublic(table).seats.jaune).toEqual({
      kind: "free",
      name: null,
      level: 3,
      online: true,
    });
    expect(to(out, BEN)).toMatchObject([{ t: "welcome", you: { seat: "vert" } }]);
  });

  it("refuses a sit when four people already hold the four seats (table-full)", () => {
    const full = run(lobby(), [
      { t: "hello", who: DAN, name: "Dan" },
      client(CLO, { t: "sit", seat: "rouge" }),
      client(DAN, { t: "sit", seat: "vert" }),
      { t: "hello", who: EVE, name: "Eve" },
    ]).table;
    const seatsPublic = tablePublic(full).seats;
    expect(Object.values(seatsPublic).every((seat) => seat.kind === "human")).toBe(true);
    const refused = reduce(full, client(EVE, { t: "sit", seat: "rouge" }), ctx());
    expect(to(refused.out, EVE)).toEqual([{ t: "error", code: "table-full" }]);
    expect(refused.table).toEqual(full);
    // A seated person may still change seats with nobody else: everything is taken.
    const taken = reduce(full, client(DAN, { t: "sit", seat: "rouge" }), ctx());
    expect(to(taken.out, DAN)).toEqual([{ t: "error", code: "seat-taken" }]);
  });

  it("refuses sit and stand after the start", () => {
    const table = started();
    for (const frame of [{ t: "sit", seat: "rouge" } as const, { t: "stand" } as const]) {
      const late = reduce(table, client(CLO, frame), ctx());
      expect(to(late.out, CLO)).toEqual([{ t: "error", code: "started" }]);
      expect(late.table).toEqual(table);
    }
    const seated = reduce(table, client(BEN, { t: "stand" }), ctx());
    expect(to(seated.out, BEN)).toEqual([{ t: "error", code: "started" }]);
  });
});

describe("move (the host only)", () => {
  it("moves a person to a free seat: the moved person gets a welcome, the others a table frame", () => {
    const { table, out } = run(lobby(), [client(ANA, { t: "move", who: "jaune", to: "vert" })]);
    expect(table.seats.jaune).toEqual({ kind: "free" });
    expect(table.seats.vert).toEqual({ kind: "human", who: BEN });
    expect(table.people.find((p) => p.who === BEN)?.seat).toBe("vert");
    expect(to(out, BEN)).toMatchObject([{ t: "welcome", you: { seat: "vert", host: false } }]);
    expect(lastTable(out, ANA).seats.vert).toMatchObject({ kind: "human", name: "Ben" });
    expect(lastTable(out, CLO).seats.jaune).toMatchObject({ kind: "free" });
  });

  it("swaps two people when the target seat is held by a human", () => {
    const { table, out } = run(lobby(), [client(ANA, { t: "move", who: "jaune", to: "bleu" })]);
    expect(table.seats.bleu).toEqual({ kind: "human", who: BEN });
    expect(table.seats.jaune).toEqual({ kind: "human", who: ANA });
    expect(to(out, BEN)).toMatchObject([{ t: "welcome", you: { seat: "bleu" } }]);
    expect(to(out, ANA)).toMatchObject([{ t: "welcome", you: { seat: "jaune", host: true } }]);
    expect(lastTable(out, CLO).host).toBe("jaune");
  });

  it("refuses a move by anyone but the host (not-host), after the start (started), of a free seat", () => {
    const table = lobby();
    for (const who of [BEN, CLO]) {
      const refused = reduce(table, client(who, { t: "move", who: "jaune", to: "vert" }), ctx());
      expect(to(refused.out, who)).toEqual([{ t: "error", code: "not-host" }]);
      expect(refused.table).toEqual(table);
    }
    const free = reduce(table, client(ANA, { t: "move", who: "rouge", to: "vert" }), ctx());
    expect(to(free.out, ANA)).toEqual([{ t: "error", code: "illegal" }]);
    expect(free.table).toEqual(table);
    const same = reduce(table, client(ANA, { t: "move", who: "jaune", to: "jaune" }), ctx());
    expect(same.table).toEqual(table);
    const after = started();
    const late = reduce(after, client(ANA, { t: "move", who: "jaune", to: "vert" }), ctx());
    expect(to(late.out, ANA)).toEqual([{ t: "error", code: "started" }]);
    expect(late.table).toEqual(after);
  });
});

describe("level (the host only, free seats only)", () => {
  it("saves the level of a free seat at once and shows it to everyone", () => {
    const { table, out } = run(lobby(), [client(ANA, { t: "level", seat: "rouge", level: 5 })]);
    expect(table.levels.rouge).toBe(5);
    for (const who of [ANA, BEN, CLO]) {
      expect(lastTable(out, who).seats.rouge).toMatchObject({ kind: "free", level: 5 });
    }
    // The computer that sits there at the start plays at that level.
    const begun = reduce(table, client(ANA, { t: "start" }), ctx()).table;
    expect(begun.levels.rouge).toBe(5);
    expect(begun.seats.rouge.kind).toBe("bot");
  });

  it("refuses a level on a human seat, by anyone but the host, out of range, or after the start", () => {
    const table = lobby();
    const human = reduce(table, client(ANA, { t: "level", seat: "jaune", level: 5 }), ctx());
    expect(to(human.out, ANA)).toEqual([{ t: "error", code: "seat-taken" }]);
    expect(human.table).toEqual(table);
    const byBen = reduce(table, client(BEN, { t: "level", seat: "rouge", level: 5 }), ctx());
    expect(to(byBen.out, BEN)).toEqual([{ t: "error", code: "not-host" }]);
    expect(byBen.table).toEqual(table);
    const wild = reduce(
      table,
      client(ANA, { t: "level", seat: "rouge", level: 9 as unknown as 5 }),
      ctx(),
    );
    expect(to(wild.out, ANA)).toEqual([{ t: "error", code: "bad-frame" }]);
    expect(wild.table).toEqual(table);
    const after = started();
    const late = reduce(after, client(ANA, { t: "level", seat: "rouge", level: 5 }), ctx());
    expect(to(late.out, ANA)).toEqual([{ t: "error", code: "started" }]);
  });
});

describe("leave", () => {
  it("removes a person from the waiting room and frees the seat", () => {
    const { table, out } = run(lobby(), [client(BEN, { t: "leave" })]);
    expect(table.people.map((p) => p.who)).toEqual([ANA, CLO]);
    expect(table.seats.jaune).toEqual({ kind: "free" });
    expect(lastTable(out, ANA).seats.jaune).toMatchObject({ kind: "free" });
    expect(to(out, BEN)).toEqual([]);
    // Coming back is a new arrival.
    const back = reduce(table, { t: "hello", who: BEN, name: "Ben" }, ctx());
    expect(to(back.out, BEN)).toMatchObject([{ t: "welcome", you: { seat: null, host: false } }]);
  });

  it("keeps the creator's role when the creator leaves; it comes back with them", () => {
    const { table, out } = run(lobby(), [client(ANA, { t: "leave" })]);
    expect(table.creator).toBe(ANA);
    expect(table.seats.bleu).toEqual({ kind: "free" });
    const seen = lastTable(out, BEN);
    expect(seen.host).toBeNull();
    expect(seen.creatorName).toBe("Ana");
    expect(seen.unseated).toEqual(["Clo"]);
    // Nobody else may start or move people meanwhile.
    const byBen = reduce(table, client(BEN, { t: "start" }), ctx());
    expect(to(byBen.out, BEN)).toEqual([{ t: "error", code: "not-host" }]);
    const back = reduce(table, { t: "hello", who: ANA, name: "Ana" }, ctx());
    expect(to(back.out, ANA)).toMatchObject([{ t: "welcome", you: { seat: null, host: true } }]);
  });
});

describe("start with unseated people, and late arrivals (D-10, D-12)", () => {
  it("starts; the unseated get a table frame with status playing and never a view", () => {
    const result = reduce(lobby(), client(ANA, { t: "start" }), ctx());
    expect(result.table.status).toBe("playing");
    const clo = to(result.out, CLO);
    expect(clo).toHaveLength(1);
    expect(clo[0]).toMatchObject({ t: "table", table: { status: "playing" } });
    expect(JSON.stringify(clo)).not.toContain('"view"');
  });

  it("welcomes an unknown person after the start with no seat and no view, and refuses their sit", () => {
    const table = started();
    const late = reduce(table, { t: "hello", who: DAN, name: "Dan" }, ctx());
    expect(to(late.out, DAN)).toMatchObject([
      { t: "welcome", you: { seat: null, host: false }, view: null, table: { status: "playing" } },
    ]);
    const sit = reduce(late.table, client(DAN, { t: "sit", seat: "rouge" }), ctx());
    expect(to(sit.out, DAN)).toEqual([{ t: "error", code: "started" }]);
    expect(sit.table.seats.rouge.kind).toBe("bot");
  });

  it("refuses a start by the host without a seat (not-host)", () => {
    const table = run(lobby(), [client(ANA, { t: "stand" })]).table;
    const refused = reduce(table, client(ANA, { t: "start" }), ctx());
    expect(to(refused.out, ANA)).toEqual([{ t: "error", code: "not-host" }]);
    expect(refused.table.status).toBe("lobby");
  });
});
