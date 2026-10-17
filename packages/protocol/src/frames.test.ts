import { type Action, apply, scenarioState, sevenPlans, viewFor } from "@toc/engine";
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
import { QUICK_MESSAGES } from "./messages.ts";
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

  it("accepts every 7 the engine plays: a knight may come back (G5), up to seven parts", () => {
    // Two knights on the ring and a 7: the engine lists every split, some of them in seven parts
    // (bleu0, bleu1, bleu0, …). Each one it plays must reach it (NET-01: apply() is the judge).
    const state = scenarioState(
      { pawns: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"] }, hands: { bleu: ["7H"] }, turn: "bleu" },
      [1, 2, 3, 4],
    );
    const plans = sevenPlans(viewFor(state, "bleu"), "bleu", "7H");
    expect(Math.max(...plans.map((plan) => plan.length))).toBe(7);
    for (const plan of plans) {
      const action: Action = { t: "seven", card: "7H", plan };
      expect(() => apply(state, "bleu", action)).not.toThrow();
      expect(ok({ t: "act", base: 3, action }), JSON.stringify(plan)).toEqual({
        ok: true,
        frame: { t: "act", base: 3, action },
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
          plan: [0, 1, 0, 1, 0, 1, 0, 1].map((i) => ({ pawn: `bleu${i}`, steps: 1 })),
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

describe("stop, leave and the reclaim of one's own seat (plan 02-07)", () => {
  it("accepts stop, reclaim and reclaimAnswer", () => {
    expect(ok({ t: "stop" })).toEqual({ ok: true, frame: { t: "stop" } });
    expect(ok({ t: "reclaim", seat: "jaune" })).toEqual({
      ok: true,
      frame: { t: "reclaim", seat: "jaune" },
    });
    expect(ok({ t: "reclaimAnswer", seat: "jaune", accept: true })).toEqual({
      ok: true,
      frame: { t: "reclaimAnswer", seat: "jaune", accept: true },
    });
    expect(ok({ t: "reclaimAnswer", seat: "vert", accept: false }).ok).toBe(true);
  });

  it("refuses them with a bad seat, a missing answer or an extra key", () => {
    for (const frame of [
      { t: "stop", now: true },
      { t: "reclaim" },
      { t: "reclaim", seat: "violet" },
      { t: "reclaim", seat: "jaune", name: "Bruno" },
      { t: "reclaimAnswer", seat: "jaune" },
      { t: "reclaimAnswer", seat: "jaune", accept: "yes" },
      { t: "reclaimAnswer", seat: "jaune", accept: 1 },
      { t: "reclaimAnswer", accept: true },
    ]) {
      expect(ok(frame), JSON.stringify(frame)).toEqual({ ok: false });
    }
  });
});

describe("the quick messages (plan 02-08, D-07, D-13)", () => {
  it("lists Romain's twelve ids in the order of the palette", () => {
    expect(QUICK_MESSAGES).toEqual([
      "bien-joue",
      "aie",
      "merci-partenaire",
      "a-toi",
      "pardon",
      "presque",
      "bravo",
      "rire",
      "applaudir",
      "surpris",
      "cheval",
      "coeur",
    ]);
  });

  it("accepts a chat frame with each of the twelve ids", () => {
    for (const msg of QUICK_MESSAGES) {
      expect(ok({ t: "chat", msg })).toEqual({ ok: true, frame: { t: "chat", msg } });
    }
  });

  it("refuses free text, a number, an empty message, an extra key, a sender", () => {
    for (const frame of [
      { t: "chat" },
      { t: "chat", msg: "Bien joué !" },
      { t: "chat", msg: "salut" },
      { t: "chat", msg: "" },
      { t: "chat", msg: 3 },
      { t: "chat", msg: ["aie"] },
      { t: "chat", msg: "aie", from: "bleu" },
      { t: "chat", msg: "aie", text: "coucou" },
      { t: "chat", msg: "<b>aie</b>" },
    ]) {
      expect(ok(frame), JSON.stringify(frame)).toEqual({ ok: false });
    }
  });

  it("reads a chat frame from a seat and the rate error, and refuses any other chat", () => {
    const chat = { t: "chat", from: "jaune", msg: "coeur", at: 12_000 };
    expect(parseServerFrame(JSON.stringify(chat))).toEqual(chat);
    expect(parseServerFrame(JSON.stringify({ t: "error", code: "rate" }))).toEqual({
      t: "error",
      code: "rate",
    });
    for (const frame of [
      { ...chat, from: "violet" },
      { ...chat, from: null },
      { ...chat, msg: "Bien joué !" },
      { ...chat, at: -1 },
      { t: "chat", from: "jaune", msg: "coeur" },
    ]) {
      expect(parseServerFrame(JSON.stringify(frame)), JSON.stringify(frame)).toBeNull();
    }
  });
});

describe("the end of a game and the rematch (plan 02-09, D-08, PLAY-07)", () => {
  it("accepts rematch { agree } from the client, a boolean only", () => {
    expect(ok({ t: "rematch", agree: true })).toEqual({
      ok: true,
      frame: { t: "rematch", agree: true },
    });
    expect(ok({ t: "rematch", agree: false })).toEqual({
      ok: true,
      frame: { t: "rematch", agree: false },
    });
    for (const frame of [
      { t: "rematch" },
      { t: "rematch", agree: "yes" },
      { t: "rematch", agree: 1 },
      { t: "rematch", agree: true, seat: "bleu" },
    ]) {
      expect(ok(frame), JSON.stringify(frame)).toEqual({ ok: false });
    }
  });

  it("reads a finished table with its winner and every seat's vote", () => {
    const seat = { kind: "human", name: "Ana", level: 3, online: true, handedOver: null };
    const finished = {
      status: "finished",
      seats: {
        bleu: seat,
        jaune: { ...seat, name: "Ben", online: false },
        rouge: { kind: "bot", name: "Éclair", level: 3, online: true, handedOver: null },
        vert: { kind: "bot", name: "Tonnerre", level: 4, online: true, handedOver: null },
      },
      host: "bleu",
      creatorName: "Ana",
      gameNo: 1,
      thinking: null,
      unseated: [],
      pause: null,
      winner: "bleu-rouge",
      rematch: { bleu: "yes", jaune: "offline", rouge: "bot", vert: "bot" },
      fast: false,
      now: 5_000,
    };
    expect(parseServerFrame(JSON.stringify({ t: "table", table: finished }))).toEqual({
      t: "table",
      table: finished,
    });
    const playing = { ...finished, status: "playing", winner: null, rematch: null };
    expect(parseServerFrame(JSON.stringify({ t: "table", table: playing }))?.t).toBe("table");
    for (const bad of [
      { ...finished, winner: "bleu-jaune" },
      { ...finished, rematch: { ...finished.rematch, jaune: "maybe" } },
      { ...finished, rematch: { bleu: "yes" } },
      { ...finished, status: "over" },
    ]) {
      expect(parseServerFrame(JSON.stringify({ t: "table", table: bad }))).toBeNull();
    }
    const { winner: _winner, ...withoutWinner } = finished;
    expect(parseServerFrame(JSON.stringify({ t: "table", table: withoutWinner }))).toBeNull();
  });

  it("accepts a near-end start position as a test option, at most 4096 characters", () => {
    const before = {
      pawns: {
        bleu: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 66 }],
        rouge: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
      },
      hands: { bleu: ["5S"] },
      turn: "bleu",
    };
    expect(parseCreateTestOptions({ test: { pace: "zero", before } })).toEqual({
      pace: "zero",
      before,
    });
    expect(
      parseCreateTestOptions({
        test: { pace: "zero", before: { ...before, phase: "play", dealer: "vert", dealIndex: 1 } },
      }),
    ).not.toBeNull();
    for (const bad of [
      { ...before, turn: "violet" },
      { ...before, hands: { bleu: ["5Z"] } },
      { ...before, pawns: { bleu: [{ h: 1 }, { h: 2 }, { h: 3 }] } },
      { ...before, pawns: { bleu: [{ h: 4 }, { h: 2 }, { h: 3 }, "S"] } },
      { ...before, extra: 1 },
      { pawns: before.pawns },
      { ...before, hands: { bleu: Array.from({ length: 1200 }, () => "5S") } },
    ]) {
      expect(parseCreateTestOptions({ test: { pace: "zero", before: bad } })).toBeNull();
    }
  });
});

describe("the table's « Avance rapide » (plan 02-10b)", () => {
  it("accepts speed { fast } from the client, a boolean only", () => {
    expect(ok({ t: "speed", fast: true })).toEqual({ ok: true, frame: { t: "speed", fast: true } });
    expect(ok({ t: "speed", fast: false })).toEqual({
      ok: true,
      frame: { t: "speed", fast: false },
    });
    for (const frame of [
      { t: "speed" },
      { t: "speed", fast: "true" },
      { t: "speed", fast: 1 },
      { t: "speed", fast: null },
      { t: "speed", fast: true, seat: "bleu" },
      { t: "speed", speed: "fast" },
    ]) {
      expect(ok(frame), JSON.stringify(frame)).toEqual({ ok: false });
    }
  });

  it("reads the flag in every public table, and refuses a table without it", () => {
    const seat = { kind: "free", name: null, level: 3, online: true, handedOver: null };
    const table = {
      status: "lobby",
      seats: { bleu: seat, jaune: seat, rouge: seat, vert: seat },
      host: "bleu",
      creatorName: "Ana",
      gameNo: 0,
      thinking: null,
      unseated: [],
      pause: null,
      winner: null,
      rematch: null,
      fast: true,
      now: 1_000,
    };
    expect(parseServerFrame(JSON.stringify({ t: "table", table }))).toEqual({ t: "table", table });
    const welcome = {
      t: "welcome",
      you: { seat: "bleu", host: true },
      table,
      view: null,
      seq: 0,
      chat: [],
    };
    expect(parseServerFrame(JSON.stringify(welcome))).toEqual(welcome);
    const { fast: _fast, ...withoutFast } = table;
    expect(parseServerFrame(JSON.stringify({ t: "table", table: withoutFast }))).toBeNull();
    expect(
      parseServerFrame(JSON.stringify({ t: "table", table: { ...table, fast: "yes" } })),
    ).toBeNull();
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
    // Version 5 (plan 02-10b): the table's « Avance rapide »; an older page would animate at the
    // normal speed while the table plays at the fast pace, so it is closed with 4002.
    expect(PROTOCOL_VERSION).toBe(5);
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
    winner: null,
    rematch: null,
    fast: false,
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
          chat: [],
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
      chat: [],
    };
    expect(parseServerFrame(JSON.stringify(welcome))).toEqual(welcome);
    for (const code of ["paused", "refused"]) {
      expect(parseServerFrame(JSON.stringify({ t: "error", code }))).toEqual({ t: "error", code });
    }
  });

  it("reads the reclaim's request (host) and result (requester)", () => {
    expect(
      parseServerFrame(JSON.stringify({ t: "reclaimRequest", seat: "jaune", name: "Bruno" })),
    ).toEqual({ t: "reclaimRequest", seat: "jaune", name: "Bruno" });
    expect(parseServerFrame(JSON.stringify({ t: "reclaimResult", accepted: false }))).toEqual({
      t: "reclaimResult",
      accepted: false,
    });
    expect(parseServerFrame(JSON.stringify({ t: "reclaimResult", accepted: true }))?.t).toBe(
      "reclaimResult",
    );
    expect(
      parseServerFrame(JSON.stringify({ t: "reclaimRequest", seat: "violet", name: "Bruno" })),
    ).toBeNull();
    expect(parseServerFrame(JSON.stringify({ t: "reclaimRequest", seat: "jaune" }))).toBeNull();
    expect(parseServerFrame(JSON.stringify({ t: "reclaimResult", accepted: "no" }))).toBeNull();
  });

  it("reads a welcome with the kept messages, oldest first, at most 30", () => {
    const entry = (i: number) => ({ from: "bleu", msg: "aie", at: 1_000 + i });
    const welcome = (chat: unknown) =>
      JSON.stringify({
        t: "welcome",
        you: { seat: "bleu", host: true },
        table,
        view: null,
        seq: 0,
        chat,
      });
    const kept = Array.from({ length: 30 }, (_, i) => entry(i));
    expect(parseServerFrame(welcome(kept))).toMatchObject({ chat: kept });
    expect(parseServerFrame(welcome([...kept, entry(30)]))).toBeNull();
    expect(parseServerFrame(welcome([{ from: "bleu", msg: "salut", at: 1 }]))).toBeNull();
    expect(
      parseServerFrame(
        JSON.stringify({
          t: "welcome",
          you: { seat: null, host: false },
          table,
          view: null,
          seq: 0,
        }),
      ),
    ).toBeNull();
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
