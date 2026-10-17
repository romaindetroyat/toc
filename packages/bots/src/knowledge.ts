// What a seat does not see, read from its PlayerView only (D-10, 03-RESEARCH Pattern 6): the cards that
// may lie in the other hands and in the talon, and how many each of them holds. A human in the seat
// knows exactly this much: his own hand, the cards played (the discard pile), the dead hands laid face
// up, the public sizes of every hand and of the talon, and the card he passed to his partner at this
// deal's exchange (PlayerView.givenToPartner): while the partner has not played it, it is known to be
// in the partner's hand, and it is not part of the unknown pool.
// Card ids are unique (52 cards), so the pool is the full deck minus every card the seat has seen.
// Pure, no I/O, erasable syntax only.

import { type CardId, COLORS, type Color, FULL_DECK, PARTNER, type PlayerView } from "@toc/engine";

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
 * How many unknown cards each seat holds (0 for the viewer, one less for the partner while it holds the
 * card the viewer passed) and how many lie in the talon.
 */
export type HiddenCounts = { hands: Record<Color, number>; talon: number };

/** The hidden counts of `view`, from the public hand sizes and the talon size. */
export function hiddenCounts(view: PlayerView): HiddenCounts {
  const hands = {} as Record<Color, number>;
  for (const color of COLORS) hands[color] = color === view.seat ? 0 : view.handSizes[color];
  if (partnerHolds(view) !== null) hands[PARTNER[view.seat]] -= 1;
  return { hands, talon: view.talonSize };
}
