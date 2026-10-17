import { BOT_NAMES } from "@toc/bots";
import type { Rng } from "@toc/engine";
import { parseTableSummary } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { createTable, reduce, summary, type Table } from "./index.ts";

const ID = "abcdefghijklmnopqrstuv";
const ANA = "who-ana-0000000000000000000000000000000000";
const BEN = "who-ben-0000000000000000000000000000000000";
const ctx = (now: number) => ({ now, seed: (): Rng => [11, 22, 33, 44] });

function run(table: Table, commands: Parameters<typeof reduce>[1][], now = 5000): Table {
  let t = table;
  for (const command of commands) t = reduce(t, command, ctx(now)).table;
  return t;
}

function lobby(): Table {
  return run(createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8], test: { pace: "zero" } }), [
    { t: "hello", who: ANA, name: "Ana" },
    { t: "client", who: ANA, frame: { t: "sit", seat: "bleu" } },
    { t: "hello", who: BEN, name: "Ben" },
    { t: "client", who: BEN, frame: { t: "sit", seat: "jaune" } },
  ]);
}

/** Card ids of the engine (« 7H », « 13S »…) anywhere in a text. */
const CARD = /\b(1[0-3]|[1-9])[SHDC]\b/;

describe("summary(table)", () => {
  it("a new table: the waiting room, nobody, four free seats", () => {
    const table = createTable({ tableId: ID, now: 1000, seed: [5, 6, 7, 8] });
    expect(summary(table)).toEqual({
      status: "lobby",
      creatorName: null,
      seats: {
        bleu: { kind: "free", name: null },
        jaune: { kind: "free", name: null },
        rouge: { kind: "free", name: null },
        vert: { kind: "free", name: null },
      },
      gameNo: 0,
      updatedAt: 1000,
      missing: [],
    });
  });

  it("the waiting room: the creator's first name, the people seated, the last activity", () => {
    const table = lobby();
    expect(summary(table)).toEqual({
      status: "lobby",
      creatorName: "Ana",
      seats: {
        bleu: { kind: "human", name: "Ana" },
        jaune: { kind: "human", name: "Ben" },
        rouge: { kind: "free", name: null },
        vert: { kind: "free", name: null },
      },
      gameNo: 0,
      updatedAt: 5000,
      missing: [],
    });
  });

  it("a game: the computers by their horse names; no person id, token hash, table id or card", () => {
    const started = run(lobby(), [{ t: "client", who: ANA, frame: { t: "start" } }], 9000);
    const result = summary(started);
    expect(result.status).toBe("playing");
    expect(result.gameNo).toBe(started.gameNo);
    expect(result.updatedAt).toBe(9000);
    for (const color of ["rouge", "vert"] as const) {
      expect(result.seats[color].kind).toBe("bot");
      expect(BOT_NAMES).toContain(result.seats[color].name);
    }
    const text = JSON.stringify(result);
    expect(text).not.toContain(ANA);
    expect(text).not.toContain(BEN);
    expect(text).not.toContain(ID);
    expect(text).not.toMatch(CARD);
    expect(text).not.toMatch(/who|token|tableId|hand|deck|rng|talon/);
    // The shape the browser accepts, exactly.
    expect(parseTableSummary(JSON.parse(text))).toEqual(result);
  });

  it("a won game reads « finished »", () => {
    const started = run(lobby(), [{ t: "client", who: ANA, frame: { t: "start" } }], 9000);
    const won: Table = JSON.parse(JSON.stringify(started));
    if (won.game === null) throw new Error("no game");
    won.game.phase = "won";
    expect(summary(won).status).toBe("finished");
  });

  it("the browser refuses a summary with an extra key, a bad status or a seat missing", () => {
    const good = summary(lobby());
    expect(parseTableSummary(good)).toEqual(good);
    expect(parseTableSummary({ ...good, who: "x" })).toBeNull();
    expect(parseTableSummary({ ...good, status: "gone" })).toBeNull();
    expect(parseTableSummary({ ...good, seats: { bleu: good.seats.bleu } })).toBeNull();
    expect(parseTableSummary("lobby")).toBeNull();
    expect(parseTableSummary(null)).toBeNull();
  });
});
