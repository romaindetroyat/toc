// Board C+ drawing as plain data (D-05, revised by Romain on 2026-10-14). Pure: no DOM, no clock.
//
// boardArt(k) lists the shapes of the C+ portrait (idees01) in painting order; every position comes
// from scene.ts. artSvg() serialises such a list into a standalone SVG document for the tools
// (the rules pictures); the game renders the same shapes as Svelte markup.

import { COLORS, type Color, ENTRY, EXIT, type PawnIndex } from "@toc/engine";
import type { Point } from "./layout.ts";
import { PALETTE, ringPolyline, SCENE, sceneXY, stableCentre } from "./scene.ts";

export type ArtRole =
  | "board"
  | "rim"
  | "band"
  | "band-edge"
  | "felt"
  | "link"
  | "rail"
  | "arrow"
  | "stable"
  | "hole"
  | "lane"
  | "cell"
  | "exit"
  | "entry"
  | "label";

/** translate, then rotate (degrees), then scale: the SVG order. */
export type ArtTransform = { translate?: Point; rotate?: number; scale?: number };

type Common = {
  role: ArtRole;
  /** Ring index, for cell, exit, entry and their labels. */
  cell?: number;
  /** The colour a shape belongs to, where it applies. */
  color?: Color;
  /** A secondary stroke of the same object (an outline, an inner line): not counted as an object. */
  detail?: true;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: readonly number[];
  linecap?: "butt" | "round";
  linejoin?: "miter" | "round";
  opacity?: number;
  transform?: ArtTransform;
};

export type ArtShape =
  | (Common & { kind: "rect"; x: number; y: number; w: number; h: number; rx?: number })
  | (Common & { kind: "circle"; cx: number; cy: number; r: number })
  | (Common & { kind: "polyline"; points: readonly Point[] })
  | (Common & { kind: "path"; d: string })
  | (Common & {
      kind: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      weight: number;
    });

const s = SCENE.step;
const SLOTS: readonly PawnIndex[] = [0, 1, 2, 3];

/** The colour whose exit (losange) is ring cell `cell`. */
function colorOfExit(cell: number): Color {
  const i = ((cell % 72) + 72) % 72;
  const c = COLORS.find((x) => EXIT[x] === i);
  if (!c) throw new Error(`no exit at cell ${cell}`);
  return c;
}

/** The shapes of board C+ for seat k, in painting order. */
export function boardArt(k: number): ArtShape[] {
  const shapes: ArtShape[] = [];
  const W = SCENE.width;
  const H = SCENE.height;

  // The oak board and its walnut rim (an inset line of 0.2 s).
  shapes.push({
    kind: "rect",
    role: "board",
    x: 0,
    y: 0,
    w: W,
    h: H,
    rx: 0.6 * s,
    fill: PALETTE.board,
  });
  shapes.push({
    kind: "rect",
    role: "rim",
    x: 0.1 * s,
    y: 0.1 * s,
    w: W - 0.2 * s,
    h: H - 0.2 * s,
    rx: 0.5 * s,
    fill: "none",
    stroke: PALETTE.rim,
    strokeWidth: 0.2 * s,
  });

  // The ring band and its dashed edge.
  const band = ringPolyline();
  shapes.push({
    kind: "polyline",
    role: "band",
    points: band,
    fill: "none",
    stroke: PALETTE.band,
    strokeWidth: 1.16 * s,
    linejoin: "round",
    linecap: "round",
  });
  shapes.push({
    kind: "polyline",
    role: "band-edge",
    points: band,
    fill: "none",
    stroke: PALETTE.bandEdge,
    strokeWidth: 0.05 * s,
    linejoin: "round",
    dash: [0.25 * s, 0.25 * s],
  });

  // The felt in the middle: walnut border 0.14 s and an inner green line 0.08 s.
  const f = SCENE.felt;
  shapes.push({
    kind: "rect",
    role: "felt",
    x: f.x + 0.07 * s,
    y: f.y + 0.07 * s,
    w: f.w - 0.14 * s,
    h: f.h - 0.14 * s,
    rx: 0.63 * s,
    fill: PALETTE.felt,
    stroke: PALETTE.feltBorder,
    strokeWidth: 0.14 * s,
  });
  shapes.push({
    kind: "rect",
    role: "felt",
    detail: true,
    x: f.x + 0.18 * s,
    y: f.y + 0.18 * s,
    w: f.w - 0.36 * s,
    h: f.h - 0.36 * s,
    rx: 0.52 * s,
    fill: "none",
    stroke: PALETTE.feltLine,
    strokeWidth: 0.08 * s,
  });

  // Ideas of proposal 01: a dashed link from each stable to its exit, a rail from the carré 16
  // into the home, discreet arrows giving the direction of travel.
  for (const c of COLORS) {
    shapes.push({
      kind: "polyline",
      role: "link",
      color: c,
      points: [stableCentre(c, k), sceneXY({ z: "ring", cell: EXIT[c] }, k)],
      fill: "none",
      stroke: PALETTE.hex[c],
      strokeWidth: 0.09 * s,
      dash: [0.27 * s, 0.18 * s],
    });
  }
  for (const c of COLORS) {
    shapes.push({
      kind: "polyline",
      role: "rail",
      color: c,
      points: [
        sceneXY({ z: "ring", cell: ENTRY[c] }, k),
        sceneXY({ z: "home", color: c, slot: 3 }, k),
      ],
      fill: "none",
      stroke: PALETTE.hex[c],
      strokeWidth: 0.24 * s,
      linecap: "round",
    });
  }
  const { left: xL, right: xR, top: yT, bottom: yB } = SCENE.ring;
  const a = 1.9 * s;
  const arrows: [number, number, number][] = [
    [xL + a, yB - a, -135],
    [xL + a, yT + a, -45],
    [xR - a, yT + a, 45],
    [xR - a, yB - a, 135],
  ];
  for (const [x, y, angle] of arrows) {
    shapes.push({
      kind: "path",
      role: "arrow",
      // The mock-up's « M3 12 H19 M13 6 L19 12 L13 18 » in its 24 x 24 box, centred on the origin.
      d: "M-9 0 H7 M1 -6 L7 0 L1 6",
      fill: "none",
      stroke: PALETTE.arrow,
      strokeWidth: 2.6,
      linecap: "round",
      linejoin: "round",
      opacity: 0.75,
      transform: { translate: [x, y], rotate: angle, scale: (0.95 * s) / 24 },
    });
  }

  // Stables (box 2.45 s, inner shadow drawn as an inner line) and their four holes.
  for (const c of COLORS) {
    const [x, y] = stableCentre(c, k);
    const half = 1.225 * s;
    shapes.push({
      kind: "rect",
      role: "stable",
      color: c,
      x: x - half + 0.045 * s,
      y: y - half + 0.045 * s,
      w: 2 * half - 0.09 * s,
      h: 2 * half - 0.09 * s,
      rx: 0.375 * s,
      fill: PALETTE.stable,
      stroke: PALETTE.hex[c],
      strokeWidth: 0.09 * s,
    });
    shapes.push({
      kind: "rect",
      role: "stable",
      color: c,
      detail: true,
      x: x - half + 0.12 * s,
      y: y - half + 0.12 * s,
      w: 2 * half - 0.24 * s,
      h: 2 * half - 0.24 * s,
      rx: 0.3 * s,
      fill: "none",
      stroke: PALETTE.stableShadow,
      strokeWidth: 0.06 * s,
    });
  }
  for (const c of COLORS) {
    for (const slot of SLOTS) {
      const [x, y] = sceneXY({ z: "stable", color: c, slot }, k);
      shapes.push({
        kind: "circle",
        role: "hole",
        color: c,
        cx: x,
        cy: y,
        r: 0.365 * s,
        fill: PALETTE.tint[c],
        stroke: PALETTE.hex[c],
        strokeWidth: 0.07 * s,
      });
    }
  }

  // Home slots: tinted squares 0.82 s with a border of the colour.
  for (const c of COLORS) {
    for (const slot of SLOTS) {
      const [x, y] = sceneXY({ z: "home", color: c, slot }, k);
      const half = 0.41 * s;
      shapes.push({
        kind: "rect",
        role: "lane",
        color: c,
        x: x - half + 0.045 * s,
        y: y - half + 0.045 * s,
        w: 2 * half - 0.09 * s,
        h: 2 * half - 0.09 * s,
        rx: 0.135 * s,
        fill: PALETTE.tint[c],
        stroke: PALETTE.hex[c],
        strokeWidth: 0.09 * s,
      });
    }
  }

  // The 72 cells and their printed numerals (board artwork, like the former printed board).
  for (let cell = 0; cell < 72; cell++) {
    const [x, y] = sceneXY({ z: "ring", cell }, k);
    const m = cell % 18;
    const label = (text: string, size: number, weight: number, fill: string, color?: Color) => {
      shapes.push({
        kind: "text",
        role: "label",
        cell,
        ...(color ? { color } : {}),
        x,
        y: y + 0.35 * size,
        text,
        size,
        weight,
        fill,
      });
    };
    if (m === 0) {
      // Losange « 18 »: a square 0.76 s turned 45°, cream border 0.08 s, ink outline 0.05 s.
      const c = colorOfExit(cell);
      const d = 0.76 * s;
      const transform = { translate: [x, y] as Point, rotate: 45 };
      shapes.push({
        kind: "rect",
        role: "exit",
        cell,
        color: c,
        x: -d / 2 + 0.04 * s,
        y: -d / 2 + 0.04 * s,
        w: d - 0.08 * s,
        h: d - 0.08 * s,
        rx: 0.04 * s,
        fill: PALETTE.hex[c],
        stroke: PALETTE.cream,
        strokeWidth: 0.08 * s,
        transform,
      });
      shapes.push({
        kind: "rect",
        role: "exit",
        cell,
        color: c,
        detail: true,
        x: -d / 2 - 0.025 * s,
        y: -d / 2 - 0.025 * s,
        w: d + 0.05 * s,
        h: d + 0.05 * s,
        rx: 0.105 * s,
        fill: "none",
        stroke: PALETTE.ink,
        strokeWidth: 0.05 * s,
        transform,
      });
      label("18", 0.36 * s, 900, PALETTE.on[c], c);
    } else if (m === 16) {
      // Carré « 16 » in the colour of the exit two cells further: 0.84 s, ink border 0.07 s.
      const c = colorOfExit(cell + 2);
      const d = 0.84 * s;
      shapes.push({
        kind: "rect",
        role: "entry",
        cell,
        color: c,
        x: x - d / 2 + 0.035 * s,
        y: y - d / 2 + 0.035 * s,
        w: d - 0.07 * s,
        h: d - 0.07 * s,
        rx: 0.105 * s,
        fill: PALETTE.hex[c],
        stroke: PALETTE.ink,
        strokeWidth: 0.07 * s,
      });
      label("16", 0.4 * s, 900, PALETTE.on[c], c);
    } else {
      // Ordinary cell: a cream disc 0.88 s with an ink border 0.075 s, numbered 1 to 17.
      shapes.push({
        kind: "circle",
        role: "cell",
        cell,
        cx: x,
        cy: y,
        r: 0.44 * s - 0.0375 * s,
        fill: PALETTE.cream,
        stroke: PALETTE.ink,
        strokeWidth: 0.075 * s,
      });
      label(String(m), 0.4 * s, 800, PALETTE.ink);
    }
  }
  return shapes;
}

/** A number for an SVG attribute: finite, at most two decimals. */
function num(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`artSvg: not a finite number: ${n}`);
  const r = Math.round(n * 100) / 100;
  return String(Object.is(r, -0) ? 0 : r);
}

/** Escapes text content and attribute values. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function transformAttr(t: ArtTransform): string {
  const parts: string[] = [];
  if (t.translate) parts.push(`translate(${num(t.translate[0])} ${num(t.translate[1])})`);
  if (t.rotate !== undefined) parts.push(`rotate(${num(t.rotate)})`);
  if (t.scale !== undefined) parts.push(`scale(${num(t.scale)})`);
  return parts.join(" ");
}

function paintAttrs(shape: ArtShape): string {
  const a: string[] = [];
  if (shape.fill !== undefined) a.push(`fill="${esc(shape.fill)}"`);
  if (shape.stroke !== undefined) a.push(`stroke="${esc(shape.stroke)}"`);
  if (shape.strokeWidth !== undefined) a.push(`stroke-width="${num(shape.strokeWidth)}"`);
  if (shape.dash !== undefined) a.push(`stroke-dasharray="${shape.dash.map(num).join(" ")}"`);
  if (shape.linecap !== undefined) a.push(`stroke-linecap="${esc(shape.linecap)}"`);
  if (shape.linejoin !== undefined) a.push(`stroke-linejoin="${esc(shape.linejoin)}"`);
  if (shape.opacity !== undefined) a.push(`opacity="${num(shape.opacity)}"`);
  if (shape.transform) a.push(`transform="${transformAttr(shape.transform)}"`);
  return a.join(" ");
}

function shapeSvg(shape: ArtShape): string {
  const paint = paintAttrs(shape);
  switch (shape.kind) {
    case "rect": {
      const rx = shape.rx !== undefined ? ` rx="${num(shape.rx)}"` : "";
      return `<rect x="${num(shape.x)}" y="${num(shape.y)}" width="${num(shape.w)}" height="${num(shape.h)}"${rx} ${paint}/>`;
    }
    case "circle":
      return `<circle cx="${num(shape.cx)}" cy="${num(shape.cy)}" r="${num(shape.r)}" ${paint}/>`;
    case "polyline": {
      const pts = shape.points.map((p) => `${num(p[0])},${num(p[1])}`).join(" ");
      return `<polyline points="${pts}" ${paint}/>`;
    }
    case "path":
      return `<path d="${esc(shape.d)}" ${paint}/>`;
    case "text":
      return `<text x="${num(shape.x)}" y="${num(shape.y)}" font-size="${num(shape.size)}" font-weight="${num(shape.weight)}" text-anchor="middle" ${paint}>${esc(shape.text)}</text>`;
  }
}

/** A complete SVG document of the shapes: viewBox = the scene, drawn at width x height pixels. */
export function artSvg(
  shapes: readonly ArtShape[],
  options: { width: number; height: number; fontFamily: string },
): string {
  const body = shapes.map(shapeSvg).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${num(options.width)}" height="${num(options.height)}" viewBox="0 0 ${num(SCENE.width)} ${num(SCENE.height)}" font-family="${esc(options.fontFamily)}">${body}</svg>`;
}
