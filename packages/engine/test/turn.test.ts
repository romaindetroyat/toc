// The turn: legalActions, playability, apply and resolveMove (RULE-04, RULE-14 to RULE-18 and the probes
// of plan 01-12). Positions are built with scenarioState via the test helpers.

import { describe, expect, it } from "vitest";
import {
  type Action,
  apply,
  type GameEvent,
  type GameState,
  IllegalActionError,
  legalActions,
  playability,
  resolveMove,
  viewFor,
} from "../src/index.ts";
import { playState } from "./helpers.ts";

const BLEU_HOME: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }] = [
  { h: 0 },
  { h: 1 },
  { h: 2 },
  { h: 3 },
];

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

const kinds = (events: GameEvent[]) => events.map((e) => e.t);

describe("apply rejects what legalActions does not list (T-01-09)", () => {
  const state = () =>
    playState({ bleu: [{ p: 5 }, "S", "S", "S"] }, { bleu: ["3S"], jaune: ["2H"] }, "bleu");

  it("throws IllegalActionError and leaves the input state unchanged", () => {
    const s = deepFreeze(state());
    const snapshot = JSON.stringify(s);
    const bad: Action[] = [
      { t: "move", card: "3S", pawn: "bleu1" },
      { t: "move", card: "2H", pawn: "bleu0" },
      { t: "discard" },
    ];
    for (const action of bad) {
      expect(() => apply(s, "bleu", action)).toThrow(IllegalActionError);
    }
    expect(JSON.stringify(s)).toBe(snapshot);
  });

  it("only the seat whose turn it is may play", () => {
    const s = state();
    expect(legalActions(s, "jaune")).toEqual([]);
    expect(() => apply(s, "jaune", { t: "move", card: "2H", pawn: "jaune0" })).toThrow(
      IllegalActionError,
    );
  });

  it("carries a code on the error", () => {
    try {
      apply(state(), "jaune", { t: "discard" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(IllegalActionError);
      expect((error as IllegalActionError).code).toBe("not-your-turn");
    }
  });

  it("does not mutate a frozen input when the move is legal", () => {
    const s = deepFreeze(state());
    const out = apply(s, "bleu", { t: "move", card: "3S", pawn: "bleu0" });
    expect(out.state.pawns.bleu0).toEqual({ zone: "ring", progress: 8 });
    expect(s.pawns.bleu0).toEqual({ zone: "ring", progress: 5 });
  });
});

describe("a move (RULE-04)", () => {
  it("emits cardPlayed, the movement, the capture, then the turn; the card goes to the discard pile", () => {
    const s = playState(
      { bleu: [{ p: 5 }, "S", "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
      { bleu: ["3S"], jaune: ["2H"] },
      "bleu",
    );
    const out = apply(s, "bleu", { t: "move", card: "3S", pawn: "bleu0" });
    expect(kinds(out.events)).toEqual([
      "cardPlayed",
      "pawnMoved",
      "pawnCaptured",
      "pawnSentHome",
      "turn",
    ]);
    expect(out.state.hands.bleu).toEqual([]);
    expect(out.state.discard).toContain("3S");
    expect(out.state.lastPlayed.bleu).toBe("3S");
    expect(out.state.captures).toEqual({ "bleu-rouge": 1, "jaune-vert": 0 });
    expect(out.state.turn).toBe("jaune");
  });

  it("passes the turn clockwise to the next seat that still holds cards", () => {
    const s = playState(
      { vert: [{ p: 0 }, "S", "S", "S"] },
      { vert: ["2C", "5C"], rouge: ["4D"] },
      "vert",
    );
    const out = apply(s, "vert", { t: "move", card: "2C", pawn: "vert0" });
    expect(out.state.turn).toBe("rouge");
  });

  it("resolveMove on the view gives the same pawns and movement events as apply", () => {
    const s = playState(
      { bleu: [{ p: 66 }, "S", "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
      { bleu: ["6S"], jaune: ["2H"] },
      "bleu",
    );
    const action: Action = { t: "move", card: "6S", pawn: "bleu0" };
    const preview = resolveMove(viewFor(s, "bleu"), "bleu", action);
    const real = apply(s, "bleu", action);
    expect(preview.pawns).toEqual(real.state.pawns);
    const movement = real.events.filter((e) => e.t !== "cardPlayed" && e.t !== "turn");
    expect(preview.events).toEqual(movement);
  });

  it("resolveMove refuses an action that is not a legal movement", () => {
    const s = playState({ bleu: [{ p: 5 }, "S", "S", "S"] }, { bleu: ["3S"] }, "bleu");
    expect(() => resolveMove(viewFor(s, "bleu"), "bleu", { t: "discard" })).toThrow(
      IllegalActionError,
    );
    expect(() =>
      resolveMove(viewFor(s, "bleu"), "bleu", { t: "move", card: "3S", pawn: "bleu3" }),
    ).toThrow(IllegalActionError);
  });
});

describe("dead hand (RULE-16)", () => {
  it("a discard lays the whole hand face up, emits handDiscarded and skips the seat", () => {
    const s = playState({}, { bleu: ["2S", "4S"], jaune: ["3H"] }, "bleu");
    expect(legalActions(s, "bleu")).toEqual([{ t: "discard" }]);
    const out = apply(s, "bleu", { t: "discard" });
    expect(out.state.hands.bleu).toEqual([]);
    expect(out.state.posed.bleu).toEqual(["2S", "4S"]);
    expect(kinds(out.events)).toEqual(["handDiscarded", "turn"]);
    expect(out.state.turn).toBe("jaune");
    expect(legalActions(out.state, "bleu")).toEqual([]);
  });

  it("a hand with a playable card never offers the discard", () => {
    const s = playState({ bleu: [{ p: 5 }, "S", "S", "S"] }, { bleu: ["3S", "11S"] }, "bleu");
    const list = legalActions(s, "bleu");
    expect(list).toEqual([{ t: "move", card: "3S", pawn: "bleu0" }]);
  });

  it("the last card of the last hand ends the deal and starts the next one", () => {
    const s = playState({ bleu: [{ p: 5 }, "S", "S", "S"] }, { bleu: ["3S"] }, "bleu");
    const out = apply(s, "bleu", { t: "move", card: "3S", pawn: "bleu0" });
    expect(out.state.phase).toBe("exchange");
    expect(out.state.dealIndex).toBe(1);
    expect(out.state.hands.bleu).toHaveLength(4);
    expect(kinds(out.events)).toEqual([
      "cardPlayed",
      "pawnMoved",
      "turn",
      "dealt",
      "handDealt",
      "handDealt",
      "handDealt",
      "handDealt",
    ]);
  });
});

describe("the finished player (RULE-17)", () => {
  it("plays the partner's pawns with every card, the As included", () => {
    const s = playState(
      { bleu: BLEU_HOME, rouge: [{ p: 10 }, "S", "S", "S"] },
      { bleu: ["1S"] },
      "bleu",
    );
    expect(legalActions(s, "bleu")).toEqual([
      { t: "move", card: "1S", pawn: "rouge0" },
      { t: "exit", card: "1S", pawn: "rouge1" },
    ]);
  });

  it("emits playerFinished once, when the fourth pawn arrives", () => {
    const s = playState(
      { bleu: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 66 }] },
      { bleu: ["5S", "1S"], jaune: ["3H"] },
      "bleu",
    );
    const out = apply(s, "bleu", { t: "move", card: "5S", pawn: "bleu3" });
    expect(kinds(out.events)).toEqual(["cardPlayed", "pawnEnteredHome", "playerFinished", "turn"]);
    const entered = out.events.find((e) => e.t === "pawnEnteredHome");
    expect(entered).toMatchObject({ pawn: "bleu3", slot: 0, homeCount: 4 });
    expect(out.events.find((e) => e.t === "playerFinished")).toEqual({
      t: "playerFinished",
      seat: "bleu",
      partner: "rouge",
    });
    // The next card of the finished player is played with the partner's pawns; no second event.
    const later = apply({ ...out.state, turn: "bleu" }, "bleu", {
      t: "exit",
      card: "1S",
      pawn: "rouge0",
    });
    expect(later.events.some((e) => e.t === "playerFinished")).toBe(false);
  });
});

describe("the win (RULE-18)", () => {
  const winning = () =>
    playState(
      { bleu: BLEU_HOME, rouge: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 66 }] },
      { rouge: ["5S", "2H"], jaune: ["3H"] },
      "rouge",
    );

  it("the eighth pawn home emits gameWon and nothing after it", () => {
    const out = apply(winning(), "rouge", { t: "move", card: "5S", pawn: "rouge3" });
    expect(kinds(out.events)).toEqual(["cardPlayed", "pawnEnteredHome", "gameWon"]);
    expect(out.events[2]).toEqual({ t: "gameWon", team: "bleu-rouge" });
    expect(out.state.phase).toBe("won");
    expect(out.state.winner).toBe("bleu-rouge");
  });

  it("after gameWon, no seat has an action and apply throws", () => {
    const won = apply(winning(), "rouge", { t: "move", card: "5S", pawn: "rouge3" }).state;
    for (const seat of ["bleu", "jaune", "rouge", "vert"] as const) {
      expect(legalActions(won, seat)).toEqual([]);
    }
    expect(() => apply(won, "jaune", { t: "discard" })).toThrow(IllegalActionError);
    expect(() => apply(won, "rouge", { t: "move", card: "2H", pawn: "rouge0" })).toThrow(
      IllegalActionError,
    );
  });
});

describe("the exchange through apply", () => {
  const exchange = (): GameState => {
    const base = playState(
      {},
      { bleu: ["2S"], jaune: ["3S"], rouge: ["4S"], vert: ["5S"] },
      "bleu",
    );
    return { ...base, phase: "exchange" };
  };

  it("offers one give per card to a seat that has not given, none after", () => {
    const s = exchange();
    expect(legalActions(s, "bleu")).toEqual([{ t: "give", card: "2S" }]);
    const out = apply(s, "bleu", { t: "give", card: "2S" });
    expect(legalActions(out.state, "bleu")).toEqual([]);
    expect(() => apply(out.state, "bleu", { t: "give", card: "2S" })).toThrow(IllegalActionError);
  });
});

describe("probes RULE-05 / RULE-06", () => {
  it("adjacency: As onto an exit held by one's own pawn is illegal, onto another colour it captures", () => {
    const own = playState({ bleu: [{ p: 0 }, "S", "S", "S"] }, { bleu: ["1S"] }, "bleu");
    expect(legalActions(own, "bleu")).toEqual([{ t: "move", card: "1S", pawn: "bleu0" }]);
    const other = playState({ jaune: [{ p: 54 }, "S", "S", "S"] }, { bleu: ["13H"] }, "bleu");
    expect(legalActions(other, "bleu")).toContainEqual({ t: "exit", card: "13H", pawn: "bleu0" });
    const out = apply(other, "bleu", { t: "exit", card: "13H", pawn: "bleu0" });
    expect(out.state.pawns.jaune0).toEqual({ zone: "stable" });
    expect(out.state.pawns.bleu0).toEqual({ zone: "ring", progress: 0 });
  });

  it("empty stable: the As and the Roi only advance", () => {
    const s = playState(
      { bleu: [{ p: 5 }, { p: 10 }, { p: 20 }, { h: 0 }] },
      { bleu: ["1S", "13S"] },
      "bleu",
    );
    expect(legalActions(s, "bleu").every((a) => a.t === "move")).toBe(true);
  });

  it("empty: no movable pawn and no stable pawn gives no-pawn-can-move", () => {
    const s = playState(
      { bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }] },
      { bleu: ["4S"] },
      "bleu",
    );
    // A finished seat plays the partner's pawns, which are all in the stable here: nothing to back up.
    expect(playability(viewFor(s, "bleu"), "bleu")["4S"]).toEqual({
      playable: false,
      reason: "no-pawn-can-move",
    });
  });

  it("ordering: the same state always yields the same list, in hand order then pawn index", () => {
    const s = playState({ bleu: [{ p: 5 }, { p: 9 }, "S", "S"] }, { bleu: ["2S", "13S"] }, "bleu");
    const first = legalActions(s, "bleu");
    expect(legalActions(s, "bleu")).toEqual(first);
    expect(first).toEqual([
      { t: "move", card: "2S", pawn: "bleu0" },
      { t: "move", card: "2S", pawn: "bleu1" },
      { t: "move", card: "13S", pawn: "bleu0" },
      { t: "move", card: "13S", pawn: "bleu1" },
      { t: "exit", card: "13S", pawn: "bleu2" },
    ]);
  });
});
