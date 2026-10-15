// The fixed bench positions (tools/bench-bots.mjs, the #/banc page of plan 03-06): always the same, at
// least 30 real choices, at least 8 of them hard 7s, each a play-phase view of the seat to play.

import { describe, expect, it } from "vitest";
import { benchPositions } from "./bench.ts";
import { candidatesFor } from "./candidates.ts";

describe("benchPositions", () => {
  it("gives at least 30 decisions with 3 candidates or more, 8 of them a 7 with 10 boards or more", () => {
    const positions = benchPositions();
    expect(positions.length).toBeGreaterThanOrEqual(30);
    let hardSevens = 0;
    for (const { view, seat, label } of positions) {
      expect(view.kind).toBe("view");
      expect(view.seat).toBe(seat);
      expect(view.phase).toBe("play");
      expect(view.turn).toBe(seat);
      const candidates = candidatesFor(view, seat);
      expect(candidates.length, label).toBeGreaterThanOrEqual(3);
      if (candidates.filter((c) => c.action.t === "seven").length >= 10) hardSevens++;
    }
    expect(hardSevens).toBeGreaterThanOrEqual(8);
  });

  it("is the same on every call", () => {
    expect(JSON.stringify(benchPositions())).toBe(JSON.stringify(benchPositions()));
  });
});
