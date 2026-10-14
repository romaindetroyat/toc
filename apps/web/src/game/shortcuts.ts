// The keyboard shortcuts of the game screen (UI-SPEC « Addendum 2026-10-14 — Raccourcis clavier »), as
// a pure key map: a key press and what the screen shows give the turnUi reducer events to send, or
// nothing. No DOM access here: Game.svelte reads the key and the focus, then dispatches the events.
//
// The map returns reducer events only, never an engine Action (T-01-36): whatever a key does, the
// reducer decides, and a move is only submitted by the confirm step the player triggers (D-19).

import { ALL_PAWNS, type CardId, type PawnId, type Place, pawnColor } from "@toc/engine";
import { knightLetter, type TurnUiEvent, type TurnUiState } from "./turnUi.ts";

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
};

export type KeyIntent = { kind: "turn"; events: TurnUiEvent[] } | null;

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

/** « Entrée » plays only with the focus on nothing, on the chosen card or on the previewed knight. */
function enterPlays(ui: Extract<TurnUiState, { kind: "preview" }>, focus: FocusTarget): boolean {
  if (focus.kind === "none") return true;
  if (focus.kind === "card") return focus.card === ui.card;
  if (focus.kind === "knight") return previewed(ui, focus.pawn);
  return false;
}

const turn = (...events: TurnUiEvent[]): KeyIntent => ({ kind: "turn", events });

/** What a key press means on the game screen, or null when it means nothing there. */
export function keyIntent(input: KeyInput, ctx: KeyContext): KeyIntent {
  if (ctx.blocked || ctx.focus.kind === "field") return null;
  if (input.ctrlKey || input.metaKey || input.altKey || input.repeat || input.isComposing) {
    return null;
  }
  const { ui } = ctx;

  const digit = digitOf(input.code);
  if (digit !== null) {
    if (!CARD_STATES.has(ui.kind) || ctx.concealed) return null;
    const card = ctx.hand[digit - 1];
    return card === undefined ? null : turn({ t: "tapCard", card });
  }

  const key = input.key.toLowerCase();
  if (key.length === 1 && key >= "a" && key <= "d") {
    if (!KNIGHT_STATES.has(ui.kind)) return null;
    const letter = key.toUpperCase();
    const matching = ctx.lit.filter((pawn) => knightLetter(pawn) === letter);
    const only = matching[0];
    return matching.length === 1 && only !== undefined ? turn({ t: "tapPawn", pawn: only }) : null;
  }

  if (input.key === "Enter") {
    return ui.kind === "preview" && enterPlays(ui, ctx.focus) ? turn({ t: "confirm" }) : null;
  }

  return null;
}
