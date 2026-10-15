// Level 5, the Champion (D-04, 03-RESEARCH Patterns 5 and 6): a flat Monte-Carlo search over the deals
// it can imagine from its own view. The unknown cards and the imagined worlds come from the PlayerView
// only; the search is counted in work units, anytime, and the same inputs give the same move.

import {
  apply,
  COLORS,
  type Color,
  type GameState,
  newGame,
  type PlayerView,
  type Rng,
  scenarioState,
  viewFor,
} from "@toc/engine";
import { describe, expect, it } from "vitest";
import { candidatesFor } from "./candidates.ts";
import { determinize } from "./determinize.ts";
import { scoreCandidates } from "./evaluate.ts";
import { giveScores } from "./exchange.ts";
import { hiddenCounts, unknownCards } from "./knowledge.ts";
import { CHAMPION_BUDGET } from "./levels.ts";
import { playGame } from "./match.ts";
import { chooseAction, createThinker } from "./thinker.ts";

/** The seat that must act: the first seat that has not chosen its exchange card, else the seat to play. */
function actingSeat(state: GameState): Color {
  if (state.phase === "exchange") {
    return COLORS.find((color) => state.given[color] === null) ?? state.turn;
  }
  return state.turn;
}

/** States met in games of level-3 bots (both phases), with the seat that must act. */
function sampleStates(count: number, every = 7): { state: GameState; seat: Color }[] {
  const out: { state: GameState; seat: Color }[] = [];
  for (let g = 1; out.length < count; g++) {
    let state = newGame({ firstDealer: COLORS[g % 4] as Color }, [g, g * 7, g * 11, g * 13]);
    let rng: Rng = [g * 3, g * 5, g * 2, g];
    for (let i = 0; i < 2000 && state.phase !== "won" && out.length < count; i++) {
      const seat = actingSeat(state);
      if (i % every === 0) out.push({ state, seat });
      const thought = chooseAction(viewFor(state, seat), seat, 3, rng);
      rng = thought.rng;
      state = apply(state, seat, thought.action).state;
    }
  }
  return out;
}

/** Play-phase decisions with at least two candidates. */
function choices(count: number): { state: GameState; seat: Color; view: PlayerView }[] {
  return sampleStates(count * 4, 3)
    .filter(({ state }) => state.phase === "play")
    .map(({ state, seat }) => ({ state, seat, view: viewFor(state, seat) }))
    .filter(({ view, seat }) => candidatesFor(view, seat).length >= 2)
    .slice(0, count);
}

describe("knowledge: what the seat does not see", () => {
  it("the unknown cards are the deck minus the hand, the discard and the posed hands", () => {
    for (const { state, seat } of sampleStates(60)) {
      const view = viewFor(state, seat);
      const unknown = unknownCards(view);
      const counts = hiddenCounts(view);
      const others = COLORS.filter((c) => c !== seat).reduce((n, c) => n + view.handSizes[c], 0);
      expect(unknown.length).toBe(others + view.talonSize);
      expect(counts.talon).toBe(view.talonSize);
      expect(counts.hands[seat]).toBe(0);
      const seen = new Set([
        ...view.hand,
        ...view.discard,
        ...COLORS.flatMap((c) => view.posed[c]),
      ]);
      for (const card of unknown) expect(seen.has(card)).toBe(false);
      expect(new Set(unknown).size).toBe(unknown.length);
      // Every card actually hidden from the seat is in the pool.
      for (const color of COLORS) {
        if (color === seat) continue;
        for (const card of state.hands[color]) expect(unknown).toContain(card);
      }
      for (const card of state.talon) expect(unknown).toContain(card);
    }
  });
});

describe("determinize: a world consistent with the view", () => {
  it("gives a state whose view for the seat is the seat's view, with the right hidden sizes", () => {
    let rng: Rng = [1, 2, 3, 4];
    for (const { state, seat } of sampleStates(60)) {
      const view = viewFor(state, seat);
      const [world, after] = determinize(view, seat, rng);
      rng = after;
      expect(world.kind).toBe("state");
      expect(viewFor(world, seat)).toEqual(view);
      for (const color of COLORS) {
        expect(world.hands[color].length).toBe(view.handSizes[color]);
        if (view.phase === "exchange" && view.hasGiven[color]) {
          expect(world.given[color]).not.toBeNull();
          expect(world.hands[color]).toContain(world.given[color]);
        }
      }
      expect(world.talon.length).toBe(view.talonSize);
      const all = [
        ...COLORS.flatMap((c) => world.hands[c]),
        ...world.talon,
        ...world.discard,
        ...COLORS.flatMap((c) => world.posed[c]),
      ];
      expect(all.length).toBe(52);
      expect(new Set(all).size).toBe(52);
    }
  });

  it("is deterministic: the same rng gives the same world and the same rng after", () => {
    for (const { state, seat } of sampleStates(10)) {
      const view = viewFor(state, seat);
      expect(determinize(view, seat, [5, 6, 7, 8])).toEqual(determinize(view, seat, [5, 6, 7, 8]));
    }
  });

  it("varies the hidden layout with the rng", () => {
    const { state, seat } = sampleStates(10).find((s) => s.state.phase === "play") as {
      state: GameState;
      seat: Color;
    };
    const view = viewFor(state, seat);
    const a = determinize(view, seat, [1, 1, 1, 1])[0];
    const b = determinize(view, seat, [2, 2, 2, 2])[0];
    expect(JSON.stringify([a.hands, a.talon])).not.toBe(JSON.stringify([b.hands, b.talon]));
  });
});

describe("level 5: the search over imagined deals", () => {
  it("plays one of its candidates; with no budget, the static best", () => {
    for (const { view, seat } of choices(8)) {
      const actions = candidatesFor(view, seat).map((c) => c.action);
      const thought = chooseAction(view, seat, 5, [3, 1, 4, 1]);
      expect(actions).toContainEqual(thought.action);
      const still = chooseAction(view, seat, 5, [3, 1, 4, 1], { plies: 0 });
      expect(still.action).toEqual(scoreCandidates(view, seat)[0]?.action);
      expect(still.units).toBe(0);
    }
  });

  it("never spends more than its budget, and says so once it is spent", () => {
    for (const { view, seat } of choices(5)) {
      for (const plies of [50, 200, CHAMPION_BUDGET.plies]) {
        const thinker = createThinker(view, seat, 5, [2, 7, 1, 8], { plies });
        let steps = 0;
        while (!thinker.step(7)) {
          steps++;
          expect(thinker.result().units).toBeLessThanOrEqual(plies);
          expect(steps).toBeLessThan(10_000);
        }
        const thought = thinker.result();
        expect(thought.units).toBeLessThanOrEqual(plies);
        expect(thinker.step(7)).toBe(true);
        expect(thinker.result()).toEqual(thought);
        // The same search run in one go gives the same thought (slicing never changes the move).
        expect(chooseAction(view, seat, 5, [2, 7, 1, 8], { plies })).toEqual(thought);
      }
    }
  });

  it("is anytime: after any number of steps, the result is an action apply accepts", () => {
    for (const { state, view, seat } of choices(6)) {
      const thinker = createThinker(view, seat, 5, [9, 9, 9, 9], { plies: 120 });
      for (const k of [0, 1, 3, 10, 40, 1000]) {
        thinker.step(k);
        const { action } = thinker.result();
        expect(() => apply(state, seat, action)).not.toThrow();
      }
    }
  });

  it("is deterministic and touches neither the view nor the rng", () => {
    for (const { view, seat } of choices(6)) {
      const before = JSON.stringify(view);
      const rng: Rng = [11, 12, 13, 14];
      const first = chooseAction(view, seat, 5, rng);
      expect(chooseAction(view, seat, 5, rng)).toEqual(first);
      expect(rng).toEqual([11, 12, 13, 14]);
      expect(JSON.stringify(view)).toBe(before);
      expect(first.difficulty).toBeGreaterThanOrEqual(0);
      expect(first.difficulty).toBeLessThanOrEqual(1);
    }
  });

  it("plays a single candidate at once, without searching", () => {
    const view = viewFor(
      scenarioState(
        {
          pawns: { bleu: [{ p: 5 }, "S", "S", "S"], jaune: [{ p: 5 }, "S", "S", "S"] },
          hands: { bleu: ["5H"], jaune: ["9S"] },
          turn: "bleu",
        },
        [1, 2, 3, 4],
      ),
      "bleu",
    );
    expect(chooseAction(view, "bleu", 5, [9, 8, 7, 6])).toEqual({
      action: { t: "move", card: "5H", pawn: "bleu0" },
      rng: [9, 8, 7, 6],
      difficulty: 0,
      candidates: 1,
      units: 0,
    });
  });

  it("takes the best exchange card, without searching", () => {
    for (const { state, seat } of sampleStates(40).filter((s) => s.state.phase === "exchange")) {
      const view = viewFor(state, seat);
      const scores = giveScores(view, seat);
      const top = [...scores].sort((a, b) => b.score - a.score)[0];
      const thought = chooseAction(view, seat, 5, [1, 2, 3, 4]);
      expect(thought.action).toEqual({ t: "give", card: top?.card });
      expect(thought.units).toBe(scores.length);
    }
  });

  it("plays whole games against level 4 with a small budget: every action accepted, a winner", () => {
    for (const n of [1, 2]) {
      const result = playGame({
        levels: { "bleu-rouge": 5, "jaune-vert": 4 },
        dealSeed: [n, n * 3, n * 5, n * 7],
        botSeed: [n * 11, n * 13, n * 17, n * 19],
        budgets: { "bleu-rouge": { plies: 40 } },
      });
      expect(["bleu-rouge", "jaune-vert"]).toContain(result.winner);
      expect(result.perTeam["bleu-rouge"].units).toBeGreaterThan(0);
    }
  }, 120_000);
});
