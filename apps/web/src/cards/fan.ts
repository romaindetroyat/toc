// Geometry of the hand fan (UI-SPEC « Hand fan »). Pure, so the 320 px promise can be tested.

/**
 * Card size in px: 72 x 100 compact, 106 x 148 once min(viewport width, height) reaches 600 (the
 * computer's bar; 88 x 124 until Romain's « Un peu plus grandes » of 2026-10-17, plan 03-10).
 */
export function cardSize(viewportWidth: number, viewportHeight: number): { w: number; h: number } {
  return Math.min(viewportWidth, viewportHeight) >= 600 ? { w: 106, h: 148 } : { w: 72, h: 100 };
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

// --- The compact mode's hand in the corner (plan 03-10) ---
//
// Romain, 2026-10-17: « sur iphone c'est beaucoup plus difficile », then « Cartes plus grandes en
// coin » — about 1.5 times the column's 52 x 73 cards, the values big, the board no smaller. The
// cards stand from the bottom of the left strip up, each covering all of the one above but a slice
// of at least 44 px, and each as far right as the galet's bare side allows (leftClearance of
// @toc/board): the lower ones lean into the galet's bare corner. A card wider than that room runs
// past the screen's left edge (on an iPhone, into the safe-area inset first): its value stands in
// its top-right corner, which is always seen.

/** Over the hand, the info pill (44 px) and 4 px. */
export const CORNER_TOP = 48;
/** How far the selected card moves toward the board, px. */
export const CORNER_SHIFT = 6;
/** What stays between a card (moved) and the nearest thing of the game, px. */
export const CORNER_MARGIN = 2;

/**
 * The hand's card and slice for a strip `height` px high: the largest card (up to 112 px high, 5:7)
 * such that five of them fit under the info pill with each slice at least 3 px past the middle of
 * its card, so the middle of every card is seen (and tapped): 79 x 110 cards and 58 px slices at
 * 390 px, 67 x 94 and 50 px at 342, 61 x 86 and 46 px at 320. A strip lower than 306 px keeps
 * 44 px slices and smaller cards.
 */
export function cornerCard(height: number): { w: number; h: number; slice: number } {
  const room = height - CORNER_TOP;
  let h = Math.min(112, Math.floor((room - 12) / 3));
  // In a tall window the cards stay together at the bottom: a slice of at most 12 px past the middle.
  let slice = Math.min(Math.floor(h / 2) + 12, Math.floor((room - h) / 4));
  if (slice < 44) {
    h = Math.max(40, room - 4 * 44);
    slice = 44;
  }
  return { w: Math.round((h * 5) / 7), h, slice };
}

/** The strip and the board, px, the strip's top-left corner being (0, 0); the board at its right. */
export type CornerStrip = {
  /** The strip's width: the board's left edge is at x = width. */
  width: number;
  height: number;
  /** The board's top edge and its width (its scale is width / SCENE.width). */
  boardTop: number;
  boardWidth: number;
};

/**
 * `count` cards (at most five) of the corner hand: the top-left corner of each, px in the strip. The
 * last card's bottom is on the strip's bottom edge, each card a slice higher than the next one (a box
 * of five, so the cards never jump when one leaves). Each card's right edge is at the galet's bare
 * room over its whole height, less CORNER_MARGIN and the CORNER_SHIFT of the selection, and never
 * right of the card under it.
 */
export function cornerLayout(
  count: number,
  strip: CornerStrip,
  clearance: (y0: number, y1: number) => number,
  sceneWidth: number,
): { x: number; y: number }[] {
  if (count <= 0 || strip.boardWidth <= 0) return [];
  const { w, h, slice } = cornerCard(strip.height);
  const scale = strip.boardWidth / sceneWidth;
  const toScene = (y: number) => (y - strip.boardTop) / scale;
  const tops = Array.from({ length: count }, (_, i) => strip.height - h - (count - 1 - i) * slice);
  const rights = tops.map(
    (y) =>
      strip.width +
      clearance(toScene(y), toScene(Math.min(y + h, strip.height))) * scale -
      CORNER_MARGIN -
      CORNER_SHIFT,
  );
  for (let i = count - 2; i >= 0; i--) {
    rights[i] = Math.min(rights[i] as number, rights[i + 1] as number);
  }
  return tops.map((y, i) => ({ x: Math.floor((rights[i] as number) - w), y }));
}
