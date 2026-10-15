// Level 5, the Champion (D-04, 03-RESEARCH Pattern 5): a flat Monte-Carlo search over the deals it can
// imagine from its own view (perfect-information Monte-Carlo, one level deep).
// 1. Its candidates are scored by the shared evaluation (evaluate.ts scoreCandidates); the best
//    CHAMPION_KEEP are kept, and every capture of an opponent and every home entry on top of them.
// 2. Until the budget is spent: one imagined deal is drawn from the view (determinize.ts). Each kept
//    candidate is played in that same deal, then every seat, the partner included, plays the noiseless
//    policy (the best scored move of its own view of the imagined deal) for CHAMPION_PLIES plies,
//    stopping at the end of the deal or of the game. The board is scored for the bot's team (± a large
//    constant for a game won or lost) and added to the candidate's running mean. Every candidate is
//    judged on the same deals: the policy draws no random number, so the deal alone fixes the rollout
//    (common random numbers).
// 3. result(): the candidate with the best mean (ties to the better static score), the static best
//    before the first deal.
// The work is counted in units (one apply plus one policy call; the candidate's own apply is one unit),
// never in time: a deal is started only when its whole cost still fits, so the total never exceeds the
// budget, and the same (view, rng, budget) gives the same move however the host slices the steps.
// Pure, no I/O, erasable syntax only.

import {
  type Action,
  apply,
  type Color,
  type PawnId,
  type PlayerView,
  pawnColor,
  type Rng,
  type Team,
  teamOf,
  viewFor,
} from "@toc/engine";
import { determinize, type World } from "./determinize.ts";
import { evaluate, type ScoredCandidate, scoreCandidates } from "./evaluate.ts";
import { type Budget, CHAMPION_KEEP, CHAMPION_PLIES } from "./levels.ts";

/** A game won (or lost) at the end of a rollout outweighs any board. */
export const GAME_WON = 10_000;
/** The score gap (evaluation units) from which a choice no longer counts as close (thinker.ts too). */
const CLOSE_GAP = 30;
/** log2 of the number of options at which a choice is as broad as it gets. */
const BROAD_LOG2 = 4;

export type SearchParams = { keep: number; plies: number };

/** The Champion's decision so far: the same shape as thinker.ts's Thought. */
export type SearchThought = {
  action: Action;
  rng: Rng;
  difficulty: number;
  candidates: number;
  units: number;
};

export type Search = {
  /** Runs at least `units` more work when the budget allows; true when the budget is spent. */
  step(units: number): boolean;
  /** Always valid: the best mean so far, the static best before the first deal. */
  result(): SearchThought;
};

/** True when `candidate` brings a knight of any colour into its home. */
function entersHome(view: PlayerView, candidate: ScoredCandidate): boolean {
  for (const id of Object.keys(candidate.pawns) as PawnId[]) {
    if (candidate.pawns[id].zone === "home" && view.pawns[id].zone !== "home") return true;
  }
  return false;
}

/** The kept candidates: the best `keep` by static score, plus every capture of an opponent and entry. */
function keptCandidates(
  view: PlayerView,
  seat: Color,
  scored: readonly ScoredCandidate[],
  keep: number,
): ScoredCandidate[] {
  const team = teamOf(seat);
  return scored.filter(
    (candidate, rank) =>
      rank < keep ||
      candidate.captured.some((id) => teamOf(pawnColor(id)) !== team) ||
      entersHome(view, candidate),
  );
}

/** The board of a finished rollout as `team` sees it, ± GAME_WON for a game over. */
function worldScore(world: World, team: Team): number {
  const board = evaluate(world.pawns, world.rules, team);
  if (world.phase !== "won" || world.winner === null) return board;
  return board + (world.winner === team ? GAME_WON : -GAME_WON);
}

/**
 * Plays `action` for `seat` in `world`, then up to `plies` plies of the noiseless policy, stopping at the
 * end of the deal or of the game. Returns the score for the seat's team and the units spent.
 */
function rollout(
  world: World,
  seat: Color,
  action: Action,
  plies: number,
): [score: number, units: number] {
  let state = apply(world, seat, action).state;
  let units = 1;
  for (let ply = 0; ply < plies; ply++) {
    if (state.phase !== "play" || state.dealsPlayed !== world.dealsPlayed) break;
    const mover = state.turn;
    const best = scoreCandidates(viewFor(state, mover), mover)[0];
    if (best === undefined) break;
    state = apply(state, mover, best.action).state;
    units++;
  }
  return [worldScore(state, teamOf(seat)), units];
}

function difficultyOf(options: number, gap: number): number {
  if (options <= 1) return 0;
  const breadth = Math.min(1, Math.log2(options) / BROAD_LOG2);
  return breadth * (1 - Math.min(1, gap / CLOSE_GAP));
}

/** The index of the best value (ties to the first) and the gap to the second best. */
function bestOf(values: readonly number[]): [index: number, gap: number] {
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if ((values[i] as number) > (values[best] as number)) best = i;
  }
  let second = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < values.length; i++) {
    if (i !== best && (values[i] as number) > second) second = values[i] as number;
  }
  return [best, Number.isFinite(second) ? (values[best] as number) - second : 0];
}

/**
 * The search of `seat` (in the play phase, on its turn) from `view`, drawing its imagined deals with
 * `rng`, within `budget`. Neither the view nor the rng is modified.
 */
export function createSearch(
  view: PlayerView,
  seat: Color,
  rng: Rng,
  budget: Budget,
  params: SearchParams = { keep: CHAMPION_KEEP, plies: CHAMPION_PLIES },
): Search {
  const scored = scoreCandidates(view, seat);
  const first = scored[0];
  if (first === undefined) throw new Error(`createSearch: ${seat} has no action to play`);
  const kept = scored.length === 1 ? [first] : keptCandidates(view, seat, scored, params.keep);
  const statics = kept.map((candidate) => candidate.score);
  const worldCost = kept.length * (1 + params.plies);
  const sums = kept.map(() => 0);

  let r: Rng = [rng[0], rng[1], rng[2], rng[3]];
  let spent = 0;
  let worlds = 0;
  let world: World | null = null;
  let partial: number[] = [];

  const spentOut = (): boolean =>
    kept.length === 1 || (world === null && spent + worldCost > budget.plies);

  return {
    step(units) {
      let done = 0;
      while (done < units && !spentOut()) {
        if (world === null) {
          [world, r] = determinize(view, seat, r);
          partial = [];
        }
        const candidate = kept[partial.length] as ScoredCandidate;
        const [score, used] = rollout(world, seat, candidate.action, params.plies);
        partial.push(score);
        spent += used;
        done += used;
        if (partial.length === kept.length) {
          for (let i = 0; i < kept.length; i++)
            sums[i] = (sums[i] as number) + (partial[i] as number);
          worlds++;
          world = null;
        }
      }
      return spentOut();
    },
    result() {
      if (kept.length === 1) {
        return { action: first.action, rng: [...rng], difficulty: 0, candidates: 1, units: 0 };
      }
      const values = worlds === 0 ? statics : sums.map((sum) => sum / worlds);
      const [index, gap] = bestOf(values);
      const chosen = kept[index] ?? first;
      return {
        action: chosen.action,
        rng: [r[0], r[1], r[2], r[3]],
        difficulty: difficultyOf(kept.length, gap),
        candidates: scored.length,
        units: spent,
      };
    },
  };
}
