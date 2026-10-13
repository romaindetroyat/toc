// legalActions and playability: what a seat may do now, and why a card cannot be played
// (RULES.md R-04, R-05, R-14). Every movement candidate comes from movesForCard, which uses walk().
// Pure, no I/O, erasable syntax only.

import { controlledPawns, movesForCard } from "./moves.ts";
import type { Color } from "./topology.ts";
import type { Action, CardId, GameState, PlayerView, Reason } from "./types.ts";
import { rankOf } from "./types.ts";

export type Playability = { playable: true } | { playable: false; reason: Reason };

/** The cards `seat` holds, as far as `source` lets the caller know (a view knows its own hand only). */
function handOf(source: GameState | PlayerView, seat: Color): CardId[] {
  if (source.kind === "state") return source.hands[seat];
  return source.seat === seat ? source.hand : [];
}

/**
 * The actions open to `seat`, in a deterministic order: hand order, then pawn order (colour, index),
 * then target id.
 * - exchange phase: one give per card, until the seat has given;
 * - play phase, seat's turn: the movements of every card of the hand; the discard (dead hand) only when
 *   nothing else is legal, so playing a playable card is mandatory (RULE-04, RULE-16);
 * - nothing for a seat whose hand is empty or laid down, or once the game is won (RULE-18).
 */
export function legalActions(source: GameState | PlayerView, seat: Color): Action[] {
  if (source.phase === "won") return [];
  const hand = handOf(source, seat);
  if (hand.length === 0) return [];

  if (source.phase === "exchange") {
    const given = source.kind === "state" ? source.given[seat] !== null : source.hasGiven[seat];
    if (given) return [];
    return [...new Set(hand)].map((card): Action => ({ t: "give", card }));
  }

  if (source.turn !== seat) return [];
  const moves = hand.flatMap((card) => movesForCard(source, seat, card).map((c) => c.action));
  return moves.length > 0 ? moves : [{ t: "discard" }];
}

/** Why `card` cannot be played, with UI-SPEC codes. Called only when the card has no candidate. */
function reasonFor(view: PlayerView, seat: Color, card: CardId): Reason {
  const rank = rankOf(card);
  if (rank === 11) return "jack-no-target";
  // The 7 has no candidate before plan 01-13 (A-12): it falls through to the generic reason.
  if (movesForCard(view, seat, card, { ignoreProtection: true }).length > 0) {
    return "blocked-protected";
  }
  const hasStable = controlledPawns(view, seat).some((id) => view.pawns[id].zone === "stable");
  if ((rank === 1 || rank === 13) && hasStable) return "no-pawn-to-exit";
  return "no-pawn-can-move";
}

/** For each card of the viewer's hand: playable, or the reason it is not. */
export function playability(view: PlayerView, seat: Color): Record<CardId, Playability> {
  const table = {} as Record<CardId, Playability>;
  for (const card of handOf(view, seat)) {
    table[card] =
      movesForCard(view, seat, card).length > 0
        ? { playable: true }
        : { playable: false, reason: reasonFor(view, seat, card) };
  }
  return table;
}
