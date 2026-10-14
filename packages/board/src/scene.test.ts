import { EXIT } from "@toc/engine";
import { describe, expect, it } from "vitest";
import type { Point } from "./layout.ts";
import { bottomOf, LAYOUTS, sceneOf, sceneXY } from "./scene.ts";

const KS = [0, 1, 2, 3];
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe("sceneOf", () => {
  it("gives the landscape plateau 3200 x 1600 and the mock-up's step", () => {
    const scene = sceneOf("landscape");
    expect(scene.width).toBe(3200);
    expect(scene.height).toBe(1600);
    expect(Math.abs(scene.step / 2 - 53.5255)).toBeLessThan(0.001);
  });

  it("gives the portrait plateau 2000 x 3000 and the mock-up's step", () => {
    const scene = sceneOf("portrait");
    expect(scene.width).toBe(2000);
    expect(scene.height).toBe(3000);
    expect(Math.abs(scene.step / 2 - 54.1852)).toBeLessThan(0.001);
  });
});

describe("ring", () => {
  for (const layout of LAYOUTS) {
    it(`has 72 distinct, equally spaced cells on the ${layout} plateau`, () => {
      const s = sceneOf(layout).step;
      for (const k of KS) {
        const pts = Array.from({ length: 72 }, (_, cell) =>
          sceneXY({ z: "ring", cell }, k, layout),
        );
        for (let i = 0; i < 72; i++) {
          for (let j = i + 1; j < 72; j++) {
            expect(dist(pts[i] as Point, pts[j] as Point)).toBeGreaterThan(0.5 * s);
          }
          const chord = dist(pts[i] as Point, pts[(i + 1) % 72] as Point) / s;
          expect(chord).toBeGreaterThanOrEqual(0.99);
          expect(chord).toBeLessThanOrEqual(1.001);
        }
      }
    });

    it(`starts the ${layout} ring at the bottom centre, the bottom seat's exit just left of it`, () => {
      const scene = sceneOf(layout);
      for (const k of KS) {
        const b = bottomOf(k);
        const centre = sceneXY({ z: "ring", cell: (EXIT[b] + 71) % 72 }, k, layout);
        expect(centre[0]).toBeCloseTo(scene.width / 2, 6);
        const lowest = Math.max(
          ...Array.from({ length: 72 }, (_, cell) => sceneXY({ z: "ring", cell }, k, layout)[1]),
        );
        expect(centre[1]).toBeCloseTo(lowest, 6);
        const exit = sceneXY({ z: "ring", cell: EXIT[b] }, k, layout);
        expect(exit[0]).toBeLessThan(centre[0]);
        const d = dist(exit, centre) / scene.step;
        expect(d).toBeGreaterThanOrEqual(0.99);
        expect(d).toBeLessThanOrEqual(1.0 + 1e-9);
      }
    });
  }
});
