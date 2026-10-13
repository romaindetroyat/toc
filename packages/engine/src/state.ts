// Game set-up and the deal machine: new game, 5/4/4 deals, reshuffle, dealer rotation and the
// simultaneous card exchange (RULES.md R-01, R-03, R-04; choices G8 and G9 read from state.rules).
// Every function returns a new state and the events it produced; inputs are never mutated.
// Pure, no I/O, erasable syntax only.

import { FULL_DECK, sortHand } from "./deck.ts";
import type { GameEvent } from "./events.ts";
import { type Rng, shuffle } from "./rng.ts";
import { DEFAULT_RULES, type RuleSet } from "./rules.ts";
import { COLORS, type Color, nextColor, PARTNER, type PawnId } from "./topology.ts";
import type { CardId, GameConfig, GameState, Pawn } from "./types.ts";

/** Cards per seat at each deal of the cycle: 5, then 4, then 4 (52 = 4 x 13). */
export const DEAL_SIZES = [5, 4, 4] as const;

function perColor<T>(make: (color: Color) => T): Record<Color, T> {
  return { bleu: make("bleu"), jaune: make("jaune"), rouge: make("rouge"), vert: make("vert") };
}

function initialPawns(): Record<PawnId, Pawn> {
  const pawns: Partial<Record<PawnId, Pawn>> = {};
  for (const color of COLORS) {
    for (const index of [0, 1, 2, 3] as const) pawns[`${color}${index}`] = { zone: "stable" };
  }
  return pawns as Record<PawnId, Pawn>;
}

/** The seat that plays first in every deal (G9, 'afterDealer'). */
function firstPlayer(dealer: Color, rules: RuleSet): Color {
  switch (rules.FIRST_PLAYER) {
    case "afterDealer":
      return nextColor(dealer);
  }
}

/**
 * Hands out the cards of the current dealIndex from the top of the talon, starting with the seat
 * after the dealer, and opens the exchange. The four hands must be empty.
 */
function dealHands(state: GameState): { state: GameState; events: GameEvent[] } {
  const size = DEAL_SIZES[state.dealIndex];
  if (state.talon.length < size * COLORS.length) {
    throw new Error(`deal: the talon holds ${state.talon.length} cards, ${size * 4} needed`);
  }
  const first = firstPlayer(state.dealer, state.rules);
  const hands = perColor((): CardId[] => []);
  const events: GameEvent[] = [
    { t: "dealt", dealer: state.dealer, dealIndex: state.dealIndex, size },
  ];
  let talon = state.talon;
  let seat = nextColor(state.dealer);
  for (let i = 0; i < COLORS.length; i++) {
    const cards = sortHand(talon.slice(0, size));
    talon = talon.slice(size);
    hands[seat] = cards;
    events.push({ t: "handDealt", seat, size: cards.length, cards: cards.slice() });
    seat = nextColor(seat);
  }
  return {
    state: {
      ...state,
      hands,
      talon,
      turn: first,
      phase: "exchange",
      given: perColor((): CardId | null => null),
      received: perColor((): CardId | null => null),
    },
    events,
  };
}

/**
 * A new game: the 52 cards shuffled with the seed, then the first deal of 5 cards (RULES.md R-03).
 * Returns the events of that first deal as well; `newGame` keeps only the state.
 * `rules` overrides single values of DEFAULT_RULES (tests, later table settings).
 */
export function startGame(
  cfg: GameConfig,
  seed: Rng,
  rules: Partial<RuleSet> = {},
): { state: GameState; events: GameEvent[] } {
  const [talon, rng] = shuffle(FULL_DECK, [seed[0], seed[1], seed[2], seed[3]]);
  const ruleSet: RuleSet = { ...DEFAULT_RULES, ...rules };
  const empty = (): CardId[] => [];
  const state: GameState = {
    kind: "state",
    pawns: initialPawns(),
    hands: perColor(empty),
    talon,
    discard: [],
    lastPlayed: perColor((): CardId | null => null),
    posed: perColor(empty),
    dealer: cfg.firstDealer,
    dealIndex: 0,
    dealsPlayed: 0,
    turn: firstPlayer(cfg.firstDealer, ruleSet),
    phase: "exchange",
    given: perColor((): CardId | null => null),
    received: perColor((): CardId | null => null),
    captures: { "bleu-rouge": 0, "jaune-vert": 0 },
    winner: null,
    rng,
    rules: ruleSet,
  };
  return dealHands(state);
}

/** `newGame(cfg, seed)` as fixed in types.ts: the state after the first deal. */
export function newGame(cfg: GameConfig, seed: Rng, rules: Partial<RuleSet> = {}): GameState {
  return startGame(cfg, seed, rules).state;
}

/**
 * Exchange choice of `seat`: the card it hands face down to its partner (R-04). Nothing moves until
 * the fourth seat has chosen; then the four swaps apply together, `cardsExchanged` is emitted once and
 * the play starts with the seat after the dealer. Throws when the give is not allowed.
 */
export function giveCard(
  state: GameState,
  seat: Color,
  card: CardId,
): { state: GameState; events: GameEvent[] } {
  if (state.phase !== "exchange") throw new Error(`give: no exchange in phase ${state.phase}`);
  if (state.given[seat] !== null) throw new Error(`give: ${seat} has already chosen a card`);
  if (!state.hands[seat].includes(card)) throw new Error(`give: ${seat} does not hold ${card}`);

  const given = { ...state.given, [seat]: card };
  if (COLORS.some((color) => given[color] === null)) {
    return { state: { ...state, given }, events: [] };
  }

  // The fourth choice has arrived: the four cards cross together (G8).
  const received = perColor((color): CardId | null => given[PARTNER[color]]);
  const hands = perColor((color) => {
    const gone = given[color] as CardId;
    const kept = state.hands[color].filter((c) => c !== gone);
    return sortHand([...kept, received[color] as CardId]);
  });
  const first = firstPlayer(state.dealer, state.rules);
  return {
    state: {
      ...state,
      hands,
      given: perColor((): CardId | null => null),
      received,
      phase: "play",
      turn: first,
    },
    events: [
      { t: "cardsExchanged", received },
      { t: "turn", seat: first },
    ],
  };
}

/** True when the four hands are empty: the deal is over and `endDeal` must run. */
export function isDealOver(state: GameState): boolean {
  return COLORS.every((color) => state.hands[color].length === 0);
}

/**
 * End-of-deal transition, called when every hand is empty (played or laid down; R-03, R-14).
 * The felt cards move to the discard pile. After the third deal of the cycle the 52 cards are
 * reshuffled with the state's rng and the dealer changes as DEALER_ROTATION says (G9); otherwise the
 * next 4-card deal is made. Either way the new deal opens with the exchange.
 */
export function endDeal(state: GameState): { state: GameState; events: GameEvent[] } {
  if (!isDealOver(state)) throw new Error("endDeal: a hand still holds cards");

  const events: GameEvent[] = [];
  const cycleEnds = state.dealIndex === 2;
  const dealer =
    cycleEnds || state.rules.DEALER_ROTATION === "perDeal" ? nextColor(state.dealer) : state.dealer;
  const discard = [...state.discard, ...COLORS.flatMap((color) => state.posed[color])];
  const base = {
    ...state,
    dealer,
    dealsPlayed: state.dealsPlayed + 1,
    posed: perColor((): CardId[] => []),
  };

  if (cycleEnds) {
    const [talon, rng] = shuffle([...state.talon, ...discard], state.rng);
    events.push({ t: "reshuffled", dealer });
    const dealt = dealHands({
      ...base,
      talon,
      discard: [],
      lastPlayed: perColor((): CardId | null => null),
      dealIndex: 0,
      rng,
    });
    return { state: dealt.state, events: [...events, ...dealt.events] };
  }

  const dealt = dealHands({ ...base, discard, dealIndex: (state.dealIndex + 1) as 1 | 2 });
  return { state: dealt.state, events: dealt.events };
}
