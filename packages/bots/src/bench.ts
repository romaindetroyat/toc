// The fixed bench positions (03-RESEARCH Pitfall 1): play-phase decisions on which the decision time of
// each level is measured, by tools/bench-bots.mjs on this machine and by the #/banc page on a phone
// (plan 03-06). They are derived on call from fixed seeds, by playing games between levels 2 to 4, so
// every device measures exactly the same decisions; nothing here draws a random number of its own.
// - every decision offers at least BENCH_MIN_CANDIDATES distinct candidates (a real choice);
// - at least BENCH_SEVENS of them hold a 7 with BENCH_SEVEN_OUTCOMES or more distinct end boards (the
//   worst case of the search, research Pitfall 1).
// Each position carries the seat's PlayerView only, like every bot call.
// Pure, no I/O, erasable syntax only.

import {
  apply,
  COLORS,
  type Color,
  newGame,
  type PlayerView,
  type Rng,
  teamOf,
  viewFor,
} from "@toc/engine";
import { candidatesFor } from "./candidates.ts";
import type { BotLevel } from "./levels.ts";
import { chooseAction } from "./thinker.ts";

export type BenchPosition = { label: string; view: PlayerView; seat: Color };

/** Distinct candidates a bench decision offers at least. */
export const BENCH_MIN_CANDIDATES = 3;
/** Distinct end boards of a 7 from which a decision counts as a hard 7. */
export const BENCH_SEVEN_OUTCOMES = 10;
/** Hard-7 decisions in the bench. */
export const BENCH_SEVENS = 12;
/** Other decisions in the bench. */
export const BENCH_OTHERS = 28;
/** One ordinary decision in this many is taken (spreads them over the game). */
const OTHER_STRIDE = 7;
/** The games played to find the positions: deal seed and the levels of the two teams. */
const BENCH_GAMES: readonly { seed: Rng; levels: readonly [BotLevel, BotLevel] }[] = [
  { seed: [101, 202, 303, 404], levels: [4, 3] },
  { seed: [505, 606, 707, 808], levels: [3, 4] },
  { seed: [909, 1010, 1111, 1212], levels: [4, 2] },
  { seed: [1313, 1414, 1515, 1616], levels: [2, 4] },
  { seed: [1717, 1818, 1919, 2020], levels: [4, 4] },
  { seed: [2121, 2222, 2323, 2424], levels: [3, 3] },
  { seed: [2525, 2626, 2727, 2828], levels: [4, 3] },
  { seed: [2929, 3030, 3131, 3232], levels: [3, 4] },
];
/** A game that has not ended after this many actions stops being searched. */
const GAME_CAP = 3000;

/**
 * The bench positions, always the same: BENCH_SEVENS hard 7s and BENCH_OTHERS ordinary choices, in the
 * order they were met.
 */
export function benchPositions(): BenchPosition[] {
  const sevens: BenchPosition[] = [];
  const others: BenchPosition[] = [];
  let met = 0;
  for (const [g, game] of BENCH_GAMES.entries()) {
    if (sevens.length >= BENCH_SEVENS && others.length >= BENCH_OTHERS) break;
    let state = newGame({ firstDealer: COLORS[g % 4] as Color }, game.seed);
    let rng: Rng = [game.seed[3], game.seed[1], game.seed[2], game.seed[0]];
    for (let i = 0; i < GAME_CAP && state.phase !== "won"; i++) {
      if (sevens.length >= BENCH_SEVENS && others.length >= BENCH_OTHERS) break;
      const seat =
        state.phase === "exchange"
          ? (COLORS.find((color) => state.given[color] === null) ?? state.turn)
          : state.turn;
      const view = viewFor(state, seat);
      if (state.phase === "play") {
        const candidates = candidatesFor(view, seat);
        const sevenOutcomes = candidates.filter((c) => c.action.t === "seven").length;
        if (candidates.length >= BENCH_MIN_CANDIDATES) {
          met++;
          const label = `partie ${g + 1}, action ${i}, ${seat}, ${candidates.length} candidats`;
          if (sevenOutcomes >= BENCH_SEVEN_OUTCOMES && sevens.length < BENCH_SEVENS) {
            sevens.push({ label: `${label} (7 : ${sevenOutcomes} issues)`, view, seat });
          } else if (met % OTHER_STRIDE === 0 && others.length < BENCH_OTHERS) {
            others.push({ label, view, seat });
          }
        }
      }
      const level = game.levels[teamOf(seat) === "bleu-rouge" ? 0 : 1];
      const thought = chooseAction(view, seat, level, rng);
      rng = thought.rng;
      state = apply(state, seat, thought.action).state;
    }
  }
  return [...sevens, ...others];
}
