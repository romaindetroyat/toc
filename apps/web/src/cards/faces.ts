import { type CardId, rankOf, suitOf } from "@toc/engine";

/** What a card face draws: the corner label, the suit pip and its colour (UI-SPEC « Card faces »). */
export type CardFace = {
  /** A, 2 ... 10, V, D, R. */
  rankLabel: string;
  /** ♠ ♥ ♦ ♣ */
  suitGlyph: string;
  /** #C0201A for hearts and diamonds, #1A1A1A for spades and clubs. */
  colour: string;
  /** Valet, Dame and Roi carry a figure (or, without one, a large letter between suit pips). */
  court: boolean;
};

const RANK_LABEL: Record<number, string> = { 1: "A", 11: "V", 12: "D", 13: "R" };
const SUIT_GLYPH = { S: "♠", H: "♥", D: "♦", C: "♣" } as const;
const RED = "#C0201A";
const BLACK = "#1A1A1A";

export function cardFace(card: CardId): CardFace {
  const rank = rankOf(card);
  const suit = suitOf(card);
  return {
    rankLabel: RANK_LABEL[rank] ?? String(rank),
    suitGlyph: SUIT_GLYPH[suit],
    colour: suit === "H" || suit === "D" ? RED : BLACK,
    court: rank >= 11,
  };
}

/**
 * Image of each court card, filled in by plan 01-20 from Romain's choice (assets/cartes/CHOIX.md).
 * A court card without an entry is drawn as a large rank letter between its suit pips.
 */
export const COURT_FIGURES: Partial<Record<CardId, string>> = {};
