// Engine contract: cards, pawns, actions, reasons, state, per-seat view and scenario fixtures.
// Types only (plus two tiny card helpers): no rule logic lives here. Pure, no I/O.
// Relative imports carry the explicit .ts extension and syntax is erasable-only
// so Node 22 can import this file directly (tools/ scripts).
//
// API implemented by plans 01-10, 01-12 and 01-13 (signatures fixed here, bodies not written yet):
//
//   newGame(cfg: GameConfig, seed: [number, number, number, number]): GameState
//   legalActions(stateOrView: GameState | PlayerView, seat: Color): Action[]
//   apply(state: GameState, seat: Color, action: Action): { state: GameState; events: GameEvent[] }
//       throws IllegalActionError for any action that is not in legalActions
//   resolveMove(view: PlayerView, seat: Color, action: Action): MoveResolution
//       pure preview on a copy: path, captures, landing place (same code as apply)
//   viewFor(state: GameState, seat: Color): PlayerView
//   playability(view: PlayerView, seat: Color): Record<CardId, { playable: true } | { playable: false; reason: Reason }>
//   nextSteps(view: PlayerView, seat: Color, card: CardId, partialPlan: SevenPlan): Map<PawnId, number[]>
//   isComplete(view: PlayerView, seat: Color, card: CardId, plan: SevenPlan): boolean
//   scenarioState(before: Scenario['before'], seed: [number, number, number, number]): GameState
//
// The `kind` discriminant makes it a type error to pass a GameState where a PlayerView is expected:
// bots must not see hidden cards (groundwork for BOT-04). newGame and scenarioState set kind 'state',
// viewFor sets kind 'view'.

import type { GameEvent } from "./events.ts";
import type { Color, PawnId, Team } from "./topology.ts";

/** 1 = As, 11 = Valet, 12 = Dame, 13 = Roi. */
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

/** S = pique, H = cœur, D = carreau, C = trèfle. */
export type Suit = "S" | "H" | "D" | "C";

/** Rank followed by suit, for example "7H" (sept de cœur) or "13S" (roi de pique). */
export type CardId = `${Rank}${Suit}`;

export function rankOf(id: CardId): Rank {
  return Number.parseInt(id.slice(0, -1), 10) as Rank;
}

export function suitOf(id: CardId): Suit {
  return id.slice(-1) as Suit;
}

/**
 * A pawn is in its stable, on the ring, or in its home.
 * `progress` is signed (negative after a backward 4 from the exit) and unbounded:
 * a pawn that misses its home entry keeps lapping (D-01).
 */
export type Pawn =
  | { zone: "stable" }
  | { zone: "ring"; progress: number }
  | { zone: "home"; slot: 0 | 1 | 2 | 3 };

/** `exchange`: the four seats choose a card to give; `play`: turn by turn; `won`: game over. */
export type Phase = "exchange" | "play" | "won";

/** A 7 is an ordered list of (pawn, steps) whose steps sum to exactly 7. */
export type SevenPlan = { pawn: PawnId; steps: number }[];

export type Action =
  /** Exchange choice: the card handed face down to the partner. */
  | { t: "give"; card: CardId }
  /** As or Roi used to leave the stable. */
  | { t: "exit"; card: CardId; pawn: PawnId }
  /** Advance by the card value, or back 4 for the 4. */
  | { t: "move"; card: CardId; pawn: PawnId }
  /** Valet: swap `pawn` with `target`. */
  | { t: "swap"; card: CardId; pawn: PawnId; target: PawnId }
  /** 7 split across pawns. */
  | { t: "seven"; card: CardId; plan: SevenPlan }
  /** Dead hand: lay all cards face up on the felt. */
  | { t: "discard" };

/** Why a card cannot be played (UI-SPEC codes, verbatim). */
export type Reason =
  | "no-pawn-can-move"
  | "no-pawn-to-exit"
  | "jack-no-target"
  | "seven-incomplete"
  | "blocked-protected";

export type GameConfig = {
  /** Seat that deals first; the seat after the dealer plays first (G9). */
  firstDealer: Color;
};

/** Full, authoritative, JSON-safe state (no Map, Set or class). Discriminant: kind: 'state'. */
export type GameState = {
  kind: "state";
  pawns: Record<PawnId, Pawn>;
  hands: Record<Color, CardId[]>;
  talon: CardId[];
  discard: CardId[];
  /** Last card each seat played, shown on the felt in front of the seat (D-08). */
  lastPlayed: Record<Color, CardId | null>;
  /** Dead hands laid face up on the felt. */
  posed: Record<Color, CardId[]>;
  dealer: Color;
  /** Position in the 5/4/4 cycle: 0 = the 5-card deal, 1 and 2 = the two 4-card deals. */
  dealIndex: 0 | 1 | 2;
  dealsPlayed: number;
  turn: Color;
  phase: Phase;
  /** Exchange: the card each seat has chosen to give, until the four choices are applied. */
  given: Record<Color, CardId | null>;
  /** Card each seat received at the last exchange (marked in hand, D-21). */
  received: Record<Color, CardId | null>;
  /** Pawns eaten so far, per team. */
  captures: Record<Team, number>;
  winner: Team | null;
  /** sfc32 state, serialisable so deals are reproducible. */
  rng: [number, number, number, number];
};

/** What one seat is allowed to know. Never carries another seat's cards. Discriminant: kind: 'view'. */
export type PlayerView = {
  kind: "view";
  seat: Color;
  pawns: Record<PawnId, Pawn>;
  /** Own cards only. */
  hand: CardId[];
  handSizes: Record<Color, number>;
  talonSize: number;
  discard: CardId[];
  lastPlayed: Record<Color, CardId | null>;
  posed: Record<Color, CardId[]>;
  dealer: Color;
  dealIndex: 0 | 1 | 2;
  dealsPlayed: number;
  turn: Color;
  phase: Phase;
  /** Own exchange choice only. */
  given: CardId | null;
  /** Card the viewer received at the last exchange. */
  received: CardId | null;
  /** Who has already chosen a card to give (public: « il reste à choisir »). */
  hasGiven: Record<Color, boolean>;
  captures: Record<Team, number>;
  winner: Team | null;
};

/** Pawn placement in a fixture: in the stable, on the ring at this progress, or in this home slot. */
export type PawnSpec = "S" | { p: number } | { h: 0 | 1 | 2 | 3 };

export type RuleId =
  | "R-01"
  | "R-02"
  | "R-03"
  | "R-04"
  | "R-05"
  | "R-06"
  | "R-07"
  | "R-08"
  | "R-09"
  | "R-10"
  | "R-11"
  | "R-12"
  | "R-13"
  | "R-14"
  | "R-15"
  | "R-16";

/**
 * A rules case written as data: it feeds RULES.md, the engine acceptance tests and the debug loader.
 *
 * Conventions for scenarioState (plan 01-10):
 * - a colour missing from `before.pawns` has its four pawns in the stable; a colour missing from
 *   `before.hands` has an empty hand; the talon holds the cards that are in no hand;
 * - `before.phase` defaults to "play"; `phase: "exchange"` with explicit hands is an exchange case;
 * - deal cases: the four hands empty with `phase: "play"` means "the deal `dealIndex` has just
 *   ended"; the engine then runs the next deal and `expect.deal` describes it (sizes in the order
 *   bleu, jaune, rouge, vert). `phase: "exchange"` with no hands at all means "the first deal of
 *   the game", dealt by the engine from the seed;
 * - `expect.events` lists the types of the events emitted by the action (or by the whole script), in order.
 */
export type Scenario = {
  /** `R-NN.k`, for example "R-08.2". */
  id: `${RuleId}.${number}`;
  rule: RuleId;
  /** French title, as listed in RULES.md. */
  title: string;
  /** Seat the action is played by (defaults to `before.turn`). */
  seat?: Color;
  before: {
    pawns?: Partial<Record<Color, [PawnSpec, PawnSpec, PawnSpec, PawnSpec]>>;
    hands?: Partial<Record<Color, CardId[]>>;
    turn: Color;
    phase?: Phase;
    dealer?: Color;
    dealIndex?: 0 | 1 | 2;
  };
  action?: Action;
  /** Multi-step cases (deals, exchange, termination). */
  script?: { seat: Color; action: Action }[];
  expect: {
    legal?: boolean;
    reason?: Reason;
    captured?: PawnId[];
    /** For each captured pawn, the 0-based index in the attacker's path where it is eaten (the 7 eats on the way). */
    capturedAtStep?: Partial<Record<PawnId, number>>;
    after?: { pawns: Partial<Record<Color, PawnSpec[]>> };
    events?: GameEvent["t"][];
    legalInclude?: Action[];
    legalExclude?: Action[];
    playable?: Partial<Record<CardId, boolean>>;
    deal?: { sizes?: number[]; dealer?: Color; first?: Color };
    /** Seat to play after the action or script. */
    turn?: Color;
    /** Phase after the action or script. */
    phase?: Phase;
    /** Card each listed seat holds as « reçue » after the exchange. */
    received?: Partial<Record<Color, CardId>>;
    /** Hand size of each listed seat after the action or script. */
    handSizes?: Partial<Record<Color, number>>;
    /** The 52 cards are all accounted for (hands, talon, discard, felt) after the script. */
    conserved?: boolean;
  };
  /**
   * G-numbers the scenario depends on, plus "seven" when it depends on whether a 7 in hand can be played,
   * plus "alt" when the scenario describes the ALTERNATIVE value of an open point (G1, G12): the engine
   * tests run it only if Romain picks that alternative, and skip it otherwise.
   */
  flags?: string[];
};
