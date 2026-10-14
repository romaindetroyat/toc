// The galet board's drawing as plain data, for its two plateaus. Pure: no DOM, no clock.
//
// boardArt(k, layout) lists the definitions (noise filters, gradients, clip paths) and the shapes of
// design/plateau-galet.dc.html for that plateau, in the mock-up's painting order; every position
// comes from scene.ts, read through sceneOf(layout) and the layout passed to every geometry call.
// artSvg() serialises such a drawing into a standalone SVG document for the tools (the rules
// pictures); the game renders the same data as Svelte markup.

import { COLORS, type Color, EXIT } from "@toc/engine";
import type { Point } from "./layout.ts";
import {
  boardOutline,
  type FeltShape,
  type Layout,
  PALETTE,
  ringPolyline,
  sceneOf,
  sceneXY,
} from "./scene.ts";

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

/** The galet drawing of a plateau for seat k, in painting order. */
export function boardArt(k: number, layout: Layout = "portrait"): Art {
  const scene = sceneOf(layout);
  const s = scene.step;
  const defs: ArtDef[] = [];
  const shapes: ArtShape[] = [];

  // The walnut outer rim, the oak outline, the track.
  const { outline, outer } = boardOutline(layout);
  shapes.push({ kind: "outline", role: "rim", points: outer, fill: PALETTE.rim });
  shapes.push({ kind: "outline", role: "board", points: outline, fill: PALETTE.board });
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

  // The felt.
  shapes.push({ kind: "path", role: "felt", d: feltPath(scene.feltShape), fill: PALETTE.feltDark });

  // The 72 cells and their handwritten numbers.
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
      // Losange « 18 »: a square 0.8 s turned 45°, ink border 0.06 s inside the box, radius 0.1 s.
      const c = colorOfExit(cell);
      const d = 0.8 * s;
      const b = 0.06 * s;
      shapes.push({
        kind: "rect",
        role: "exit",
        cell,
        color: c,
        x: -d / 2 + b / 2,
        y: -d / 2 + b / 2,
        w: d - b,
        h: d - b,
        rx: 0.1 * s - b / 2,
        fill: PALETTE.hex[c],
        stroke: PALETTE.ink,
        strokeWidth: b,
        transform: { translate: [x, y], rotate: 45 },
      });
      label("18", 0.52 * s, PALETTE.on[c], 0, 0, c);
    } else if (m === 16) {
      // Carré « 16 » in the colour of the exit two cells further: 0.86 s, radius 0.12 s.
      const c = colorOfExit(cell + 2);
      const d = 0.86 * s;
      const b = 0.06 * s;
      shapes.push({
        kind: "rect",
        role: "entry",
        cell,
        color: c,
        x: x - d / 2 + b / 2,
        y: y - d / 2 + b / 2,
        w: d - b,
        h: d - b,
        rx: 0.12 * s - b / 2,
        fill: PALETTE.hex[c],
        stroke: PALETTE.ink,
        strokeWidth: b,
      });
      label("16", 0.56 * s, PALETTE.on[c], tilt, 0, c);
    } else {
      // Ordinary cell: a cream disc 0.84 s with an ink border 0.065 s, numbered 1 to 17.
      const b = 0.065 * s;
      shapes.push({
        kind: "circle",
        role: "cell",
        cell,
        cx: x,
        cy: y,
        r: 0.42 * s - b / 2,
        fill: PALETTE.cream,
        stroke: PALETTE.ink,
        strokeWidth: b,
      });
      label(String(m), 0.58 * s, PALETTE.ink, tilt, -0.02 * s);
    }
  }
  return { layout, width: scene.width, height: scene.height, defs, shapes };
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
