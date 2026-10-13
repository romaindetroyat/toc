// Candidate moves of one card for one seat (RULES.md R-06 to R-09), built only on walk() and exitWalk().
// controlledPawns() decides whose pawns a seat plays (R-15). The 7 is added by plan 01-13.
// Pure, no I/O, erasable syntax only.

import {
  ALL_PAWNS,
  type Board,
  exitWalk,
  isProtected,
  type WalkOk,
  type WalkOpts,
  walk,
} from "./path.ts";
import { type Color, EXIT, PARTNER, type PawnId, pawnColor, RING, ringIndex } from "./topology.ts";
import type { Action, CardId, Pawn } from "./types.ts";
import { rankOf } from "./types.ts";

function seatPawns(seat: Color): PawnId[] {
  return ([0, 1, 2, 3] as const).map((index): PawnId => `${seat}${index}`);
}

/** True when the four pawns of `seat` are home (R-15). */
export function isFinished(board: Board, seat: Color): boolean {
  return seatPawns(seat).every((id) => board.pawns[id].zone === "home");
}

/**
 * The pawns `seat` plays: its own four, or its partner's once its own four are home (RULE-17).
 * A player never plays the partner's pawns while one of his own is not home.
 */
export function controlledPawns(board: Board, seat: Color): PawnId[] {
  return isFinished(board, seat) ? seatPawns(PARTNER[seat]) : seatPawns(seat);
}

/**
 * Pawns that count as « his own » for captures and the Valet (G7): the partner's pawns when the seat
 * has finished and FINISHED_PARTNER_PAWNS_ARE_OWN, otherwise the seat's own pawns.
 */
export function ownPawns(board: Board, seat: Color): PawnId[] {
  return isFinished(board, seat) && !board.rules.FINISHED_PARTNER_PAWNS_ARE_OWN
    ? seatPawns(seat)
    : controlledPawns(board, seat);
}

export type SwapEnds = { aEnd: Pawn; bEnd: Pawn };

/** Progress of a pawn of `color` that lands on `cell` in a swap, per SWAP_PROGRESS (G1). */
function progressAfterSwap(board: Board, color: Color, was: number, cell: number): number {
  const position = (((cell - EXIT[color]) % RING) + RING) % RING;
  if (board.rules.SWAP_PROGRESS === "position") return position;
  // 'keep': the laps already done stay.
  return RING * Math.max(0, Math.floor(was / RING)) + position;
}

/** The two pawns after the Valet swapped `a` and `b` (both on the ring). */
export function swapEnds(board: Board, a: PawnId, b: PawnId): SwapEnds {
  const pa = board.pawns[a];
  const pb = board.pawns[b];
  if (pa.zone !== "ring" || pb.zone !== "ring")
    throw new Error("swapEnds: both pawns must be on the ring");
  const colorA = pawnColor(a);
  const colorB = pawnColor(b);
  const cellA = ringIndex(colorA, pa.progress);
  const cellB = ringIndex(colorB, pb.progress);
  return {
    aEnd: { zone: "ring", progress: progressAfterSwap(board, colorA, pa.progress, cellB) },
    bEnd: { zone: "ring", progress: progressAfterSwap(board, colorB, pb.progress, cellA) },
  };
}

/** A legal action with the movement it produces (single source for legality, preview and apply). */
export type Candidate = {
  action: Action;
  /** exit / move: the walk result. */
  walk?: WalkOk;
  /** swap: the pawns and where they end. */
  swap?: { a: PawnId; b: PawnId } & SwapEnds;
};

export type MoveOpts = {
  /** Playability only: ignore protected pawns to find out whether they are the reason of an empty list. */
  ignoreProtection?: boolean;
};

/** Deep equality of two actions, whatever the key order. */
export function sameAction(a: Action, b: Action): boolean {
  return canonical(a) === canonical(b);
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${key}:${canonical(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * The candidate actions of `card` for `seat`, in a fixed order: pawn order (colour, index), then target id.
 * - As: leave the stable (lowest-index stable pawn, A-11) or advance 1; Roi: leave or advance 13;
 * - Dame 12, 2, 3, 5, 6, 8, 9, 10: advance; 4: back 4 (ring pawns only);
 * - Valet: swap one of my ring pawns with a ring pawn of another colour that is not mine;
 * - the 7 returns nothing until plan 01-13.
 */
export function movesForCard(
  board: Board,
  seat: Color,
  card: CardId,
  moveOpts: MoveOpts = {},
): Candidate[] {
  const rank = rankOf(card);
  if (rank === 7) return [];

  const controlled = controlledPawns(board, seat);
  const own = ownPawns(board, seat);
  const rules = board.rules;
  const ignoreProtection = moveOpts.ignoreProtection === true;
  const out: Candidate[] = [];

  if (rank === 11) {
    for (const pawn of controlled) {
      const state = board.pawns[pawn];
      if (state.zone !== "ring") continue;
      if (!rules.SWAP_OWN_PROTECTED && !ignoreProtection && isProtected(pawn, state, rules))
        continue;
      for (const target of ALL_PAWNS) {
        const other = board.pawns[target];
        if (other.zone !== "ring" || own.includes(target)) continue;
        if (pawnColor(target) === pawnColor(pawn)) continue;
        if (!ignoreProtection && isProtected(target, other, rules)) continue;
        const ends = swapEnds(board, pawn, target);
        out.push({
          action: { t: "swap", card, pawn, target },
          swap: { a: pawn, b: target, ...ends },
        });
      }
    }
    return out;
  }

  const walkOpts = (mover: PawnId): WalkOpts => ({
    capturePassed: !rules.ORDINARY_CARDS_PASS_OVER_PAWNS,
    ownIds: controlled.includes(mover) ? own : seatPawns(pawnColor(mover)),
    ignoreProtection,
  });
  const steps = rank === 4 ? 4 : rank;
  const dir = rank === 4 ? -1 : 1;
  // G10: only the Jack moves a pawn that is not mine; with ONLY_OWN_PAWNS_MOVE off, the 5 also may.
  const movers =
    rank === 5 && !rules.ONLY_OWN_PAWNS_MOVE
      ? ALL_PAWNS.filter((id) => controlled.includes(id) || board.pawns[id].zone === "ring")
      : controlled;
  let exitOffered = false;

  for (const pawn of movers) {
    const state = board.pawns[pawn];
    if (state.zone === "stable") {
      if ((rank === 1 || rank === 13) && !exitOffered) {
        exitOffered = true; // A-11: stable pawns are interchangeable, offer the lowest index only
        const result = exitWalk(board, pawn, walkOpts(pawn));
        if (result.ok) out.push({ action: { t: "exit", card, pawn }, walk: result });
      }
      continue;
    }
    if (rank === 4 && state.zone !== "ring") continue;
    const result = walk(board, pawn, steps, dir, walkOpts(pawn));
    if (result.ok) out.push({ action: { t: "move", card, pawn }, walk: result });
  }
  return out;
}
