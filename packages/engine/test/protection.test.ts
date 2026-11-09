// G18 (RULES.md R-12, « Décisions de Romain », 2026-10-19): only a knight that came out of its stable
// onto its own losange is protected there, and it stays protected until it moves. Every other arrival
// on its own losange (an extra lap or a missed entry, a Valet swap, a 4 backwards) gives an ordinary
// knight: passed, eaten and swapped like any other. Its own knight on the losange, protected or
// ordinary, still makes a second exit impossible (« Garde le blocage »).
// A ring pawn saved before G18 carries no flag: it is read as protected iff it stands on its own
// losange at progress 0, and upgradeState writes that default out.

import { describe, expect, it } from "vitest";
import {
  type Action,
  apply,
  applyPlan,
  type Color,
  DEFAULT_RULES,
  type GameState,
  isProtected,
  legalActions,
  movesForCard,
  type Pawn,
  type PawnId,
  sameAction,
  upgradeState,
} from "../src/index.ts";
import { playState } from "./helpers.ts";

function actionsOf(state: GameState, seat: Color, card: Parameters<typeof movesForCard>[2]) {
  return movesForCard(state, seat, card).map((c) => c.action);
}

function holds(list: Action[], action: Action): boolean {
  return list.some((each) => sameAction(each, action));
}

function protectedIn(state: GameState, id: PawnId): boolean {
  return isProtected(id, state.pawns[id], state.rules);
}

/** A state as a Durable Object saved it before G18: no flag on the pawns, no switch in the rules. */
function oldShape(state: GameState): GameState {
  const old = JSON.parse(JSON.stringify(state)) as GameState;
  for (const pawn of Object.values(old.pawns) as Pawn[]) {
    if (pawn.zone === "ring") delete (pawn as { justOut?: boolean }).justOut;
  }
  delete (old.rules as Partial<typeof old.rules>).EXIT_ONLY_PROTECTION;
  return old;
}

describe("G18 EXIT_ONLY_PROTECTION: the knight just out of its stable", () => {
  it("is the rule in force", () => {
    expect(DEFAULT_RULES.EXIT_ONLY_PROTECTION).toBe(true);
  });

  it("an As brings it out protected: nobody passes it, lands on it or swaps it", () => {
    const start = playState(
      {
        bleu: ["S", "S", "S", "S"],
        // jaune0 on cell 70, two cells before bleu's losange (cell 0); vert0 on cell 64.
        jaune: [{ p: 52 }, "S", "S", "S"],
        vert: [{ p: 10 }, "S", "S", "S"],
      },
      { bleu: ["1S"], jaune: ["3H", "2H"], vert: ["11C"] },
      "bleu",
    );
    const out = apply(start, "bleu", { t: "exit", card: "1S", pawn: "bleu0" }).state;
    expect(out.pawns.bleu0).toEqual({ zone: "ring", progress: 0, justOut: true });
    expect(protectedIn(out, "bleu0")).toBe(true);
    expect(actionsOf(out, "jaune", "3H")).toEqual([]);
    expect(actionsOf(out, "jaune", "2H")).toEqual([]);
    expect(
      holds(actionsOf(out, "vert", "11C"), {
        t: "swap",
        card: "11C",
        pawn: "vert0",
        target: "bleu0",
      }),
    ).toBe(false);
  });

  it("stays protected over the other seats' turns and its partner's moves, and loses it on its first move", () => {
    let state = playState(
      {
        bleu: ["S", { p: 20 }, "S", "S"],
        jaune: [{ p: 20 }, "S", "S", "S"],
        rouge: [{ p: 10 }, "S", "S", "S"],
        vert: [{ p: 10 }, "S", "S", "S"],
      },
      { bleu: ["1S", "2S", "3S"], jaune: ["5H", "6H"], rouge: ["2D", "3D"], vert: ["2C", "3C"] },
      "bleu",
    );
    const plays: [Color, Action][] = [
      ["bleu", { t: "exit", card: "1S", pawn: "bleu0" }],
      ["jaune", { t: "move", card: "5H", pawn: "jaune0" }],
      ["rouge", { t: "move", card: "2D", pawn: "rouge0" }],
      ["vert", { t: "move", card: "2C", pawn: "vert0" }],
      ["bleu", { t: "move", card: "2S", pawn: "bleu1" }],
      ["jaune", { t: "move", card: "6H", pawn: "jaune0" }],
      ["rouge", { t: "move", card: "3D", pawn: "rouge0" }],
      ["vert", { t: "move", card: "3C", pawn: "vert0" }],
    ];
    for (const [seat, action] of plays) {
      state = apply(state, seat, action).state;
      expect(protectedIn(state, "bleu0"), JSON.stringify(action)).toBe(true);
    }
    state = apply(state, "bleu", { t: "move", card: "3S", pawn: "bleu0" }).state;
    expect(state.pawns.bleu0).toEqual({ zone: "ring", progress: 3, justOut: false });
    expect(protectedIn(state, "bleu0")).toBe(false);
  });

  it("a Roi brings it out protected too", () => {
    const start = playState({}, { rouge: ["13D"] }, "rouge");
    const out = apply(start, "rouge", { t: "exit", card: "13D", pawn: "rouge0" }).state;
    expect(protectedIn(out, "rouge0")).toBe(true);
  });
});

describe("G18: every other arrival on its own losange gives an ordinary knight", () => {
  it("after an extra lap: passed by a 3, eaten by a 2, swapped by the Valet, eaten in passing by the 7", () => {
    const state = playState(
      {
        bleu: [{ p: 72 }, "S", "S", "S"],
        jaune: [{ p: 52 }, "S", "S", "S"],
        vert: [{ p: 10 }, "S", "S", "S"],
      },
      { jaune: ["3H", "2H", "7H"], vert: ["11C"] },
      "jaune",
    );
    expect(protectedIn(state, "bleu0")).toBe(false);
    expect(holds(actionsOf(state, "jaune", "3H"), { t: "move", card: "3H", pawn: "jaune0" })).toBe(
      true,
    );
    const eaten = apply(state, "jaune", { t: "move", card: "2H", pawn: "jaune0" });
    expect(eaten.state.pawns.bleu0).toEqual({ zone: "stable" });
    expect(
      holds(actionsOf(state, "vert", "11C"), {
        t: "swap",
        card: "11C",
        pawn: "vert0",
        target: "bleu0",
      }),
    ).toBe(true);
    const seven = applyPlan(state, "jaune", "7H", [{ pawn: "jaune0", steps: 7 }]);
    expect(seven.ok && seven.captured).toEqual(["bleu0"]);
  });

  it("after a missed entry (the target slot is taken, R-13): it stops on its 18 as an ordinary knight", () => {
    // bleu0 crosses its carré 16 with 2 steps beyond it: slot 1 is taken, so it goes on to its 18.
    const start = playState(
      { bleu: [{ p: 69 }, { h: 1 }, "S", "S"], jaune: [{ p: 52 }, "S", "S", "S"] },
      { bleu: ["3S"], jaune: ["3H"] },
      "bleu",
    );
    const after = apply(start, "bleu", { t: "move", card: "3S", pawn: "bleu0" }).state;
    expect(after.pawns.bleu0).toEqual({ zone: "ring", progress: 72, justOut: false });
    expect(protectedIn(after, "bleu0")).toBe(false);
    expect(holds(actionsOf(after, "jaune", "3H"), { t: "move", card: "3H", pawn: "jaune0" })).toBe(
      true,
    );
  });

  it("after a Valet swap onto its 18: ordinary, a rival lands on it and eats it", () => {
    // bleu0 stands on cell 18, jaune's losange; the Valet sends jaune0 there.
    const start = playState(
      {
        bleu: [{ p: 18 }, "S", "S", "S"],
        jaune: [{ p: 30 }, "S", "S", "S"],
        rouge: [{ p: 51 }, "S", "S", "S"],
      },
      { bleu: ["11S"], rouge: ["3D", "5D"] },
      "bleu",
    );
    const after = apply(start, "bleu", {
      t: "swap",
      card: "11S",
      pawn: "bleu0",
      target: "jaune0",
    }).state;
    expect(after.pawns.jaune0).toEqual({ zone: "ring", progress: 0, justOut: false });
    expect(after.pawns.bleu0).toEqual({ zone: "ring", progress: 48, justOut: false });
    expect(protectedIn(after, "jaune0")).toBe(false);
    const land = movesForCard(after, "rouge", "3D").find((c) => c.action.t === "move");
    expect(land?.walk?.captures).toEqual([{ victim: "jaune0", atStep: 2 }]);
    expect(holds(actionsOf(after, "rouge", "5D"), { t: "move", card: "5D", pawn: "rouge0" })).toBe(
      true,
    );
  });

  it("after a 4 backwards onto its 18 (progress 4 to 0): ordinary, passed and eaten", () => {
    const start = playState(
      { vert: [{ p: 4 }, "S", "S", "S"], bleu: [{ p: 50 }, { p: 52 }, "S", "S"] },
      { vert: ["4C"], bleu: ["6S", "2S"] },
      "vert",
    );
    const after = apply(start, "vert", { t: "move", card: "4C", pawn: "vert0" }).state;
    expect(after.pawns.vert0).toEqual({ zone: "ring", progress: 0, justOut: false });
    expect(protectedIn(after, "vert0")).toBe(false);
    expect(holds(actionsOf(after, "bleu", "6S"), { t: "move", card: "6S", pawn: "bleu0" })).toBe(
      true,
    );
    const land = movesForCard(after, "bleu", "2S").find(
      (c) => c.action.t === "move" && c.action.pawn === "bleu1",
    );
    expect(land?.walk?.captures).toEqual([{ victim: "vert0", atStep: 1 }]);
  });

  it("its own ordinary knight on the losange still blocks a second exit (« Garde le blocage »)", () => {
    const state = playState({ jaune: [{ p: 72 }, "S", "S", "S"] }, { jaune: ["13S"] }, "jaune");
    expect(protectedIn(state, "jaune0")).toBe(false);
    const legal = legalActions(state, "jaune");
    expect(holds(legal, { t: "exit", card: "13S", pawn: "jaune1" })).toBe(false);
    expect(holds(legal, { t: "move", card: "13S", pawn: "jaune0" })).toBe(true);
  });
});

describe("G18: games saved before the flag", () => {
  const saved = (): GameState =>
    oldShape(
      playState(
        { bleu: [{ p: 0 }, { p: 72 }, { p: 5 }, "S"], jaune: [{ p: 0 }, "S", "S", "S"] },
        { bleu: ["2S"] },
        "bleu",
      ),
    );

  it("a pawn without the flag is protected iff it stands on its own losange at progress 0", () => {
    const old = saved();
    const rules = DEFAULT_RULES;
    expect(isProtected("bleu0", old.pawns.bleu0, rules)).toBe(true);
    expect(isProtected("bleu1", old.pawns.bleu1, rules)).toBe(false);
    expect(isProtected("bleu2", old.pawns.bleu2, rules)).toBe(false);
  });

  it("upgradeState writes the default flag on every ring pawn and fills the missing switch", () => {
    const old = saved();
    const before = JSON.stringify(old);
    const up = upgradeState(old);
    expect(JSON.stringify(old)).toBe(before);
    expect(up.rules.EXIT_ONLY_PROTECTION).toBe(true);
    expect(up.pawns.bleu0).toEqual({ zone: "ring", progress: 0, justOut: true });
    expect(up.pawns.bleu1).toEqual({ zone: "ring", progress: 72, justOut: false });
    expect(up.pawns.bleu2).toEqual({ zone: "ring", progress: 5, justOut: false });
    expect(up.pawns.jaune0).toEqual({ zone: "ring", progress: 0, justOut: true });
    expect(up.pawns.bleu3).toEqual({ zone: "stable" });
    // An up-to-date state goes through unchanged.
    expect(upgradeState(up)).toEqual(up);
    // The upgraded game plays on: bleu0 is still protected, bleu1 is not.
    const next = apply(up, "bleu", { t: "move", card: "2S", pawn: "bleu2" }).state;
    expect(protectedIn(next, "bleu0")).toBe(true);
    expect(protectedIn(next, "bleu1")).toBe(false);
  });

  it("upgradeState keeps a switch the saved game already had", () => {
    const old = saved();
    const off = upgradeState({ ...old, rules: { ...old.rules, EXIT_ONLY_PROTECTION: false } });
    expect(off.rules.EXIT_ONLY_PROTECTION).toBe(false);
  });
});

describe("G18 off: the rule of 2026-10-13 (protection by position, G3)", () => {
  it("a knight back on its losange after a lap is protected again when G3 is on", () => {
    const state = playState(
      { bleu: [{ p: 72 }, "S", "S", "S"], rouge: [{ p: 34 }, "S", "S", "S"] },
      { rouge: ["3S"] },
      "rouge",
      { EXIT_ONLY_PROTECTION: false },
    );
    expect(protectedIn(state, "bleu0")).toBe(true);
    expect(actionsOf(state, "rouge", "3S")).toEqual([]);
  });
});
