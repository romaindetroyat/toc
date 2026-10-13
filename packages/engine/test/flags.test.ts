// Each validated rule constant read through state.rules: both values behave as RULES.md describes
// (« Décisions de Romain »). Single movement path: movesForCard() and swapEnds() from moves.ts.

import { describe, expect, it } from "vitest";
import { type Action, controlledPawns, movesForCard, type PawnId, swapEnds } from "../src/index.ts";
import { board, playState } from "./helpers.ts";

const BLEU_HOME: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }] = [
  { h: 0 },
  { h: 1 },
  { h: 2 },
  { h: 3 },
];

function actions(
  state: ReturnType<typeof playState>,
  seat: "bleu" | "jaune" | "rouge" | "vert",
  card: Parameters<typeof movesForCard>[2],
): Action[] {
  return movesForCard(state, seat, card).map((c) => c.action);
}

describe("controlledPawns (RULE-17)", () => {
  it("is the seat's own four pawns while one of them is not home", () => {
    const s = playState(
      { bleu: [{ p: 3 }, { h: 0 }, { h: 1 }, { h: 2 }] },
      { bleu: ["2S"] },
      "bleu",
    );
    expect(controlledPawns(s, "bleu")).toEqual(["bleu0", "bleu1", "bleu2", "bleu3"]);
  });

  it("is the partner's pawns once the four of the seat are home", () => {
    const s = playState({ bleu: BLEU_HOME }, { bleu: ["2S"] }, "bleu");
    expect(controlledPawns(s, "bleu")).toEqual(["rouge0", "rouge1", "rouge2", "rouge3"]);
    expect(controlledPawns(s, "jaune")).toEqual(["jaune0", "jaune1", "jaune2", "jaune3"]);
  });
});

describe("G1 SWAP_PROGRESS", () => {
  const b = (value: "position" | "keep") =>
    board({ bleu0: { p: 80 }, jaune0: { p: 20 } }, { SWAP_PROGRESS: value });

  it("position: each pawn takes the progress of its new cell (R-09.8)", () => {
    expect(swapEnds(b("position"), "bleu0", "jaune0")).toEqual({
      aEnd: { zone: "ring", progress: 38 },
      bEnd: { zone: "ring", progress: 62 },
    });
  });

  it("keep: each pawn keeps the laps already done (R-09.9)", () => {
    expect(swapEnds(b("keep"), "bleu0", "jaune0")).toEqual({
      aEnd: { zone: "ring", progress: 110 },
      bEnd: { zone: "ring", progress: 62 },
    });
  });

  it("position gives the default numbers of R-09.1 and R-09.2", () => {
    expect(swapEnds(board({ bleu0: { p: 10 }, jaune0: { p: 20 } }), "bleu0", "jaune0")).toEqual({
      aEnd: { zone: "ring", progress: 38 },
      bEnd: { zone: "ring", progress: 64 },
    });
    expect(swapEnds(board({ bleu0: { p: 10 }, rouge0: { p: 12 } }), "bleu0", "rouge0")).toEqual({
      aEnd: { zone: "ring", progress: 48 },
      bEnd: { zone: "ring", progress: 46 },
    });
  });
});

describe("G2 HOME_JUMP_BLOCKED", () => {
  const state = (value: "continue" | "illegal") =>
    playState({ bleu: [{ p: 66 }, { h: 0 }, "S", "S"] }, { bleu: ["8S"] }, "bleu", {
      HOME_JUMP_BLOCKED: value,
    });
  const move: Action = { t: "move", card: "8S", pawn: "bleu0" };

  it("continue: the pawn goes round again (R-13.7)", () => {
    expect(actions(state("continue"), "bleu", "8S")).toContainEqual(move);
  });

  it("illegal: the move is forbidden", () => {
    expect(actions(state("illegal"), "bleu", "8S")).not.toContainEqual(move);
  });
});

describe("G3 PROTECTED_AFTER_EXTRA_LAP", () => {
  const state = (value: boolean) =>
    playState(
      { bleu: [{ p: 72 }, "S", "S", "S"], rouge: [{ p: 34 }, "S", "S", "S"] },
      { rouge: ["3S"] },
      "rouge",
      { PROTECTED_AFTER_EXTRA_LAP: value },
    );
  const move: Action = { t: "move", card: "3S", pawn: "rouge0" };

  it("true: the pawn back on its exit after a lap blocks the passage (R-12.9)", () => {
    expect(actions(state(true), "rouge", "3S")).not.toContainEqual(move);
  });

  it("false: it is an ordinary pawn", () => {
    expect(actions(state(false), "rouge", "3S")).toContainEqual(move);
  });
});

describe("G4 PROTECTED_BLOCKS_OWNER", () => {
  const state = (value: boolean) =>
    playState({ bleu: [{ p: 0 }, { p: 2 }, "S", "S"] }, { bleu: ["4S"] }, "bleu", {
      PROTECTED_BLOCKS_OWNER: value,
    });
  const back1: Action = { t: "move", card: "4S", pawn: "bleu1" };

  it("true: the protected pawn also blocks the other pawns of its colour (R-08.5)", () => {
    expect(actions(state(true), "bleu", "4S")).not.toContainEqual(back1);
  });

  it("false: only the other colours are blocked", () => {
    expect(actions(state(false), "bleu", "4S")).toContainEqual(back1);
  });
});

describe("G6 SWAP_OWN_PROTECTED", () => {
  const state = (value: boolean) =>
    playState(
      { bleu: [{ p: 0 }, "S", "S", "S"], jaune: [{ p: 20 }, "S", "S", "S"] },
      { bleu: ["11S"] },
      "bleu",
      { SWAP_OWN_PROTECTED: value },
    );
  const swap: Action = { t: "swap", card: "11S", pawn: "bleu0", target: "jaune0" };

  it("false: my protected pawn cannot be swapped (R-09.6)", () => {
    expect(actions(state(false), "bleu", "11S")).not.toContainEqual(swap);
  });

  it("true: it can", () => {
    expect(actions(state(true), "bleu", "11S")).toContainEqual(swap);
  });

  it("a protected target is never swapped, whatever the value (R-12.4)", () => {
    const s = playState(
      { bleu: [{ p: 10 }, "S", "S", "S"], jaune: [{ p: 0 }, "S", "S", "S"] },
      { bleu: ["11S"] },
      "bleu",
      { SWAP_OWN_PROTECTED: true },
    );
    expect(actions(s, "bleu", "11S")).toEqual([]);
  });
});

describe("G7 FINISHED_PARTNER_PAWNS_ARE_OWN", () => {
  const eat = (value: boolean) =>
    playState(
      { bleu: BLEU_HOME, rouge: [{ p: 10 }, { p: 12 }, "S", "S"] },
      { bleu: ["2S"] },
      "bleu",
      { FINISHED_PARTNER_PAWNS_ARE_OWN: value },
    );
  const land: Action = { t: "move", card: "2S", pawn: "rouge0" };

  it("true: the partner's pawns are mine, I cannot stop on one of them", () => {
    expect(actions(eat(true), "bleu", "2S")).not.toContainEqual(land);
  });

  it("false: the partner's other pawn is not mine, stopping on it eats it", () => {
    expect(actions(eat(false), "bleu", "2S")).toContainEqual(land);
  });

  it("the Jack swaps a partner pawn with an adversary in both cases (R-15.4)", () => {
    for (const value of [true, false]) {
      const s = playState(
        { bleu: BLEU_HOME, rouge: [{ p: 10 }, "S", "S", "S"], jaune: [{ p: 20 }, "S", "S", "S"] },
        { bleu: ["11S"] },
        "bleu",
        { FINISHED_PARTNER_PAWNS_ARE_OWN: value },
      );
      expect(actions(s, "bleu", "11S")).toContainEqual({
        t: "swap",
        card: "11S",
        pawn: "rouge0",
        target: "jaune0",
      });
    }
  });
});

describe("G10 ONLY_OWN_PAWNS_MOVE", () => {
  const state = (value: boolean) =>
    playState(
      {
        bleu: [{ p: 5 }, "S", "S", "S"],
        rouge: [{ p: 10 }, "S", "S", "S"],
        jaune: [{ p: 7 }, "S", "S", "S"],
      },
      { bleu: ["5S", "6S"] },
      "bleu",
      { ONLY_OWN_PAWNS_MOVE: value },
    );
  const ids = (list: Action[]): PawnId[] => list.flatMap((a) => (a.t === "move" ? [a.pawn] : []));

  it("true: the 5 moves my own pawns only (R-07.3)", () => {
    expect(ids(actions(state(true), "bleu", "5S"))).toEqual(["bleu0"]);
  });

  it("false: the 5 may move any pawn on the ring, the other cards still only mine", () => {
    expect(ids(actions(state(false), "bleu", "5S"))).toEqual(["bleu0", "jaune0", "rouge0"]);
    expect(ids(actions(state(false), "bleu", "6S"))).toEqual(["bleu0"]);
  });
});

describe("G11 ORDINARY_CARDS_PASS_OVER_PAWNS", () => {
  const state = (value: boolean) =>
    playState(
      { bleu: [{ p: 5 }, "S", "S", "S"], rouge: [{ p: 44 }, "S", "S", "S"] },
      { bleu: ["6S"] },
      "bleu",
      { ORDINARY_CARDS_PASS_OVER_PAWNS: value },
    );

  it("true: passing a pawn eats nothing (R-07.5)", () => {
    const [candidate] = movesForCard(state(true), "bleu", "6S");
    expect(candidate?.walk?.captures).toEqual([]);
  });

  it("false: ordinary cards also eat what they pass", () => {
    const [candidate] = movesForCard(state(false), "bleu", "6S");
    expect(candidate?.walk?.captures).toEqual([{ victim: "rouge0", atStep: 2 }]);
  });
});
