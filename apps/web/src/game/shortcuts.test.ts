import {
  ALL_PAWNS,
  type CardId,
  type Color,
  type GameState,
  type PawnId,
  type Place,
  placeOf,
  type Scenario,
  scenarioState,
  sortHand,
  viewFor,
} from "@toc/engine";
import { describe, expect, it } from "vitest";
import {
  type FocusTarget,
  type KeyContext,
  type KeyInput,
  keyIntent,
  litKnights,
} from "./shortcuts.ts";
import {
  initialTurnUi,
  reduceTurnUi,
  type TurnCtx,
  type TurnUiEvent,
  type TurnUiState,
  turnCtx,
} from "./turnUi.ts";

const SEED: [number, number, number, number] = [2, 7, 1, 8];

function build(before: Scenario["before"], patch: Partial<GameState> = {}): GameState {
  return { ...scenarioState(before, SEED), ...patch };
}

/** A position as the game screen holds it: the reducer's context and where every knight is drawn. */
type Table = { ctx: TurnCtx; places: Record<PawnId, Place> };

function table(before: Scenario["before"], seat: Color = "bleu", patch: Partial<GameState> = {}) {
  const state = build(before, patch);
  const view = viewFor(state, seat);
  const places = Object.fromEntries(
    ALL_PAWNS.map((id) => [id, placeOf(id, view.pawns[id])]),
  ) as Record<PawnId, Place>;
  return { ctx: turnCtx(view, seat), places } satisfies Table;
}

/** Runs reducer events from the synced state and returns the state reached. */
function reach(t: Table, ...events: TurnUiEvent[]): TurnUiState {
  let state = reduceTurnUi(initialTurnUi, { t: "sync" }, t.ctx).state;
  for (const event of events) state = reduceTurnUi(state, event, t.ctx).state;
  return state;
}

/** A key press with no modifier: `key` is the typed character, `code` the physical key. */
function press(key: string, extra: Partial<KeyInput> = {}): KeyInput {
  const code = /^[1-9]$/.test(key)
    ? `Digit${key}`
    : /^[a-z]$/i.test(key)
      ? `Key${key.toUpperCase()}`
      : key;
  return {
    key,
    code,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    repeat: false,
    isComposing: false,
    ...extra,
  };
}

/** What the game screen would hand to keyIntent for `ui` in the position `t`. */
function context(t: Table, ui: TurnUiState, extra: Partial<KeyContext> = {}): KeyContext {
  const flow = ui.kind === "tray" ? ui.next : ui;
  return {
    ui,
    hand: sortHand(t.ctx.view.hand),
    lit: litKnights(flow, t.places),
    concealed: false,
    focus: { kind: "none" },
    blocked: false,
    ...extra,
  };
}

const eventsOf = (intent: ReturnType<typeof keyIntent>): TurnUiEvent[] | null =>
  intent?.kind === "turn" ? intent.events : null;

// The Dame and four other cards: bleu0 on the ring, three knights in the stable.
const QUEEN = table({
  pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
  hands: { bleu: ["12H", "4S", "11S", "2D", "9C"] },
  turn: "bleu",
});

// The Valet: bleu0 and bleu1 on the ring, vert0 and jaune0 to swap with.
const JACK = table({
  pawns: {
    bleu: [{ p: 5 }, { p: 40 }, "S", "S"],
    vert: [{ p: 30 }, "S", "S", "S"],
    jaune: [{ p: 62 }, "S", "S", "S"],
  },
  hands: { bleu: ["11H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
  turn: "bleu",
});

// The 7 with two knights on the ring.
const SEVEN = table({
  pawns: { bleu: [{ p: 10 }, { p: 30 }, "S", "S"] },
  hands: { bleu: ["7H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
  turn: "bleu",
});

// The As with both modes: an exit and an advance.
const ACE = table({
  pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
  hands: { bleu: ["1S"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
  turn: "bleu",
});

describe("litKnights: the knights lit for the flow", () => {
  it("lights nothing with no card selected", () => {
    expect(litKnights(reach(QUEEN), QUEEN.places)).toEqual([]);
  });

  it("lights the card's moving knight", () => {
    const ui = reach(QUEEN, { t: "tapCard", card: "12H" });
    expect(ui.kind).toBe("cardSelected");
    expect(litKnights(ui, QUEEN.places)).toEqual(["bleu0"]);
  });

  it("lights every stable knight of the colour for an exit", () => {
    const ui = reach(ACE, { t: "tapCard", card: "1S" }, { t: "chooseExit" });
    expect(ui.kind).toBe("preview");
    expect(litKnights(ui, ACE.places)).toEqual(["bleu1", "bleu2", "bleu3"]);
  });

  it("lights the move knights of a move preview", () => {
    const ui = reach(QUEEN, { t: "tapCard", card: "12H" }, { t: "tapPawn", pawn: "bleu0" });
    expect(ui.kind).toBe("preview");
    expect(litKnights(ui, QUEEN.places)).toEqual(["bleu0"]);
  });

  it("lights the Valet's own knights, then his chosen knight and its targets", () => {
    const pick = reach(JACK, { t: "tapCard", card: "11H" });
    expect(pick.kind).toBe("jackPick");
    expect(litKnights(pick, JACK.places)).toEqual(pick.kind === "jackPick" ? pick.pawns : []);
    const target = reach(JACK, { t: "tapCard", card: "11H" }, { t: "tapPawn", pawn: "bleu0" });
    if (target.kind !== "jackTarget") throw new Error("no jackTarget");
    expect(litKnights(target, JACK.places)).toEqual(["bleu0", ...target.targets]);
  });

  it("keeps the Valet's knight and its targets lit in the swap preview", () => {
    const target = reach(JACK, { t: "tapCard", card: "11H" }, { t: "tapPawn", pawn: "bleu0" });
    const preview = reach(
      JACK,
      { t: "tapCard", card: "11H" },
      { t: "tapPawn", pawn: "bleu0" },
      { t: "tapPawn", pawn: "vert0" },
    );
    expect(preview.kind).toBe("preview");
    expect(new Set(litKnights(preview, JACK.places))).toEqual(
      new Set(litKnights(target, JACK.places)),
    );
  });

  it("lights the 7's knights that may still be given steps", () => {
    const ui = reach(SEVEN, { t: "tapCard", card: "7H" });
    if (ui.kind !== "sevenBuilding") throw new Error("no sevenBuilding");
    const expected = ALL_PAWNS.filter((pawn) => (ui.steps[pawn] ?? []).length > 0);
    expect(expected).toEqual(["bleu0", "bleu1"]);
    expect(litKnights(ui, SEVEN.places)).toEqual(expected);
  });
});

describe("keyIntent: the tracer keys (« 1 », « A », « Entrée »)", () => {
  const idle = reach(QUEEN);
  const hand = sortHand(QUEEN.ctx.view.hand);
  const selected = reach(QUEEN, { t: "tapCard", card: "12H" });
  const preview = reach(QUEEN, { t: "tapCard", card: "12H" }, { t: "tapPawn", pawn: "bleu0" });

  it("« 1 » taps the first card of the hand from the left", () => {
    expect(eventsOf(keyIntent(press("1"), context(QUEEN, idle)))).toEqual([
      { t: "tapCard", card: hand[0] },
    ]);
    expect(eventsOf(keyIntent(press("5"), context(QUEEN, idle)))).toEqual([
      { t: "tapCard", card: hand[4] },
    ]);
  });

  it("reads the physical key: « & » on AZERTY's Digit1 is « 1 », and the numeric keypad works", () => {
    expect(eventsOf(keyIntent(press("&", { code: "Digit1" }), context(QUEEN, idle)))).toEqual([
      { t: "tapCard", card: hand[0] },
    ]);
    expect(eventsOf(keyIntent(press("2", { code: "Numpad2" }), context(QUEEN, idle)))).toEqual([
      { t: "tapCard", card: hand[1] },
    ]);
  });

  it("« 6 » with five cards means nothing", () => {
    expect(keyIntent(press("6"), context(QUEEN, idle))).toBeNull();
  });

  it("does nothing while the new hand is held back by the deal", () => {
    expect(keyIntent(press("1"), context(QUEEN, idle, { concealed: true }))).toBeNull();
  });

  it("« a » taps the one lit knight lettered A", () => {
    expect(eventsOf(keyIntent(press("a"), context(QUEEN, selected)))).toEqual([
      { t: "tapPawn", pawn: "bleu0" },
    ]);
    expect(eventsOf(keyIntent(press("A"), context(QUEEN, selected)))).toEqual([
      { t: "tapPawn", pawn: "bleu0" },
    ]);
    // No knight B is lit.
    expect(keyIntent(press("b"), context(QUEEN, selected))).toBeNull();
  });

  it("« Entrée » confirms the preview with the focus on nothing, the chosen card or the knight", () => {
    for (const focus of [
      { kind: "none" },
      { kind: "card", card: "12H" },
      { kind: "knight", pawn: "bleu0" },
    ] as FocusTarget[]) {
      expect(eventsOf(keyIntent(press("Enter"), context(QUEEN, preview, { focus })))).toEqual([
        { t: "confirm" },
      ]);
    }
  });

  it("« Entrée » keeps its meaning on a focused control or another card", () => {
    const focusOn = (focus: FocusTarget) =>
      keyIntent(press("Enter"), context(QUEEN, preview, { focus }));
    expect(focusOn({ kind: "control" })).toBeNull();
    expect(focusOn({ kind: "card", card: "4S" as CardId })).toBeNull();
    expect(focusOn({ kind: "knight", pawn: "bleu1" })).toBeNull();
  });

  it("plays the Dame with « 1 »-style picks then « Entrée », through the reducer only", () => {
    let ui = idle;
    const digit = String(hand.indexOf("12H") + 1);
    const submitted = [];
    for (const key of [digit, "a", "Enter"]) {
      const events = eventsOf(keyIntent(press(key), context(QUEEN, ui)));
      expect(events, key).not.toBeNull();
      for (const event of events ?? []) {
        const result = reduceTurnUi(ui, event, QUEEN.ctx);
        ui = result.state;
        if (result.submit) submitted.push(result.submit);
      }
    }
    expect(submitted).toEqual([{ t: "move", card: "12H", pawn: "bleu0" }]);
  });
});

describe("keyIntent: the guards", () => {
  const idle = reach(QUEEN);
  const preview = reach(QUEEN, { t: "tapCard", card: "12H" }, { t: "tapPawn", pawn: "bleu0" });

  it("does nothing while a sheet, a dialog or the end screen is up", () => {
    expect(keyIntent(press("1"), context(QUEEN, idle, { blocked: true }))).toBeNull();
    expect(keyIntent(press("Enter"), context(QUEEN, preview, { blocked: true }))).toBeNull();
  });

  it("does nothing in a form field", () => {
    expect(keyIntent(press("1"), context(QUEEN, idle, { focus: { kind: "field" } }))).toBeNull();
  });

  it("does nothing with Ctrl, Cmd or Alt held, on auto-repeat, or during IME composition", () => {
    for (const extra of [
      { ctrlKey: true },
      { metaKey: true },
      { altKey: true },
      { repeat: true },
      { isComposing: true },
    ]) {
      expect(keyIntent(press("1", extra), context(QUEEN, idle))).toBeNull();
      expect(keyIntent(press("Enter", extra), context(QUEEN, preview))).toBeNull();
    }
  });

  it("never returns an engine action: only turnUi reducer events", () => {
    const ENGINE = new Set(["move", "exit", "swap", "seven", "discard"]);
    const states = [idle, reach(QUEEN, { t: "tapCard", card: "12H" }), preview];
    const keys = ["1", "2", "3", "4", "5", "a", "b", "c", "d", "Enter", "Escape", "Backspace", "x"];
    for (const ui of states) {
      for (const key of keys) {
        for (const event of eventsOf(keyIntent(press(key), context(QUEEN, ui))) ?? []) {
          expect(ENGINE.has(event.t), `${ui.kind} ${key} → ${event.t}`).toBe(false);
        }
      }
    }
  });
});
