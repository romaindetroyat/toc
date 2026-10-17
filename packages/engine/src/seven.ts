// The 7 (RULES.md R-10, R-11, R-15; choices G5 and G12 read from board.rules): one ordered plan of
// (pawn, steps) micro-moves whose steps sum to exactly 7.
// - every micro-move is a forward walk() with { capturePassed: true, ownIds } and is checked when it
//   happens, so the order matters and a captured pawn frees its cell for the rest of the plan;
// - the plan is atomic: the first micro-move that fails rejects the whole plan, the input is untouched;
// - two consecutive entries of the same pawn count as one (RULES.md R-10): plans are merged before
//   they are played, and the plans listed by sevenPlans are in that merged form;
// - nextSteps offers, while a plan is being built, only the step counts after which the 7 can still be
//   completed exactly (existence search memoised on the board, the steps left, the last pawn);
// - G16 (KNIGHT_MUST_ENTER, decided by Romain on 2026-10-15, judged card by card: « Seulement la carte qui
//   le fait rentrer pile est obligée de le faire rentrer. Avec le 9, il peut continuer son tour. »): the
//   knights a split of this 7 can leave in their home (sevenMustEnter) end the plan either where they
//   started or in their home. It is a check on the finished plan, so a knight may stop on its carré 16 and
//   enter with a later step; previewPlan never applies it. If no plan respects it, the 7 plays as before.
// - sevenOutcomes (phase 3, for the computer players) lists one plan per distinct end board: the same
//   search as sevenPlans, which expands each equivalent partial state once, so a 7 with thousands of
//   plans costs a handful of boards. Its boards are exactly those of sevenPlans then applyPlan.
// Pure, no I/O, erasable syntax only.

import type { GameEvent } from "./events.ts";
import { controlledPawns, homeCount, ownPawns, winningTeam } from "./moves.ts";
import {
  ALL_PAWNS,
  type Board,
  placeOf,
  stablePlace,
  type WalkFailure,
  type WalkOk,
  walk,
} from "./path.ts";
import type { RuleSet } from "./rules.ts";
import { type Color, ENTRY, PARTNER, type PawnId, pawnColor, RING, ringIndex } from "./topology.ts";
import type { CardId, Pawn, SevenPlan } from "./types.ts";
import { rankOf } from "./types.ts";

/** What a 7 is worth. */
const SEVEN = 7;

type Pawns = Record<PawnId, Pawn>;

/**
 * Why a plan is refused: a failed micro-move (walk reason), a plan that is not a 7, or a finished plan that
 * moved a knight this 7 could bring home without bringing it home (G16).
 */
export type PlanFailure =
  | WalkFailure
  | "bad-plan"
  | "not-controlled"
  | "same-pawn-twice"
  | "must-enter";

export type PlanOk = {
  ok: true;
  /** The plan as played: consecutive entries of one pawn merged. */
  plan: SevenPlan;
  /** The pawns after the whole plan (a copy: the input is never touched). */
  pawns: Record<PawnId, Pawn>;
  /** Per micro-move: pawnMoved or pawnEnteredHome, then its pawnCaptured / pawnSentHome pairs. */
  events: GameEvent[];
  captured: PawnId[];
};
export type PlanResult = PlanOk | { ok: false; reason: PlanFailure };

export type SevenOpts = {
  /** Playability only: pretend no pawn is protected, to tell « blocked by a protected pawn » from the rest. */
  ignoreProtection?: boolean;
};

const bit = (pawn: PawnId): number => 1 << ALL_PAWNS.indexOf(pawn);

/** Merges consecutive entries of the same pawn (RULES.md R-10: they count as one). */
export function normalizePlan(plan: SevenPlan): SevenPlan {
  const out: SevenPlan = [];
  for (const entry of plan) {
    const last = out[out.length - 1];
    if (last !== undefined && last.pawn === entry.pawn) {
      out[out.length - 1] = { pawn: last.pawn, steps: last.steps + entry.steps };
    } else {
      out.push({ pawn: entry.pawn, steps: entry.steps });
    }
  }
  return out;
}

/** Untrusted input (T-01-18): a non-empty array of known pawns with whole, positive step counts. */
function wellFormed(plan: unknown): plan is SevenPlan {
  if (!Array.isArray(plan) || plan.length === 0 || plan.length > SEVEN) return false;
  return plan.every((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return false;
    const { pawn, steps } = entry as { pawn?: unknown; steps?: unknown };
    return (
      typeof pawn === "string" &&
      (ALL_PAWNS as readonly string[]).includes(pawn) &&
      typeof steps === "number" &&
      Number.isInteger(steps) &&
      steps >= 1 &&
      steps <= SEVEN
    );
  });
}

const total = (plan: SevenPlan): number => plan.reduce((sum, entry) => sum + entry.steps, 0);

/** True when a pawn appears twice in a merged plan (separated by another pawn). */
function repeatsPawn(plan: SevenPlan): boolean {
  return new Set(plan.map((entry) => entry.pawn)).size !== plan.length;
}

// ---------------------------------------------------------------------------------------------
// One micro-move

type Ctx = {
  seat: Color;
  rules: RuleSet;
  /** Pawns controlled and « own » at the start of the plan (used when G12 is off). */
  startControlled: PawnId[];
  startOwn: PawnId[];
  ignoreProtection: boolean;
  /** G16: the knights the finished plan must leave where they started or in their home. */
  mustEnter: readonly PawnId[];
  /** The pawns at the start of the plan (where a knight of mustEnter may stay). */
  start: Pawns;
};

function makeCtx(board: Board, seat: Color, opts: SevenOpts, mustEnter: readonly PawnId[]): Ctx {
  return {
    seat,
    rules: board.rules,
    startControlled: controlledPawns(board, seat),
    startOwn: ownPawns(board, seat),
    ignoreProtection: opts.ignoreProtection === true,
    mustEnter,
    start: board.pawns,
  };
}

/** G16 on a finished plan: every knight of ctx.mustEnter is where it started or in its home. */
function keepsDuty(ctx: Ctx, pawns: Pawns): boolean {
  for (const id of ctx.mustEnter) {
    const now = pawns[id];
    const was = ctx.start[id];
    if (now.zone === "home") continue;
    if (now.zone === "ring" && was.zone === "ring" && now.progress === was.progress) continue;
    return false;
  }
  return true;
}

/**
 * The pawns the seat may move now, and the ones that count as « his own » (not eaten, not a landing
 * place). Once the seat's fourth pawn is home they are the partner's (G12), unless SEVEN_CONTINUES_WITH_PARTNER
 * is off, in which case the set held at the start of the turn stays.
 */
function actors(ctx: Ctx, pawns: Pawns): { controlled: PawnId[]; own: PawnId[] } {
  if (!ctx.rules.SEVEN_CONTINUES_WITH_PARTNER) {
    return { controlled: ctx.startControlled, own: ctx.startOwn };
  }
  const board = { pawns, rules: ctx.rules };
  return { controlled: controlledPawns(board, ctx.seat), own: ownPawns(board, ctx.seat) };
}

type Micro =
  | { ok: true; next: Pawns; walked: WalkOk }
  | { ok: false; reason: WalkFailure | "not-controlled" };

/** `pawn` walks `steps` forward on `pawns`: the pawns after the move, captured pawns back in their stables. */
function microMove(ctx: Ctx, pawns: Pawns, pawn: PawnId, steps: number): Micro {
  const { controlled, own } = actors(ctx, pawns);
  if (!controlled.includes(pawn)) return { ok: false, reason: "not-controlled" };
  const walked = walk({ pawns, rules: ctx.rules }, pawn, steps, 1, {
    capturePassed: true,
    ownIds: own,
    ignoreProtection: ctx.ignoreProtection,
  });
  if (!walked.ok) return walked;
  const next: Pawns = { ...pawns };
  next[pawn] = walked.end;
  for (const { victim } of walked.captures) next[victim] = { zone: "stable" };
  return { ok: true, next, walked };
}

/** The events of one micro-move, in the order the table shows them. */
function microEvents(pawn: PawnId, before: Pawns, micro: Micro & { ok: true }): GameEvent[] {
  const events: GameEvent[] = [];
  const start = before[pawn];
  const { walked, next } = micro;
  if (walked.end.zone === "home" && start.zone === "ring") {
    events.push({
      t: "pawnEnteredHome",
      pawn,
      path: walked.path,
      slot: walked.end.slot,
      homeCount: homeCount(next, pawnColor(pawn)),
    });
    // The fourth pawn of a colour is home; the victory (which has no playerFinished) is told by apply.
    if (homeCount(next, pawnColor(pawn)) === 4 && winningTeam(next) === null) {
      const seat = pawnColor(pawn);
      events.push({ t: "playerFinished", seat, partner: PARTNER[seat] });
    }
  } else {
    events.push({ t: "pawnMoved", pawn, from: placeOf(pawn, start), path: walked.path, dir: 1 });
  }
  for (const { victim, atStep } of walked.captures) {
    events.push({
      t: "pawnCaptured",
      by: pawn,
      victim,
      at: placeOf(victim, before[victim]),
      atStep,
    });
    events.push({ t: "pawnSentHome", pawn: victim, to: stablePlace(victim) });
  }
  return events;
}

// ---------------------------------------------------------------------------------------------
// Playing a whole plan

function copyPawns(pawns: Pawns): Pawns {
  const copy = {} as Pawns;
  for (const id of ALL_PAWNS) copy[id] = { ...pawns[id] };
  return copy;
}

/**
 * Plays `plan` (untrusted) for `seat`: micro-moves in order, each checked when it happens. Returns the
 * pawns after the plan, the events and the captured pawns, or the reason of the first failure; the whole
 * plan is refused as one and `board` is never modified (RULE-10).
 */
export function applyPlan(board: Board, seat: Color, card: CardId, plan: SevenPlan): PlanResult {
  if (rankOf(card) !== SEVEN || !wellFormed(plan)) return { ok: false, reason: "bad-plan" };
  const merged = normalizePlan(plan);
  if (total(merged) !== SEVEN) return { ok: false, reason: "bad-plan" };
  return playMerged(board, seat, merged, sevenMustEnter(board, seat));
}

/**
 * Plays the first steps of a 7 for a preview (the splitter of the interface): the same micro-moves as
 * applyPlan, with the same checks, but the steps may sum to less than 7 and the plan may be empty.
 * The events are the ones the whole plan would begin with, so what is shown is what will happen.
 */
export function previewPlan(board: Board, seat: Color, card: CardId, plan: SevenPlan): PlanResult {
  if (rankOf(card) !== SEVEN) return { ok: false, reason: "bad-plan" };
  const merged = plan.length === 0 ? [] : wellFormedPrefix(plan);
  if (merged === null) return { ok: false, reason: "bad-plan" };
  // An unfinished plan may still bring the knight home later: G16 is not applied here.
  return playMerged(board, seat, merged, []);
}

/** Plays a merged plan; `mustEnter` (G16) is checked once the last micro-move is played. */
function playMerged(
  board: Board,
  seat: Color,
  merged: SevenPlan,
  mustEnter: readonly PawnId[],
): PlanResult {
  if (!board.rules.SEVEN_SAME_PAWN_TWICE && repeatsPawn(merged)) {
    return { ok: false, reason: "same-pawn-twice" };
  }

  const ctx = makeCtx(board, seat, {}, mustEnter);
  let pawns: Pawns = board.pawns;
  const events: GameEvent[] = [];
  const captured: PawnId[] = [];
  for (const { pawn, steps } of merged) {
    const micro = microMove(ctx, pawns, pawn, steps);
    if (!micro.ok) return { ok: false, reason: micro.reason };
    events.push(...microEvents(pawn, pawns, micro));
    for (const { victim } of micro.walked.captures) captured.push(victim);
    pawns = micro.next;
  }
  if (!keepsDuty(ctx, pawns)) return { ok: false, reason: "must-enter" };
  return { ok: true, plan: merged, pawns: copyPawns(pawns), events, captured };
}

/** True when `plan` is a whole 7: the steps sum to 7 and every micro-move is legal in turn. */
export function isComplete(board: Board, seat: Color, card: CardId, plan: SevenPlan): boolean {
  return applyPlan(board, seat, card, plan).ok;
}

// ---------------------------------------------------------------------------------------------
// Existence search and enumeration

/**
 * An existence search. `goal` (sevenMustEnter only) asks for a finished plan that leaves this knight in its
 * home; ctx.mustEnter (G16) is checked on every finished plan.
 */
type Search = { ctx: Ctx; memo: Map<string, boolean>; goal: PawnId | null };

/** The search of the exported entry points: G16 filled from the board (sevenMustEnter). */
const newSearch = (board: Board, seat: Color, opts: SevenOpts = {}): Search => ({
  ctx: makeCtx(board, seat, opts, sevenMustEnter(board, seat)),
  memo: new Map(),
  goal: null,
});

function boardKey(pawns: Pawns): string {
  let key = "";
  for (const id of ALL_PAWNS) {
    const pawn = pawns[id];
    key +=
      pawn.zone === "stable" ? "s," : pawn.zone === "home" ? `h${pawn.slot},` : `${pawn.progress},`;
  }
  return key;
}

/**
 * Calls `visit` for every legal micro-move of `remaining` steps or fewer from `pawns`, pawn by pawn
 * (the pawn that just moved is skipped: its next steps would merge with the last entry), and stops as
 * soon as `visit` returns true. Returns whether it stopped.
 */
function eachChild(
  search: Search,
  pawns: Pawns,
  remaining: number,
  last: PawnId | null,
  used: number,
  descending: boolean,
  visit: (pawn: PawnId, steps: number, next: Pawns) => boolean,
): boolean {
  const { ctx } = search;
  for (const pawn of actors(ctx, pawns).controlled) {
    if (pawn === last || pawns[pawn].zone === "stable") continue;
    if (!ctx.rules.SEVEN_SAME_PAWN_TWICE && (used & bit(pawn)) !== 0) continue;
    for (let i = 1; i <= remaining; i++) {
      const steps = descending ? remaining + 1 - i : i;
      const micro = microMove(ctx, pawns, pawn, steps);
      if (micro.ok && visit(pawn, steps, micro.next)) return true;
    }
  }
  return false;
}

/** Can the `remaining` steps still be played exactly from here? */
function completable(
  search: Search,
  pawns: Pawns,
  remaining: number,
  last: PawnId | null,
  used: number,
): boolean {
  if (remaining === 0) {
    if (search.goal !== null && pawns[search.goal].zone !== "home") return false;
    return keepsDuty(search.ctx, pawns);
  }
  const key = `${boardKey(pawns)}|${remaining}|${last ?? ""}|${search.ctx.rules.SEVEN_SAME_PAWN_TWICE ? 0 : used}|${search.goal ?? ""}`;
  const known = search.memo.get(key);
  if (known !== undefined) return known;
  const found = eachChild(search, pawns, remaining, last, used, true, (pawn, steps, next) =>
    completable(search, next, remaining - steps, pawn, used | bit(pawn)),
  );
  search.memo.set(key, found);
  return found;
}

/**
 * G16: may the knight at progress `q` of `color` reach its carré 16 within the first 6 steps of a 7, where
 * the walk may open its home (always under G14, from progress 70 on otherwise)? A cheap filter before the
 * goal search.
 */
function nearEntry(color: Color, q: number, rules: RuleSet): boolean {
  for (let k = 0; k < SEVEN; k++) {
    if (
      ringIndex(color, q + k) === ENTRY[color] &&
      (rules.ENTRY_WITHOUT_FULL_LAP || q + k >= RING - 2)
    ) {
      return true;
    }
  }
  return false;
}

/** sevenMustEnter per board object and seat: states and views are never mutated. */
const mustEnterMemo = new WeakMap<Board, Map<Color, readonly PawnId[]>>();

/**
 * G16 (KNIGHT_MUST_ENTER): the knights `seat` controls, standing on the ring, that some complete plan of a
 * 7 leaves in their home, judged under every other rule (without G16). Any 7 that moves one of them must
 * leave it in its home. The plans of a 7 do not depend on which 7 it is, so no card is needed.
 * [] when the switch is off, and [] when no plan of the 7 could respect the duty while some plan exists
 * without it: G16 never makes a 7 unplayable.
 */
export function sevenMustEnter(board: Board, seat: Color): readonly PawnId[] {
  if (!board.rules.KNIGHT_MUST_ENTER) return [];
  let bySeat = mustEnterMemo.get(board);
  const known = bySeat?.get(seat);
  if (known !== undefined) return known;

  const ctx = makeCtx(board, seat, {}, []);
  const memo = new Map<string, boolean>();
  const duty = ctx.startControlled.filter((id) => {
    const pawn = board.pawns[id];
    if (pawn.zone !== "ring" || !nearEntry(pawnColor(id), pawn.progress, board.rules)) return false;
    return completable({ ctx, memo, goal: id }, board.pawns, SEVEN, null, 0);
  });
  let found: readonly PawnId[] = duty;
  if (duty.length > 0) {
    // The safety: a duty no plan can keep is dropped (the 7 is playable here, the goal search found a plan).
    const dutyCtx = makeCtx(board, seat, {}, duty);
    if (!completable({ ctx: dutyCtx, memo: new Map(), goal: null }, board.pawns, SEVEN, null, 0)) {
      found = [];
    }
  }
  if (bySeat === undefined) {
    bySeat = new Map();
    mustEnterMemo.set(board, bySeat);
  }
  bySeat.set(seat, found);
  return found;
}

/** Can `seat` play a 7 at all? With `ignoreProtection`, could it if no pawn were protected? */
export function canPlaySeven(board: Board, seat: Color, opts: SevenOpts = {}): boolean {
  return completable(newSearch(board, seat, opts), board.pawns, SEVEN, null, 0);
}

/**
 * Every valid plan of `card`, in a fixed order (pawn order, then fewer steps first), consecutive entries
 * of one pawn merged. `limit` stops the enumeration early (tests, previews).
 */
export function sevenPlans(
  board: Board,
  seat: Color,
  card: CardId,
  limit = Number.POSITIVE_INFINITY,
): SevenPlan[] {
  if (rankOf(card) !== SEVEN) return [];
  const search = newSearch(board, seat);
  const out: SevenPlan[] = [];
  const prefix: SevenPlan = [];

  const walkPlans = (
    pawns: Pawns,
    remaining: number,
    last: PawnId | null,
    used: number,
  ): boolean => {
    if (remaining === 0) {
      out.push(prefix.map((entry) => ({ ...entry })));
      return out.length >= limit;
    }
    return eachChild(search, pawns, remaining, last, used, false, (pawn, steps, next) => {
      if (!completable(search, next, remaining - steps, pawn, used | bit(pawn))) return false;
      prefix.push({ pawn, steps });
      const stop = walkPlans(next, remaining - steps, pawn, used | bit(pawn));
      prefix.pop();
      return stop;
    });
  };

  walkPlans(board.pawns, SEVEN, null, 0);
  return out;
}

/** One end board of a 7: the first plan (in sevenPlans' order) that reaches it, as applyPlan plays it. */
export type SevenOutcome = {
  plan: SevenPlan;
  pawns: Record<PawnId, Pawn>;
  captured: PawnId[];
};

/**
 * The distinct end boards of `card` for `seat`, one outcome each, in the order of their first plan in
 * sevenPlans, with that plan. The search is sevenPlans' own (eachChild, completable, G16 through
 * keepsDuty), with a visited set on the key of completable's memo: a partial state already expanded
 * cannot reach a board not yet seen, so each is expanded once and no first plan is lost.
 * [] for a card that is not a 7 or a 7 that cannot be played.
 */
export function sevenOutcomes(board: Board, seat: Color, card: CardId): SevenOutcome[] {
  if (rankOf(card) !== SEVEN) return [];
  const search = newSearch(board, seat);
  const sameTwice = search.ctx.rules.SEVEN_SAME_PAWN_TWICE;
  const out: SevenOutcome[] = [];
  const ends = new Set<string>();
  const expanded = new Set<string>();
  const prefix: SevenPlan = [];

  const explore = (pawns: Pawns, remaining: number, last: PawnId | null, used: number): void => {
    if (remaining === 0) {
      const end = boardKey(pawns);
      if (ends.has(end)) return;
      ends.add(end);
      const result = applyPlan(board, seat, card, prefix);
      if (!result.ok) throw new Error(`sevenOutcomes: a found plan was refused (${result.reason})`);
      out.push({ plan: result.plan, pawns: result.pawns, captured: result.captured });
      return;
    }
    const state = `${boardKey(pawns)}|${remaining}|${last ?? ""}|${sameTwice ? 0 : used}`;
    if (expanded.has(state)) return;
    expanded.add(state);
    eachChild(search, pawns, remaining, last, used, false, (pawn, steps, next) => {
      if (!completable(search, next, remaining - steps, pawn, used | bit(pawn))) return false;
      prefix.push({ pawn, steps });
      explore(next, remaining - steps, pawn, used | bit(pawn));
      prefix.pop();
      return false;
    });
  };

  explore(board.pawns, SEVEN, null, 0);
  return out;
}

/**
 * While a plan is being built: for each pawn the seat may move, the step counts that can be added after
 * `partialPlan` such that the 7 can still be completed exactly. A pawn with no such count has an empty list.
 * Steps for the pawn of the last entry merge with that entry (they count as one move). A partial plan that
 * is not itself playable, or already complete, offers nothing.
 */
export function nextSteps(
  board: Board,
  seat: Color,
  card: CardId,
  partialPlan: SevenPlan,
): Partial<Record<PawnId, number[]>> {
  const search = newSearch(board, seat);
  const { ctx } = search;
  const offers: Partial<Record<PawnId, number[]>> = {};
  const offered = (pawn: PawnId): number[] => {
    const list = offers[pawn] ?? [];
    offers[pawn] = list;
    return list;
  };
  for (const pawn of ctx.startControlled) offered(pawn);
  if (rankOf(card) !== SEVEN) return offers;

  const partial = partialPlan.length === 0 ? [] : wellFormedPrefix(partialPlan);
  if (partial === null) return offers;
  const remaining = SEVEN - total(partial);
  if (remaining <= 0) return offers;
  if (!ctx.rules.SEVEN_SAME_PAWN_TWICE && repeatsPawn(partial)) return offers;

  // Play the plan so far; the last entry is kept apart because new steps of its pawn merge with it.
  const head = partial.slice(0, -1);
  const tail = partial[partial.length - 1];
  let before: Pawns = board.pawns;
  let used = 0;
  for (const { pawn, steps } of head) {
    const micro = microMove(ctx, before, pawn, steps);
    if (!micro.ok) return offers;
    before = micro.next;
    used |= bit(pawn);
  }
  let now = before;
  if (tail !== undefined) {
    const micro = microMove(ctx, before, tail.pawn, tail.steps);
    if (!micro.ok) return offers;
    now = micro.next;
  }
  const usedNow = tail === undefined ? used : used | bit(tail.pawn);

  for (const pawn of actors(ctx, now).controlled) {
    const list = offered(pawn);
    const merging = tail !== undefined && tail.pawn === pawn;
    if (!merging && !ctx.rules.SEVEN_SAME_PAWN_TWICE && (usedNow & bit(pawn)) !== 0) continue;
    for (let steps = 1; steps <= remaining; steps++) {
      const micro = merging
        ? microMove(ctx, before, pawn, tail.steps + steps)
        : microMove(ctx, now, pawn, steps);
      if (
        micro.ok &&
        completable(search, micro.next, remaining - steps, pawn, usedNow | bit(pawn))
      ) {
        list.push(steps);
      }
    }
  }
  return offers;
}

/** A partial plan as played: well formed entries (sum up to 7), consecutive entries merged, or null. */
function wellFormedPrefix(plan: SevenPlan): SevenPlan | null {
  if (!Array.isArray(plan) || plan.length > SEVEN || !wellFormed(plan)) return null;
  const merged = normalizePlan(plan);
  return total(merged) <= SEVEN ? merged : null;
}
