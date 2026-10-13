import type { HopTimeline, Point } from "@toc/board";

/** Hop arc height as a fraction of the cell pitch (UI-SPEC: 18 %). */
const ARC_HEIGHT = 0.18;

/**
 * Move a pawn along `points` (start anchor first, then every cell entered) in one lock-step pair of
 * animations: `mover` translates along the path over `timeline.total`, `arc` bounces once per hop.
 * Both start together after `leadMs`, the same lead the audio clops are scheduled with.
 * Offsets are relative to the pawn's static anchor; `px` in translate() equals SVG user units.
 * Resolves when both animations have finished. The mover keeps its end offset (fill: forwards)
 * until `clear()` is called, after the static anchor has moved.
 */
export async function hop(
  mover: SVGGElement,
  arc: SVGGElement,
  points: Point[],
  timeline: HopTimeline,
  leadMs = 0,
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
  await Promise.all([a1.finished, a2.finished]);
}

/** Drop the animations of a pawn (after its static anchor has been moved to the landing cell). */
export function clear(mover: SVGGElement, arc: SVGGElement): void {
  for (const a of [...mover.getAnimations(), ...arc.getAnimations()]) a.cancel();
}
