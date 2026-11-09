// The deal is fair (quick task 261109-6an). Romain asked on 2026-11-09 whether the deal favours the
// computer players (As, Rois, 7, Valets, « la carte qui fait manger » at the right moment). It does not:
// one shuffle (Fisher-Yates on sfc32) and one deal (dealHands, the same loop for every seat) serve all
// four seats, and no seat knows or chooses who sits where. This test keeps that proof for good: over
// thousands of packs dealt from newGame and endDeal with varied seeds, every seat receives every rank,
// and the 16 key cards (As, 7, Valet, Roi), at the expected rate within wide statistical bounds (8
// standard deviations: no false failure, yet a seat favoured by a few percent fails), and the 52 cards
// are conserved after every deal. Deterministic: the seeds come from a fixed sfc32 stream.

import { describe, expect, it } from "vitest";
import {
  type CardId,
  COLORS,
  type Color,
  endDeal,
  FULL_DECK,
  type GameState,
  newGame,
  next,
  RANKS,
  type Rank,
  type Rng,
  rankOf,
} from "../src/index.ts";

const GAMES = 3000;
/** Six deals per game: two packs of 5 + 4 + 4 cards per seat. */
const DEALS = 6;
const PACKS = GAMES * (DEALS / 3);
const KEY_RANKS: ReadonlySet<Rank> = new Set<Rank>([1, 7, 11, 13]);
const BOUND = 8;

/** Plays the deal out: every card of every hand goes to the discard pile. */
function emptyHands(state: GameState): GameState {
  return {
    ...state,
    hands: { bleu: [], jaune: [], rouge: [], vert: [] },
    discard: [...state.discard, ...COLORS.flatMap((c) => state.hands[c])],
    phase: "play",
  };
}

function allCards(state: GameState): CardId[] {
  return [
    ...state.talon,
    ...state.discard,
    ...COLORS.flatMap((c) => state.hands[c]),
    ...COLORS.flatMap((c) => state.posed[c]),
  ];
}

const SORTED_DECK = [...FULL_DECK].sort();

/** The seeds of the games: four 32-bit words per game from one fixed sfc32 stream. */
function seeds(count: number): Rng[] {
  let rng: Rng = [0x9e3779b9, 0x243f6a88, 0xb7e15162, 2026];
  const out: Rng[] = [];
  for (let i = 0; i < count; i++) {
    const words: number[] = [];
    for (let w = 0; w < 4; w++) {
      const [value, after] = next(rng);
      rng = after;
      words.push(Math.floor(value * 2 ** 32) >>> 0);
    }
    out.push([words[0] ?? 0, words[1] ?? 0, words[2] ?? 0, words[3] ?? 0]);
  }
  return out;
}

/**
 * Variance of how many of `special` cards one seat gets in a pack: 13 cards drawn from 52 without
 * replacement (hypergeometric), 13 p (1 − p) (52 − 13) / (52 − 1) with p = special / 52.
 */
function packVariance(special: number): number {
  const p = special / 52;
  return 13 * p * (1 - p) * (39 / 51);
}

type Tally = {
  ranks: Record<Color, Record<Rank, number>>;
  keys: Record<Color, number>;
  firstHands: Set<string>;
  conserved: boolean;
};

function deal(): Tally {
  const ranks = {} as Record<Color, Record<Rank, number>>;
  const keys = {} as Record<Color, number>;
  for (const seat of COLORS) {
    ranks[seat] = {} as Record<Rank, number>;
    for (const rank of RANKS) ranks[seat][rank] = 0;
    keys[seat] = 0;
  }
  const firstHands = new Set<string>();
  let conserved = true;
  seeds(GAMES).forEach((seed, game) => {
    const firstDealer = COLORS[game % COLORS.length] as Color;
    let state = newGame({ firstDealer }, seed);
    firstHands.add(state.hands.bleu.join(","));
    for (let d = 0; d < DEALS; d++) {
      // The hands right after the deal: the exchange comes after it and does not change the deal.
      for (const seat of COLORS) {
        for (const card of state.hands[seat]) {
          const rank = rankOf(card);
          ranks[seat][rank] += 1;
          if (KEY_RANKS.has(rank)) keys[seat] += 1;
        }
      }
      const cards = allCards(state).sort();
      if (cards.length !== 52 || cards.some((card, i) => card !== SORTED_DECK[i])) {
        conserved = false;
      }
      if (d < DEALS - 1) state = endDeal(emptyHands(state)).state;
    }
  });
  return { ranks, keys, firstHands, conserved };
}

describe("the deal is the same for every seat", () => {
  // 18 000 deals; the 5000 ms timeout fails the suite if they ever take more than 5 s.
  it("every seat gets every rank and the key cards at the expected rate; 52 cards always", () => {
    const tally = deal();
    expect(tally.conserved).toBe(true);

    const rankSd = Math.sqrt(packVariance(4) * PACKS);
    const keySd = Math.sqrt(packVariance(16) * PACKS);
    for (const seat of COLORS) {
      for (const rank of RANKS) {
        // 1 card of each rank per seat and pack on average (13 cards, 4 of each of 13 ranks).
        const got = tally.ranks[seat][rank];
        expect(Math.abs(got - PACKS), `${seat} rank ${rank}: ${got}`).toBeLessThanOrEqual(
          BOUND * rankSd,
        );
      }
      // 4 key cards per seat and pack on average (13 x 16 / 52).
      const got = tally.keys[seat];
      expect(Math.abs(got - 4 * PACKS), `${seat} key cards: ${got}`).toBeLessThanOrEqual(
        BOUND * keySd,
      );
    }

    // The seeds vary: the first hands differ from game to game.
    expect(tally.firstHands.size).toBeGreaterThanOrEqual(Math.ceil(GAMES * 0.99));
  }, 5000);
});
