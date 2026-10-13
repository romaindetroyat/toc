// Board rotation toward the human player (D-05). Pure: no DOM, no clock.
// The art is turned by CSS; every overlay stays upright and only its anchor is rotated here.

import { type Color, nextColor, PARTNER } from "@toc/engine";
import { BOARD_SIZE, type Point } from "./layout.ts";

/** Where a seat sits on the screen once the board is turned toward the human. */
export type ScreenSide = "bottom" | "left" | "top" | "right";

/** Clockwise quarter turns that bring a colour to the bottom (UI-SPEC: Bleu 0, Vert +90, Rouge 180, Jaune -90). */
const QUARTER_TURNS: Record<Color, number> = { bleu: 0, vert: 1, rouge: 2, jaune: 3 };

export function quarterTurnsFor(color: Color): number {
  return QUARTER_TURNS[color];
}

/** Rotates a board-unit point by `k` clockwise quarter turns about the centre: (x, y) -> (size - y, x). */
export function rotatePoint(point: Point, k: number): Point {
  const turns = ((Math.trunc(k) % 4) + 4) % 4;
  let [x, y] = point;
  for (let i = 0; i < turns; i++) [x, y] = [BOARD_SIZE - y, x];
  return [x, y];
}

/** Bottom for the human, left for the next seat clockwise, top for the partner, right for the previous seat. */
export function screenSideOf(seat: Color, human: Color): ScreenSide {
  if (seat === human) return "bottom";
  if (seat === PARTNER[human]) return "top";
  if (seat === nextColor(human)) return "left";
  return "right";
}
