import { describe, expect, it } from "vitest";
import { hopTimeline, MIN_CLOP_GAP_MS, type Mode } from "./hopTimeline.ts";

const MODES: Mode[] = ["normal", "fast", "reduced"];

describe("hopTimeline", () => {
  it("matches the UI-SPEC totals", () => {
    expect(hopTimeline(1).total).toBe(400);
    expect(hopTimeline(4).total).toBe(799);
    expect(hopTimeline(13).total).toBe(1996);
  });

  it("puts the four clops of a 4-cell hop on the landings", () => {
    const t = hopTimeline(4);
    expect(t.clops).toEqual([199.75, 399.5, 599.25, 799]);
    expect(t.clops).toEqual(t.landings);
  });

  it("keeps landings and clops monotone and inside [0, total]", () => {
    for (const mode of MODES) {
      for (let n = 1; n <= 13; n++) {
        const { total, landings, clops } = hopTimeline(n, mode);
        for (const series of [landings, clops]) {
          for (let i = 0; i < series.length; i++) {
            const v = series[i] as number;
            expect(v).toBeGreaterThanOrEqual(0);
            expect(v).toBeLessThanOrEqual(total + 1e-9);
            if (i > 0) expect(v).toBeGreaterThan(series[i - 1] as number);
          }
        }
      }
    }
  });

  it("keeps consecutive clops at least MIN_CLOP_GAP_MS apart in every mode", () => {
    for (const mode of MODES) {
      for (let n = 1; n <= 13; n++) {
        const { clops } = hopTimeline(n, mode);
        for (let i = 1; i < clops.length; i++) {
          expect((clops[i] as number) - (clops[i - 1] as number)).toBeGreaterThanOrEqual(
            MIN_CLOP_GAP_MS,
          );
        }
      }
    }
  });

  it("shortens each hop as the distance grows", () => {
    for (const mode of ["normal", "fast"] as const) {
      for (let n = 1; n < 13; n++) {
        expect(hopTimeline(n + 1, mode).hop).toBeLessThan(hopTimeline(n, mode).hop);
      }
    }
  });

  it("schedules the expected number of clops", () => {
    expect(hopTimeline(4).clops).toHaveLength(4);
    expect(hopTimeline(13, "normal").clops).toHaveLength(26);
    expect(hopTimeline(13, "reduced").clops).toHaveLength(1);
    expect(hopTimeline(4, "reduced").total).toBe(180);
  });
});
