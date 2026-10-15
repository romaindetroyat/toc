// The turn interaction as a pure reducer (RESEARCH Pattern 6): card, then knight, then preview, then
// confirm; the exchange; the dead hand. Svelte only renders the state it returns.
//
// The As and the Roi ask « Sortir ou avancer » when both are possible (D-16), the Valet takes two taps
// (his knight, then the one to swap with) and a tap near several candidate knights opens a tray of
// chips to tell them apart.
//
// Nothing here ever plays for the human (D-19, D-20): the reducer returns a `submit` only for
// `confirm` in a preview, `give` with a chosen card and `pose` on a dead hand. A preview is
// resolveMove(view, seat, action), the engine's own code, so what is shown is what will happen.
//
// A card that only one knight can play skips the knight tap (recette 3, test 27). Romain: « Quand il
// ne reste qu'un cheval sur le plateau, inutile de cliquer dessus pour jouer la carte, sauf valet
// évidemment ». The card tap opens that knight's preview, flagged `auto`, and « Jouer » still decides
// (D-19): an automatic step never submits. One step back from it puts the card down, since there was
// no knight choice to go back to. The same holds after « Avancer » of the As or the Roi (back is then
// the question) and for a 7 that has a single split: its assistant opens filled, « Reste 0 ». The
// Valet always asks for both knights (« sauf valet évidemment »).

import {
  type Action,
  type CardId,
  COLORS,
  type Color,
  isComplete,
  isFinished,
  legalActions,
  nextSteps,
  normalizePlan,
  type PawnId,
  type Place,
  type Playability,
  type PlayerView,
  pawnColor,
  placeOf,
  playability,
  previewPlan,
  type Reason,
  rankOf,
  resolveMove,
  type SevenPlan,
  sevenPlans,
  teamOf,
} from "@toc/engine";

/** What the French sentence under the board says about the previewed move; the words live in i18n. */
export type PreviewDescription = {
  verb: "exit" | "advance" | "back" | "swap";
  pawn: PawnId;
  /** Valet: the knight swapped with. */
  target?: PawnId;
  /** Cells moved (the card's value); 0 for an exit. */
  steps: number;
  entersHome: boolean;
};

/** One micro-move of the 7 as the board draws it: the knight, where it starts and every cell it enters. */
export type SevenMove = { pawn: PawnId; from: Place; path: Place[] };

/** A knight eaten on the way by the micro-move number `move` (an index into `moves`), at its `atStep`-th cell. */
export type SevenCapture = {
  by: PawnId;
  victim: PawnId;
  at: Place;
  move: number;
  atStep: number;
};

/** The plan so far, played by the engine (previewPlan): what the board shows before « Jouer ». */
export type SevenPreview = { moves: SevenMove[]; captures: SevenCapture[] };

export type TurnUiState =
  /** Not his turn, a move is playing, or the game is over: the board is locked. */
  | { kind: "waiting" }
  /** His turn, nothing selected. */
  | { kind: "idle" }
  /** His turn, with the « Tes quatre chevaux sont rentrés » prompt to show once. */
  | { kind: "finishedPrompt" }
  | { kind: "cardSelected"; card: CardId; candidates: Action[] }
  /** As or Roi with both an exit and an advance legal: « Que veux-tu faire ? ». */
  | { kind: "modeChoice"; card: CardId; exit: Action; advance: Action[] }
  /** Valet, first tap: one of his knights that has at least one swap. */
  | { kind: "jackPick"; card: CardId; candidates: Action[]; pawns: PawnId[] }
  /** Valet, second tap: the knights `pawn` can be swapped with. */
  | { kind: "jackTarget"; card: CardId; candidates: Action[]; pawn: PawnId; targets: PawnId[] }
  /**
   * The 7 (D-17): the steps are spread knight by knight. `plan` is what the player chose, one entry per
   * choice (the engine merges consecutive entries of one knight); `steps` is what each knight may still
   * be given, straight from nextSteps; `selected` is the knight whose chips are shown.
   */
  | {
      kind: "sevenBuilding";
      card: CardId;
      plan: SevenPlan;
      remaining: number;
      selected?: PawnId;
      steps: Partial<Record<PawnId, number[]>>;
      preview: SevenPreview;
      /** What the last refused choice was: a number of steps that cannot be finished, or no knight yet. */
      notice?: "stepRefused" | "pickKnight";
      /** Filled by itself: the 7 had a single split (recette 3, test 27). */
      auto?: true;
    }
  /** Candidate knights too close to tell apart: chips to choose from; `next` is where the flow resumes. */
  | { kind: "tray"; card: CardId; options: PawnId[]; next: TurnUiState }
  | {
      kind: "preview";
      card: CardId;
      /** The candidates of the card, to switch to another knight without going back. */
      candidates: Action[];
      action: Action;
      path: Place[];
      /** Valet: the two knights and the place each one will stand on. */
      swap?: { a: PawnId; b: PawnId; aTo: Place; bTo: Place };
      captured: PawnId[];
      /** A knight of his own side would be eaten (D-16): the UI warns. */
      partnerCapture: boolean;
      description: PreviewDescription;
      /** Reached by itself: the card had a single knight to play it (recette 3, test 27). */
      auto?: true;
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
  /** A tap on the board: the candidate knights within 44 screen px of it, nearest first. */
  | { t: "tapAt"; near: PawnId[] }
  | { t: "chooseExit" }
  | { t: "chooseAdvance" }
  | { t: "chooseTrayOption"; pawn: PawnId }
  | { t: "closeTray" }
  /** The 7: give `steps` to the selected knight. */
  | { t: "pickSteps"; steps: number }
  /** The 7: take back the last micro-move only (order matters). */
  | { t: "undoLast" }
  /** The 7: drop the plan and the card. */
  | { t: "cancelAll" }
  | { t: "confirm" }
  | { t: "cancel" }
  | { t: "changeCard" }
  | { t: "escape" }
  /** One step back, the keyboard's Échap (UI-SPEC addendum 2026-10-14): never drops more than one choice. */
  | { t: "back" }
  | { t: "selectGive"; card: CardId }
  | { t: "give" }
  | { t: "pose" };

/** What the reducer reads: the view and what the engine says about it. */
export type TurnCtx = {
  view: PlayerView;
  seat: Color;
  playability: Record<CardId, Playability>;
  /** legalActions(view, seat, { sevenPlans: 'none' }): the 7 is spread by sevenBuilding, with nextSteps. */
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
    state.kind === "modeChoice" ||
    state.kind === "jackPick" ||
    state.kind === "jackTarget" ||
    state.kind === "sevenBuilding" ||
    state.kind === "tray" ||
    state.kind === "preview" ||
    state.kind === "deadHand"
  );
}

/** Whether a card is selected (the reducer is somewhere between the card and « Jouer »). */
function hasCard(state: TurnUiState): state is Extract<TurnUiState, { card: CardId }> {
  return (
    state.kind === "cardSelected" ||
    state.kind === "modeChoice" ||
    state.kind === "jackPick" ||
    state.kind === "jackTarget" ||
    state.kind === "sevenBuilding" ||
    state.kind === "tray" ||
    state.kind === "preview"
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

/** The Valet's swaps for a card, in the engine's order. */
function swapsOf(ctx: TurnCtx, card: CardId): Action[] {
  return ctx.legal.filter((a) => a.t === "swap" && a.card === card);
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
  auto = false,
): Extract<TurnUiState, { kind: "preview" }> | null {
  const state = resolvedPreview(card, candidates, action, ctx);
  return state !== null && auto ? { ...state, auto: true } : state;
}

function resolvedPreview(
  card: CardId,
  candidates: Action[],
  action: Action,
  ctx: TurnCtx,
): Extract<TurnUiState, { kind: "preview" }> | null {
  if (action.t !== "exit" && action.t !== "move" && action.t !== "swap") return null;
  const resolved = resolveMove(ctx.view, ctx.seat, action);
  const first = resolved.events[0];
  if (action.t === "swap") {
    if (first?.t !== "pawnsSwapped") return null;
    return {
      kind: "preview",
      card,
      candidates,
      action,
      path: [],
      swap: { a: first.a, b: first.b, aTo: first.aTo, bTo: first.bTo },
      captured: [],
      partnerCapture: false,
      description: {
        verb: "swap",
        pawn: action.pawn,
        target: action.target,
        steps: 0,
        entersHome: false,
      },
    };
  }
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

/** The state a tap on a card leads to: the question, the Valet's first tap, or the candidate knights. */
function selectCard(card: CardId, ctx: TurnCtx): TurnUiState {
  if (rankOf(card) === 7) {
    return (
      singleSplit(card, ctx) ??
      buildSeven(card, [], undefined, ctx) ?? { kind: "cardSelected", card, candidates: [] }
    );
  }
  if (rankOf(card) === 11) {
    const candidates = swapsOf(ctx, card);
    const pawns = [...new Set(candidates.flatMap((a) => (a.t === "swap" ? [a.pawn] : [])))];
    return { kind: "jackPick", card, candidates, pawns };
  }
  const candidates = candidatesOf(ctx, card);
  const exit = candidates.find((a) => a.t === "exit");
  const advance = candidates.filter((a) => a.t === "move");
  if (exit !== undefined && advance.length > 0) return { kind: "modeChoice", card, exit, advance };
  return litOrAuto(card, candidates, ctx);
}

/** The card's lit knights, or, when a single one can play it, its preview at once (recette 3, test 27). */
function litOrAuto(card: CardId, candidates: Action[], ctx: TurnCtx): TurnUiState {
  const only = candidates[0];
  if (candidates.length === 1 && only !== undefined) {
    const preview = previewState(card, candidates, only, ctx, true);
    if (preview !== null) return preview;
  }
  return { kind: "cardSelected", card, candidates };
}

// ---------------------------------------------------------------------------------------------
// The 7, knight by knight (D-17). Every number of steps offered comes from nextSteps, and the preview
// is previewPlan: the engine's own micro-moves, with the same captures in transit.

/** The sum of a plan's steps. */
const spent = (plan: SevenPlan): number => plan.reduce((sum, entry) => sum + entry.steps, 0);

/** « A » to « D »: the knight's index in its colour, as written on the 7 panel's rows. */
export function knightLetter(pawn: PawnId): string {
  return "ABCD".charAt(Number(pawn.slice(-1)));
}

/** The plan so far as the board draws it, read from the events of previewPlan; null when it is refused. */
function sevenPreview(card: CardId, plan: SevenPlan, ctx: TurnCtx): SevenPreview | null {
  const played = previewPlan(ctx.view, ctx.seat, card, plan);
  if (!played.ok) return null;
  // Where each knight stands as the micro-moves go by: the `from` of a move into the home is not an event.
  const at = new Map<PawnId, Place>();
  for (const [id, pawn] of Object.entries(ctx.view.pawns) as [
    PawnId,
    PlayerView["pawns"][PawnId],
  ][]) {
    at.set(id, placeOf(id, pawn));
  }
  const moves: SevenMove[] = [];
  const captures: SevenCapture[] = [];
  for (const event of played.events) {
    if (event.t === "pawnMoved" || event.t === "pawnEnteredHome") {
      const from = at.get(event.pawn) as Place;
      moves.push({ pawn: event.pawn, from, path: event.path });
      at.set(
        event.pawn,
        event.t === "pawnMoved"
          ? (event.path[event.path.length - 1] as Place)
          : { z: "home", color: pawnColor(event.pawn), slot: event.slot },
      );
    } else if (event.t === "pawnCaptured") {
      captures.push({
        by: event.by,
        victim: event.victim,
        at: event.at,
        move: moves.length - 1,
        atStep: event.atStep,
      });
    } else if (event.t === "pawnSentHome") {
      at.set(event.pawn, event.to);
    }
  }
  return { moves, captures };
}

/** A 7 with exactly one complete split: its assistant filled with it, « Reste 0 », or null. */
function singleSplit(card: CardId, ctx: TurnCtx): TurnUiState | null {
  const plans = sevenPlans(ctx.view, ctx.seat, card, 2);
  const only = plans[0];
  if (plans.length !== 1 || only === undefined) return null;
  const filled = buildSeven(card, normalizePlan(only), undefined, ctx);
  return filled !== null && filled.remaining === 0 ? { ...filled, auto: true } : null;
}

/** The splitter for `plan`: what is left, what each knight may be given, and the preview. */
function buildSeven(
  card: CardId,
  plan: SevenPlan,
  selected: PawnId | undefined,
  ctx: TurnCtx,
): Extract<TurnUiState, { kind: "sevenBuilding" }> | null {
  const preview = sevenPreview(card, plan, ctx);
  if (preview === null) return null;
  const state: Extract<TurnUiState, { kind: "sevenBuilding" }> = {
    kind: "sevenBuilding",
    card,
    plan,
    remaining: 7 - spent(plan),
    steps: nextSteps(ctx.view, ctx.seat, card, plan),
    preview,
  };
  if (selected !== undefined) state.selected = selected;
  return state;
}

function pickSteps(state: TurnUiState, steps: number, ctx: TurnCtx): TurnUiResult {
  if (state.kind !== "sevenBuilding") return { state };
  const { selected } = state;
  if (selected === undefined) return { state: { ...state, notice: "pickKnight" } };
  if (!(state.steps[selected] ?? []).includes(steps)) {
    return { state: { ...state, notice: "stepRefused" } };
  }
  const next = buildSeven(state.card, [...state.plan, { pawn: selected, steps }], undefined, ctx);
  return { state: next ?? state };
}

function undoLast(state: TurnUiState, ctx: TurnCtx): TurnUiResult {
  if (state.kind !== "sevenBuilding" || state.plan.length === 0) return { state };
  // A split filled by itself is the only one: taking a step back would rebuild the same plan.
  if (state.auto) return { state: IDLE };
  const next = buildSeven(state.card, state.plan.slice(0, -1), undefined, ctx);
  return { state: next ?? state };
}

/** « Jouer » of the 7: only with nothing left to spread, and only a plan the engine plays whole (T-01-31). */
function confirmSeven(state: Extract<TurnUiState, { kind: "sevenBuilding" }>, ctx: TurnCtx) {
  const plan = normalizePlan(state.plan);
  if (state.remaining !== 0 || !isComplete(ctx.view, ctx.seat, state.card, plan)) return { state };
  return {
    state: { kind: "waiting" } as TurnUiState,
    submit: { t: "seven", card: state.card, plan } as Action,
  };
}

function tapCard(state: TurnUiState, card: CardId, ctx: TurnCtx): TurnUiResult {
  const choosing = isOwnTurn(state) || state.kind === "finishedPrompt";
  if (!choosing || !ctx.view.hand.includes(card)) return { state };
  if (hasCard(state) && state.card === card) return { state: IDLE };
  const verdict = ctx.playability[card];
  if (verdict === undefined) return { state };
  if (!verdict.playable) return { state, hint: verdict.reason };
  return { state: selectCard(card, ctx) };
}

/** What a tap on `pawn` leads to from `state`, or null when the knight is not one to tap there. */
function stepFor(state: TurnUiState, pawn: PawnId, ctx: TurnCtx): TurnUiState | null {
  switch (state.kind) {
    case "cardSelected": {
      const action = actionFor(state.candidates, pawn, ctx);
      return action === undefined ? null : previewState(state.card, state.candidates, action, ctx);
    }
    case "jackPick": {
      if (!state.pawns.includes(pawn)) return null;
      const targets = state.candidates.flatMap((a) =>
        a.t === "swap" && a.pawn === pawn ? [a.target] : [],
      );
      return { kind: "jackTarget", card: state.card, candidates: state.candidates, pawn, targets };
    }
    case "jackTarget":
      return stepFromSwap(state, state.pawn, state.targets, pawn, ctx);
    case "sevenBuilding": {
      // A knight with something to be given is selected; the same knight again lets it go.
      if ((state.steps[pawn] ?? []).length === 0) return null;
      const { selected: _, notice: __, ...rest } = state;
      return pawn === state.selected ? rest : { ...rest, selected: pawn };
    }
    case "preview": {
      if (state.action.t === "swap") {
        const own = state.action.pawn;
        const targets = state.candidates.flatMap((a) =>
          a.t === "swap" && a.pawn === own ? [a.target] : [],
        );
        return stepFromSwap(state, own, targets, pawn, ctx);
      }
      const action = actionFor(state.candidates, pawn, ctx);
      if (action === undefined) return null;
      return previewState(state.card, state.candidates, action, ctx, state.auto === true);
    }
    default:
      return null;
  }
}

/** Valet, own knight chosen: a target previews the swap, the knight itself goes back to the first tap. */
function stepFromSwap(
  state: Extract<TurnUiState, { kind: "jackTarget" | "preview" }>,
  own: PawnId,
  targets: PawnId[],
  pawn: PawnId,
  ctx: TurnCtx,
): TurnUiState | null {
  if (targets.includes(pawn)) {
    const action = state.candidates.find(
      (a) => a.t === "swap" && a.pawn === own && a.target === pawn,
    );
    return action === undefined ? null : previewState(state.card, state.candidates, action, ctx);
  }
  if (pawn !== own) return null;
  // The chosen knight again: from the preview back to its targets, from its targets back to the choice.
  if (state.kind === "preview") {
    return {
      kind: "jackTarget",
      card: state.card,
      candidates: state.candidates,
      pawn: own,
      targets,
    };
  }
  const pawns = [...new Set(state.candidates.flatMap((a) => (a.t === "swap" ? [a.pawn] : [])))];
  return { kind: "jackPick", card: state.card, candidates: state.candidates, pawns };
}

function tapPawn(state: TurnUiState, pawn: PawnId, ctx: TurnCtx): TurnUiResult {
  const next = stepFor(state, pawn, ctx);
  return { state: next ?? state };
}

/** Two stable knights of one colour are the same exit (A-11): one option for them all. */
function optionKey(pawn: PawnId, ctx: TurnCtx): string {
  return ctx.view.pawns[pawn].zone === "stable" ? `stable:${pawnColor(pawn)}` : pawn;
}

const TRAY_MAX = 4;

/** A tap near knights: one tapped as such, several open the tray (2 to 4 chips). */
function tapAt(state: TurnUiState, near: PawnId[], ctx: TurnCtx): TurnUiResult {
  const seen = new Set<string>();
  const options: PawnId[] = [];
  for (const pawn of near) {
    if (stepFor(state, pawn, ctx) === null) continue;
    const key = optionKey(pawn, ctx);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(pawn);
  }
  const first = options[0];
  if (first === undefined) return { state };
  if (options.length === 1 || !hasCard(state)) return tapPawn(state, first, ctx);
  return {
    state: { kind: "tray", card: state.card, options: options.slice(0, TRAY_MAX), next: state },
  };
}

function chooseTrayOption(state: TurnUiState, pawn: PawnId, ctx: TurnCtx): TurnUiResult {
  if (state.kind !== "tray" || !state.options.includes(pawn)) return { state };
  return tapPawn(state.next, pawn, ctx);
}

/**
 * The letters A to D written on the chips and over the knights of the tray: the knight's index in
 * its colour, or its place in the tray when two options would carry the same letter.
 */
export function trayLetters(options: readonly PawnId[]): string[] {
  const byIndex = options.map((pawn) => "ABCD".charAt(Number(pawn.slice(-1))));
  return new Set(byIndex).size === options.length
    ? byIndex
    : options.map((_, i) => "ABCD".charAt(i));
}

function chooseMode(state: TurnUiState, mode: "exit" | "advance", ctx: TurnCtx): TurnUiResult {
  if (state.kind !== "modeChoice") return { state };
  if (mode === "advance") return { state: litOrAuto(state.card, state.advance, ctx) };
  const next = previewState(state.card, [state.exit], state.exit, ctx);
  return { state: next ?? state };
}

function deselect(state: TurnUiState): TurnUiResult {
  if (hasCard(state)) return { state: IDLE };
  if (state.kind === "exchange" && state.selected !== undefined) {
    return { state: { kind: "exchange" } };
  }
  return { state };
}

/** The Valet's targets for his own knight `own`, in the engine's order. */
function swapTargets(candidates: Action[], own: PawnId): PawnId[] {
  return candidates.flatMap((a) => (a.t === "swap" && a.pawn === own ? [a.target] : []));
}

/**
 * One step back (the keyboard's Échap): the tray to its flow, a preview to the choice it came from, the
 * Valet's target to his own knight, « Avancer » to the As/Roi question, the 7 to its knight or its last
 * step, and only then the card. Never submits anything.
 */
function back(state: TurnUiState, ctx: TurnCtx): TurnUiResult {
  switch (state.kind) {
    case "tray":
      return { state: state.next };
    case "preview": {
      const { action, card, candidates } = state;
      if (state.auto) {
        // Reached by itself: there was no knight to choose, so back is the As/Roi question or no card.
        const question = selectCard(card, ctx);
        return { state: question.kind === "modeChoice" ? question : IDLE };
      }
      if (action.t === "swap") {
        return {
          state: {
            kind: "jackTarget",
            card,
            candidates,
            pawn: action.pawn,
            targets: swapTargets(candidates, action.pawn),
          },
        };
      }
      if (action.t === "exit") {
        const question = selectCard(card, ctx);
        if (question.kind === "modeChoice") return { state: question };
      }
      return { state: { kind: "cardSelected", card, candidates } };
    }
    case "jackTarget": {
      const pawns = [...new Set(state.candidates.flatMap((a) => (a.t === "swap" ? [a.pawn] : [])))];
      return {
        state: { kind: "jackPick", card: state.card, candidates: state.candidates, pawns },
      };
    }
    case "cardSelected": {
      const question = selectCard(state.card, ctx);
      return { state: question.kind === "modeChoice" ? question : IDLE };
    }
    case "jackPick":
    case "modeChoice":
      return { state: IDLE };
    case "sevenBuilding": {
      if (state.auto) return { state: IDLE };
      if (state.selected !== undefined) {
        const { selected: _, notice: __, ...rest } = state;
        return { state: rest };
      }
      if (state.plan.length > 0) return undoLast(state, ctx);
      return { state: IDLE };
    }
    case "exchange":
      return state.selected === undefined ? { state } : { state: { kind: "exchange" } };
    default:
      return { state };
  }
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
    case "tapAt":
      return tapAt(state, event.near, ctx);
    case "chooseExit":
      return chooseMode(state, "exit", ctx);
    case "chooseAdvance":
      return chooseMode(state, "advance", ctx);
    case "chooseTrayOption":
      return chooseTrayOption(state, event.pawn, ctx);
    case "closeTray":
      return state.kind === "tray" ? { state: state.next } : { state };
    case "pickSteps":
      return pickSteps(state, event.steps, ctx);
    case "undoLast":
      return undoLast(state, ctx);
    case "cancelAll":
      return hasCard(state) ? { state: IDLE } : { state };
    case "confirm":
      if (state.kind === "sevenBuilding") return confirmSeven(state, ctx);
      return state.kind === "preview"
        ? { state: { kind: "waiting" }, submit: state.action }
        : { state };
    case "cancel":
    case "changeCard":
    case "escape":
      return deselect(state);
    case "back":
      return back(state, ctx);
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
