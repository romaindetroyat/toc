// G16, the knight that a card can bring home moves only to enter (RULES.md R-13, « Décisions de Romain »;
// decided by Romain on 2026-10-15, UAT test 26). It is judged card by card: « Seulement la carte qui le
// fait rentrer pile est obligée de le faire rentrer. Avec le 9, il peut continuer son tour. »
// Ordinary cards already do it (D-02, exact count); the 7 is the new case: a 7 whose split can leave a
// knight in its home brings it home or does not move it.
// Bleu's carré 16 is progress 70; from there 1 to 4 steps lead to home slots 0 to 3.

import { describe, expect, it } from "vitest";
import {
  type Action,
  apply,
  applyPlan,
  IllegalActionError,
  isComplete,
  legalActions,
  movesForCard,
  nextSteps,
  type PawnId,
  previewPlan,
  type SevenPlan,
  sevenMustEnter,
  sevenPlans,
  viewFor,
} from "../src/index.ts";
import { playState } from "./helpers.ts";

const plan = (...entries: [PawnId, number][]): SevenPlan =>
  entries.map(([pawn, steps]) => ({ pawn, steps }));

const key = (p: SevenPlan): string => JSON.stringify(p);

/** bleu0 two cells before its carré 16, bleu1 far away, a 7 in hand. */
const nearHome = () =>
  playState({ bleu: [{ p: 68 }, { p: 10 }, "S", "S"] }, { bleu: ["7S"] }, "bleu");

describe("ordinary cards, judged card by card (G16)", () => {
  it("bleu0 on its carré 16 with 2♠ 9♠: the 2 enters home slot 1, the 9 still goes round to 79 (G16)", () => {
    const state = playState({ bleu: [{ p: 70 }, "S", "S", "S"] }, { bleu: ["2S", "9S"] }, "bleu");
    const actions = legalActions(state, "bleu");
    expect(actions).toContainEqual({ t: "move", card: "2S", pawn: "bleu0" });
    expect(actions).toContainEqual({ t: "move", card: "9S", pawn: "bleu0" });
    const end = (card: "2S" | "9S") =>
      movesForCard(state, "bleu", card).find(
        (c) => c.action.t === "move" && c.action.pawn === "bleu0",
      )?.walk?.end;
    expect(end("2S")).toEqual({ zone: "home", slot: 1 });
    expect(end("9S")).toEqual({ zone: "ring", progress: 79 });
    const after = apply(state, "bleu", { t: "move", card: "9S", pawn: "bleu0" });
    expect(after.state.pawns.bleu0).toEqual({ zone: "ring", progress: 79 });
  });
});

describe("the 7 brings home the knight it can bring home, or leaves it (G16)", () => {
  it("sevenMustEnter lists bleu0, the knight a split of the 7 can bring home (G16)", () => {
    expect(sevenMustEnter(nearHome(), "bleu")).toEqual(["bleu0"]);
  });

  it("sevenPlans leaves out the splits that move bleu0 without bringing it home (G16)", () => {
    const listed = new Set(sevenPlans(nearHome(), "bleu", "7S").map(key));
    expect(listed.has(key(plan(["bleu0", 7])))).toBe(false);
    expect(listed.has(key(plan(["bleu0", 2], ["bleu1", 5])))).toBe(false);
    expect(listed.has(key(plan(["bleu0", 3], ["bleu1", 4])))).toBe(true);
    expect(listed.has(key(plan(["bleu0", 6], ["bleu1", 1])))).toBe(true);
    expect(listed.has(key(plan(["bleu1", 7])))).toBe(true);
    // every listed plan leaves bleu0 at 68 or in its home
    for (const p of sevenPlans(nearHome(), "bleu", "7S")) {
      const r = applyPlan(nearHome(), "bleu", "7S", p);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      const bleu0 = r.pawns.bleu0;
      expect(bleu0.zone === "home" || (bleu0.zone === "ring" && bleu0.progress === 68)).toBe(true);
    }
  });

  it("bleu0 may stop on its carré 16 and enter with a later step of the same 7 (G16)", () => {
    const r = applyPlan(nearHome(), "bleu", "7S", plan(["bleu0", 2], ["bleu1", 1], ["bleu0", 4]));
    expect(r.ok).toBe(true);
    expect(r.ok && r.pawns.bleu0).toEqual({ zone: "home", slot: 3 });
    expect(r.ok && r.pawns.bleu1).toEqual({ zone: "ring", progress: 11 });
  });

  it("nextSteps offers bleu0 1 to 6 steps, never 7 (G16)", () => {
    const state = nearHome();
    expect(nextSteps(state, "bleu", "7S", [])["bleu0"]).toEqual([1, 2, 3, 4, 5, 6]);
    expect(nextSteps(viewFor(state, "bleu"), "bleu", "7S", [])["bleu0"]).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    // bleu1 5 or 6 would leave bleu0 2 or 1 steps, which stop it short of its home.
    expect(nextSteps(state, "bleu", "7S", [])["bleu1"]).toEqual([1, 2, 3, 4, 7]);
  });

  it("after bleu0 2 then bleu1 5, the plan is refused with « must-enter » (G16)", () => {
    const state = nearHome();
    for (const bad of [plan(["bleu0", 7]), plan(["bleu0", 2], ["bleu1", 5])]) {
      expect(applyPlan(state, "bleu", "7S", bad)).toEqual({ ok: false, reason: "must-enter" });
      expect(isComplete(state, "bleu", "7S", bad)).toBe(false);
      const action: Action = { t: "seven", card: "7S", plan: bad };
      expect(() => apply(state, "bleu", action)).toThrow(IllegalActionError);
    }
  });

  it("previewPlan shows the unfinished [bleu0 2]: G16 judges the finished plan only (G16)", () => {
    const r = previewPlan(nearHome(), "bleu", "7S", plan(["bleu0", 2]));
    expect(r.ok).toBe(true);
    expect(r.ok && r.pawns.bleu0).toEqual({ zone: "ring", progress: 70 });
  });

  it("bleu0 alone on its carré 16: the 7 cannot bring it home, it goes round to 77 (G16)", () => {
    const state = playState({ bleu: [{ p: 70 }, "S", "S", "S"] }, { bleu: ["7S"] }, "bleu");
    expect(sevenMustEnter(state, "bleu")).toEqual([]);
    expect(sevenPlans(state, "bleu", "7S").map(key)).toEqual([key(plan(["bleu0", 7]))]);
    const r = applyPlan(state, "bleu", "7S", plan(["bleu0", 7]));
    expect(r.ok && r.pawns.bleu0).toEqual({ zone: "ring", progress: 77 });
  });
});
