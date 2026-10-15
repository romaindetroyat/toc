// House-rule choices validated by Romain on 2026-10-13 (plan 01-07, RULE-20).
//
// One named constant per open point of RULES.md, section « Décisions de Romain ». Each value is the
// choice Romain validated (the proposed default for every point). Two kinds of switch live here:
//
// - Switches the engine honours. Their type is the literal union of the retained value and its
//   alternative, the engine reads them from `state.rules` (never the constants), and a game started
//   with another value through `startGame(cfg, seed, rules)` really plays the alternative.
// - Descriptive switches: EXCHANGE_SIMULTANEOUS (G8), EMPTY_HAND_SKIPPED (G13),
//   EXCHANGE_KEEPS_HAND_SIZE (Q7) and PAUSE_IN_ALL_PHASES (Q22). Only the validated value is
//   implemented and no engine code reads them, so their type is that single literal: they record the
//   choice (and show it in PlayerView.rules) but there is no alternative to switch to. (FIRST_PLAYER,
//   G9, also has a single value, but state.ts does read it.) G8, G13 and Q7 are built into
//   the engine's structure (the exchange in state.ts, nextHolder in apply.ts); Q22 concerns network
//   play (phase 2) and nothing reads it yet. Offering one of them as a table setting means
//   implementing the alternative first and widening its type.
//
// Numbering follows RULES.md: G1-G13 are the gaps, Q7 and Q22 the two questions listed with them.
// G14 and G15 record the changes Romain made on 2026-10-14 during the phase acceptance test; later
// changes continue the numbering (G16, 2026-10-15, his third acceptance test).
// Pure, no I/O, no import: Node 22 can load this file directly (erasable syntax only).

/**
 * G1 — Progression of a pawn after a Jack swap (RULES.md R-09, « Décisions de Romain »; validated 2026-10-13).
 * 'position': the pawn takes the progression of its new square (0-71; a pawn that had done an extra lap loses it).
 * 'keep': the pawn keeps the laps already done (picture R-09.9, not implemented).
 */
export const SWAP_PROGRESS: "position" | "keep" = "position";

/**
 * G2 — Home entry blocked by a pawn already home (RULES.md R-13; validated 2026-10-13).
 * 'continue': the pawn does not jump it and goes on for another lap, as if the square were occupied (scenario R-13.7).
 * 'illegal': the move is forbidden.
 */
export const HOME_JUMP_BLOCKED: "continue" | "illegal" = "continue";

/**
 * G3 — A pawn stopping on its own exit square after an extra lap is protected like on its first pass
 * (RULES.md R-12; validated 2026-10-13). true: protection depends on square and colour, not on the lap.
 */
export const PROTECTED_AFTER_EXTRA_LAP: boolean = true;

/**
 * G4 — A protected pawn also blocks the pawns of its own colour, for the 4, the 7 and the advancing cards
 * (RULES.md R-08, R-12; validated 2026-10-13). true: nobody passes it, own side included.
 */
export const PROTECTED_BLOCKS_OWNER: boolean = true;

/**
 * G5 — The same pawn may come back several times in one 7 plan; two consecutive steps of the same pawn
 * count as one (RULES.md R-10, scenario R-10.13; validated 2026-10-13). true: allowed.
 */
export const SEVEN_SAME_PAWN_TWICE: boolean = true;

/**
 * G6 — Jack with my own pawn protected on my exit square (RULES.md R-09, scenario R-09.6; validated 2026-10-13).
 * false: impossible, a protected pawn cannot be swapped, neither as target nor as the pawn played.
 */
export const SWAP_OWN_PROTECTED: boolean = false;

/**
 * G7 — Player who has finished: the partner's pawns count as « his own » for the Jack and for captures
 * (RULES.md R-09, R-15, scenarios R-15.4 and R-15.6; validated 2026-10-13). true: they do.
 */
export const FINISHED_PARTNER_PAWNS_ARE_OWN: boolean = true;

/**
 * G8 — Card exchange is simultaneous: the four players choose, then the four cards change hands together
 * (RULES.md R-04; validated 2026-10-13). Descriptive: the only value implemented (state.ts giveCard),
 * nothing reads the switch.
 */
export const EXCHANGE_SIMULTANEOUS: true = true;

/**
 * G9 — Dealer rotation (RULES.md R-03, scenarios R-03.1 to R-03.4; validated 2026-10-13).
 * 'perCycle': the dealer stays the same for the three deals of a pack and changes (clockwise) at each reshuffle.
 * 'perDeal': the dealer changes at every deal.
 */
export const DEALER_ROTATION: "perCycle" | "perDeal" = "perCycle";

/**
 * G9 — Who starts each deal (RULES.md R-03; validated 2026-10-13).
 * 'afterDealer': the player following the dealer, clockwise, starts every deal.
 */
export const FIRST_PLAYER: "afterDealer" = "afterDealer";

/**
 * G10 — Only the Jack moves a pawn that is not the player's own; every other card, the 5 included,
 * moves the player's own pawns only (RULES.md R-07, R-09, scenario R-07.3; validated 2026-10-13). true: only own pawns.
 */
export const ONLY_OWN_PAWNS_MOVE: boolean = true;

/**
 * G11 — Ordinary cards pass over pawns without capturing them; only a protected pawn is impassable and
 * only the 7 captures what it passes (RULES.md R-07, R-10, scenario R-07.5; validated 2026-10-13). true: pass over.
 */
export const ORDINARY_CARDS_PASS_OVER_PAWNS: boolean = true;

/**
 * G12 — When a 7 brings the player's last pawn home mid-plan, the remaining steps may be played with the
 * partner's pawns (RULES.md R-10, R-15, scenario R-15.8; validated 2026-10-13). true: they may
 * (R-15.9, playing the whole 7 with the pawns held at the start of the turn, is not implemented).
 */
export const SEVEN_CONTINUES_WITH_PARTNER: boolean = true;

/**
 * G14 — Home entry without the full lap (RULES.md R-02, R-08, R-13, « Décisions de Romain »; decided by
 * Romain on 2026-10-14 during the acceptance test, UAT test 6).
 * true: a knight enters its home whenever it reaches or crosses its own carré 16 moving forward, lap done
 * or not, at the exact count onto an empty slot (entry mandatory when the count is exact).
 * false: the rule of 2026-10-13 (entry only from progress 70 on, after the full lap).
 */
export const ENTRY_WITHOUT_FULL_LAP: boolean = true;

/**
 * G15 — The 7 and the partner's knight (RULES.md R-07, R-10, R-11, R-15, « Décisions de Romain »; decided
 * by Romain on 2026-10-14 during the acceptance test, UAT test 7).
 * false: a capture in passing (the 7, and the ordinary cards when G11 is off) eats only opponent knights;
 * the knights of the mover's team, own and partner's, are passed without being eaten, also when a finished
 * player plays his partner's knights; landing on a partner's knight still eats it (R-11).
 * true: the rule of 2026-10-13 (Q23), every passed knight that is not own is eaten.
 */
export const SEVEN_EATS_PASSED_PARTNER: boolean = false;

/**
 * G16 — The knight a card can bring home moves only to enter, judged card by card (RULES.md R-10, R-13,
 * « Décisions de Romain »; decided by Romain on 2026-10-15 during the acceptance test, UAT test 26; precises
 * D-02). His words: « si l'on peut atteindre une case vide de la zone d'arrivée, il faut que ce soit le seul
 * coup à jouer », « Seulement pour ce cheval », and, for a 9 played on a knight a 2 would bring home,
 * « Oui, autorisé » (« Seulement la carte qui le fait rentrer pile est obligée de le faire rentrer. Avec le
 * 9, il peut continuer son tour. »). An ordinary card already enters at the exact count (D-02); the 4 and
 * the Valet never enter.
 * true: a 7 whose split can leave a knight in its home moves that knight only to bring it home (it may
 * stop on its carré 16 and enter with a later step of the same 7); a 7 that does not move it stays free,
 * and the rule never makes a 7 unplayable.
 * false: the rule of 2026-10-14, the 7 may send that knight past its home or leave it short of it.
 */
export const KNIGHT_MUST_ENTER: boolean = true;

/**
 * G13 — A player with no card left is skipped until the next deal and the turn passes to the next player
 * (RULES.md R-05, R-14, scenarios R-05.3 and R-14.4; validated 2026-10-13). true: skipped.
 * Descriptive: the only value implemented (nextHolder in apply.ts always skips), nothing reads it.
 */
export const EMPTY_HAND_SKIPPED: true = true;

/**
 * Q7 — The exchanged card counts before the exchange: each player gives one card and receives one, so hand
 * sizes do not change (RULES.md R-04, scenario R-04.4; validated 2026-10-13). true: sizes unchanged.
 * Descriptive: the only value implemented (the exchange swaps one card for one), nothing reads it.
 */
export const EXCHANGE_KEEPS_HAND_SIZE: true = true;

/**
 * Q22 — The pause on disconnection applies in every phase of the game: exchange, hand laying down and
 * computer turns (RULES.md, « Décisions de Romain »; validated 2026-10-13). Network play only (phase 2).
 * Descriptive: there is no pause in phase 1, nothing reads it yet.
 */
export const PAUSE_IN_ALL_PHASES: true = true;

/**
 * Every validated choice in one JSON-safe object (value types written out: `typeof` would narrow them to
 * the retained literal): the engine reads `state.rules`, never the constants. The descriptive switches
 * (see the header) are typed as their single implemented value, so an override cannot ask for an
 * alternative the engine does not play.
 */
export type RuleSet = {
  SWAP_PROGRESS: "position" | "keep";
  HOME_JUMP_BLOCKED: "continue" | "illegal";
  PROTECTED_AFTER_EXTRA_LAP: boolean;
  PROTECTED_BLOCKS_OWNER: boolean;
  SEVEN_SAME_PAWN_TWICE: boolean;
  SWAP_OWN_PROTECTED: boolean;
  FINISHED_PARTNER_PAWNS_ARE_OWN: boolean;
  EXCHANGE_SIMULTANEOUS: true;
  DEALER_ROTATION: "perCycle" | "perDeal";
  FIRST_PLAYER: "afterDealer";
  ONLY_OWN_PAWNS_MOVE: boolean;
  ORDINARY_CARDS_PASS_OVER_PAWNS: boolean;
  SEVEN_CONTINUES_WITH_PARTNER: boolean;
  ENTRY_WITHOUT_FULL_LAP: boolean;
  SEVEN_EATS_PASSED_PARTNER: boolean;
  KNIGHT_MUST_ENTER: boolean;
  EMPTY_HAND_SKIPPED: true;
  EXCHANGE_KEEPS_HAND_SIZE: true;
  PAUSE_IN_ALL_PHASES: true;
};

/** The rules as Romain validated them (2026-10-13). A game copies this into `state.rules`. */
export const DEFAULT_RULES: Readonly<RuleSet> = {
  SWAP_PROGRESS,
  HOME_JUMP_BLOCKED,
  PROTECTED_AFTER_EXTRA_LAP,
  PROTECTED_BLOCKS_OWNER,
  SEVEN_SAME_PAWN_TWICE,
  SWAP_OWN_PROTECTED,
  FINISHED_PARTNER_PAWNS_ARE_OWN,
  EXCHANGE_SIMULTANEOUS,
  DEALER_ROTATION,
  FIRST_PLAYER,
  ONLY_OWN_PAWNS_MOVE,
  ORDINARY_CARDS_PASS_OVER_PAWNS,
  SEVEN_CONTINUES_WITH_PARTNER,
  ENTRY_WITHOUT_FULL_LAP,
  SEVEN_EATS_PASSED_PARTNER,
  KNIGHT_MUST_ENTER,
  EMPTY_HAND_SKIPPED,
  EXCHANGE_KEEPS_HAND_SIZE,
  PAUSE_IN_ALL_PHASES,
};
