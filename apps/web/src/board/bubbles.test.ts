// Where a quick message's bubble goes (plan 02-08, 02-UI-SPEC « Received messages »): beside the
// sender's rider, on the side facing the board's vertical centre line, vertically centred on it, 4 px
// clear of it with its 8 px tail pointing at it, inside the board, and slid along the board's edge to
// stay clear of the controls. The rects below come from the real layout code: compactLayout (the
// phone's strips and board), cornerLayout (the hand's cards), riderBox (the riders), the computer's
// bar of 160 px.

import { leftClearance, quarterTurnsFor, riderBox, SCENE } from "@toc/board";
import { COLORS, type Color } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { compactLayout, cornerLayout, PROMPT_ROW, STRIP_MIN } from "../cards/fan.ts";
import {
  BUBBLE_GAP,
  BUBBLE_MAX_W,
  BUBBLE_TAIL,
  intersects,
  placeBubble,
  type Rect,
  riderRect,
} from "./bubbles.ts";

const SIZE = { w: BUBBLE_MAX_W, h: 48 };
const GALET_BARE = leftClearance(-Infinity, Infinity) / SCENE.width;

type Screen = { name: string; board: Rect; obstacles: Rect[] };

/** The phone held sideways, insets 0: strips, prompt row, the five corner cards (one selected). */
function compact(width: number, height: number): Screen {
  const { board: b, left } = compactLayout(width, height, { x: 0, y: 0 }, GALET_BARE);
  const bh = b * (SCENE.height / SCENE.width);
  const top = (height - PROMPT_ROW - bh) / 2 + PROMPT_ROW;
  const right = width - left - b;
  const hand = cornerLayout(
    5,
    { width: left, height, boardTop: top, boardWidth: b },
    leftClearance,
    SCENE.width,
  );
  const cards = hand.slots.map((slot) => ({
    x: slot.x,
    y: slot.y,
    w: hand.card.w + 6,
    h: hand.card.h,
  }));
  return {
    name: `${width} × ${height}`,
    board: { x: left, y: top, w: b, h: bh },
    obstacles: [
      // The info pill at the top of the left strip.
      { x: 0, y: 0, w: left, h: 44 },
      // « Réglages » and « Messages » at the top of the right strip, the state's buttons under them.
      { x: width - right, y: 0, w: right, h: 96 },
      { x: width - right, y: 100, w: Math.max(STRIP_MIN, right), h: height - 100 },
      // The prompt row over the board.
      { x: left, y: top - PROMPT_ROW, w: b, h: PROMPT_ROW },
      ...cards,
    ],
  };
}

/** The computer, 1280 × 800: the board across the width over the 160 px bar. */
function computer(): Screen {
  const width = 1280;
  const height = 800;
  const bar = 160;
  const ratio = SCENE.height / SCENE.width;
  const b = Math.min(width - 32, (height - bar) / (ratio + SCENE.headRoom), 1600);
  const bh = b * ratio;
  return {
    name: "1280 × 800",
    board: { x: (width - b) / 2, y: height - bar - bh, w: b, h: bh },
    obstacles: [{ x: 0, y: height - bar, w: width, h: bar }],
  };
}

const SCREENS: Screen[] = [compact(844, 390), compact(750, 342), compact(480, 320), computer()];

const inside = (inner: Rect, outer: Rect) =>
  inner.x >= outer.x - 0.01 &&
  inner.y >= outer.y - 0.01 &&
  inner.x + inner.w <= outer.x + outer.w + 0.01 &&
  inner.y + inner.h <= outer.y + outer.h + 0.01;

describe("riderRect: a rider's box on the screen", () => {
  it("is the scene's rider box scaled to the board, turned a quarter on the sides", () => {
    const board = { x: 100, y: 50, w: 800, h: 400 };
    const scale = board.w / SCENE.width;
    for (const color of COLORS) {
      const k = quarterTurnsFor("bleu");
      const scene = riderBox(color, k);
      const rect = riderRect(color, k, board);
      const quarter = scene.angle === 90 || scene.angle === 270;
      expect(rect.w).toBeCloseTo((quarter ? scene.h : scene.w) * scale, 6);
      expect(rect.h).toBeCloseTo((quarter ? scene.w : scene.h) * scale, 6);
      expect(rect.x + rect.w / 2).toBeCloseTo(board.x + (scene.x + scene.w / 2) * scale, 6);
      expect(rect.y + rect.h / 2).toBeCloseTo(board.y + (scene.y + scene.h / 2) * scale, 6);
    }
  });

  it("puts your own rider at the bottom left and your partner's at the top right", () => {
    const board = { x: 0, y: 0, w: 800, h: 400 };
    const k = quarterTurnsFor("bleu");
    const own = riderRect("bleu", k, board);
    const partner = riderRect("rouge", k, board);
    expect(own.x + own.w / 2).toBeLessThan(400);
    expect(own.y + own.h / 2).toBeGreaterThan(200);
    expect(partner.x + partner.w / 2).toBeGreaterThan(400);
    expect(partner.y + partner.h / 2).toBeLessThan(200);
  });
});

describe("placeBubble: beside the rider, facing the middle", () => {
  const board = { x: 0, y: 0, w: 1000, h: 500 };

  it("sits right of a left rider, 4 px and the tail away, vertically centred", () => {
    const rider = { x: 100, y: 200, w: 40, h: 60 };
    const at = placeBubble(rider, board, SIZE, []);
    expect(at.side).toBe("right");
    expect(at.x).toBe(rider.x + rider.w + BUBBLE_GAP + BUBBLE_TAIL);
    expect(at.y + SIZE.h / 2).toBe(rider.y + rider.h / 2);
    expect(at.tailY).toBe(SIZE.h / 2);
    expect(at.clear).toBe(true);
  });

  it("sits left of a right rider, its tail on its right edge", () => {
    const rider = { x: 800, y: 300, w: 40, h: 60 };
    const at = placeBubble(rider, board, SIZE, []);
    expect(at.side).toBe("left");
    expect(at.x + SIZE.w).toBe(rider.x - BUBBLE_GAP - BUBBLE_TAIL);
  });

  it("stays inside the board, the tail still aimed at the rider", () => {
    const rider = { x: 20, y: 0, w: 40, h: 30 };
    const at = placeBubble(rider, board, SIZE, []);
    expect(at.y).toBe(0);
    expect(at.tailY).toBeGreaterThanOrEqual(12);
    expect(at.tailY).toBeLessThan(SIZE.h / 2);
  });

  it("slides along the edge to clear an obstacle, the nearest way", () => {
    const rider = { x: 100, y: 200, w: 40, h: 60 };
    const block = { x: 140, y: 210, w: 300, h: 40 };
    const at = placeBubble(rider, board, SIZE, [block]);
    expect(at.clear).toBe(true);
    expect(intersects({ x: at.x, y: at.y, w: SIZE.w, h: SIZE.h }, block)).toBe(false);
    expect(Math.abs(at.y + SIZE.h / 2 - 230)).toBeLessThanOrEqual(SIZE.h / 2 + 20 + 2);
  });

  it("keeps off another bubble when it can, and off a control always", () => {
    const rider = { x: 100, y: 200, w: 40, h: 60 };
    const other = { x: 140, y: 190, w: 200, h: 80 };
    const apart = placeBubble(rider, board, SIZE, [], [other]);
    expect(apart.alone).toBe(true);
    expect(intersects({ x: apart.x, y: apart.y, w: SIZE.w, h: SIZE.h }, other)).toBe(false);
    // A board just as tall as the bubble: no room for both, the control wins.
    const low = { x: 0, y: 200, w: 1000, h: SIZE.h };
    const squeezed = placeBubble({ x: 100, y: 200, w: 40, h: 48 }, low, SIZE, [], [low]);
    expect(squeezed).toMatchObject({ clear: true, alone: false });
  });

  it("says so when nothing is clear, and keeps its place by the rider", () => {
    const rider = { x: 100, y: 200, w: 40, h: 60 };
    const at = placeBubble(rider, board, SIZE, [board]);
    expect(at.clear).toBe(false);
    expect(at.x).toBe(rider.x + rider.w + BUBBLE_GAP + BUBBLE_TAIL);
  });
});

describe("the four bubbles at the target sizes", () => {
  for (const screen of SCREENS) {
    for (const me of COLORS) {
      it(`${screen.name}, ${me} at the bottom: all four fit at once, clear of every control`, () => {
        const k = quarterTurnsFor(me);
        const placed: Rect[] = [];
        for (const color of COLORS as readonly Color[]) {
          const rider = riderRect(color, k, screen.board);
          const at = placeBubble(rider, screen.board, SIZE, screen.obstacles, placed);
          const box = { x: at.x, y: at.y, w: SIZE.w, h: SIZE.h };
          expect(at.clear, `${color}`).toBe(true);
          // Apart from each other too, where the board leaves room (not at 480 × 320, whose board is
          // 351 px wide with 129 px between the left and the right riders).
          if (screen.name !== "480 × 320") expect(at.alone, `${color} apart`).toBe(true);
          expect(inside(box, screen.board), `${color} inside the board`).toBe(true);
          for (const obstacle of screen.obstacles) {
            expect(intersects(box, obstacle), `${color} over ${JSON.stringify(obstacle)}`).toBe(
              false,
            );
          }
          // The bubble faces the middle: left riders to their right, right riders to their left.
          const middle = screen.board.x + screen.board.w / 2;
          expect(at.side).toBe(rider.x + rider.w / 2 < middle ? "right" : "left");
          placed.push(box);
        }
      });
    }
  }
});
