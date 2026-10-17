// The render state: everything the board, the felt and the info bar draw, as a pure fold of engine events
// (RESEARCH Pattern 5). The Director folds it event by event while it animates, and at once for the
// fast-forward after a tab was hidden or a reconnection; renderOf(view) is the same state projected
// straight from a PlayerView, and the property test proves the two agree.
// It carries public information only: hands are sizes, never cards (handDealt and cardsExchanged change
// sizes and phase, nothing else).
// Pure, no I/O, erasable syntax only.

import type { GameEvent } from "./events.ts";
import { homeCount } from "./moves.ts";
import { placeOf } from "./path.ts";
import { firstPlayer } from "./state.ts";
import {
  COLORS,
  type Color,
  type PawnId,
  type Place,
  pawnColor,
  type Team,
  teamOf,
} from "./topology.ts";
import type { CardId, Phase, PlayerView } from "./types.ts";

export type RenderState = {
  /** Where every pawn is drawn: its stable slot, a ring cell or a home slot. */
  pawns: Record<PawnId, Place>;
  /** Last card each seat played, shown on the felt in front of the seat. */
  lastPlayed: Record<Color, CardId | null>;
  /** Dead hands laid face up on the felt. */
  posed: Record<Color, CardId[]>;
  talonSize: number;
  discardSize: number;
  handSizes: Record<Color, number>;
  dealer: Color;
  dealIndex: 0 | 1 | 2;
  turn: Color;
  /** Pawns in each colour's home (4 triggers the party). */
  homeCounts: Record<Color, number>;
  /** Pawns eaten so far, per team. */
  captures: Record<Team, number>;
  phase: Phase;
  winner: Team | null;
};

function perColor<T>(make: (color: Color) => T): Record<Color, T> {
  return { bleu: make("bleu"), jaune: make("jaune"), rouge: make("rouge"), vert: make("vert") };
}

/** The render state of a view: what the seat sees of the board, the felt and the piles. */
export function renderOf(view: PlayerView): RenderState {
  const pawns = {} as Record<PawnId, Place>;
  for (const color of COLORS) {
    for (const index of [0, 1, 2, 3] as const) {
      const id: PawnId = `${color}${index}`;
      pawns[id] = placeOf(id, view.pawns[id]);
    }
  }
  return {
    pawns,
    lastPlayed: { ...view.lastPlayed },
    posed: perColor((color) => view.posed[color].slice()),
    talonSize: view.talonSize,
    discardSize: view.discard.length,
    handSizes: { ...view.handSizes },
    dealer: view.dealer,
    dealIndex: view.dealIndex,
    turn: view.turn,
    homeCounts: perColor((color) => homeCount(view.pawns, color)),
    captures: { ...view.captures },
    phase: view.phase,
    winner: view.winner,
  };
}

/** The initial render state: the first view of a game (or the view a client joins with). */
export function renderInit(view: PlayerView): RenderState {
  return renderOf(view);
}

const posedTotal = (posed: Record<Color, CardId[]>): number =>
  COLORS.reduce((sum, color) => sum + posed[color].length, 0);

/**
 * Applies one engine event, using public information only. Returns a new state; the input is untouched.
 * The deal events carry the structure: `reshuffled` gathers the 52 cards into the talon, `dealt` moves
 * the felt cards to the discard pile and opens the exchange (the player after the dealer starts, G9),
 * `handDealt` takes cards from the talon into one hand.
 */
export function renderReduce(rs: RenderState, event: GameEvent): RenderState {
  switch (event.t) {
    case "reshuffled":
      return {
        ...rs,
        talonSize: rs.talonSize + rs.discardSize + posedTotal(rs.posed),
        discardSize: 0,
        posed: perColor((): CardId[] => []),
        lastPlayed: perColor((): CardId | null => null),
        dealer: event.dealer,
      };
    case "dealt":
      return {
        ...rs,
        discardSize: rs.discardSize + posedTotal(rs.posed),
        posed: perColor((): CardId[] => []),
        dealer: event.dealer,
        dealIndex: event.dealIndex,
        turn: firstPlayer(event.dealer),
        phase: "exchange",
      };
    case "handDealt":
      return {
        ...rs,
        talonSize: rs.talonSize - event.size,
        handSizes: { ...rs.handSizes, [event.seat]: event.size },
      };
    case "cardsExchanged":
      // Each seat gives one card and receives one: the sizes do not change.
      return { ...rs, phase: "play" };
    case "cardPlayed":
      return {
        ...rs,
        handSizes: { ...rs.handSizes, [event.seat]: rs.handSizes[event.seat] - 1 },
        lastPlayed: { ...rs.lastPlayed, [event.seat]: event.card },
        discardSize: rs.discardSize + 1,
      };
    case "pawnExited":
      return { ...rs, pawns: { ...rs.pawns, [event.pawn]: event.to } };
    case "pawnMoved": {
      const landing = event.path[event.path.length - 1];
      return landing === undefined ? rs : { ...rs, pawns: { ...rs.pawns, [event.pawn]: landing } };
    }
    case "pawnEnteredHome": {
      const color = pawnColor(event.pawn);
      return {
        ...rs,
        pawns: { ...rs.pawns, [event.pawn]: { z: "home", color, slot: event.slot } },
        homeCounts: { ...rs.homeCounts, [color]: event.homeCount },
      };
    }
    case "pawnCaptured": {
      const team = teamOf(pawnColor(event.by));
      return { ...rs, captures: { ...rs.captures, [team]: rs.captures[team] + 1 } };
    }
    case "pawnSentHome":
      return { ...rs, pawns: { ...rs.pawns, [event.pawn]: event.to } };
    case "pawnsSwapped":
      return { ...rs, pawns: { ...rs.pawns, [event.a]: event.aTo, [event.b]: event.bTo } };
    case "handDiscarded":
      return {
        ...rs,
        handSizes: { ...rs.handSizes, [event.seat]: 0 },
        posed: { ...rs.posed, [event.seat]: event.cards.slice() },
      };
    case "turn":
      return { ...rs, turn: event.seat };
    case "gameWon":
      return { ...rs, phase: "won", winner: event.team };
    case "playerFinished":
      // Told by homeCounts (4): the Director marks the partner's pawns as played for him.
      return rs;
  }
}
