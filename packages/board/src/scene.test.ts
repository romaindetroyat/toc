import { COLORS, type Color, ENTRY, EXIT, nextColor, PARTNER, type Place } from "@toc/engine";
import { describe, expect, it } from "vitest";
// Read through the package barrel, so these checks survive the move of the rotation helpers.
import {
  boardOutline,
  bottomOf,
  KNIGHT,
  knightScale,
  MOCKUP,
  type Point,
  quarterTurnsFor,
  riderBox,
  SCENE,
  type Scene,
  sceneSideOf,
  sceneXY,
  screenSideOf,
  seatCard,
  stableCentre,
} from "./index.ts";

const KS = [0, 1, 2, 3];
const SLOTS = [0, 1, 2, 3] as const;
const dist = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const previousColor = (c: Color) => nextColor(nextColor(nextColor(c)));

const ring = (k: number) =>
  Array.from({ length: 72 }, (_, cell) => sceneXY({ z: "ring", cell }, k));
const homes = (c: Color, k: number) =>
  SLOTS.map((slot) => sceneXY({ z: "home", color: c, slot }, k));
const holes = (c: Color, k: number) =>
  SLOTS.map((slot) => sceneXY({ z: "stable", color: c, slot }, k));

/** The side of the galet a point lies on, the ring's half-axes weighing the two directions. */
function sideOf(scene: Scene, [x, y]: Point): string {
  const dx = (x - scene.centre[0]) / scene.ring.a;
  const dy = (y - scene.centre[1]) / scene.ring.b;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? "left" : "right";
  return dy > 0 ? "bottom" : "top";
}

/** Even-odd point-in-polygon. */
function insidePolygon(poly: readonly Point[], [x, y]: Point): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i] as Point;
    const [xj, yj] = poly[j] as Point;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Exact outlines of the drawn places: a disc, or a convex polygon (the squares, unrounded, which
// holds the rounded drawing inside it).
type Outline = { kind: "disc"; c: Point; r: number } | { kind: "poly"; pts: Point[] };

const square = (c: Point, side: number, turn: number): Outline => {
  const h = side / 2;
  const a = (turn * Math.PI) / 180;
  const corners: Point[] = [
    [-h, -h],
    [h, -h],
    [h, h],
    [-h, h],
  ];
  return {
    kind: "poly",
    pts: corners.map(([x, y]) => [
      c[0] + x * Math.cos(a) - y * Math.sin(a),
      c[1] + x * Math.sin(a) + y * Math.cos(a),
    ]),
  };
};

/** Distance from a point to a segment. */
function segmentDistance(p: Point, a: Point, b: Point): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy)),
  );
  return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy);
}

function polyEdges(pts: Point[]): [Point, Point][] {
  return pts.map((p, i) => [p, pts[(i + 1) % pts.length] as Point]);
}

/** Separating axis test of two convex polygons. */
function polysMeet(a: Point[], b: Point[]): boolean {
  for (const poly of [a, b]) {
    for (const [p, q] of polyEdges(poly)) {
      const nx = q[1] - p[1];
      const ny = p[0] - q[0];
      const project = (pts: Point[]) => pts.map(([x, y]) => x * nx + y * ny);
      const pa = project(a);
      const pb = project(b);
      if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
    }
  }
  return true;
}

function meet(a: Outline, b: Outline): boolean {
  if (a.kind === "disc" && b.kind === "disc") return dist(a.c, b.c) < a.r + b.r;
  if (a.kind === "poly" && b.kind === "poly") return polysMeet(a.pts, b.pts);
  const disc = (a.kind === "disc" ? a : b) as Extract<Outline, { kind: "disc" }>;
  const poly = (a.kind === "poly" ? a : b) as Extract<Outline, { kind: "poly" }>;
  if (insidePolygon(poly.pts, disc.c)) return true;
  return Math.min(...polyEdges(poly.pts).map(([p, q]) => segmentDistance(disc.c, p, q))) < disc.r;
}

const box = (x: number, y: number, w: number, h: number): Outline => ({
  kind: "poly",
  pts: [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ],
});

/** Every drawn place of the galet for seat k, with its exact outline. */
function placeOutlines(k: number): Outline[] {
  const s = SCENE.step;
  const out: Outline[] = ring(k).map((c, cell) => {
    const m = cell % 18;
    if (m === 0) return square(c, 0.8 * s, 45);
    if (m === 16) return square(c, 0.86 * s, 0);
    return { kind: "disc", c, r: 0.42 * s };
  });
  for (const c of COLORS) {
    for (const p of homes(c, k)) out.push({ kind: "disc", c: p, r: 0.4 * s });
    for (const p of holes(c, k)) out.push({ kind: "disc", c: p, r: 0.42 * s });
  }
  return out;
}

/** Is a point inside the felt's ellipse? */
function insideFelt(scene: Scene, [x, y]: Point): boolean {
  const f = scene.feltShape;
  return ((x - f.cx) / f.rx) ** 2 + ((y - f.cy) / f.ry) ** 2 <= 1;
}

/** The four corners of a card w x h centred on `at`, turned by `angle` degrees. */
function cardCorners(at: Point, w: number, h: number, angle: number): Point[] {
  return (square([0, 0], 1, 0) as { pts: Point[] }).pts.map(([x, y]) => {
    const a = (angle * Math.PI) / 180;
    const px = 2 * x * (w / 2);
    const py = 2 * y * (h / 2);
    return [
      at[0] + px * Math.cos(a) - py * Math.sin(a),
      at[1] + px * Math.sin(a) + py * Math.cos(a),
    ];
  });
}

describe("SCENE", () => {
  it("gives the galet 3200 x 1600 and the mock-up's step", () => {
    const scene = SCENE;
    expect(scene.scale).toBe(2);
    expect(scene.width).toBe(MOCKUP.width * 2);
    expect(scene.width).toBe(3200);
    expect(scene.height).toBe(1600);
    expect(Math.abs(scene.step / 2 - 53.5255)).toBeLessThan(0.001);
  });

  it("has converged its step (a 7th iteration moves it < 0.001)", () => {
    const cfg = MOCKUP;
    const s = SCENE.step / 2;
    const cx = cfg.width / 2;
    const cy = cfg.height / 2;
    const m = MOCKUP.pad + 0.5 * MOCKUP.disc * s;
    const e = 2 / cfg.n;
    const sp = (v: number) => Math.sign(v) * Math.abs(v) ** e;
    let P = 0;
    let last: Point | null = null;
    for (let j = 0; j <= 1440; j++) {
      const th = ((90 + (360 * j) / 1440) * Math.PI) / 180;
      const p: Point = [cx + (cx - m) * sp(Math.cos(th)), cy + (cy - m) * sp(Math.sin(th))];
      if (last) P += dist(last, p);
      last = p;
    }
    expect(Math.abs(P / 72 - s)).toBeLessThan(0.001);
  });
});

describe("ring", () => {
  it("has 72 distinct, equally spaced cells", () => {
    const s = SCENE.step;
    for (const k of KS) {
      const pts = ring(k);
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

  it("starts the ring at the bottom centre, the bottom seat's exit just left of it", () => {
    const scene = SCENE;
    for (const k of KS) {
      const b = bottomOf(k);
      const centre = sceneXY({ z: "ring", cell: (EXIT[b] + 71) % 72 }, k);
      expect(centre[0]).toBeCloseTo(scene.width / 2, 6);
      const lowest = Math.max(...ring(k).map((p) => p[1]));
      expect(centre[1]).toBeCloseTo(lowest, 6);
      const exit = sceneXY({ z: "ring", cell: EXIT[b] }, k);
      expect(exit[0]).toBeLessThan(centre[0]);
      const d = dist(exit, centre) / scene.step;
      expect(d).toBeGreaterThanOrEqual(0.99);
      expect(d).toBeLessThanOrEqual(1.0 + 1e-9);
    }
  });

  it("puts each exit one step after its side centre and each carré one step before", () => {
    const scene = SCENE;
    const [cx, cy] = scene.centre;
    const { a, b: rb } = scene.ring;
    const centres: Record<string, Point> = {
      bottom: [cx, cy + rb],
      left: [cx - a, cy],
      top: [cx, cy - rb],
      right: [cx + a, cy],
    };
    // Along the direction of travel: true when p lies past the side centre.
    const past: Record<string, (p: Point) => boolean> = {
      bottom: (p) => p[0] < cx,
      left: (p) => p[1] < cy,
      top: (p) => p[0] > cx,
      right: (p) => p[1] > cy,
    };
    for (const k of KS) {
      const b = bottomOf(k);
      const seats: [Color, string][] = [
        [b, "bottom"],
        [nextColor(b), "left"],
        [PARTNER[b], "top"],
        [previousColor(b), "right"],
      ];
      for (const [c, side] of seats) {
        const centre = centres[side] as Point;
        const exit = sceneXY({ z: "ring", cell: EXIT[c] }, k);
        const entry = sceneXY({ z: "ring", cell: ENTRY[c] }, k);
        for (const p of [exit, entry]) {
          const d = dist(p, centre) / scene.step;
          expect(d).toBeGreaterThanOrEqual(0.99);
          expect(d).toBeLessThanOrEqual(1.0 + 1e-6);
          expect(sideOf(scene, p)).toBe(side);
        }
        expect(past[side]?.(exit)).toBe(true);
        expect(past[side]?.(entry)).toBe(false);
      }
    }
  });

  it("keeps every cell, home and stable centre inside the board outline", () => {
    const { outline } = boardOutline();
    for (const k of KS) {
      const points = [...ring(k)];
      for (const c of COLORS) points.push(...homes(c, k), ...holes(c, k));
      for (const p of points) expect(insidePolygon(outline, p)).toBe(true);
    }
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
  it("quarterTurnsFor gives bleu 0, vert 1, rouge 2, jaune 3 and bottomOf is its inverse", () => {
    expect(quarterTurnsFor("bleu")).toBe(0);
    expect(quarterTurnsFor("vert")).toBe(1);
    expect(quarterTurnsFor("rouge")).toBe(2);
    expect(quarterTurnsFor("jaune")).toBe(3);
    for (const c of COLORS) expect(bottomOf(quarterTurnsFor(c))).toBe(c);
    expect(bottomOf(4)).toBe(bottomOf(0));
    expect(bottomOf(-1)).toBe(bottomOf(3));
  });

  it("screenSideOf follows the UI-SPEC examples", () => {
    expect(screenSideOf("bleu", "bleu")).toBe("bottom");
    expect(screenSideOf("jaune", "bleu")).toBe("left");
    expect(screenSideOf("rouge", "bleu")).toBe("top");
    expect(screenSideOf("vert", "bleu")).toBe("right");
    expect(screenSideOf("rouge", "jaune")).toBe("left");
    expect(screenSideOf("vert", "jaune")).toBe("top");
    expect(screenSideOf("bleu", "jaune")).toBe("right");
    expect(screenSideOf("bleu", "vert")).toBe("left");
    expect(screenSideOf("jaune", "vert")).toBe("top");
    expect(screenSideOf("rouge", "vert")).toBe("right");
  });

  it("screenSideOf is bottom for the human, top for the partner, left for the next seat, right for the previous", () => {
    for (const human of COLORS) {
      expect(screenSideOf(human, human)).toBe("bottom");
      expect(screenSideOf(PARTNER[human], human)).toBe("top");
      expect(screenSideOf(nextColor(human), human)).toBe("left");
      expect(screenSideOf(previousColor(human), human)).toBe("right");
    }
  });

  it("puts each colour's home and stable on the side sceneSideOf names", () => {
    const scene = SCENE;
    for (const k of KS) {
      const b = bottomOf(k);
      for (const c of COLORS) {
        const side = screenSideOf(c, b);
        expect(sceneSideOf(c, k)).toBe(side);
        expect(sideOf(scene, stableCentre(c, k))).toBe(side);
        for (const p of homes(c, k)) expect(sideOf(scene, p)).toBe(side);
        for (const p of holes(c, k)) expect(sideOf(scene, p)).toBe(side);
      }
    }
  });

  it("home slot 0 is the nearest the carré, stable slot 0 the nearest the exit", () => {
    const s = SCENE.step;
    for (const k of KS) {
      for (const c of COLORS) {
        const carre = sceneXY({ z: "ring", cell: ENTRY[c] }, k);
        const d = homes(c, k).map((p) => dist(p, carre));
        expect(Math.min(...d)).toBe(d[0]);
        for (let i = 1; i < 4; i++) {
          expect((d[i] as number) - (d[i - 1] as number)).toBeCloseTo(1.05 * s, 6);
        }
        const exit = sceneXY({ z: "ring", cell: EXIT[c] }, k);
        const e = holes(c, k).map((p) => dist(p, exit));
        expect(Math.min(...e)).toBe(e[0]);
        // The stable centre is the mean of the four dots.
        const mean = holes(c, k).reduce((m, p) => [m[0] + p[0] / 4, m[1] + p[1] / 4], [
          0, 0,
        ] as Point);
        const centre = stableCentre(c, k);
        expect(centre[0]).toBeCloseTo(mean[0], 6);
        expect(centre[1]).toBeCloseTo(mean[1], 6);
      }
    }
  });
});

describe("no overlap", () => {
  it("keeps the 104 drawn places apart, off the felt", () => {
    const f = SCENE.felt;
    const felt = box(f.x, f.y, f.w, f.h);
    for (const k of KS) {
      const places = placeOutlines(k);
      expect(places).toHaveLength(104);
      for (let i = 0; i < places.length; i++) {
        expect(meet(places[i] as Outline, felt)).toBe(false);
        for (let j = i + 1; j < places.length; j++) {
          expect(meet(places[i] as Outline, places[j] as Outline)).toBe(false);
        }
      }
    }
  });

  it("keeps the riders off the places and the felt, in their corners", () => {
    const scene = SCENE;
    const [cx, cy] = scene.centre;
    const f = scene.felt;
    const felt = box(f.x, f.y, f.w, f.h);
    // The corner of the side each seat sets off towards: bottom → below-left, then clockwise.
    const corner: Record<string, (p: Point) => boolean> = {
      bottom: (p) => p[0] < cx && p[1] > cy,
      left: (p) => p[0] < cx && p[1] < cy,
      top: (p) => p[0] > cx && p[1] < cy,
      right: (p) => p[0] > cx && p[1] > cy,
    };
    for (const k of KS) {
      const places = placeOutlines(k);
      const riders = COLORS.map((c) => {
        const r = riderBox(c, k);
        expect(r.h).toBeCloseTo(MOCKUP.rider.h * scene.step, 6);
        expect(r.w).toBeCloseTo((r.h * 157) / 209, 6);
        const centre: Point = [r.x + r.w / 2, r.y + r.h / 2];
        expect(corner[sceneSideOf(c, k)]?.(centre)).toBe(true);
        return box(r.x, r.y, r.w, r.h);
      });
      for (const rider of riders) {
        expect(meet(rider, felt)).toBe(false);
        for (const place of places) expect(meet(rider, place)).toBe(false);
      }
    }
  });

  it("lays the seat cards (±4°), the talon and the défausse inside the felt", () => {
    const scene = SCENE;
    const { w, h } = scene.card;
    for (const k of KS) {
      const b = bottomOf(k);
      for (const c of COLORS) {
        const card = seatCard(c, k);
        const expected = { bottom: 0, left: 90, top: 180, right: 270 }[screenSideOf(c, b)];
        expect(card.angle).toBe(expected);
        for (const tilt of [-4, 0, 4]) {
          for (const p of cardCorners(card.at, w, h, card.angle + tilt)) {
            expect(insideFelt(scene, p)).toBe(true);
          }
        }
      }
    }
    for (const pile of [scene.talon, scene.defausse]) {
      for (const p of cardCorners(pile, w * scene.pile, h * scene.pile, 0)) {
        expect(insideFelt(scene, p)).toBe(true);
      }
    }
  });

  it("quotes the felt, the piles and the card of the mock-up", () => {
    const land = SCENE;
    expect(land.feltShape).toEqual({ kind: "ellipse", cx: 1600, cy: 800, rx: 600, ry: 224 });
    expect(land.felt).toEqual({ x: 1000, y: 576, w: 1200, h: 448 });
    expect(land.talon).toEqual([1450, 800]);
    expect(land.defausse).toEqual([1750, 800]);
    expect(land.pile).toBe(0.95);
    expect(land.card.w).toBeCloseTo(1.3 * land.step, 6);
    expect(land.card.h).toBeCloseTo(1.82 * land.step, 6);
  });
});

describe("knights", () => {
  it("scales the 110 x 190 sprite to 0.95, 0.82 and 0.78 step", () => {
    const s = SCENE.step;
    expect(knightScale({ z: "ring", cell: 3 })).toBeCloseTo((0.95 * s) / 110, 9);
    expect(knightScale({ z: "home", color: "vert", slot: 2 })).toBeCloseTo((0.82 * s) / 110, 9);
    expect(knightScale({ z: "stable", color: "rouge", slot: 1 })).toBeCloseTo((0.78 * s) / 110, 9);
  });

  it("keeps the head room of a lifted top-row knight above the board", () => {
    const scene = SCENE;
    const top = Math.min(...ring(0).map((p) => p[1]));
    const head = (KNIGHT.head + KNIGHT.lift) * knightScale({ z: "ring", cell: 0 });
    expect(Math.abs(scene.headRoom - (head - top) / scene.width)).toBeLessThan(1e-6);
  });

  it("has a head room of 0.02166", () => {
    expect(Math.abs(SCENE.headRoom - 0.02166)).toBeLessThan(0.0001);
  });
});
