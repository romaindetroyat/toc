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

/** The width of the screen margin on each side of the fan (the padding of the hand zone), px. */
export const FAN_GUTTER = 16;

/**
 * How far past the box of the fan the top corners of its outer cards reach once they are turned about
 * the point at 160 % of their height (the corner swings out by 1.6 h sin(a) and the half width
 * shrinks by cos(a)), px. Zero for one card, and never negative.
 */
export function fanReach(n: number, cardW: number, cardH: number): number {
  if (n <= 1) return 0;
  const angle = (((n - 1) / 2) * 4 * Math.PI) / 180;
  const pivotY = 1.6 * cardH;
  // The outer top corner, relative to the pivot (the card's centre line, 160 % down), then turned.
  const x = (cardW / 2) * Math.cos(angle) + pivotY * Math.sin(angle);
  return Math.max(0, x - cardW / 2);
}

/**
 * The width the fan may spread over so that its turned outer cards stay inside the screen: the
 * container width less what the turned corners reach past the gutter, on both sides.
 */
export function fanSpread(n: number, width: number, cardW: number, cardH: number): number {
  const beyond = Math.max(0, Math.ceil(fanReach(n, cardW, cardH)) - FAN_GUTTER);
  return width - 2 * beyond;
}

// --- The compact bar's hand (UI-SPEC addendum « Plateau galet », items 8 and 9, plan 01-37) ---
//
// On a phone held sideways the hand is a flat row inside the band's 64 px row: compact cards of
// 64 x 90 with no turn and no drop, their top 8 px under the row's top edge, the selected card
// rising 8 px. The lower part of every card is cut at the row's bottom edge (the bottom of the
// screen): what shows is the card's top, its indices and its pip.

/** The band's card size, px. */
export const BAND_CARD = { w: 64, h: 90 } as const;

/** The band's hand row, px (the 64 px row of the compact bar). */
export const BAND_ROW = 64;

/** How far under the row's top edge the cards' tops sit, px. */
export const BAND_TOP = 8;

/** How far the selected card rises, px (its top then meets the row's top edge). */
export const BAND_LIFT = 8;

/**
 * `n` flat cards in a row `width` px wide: offset = min(56, floor((width − 64) / (n − 1))), no
 * rotation, no drop. One card is centred.
 */
export function bandLayout(n: number, width: number): FanSlot[] {
  if (n <= 0) return [];
  if (n === 1) return [{ dx: 0, drop: 0, rotation: 0 }];
  const offset = Math.min(56, Math.floor((width - BAND_CARD.w) / (n - 1)));
  return Array.from({ length: n }, (_, i) => ({
    dx: (i - (n - 1) / 2) * offset,
    drop: 0,
    rotation: 0,
  }));
}

/**
 * The visible height of a card in a row `row` px high, px: from its top (8 px under the row's top,
 * or at it once selected) down to the row's bottom edge, never more than the card itself.
 */
export function bandVisible(selected: boolean, row: number = BAND_ROW): number {
  const top = selected ? BAND_TOP - BAND_LIFT : BAND_TOP;
  return Math.max(0, Math.min(BAND_CARD.h, row - top));
}
