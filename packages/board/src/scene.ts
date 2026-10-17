// The galet board geometry (Romain's choice of 2026-10-14: « galet partout »). Pure: no DOM, no clock.
//
// Romain, 2026-10-14: « Pour la version iphone, oblige à jouer en format paysage, ça permettra
// d'utiliser le même plateau » and « Oui, paysage obligatoire ». The game has one board, the galet in
// landscape, on a computer and on a phone held sideways alike: this file holds that one plateau and
// SCENE is its scene.
//
// Ported from renderVals() of design/plateau-galet.dc.html with the mock-up's own numbers, variant
// pc-galet (1600 x 800, superellipse exponent 3.2, felt ellipse, no wave). The ring is computed in
// mock-up units exactly as the mock-up does (shape, the six iterations of the step, at, cellPos, the
// frame origins C and frame), then every export is given in scene units = mock-up units x 2: the
// scene is 3200 x 1600 (step about 107.05), so a knight keeps about the 110 x 190 sprite footprint
// the overlays were tuned for.
//
// Seating (« à confirmer par Romain », kept from D-05): the drawing never turns. The colour of seat k
// (bleu 0, vert 1, rouge 2, jaune 3) takes the bottom side, its partner the top, the next seat
// clockwise the left and the previous one the right; the ring indices follow from the bottom seat's
// start index, as in the mock-up.

import { COLORS, type Color, EXIT, nextColor, PARTNER, type Place } from "@toc/engine";

/** A point (x, y) on the galet, in scene units (the 3200 x 1600 scene) unless stated otherwise. */
export type Point = readonly [number, number];

/** Where a seat sits on the screen: the human at the bottom, the partner at the top. */
export type ScreenSide = "bottom" | "left" | "top" | "right";

/** The human's seat index k, the colour at the bottom of the galet: bleu 0, vert 1, rouge 2, jaune 3. */
const QUARTER_TURNS: Record<Color, number> = { bleu: 0, vert: 1, rouge: 2, jaune: 3 };

export function quarterTurnsFor(color: Color): number {
  return QUARTER_TURNS[color];
}

/** Bottom for the human, left for the next seat clockwise, top for the partner, right for the previous seat. */
export function screenSideOf(seat: Color, human: Color): ScreenSide {
  if (seat === human) return "bottom";
  if (seat === PARTNER[human]) return "top";
  if (seat === nextColor(human)) return "left";
  return "right";
}

/** The mock-up's own frame and constants (renderVals, variant pc-galet). */
export const MOCKUP = {
  pad: 22,
  disc: 0.84,
  variant: "pc-galet",
  width: 1600,
  height: 800,
  n: 3.2,
  wave: 0,
  felt: { rx: 300, ry: 112, stitch: { rx: 286, ry: 98 } },
  grain: [0.0028, 0.075],
  rider: { f: 0.6, h: 2.6 },
  /** Talon and défausse beside the centre, at 0.95 of a card. */
  pile: { dx: 75, dy: 0, scale: 0.95 },
} as const;

const SCALE = 2;
const RING_CELLS = 72;
/** Points of the ring polyline (the mock-up's shape(ringA, ringB, 1440)). */
const RING_STEPS = 1440;
/** Points of the board's outline and outer rim (shape(…, 360)). */
const RIM_STEPS = 360;
/** The rider picture's own size (design/assets/cav-<colour>.png). */
const RIDER_PICTURE = { w: 157, h: 209 } as const;

type XY = [number, number];

/** sign(v) |v|^e, the superellipse's power. */
const sp = (v: number, e: number) => Math.sign(v) * Math.abs(v) ** e;

// Seat frames, q = 0 bottom, 1 left, 2 top, 3 right.
// T = direction of travel, N = towards the centre, ROT = the angle a seat's card is turned by.
const T: readonly Point[] = [
  [-1, 0],
  [0, -1],
  [1, 0],
  [0, 1],
];
const N: readonly Point[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const ROT = [0, 90, 180, 270] as const;
const SIDES: readonly ScreenSide[] = ["bottom", "left", "top", "right"];
/** Where each seat's rider stands: the corner of the side its colour sets off towards (degrees). */
const CORNER_TH = [135, 225, 315, 45] as const;
/** The stable dots of a seat, frame(q, ta, na); slot 0 is the nearest the exit. */
const STABLE_FRAME: readonly Point[] = [
  [2.4, 2.0],
  [3.5, 2.0],
  [2.4, 3.1],
  [3.5, 3.1],
];
/** Home dots leave the carré along normalize(2N - T), one every 1.05 step. */
const HOME_PITCH = 1.05;

/** Knight sprite metrics, in the units of the existing 110 x 190 knight sprite. */
export const KNIGHT = {
  w: 110,
  h: 190,
  /** The feet stand this far below the cell centre (0.28 w, as in the mock-up). */
  feet: 0.28 * 110,
  /** From the cell centre up to the centre of the sprite's box. */
  body: 190 / 2 - 0.28 * 110,
  /** From the cell centre up to the top of the head. */
  head: 190 - 0.28 * 110,
  /** How far a selected knight is lifted. */
  lift: 12,
} as const;

/**
 * Knight width as a fraction of the step, per zone: the galet mock-up's 0.95 on the ring, 0.82 in a
 * home and 0.78 in a stable (« à confirmer par Romain »).
 */
const KNIGHT_WIDTH = { ring: 0.95, home: 0.82, stable: 0.78 } as const;

/** The felt's outline in scene units: an ellipse. */
export type FeltShape = { kind: "ellipse"; cx: number; cy: number; rx: number; ry: number };

/** The galet: viewBox 0 0 width height, its step, its ring, its felt and the cards on it (scene units). */
export type Scene = {
  scale: number;
  width: number;
  height: number;
  /** The distance between two ring cells along the ring. */
  step: number;
  centre: Point;
  /** The ring's superellipse: centre ± (a sp(cos θ, 2 / n), b sp(sin θ, 2 / n)). */
  ring: { a: number; b: number; n: number };
  /** The felt's bounding box. */
  felt: { x: number; y: number; w: number; h: number };
  feltShape: FeltShape;
  /** The cream stitch inside the felt. */
  stitch: FeltShape;
  talon: Point;
  defausse: Point;
  /** The talon and the défausse are drawn at this fraction of a card. */
  pile: number;
  card: { w: number; h: number };
  /** How far a lifted top-row ring knight's head rises above the board, as a fraction of the width. */
  headRoom: number;
};

type Geometry = {
  scene: Scene;
  /** at(j step) for j = 0..71, from the bottom centre clockwise on screen (scene units). */
  cells: Point[];
  /** The 1441-point ring polyline (scene units). */
  poly: Point[];
  /** The frame origins C[q] (scene units). */
  origins: Point[];
  outline: Point[];
  outer: Point[];
  /** Mock-up corner points of the ring for the riders (scene units). */
  corners: Point[];
};

/** The galet computed verbatim in mock-up units, then given in scene units. */
function compute(): Geometry {
  const cfg = MOCKUP;
  const W = cfg.width;
  const H = cfg.height;
  const cx = W / 2;
  const cy = H / 2;
  const e = 2 / cfg.n;

  // The ring: a superellipse walked clockwise on screen from the bottom centre (wave 0).
  const shape = (a: number, b: number, steps: number): XY[] => {
    const out: XY[] = [];
    for (let j = 0; j <= steps; j++) {
      const th = ((90 + (360 * j) / steps) * Math.PI) / 180;
      out.push([cx + a * sp(Math.cos(th), e), cy + b * sp(Math.sin(th), e)]);
    }
    return out;
  };
  const perimeter = (pts: XY[]) => {
    let P = 0;
    for (let j = 1; j < pts.length; j++) {
      const p = pts[j - 1] as XY;
      const q = pts[j] as XY;
      P += Math.hypot(q[0] - p[0], q[1] - p[1]);
    }
    return P;
  };

  let s = 50;
  let pts: XY[] = [];
  let ringA = 0;
  let ringB = 0;
  for (let it = 0; it < 6; it++) {
    const m = MOCKUP.pad + 0.5 * MOCKUP.disc * s;
    ringA = cx - m;
    ringB = cy - m;
    pts = shape(ringA, ringB, RING_STEPS);
    s = perimeter(pts) / RING_CELLS;
  }
  const cum: number[] = [0];
  for (let j = 1; j < pts.length; j++) {
    const p = pts[j - 1] as XY;
    const q = pts[j] as XY;
    cum.push((cum[j - 1] as number) + Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  const at = (d: number): XY => {
    for (let j = 1; j < pts.length; j++) {
      if (d <= (cum[j] as number) + 1e-6) {
        const p = pts[j - 1] as XY;
        const q = pts[j] as XY;
        const c0 = cum[j - 1] as number;
        const f = (d - c0) / ((cum[j] as number) - c0 || 1);
        return [p[0] + f * (q[0] - p[0]), p[1] + f * (q[1] - p[1])];
      }
    }
    return pts[pts.length - 1] as XY;
  };
  const cells: XY[] = Array.from({ length: RING_CELLS }, (_, j) => at(j * s));

  // Frame origins: the bottom and top on the centre line at the height of their exit, the sides on
  // the middle line at the abscissa of theirs. The exit of seat q is cell j = 18 q + 1.
  const exitOf = (q: number) => cells[18 * q + 1] as XY;
  const origins: XY[] = [
    [cx, exitOf(0)[1]],
    [exitOf(1)[0], cy],
    [cx, exitOf(2)[1]],
    [exitOf(3)[0], cy],
  ];

  const rim = 0.5 * MOCKUP.disc * s;
  const outline = shape(ringA + rim + 20, ringB + rim + 20, RIM_STEPS);
  const outer = shape(ringA + rim + 21.5, ringB + rim + 21.5, RIM_STEPS);
  const corners: XY[] = CORNER_TH.map((deg) => {
    const th = (deg * Math.PI) / 180;
    return [cx + ringA * sp(Math.cos(th), e), cy + ringB * sp(Math.sin(th), e)];
  });

  // The felt and its stitch.
  const f = cfg.felt;
  const feltShape: FeltShape = {
    kind: "ellipse",
    cx: cx * SCALE,
    cy: cy * SCALE,
    rx: f.rx * SCALE,
    ry: f.ry * SCALE,
  };
  const stitch: FeltShape = {
    kind: "ellipse",
    cx: cx * SCALE,
    cy: cy * SCALE,
    rx: f.stitch.rx * SCALE,
    ry: f.stitch.ry * SCALE,
  };
  const felt: Scene["felt"] = {
    x: (cx - f.rx) * SCALE,
    y: (cy - f.ry) * SCALE,
    w: 2 * f.rx * SCALE,
    h: 2 * f.ry * SCALE,
  };

  const step = s * SCALE;
  const card = { w: 1.3 * step, h: 1.3 * step * 1.4 };
  const pile = cfg.pile;
  const talon: Point = [cx * SCALE - pile.dx * SCALE, cy * SCALE - pile.dy * card.h];
  const defausse: Point = [cx * SCALE + pile.dx * SCALE, cy * SCALE + pile.dy * card.h];

  const scaled = (p: XY): Point => [p[0] * SCALE, p[1] * SCALE];
  const sceneCells = cells.map(scaled);
  // headRoom = ((KNIGHT.head + KNIGHT.lift) x knightScale(ring place) − the smallest y of the 72 ring
  // cells) / width = ((159.2 + 12) x 0.95 x step / 110 − 2 x (22 + 0.42 s)) / width: about 0.02166.
  // A board with its head room is therefore (height / width + headRoom) times as tall as it is wide.
  const ringTop = Math.min(...sceneCells.map((p) => p[1]));
  const ringScale = (KNIGHT_WIDTH.ring * step) / KNIGHT.w;
  const headRoom = Math.max(0, (KNIGHT.head + KNIGHT.lift) * ringScale - ringTop) / (W * SCALE);

  return {
    scene: {
      scale: SCALE,
      width: W * SCALE,
      height: H * SCALE,
      step,
      centre: [cx * SCALE, cy * SCALE],
      ring: { a: ringA * SCALE, b: ringB * SCALE, n: cfg.n },
      felt,
      feltShape,
      stitch,
      talon,
      defausse,
      pile: pile.scale,
      card,
      headRoom,
    },
    cells: sceneCells,
    poly: pts.map(scaled),
    origins: origins.map(scaled),
    outline: outline.map(scaled),
    outer: outer.map(scaled),
    corners: corners.map(scaled),
  };
}

/** The galet, computed once. */
const GEOMETRY: Geometry = compute();

/** The galet's scene, the game's one board (« paysage obligatoire »). */
export const SCENE: Scene = GEOMETRY.scene;

/** Sprite-to-scene scale of a knight standing on `place`. */
export function knightScale(place: Place): number {
  return (KNIGHT_WIDTH[place.z] * SCENE.step) / KNIGHT.w;
}

/** The galet colours and the board's paints (mock-up constants). */
export const PALETTE = {
  hex: { bleu: "#1F4FA8", jaune: "#E3A90C", rouge: "#C3271D", vert: "#1F8A3C" },
  light: { bleu: "#5C86D4", jaune: "#F7D35A", rouge: "#EE6B5E", vert: "#5CC27A" },
  on: { bleu: "#FFFFFF", jaune: "#2A1A0E", rouge: "#FFFFFF", vert: "#FFFFFF" },
  ink: "#2A1A0E",
  cream: "#FBF4E2",
  /** The oak of the board. */
  board: "#E9D5AE",
  /** The walnut outer rim. */
  rim: "#4A2E18",
  /** The fine line along the board's outline. */
  outlineLine: "#7A5634",
  track: "#5B3A20",
  feltLight: "#2E7A4E",
  feltDark: "#174A2F",
  feltRim: "#4A2E18",
  stitch: "#E9D5AE",
  /** The cells' drop shadow and the cells' inner shadow (the mock-up's box-shadows). */
  shadow: "#2A1A0E",
  inset: "#785028",
} as const satisfies {
  hex: Record<Color, string>;
  light: Record<Color, string>;
  on: Record<Color, string>;
  [key: string]: unknown;
};

/** The colour at the bottom for seat k (bleu 0, vert 1, rouge 2, jaune 3, as quarterTurnsFor). */
const BOTTOM: readonly Color[] = ["bleu", "vert", "rouge", "jaune"];

export function bottomOf(k: number): Color {
  return BOTTOM[((Math.trunc(k) % 4) + 4) % 4] as Color;
}

/** Seat frame index of a colour once bottomOf(k) is at the bottom: 0 bottom, 1 left, 2 top, 3 right. */
function quarterOf(color: Color, k: number): number {
  const b = COLORS.indexOf(bottomOf(k));
  const i = COLORS.indexOf(color);
  if (i < 0) throw new Error(`unknown colour ${String(color)}`);
  return (i - b + 4) % 4;
}

/** The side of the scene a colour sits on for seat k. */
export function sceneSideOf(color: Color, k: number): ScreenSide {
  return SIDES[quarterOf(color, k)] as ScreenSide;
}

/** C[q] + T[q] ta step + N[q] na step (the mock-up's frame()). */
function frame(g: Geometry, q: number, ta: number, na: number): Point {
  const c = g.origins[q] as Point;
  const t = T[q] as Point;
  const n = N[q] as Point;
  const s = g.scene.step;
  return [c[0] + t[0] * ta * s + n[0] * na * s, c[1] + t[1] * ta * s + n[1] * na * s];
}

/** Centre of a colour's stable: the mean of its four stable dots. */
export function stableCentre(color: Color, k: number): Point {
  const g = GEOMETRY;
  const q = quarterOf(color, k);
  const dots = STABLE_FRAME.map(([ta, na]) => frame(g, q, ta, na));
  return [dots.reduce((sum, p) => sum + p[0], 0) / 4, dots.reduce((sum, p) => sum + p[1], 0) / 4];
}

const isSlot = (slot: number) => Number.isInteger(slot) && slot >= 0 && slot < 4;

/** Scene point of an engine place for seat k: the cell centre a knight's feet stand on. */
export function sceneXY(place: Place, k: number): Point {
  const g = GEOMETRY;
  const startIdx = (EXIT[bottomOf(k)] + RING_CELLS - 1) % RING_CELLS;
  if (place.z === "ring") {
    const cell = place.cell;
    if (!Number.isInteger(cell) || cell < 0 || cell >= RING_CELLS) {
      throw new Error(`no anchor for place ${JSON.stringify(place)}`);
    }
    return g.cells[(cell - startIdx + RING_CELLS) % RING_CELLS] as Point;
  }
  if (!COLORS.includes(place.color) || !isSlot(place.slot)) {
    throw new Error(`no anchor for place ${JSON.stringify(place)}`);
  }
  const q = quarterOf(place.color, k);
  if (place.z === "stable") {
    const [ta, na] = STABLE_FRAME[place.slot] as Point;
    return frame(g, q, ta, na);
  }
  // Home: from the carré 16 (two cells before the exit) towards the centre, a little askew.
  const carre = g.cells[(EXIT[place.color] + 70 - startIdx + 2 * RING_CELLS) % RING_CELLS] as Point;
  const t = T[q] as Point;
  const n = N[q] as Point;
  const dir: Point = [(2 * n[0] - t[0]) / Math.sqrt(5), (2 * n[1] - t[1]) / Math.sqrt(5)];
  const d = (place.slot + 1) * HOME_PITCH * g.scene.step;
  return [carre[0] + dir[0] * d, carre[1] + dir[1] * d];
}

/** The track: every 4th point of the 1440-point ring, closed, from the bottom centre clockwise. */
export function ringPolyline(): Point[] {
  return GEOMETRY.poly.filter((_, j) => j % 4 === 0).map((p) => [p[0], p[1]] as const);
}

/** The board's outline (oak) and its walnut outer rim, closed 360-point superellipses. */
export function boardOutline(): { outline: Point[]; outer: Point[] } {
  const g = GEOMETRY;
  return {
    outline: g.outline.map((p) => [p[0], p[1]] as const),
    outer: g.outer.map((p) => [p[0], p[1]] as const),
  };
}

/**
 * The box of a colour's rider picture, in the corner of the side its colour sets off towards, and
 * the quarter turn it is drawn with. x, y, w and h describe the upright picture (157:209) around
 * its centre; `angle` turns it about that centre by its seat frame's ROT, the angle seatCard gives
 * the same seat's felt card: 0 at the bottom, 90 on the left, 180 at the top, 270 on the right.
 * Romain, 2026-10-15: « Les chevaux gravés sur le plateau sont tous orientés de la même façon mais
 * je voudrais les tourner pour que les sabots soient dirigés vers chaque camp », then « Quart de
 * tour (Recommandé) ». The hooves of each rider thus point to the edge of its own camp.
 */
export function riderBox(
  color: Color,
  k: number,
): { x: number; y: number; w: number; h: number; angle: 0 | 90 | 180 | 270 } {
  const g = GEOMETRY;
  const rider = MOCKUP.rider;
  const q = quarterOf(color, k);
  const corner = g.corners[q] as Point;
  const [cx, cy] = g.scene.centre;
  const x = cx + rider.f * (corner[0] - cx);
  const y = cy + rider.f * (corner[1] - cy);
  const h = rider.h * g.scene.step;
  const w = (h * RIDER_PICTURE.w) / RIDER_PICTURE.h;
  return { x: x - w / 2, y: y - h / 2, w, h, angle: ROT[q] as 0 | 90 | 180 | 270 };
}

/** Where a seat's last card lies on the felt and how it is turned to face its seat. */
export function seatCard(seat: Color, k: number): { at: Point; angle: 0 | 90 | 180 | 270 } {
  const scene = SCENE;
  const felt = MOCKUP.felt;
  const q = quarterOf(seat, k);
  // In mock-up units, as renderVals: the side seats of the ellipse sit fw − 110 from the centre,
  // the bottom and the top fh − 0.5 h − 6.
  const fw = felt.rx;
  const fh = felt.ry;
  const ch = scene.card.h / SCALE;
  const off = (q % 2 === 1 ? fw - 110 : fh - 0.5 * ch - 6) * SCALE;
  const n = N[q] as Point;
  const [cx, cy] = scene.centre;
  return { at: [cx - n[0] * off, cy - n[1] * off], angle: ROT[q] as 0 | 90 | 180 | 270 };
}

// --- The galet's bare left side (plan 03-10) ---
//
// Romain, 2026-10-17, on the phone held sideways: « Cartes plus grandes en coin » — the hand spreads in
// the bare corner at the bottom left of the galet. What the hand may cover is the galet's wood and
// rim only, never a thing of the game: the boxes below are what must stay uncovered, in scene units.

/** Around a ring cell: its disc (or losange, or carré), the ghost ring and halo of a knight on it. */
const CELL_HALF = 0.62;
/** Above a cell's centre: the head of a knight standing on it (lifted when selected). */
const CELL_UP = 1.4;
/** Around a home or stable dot, and above it the head of its (smaller) knight. */
const DOT_HALF = 0.5;
const DOT_UP = 1.2;

/** Every box the hand must leave bare: [left, top, bottom] in scene units, for any seat k. */
const KEEP_CLEAR: readonly (readonly [number, number, number])[] = (() => {
  const s = GEOMETRY.scene.step;
  const boxes: [number, number, number][] = GEOMETRY.cells.map(([x, y]) => [
    x - CELL_HALF * s,
    y - CELL_UP * s,
    y + CELL_HALF * s,
  ]);
  // The drawing never turns: the dots and riders of seat 0 are every seat's places.
  for (const color of COLORS) {
    for (const slot of [0, 1, 2, 3] as const) {
      for (const z of ["home", "stable"] as const) {
        const [x, y] = sceneXY({ z, color, slot }, 0);
        boxes.push([x - DOT_HALF * s, y - DOT_UP * s, y + DOT_HALF * s]);
      }
    }
    // A rider (and the glow of a thinking seat around it), turned a quarter or not.
    const r = riderBox(color, 0);
    const half = r.angle % 180 === 0 ? r.w / 2 : r.h / 2;
    const tall = r.angle % 180 === 0 ? r.h / 2 : r.w / 2;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    boxes.push([cx - half, cy - tall, cy + tall]);
  }
  const felt = GEOMETRY.scene.felt;
  boxes.push([felt.x, felt.y, felt.y + felt.h]);
  return boxes;
})();

/**
 * How far the galet stays bare from its left edge in the band of scene heights [y0, y1]: the scene x
 * of the leftmost box of KEEP_CLEAR that meets the band (every ring cell with the knight, halo and
 * ghost ring it may carry, every home and stable dot with its knight, the riders, the felt). The
 * phone's hand may cover the galet left of it.
 */
export function leftClearance(y0: number, y1: number): number {
  let x = GEOMETRY.scene.width;
  for (const [left, top, bottom] of KEEP_CLEAR) {
    if (bottom >= y0 && top <= y1 && left < x) x = left;
  }
  return Math.max(0, x);
}
