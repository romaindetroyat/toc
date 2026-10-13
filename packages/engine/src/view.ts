// The per-seat view: the hidden-hand boundary. Pure, no I/O.
// A PlayerView carries what one seat is allowed to know: its own cards, the size of the other hands,
// the public piles and the public board. Never the rng, the talon order or another seat's cards.
// kind 'view' makes it a type error to hand a GameState to code that must stay blind (bots).

import type { Color, PawnId } from "./topology.ts";
import type { GameState, Pawn, PlayerView } from "./types.ts";

function perColor<T>(make: (color: Color) => T): Record<Color, T> {
  return { bleu: make("bleu"), jaune: make("jaune"), rouge: make("rouge"), vert: make("vert") };
}

function copyPawns(pawns: Record<PawnId, Pawn>): Record<PawnId, Pawn> {
  const copy = {} as Record<PawnId, Pawn>;
  for (const id of Object.keys(pawns) as PawnId[]) copy[id] = { ...pawns[id] };
  return copy;
}

/** What `seat` may know of `state`. Every field is a copy: the view shares nothing with the state. */
export function viewFor(state: GameState, seat: Color): PlayerView {
  return {
    kind: "view",
    seat,
    pawns: copyPawns(state.pawns),
    hand: state.hands[seat].slice(),
    handSizes: perColor((color) => state.hands[color].length),
    talonSize: state.talon.length,
    discard: state.discard.slice(),
    lastPlayed: { ...state.lastPlayed },
    posed: perColor((color) => state.posed[color].slice()),
    dealer: state.dealer,
    dealIndex: state.dealIndex,
    dealsPlayed: state.dealsPlayed,
    turn: state.turn,
    phase: state.phase,
    given: state.given[seat],
    received: state.received[seat],
    hasGiven: perColor((color) => state.given[color] !== null),
    captures: { ...state.captures },
    winner: state.winner,
    rules: { ...state.rules },
  };
}
