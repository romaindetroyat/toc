import {
  type Action,
  type CardId,
  type Color,
  type GameState,
  type PawnId,
  type Place,
  type Reason,
  resolveMove,
  type Scenario,
  scenarioState,
  viewFor,
} from "@toc/engine";
import { describe, expect, it } from "vitest";
import {
  initialTurnUi,
  reduceTurnUi,
  type TurnCtx,
  type TurnUiEvent,
  type TurnUiState,
  trayLetters,
  turnCtx,
} from "./turnUi.ts";

const SEED: [number, number, number, number] = [2, 7, 1, 8];

function build(before: Scenario["before"], patch: Partial<GameState> = {}): GameState {
  return { ...scenarioState(before, SEED), ...patch };
}

function ctxOf(state: GameState, seat: Color = "bleu"): TurnCtx {
  return turnCtx(viewFor(state, seat), seat);
}

/** Runs events one after the other, keeping every result. */
function run(start: TurnUiState, ctx: TurnCtx, ...events: TurnUiEvent[]) {
  const results = [];
  let state = start;
  for (const event of events) {
    const result = reduceTurnUi(state, event, ctx);
    results.push(result);
    state = result.state;
  }
  return results;
}

const synced = (ctx: TurnCtx, from: TurnUiState = initialTurnUi) =>
  reduceTurnUi(from, { t: "sync" }, ctx).state;

// One knight on the ring, one card: a single legal move.
const SINGLE = build({
  pawns: { bleu: [{ p: 5 }, "S", "S", "S"] },
  hands: { bleu: ["5H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
  turn: "bleu",
});

describe("sync: the state follows the view", () => {
  it("starts waiting", () => {
    expect(initialTurnUi).toEqual({ kind: "waiting" });
  });

  it("waits while it is not his turn, and when the game is over", () => {
    const other = build({ ...SINGLE_BEFORE(), turn: "jaune" });
    expect(synced(ctxOf(other))).toEqual({ kind: "waiting" });
    const won = { ...SINGLE, phase: "won" as const, winner: "bleu-rouge" as const };
    expect(synced(ctxOf(won))).toEqual({ kind: "waiting" });
  });

  it("is idle on his turn", () => {
    expect(synced(ctxOf(SINGLE))).toEqual({ kind: "idle" });
  });

  it("chooses the card to give in the exchange, then waits for the others", () => {
    const exchange = build({
      phase: "exchange",
      hands: {
        bleu: ["2H", "3H", "4H", "5H", "6H"],
        jaune: ["2S", "3S", "4S", "5S", "6S"],
        rouge: ["2D", "3D", "4D", "5D", "6D"],
        vert: ["2C", "3C", "4C", "5C", "6C"],
      },
      turn: "jaune",
      dealer: "bleu",
    });
    expect(synced(ctxOf(exchange))).toEqual({ kind: "exchange" });

    const gave = {
      ...exchange,
      given: { ...exchange.given, bleu: "2H" as CardId, jaune: "2S" as CardId },
    };
    expect(synced(ctxOf(gave))).toEqual({ kind: "exchangeWaiting", pending: ["rouge", "vert"] });
  });

  it("keeps the card chosen for the exchange when the view changes", () => {
    const exchange = build({
      phase: "exchange",
      hands: { bleu: ["2H", "3H", "4H", "5H", "6H"], jaune: ["2S"], rouge: ["2D"], vert: ["2C"] },
      turn: "jaune",
      dealer: "bleu",
    });
    const picked = reduceTurnUi(
      { kind: "exchange" },
      { t: "selectGive", card: "3H" },
      ctxOf(exchange),
    ).state;
    const later = { ...exchange, given: { ...exchange.given, rouge: "2D" as CardId } };
    expect(synced(ctxOf(later), picked)).toEqual({ kind: "exchange", selected: "3H" });
  });

  it("is in the dead-hand state when only the discard is left", () => {
    const dead = build({
      pawns: { bleu: ["S", "S", "S", "S"] },
      hands: { bleu: ["8S", "9S"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
      turn: "bleu",
    });
    expect(synced(ctxOf(dead))).toEqual({ kind: "deadHand" });
  });

  it("tells a laid-down hand from an empty one", () => {
    const empty = build({ hands: { jaune: ["2S"] }, turn: "jaune" });
    expect(synced(ctxOf(empty))).toEqual({ kind: "empty" });
    const posed = { ...empty, posed: { ...empty.posed, bleu: ["8S", "9S"] as CardId[] } };
    expect(synced(ctxOf(posed))).toEqual({ kind: "posed" });
  });

  it("shows the finished-player prompt once at the start of each of his turns", () => {
    const finished = build({
      pawns: { bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }], rouge: [{ p: 9 }, "S", "S", "S"] },
      hands: { bleu: ["5H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
      turn: "bleu",
    });
    const away = { ...finished, turn: "jaune" as const };
    const first = synced(ctxOf(finished), synced(ctxOf(away)));
    expect(first).toEqual({ kind: "finishedPrompt" });
    // The same view again does not announce it twice, and a later idle state does not bring it back.
    expect(synced(ctxOf(finished), first)).toEqual({ kind: "finishedPrompt" });
    expect(synced(ctxOf(finished), { kind: "idle" })).toEqual({ kind: "idle" });
    // Without having finished there is no prompt.
    expect(synced(ctxOf(SINGLE), synced(ctxOf({ ...SINGLE, turn: "jaune" })))).toEqual({
      kind: "idle",
    });
  });

  it("never submits anything", () => {
    for (const state of [SINGLE, build(deadBefore())]) {
      expect(reduceTurnUi(initialTurnUi, { t: "sync" }, ctxOf(state)).submit).toBeUndefined();
    }
  });
});

function SINGLE_BEFORE(): Scenario["before"] {
  return {
    pawns: { bleu: [{ p: 5 }, "S", "S", "S"] },
    hands: { bleu: ["5H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
    turn: "bleu",
  };
}

function deadBefore(): Scenario["before"] {
  return {
    pawns: { bleu: ["S", "S", "S", "S"] },
    hands: { bleu: ["8S", "9S"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
    turn: "bleu",
  };
}

describe("with exactly one legal move nothing is played for him (D-19)", () => {
  it("previews it after the card and the knight, and submits only on confirm", () => {
    const ctx = ctxOf(SINGLE);
    expect(ctx.legal).toHaveLength(1);
    const [sync, card, pawn, confirm] = run(
      initialTurnUi,
      ctx,
      { t: "sync" },
      { t: "tapCard", card: "5H" },
      { t: "tapPawn", pawn: "bleu0" },
      { t: "confirm" },
    );
    expect(sync?.state).toEqual({ kind: "idle" });
    expect(sync?.submit).toBeUndefined();
    expect(card?.state.kind).toBe("cardSelected");
    expect(card?.submit).toBeUndefined();
    expect(pawn?.state.kind).toBe("preview");
    expect(pawn?.submit).toBeUndefined();
    expect(confirm?.submit).toEqual({ t: "move", card: "5H", pawn: "bleu0" });
    expect(confirm?.state).toEqual({ kind: "waiting" });
  });
});

describe("a dead hand is laid down only on his pose (D-20)", () => {
  const ctx = ctxOf(build(deadBefore()));

  it("submits the discard on pose and on nothing else", () => {
    const start = synced(ctx);
    const others: TurnUiEvent[] = [
      { t: "sync" },
      { t: "confirm" },
      { t: "cancel" },
      { t: "escape" },
      { t: "changeCard" },
      { t: "give" },
      { t: "tapCard", card: "8S" },
      { t: "tapPawn", pawn: "bleu0" },
      { t: "selectGive", card: "8S" },
    ];
    for (const event of others) {
      const result = reduceTurnUi(start, event, ctx);
      expect(result.submit, event.t).toBeUndefined();
    }
    const pose = reduceTurnUi(start, { t: "pose" }, ctx);
    expect(pose.submit).toEqual({ t: "discard" });
    expect(pose.state).toEqual({ kind: "waiting" });
  });

  it("does not pose outside the dead-hand state", () => {
    for (const state of [synced(ctxOf(SINGLE)), initialTurnUi]) {
      expect(reduceTurnUi(state, { t: "pose" }, ctxOf(SINGLE)).submit).toBeUndefined();
    }
  });
});

describe("tapping an unplayable card", () => {
  const stuck = build({
    pawns: { bleu: ["S", "S", "S", "S"] },
    hands: { bleu: ["4S", "1H", "11D"], jaune: ["4D"], rouge: ["8D"], vert: ["9C"] },
    turn: "bleu",
  });

  it("gives the hint of its reason and keeps the state", () => {
    const ctx = ctxOf(stuck);
    const start = synced(ctx);
    const four = reduceTurnUi(start, { t: "tapCard", card: "4S" }, ctx);
    expect(four.hint).toBe<Reason>("no-pawn-can-move");
    expect(four.state).toBe(start);
    expect(four.submit).toBeUndefined();

    const jack = reduceTurnUi(start, { t: "tapCard", card: "11D" }, ctx);
    expect(jack.hint).toBe<Reason>("jack-no-target");
    expect(jack.state).toBe(start);
  });

  it("gives the hint of the reason in the engine's table, whatever the reason", () => {
    const ctx = ctxOf(stuck);
    for (const card of stuck.hands.bleu) {
      const verdict = ctx.playability[card];
      const result = reduceTurnUi({ kind: "idle" }, { t: "tapCard", card }, ctx);
      if (verdict?.playable === false) expect(result.hint).toBe(verdict.reason);
      else expect(result.hint).toBeUndefined();
    }
  });

  it("keeps a selected card selected when another, unplayable, card is tapped", () => {
    const ctx = ctxOf(stuck);
    const selected = reduceTurnUi(synced(ctx), { t: "tapCard", card: "1H" }, ctx).state;
    expect(selected.kind).toBe("cardSelected");
    const result = reduceTurnUi(selected, { t: "tapCard", card: "4S" }, ctx);
    expect(result.state).toBe(selected);
    expect(result.hint).toBe("no-pawn-can-move");
  });

  it("ignores a card that is not in his hand", () => {
    const ctx = ctxOf(stuck);
    const start = synced(ctx);
    const result = reduceTurnUi(start, { t: "tapCard", card: "2C" }, ctx);
    expect(result.state).toBe(start);
    expect(result.hint).toBeUndefined();
  });
});

describe("deselecting", () => {
  const ctx = ctxOf(SINGLE);
  const toSelected = () => reduceTurnUi({ kind: "idle" }, { t: "tapCard", card: "5H" }, ctx).state;
  const toPreview = () => reduceTurnUi(toSelected(), { t: "tapPawn", pawn: "bleu0" }, ctx).state;

  it("goes back to idle on a second tap of the card, changeCard, cancel and escape", () => {
    for (const [label, from] of [
      ["selected", toSelected()],
      ["preview", toPreview()],
    ] as const) {
      for (const event of [
        { t: "tapCard", card: "5H" },
        { t: "changeCard" },
        { t: "cancel" },
        { t: "escape" },
      ] as TurnUiEvent[]) {
        const result = reduceTurnUi(from, event, ctx);
        expect(result.state, `${label} ${event.t}`).toEqual({ kind: "idle" });
        expect(result.submit).toBeUndefined();
      }
    }
  });

  it("changes the card without going through idle when another playable card is tapped", () => {
    const two = build({
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"] },
      hands: { bleu: ["5H", "6H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
      turn: "bleu",
    });
    const c = ctxOf(two);
    const first = reduceTurnUi({ kind: "idle" }, { t: "tapCard", card: "5H" }, c).state;
    const second = reduceTurnUi(first, { t: "tapCard", card: "6H" }, c).state;
    expect(second).toMatchObject({ kind: "cardSelected", card: "6H" });
  });

  it("ignores confirm without a preview", () => {
    expect(reduceTurnUi(toSelected(), { t: "confirm" }, ctx).submit).toBeUndefined();
    expect(reduceTurnUi({ kind: "idle" }, { t: "confirm" }, ctx).submit).toBeUndefined();
  });
});

describe("the preview is the engine's own resolveMove (PLAY-02)", () => {
  function previewOf(before: Scenario["before"], card: CardId, pawn: PawnId, seat: Color = "bleu") {
    const state = build(before);
    const ctx = ctxOf(state, seat);
    const [, result] = run(synced(ctx), ctx, { t: "tapCard", card }, { t: "tapPawn", pawn });
    return { ctx, result, view: viewFor(state, seat) };
  }

  it("shows the same path and the same captured knights as resolveMove", () => {
    // Bleu's knight (cell 5) plays a 3 onto jaune's knight (jaune progress 62 is cell 8).
    const { result, view } = previewOf(
      {
        pawns: { bleu: [{ p: 5 }, "S", "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
        hands: { bleu: ["3S"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
        turn: "bleu",
      },
      "3S",
      "bleu0",
    );
    const action: Action = { t: "move", card: "3S", pawn: "bleu0" };
    const resolved = resolveMove(view, "bleu", action);
    const moved = resolved.events.find((e) => e.t === "pawnMoved");
    expect(result?.state.kind).toBe("preview");
    if (result?.state.kind !== "preview" || moved?.t !== "pawnMoved") throw new Error("no preview");
    expect(result.state.action).toEqual(action);
    expect(result.state.path).toEqual(moved.path);
    expect(result.state.captured).toEqual(resolved.captured);
    expect(result.state.captured).toEqual(["jaune0"]);
    expect(result.state.partnerCapture).toBe(false);
    expect(result.state.description).toEqual({
      verb: "advance",
      pawn: "bleu0",
      steps: 3,
      entersHome: false,
    });
  });

  it("flags the capture of a partner knight", () => {
    // Rouge is bleu's partner; rouge progress 44 is cell 8.
    const { result } = previewOf(
      {
        pawns: { bleu: [{ p: 5 }, "S", "S", "S"], rouge: [{ p: 44 }, "S", "S", "S"] },
        hands: { bleu: ["3S"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
        turn: "bleu",
      },
      "3S",
      "bleu0",
    );
    if (result?.state.kind !== "preview") throw new Error("no preview");
    expect(result.state.captured).toEqual(["rouge0"]);
    expect(result.state.partnerCapture).toBe(true);
  });

  it("describes a backward 4 and an exit, and treats any stable knight as the exit", () => {
    const before: Scenario["before"] = {
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"] },
      hands: { bleu: ["4S", "1S"], jaune: ["4D"], rouge: ["8D"], vert: ["9C"] },
      turn: "bleu",
    };
    const back = previewOf(before, "4S", "bleu0").result;
    if (back?.state.kind !== "preview") throw new Error("no preview");
    expect(back.state.description).toMatchObject({ verb: "back", pawn: "bleu0", steps: 4 });
    expect(back.state.path).toHaveLength(4);

    // The As with both an exit and an advance asks first (D-16); « Sortir » previews the exit with
    // no knight tap, whichever stable knight is tapped afterwards.
    const ctx = ctxOf(build(before));
    const [asked, exitPreview, tappedStable] = run(
      synced(ctx),
      ctx,
      { t: "tapCard", card: "1S" },
      { t: "chooseExit" },
      { t: "tapPawn", pawn: "bleu3" },
    );
    expect(asked?.state.kind).toBe("modeChoice");
    if (exitPreview?.state.kind !== "preview") throw new Error("no preview");
    expect(exitPreview.state.action).toEqual({ t: "exit", card: "1S", pawn: "bleu1" });
    expect(exitPreview.state.description.verb).toBe("exit");
    expect(exitPreview.state.path).toHaveLength(1);
    expect(exitPreview.submit).toBeUndefined();
    expect(tappedStable?.state).toEqual(exitPreview.state);
  });

  it("marks a move that enters the home", () => {
    // Progress 68 + 3: through the entry square (cell 70) into the first home slot.
    const { result } = previewOf(
      {
        pawns: { bleu: [{ p: 68 }, "S", "S", "S"] },
        hands: { bleu: ["3S"], jaune: ["4D"], rouge: ["8D"], vert: ["9C"] },
        turn: "bleu",
      },
      "3S",
      "bleu0",
    );
    if (result?.state.kind !== "preview") throw new Error("no preview");
    const last = result.state.path[result.state.path.length - 1] as Place;
    expect(last).toEqual({ z: "home", color: "bleu", slot: 0 });
    expect(result.state.description.entersHome).toBe(true);
  });

  it("switches the preview when another candidate is tapped, and ignores a non-candidate", () => {
    const before: Scenario["before"] = {
      pawns: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"] },
      hands: { bleu: ["6H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
      turn: "bleu",
    };
    const state = build(before);
    const ctx = ctxOf(state);
    const [, a, b, other, back] = run(
      synced(ctx),
      ctx,
      { t: "tapCard", card: "6H" },
      { t: "tapPawn", pawn: "bleu0" },
      { t: "tapPawn", pawn: "bleu1" },
      { t: "tapPawn", pawn: "jaune0" },
      { t: "tapPawn", pawn: "bleu3" },
    ) as { state: TurnUiState }[];
    expect(a?.state).toMatchObject({ kind: "preview", action: { pawn: "bleu0" } });
    expect(b?.state).toMatchObject({ kind: "preview", action: { pawn: "bleu1" } });
    // A knight that is not a candidate does nothing; the preview stays.
    expect(other?.state).toBe(b?.state);
    expect(back?.state).toBe(b?.state);
  });

  it("ignores a knight tap with no card selected", () => {
    const ctx = ctxOf(SINGLE);
    const start = synced(ctx);
    expect(reduceTurnUi(start, { t: "tapPawn", pawn: "bleu0" }, ctx).state).toBe(start);
  });
});

describe("cards the later plans complete", () => {
  it("lets a 7 be selected without producing a candidate (plan 01-21)", () => {
    const state = build({
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"], vert: [{ p: 30 }, "S", "S", "S"] },
      hands: { bleu: ["7H", "11H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
      turn: "bleu",
    });
    const ctx = ctxOf(state);
    expect(ctx.playability["7H"]).toEqual({ playable: true });
    expect(ctx.playability["11H"]).toEqual({ playable: true });
    for (const card of ["7H"] as const) {
      const [selected, pawn] = run(
        synced(ctx),
        ctx,
        { t: "tapCard", card },
        { t: "tapPawn", pawn: "bleu0" },
      );
      expect(selected?.state).toEqual({ kind: "cardSelected", card, candidates: [] });
      expect(pawn?.state).toEqual(selected?.state);
      expect(pawn?.submit).toBeUndefined();
    }
  });
});

describe("the exchange", () => {
  const exchange = build({
    phase: "exchange",
    hands: {
      bleu: ["2H", "3H", "4H", "5H", "6H"],
      jaune: ["2S", "3S", "4S", "5S", "6S"],
      rouge: ["2D", "3D", "4D", "5D", "6D"],
      vert: ["2C", "3C", "4C", "5C", "6C"],
    },
    turn: "jaune",
    dealer: "bleu",
  });
  const ctx = ctxOf(exchange);

  it("selects, unselects and gives a card, and submits only on give", () => {
    const [select, again, reselect, other, cleared, pick, give] = run(
      { kind: "exchange" },
      ctx,
      { t: "selectGive", card: "3H" },
      { t: "selectGive", card: "3H" },
      { t: "selectGive", card: "3H" },
      { t: "selectGive", card: "5H" },
      { t: "escape" },
      { t: "selectGive", card: "6H" },
      { t: "give" },
    );
    expect(select?.state).toEqual({ kind: "exchange", selected: "3H" });
    expect(again?.state).toEqual({ kind: "exchange" });
    expect(reselect?.state).toEqual({ kind: "exchange", selected: "3H" });
    expect(other?.state).toEqual({ kind: "exchange", selected: "5H" });
    expect(cleared?.state).toEqual({ kind: "exchange" });
    for (const step of [select, again, reselect, other, cleared, pick]) {
      expect(step?.submit).toBeUndefined();
    }
    expect(give?.submit).toEqual({ t: "give", card: "6H" });
    expect(give?.state).toEqual({ kind: "exchangeWaiting", pending: ["jaune", "rouge", "vert"] });
  });

  it("does not give without a chosen card, nor a card he does not hold", () => {
    const [none, foreign] = run(
      { kind: "exchange" },
      ctx,
      { t: "give" },
      { t: "selectGive", card: "2S" },
    );
    expect(none?.submit).toBeUndefined();
    expect(foreign?.state).toEqual({ kind: "exchange" });
  });

  it("ignores play events during the exchange", () => {
    for (const event of [
      { t: "tapCard", card: "2H" },
      { t: "tapPawn", pawn: "bleu0" },
      { t: "confirm" },
      { t: "pose" },
    ] as TurnUiEvent[]) {
      const result = reduceTurnUi({ kind: "exchange" }, event, ctx);
      expect(result.state).toEqual({ kind: "exchange" });
      expect(result.submit).toBeUndefined();
    }
  });
});

describe("the finished player plays his partner's knights", () => {
  it("offers the partner's knights as candidates", () => {
    const finished = build({
      pawns: { bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }], rouge: [{ p: 9 }, "S", "S", "S"] },
      hands: { bleu: ["5H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
      turn: "bleu",
    });
    const ctx = ctxOf(finished);
    const start = synced(ctx, synced(ctxOf({ ...finished, turn: "jaune" })));
    expect(start).toEqual({ kind: "finishedPrompt" });
    const [card, pawn, confirm] = run(
      start,
      ctx,
      { t: "tapCard", card: "5H" },
      { t: "tapPawn", pawn: "rouge0" },
      { t: "confirm" },
    );
    expect(card?.state.kind).toBe("cardSelected");
    expect(pawn?.state.kind).toBe("preview");
    expect(confirm?.submit).toEqual({ t: "move", card: "5H", pawn: "rouge0" });
  });
});

describe("waiting locks the board", () => {
  it("ignores every play event while waiting", () => {
    const ctx = ctxOf(SINGLE);
    for (const event of [
      { t: "tapCard", card: "5H" },
      { t: "tapPawn", pawn: "bleu0" },
      { t: "confirm" },
      { t: "give" },
      { t: "pose" },
      { t: "cancel" },
    ] as TurnUiEvent[]) {
      const result = reduceTurnUi({ kind: "waiting" }, event, ctx);
      expect(result.state).toEqual({ kind: "waiting" });
      expect(result.submit).toBeUndefined();
    }
  });
});

describe("As and Roi: « Sortir ou avancer » (D-16, PLAY-04)", () => {
  const both: Scenario["before"] = {
    pawns: { bleu: [{ p: 5 }, "S", "S", "S"] },
    hands: { bleu: ["1S", "13H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
    turn: "bleu",
  };
  const ctx = ctxOf(build(both));

  it("asks when both are possible, for the As and for the Roi", () => {
    for (const card of ["1S", "13H"] as const) {
      const result = reduceTurnUi(synced(ctx), { t: "tapCard", card }, ctx);
      expect(result.state).toMatchObject({ kind: "modeChoice", card });
      expect(result.submit).toBeUndefined();
    }
  });

  it("previews the exit with no knight tap, then plays it only on confirm", () => {
    const [asked, exit, confirm] = run(
      synced(ctx),
      ctx,
      { t: "tapCard", card: "13H" },
      { t: "chooseExit" },
      { t: "confirm" },
    );
    expect(asked?.state.kind).toBe("modeChoice");
    expect(exit?.state).toMatchObject({
      kind: "preview",
      card: "13H",
      action: { t: "exit", card: "13H", pawn: "bleu1" },
    });
    expect(exit?.submit).toBeUndefined();
    expect(confirm?.submit).toEqual({ t: "exit", card: "13H", pawn: "bleu1" });
  });

  it("advancing lights the ring knights and waits for the tap", () => {
    const [, advance, pawn, confirm] = run(
      synced(ctx),
      ctx,
      { t: "tapCard", card: "13H" },
      { t: "chooseAdvance" },
      { t: "tapPawn", pawn: "bleu0" },
      { t: "confirm" },
    );
    expect(advance?.state).toMatchObject({
      kind: "cardSelected",
      card: "13H",
      candidates: [{ t: "move", card: "13H", pawn: "bleu0" }],
    });
    expect(advance?.submit).toBeUndefined();
    expect(pawn?.state).toMatchObject({ kind: "preview", action: { t: "move", pawn: "bleu0" } });
    expect(confirm?.submit).toEqual({ t: "move", card: "13H", pawn: "bleu0" });
  });

  it("ignores a knight tap while the question is open, and the buttons outside it", () => {
    const asked = reduceTurnUi(synced(ctx), { t: "tapCard", card: "1S" }, ctx).state;
    expect(reduceTurnUi(asked, { t: "tapPawn", pawn: "bleu0" }, ctx).state).toBe(asked);
    const idle = synced(ctx);
    for (const event of [{ t: "chooseExit" }, { t: "chooseAdvance" }] as TurnUiEvent[]) {
      expect(reduceTurnUi(idle, event, ctx).state).toBe(idle);
    }
  });

  it("skips the question when only one mode is possible", () => {
    // Every knight in the stable: only the exit.
    const stable = ctxOf(
      build({
        pawns: { bleu: ["S", "S", "S", "S"] },
        hands: { bleu: ["1S"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
        turn: "bleu",
      }),
    );
    const exitOnly = reduceTurnUi(synced(stable), { t: "tapCard", card: "1S" }, stable).state;
    expect(exitOnly).toMatchObject({ kind: "cardSelected", card: "1S" });
    // No knight in the stable: only advancing.
    const ring = ctxOf(
      build({
        pawns: { bleu: [{ p: 5 }, { p: 9 }, { p: 20 }, { p: 30 }] },
        hands: { bleu: ["13H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
        turn: "bleu",
      }),
    );
    const advanceOnly = reduceTurnUi(synced(ring), { t: "tapCard", card: "13H" }, ring).state;
    expect(advanceOnly).toMatchObject({ kind: "cardSelected", card: "13H" });
  });

  it("goes back to idle from the question, on its card, cancel and escape", () => {
    const asked = reduceTurnUi(synced(ctx), { t: "tapCard", card: "1S" }, ctx).state;
    for (const event of [
      { t: "tapCard", card: "1S" },
      { t: "changeCard" },
      { t: "cancel" },
      { t: "escape" },
    ] as TurnUiEvent[]) {
      expect(reduceTurnUi(asked, event, ctx).state, event.t).toEqual({ kind: "idle" });
    }
    const other = reduceTurnUi(asked, { t: "tapCard", card: "13H" }, ctx).state;
    expect(other).toMatchObject({ kind: "modeChoice", card: "13H" });
  });
});

describe("the Valet in two taps (PLAY-02, RULE-09)", () => {
  const before: Scenario["before"] = {
    pawns: {
      bleu: [{ p: 5 }, { p: 40 }, "S", "S"],
      vert: [{ p: 30 }, "S", "S", "S"],
      jaune: [{ p: 62 }, "S", "S", "S"],
    },
    hands: { bleu: ["11H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
    turn: "bleu",
  };
  const ctx = ctxOf(build(before));
  const swaps = ctx.legal.filter((a) => a.t === "swap");

  it("takes the knights and the targets only from the legal swaps", () => {
    expect(swaps.length).toBeGreaterThan(1);
    const picked = reduceTurnUi(synced(ctx), { t: "tapCard", card: "11H" }, ctx);
    expect(picked.state).toMatchObject({ kind: "jackPick", card: "11H" });
    expect(picked.submit).toBeUndefined();
    const [, target] = run(
      synced(ctx),
      ctx,
      { t: "tapCard", card: "11H" },
      { t: "tapPawn", pawn: "bleu0" },
    );
    if (target?.state.kind !== "jackTarget") throw new Error("no jackTarget");
    expect(target.state.pawn).toBe("bleu0");
    const expected = swaps.filter((a) => a.pawn === "bleu0").map((a) => a.target);
    expect(target.state.targets).toEqual(expected);
    expect(target.state.targets).toContain("vert0");
    expect(target.state.targets).toContain("jaune0");
  });

  it("previews the swap with both destinations, then plays it only on confirm", () => {
    const [, , preview, confirm] = run(
      synced(ctx),
      ctx,
      { t: "tapCard", card: "11H" },
      { t: "tapPawn", pawn: "bleu0" },
      { t: "tapPawn", pawn: "vert0" },
      { t: "confirm" },
    );
    if (preview?.state.kind !== "preview") throw new Error("no preview");
    const action: Action = { t: "swap", card: "11H", pawn: "bleu0", target: "vert0" };
    expect(preview.state.action).toEqual(action);
    expect(preview.state.description).toMatchObject({
      verb: "swap",
      pawn: "bleu0",
      target: "vert0",
    });
    expect(preview.state.captured).toEqual([]);
    expect(preview.state.partnerCapture).toBe(false);
    const resolved = resolveMove(viewFor(build(before), "bleu"), "bleu", action);
    const event = resolved.events[0];
    if (event?.t !== "pawnsSwapped") throw new Error("no swap event");
    expect(preview.state.swap).toEqual({ a: "bleu0", b: "vert0", aTo: event.aTo, bTo: event.bTo });
    expect(preview.submit).toBeUndefined();
    expect(confirm?.submit).toEqual(action);
    expect(confirm?.state).toEqual({ kind: "waiting" });
  });

  it("never submits a single legal swap on its own (D-19)", () => {
    const one = ctxOf(
      build({
        pawns: { bleu: [{ p: 5 }, "S", "S", "S"], vert: [{ p: 30 }, "S", "S", "S"] },
        hands: { bleu: ["11H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
        turn: "bleu",
      }),
    );
    expect(one.legal.filter((a) => a.t === "swap")).toHaveLength(1);
    const steps = run(
      synced(one),
      one,
      { t: "sync" },
      { t: "tapCard", card: "11H" },
      { t: "tapPawn", pawn: "bleu0" },
      { t: "tapPawn", pawn: "vert0" },
    );
    for (const step of steps) expect(step.submit).toBeUndefined();
    expect(steps[steps.length - 1]?.state.kind).toBe("preview");
  });

  it("switches the target, and goes back to the knight choice on the chosen knight", () => {
    const [, , first, second, back, again] = run(
      synced(ctx),
      ctx,
      { t: "tapCard", card: "11H" },
      { t: "tapPawn", pawn: "bleu0" },
      { t: "tapPawn", pawn: "vert0" },
      { t: "tapPawn", pawn: "jaune0" },
      { t: "tapPawn", pawn: "bleu0" },
      { t: "tapPawn", pawn: "bleu0" },
    );
    expect(first?.state).toMatchObject({ kind: "preview", action: { target: "vert0" } });
    expect(second?.state).toMatchObject({ kind: "preview", action: { target: "jaune0" } });
    expect(back?.state).toMatchObject({ kind: "jackTarget", pawn: "bleu0" });
    expect(again?.state).toMatchObject({ kind: "jackPick" });
  });

  it("ignores a knight that is not lit, in both taps", () => {
    const picked = reduceTurnUi(synced(ctx), { t: "tapCard", card: "11H" }, ctx).state;
    // Not one of his knights with a swap: neither a stable knight nor a target.
    expect(reduceTurnUi(picked, { t: "tapPawn", pawn: "vert0" }, ctx).state).toBe(picked);
    expect(reduceTurnUi(picked, { t: "tapPawn", pawn: "bleu3" }, ctx).state).toBe(picked);
    const target = reduceTurnUi(picked, { t: "tapPawn", pawn: "bleu0" }, ctx).state;
    expect(reduceTurnUi(target, { t: "tapPawn", pawn: "bleu1" }, ctx).state).toBe(target);
    expect(reduceTurnUi(target, { t: "tapPawn", pawn: "jaune3" }, ctx).state).toBe(target);
  });

  it("goes back to idle on the card, changeCard, cancel and escape", () => {
    const picked = reduceTurnUi(synced(ctx), { t: "tapCard", card: "11H" }, ctx).state;
    const target = reduceTurnUi(picked, { t: "tapPawn", pawn: "bleu0" }, ctx).state;
    const preview = reduceTurnUi(target, { t: "tapPawn", pawn: "vert0" }, ctx).state;
    for (const from of [picked, target, preview]) {
      for (const event of [
        { t: "tapCard", card: "11H" },
        { t: "changeCard" },
        { t: "cancel" },
        { t: "escape" },
      ] as TurnUiEvent[]) {
        expect(reduceTurnUi(from, event, ctx).state, `${from.kind} ${event.t}`).toEqual({
          kind: "idle",
        });
      }
    }
  });

  it("leaves a protected knight out (RULES R-09 as validated)", () => {
    // A knight on its exit square is protected: it is neither played nor a target.
    const protectedCtx = ctxOf(
      build({
        pawns: {
          bleu: [{ p: 0 }, { p: 20 }, "S", "S"],
          vert: [{ p: 0 }, { p: 30 }, "S", "S"],
        },
        hands: { bleu: ["11H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
        turn: "bleu",
      }),
    );
    const picked = reduceTurnUi(synced(protectedCtx), { t: "tapCard", card: "11H" }, protectedCtx);
    if (picked.state.kind !== "jackPick") throw new Error("no jackPick");
    expect(picked.state.pawns).toEqual(["bleu1"]);
    const target = reduceTurnUi(picked.state, { t: "tapPawn", pawn: "bleu1" }, protectedCtx).state;
    if (target.kind !== "jackTarget") throw new Error("no jackTarget");
    expect(target.targets).toEqual(["vert1"]);
  });
});

describe("the tray: knights too close to tell apart", () => {
  // Two of his knights on neighbouring cells and a 3: both can play it.
  const close = ctxOf(
    build({
      pawns: { bleu: [{ p: 5 }, { p: 6 }, "S", "S"] },
      hands: { bleu: ["3S"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
      turn: "bleu",
    }),
  );
  const selected = () => reduceTurnUi(synced(close), { t: "tapCard", card: "3S" }, close).state;

  it("opens with the knights near the tap, and a single one is simply tapped", () => {
    const from = selected();
    const result = reduceTurnUi(from, { t: "tapAt", near: ["bleu1", "bleu0"] }, close);
    expect(result.state).toEqual({
      kind: "tray",
      card: "3S",
      options: ["bleu1", "bleu0"],
      next: from,
    });
    expect(result.submit).toBeUndefined();
    const single = reduceTurnUi(from, { t: "tapAt", near: ["bleu0"] }, close);
    expect(single.state).toMatchObject({ kind: "preview", action: { pawn: "bleu0" } });
  });

  it("continues as if the chosen knight had been tapped, and submits nothing", () => {
    const [, tray, chosen, confirm] = run(
      synced(close),
      close,
      { t: "tapCard", card: "3S" },
      { t: "tapAt", near: ["bleu0", "bleu1"] },
      { t: "chooseTrayOption", pawn: "bleu1" },
      { t: "confirm" },
    );
    expect(tray?.state.kind).toBe("tray");
    expect(chosen?.state).toMatchObject({ kind: "preview", action: { pawn: "bleu1" } });
    expect(chosen?.submit).toBeUndefined();
    expect(confirm?.submit).toEqual({ t: "move", card: "3S", pawn: "bleu1" });
  });

  it("« Choisir un autre cheval » returns to the selection with the card still selected", () => {
    const from = selected();
    const [tray, closed] = run(
      from,
      close,
      { t: "tapAt", near: ["bleu0", "bleu1"] },
      { t: "closeTray" },
    );
    expect(tray?.state.kind).toBe("tray");
    expect(closed?.state).toBe(from);
    expect(closed?.state).toMatchObject({ kind: "cardSelected", card: "3S" });
  });

  it("ignores a chosen knight that is not an option, and the tray events elsewhere", () => {
    const from = selected();
    const tray = reduceTurnUi(from, { t: "tapAt", near: ["bleu0", "bleu1"] }, close).state;
    expect(reduceTurnUi(tray, { t: "chooseTrayOption", pawn: "bleu3" }, close).state).toBe(tray);
    expect(reduceTurnUi(from, { t: "chooseTrayOption", pawn: "bleu0" }, close).state).toBe(from);
    expect(reduceTurnUi(from, { t: "closeTray" }, close).state).toBe(from);
    expect(reduceTurnUi(tray, { t: "tapPawn", pawn: "bleu0" }, close).state).toBe(tray);
  });

  it("escape, cancel and a second tap of the card leave the tray for idle", () => {
    const tray = reduceTurnUi(selected(), { t: "tapAt", near: ["bleu0", "bleu1"] }, close).state;
    for (const event of [
      { t: "tapCard", card: "3S" },
      { t: "escape" },
      { t: "cancel" },
    ] as TurnUiEvent[]) {
      expect(reduceTurnUi(tray, event, close).state, event.t).toEqual({ kind: "idle" });
    }
  });

  it("does not offer stable knights of one colour as a choice: they are the same exit", () => {
    const stable = ctxOf(
      build({
        pawns: { bleu: ["S", "S", "S", "S"] },
        hands: { bleu: ["1S"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
        turn: "bleu",
      }),
    );
    const result = run(
      synced(stable),
      stable,
      { t: "tapCard", card: "1S" },
      { t: "tapAt", near: ["bleu2", "bleu3", "bleu1"] },
    )[1];
    expect(result?.state).toMatchObject({ kind: "preview", action: { t: "exit" } });
  });

  it("keeps the knights that are not targets out of the options, and caps them at four", () => {
    const valet = ctxOf(
      build({
        pawns: {
          bleu: [{ p: 5 }, "S", "S", "S"],
          jaune: [{ p: 62 }, { p: 63 }, { p: 64 }, { p: 65 }],
          vert: [{ p: 30 }, "S", "S", "S"],
        },
        hands: { bleu: ["11H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
        turn: "bleu",
      }),
    );
    const [, , tray] = run(
      synced(valet),
      valet,
      { t: "tapCard", card: "11H" },
      { t: "tapPawn", pawn: "bleu0" },
      { t: "tapAt", near: ["jaune0", "jaune1", "bleu3", "jaune2", "jaune3", "vert0"] },
    );
    if (tray?.state.kind !== "tray") throw new Error("no tray");
    expect(tray.state.options).toEqual(["jaune0", "jaune1", "jaune2", "jaune3"]);
    const second = reduceTurnUi(tray.state, { t: "chooseTrayOption", pawn: "jaune2" }, valet).state;
    expect(second).toMatchObject({ kind: "preview", action: { t: "swap", target: "jaune2" } });
  });

  it("labels the knights A to D by their index, and by their place when the index repeats", () => {
    expect(trayLetters(["bleu1", "bleu2"])).toEqual(["B", "C"]);
    expect(trayLetters(["jaune0", "bleu3", "vert1"])).toEqual(["A", "D", "B"]);
    expect(trayLetters(["jaune0", "bleu0", "vert1"])).toEqual(["A", "B", "C"]);
  });
});
