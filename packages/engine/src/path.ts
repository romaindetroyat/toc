// The single movement path (RESEARCH Pattern 1): walk() is used by legality, previews, captures,
// the 7 (plan 01-13, seven.ts) and animation. No second movement code path exists for the 4, the Valet or the 7.
// Rules read: RULES.md R-02, R-08, R-10, R-12, R-13 and the choices G2, G3, G4, G14, G15 through
// `board.rules` (G15: a capture in passing eats only opponents, the mover's team is passed).
// Pure, no I/O, erasable syntax only.

import type { RuleSet } from "./rules.ts";
import {
  COLORS,
  type Color,
  ENTRY,
  EXIT,
  type PawnId,
  type Place,
  pawnColor,
  pawnIndex,
  RING,
  ringIndex,
  teamOf,
} from "./topology.ts";
import type { Pawn } from "./types.ts";

/** What movement needs to know: where the pawns are and which rules are in force (GameState and PlayerView both fit). */
export type Board = { readonly pawns: Record<PawnId, Pawn>; readonly rules: RuleSet };

/** The 16 pawn ids in a fixed order: colours in turn order, then pawn index. */
export const ALL_PAWNS: readonly PawnId[] = COLORS.flatMap((color) =>
  ([0, 1, 2, 3] as const).map((index): PawnId => `${color}${index}`),
);

/**
 * Progress of the entry square on the first lap (D-01). Used only when ENTRY_WITHOUT_FULL_LAP is off
 * (the rule of 2026-10-13, D-04): then the pawn must have done the whole lap to enter.
 */
const ENTRY_PROGRESS = RING - 2;
/** Pawns in a home. */
const HOME_SLOTS = 4;

export type WalkFailure =
  | "blocked-protected"
  | "own-pawn"
  | "home-overflow"
  | "home-blocked"
  | "no-entry";

export type Capture = { victim: PawnId; atStep: number };

export type WalkOk = { ok: true; path: Place[]; end: Pawn; captures: Capture[] };
export type WalkResult = WalkOk | { ok: false; reason: WalkFailure };

export type WalkOpts = {
  /**
   * The 7 eats the opponent pawns on crossed cells and passes the knights of the mover's team, own and
   * partner's (G15; every non-own pawn when SEVEN_EATS_PASSED_PARTNER); ordinary cards pass over (G11).
   */
  capturePassed: boolean;
  /** Pawns the mover may neither stop on nor eat: the pawns of the player who moves. */
  ownIds: readonly PawnId[];
  /** Playability only: pretend no pawn is protected, to tell « blocked by a protected pawn » from the rest. */
  ignoreProtection?: boolean;
};

/** Where the pawn `id` stands, as a board place (its stable slot, its ring cell or its home slot). */
export function placeOf(id: PawnId, pawn: Pawn): Place {
  const color = pawnColor(id);
  if (pawn.zone === "stable") return stablePlace(id);
  if (pawn.zone === "home") return { z: "home", color, slot: pawn.slot };
  return { z: "ring", cell: ringIndex(color, pawn.progress) };
}

/** The stable slot of the pawn `id`. */
export function stablePlace(id: PawnId): Place {
  return { z: "stable", color: pawnColor(id), slot: pawnIndex(id) };
}

/** Ring pawns by cell, in ALL_PAWNS order: one scan of the 16 pawns per walk instead of one per cell. */
type Occupancy = (PawnId[] | undefined)[];

function ringOccupancy(board: Board): Occupancy {
  const occ: Occupancy = new Array(RING);
  for (const id of ALL_PAWNS) {
    const pawn = board.pawns[id];
    if (pawn.zone !== "ring") continue;
    const cell = ringIndex(pawnColor(id), pawn.progress);
    const here = occ[cell];
    if (here === undefined) occ[cell] = [id];
    else here.push(id);
  }
  return occ;
}

const ringPlace = (cell: number): Place => ({ z: "ring", cell });

function homePlace(color: Color, slot: number): Place {
  return { z: "home", color, slot: slot as 0 | 1 | 2 | 3 };
}

/**
 * A pawn on the diamond of its own colour is protected (R-12): the ring cell is its colour's EXIT, at
 * progress 0 or, after an extra lap, only when PROTECTED_AFTER_EXTRA_LAP (G3).
 */
export function isProtected(id: PawnId, pawn: Pawn, rules: RuleSet): boolean {
  if (pawn.zone !== "ring") return false;
  const color = pawnColor(id);
  if (ringIndex(color, pawn.progress) !== EXIT[color]) return false;
  return pawn.progress === 0 || rules.PROTECTED_AFTER_EXTRA_LAP;
}

/** The ring pawns standing on `cell`, except `except`. */
function occupantsAt(board: Board, cell: number, except: PawnId): PawnId[] {
  return ALL_PAWNS.filter((id) => {
    if (id === except) return false;
    const pawn = board.pawns[id];
    return pawn.zone === "ring" && ringIndex(pawnColor(id), pawn.progress) === cell;
  });
}

/** The protected pawn among `here` that stops `moving`, or null (own colour included under G4). */
function protectorOf(board: Board, here: readonly PawnId[], moving: PawnId): PawnId | null {
  for (const id of here) {
    if (id === moving) continue;
    if (!isProtected(id, board.pawns[id], board.rules)) continue;
    if (pawnColor(id) === pawnColor(moving) && !board.rules.PROTECTED_BLOCKS_OWNER) continue;
    return id;
  }
  return null;
}

/**
 * The protected pawn that stops `moving` on `cell`, or null. A protected pawn blocks every other pawn,
 * its own colour included when PROTECTED_BLOCKS_OWNER (G4).
 */
export function blocksPath(cell: number, moving: PawnId, board: Board): PawnId | null {
  return protectorOf(board, occupantsAt(board, cell, moving), moving);
}

type Stretch =
  | { ok: true; path: Place[]; captures: Capture[] }
  | { ok: false; reason: WalkFailure };

/**
 * Walks `count` ring cells from `from` in direction `dir`, checking protection and applying the landing
 * rule on the last cell when `lands` (own pawn: illegal; any other pawn: captured). With
 * `opts.capturePassed`, a passed pawn is eaten only when it is not own and, under G15, belongs to the
 * other team (the mover's colour is that of the knight moved: a finished player moving his partner's
 * knights spares the whole team).
 */
function ringStretch(
  board: Board,
  id: PawnId,
  from: number,
  count: number,
  dir: 1 | -1,
  lands: boolean,
  opts: WalkOpts,
  occ: Occupancy,
): Stretch {
  const color = pawnColor(id);
  const team = teamOf(color);
  const path: Place[] = [];
  const captures: Capture[] = [];
  for (let i = 1; i <= count; i++) {
    const cell = ringIndex(color, from + dir * i);
    const here = occ[cell];
    if (here !== undefined) {
      if (!opts.ignoreProtection && protectorOf(board, here, id) !== null) {
        return { ok: false, reason: "blocked-protected" };
      }
      const landing = lands && i === count;
      for (const other of here) {
        if (other === id) continue;
        const own = opts.ownIds.includes(other);
        if (landing) {
          if (own) return { ok: false, reason: "own-pawn" };
          captures.push({ victim: other, atStep: i - 1 });
        } else if (
          opts.capturePassed &&
          !own &&
          (board.rules.SEVEN_EATS_PASSED_PARTNER || teamOf(pawnColor(other)) !== team)
        ) {
          captures.push({ victim: other, atStep: i - 1 });
        }
      }
    }
    path.push(ringPlace(cell));
  }
  return { ok: true, path, captures };
}

/** Slots of `color`'s home that hold a pawn. */
function homeOccupied(board: Board, color: Color): boolean[] {
  const slots = [false, false, false, false];
  for (const id of ALL_PAWNS) {
    const pawn = board.pawns[id];
    if (pawnColor(id) === color && pawn.zone === "home") slots[pawn.slot] = true;
  }
  return slots;
}

/**
 * True when a pawn of `color` at progress `q` stands on its own carré 16 (the entry square, cell
 * EXIT - 2, so q = 70 mod 72, negative q included) and may enter from there: always under G14
 * (ENTRY_WITHOUT_FULL_LAP), otherwise only after the full lap (q >= 70).
 */
function entryOpensAt(color: Color, q: number, rules: RuleSet): boolean {
  if (ringIndex(color, q) !== ENTRY[color]) return false;
  return rules.ENTRY_WITHOUT_FULL_LAP || q >= ENTRY_PROGRESS;
}

/**
 * Moves `pawnId` by `steps` (forward with dir 1, backward with dir -1: only the 4 goes backward).
 * Home entry (D-01 to D-03, G14): whenever the pawn reaches or crosses its carré 16 moving forward,
 * full lap done or not, it enters only if the count ends exactly on an empty home slot, and then it
 * must; otherwise it goes on round the ring. A home pawn advances by the exact count without jumping.
 * Backward moves stay on the ring and never enter the home (D-04).
 */
export function walk(
  board: Board,
  pawnId: PawnId,
  steps: number,
  dir: 1 | -1,
  opts: WalkOpts,
): WalkResult {
  const pawn = board.pawns[pawnId];
  const color = pawnColor(pawnId);

  if (pawn.zone === "stable") return { ok: false, reason: "no-entry" };

  if (pawn.zone === "home") {
    if (dir !== 1) return { ok: false, reason: "no-entry" };
    if (pawn.slot + steps > HOME_SLOTS - 1) return { ok: false, reason: "home-overflow" };
    const occupied = homeOccupied(board, color);
    const path: Place[] = [];
    for (let slot = pawn.slot + 1; slot <= pawn.slot + steps; slot++) {
      if (occupied[slot]) return { ok: false, reason: "home-blocked" };
      path.push(homePlace(color, slot));
    }
    return {
      ok: true,
      path,
      end: { zone: "home", slot: (pawn.slot + steps) as 0 | 1 | 2 | 3 },
      captures: [],
    };
  }

  const from = pawn.progress;
  const occ = ringOccupancy(board);
  if (dir === 1) {
    // The carré 16 is crossed (or stood on) at progress q = from + k, moving forward (G14: lap done or
    // not); `r` steps lie beyond it.
    for (let k = 0; k < steps; k++) {
      const q = from + k;
      if (!entryOpensAt(color, q, board.rules)) continue;
      const r = steps - k;
      if (r < 1 || r > HOME_SLOTS) break;
      const occupied = homeOccupied(board, color);
      if (occupied[r - 1]) break; // occupied target: the pawn goes round again (D-01)
      if (occupied.slice(0, r - 1).some(Boolean)) {
        if (board.rules.HOME_JUMP_BLOCKED === "illegal")
          return { ok: false, reason: "home-blocked" };
        break; // G2 continue: the pawn does not jump the home pawn and goes round again
      }
      const stretch = ringStretch(board, pawnId, from, k, 1, false, opts, occ);
      if (!stretch.ok) return stretch;
      const path = [...stretch.path];
      for (let slot = 0; slot < r; slot++) path.push(homePlace(color, slot));
      return {
        ok: true,
        path,
        end: { zone: "home", slot: (r - 1) as 0 | 1 | 2 | 3 },
        captures: stretch.captures,
      };
    }
  }

  const stretch = ringStretch(board, pawnId, from, steps, dir, true, opts, occ);
  if (!stretch.ok) return stretch;
  return {
    ok: true,
    path: stretch.path,
    end: { zone: "ring", progress: from + dir * steps },
    captures: stretch.captures,
  };
}

/**
 * A stable pawn leaves onto its colour's exit square (As, Roi). Illegal when one of the mover's pawns
 * stands there (R-06, R-12 and Q15); a pawn of another colour there is eaten, because only the pawn of
 * the colour of the diamond is protected there.
 */
export function exitWalk(board: Board, pawnId: PawnId, opts: WalkOpts): WalkResult {
  if (board.pawns[pawnId].zone !== "stable") return { ok: false, reason: "no-entry" };
  const color = pawnColor(pawnId);
  const cell = EXIT[color];
  const captures: Capture[] = [];
  for (const other of occupantsAt(board, cell, pawnId)) {
    if (opts.ownIds.includes(other) || pawnColor(other) === color) {
      return { ok: false, reason: "own-pawn" };
    }
    if (!opts.ignoreProtection && isProtected(other, board.pawns[other], board.rules)) {
      return { ok: false, reason: "blocked-protected" };
    }
    captures.push({ victim: other, atStep: 0 });
  }
  return { ok: true, path: [ringPlace(cell)], end: { zone: "ring", progress: 0 }, captures };
}
