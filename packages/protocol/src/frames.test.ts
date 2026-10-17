import { describe, expect, it } from "vitest";
import {
  CLOSE_ELSEWHERE,
  CLOSE_GONE,
  CLOSE_VERSION,
  MAX_FRAME_CHARS,
  PROTOCOL_VERSION,
  parseClientFrame,
  parseServerFrame,
} from "./frames.ts";
import { isTableId, normalizeName, toBase64Url } from "./names.ts";

const TOKEN = "A".repeat(43);
const ok = (frame: unknown) => parseClientFrame(JSON.stringify(frame));

describe("parseClientFrame", () => {
  it("accepts the four client frames", () => {
    expect(ok({ t: "hello", v: PROTOCOL_VERSION, token: TOKEN, name: "Ana" })).toEqual({
      ok: true,
      frame: { t: "hello", v: 1, token: TOKEN, name: "Ana" },
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

  it("keeps distinct close codes for the three endings", () => {
    expect([CLOSE_ELSEWHERE, CLOSE_VERSION, CLOSE_GONE]).toEqual([4001, 4002, 4004]);
  });
});

describe("parseServerFrame", () => {
  const seat = { kind: "free", name: null, level: 3, online: true };
  const table = {
    status: "lobby",
    seats: { bleu: seat, jaune: seat, rouge: seat, vert: seat },
    host: null,
    creatorName: "Ana",
    gameNo: 0,
    thinking: null,
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
    const view = { kind: "view", seat: "bleu" };
    expect(
      parseServerFrame(JSON.stringify({ t: "events", seq: 3, events: [{ t: "turn" }], view })),
    ).toEqual({ t: "events", seq: 3, events: [{ t: "turn" }], view });
  });

  it("refuses a frame of another shape", () => {
    expect(parseServerFrame("nope")).toBeNull();
    expect(parseServerFrame(JSON.stringify({ t: "error", code: "boom" }))).toBeNull();
    expect(
      parseServerFrame(
        JSON.stringify({ t: "events", seq: 1, events: [], view: { kind: "state" } }),
      ),
    ).toBeNull();
    expect(
      parseServerFrame(JSON.stringify({ t: "table", table: { ...table, host: "violet" } })),
    ).toBeNull();
  });
});
