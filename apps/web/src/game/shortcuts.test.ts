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

// --- The whole map (Task 2): every key in every kind of state. ---

// The Valet with bleu0 and a vert0 target: both are knight « A ».
const JACK_SAME_LETTER = table({
  pawns: { bleu: [{ p: 5 }, "S", "S", "S"], vert: [{ p: 40 }, "S", "S", "S"] },
  hands: { bleu: ["11H"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
  turn: "bleu",
});

// Two knights too close to tell apart: a tap between them opens the tray.
const CLOSE = table({
  pawns: { bleu: [{ p: 5 }, { p: 6 }, "S", "S"] },
  hands: { bleu: ["3S"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
  turn: "bleu",
});

const DEAD = table({
  pawns: { bleu: ["S", "S", "S", "S"] },
  hands: { bleu: ["2S"], jaune: ["4S"], rouge: ["8D"], vert: ["9C"] },
  turn: "bleu",
});

const EXCHANGE = table(
  {
    hands: { bleu: ["2H", "3H", "4H", "5H", "6H"], jaune: ["2S"], rouge: ["2D"], vert: ["2C"] },
    turn: "jaune",
    dealer: "bleu",
  },
  "bleu",
  { phase: "exchange" },
);

const KEYS = ["Escape", "Enter", "Backspace", "1", "3", "8", "s", "a", "b", "p"] as const;
type Key = (typeof KEYS)[number];
type Row = { name: string; t: Table; ui: TurnUiState; expect: Partial<Record<Key, TurnUiEvent[]>> };

const queenHand = sortHand(QUEEN.ctx.view.hand);
const exchangeHand = sortHand(EXCHANGE.ctx.view.hand);
const sevenStart = reach(SEVEN, { t: "tapCard", card: "7H" });
const sevenPicked = reach(SEVEN, { t: "tapCard", card: "7H" }, { t: "tapPawn", pawn: "bleu0" });
const sevenGiven = reach(
  SEVEN,
  { t: "tapCard", card: "7H" },
  { t: "tapPawn", pawn: "bleu0" },
  { t: "pickSteps", steps: 3 },
);
const sevenDone = reach(
  SEVEN,
  { t: "tapCard", card: "7H" },
  { t: "tapPawn", pawn: "bleu0" },
  { t: "pickSteps", steps: 3 },
  { t: "tapPawn", pawn: "bleu1" },
  { t: "pickSteps", steps: 4 },
);
const closeSelected = reach(CLOSE, { t: "tapCard", card: "3S" });
const closeTray = reduceTurnUi(
  closeSelected,
  { t: "tapAt", near: ["bleu0", "bleu1"] },
  CLOSE.ctx,
).state;

/**
 * The expected events per key; a key left out maps to nothing (null). Card digits follow the hand of
 * the row's position.
 */
const ROWS: Row[] = [
  { name: "waiting", t: QUEEN, ui: { kind: "waiting" }, expect: {} },
  { name: "posed", t: QUEEN, ui: { kind: "posed" }, expect: {} },
  { name: "empty", t: QUEEN, ui: { kind: "empty" }, expect: {} },
  {
    name: "exchangeWaiting",
    t: EXCHANGE,
    ui: { kind: "exchangeWaiting", pending: ["rouge"] },
    expect: {},
  },
  {
    name: "idle",
    t: QUEEN,
    ui: reach(QUEEN),
    expect: {
      "1": [{ t: "tapCard", card: queenHand[0] as CardId }],
      "3": [{ t: "tapCard", card: queenHand[2] as CardId }],
    },
  },
  {
    name: "finishedPrompt",
    t: QUEEN,
    ui: { kind: "finishedPrompt" },
    expect: {
      "1": [{ t: "tapCard", card: queenHand[0] as CardId }],
      "3": [{ t: "tapCard", card: queenHand[2] as CardId }],
    },
  },
  {
    name: "cardSelected",
    t: QUEEN,
    ui: reach(QUEEN, { t: "tapCard", card: "12H" }),
    expect: {
      Escape: [{ t: "back" }],
      "1": [{ t: "tapCard", card: queenHand[0] as CardId }],
      "3": [{ t: "tapCard", card: queenHand[2] as CardId }],
      a: [{ t: "tapPawn", pawn: "bleu0" }],
    },
  },
  {
    name: "modeChoice",
    t: ACE,
    ui: reach(ACE, { t: "tapCard", card: "1S" }),
    expect: {
      Escape: [{ t: "back" }],
      "1": [{ t: "tapCard", card: "1S" }],
      s: [{ t: "chooseExit" }],
      a: [{ t: "chooseAdvance" }],
    },
  },
  {
    name: "jackPick",
    t: JACK,
    ui: reach(JACK, { t: "tapCard", card: "11H" }),
    expect: {
      Escape: [{ t: "back" }],
      "1": [{ t: "tapCard", card: "11H" }],
      a: [{ t: "tapPawn", pawn: "bleu0" }],
      b: [{ t: "tapPawn", pawn: "bleu1" }],
    },
  },
  {
    name: "jackTarget",
    t: JACK_SAME_LETTER,
    ui: reach(JACK_SAME_LETTER, { t: "tapCard", card: "11H" }, { t: "tapPawn", pawn: "bleu0" }),
    expect: {
      Escape: [{ t: "back" }],
      "1": [{ t: "tapCard", card: "11H" }],
      // bleu0 (his own knight) and vert0 (the target) are both « A »: the tray tells them apart.
      a: [{ t: "tapAt", near: ["bleu0", "vert0"] }],
    },
  },
  {
    name: "sevenBuilding (start)",
    t: SEVEN,
    ui: sevenStart,
    expect: {
      Escape: [{ t: "back" }],
      "1": [{ t: "pickSteps", steps: 1 }],
      "3": [{ t: "pickSteps", steps: 3 }],
      a: [{ t: "tapPawn", pawn: "bleu0" }],
      b: [{ t: "tapPawn", pawn: "bleu1" }],
    },
  },
  {
    name: "sevenBuilding (a knight selected)",
    t: SEVEN,
    ui: sevenPicked,
    expect: {
      Escape: [{ t: "back" }],
      "1": [{ t: "pickSteps", steps: 1 }],
      "3": [{ t: "pickSteps", steps: 3 }],
      a: [{ t: "tapPawn", pawn: "bleu0" }],
      b: [{ t: "tapPawn", pawn: "bleu1" }],
    },
  },
  {
    name: "sevenBuilding (a step given)",
    t: SEVEN,
    ui: sevenGiven,
    expect: {
      Escape: [{ t: "back" }],
      Backspace: [{ t: "undoLast" }],
      "1": [{ t: "pickSteps", steps: 1 }],
      "3": [{ t: "pickSteps", steps: 3 }],
      a: [{ t: "tapPawn", pawn: "bleu0" }],
      b: [{ t: "tapPawn", pawn: "bleu1" }],
    },
  },
  {
    name: "sevenBuilding (all spread)",
    t: SEVEN,
    ui: sevenDone,
    expect: {
      Escape: [{ t: "back" }],
      Enter: [{ t: "confirm" }],
      Backspace: [{ t: "undoLast" }],
      "1": [{ t: "pickSteps", steps: 1 }],
      "3": [{ t: "pickSteps", steps: 3 }],
    },
  },
  {
    name: "tray",
    t: CLOSE,
    ui: closeTray,
    expect: {
      Escape: [{ t: "back" }],
      a: [{ t: "chooseTrayOption", pawn: "bleu0" }],
      b: [{ t: "chooseTrayOption", pawn: "bleu1" }],
    },
  },
  {
    name: "preview",
    t: QUEEN,
    ui: reach(QUEEN, { t: "tapCard", card: "12H" }, { t: "tapPawn", pawn: "bleu0" }),
    expect: {
      Escape: [{ t: "back" }],
      Enter: [{ t: "confirm" }],
      "1": [{ t: "tapCard", card: queenHand[0] as CardId }],
      "3": [{ t: "tapCard", card: queenHand[2] as CardId }],
      a: [{ t: "tapPawn", pawn: "bleu0" }],
    },
  },
  {
    name: "exchange (no card chosen)",
    t: EXCHANGE,
    ui: { kind: "exchange" },
    expect: {
      "1": [{ t: "selectGive", card: exchangeHand[0] as CardId }],
      "3": [{ t: "selectGive", card: exchangeHand[2] as CardId }],
    },
  },
  {
    name: "exchange (a card chosen)",
    t: EXCHANGE,
    ui: { kind: "exchange", selected: "3H" },
    expect: {
      Escape: [{ t: "back" }],
      Enter: [{ t: "give" }],
      "1": [{ t: "selectGive", card: exchangeHand[0] as CardId }],
      "3": [{ t: "selectGive", card: exchangeHand[2] as CardId }],
      p: [{ t: "give" }],
    },
  },
  {
    name: "deadHand",
    t: DEAD,
    ui: reach(DEAD),
    expect: {
      Enter: [{ t: "pose" }],
      "1": [{ t: "tapCard", card: "2S" }],
      p: [{ t: "pose" }],
    },
  },
];

describe("keyIntent: every key in every state kind", () => {
  it("covers every kind of TurnUiState", () => {
    const kinds = new Set(ROWS.map((row) => row.ui.kind));
    for (const kind of [
      "waiting",
      "idle",
      "finishedPrompt",
      "cardSelected",
      "modeChoice",
      "jackPick",
      "jackTarget",
      "sevenBuilding",
      "tray",
      "preview",
      "exchange",
      "exchangeWaiting",
      "deadHand",
      "posed",
      "empty",
    ] as const) {
      expect(kinds.has(kind), kind).toBe(true);
    }
  });

  it("checks the positions the rows are built on", () => {
    expect(ROWS.find((row) => row.name === "deadHand")?.ui.kind).toBe("deadHand");
    expect(sevenDone).toMatchObject({ kind: "sevenBuilding", remaining: 0 });
    expect(closeTray.kind).toBe("tray");
  });

  for (const row of ROWS) {
    it(`${row.name}: ${KEYS.join(", ")}`, () => {
      for (const key of KEYS) {
        const got = eventsOf(keyIntent(press(key), context(row.t, row.ui)));
        expect(got, `${row.name} « ${key} »`).toEqual(row.expect[key] ?? null);
      }
    });
  }
});

describe("keyIntent: the details of the map", () => {
  it("the 7: « 8 » and « 9 » give nothing, « Retour arrière » with no step given does nothing", () => {
    expect(keyIntent(press("8"), context(SEVEN, sevenStart))).toBeNull();
    expect(keyIntent(press("9"), context(SEVEN, sevenStart))).toBeNull();
    expect(keyIntent(press("Backspace"), context(SEVEN, sevenStart))).toBeNull();
  });

  it("the 7's « Jouer » with « Entrée » only with nothing focused", () => {
    expect(
      keyIntent(press("Enter"), context(SEVEN, sevenDone, { focus: { kind: "control" } })),
    ).toBeNull();
    expect(keyIntent(press("Enter"), context(SEVEN, sevenGiven))).toBeNull();
  });

  it("the exchange: « Entrée » passes the card with the focus on it, not on another one", () => {
    const chosen: TurnUiState = { kind: "exchange", selected: "3H" };
    expect(
      eventsOf(
        keyIntent(
          press("Enter"),
          context(EXCHANGE, chosen, { focus: { kind: "card", card: "3H" } }),
        ),
      ),
    ).toEqual([{ t: "give" }]);
    expect(
      keyIntent(press("Enter"), context(EXCHANGE, chosen, { focus: { kind: "card", card: "5H" } })),
    ).toBeNull();
    expect(keyIntent(press("1"), context(EXCHANGE, chosen, { concealed: true }))).toBeNull();
  });

  it("a dead hand is laid with « Entrée » only with nothing focused", () => {
    expect(
      keyIntent(press("Enter"), context(DEAD, reach(DEAD), { focus: { kind: "control" } })),
    ).toBeNull();
  });

  it("in the tray, digits and « P » do nothing; a letter no chip carries does nothing", () => {
    expect(keyIntent(press("1"), context(CLOSE, closeTray))).toBeNull();
    expect(keyIntent(press("p"), context(CLOSE, closeTray))).toBeNull();
    expect(keyIntent(press("c"), context(CLOSE, closeTray))).toBeNull();
  });

  it("Shift held with a digit key still maps (AZERTY's top row)", () => {
    expect(
      eventsOf(keyIntent(press("1", { code: "Digit1" }), context(QUEEN, reach(QUEEN), {}))),
    ).toEqual([{ t: "tapCard", card: queenHand[0] }]);
    // Shift+« & » on AZERTY types « 1 »; without Shift « & »: both are Digit1.
    for (const key of ["&", "1"]) {
      expect(
        eventsOf(
          keyIntent(press(key, { code: "Digit1" }), context(EXCHANGE, { kind: "exchange" })),
        ),
      ).toEqual([{ t: "selectGive", card: exchangeHand[0] }]);
    }
  });

  it("letters are case-insensitive", () => {
    const question = reach(ACE, { t: "tapCard", card: "1S" });
    expect(eventsOf(keyIntent(press("S"), context(ACE, question)))).toEqual([{ t: "chooseExit" }]);
    expect(eventsOf(keyIntent(press("P"), context(DEAD, reach(DEAD))))).toEqual([{ t: "pose" }]);
  });
});

describe("keyIntent: round trips through the reducer", () => {
  /** Presses keys one after the other from `ui`, sending every event to the reducer. */
  function play(t: Table, ui: TurnUiState, ...keys: string[]) {
    let state = ui;
    const submitted = [];
    for (const key of keys) {
      const events = eventsOf(keyIntent(press(key), context(t, state)));
      if (events === null) throw new Error(`« ${key} » means nothing in ${state.kind}`);
      for (const event of events) {
        const result = reduceTurnUi(state, event, t.ctx);
        state = result.state;
        if (result.submit) submitted.push(result.submit);
      }
    }
    return { state, submitted };
  }

  it("As with both modes: « 1 », « s » preview the exit, « Entrée » plays it", () => {
    const shown = play(ACE, reach(ACE), "1", "s");
    expect(shown.state).toMatchObject({ kind: "preview", action: { t: "exit", card: "1S" } });
    expect(shown.submitted).toEqual([]);
    expect(play(ACE, reach(ACE), "1", "s", "Enter").submitted).toEqual([
      { t: "exit", card: "1S", pawn: expect.stringMatching(/^bleu/) },
    ]);
  });

  it("As: « 1 », « a » light the ring knight, then Échap goes back to the question, then to idle", () => {
    const advance = play(ACE, reach(ACE), "1", "a");
    expect(advance.state.kind).toBe("cardSelected");
    expect(play(ACE, advance.state, "Escape").state.kind).toBe("modeChoice");
    expect(play(ACE, advance.state, "Escape", "Escape").state.kind).toBe("idle");
  });

  it("Échap reaches the reducer as back: one step at a time", () => {
    const digit = String(queenHand.indexOf("12H") + 1);
    const preview = play(QUEEN, reach(QUEEN), digit, "a");
    expect(preview.state.kind).toBe("preview");
    expect(play(QUEEN, preview.state, "Escape").state.kind).toBe("cardSelected");
    expect(play(QUEEN, preview.state, "Escape", "Escape").state.kind).toBe("idle");
  });

  it("the Valet: two knights « A » open the tray, « b » takes vert0, « Entrée » swaps", () => {
    const tray = play(JACK_SAME_LETTER, reach(JACK_SAME_LETTER), "1", "a", "a");
    if (tray.state.kind !== "tray") throw new Error("no tray");
    expect(tray.state.options).toEqual(["bleu0", "vert0"]);
    const swapped = play(JACK_SAME_LETTER, tray.state, "b", "Enter");
    expect(swapped.submitted).toEqual([{ t: "swap", card: "11H", pawn: "bleu0", target: "vert0" }]);
  });

  it("the 7: « a », « 3 », « b », « 4 », « Entrée » play the split; « Retour arrière » takes a step back", () => {
    const split = play(SEVEN, reach(SEVEN), "1", "a", "3", "b", "4", "Enter");
    expect(split.submitted).toEqual([
      {
        t: "seven",
        card: "7H",
        plan: [
          { pawn: "bleu0", steps: 3 },
          { pawn: "bleu1", steps: 4 },
        ],
      },
    ]);
    const undone = play(SEVEN, reach(SEVEN), "1", "a", "3", "Backspace");
    expect(undone.state).toMatchObject({ kind: "sevenBuilding", remaining: 7, plan: [] });
  });

  it("the 7: a count the engine does not offer shows the refusal notice", () => {
    // bleu0 at 10 behind bleu1 at 30: every count is open, so ask a knight with none selected.
    const noKnight = play(SEVEN, reach(SEVEN), "1", "3");
    expect(noKnight.state).toMatchObject({ kind: "sevenBuilding", notice: "pickKnight" });
  });

  it("the exchange: « 2 », then « Entrée » passes the second card", () => {
    const passed = play(EXCHANGE, { kind: "exchange" }, "2", "Enter");
    expect(passed.submitted).toEqual([{ t: "give", card: exchangeHand[1] }]);
  });

  it("a dead hand: « p » lays it down", () => {
    expect(play(DEAD, reach(DEAD), "p").submitted).toEqual([{ t: "discard" }]);
  });
});
