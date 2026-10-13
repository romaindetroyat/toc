// Geometry of the hand fan (UI-SPEC « Hand fan »). Pure, so the 320 px promise can be tested.

/** Card size in px: 72 x 100 compact, 88 x 124 once min(viewport width, height) reaches 600. */
export function cardSize(viewportWidth: number, viewportHeight: number): { w: number; h: number } {
  return Math.min(viewportWidth, viewportHeight) >= 600 ? { w: 88, h: 124 } : { w: 72, h: 100 };
}

export type FanSlot = {
  /** Horizontal shift from the centre, px. */
  dx: number;
  /** Vertical drop, px (the outer cards sit lower). */
  drop: number;
  /** Rotation in degrees about the point at 50 % / 160 % of the card. */
  rotation: number;
};

/**
 * `n` cards in a container `width` px wide: offset = min(56, floor((width - cardW) / (n - 1))),
 * rotation = (i - (n - 1) / 2) x 4 deg, drop = (i - (n - 1) / 2)^2 x 4 px. One card is centred
 * without rotation.
 */
export function fanLayout(n: number, width: number, cardW: number): FanSlot[] {
  if (n <= 0) return [];
  if (n === 1) return [{ dx: 0, drop: 0, rotation: 0 }];
  const offset = Math.min(56, Math.floor((width - cardW) / (n - 1)));
  return Array.from({ length: n }, (_, i) => {
    const middle = i - (n - 1) / 2;
    return { dx: middle * offset, drop: middle * middle * 4, rotation: middle * 4 };
  });
}

/** The visible slice of every card but the last, px: what a finger can hit. */
export function visibleSlice(n: number, width: number, cardW: number): number {
  return n <= 1 ? cardW : Math.min(56, Math.floor((width - cardW) / (n - 1)));
}
