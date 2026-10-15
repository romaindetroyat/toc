// The distinct candidates of a seat in the play phase, each with the board it leads to
// (03-RESEARCH Pattern 2). The bots score boards, not plans: a 7 that has thousands of plans is a
// handful of candidates, one per distinct end board.
// - the cards other than the 7: legalActions (without the 7's plans), each resolved with resolveMove;
// - the 7: one candidate per distinct end board (sevenPlans then applyPlan, the first plan kept);
// - the discard alone when the hand is dead (nothing else, the 7 included, can be played);
// - two cards of the same rank that end on the same board are one candidate, the first in hand order.
// Every legality decision is the engine's (movesForCard, sevenPlans with G16, legalActions).
// Pure, no I/O, erasable syntax only.

import {
  type Action,
  ALL_PAWNS,
  applyPlan,
  type CardId,
  type Color,
  legalActions,
  type Pawn,
  type PawnId,
  type PlayerView,
  rankOf,
  resolveMove,
  sevenPlans,
} from "@toc/engine";

export type BotCandidate = {
  action: Action;
  /** The pawns after the action (a fresh object: the view is never touched). */
  pawns: Record<PawnId, Pawn>;
  captured: PawnId[];
};

/** One string per board: equal strings, equal boards. */
export function pawnsKey(pawns: Record<PawnId, Pawn>): string {
  let key = "";
  for (const id of ALL_PAWNS) {
    const pawn = pawns[id];
    key +=
      pawn.zone === "stable" ? "s," : pawn.zone === "home" ? `h${pawn.slot},` : `${pawn.progress},`;
  }
  return key;
}

/** The distinct end boards of a 7, each with the first plan that reaches it. */
function sevenCandidates(view: PlayerView, seat: Color, card: CardId): BotCandidate[] {
  const out: BotCandidate[] = [];
  const seen = new Set<string>();
  for (const plan of sevenPlans(view, seat, card)) {
    const result = applyPlan(view, seat, card, plan);
    if (!result.ok) continue;
    const key = pawnsKey(result.pawns);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      action: { t: "seven", card, plan: result.plan },
      pawns: result.pawns,
      captured: result.captured,
    });
  }
  return out;
}

/**
 * The candidates of `seat` on its turn of the play phase, in a deterministic order (hand order, then
 * the engine's order). [] outside its turn.
 */
export function candidatesFor(view: PlayerView, seat: Color): BotCandidate[] {
  if (view.phase !== "play" || view.turn !== seat) return [];
  const open = legalActions(view, seat, { sevenPlans: "none" });
  if (open.length === 1 && open[0]?.t === "discard") {
    return [{ action: { t: "discard" }, pawns: { ...view.pawns }, captured: [] }];
  }

  const out: BotCandidate[] = [];
  const seen = new Set<string>();
  let sevenDone = false;
  for (const card of view.hand) {
    const rank = rankOf(card);
    let found: BotCandidate[];
    if (rank === 7) {
      // The plans of a 7 do not depend on which 7 it is: the first in hand order stands for all.
      if (sevenDone) continue;
      sevenDone = true;
      found = sevenCandidates(view, seat, card);
    } else {
      found = open
        .filter((action) => action.t !== "discard" && action.t !== "give" && action.card === card)
        .map((action): BotCandidate => {
          const { pawns, captured } = resolveMove(view, seat, action);
          return { action, pawns, captured };
        });
    }
    for (const candidate of found) {
      const key = `${rank}|${pawnsKey(candidate.pawns)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(candidate);
    }
  }
  return out;
}
