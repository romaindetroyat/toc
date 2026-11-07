import { type ArtShape, boardArt, KNIGHT, knightScale, riderBox, SCENE, sceneXY } from "@toc/board";
import { COLORS, type Color, type Place } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { starterToken } from "./starterToken.ts";

// The stable marks (plan 05-02, APP-05, D-14): the seat's shape beside each stable is the board's
// key, so it must stand on bare wood, clear of everything of the game by at least 0.1 step, for
// each of the four seats at the bottom of the screen in turn: every ring cell, exit and entry
// square (their 0.62-step box, as starterToken.test.ts), every home and stable dot, the knight
// standing on any of them (its sprite's footprint at its zone's size, lifted as a selected one), the
// riders, the « 1er » token at the 844 x 390 and 1280 x 800 scales, and the felt with its rim.

const S = SCENE.step;
const MARGIN = 0.1 * S;
/** Board units per screen pixel at 1280 x 800 and at 844 x 390 (starterToken.test.ts). */
const PXS = [2.61, 4.42];

type Box = { x0: number; y0: number; x1: number; y1: number };

/** A knight's sprite footprint on its place (Pawn.svelte: feet KNIGHT.feet below, 110 x 190 at its size). */
function knightBox(place: Place, k: number): Box {
  const [x, y] = sceneXY(place, k);
  const size = knightScale(place);
  const feet = y + KNIGHT.feet * size;
  return {
    x0: x - (KNIGHT.w / 2) * size,
    x1: x + (KNIGHT.w / 2) * size,
    y0: feet - 186 * size - KNIGHT.lift,
    y1: feet + 4 * size,
  };
}

const square = ([x, y]: readonly [number, number], half: number): Box => ({
  x0: x - half,
  y0: y - half,
  x1: x + half,
  y1: y + half,
});

/** Every thing the mark must leave uncovered, for the board turned for k. */
function things(k: number): { name: string; box: Box }[] {
  const out: { name: string; box: Box }[] = [];
  for (let cell = 0; cell < 72; cell++) {
    const place: Place = { z: "ring", cell };
    out.push({ name: `case ${cell}`, box: square(sceneXY(place, k), 0.62 * S) });
    out.push({ name: `cheval sur la case ${cell}`, box: knightBox(place, k) });
  }
  for (const color of COLORS) {
    for (const slot of [0, 1, 2, 3] as const) {
      for (const z of ["home", "stable"] as const) {
        const place: Place = { z, color, slot };
        out.push({ name: `${z} ${color}${slot}`, box: square(sceneXY(place, k), 0.5 * S) });
        out.push({ name: `cheval ${z} ${color}${slot}`, box: knightBox(place, k) });
      }
    }
    const r = riderBox(color, k);
    const [hw, hh] = r.angle % 180 === 0 ? [r.w / 2, r.h / 2] : [r.h / 2, r.w / 2];
    const rc = [r.x + r.w / 2, r.y + r.h / 2] as const;
    out.push({
      name: `cavalier ${color}`,
      box: { x0: rc[0] - hw, y0: rc[1] - hh, x1: rc[0] + hw, y1: rc[1] + hh },
    });
    for (const px of PXS) {
      const t = starterToken(color, k, px);
      out.push({
        name: `1er ${color} ${px}`,
        box: {
          x0: t.at[0] - t.w / 2,
          y0: t.at[1] - t.h / 2,
          x1: t.at[0] + t.w / 2,
          y1: t.at[1] + t.h / 2,
        },
      });
    }
  }
  return out;
}

/** Distance from a point to a box (0 inside). */
const gap = (x: number, y: number, b: Box) =>
  Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.y0 - y, 0, y - b.y1));

/** Distance from a point outside the felt to the felt's outline with its rim (0.12 step wide). */
function feltGap(x: number, y: number): number {
  const f = SCENE.feltShape;
  const rx = f.rx + 0.06 * S;
  const ry = f.ry + 0.06 * S;
  if (((x - f.cx) / rx) ** 2 + ((y - f.cy) / ry) ** 2 <= 1) return 0;
  let best = Number.POSITIVE_INFINITY;
  for (let j = 0; j < 1440; j++) {
    const a = (2 * Math.PI * j) / 1440;
    best = Math.min(best, Math.hypot(x - f.cx - rx * Math.cos(a), y - f.cy - ry * Math.sin(a)));
  }
  return best;
}

/** Whether a point lies inside the ring's superellipse (on the wood within the ring). */
function insideRing(x: number, y: number): boolean {
  const { a, b, n } = SCENE.ring;
  const [cx, cy] = SCENE.centre;
  return Math.abs((x - cx) / a) ** n + Math.abs((y - cy) / b) ** n < 1;
}

function markDisc(k: number, color: Color): { cx: number; cy: number; r: number } {
  const disc = boardArt(k).shapes.find(
    (x: ArtShape) => x.role === "stable-mark" && !x.detail && x.color === color,
  );
  if (disc?.kind !== "circle") throw new Error(`no stable mark for ${color} at k=${k}`);
  // Its outer edge, the ink line included.
  return { cx: disc.cx, cy: disc.cy, r: disc.r + (disc.strokeWidth ?? 0) / 2 };
}

describe("the stable marks stand on bare wood (plan 05-02)", () => {
  it("are clear of every cell, dot, knight, rider and « 1er » token, at every turn of the board", () => {
    for (let k = 0; k < 4; k++) {
      const all = things(k);
      for (const color of COLORS) {
        const { cx, cy, r } = markDisc(k, color);
        const hit = all
          .filter((thing) => gap(cx, cy, thing.box) < r + MARGIN)
          .map((thing) => thing.name);
        expect(hit, `${color} k=${k}`).toEqual([]);
      }
    }
  });

  it("are clear of the felt and its rim, and inside the ring", () => {
    for (let k = 0; k < 4; k++) {
      for (const color of COLORS) {
        const { cx, cy, r } = markDisc(k, color);
        expect(feltGap(cx, cy), `${color} k=${k}`).toBeGreaterThanOrEqual(r + MARGIN);
        for (let j = 0; j < 16; j++) {
          const a = (2 * Math.PI * j) / 16;
          expect(insideRing(cx + r * Math.cos(a), cy + r * Math.sin(a)), `${color} k=${k}`).toBe(
            true,
          );
        }
      }
    }
  });

  it("are clear of each other", () => {
    for (let k = 0; k < 4; k++) {
      const discs = COLORS.map((c) => markDisc(k, c));
      for (let i = 0; i < 4; i++) {
        for (let j = i + 1; j < 4; j++) {
          const a = discs[i] as { cx: number; cy: number; r: number };
          const b = discs[j] as { cx: number; cy: number; r: number };
          expect(Math.hypot(a.cx - b.cx, a.cy - b.cy)).toBeGreaterThan(a.r + b.r + MARGIN);
        }
      }
    }
  });
});
