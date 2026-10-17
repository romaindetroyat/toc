// The « 1er » token of the first player of a deal (Romain, 2026-10-17: « Il faut aussi savoir quel
// joueur va jouer le premier la donne actuelle », plan 03-11). Pure geometry, in scene units.

import { type Point, SCENE, seatCard } from "@toc/board";
import type { Color } from "@toc/engine";

/** The token's size on the screen (CSS px): a pill 34 x 24, like the « D » disc's 24 px height. */
export const STARTER_TOKEN = { w: 34, h: 24, gap: 6 } as const;

/**
 * Below and above the felt, the bare wood runs from the stable to the first home dot; its middle is
 * this far from the felt's axis, toward the stable (scene units). The drawing never turns: the stable
 * is on the left at the bottom and on the right at the top, whoever sits there.
 */
const TOWARD_STABLE = 50;

/**
 * Where the token of `seat` stands for the board turned for seat index `k`, `px` board units per
 * screen pixel: on the wood just outside the felt's rim, on that seat's side, `gap` px away, in the
 * middle of the bare wood between that side's stable and home lane. The felt's
 * centre is full (the talon, the défausse and the four card places, the top and bottom ones between
 * the piles), while the wood between the rim and each seat's stable and home lane is bare.
 * Returns the centre and the box size in scene units.
 */
export function starterToken(
  seat: Color,
  k: number,
  px: number,
): { at: Point; w: number; h: number } {
  const { at, angle } = seatCard(seat, k);
  const [cx, cy] = SCENE.centre;
  const { w, h } = SCENE.felt;
  const tw = STARTER_TOKEN.w * px;
  const th = STARTER_TOKEN.h * px;
  const gap = STARTER_TOKEN.gap * px;
  if (angle % 180 === 0) {
    const dir = Math.sign(at[1] - cy);
    return { at: [cx - dir * TOWARD_STABLE, cy + dir * (h / 2 + gap + th / 2)], w: tw, h: th };
  }
  const dir = Math.sign(at[0] - cx);
  return { at: [cx + dir * (w / 2 + gap + tw / 2), cy], w: tw, h: th };
}
