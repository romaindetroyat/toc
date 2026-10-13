// The 7 (RULES.md R-10, R-11, R-15; choices G5 and G12 read from board.rules): one ordered plan of
// (pawn, steps) micro-moves whose steps sum to exactly 7.
// - every micro-move is a forward walk() with { capturePassed: true, ownIds } and is checked when it
//   happens, so the order matters and a captured pawn frees its cell for the rest of the plan;
// - the plan is atomic: the first micro-move that fails rejects the whole plan, the input is untouched;
// - two consecutive entries of the same pawn count as one (RULES.md R-10): plans are merged before
//   they are played, and the plans listed by sevenPlans are in that merged form;
// - nextSteps offers, while a plan is being built, only the step counts after which the 7 can still be
//   completed exactly (existence search memoised on the board, the steps left, the last pawn).
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
import { type Color, PARTNER, type PawnId, pawnColor } from "./topology.ts";
import type { CardId, Pawn, SevenPlan } from "./types.ts";
import { rankOf } from "./types.ts";

/** What a 7 is worth. */
const SEVEN = 7;

type Pawns = Record<PawnId, Pawn>;

/** Why a plan is refused: a failed micro-move (walk reason), or a plan that is not a 7. */
export type PlanFailure = WalkFailure | "bad-plan" | "not-controlled" | "same-pawn-twice";

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
};

function makeCtx(board: Board, seat: Color, opts: SevenOpts): Ctx {
  return {
    seat,
    rules: board.rules,
    startControlled: controlledPawns(board, seat),
    startOwn: ownPawns(board, seat),
    ignoreProtection: opts.ignoreProtection === true,
  };
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
  if (!board.rules.SEVEN_SAME_PAWN_TWICE && repeatsPawn(merged)) {
    return { ok: false, reason: "same-pawn-twice" };
  }

  const ctx = makeCtx(board, seat, {});
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
  return { ok: true, plan: merged, pawns: copyPawns(pawns), events, captured };
}

/** True when `plan` is a whole 7: the steps sum to 7 and every micro-move is legal in turn. */
export function isComplete(board: Board, seat: Color, card: CardId, plan: SevenPlan): boolean {
  return applyPlan(board, seat, card, plan).ok;
}

// ---------------------------------------------------------------------------------------------
// Existence search and enumeration

type Search = { ctx: Ctx; memo: Map<string, boolean> };

const newSearch = (board: Board, seat: Color, opts: SevenOpts = {}): Search => ({
  ctx: makeCtx(board, seat, opts),
  memo: new Map(),
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
  if (remaining === 0) return true;
  const key = `${boardKey(pawns)}|${remaining}|${last ?? ""}|${search.ctx.rules.SEVEN_SAME_PAWN_TWICE ? 0 : used}`;
  const known = search.memo.get(key);
  if (known !== undefined) return known;
  const found = eachChild(search, pawns, remaining, last, used, true, (pawn, steps, next) =>
    completable(search, next, remaining - steps, pawn, used | bit(pawn)),
  );
  search.memo.set(key, found);
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
