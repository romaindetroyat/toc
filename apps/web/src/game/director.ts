import { type HopTimeline, hopTimeline, type Mode, type Point } from "@toc/board";
import {
  type GameEvent,
  type PawnId,
  type Place,
  type PlayerView,
  type RenderState,
  renderInit,
  renderReduce,
} from "@toc/engine";
import { anchorOf, type Facing, facingFor, screenDelta } from "../board/geometry.ts";

/** Lead between "now" and the start of a move, shared by the animation and the audio clock. */
export const LEAD_S = 0.06;

/** The animation pace of the moment: the settings modes, or `test` (debug builds), which skips motion. */
export type DirectorMode = Mode | "test";

/** The part of `document` the Director listens to, so tests can pass a fake. */
export type VisibilitySource = {
  readonly hidden: boolean;
  addEventListener(type: "visibilitychange", listener: () => void): void;
  removeEventListener(type: "visibilitychange", listener: () => void): void;
};

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
    /** Jumps the running animations of `pawn` to their end, so the hop promise settles at once. */
    finish?(pawn: PawnId): void;
  };
  audio: {
    now(): number;
    scheduleClops(offsetsMs: number[], t0: number): void;
    pauseAmbience?(): void;
    resumeAmbience?(): void;
  };
  /** Clockwise quarter turns of the board toward the human (D-05): hop points are screen anchors. */
  quarterTurns: number;
  /** Where the pawn's head points right now, before the event is played. */
  facingOf(pawn: PawnId): Facing;
  /** Called once an event has been played, to move the pawn's static anchor and facing. */
  commit(pawn: PawnId, place: Place, facing: Facing): void;
  /** The pace read for every move: settings (normal, fast, reduced) or `test`. Default: normal. */
  getMode?(): DirectorMode;
  /** The view the render state starts from. Without it the render state stays null until reset(). */
  initial?: PlayerView;
  /** Default: the page's document, when there is one. */
  document?: VisibilitySource;
};

export type Director = {
  enqueue(events: GameEvent[]): void;
  /** Resolves once everything queued so far has been played. */
  idle(): Promise<void>;
  /**
   * Finishes the running animation and folds everything queued at once, without motion or sound.
   * Resolves when the queue is empty.
   */
  snapToEnd(): Promise<void>;
  /** The board, felt and piles as the events so far leave them; null until there is a first view. */
  readonly renderState: RenderState | null;
  /** Called with the new render state after every event. Returns the unsubscribe function. */
  onRender(listener: (state: RenderState) => void): () => void;
  /** Starts again from a view: the queue is dropped and the render state replaced. */
  reset(view: PlayerView): void;
  dispose(): void;
};

type Movement = { pawn: PawnId; from: Place | null; path: Place[] };

/**
 * Plays engine events strictly one at a time and folds each one into the render state (renderReduce),
 * so the render state after idle() is the projection of the view (RESEARCH Pattern 5). One hopTimeline()
 * call per move feeds both the animation and the audio, so hoof cadence cannot drift from the visuals.
 * A hidden tab, snapToEnd() and the `test` mode apply events without motion or sound (Pitfall 11).
 */
export function createDirector(deps: DirectorDeps): Director {
  const queue: GameEvent[] = [];
  const listeners = new Set<(state: RenderState) => void>();
  let render: RenderState | null = deps.initial === undefined ? null : renderInit(deps.initial);
  let draining: Promise<void> | null = null;
  /** The pawn whose animation is running. */
  let current: PawnId | null = null;
  /** Everything left in the queue is applied at once. */
  let snapping = false;
  let generation = 0;

  const doc: VisibilitySource | undefined =
    deps.document ?? (typeof document === "undefined" ? undefined : document);
  let hidden = doc?.hidden ?? false;

  const mode = (): DirectorMode => deps.getMode?.() ?? "normal";
  const instant = (): boolean => hidden || snapping || mode() === "test";

  function fold(event: GameEvent): void {
    if (render === null) return;
    render = renderReduce(render, event);
    for (const listener of [...listeners]) listener(render);
  }

  function movementOf(event: GameEvent): Movement | null {
    if (event.t === "pawnMoved") return { pawn: event.pawn, from: event.from, path: event.path };
    if (event.t === "pawnEnteredHome") {
      return { pawn: event.pawn, from: render?.pawns[event.pawn] ?? null, path: event.path };
    }
    return null;
  }

  async function play(event: GameEvent): Promise<void> {
    const move = movementOf(event);
    const landing = move?.path[move.path.length - 1];
    if (move === null || landing === undefined) {
      fold(event);
      return;
    }

    const pace = mode();
    const generationAtStart = generation;
    // Facing follows the screen delta of each hop; a near-vertical hop keeps the previous one.
    let points: Point[] | null = null;
    let facing = deps.facingOf(move.pawn);
    const facings: Facing[] = [];
    if (move.from !== null) {
      const all = [move.from, ...move.path].map((p) => anchorOf(p, deps.quarterTurns));
      // Reduced motion: a single slide from start to end (UI-SPEC).
      points = pace === "reduced" ? [all[0] as Point, all[all.length - 1] as Point] : all;
      for (let i = 1; i < points.length; i++) {
        const [dx, dy] = screenDelta(points[i - 1] as Point, points[i] as Point);
        facing = facingFor(facing, dx, dy);
        facings.push(facing);
      }
    }

    if (points !== null && !instant() && pace !== "test") {
      const timeline = hopTimeline(points.length - 1, pace);
      deps.audio.scheduleClops(timeline.clops, deps.audio.now() + LEAD_S);
      current = move.pawn;
      try {
        await deps.animator.hop(move.pawn, points, timeline, LEAD_S * 1000, facings);
      } catch (error) {
        console.error(error);
      } finally {
        current = null;
      }
    }

    if (generationAtStart !== generation) return;
    fold(event);
    deps.commit(move.pawn, landing, facing);
  }

  async function drain(): Promise<void> {
    try {
      while (queue.length > 0) {
        const event = queue.shift() as GameEvent;
        try {
          await play(event);
        } catch (error) {
          console.error(error);
        }
      }
    } finally {
      snapping = false;
      draining = null;
    }
  }

  async function idle(): Promise<void> {
    while (draining !== null) await draining;
  }

  function snapToEnd(): Promise<void> {
    if (draining !== null) {
      snapping = true;
      if (current !== null) deps.animator.finish?.(current);
    }
    return idle();
  }

  function onVisibility(): void {
    if (doc === undefined) return;
    if (doc.hidden) {
      hidden = true;
      void snapToEnd();
      deps.audio.pauseAmbience?.();
    } else {
      hidden = false;
      deps.audio.resumeAmbience?.();
    }
  }
  doc?.addEventListener("visibilitychange", onVisibility);

  return {
    enqueue(events) {
      queue.push(...events);
      if (draining === null && queue.length > 0) draining = drain();
    },
    idle,
    snapToEnd,
    get renderState() {
      return render;
    },
    onRender(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    reset(view) {
      generation++;
      queue.length = 0;
      render = renderInit(view);
      for (const listener of [...listeners]) listener(render);
    },
    dispose() {
      generation++;
      queue.length = 0;
      listeners.clear();
      doc?.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
