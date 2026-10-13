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
