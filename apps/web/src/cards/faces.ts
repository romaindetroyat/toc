import { type CardId, FULL_DECK, rankOf, suitOf } from "@toc/engine";

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
 * The figure files of apps/web/src/assets/cartes, written by tools/import-card-art.mjs from the card
 * art Romain chose (assets/cartes/CHOIX.md, D-24). Each is a separate file named {rank}{suit}, loaded
 * as an image and never inlined into the code, so that it can be replaced by another figure.
 */
const FIGURE_FILES = import.meta.glob<string>("../assets/cartes/*.{svg,webp}", {
  eager: true,
  query: "?url",
  import: "default",
});

const figureByName = new Map(
  Object.entries(FIGURE_FILES).map(([file, url]) => [
    file.slice(file.lastIndexOf("/") + 1).replace(/\.(svg|webp)$/, ""),
    url,
  ]),
);

/**
 * Image of each court card (Valet, Dame, Roi). A court card without an entry is drawn as a large
 * rank letter between its suit pips.
 */
export const COURT_FIGURES: Partial<Record<CardId, string>> = Object.fromEntries(
  FULL_DECK.filter((card) => rankOf(card) >= 11).flatMap((card) => {
    const url = figureByName.get(card);
    return url ? [[card, url]] : [];
  }),
);
