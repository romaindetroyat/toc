// The 52-card deck and the hand order. Pure, no I/O.

import type { CardId, Rank, Suit } from "./types.ts";
import { rankOf, suitOf } from "./types.ts";

/** Hand order of the suits for equal ranks: pique, coeur, carreau, trefle (UI-SPEC). */
const SUIT_ORDER: Record<Suit, number> = { S: 0, H: 1, D: 2, C: 3 };

const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const SUITS: readonly Suit[] = ["S", "H", "D", "C"];

/** The 52 cards, 13 ranks times S H D C, no joker. */
export const FULL_DECK: readonly CardId[] = RANKS.flatMap((rank) =>
  SUITS.map((suit): CardId => `${rank}${suit}`),
);

/** A new array: ascending rank (As = 1 ... Roi = 13), ties ordered pique, coeur, carreau, trefle. */
export function sortHand(cards: readonly CardId[]): CardId[] {
  return cards
    .slice()
    .sort((x, y) => rankOf(x) - rankOf(y) || SUIT_ORDER[suitOf(x)] - SUIT_ORDER[suitOf(y)]);
}
