// Board C+ geometry (D-05, revised by Romain on 2026-10-14). Pure: no DOM, no clock.
//
// Ported from renderVals() of design/plateau-maquette.dc.html, variant « portrait » with idees01,
// with the mock-up's own numbers. The ring is computed in mock-up units (1000 x 1500) exactly as the
// mock-up does, then every export is given in scene units = mock-up units x SCENE.scale (2), so the
// scene is 2000 x 3000 and one step (the distance between two ring cells) is about 126.156 units.
//
// Seating (consequence of C+, to be confirmed by Romain): the drawing never turns. The colour of
// seat k (bleu 0, vert 1, rouge 2, jaune 3) takes the bottom side, its partner the top, the next
// seat clockwise the left and the previous one the right; the ring indices follow from the bottom
// seat's start index, as in the mock-up.

import { COLORS, type Color, EXIT, type Place } from "@toc/engine";
import type { Point } from "./layout.ts";
import type { ScreenSide } from "./rotate.ts";

/** The mock-up's own frame and constants (renderVals, portrait). */
export const MOCKUP = { width: 1000, height: 1500, pad: 16, disc: 0.88 } as const;

const SCALE = 2;
const RING_CELLS = 72;

type XY = [number, number];

/** The ring polyline and its step, computed verbatim in mock-up units. */
function mockupRing() {
  const W = MOCKUP.width;
  const H = MOCKUP.height;
  const cx = W / 2;
  const cy = H / 2;
  let s = 50;
  let pts: XY[] = [];
  let xL = 0;
  let xR = 0;
  let yT = 0;
  let yB = 0;
  for (let it = 0; it < 6; it++) {
    const inset = MOCKUP.pad + 0.5 * MOCKUP.disc * s;
    xL = inset;
    xR = W - inset;
    yT = inset;
    yB = H - inset;
    const r = s;
    const next: XY[] = [];
    const arc = (ox: number, oy: number, a0: number, a1: number) => {
      for (let j = 0; j <= 24; j++) {
        const a = ((a0 + ((a1 - a0) * j) / 24) * Math.PI) / 180;
        next.push([ox + r * Math.cos(a), oy + r * Math.sin(a)]);
      }
    };
    next.push([cx, yB], [xL + r, yB]);
    arc(xL + r, yB - r, 90, 180);
    next.push([xL, yT + r]);
    arc(xL + r, yT + r, 180, 270);
    next.push([xR - r, yT]);
    arc(xR - r, yT + r, 270, 360);
    next.push([xR, yB - r]);
    arc(xR - r, yB - r, 0, 90);
    next.push([cx, yB]);
    pts = next;
    let P = 0;
    for (let j = 1; j < pts.length; j++) {
      const a = pts[j - 1] as XY;
      const b = pts[j] as XY;
      P += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    s = P / RING_CELLS;
  }
  return { s, pts, xL, xR, yT, yB, cx, cy };
}

const M = mockupRing();
const STEP = M.s * SCALE;
const CX = M.cx * SCALE;
const CY = M.cy * SCALE;
const XL = M.xL * SCALE;
const XR = M.xR * SCALE;
const YT = M.yT * SCALE;
const YB = M.yB * SCALE;
const POLY: readonly Point[] = M.pts.map(([x, y]) => [x * SCALE, y * SCALE] as const);
const CUM: number[] = [0];
for (let j = 1; j < POLY.length; j++) {
  const a = POLY[j - 1] as Point;
  const b = POLY[j] as Point;
  CUM.push((CUM[j - 1] as number) + Math.hypot(b[0] - a[0], b[1] - a[1]));
}

/** The point at length `d` along the ring polyline (the mock-up's at(), scene units). */
function at(d: number): Point {
  for (let j = 1; j < POLY.length; j++) {
    if (d <= (CUM[j] as number) + 1e-6) {
      const a = POLY[j - 1] as Point;
      const b = POLY[j] as Point;
      const c0 = CUM[j - 1] as number;
      const f = (d - c0) / ((CUM[j] as number) - c0 || 1);
      return [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])];
    }
  }
  return POLY[POLY.length - 1] as Point;
}

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
const SIDE_CENTRE: readonly Point[] = [
  [CX, YB],
  [XL, CY],
  [CX, YT],
  [XR, CY],
];
const SIDES: readonly ScreenSide[] = ["bottom", "left", "top", "right"];

/** C[q] + T[q] ta step + N[q] na step (the mock-up's frame()). */
function frame(q: number, ta: number, na: number): Point {
  const c = SIDE_CENTRE[q] as Point;
  const t = T[q] as Point;
  const n = N[q] as Point;
  return [c[0] + t[0] * ta * STEP + n[0] * na * STEP, c[1] + t[1] * ta * STEP + n[1] * na * STEP];
}

const FELT_HALF_W = 2.45 * STEP;
const FELT_HALF_H = 6.3 * STEP;
const CARD_W = 1.3 * STEP;

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

/** Knight width as a fraction of the step, per zone (mock-up: 0.92 ring, 0.8 home, 0.72 stable). */
const KNIGHT_WIDTH = { ring: 0.92, home: 0.8, stable: 0.72 } as const;

/** Sprite-to-scene scale of a knight standing on `place`. */
export function knightScale(place: Place): number {
  return (KNIGHT_WIDTH[place.z] * STEP) / KNIGHT.w;
}

/** The C+ colours and the board's paints (mock-up constants). */
export const PALETTE = {
  hex: { bleu: "#2C68B0", jaune: "#D9A20F", rouge: "#C23B2B", vert: "#2F8743" },
  tint: { bleu: "#D3E0F1", jaune: "#F6E4A8", rouge: "#F2CFC7", vert: "#CBE4CE" },
  on: { bleu: "#FFFFFF", jaune: "#3A2414", rouge: "#FFFFFF", vert: "#FFFFFF" },
  ink: "#4A2F1B",
  cream: "#FBF5E6",
  board: "#E8D3A6",
  rim: "#5A3B23",
  band: "#D2AF77",
  bandEdge: "#C49C5F",
  felt: "#1F5A3B",
  feltBorder: "#5A3B23",
  feltLine: "#2E7350",
  stable: "#DCC08D",
  stableShadow: "rgba(74,47,27,0.25)",
  arrow: "#7A5634",
} as const satisfies {
  hex: Record<Color, string>;
  tint: Record<Color, string>;
  on: Record<Color, string>;
  [key: string]: unknown;
};

const ringTopKnightHead = (KNIGHT.head + KNIGHT.lift) * ((KNIGHT_WIDTH.ring * STEP) / KNIGHT.w);

/** The scene: viewBox 0 0 width height, its step, the felt and the cards on it (scene units). */
export const SCENE = {
  scale: SCALE,
  width: MOCKUP.width * SCALE,
  height: MOCKUP.height * SCALE,
  step: STEP,
  centre: [CX, CY] as Point,
  /** The ring's straight sides: x of the left and right columns, y of the top and bottom rows. */
  ring: { left: XL, right: XR, top: YT, bottom: YB, radius: STEP },
  felt: { x: CX - FELT_HALF_W, y: CY - FELT_HALF_H, w: 2 * FELT_HALF_W, h: 2 * FELT_HALF_H },
  talon: [CX, CY - 1.15 * STEP] as Point,
  defausse: [CX, CY + 1.15 * STEP] as Point,
  card: { w: CARD_W, h: CARD_W * 1.4 },
  /** How far a lifted top-row ring knight's head rises above the board, as a fraction of the width. */
  headRoom: Math.max(0, ringTopKnightHead - YT) / (MOCKUP.width * SCALE),
} as const;

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

/** Stable holes around the stable centre, (along T, along N) in steps; hole 0 is the nearest the exit. */
const HOLES: readonly Point[] = [
  [-0.56, -0.56],
  [0.56, -0.56],
  [-0.56, 0.56],
  [0.56, 0.56],
];

/** Centre of a colour's stable box. */
export function stableCentre(color: Color, k: number): Point {
  return frame(quarterOf(color, k), 3.4, 2.1);
}

const isSlot = (slot: number) => Number.isInteger(slot) && slot >= 0 && slot < 4;

/** Scene point of an engine place for seat k: the cell centre a knight's feet stand on. */
export function sceneXY(place: Place, k: number): Point {
  if (place.z === "ring") {
    const cell = place.cell;
    if (!Number.isInteger(cell) || cell < 0 || cell >= RING_CELLS) {
      throw new Error(`no anchor for place ${JSON.stringify(place)}`);
    }
    const startIdx = (EXIT[bottomOf(k)] + RING_CELLS - 1) % RING_CELLS;
    const j = (cell - startIdx + RING_CELLS) % RING_CELLS;
    return at(j * STEP);
  }
  if (!COLORS.includes(place.color) || !isSlot(place.slot)) {
    throw new Error(`no anchor for place ${JSON.stringify(place)}`);
  }
  const q = quarterOf(place.color, k);
  if (place.z === "home") return frame(q, -1, (place.slot + 1) * 1.04);
  const c = frame(q, 3.4, 2.1);
  const [a, b] = HOLES[place.slot] as Point;
  const t = T[q] as Point;
  const n = N[q] as Point;
  return [c[0] + t[0] * a * STEP + n[0] * b * STEP, c[1] + t[1] * a * STEP + n[1] * b * STEP];
}

/** The ring band as a closed polyline (scene units), from the bottom-side centre, clockwise on screen. */
export function ringPolyline(): Point[] {
  return POLY.map((p) => [p[0], p[1]] as const);
}

/** Where a seat's last card lies on the felt and how it is turned to face its seat. */
export function seatCard(seat: Color, k: number): { at: Point; angle: 0 | 90 | 180 | 270 } {
  const q = quarterOf(seat, k);
  const half = q % 2 === 0 ? FELT_HALF_H : FELT_HALF_W;
  const off = half - 1.2 * STEP;
  const n = N[q] as Point;
  return { at: [CX - n[0] * off, CY - n[1] * off], angle: ROT[q] as 0 | 90 | 180 | 270 };
}
