import { describe, expect, it } from "vitest";
import { ms, resultsText } from "../i18n/fr/banc.ts";
import { fastEnough, percentile, resultsOf } from "./benchStats.ts";

describe("bench numbers", () => {
  it("takes the nearest-rank percentiles of the bench tool", () => {
    const sorted = Array.from({ length: 40 }, (_, i) => i + 1);
    expect(percentile(sorted, 0.5)).toBe(21);
    expect(percentile(sorted, 0.95)).toBe(39);
    expect(percentile([], 0.95)).toBe(0);
  });

  it("sorts the decision times and keeps the frozen frame", () => {
    expect(resultsOf([30, 10, 20], 16.7)).toEqual({
      count: 3,
      p50: 20,
      p95: 30,
      max: 30,
      frozen: 16.7,
    });
  });

  it("judges against p95 ≤ 1000, max ≤ 2000 and frozen frame ≤ 100 ms, bounds included", () => {
    const ok = { count: 40, p50: 300, p95: 1000, max: 2000, frozen: 100 };
    expect(fastEnough(ok)).toBe(true);
    expect(fastEnough({ ...ok, p95: 1000.5 })).toBe(false);
    expect(fastEnough({ ...ok, max: 2001 })).toBe(false);
    expect(fastEnough({ ...ok, frozen: 101 })).toBe(false);
    expect(fastEnough({ ...ok, count: 0 })).toBe(false);
  });

  it("writes milliseconds the French way, U+202F before ms and between thousands", () => {
    expect(ms(0.4)).toBe("0 ms");
    expect(ms(1240.2)).toBe("1 240 ms");
    expect(ms(1234567)).toBe("1 234 567 ms");
  });

  it("copies one plain line per item", () => {
    const text = resultsText(
      "Champion",
      { count: 40, p50: 50, p95: 225, max: 1240, frozen: 17 },
      "UA",
      "2026-10-15",
    );
    expect(text.split("\n")).toEqual([
      "Banc d’essai TOC · Champion",
      "Coups mesurés : 40",
      "Temps médian : 50 ms",
      "95 % des coups en moins de : 225 ms",
      "Le plus long : 1 240 ms",
      "Plus longue image figée : 17 ms",
      "Navigateur : UA",
      "Date : 2026-10-15",
    ]);
  });
});
