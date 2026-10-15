// What a seat does not see, read from its PlayerView only (D-10, 03-RESEARCH Pattern 6): the cards that
// may lie in the other hands and in the talon, and how many each of them holds. A human in the seat
// knows exactly this much: his own hand, the cards played (the discard pile), the dead hands laid face
// up, and the public sizes of every hand and of the talon.
// Card ids are unique (52 cards), so the pool is the full deck minus every card the seat has seen.
// Pure, no I/O, erasable syntax only.

import { type CardId, COLORS, type Color, FULL_DECK, type PlayerView } from "@toc/engine";

/** The cards hidden from the seat of `view`: in the other hands or in the talon, in deck order. */
export function unknownCards(view: PlayerView): CardId[] {
  const seen = new Set<CardId>(view.hand);
  for (const card of view.discard) seen.add(card);
  for (const color of COLORS) for (const card of view.posed[color]) seen.add(card);
  return FULL_DECK.filter((card) => !seen.has(card));
}

/** How many unknown cards each seat holds (0 for the viewer) and how many lie in the talon. */
export type HiddenCounts = { hands: Record<Color, number>; talon: number };

/** The hidden counts of `view`, from the public hand sizes and the talon size. */
export function hiddenCounts(view: PlayerView): HiddenCounts {
  const hands = {} as Record<Color, number>;
  for (const color of COLORS) hands[color] = color === view.seat ? 0 : view.handSizes[color];
  return { hands, talon: view.talonSize };
}
