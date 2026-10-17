// No cheating (BOT-04, D-10, 03-RESEARCH « Hidden-hand swap property »): what a seat cannot see never
// changes its move. A state S is reached by random legal actions; S' redeals every card hidden from the
// seat to act among the other hands and the talon, with the same sizes, keeping what the seat knows in
// place (the card it passed, in its partner's hand while unplayed; each exchange choice in its giver's
// hand). The seat's view is the same in S and S', and every level from 1 to 5 plays the same Thought.
// A deliberately cheating stub that reads S's hands through a closure fails that very property (the
// negative control), so the property can fail; and handing a GameState to the bot is a type error.

import {
  apply,
  type CardId,
  COLORS,
  type Color,
  type GameState,
  newGame,
  PARTNER,
  type PlayerView,
  type Rng,
  rankOf,
  shuffle,
  sortHand,
  viewFor,
} from "@toc/engine";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { candidatesFor } from "./candidates.ts";
import type { BotLevel } from "./levels.ts";
import { randomLegal } from "./randomLegal.ts";
import { chooseAction, createThinker, type Thought } from "./thinker.ts";

/** The fixed seed of every property here: the samples are the same on every run. */
const PROPERTY_SEED = 20261015;
const RUNS_PER_LEVEL = 100;
/** Level 5 searches with a small budget: the property is about what it reads, not its strength. */
const SMALL_BUDGET = { plies: 40 };

/** The seat that must act: the first seat that has not chosen its exchange card, else the seat to play. */
function actingSeat(state: GameState): Color {
  if (state.phase === "exchange") {
    return COLORS.find((color) => state.given[color] === null) ?? state.turn;
  }
  return state.turn;
}

/** The state after up to `k` random legal actions from a new game (stops before the game is won). */
function reach(seed: Rng, k: number): GameState {
  let state = newGame({ firstDealer: COLORS[(seed[0] >>> 0) % 4] as Color }, seed);
  let rng: Rng = [seed[3], seed[2], seed[1], seed[0]];
  for (let i = 0; i < k; i++) {
    const seat = actingSeat(state);
    const [action, after] = randomLegal(viewFor(state, seat), seat, rng);
    const moved = apply(state, seat, action).state;
    if (moved.phase === "won") break;
    rng = after;
    state = moved;
  }
  return state;
}

/**
 * S': every card hidden from `seat` redealt among the other hands and the talon, with the same sizes.
 * Kept in place: each exchange choice in its giver's hand, and the card `seat` passed to its partner
 * while the partner still holds it (what `seat` knows).
 */
function redeal(state: GameState, seat: Color, rng: Rng): GameState {
  const others = COLORS.filter((color) => color !== seat);
  const pinned: Record<Color, CardId[]> = { bleu: [], jaune: [], rouge: [], vert: [] };
  for (const color of others) {
    const given = state.given[color];
    if (given !== null) pinned[color].push(given);
  }
  const passed = viewFor(state, seat).givenToPartner;
  const partner = PARTNER[seat];
  if (passed !== null && state.hands[partner].includes(passed)) pinned[partner].push(passed);

  const fixed = new Set(others.flatMap((color) => pinned[color]));
  const hidden = [...others.flatMap((color) => state.hands[color]), ...state.talon].filter(
    (card) => !fixed.has(card),
  );
  let [pool] = shuffle(hidden, rng);
  const hands = { ...state.hands };
  for (const color of others) {
    const take = state.hands[color].length - pinned[color].length;
    hands[color] = sortHand([...pinned[color], ...pool.slice(0, take)]);
    pool = pool.slice(take);
  }
  return { ...state, hands, talon: pool };
}

type Bot = (state: GameState, view: PlayerView, seat: Color, rng: Rng) => Thought;

/** The real bot of `level`: it is handed the view only (the state is there for the stub's sake). */
const realBot =
  (level: BotLevel): Bot =>
  (_state, view, seat, rng) =>
    chooseAction(view, seat, level, rng, level === 5 ? SMALL_BUDGET : undefined);

/**
 * A cheating stub: it plays the level-3 move, except that it picks its candidate (or its give) from the
 * ranks of the cards hidden in the other hands, read from the state through the closure.
 */
const cheatingBot: Bot = (state, view, seat, rng) => {
  const honest = chooseAction(view, seat, 3, rng);
  const peek = COLORS.filter((color) => color !== seat)
    .flatMap((color) => state.hands[color])
    .reduce((sum, card, i) => sum + rankOf(card) * (i + 1), 0);
  if (view.phase === "exchange") {
    const card = view.hand[peek % view.hand.length] as CardId;
    return { ...honest, action: { t: "give", card } };
  }
  const options = candidatesFor(view, seat);
  const pick = options[peek % Math.max(1, options.length)];
  return pick === undefined ? honest : { ...honest, action: pick.action };
};

const seedArb = fc.tuple(
  fc.integer({ min: 0, max: 0x7fffffff }),
  fc.integer({ min: 0, max: 0x7fffffff }),
  fc.integer({ min: 0, max: 0x7fffffff }),
  fc.integer({ min: 0, max: 0x7fffffff }),
);

/** The hidden-hand swap property for `bot`; also counts the samples where S' really differs. */
function swapProperty(bot: Bot, counter: { changed: number }) {
  return fc.property(seedArb, fc.integer({ min: 0, max: 400 }), seedArb, (seed, k, swap) => {
    const state = reach(seed as Rng, k);
    const seat = actingSeat(state);
    const swapped = redeal(state, seat, swap as Rng);
    const view = viewFor(state, seat);
    expect(viewFor(swapped, seat)).toEqual(view);
    if (
      JSON.stringify([swapped.hands, swapped.talon]) !== JSON.stringify([state.hands, state.talon])
    ) {
      counter.changed++;
    }
    const rng: Rng = [seed[1] as number, seed[2] as number, seed[3] as number, k];
    const before = bot(state, view, seat, rng);
    const after = bot(swapped, viewFor(swapped, seat), seat, rng);
    expect(after).toEqual(before);
  });
}

describe("no cheating: the hidden hands never change the move (BOT-04, D-10)", () => {
  for (const level of [1, 2, 3, 4, 5] as const) {
    it(`level ${level}: the same move whatever the hidden cards (${RUNS_PER_LEVEL} samples)`, () => {
      const counter = { changed: 0 };
      fc.assert(swapProperty(realBot(level), counter), {
        seed: PROPERTY_SEED + level,
        numRuns: RUNS_PER_LEVEL,
      });
      // The redeal is not a no-op: most samples really move hidden cards.
      expect(counter.changed).toBeGreaterThan(RUNS_PER_LEVEL / 2);
    }, 120_000);
  }

  it("the negative control: a stub that reads the hidden hands fails the same property", () => {
    const result = fc.check(swapProperty(cheatingBot, { changed: 0 }), {
      seed: PROPERTY_SEED,
      numRuns: RUNS_PER_LEVEL,
    });
    expect(result.failed).toBe(true);
    expect(result.counterexample).not.toBeNull();
  });

  it("handing a GameState to the bot is a type error", () => {
    const state = newGame({ firstDealer: "bleu" }, [1, 1, 1, 1]);
    const bad = () => {
      // @ts-expect-error a GameState carries every hand: the bot is given its seat's PlayerView only
      chooseAction(state, "bleu", 5, [1, 2, 3, 4]);
      // @ts-expect-error the same for the anytime form, at every level
      createThinker(state, "bleu", 5, [1, 2, 3, 4], { plies: 10 });
    };
    expect(bad).toBeTypeOf("function");
  });
});
