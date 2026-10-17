// The single entry point of every computer level (03-RESEARCH Pattern 1). The bot is given a PlayerView
// (kind "view"), its seat, its level and an sfc32 rng, and returns its action with the rng advanced, like
// randomLegal. A GameState, which carries every hand, is a type error (BOT-04, D-10): the bot decides
// from what a human in its seat would know.
// - level 1: randomLegal, unchanged (BOT-02);
// - levels 2 to 5: every distinct candidate (candidates.ts) is scored with the team evaluation and the
//   cards kept (evaluate.ts scoreOf), then picked through the noise of the level (levels.ts): an epsilon
//   chance of a uniform pick, otherwise a softmax of temperature T over the scores (T 0: the best
//   score, ties to the first);
// - exchange phase: level 1 gives like randomLegal; levels 2 to 5 score each card for the partner
//   (exchange.ts giveScores, D-09) and pick through the same noise, level 5 taking the best.
// - level 5 in the play phase: the search over imagined deals (search.ts, D-04), anytime: each step
//   runs more of its budget (levels.ts CHAMPION_BUDGET by default) and result() is valid at any moment.
// Work is counted in units (Budget), never in time, so the same inputs give the same move on every
// machine and inside the Durable Object of phase 2. Levels 1 to 4 (and level 5 outside the play phase)
// finish in their first step.
// Pure, no I/O, erasable syntax only.

import { type Action, type Color, next, type PlayerView, type Rng } from "@toc/engine";
import { candidatesFor } from "./candidates.ts";
import { scoreOf } from "./evaluate.ts";
import { giveScores } from "./exchange.ts";
import { type BotLevel, type Budget, CHAMPION_BUDGET, LEVEL_PARAMS } from "./levels.ts";
import { randomLegal } from "./randomLegal.ts";
import { createSearch, type SearchCheckpoint } from "./search.ts";

export type { Budget } from "./levels.ts";

/**
 * A decision: the action, the rng after it, how hard the choice was (0 to 1), how many options, and the
 * work spent in units (levels 1 to 4 and every exchange: one unit per candidate scored; level 5 in the
 * play phase: its rollout plies, never more than its budget). The ladder reports the units of each side.
 */
export type Thought = {
  action: Action;
  rng: Rng;
  difficulty: number;
  candidates: number;
  units: number;
};

/**
 * Where a think stands, JSON-safe, to resume it in another invocation (the online table's Champion, plan
 * 02-03): the search's checkpoint for level 5 in the play phase, null for every think that finishes in
 * its first step (levels 1 to 4, every exchange).
 */
export type ThinkerCheckpoint = SearchCheckpoint | null;

export type Thinker = {
  /** Runs about `units` more work (never past the budget); true when the decision is final. */
  step(units: number): boolean;
  /** Always valid, also before the search is finished (anytime). */
  result(): Thought;
  /** The think so far as plain JSON (null when there is nothing to resume). */
  checkpoint(): ThinkerCheckpoint;
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

/** The gap between the two best scores (0 with fewer than two). */
function gapOf(scores: readonly number[]): number {
  const sorted = [...scores].sort((a, b) => b - a);
  return sorted.length > 1 ? (sorted[0] as number) - (sorted[1] as number) : 0;
}

/** The exchange card of levels 2 to 5: giveScores through the noise of the level. */
function decideGive(view: PlayerView, seat: Color, level: BotLevel, rng: Rng): Thought {
  const gives = giveScores(view, seat);
  const only = gives[0];
  if (only === undefined) throw new Error(`chooseAction: ${seat} has no card to give`);
  const units = gives.length;
  if (gives.length === 1) {
    return {
      action: { t: "give", card: only.card },
      rng: [...rng],
      difficulty: 0,
      candidates: 1,
      units,
    };
  }
  const scores = gives.map((give) => give.score);
  const [index, after] = pickIndex(scores, level, rng);
  const chosen = gives[index] ?? only;
  return {
    action: { t: "give", card: chosen.card },
    rng: after,
    difficulty: difficultyOf(gives.length, gapOf(scores)),
    candidates: gives.length,
    units,
  };
}

/** The decision of a level from 1 to 5, computed in one go. */
function decide(view: PlayerView, seat: Color, level: BotLevel, rng: Rng): Thought {
  if (view.phase === "exchange" && level !== 1) return decideGive(view, seat, level, rng);
  if (view.phase !== "play") {
    // Level 1's exchange (and a won game, where randomLegal reports there is nothing to play).
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
  const scores = candidates.map((c) => scoreOf(view, seat, c));
  const difficulty = difficultyOf(candidates.length, gapOf(scores));
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
 * The anytime form of the bot, for hosts that slice the work (the browser runner of plan 03-05, the
 * online table's alarms of plan 02-03). Takes a PlayerView only. Neither the view nor the rng is
 * modified. `from` resumes a level-5 play search from its checkpoint (same view, seat, rng and budget);
 * it is ignored by every other think.
 */
export function createThinker(
  view: PlayerView,
  seat: Color,
  level: BotLevel,
  rng: Rng,
  budget?: Budget,
  from?: ThinkerCheckpoint,
): Thinker {
  const start: Rng = [rng[0], rng[1], rng[2], rng[3]];
  if (level === 5 && view.phase === "play") {
    return createSearch(
      view,
      seat,
      start,
      budget ?? CHAMPION_BUDGET,
      undefined,
      from === null ? undefined : from,
    );
  }
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
    checkpoint: () => null,
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
    // Each step runs more of the budget; levels 1 to 4 finish in the first.
  }
  return thinker.result();
}
