// The 7 split across pawns (RULE-10, RULE-11, RULE-16): ordered plans, captures in transit, atomicity,
// dead ends and the 5 ms bound of nextSteps. Positions are built with playState (test helpers).
// Cell arithmetic: cell = (EXIT[color] + progress) mod 72, EXIT bleu 0, jaune 18, rouge 36, vert 54.

import { describe, expect, it } from "vitest";
import {
  type Action,
  apply,
  applyPlan,
  type GameEvent,
  type GameState,
  IllegalActionError,
  isComplete,
  legalActions,
  nextSteps,
  type PawnId,
  type PawnSpec,
  playability,
  type SevenPlan,
  sevenPlans,
  viewFor,
} from "../src/index.ts";
import { playState } from "./helpers.ts";

const CARD = "7S";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const bleuOnly = (specs: [PawnSpec, PawnSpec, PawnSpec, PawnSpec], rules = {}) =>
  playState({ bleu: specs }, { bleu: [CARD] }, "bleu", rules);

const plan = (...entries: [PawnId, number][]): SevenPlan =>
  entries.map(([pawn, steps]) => ({ pawn, steps }));

const kinds = (events: GameEvent[]) => events.map((e) => e.t);

describe("applyPlan: one ordered plan of micro-moves", () => {
  it("a single pawn, 7 steps, eats the opponent it passes with atStep = index of its cell in the path", () => {
    // bleu0 on cell 10; jaune0 on cell 13 (progress 67): the third cell of the path (atStep 2).
    const state = playState(
      { bleu: [{ p: 10 }, "S", "S", "S"], jaune: [{ p: 67 }, "S", "S", "S"] },
      { bleu: [CARD] },
      "bleu",
    );
    const result = applyPlan(state, "bleu", CARD, plan(["bleu0", 7]));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pawns.bleu0).toEqual({ zone: "ring", progress: 17 });
    expect(result.pawns.jaune0).toEqual({ zone: "stable" });
    expect(kinds(result.events)).toEqual(["pawnMoved", "pawnCaptured", "pawnSentHome"]);
    const capture = result.events.find((e) => e.t === "pawnCaptured");
    expect(capture).toMatchObject({ by: "bleu0", victim: "jaune0", atStep: 2 });
    expect(result.captured).toEqual(["jaune0"]);
  });

  it("accepts 3 + 4 and 2 + 2 + 3 when each micro-move is legal at its turn", () => {
    const state = bleuOnly([{ p: 5 }, { p: 20 }, { p: 30 }, "S"]);
    const a = applyPlan(state, "bleu", CARD, plan(["bleu0", 3], ["bleu1", 4]));
    expect(a.ok).toBe(true);
    const b = applyPlan(state, "bleu", CARD, plan(["bleu0", 2], ["bleu1", 2], ["bleu2", 3]));
    expect(b.ok).toBe(true);
    if (b.ok) {
      expect(b.pawns.bleu0).toEqual({ zone: "ring", progress: 7 });
      expect(b.pawns.bleu1).toEqual({ zone: "ring", progress: 22 });
      expect(b.pawns.bleu2).toEqual({ zone: "ring", progress: 33 });
    }
  });

  it("rejects a plan whose second micro-move stops on an own pawn and leaves the input unchanged", () => {
    const state = deepFreeze(bleuOnly([{ p: 5 }, { p: 2 }, "S", "S"]));
    const snapshot = JSON.stringify(state);
    // bleu0 2 -> 7, then bleu1 5 -> 7: the second micro-move stops on the first one's pawn.
    const clash = applyPlan(state, "bleu", CARD, plan(["bleu0", 2], ["bleu1", 5]));
    expect(clash).toEqual({ ok: false, reason: "own-pawn" });
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("rejects plans that sum to 6 or 8, empty plans and non-positive or fractional steps", () => {
    const state = bleuOnly([{ p: 5 }, { p: 20 }, "S", "S"]);
    for (const bad of [
      plan(["bleu0", 3], ["bleu1", 3]),
      plan(["bleu0", 3], ["bleu1", 5]),
      plan(),
      plan(["bleu0", 0], ["bleu1", 7]),
      plan(["bleu0", -1], ["bleu1", 8]),
      plan(["bleu0", 3.5], ["bleu1", 3.5]),
    ]) {
      const result = applyPlan(state, "bleu", CARD, bad);
      expect(result.ok).toBe(false);
      expect(isComplete(viewFor(state, "bleu"), "bleu", CARD, bad)).toBe(false);
    }
  });

  it("order matters: moving the pawn in front first frees the cell, the reverse order is refused", () => {
    const state = bleuOnly([{ p: 5 }, { p: 8 }, "S", "S"]);
    const good = applyPlan(state, "bleu", CARD, plan(["bleu1", 4], ["bleu0", 3]));
    expect(good.ok).toBe(true);
    if (good.ok) {
      expect(good.pawns.bleu0).toEqual({ zone: "ring", progress: 8 });
      expect(good.pawns.bleu1).toEqual({ zone: "ring", progress: 12 });
    }
    const reversed = applyPlan(state, "bleu", CARD, plan(["bleu0", 3], ["bleu1", 4]));
    expect(reversed).toEqual({ ok: false, reason: "own-pawn" });
  });

  it("a pawn eaten in transit frees its cell at once for the rest of the plan", () => {
    // jaune0 on cell 13 (progress 67); bleu0 eats it with 3 from cell 10, then bleu1 lands on cell 10.
    const state = playState(
      { bleu: [{ p: 10 }, { p: 6 }, "S", "S"], jaune: [{ p: 67 }, "S", "S", "S"] },
      { bleu: [CARD] },
      "bleu",
    );
    const result = applyPlan(state, "bleu", CARD, plan(["bleu0", 3], ["bleu1", 4]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.pawns.bleu0).toEqual({ zone: "ring", progress: 13 });
      expect(result.pawns.bleu1).toEqual({ zone: "ring", progress: 10 });
      expect(result.pawns.jaune0).toEqual({ zone: "stable" });
      expect(kinds(result.events)).toEqual([
        "pawnMoved",
        "pawnCaptured",
        "pawnSentHome",
        "pawnMoved",
      ]);
    }
  });

  it("passes own pawns without eating them and eats the partner's pawn it crosses", () => {
    const state = playState(
      { bleu: [{ p: 5 }, { p: 8 }, "S", "S"], rouge: [{ p: 45 }, "S", "S", "S"] },
      { bleu: [CARD] },
      "bleu",
    );
    // rouge0 is on cell 36 + 45 = 81 mod 72 = 9: the fourth cell of bleu0's path.
    const result = applyPlan(state, "bleu", CARD, plan(["bleu0", 7]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.captured).toEqual(["rouge0"]);
      expect(result.pawns.bleu1).toEqual({ zone: "ring", progress: 8 });
      const capture = result.events.find((e) => e.t === "pawnCaptured");
      expect(capture).toMatchObject({ victim: "rouge0", atStep: 3 });
    }
  });

  it("a protected pawn is never crossed, whatever the order", () => {
    const state = playState(
      { bleu: [{ p: 33 }, { p: 10 }, "S", "S"], rouge: [{ p: 0 }, "S", "S", "S"] },
      { bleu: [CARD] },
      "bleu",
    );
    expect(applyPlan(state, "bleu", CARD, plan(["bleu0", 5], ["bleu1", 2]))).toEqual({
      ok: false,
      reason: "blocked-protected",
    });
    expect(applyPlan(state, "bleu", CARD, plan(["bleu0", 2], ["bleu1", 5])).ok).toBe(true);
  });

  it("refuses a pawn that is not controlled at that moment", () => {
    const state = playState(
      { bleu: [{ p: 5 }, "S", "S", "S"], jaune: [{ p: 40 }, "S", "S", "S"] },
      { bleu: [CARD] },
      "bleu",
    );
    expect(applyPlan(state, "bleu", CARD, plan(["jaune0", 7])).ok).toBe(false);
    expect(applyPlan(state, "bleu", CARD, plan(["bleu1", 7])).ok).toBe(false);
  });

  it("two consecutive entries of the same pawn count as one (G5, RULES.md R-10)", () => {
    const state = bleuOnly([{ p: 5 }, { p: 12 }, "S", "S"]);
    // 3 then 4 for bleu0 is the single step 7, which lands on bleu1: refused as one move.
    const merged = applyPlan(state, "bleu", CARD, plan(["bleu0", 3], ["bleu0", 4]));
    expect(merged).toEqual({ ok: false, reason: "own-pawn" });
    const free = bleuOnly([{ p: 5 }, "S", "S", "S"]);
    const a = applyPlan(free, "bleu", CARD, plan(["bleu0", 3], ["bleu0", 4]));
    const b = applyPlan(free, "bleu", CARD, plan(["bleu0", 7]));
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.pawns).toEqual(b.pawns);
      expect(kinds(a.events)).toEqual(kinds(b.events));
    }
  });

  it("the same pawn may come back later (G5), unless SEVEN_SAME_PAWN_TWICE is off", () => {
    const entries = plan(["bleu0", 2], ["bleu1", 3], ["bleu0", 2]);
    const on = bleuOnly([{ p: 5 }, { p: 10 }, "S", "S"]);
    const off = bleuOnly([{ p: 5 }, { p: 10 }, "S", "S"], { SEVEN_SAME_PAWN_TWICE: false });
    const ok = applyPlan(on, "bleu", CARD, entries);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.pawns.bleu0).toEqual({ zone: "ring", progress: 9 });
    expect(applyPlan(off, "bleu", CARD, entries).ok).toBe(false);
  });

  it("enters the home at the exact count and plays the rest with the partner's pawns (G12)", () => {
    const state = playState(
      {
        bleu: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 69 }],
        rouge: [{ p: 10 }, "S", "S", "S"],
      },
      { bleu: [CARD] },
      "bleu",
    );
    const result = applyPlan(state, "bleu", CARD, plan(["bleu3", 2], ["rouge0", 5]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(kinds(result.events)).toEqual(["pawnEnteredHome", "playerFinished", "pawnMoved"]);
      expect(result.pawns.rouge0).toEqual({ zone: "ring", progress: 15 });
    }
    const stay = playState(
      {
        bleu: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 69 }],
        rouge: [{ p: 10 }, "S", "S", "S"],
      },
      { bleu: [CARD] },
      "bleu",
      { SEVEN_CONTINUES_WITH_PARTNER: false },
    );
    // The alternative of G12 (R-15.9): the whole 7 is played with the pawns held at the start of the turn.
    expect(applyPlan(stay, "bleu", CARD, plan(["bleu3", 2], ["rouge0", 5])).ok).toBe(false);
    expect(applyPlan(stay, "bleu", CARD, plan(["bleu3", 7])).ok).toBe(true);
  });
});

describe("legalActions and playability with the 7", () => {
  it("lists every valid ordered plan and none of the invalid ones", () => {
    const state = bleuOnly([{ p: 5 }, { p: 12 }, "S", "S"]);
    const actions = legalActions(state, "bleu");
    const sevens = actions.filter((a): a is Extract<Action, { t: "seven" }> => a.t === "seven");
    expect(sevens.length).toBeGreaterThan(0);
    const has = (p: SevenPlan) => sevens.some((a) => JSON.stringify(a.plan) === JSON.stringify(p));
    expect(has(plan(["bleu0", 3], ["bleu1", 4]))).toBe(true);
    expect(has(plan(["bleu1", 4], ["bleu0", 3]))).toBe(true);
    expect(has(plan(["bleu0", 7]))).toBe(false);
    expect(has(plan(["bleu1", 7]))).toBe(true);
    // Every listed plan is applied by apply, and by applyPlan, identically.
    for (const a of sevens) {
      expect(applyPlan(state, "bleu", CARD, a.plan).ok).toBe(true);
      expect(isComplete(viewFor(state, "bleu"), "bleu", CARD, a.plan)).toBe(true);
    }
    expect(actions.some((a) => a.t === "discard")).toBe(false);
  });

  it("sevenPlans enumerates the same set as legalActions", () => {
    const state = bleuOnly([{ p: 5 }, { p: 12 }, { p: 30 }, "S"]);
    const fromLegal = legalActions(state, "bleu").flatMap((a) => (a.t === "seven" ? [a.plan] : []));
    const direct = sevenPlans(state, "bleu", CARD);
    expect(direct.map((p) => JSON.stringify(p)).sort()).toEqual(
      fromLegal.map((p) => JSON.stringify(p)).sort(),
    );
    expect(sevenPlans(state, "bleu", CARD, 5)).toHaveLength(5);
  });

  it("opts.sevenPlans 'none' skips the plans but keeps the discard rule honest", () => {
    const state = bleuOnly([{ p: 5 }, "S", "S", "S"]);
    const none = legalActions(state, "bleu", { sevenPlans: "none" });
    expect(none.some((a) => a.t === "seven")).toBe(false);
    expect(none.some((a) => a.t === "discard")).toBe(false);
  });

  it("a 7 that no plan completes is unplayable (seven-incomplete) and the hand is dead", () => {
    const state = bleuOnly([{ h: 0 }, { h: 2 }, { h: 3 }, "S"]);
    expect(playability(viewFor(state, "bleu"), "bleu")[CARD]).toEqual({
      playable: false,
      reason: "seven-incomplete",
    });
    expect(legalActions(state, "bleu")).toEqual([{ t: "discard" }]);
  });

  it("blocked-protected when only a protected pawn prevents every plan", () => {
    const state = hemmed();
    expect(playability(viewFor(state, "bleu"), "bleu")[CARD]).toEqual({
      playable: false,
      reason: "blocked-protected",
    });
  });
});

describe("apply with a seven action", () => {
  it("emits cardPlayed, one movement per micro-move and the turn, and moves the card to the discard", () => {
    const state = playState(
      { bleu: [{ p: 5 }, { p: 20 }, "S", "S"] },
      { bleu: [CARD], jaune: ["2H"] },
      "bleu",
    );
    const out = apply(state, "bleu", {
      t: "seven",
      card: CARD,
      plan: plan(["bleu0", 3], ["bleu1", 4]),
    });
    expect(kinds(out.events)).toEqual(["cardPlayed", "pawnMoved", "pawnMoved", "turn"]);
    expect(out.state.hands.bleu).toEqual([]);
    expect(out.state.discard).toContain(CARD);
    expect(out.state.turn).toBe("jaune");
  });

  it("counts the pawns eaten by the 7 for the team", () => {
    const state = playState(
      { bleu: [{ p: 10 }, "S", "S", "S"], jaune: [{ p: 67 }, "S", "S", "S"] },
      { bleu: [CARD], jaune: ["2H"] },
      "bleu",
    );
    const out = apply(state, "bleu", { t: "seven", card: CARD, plan: plan(["bleu0", 7]) });
    expect(out.state.captures["bleu-rouge"]).toBe(1);
  });

  it("rejects an invalid plan as a whole: IllegalActionError, input state untouched (T-01-18)", () => {
    const state = deepFreeze(
      playState({ bleu: [{ p: 5 }, { p: 20 }, "S", "S"] }, { bleu: [CARD], jaune: ["2H"] }, "bleu"),
    );
    const snapshot = JSON.stringify(state);
    const mutants: SevenPlan[] = [
      plan(["bleu0", 3], ["bleu1", 3]),
      plan(["bleu0", 3], ["bleu1", 5]),
      plan(["bleu0", 8]),
      plan(["bleu2", 7]),
      plan(["jaune0", 7]),
      [],
    ];
    for (const p of mutants) {
      expect(() => apply(state, "bleu", { t: "seven", card: CARD, plan: p })).toThrow(
        IllegalActionError,
      );
    }
    expect(() =>
      apply(state, "jaune", { t: "seven", card: CARD, plan: plan(["bleu0", 7]) }),
    ).toThrow(IllegalActionError);
    expect(() =>
      apply(state, "bleu", { t: "seven", card: "7H", plan: plan(["bleu0", 7]) }),
    ).toThrow(IllegalActionError);
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("the 7 that brings the eighth pawn home wins the game (R-16.3)", () => {
    const state = playState(
      {
        bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
        rouge: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 64 }],
      },
      { rouge: [CARD], bleu: ["2H"] },
      "rouge",
    );
    const out = apply(state, "rouge", { t: "seven", card: CARD, plan: plan(["rouge3", 7]) });
    expect(kinds(out.events)).toEqual(["cardPlayed", "pawnEnteredHome", "gameWon"]);
    expect(out.state.phase).toBe("won");
  });
});

describe("nextSteps: only the steps after which the 7 can still be completed", () => {
  /** Brute force: the first entries of every complete plan, per pawn. */
  function firstSteps(state: GameState, partial: SevenPlan): Map<PawnId, Set<number>> {
    const used = partial.reduce((sum, e) => sum + e.steps, 0);
    const out = new Map<PawnId, Set<number>>();
    for (const full of sevenPlans(state, "bleu", CARD)) {
      // A complete canonical plan extends `partial` when it starts with the same entries.
      const head = full.slice(0, partial.length);
      if (JSON.stringify(head) !== JSON.stringify(partial)) continue;
      const next = full[partial.length];
      if (next === undefined) continue;
      const set = out.get(next.pawn) ?? new Set<number>();
      set.add(next.steps);
      out.set(next.pawn, set);
    }
    expect(used).toBeLessThanOrEqual(7);
    return out;
  }

  it("from an empty plan it offers exactly the first entries of the complete plans", () => {
    const state = playState(
      {
        bleu: [{ p: 5 }, { p: 12 }, { p: 33 }, "S"],
        rouge: [{ p: 0 }, "S", "S", "S"],
        jaune: [{ p: 67 }, "S", "S", "S"],
      },
      { bleu: [CARD] },
      "bleu",
    );
    const offered = nextSteps(viewFor(state, "bleu"), "bleu", CARD, []);
    const expected = firstSteps(state, []);
    for (const id of ["bleu0", "bleu1", "bleu2", "bleu3"] as const) {
      expect([...(offered[id] ?? [])].sort()).toEqual([...(expected.get(id) ?? [])].sort());
    }
    // bleu2 stands 3 cells before the protected rouge0: it never offers more than 2 steps.
    expect(Math.max(0, ...(offered.bleu2 ?? []))).toBeLessThanOrEqual(2);
  });

  it("after a partial plan it offers only what still completes to 7 (no dead end)", () => {
    const state = bleuOnly([{ p: 5 }, { p: 8 }, "S", "S"]);
    const partial = plan(["bleu0", 3]);
    // bleu0 3 would stop on bleu1: the partial plan itself is invalid, so nothing is offered.
    const none = nextSteps(viewFor(state, "bleu"), "bleu", CARD, partial);
    expect(Object.values(none).every((steps) => (steps ?? []).length === 0)).toBe(true);

    const ok = nextSteps(viewFor(state, "bleu"), "bleu", CARD, plan(["bleu1", 2]));
    // 5 steps remain: every offer must be completable, so a step count above 5 never appears.
    for (const steps of Object.values(ok)) {
      for (const s of steps ?? []) expect(s).toBeLessThanOrEqual(5);
    }
    const expected = firstSteps(state, plan(["bleu1", 2]));
    for (const id of ["bleu0", "bleu1"] as const) {
      const got = new Set(ok[id] ?? []);
      for (const s of expected.get(id) ?? []) expect(got.has(s)).toBe(true);
    }
  });

  it("the last pawn can be extended: its steps merge with the previous entry", () => {
    const state = bleuOnly([{ p: 5 }, { p: 8 }, "S", "S"]);
    const offered = nextSteps(viewFor(state, "bleu"), "bleu", CARD, plan(["bleu1", 2]));
    // bleu1 2 then 3 more is the single step 5 for bleu1: 8 -> 13, legal.
    expect(offered.bleu1).toContain(3);
  });

  it("offers the partner's pawns once the fourth pawn has entered the home mid-plan", () => {
    const state = playState(
      {
        bleu: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 69 }],
        rouge: [{ p: 10 }, "S", "S", "S"],
      },
      { bleu: [CARD] },
      "bleu",
    );
    const offered = nextSteps(viewFor(state, "bleu"), "bleu", CARD, plan(["bleu3", 2]));
    expect(offered.rouge0).toEqual([1, 2, 3, 4, 5]);
  });
});

/** Four bleu pawns, each stopped by a protected pawn of another colour (or by the home). */
function hemmed(): GameState {
  return playState(
    {
      bleu: [{ p: 17 }, { p: 35 }, { p: 53 }, { h: 3 }],
      jaune: [{ p: 0 }, "S", "S", "S"],
      rouge: [{ p: 0 }, "S", "S", "S"],
      vert: [{ p: 0 }, "S", "S", "S"],
    },
    { bleu: [CARD] },
    "bleu",
  );
}

describe("nextSteps stays under 5 ms (T-01-13)", () => {
  /** Best of several runs after a warm-up: robust against a cold JIT or a busy CI machine. */
  function bestMs(run: () => unknown): number {
    run();
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 7; i++) {
      const t0 = performance.now();
      run();
      best = Math.min(best, performance.now() - t0);
    }
    return best;
  }

  const boards: [string, GameState][] = [
    ["nothing completes: four controllable pawns, every one hemmed in", hemmed()],
    [
      "nothing completes: three pawns with two free cells each, one home pawn stuck",
      playState(
        {
          bleu: [{ p: 15 }, { p: 33 }, { p: 51 }, { h: 3 }],
          jaune: [{ p: 0 }, "S", "S", "S"],
          rouge: [{ p: 0 }, "S", "S", "S"],
          vert: [{ p: 0 }, "S", "S", "S"],
        },
        { bleu: [CARD] },
        "bleu",
      ),
    ],
    [
      "open board: four free pawns among opponents",
      playState(
        {
          bleu: [{ p: 3 }, { p: 10 }, { p: 20 }, { p: 30 }],
          jaune: [{ p: 67 }, { p: 50 }, { p: 40 }, "S"],
          rouge: [{ p: 45 }, { p: 60 }, "S", "S"],
          vert: [{ p: 12 }, "S", "S", "S"],
        },
        { bleu: [CARD] },
        "bleu",
      ),
    ],
    [
      "dead ends everywhere: one free pawn, three pawns stuck behind each other",
      playState(
        {
          bleu: [{ p: 40 }, { p: 41 }, { p: 42 }, { p: 43 }],
          rouge: [{ p: 0 }, "S", "S", "S"],
        },
        { bleu: [CARD] },
        "bleu",
      ),
    ],
  ];

  for (const [name, state] of boards) {
    it(name, () => {
      const view = viewFor(state, "bleu");
      const ms = bestMs(() => nextSteps(view, "bleu", CARD, []));
      expect(ms).toBeLessThan(5);
      const playable = bestMs(() => playability(view, "bleu"));
      expect(playable).toBeLessThan(5);
    });
  }

  it("hemmed-in boards offer nothing and open boards offer something", () => {
    const none = nextSteps(viewFor(hemmed(), "bleu"), "bleu", CARD, []);
    expect(Object.values(none).every((steps) => (steps ?? []).length === 0)).toBe(true);
    const open = nextSteps(viewFor(boards[2]?.[1] as GameState, "bleu"), "bleu", CARD, []);
    expect(Object.values(open).some((steps) => (steps ?? []).length > 0)).toBe(true);
  });
});
