import type { Color, PawnId, Place, Team } from "./topology.ts";
import type { CardId } from "./types.ts";

/**
 * Engine events are the only input of rendering, animation and audio, and later of the
 * network protocol (phase 2) and of replay. Each event is self-contained: folding the events
 * over the initial render state gives the same pawns and piles as the state itself.
 */
export type GameEvent =
  /** A deal starts: `size` cards per seat (5, 4 or 4). */
  | { t: "dealt"; dealer: Color; dealIndex: 0 | 1 | 2; size: number }
  /** Private to `seat`: the cards it was dealt. */
  | { t: "handDealt"; seat: Color; cards: CardId[] }
  /** The four exchange choices are applied together; `received` is private per seat. */
  | { t: "cardsExchanged"; received: Record<Color, CardId | null> }
  | { t: "cardPlayed"; seat: Color; card: CardId }
  /** A pawn leaves its stable onto its exit square. */
  | { t: "pawnExited"; pawn: PawnId; to: Place }
  | {
      t: "pawnMoved";
      pawn: PawnId;
      from: Place;
      /** Every cell entered, landing cell last. */
      path: Place[];
      dir: 1 | -1;
    }
  /** `atStep` indexes the attacker's path (0-based); it matters for the 7 where captures happen on the way. */
  | { t: "pawnCaptured"; by: PawnId; victim: PawnId; at: Place; atStep: number }
  /** The eaten pawn goes back to its stable slot. */
  | { t: "pawnSentHome"; pawn: PawnId; to: Place }
  | { t: "pawnsSwapped"; a: PawnId; b: PawnId; aTo: Place; bTo: Place }
  /** `homeCount` is the number of pawns now in the home of that colour (4 triggers the party, D-14). */
  | { t: "pawnEnteredHome"; pawn: PawnId; path: Place[]; slot: 0 | 1 | 2 | 3; homeCount: number }
  /** Dead hand laid face up on the felt. */
  | { t: "handDiscarded"; seat: Color; cards: CardId[] }
  /** All four pawns of `seat` are home; `partner` plays for it from now on. */
  | { t: "playerFinished"; seat: Color; partner: Color }
  /** The cycle of three deals is over: the 52 cards are shuffled again. */
  | { t: "reshuffled"; dealer: Color }
  | { t: "turn"; seat: Color }
  | { t: "gameWon"; team: Team };
