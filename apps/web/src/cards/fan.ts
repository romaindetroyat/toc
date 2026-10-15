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

// --- The compact mode's hand column (UI-SPEC addendum « Recette 3 de Romain », plan 01-47) ---
//
// On a phone held sideways the galet takes the full height and the hand stands in the 60 px strip at
// its left: a column of 52 x 73 cards, none turned, each overlapping the one above so that every card
// shows at least its top 44 px (its index), the last one whole, bottom-aligned. The selected card
// moves 6 px toward the board.

/** The column's card size, px. */
export const COLUMN_CARD = { w: 52, h: 73 } as const;

/** The vertical step between two cards of the column, px: what shows of every card but the last. */
export const COLUMN_STEP = 44;

/** How far the selected card moves toward the board, px. */
export const COLUMN_SHIFT = 6;

/** The height `count` cards take in the column, px: (count − 1) steps and one whole card. */
export function columnHeight(count: number): number {
  return count <= 0 ? 0 : (count - 1) * COLUMN_STEP + COLUMN_CARD.h;
}

/**
 * `count` cards in a column box `height` px high: the top of each card, px from the box's top, every
 * card COLUMN_STEP under the one before, the last one whole and its bottom on the box's bottom edge.
 * A box lower than the cards need keeps the steps: the top cards then start above it.
 */
export function columnLayout(count: number, height: number): { y: number }[] {
  if (count <= 0) return [];
  const top = height - columnHeight(count);
  return Array.from({ length: count }, (_, i) => ({ y: top + i * COLUMN_STEP }));
}
