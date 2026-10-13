// The turn interaction as a pure reducer (RESEARCH Pattern 6): card, then knight, then preview, then
// confirm; the exchange; the dead hand. Svelte only renders the state it returns.
//
// Nothing here ever plays for the human (D-19, D-20): the reducer returns a `submit` only for
// `confirm` in a preview, `give` with a chosen card and `pose` on a dead hand. A preview is
// resolveMove(view, seat, action), the engine's own code, so what is shown is what will happen.

import {
  type Action,
  type CardId,
  COLORS,
  type Color,
  isFinished,
  legalActions,
  type PawnId,
  type Place,
  type Playability,
  type PlayerView,
  pawnColor,
  playability,
  type Reason,
  rankOf,
  resolveMove,
  teamOf,
} from "@toc/engine";

/** What the French sentence under the board says about the previewed move; the words live in i18n. */
export type PreviewDescription = {
  verb: "exit" | "advance" | "back";
  pawn: PawnId;
  /** Cells moved (the card's value); 0 for an exit. */
  steps: number;
  entersHome: boolean;
};

export type TurnUiState =
  /** Not his turn, a move is playing, or the game is over: the board is locked. */
  | { kind: "waiting" }
  /** His turn, nothing selected. */
  | { kind: "idle" }
  /** His turn, with the « Tes quatre chevaux sont rentrés » prompt to show once. */
  | { kind: "finishedPrompt" }
  | { kind: "cardSelected"; card: CardId; candidates: Action[] }
  | {
      kind: "preview";
      card: CardId;
      /** The candidates of the card, to switch to another knight without going back. */
      candidates: Action[];
      action: Action;
      path: Place[];
      captured: PawnId[];
      /** A knight of his own side would be eaten (D-16): the UI warns. */
      partnerCapture: boolean;
      description: PreviewDescription;
    }
  | { kind: "exchange"; selected?: CardId }
  | { kind: "exchangeWaiting"; pending: Color[] }
  | { kind: "deadHand" }
  /** His dead hand lies on the felt. */
  | { kind: "posed" }
  /** No card left between two deals. */
  | { kind: "empty" };

export type TurnUiEvent =
  /** The view changed: recompute the state from the context. */
  | { t: "sync" }
  | { t: "tapCard"; card: CardId }
  | { t: "tapPawn"; pawn: PawnId }
  | { t: "confirm" }
  | { t: "cancel" }
  | { t: "changeCard" }
  | { t: "escape" }
  | { t: "selectGive"; card: CardId }
  | { t: "give" }
  | { t: "pose" };

/** What the reducer reads: the view and what the engine says about it. */
export type TurnCtx = {
  view: PlayerView;
  seat: Color;
  playability: Record<CardId, Playability>;
  /** legalActions(view, seat, { sevenPlans: 'none' }): the 7 is added by plan 01-18. */
  legal: Action[];
};

export type TurnUiResult = {
  state: TurnUiState;
  /** An action for the controller; only ever set by confirm, give and pose. */
  submit?: Action;
  /** The reason a tapped card cannot be played (UI-SPEC copy keys). */
  hint?: Reason;
};

export const initialTurnUi: TurnUiState = { kind: "waiting" };

/** The context of a view: the engine's playability table and legal actions, computed once. */
export function turnCtx(view: PlayerView, seat: Color): TurnCtx {
  return {
    view,
    seat,
    playability: view.phase === "play" ? playability(view, seat) : ({} as TurnCtx["playability"]),
    legal: legalActions(view, seat, { sevenPlans: "none" }),
  };
}

const IDLE: TurnUiState = { kind: "idle" };

function pendingGivers(ctx: TurnCtx): Color[] {
  return COLORS.filter((color) => color !== ctx.seat && !ctx.view.hasGiven[color]);
}

/** Whether the state is one of his own-turn states (the finished prompt was already shown). */
function isOwnTurn(state: TurnUiState): boolean {
  return (
    state.kind === "idle" ||
    state.kind === "cardSelected" ||
    state.kind === "preview" ||
    state.kind === "deadHand"
  );
}

function derive(prev: TurnUiState, ctx: TurnCtx): TurnUiState {
  const { view, seat } = ctx;
  if (view.phase === "won") return { kind: "waiting" };

  if (view.phase === "exchange") {
    if (view.hasGiven[seat]) return { kind: "exchangeWaiting", pending: pendingGivers(ctx) };
    if (prev.kind === "exchange" && prev.selected !== undefined) {
      if (view.hand.includes(prev.selected)) return { kind: "exchange", selected: prev.selected };
    }
    return { kind: "exchange" };
  }

  if (view.hand.length === 0) {
    return view.posed[seat].length > 0 ? { kind: "posed" } : { kind: "empty" };
  }
  if (view.turn !== seat) return { kind: "waiting" };

  const only = ctx.legal[0];
  if (ctx.legal.length === 1 && only?.t === "discard") return { kind: "deadHand" };
  if (prev.kind === "finishedPrompt") return prev;
  if (!isOwnTurn(prev) && isFinished(view, seat)) return { kind: "finishedPrompt" };
  return IDLE;
}

/** The movement candidates of a card: the ones the knights can be tapped for in this plan. */
function candidatesOf(ctx: TurnCtx, card: CardId): Action[] {
  return ctx.legal.filter((a) => (a.t === "exit" || a.t === "move") && a.card === card);
}

/** The action a tap on `pawn` means among `candidates`: a stable knight of the right colour is the exit. */
function actionFor(candidates: Action[], pawn: PawnId, ctx: TurnCtx): Action | undefined {
  if (ctx.view.pawns[pawn].zone === "stable") {
    // Stable knights are interchangeable (A-11): any of them stands for the one the engine offers.
    return candidates.find((a) => a.t === "exit" && pawnColor(a.pawn) === pawnColor(pawn));
  }
  return candidates.find((a) => a.t === "move" && a.pawn === pawn);
}

function previewState(
  card: CardId,
  candidates: Action[],
  action: Action,
  ctx: TurnCtx,
): TurnUiState | null {
  if (action.t !== "exit" && action.t !== "move") return null;
  const resolved = resolveMove(ctx.view, ctx.seat, action);
  const first = resolved.events[0];
  let path: Place[] = [];
  if (first?.t === "pawnMoved" || first?.t === "pawnEnteredHome") path = first.path;
  else if (first?.t === "pawnExited") path = [first.to];
  const rank = rankOf(card);
  const description: PreviewDescription =
    action.t === "exit"
      ? { verb: "exit", pawn: action.pawn, steps: 0, entersHome: false }
      : {
          verb: rank === 4 ? "back" : "advance",
          pawn: action.pawn,
          steps: rank,
          entersHome: first?.t === "pawnEnteredHome",
        };
  return {
    kind: "preview",
    card,
    candidates,
    action,
    path,
    captured: resolved.captured,
    partnerCapture: resolved.captured.some((v) => teamOf(pawnColor(v)) === teamOf(ctx.seat)),
    description,
  };
}

function tapCard(state: TurnUiState, card: CardId, ctx: TurnCtx): TurnUiResult {
  const choosing = isOwnTurn(state) || state.kind === "finishedPrompt";
  if (!choosing || !ctx.view.hand.includes(card)) return { state };
  if ((state.kind === "cardSelected" || state.kind === "preview") && state.card === card) {
    return { state: IDLE };
  }
  const verdict = ctx.playability[card];
  if (verdict === undefined) return { state };
  if (!verdict.playable) return { state, hint: verdict.reason };
  return { state: { kind: "cardSelected", card, candidates: candidatesOf(ctx, card) } };
}

function tapPawn(state: TurnUiState, pawn: PawnId, ctx: TurnCtx): TurnUiResult {
  if (state.kind !== "cardSelected" && state.kind !== "preview") return { state };
  const action = actionFor(state.candidates, pawn, ctx);
  if (action === undefined) return { state };
  const next = previewState(state.card, state.candidates, action, ctx);
  return { state: next ?? state };
}

function deselect(state: TurnUiState): TurnUiResult {
  if (state.kind === "cardSelected" || state.kind === "preview") return { state: IDLE };
  if (state.kind === "exchange" && state.selected !== undefined) {
    return { state: { kind: "exchange" } };
  }
  return { state };
}

function selectGive(state: TurnUiState, card: CardId, ctx: TurnCtx): TurnUiResult {
  if (state.kind !== "exchange" || !ctx.view.hand.includes(card)) return { state };
  return {
    state: state.selected === card ? { kind: "exchange" } : { kind: "exchange", selected: card },
  };
}

function give(state: TurnUiState, ctx: TurnCtx): TurnUiResult {
  if (state.kind !== "exchange" || state.selected === undefined) return { state };
  const action: Action = { t: "give", card: state.selected };
  const offered = ctx.legal.some((a) => a.t === "give" && a.card === state.selected);
  if (!offered) return { state };
  return { state: { kind: "exchangeWaiting", pending: pendingGivers(ctx) }, submit: action };
}

/**
 * One step of the turn interaction. Pure: the result is a new state and, at most, one action to
 * submit. Events that make no sense in the current state leave it unchanged.
 */
export function reduceTurnUi(state: TurnUiState, event: TurnUiEvent, ctx: TurnCtx): TurnUiResult {
  switch (event.t) {
    case "sync":
      return { state: derive(state, ctx) };
    case "tapCard":
      return tapCard(state, event.card, ctx);
    case "tapPawn":
      return tapPawn(state, event.pawn, ctx);
    case "confirm":
      return state.kind === "preview"
        ? { state: { kind: "waiting" }, submit: state.action }
        : { state };
    case "cancel":
    case "changeCard":
    case "escape":
      return deselect(state);
    case "selectGive":
      return selectGive(state, event.card, ctx);
    case "give":
      return give(state, ctx);
    case "pose":
      return state.kind === "deadHand" && ctx.legal.some((a) => a.t === "discard")
        ? { state: { kind: "waiting" }, submit: { t: "discard" } }
        : { state };
  }
}
