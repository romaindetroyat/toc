// The record of a finished game, phase 5 (plan 05-01, HIST-02, D-01, D-04; 05-RESEARCH Pattern 1):
// besides the 02-09 fields, each human seat carries its person's account (null for a guest), the
// knights it ate and lost (table.tally, folded from the engine's events in commitPlay) and its knights
// home (the final pawns); the record names the table creator. The tally starts again with every game
// (the start and the rematch) and a snapshot from before this plan gets an empty one. The record and
// the tally stay on the server: no frame carries them.

import type { Rng, Scenario } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { copyTable, createTable, gameRecordOf, type Reduced, reduce, type Table } from "./index.ts";

const ID = "abcdefghijklmnopqrstuv";
const ANA = "who-ana";
const MAMIE = "who-mamie";
const BEN = "who-ben";
const SEED: Rng = [11, 22, 33, 44];

type Command = Parameters<typeof reduce>[1];
type ClientFrameOf = Extract<Command, { t: "client" }>["frame"];

const client = (who: string, frame: ClientFrameOf): Command => ({ t: "client", who, frame });
const ctx = (now: number, seed: Rng = SEED) => ({ now, seed: (): Rng => seed });

/**
 * Bleu's 2 lands on vert's knight (cell 66: vert's progress 12) and eats it; bleu's 5 then brings
 * bleu's last knight home, the eighth of bleu-rouge (rouge is all home).
 */
const CAPTURE_THEN_WIN: Scenario["before"] = {
  pawns: {
    bleu: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 64 }],
    rouge: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
    vert: [{ p: 12 }, "S", "S", "S"],
  },
  hands: { bleu: ["2S", "5S"] },
  turn: "bleu",
};

/** Ana (account, creator) bleu, Mamie (guest) jaune, Ben (account) vert, rouge a computer; started. */
function started(): Table {
  let table = createTable({
    tableId: ID,
    now: 1000,
    seed: [5, 6, 7, 8],
    test: { pace: "zero", before: CAPTURE_THEN_WIN },
  });
  for (const command of [
    { t: "hello", who: ANA, name: "Ana", account: { id: "acc-ana", pseudo: "Ana" } },
    { t: "hello", who: MAMIE, name: "Mamie" },
    { t: "hello", who: BEN, name: "Ben", account: { id: "acc-ben", pseudo: "Benoît" } },
    client(ANA, { t: "sit", seat: "bleu" }),
    client(MAMIE, { t: "sit", seat: "jaune" }),
    client(BEN, { t: "sit", seat: "vert" }),
  ] as Command[]) {
    table = reduce(table, command, ctx(1000)).table;
  }
  return reduce(table, client(ANA, { t: "start" }), ctx(2000)).table;
}

const move = (table: Table, card: string, now: number): Reduced =>
  reduce(
    table,
    client(ANA, { t: "act", base: table.seq, action: { t: "move", card, pawn: "bleu3" } as never }),
    ctx(now),
  );

/** Bleu eats vert's knight at 2500, then wins at 3000. */
function won(): { eat: Reduced; win: Reduced } {
  const eat = move(started(), "2S", 2500);
  const win = move(eat.table, "5S", 3000);
  return { eat, win };
}

describe("the tally of a game (plan 05-01)", () => {
  it("is folded from the events of every accepted play", () => {
    const { eat } = won();
    expect(eat.table.tally.bleu).toEqual({ captured: 1, lost: 0 });
    expect(eat.table.tally.vert).toEqual({ captured: 0, lost: 1 });
    expect(eat.table.tally.jaune).toEqual({ captured: 0, lost: 0 });
  });

  it("starts at zero when a game starts, whatever the table held", () => {
    let table = createTable({
      tableId: ID,
      now: 1000,
      seed: [5, 6, 7, 8],
      test: { pace: "zero", before: CAPTURE_THEN_WIN },
    });
    for (const command of [
      { t: "hello", who: ANA, name: "Ana" },
      client(ANA, { t: "sit", seat: "bleu" }),
    ] as Command[]) {
      table = reduce(table, command, ctx(1000)).table;
    }
    expect(table.tally.bleu).toEqual({ captured: 0, lost: 0 });
    table.tally.bleu.captured = 9;
    const after = reduce(table, client(ANA, { t: "start" }), ctx(2000)).table;
    expect(after.tally.bleu).toEqual({ captured: 0, lost: 0 });
  });

  it("starts at zero again with the rematch", () => {
    const { win } = won();
    expect(win.table.tally.bleu.captured).toBe(1);
    let table = win.table;
    for (const who of [ANA, MAMIE, BEN]) {
      table = reduce(table, client(who, { t: "rematch", agree: true }), ctx(4000)).table;
    }
    expect(table.gameNo).toBe(2);
    expect(table.status).toBe("playing");
    expect(table.tally).toEqual({
      bleu: { captured: 0, lost: 0 },
      jaune: { captured: 0, lost: 0 },
      rouge: { captured: 0, lost: 0 },
      vert: { captured: 0, lost: 0 },
    });
  });

  it("a snapshot from before this plan gets an empty tally", () => {
    const table = started() as Partial<Table>;
    delete table.tally;
    const copy = copyTable(table as Table);
    expect(copy.tally.rouge).toEqual({ captured: 0, lost: 0 });
  });
});

describe("the record of a finished game, phase 5 (plan 05-01)", () => {
  it("carries each seat's account, tally and knights home, and the creator's name", () => {
    const { win } = won();
    const record = win.records?.[0];
    expect(record).toBeDefined();
    expect(record?.creatorName).toBe("Ana");
    expect(record?.winner).toBe("bleu-rouge");
    const seats = record?.seats ?? [];
    expect(seats.map((seat) => [seat.colour, seat.kind, seat.account])).toEqual([
      ["bleu", "human", "acc-ana"],
      ["jaune", "human", null],
      ["rouge", "bot", null],
      ["vert", "human", "acc-ben"],
    ]);
    expect(seats[0]).toMatchObject({ name: "Ana", captured: 1, lost: 0, home: 4 });
    expect(seats[1]).toMatchObject({ name: "Mamie", captured: 0, lost: 0, home: 0 });
    expect(seats[2]).toMatchObject({ captured: 0, lost: 0, home: 4 });
    expect(seats[3]).toMatchObject({ name: "Benoît", captured: 0, lost: 1, home: 0 });
    expect(gameRecordOf(win.table)).toEqual(record);
  });

  it("never reaches a frame: no account id and no tally in what the table sends (creatorName is public since 02)", () => {
    const { eat, win } = won();
    const text = JSON.stringify([...eat.out, ...win.out]);
    expect(text).not.toContain("acc-ana");
    expect(text).not.toContain("acc-ben");
    expect(text).not.toContain('"captured"');
  });
});
