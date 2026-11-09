// The seat marks (APP-05, D-11 corrected by D-14): each seat's shape, the glyph of
// apps/web/src/i18n/fr/seats.ts drawn as a path: Bleu a round, Jaune a triangle, Rouge a square,
// Vert a star. Never a diamond: it would read as the board's exit square (the losange « 18 »).
// One constant decides the shapes (05-RESEARCH Pitfall 1); the knight marks (KnightDefs.svelte) and
// the stable marks (art.ts) both draw markPath. Pure: no DOM.

import type { Color } from "@toc/engine";

export type MarkShape = "round" | "triangle" | "square" | "star";

/** Each seat's shape (D-14: the glyphs ● ▲ ■ ★ of seats.ts). */
export const SEAT_MARKS: Readonly<Record<Color, MarkShape>> = {
  bleu: "round",
  jaune: "triangle",
  rouge: "square",
  vert: "star",
};

/** Three decimals at most, never « -0 ». */
function n(v: number): string {
  const r = Math.round(v * 1000) / 1000;
  return String(Object.is(r, -0) ? 0 : r);
}

/** A closed path through points. */
function polygon(points: readonly (readonly [number, number])[]): string {
  return `M${points.map(([x, y]) => `${n(x)} ${n(y)}`).join(" L")} Z`;
}

/**
 * The closed path of a seat's shape centred on (cx, cy), fitting a box of 2r: a round, a triangle
 * point up, a square or a five-point star with one point up. The sizes even out how big each shape
 * looks (a square of 2r would look heavier than a round of 2r). Every shape is symmetric about the
 * vertical line through cx, so a mirrored knight (its head to the left) shows the same mark.
 */
export function markPath(shape: MarkShape, cx: number, cy: number, r: number): string {
  switch (shape) {
    case "round": {
      const a = 0.9 * r;
      return `M${n(cx - a)} ${n(cy)} A${n(a)} ${n(a)} 0 1 0 ${n(cx + a)} ${n(cy)} A${n(a)} ${n(a)} 0 1 0 ${n(cx - a)} ${n(cy)} Z`;
    }
    case "square": {
      const a = 0.78 * r;
      return polygon([
        [cx - a, cy - a],
        [cx + a, cy - a],
        [cx + a, cy + a],
        [cx - a, cy + a],
      ]);
    }
    case "triangle": {
      // Equilateral, its centroid a little below the centre so the shape sits in the middle of the box.
      const h = 1.7 * r;
      const half = h / Math.sqrt(3);
      const top = cy - 0.55 * h;
      return polygon([
        [cx, top],
        [cx + half, top + h],
        [cx - half, top + h],
      ]);
    }
    case "star": {
      // Ten points, outer r and inner 0.45 r (a little fuller than the classic 0.38, for small sizes),
      // the first one straight up; moved down so the top point and the two lower ones balance.
      const dy = (r - r * Math.cos(Math.PI / 5)) / 2;
      const points: [number, number][] = [];
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r : 0.45 * r;
        const angle = -Math.PI / 2 + (i * Math.PI) / 5;
        points.push([cx + radius * Math.cos(angle), cy + dy + radius * Math.sin(angle)]);
      }
      return polygon(points);
    }
  }
}
