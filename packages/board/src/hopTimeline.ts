// Single timing source for the hop animation (WAAPI) and the hoof clops (Web Audio).
// Pure: no clock, no DOM. Times are in milliseconds from the start of the move.

export type Mode = "normal" | "fast" | "reduced";

const SCALE = { normal: 1, fast: 0.4, reduced: 1 } as const;

/** Clops closer than this to the last kept clop are dropped (avoids a buzz in fast mode). */
export const MIN_CLOP_GAP_MS = 50;

export type HopTimeline = {
  total: number;
  hop: number;
  landings: number[];
  clops: number[];
};

export function hopTimeline(n: number, mode: Mode = "normal"): HopTimeline {
  if (mode === "reduced") return { total: 180, hop: 180, landings: [180], clops: [180] }; // single 180 ms slide, one clop
  const total = (400 + 133 * (n - 1)) * SCALE[mode]; // UI-SPEC: 1 cell 400, 4 cells 800, 13 cells 2000
  const hop = total / n;
  const landings = Array.from({ length: n }, (_, i) => (i + 1) * hop);
  const gallop = n >= 8; // UI-SPEC cadence: 2 clops per hop at 0 and 0.5 hop
  const raw = gallop ? landings.flatMap((t) => [t - hop, t - hop / 2]) : landings; // gallop: at 0 and 0.5 hop from each hop start; else on landing
  const clops: number[] = []; // keep a clop only if >= MIN_CLOP_GAP_MS after the last KEPT one
  for (const t of raw) {
    const last = clops[clops.length - 1];
    if (last === undefined || t - last >= MIN_CLOP_GAP_MS) clops.push(t);
  }
  return { total, hop, landings, clops };
}
