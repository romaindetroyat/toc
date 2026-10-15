// Deck, 5/4/4 deal cycle, dealer rotation and simultaneous exchange (RULE-01, RULE-02, RULE-03).
// Scenarios R-01, R-03 and R-04 of RULES.md, executed against the engine state machine.

import { describe, expect, it } from "vitest";
import {
  type CardId,
  COLORS,
  type Color,
  DEFAULT_RULES,
  endDeal,
  eventsFor,
  FULL_DECK,
  type GameEvent,
  type GameState,
  giveCard,
  nextColor,
  PARTNER,
  sortHand,
  startGame,
  teamOf,
  viewFor,
} from "../src/index.ts";

type Seed = [number, number, number, number];
const SEED: Seed = [1, 2, 3, 4];

/** Every card id found anywhere in the state. */
function allCards(state: GameState): CardId[] {
  return [
    ...state.talon,
    ...state.discard,
    ...COLORS.flatMap((c) => state.hands[c]),
    ...COLORS.flatMap((c) => state.posed[c]),
  ];
}

function expectConserved(state: GameState): void {
  const cards = allCards(state);
  expect(cards).toHaveLength(52);
  expect([...cards].sort()).toEqual([...FULL_DECK].sort());
}

function sizes(state: GameState): number[] {
  return COLORS.map((c) => state.hands[c].length);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

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

describe("deck", () => {
  it("has 52 distinct cards, 13 ranks in 4 suits", () => {
    expect(FULL_DECK).toHaveLength(52);
    expect(new Set(FULL_DECK).size).toBe(52);
  });

  it("sorts a hand by rank, ties as pique, coeur, carreau, trefle", () => {
    expect(sortHand(["13C", "1D", "7H", "7S", "1S", "7C", "7D"])).toEqual([
      "1S",
      "1D",
      "7S",
      "7H",
      "7D",
      "7C",
      "13C",
    ]);
  });
});

describe("startGame / newGame", () => {
  it("seats the four colours in two teams of partners face to face (R-01)", () => {
    expect(COLORS).toEqual(["bleu", "jaune", "rouge", "vert"]);
    expect(teamOf("bleu")).toBe(teamOf("rouge"));
    expect(teamOf("jaune")).toBe(teamOf("vert"));
    expect(teamOf("bleu")).not.toBe(teamOf("jaune"));
    for (const dealer of COLORS) {
      const { state } = startGame({ firstDealer: dealer }, SEED);
      expect(PARTNER[PARTNER[dealer]]).toBe(dealer);
      expect(state.dealer).toBe(dealer);
    }
  });

  it("deals 5 cards to each seat, keeps 32 in the talon and opens the exchange (R-03.1)", () => {
    const { state, events } = startGame({ firstDealer: "bleu" }, SEED);
    expect(state.kind).toBe("state");
    expect(state.phase).toBe("exchange");
    expect(state.dealIndex).toBe(0);
    expect(state.dealer).toBe("bleu");
    expect(state.turn).toBe("jaune");
    expect(sizes(state)).toEqual([5, 5, 5, 5]);
    expect(state.talon).toHaveLength(32);
    expect(events.map((e) => e.t)).toEqual([
      "dealt",
      "handDealt",
      "handDealt",
      "handDealt",
      "handDealt",
    ]);
    expect(events[0]).toEqual({ t: "dealt", dealer: "bleu", dealIndex: 0, size: 5 });
    expectConserved(state);
  });

  it("starts with the default house rules, as a copy", () => {
    const { state } = startGame({ firstDealer: "vert" }, SEED);
    expect(state.rules).toEqual(DEFAULT_RULES);
    expect(state.rules).not.toBe(DEFAULT_RULES);
    expect(state.rules.DEALER_ROTATION).toBe("perCycle");
    expect(state.rules.FIRST_PLAYER).toBe("afterDealer");
  });

  it("offers no override for the descriptive switches, which have a single implemented value", () => {
    // Type-level guard: asking for an alternative the engine does not play does not compile.
    // @ts-expect-error EMPTY_HAND_SKIPPED has no alternative (G13)
    startGame({ firstDealer: "vert" }, SEED, { EMPTY_HAND_SKIPPED: false });
    // @ts-expect-error EXCHANGE_KEEPS_HAND_SIZE has no alternative (Q7)
    startGame({ firstDealer: "vert" }, SEED, { EXCHANGE_KEEPS_HAND_SIZE: false });
    // @ts-expect-error PAUSE_IN_ALL_PHASES has no alternative (Q22)
    startGame({ firstDealer: "vert" }, SEED, { PAUSE_IN_ALL_PHASES: false });
    // @ts-expect-error EXCHANGE_SIMULTANEOUS has no alternative (G8)
    startGame({ firstDealer: "vert" }, SEED, { EXCHANGE_SIMULTANEOUS: false });
    expect(DEFAULT_RULES.EMPTY_HAND_SKIPPED).toBe(true);
    expect(DEFAULT_RULES.EXCHANGE_KEEPS_HAND_SIZE).toBe(true);
    expect(DEFAULT_RULES.PAUSE_IN_ALL_PHASES).toBe(true);
    expect(DEFAULT_RULES.EXCHANGE_SIMULTANEOUS).toBe(true);
  });

  it("puts every pawn in its stable at the start", () => {
    const { state } = startGame({ firstDealer: "bleu" }, SEED);
    expect(Object.keys(state.pawns)).toHaveLength(16);
    for (const pawn of Object.values(state.pawns)) expect(pawn).toEqual({ zone: "stable" });
  });

  it("hands out sorted hands and each handDealt event carries the seat's own cards", () => {
    const { state, events } = startGame({ firstDealer: "rouge" }, SEED);
    for (const seat of COLORS) {
      expect(state.hands[seat]).toEqual(sortHand(state.hands[seat]));
    }
    const dealtTo = events.filter((e) => e.t === "handDealt");
    expect(dealtTo.map((e) => e.seat)).toEqual(["vert", "bleu", "jaune", "rouge"]);
    for (const event of dealtTo) expect(event.cards).toEqual(state.hands[event.seat]);
  });

  it("shuffles differently for different seeds", () => {
    const a = startGame({ firstDealer: "bleu" }, [1, 2, 3, 4]).state;
    const b = startGame({ firstDealer: "bleu" }, [5, 6, 7, 8]).state;
    expect(a.hands).not.toEqual(b.hands);
  });

  it("is deterministic: same seed, same actions, byte-identical JSON", () => {
    const run = (): string => {
      const first = startGame({ firstDealer: "jaune" }, SEED).state;
      const exchanged = exchangeAll(first).state;
      const next = endDeal(emptyHands(exchanged)).state;
      return JSON.stringify(next);
    };
    expect(run()).toBe(run());
  });
});

describe("deal cycle 5/4/4 with reshuffle (R-03)", () => {
  it("deals 5, 4, 4 then reshuffles and deals 5 again, dealer changing only at the reshuffle", () => {
    let { state } = startGame({ firstDealer: "bleu" }, SEED);
    const observed: { size: number; dealer: Color; first: Color; index: number }[] = [];
    const eventTypes: GameEvent["t"][][] = [];
    for (let deal = 0; deal < 4; deal++) {
      observed.push({
        size: state.hands.bleu.length,
        dealer: state.dealer,
        first: state.turn,
        index: state.dealIndex,
      });
      expectConserved(state);
      const played = emptyHands(exchangeAll(state).state);
      const result = endDeal(played);
      eventTypes.push(result.events.map((e) => e.t));
      state = result.state;
    }
    expect(observed).toEqual([
      { size: 5, dealer: "bleu", first: "jaune", index: 0 },
      { size: 4, dealer: "bleu", first: "jaune", index: 1 },
      { size: 4, dealer: "bleu", first: "jaune", index: 2 },
      { size: 5, dealer: "jaune", first: "rouge", index: 0 },
    ]);
    const deal = ["dealt", "handDealt", "handDealt", "handDealt", "handDealt"];
    expect(eventTypes[0]).toEqual(deal);
    expect(eventTypes[1]).toEqual(deal);
    expect(eventTypes[2]).toEqual(["reshuffled", ...deal]);
    expect(state.dealer).toBe("jaune");
    expect(state.dealsPlayed).toBe(4);
  });

  it("reshuffles all 52 cards: nothing stays on the felt, nothing is lost (R-03.4, R-03.5)", () => {
    let { state } = startGame({ firstDealer: "vert" }, SEED);
    for (let deal = 0; deal < 3; deal++) {
      state = endDeal(emptyHands(exchangeAll(state).state)).state;
    }
    expectConserved(state);
    expect(state.discard).toEqual([]);
    expect(COLORS.flatMap((c) => state.posed[c])).toEqual([]);
    expect(state.dealer).toBe("bleu");
    expect(state.turn).toBe("jaune");
    expect(sizes(state)).toEqual([5, 5, 5, 5]);
    expect(state.talon).toHaveLength(32);
  });

  it("brings the posed hands back into the pack at the reshuffle", () => {
    let { state } = startGame({ firstDealer: "bleu" }, SEED);
    state = exchangeAll(state).state;
    // jaune lays its hand down instead of playing it; the other seats play theirs
    const posed = { ...state.posed, jaune: state.hands.jaune };
    const hands = { bleu: [], jaune: [], rouge: [], vert: [] };
    state = {
      ...state,
      posed,
      hands,
      discard: [...state.discard, ...state.hands.bleu, ...state.hands.rouge, ...state.hands.vert],
    };
    state = endDeal(state).state;
    expectConserved(state);
    expect(COLORS.flatMap((c) => state.posed[c])).toEqual([]);
  });

  it("changes the dealer every deal when DEALER_ROTATION is perDeal", () => {
    const base = startGame({ firstDealer: "bleu" }, SEED, { DEALER_ROTATION: "perDeal" });
    let state = base.state;
    const dealers: Color[] = [state.dealer];
    const firsts: Color[] = [state.turn];
    for (let deal = 0; deal < 3; deal++) {
      state = endDeal(emptyHands(exchangeAll(state).state)).state;
      dealers.push(state.dealer);
      firsts.push(state.turn);
    }
    expect(dealers).toEqual(["bleu", "jaune", "rouge", "vert"]);
    expect(firsts).toEqual(["jaune", "rouge", "vert", "bleu"]);
    expect(firsts).toEqual(dealers.map(nextColor));
    expectConserved(state);
  });

  it("refuses to end a deal while a hand still holds cards", () => {
    const { state } = startGame({ firstDealer: "bleu" }, SEED);
    expect(() => endDeal(state)).toThrow();
  });
});

describe("simultaneous exchange (R-04)", () => {
  it("changes nothing for the first three gives (R-04.1)", () => {
    let { state } = startGame({ firstDealer: "vert" }, SEED);
    const handsBefore = JSON.stringify(state.hands);
    for (const seat of ["bleu", "jaune", "rouge"] as const) {
      const result = giveCard(state, seat, state.hands[seat][0] as CardId);
      state = result.state;
      expect(result.events).toEqual([]);
      expect(state.phase).toBe("exchange");
      expect(JSON.stringify(state.hands)).toBe(handsBefore);
    }
    expect(state.given.vert).toBeNull();
  });

  it("applies the four swaps together at the fourth give, with one cardsExchanged (R-04.2)", () => {
    const { state } = startGame({ firstDealer: "vert" }, SEED);
    const gift = Object.fromEntries(COLORS.map((c) => [c, state.hands[c][1]])) as Record<
      Color,
      CardId
    >;
    let current = state;
    let events: GameEvent[] = [];
    for (const seat of COLORS) {
      const result = giveCard(current, seat, gift[seat]);
      current = result.state;
      events = result.events;
    }
    expect(events.map((e) => e.t)).toEqual(["cardsExchanged", "turn"]);
    expect(events[0]).toEqual({
      t: "cardsExchanged",
      received: {
        bleu: gift.rouge,
        rouge: gift.bleu,
        jaune: gift.vert,
        vert: gift.jaune,
      },
    });
    expect(events[1]).toEqual({ t: "turn", seat: "bleu" });
    expect(current.phase).toBe("play");
    expect(current.turn).toBe("bleu");
    for (const seat of COLORS) {
      expect(current.received[seat]).toBe(gift[PARTNER[seat]]);
      expect(current.hands[seat]).toContain(gift[PARTNER[seat]]);
      if (gift[seat] !== gift[PARTNER[seat]]) expect(current.hands[seat]).not.toContain(gift[seat]);
      expect(current.given[seat]).toBeNull();
    }
    expectConserved(current);
  });

  it("keeps the hand sizes: the received card does not count in the deal (R-04.4)", () => {
    const { state } = startGame({ firstDealer: "bleu" }, SEED);
    expect(sizes(exchangeAll(state).state)).toEqual([5, 5, 5, 5]);
  });

  it("exchanges at every deal, not only the first one", () => {
    let { state } = startGame({ firstDealer: "bleu" }, SEED);
    state = endDeal(emptyHands(exchangeAll(state).state)).state;
    expect(state.phase).toBe("exchange");
    expect(state.received).toEqual({ bleu: null, jaune: null, rouge: null, vert: null });
    const exchanged = exchangeAll(state);
    expect(exchanged.events.map((e) => e.t)).toEqual(["cardsExchanged", "turn"]);
    expect(sizes(exchanged.state)).toEqual([4, 4, 4, 4]);
  });

  it("makes a seat with a dead hand exchange like the others (R-04.3)", () => {
    const { state } = startGame({ firstDealer: "vert" }, SEED);
    const hands: Record<Color, CardId[]> = {
      bleu: ["2S", "3S", "4S", "5S", "6S"],
      jaune: ["2H", "3H", "4H", "5H", "6H"],
      rouge: ["1S", "13S", "2D", "3D", "4D"],
      vert: ["7H", "8H", "9H", "10H", "2C"],
    };
    const used = new Set(COLORS.flatMap((c) => hands[c]));
    const forced: GameState = {
      ...state,
      hands,
      talon: FULL_DECK.filter((c) => !used.has(c)),
    };
    let current = forced;
    for (const [seat, card] of [
      ["bleu", "2S"],
      ["jaune", "2H"],
      ["rouge", "1S"],
      ["vert", "7H"],
    ] as const) {
      current = giveCard(current, seat, card).state;
    }
    expect(current.phase).toBe("play");
    expect(current.received).toEqual({ bleu: "1S", rouge: "2S", jaune: "7H", vert: "2H" });
    expectConserved(current);
  });

  it("rejects a card that is not in the hand, a second give and a give outside the exchange (R-04.5)", () => {
    const { state } = startGame({ firstDealer: "bleu" }, SEED);
    const foreign = state.hands.jaune[0] as CardId;
    expect(() => giveCard(state, "bleu", foreign)).toThrow();
    const once = giveCard(state, "bleu", state.hands.bleu[0] as CardId).state;
    expect(() => giveCard(once, "bleu", once.hands.bleu[1] as CardId)).toThrow();
    const playing = exchangeAll(state).state;
    expect(() => giveCard(playing, "bleu", playing.hands.bleu[0] as CardId)).toThrow();
  });

  it("never mutates its input", () => {
    const { state } = startGame({ firstDealer: "bleu" }, SEED);
    const frozen = deepFreeze(structuredClone(state));
    const exchanged = exchangeAll(frozen).state;
    expect(JSON.stringify(frozen)).toBe(JSON.stringify(state));
    const played = deepFreeze(emptyHands(exchanged));
    expect(() => endDeal(played)).not.toThrow();
  });
});

describe("viewFor: the hidden-hand boundary (T-01-10)", () => {
  it("is tagged kind 'view' and carries the seat's own hand and the hand sizes", () => {
    const { state } = startGame({ firstDealer: "bleu" }, SEED);
    const view = viewFor(state, "jaune");
    expect(view.kind).toBe("view");
    expect(view.seat).toBe("jaune");
    expect(view.hand).toEqual(state.hands.jaune);
    expect(view.handSizes).toEqual({ bleu: 5, jaune: 5, rouge: 5, vert: 5 });
    expect(view.talonSize).toBe(32);
    expect(view.dealer).toBe("bleu");
    expect(view.phase).toBe("exchange");
    expect(view.rules).toEqual(state.rules);
  });

  it("never contains a card id of another seat's hand, in every phase and for every seat", () => {
    let { state } = startGame({ firstDealer: "bleu" }, SEED);
    const stages: GameState[] = [state];
    // two gives: the givers' cards must stay private
    state = giveCard(state, "bleu", state.hands.bleu[0] as CardId).state;
    state = giveCard(state, "rouge", state.hands.rouge[0] as CardId).state;
    stages.push(state);
    state = giveCard(state, "jaune", state.hands.jaune[0] as CardId).state;
    state = giveCard(state, "vert", state.hands.vert[0] as CardId).state;
    stages.push(state);
    for (const stage of stages) {
      for (const seat of COLORS) {
        const view = viewFor(stage, seat);
        const json = JSON.stringify(view);
        // The seat knows its own cards and the card it passed to its partner (givenToPartner).
        const mine = new Set<string>(stage.hands[seat]);
        if (view.givenToPartner !== null) mine.add(view.givenToPartner);
        for (const other of COLORS) {
          if (other === seat) continue;
          for (const card of stage.hands[other]) {
            if (mine.has(card)) continue;
            expect(json).not.toContain(`"${card}"`);
          }
        }
      }
    }
  });

  it("hides the talon order, the rng and the other seats' exchange choices", () => {
    let { state } = startGame({ firstDealer: "bleu" }, SEED);
    const given = state.hands.rouge[0] as CardId;
    state = giveCard(state, "rouge", given).state;
    const own = viewFor(state, "rouge");
    expect(own.given).toBe(given);
    const other = viewFor(state, "jaune");
    expect(other.given).toBeNull();
    expect(JSON.stringify(other)).not.toContain(`"${given}"`);
    expect(other.hasGiven).toEqual({ bleu: false, jaune: false, rouge: true, vert: false });
    const json = JSON.stringify(other);
    expect(json).not.toContain("rng");
    expect(json).not.toContain('"talon"');
    for (const card of state.talon) expect(json).not.toContain(`"${card}"`);
  });

  it("shows the received card to its owner only and the public piles to everybody", () => {
    const { state } = startGame({ firstDealer: "bleu" }, SEED);
    const played = exchangeAll(state).state;
    const mine = viewFor(played, "bleu");
    expect(mine.received).toBe(played.received.bleu);
    expect(mine.given).toBeNull();
    expect(viewFor(played, "vert").received).toBe(played.received.vert);
    const felt = {
      ...played,
      discard: ["5H", "9D"] as CardId[],
      posed: { ...played.posed, rouge: ["2C"] as CardId[] },
    };
    for (const seat of COLORS) {
      const view = viewFor(felt, seat);
      expect(view.discard).toEqual(["5H", "9D"]);
      expect(view.posed.rouge).toEqual(["2C"]);
    }
  });

  it("returns a copy: changing the view does not touch the state", () => {
    const { state } = startGame({ firstDealer: "bleu" }, SEED);
    const before = JSON.stringify(state);
    const view = viewFor(state, "bleu");
    view.hand.pop();
    view.discard.push("1S");
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe("viewFor: givenToPartner, the card the seat passed (D-10, BOT-04)", () => {
  it("is null before the seat chooses, its own choice during the exchange, hidden from the others", () => {
    let { state } = startGame({ firstDealer: "bleu" }, SEED);
    for (const seat of COLORS) expect(viewFor(state, seat).givenToPartner).toBeNull();
    const card = state.hands.rouge[2] as CardId;
    state = giveCard(state, "rouge", card).state;
    expect(viewFor(state, "rouge").givenToPartner).toBe(card);
    for (const seat of ["bleu", "jaune", "vert"] as const) {
      expect(viewFor(state, seat).givenToPartner).toBeNull();
    }
  });

  it("is the card the seat passed once the gives have crossed, and null again at the next deal", () => {
    const { state } = startGame({ firstDealer: "bleu" }, SEED);
    const gift = Object.fromEntries(COLORS.map((c) => [c, state.hands[c][0]])) as Record<
      Color,
      CardId
    >;
    const played = exchangeAll(state).state;
    for (const seat of COLORS) {
      const view = viewFor(played, seat);
      expect(view.givenToPartner).toBe(gift[seat]);
      expect(view.givenToPartner).toBe(played.received[PARTNER[seat]]);
      expect(played.hands[PARTNER[seat]]).toContain(view.givenToPartner);
    }
    const next = endDeal(emptyHands(played)).state;
    expect(next.phase).toBe("exchange");
    for (const seat of COLORS) expect(viewFor(next, seat).givenToPartner).toBeNull();
  });

  it("never equals another seat's give, through the deals of a game", () => {
    let { state } = startGame({ firstDealer: "jaune" }, [9, 8, 7, 6]);
    for (let deal = 0; deal < 4; deal++) {
      const gift: Partial<Record<Color, CardId>> = {};
      // The seats give one after the other; after each give every view is checked.
      for (const giver of COLORS) {
        const card = state.hands[giver][deal % state.hands[giver].length] as CardId;
        gift[giver] = card;
        state = giveCard(state, giver, card).state;
        for (const seat of COLORS) {
          const own = viewFor(state, seat).givenToPartner;
          expect(own).toBe(gift[seat] ?? null);
          for (const other of COLORS) {
            if (other !== seat && gift[other] !== undefined) expect(own).not.toBe(gift[other]);
          }
        }
      }
      state = endDeal(emptyHands(state)).state;
    }
  });
});

describe("eventsFor: the hidden-hand boundary of the event stream", () => {
  it("keeps the seat's own dealt cards and the public hand sizes, hides the other hands", () => {
    const { state, events } = startGame({ firstDealer: "rouge" }, SEED);
    for (const seat of COLORS) {
      const projected = eventsFor(events, seat);
      expect(projected.map((e) => e.t)).toEqual(events.map((e) => e.t));
      for (const event of projected) {
        if (event.t !== "handDealt") continue;
        expect(event.size).toBe(state.hands[event.seat].length);
        if (event.seat === seat) expect(event.cards).toEqual(state.hands[seat]);
        else expect(event.cards).toBeNull();
      }
      const json = JSON.stringify(projected);
      for (const other of COLORS) {
        if (other === seat) continue;
        for (const card of state.hands[other]) {
          if (!state.hands[seat].includes(card)) expect(json).not.toContain(`"${card}"`);
        }
      }
    }
  });

  it("shows each seat only the card it received at the exchange", () => {
    const { state } = startGame({ firstDealer: "vert" }, SEED);
    const { state: played, events } = exchangeAll(state);
    for (const seat of COLORS) {
      const exchanged = eventsFor(events, seat).find((e) => e.t === "cardsExchanged");
      expect(exchanged).toBeDefined();
      if (exchanged?.t !== "cardsExchanged") continue;
      for (const color of COLORS) {
        expect(exchanged.received[color]).toBe(color === seat ? played.received[seat] : null);
      }
    }
  });

  it("passes the public events through and never touches its input", () => {
    const { events } = startGame({ firstDealer: "bleu" }, SEED);
    const frozen = deepFreeze(events.map((e) => ({ ...e })));
    const before = JSON.stringify(frozen);
    const projected = eventsFor(frozen, "jaune");
    expect(JSON.stringify(frozen)).toBe(before);
    expect(projected[0]).toEqual(frozen[0]);
    const own = projected.find((e) => e.t === "handDealt" && e.seat === "jaune");
    const source = frozen.find((e) => e.t === "handDealt" && e.seat === "jaune");
    if (own?.t === "handDealt" && source?.t === "handDealt") {
      expect(own.cards).not.toBe(source.cards);
    }
  });
});
