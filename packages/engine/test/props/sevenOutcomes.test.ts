// sevenOutcomes: one plan per distinct end board of a 7 (03-RESEARCH Pattern 2). The oracle is the full
// enumeration, sevenPlans followed by applyPlan and grouped by end board: on every 7 turn of 30 seeded
// random games (level-1 bots) both give the same set of boards, in the same order, and every outcome
// replays to the same pawns and captures through applyPlan. G16 is checked on the classic position.

import { describe, expect, it } from "vitest";
import { randomLegal } from "../../../bots/src/index.ts";
import {
  ALL_PAWNS,
  apply,
  applyPlan,
  type Board,
  type CardId,
  COLORS,
  type Color,
  canPlaySeven,
  type GameState,
  newGame,
  type Pawn,
  type PawnId,
  type Rng,
  rankOf,
  sevenOutcomes,
  sevenPlans,
  viewFor,
} from "../../src/index.ts";
import { playState } from "../helpers.ts";

const GAMES = 30;

const key = (pawns: Record<PawnId, Pawn>): string =>
  ALL_PAWNS.map((id) => JSON.stringify(pawns[id])).join("|");

/** The seat that must act: the first seat that has not chosen its exchange card, else the seat to play. */
function actingSeat(state: GameState): Color {
  if (state.phase === "exchange") {
    return COLORS.find((color) => state.given[color] === null) ?? state.turn;
  }
  return state.turn;
}

/** The oracle: the end boards of every plan, in the order of their first plan, with that plan. */
function grouped(board: Board, seat: Color, card: CardId) {
  const out: { key: string; plan: unknown }[] = [];
  const seen = new Set<string>();
  const plans = sevenPlans(board, seat, card);
  for (const plan of plans) {
    const result = applyPlan(board, seat, card, plan);
    if (!result.ok) throw new Error("a listed plan must apply");
    const k = key(result.pawns);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ key: k, plan: result.plan });
  }
  return { boards: out, plans: plans.length };
}

describe("sevenOutcomes: unit cases", () => {
  it("is empty for a card that is not a 7, and for a 7 that cannot be played", () => {
    const state = playState({ bleu: [{ p: 5 }, "S", "S", "S"] }, { bleu: ["5S", "7S"] }, "bleu");
    expect(sevenOutcomes(state, "bleu", "5S")).toEqual([]);
    const stuck = playState({}, { bleu: ["7S"] }, "bleu");
    expect(canPlaySeven(stuck, "bleu")).toBe(false);
    expect(sevenOutcomes(stuck, "bleu", "7S")).toEqual([]);
  });

  it("bleu0 two cells before its carré 16: never left on the ring beyond its start (G16)", () => {
    const state = playState({ bleu: [{ p: 68 }, { p: 10 }, "S", "S"] }, { bleu: ["7S"] }, "bleu");
    const outcomes = sevenOutcomes(state, "bleu", "7S");
    expect(outcomes.length).toBeGreaterThan(1);
    for (const { pawns } of outcomes) {
      const bleu0 = pawns.bleu0;
      expect(bleu0.zone === "home" || (bleu0.zone === "ring" && bleu0.progress === 68)).toBe(true);
    }
    expect(outcomes.some(({ pawns }) => pawns.bleu0.zone === "home")).toBe(true);
    const still = outcomes.find(({ pawns }) => pawns.bleu0.zone === "ring");
    expect(still?.plan).toEqual([{ pawn: "bleu1", steps: 7 }]);
    expect(still?.pawns.bleu1).toEqual({ zone: "ring", progress: 17, justOut: false });
  });

  it("does not modify the board", () => {
    const state = playState({ bleu: [{ p: 3 }, { p: 20 }, "S", "S"] }, { bleu: ["7S"] }, "bleu");
    const before = JSON.stringify(state);
    sevenOutcomes(state, "bleu", "7S");
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("sevenOutcomes: the same boards as the full enumeration (property, 30 games)", () => {
  it("on every 7 turn: same boards, same order, first plans, replayable, pairwise distinct", () => {
    let boards = 0;
    let outcomesSeen = 0;
    let plansSeen = 0;
    for (let g = 1; g <= GAMES; g++) {
      const seed: Rng = [g * 101, g * 37 + 1, g * 13 + 2, g * 7 + 3];
      let state = newGame({ firstDealer: COLORS[g % 4] as Color }, seed);
      let rng: Rng = [g, g + 1, g + 2, g + 3];
      for (let i = 0; i < 5000 && state.phase !== "won"; i++) {
        const seat = actingSeat(state);
        if (state.phase === "play") {
          const seven = state.hands[seat].find((card) => rankOf(card) === 7);
          if (seven !== undefined) {
            boards++;
            const outcomes = sevenOutcomes(state, seat, seven);
            const oracle = grouped(state, seat, seven);
            expect(outcomes.map((o) => key(o.pawns))).toEqual(oracle.boards.map((o) => o.key));
            expect(outcomes.map((o) => o.plan)).toEqual(oracle.boards.map((o) => o.plan));
            expect(new Set(outcomes.map((o) => key(o.pawns))).size).toBe(outcomes.length);
            for (const outcome of outcomes) {
              const replay = applyPlan(state, seat, seven, outcome.plan);
              expect(replay.ok).toBe(true);
              if (!replay.ok) continue;
              expect(replay.pawns).toEqual(outcome.pawns);
              expect(replay.captured).toEqual(outcome.captured);
            }
            // The view gives the same outcomes: the 7 depends on the public board only.
            if (boards % 10 === 0) {
              expect(sevenOutcomes(viewFor(state, seat), seat, seven)).toEqual(outcomes);
            }
            outcomesSeen += outcomes.length;
            plansSeen += oracle.plans;
          }
        }
        const [action, after] = randomLegal(viewFor(state, seat), seat, rng);
        rng = after;
        state = apply(state, seat, action).state;
      }
    }
    // Not vacuous: many 7 turns, and far fewer outcomes than plans.
    expect(boards).toBeGreaterThan(300);
    expect(plansSeen).toBeGreaterThan(outcomesSeen * 5);
  }, 120_000);
});
