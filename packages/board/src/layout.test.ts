import { COLORS, ENTRY, EXIT } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { LAYOUT, type Point } from "./layout.ts";

const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

function at<T>(list: readonly T[], i: number): T {
  const v = list[i];
  if (v === undefined) throw new Error(`missing item ${i}`);
  return v;
}

describe("LAYOUT", () => {
  it("has 72 distinct ring points on the 2560 board", () => {
    expect(LAYOUT.size).toBe(2560);
    expect(LAYOUT.ring).toHaveLength(72);
    expect(new Set(LAYOUT.ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)).size).toBe(72);
    for (const [x, y] of LAYOUT.ring) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(LAYOUT.size);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(LAYOUT.size);
    }
  });

  it("puts every exit on its diamond and every entry on its entry square (2 units)", () => {
    for (const color of COLORS) {
      const piece = LAYOUT.pieces[color];
      expect(
        dist(at(LAYOUT.ring, EXIT[color]), piece.diamond),
        `${color} diamond`,
      ).toBeLessThanOrEqual(2);
      expect(
        dist(at(LAYOUT.ring, ENTRY[color]), piece.square),
        `${color} square`,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("has 4 stable and 4 home points per colour", () => {
    for (const color of COLORS) {
      expect(LAYOUT.pieces[color].stable).toHaveLength(4);
      expect(LAYOUT.pieces[color].home).toHaveLength(4);
    }
  });

  it("orders home slots from the entry square: slot 0 is the nearest home point", () => {
    for (const color of COLORS) {
      const { home, square } = LAYOUT.pieces[color];
      const nearest = Math.min(...home.map((p) => dist(p, square)));
      expect(dist(at(home, 0), square), color).toBe(nearest);
    }
  });

  it("orders stable slots from the diamond: slot 0 is the nearest stable point", () => {
    for (const color of COLORS) {
      const { stable, diamond } = LAYOUT.pieces[color];
      const nearest = Math.min(...stable.map((p) => dist(p, diamond)));
      expect(dist(at(stable, 0), diamond), color).toBe(nearest);
    }
  });
});
