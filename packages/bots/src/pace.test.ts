import { describe, expect, it } from "vitest";
import {
  CHOICE_BASE_MS,
  CHOICE_CEILING_MS,
  CHOICE_SPAN_MS,
  FAST_CEILING_MS,
  hardCap,
  paceFor,
} from "./pace.ts";

// The think time of a computer player (D-11, D-13; 03-UI-SPEC « Bot pacing »): it depends on how hard
// the move was, the search time counts inside it, « Avance rapide » shortens it, the test speed has none.

const US = Array.from({ length: 101 }, (_, i) => Math.min(0.999_999, i / 100));
const DIFFICULTIES = Array.from({ length: 21 }, (_, i) => i / 20);

describe("paceFor at normal speed", () => {
  it("thinks 300 to 450 ms (always under half a second) with no choice or a single move", () => {
    for (const candidates of [0, 1]) {
      for (const difficulty of [0, 0.5, 1]) {
        for (const u of US) {
          const t = paceFor({ difficulty, candidates }, "normal", u);
          expect(t).toBeGreaterThanOrEqual(300);
          expect(t).toBeLessThanOrEqual(450);
          expect(t).toBeLessThan(500);
        }
      }
    }
  });

  it("thinks (450 + 1550 × difficulty) ms ± 10 % on a real choice, at most 2 s", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const u of US) {
        const t = paceFor({ difficulty, candidates: 5 }, "normal", u);
        const expected = Math.min(
          CHOICE_CEILING_MS,
          (CHOICE_BASE_MS + CHOICE_SPAN_MS * difficulty) * (0.9 + 0.2 * u),
        );
        expect(t).toBeCloseTo(expected, 6);
        expect(t).toBeGreaterThanOrEqual(450 * 0.9);
        expect(t).toBeLessThanOrEqual(2000);
      }
    }
    expect(paceFor({ difficulty: 0, candidates: 2 }, "normal", 0.5)).toBeCloseTo(450, 6);
    expect(paceFor({ difficulty: 1, candidates: 2 }, "normal", 0)).toBe(1800);
    expect(paceFor({ difficulty: 1, candidates: 2 }, "normal", 0.999)).toBe(2000);
  });

  it("never thinks less on a harder choice, for the same draw", () => {
    for (const u of US) {
      let previous = -1;
      for (const difficulty of DIFFICULTIES) {
        const t = paceFor({ difficulty, candidates: 8 }, "normal", u);
        expect(t).toBeGreaterThanOrEqual(previous);
        previous = t;
      }
    }
  });

  it("keeps a difficulty out of [0, 1] inside the bounds", () => {
    expect(paceFor({ difficulty: 7, candidates: 3 }, "normal", 0.5)).toBe(2000);
    expect(paceFor({ difficulty: -1, candidates: 3 }, "normal", 0.5)).toBeCloseTo(450, 6);
    expect(paceFor({ difficulty: Number.NaN, candidates: 3 }, "normal", 0.5)).toBeCloseTo(450, 6);
  });
});

describe("paceFor in « Avance rapide » and at the test speed", () => {
  it("thinks about a quarter of the normal time, never above 300 ms", () => {
    for (const candidates of [1, 4]) {
      for (const difficulty of DIFFICULTIES) {
        for (const u of US) {
          const normal = paceFor({ difficulty, candidates }, "normal", u);
          const fast = paceFor({ difficulty, candidates }, "fast", u);
          expect(fast).toBeLessThanOrEqual(FAST_CEILING_MS);
          expect(fast).toBeCloseTo(Math.min(300, normal / 4), 6);
          expect(fast).toBeGreaterThan(0);
        }
      }
    }
  });

  it("does not think at the test speed", () => {
    for (const u of US) {
      expect(paceFor({ difficulty: 1, candidates: 9 }, "test", u)).toBe(0);
      expect(paceFor({ difficulty: 0, candidates: 1 }, "test", u)).toBe(0);
    }
  });
});

describe("hardCap", () => {
  it("stops a search at 2.5 s, 0.5 s in « Avance rapide », never at the test speed", () => {
    expect(hardCap("normal")).toBe(2500);
    expect(hardCap("fast")).toBe(500);
    expect(hardCap("test")).toBeNull();
  });

  it("leaves room above every pace", () => {
    for (const u of US) {
      expect(paceFor({ difficulty: 1, candidates: 9 }, "normal", u)).toBeLessThan(
        hardCap("normal") as number,
      );
      expect(paceFor({ difficulty: 1, candidates: 9 }, "fast", u)).toBeLessThan(
        hardCap("fast") as number,
      );
    }
  });
});
