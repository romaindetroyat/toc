// What a seat does not see, read from its PlayerView only (D-10, 03-RESEARCH Pattern 6): the cards that
// may lie in the other hands and in the talon, and how many each of them holds. A human in the seat
// knows exactly this much: his own hand, the cards played (the discard pile), the dead hands laid face
// up, the public sizes of every hand and of the talon, and the card he passed to his partner at this
// deal's exchange (PlayerView.givenToPartner): while the partner has not played it, it is known to be
// in the partner's hand, and it is not part of the unknown pool.
// The pool itself is the engine's (unknownCards and partnerHolds of @toc/engine, quick task
// 261109-6an), re-exported here: the sheet « Les cartes du paquet » counts the same pool rank by rank,
// so a human and a computer player see the same thing. Pure, no I/O, erasable syntax only.

import { COLORS, type Color, PARTNER, type PlayerView, partnerHolds } from "@toc/engine";

export { partnerHolds, unknownCards } from "@toc/engine";

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
