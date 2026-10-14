// Board C+ drawing as plain data (D-05, revised by Romain on 2026-10-14). Pure: no DOM, no clock.
//
// boardArt(k) lists the shapes of the C+ portrait (idees01) in painting order; every position comes
// from scene.ts. artSvg() serialises such a list into a standalone SVG document for the tools
// (the rules pictures); the game renders the same shapes as Svelte markup.

import type { Color } from "@toc/engine";
import type { Point } from "./layout.ts";
import { PALETTE, ringPolyline, SCENE, sceneXY } from "./scene.ts";

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

  // Tracer: the 72 cells as plain cream discs.
  for (let cell = 0; cell < 72; cell++) {
    const [x, y] = sceneXY({ z: "ring", cell }, k);
    const d = 0.88 * s;
    shapes.push({
      kind: "circle",
      role: "cell",
      cell,
      cx: x,
      cy: y,
      r: d / 2 - 0.0375 * s,
      fill: PALETTE.cream,
      stroke: PALETTE.ink,
      strokeWidth: 0.075 * s,
    });
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
