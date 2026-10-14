import { COLORS, type Color, ENTRY, EXIT, nextColor, PARTNER, type Place } from "@toc/engine";
import { describe, expect, it } from "vitest";
import type { Point } from "./layout.ts";
import { quarterTurnsFor, screenSideOf } from "./rotate.ts";
import {
  bottomOf,
  knightScale,
  MOCKUP,
  ringPolyline,
  SCENE,
  sceneSideOf,
  sceneXY,
  seatCard,
  stableCentre,
} from "./scene.ts";

const s = SCENE.step;
const { left: xL, right: xR, top: yT, bottom: yB } = SCENE.ring;
const [cx, cy] = SCENE.centre;
const KS = [0, 1, 2, 3];
const SLOTS = [0, 1, 2, 3] as const;
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const previousColor = (c: Color) => nextColor(nextColor(nextColor(c)));

const close = (p: Point, q: Point, digits = 2) => {
  expect(p[0]).toBeCloseTo(q[0], digits);
  expect(p[1]).toBeCloseTo(q[1], digits);
};

const ring = (k: number) =>
  Array.from({ length: 72 }, (_, cell) => sceneXY({ z: "ring", cell }, k));
const homes = (c: Color, k: number) =>
  SLOTS.map((slot) => sceneXY({ z: "home", color: c, slot }, k));
const holes = (c: Color, k: number) =>
  SLOTS.map((slot) => sceneXY({ z: "stable", color: c, slot }, k));

/** The board edge a point is nearest to. */
function nearestEdge([x, y]: Point): string {
  const d: [string, number][] = [
    ["left", x],
    ["right", SCENE.width - x],
    ["top", y],
    ["bottom", SCENE.height - y],
  ];
  d.sort((a, b) => a[1] - b[1]);
  return (d[0] as [string, number])[0];
}

/** Does an axis-aligned square (centre, half side) meet a disc? */
function squareMeetsDisc(c: Point, half: number, p: Point, r: number): boolean {
  const dx = Math.max(Math.abs(p[0] - c[0]) - half, 0);
  const dy = Math.max(Math.abs(p[1] - c[1]) - half, 0);
  return Math.hypot(dx, dy) < r;
}

/** Does an axis-aligned square (centre, half side) meet the felt rectangle? */
function squareMeetsFelt(c: Point, half: number): boolean {
  const f = SCENE.felt;
  return (
    c[0] + half > f.x && c[0] - half < f.x + f.w && c[1] + half > f.y && c[1] - half < f.y + f.h
  );
}

describe("SCENE", () => {
  it("is the mock-up frame times two, with the mock-up's own step", () => {
    expect(SCENE.scale).toBe(2);
    expect(SCENE.width).toBe(MOCKUP.width * 2);
    expect(SCENE.width).toBe(2000);
    expect(SCENE.height).toBe(3000);
    expect(Math.abs(SCENE.step / 2 - 63.078)).toBeLessThan(0.001);
    expect(Math.abs(xL - 87.51)).toBeLessThan(0.01);
    expect(Math.abs(yT - 87.51)).toBeLessThan(0.01);
    expect(xR).toBeCloseTo(SCENE.width - xL, 6);
    expect(yB).toBeCloseTo(SCENE.height - yT, 6);
  });

  it("quotes the felt, the talon, the défausse and the card size of the plan", () => {
    expect(SCENE.felt.x).toBeCloseTo(690.9, 1);
    expect(SCENE.felt.x + SCENE.felt.w).toBeCloseTo(1309.1, 1);
    expect(SCENE.felt.y).toBeCloseTo(705.2, 1);
    expect(SCENE.felt.y + SCENE.felt.h).toBeCloseTo(2294.8, 1);
    close(SCENE.talon, [1000, 1354.9], 1);
    close(SCENE.defausse, [1000, 1645.1], 1);
    expect(SCENE.card.w).toBeCloseTo(164.0, 1);
    expect(SCENE.card.h).toBeCloseTo(229.6, 1);
  });

  it("keeps a head room between 0.04 and 0.05 of the width", () => {
    expect(SCENE.headRoom).toBeGreaterThan(0.04);
    expect(SCENE.headRoom).toBeLessThan(0.05);
    expect(SCENE.headRoom).toBeCloseTo(0.0466, 3);
  });
});

describe("ring", () => {
  it("has 72 distinct, equally spaced cells inside the board, for every k", () => {
    for (const k of KS) {
      const pts = ring(k);
      for (let i = 0; i < 72; i++) {
        const p = pts[i] as Point;
        expect(p[0]).toBeGreaterThan(0);
        expect(p[0]).toBeLessThan(SCENE.width);
        expect(p[1]).toBeGreaterThan(0);
        expect(p[1]).toBeLessThan(SCENE.height);
        for (let j = i + 1; j < 72; j++) expect(dist(p, pts[j] as Point)).toBeGreaterThan(0.9 * s);
      }
      // Consecutive cells in the direction of travel, the last one back to the first.
      for (let i = 0; i < 72; i++) {
        const chord = dist(pts[i] as Point, pts[(i + 1) % 72] as Point) / s;
        expect(chord).toBeGreaterThanOrEqual(0.96);
        expect(chord).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it("puts every exit at its side centre + s and every carré 16 at its side centre - s", () => {
    for (const k of KS) {
      const b = bottomOf(k);
      close(sceneXY({ z: "ring", cell: EXIT[b] }, k), [cx - s, yB]);
      close(sceneXY({ z: "ring", cell: EXIT[nextColor(b)] }, k), [xL, cy - s]);
      close(sceneXY({ z: "ring", cell: EXIT[PARTNER[b]] }, k), [cx + s, yT]);
      close(sceneXY({ z: "ring", cell: EXIT[previousColor(b)] }, k), [xR, cy + s]);
      close(sceneXY({ z: "ring", cell: ENTRY[b] }, k), [cx + s, yB]);
      close(sceneXY({ z: "ring", cell: ENTRY[nextColor(b)] }, k), [xL, cy + s]);
      close(sceneXY({ z: "ring", cell: ENTRY[PARTNER[b]] }, k), [cx - s, yT]);
      close(sceneXY({ z: "ring", cell: ENTRY[previousColor(b)] }, k), [xR, cy - s]);
      close(sceneXY({ z: "ring", cell: (EXIT[b] + 71) % 72 }, k), [cx, yB]);
    }
  });

  it("is the band polyline: closed, starting at the bottom-side centre", () => {
    const band = ringPolyline();
    close(band[0] as Point, [cx, yB], 6);
    close(band[band.length - 1] as Point, [cx, yB], 6);
    let length = 0;
    for (let i = 1; i < band.length; i++) length += dist(band[i - 1] as Point, band[i] as Point);
    expect(length / s).toBeCloseTo(72, 6);
  });

  it("throws on an impossible place", () => {
    expect(() => sceneXY({ z: "ring", cell: 72 }, 0)).toThrow();
    expect(() => sceneXY({ z: "ring", cell: -1 }, 0)).toThrow();
    expect(() => sceneXY({ z: "ring", cell: 1.5 }, 0)).toThrow();
    expect(() => sceneXY({ z: "home", color: "bleu", slot: 4 } as unknown as Place, 0)).toThrow();
    expect(() => sceneXY({ z: "stable", color: "noir", slot: 0 } as unknown as Place, 0)).toThrow();
  });
});

describe("seating", () => {
  it("bottomOf is the inverse of quarterTurnsFor", () => {
    for (const c of COLORS) expect(bottomOf(quarterTurnsFor(c))).toBe(c);
    expect(bottomOf(4)).toBe(bottomOf(0));
    expect(bottomOf(-1)).toBe(bottomOf(3));
  });

  it("puts each colour's stable and home on the side screenSideOf names", () => {
    for (const k of KS) {
      const b = bottomOf(k);
      for (const c of COLORS) {
        const side = screenSideOf(c, b);
        expect(sceneSideOf(c, k)).toBe(side);
        expect(nearestEdge(stableCentre(c, k))).toBe(side);
        for (const p of homes(c, k)) expect(nearestEdge(p)).toBe(side);
        for (const p of holes(c, k)) expect(nearestEdge(p)).toBe(side);
      }
    }
  });

  it("home slot 0 is the nearest the carré, stable slot 0 the nearest the exit", () => {
    for (const k of KS) {
      for (const c of COLORS) {
        const carre = sceneXY({ z: "ring", cell: ENTRY[c] }, k);
        const d = homes(c, k).map((p) => dist(p, carre));
        expect(Math.min(...d)).toBe(d[0]);
        for (let i = 1; i < 4; i++) expect(d[i] as number).toBeGreaterThan(d[i - 1] as number);
        const exit = sceneXY({ z: "ring", cell: EXIT[c] }, k);
        const e = holes(c, k).map((p) => dist(p, exit));
        expect(Math.min(...e)).toBe(e[0]);
      }
    }
  });
});

describe("no overlap", () => {
  it("keeps the 104 place centres 0.95 step apart and their discs apart", () => {
    for (const k of KS) {
      const places: { p: Point; r: number }[] = ring(k).map((p) => ({ p, r: 0.44 * s }));
      for (const c of COLORS) {
        for (const p of homes(c, k)) places.push({ p, r: 0.41 * s });
        for (const p of holes(c, k)) places.push({ p, r: 0.4 * s });
      }
      expect(places).toHaveLength(104);
      for (let i = 0; i < places.length; i++) {
        for (let j = i + 1; j < places.length; j++) {
          const a = places[i] as { p: Point; r: number };
          const b = places[j] as { p: Point; r: number };
          const d = dist(a.p, b.p);
          expect(d).toBeGreaterThanOrEqual(0.95 * s);
          expect(d).toBeGreaterThan(a.r + b.r);
        }
      }
    }
  });

  it("keeps home slots, holes and stable boxes off the ring discs and the felt", () => {
    for (const k of KS) {
      const cells = ring(k);
      for (const c of COLORS) {
        const boxes: { c: Point; half: number }[] = [
          ...homes(c, k).map((p) => ({ c: p, half: 0.41 * s })),
          ...holes(c, k).map((p) => ({ c: p, half: 0.4 * s })),
          { c: stableCentre(c, k), half: 1.225 * s },
        ];
        for (const box of boxes) {
          expect(squareMeetsFelt(box.c, box.half)).toBe(false);
          for (const cell of cells)
            expect(squareMeetsDisc(box.c, box.half, cell, 0.44 * s)).toBe(false);
        }
      }
    }
  });

  it("lays the four seat cards (with a 4° tilt), the talon and the défausse inside the felt", () => {
    const f = SCENE.felt;
    const tilt = (4 * Math.PI) / 180;
    const inside = (at: Point, w: number, h: number) => {
      const bw = w * Math.cos(tilt) + h * Math.sin(tilt);
      const bh = h * Math.cos(tilt) + w * Math.sin(tilt);
      expect(at[0] - bw / 2).toBeGreaterThan(f.x);
      expect(at[0] + bw / 2).toBeLessThan(f.x + f.w);
      expect(at[1] - bh / 2).toBeGreaterThan(f.y);
      expect(at[1] + bh / 2).toBeLessThan(f.y + f.h);
    };
    const { w, h } = SCENE.card;
    for (const k of KS) {
      const b = bottomOf(k);
      for (const c of COLORS) {
        const card = seatCard(c, k);
        const side = screenSideOf(c, b);
        const expected = { bottom: 0, left: 90, top: 180, right: 270 }[side];
        expect(card.angle).toBe(expected);
        if (card.angle % 180 === 0) inside(card.at, w, h);
        else inside(card.at, h, w);
      }
    }
    inside(SCENE.talon, w, h);
    inside(SCENE.defausse, w, h);
    close(seatCard(bottomOf(0), 0).at, [1000, 2143.4], 1);
    close(seatCard(PARTNER[bottomOf(0)], 0).at, [1000, 856.6], 1);
    close(seatCard(nextColor(bottomOf(0)), 0).at, [842.3, 1500], 1);
    close(seatCard(previousColor(bottomOf(0)), 0).at, [1157.7, 1500], 1);
  });
});

describe("knights", () => {
  it("scales the 110 x 190 sprite to 0.92, 0.8 and 0.72 step", () => {
    expect(Math.abs(knightScale({ z: "ring", cell: 3 }) - 1.0551)).toBeLessThan(0.0005);
    expect(Math.abs(knightScale({ z: "home", color: "vert", slot: 2 }) - 0.9175)).toBeLessThan(
      0.0005,
    );
    expect(Math.abs(knightScale({ z: "stable", color: "rouge", slot: 1 }) - 0.8257)).toBeLessThan(
      0.0005,
    );
  });
});
