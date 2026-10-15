// One imagined deal (03-RESEARCH Pattern 6): a full game state that the seat could be in, given what it
// sees. The unknown cards (knowledge.ts) are shuffled with the bot's own sfc32 and dealt to the other
// seats by their public hand sizes, the rest forming the talon in random order. Every public field is
// copied from the view, the seat's own hand and exchange choice too, so viewFor(world, seat) equals the
// view. The card the seat passed to its partner (givenToPartner) is placed in the partner's hand while
// the partner has not played it: the seat knows it is there. It is a uniform draw over the hidden layouts consistent with the view: no inference from the
// opponents' past choices, and the partner's hand is unknown like the opponents' (D-10: a human partner
// is treated like a computer one).
// This is the one file of the bots that names the full state: it builds an imagined one, from the view
// alone, for the search to play in (search.ts). No real GameState ever reaches the bots.
// Pure, no I/O, erasable syntax only.

import {
  type CardId,
  COLORS,
  type Color,
  type GameState,
  next,
  PARTNER,
  type Pawn,
  type PawnId,
  type PlayerView,
  type Rng,
  shuffle,
  sortHand,
} from "@toc/engine";
import { hiddenCounts, partnerHolds, unknownCards } from "./knowledge.ts";

/** An imagined game state, built from a PlayerView by determinize. */
export type World = GameState;

function perColor<T>(make: (color: Color) => T): Record<Color, T> {
  return { bleu: make("bleu"), jaune: make("jaune"), rouge: make("rouge"), vert: make("vert") };
}

function copyPawns(pawns: Record<PawnId, Pawn>): Record<PawnId, Pawn> {
  const copy = {} as Record<PawnId, Pawn>;
  for (const id of Object.keys(pawns) as PawnId[]) copy[id] = { ...pawns[id] };
  return copy;
}

/**
 * A world consistent with `view` (the view of `seat`), drawn with `rng`; returns it and the rng after
 * the draw. The same view and rng give the same world.
 */
export function determinize(view: PlayerView, seat: Color, rng: Rng): [World, Rng] {
  const counts = hiddenCounts(view);
  const passed = partnerHolds(view);
  let [pool, r] = shuffle(unknownCards(view), rng);
  const hands = perColor((color): CardId[] => {
    if (color === seat) return view.hand.slice();
    const cards = pool.slice(0, counts.hands[color]);
    pool = pool.slice(counts.hands[color]);
    if (passed !== null && color === PARTNER[seat]) cards.push(passed);
    return sortHand(cards);
  });
  const talon = pool;

  // In the exchange, a seat that has chosen gives one card of its imagined hand (its own: the view's).
  const given = perColor((): CardId | null => null);
  for (const color of COLORS) {
    if (color === seat) {
      given[color] = view.given;
    } else if (view.phase === "exchange" && view.hasGiven[color]) {
      const hand = hands[color];
      let u: number;
      [u, r] = next(r);
      given[color] = hand[Math.min(hand.length - 1, Math.floor(u * hand.length))] ?? null;
    }
  }
  // The seat's own give, once crossed, is its partner's received card (state.received); the other seats'
  // received cards only label a card in hand and stay unknown.
  const received = perColor((color): CardId | null => {
    if (color === seat) return view.received;
    if (color === PARTNER[seat] && view.given === null) return view.givenToPartner;
    return null;
  });

  const seed: number[] = [];
  for (let i = 0; i < 4; i++) {
    let u: number;
    [u, r] = next(r);
    seed.push(Math.floor(u * 4294967296) | 0);
  }

  const world: World = {
    kind: "state",
    pawns: copyPawns(view.pawns),
    hands,
    talon,
    discard: view.discard.slice(),
    lastPlayed: { ...view.lastPlayed },
    posed: perColor((color) => view.posed[color].slice()),
    dealer: view.dealer,
    dealIndex: view.dealIndex,
    dealsPlayed: view.dealsPlayed,
    turn: view.turn,
    phase: view.phase,
    given,
    received,
    captures: { ...view.captures },
    winner: view.winner,
    rng: seed as Rng,
    rules: { ...view.rules },
  };
  return [world, r];
}
