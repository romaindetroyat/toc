// The keyboard shortcuts of the game screen (UI-SPEC « Addendum 2026-10-14 — Raccourcis clavier »), as
// a pure key map: a key press and what the screen shows give the turnUi reducer events to send, or
// nothing. No DOM access here: Game.svelte reads the key and the focus, then dispatches the events.
//
// The map returns reducer events only, never an engine Action (T-01-36): whatever a key does, the
// reducer decides, and a move is only submitted by the confirm step the player triggers (D-19).

import { ALL_PAWNS, type CardId, type PawnId, type Place, pawnColor } from "@toc/engine";
import { knightLetter, type TurnUiEvent, type TurnUiState, trayLetters } from "./turnUi.ts";

/** The parts of a KeyboardEvent the map reads. */
export type KeyInput = {
  key: string;
  code: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  repeat: boolean;
  isComposing: boolean;
};

/** Where the focus is: nothing, a card of the hand, a lit knight, another control, or a form field. */
export type FocusTarget =
  | { kind: "none" }
  | { kind: "card"; card: CardId }
  | { kind: "knight"; pawn: PawnId }
  | { kind: "control" }
  | { kind: "field" };

export type KeyContext = {
  ui: TurnUiState;
  /** The hand in display order, left to right (sortHand). */
  hand: readonly CardId[];
  /** The lit knights (litKnights): the only ones a letter can reach. */
  lit: readonly PawnId[];
  /** The new hand is held back while the cards of the deal fly. */
  concealed: boolean;
  focus: FocusTarget;
  /** A sheet or dialog is open, the end screen is up, or there is no game. */
  blocked: boolean;
  /** An online game: « M » opens « Messages rapides » (plan 02-08); absent or false in the local game. */
  messages?: boolean;
};

/** Reducer events to send, the help sheet (« ? ») or the quick messages (« M », online) to open, or nothing. */
export type KeyIntent =
  | { kind: "turn"; events: TurnUiEvent[] }
  | { kind: "help" }
  | { kind: "messages" }
  | null;

/**
 * The knights lit for the flow (the state under the tray): the 7's knights that may still be given
 * steps, the Valet's own knights or his chosen knight and its targets, a card's moving knights and,
 * for an exit, every stable knight of that colour (A-11). HitLayer, Overlay and the key map share it.
 */
export function litKnights(
  flow: TurnUiState,
  places: Readonly<Partial<Record<PawnId, Place>>>,
): PawnId[] {
  const out = new Set<PawnId>();
  if (flow.kind === "sevenBuilding") {
    for (const pawn of ALL_PAWNS) {
      if ((flow.steps[pawn] ?? []).length > 0) out.add(pawn);
    }
  } else if (flow.kind === "jackPick") {
    for (const pawn of flow.pawns) out.add(pawn);
  } else if (flow.kind === "jackTarget") {
    out.add(flow.pawn);
    for (const pawn of flow.targets) out.add(pawn);
  } else if (flow.kind === "preview" && flow.action.t === "swap") {
    const own = flow.action.pawn;
    out.add(own);
    for (const action of flow.candidates) {
      if (action.t === "swap" && action.pawn === own) out.add(action.target);
    }
  } else if (flow.kind === "cardSelected" || flow.kind === "preview") {
    for (const action of flow.candidates) {
      if (action.t === "move") out.add(action.pawn);
      else if (action.t === "exit") {
        const color = pawnColor(action.pawn);
        for (const pawn of ALL_PAWNS) {
          if (pawnColor(pawn) === color && places[pawn]?.z === "stable") out.add(pawn);
        }
      }
    }
  }
  return [...out];
}

/** The digit of the physical key (AZERTY's top row gives « & » for Digit1), or null. */
function digitOf(code: string): number | null {
  const match = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  return match ? Number(match[1]) : null;
}

/** The states in which a digit picks a card of the hand. */
const CARD_STATES: ReadonlySet<TurnUiState["kind"]> = new Set([
  "idle",
  "finishedPrompt",
  "cardSelected",
  "modeChoice",
  "jackPick",
  "jackTarget",
  "preview",
  "deadHand",
]);

/** The states in which a letter picks a lit knight. */
const KNIGHT_STATES: ReadonlySet<TurnUiState["kind"]> = new Set([
  "cardSelected",
  "jackPick",
  "jackTarget",
  "sevenBuilding",
  "preview",
]);

/** The knights a preview plays: the moving one, the Valet's target, or any knight of the exit's colour. */
function previewed(ui: Extract<TurnUiState, { kind: "preview" }>, pawn: PawnId): boolean {
  const { action } = ui;
  if (action.t === "exit") return pawnColor(pawn) === pawnColor(action.pawn);
  if (action.t === "swap") return pawn === action.pawn || pawn === action.target;
  return action.t === "move" && action.pawn === pawn;
}

/** Whether the focus lets « Entrée » play: nothing focused, the chosen card or the previewed knight. */
function enterPlays(ui: Extract<TurnUiState, { kind: "preview" }>, focus: FocusTarget): boolean {
  if (focus.kind === "none") return true;
  if (focus.kind === "card") return focus.card === ui.card;
  if (focus.kind === "knight") return previewed(ui, focus.pawn);
  return false;
}

/** The states « Échap » steps back from (the 7 and a chosen exchange card included). */
const BACK_STATES: ReadonlySet<TurnUiState["kind"]> = new Set([
  "tray",
  "preview",
  "jackTarget",
  "jackPick",
  "cardSelected",
  "modeChoice",
  "sevenBuilding",
]);

const turn = (...events: TurnUiEvent[]): KeyIntent => ({ kind: "turn", events });

/** « Entrée »: the primary action of the action zone, when it is ready. */
function enterIntent(ctx: KeyContext): KeyIntent {
  const { ui, focus } = ctx;
  switch (ui.kind) {
    case "preview":
      return enterPlays(ui, focus) ? turn({ t: "confirm" }) : null;
    case "sevenBuilding":
      return ui.remaining === 0 && focus.kind === "none" ? turn({ t: "confirm" }) : null;
    case "exchange": {
      if (ui.selected === undefined) return null;
      const onCard = focus.kind === "card" && focus.card === ui.selected;
      return focus.kind === "none" || onCard ? turn({ t: "give" }) : null;
    }
    case "deadHand":
      return focus.kind === "none" ? turn({ t: "pose" }) : null;
    default:
      return null;
  }
}

/** A digit: the 7's steps, the card to pass, or the n-th card of the hand. */
function digitIntent(n: number, ctx: KeyContext): KeyIntent {
  const { ui } = ctx;
  if (ui.kind === "sevenBuilding") return n <= 7 ? turn({ t: "pickSteps", steps: n }) : null;
  if (ctx.concealed) return null;
  const card = ctx.hand[n - 1];
  if (card === undefined) return null;
  if (ui.kind === "exchange") return turn({ t: "selectGive", card });
  return CARD_STATES.has(ui.kind) ? turn({ t: "tapCard", card }) : null;
}

/** « A » to « D »: a tray chip, or the lit knights with that letter (several open the tray). */
function knightIntent(letter: string, ctx: KeyContext): KeyIntent {
  const { ui } = ctx;
  if (ui.kind === "tray") {
    const index = trayLetters(ui.options).indexOf(letter);
    const pawn = ui.options[index];
    return pawn === undefined ? null : turn({ t: "chooseTrayOption", pawn });
  }
  if (!KNIGHT_STATES.has(ui.kind)) return null;
  const matching = ctx.lit.filter((pawn) => knightLetter(pawn) === letter);
  const only = matching[0];
  if (only === undefined) return null;
  return matching.length === 1
    ? turn({ t: "tapPawn", pawn: only })
    : turn({ t: "tapAt", near: matching });
}

/** What a key press means on the game screen, or null when it means nothing there. */
export function keyIntent(input: KeyInput, ctx: KeyContext): KeyIntent {
  if (ctx.blocked || ctx.focus.kind === "field") return null;
  if (input.ctrlKey || input.metaKey || input.altKey || input.repeat || input.isComposing) {
    return null;
  }
  // « ? » (typed with Shift on most layouts) opens the help sheet, whatever the turn.
  if (input.key === "?") return { kind: "help" };
  // « M » (the typed letter, wherever the layout puts it) opens the quick messages online, whatever the turn.
  if (ctx.messages === true && (input.key === "m" || input.key === "M")) {
    return { kind: "messages" };
  }
  const { ui } = ctx;

  const digit = digitOf(input.code);
  if (digit !== null) return digitIntent(digit, ctx);

  switch (input.key) {
    case "Escape": {
      const chosen =
        BACK_STATES.has(ui.kind) || (ui.kind === "exchange" && ui.selected !== undefined);
      return chosen ? turn({ t: "back" }) : null;
    }
    case "Enter":
      return enterIntent(ctx);
    case "Backspace":
      return ui.kind === "sevenBuilding" && ui.plan.length > 0 ? turn({ t: "undoLast" }) : null;
  }

  const key = input.key.length === 1 ? input.key.toLowerCase() : "";
  if (ui.kind === "modeChoice") {
    if (key === "s") return turn({ t: "chooseExit" });
    if (key === "a") return turn({ t: "chooseAdvance" });
    return null;
  }
  if (key === "p") {
    if (ui.kind === "exchange" && ui.selected !== undefined) return turn({ t: "give" });
    return ui.kind === "deadHand" ? turn({ t: "pose" }) : null;
  }
  if (key >= "a" && key <= "d") return knightIntent(key.toUpperCase(), ctx);

  return null;
}
