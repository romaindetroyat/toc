// apply: one action of one seat on the full state, and resolveMove: the movement of one action on the
// public board only (previews in the UI). Both use the same code path, movesForCard/walk (RESEARCH
// Pattern 6). apply accepts only actions that legalActions lists (T-01-09) and never mutates its input.
// Pure, no I/O, erasable syntax only.

import type { GameEvent } from "./events.ts";
import { legalActions } from "./legal.ts";
import { movesForCard, sameAction } from "./moves.ts";
import type { Board } from "./path.ts";
import { endDeal, giveCard, isDealOver } from "./state.ts";
import {
  COLORS,
  type Color,
  nextColor,
  PARTNER,
  type PawnId,
  type Place,
  pawnColor,
  pawnIndex,
  ringIndex,
  type Team,
  teamOf,
} from "./topology.ts";
import type { Action, CardId, GameState, Pawn } from "./types.ts";
import { rankOf } from "./types.ts";

/** An action that is not allowed: wrong turn, card not held, not in legalActions, or the game is over. */
export class IllegalActionError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "IllegalActionError";
    this.code = code;
  }
}

/** The pawns after one movement and the movement events it produces (no cardPlayed, no turn). */
export type MoveResolution = {
  pawns: Record<PawnId, Pawn>;
  events: GameEvent[];
  captured: PawnId[];
};

function copyPawns(pawns: Record<PawnId, Pawn>): Record<PawnId, Pawn> {
  const copy = {} as Record<PawnId, Pawn>;
  for (const id of Object.keys(pawns) as PawnId[]) copy[id] = { ...pawns[id] };
  return copy;
}

function stablePlace(id: PawnId): Place {
  return { z: "stable", color: pawnColor(id), slot: pawnIndex(id) };
}

/** Where `pawn` stands, as a board place. */
function placeOf(id: PawnId, pawn: Pawn): Place {
  const color = pawnColor(id);
  if (pawn.zone === "stable") return stablePlace(id);
  if (pawn.zone === "home") return { z: "home", color, slot: pawn.slot };
  return { z: "ring", cell: ringIndex(color, pawn.progress) };
}

function homeCount(pawns: Record<PawnId, Pawn>, color: Color): number {
  return ([0, 1, 2, 3] as const).filter((i) => pawns[`${color}${i}`]?.zone === "home").length;
}

/**
 * Applies the movement of an exit / move / swap action to the public board. The action must be one of
 * the candidates of its card (the same list legalActions is made of), otherwise IllegalActionError.
 * Works on a PlayerView, so the UI previews exactly what apply will do.
 */
export function resolveMove(board: Board, seat: Color, action: Action): MoveResolution {
  if (action.t !== "exit" && action.t !== "move" && action.t !== "swap") {
    throw new IllegalActionError("not-a-movement", `resolveMove: ${action.t} is not a movement`);
  }
  const candidate = movesForCard(board, seat, action.card).find((c) =>
    sameAction(c.action, action),
  );
  if (candidate === undefined) {
    throw new IllegalActionError("illegal-action", `${seat} cannot play ${JSON.stringify(action)}`);
  }

  const pawns = copyPawns(board.pawns);
  const events: GameEvent[] = [];
  const captured: PawnId[] = [];

  if (candidate.swap !== undefined) {
    const { a, b, aEnd, bEnd } = candidate.swap;
    const aTo = placeOf(b, board.pawns[b]);
    const bTo = placeOf(a, board.pawns[a]);
    pawns[a] = aEnd;
    pawns[b] = bEnd;
    events.push({ t: "pawnsSwapped", a, b, aTo, bTo });
    return { pawns, events, captured };
  }

  const walked = candidate.walk;
  if (walked === undefined || (action.t !== "exit" && action.t !== "move")) {
    throw new IllegalActionError("illegal-action", "resolveMove: no walk for this action");
  }
  const id = action.pawn;
  const before = board.pawns[id];
  const from = placeOf(id, before);
  pawns[id] = walked.end;

  if (action.t === "exit") {
    events.push({ t: "pawnExited", pawn: id, to: walked.path[0] as Place });
  } else if (walked.end.zone === "home" && before.zone === "ring") {
    events.push({
      t: "pawnEnteredHome",
      pawn: id,
      path: walked.path,
      slot: walked.end.slot,
      homeCount: homeCount(pawns, pawnColor(id)),
    });
  } else {
    events.push({
      t: "pawnMoved",
      pawn: id,
      from,
      path: walked.path,
      dir: rankOf(action.card) === 4 ? -1 : 1,
    });
  }

  for (const { victim, atStep } of walked.captures) {
    events.push({
      t: "pawnCaptured",
      by: id,
      victim,
      at: placeOf(victim, board.pawns[victim]),
      atStep,
    });
    events.push({ t: "pawnSentHome", pawn: victim, to: stablePlace(victim) });
    pawns[victim] = { zone: "stable" };
    captured.push(victim);
  }
  return { pawns, events, captured };
}

/** The first seat after `seat` (clockwise, `seat` last) whose hand still holds cards, or null (G13). */
function nextHolder(hands: Record<Color, CardId[]>, seat: Color): Color | null {
  let candidate = seat;
  for (let i = 0; i < COLORS.length; i++) {
    candidate = nextColor(candidate);
    if (hands[candidate].length > 0) return candidate;
  }
  return null;
}

/** The team whose eight pawns are all home, if any (RULE-18). */
function winningTeam(pawns: Record<PawnId, Pawn>): Team | null {
  for (const team of ["bleu-rouge", "jaune-vert"] as const) {
    const colors = COLORS.filter((c) => teamOf(c) === team);
    if (colors.every((c) => homeCount(pawns, c) === 4)) return team;
  }
  return null;
}

function reject(state: GameState, seat: Color, action: Action): never {
  if (state.phase === "won") throw new IllegalActionError("game-over", "the game is over");
  if (state.phase === "play" && state.turn !== seat && action.t !== "give") {
    throw new IllegalActionError("not-your-turn", `it is ${state.turn}'s turn, not ${seat}'s`);
  }
  if ("card" in action && !state.hands[seat].includes(action.card)) {
    throw new IllegalActionError("card-not-in-hand", `${seat} does not hold ${action.card}`);
  }
  throw new IllegalActionError("illegal-action", `${seat} cannot play ${JSON.stringify(action)}`);
}

/**
 * Plays one action. Returns a new state and the events (the input is never mutated). Throws
 * IllegalActionError for anything legalActions(state, seat) does not list.
 */
export function apply(
  state: GameState,
  seat: Color,
  action: Action,
): { state: GameState; events: GameEvent[] } {
  if (!legalActions(state, seat).some((legal) => sameAction(legal, action))) {
    return reject(state, seat, action);
  }

  if (action.t === "give") return giveCard(state, seat, action.card);

  const hands = { ...state.hands };
  const events: GameEvent[] = [];
  let next: GameState;

  if (action.t === "discard") {
    const cards = state.hands[seat].slice();
    hands[seat] = [];
    events.push({ t: "handDiscarded", seat, cards });
    next = { ...state, hands, posed: { ...state.posed, [seat]: cards } };
  } else if (action.t === "seven") {
    // Plan 01-13 adds the 7; legalActions never lists it before.
    return reject(state, seat, action);
  } else {
    const resolved = resolveMove(state, seat, action);
    hands[seat] = state.hands[seat].filter((card) => card !== action.card);
    events.push({ t: "cardPlayed", seat, card: action.card }, ...resolved.events);

    const winner = winningTeam(resolved.pawns);
    const captures = { ...state.captures };
    captures[teamOf(seat)] += resolved.captured.length;
    next = {
      ...state,
      pawns: resolved.pawns,
      hands,
      discard: [...state.discard, action.card],
      lastPlayed: { ...state.lastPlayed, [seat]: action.card },
      captures,
    };

    if (winner !== null) {
      // The victory is checked after every move and comes before the end of the turn (R-16).
      events.push({ t: "gameWon", team: winner });
      return { state: { ...next, phase: "won", winner }, events };
    }
    for (const event of resolved.events) {
      if (event.t === "pawnEnteredHome" && event.homeCount === 4) {
        const finished = pawnColor(event.pawn);
        events.push({ t: "playerFinished", seat: finished, partner: PARTNER[finished] });
      }
    }
  }

  const holder = nextHolder(next.hands, seat);
  if (holder !== null) {
    events.push({ t: "turn", seat: holder });
    return { state: { ...next, turn: holder }, events };
  }

  // Every hand is empty: the deal is over (R-03, R-14). The turn passes, then the next deal opens.
  events.push({ t: "turn", seat: nextColor(seat) });
  const ended = isDealOver(next) ? endDeal(next) : { state: next, events: [] };
  return { state: ended.state, events: [...events, ...ended.events] };
}
