import { LAYOUT, placeXY, rotatePoint } from "@toc/board";
import { COLORS, type Place } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { anchorOf, screenDelta } from "./geometry.ts";

const places: Place[] = [
  { z: "ring", cell: 0 },
  { z: "ring", cell: 37 },
  { z: "ring", cell: 71 },
  ...COLORS.flatMap((color) =>
    ([0, 1, 2, 3] as const).flatMap((slot): Place[] => [
      { z: "stable", color, slot },
      { z: "home", color, slot },
    ]),
  ),
];

describe("anchorOf", () => {
  it("is the unrotated placeXY for k = 0", () => {
    for (const place of places) expect(anchorOf(place, 0)).toEqual(placeXY(place));
  });

  it("rotates ring, stable and home places like rotatePoint(placeXY(place), k)", () => {
    for (const k of [0, 1, 2, 3]) {
      for (const place of places) {
        const [x, y] = anchorOf(place, k);
        const [ex, ey] = rotatePoint(placeXY(place), k);
        expect(x).toBeCloseTo(ex, 9);
        expect(y).toBeCloseTo(ey, 9);
      }
    }
  });

  it("moves the exit diamond of the human's colour to the lower half", () => {
    const k = 1; // vert
    expect(anchorOf({ z: "ring", cell: 54 }, k)[1]).toBeGreaterThan(1280);
    expect(LAYOUT.pieces.vert.diamond[0]).toBeGreaterThan(1280);
  });
});

describe("screenDelta", () => {
  it("is b minus a", () => {
    expect(screenDelta([10, 20], [15, 12])).toEqual([5, -8]);
  });
});
