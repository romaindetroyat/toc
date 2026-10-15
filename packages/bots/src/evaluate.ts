// The team evaluation of a board (D-08: « rentrer ses chevaux, manger les adversaires, se protéger,
// aider le partenaire »), shared by every level from 2 to 5 (D-05, D-06), and the scores of a seat's
// candidates.
// - rentrer: a knight home is worth the most, a knight on the ring is worth its progress (70 minus the
//   steps left to its carré 16), a knight out of the stable a little more;
// - manger: no term of its own, an eaten knight loses its value;
// - se protéger: a ring knight within an opponent's reach is worth less (the risk term, 03-RESEARCH
//   Pattern 3); a knight protected on its own exit is safe;
// - aider le partenaire: the partner's knights count exactly like the seat's own (a finished player
//   plays them, R-15), so eating the partner costs what losing one's own knight costs.
// The candidates of the play phase are scored as evaluate(after) + handBonus(the cards kept, after): a
// bot that keeps an As or a Roi while knights wait in the stable, or a 4 for the trick, is credited
// for it. Each weight is a named constant, judged by tools/ladder.mjs (plan 03-02 Task 3, 2026-10-15,
// seed 1, 400 games per step: 2 → 1 92.5 %, 3 → 2 98.3 %, 4 → 3 66.3 %, all above the bar on the
// first run, so these weights were kept; head to head at T = 0 this evaluation beat 03-01's, without
// the risk and hand terms, 305 / 400 = 76.3 %). Re-run the ladder after any change here.
// The risk term approximates reach (no protected knight in the way, no home entry on the way): it is a
// heuristic, never a legality decision (those are the engine's).
// Pure, no I/O, erasable syntax only.

import {
  type Action,
  ALL_PAWNS,
  type CardId,
  COLORS,
  type Color,
  ENTRY,
  EXIT,
  isProtected,
  PARTNER,
  type Pawn,
  type PawnId,
  type PlayerView,
  pawnColor,
  RING,
  type RuleSet,
  rankOf,
  ringIndex,
  type Team,
  teamOf,
} from "@toc/engine";
import { type BotCandidate, candidatesFor } from "./candidates.ts";

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

/** The share of a ring knight's value lost per threat on it (« se protéger »). */
export const RISK_PER_THREAT = 0.1;
/** The most a knight can lose to threats, as a share of its value. */
export const RISK_CAP = 0.9;
/** An opponent knight up to this many cells behind threatens fully (any card up to it, and the 7). */
export const NEAR_REACH = 7;
/** An opponent knight up to this many cells behind threatens with one exact card (the Roi is 13). */
export const FAR_REACH = 13;
/** The weight of a threat from 8 to 13 cells behind: only one exact rank reaches. */
export const FAR_THREAT = 0.5;
/** No card moves 11 cells (the Valet swaps). */
export const NO_REACH = 11;
/** The 4 goes backward: an opponent knight exactly this many cells ahead threatens. */
export const BACKWARD_REACH = 4;
/** Standing on an opponent's exit while that opponent has knights in its stable (As and Roi eat). */
export const EXIT_THREAT = 1;

/** Keeping an As or a Roi while a controlled knight waits in the stable (one per waiting knight). */
export const EXIT_CARD_KEEP = 10;
/** Keeping a 4 while a controlled knight stands where the 4 backward brings it near its carré 16. */
export const FOUR_CARD_KEEP = 10;

/**
 * Steps from a knight's cell to its colour's carré 16 (the entry square), going forward. Under G14 a
 * knight backed up 4 behind its exit is 2 steps from it, so the « trick of the 4 » is valued by itself.
 */
export function distanceToEntry(id: PawnId, progress: number): number {
  const color = pawnColor(id);
  return (ENTRY[color] - ringIndex(color, progress) + RING) % RING;
}

/** The worth of one knight, whatever its team, before any risk. */
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

/** True when a knight of `color` waits in its stable. */
function hasStable(pawns: Record<PawnId, Pawn>, color: Color): boolean {
  for (const index of [0, 1, 2, 3] as const) {
    if (pawns[`${color}${index}`].zone === "stable") return true;
  }
  return false;
}

/**
 * The threats on the ring knight `id` at `cell`: opponent knights behind it within reach, an opponent
 * knight exactly 4 cells ahead, and an opponent's exit it stands on while that opponent can come out.
 * `cells` holds the ring cell of every knight (-1 off the ring).
 */
function threatsOn(
  id: PawnId,
  cell: number,
  pawns: Record<PawnId, Pawn>,
  cells: readonly number[],
): number {
  const team = teamOf(pawnColor(id));
  let threats = 0;
  for (let i = 0; i < ALL_PAWNS.length; i++) {
    const other = ALL_PAWNS[i] as PawnId;
    const at = cells[i] as number;
    if (at < 0 || teamOf(pawnColor(other)) === team) continue;
    const behind = (cell - at + RING) % RING;
    if (behind >= 1 && behind <= NEAR_REACH) threats += 1;
    else if (behind > NEAR_REACH && behind <= FAR_REACH && behind !== NO_REACH) {
      threats += FAR_THREAT;
    }
    if ((at - cell + RING) % RING === BACKWARD_REACH) threats += 1;
  }
  for (const color of COLORS) {
    if (teamOf(color) === team) continue;
    if (EXIT[color] === cell && hasStable(pawns, color)) threats += EXIT_THREAT;
  }
  return threats;
}

/**
 * The board as `team` sees it: the sum of its eight knights minus the sum of the eight opponents, each
 * ring knight less its risk (value × min(RISK_CAP, RISK_PER_THREAT × threats)). Protection reads the
 * rules in force (G3).
 */
export function evaluate(pawns: Record<PawnId, Pawn>, rules: RuleSet, team: Team): number {
  const cells: number[] = [];
  for (const id of ALL_PAWNS) {
    const pawn = pawns[id];
    cells.push(pawn.zone === "ring" ? ringIndex(pawnColor(id), pawn.progress) : -1);
  }
  let score = 0;
  for (let i = 0; i < ALL_PAWNS.length; i++) {
    const id = ALL_PAWNS[i] as PawnId;
    const pawn = pawns[id];
    let value = knightValue(id, pawn);
    const cell = cells[i] as number;
    if (cell >= 0 && !isProtected(id, pawn, rules)) {
      const threats = threatsOn(id, cell, pawns, cells);
      if (threats > 0) value -= value * Math.min(RISK_CAP, RISK_PER_THREAT * threats);
    }
    score += teamOf(pawnColor(id)) === team ? value : -value;
  }
  return score;
}

/** The knights `seat` plays: its own, or its partner's once its own four are home (R-15). */
function controlledIds(pawns: Record<PawnId, Pawn>, seat: Color): PawnId[] {
  const own = ([0, 1, 2, 3] as const).map((index): PawnId => `${seat}${index}`);
  if (own.every((id) => pawns[id].zone === "home")) {
    return ([0, 1, 2, 3] as const).map((index): PawnId => `${PARTNER[seat]}${index}`);
  }
  return own;
}

/** True when the 4 backward brings the ring knight nearer its carré 16 (just past its exit, G14). */
function fourHelps(id: PawnId, pawn: Pawn): boolean {
  if (pawn.zone !== "ring") return false;
  return distanceToEntry(id, pawn.progress - BACKWARD_REACH) < distanceToEntry(id, pawn.progress);
}

/**
 * The worth of the cards `seat` keeps on the board `pawns`: an As or a Roi per controlled knight waiting
 * in the stable, a 4 per controlled knight that the 4 backward brings near its carré 16.
 */
export function handBonus(
  hand: readonly CardId[],
  pawns: Record<PawnId, Pawn>,
  seat: Color,
): number {
  let exits = 0;
  let fours = 0;
  for (const card of hand) {
    const rank = rankOf(card);
    if (rank === 1 || rank === 13) exits++;
    else if (rank === 4) fours++;
  }
  if (exits === 0 && fours === 0) return 0;
  let waiting = 0;
  let tricks = 0;
  for (const id of controlledIds(pawns, seat)) {
    const pawn = pawns[id];
    if (pawn.zone === "stable") waiting++;
    else if (fourHelps(id, pawn)) tricks++;
  }
  return EXIT_CARD_KEEP * Math.min(exits, waiting) + FOUR_CARD_KEEP * Math.min(fours, tricks);
}

/** The hand after `action`: the card played removed (the discard lays the whole hand down). */
function handAfter(hand: readonly CardId[], action: Action): CardId[] {
  if (action.t === "discard") return [];
  if (action.t === "give") return hand.filter((card) => card !== action.card);
  const at = hand.indexOf(action.card);
  return at === -1 ? [...hand] : [...hand.slice(0, at), ...hand.slice(at + 1)];
}

export type ScoredCandidate = BotCandidate & { score: number };

/** The score of one candidate of `seat`: the board after it, plus the cards kept. */
export function scoreOf(view: PlayerView, seat: Color, candidate: BotCandidate): number {
  return (
    evaluate(candidate.pawns, view.rules, teamOf(seat)) +
    handBonus(handAfter(view.hand, candidate.action), candidate.pawns, seat)
  );
}

/**
 * Every candidate of `seat` (candidates.ts) with its score, best first (a stable sort: ties keep the
 * candidates' own order). [] outside its turn of the play phase.
 */
export function scoreCandidates(view: PlayerView, seat: Color): ScoredCandidate[] {
  return candidatesFor(view, seat)
    .map((candidate): ScoredCandidate => ({ ...candidate, score: scoreOf(view, seat, candidate) }))
    .sort((a, b) => b.score - a.score);
}
