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

// --- The compact mode's hand in the corner (plans 03-10 and 02-06b) ---
//
// Romain, 2026-10-17: « sur iphone c'est beaucoup plus difficile », then « Cartes plus grandes en
// coin » — about 1.5 times the column's 52 x 73 cards, the values big, the board no smaller. The
// cards stand from the bottom of the left strip up, each covering all of the one above but a slice
// of at least 44 px. Then, the same day, from his iPhone: « Sur iphone, la carte du bas est décalée,
// je ne veux pas ça » (plan 02-06b): the cards stand in one straight column, all the same size and
// the same left edge, never left of the strip (which starts after the safe-area inset, so no card
// sits under the Dynamic Island). The column is as far right as the galet's bare side allows over
// its whole height (leftClearance of @toc/board); where that room is narrower than the 03-10 card,
// the cards are the largest that fit. Each card's value stands in its top-right corner.

/** Over the hand, the info pill (44 px) and 4 px. */
export const CORNER_TOP = 48;
/** How far the selected card moves toward the board, px. */
export const CORNER_SHIFT = 6;
/** What stays between a card (moved) and the nearest thing of the game, px. */
export const CORNER_MARGIN = 2;
/** The tallest corner card, px (80 x 112). */
const CORNER_MAX_H = 112;
/** The narrowest corner card, px: a tap target. */
const CORNER_MIN_W = 44;

export type CornerCard = { w: number; h: number; slice: number };

/**
 * The hand's card and slice for a strip `height` px high: the largest card (up to 112 px high, 5:7,
 * at most `maxWidth` wide) such that five of them fit under the info pill with each slice at least
 * 3 px past the middle of its card, so the middle of every card is seen (and tapped): 79 x 110 cards
 * and 58 px slices at 390 px, 67 x 94 and 50 px at 342, 61 x 86 and 46 px at 320. A strip lower than
 * 306 px keeps 44 px slices and smaller cards.
 */
export function cornerCard(height: number, maxWidth = Number.POSITIVE_INFINITY): CornerCard {
  const room = height - CORNER_TOP;
  // The tallest 5:7 card whose rounded width is at most maxWidth.
  const cap = Math.min(CORNER_MAX_H, Math.floor((Math.floor(maxWidth) * 7) / 5));
  let h = Math.min(cap, Math.floor((room - 12) / 3));
  // In a tall window the cards stay together at the bottom: a slice of at most 12 px past the middle.
  let slice = Math.min(Math.floor(h / 2) + 12, Math.floor((room - h) / 4));
  if (slice < 44) {
    h = Math.min(cap, Math.max(40, room - 4 * 44));
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

/** The corner hand: its card, and the top-left corner of each of its cards in the strip, px. */
export type CornerHand = { card: CornerCard; slots: { x: number; y: number }[] };

/**
 * `count` cards (at most five) of the corner hand. The last card's bottom is on the strip's bottom
 * edge, each card a slice higher than the next one (a box of five, so the cards never jump when one
 * leaves). One column: every card has the same left edge, set so that the cards' right edge (moved by
 * CORNER_SHIFT when selected, plus CORNER_MARGIN) stays left of the galet's bare room over the whole
 * box, and never left of the strip's left edge; the card is the largest cornerCard that fits there.
 */
export function cornerLayout(
  count: number,
  strip: CornerStrip,
  clearance: (y0: number, y1: number) => number,
  sceneWidth: number,
): CornerHand {
  const tallest = cornerCard(strip.height);
  if (count <= 0 || strip.boardWidth <= 0) return { card: tallest, slots: [] };
  const scale = strip.boardWidth / sceneWidth;
  const toScene = (y: number) => (y - strip.boardTop) / scale;
  /** Where the right edge of the column may go for this card: the bare room over its box of five. */
  const room = (card: CornerCard) => {
    const top = Math.max(0, strip.height - card.h - 4 * card.slice);
    const bare = clearance(toScene(top), toScene(strip.height)) * scale;
    return strip.width + bare - CORNER_MARGIN - CORNER_SHIFT;
  };
  // A smaller card makes a box no higher, so its room is no narrower: from the tallest card down, the
  // first that fits is the largest.
  let card = tallest;
  for (let w = tallest.w - 1; w >= CORNER_MIN_W && card.w > room(card); w--) {
    card = cornerCard(strip.height, w);
  }
  const x = Math.max(0, Math.floor(room(card) - card.w));
  const slots = Array.from({ length: count }, (_, i) => ({
    x,
    y: strip.height - card.h - (count - 1 - i) * card.slice,
  }));
  return { card, slots };
}

// --- The left strip the compact layout gives the hand (plan 02-06c) ---
//
// Romain, 2026-10-17, asked whether the 02-06b column's smaller cards (56 px wide instead of 79 at
// 844 x 390) should stay or the board shrink a little: « Plateau un peu réduit (Recommandé) ». The
// left strip is as wide as the 03-10 card needs, the right one stays at 60 px: the board moves right
// first (in a window with spare width) and only then gets narrower. The CSS of Game.svelte
// (--hand-card, --hand-strip, --board-size) computes exactly this.

/** Each side strip, at least, px; the prompt row over the board, px. */
export const STRIP_MIN = 60;
export const PROMPT_ROW = 24;
/** What the strip adds to the card for the rounding of the real card (cornerCard rounds), px. */
const STRIP_SLACK = 1.5;

/**
 * The target card's width for a strip `height` px high: cornerCard(height).w without its rounding
 * (min(80, (h − 60) · 5/21, max(40, h − 224) · 5/7)), never under the real one by more than 0.5 px.
 */
export function cornerTargetWidth(height: number): number {
  return Math.min(80, ((height - 60) * 5) / 21, (Math.max(40, height - 224) * 5) / 7);
}

/**
 * The compact layout of a `width` x `height` window with its safe-area insets (`x` both sides
 * together, `y` top and bottom together), the galet being `bare` of its width bare at its left: the
 * board's width and the left strip's (the right strip takes what is left, at least 60 px). The left
 * strip holds the target card, moved by CORNER_SHIFT, plus CORNER_MARGIN, over the galet's bare side:
 * max(60, (card + 8 + 1.5 − bare · (w − x − 60)) / (1 − bare), card + 9.5 − bare · tall board), the
 * first term for a board limited by the width, the second by the height.
 */
export function compactLayout(
  width: number,
  height: number,
  insets: { x: number; y: number },
  bare: number,
  ratio = 0.5,
): { board: number; left: number } {
  const strip = height - insets.y;
  const card = cornerTargetWidth(strip) + CORNER_SHIFT + CORNER_MARGIN + STRIP_SLACK;
  const tall = (strip - PROMPT_ROW) / ratio;
  const room = width - insets.x - STRIP_MIN;
  const hand = Math.max(STRIP_MIN, (card - bare * room) / (1 - bare), card - bare * tall);
  const board = Math.max(0, Math.min(room - hand, tall));
  // The two columns share what the board leaves, the left never under the hand's strip.
  const spare = width - insets.x - board;
  return { board, left: Math.max(hand, spare / 2) };
}
