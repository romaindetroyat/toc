// Pure screen geometry for the overlay: where a place appears once the board is turned by k
// clockwise quarter turns. Pawns, cards and badges stay upright; only their anchors move.

import { type Point, placeXY, rotatePoint } from "@toc/board";
import type { Place } from "@toc/engine";

/** Cell centre of a place on the screen: the point where a pawn's feet stand. */
export function anchorOf(place: Place, k: number): Point {
  return rotatePoint(placeXY(place), k);
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
