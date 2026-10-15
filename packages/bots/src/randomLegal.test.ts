// randomLegal: the level-1 bot. It sees a PlayerView only and always returns an action the engine accepts.

import {
  type Action,
  apply,
  COLORS,
  type Color,
  type GameState,
  isComplete,
  legalActions,
  newGame,
  next as nextRandom,
  type Rng,
  rankOf,
  viewFor,
} from "@toc/engine";
import { describe, expect, it } from "vitest";
import { randomLegal } from "./randomLegal.ts";

/** The seat that must act: the first seat that has not chosen its exchange card, else the seat to play. */
function actingSeat(state: GameState): Color {
  if (state.phase === "exchange") {
    return COLORS.find((color) => state.given[color] === null) ?? state.turn;
  }
  return state.turn;
}

/** Plays a game with four bots; calls `onAction` for each action; stops at the win or after `max` actions. */
function play(
  seed: Rng,
  botSeed: Rng,
  max: number,
  onAction: (state: GameState, seat: Color, action: Action) => void,
): GameState {
  let state = newGame({ firstDealer: COLORS[seed[0] % 4] as Color }, seed);
  let rng = botSeed;
  for (let i = 0; i < max && state.phase !== "won"; i++) {
    const seat = actingSeat(state);
    const [action, after] = randomLegal(viewFor(state, seat), seat, rng);
    rng = after;
    onAction(state, seat, action);
    state = apply(state, seat, action).state;
  }
  return state;
}

describe("randomLegal", () => {
  it("returns an action that apply accepts, in the exchange, the play and the dead-hand states", () => {
    const kinds = new Set<string>();
    for (const n of [1, 2, 3, 4, 5, 6]) {
      play([n, n * 7, n * 13, n * 29], [n, 2, 3, 4], 700, (state, seat, action) => {
        kinds.add(action.t);
        expect(() => apply(state, seat, action)).not.toThrow();
      });
    }
    for (const kind of ["give", "move", "exit", "seven", "discard"]) {
      expect(kinds.has(kind), `no ${kind} action seen`).toBe(true);
    }
  });

  it("only returns a card that is in the hand, and a complete plan for a 7", () => {
    play([9, 8, 7, 6], [1, 1, 1, 1], 800, (state, seat, action) => {
      if (action.t === "discard") return;
      expect(state.hands[seat]).toContain(action.card);
      if (action.t === "seven") {
        expect(rankOf(action.card)).toBe(7);
        expect(action.plan.reduce((sum, e) => sum + e.steps, 0)).toBe(7);
        expect(isComplete(state, seat, action.card, action.plan)).toBe(true);
      }
    });
  });

  it("discards when the hand is dead and plays when a card can be played", () => {
    play([3, 1, 4, 1], [5, 9, 2, 6], 800, (state, seat, action) => {
      const open = legalActions(state, seat, { sevenPlans: "none" });
      if (state.phase === "play" && open.length === 1 && open[0]?.t === "discard") {
        expect(action).toEqual({ t: "discard" });
      } else if (state.phase === "play") {
        expect(action.t).not.toBe("discard");
      }
    });
  });

  it("is deterministic: the same view and rng give the same action and the same next rng", () => {
    const state = newGame({ firstDealer: "bleu" }, [11, 22, 33, 44]);
    const view = viewFor(state, "bleu");
    const first = randomLegal(view, "bleu", [1, 2, 3, 4]);
    const second = randomLegal(view, "bleu", [1, 2, 3, 4]);
    expect(second).toEqual(first);
    expect(first[1]).not.toEqual([1, 2, 3, 4]);
  });

  it("does not modify its rng argument", () => {
    const rng: Rng = [5, 6, 7, 8];
    randomLegal(viewFor(newGame({ firstDealer: "rouge" }, [1, 2, 3, 4]), "vert"), "vert", rng);
    expect(rng).toEqual([5, 6, 7, 8]);
  });

  it("draws different cards for different rngs", () => {
    const view = viewFor(newGame({ firstDealer: "jaune" }, [8, 8, 8, 8]), "jaune");
    const cards = new Set<string>();
    let rng: Rng = [1, 2, 3, 4];
    for (let i = 0; i < 40; i++) {
      // Small seeds give correlated first draws in sfc32: walk the generator, as a game does.
      [, rng] = nextRandom(rng);
      const [action] = randomLegal(view, "jaune", rng);
      if (action.t === "give") cards.add(action.card);
    }
    expect(cards.size).toBeGreaterThan(1);
  });

  it("takes a PlayerView only: passing a GameState is a type error", () => {
    const state = newGame({ firstDealer: "bleu" }, [1, 1, 1, 1]);
    const bad = () => {
      // @ts-expect-error a GameState carries every hand: the bot must be given a PlayerView
      randomLegal(state, "bleu", [1, 2, 3, 4]);
    };
    expect(bad).toBeTypeOf("function");
  });
});
