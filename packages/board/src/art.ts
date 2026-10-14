// The galet board's drawing as plain data, for its two plateaus. Pure: no DOM, no clock.
//
// boardArt(k, layout) lists the definitions (noise filters, gradients, clip paths) and the shapes of
// design/plateau-galet.dc.html for that plateau, in the mock-up's painting order; every position
// comes from scene.ts, read through sceneOf(layout) and the layout passed to every geometry call.
// artSvg() serialises such a drawing into a standalone SVG document for the tools (the rules
// pictures); the game renders the same data as Svelte markup.

import { COLORS, type Color, EXIT, type PawnIndex } from "@toc/engine";
import type { Point } from "./layout.ts";
import {
  boardOutline,
  bottomOf,
  type FeltShape,
  type Layout,
  MOCKUP,
  PALETTE,
  riderBox,
  ringPolyline,
  sceneOf,
  sceneXY,
} from "./scene.ts";

const SLOTS: readonly PawnIndex[] = [0, 1, 2, 3];

export type ArtRole =
  | "rim"
  | "board"
  | "grain"
  | "track"
  | "felt"
  | "felt-texture"
  | "felt-rim"
  | "stitch"
  | "rider"
  | "lane"
  | "hole"
  | "cell"
  | "exit"
  | "entry"
  | "label";

/** translate, then rotate (degrees), then scale: the SVG order. */
export type ArtTransform = { translate?: Point; rotate?: number; scale?: number };

/** A definition the shapes refer to by its id (always prefixed « toc- »). */
export type ArtDef =
  | {
      kind: "noise";
      id: string;
      /** feTurbulence baseFrequency, per scene unit (x, y). */
      frequency: readonly [number, number];
      octaves: number;
      seed: number;
      /** The feColorMatrix « matrix » values (20 numbers). */
      matrix: readonly number[];
    }
  | {
      kind: "radial";
      id: string;
      /** Centre and radius as fractions of the shape's box. */
      cx: number;
      cy: number;
      r: number;
      stops: readonly { offset: number; color: string }[];
    }
  | { kind: "clip"; id: string; d: string };

type Common = {
  role: ArtRole;
  /** Ring index, for cell, exit, entry and their labels. */
  cell?: number;
  /** The colour a shape belongs to, where it applies. */
  color?: Color;
  /** A secondary stroke or a shadow of the same object: not counted as an object. */
  detail?: true;
  fill?: string;
  /** Fill with a gradient def (its id). */
  fillDef?: string;
  /** A filter def (its id). */
  filter?: string;
  /** A clip-path def (its id). */
  clip?: string;
  fillOpacity?: number;
  stroke?: string;
  strokeWidth?: number;
  strokeOpacity?: number;
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
  /** A closed outline through its points. */
  | (Common & { kind: "outline"; points: readonly Point[] })
  | (Common & { kind: "path"; d: string })
  | (Common & {
      kind: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      weight: number;
      /** hand = the handwritten family (Caveat), ui = the interface family. */
      font: "hand" | "ui";
    })
  /** A picture; its href is supplied by the renderer (by colour). */
  | (Common & { kind: "image"; color: Color; x: number; y: number; w: number; h: number });

/** A plateau's drawing: its scene size, its definitions and its shapes in painting order. */
export type Art = {
  layout: Layout;
  width: number;
  height: number;
  defs: ArtDef[];
  shapes: ArtShape[];
};

/** The colour whose exit (losange) is ring cell `cell`. */
function colorOfExit(cell: number): Color {
  const i = ((cell % 72) + 72) % 72;
  const c = COLORS.find((x) => EXIT[x] === i);
  if (!c) throw new Error(`no exit at cell ${cell}`);
  return c;
}

/** One decimal, as the mock-up's paths. */
const f1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

/** A closed path through points (the mock-up's pathOf). */
function pathOf(points: readonly Point[]): string {
  return `M${points.map((p) => `${f1(p[0])} ${f1(p[1])}`).join(" L")} Z`;
}

/** The felt's outline as a path: a 96-point ellipse or a rectangle with quadratic corners. */
export function feltPath(shape: FeltShape): string {
  if (shape.kind === "ellipse") {
    const pts: Point[] = [];
    for (let j = 0; j < 96; j++) {
      const a = (2 * Math.PI * j) / 96;
      pts.push([shape.cx + shape.rx * Math.cos(a), shape.cy + shape.ry * Math.sin(a)]);
    }
    return pathOf(pts);
  }
  const { x, y, w, h, r } = shape;
  const L = x;
  const R = x + w;
  const Tp = y;
  const B = y + h;
  return (
    `M${f1(L + r)} ${f1(Tp)} H${f1(R - r)} Q${f1(R)} ${f1(Tp)} ${f1(R)} ${f1(Tp + r)} ` +
    `V${f1(B - r)} Q${f1(R)} ${f1(B)} ${f1(R - r)} ${f1(B)} H${f1(L + r)} ` +
    `Q${f1(L)} ${f1(B)} ${f1(L)} ${f1(B - r)} V${f1(Tp + r)} Q${f1(L)} ${f1(Tp)} ${f1(L + r)} ${f1(Tp)} Z`
  );
}

/** The mock-up's « 0 0 0 0 r  0 0 0 0 g  0 0 0 0 b  0 0 0 a o » matrices of the two noises. */
const GRAIN_MATRIX = [0, 0, 0, 0, 0.42, 0, 0, 0, 0, 0.27, 0, 0, 0, 0, 0.13, 0, 0, 0, 1.25, -0.42];
const FELT_MATRIX = [0, 0, 0, 0, 0.05, 0, 0, 0, 0, 0.16, 0, 0, 0, 0, 0.09, 0, 0, 0, 0.6, -0.2];

/** The fixed ids of the definitions (one board is drawn at a time). */
const ID = {
  grain: "toc-grain",
  felt: "toc-felt",
  boardClip: "toc-board-clip",
  feltClip: "toc-felt-clip",
  feltLight: "toc-felt-light",
  hole: (c: Color) => `toc-hole-${c}`,
} as const;

/**
 * The crescent of a disc's inner shadow (the mock-up's « inset 0 -dy … »): the part of the disc of
 * radius r at (x, y) that the same disc moved up by dy leaves uncovered, along its bottom edge.
 */
function crescent(x: number, y: number, r: number, dy: number): string {
  const half = Math.sqrt(r * r - (dy / 2) ** 2);
  const ym = y - dy / 2;
  const n = (v: number) => (Math.round(v * 100) / 100).toString();
  return (
    `M${n(x - half)} ${n(ym)} A${n(r)} ${n(r)} 0 0 0 ${n(x + half)} ${n(ym)} ` +
    `A${n(r)} ${n(r)} 0 0 1 ${n(x - half)} ${n(ym)} Z`
  );
}

/** The galet drawing of a plateau for seat k, in the mock-up's painting order. */
export function boardArt(k: number, layout: Layout = "portrait"): Art {
  const scene = sceneOf(layout);
  const s = scene.step;
  const W = scene.width;
  const H = scene.height;
  const grain = MOCKUP[layout].grain;
  const { outline, outer } = boardOutline(layout);
  const felt = feltPath(scene.feltShape);

  // The noise frequencies are per user unit: the scene is the mock-up x 2, so they are halved.
  const defs: ArtDef[] = [
    {
      kind: "noise",
      id: ID.grain,
      frequency: [grain[0] / 2, grain[1] / 2],
      octaves: 3,
      seed: 11,
      matrix: GRAIN_MATRIX,
    },
    {
      kind: "noise",
      id: ID.felt,
      frequency: [0.45, 0.45],
      octaves: 2,
      seed: 3,
      matrix: FELT_MATRIX,
    },
    { kind: "clip", id: ID.boardClip, d: pathOf(outline) },
    { kind: "clip", id: ID.feltClip, d: felt },
    {
      kind: "radial",
      id: ID.feltLight,
      cx: 0.5,
      cy: 0.42,
      r: 0.65,
      stops: [
        { offset: 0, color: PALETTE.feltLight },
        { offset: 1, color: PALETTE.feltDark },
      ],
    },
    // The stable dots' « radial-gradient(circle at 35% 30%, LIGHT 0%, HEX 62%) »: a circle reaching
    // the farthest corner of the dot's box, hypot(0.65, 0.7) of its side.
    ...COLORS.map(
      (c): ArtDef => ({
        kind: "radial",
        id: ID.hole(c),
        cx: 0.35,
        cy: 0.3,
        r: Math.hypot(0.65, 0.7),
        stops: [
          { offset: 0, color: PALETTE.light[c] },
          { offset: 0.62, color: PALETTE.hex[c] },
        ],
      }),
    ),
  ];
  const shapes: ArtShape[] = [];

  // The board: the walnut outer rim, the oak outline, its grain, its fine line, the track.
  shapes.push({ kind: "outline", role: "rim", points: outer, fill: PALETTE.rim });
  shapes.push({ kind: "outline", role: "board", points: outline, fill: PALETTE.board });
  shapes.push({
    kind: "rect",
    role: "grain",
    x: 0,
    y: 0,
    w: W,
    h: H,
    filter: ID.grain,
    clip: ID.boardClip,
  });
  shapes.push({
    kind: "outline",
    role: "board",
    detail: true,
    points: outline,
    fill: "none",
    stroke: PALETTE.outlineLine,
    strokeWidth: 0.06 * s,
    strokeOpacity: 0.55,
  });
  shapes.push({
    kind: "polyline",
    role: "track",
    points: ringPolyline(layout),
    fill: "none",
    stroke: PALETTE.track,
    strokeOpacity: 0.28,
    strokeWidth: 0.07 * s,
    linejoin: "round",
  });

  // The felt: its radial green, a fine texture clipped to the felt only (the mock-up's « correction
  // des transparences du tapis », « à confirmer par Romain »), its walnut rim and its cream stitch.
  shapes.push({ kind: "path", role: "felt", d: felt, fillDef: ID.feltLight });
  shapes.push({
    kind: "rect",
    role: "felt-texture",
    x: 0,
    y: 0,
    w: W,
    h: H,
    filter: ID.felt,
    clip: ID.feltClip,
    opacity: 0.5,
  });
  shapes.push({
    kind: "path",
    role: "felt-rim",
    d: felt,
    fill: "none",
    stroke: PALETTE.feltRim,
    strokeWidth: 0.12 * s,
  });
  shapes.push({
    kind: "path",
    role: "stitch",
    d: feltPath(scene.stitch),
    fill: "none",
    stroke: PALETTE.stitch,
    strokeOpacity: 0.45,
    strokeWidth: 0.04 * s,
    dash: [0.16 * s, 0.12 * s],
  });

  // Romain's ink riders, one per colour, in the corner of the side its colour sets off towards.
  for (const c of COLORS) {
    shapes.push({
      kind: "image",
      role: "rider",
      color: c,
      ...riderBox(c, k, layout),
      opacity: 0.85,
    });
  }

  // The dots: per seat, the 4 home dots (hollow, cream ringed with the colour) then the 4 stable
  // dots (the colour's radial gradient, ringed in ink); each over its drop shadow.
  const dotShadow = (role: "lane" | "hole", c: Color, x: number, y: number, r: number) => {
    shapes.push({
      kind: "circle",
      role,
      color: c,
      detail: true,
      cx: x,
      cy: y + 0.04 * s,
      r,
      fill: PALETTE.shadow,
      fillOpacity: 0.3,
    });
  };
  const b = bottomOf(k);
  const seats = [0, 1, 2, 3].map((q) => COLORS[(COLORS.indexOf(b) + q) % 4] as Color);
  for (const c of seats) {
    for (const slot of SLOTS) {
      const [x, y] = sceneXY({ z: "home", color: c, slot }, k, layout);
      const r = 0.4 * s;
      const border = 0.1 * s;
      dotShadow("lane", c, x, y, r);
      shapes.push({
        kind: "circle",
        role: "lane",
        color: c,
        cx: x,
        cy: y,
        r: r - border / 2,
        fill: PALETTE.cream,
        stroke: PALETTE.hex[c],
        strokeWidth: border,
      });
    }
    for (const slot of SLOTS) {
      const [x, y] = sceneXY({ z: "stable", color: c, slot }, k, layout);
      const r = 0.42 * s;
      const border = 0.05 * s;
      dotShadow("hole", c, x, y, r);
      shapes.push({
        kind: "circle",
        role: "hole",
        color: c,
        cx: x,
        cy: y,
        r: r - border / 2,
        fillDef: ID.hole(c),
        stroke: PALETTE.ink,
        strokeWidth: border,
      });
    }
  }

  // The 72 cells and their handwritten numbers, each cell over its drop shadow.
  for (let cell = 0; cell < 72; cell++) {
    const [x, y] = sceneXY({ z: "ring", cell }, k, layout);
    const m = cell % 18;
    const tilt = ((cell * 37) % 13) - 6;
    const label = (
      text: string,
      size: number,
      fill: string,
      rotate: number,
      dy: number,
      color?: Color,
    ) => {
      shapes.push({
        kind: "text",
        role: "label",
        cell,
        ...(color ? { color } : {}),
        x: 0,
        y: 0.33 * size,
        text,
        size,
        weight: 700,
        font: "hand",
        fill,
        transform: { translate: [x, y + dy], rotate },
      });
    };
    if (m === 0) {
      // Losange « 18 »: a square 0.8 s turned 45°, ink border 0.06 s inside the box, radius 0.1 s,
      // over its shadow (0, 0.05 s, rgba(42,26,14,0.35)).
      const c = colorOfExit(cell);
      const d = 0.8 * s;
      const bw = 0.06 * s;
      shapes.push({
        kind: "rect",
        role: "exit",
        cell,
        color: c,
        detail: true,
        x: -d / 2,
        y: -d / 2,
        w: d,
        h: d,
        rx: 0.1 * s,
        fill: PALETTE.shadow,
        fillOpacity: 0.35,
        transform: { translate: [x, y + 0.05 * s], rotate: 45 },
      });
      shapes.push({
        kind: "rect",
        role: "exit",
        cell,
        color: c,
        x: -d / 2 + bw / 2,
        y: -d / 2 + bw / 2,
        w: d - bw,
        h: d - bw,
        rx: 0.1 * s - bw / 2,
        fill: PALETTE.hex[c],
        stroke: PALETTE.ink,
        strokeWidth: bw,
        transform: { translate: [x, y], rotate: 45 },
      });
      label("18", 0.52 * s, PALETTE.on[c], 0, 0, c);
    } else if (m === 16) {
      // Carré « 16 » in the colour of the exit two cells further: 0.86 s, radius 0.12 s, same shadow.
      const c = colorOfExit(cell + 2);
      const d = 0.86 * s;
      const bw = 0.06 * s;
      shapes.push({
        kind: "rect",
        role: "entry",
        cell,
        color: c,
        detail: true,
        x: x - d / 2,
        y: y - d / 2 + 0.05 * s,
        w: d,
        h: d,
        rx: 0.12 * s,
        fill: PALETTE.shadow,
        fillOpacity: 0.35,
      });
      shapes.push({
        kind: "rect",
        role: "entry",
        cell,
        color: c,
        x: x - d / 2 + bw / 2,
        y: y - d / 2 + bw / 2,
        w: d - bw,
        h: d - bw,
        rx: 0.12 * s - bw / 2,
        fill: PALETTE.hex[c],
        stroke: PALETTE.ink,
        strokeWidth: bw,
      });
      label("16", 0.56 * s, PALETTE.on[c], tilt, 0, c);
    } else {
      // Ordinary cell: a cream disc 0.84 s with an ink border 0.065 s, numbered 1 to 17, over its
      // shadow (0, 0.03 s, rgba(42,26,14,0.25)), with its inner shadow (0, -0.06 s,
      // rgba(120,80,40,0.25)) along its bottom edge inside the border.
      const r = 0.42 * s;
      const bw = 0.065 * s;
      shapes.push({
        kind: "circle",
        role: "cell",
        cell,
        detail: true,
        cx: x,
        cy: y + 0.03 * s,
        r,
        fill: PALETTE.shadow,
        fillOpacity: 0.25,
      });
      shapes.push({
        kind: "circle",
        role: "cell",
        cell,
        cx: x,
        cy: y,
        r: r - bw / 2,
        fill: PALETTE.cream,
        stroke: PALETTE.ink,
        strokeWidth: bw,
      });
      shapes.push({
        kind: "path",
        role: "cell",
        cell,
        detail: true,
        d: crescent(x, y, r - bw, 0.06 * s),
        fill: PALETTE.inset,
        fillOpacity: 0.25,
      });
      label(String(m), 0.58 * s, PALETTE.ink, tilt, -0.02 * s);
    }
  }
  return { layout, width: W, height: H, defs, shapes };
}

/** A number for an SVG attribute: finite, at most four decimals. */
function num(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`artSvg: not a finite number: ${n}`);
  const r = Math.round(n * 10000) / 10000;
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

const DEF_ID = /^toc-[a-z0-9-]+$/;

export type ArtSvgOptions = {
  width: number;
  height: number;
  /** The interface family. */
  fontFamily: string;
  /** The handwritten family of the cell numbers (default Caveat). */
  handFamily?: string;
  /** The rider pictures' hrefs, by colour; an image without one is not written. */
  images?: Partial<Record<Color, string>>;
};

/** A complete SVG document of a drawing: viewBox = its scene, drawn at width x height pixels. */
export function artSvg(art: Art, options: ArtSvgOptions): string {
  const ids = new Set<string>();
  for (const def of art.defs) {
    if (!DEF_ID.test(def.id)) throw new Error(`artSvg: bad def id ${def.id}`);
    ids.add(def.id);
  }
  const ref = (id: string) => {
    if (!ids.has(id)) throw new Error(`artSvg: no def ${id}`);
    return `url(#${id})`;
  };

  const paintAttrs = (shape: ArtShape): string => {
    const a: string[] = [];
    if (shape.fillDef !== undefined) a.push(`fill="${ref(shape.fillDef)}"`);
    else if (shape.fill !== undefined) a.push(`fill="${esc(shape.fill)}"`);
    if (shape.fillOpacity !== undefined) a.push(`fill-opacity="${num(shape.fillOpacity)}"`);
    if (shape.filter !== undefined) a.push(`filter="${ref(shape.filter)}"`);
    if (shape.clip !== undefined) a.push(`clip-path="${ref(shape.clip)}"`);
    if (shape.stroke !== undefined) a.push(`stroke="${esc(shape.stroke)}"`);
    if (shape.strokeWidth !== undefined) a.push(`stroke-width="${num(shape.strokeWidth)}"`);
    if (shape.strokeOpacity !== undefined) a.push(`stroke-opacity="${num(shape.strokeOpacity)}"`);
    if (shape.dash !== undefined) a.push(`stroke-dasharray="${shape.dash.map(num).join(" ")}"`);
    if (shape.linecap !== undefined) a.push(`stroke-linecap="${esc(shape.linecap)}"`);
    if (shape.linejoin !== undefined) a.push(`stroke-linejoin="${esc(shape.linejoin)}"`);
    if (shape.opacity !== undefined) a.push(`opacity="${num(shape.opacity)}"`);
    if (shape.transform) a.push(`transform="${transformAttr(shape.transform)}"`);
    return a.join(" ");
  };

  const hand = options.handFamily ?? "Caveat, cursive";
  const shapeSvg = (shape: ArtShape): string => {
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
      case "outline": {
        const pts = shape.points.map((p) => `${num(p[0])},${num(p[1])}`).join(" ");
        return `<polygon points="${pts}" ${paint}/>`;
      }
      case "path":
        return `<path d="${esc(shape.d)}" ${paint}/>`;
      case "text": {
        const family = shape.font === "hand" ? hand : options.fontFamily;
        return `<text x="${num(shape.x)}" y="${num(shape.y)}" font-family="${esc(family)}" font-size="${num(shape.size)}" font-weight="${num(shape.weight)}" text-anchor="middle" ${paint}>${esc(shape.text)}</text>`;
      }
      case "image": {
        const href = options.images?.[shape.color];
        if (href === undefined) return "";
        return `<image href="${esc(href)}" x="${num(shape.x)}" y="${num(shape.y)}" width="${num(shape.w)}" height="${num(shape.h)}" preserveAspectRatio="none" ${paint}/>`;
      }
    }
  };

  const defSvg = (def: ArtDef): string => {
    switch (def.kind) {
      case "noise":
        return `<filter id="${def.id}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${def.frequency.map(num).join(" ")}" numOctaves="${num(def.octaves)}" seed="${num(def.seed)}"/><feColorMatrix type="matrix" values="${def.matrix.map(num).join(" ")}"/></filter>`;
      case "radial": {
        const stops = def.stops
          .map((stop) => `<stop offset="${num(stop.offset)}" stop-color="${esc(stop.color)}"/>`)
          .join("");
        return `<radialGradient id="${def.id}" cx="${num(def.cx)}" cy="${num(def.cy)}" r="${num(def.r)}">${stops}</radialGradient>`;
      }
      case "clip":
        return `<clipPath id="${def.id}"><path d="${esc(def.d)}"/></clipPath>`;
    }
  };

  const defs = art.defs.length > 0 ? `<defs>${art.defs.map(defSvg).join("")}</defs>` : "";
  const body = art.shapes.map(shapeSvg).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${num(options.width)}" height="${num(options.height)}" viewBox="0 0 ${num(art.width)} ${num(art.height)}" font-family="${esc(options.fontFamily)}">${defs}${body}</svg>`;
}
