// What a seat does not see, read from its PlayerView only (D-10, 03-RESEARCH Pattern 6; moved from
// packages/bots by quick task 261109-6an): the cards that may lie in the other hands and in the talon.
// A human in the seat knows exactly this much: his own hand, the cards played (the discard pile), the
// dead hands laid face up, the public sizes of every hand and of the talon, and the card he passed to
// his partner at this deal's exchange (PlayerView.givenToPartner): while the partner has not played
// it, it is known to be in the partner's hand, and it is not part of the unknown pool.
// The computer players read this pool (packages/bots/src/knowledge.ts re-exports it) and the sheet
// « Les cartes du paquet » shows it rank by rank, so a human and a computer know the same thing.
// Card ids are unique (52 cards), so the pool is the full deck minus every card the seat has seen.
// Pure, no I/O, erasable syntax only.

import { FULL_DECK, RANKS } from "./deck.ts";
import { DEAL_SIZES } from "./state.ts";
import { COLORS } from "./topology.ts";
import { type CardId, type PlayerView, type Rank, rankOf } from "./types.ts";

/**
 * The card the seat passed to its partner when the partner still holds it: givenToPartner once the
 * gives have crossed, unless it was played or laid down since. null otherwise (and during the exchange,
 * where the chosen card is still in the seat's own hand).
 */
export function partnerHolds(view: PlayerView): CardId | null {
  const card = view.givenToPartner;
  if (card === null || view.hand.includes(card) || view.discard.includes(card)) return null;
  for (const color of COLORS) if (view.posed[color].includes(card)) return null;
  return card;
}

/** The cards hidden from the seat of `view`: in the other hands or in the talon, in deck order. */
export function unknownCards(view: PlayerView): CardId[] {
  const seen = new Set<CardId>(view.hand);
  for (const card of view.discard) seen.add(card);
  for (const color of COLORS) for (const card of view.posed[color]) seen.add(card);
  const passed = partnerHolds(view);
  if (passed !== null) seen.add(passed);
  return FULL_DECK.filter((card) => !seen.has(card));
}

/**
 * The pack as the seat knows it: for each rank how many of its 4 cards are still hidden (in the other
 * hands or in the talon), their sum, the deal of the pack (1 to 3: 5, 4 then 4 cards) and the talon.
 */
export type DeckCount = {
  hidden: Record<Rank, number>;
  total: number;
  deal: 1 | 2 | 3;
  dealSize: number;
  talon: number;
};

/** The count of `view`, grouped by rank from unknownCards: nothing a seat could not work out itself. */
export function deckCount(view: PlayerView): DeckCount {
  const hidden = {} as Record<Rank, number>;
  for (const rank of RANKS) hidden[rank] = 0;
  const unknown = unknownCards(view);
  for (const card of unknown) hidden[rankOf(card)] += 1;
  const index = view.dealIndex;
  return {
    hidden,
    total: unknown.length,
    deal: (index + 1) as 1 | 2 | 3,
    dealSize: DEAL_SIZES[index],
    talon: view.talonSize,
  };
}
