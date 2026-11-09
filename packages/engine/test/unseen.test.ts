// The count of the cards a seat has not seen (quick task 261109-6an): unknownCards, partnerHolds and
// deckCount, the pool the computer players remember and the sheet « Les cartes du paquet » shows. The
// own hand, the card passed to the partner while the partner holds it, the played cards and the dead
// hands laid down are seen; a new pack starts again from the own hand.

import { describe, expect, it } from "vitest";
import {
  type CardId,
  COLORS,
  type Color,
  DEAL_SIZES,
  deckCount,
  endDeal,
  FULL_DECK,
  type GameEvent,
  type GameState,
  giveCard,
  newGame,
  PARTNER,
  partnerHolds,
  RANKS,
  type Rank,
  rankOf,
  unknownCards,
  viewFor,
} from "../src/index.ts";

/** The four seats give their first card; returns the state after the fourth give. */
function exchangeAll(state: GameState): { state: GameState; events: GameEvent[] } {
  let current = state;
  let events: GameEvent[] = [];
  for (const seat of COLORS) {
    const result = giveCard(current, seat, current.hands[seat][0] as CardId);
    current = result.state;
    events = result.events;
  }
  return { state: current, events };
}

/** Plays the deal out: every card of every hand goes to the discard pile. */
function emptyHands(state: GameState): GameState {
  return {
    ...state,
    hands: { bleu: [], jaune: [], rouge: [], vert: [] },
    discard: [...state.discard, ...COLORS.flatMap((c) => state.hands[c])],
    phase: "play",
  };
}

/** How many cards of each rank `cards` holds. */
function perRank(cards: readonly CardId[]): Record<Rank, number> {
  const out = {} as Record<Rank, number>;
  for (const rank of RANKS) out[rank] = 0;
  for (const card of cards) out[rankOf(card)] += 1;
  return out;
}

/** The expected hidden count: 4 of each rank minus the cards of `seen`. */
function expectedHidden(seen: readonly CardId[]): Record<Rank, number> {
  const counted = perRank(seen);
  const out = {} as Record<Rank, number>;
  for (const rank of RANKS) out[rank] = 4 - counted[rank];
  return out;
}

const sum = (values: Record<Rank, number>): number =>
  RANKS.reduce((total, rank) => total + values[rank], 0);

const fresh = (seed = 11, firstDealer: Color = "vert"): GameState =>
  newGame({ firstDealer }, [seed, 22, 33, 44]);

describe("deckCount: the start of a pack", () => {
  it("during the exchange: 4 of each rank minus the own hand, deal 1 of 5 cards, 32 in the talon", () => {
    const state = fresh();
    const view = viewFor(state, "bleu");
    const count = deckCount(view);
    expect(count.hidden).toEqual(expectedHidden(state.hands.bleu));
    expect(count.total).toBe(47);
    expect(count.total).toBe(32 + 15);
    expect(sum(count.hidden)).toBe(count.total);
    expect(count.deal).toBe(1);
    expect(count.dealSize).toBe(5);
    expect(count.talon).toBe(32);
  });

  it("the card chosen to give is still in the own hand while the exchange is open: seen", () => {
    const state = fresh();
    const chosen = state.hands.bleu[0] as CardId;
    const after = giveCard(state, "bleu", chosen).state;
    const view = viewFor(after, "bleu");
    expect(view.givenToPartner).toBe(chosen);
    expect(partnerHolds(view)).toBeNull();
    expect(unknownCards(view)).not.toContain(chosen);
    expect(deckCount(view).total).toBe(47);
  });
});

describe("deckCount: the card passed to the partner", () => {
  it("once the gives have crossed it is in the partner's hand and not hidden", () => {
    const state = fresh();
    const gave = state.hands.bleu[0] as CardId;
    const crossed = exchangeAll(state).state;
    expect(crossed.hands.rouge).toContain(gave);

    const bleu = viewFor(crossed, "bleu");
    expect(partnerHolds(bleu)).toBe(gave);
    expect(unknownCards(bleu)).not.toContain(gave);
    const count = deckCount(bleu);
    expect(count.hidden).toEqual(expectedHidden([...crossed.hands.bleu, gave]));
    expect(count.total).toBe(46);

    // Rouge counts its own hand (bleu's card is in it) and the card it passed to bleu, nothing else.
    const rouge = viewFor(crossed, "rouge");
    const rougeGave = state.hands.rouge[0] as CardId;
    expect(partnerHolds(rouge)).toBe(rougeGave);
    expect(unknownCards(rouge)).not.toContain(gave);
    expect(deckCount(rouge).hidden).toEqual(expectedHidden([...crossed.hands.rouge, rougeGave]));
    expect(deckCount(rouge).total).toBe(46);
  });

  it("when the partner plays it, it is a played card: still not hidden, not counted twice", () => {
    const state = fresh();
    const gave = state.hands.bleu[0] as CardId;
    const crossed = exchangeAll(state).state;
    const played: GameState = {
      ...crossed,
      hands: { ...crossed.hands, rouge: crossed.hands.rouge.filter((card) => card !== gave) },
      discard: [...crossed.discard, gave],
    };
    const view = viewFor(played, "bleu");
    expect(partnerHolds(view)).toBeNull();
    expect(unknownCards(view)).not.toContain(gave);
    const count = deckCount(view);
    expect(count.total).toBe(52 - view.hand.length - view.discard.length);
    expect(count.hidden).toEqual(expectedHidden([...view.hand, ...view.discard]));
  });
});

describe("deckCount: played cards and dead hands", () => {
  it("the discard pile is seen by every seat", () => {
    const crossed = exchangeAll(fresh()).state;
    const card = crossed.hands.jaune[0] as CardId;
    const played: GameState = {
      ...crossed,
      hands: { ...crossed.hands, jaune: crossed.hands.jaune.slice(1) },
      discard: [card],
    };
    for (const seat of COLORS) {
      expect(unknownCards(viewFor(played, seat)), seat).not.toContain(card);
    }
  });

  it("a hand laid down leaves the hidden cards of every viewer", () => {
    const crossed = exchangeAll(fresh()).state;
    const dead = crossed.hands.jaune.slice();
    const posed: GameState = {
      ...crossed,
      hands: { ...crossed.hands, jaune: [] },
      posed: { ...crossed.posed, jaune: dead },
    };
    for (const seat of COLORS) {
      const before = unknownCards(viewFor(crossed, seat));
      const after = deckCount(viewFor(posed, seat));
      const unknown = unknownCards(viewFor(posed, seat));
      for (const card of dead) expect(unknown, `${seat} ${card}`).not.toContain(card);
      // Vert already knew the card it passed to Jaune; Jaune already knew its own hand.
      const newlySeen = dead.filter((card) => before.includes(card)).length;
      expect(newlySeen, seat).toBe(
        seat === "jaune" ? 0 : seat === "vert" ? dead.length - 1 : dead.length,
      );
      expect(after.total, seat).toBe(before.length - newlySeen);
    }
  });
});

describe("deckCount: the deals of a pack and the new pack", () => {
  it("deal 2 and 3 count on, then the reshuffle starts again from the own hand", () => {
    let state = fresh(5, "bleu");
    for (const dealIndex of [0, 1, 2] as const) {
      const view = viewFor(state, "bleu");
      const count = deckCount(view);
      expect(count.deal).toBe(dealIndex + 1);
      expect(count.dealSize).toBe(DEAL_SIZES[dealIndex]);
      expect(count.talon).toBe(state.talon.length);
      expect(count.hidden).toEqual(expectedHidden([...view.hand, ...view.discard]));
      state = endDeal(emptyHands(exchangeAll(state).state)).state;
    }
    // The new pack: the discard is shuffled back in, every rank is 4 minus the own hand again.
    expect(state.dealIndex).toBe(0);
    expect(state.discard).toEqual([]);
    for (const seat of COLORS) {
      const view = viewFor(state, seat);
      const count = deckCount(view);
      expect(count.deal, seat).toBe(1);
      expect(count.hidden, seat).toEqual(expectedHidden(view.hand));
      expect(count.total, seat).toBe(47);
    }
  });

  it("on every state of several games: total = talon + other hands − the partner's known card", () => {
    for (const seed of [1, 2, 3, 99, 2026]) {
      let state = fresh(seed, COLORS[seed % 4] ?? "bleu");
      for (let deal = 0; deal < 6; deal++) {
        const crossed = exchangeAll(state).state;
        for (const each of [state, crossed]) {
          for (const seat of COLORS) {
            const view = viewFor(each, seat);
            const count = deckCount(view);
            let inHands = 0;
            for (const color of COLORS) if (color !== seat) inHands += view.handSizes[color];
            if (partnerHolds(view) !== null) inHands -= 1;
            expect(count.total, `${seed} ${deal} ${seat}`).toBe(view.talonSize + inHands);
            expect(count.total).toBe(unknownCards(view).length);
            expect(sum(count.hidden)).toBe(count.total);
            for (const rank of RANKS) {
              expect(count.hidden[rank]).toBeGreaterThanOrEqual(0);
              expect(count.hidden[rank]).toBeLessThanOrEqual(4);
            }
            // Never a card of the seat's own hand, nor the one it knows its partner holds.
            const unknown = new Set(unknownCards(view));
            for (const card of view.hand) expect(unknown.has(card)).toBe(false);
            const passed = partnerHolds(view);
            if (passed !== null) {
              expect(unknown.has(passed)).toBe(false);
              expect(each.hands[PARTNER[seat]]).toContain(passed);
            }
            expect(FULL_DECK.filter((card) => unknown.has(card))).toEqual([...unknown]);
          }
        }
        state = endDeal(emptyHands(crossed)).state;
      }
    }
  });

  it("takes a PlayerView only: a GameState is a type error", () => {
    const state = fresh();
    // @ts-expect-error the full state is not a seat's view (kind "state", not "view")
    const blind = () => deckCount(state);
    expect(typeof blind).toBe("function");
  });
});
