// The lesson guide's checks (APP-04, D-09; 05-RESEARCH Pattern 5): pure functions placed in front of
// the turn reducer, so a lesson is the game screen with a guide and not a second game.
//
// - lessonStep: the current step, derived from the turn state and the moves played (never a counter of
//   taps), so a step back (Échap, « Changer de carte ») brings that step's line back and no guide line
//   is ever skipped. Only the narration lines are counted, as they have no trace in the turn state.
// - lessonGate: whether an event goes on to the reducer, or the guide's line that explains why not.
//   A wrong card or knight is refused with the step's wrong line and changes nothing; things the game
//   itself refuses go through, so the game's own reason is shown. No failure state, no counter.
// - lessonHalo: what the guide rings.
//
// Nothing here knows a rule: what may be played comes from the engine through reduceTurnUi. No storage,
// no clock (the 4 s return of the step's line belongs to the screen), no Svelte.

import type { Action, CardId, PawnId } from "@toc/engine";
import type { Lesson, LessonStep } from "./lessons.ts";
import { reduceTurnUi, type TurnCtx, type TurnUiEvent, type TurnUiState } from "./turnUi.ts";

/** A turn event, or the guide's « Suivant ». */
export type LessonEvent = TurnUiEvent | { t: "next" };

/** What the lesson screen keeps: the narration lines passed and the player's moves the engine took. */
export type LessonProgress = { told: number; played: readonly Action[] };

/** The current step; `ready` is false while a « cross » line waits for the cards to cross. */
export type LessonAt = { index: number; step: LessonStep; ready: boolean };

export type LessonVerdict =
  | { pass: true }
  /** Refused: show `line`; `reset` is applied to the turn state (lesson 6's split back to its start). */
  | { pass: false; line: string; reset?: TurnUiEvent[] };

/** What the guide rings. */
export type LessonHalo =
  | { t: "card"; card: CardId }
  | { t: "pawn"; pawn: PawnId }
  | { t: "chip"; steps: number }
  | { t: "button"; button: "next" | "confirm" | "give" };

const PASS: LessonVerdict = { pass: true };

/** The card chosen so far, in a play or in the exchange. */
function chosenCard(ui: TurnUiState): CardId | undefined {
  switch (ui.kind) {
    case "cardSelected":
    case "modeChoice":
    case "jackPick":
    case "jackTarget":
    case "sevenBuilding":
    case "tray":
    case "preview":
      return ui.card;
    case "exchange":
      return ui.selected;
    default:
      return undefined;
  }
}

/** The knights chosen so far for the card in hand. */
function chosenPawns(ui: TurnUiState): PawnId[] {
  switch (ui.kind) {
    case "jackTarget":
      return [ui.pawn];
    case "preview":
      if (ui.action.t === "swap") return [ui.action.pawn, ui.action.target];
      return ui.action.t === "move" || ui.action.t === "exit" ? [ui.action.pawn] : [];
    case "sevenBuilding":
      return [...ui.plan.map((entry) => entry.pawn), ...(ui.selected ? [ui.selected] : [])];
    case "tray":
      return chosenPawns(ui.next);
    default:
      return [];
  }
}

/** The steps already spread on the 7. */
function spread(ui: TurnUiState): number {
  return ui.kind === "sevenBuilding" ? ui.plan.reduce((sum, entry) => sum + entry.steps, 0) : 0;
}

/** Whether the step ends with an action for the engine (it is over once the move is played). */
function submits(step: LessonStep): boolean {
  return step.expect.t === "button" || step.expect.t === "plan";
}

/** Whether the exchanged cards have crossed. */
function crossed(ui: TurnUiState): boolean {
  return ui.kind !== "exchange" && ui.kind !== "exchangeWaiting";
}

/** The current step of `lesson`, or null once the lesson is over (the « Bravo » plank). */
export function lessonStep(
  lesson: Lesson,
  ui: TurnUiState,
  progress: LessonProgress,
): LessonAt | null {
  let told = progress.told;
  let move = 0;
  let share = 0;
  for (const [index, step] of lesson.steps.entries()) {
    const want = step.expect;
    const done = move < progress.played.length;
    if (submits(step)) move++;
    switch (want.t) {
      case "next":
      case "cross":
        if (told > 0) {
          told--;
          break;
        }
        return { index, step, ready: want.t === "next" || crossed(ui) };
      case "card":
        if (!done && chosenCard(ui) !== want.card) return { index, step, ready: true };
        break;
      case "pawn":
        if (!done && !chosenPawns(ui).includes(want.pawn)) return { index, step, ready: true };
        break;
      case "steps":
        share += want.steps;
        if (!done && (ui.kind !== "sevenBuilding" || spread(ui) < share)) {
          return { index, step, ready: true };
        }
        break;
      case "button":
      case "plan":
        if (!done) return { index, step, ready: true };
        break;
    }
  }
  return null;
}

/** Whether the lesson is over: its « Bravo » plank shows. */
export function lessonDone(lesson: Lesson, ui: TurnUiState, progress: LessonProgress): boolean {
  return lessonStep(lesson, ui, progress) === null;
}

/** The line for a wrong card or knight at `step`. */
function wrongLine(step: LessonStep, choice: CardId | PawnId | undefined): string {
  return (choice === undefined ? undefined : step.wrongs?.[choice]) ?? step.wrong ?? step.line;
}

/** The knights a tap stands for, among those the game would take now (nearest first). */
function tappedPawns(event: TurnUiEvent, ui: TurnUiState, ctx: TurnCtx): PawnId[] | null {
  const takes = (e: TurnUiEvent) => reduceTurnUi(ui, e, ctx).state !== ui;
  switch (event.t) {
    case "tapPawn":
      return takes(event) ? [event.pawn] : [];
    case "chooseTrayOption":
      return takes(event) ? [event.pawn] : [];
    case "tapAt":
      return event.near.filter((pawn) => takes({ t: "tapPawn", pawn }));
    default:
      return null;
  }
}

/**
 * Whether `event` may go on to the reducer at `step`, or the line that explains why not. Only choices
 * the lesson does not want are refused; the steps back always pass.
 */
export function lessonGate(
  step: LessonStep,
  event: LessonEvent,
  ui: TurnUiState,
  ctx: TurnCtx,
): LessonVerdict {
  const want = step.expect;
  const narration = want.t === "next" || want.t === "cross";

  if (event.t === "next") {
    if (want.t === "next" || (want.t === "cross" && crossed(ui))) return PASS;
    return { pass: false, line: step.line };
  }
  switch (event.t) {
    case "sync":
    case "back":
    case "escape":
    case "cancel":
    case "changeCard":
    case "cancelAll":
    case "undoLast":
    case "closeTray":
      return PASS;
    default:
      break;
  }
  if (narration) return { pass: false, line: step.line };

  if (event.t === "tapCard" || event.t === "selectGive") {
    // The card of the step, or the card already chosen (touching it again puts it down: a step back).
    const right = want.t === "card" ? want.card : chosenCard(ui);
    return event.card === right ? PASS : { pass: false, line: wrongLine(step, event.card) };
  }

  const taps = tappedPawns(event, ui, ctx);
  if (taps !== null) {
    // A tap the game does nothing with changes nothing; lesson 6's split lets any knight pass.
    if (taps.length === 0 || want.t === "steps" || want.t === "plan") return PASS;
    const allowed = [...chosenPawns(ui), ...(want.t === "pawn" ? [want.pawn] : [])];
    return taps.some((pawn) => allowed.includes(pawn))
      ? PASS
      : { pass: false, line: wrongLine(step, taps[0]) };
  }

  if (event.t === "confirm" && want.t === "plan" && ui.kind === "sevenBuilding") {
    const result = reduceTurnUi(ui, event, ctx);
    if (result.submit === undefined) return PASS;
    const eaten = ui.preview.captures.map((capture) => capture.victim);
    if (want.eats.every((pawn) => eaten.includes(pawn))) return PASS;
    return {
      pass: false,
      line: wrongLine(step, undefined),
      reset: [{ t: "cancelAll" }, { t: "tapCard", card: ui.card }],
    };
  }

  // Nothing is played at another step than the one that asks for it.
  const asks =
    (event.t === "confirm" && want.t === "button" && want.button === "confirm") ||
    (event.t === "give" && want.t === "button" && want.button === "give");
  if (!asks && reduceTurnUi(ui, event, ctx).submit !== undefined) {
    return { pass: false, line: step.line };
  }
  return PASS;
}

/** What the guide rings at `step` (nothing once the lesson is over). */
export function lessonHalo(step: LessonStep | null, ui: TurnUiState): LessonHalo[] {
  if (step === null) return [];
  const want = step.expect;
  switch (want.t) {
    case "next":
    case "cross":
      return [{ t: "button", button: "next" }];
    case "card":
      return [{ t: "card", card: want.card }];
    case "pawn":
      return [{ t: "pawn", pawn: want.pawn }];
    case "steps":
      return ui.kind === "sevenBuilding" && ui.selected === want.pawn
        ? [{ t: "chip", steps: want.steps }]
        : [{ t: "pawn", pawn: want.pawn }];
    case "button":
      return [{ t: "button", button: want.button }];
    case "plan":
      return [{ t: "button", button: "confirm" }];
  }
}
