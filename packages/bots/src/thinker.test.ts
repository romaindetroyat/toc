// The bot entry point of every level (chooseAction / createThinker): level 1 is exactly randomLegal,
// levels 2 to 5 score the distinct candidates with one team evaluation and pick through their own
// noise, every chosen action is accepted by apply, and the API takes a PlayerView only.

import {
  type Action,
  ALL_PAWNS,
  apply,
  applyPlan,
  COLORS,
  type Color,
  type GameState,
  newGame,
  next as nextRandom,
  type PlayerView,
  type Rng,
  scenarioState,
  sevenPlans,
  teamOf,
  viewFor,
} from "@toc/engine";
import { describe, expect, it } from "vitest";
import { candidatesFor } from "./candidates.ts";
import { BOT_LEVELS, type BotLevel, DEFAULT_BOT_LEVEL, parseBotLevel } from "./levels.ts";
import { randomLegal } from "./randomLegal.ts";
import { chooseAction, createThinker } from "./thinker.ts";

/** The seat that must act: the first seat that has not chosen its exchange card, else the seat to play. */
function actingSeat(state: GameState): Color {
  if (state.phase === "exchange") {
    return COLORS.find((color) => state.given[color] === null) ?? state.turn;
  }
  return state.turn;
}

/** A game of four level-1 bots; calls `visit` with the state and the acting seat before each action. */
function walkGame(seed: Rng, max: number, visit: (state: GameState, seat: Color) => void): void {
  let state = newGame({ firstDealer: COLORS[seed[0] % 4] as Color }, seed);
  let rng: Rng = [seed[3], seed[2], seed[1], seed[0]];
  for (let i = 0; i < max && state.phase !== "won"; i++) {
    const seat = actingSeat(state);
    visit(state, seat);
    const [action, after] = randomLegal(viewFor(state, seat), seat, rng);
    rng = after;
    state = apply(state, seat, action).state;
  }
}

/** Seat views from random games, in the exchange and in the play phases. */
function sampleViews(count: number): { view: PlayerView; seat: Color }[] {
  const out: { view: PlayerView; seat: Color }[] = [];
  for (let g = 1; out.length < count; g++) {
    walkGame([g, g * 3, g * 5, g * 7], 400, (state, seat) => {
      if (out.length < count && (state.phase === "exchange" || out.length % 3 === 0 || g > 3)) {
        out.push({ view: viewFor(state, seat), seat });
      }
    });
  }
  return out.slice(0, count);
}

/** Plays a whole game: the team of bleu at level `a`, the other at level `b`. Returns the final state. */
function match(seed: Rng, a: BotLevel, b: BotLevel): GameState {
  let state = newGame({ firstDealer: COLORS[seed[1] % 4] as Color }, seed);
  let rng: Rng = [seed[2], seed[0], seed[3], seed[1]];
  for (let i = 0; i < 5000 && state.phase !== "won"; i++) {
    const seat = actingSeat(state);
    const level = teamOf(seat) === "bleu-rouge" ? a : b;
    const thought = chooseAction(viewFor(state, seat), seat, level, rng);
    rng = thought.rng;
    // apply throws IllegalActionError on anything legalActions does not list.
    state = apply(state, seat, thought.action).state;
  }
  return state;
}

const boardKey = (pawns: PlayerView["pawns"]): string =>
  ALL_PAWNS.map((id) => JSON.stringify(pawns[id])).join("|");

describe("parseBotLevel", () => {
  it("accepts the five levels and nothing else", () => {
    expect(BOT_LEVELS).toEqual([1, 2, 3, 4, 5]);
    expect(DEFAULT_BOT_LEVEL).toBe(3);
    for (const level of [1, 2, 3, 4, 5]) expect(parseBotLevel(level)).toBe(level);
    for (const bad of [0, 6, 2.5, "3", null, undefined, Number.NaN, [], {}, -1, true]) {
      expect(parseBotLevel(bad), String(bad)).toBeNull();
    }
  });
});

describe("chooseAction level 1 (BOT-02)", () => {
  it("returns exactly the action and the next rng of randomLegal, on 50 seat views", () => {
    const views = sampleViews(50);
    expect(views.some(({ view }) => view.phase === "exchange")).toBe(true);
    expect(views.some(({ view }) => view.phase === "play")).toBe(true);
    let rng: Rng = [3, 1, 4, 1];
    for (const { view, seat } of views) {
      [, rng] = nextRandom(rng);
      const thought = chooseAction(view, seat, 1, rng);
      const [action, after] = randomLegal(view, seat, rng);
      expect({ action: thought.action, rng: thought.rng }).toEqual({ action, rng: after });
    }
  });
});

describe("chooseAction levels 2 to 5", () => {
  /** bleu0 alone on the ring with a single 5: one legal move. */
  const single = () =>
    viewFor(
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

  it("plays the only candidate at once: difficulty 0, one candidate, the rng unchanged", () => {
    for (const level of [2, 3, 4, 5] as const) {
      const rng: Rng = [9, 8, 7, 6];
      const thought = chooseAction(single(), "bleu", level, rng);
      expect(thought).toEqual({
        action: { t: "move", card: "5H", pawn: "bleu0" },
        rng: [9, 8, 7, 6],
        difficulty: 0,
        candidates: 1,
      });
    }
  });

  it("lays the dead hand down as its only candidate", () => {
    const view = viewFor(
      scenarioState({ hands: { bleu: ["8S"], jaune: ["9S"] }, turn: "bleu" }, [1, 2, 3, 4]),
      "bleu",
    );
    expect(chooseAction(view, "bleu", 4, [1, 1, 1, 1]).action).toEqual({ t: "discard" });
  });

  it("level 5 takes the capture when a capture is on offer (team evaluation, T = 0)", () => {
    // bleu0 at progress 5 (cell 5); jaune0 at cell 8. The 3 eats it, the 2 does not.
    const view = viewFor(
      scenarioState(
        {
          pawns: { bleu: [{ p: 5 }, "S", "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
          hands: { bleu: ["2S", "3S"], jaune: ["9S"] },
          turn: "bleu",
        },
        [1, 2, 3, 4],
      ),
      "bleu",
    );
    expect(chooseAction(view, "bleu", 5, [5, 5, 5, 5]).action).toEqual({
      t: "move",
      card: "3S",
      pawn: "bleu0",
    });
  });

  it("plays whole games between mixed levels: every action is accepted and every game has a winner", () => {
    const pairs: [BotLevel, BotLevel][] = [
      [2, 1],
      [3, 2],
      [4, 3],
      [5, 4],
    ];
    for (const [a, b] of pairs) {
      for (const n of [1, 2]) {
        const seed: Rng = [n * 17 + a, n * 31 + b, n * 7, a * b + n];
        const end = match(seed, a, b);
        expect(end.phase, `${a} vs ${b}, seed ${n}`).toBe("won");
        expect(end.winner).not.toBeNull();
        const swapped = match(seed, b, a);
        expect(swapped.phase, `${b} vs ${a}, seed ${n}`).toBe("won");
      }
    }
  }, 120_000);

  it("is deterministic and mutates neither the view nor the rng", () => {
    for (const { view, seat } of sampleViews(30)) {
      for (const level of BOT_LEVELS) {
        const before = JSON.stringify(view);
        const rng: Rng = [21, 22, 23, 24];
        const first = chooseAction(view, seat, level, rng, { plies: 64 });
        const second = chooseAction(view, seat, level, rng, { plies: 64 });
        expect(second).toEqual(first);
        expect(rng).toEqual([21, 22, 23, 24]);
        expect(JSON.stringify(view)).toBe(before);
        expect(first.difficulty).toBeGreaterThanOrEqual(0);
        expect(first.difficulty).toBeLessThanOrEqual(1);
      }
    }
  });

  it("createThinker is valid before and after its step, and finishes in one step", () => {
    const { view, seat } = sampleViews(12)[11] as { view: PlayerView; seat: Color };
    const thinker = createThinker(view, seat, 3, [4, 3, 2, 1]);
    const early = thinker.result();
    expect(thinker.step(1)).toBe(true);
    expect(thinker.result()).toEqual(early);
    expect(thinker.result()).toEqual(chooseAction(view, seat, 3, [4, 3, 2, 1]));
  });
});

describe("candidates", () => {
  /** Three bleu knights far apart and a 7: many plans, far fewer distinct boards. */
  const crowded = () =>
    viewFor(
      scenarioState(
        {
          pawns: { bleu: [{ p: 3 }, { p: 20 }, { p: 40 }, "S"] },
          hands: { bleu: ["7S", "7H", "5D"], jaune: ["9S"] },
          turn: "bleu",
        },
        [1, 2, 3, 4],
      ),
      "bleu",
    );

  it("gives the 7 one candidate per distinct end board, not one per plan", () => {
    const view = crowded();
    const sevens = candidatesFor(view, "bleu").filter((c) => c.action.t === "seven");
    const plans = sevenPlans(view, "bleu", "7S");
    const boards = new Set(
      plans.map((plan) => {
        const result = applyPlan(view, "bleu", "7S", plan);
        if (!result.ok) throw new Error("a listed plan must apply");
        return boardKey(result.pawns);
      }),
    );
    expect(plans.length).toBeGreaterThan(sevens.length);
    expect(sevens.length).toBe(boards.size);
    expect(new Set(sevens.map((c) => boardKey(c.pawns))).size).toBe(sevens.length);
    // Two 7 in hand: the second adds nothing (same rank, same boards), the first in hand order is kept.
    expect(sevens.every((c) => c.action.t === "seven" && c.action.card === "7S")).toBe(true);
  });

  it("keeps a card of another rank that ends on the same board, and collapses the same rank", () => {
    const view = viewFor(
      scenarioState(
        {
          pawns: { bleu: [{ p: 5 }, "S", "S", "S"] },
          hands: { bleu: ["5H", "5S", "1D", "13C"], jaune: ["9S"] },
          turn: "bleu",
        },
        [1, 2, 3, 4],
      ),
      "bleu",
    );
    const actions = candidatesFor(view, "bleu").map((c) => c.action);
    expect(actions).toContainEqual({ t: "move", card: "5H", pawn: "bleu0" });
    expect(actions).not.toContainEqual({ t: "move", card: "5S", pawn: "bleu0" });
    // The As and the Roi both bring bleu1 out: different ranks, both kept.
    expect(actions).toContainEqual({ t: "exit", card: "1D", pawn: "bleu1" });
    expect(actions).toContainEqual({ t: "exit", card: "13C", pawn: "bleu1" });
  });

  it("lists only actions apply accepts, each with the pawns apply gives", () => {
    let checked = 0;
    walkGame([5, 6, 7, 8], 600, (state, seat) => {
      if (state.phase !== "play") return;
      for (const candidate of candidatesFor(viewFor(state, seat), seat)) {
        const action: Action = candidate.action;
        const after = apply(state, seat, action).state;
        // The end of a deal lays the posed hands down, never the pawns: the board is the same.
        expect(boardKey(after.pawns)).toBe(boardKey(candidate.pawns));
        checked++;
      }
    });
    expect(checked).toBeGreaterThan(100);
  });
});

describe("the bot takes a PlayerView only", () => {
  it("passing a GameState is a type error", () => {
    const state = newGame({ firstDealer: "bleu" }, [1, 1, 1, 1]);
    const bad = () => {
      // @ts-expect-error a GameState carries every hand: the bot must be given a PlayerView
      chooseAction(state, "bleu", 3, [1, 2, 3, 4]);
      // @ts-expect-error the same for the anytime form
      createThinker(state, "bleu", 5, [1, 2, 3, 4]);
    };
    expect(bad).toBeTypeOf("function");
  });
});
