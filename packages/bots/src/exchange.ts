// The exchange card (D-09, 03-RESEARCH Pattern 7): the bot gives what helps its partner most, judged on
// public information only (D-10). For each card in hand (one per rank: two cards of a rank are worth
// the same), the score is
//   partnerGain − GIVE_OWN_LOSS × ownLoss
// where partnerGain is the best evaluation gain among the partner's moves of that card on the current
// board (movesForCard for PARTNER[seat], sevenOutcomes for a 7) and ownLoss the same for the bot itself.
// A card with no move gains nothing. movesForCard follows controlledPawns, so a partner who has finished
// is credited with moving the bot's own knights (R-15).
// The partner's hand is never read: the score uses the view's board and the bot's own hand only.
// Pure, no I/O, erasable syntax only.

import {
  type Board,
  type CardId,
  type Color,
  movesForCard,
  PARTNER,
  type PlayerView,
  rankOf,
  resolveMove,
  sevenOutcomes,
  type Team,
  teamOf,
} from "@toc/engine";
import { evaluate } from "./evaluate.ts";

/** How much the bot's own use of a card weighs against the partner's (λ). */
export const GIVE_OWN_LOSS = 0.6;

export type GiveScore = { card: CardId; score: number };

/** The best evaluation gain for `team` among the moves of `card` by `mover` on `board`; 0 without any. */
function bestGain(board: Board, mover: Color, card: CardId, team: Team): number {
  const base = evaluate(board.pawns, board.rules, team);
  let best: number | null = null;
  if (rankOf(card) === 7) {
    for (const outcome of sevenOutcomes(board, mover, card)) {
      const gain = evaluate(outcome.pawns, board.rules, team) - base;
      if (best === null || gain > best) best = gain;
    }
  } else {
    for (const candidate of movesForCard(board, mover, card)) {
      const { pawns } = resolveMove(board, mover, candidate.action);
      const gain = evaluate(pawns, board.rules, team) - base;
      if (best === null || gain > best) best = gain;
    }
  }
  return best ?? 0;
}

/**
 * The score of each card `seat` may give, in hand order, the first card of each rank only. Reads the
 * view's board and hand, nothing else.
 */
export function giveScores(view: PlayerView, seat: Color): GiveScore[] {
  const team = teamOf(seat);
  const board: Board = { pawns: view.pawns, rules: view.rules };
  const ranks = new Set<number>();
  const out: GiveScore[] = [];
  for (const card of view.hand) {
    const rank = rankOf(card);
    if (ranks.has(rank)) continue;
    ranks.add(rank);
    const partnerGain = bestGain(board, PARTNER[seat], card, team);
    const ownLoss = bestGain(board, seat, card, team);
    out.push({ card, score: partnerGain - GIVE_OWN_LOSS * ownLoss });
  }
  return out;
}
