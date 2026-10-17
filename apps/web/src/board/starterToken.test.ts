import { riderBox, SCENE, sceneXY, seatCard } from "@toc/board";
import { COLORS, type Color, firstPlayer } from "@toc/engine";
import { describe, expect, it } from "vitest";
import { STARTER_TOKEN, starterToken } from "./starterToken.ts";

// The « 1er » token (plan 03-11) stands on bare wood at every board size: never on a ring cell, a
// stable or home dot (with the knight standing on it), a rider, the felt or its piles. The board
// units per screen pixel, measured: 2.00 (1920 x 1080), 2.61 (1280 x 800), 4.42 (844 x 390), 5.08
// (750 x 342), 7.14 (568 x 320) and 8.89 at 480 x 320, the smallest screen the game is played on.

const PXS = [2, 2.61, 3.48, 4.42, 5.08, 5.85, 6.15, 7.14, 8.89, 9];

type Box = { x0: number; y0: number; x1: number; y1: number };
const meet = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const around = ([x, y]: readonly [number, number], half: number, up: number): Box => ({
  x0: x - half,
  y0: y - up,
  x1: x + half,
  y1: y + half,
});

/** Every thing of the game the token must leave uncovered, for the board turned for k. */
function things(k: number): { name: string; box: Box }[] {
  const s = SCENE.step;
  const out: { name: string; box: Box }[] = [];
  for (let cell = 0; cell < 72; cell++) {
    // The cell's disc, and the head of a knight standing on it.
    out.push({
      name: `case ${cell}`,
      box: around(sceneXY({ z: "ring", cell }, k), 0.62 * s, 1.4 * s),
    });
  }
  for (const color of COLORS) {
    for (const slot of [0, 1, 2, 3] as const) {
      for (const z of ["home", "stable"] as const) {
        out.push({
          name: `${z} ${color}${slot}`,
          box: around(sceneXY({ z, color, slot }, k), 0.5 * s, 1.2 * s),
        });
      }
    }
    const r = riderBox(color, k);
    const [hw, hh] = r.angle % 180 === 0 ? [r.w / 2, r.h / 2] : [r.h / 2, r.w / 2];
    const rc = [r.x + r.w / 2, r.y + r.h / 2] as const;
    out.push({
      name: `cavalier ${color}`,
      box: { x0: rc[0] - hw, y0: rc[1] - hh, x1: rc[0] + hw, y1: rc[1] + hh },
    });
  }
  return out;
}

const tokenBox = (at: readonly [number, number], w: number, h: number): Box => ({
  x0: at[0] - w / 2,
  y0: at[1] - h / 2,
  x1: at[0] + w / 2,
  y1: at[1] + h / 2,
});

/** Whether a point lies inside the felt's ellipse (its rim included, 4 px wide). */
function inFelt([x, y]: readonly [number, number], px: number): boolean {
  const f = SCENE.feltShape;
  const rx = f.rx + 4 * px;
  const ry = f.ry + 4 * px;
  return ((x - f.cx) / rx) ** 2 + ((y - f.cy) / ry) ** 2 <= 1;
}

describe("the « 1er » token (plan 03-11)", () => {
  it("stands outside the felt, on the side of the seat's card place", () => {
    for (let k = 0; k < 4; k++) {
      for (const seat of COLORS) {
        const card = seatCard(seat, k).at;
        for (const px of PXS) {
          const { at, w, h } = starterToken(seat, k, px);
          const box = tokenBox(at, w, h);
          for (const corner of [
            [box.x0, box.y0],
            [box.x1, box.y0],
            [box.x0, box.y1],
            [box.x1, box.y1],
          ] as const) {
            expect(inFelt(corner, px), `${seat} k=${k} px=${px}`).toBe(false);
          }
          // On the seat's side of the felt: beyond its card, near the felt's axis toward that seat.
          const [cx, cy] = SCENE.centre;
          const dx = Math.round(card[0] - cx);
          const dy = Math.round(card[1] - cy);
          if (dx === 0) {
            expect(Math.sign(at[1] - cy)).toBe(Math.sign(dy));
            expect(Math.abs(at[1] - cy)).toBeGreaterThan(Math.abs(dy));
            expect(Math.abs(at[0] - cx)).toBeLessThanOrEqual(50);
          } else {
            expect(Math.sign(at[0] - cx)).toBe(Math.sign(dx));
            expect(Math.abs(at[0] - cx)).toBeGreaterThan(Math.abs(dx));
            expect(at[1]).toBe(cy);
          }
        }
      }
    }
  });

  it("never covers a ring cell, a stable or home dot, a knight on them or a rider", () => {
    for (let k = 0; k < 4; k++) {
      const all = things(k);
      for (const seat of COLORS) {
        for (const px of PXS) {
          const { at, w, h } = starterToken(seat, k, px);
          const box = tokenBox(at, w, h);
          const hit = all.filter((thing) => meet(box, thing.box)).map((thing) => thing.name);
          expect(hit, `${seat} k=${k} px=${px}`).toEqual([]);
        }
      }
    }
  });

  it("is a 34 x 24 px pill at every size, the seat after the dealer's", () => {
    const { w, h } = starterToken("bleu", 0, 3);
    expect([w, h]).toEqual([STARTER_TOKEN.w * 3, STARTER_TOKEN.h * 3]);
    const dealers: Color[] = ["vert", "bleu", "jaune", "rouge"];
    expect(dealers.map((dealer) => firstPlayer(dealer))).toEqual([
      "bleu",
      "jaune",
      "rouge",
      "vert",
    ]);
  });
});
