import {
  captureBeat,
  type HopTimeline,
  hopTimeline,
  MOTION,
  type Mode,
  type Point,
  rearDuration,
  scaleFor,
  volteFaceDuration,
} from "@toc/board";
import {
  type CardId,
  COLORS,
  type Color,
  type GameEvent,
  type PawnId,
  type Place,
  type PlayerView,
  type RenderState,
  renderInit,
  renderReduce,
  teamOf,
} from "@toc/engine";
import type { SoundId } from "../audio/sounds.ts";
import { anchorOf, type Facing, facingFor, screenDelta } from "../board/geometry.ts";
import { type Cue, cuesFor } from "./cues.ts";

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

/** A knight that crosses to the place of another one (the Valet). */
export type SwapLeg = { pawn: PawnId; from: Point; to: Point; facing: Facing };

/**
 * What draws the knights. Every motion takes `leadMs`, the delay before it starts: the same lead the
 * audio is scheduled with, so picture and sound begin together (Pitfall 8). Only `hop` is required;
 * a motion the animator does not have is skipped (the event is still applied).
 */
export type PawnAnimator = {
  /** Called once per step with every knight about to move, before any animation starts. */
  begin?(pawns: PawnId[]): void;
  hop(
    pawn: PawnId,
    points: Point[],
    timeline: HopTimeline,
    leadMs: number,
    /** Facing during each hop, one per hop (D-10). */
    facings: Facing[],
    mode?: Mode,
  ): Promise<void>;
  /** Jumps the running animations of `pawn` to their end, so the promises settle at once. */
  finish?(pawn: PawnId): void;
  /** Leaving the stable: one arc bound (D-15). */
  exit?(
    pawn: PawnId,
    from: Point,
    to: Point,
    leadMs: number,
    facing: Facing,
    mode: Mode,
  ): Promise<void>;
  /** The head turns before a backward 4 (D-10). */
  turn?(pawn: PawnId, from: Facing, to: Facing, leadMs: number, mode: Mode): Promise<void>;
  /** The attacker rears after eating a knight (D-12). */
  rear?(pawn: PawnId, leadMs: number, mode: Mode): Promise<void>;
  /** The eaten knight flies back to its stable (D-12). */
  eject?(
    pawn: PawnId,
    from: Point,
    to: Point,
    leadMs: number,
    facing: Facing,
    mode: Mode,
  ): Promise<void>;
  /** The Valet: two arcs that cross (D-13). */
  swap?(a: SwapLeg, b: SwapLeg, leadMs: number, mode: Mode): Promise<void>;
  /** Entering the home: the short settle (D-14). */
  settle?(pawn: PawnId, leadMs: number, mode: Mode): Promise<void>;
  /** The fourth knight home: a rear and a burst of particles at `at` (D-14). */
  party?(pawn: PawnId, at: Point, leadMs: number, mode: Mode): Promise<void>;
  /** The winning team's knights hop in place once. */
  winHop?(pawns: PawnId[], leadMs: number, mode: Mode): Promise<void>;
};

/**
 * What draws the cards: the deal, a played card, the exchange and a dead hand laid on the felt. Like the
 * knights' motions each takes `leadMs` (the delay shared with the audio clock) and the pace of the moment;
 * a motion the animator does not have is skipped and the event is still applied.
 */
export type CardAnimator = {
  /** The deal: `seats` in dealing order with the number of cards each gets; the player's flip face up after. */
  deal?(seats: { seat: Color; count: number }[], leadMs: number, mode: Mode): Promise<void>;
  /** A card played flies to the felt slot of its seat. */
  playCard?(seat: Color, card: CardId, leadMs: number, mode: Mode): Promise<void>;
  /** The four cards of the exchange cross the felt, each seat to its partner. */
  exchange?(leadMs: number, mode: Mode): Promise<void>;
  /** A dead hand is laid face up in front of its seat, card by card. */
  lay?(seat: Color, cards: CardId[], leadMs: number, mode: Mode): Promise<void>;
  /** Jumps the cards in flight to their end, so the promises settle at once. */
  finishCards?(): void;
};

export type DirectorDeps = {
  animator: PawnAnimator & CardAnimator;
  audio: {
    now(): number;
    scheduleClops(offsetsMs: number[], t0: number): void;
    /** The neighs and the card sounds, on the audio clock like the clops. */
    cue?(id: SoundId, at?: number): void;
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
  /**
   * The first deal of a game: the render state goes back to before it (all the cards in the talon, no
   * hand) and the deal events are played, so the cards fly from the talon to the seats.
   */
  openDeal(events: GameEvent[]): void;
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

type MovementEvent = Extract<GameEvent, { t: "pawnExited" | "pawnMoved" | "pawnEnteredHome" }>;

/** A knight eaten by the move: where it stood, where it goes, and the events that say so. */
type Capture = {
  victim: PawnId;
  atStep: number;
  at: Place;
  to: Place | null;
  captured: Extract<GameEvent, { t: "pawnCaptured" }>;
  events: GameEvent[];
};

/** The single bound of a stable exit as a hop timeline (no clop but the landing). */
function exitTimeline(total: number): HopTimeline {
  return { total, hop: total, landings: [total], clops: [total] };
}

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
  /** The pawns whose animations are running. */
  const current = new Set<PawnId>();
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

  const isMovement = (event: GameEvent): event is MovementEvent =>
    event.t === "pawnExited" || event.t === "pawnMoved" || event.t === "pawnEnteredHome";

  /** The captures that follow a movement in the queue (the engine emits them right after it). */
  function takeCaptures(by: PawnId): Capture[] {
    const taken: Capture[] = [];
    for (;;) {
      const next = queue[0];
      if (next === undefined || next.t !== "pawnCaptured" || next.by !== by) return taken;
      queue.shift();
      const events: GameEvent[] = [next];
      let to: Place | null = null;
      const after = queue[0];
      if (after !== undefined && after.t === "pawnSentHome" && after.pawn === next.victim) {
        queue.shift();
        events.push(after);
        to = after.to;
      }
      taken.push({
        victim: next.victim,
        atStep: next.atStep,
        at: next.at,
        to,
        captured: next,
        events,
      });
    }
  }

  /** Sounds go on the audio clock at t0 + offset; the clops through scheduleClops, once per move. */
  function sound(cues: Cue[], t0: number): void {
    const clops = cues.filter((cue) => cue.id === "sabot").map((cue) => cue.atMs);
    if (clops.length > 0) deps.audio.scheduleClops(clops, t0);
    for (const cue of cues) {
      if (cue.id !== "sabot") deps.audio.cue?.(cue.id, t0 + cue.atMs / 1000);
    }
  }

  async function settled(running: (Promise<void> | undefined)[]): Promise<void> {
    for (const result of await Promise.allSettled(running)) {
      if (result.status === "rejected") console.error(result.reason);
    }
  }

  /** The anchor on the screen of a place, for the pawn that stands there now. */
  const anchor = (place: Place): Point => anchorOf(place, deps.quarterTurns);

  /**
   * A knight leaves the stable, walks, or enters its home, with the knights it eats. One t0 serves the
   * whole step: the hops, the rear and the ejections are started together, each with its own delay, and
   * the sounds are scheduled on the audio clock from the same offsets, so nothing can drift.
   */
  async function playMovement(event: MovementEvent): Promise<void> {
    const captures = takeCaptures(event.pawn);
    const path = event.t === "pawnExited" ? [event.to] : event.path;
    const landing = path[path.length - 1];
    const folds: GameEvent[] = [event, ...captures.flatMap((capture) => capture.events)];
    if (landing === undefined) {
      for (const each of folds) fold(each);
      return;
    }
    const from = event.t === "pawnMoved" ? event.from : (render?.pawns[event.pawn] ?? null);

    const pace = mode();
    const m: Mode = pace === "test" ? "normal" : pace;
    const reduced = m === "reduced";
    const scale = scaleFor(m);
    const generationAtStart = generation;

    // Facing follows the screen delta of each hop; a near-vertical hop keeps the previous one.
    const facingBefore = deps.facingOf(event.pawn);
    let facing = facingBefore;
    let points: Point[] | null = null;
    const facings: Facing[] = [];
    if (from !== null) {
      const all = [from, ...path].map(anchor);
      // Reduced motion: a single slide from start to end (UI-SPEC).
      points = reduced ? [all[0] as Point, all[all.length - 1] as Point] : all;
      for (let i = 1; i < points.length; i++) {
        const [dx, dy] = screenDelta(points[i - 1] as Point, points[i] as Point);
        facing = facingFor(facing, dx, dy);
        facings.push(facing);
      }
    }

    // What each eaten knight does: where it flies and which way its head points on the way.
    const ejections = captures.map((capture) => {
      const start = anchor(capture.at);
      const end = capture.to === null ? start : anchor(capture.to);
      const [dx, dy] = screenDelta(start, end);
      return { capture, start, end, facing: facingFor(deps.facingOf(capture.victim), dx, dy) };
    });

    const walks = event.t !== "pawnExited";
    const canAnimate = points !== null && (walks || deps.animator.exit !== undefined) && !instant();
    if (canAnimate && points !== null) {
      const timeline: HopTimeline = walks
        ? hopTimeline(points.length - 1, m)
        : exitTimeline(reduced ? 180 : MOTION.exit * scale);
      const volte = event.t === "pawnMoved" && event.dir === -1 ? volteFaceDuration(m) : 0;
      const moveEnd = volte + timeline.total;
      const lead = LEAD_S * 1000;
      const t0 = deps.audio.now() + LEAD_S;

      // Sounds first: they are scheduled on the audio clock, the animations start at the same t0.
      const cues = cuesFor(event, { mode: m, timeline });
      if (!walks) cues.push({ id: "sabot", atMs: timeline.total });
      for (const { capture } of ejections) {
        const finalCell = reduced || capture.atStep >= path.length - 1;
        cues.push(
          ...cuesFor(capture.captured, {
            mode: m,
            timeline,
            isFinalCapture: finalCell,
            arrivalMs: moveEnd,
          }),
        );
      }
      sound(cues, t0);

      const involved = [event.pawn, ...captures.map((capture) => capture.victim)];
      deps.animator.begin?.(involved);
      for (const pawn of involved) current.add(pawn);

      const running: (Promise<void> | undefined)[] = [];
      try {
        if (!walks) {
          running.push(
            deps.animator.exit?.(
              event.pawn,
              points[0] as Point,
              points[1] as Point,
              lead,
              facing,
              m,
            ),
          );
        } else {
          if (volte > 0) {
            running.push(
              deps.animator.turn?.(event.pawn, facingBefore, facings[0] ?? facing, lead, m),
            );
          }
          running.push(deps.animator.hop(event.pawn, points, timeline, lead + volte, facings, m));
        }

        let reared = false;
        for (const { capture, start, end, facing: victimFacing } of ejections) {
          const finalCell = reduced || capture.atStep >= path.length - 1;
          let startMs: number;
          if (finalCell) {
            // Eaten on the cell the attacker ends on: it rears, then the knight is thrown back (D-12).
            if (!reared && !reduced) {
              reared = true;
              running.push(deps.animator.rear?.(event.pawn, lead + moveEnd, m));
            }
            startMs = moveEnd + rearDuration(m);
          } else {
            // The 7: eaten at the moment the attacker passes its cell.
            startMs = volte + captureBeat(path.length, capture.atStep, m);
          }
          running.push(
            capture.to === null
              ? undefined
              : deps.animator.eject?.(capture.victim, start, end, lead + startMs, victimFacing, m),
          );
        }

        if (event.t === "pawnEnteredHome" && !reduced) {
          running.push(
            event.homeCount === 4
              ? deps.animator.party?.(
                  event.pawn,
                  points[points.length - 1] as Point,
                  lead + moveEnd,
                  m,
                )
              : deps.animator.settle?.(event.pawn, lead + moveEnd, m),
          );
        }
      } catch (error) {
        console.error(error);
      }
      try {
        await settled(running);
      } finally {
        for (const pawn of involved) current.delete(pawn);
      }
    }

    if (generationAtStart !== generation) return;
    for (const each of folds) fold(each);
    deps.commit(event.pawn, landing, facing);
    if (canAnimate) {
      for (const { capture, facing: victimFacing } of ejections) {
        if (capture.to !== null) deps.commit(capture.victim, capture.to, victimFacing);
      }
    }
  }

  /** The Valet: two knights cross; each lands on the other's place. */
  async function playSwap(event: Extract<GameEvent, { t: "pawnsSwapped" }>): Promise<void> {
    const pace = mode();
    const m: Mode = pace === "test" ? "normal" : pace;
    const generationAtStart = generation;
    const legs = ((): [SwapLeg, SwapLeg] | null => {
      if (render === null) return null;
      const make = (pawn: PawnId, to: Place): SwapLeg | null => {
        const start = render?.pawns[pawn];
        if (start === undefined) return null;
        const a = anchor(start);
        const b = anchor(to);
        const [dx, dy] = screenDelta(a, b);
        return { pawn, from: a, to: b, facing: facingFor(deps.facingOf(pawn), dx, dy) };
      };
      const first = make(event.a, event.aTo);
      const second = make(event.b, event.bTo);
      return first !== null && second !== null ? [first, second] : null;
    })();

    const animated = legs !== null && deps.animator.swap !== undefined && !instant();
    if (animated && legs !== null) {
      sound(cuesFor(event, { mode: m }), deps.audio.now() + LEAD_S);
      deps.animator.begin?.([event.a, event.b]);
      current.add(event.a);
      current.add(event.b);
      try {
        await settled([deps.animator.swap?.(legs[0], legs[1], LEAD_S * 1000, m)]);
      } finally {
        current.delete(event.a);
        current.delete(event.b);
      }
    }
    if (generationAtStart !== generation) return;
    fold(event);
    if (animated && legs !== null) {
      deps.commit(event.a, event.aTo, legs[0].facing);
      deps.commit(event.b, event.bTo, legs[1].facing);
    }
  }

  /** The game is won: the winning team's knights hop in place once. */
  async function playWin(event: Extract<GameEvent, { t: "gameWon" }>): Promise<void> {
    const pace = mode();
    const generationAtStart = generation;
    if (deps.animator.winHop !== undefined && render !== null && !instant() && pace !== "reduced") {
      const m: Mode = pace === "test" ? "normal" : pace;
      const winners = COLORS.filter((color) => teamOf(color) === event.team).flatMap((color) =>
        ([0, 1, 2, 3] as const).map((slot) => `${color}${slot}` as PawnId),
      );
      current.clear();
      for (const pawn of winners) current.add(pawn);
      try {
        await settled([deps.animator.winHop(winners, LEAD_S * 1000, m)]);
      } finally {
        current.clear();
      }
    }
    if (generationAtStart !== generation) return;
    fold(event);
  }

  /** The pace and the start of a card motion, with its sounds on the audio clock; null when it is skipped. */
  function cardStart(event: GameEvent, wanted: boolean): Mode | null {
    if (!wanted || instant()) return null;
    const pace = mode();
    const m: Mode = pace === "test" ? "normal" : pace;
    sound(cuesFor(event, { mode: m }), deps.audio.now() + LEAD_S);
    return m;
  }

  /**
   * A deal: the `dealt` event opens the exchange (the banner shows), then the cards of the hands that
   * follow it fly from the talon to the seats, and the hands are counted once they have landed.
   */
  async function playDeal(event: Extract<GameEvent, { t: "dealt" }>): Promise<void> {
    const hands: Extract<GameEvent, { t: "handDealt" }>[] = [];
    for (let next = queue[0]; next !== undefined && next.t === "handDealt"; next = queue[0]) {
      queue.shift();
      hands.push(next);
    }
    const generationAtStart = generation;
    fold(event);
    const m = cardStart(event, deps.animator.deal !== undefined && hands.length > 0);
    if (m !== null) {
      const seats = hands.map((hand) => ({ seat: hand.seat, count: hand.cards.length }));
      await settled([deps.animator.deal?.(seats, LEAD_S * 1000, m)]);
    }
    if (generationAtStart !== generation) return;
    for (const hand of hands) fold(hand);
  }

  /** A card played lands on the felt before the knight it moves; the felt shows it once it has landed. */
  async function playCardPlayed(event: Extract<GameEvent, { t: "cardPlayed" }>): Promise<void> {
    const generationAtStart = generation;
    const m = cardStart(event, deps.animator.playCard !== undefined && render !== null);
    if (m !== null)
      await settled([deps.animator.playCard?.(event.seat, event.card, LEAD_S * 1000, m)]);
    if (generationAtStart !== generation) return;
    fold(event);
  }

  /** The four cards of the exchange cross the felt; the hands change once they have crossed. */
  async function playExchange(event: Extract<GameEvent, { t: "cardsExchanged" }>): Promise<void> {
    const generationAtStart = generation;
    const m = cardStart(event, deps.animator.exchange !== undefined && render !== null);
    if (m !== null) await settled([deps.animator.exchange?.(LEAD_S * 1000, m)]);
    if (generationAtStart !== generation) return;
    fold(event);
  }

  /** A dead hand is laid face up in front of its seat, 350 ms per card, 60 ms apart. */
  async function playDiscard(event: Extract<GameEvent, { t: "handDiscarded" }>): Promise<void> {
    const generationAtStart = generation;
    const m = cardStart(
      event,
      deps.animator.lay !== undefined && render !== null && event.cards.length > 0,
    );
    if (m !== null) await settled([deps.animator.lay?.(event.seat, event.cards, LEAD_S * 1000, m)]);
    if (generationAtStart !== generation) return;
    fold(event);
  }

  async function play(event: GameEvent): Promise<void> {
    if (isMovement(event)) return playMovement(event);
    switch (event.t) {
      case "pawnsSwapped":
        return playSwap(event);
      case "gameWon":
        return playWin(event);
      case "dealt":
        return playDeal(event);
      case "cardPlayed":
        return playCardPlayed(event);
      case "cardsExchanged":
        return playExchange(event);
      case "handDiscarded":
        return playDiscard(event);
      default:
        fold(event);
    }
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
      for (const pawn of current) deps.animator.finish?.(pawn);
      deps.animator.finishCards?.();
    }
    return idle();
  }

  function enqueue(events: GameEvent[]): void {
    queue.push(...events);
    if (draining === null && queue.length > 0) draining = drain();
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
    enqueue,
    openDeal(events) {
      if (render !== null) {
        // Before the deal every card is in the talon: the hands fill as the cards land.
        const held = COLORS.reduce((sum, color) => sum + (render?.handSizes[color] ?? 0), 0);
        render = {
          ...render,
          talonSize: render.talonSize + held,
          handSizes: { bleu: 0, jaune: 0, rouge: 0, vert: 0 },
        };
        for (const listener of [...listeners]) listener(render);
      }
      enqueue(events);
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
