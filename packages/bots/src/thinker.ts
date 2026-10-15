// The single entry point of every computer level (03-RESEARCH Pattern 1). The bot is given a PlayerView
// (kind "view"), its seat, its level and an sfc32 rng, and returns its action with the rng advanced, like
// randomLegal. A GameState, which carries every hand, is a type error (BOT-04, D-10): the bot decides
// from what a human in its seat would know.
// - level 1: randomLegal, unchanged (BOT-02);
// - levels 2 to 5: every distinct candidate (candidates.ts) is scored with the team evaluation, then
//   picked through the noise of the level (levels.ts): an epsilon chance of a uniform pick, otherwise a
//   softmax of temperature T over the scores (T 0: the best score, ties to the first);
// - exchange phase: the give of randomLegal at every level (plan 03-02 adds the choice of D-09).
// Work is counted in units (Budget), never in time, so the same inputs give the same move on every
// machine and inside the Durable Object of phase 2. Levels 1 to 5 finish in their first step here;
// plan 03-04 makes level 5 anytime.
// Pure, no I/O, erasable syntax only.

import { type Action, type Color, next, type PlayerView, type Rng, teamOf } from "@toc/engine";
import { candidatesFor } from "./candidates.ts";
import { evaluate } from "./evaluate.ts";
import { type BotLevel, LEVEL_PARAMS } from "./levels.ts";
import { randomLegal } from "./randomLegal.ts";

/** Work, not time: one unit = one apply and one policy call inside a search (level 5, plan 03-04). */
export type Budget = { plies: number };

/**
 * A decision: the action, the rng after it, how hard the choice was (0 to 1), how many options, and the
 * work spent in units (levels 1 to 4: one unit per candidate scored; plan 03-04 counts level 5's
 * rollout plies). The ladder reports the units of each side.
 */
export type Thought = {
  action: Action;
  rng: Rng;
  difficulty: number;
  candidates: number;
  units: number;
};

export type Thinker = {
  /** Runs up to `units` more work; true when the decision is final. */
  step(units: number): boolean;
  /** Always valid, also before the search is finished (anytime). */
  result(): Thought;
};

/** The score gap (evaluation units) from which a choice no longer counts as close. */
const CLOSE_GAP = 30;
/** log2 of the number of options at which a choice is as broad as it gets. */
const BROAD_LOG2 = 4;

/**
 * How hard a choice is, from 0 to 1: broad (many options) and close (the two best are near each other).
 * The pace of plan 03-05 reads it.
 */
function difficultyOf(options: number, gap: number): number {
  if (options <= 1) return 0;
  const breadth = Math.min(1, Math.log2(options) / BROAD_LOG2);
  return breadth * (1 - Math.min(1, gap / CLOSE_GAP));
}

/** The index the noise of the level picks among `scores` (at least two). */
function pickIndex(scores: readonly number[], level: BotLevel, rng: Rng): [number, Rng] {
  const { epsilon, temperature } = LEVEL_PARAMS[level];
  let u: number;
  let r: Rng;
  [u, r] = next(rng);
  if (u < epsilon) {
    [u, r] = next(r);
    return [Math.min(scores.length - 1, Math.floor(u * scores.length)), r];
  }
  let best = 0;
  for (let i = 1; i < scores.length; i++) {
    if ((scores[i] as number) > (scores[best] as number)) best = i;
  }
  if (temperature <= 0) return [best, r];

  const top = scores[best] as number;
  const weights = scores.map((score) => Math.exp((score - top) / temperature));
  const total = weights.reduce((sum, w) => sum + w, 0);
  [u, r] = next(r);
  let target = u * total;
  for (let i = 0; i < weights.length; i++) {
    target -= weights[i] as number;
    if (target < 0) return [i, r];
  }
  return [weights.length - 1, r];
}

/** The decision of a level from 1 to 5, computed in one go. */
function decide(view: PlayerView, seat: Color, level: BotLevel, rng: Rng): Thought {
  if (view.phase !== "play") {
    // The exchange (and a won game, where randomLegal reports there is nothing to play).
    const [action, after] = randomLegal(view, seat, rng);
    const options = new Set(view.hand).size;
    return {
      action,
      rng: after,
      difficulty: difficultyOf(options, 0),
      candidates: options,
      units: options,
    };
  }

  const candidates = candidatesFor(view, seat);
  const scores = candidates.map((c) => evaluate(c.pawns, view.rules, teamOf(seat)));
  const sorted = [...scores].sort((a, b) => b - a);
  const gap = sorted.length > 1 ? (sorted[0] as number) - (sorted[1] as number) : 0;
  const difficulty = difficultyOf(candidates.length, gap);
  const units = candidates.length;

  if (level === 1) {
    const [action, after] = randomLegal(view, seat, rng);
    return { action, rng: after, difficulty, candidates: candidates.length, units };
  }
  const only = candidates[0];
  if (only === undefined) throw new Error(`chooseAction: ${seat} has no action to play`);
  if (candidates.length === 1) {
    return { action: only.action, rng: [...rng], difficulty: 0, candidates: 1, units };
  }
  const [index, after] = pickIndex(scores, level, rng);
  const chosen = candidates[index] ?? only;
  return { action: chosen.action, rng: after, difficulty, candidates: candidates.length, units };
}

/**
 * The anytime form of the bot, for hosts that slice the work (the browser runner of plan 03-05).
 * Takes a PlayerView only. Neither the view nor the rng is modified.
 */
export function createThinker(
  view: PlayerView,
  seat: Color,
  level: BotLevel,
  rng: Rng,
  _budget?: Budget,
): Thinker {
  const start: Rng = [rng[0], rng[1], rng[2], rng[3]];
  let thought: Thought | null = null;
  const result = (): Thought => {
    thought ??= decide(view, seat, level, start);
    return thought;
  };
  return {
    step(_units) {
      result();
      return true;
    },
    result,
  };
}

/** Synchronous: tests, the ladder, the controller, and later the Durable Object. */
export function chooseAction(
  view: PlayerView,
  seat: Color,
  level: BotLevel,
  rng: Rng,
  budget?: Budget,
): Thought {
  const thinker = createThinker(view, seat, level, rng, budget);
  while (!thinker.step(256)) {
    // Each step runs more of the budget; the levels of this plan finish in the first.
  }
  return thinker.result();
}
