import { type HopTimeline, hopTimeline, type Point } from "@toc/board";
import type { GameEvent, PawnId, Place } from "@toc/engine";
import { anchorOf, type Facing, facingFor, screenDelta } from "../board/geometry.ts";

/** Lead between "now" and the start of a move, shared by the animation and the audio clock. */
export const LEAD_S = 0.06;

export type DirectorDeps = {
  animator: {
    hop(
      pawn: PawnId,
      points: Point[],
      timeline: HopTimeline,
      leadMs: number,
      /** Facing during each hop, one per hop (D-10). */
      facings: Facing[],
    ): Promise<void>;
  };
  audio: {
    now(): number;
    scheduleClops(offsetsMs: number[], t0: number): void;
  };
  /** Clockwise quarter turns of the board toward the human (D-05): hop points are screen anchors. */
  quarterTurns: number;
  /** Where the pawn's head points right now, before the event is played. */
  facingOf(pawn: PawnId): Facing;
  /** Called once an event has been played, to move the pawn's static anchor and facing. */
  commit(pawn: PawnId, place: Place, facing: Facing): void;
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
      const points = [event.from, ...event.path].map((p) => anchorOf(p, deps.quarterTurns));
      // Facing follows the screen delta of each hop; a near-vertical hop keeps the previous one.
      const facings: Facing[] = [];
      let facing = deps.facingOf(event.pawn);
      for (let i = 1; i < points.length; i++) {
        const [dx, dy] = screenDelta(points[i - 1] as Point, points[i] as Point);
        facing = facingFor(facing, dx, dy);
        facings.push(facing);
      }
      const timeline = hopTimeline(event.path.length, "normal");
      const t0 = deps.audio.now() + LEAD_S;
      deps.audio.scheduleClops(timeline.clops, t0);
      await deps.animator.hop(event.pawn, points, timeline, LEAD_S * 1000, facings);
      deps.commit(event.pawn, landing, facing);
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
