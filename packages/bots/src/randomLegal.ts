// Level-1 bot: a uniformly random legal move, chosen from the bot's own view only.
// The parameter is a PlayerView (kind 'view'), so a GameState (which carries every hand) is a type error.
// Pure: the random numbers come from the sfc32 state passed in and returned, never from a global source.

import {
  type Action,
  type CardId,
  type Color,
  legalActions,
  next as nextRandom,
  nextSteps,
  normalizePlan,
  type PawnId,
  type PlayerView,
  playability,
  type Rng,
  rankOf,
  type SevenPlan,
} from "@toc/engine";

/** One element of `xs`, uniformly. */
function pick<T>(xs: readonly T[], rng: Rng): [T, Rng] {
  const [u, after] = nextRandom(rng);
  const item = xs[Math.min(xs.length - 1, Math.floor(u * xs.length))];
  if (item === undefined) throw new Error("randomLegal: nothing to choose from");
  return [item, after];
}

/** A random 7: repeatedly one pawn among those nextSteps offers, then one of its step counts, until 7 are placed. */
function randomSeven(view: PlayerView, seat: Color, card: CardId, rng: Rng): [Action, Rng] {
  let plan: SevenPlan = [];
  let placed = 0;
  let r = rng;
  while (placed < 7) {
    const offers = nextSteps(view, seat, card, plan);
    const pawns = (Object.keys(offers) as PawnId[]).filter((id) => (offers[id] ?? []).length > 0);
    if (pawns.length === 0) throw new Error("randomLegal: the 7 cannot be completed");
    let pawn: PawnId;
    let steps: number;
    [pawn, r] = pick(pawns, r);
    [steps, r] = pick(offers[pawn] ?? [], r);
    plan = normalizePlan([...plan, { pawn, steps }]);
    placed = plan.reduce((sum, entry) => sum + entry.steps, 0);
  }
  return [{ t: "seven", card, plan }, r];
}

/**
 * The action of a level-1 bot: exchange a random card, play a random playable card in a random legal way
 * (a 7 is split by a random walk), or discard when the hand is dead. Returns the action and the new rng.
 */
export function randomLegal(view: PlayerView, seat: Color, rng: Rng): [Action, Rng] {
  // The 7 is left out of this list on purpose: its plans can number in the tens of thousands.
  const open = legalActions(view, seat, { sevenPlans: "none" });
  const first = open[0];
  if (first === undefined && !view.hand.some((card) => rankOf(card) === 7)) {
    throw new Error(`randomLegal: ${seat} has no action to play`);
  }
  if (first !== undefined && first.t === "give") return pick(open, rng);
  if (first !== undefined && first.t === "discard") return [first, rng];

  // Play phase: the playable cards, in hand order, each once.
  const table = playability(view, seat);
  const cards = [...new Set(view.hand)].filter((card) => table[card]?.playable === true);
  if (cards.length === 0) throw new Error(`randomLegal: ${seat} has no playable card`);
  const [card, r] = pick(cards, rng);
  if (rankOf(card) === 7) return randomSeven(view, seat, card, r);
  const own = open.filter((action) => action.t !== "discard" && action.card === card);
  return pick(own, r);
}
