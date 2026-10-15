// The pace of a computer player (D-11, D-13; 03-UI-SPEC « Bot pacing »; 03-RESEARCH Pattern 8).
// The bot says how hard its decision was (Thought.difficulty from 0 to 1, Thought.candidates); the
// browser host turns it into a total think time. The search's own time counts inside that time, never
// on top of it: the controller waits only what is left once the decision is made.
// - normal, no choice or a single move: 300 to 450 ms, always under half a second;
// - normal, a real choice: 450 + 1550 × difficulty ms, ± 10 % jitter, at most 2 s;
// - « Avance rapide »: about a quarter of that, at most 300 ms (« presque aussitôt »);
// - test speed: no think time at all.
// hardCap is the wall-clock limit of the search itself (the runner then plays its best move so far):
// 2.5 s, 0.5 s in « Avance rapide », none at the test speed so a seeded test game is the same everywhere.
// The constants are a first guess, tuned with Romain at the acceptance test (03-07).
// Pure: no clock, no timer, no random source (u comes from the bot rng).

import type { Speed } from "./GameController.ts";

/** A forced move (0 or 1 candidate): SINGLE_BASE_MS + SINGLE_SPAN_MS × u. */
export const SINGLE_BASE_MS = 300;
export const SINGLE_SPAN_MS = 150;
/** A real choice: CHOICE_BASE_MS + CHOICE_SPAN_MS × difficulty, then the jitter. */
export const CHOICE_BASE_MS = 450;
export const CHOICE_SPAN_MS = 1550;
/** ± 10 %: the factor goes from 1 − JITTER to 1 + JITTER as u goes from 0 to 1. */
export const JITTER = 0.1;
/** The longest think at normal speed. */
export const CHOICE_CEILING_MS = 2000;
/** « Avance rapide »: this share of the normal time, never above FAST_CEILING_MS. */
export const FAST_FACTOR = 0.25;
export const FAST_CEILING_MS = 300;
/** The search is stopped at these wall-clock limits (BOT-05). */
export const HARD_CAP_MS = 2500;
export const FAST_HARD_CAP_MS = 500;

/** What the pace reads from a decision (a Thought of @toc/bots has both). */
export type Paced = { difficulty: number; candidates: number };

function normalPace(thought: Paced, u: number): number {
  if (thought.candidates <= 1) return SINGLE_BASE_MS + SINGLE_SPAN_MS * u;
  const raw = Number.isFinite(thought.difficulty) ? thought.difficulty : 0;
  const difficulty = Math.min(1, Math.max(0, raw));
  const jitter = 1 - JITTER + 2 * JITTER * u;
  return Math.min(CHOICE_CEILING_MS, (CHOICE_BASE_MS + CHOICE_SPAN_MS * difficulty) * jitter);
}

/** The total think time in ms of one decision. `u` is uniform in [0, 1), drawn from the bot rng. */
export function paceFor(thought: Paced, speed: Speed, u: number): number {
  switch (speed) {
    case "normal":
      return normalPace(thought, u);
    case "fast":
      return Math.min(FAST_CEILING_MS, normalPace(thought, u) * FAST_FACTOR);
    case "test":
      return 0;
  }
}

/** The wall-clock limit of a search in ms; null at the test speed (no limit, reproducible games). */
export function hardCap(speed: Speed): number | null {
  switch (speed) {
    case "normal":
      return HARD_CAP_MS;
    case "fast":
      return FAST_HARD_CAP_MS;
    case "test":
      return null;
  }
}
