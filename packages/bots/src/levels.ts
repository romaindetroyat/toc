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

export const LEVEL_PARAMS: Readonly<Record<BotLevel, LevelParams>> = {
  1: { epsilon: 1, temperature: 0 },
  2: { epsilon: 0.5, temperature: 20 },
  3: { epsilon: 0, temperature: 8 },
  4: { epsilon: 0, temperature: 3 },
  5: { epsilon: 0, temperature: 0 },
};
