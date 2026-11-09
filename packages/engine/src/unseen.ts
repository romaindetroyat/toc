// What a seat does not see, read from its PlayerView only (D-10, 03-RESEARCH Pattern 6; moved from
// packages/bots by quick task 261109-6an): the cards that may lie in the other hands and in the talon.
// A human in the seat knows exactly this much: his own hand, the cards played (the discard pile), the
// dead hands laid face up, the public sizes of every hand and of the talon, and the card he passed to
// his partner at this deal's exchange (PlayerView.givenToPartner): while the partner has not played
// it, it is known to be in the partner's hand, and it is not part of the unknown pool.
// The computer players read this pool (packages/bots/src/knowledge.ts re-exports it), so a human and a
// computer know the same thing. The sheet « Les cartes jouées » (quick task 261109-80e) shows the other
// side of the same count, rank by rank: the cards already played face up in this pack (playedCards).
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
 * The cards already played in this pack, in deck order: every card seen face up since the last shuffle,
 * that is the discard pile (the cards played in every deal of the pack; the dead hands of the past deals
 * joined it at endDeal) and the dead hands laid down in this deal (view.posed). Not the seat's own hand,
 * nor the card it passed to its partner while the partner holds it: those were never played. Empty again
 * once the pack is reshuffled (endDeal empties the discard pile).
 */
export function playedCards(view: PlayerView): CardId[] {
  const played = new Set<CardId>(view.discard);
  for (const color of COLORS) for (const card of view.posed[color]) played.add(card);
  return FULL_DECK.filter((card) => played.has(card));
}

/**
 * The pack as the seat knows it: for each rank how many of its 4 cards are still hidden (in the other
 * hands or in the talon) and how many were already played (playedCards), both sums, the deal of the
 * pack (1 to 3: 5, 4 then 4 cards) and the talon. Per rank: played + hidden + the own hand + the card
 * the partner holds from the seat (partnerHolds) = 4.
 */
export type DeckCount = {
  hidden: Record<Rank, number>;
  total: number;
  played: Record<Rank, number>;
  playedTotal: number;
  deal: 1 | 2 | 3;
  dealSize: number;
  talon: number;
};

/** How many cards of each rank `cards` holds. */
function byRank(cards: readonly CardId[]): Record<Rank, number> {
  const out = {} as Record<Rank, number>;
  for (const rank of RANKS) out[rank] = 0;
  for (const card of cards) out[rankOf(card)] += 1;
  return out;
}

/**
 * The count of `view`, grouped by rank from unknownCards and playedCards: nothing a seat could not work
 * out itself.
 */
export function deckCount(view: PlayerView): DeckCount {
  const unknown = unknownCards(view);
  const played = playedCards(view);
  const index = view.dealIndex;
  return {
    hidden: byRank(unknown),
    total: unknown.length,
    played: byRank(played),
    playedTotal: played.length,
    deal: (index + 1) as 1 | 2 | 3,
    dealSize: DEAL_SIZES[index],
    talon: view.talonSize,
  };
}
