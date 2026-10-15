// The five strengths of a computer seat (BOT-01) and the parameters that set them apart (D-05, D-06):
// the levels share one evaluation and differ only by their noise. Level 1 is randomLegal (BOT-02).
// Pure, no I/O, erasable syntax only.

/** 1 Poulain, 2 Trotteur, 3 Galopeur, 4 Pur-sang, 5 Champion (the names live in the web catalogue). */
export type BotLevel = 1 | 2 | 3 | 4 | 5;

export const BOT_LEVELS: readonly BotLevel[] = [1, 2, 3, 4, 5];

/** Galopeur, the strength of every seat on a first visit (D-03). */
export const DEFAULT_BOT_LEVEL: BotLevel = 3;

/**
 * A level from an untrusted value (stored settings, later a protocol message): exactly one of the
 * numbers 1 to 5, otherwise null. A string such as "3" is refused.
 */
export function parseBotLevel(value: unknown): BotLevel | null {
  return BOT_LEVELS.find((level) => level === value) ?? null;
}

/**
 * The mistakes of a level (03-RESEARCH Pattern 4):
 * - epsilon: the chance of a uniformly random candidate instead of a considered one;
 * - temperature: the softmax temperature over the evaluation, in evaluation units (T = 8 reads « a
 *   move 8 progress steps worse is e^-1 as likely »); 0 picks the best score, ties to the first.
 * Level 1 does not use them: it plays randomLegal. Plan 03-04 adds level 5's search budget here.
 */
export type LevelParams = { epsilon: number; temperature: number };

/** Level 2, Trotteur: half of its moves at random, the rest through a broad softmax. */
export const TROTTEUR_EPSILON = 0.5;
/**
 * Level 2's temperature. Ladder 2026-10-15 (plan 03-02, evaluation with the risk and hand terms):
 * `node tools/ladder.mjs --a 2 --b 1 --games 400 --seed 1` → 370 / 400, p̂ 92.5 %, Wilson 95 %
 * lower bound 89.5 % (pairs 171 / 28 / 1). PASS.
 */
export const TROTTEUR_TEMPERATURE = 20;
/**
 * Level 3, Galopeur. Ladder 2026-10-15: `--a 3 --b 2 --games 400 --seed 1` → 393 / 400, p̂ 98.3 %,
 * Wilson lower bound 96.4 % (pairs 193 / 7 / 0). PASS.
 */
export const GALOPEUR_TEMPERATURE = 8;
/**
 * Level 4, Pur-sang. Ladder 2026-10-15: `--a 4 --b 3 --games 400 --seed 1` → 265 / 400, p̂ 66.3 %,
 * Wilson lower bound 61.5 % (pairs 80 / 105 / 15). PASS. The narrow step: plan 03-04 may soften it
 * once level 5 has its search (5 → 4 must pass the same bar).
 */
export const PUR_SANG_TEMPERATURE = 3;

/**
 * Frozen by plan 03-02 Task 3: every step passed the bar (p̂ ≥ 60 %, Wilson lower bound > 55 %) with
 * p̂ ≥ 63 % on the first run, so the starting values of 03-RESEARCH Pattern 4 were kept unchanged.
 * Re-run the three ladder steps whenever this table or evaluate.ts changes (research Pitfall 7).
 */
export const LEVEL_PARAMS: Readonly<Record<BotLevel, LevelParams>> = {
  1: { epsilon: 1, temperature: 0 },
  2: { epsilon: TROTTEUR_EPSILON, temperature: TROTTEUR_TEMPERATURE },
  3: { epsilon: 0, temperature: GALOPEUR_TEMPERATURE },
  4: { epsilon: 0, temperature: PUR_SANG_TEMPERATURE },
  5: { epsilon: 0, temperature: 0 },
};
