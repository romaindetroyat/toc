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
 * Level 1 does not use them: it plays randomLegal. Level 5 plays T = 0 on top of its search (below).
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
 * Wilson lower bound 61.5 % (pairs 80 / 105 / 15). PASS. Kept by plan 03-04: level 5 beat it 81.8 %
 * on the first 400-game run, so it was not softened; 4 → 3 re-run on 2026-10-15 gave the same 265 / 400.
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

/** Work, not time: one unit = one apply and one policy call inside level 5's search. */
export type Budget = { plies: number };

/**
 * Level 5, Champion (D-04, 03-RESEARCH Pattern 5): how many candidates the search keeps by the static
 * evaluation (captures and home entries are always kept on top of these).
 */
export const CHAMPION_KEEP = 6;
/** Plies rolled out after each kept candidate, every seat playing the noiseless policy (one round). */
export const CHAMPION_PLIES = 4;
/**
 * Imagined deals the default budget pays for when CHAMPION_KEEP candidates are kept. Calibrated on
 * 2026-10-15 with `node tools/bench-bots.mjs --level 5 --check` (40 fixed positions, 12 of them hard 7s,
 * 3 repeats; ceiling p95 ≤ 250 ms and max ≤ 600 ms on this machine, the phone's 1 s / 2 s over 3 to 5):
 * - 12 deals (360 units): p50 64.2 ms, p95 258.8 ms, max 691.3 ms — FAIL;
 * - 11 deals (330 units): p95 244.0 ms, max 550.9 ms — passes by 6 ms, within the run-to-run noise;
 * - 10 deals (300 units): p95 235.5 / 215.7 / 234.0 ms, max 444.7 / 492.5 / 458.9 ms over three runs —
 *   kept, the most deals that pass with a margin. CHAMPION_PLIES stays 4 (more plies cost the same).
 */
export const CHAMPION_WORLDS = 10;
/**
 * Level 5's default budget: each kept candidate costs its own apply plus CHAMPION_PLIES per deal
 * (6 × 10 × 5 = 300 units). Ladder runs against level 4 (seed 1, 4 workers):
 * - probe, 360 units (12 deals), 100 games: 78 / 100, p̂ 78.0 %, Wilson 95 % [68.9 %, 85.0 %];
 * - probe, 300 units, 100 games: 85 / 100, p̂ 85.0 %, Wilson 95 % [76.7 %, 90.7 %] — above 62 %, so
 *   none of plan 03-04's levers (card counting, K and N, level 4's T) was needed;
 * - confirmation 2026-10-15, 300 units: `node tools/ladder.mjs --a 5 --b 4 --games 400 --seed 1`
 *   → 327 / 400, p̂ 81.8 %, Wilson 95 % lower bound 77.7 % (pairs 133 / 61 / 6). PASS, first run
 *   (record: .planning/phases/03-l-ordinateur-la-force-choisie/03-04-ladder-5-4.txt).
 */
export const CHAMPION_BUDGET: Readonly<Budget> = {
  plies: CHAMPION_KEEP * CHAMPION_WORLDS * (1 + CHAMPION_PLIES),
};
