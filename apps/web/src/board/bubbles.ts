// Where a quick message's bubble stands (plan 02-08, 02-UI-SPEC « Received messages »). Pure: the
// screen passes the board's box, the rider's box and the boxes of the controls, all in screen px.
//
// The bubble sits beside the sender's rider, on the side facing the board's vertical centre line
// (left riders → to their right, right riders → to their left), vertically centred on it, BUBBLE_GAP
// clear of it with its BUBBLE_TAIL tail pointing at it, inside the board's box. When that spot covers
// a control (a hand card, a strip button, the info pill, the prompt row, a plate, another bubble), it
// slides along the board's edge to the nearest clear spot; when there is none, it keeps its spot and
// says so (the screen then draws it under the controls, which stay readable and tappable). The other
// bubbles are soft obstacles: avoided when the board leaves room (it does not at 480 x 320, where only
// 129 px separate the left riders from the right ones), never at the cost of a control.

import { riderBox, SCENE } from "@toc/board";
import type { Color } from "@toc/engine";

export type Rect = { x: number; y: number; w: number; h: number };
export type Size = { w: number; h: number };

/** Between the rider's box and the tail's tip, px. */
export const BUBBLE_GAP = 4;
/** The tail's length, px (a triangle pointing at the rider). */
export const BUBBLE_TAIL = 8;
/** The widest bubble, px (« On y est presque » and a 10-letter name fit). */
export const BUBBLE_MAX_W = 160;
/** The bubble's corner radius, px: the tail stays this far (plus its half-width) from the corners. */
const RADIUS = 12;
/** The step of the slide along the edge, px. */
const STEP = 2;

/** Whether two boxes overlap (touching edges do not). */
export function intersects(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/**
 * The box `color`'s rider takes on the screen, the board being `board` (its scale is board.w over
 * SCENE.width): riderBox scaled, its width and height swapped on the side seats (turned 90 or 270°).
 */
export function riderRect(color: Color, k: number, board: Rect): Rect {
  const box = riderBox(color, k);
  const scale = board.w / SCENE.width;
  const quarter = box.angle === 90 || box.angle === 270;
  const w = (quarter ? box.h : box.w) * scale;
  const h = (quarter ? box.w : box.h) * scale;
  const cx = board.x + (box.x + box.w / 2) * scale;
  const cy = board.y + (box.y + box.h / 2) * scale;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export type Placement = {
  /** The bubble's top-left corner, px. */
  x: number;
  y: number;
  /** Which side of the rider it stands on (its tail is on its other edge). */
  side: "left" | "right";
  /** The tail's centre from the bubble's top, px: aimed at the rider's centre, kept off the corners. */
  tailY: number;
  /** False when no spot along the edge is clear of the obstacles. */
  clear: boolean;
  /** Also clear of the soft obstacles (the other bubbles). */
  alone: boolean;
};

const clamp = (value: number, low: number, high: number) =>
  Math.min(Math.max(value, low), Math.max(low, high));

/**
 * The bubble of `size` beside `rider` inside `board`, clear of `obstacles` and, when it can be, of
 * `soft` (see the file's comment). The slide keeps the side and moves the bubble up or down, the
 * nearest clear spot first.
 */
export function placeBubble(
  rider: Rect,
  board: Rect,
  size: Size,
  obstacles: readonly Rect[],
  soft: readonly Rect[] = [],
): Placement {
  const middle = board.x + board.w / 2;
  const centreX = rider.x + rider.w / 2;
  const centreY = rider.y + rider.h / 2;
  const side = centreX < middle ? "right" : "left";
  const ideal =
    side === "right"
      ? rider.x + rider.w + BUBBLE_GAP + BUBBLE_TAIL
      : rider.x - BUBBLE_GAP - BUBBLE_TAIL - size.w;
  const x = clamp(ideal, board.x, board.x + board.w - size.w);
  const top = board.y;
  const bottom = board.y + board.h - size.h;
  const wanted = clamp(centreY - size.h / 2, top, bottom);
  const tail = (y: number) =>
    clamp(centreY - y, RADIUS + BUBBLE_TAIL / 2, size.h - RADIUS - BUBBLE_TAIL / 2);
  const free = (y: number, list: readonly Rect[]) =>
    !list.some((obstacle) => intersects({ x, y, w: size.w, h: size.h }, obstacle));

  // The spots along the edge, nearest first: the wanted one, then one step up and down, and so on.
  const reach = Math.max(wanted - top, bottom - wanted);
  const spots: number[] = [];
  for (let d = 0; d <= reach + STEP; d += STEP) {
    for (const y of d === 0 ? [wanted] : [wanted - d, wanted + d]) {
      if (y >= top - 0.001 && y <= bottom + 0.001) spots.push(y);
    }
  }
  const all = [...obstacles, ...soft];
  for (const y of spots) {
    if (free(y, all)) return { x, y, side, tailY: tail(y), clear: true, alone: true };
  }
  for (const y of spots) {
    if (free(y, obstacles)) return { x, y, side, tailY: tail(y), clear: true, alone: false };
  }
  return { x, y: wanted, side, tailY: tail(wanted), clear: false, alone: false };
}

/**
 * The waiting room's bubble: centred above the sender's seat tile, its tail down, BUBBLE_GAP over the
 * tile, kept inside `bounds` (the window less a margin).
 */
export function placeAbove(tile: Rect, size: Size, bounds: Rect): { x: number; y: number } {
  const x = clamp(tile.x + tile.w / 2 - size.w / 2, bounds.x, bounds.x + bounds.w - size.w);
  const y = clamp(
    tile.y - BUBBLE_GAP - BUBBLE_TAIL - size.h,
    bounds.y,
    bounds.y + bounds.h - size.h,
  );
  return { x, y };
}
