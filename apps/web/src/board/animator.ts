import type { HopTimeline, Point } from "@toc/board";
import type { Facing } from "./geometry.ts";

/** Hop arc height as a fraction of the cell pitch (UI-SPEC: 18 %). */
const ARC_HEIGHT = 0.18;

/** The three animated inner groups of a Pawn.svelte. */
export type PawnParts = {
  mover: SVGGElement;
  arc: SVGGElement;
  facing: SVGGElement;
};

/** Finds the animated inner groups of a pawn from its outer group (null when it is not mounted). */
export function partsOf(outer: SVGGElement | undefined): PawnParts | null {
  const mover = outer?.querySelector<SVGGElement>('[data-role="mover"]');
  const arc = outer?.querySelector<SVGGElement>('[data-role="arc"]');
  const facing = outer?.querySelector<SVGGElement>('[data-role="facing"]');
  return mover && arc && facing ? { mover, arc, facing } : null;
}

/**
 * Move a pawn along `points` (start anchor first, then every cell entered) in one lock-step pair of
 * animations: `mover` translates along the path over `timeline.total`, `arc` bounces once per hop.
 * `facing` mirrors the sprite per hop (`facings[i]` holds during hop i, switching at its start).
 * All start together after `leadMs`, the same lead the audio clops are scheduled with.
 * Offsets are relative to the pawn's static anchor; `px` in translate() equals SVG user units.
 * Resolves when the animations have finished. The mover keeps its end offset (fill: forwards)
 * until `clear()` is called, after the static anchor has moved.
 */
export async function hop(
  { mover, arc, facing }: PawnParts,
  points: Point[],
  timeline: HopTimeline,
  leadMs = 0,
  facings: Facing[] = [],
): Promise<void> {
  const start = points[0];
  if (!start || points.length < 2) return;
  const n = points.length - 1;

  let pitch = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Point;
    const b = points[i] as Point;
    pitch += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  pitch /= n;

  const keyframes = points.map((p) => ({
    transform: `translate(${p[0] - start[0]}px, ${p[1] - start[1]}px)`,
  }));
  const a1 = mover.animate(keyframes, {
    duration: timeline.total,
    delay: leadMs,
    fill: "forwards",
    easing: "linear",
  });
  const a2 = arc.animate(
    [
      { transform: "translateY(0px)" },
      { transform: `translateY(${-ARC_HEIGHT * pitch}px)`, offset: 0.5 },
      { transform: "translateY(0px)" },
    ],
    {
      duration: timeline.hop,
      delay: leadMs,
      iterations: Math.max(1, Math.round(timeline.total / timeline.hop)),
    },
  );
  const flips =
    facings.length > 0
      ? facing.animate(facingKeyframes(facings, n), {
          duration: timeline.total,
          delay: leadMs,
          fill: "both",
          easing: "linear",
        })
      : null;
  await Promise.all([a1.finished, a2.finished, flips?.finished]);
}

/** Facing is constant during a hop: each keyframe holds its value until the next one (a step). */
function facingKeyframes(facings: Facing[], n: number): Keyframe[] {
  const scale = (f: Facing) => `scale(${f === "left" ? -1 : 1}, 1)`;
  const last = facings[facings.length - 1] ?? "right";
  return [
    ...Array.from({ length: n }, (_, i) => ({
      transform: scale(facings[i] ?? last),
      offset: i / n,
      easing: "steps(1, jump-end)",
    })),
    { transform: scale(facings[n - 1] ?? last), offset: 1 },
  ];
}

/** Drop the animations of a pawn (after its static anchor has been moved to the landing cell). */
export function clear({ mover, arc, facing }: PawnParts): void {
  for (const a of [...mover.getAnimations(), ...arc.getAnimations(), ...facing.getAnimations()]) {
    a.cancel();
  }
}
