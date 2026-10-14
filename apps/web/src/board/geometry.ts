// Pure screen geometry for the galet plateaus (packages/board/src/scene.ts, sceneOf(layout)): where a
// place appears on a plateau when seat k (bleu 0, vert 1, rouge 2, jaune 3) sits at the bottom. The
// drawing never turns; the colours take their side. Knights, cards and badges stay upright; only
// their anchors move.

import { type Layout, type Point, sceneXY } from "@toc/board";
import type { Place } from "@toc/engine";

/**
 * Centre of the drawn cell, home slot or stable hole of a place, in scene units, for seat k at the
 * bottom, on the plateau `layout`. A knight stands on it (its feet KNIGHT.feet x its size below it);
 * the Director's hop points, the overlays and the hit targets use it too. The layout defaults to the
 * landscape galet, the game's only board (« paysage obligatoire »); 01-40 removes the parameter.
 */
export function anchorOf(place: Place, k: number, layout: Layout = "landscape"): Point {
  return sceneXY(place, k, layout);
}

/** Vector from a to b. */
export function screenDelta(a: Point, b: Point): Point {
  return [b[0] - a[0], b[1] - a[1]];
}

/** Which way a knight's head points on the screen. The sprite faces right; left is its mirror. */
export type Facing = "right" | "left";

/** Below this ratio |dx| / |dy| a move counts as vertical and the knight keeps its facing (D-10). */
const VERTICAL_RATIO = 0.35;

/**
 * Facing for a hop whose screen-space delta is (dx, dy), after the board rotation. A near-vertical
 * hop (|dx| < 0.35 * |dy|) and a hop that goes nowhere keep the previous facing.
 */
export function facingFor(previous: Facing, dx: number, dy: number): Facing {
  if (dx === 0 || Math.abs(dx) < VERTICAL_RATIO * Math.abs(dy)) return previous;
  return dx > 0 ? "right" : "left";
}

/** Stable text form of a place, for the data-place attribute: ring:N, stable:colour:slot, home:colour:slot. */
export function placeKey(place: Place): string {
  return place.z === "ring" ? `ring:${place.cell}` : `${place.z}:${place.color}:${place.slot}`;
}
