// legalActions and playability: what a seat may do now, and why a card cannot be played
// (RULES.md R-04, R-05, R-14). Every movement candidate comes from movesForCard, which uses walk().
// Pure, no I/O, erasable syntax only.

import { controlledPawns, movesForCard } from "./moves.ts";
import { canPlaySeven, sevenPlans } from "./seven.ts";
import type { Color } from "./topology.ts";
import type { Action, CardId, GameState, PlayerView, Reason } from "./types.ts";
import { rankOf } from "./types.ts";

export type Playability = { playable: true } | { playable: false; reason: Reason };

/** `sevenPlans: 'none'` leaves the (many) plans of the 7 out, for callers that only need the other cards. */
export type LegalOpts = { sevenPlans?: "all" | "none" };

/** The cards `seat` holds, as far as `source` lets the caller know (a view knows its own hand only). */
function handOf(source: GameState | PlayerView, seat: Color): CardId[] {
  if (source.kind === "state") return source.hands[seat];
  return source.seat === seat ? source.hand : [];
}

/**
 * The actions open to `seat`, in a deterministic order: hand order, then pawn order (colour, index),
 * then target id.
 * - exchange phase: one give per card, until the seat has given;
 * - play phase, seat's turn: the movements of every card of the hand, every plan of each 7 (unless
 *   opts.sevenPlans is 'none'); the discard (dead hand) only when nothing else, the 7 included, can be
 *   played, so playing a playable card is mandatory (RULE-04, RULE-16);
 * - nothing for a seat whose hand is empty or laid down, or once the game is won (RULE-18).
 */
export function legalActions(
  source: GameState | PlayerView,
  seat: Color,
  opts: LegalOpts = {},
): Action[] {
  if (source.phase === "won") return [];
  const hand = handOf(source, seat);
  if (hand.length === 0) return [];

  if (source.phase === "exchange") {
    const given = source.kind === "state" ? source.given[seat] !== null : source.hasGiven[seat];
    if (given) return [];
    return [...new Set(hand)].map((card): Action => ({ t: "give", card }));
  }

  if (source.turn !== seat) return [];
  const sevens = hand.filter((card) => rankOf(card) === 7);
  const withPlans = (opts.sevenPlans ?? "all") === "all";
  // The plans of a 7 do not depend on which 7 it is: enumerate them once.
  const plans = withPlans && sevens.length > 0 ? sevenPlans(source, seat, sevens[0] as CardId) : [];
  const moves = hand.flatMap((card): Action[] =>
    rankOf(card) === 7
      ? plans.map((plan): Action => ({ t: "seven", card, plan }))
      : movesForCard(source, seat, card).map((c) => c.action),
  );
  if (moves.length > 0) return moves;
  // No plan listed: either the caller left them out or the 7 cannot be played; the discard is for the latter.
  if (sevens.length > 0 && canPlaySeven(source, seat)) return moves;
  return [{ t: "discard" }];
}

/** Why `card` cannot be played, with UI-SPEC codes. Called only when the card has no candidate. */
function reasonFor(view: PlayerView, seat: Color, card: CardId): Reason {
  const rank = rankOf(card);
  if (rank === 11) return "jack-no-target";
  // The 7 is played in full or not at all: a protected pawn may be the only obstacle.
  if (rank === 7) {
    return canPlaySeven(view, seat, { ignoreProtection: true })
      ? "blocked-protected"
      : "seven-incomplete";
  }
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
    const playable =
      rankOf(card) === 7 ? canPlaySeven(view, seat) : movesForCard(view, seat, card).length > 0;
    table[card] = playable
      ? { playable: true }
      : { playable: false, reason: reasonFor(view, seat, card) };
  }
  return table;
}
