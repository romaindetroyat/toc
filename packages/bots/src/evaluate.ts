// The team evaluation of a board (D-08: « rentrer ses chevaux, manger les adversaires, se protéger,
// aider le partenaire »), shared by every level from 2 to 5 (D-05, D-06). The partner's knights count
// exactly like the seat's own (a finished player plays his partner's knights, R-15); every opponent
// knight counts against. Captures need no term of their own: an eaten knight loses its value.
// Plan 03-02 adds the risk term (« se protéger ») and the hand terms.
// Pure, no I/O, erasable syntax only.

import {
  ALL_PAWNS,
  ENTRY,
  type Pawn,
  type PawnId,
  pawnColor,
  RING,
  type RuleSet,
  ringIndex,
  type Team,
  teamOf,
} from "@toc/engine";

/** A knight in its home. */
export const HOME_VALUE = 100;
/** Per home slot: a deeper slot leaves the shallower ones free for the knights still to come. */
export const HOME_SLOT_VALUE = 2;
/** A knight out of its stable, on the ring (it makes the As and Roi exits worth playing). */
export const OUT_VALUE = 20;
/** Progress is measured as this minus the steps left to the knight's carré 16. */
export const PROGRESS_SPAN = 70;
/** A knight in its stable. */
export const STABLE_VALUE = 0;

/**
 * Steps from a knight's cell to its colour's carré 16 (the entry square), going forward. Under G14 a
 * knight backed up 4 behind its exit is 2 steps from it, so the « trick of the 4 » is valued by itself.
 */
export function distanceToEntry(id: PawnId, progress: number): number {
  const color = pawnColor(id);
  return (ENTRY[color] - ringIndex(color, progress) + RING) % RING;
}

/** The worth of one knight, whatever its team. */
export function knightValue(id: PawnId, pawn: Pawn): number {
  switch (pawn.zone) {
    case "home":
      return HOME_VALUE + HOME_SLOT_VALUE * pawn.slot;
    case "ring":
      return OUT_VALUE + PROGRESS_SPAN - distanceToEntry(id, pawn.progress);
    case "stable":
      return STABLE_VALUE;
  }
}

/**
 * The board as `team` sees it: the sum of its eight knights minus the sum of the eight opponents.
 * `rules` is taken now so the risk term of plan 03-02 reads the rules in force, never the constants.
 */
export function evaluate(pawns: Record<PawnId, Pawn>, _rules: RuleSet, team: Team): number {
  let score = 0;
  for (const id of ALL_PAWNS) {
    const value = knightValue(id, pawns[id]);
    score += teamOf(pawnColor(id)) === team ? value : -value;
  }
  return score;
}
