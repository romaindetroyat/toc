import { type HopTimeline, hopTimeline, type Point } from "@toc/board";
import type { GameEvent, PawnId, Place } from "@toc/engine";

/** Lead between "now" and the start of a move, shared by the animation and the audio clock. */
export const LEAD_S = 0.06;

export type DirectorDeps = {
  animator: {
    hop(pawn: PawnId, points: Point[], timeline: HopTimeline, leadMs: number): Promise<void>;
  };
  audio: {
    now(): number;
    scheduleClops(offsetsMs: number[], t0: number): void;
  };
  placeOf(place: Place): Point;
  /** Called once an event has been played, to move the pawn's static anchor to its new place. */
  commit(pawn: PawnId, place: Place): void;
};

export type Director = {
  enqueue(events: GameEvent[]): void;
  idle(): Promise<void>;
};

/**
 * Plays engine events strictly one at a time. One hopTimeline() call per move feeds both the
 * animation and the audio, so hoof cadence cannot drift from the visuals.
 */
export function createDirector(deps: DirectorDeps): Director {
  let tail: Promise<void> = Promise.resolve();

  async function play(event: GameEvent): Promise<void> {
    if (event.t === "pawnMoved") {
      const landing = event.path[event.path.length - 1];
      if (!landing) return;
      const points = [deps.placeOf(event.from), ...event.path.map((p) => deps.placeOf(p))];
      const timeline = hopTimeline(event.path.length, "normal");
      const t0 = deps.audio.now() + LEAD_S;
      deps.audio.scheduleClops(timeline.clops, t0);
      await deps.animator.hop(event.pawn, points, timeline, LEAD_S * 1000);
      deps.commit(event.pawn, landing);
    }
  }

  return {
    enqueue(events) {
      for (const event of events) {
        tail = tail.then(() => play(event)).catch((error) => console.error(error));
      }
    },
    async idle() {
      let seen: Promise<void>;
      do {
        seen = tail;
        await seen;
      } while (seen !== tail);
    },
  };
}
