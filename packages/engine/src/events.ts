import type { PawnId, Place } from "./topology.ts";

/**
 * Engine events are the only input of rendering, animation and audio.
 * Plan 01-03 completes the union; this plan establishes `pawnMoved`.
 */
export type GameEvent = {
  t: "pawnMoved";
  pawn: PawnId;
  from: Place;
  /** Every cell entered, landing cell last. */
  path: Place[];
  dir: 1 | -1;
};
