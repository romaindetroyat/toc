import { type HopTimeline, MOTION, type Mode, type Point, REDUCED, scaleFor } from "@toc/board";
import type { Facing } from "./geometry.ts";

// Every motion is a Web Animations API call on an inner group of a Pawn.svelte (never on the outer
// <g>, which holds the static anchor), on transform and opacity only. The durations come from
// packages/board/src/motion.ts and hopTimeline, so picture and sound share one timing source.
// Each function returns a promise of its finish and takes `leadMs`: the delay before it starts, the
// same lead the audio cues are scheduled with (Pitfall 8). Offsets are relative to the pawn's static
// anchor; `px` in translate() equals SVG user units.

/** Hop arc height as a fraction of the cell pitch (UI-SPEC: 18 %). */
const ARC_HEIGHT = 0.18;
/** How far the shadow shrinks and fades at the top of a leap. */
const SHADOW_SHRINK = 0.3;
const SHADOW_FADE = 0.45;
/** The body is already compressing this long (ms, normal speed) before it touches the ground. */
const IMPACT_MS = 30;

/** The animated inner groups of a Pawn.svelte. */
export type PawnParts = {
  mover: SVGGElement;
  arc: SVGGElement;
  squash: SVGGElement;
  facing: SVGGElement;
  rear: SVGGElement;
  shadow: SVGGElement;
};

const ROLES = ["mover", "arc", "squash", "facing", "rear", "shadow"] as const;

/** Finds the animated inner groups of a pawn from its outer group (null when it is not mounted). */
export function partsOf(outer: SVGGElement | undefined): PawnParts | null {
  if (!outer) return null;
  const found: Partial<Record<(typeof ROLES)[number], SVGGElement>> = {};
  for (const role of ROLES) {
    const group = outer.querySelector<SVGGElement>(`[data-role="${role}"]`);
    if (!group) return null;
    found[role] = group;
  }
  return found as PawnParts;
}

/** A leg of a swap: where a knight starts and ends and which way its head points on the way. */
export type Leg = { parts: PawnParts; from: Point; to: Point; facing: Facing };

const translate = (dx: number, dy: number): string => `translate(${dx}px, ${dy}px)`;
const mirror = (facing: Facing): string => `scale(${facing === "left" ? -1 : 1}, 1)`;
const finished = (animations: (Animation | null)[]): Promise<void> =>
  Promise.all(animations.map((a) => a?.finished)).then(() => undefined);

/** The rising half of a leap decelerates, the falling half accelerates: a parabola in two segments. */
const RISE = "cubic-bezier(0.2, 0.6, 0.4, 1)";
const FALL = "cubic-bezier(0.6, 0, 0.8, 0.4)";

function leapKeyframes(peak: number): Keyframe[] {
  return [
    { transform: translate(0, 0), easing: RISE },
    { transform: translate(0, -peak), offset: 0.5, easing: FALL },
    { transform: translate(0, 0) },
  ];
}

/** The shadow stays on the ground and shrinks and fades as the knight rises. */
function shadowKeyframes(): Keyframe[] {
  const high = { transform: `scale(${1 - SHADOW_SHRINK})`, opacity: 1 - SHADOW_FADE };
  return [
    { transform: "scale(1)", opacity: 1, easing: RISE },
    { ...high, offset: 0.5, easing: FALL },
    { transform: "scale(1)", opacity: 1 },
  ];
}

/**
 * Compression on every landing: the body is already squashing by IMPACT before the ground, is at its
 * flattest on touchdown and recovers within `settle`; the last landing recovers after `total`, which
 * is the settle of the last hop (D-11). One animation for the whole move, `total + settle` long.
 */
function squashKeyframes(
  landings: number[],
  total: number,
  settle: number,
  impact: number,
): { keyframes: Keyframe[]; duration: number } {
  const duration = total + settle;
  const flat = `scale(${1 + MOTION.landingSquash / 2}, ${1 - MOTION.landingSquash})`;
  const at = (ms: number) => Math.min(1, Math.max(0, ms / duration));
  const keyframes: Keyframe[] = [{ transform: "scale(1, 1)", offset: 0 }];
  for (const landing of landings) {
    keyframes.push(
      { transform: "scale(1, 1)", offset: at(landing - impact), easing: "ease-out" },
      { transform: flat, offset: at(landing), easing: "ease-out" },
      { transform: "scale(1, 1)", offset: at(landing + settle) },
    );
  }
  keyframes.push({ transform: "scale(1, 1)", offset: 1 });
  // Offsets must not decrease: clamp the ones the impact or the settle pushed past a neighbour.
  let last = 0;
  for (const keyframe of keyframes) {
    last = Math.max(last, keyframe.offset as number);
    keyframe.offset = last;
  }
  return { keyframes, duration };
}

/**
 * Move a pawn along `points` (start anchor first) in one lock-step set of animations: `mover`
 * translates along the path over `timeline.total`, `arc` leaps once per bound, `shadow` shrinks while
 * it is up, `squash` compresses on each landing (the settle of the last one outlasts the move and is
 * not waited for). `facing` mirrors the sprite per segment (`facings[i]` holds during segment i,
 * switching at its start). Reduced motion is a single linear slide, nothing else.
 * Resolves when the movement has finished; the mover keeps its end offset (fill: forwards) until
 * `clear()` is called, after the static anchor has moved.
 * `points` may have more samples than there are bounds (a swap bulges sideways); the bounds are
 * `timeline.total / timeline.hop`.
 */
export async function hop(
  parts: PawnParts,
  points: Point[],
  timeline: HopTimeline,
  leadMs = 0,
  facings: Facing[] = [],
  mode: Mode = "normal",
  peak?: number,
): Promise<void> {
  const { mover, arc, shadow, squash, facing } = parts;
  const start = points[0];
  if (!start || points.length < 2) return;
  const segments = points.length - 1;
  const bounds = Math.max(1, Math.round(timeline.total / timeline.hop));

  const keyframes = points.map((p) => ({
    transform: translate(p[0] - start[0], p[1] - start[1]),
  }));
  const animations: Animation[] = [
    mover.animate(keyframes, {
      duration: timeline.total,
      delay: leadMs,
      fill: "forwards",
      easing: "linear",
    }),
  ];
  if (facings.length > 0) {
    // Forwards only: before its start the head keeps its old direction (a volte-face may be running).
    animations.push(
      facing.animate(facingKeyframes(facings, segments), {
        duration: timeline.total,
        delay: leadMs,
        fill: "forwards",
        easing: "linear",
      }),
    );
  }

  if (mode !== "reduced") {
    let pitch = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1] as Point;
      const b = points[i] as Point;
      pitch += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    pitch /= segments;
    const height = peak ?? ARC_HEIGHT * pitch;
    const bound = { duration: timeline.hop, delay: leadMs, iterations: bounds };
    animations.push(
      arc.animate(leapKeyframes(height), bound),
      shadow.animate(shadowKeyframes(), bound),
    );
    const scale = scaleFor(mode);
    const settle = Math.min(MOTION.lastHopSettle * scale, timeline.hop * 0.5);
    const impact = Math.min(IMPACT_MS * scale, timeline.hop * 0.25);
    const landings = Array.from({ length: bounds }, (_, i) => (i + 1) * timeline.hop);
    const squashed = squashKeyframes(landings, timeline.total, settle, impact);
    // Not waited for: the settle of the last landing runs on into the next event.
    squash.animate(squashed.keyframes, { duration: squashed.duration, delay: leadMs });
  }
  await finished(animations);
}

/** Facing is constant during a segment: each keyframe holds its value until the next one (a step). */
function facingKeyframes(facings: Facing[], n: number): Keyframe[] {
  const last = facings[facings.length - 1] ?? "right";
  return [
    ...Array.from({ length: n }, (_, i) => ({
      transform: mirror(facings[i] ?? last),
      offset: i / n,
      easing: "steps(1, jump-end)",
    })),
    { transform: mirror(facings[n - 1] ?? last), offset: 1 },
  ];
}

/** A timeline of `bounds` equal leaps over `total` ms, for the motions that are not a walk. */
function leaps(total: number, bounds: number): HopTimeline {
  const hopMs = total / bounds;
  const landings = Array.from({ length: bounds }, (_, i) => (i + 1) * hopMs);
  return { total, hop: hopMs, landings, clops: landings };
}

/** Leaving the stable: one arc bound from the stable slot to the diamond, 600 ms (D-15). */
export function exitBound(
  parts: PawnParts,
  from: Point,
  to: Point,
  leadMs: number,
  facing: Facing,
  mode: Mode,
): Promise<void> {
  const total = mode === "reduced" ? REDUCED.move : MOTION.exit * scaleFor(mode);
  const distance = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const peak = Math.min(140, Math.max(40, 0.22 * distance));
  return hop(parts, [from, to], leaps(total, 1), leadMs, [facing], mode, peak);
}

/**
 * The head turns toward the direction of travel before a backward 4 (D-10): a 120 ms flip of the
 * facing mirror through the edge-on view; if the knight already looks that way it glances over its
 * shoulder (a narrowing and back). Reduced motion has none.
 */
export function volteFace(
  { facing }: PawnParts,
  from: Facing,
  to: Facing,
  leadMs: number,
  mode: Mode,
): Promise<void> {
  if (mode === "reduced") return Promise.resolve();
  const edge = from === to ? 0.85 : 0;
  const animation = facing.animate(
    [
      { transform: mirror(from), easing: "ease-in-out" },
      { transform: `scale(${(from === "left" ? -1 : 1) * edge}, 1)`, offset: 0.5 },
      { transform: mirror(to) },
    ],
    { duration: MOTION.volteFace * scaleFor(mode), delay: leadMs, fill: "forwards" },
  );
  return finished([animation]);
}

/**
 * The attacker rears on arrival: rotate −14° and rise 14 units, 220 ms up then 280 ms down (D-12).
 * Two animations back to back (the second starts the instant the first ends, so there is no gap).
 */
export function rear({ rear: group }: PawnParts, leadMs: number, mode: Mode): Promise<void> {
  if (mode === "reduced") return Promise.resolve();
  const scale = scaleFor(mode);
  const rest = "rotate(0deg) translateY(0px)";
  const pose = `rotate(${MOTION.rearAngle}deg) translateY(${-MOTION.rearRise}px)`;
  const up = MOTION.rearUp * scale;
  return finished([
    group.animate([{ transform: rest }, { transform: pose }], {
      duration: up,
      delay: leadMs,
      easing: "ease-out",
    }),
    group.animate([{ transform: pose }, { transform: rest }], {
      duration: MOTION.rearDown * scale,
      delay: leadMs + up,
      easing: "ease-in-out",
    }),
  ]);
}

/**
 * The eaten knight flies to its stable on a parabola (peak 35 % of the distance), 700 ms, then bounces
 * once for 150 ms (D-12). Reduced motion: it fades out where it stood and fades in at the stable.
 */
export function eject(
  parts: PawnParts,
  from: Point,
  to: Point,
  leadMs: number,
  facing: Facing,
  mode: Mode,
): Promise<void> {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  if (mode === "reduced") return fade(parts.mover, dx, dy, leadMs, REDUCED.captureFadeOut);
  const scale = scaleFor(mode);
  const flight = MOTION.eject * scale;
  const bounce = MOTION.ejectBounce * scale;
  const height = MOTION.ejectPeak * Math.hypot(dx, dy);
  const { mover, arc, shadow, squash } = parts;

  const samples = 16;
  const parabola = Array.from({ length: samples + 1 }, (_, i) => {
    const t = i / samples;
    return { transform: translate(0, -4 * height * t * (1 - t)), offset: t };
  });
  const along = Array.from({ length: samples + 1 }, (_, i) => ({
    transform: translate((dx * i) / samples, (dy * i) / samples),
    offset: i / samples,
  }));
  const animations: Animation[] = [
    mover.animate(along, { duration: flight, delay: leadMs, fill: "forwards", easing: "linear" }),
    arc.animate(parabola, { duration: flight, delay: leadMs, easing: "linear" }),
    // The little bounce on arrival, with the body squashing as it lands.
    arc.animate(leapKeyframes(Math.min(24, height * 0.12)), {
      duration: bounce,
      delay: leadMs + flight,
    }),
    squash.animate(
      [
        { transform: `scale(${1 + MOTION.landingSquash / 2}, ${1 - MOTION.landingSquash})` },
        { transform: "scale(1, 1)" },
      ],
      { duration: bounce * 0.6, delay: leadMs + flight, easing: "ease-out" },
    ),
    shadow.animate(
      [
        { transform: "scale(1)", opacity: 1 },
        { transform: `scale(${1 - SHADOW_SHRINK})`, opacity: 1 - SHADOW_FADE, offset: 0.5 },
        { transform: "scale(1)", opacity: 1 },
      ],
      { duration: flight, delay: leadMs, easing: "ease-in-out" },
    ),
    shadow.animate(shadowKeyframes(), { duration: bounce, delay: leadMs + flight }),
    parts.facing.animate([{ transform: mirror(facing) }, { transform: mirror(facing) }], {
      duration: flight,
      delay: leadMs,
      fill: "forwards",
    }),
  ];
  return finished(animations);
}

/** Fade out where it stands, jump, fade in at the other place: `duration` ms each way (reduced motion). */
function fade(
  mover: SVGGElement,
  dx: number,
  dy: number,
  leadMs: number,
  duration: number,
): Promise<void> {
  return finished([
    mover.animate(
      [
        { transform: translate(0, 0), opacity: 1, offset: 0 },
        { transform: translate(0, 0), opacity: 0, offset: 0.5 },
        { transform: translate(dx, dy), opacity: 0, offset: 0.5 },
        { transform: translate(dx, dy), opacity: 1, offset: 1 },
      ],
      {
        duration: duration * 2,
        delay: leadMs,
        fill: "forwards",
        easing: "linear",
      },
    ),
  ]);
}

/**
 * The Valet: two knights cross in two arcs, two bounds each, 900 ms, at the same time (D-13). Both
 * bow out sideways, on opposite sides, so the paths cross rather than overlap. Reduced motion: a
 * 150 ms crossfade.
 */
export function swapArcs(a: Leg, b: Leg, leadMs: number, mode: Mode): Promise<void> {
  if (mode === "reduced") {
    return Promise.all([
      fade(a.parts.mover, a.to[0] - a.from[0], a.to[1] - a.from[1], leadMs, REDUCED.swapFade / 2),
      fade(b.parts.mover, b.to[0] - b.from[0], b.to[1] - b.from[1], leadMs, REDUCED.swapFade / 2),
    ]).then(() => undefined);
  }
  const total = MOTION.swap * scaleFor(mode);
  const timeline = leaps(total, MOTION.swapBounds);
  const leg = (own: Leg) => {
    const dx = own.to[0] - own.from[0];
    const dy = own.to[1] - own.from[1];
    const distance = Math.hypot(dx, dy) || 1;
    // The sideways direction flips with the direction of travel, so both legs bow to their own
    // left and the two paths pass on either side of each other.
    const bulge = Math.min(90, 0.18 * distance);
    const samples = 8;
    const points = Array.from({ length: samples + 1 }, (_, i): Point => {
      const t = i / samples;
      const sideways = Math.sin(Math.PI * t) * bulge;
      return [
        own.from[0] + dx * t + (-dy / distance) * sideways,
        own.from[1] + dy * t + (dx / distance) * sideways,
      ];
    });
    const peak = Math.min(60, 0.1 * distance);
    return hop(own.parts, points, timeline, leadMs, [own.facing], mode, peak);
  };
  return Promise.all([leg(a), leg(b)]).then(() => undefined);
}

/** Entering the home (the first three knights): a 150 ms settle after the last hop (D-14). */
export function homeSettle({ squash }: PawnParts, leadMs: number, mode: Mode): Promise<void> {
  if (mode === "reduced") return Promise.resolve();
  return finished([
    squash.animate(
      [
        { transform: "scale(1, 1)" },
        { transform: "scale(1.05, 0.94)", offset: 0.35 },
        { transform: "scale(1, 1)" },
      ],
      { duration: MOTION.homeSettle * scaleFor(mode), delay: leadMs, easing: "ease-in-out" },
    ),
  ]);
}

/**
 * The fourth knight home rears for 500 ms; the burst of particles (700 ms) is the caller's, started
 * with the rear and waited for here (D-14). Reduced motion: no rearing, no particles.
 */
export function party(
  parts: PawnParts,
  leadMs: number,
  mode: Mode,
  burst: () => Promise<void>,
): Promise<void> {
  if (mode === "reduced") return Promise.resolve();
  const pose = `rotate(${MOTION.rearAngle}deg) translateY(${-MOTION.rearRise * 1.4}px)`;
  const rise = finished([
    parts.rear.animate(
      [
        { transform: "rotate(0deg) translateY(0px)", easing: "ease-out" },
        { transform: pose, offset: 0.35 },
        { transform: pose, offset: 0.65, easing: "ease-in-out" },
        { transform: "rotate(0deg) translateY(0px)" },
      ],
      { duration: MOTION.partyRear * scaleFor(mode), delay: leadMs },
    ),
  ]);
  return Promise.all([rise, burst()]).then(() => undefined);
}

/** Each knight of the winning team hops in place once, 600 ms. Reduced motion: still. */
export function winHop(all: PawnParts[], leadMs: number, mode: Mode): Promise<void> {
  if (mode === "reduced") return Promise.resolve();
  const duration = MOTION.winHop * scaleFor(mode);
  return Promise.all(
    all.map(({ arc, shadow, squash }) =>
      finished([
        arc.animate(leapKeyframes(42), { duration, delay: leadMs }),
        shadow.animate(shadowKeyframes(), { duration, delay: leadMs }),
        squash.animate(
          squashKeyframes([duration], duration, 0, IMPACT_MS * scaleFor(mode)).keyframes,
          { duration, delay: leadMs },
        ),
      ]),
    ),
  ).then(() => undefined);
}

/** Jump the running animations of a pawn to their end, so the promises of the Director settle at once. */
export function finish(parts: PawnParts): void {
  for (const role of ROLES) {
    for (const animation of parts[role].getAnimations()) animation.finish();
  }
}

/**
 * Drop the animations of a pawn that hold an offset (after its static anchor has been moved to the
 * landing cell). The squash and the shadow end by themselves, so a landing settle may run on.
 */
export function clear({ mover, arc, facing }: PawnParts): void {
  for (const a of [...mover.getAnimations(), ...arc.getAnimations(), ...facing.getAnimations()]) {
    a.cancel();
  }
}
