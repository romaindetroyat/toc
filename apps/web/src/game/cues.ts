// The sound cues of each engine event, with their offsets in milliseconds from the start of the
// play (the Director's t0). Pure, so the Director and its tests share them. The offsets come from
// the same numbers as the animations (hopTimeline, MOTION), D-23: a neigh at the stable exit, a
// snort at the rear-up and a whinny from the eaten knight, joyful neighs at the home, a surprised
// one at the Valet swap. The hoof clops are the 'sabot' cues, one per hop of the timeline.

import { captureBeat, type HopTimeline, MOTION, type Mode, scaleFor } from "@toc/board";
import type { GameEvent } from "@toc/engine";
import type { SoundId } from "../audio/sounds.ts";

export type Cue = { id: SoundId; atMs: number };

export type CueContext = {
  mode: Mode;
  /** The hop timeline of the move the event belongs to (its clops, its landings, its total). */
  timeline?: HopTimeline;
  /** A capture on the cell the attacker ends on, as opposed to one it passes on the way (the 7). */
  isFinalCapture?: boolean;
  /** When the attacker arrives, if that is not the end of the timeline (after a volte-face or an exit). */
  arrivalMs?: number;
};

export function cuesFor(event: GameEvent, context: CueContext): Cue[] {
  const { mode, timeline } = context;
  const scale = scaleFor(mode);
  switch (event.t) {
    case "pawnExited":
      return [{ id: "hennissement-sortie", atMs: 0 }];
    case "pawnMoved": {
      // A backward 4 starts with the volte-face; reduced motion has none.
      const lead = event.dir === -1 && mode !== "reduced" ? MOTION.volteFace * scale : 0;
      return (timeline?.clops ?? []).map((atMs) => ({ id: "sabot", atMs: atMs + lead }));
    }
    case "pawnEnteredHome": {
      const settleAt = timeline?.total ?? 0;
      return [
        ...(timeline?.clops ?? []).map((atMs): Cue => ({ id: "sabot", atMs })),
        { id: event.homeCount === 4 ? "hennissement-fete" : "hennissement-joyeux", atMs: settleAt },
      ];
    }
    case "pawnCaptured": {
      if (context.isFinalCapture === false) {
        // The 7: the knight is eaten at the moment the attacker passes its cell.
        const landings = timeline?.landings ?? [];
        const atMs = landings.length > 0 ? captureBeat(landings.length, event.atStep, mode) : 0;
        return [{ id: "hennissement-plainte", atMs }];
      }
      const arrival = context.arrivalMs ?? timeline?.total ?? 0;
      if (mode === "reduced") return [{ id: "hennissement-plainte", atMs: arrival }];
      return [
        { id: "hennissement-ruade", atMs: arrival },
        { id: "hennissement-plainte", atMs: arrival + (MOTION.rearUp + MOTION.rearDown) * scale },
      ];
    }
    case "pawnsSwapped":
      return [{ id: "hennissement-surpris", atMs: 0 }];
    case "dealt":
      return [{ id: "carte-donne", atMs: 0 }];
    case "cardPlayed":
      return [{ id: "carte-pose", atMs: 0 }];
    case "cardsExchanged":
      return [{ id: "carte-echange", atMs: 0 }];
    default:
      return [];
  }
}
