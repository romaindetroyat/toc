// The numbers of the bench page #/banc (03-UI-SPEC « What it measures »): the median, the time under
// which 95 % of the decisions fall, the longest decision and the longest frozen frame, and the verdict
// against the phone's target (BOT-05). Pure: the page measures, this file only counts.

import type { BenchResults } from "../i18n/fr/banc.ts";

/** The verdict's thresholds, in ms (03-UI-SPEC, to be confirmed by Romain at the acceptance test). */
export const VERDICT_P95_MS = 1000;
export const VERDICT_MAX_MS = 2000;
export const VERDICT_FROZEN_MS = 100;

/** The value under which a share q of the sorted values fall (the bench tool's nearest rank). */
export function percentile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0;
}

/** The results of the decision times measured (ms each) and of the longest frozen frame. */
export function resultsOf(times: readonly number[], frozen: number): BenchResults {
  const sorted = [...times].sort((a, b) => a - b);
  return {
    count: sorted.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max: sorted.at(-1) ?? 0,
    frozen,
  };
}

/** « Assez rapide sur cet appareil » when every threshold holds. */
export function fastEnough(results: BenchResults): boolean {
  return (
    results.count > 0 &&
    results.p95 <= VERDICT_P95_MS &&
    results.max <= VERDICT_MAX_MS &&
    results.frozen <= VERDICT_FROZEN_MS
  );
}
