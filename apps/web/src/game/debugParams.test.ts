import { scenarios } from "@toc/engine/scenarios";
import { describe, expect, it } from "vitest";
import { parseDebugParams } from "./debugParams.ts";

const ON = { debug: true };

function encode(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  let binary = "";
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

const GOOD_ETAT = {
  turn: "bleu",
  hands: { bleu: ["5H", "13S"], rouge: ["2D"] },
  pawns: { bleu: [{ p: 3 }, "S", "S", "S"], jaune: [{ p: -2 }, { h: 1 }, "S", "S"] },
  phase: "play",
  dealer: "vert",
  dealIndex: 1,
};

describe("parseDebugParams: allow-list", () => {
  it("accepts a scenario id that exists", () => {
    const id = scenarios[0]?.id as string;
    const parsed = parseDebugParams(`#/partie?scenario=${id}`, ON);
    expect(parsed.scenario?.id).toBe(id);
  });

  it("ignores an unknown scenario id and a malformed one", () => {
    for (const id of ["R-99.9", "r-08.2", "R-08.2;x", "R-8.2", "../R-08.2", "", "R-08.2%00"]) {
      expect(parseDebugParams(`scenario=${id}`, ON).scenario, id).toBeUndefined();
    }
  });

  it("accepts a well-formed etat and returns a copy limited to the known keys", () => {
    const parsed = parseDebugParams(`#/partie?etat=${encode(GOOD_ETAT)}`, ON);
    expect(parsed.etat).toEqual(GOOD_ETAT);
  });

  it("accepts a minimal etat (only the turn)", () => {
    expect(parseDebugParams(`etat=${encode({ turn: "rouge" })}`, ON).etat).toEqual({
      turn: "rouge",
    });
  });

  it("rejects an etat that is too long, not base64url, or not JSON", () => {
    const long = encode({ turn: "bleu", hands: { bleu: [] }, pad: "x".repeat(4096) });
    expect(long.length).toBeGreaterThan(4096);
    expect(parseDebugParams(`etat=${long}`, ON).etat).toBeUndefined();
    expect(parseDebugParams("etat=%%%", ON).etat).toBeUndefined();
    expect(parseDebugParams("etat=a+b/c=", ON).etat).toBeUndefined();
    expect(parseDebugParams(`etat=${encode("not json")}`, ON).etat).toBeUndefined();
    expect(parseDebugParams(`etat=${encode("[1,2]")}`, ON).etat).toBeUndefined();
    expect(parseDebugParams(`etat=${encode("null")}`, ON).etat).toBeUndefined();
  });

  it("rejects an etat whose shape is wrong", () => {
    const bad: unknown[] = [
      {},
      { turn: "orange" },
      { turn: "bleu", extra: 1 },
      { turn: "bleu", phase: "lobby" },
      { turn: "bleu", dealer: "violet" },
      { turn: "bleu", dealIndex: 3 },
      { turn: "bleu", hands: { bleu: ["14S"] } },
      { turn: "bleu", hands: { bleu: ["5X"] } },
      { turn: "bleu", hands: { bleu: ["5H", "5H"] } },
      { turn: "bleu", hands: { bleu: ["5H"], rouge: ["5H"] } },
      { turn: "bleu", hands: { bleu: ["1S", "2S", "3S", "4S", "5S", "6S"] } },
      { turn: "bleu", hands: { orange: ["5H"] } },
      { turn: "bleu", hands: [] },
      { turn: "bleu", pawns: { bleu: [{ p: 1 }, "S", "S"] } },
      { turn: "bleu", pawns: { bleu: [{ p: 1 }, "S", "S", "S", "S"] } },
      { turn: "bleu", pawns: { bleu: [{ p: 1.5 }, "S", "S", "S"] } },
      { turn: "bleu", pawns: { bleu: [{ p: 1e9 }, "S", "S", "S"] } },
      { turn: "bleu", pawns: { bleu: [{ h: 4 }, "S", "S", "S"] } },
      { turn: "bleu", pawns: { bleu: [{ h: 1 }, { h: 1 }, "S", "S"] } },
      { turn: "bleu", pawns: { bleu: [{ p: 4 }, { p: 4 }, "S", "S"] } },
      {
        turn: "bleu",
        pawns: { bleu: [{ p: 18 }, "S", "S", "S"], jaune: [{ p: 0 }, "S", "S", "S"] },
      },
      { turn: "bleu", pawns: { bleu: ["X", "S", "S", "S"] } },
      { turn: "bleu", pawns: { bleu: [{ p: 1, h: 1 }, "S", "S", "S"] } },
      { turn: "bleu", pawns: { orange: ["S", "S", "S", "S"] } },
    ];
    for (const etat of bad) {
      expect(parseDebugParams(`etat=${encode(etat)}`, ON).etat, JSON.stringify(etat)).toBe(
        undefined,
      );
    }
  });

  it("does not let a __proto__ key through", () => {
    const text = '{"turn":"bleu","__proto__":{"polluted":true}}';
    expect(parseDebugParams(`etat=${encode(text)}`, ON).etat).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("accepts a graine of exactly 32 hex characters", () => {
    const parsed = parseDebugParams("graine=00000001ffffffff0000000200000003", ON);
    expect(parsed.graine).toEqual([1, 0xffffffff, 2, 3]);
    expect(parseDebugParams("graine=ABCDEF0123456789abcdef0123456789", ON).graine).toHaveLength(4);
  });

  it("ignores a graine of the wrong length or alphabet", () => {
    for (const g of [
      "0".repeat(31),
      "0".repeat(33),
      `${"0".repeat(31)}g`,
      `${"0".repeat(30)} 1`,
      "",
      `0x${"0".repeat(30)}`,
    ]) {
      expect(parseDebugParams(`graine=${g}`, ON).graine, g).toBeUndefined();
    }
  });

  it("accepts vitesse=test and nothing else", () => {
    expect(parseDebugParams("vitesse=test", ON).vitesse).toBe("test");
    for (const v of ["fast", "TEST", "test ", "0", ""]) {
      expect(parseDebugParams(`vitesse=${v}`, ON).vitesse, v).toBeUndefined();
    }
  });

  it("judges each parameter on its own", () => {
    const parsed = parseDebugParams(
      `#/partie?etat=%%%&graine=${"a".repeat(32)}&vitesse=test&scenario=R-99.9`,
      ON,
    );
    expect(parsed.etat).toBeUndefined();
    expect(parsed.scenario).toBeUndefined();
    expect(parsed.graine).toHaveLength(4);
    expect(parsed.vitesse).toBe("test");
  });

  it("accepts the whole hash, the query alone, or a leading question mark", () => {
    for (const text of ["#/partie?vitesse=test", "?vitesse=test", "vitesse=test"]) {
      expect(parseDebugParams(text, ON).vitesse, text).toBe("test");
    }
  });
});

describe("parseDebugParams: release builds", () => {
  it("parses nothing when debug is off", () => {
    const id = scenarios[0]?.id as string;
    const hash = `#/partie?scenario=${id}&etat=${encode(GOOD_ETAT)}&graine=${"a".repeat(32)}&vitesse=test`;
    expect(parseDebugParams(hash, { debug: false })).toEqual({});
  });

  it("defaults to the compile-time switch, which is off under test", () => {
    expect(parseDebugParams("vitesse=test")).toEqual({});
  });
});
