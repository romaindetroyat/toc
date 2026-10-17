import { describe, expect, it } from "vitest";
import {
  CLOSE_ELSEWHERE,
  CLOSE_GONE,
  CLOSE_SILENT,
  CLOSE_VERSION,
  MAX_FRAME_CHARS,
  PROTOCOL_VERSION,
  parseClientFrame,
  parseCreateTestOptions,
  parseServerFrame,
} from "./frames.ts";
import { isTableId, normalizeName, toBase64Url } from "./names.ts";

const TOKEN = "A".repeat(43);
const ok = (frame: unknown) => parseClientFrame(JSON.stringify(frame));

describe("parseClientFrame", () => {
  it("accepts the four client frames", () => {
    expect(ok({ t: "hello", v: PROTOCOL_VERSION, token: TOKEN, name: "Ana" })).toEqual({
      ok: true,
      frame: { t: "hello", v: PROTOCOL_VERSION, token: TOKEN, name: "Ana" },
    });
    expect(ok({ t: "sit", seat: "jaune" })).toEqual({
      ok: true,
      frame: { t: "sit", seat: "jaune" },
    });
    expect(ok({ t: "start" })).toEqual({ ok: true, frame: { t: "start" } });
    expect(ok({ t: "act", base: 0, action: { t: "discard" } }).ok).toBe(true);
  });

  it("accepts every engine action shape", () => {
    for (const action of [
      { t: "give", card: "13S" },
      { t: "exit", card: "1H", pawn: "bleu0" },
      { t: "move", card: "10D", pawn: "vert3" },
      { t: "swap", card: "11C", pawn: "jaune1", target: "rouge2" },
      {
        t: "seven",
        card: "7H",
        plan: [
          { pawn: "bleu0", steps: 3 },
          { pawn: "bleu1", steps: 4 },
        ],
      },
      { t: "discard" },
    ]) {
      expect(ok({ t: "act", base: 12, action }), JSON.stringify(action)).toEqual({
        ok: true,
        frame: { t: "act", base: 12, action },
      });
    }
  });

  it("normalizes the hello's first name and refuses an empty one", () => {
    const hello = (name: string) => ok({ t: "hello", v: 1, token: TOKEN, name });
    expect(hello("  Ana   Maria ")).toEqual({
      ok: true,
      frame: { t: "hello", v: 1, token: TOKEN, name: "Ana Maria" },
    });
    expect(hello("   ").ok).toBe(false);
  });

  it("refuses what is not a frame", () => {
    const refused: unknown[] = [
      { t: "shout" },
      { t: "start", extra: 1 },
      { t: "sit", seat: "violet" },
      { t: "sit" },
      { t: "hello", v: 1, token: "short", name: "Ana" },
      { t: "hello", v: 1, token: `${"A".repeat(42)}=`, name: "Ana" },
      { t: "act", base: -1, action: { t: "discard" } },
      { t: "act", base: 1.5, action: { t: "discard" } },
      { t: "act", base: "1", action: { t: "discard" } },
      { t: "act", base: 0, action: { t: "give", card: "14S" } },
      { t: "act", base: 0, action: { t: "give", card: "0H" } },
      { t: "act", base: 0, action: { t: "give", card: "5X" } },
      { t: "act", base: 0, action: { t: "move", card: "5H", pawn: "bleu4" } },
      { t: "act", base: 0, action: { t: "move", card: "5H", pawn: "noir0" } },
      { t: "act", base: 0, action: { t: "move", card: "5H" } },
      { t: "act", base: 0, action: { t: "discard", card: "5H" } },
      { t: "act", base: 0, action: { t: "fly" } },
      {
        t: "act",
        base: 0,
        action: {
          t: "seven",
          card: "7H",
          plan: [1, 1, 1, 1, 3].map((steps, i) => ({ pawn: `bleu${i % 4}`, steps })),
        },
      },
      {
        t: "act",
        base: 0,
        action: { t: "seven", card: "7H", plan: [{ pawn: "bleu0", steps: 8 }] },
      },
      {
        t: "act",
        base: 0,
        action: { t: "seven", card: "7H", plan: [{ pawn: "bleu0", steps: 0 }] },
      },
      { t: "act", base: 0, action: { t: "seven", card: "7H", plan: [] } },
      null,
      [],
      "start",
    ];
    for (const frame of refused) expect(ok(frame), JSON.stringify(frame)).toEqual({ ok: false });
    expect(parseClientFrame("{not json")).toEqual({ ok: false });
    expect(parseClientFrame(42)).toEqual({ ok: false });
  });

  it("accepts the four lobby frames: stand, move, level, leave", () => {
    expect(ok({ t: "stand" })).toEqual({ ok: true, frame: { t: "stand" } });
    expect(ok({ t: "move", who: "jaune", to: "vert" })).toEqual({
      ok: true,
      frame: { t: "move", who: "jaune", to: "vert" },
    });
    for (const level of [1, 2, 3, 4, 5]) {
      expect(ok({ t: "level", seat: "rouge", level })).toEqual({
        ok: true,
        frame: { t: "level", seat: "rouge", level },
      });
    }
    expect(ok({ t: "leave" })).toEqual({ ok: true, frame: { t: "leave" } });
  });

  it("refuses a level outside 1 to 5, a string level, an unknown colour, an extra key", () => {
    const refused: unknown[] = [
      { t: "level", seat: "rouge", level: 0 },
      { t: "level", seat: "rouge", level: 6 },
      { t: "level", seat: "rouge", level: 2.5 },
      { t: "level", seat: "rouge", level: "3" },
      { t: "level", seat: "violet", level: 3 },
      { t: "level", level: 3 },
      { t: "move", who: "violet", to: "vert" },
      { t: "move", who: "jaune", to: "noir" },
      { t: "move", who: "jaune" },
      { t: "move", who: "jaune", to: "vert", extra: true },
      { t: "stand", seat: "bleu" },
      { t: "leave", now: true },
    ];
    for (const frame of refused) expect(ok(frame), JSON.stringify(frame)).toEqual({ ok: false });
  });

  it("accepts the pause choices and resume (plan 02-06), a level with the hand-over only", () => {
    expect(ok({ t: "pause", choice: "wait" })).toEqual({
      ok: true,
      frame: { t: "pause", choice: "wait" },
    });
    expect(ok({ t: "pause", choice: "save" }).ok).toBe(true);
    expect(ok({ t: "pause", choice: "bot" })).toEqual({
      ok: true,
      frame: { t: "pause", choice: "bot" },
    });
    expect(ok({ t: "pause", choice: "bot", level: 4 })).toEqual({
      ok: true,
      frame: { t: "pause", choice: "bot", level: 4 },
    });
    expect(ok({ t: "resume" })).toEqual({ ok: true, frame: { t: "resume" } });
    for (const frame of [
      { t: "pause", choice: "wait", level: 3 },
      { t: "pause", choice: "save", level: 1 },
      { t: "pause", choice: "bot", level: 6 },
      { t: "pause", choice: "bot", level: "4" },
      { t: "pause", choice: "later" },
      { t: "pause" },
      { t: "resume", now: 1 },
    ]) {
      expect(ok(frame).ok, JSON.stringify(frame)).toBe(false);
    }
  });

  it("refuses any text longer than MAX_FRAME_CHARS before parsing it", () => {
    const padded = JSON.stringify({ t: "hello", v: 1, token: TOKEN, name: "Ana" }).padEnd(
      MAX_FRAME_CHARS + 1,
      " ",
    );
    expect(MAX_FRAME_CHARS).toBe(4096);
    expect(parseClientFrame(padded)).toEqual({ ok: false });
    expect(parseClientFrame(padded.slice(0, MAX_FRAME_CHARS)).ok).toBe(true);
  });
});

describe("normalizeName", () => {
  it("trims, collapses spaces and applies NFC", () => {
    expect(normalizeName("  Ana ")).toBe("Ana");
    expect(normalizeName("Zoe\u0301")).toBe("Zoé");
    expect(normalizeName("Ana\u0000\u0007 Lou")).toBe("Ana Lou");
    expect(normalizeName("Ana\u202Eiram")).toBe("Anairam");
  });

  it("refuses empty names and names longer than 20 code points", () => {
    expect(normalizeName("")).toBeNull();
    expect(normalizeName("    ")).toBeNull();
    expect(normalizeName("a".repeat(20))).toBe("a".repeat(20));
    expect(normalizeName("a".repeat(21))).toBeNull();
    expect(normalizeName("🐴".repeat(20))).toBe("🐴".repeat(20));
    expect(normalizeName(42)).toBeNull();
  });
});

describe("ids", () => {
  it("encodes 16 bytes as a 22-character table id", () => {
    const id = toBase64Url(new Uint8Array(16).fill(251));
    expect(id).toHaveLength(22);
    expect(isTableId(id)).toBe(true);
    expect(isTableId(`${id}x`)).toBe(false);
    expect(isTableId("../../etc/passwd/xxxxx")).toBe(false);
    expect(toBase64Url(new Uint8Array(32))).toHaveLength(43);
    // Same as the standard encoding with the URL alphabet and no padding.
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 62, 63]);
    expect(toBase64Url(bytes)).toBe("AAEC-vv8_f7_Pj8");
  });

  it("keeps distinct close codes for the three endings, and 4000 for a silent socket", () => {
    expect([CLOSE_ELSEWHERE, CLOSE_VERSION, CLOSE_GONE]).toEqual([4001, 4002, 4004]);
    expect(CLOSE_SILENT).toBe(4000);
    // Version 2: the pause and the ping (an older client is closed with 4002).
    expect(PROTOCOL_VERSION).toBe(2);
  });
});

describe("parseServerFrame", () => {
  const seat = { kind: "free", name: null, level: 3, online: true, handedOver: null };
  const table = {
    status: "lobby",
    seats: { bleu: seat, jaune: seat, rouge: seat, vert: seat },
    host: null,
    creatorName: "Ana",
    gameNo: 0,
    thinking: null,
    unseated: ["Céline"],
    pause: null,
    now: 1_000,
  };

  it("reads the four server frames", () => {
    expect(
      parseServerFrame(
        JSON.stringify({
          t: "welcome",
          you: { seat: null, host: true },
          table,
          view: null,
          seq: 0,
        }),
      )?.t,
    ).toBe("welcome");
    expect(parseServerFrame(JSON.stringify({ t: "table", table }))?.t).toBe("table");
    expect(parseServerFrame(JSON.stringify({ t: "error", code: "stale" }))).toEqual({
      t: "error",
      code: "stale",
    });
    expect(parseServerFrame(JSON.stringify({ t: "error", code: "table-full" }))).toEqual({
      t: "error",
      code: "table-full",
    });
    const view = { kind: "view", seat: "bleu" };
    expect(
      parseServerFrame(JSON.stringify({ t: "events", seq: 3, events: [{ t: "turn" }], view })),
    ).toEqual({ t: "events", seq: 3, events: [{ t: "turn" }], view });
  });

  it("reads a paused table, a saved one, a handed-over seat and a welcome that regained a seat", () => {
    const paused = {
      ...table,
      status: "paused",
      seats: {
        ...table.seats,
        jaune: { kind: "human", name: "Ben", level: 3, online: false, handedOver: null },
      },
      pause: { missing: ["jaune"], since: 1_000, choiceAt: 61_000, choosing: false },
    };
    expect(parseServerFrame(JSON.stringify({ t: "table", table: paused }))).toEqual({
      t: "table",
      table: paused,
    });
    const handed = {
      ...table,
      status: "playing",
      seats: {
        ...table.seats,
        jaune: { kind: "human", name: "Ben", level: 3, online: false, handedOver: 4 },
      },
    };
    expect(parseServerFrame(JSON.stringify({ t: "table", table: handed }))?.t).toBe("table");
    expect(
      parseServerFrame(JSON.stringify({ t: "table", table: { ...table, status: "saved" } }))?.t,
    ).toBe("table");
    const welcome = {
      t: "welcome",
      you: { seat: "jaune", host: false },
      table: handed,
      view: null,
      seq: 4,
      regained: true,
    };
    expect(parseServerFrame(JSON.stringify(welcome))).toEqual(welcome);
    for (const code of ["paused", "refused"]) {
      expect(parseServerFrame(JSON.stringify({ t: "error", code }))).toEqual({ t: "error", code });
    }
  });

  it("refuses a frame of another shape", () => {
    expect(parseServerFrame("nope")).toBeNull();
    const { now: _now, ...withoutNow } = table;
    expect(parseServerFrame(JSON.stringify({ t: "table", table: withoutNow }))).toBeNull();
    expect(
      parseServerFrame(
        JSON.stringify({
          t: "table",
          table: {
            ...table,
            pause: { missing: ["violet"], since: 0, choiceAt: 0, choosing: false },
          },
        }),
      ),
    ).toBeNull();
    expect(
      parseServerFrame(
        JSON.stringify({
          t: "table",
          table: { ...table, seats: { ...table.seats, bleu: { ...seat, handedOver: 9 } } },
        }),
      ),
    ).toBeNull();
    expect(parseServerFrame(JSON.stringify({ t: "error", code: "boom" }))).toBeNull();
    expect(
      parseServerFrame(
        JSON.stringify({ t: "events", seq: 1, events: [], view: { kind: "state" } }),
      ),
    ).toBeNull();
    expect(
      parseServerFrame(JSON.stringify({ t: "table", table: { ...table, host: "violet" } })),
    ).toBeNull();
    expect(
      parseServerFrame(JSON.stringify({ t: "table", table: { ...table, unseated: [3] } })),
    ).toBeNull();
    const { unseated: _unseated, ...withoutUnseated } = table;
    expect(parseServerFrame(JSON.stringify({ t: "table", table: withoutUnseated }))).toBeNull();
  });
});

describe("the test options of a creation body", () => {
  it("accepts a pace and per-colour levels 1 to 5, nothing else", () => {
    expect(parseCreateTestOptions({ test: { pace: "zero" } })).toEqual({ pace: "zero" });
    expect(
      parseCreateTestOptions({ test: { pace: "normal", levels: { jaune: 5, rouge: 3, vert: 4 } } }),
    ).toEqual({ pace: "normal", levels: { jaune: 5, rouge: 3, vert: 4 } });
    expect(parseCreateTestOptions({ test: { pace: "zero", pauseMs: 2000 } })).toEqual({
      pace: "zero",
      pauseMs: 2000,
    });
    for (const test of [
      undefined,
      null,
      { pace: "fast" },
      { pace: "zero", levels: { jaune: 6 } },
      { pace: "zero", levels: { jaune: "5" } },
      { pace: "zero", levels: { violet: 3 } },
      { pace: "zero", extra: 1 },
      { pace: "zero", pauseMs: 100 },
      { pace: "zero", pauseMs: 61_000 },
      { pace: "zero", pauseMs: "2000" },
    ]) {
      expect(parseCreateTestOptions({ test }), JSON.stringify(test)).toBeNull();
    }
    expect(parseCreateTestOptions(null)).toBeNull();
    expect(parseCreateTestOptions("x")).toBeNull();
  });
});
