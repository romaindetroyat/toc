// The per-seat tally of a game (plan 05-01, HIST-03 support; 05-RESEARCH Pattern 1): the knights each
// seat ate and lost, folded from the engine's events. The online table folds every accepted batch
// (packages/table commitPlay) and the solo game will fold its own (plan 05-07), so both count alike.
//
// A capture is credited to the seat that played the card: the seat of the last `cardPlayed` of the
// batch, because a finished player moves the partner's knights (G7) and the knight's own colour would
// credit the wrong seat. Without a card in the batch, the capturing knight's colour. The eaten knight's
// colour loses one. The knights home are read from the final pawns, not from here. Pure.

import type { GameEvent } from "./events.ts";
import { COLORS, type Color, pawnColor } from "./topology.ts";

export type SeatTally = { captured: number; lost: number };
export type Tally = Record<Color, SeatTally>;

export function emptyTally(): Tally {
  return {
    bleu: { captured: 0, lost: 0 },
    jaune: { captured: 0, lost: 0 },
    rouge: { captured: 0, lost: 0 },
    vert: { captured: 0, lost: 0 },
  };
}

/** `tally` plus the captures of `events`; the input is never changed. */
export function foldTally(tally: Tally, events: readonly GameEvent[]): Tally {
  const next = emptyTally();
  for (const color of COLORS) {
    next[color].captured = tally[color]?.captured ?? 0;
    next[color].lost = tally[color]?.lost ?? 0;
  }
  let actor: Color | null = null;
  for (const event of events) {
    if (event.t === "cardPlayed") actor = event.seat;
    else if (event.t === "pawnCaptured") {
      next[pawnColor(event.victim)].lost += 1;
      next[actor ?? pawnColor(event.by)].captured += 1;
    }
  }
  return next;
}
