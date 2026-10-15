---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 10
subsystem: engine
tags: [engine, deck, sfc32, deal, exchange, view, purity, vitest]

requires:
  - phase: 01-03
    provides: "Engine contract: GameState, PlayerView, GameEvent, Scenario types"
  - phase: 01-07
    provides: "Validated rule constants (G1-G13, Q7, Q22) in rules.ts"
provides:
  - "rng.ts: sfc32 next() and Fisher-Yates shuffle() over a serialisable state"
  - "deck.ts: FULL_DECK (52 ids) and sortHand (rank ascending, ties S H D C)"
  - "rules.ts: RuleSet type and DEFAULT_RULES; GameState.rules and PlayerView.rules"
  - "state.ts: startGame/newGame, giveCard (simultaneous exchange), endDeal (5/4/4 cycle, reshuffle, dealer rotation), isDealOver"
  - "view.ts: viewFor(state, seat), the hidden-hand boundary"
  - "purity.test.ts: guard run by every later engine plan"
affects: [01-11, 01-12, 01-13, 01-14, 01-15, 02-rooms]

requirements-completed: [RULE-01, RULE-02, RULE-03]

actuals:
  tokens: 9500
  tasks: 2
  commits: 3
plan_head_before: 32338470048759665c96d1d20b764a61b307a43c
plan_head_after: 544884823bc81b4fff310e130fb290e7812b01bd

tech-stack:
  added: []
  patterns:
    - "Engine functions return { state, events } and never mutate their input (deep-freeze test)"
    - "Every rule decision reads state.rules, not the module constants"
    - "viewFor copies every field and is scanned for foreign card ids in tests"

key-files:
  created:
    - packages/engine/src/rng.ts
    - packages/engine/src/deck.ts
    - packages/engine/src/state.ts
    - packages/engine/src/view.ts
    - packages/engine/tsconfig.test.json
    - packages/engine/test/deal.test.ts
    - packages/engine/test/purity.test.ts
  modified:
    - packages/engine/src/rules.ts
    - packages/engine/src/types.ts
    - packages/engine/src/index.ts
    - packages/engine/package.json

key-decisions:
  - "newGame keeps the types.ts signature (returns GameState); startGame returns { state, events } so the first deal's events are not lost"
  - "Felt cards (posed hands) move to the discard pile at every end of deal; the reshuffle gathers talon + discard"
  - "dealsPlayed counts deals completely played (0 during the first deal)"
  - "The exchange emits cardsExchanged then turn (as scenario R-04.2 lists); the first player is the seat after the dealer"
  - "Seed is used as given (no warm-up): the shell seeds with four crypto words"

status: complete
completed: 2026-10-13
---

# Phase 1 Plan 10: Le moteur — paquet, donnes 5/4/4, échange et vue par place Summary

**Seeded sfc32 deck, 5/4/4 deal cycle with reshuffle and dealer rotation read from state.rules, simultaneous exchange, and a per-seat `viewFor` that hides other hands, guarded by a purity test.**

## Accomplishments

- `startGame`/`newGame` seat bleu, jaune, rouge, vert in two teams, shuffle the 52 cards with the seed and deal 5 to each seat starting with the seat after the dealer; phase `exchange`.
- `giveCard`: first three gives change nothing; the fourth applies all four swaps at once, emits `cardsExchanged` then `turn`, resets `given`, records `received`, hand sizes unchanged; a dead-looking hand exchanges like any other.
- `endDeal` (called by plan 01-12's `apply` when every hand is empty): deals 4, 4, then reshuffles all 52 cards with the state's rng, emits `reshuffled`, and rotates the dealer per `DEALER_ROTATION` (`perCycle` default, `perDeal` supported).
- `viewFor` returns `kind: 'view'` with the seat's own hand, `handSizes`, `talonSize`, own `given`/`received`, public `hasGiven`, public piles and `rules`; never the rng, talon order or other hands.
- `purity.test.ts` scans `packages/engine/src` (comments stripped) for the random API of Math, Date, performance, crypto, timers, storage, network, DOM, `process` and `node:` imports, and checks it detects each of them.

## Task Commits

1. RED tests for Task 1 — `c50dcec` (test)
2. Task 1: deck, deals, exchange, dealer — `a6b5c24` (feat)
3. Task 2: view and purity guard — `5448848` (feat)

## Verification

- `pnpm exec vitest run packages/engine`: 3 files, 39 tests pass; full `pnpm exec vitest run`: 143 tests pass
- `pnpm typecheck` (engine both tsconfigs, board, web): pass; `pnpm lint`: pass
- Plain Node import of `src/index.ts`, `newGame(...)`, `viewFor(s, 'jaune').kind === 'view'`: exit 0
- Mutation check: adding the full hands to the view makes the foreign-card scan fail (2 tests), then reverted

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] types.ts needed `rules` on GameState and PlayerView**
- **Found during:** Task 1
- **Issue:** The plan makes `state.rules` the source of every rule decision and lists `rules` in the view, but types.ts (plan 01-03) had neither field; the file is not in `files_modified`.
- **Fix:** Added `rules: RuleSet` to `GameState` and `PlayerView` and documented `dealsPlayed`.
- **Files modified:** packages/engine/src/types.ts
- **Commit:** a6b5c24

**2. [Rule 1 - Bug] `typeof CONST` narrows validated constants to their literal**
- **Found during:** Task 1 typecheck
- **Issue:** `RuleSet` fields defined as `typeof DEALER_ROTATION` became `"perCycle"`, so `"perDeal"` was a type error.
- **Fix:** RuleSet writes the union types out explicitly.
- **Commit:** a6b5c24

**3. [Rule 3 - Blocking] `structuredClone` is not in the engine's ES2022 lib**
- **Found during:** Task 2 typecheck
- **Issue:** The engine tsconfig has `lib: ["ES2022"]`, `types: []`.
- **Fix:** viewFor copies pawns explicitly.
- **Commit:** 5448848

**4. [Process] Task 2 tests and implementation written in one step**
- The view and purity tests were not committed as a separate RED commit; instead a mutation check confirmed the view tests fail when other hands leak.

Additions beyond the plan, minor: optional third argument `rules` on `startGame`/`newGame` (lets tests flip one value, as the plan intends), and `isDealOver`.

## Known Stubs

None.

## Threat Flags

None. T-01-10 (view disclosure) and T-01-11 (predictable deals) are mitigated by `deal.test.ts` and `purity.test.ts`.

## Notes for later plans

- Plan 01-12: `giveCard` throws a plain `Error` on an illegal give (wrong phase, already given, card not in hand); `apply` should check `legalActions` first and raise `IllegalActionError`. After the last card of a deal leaves the hands, call `endDeal`; `isDealOver` tests the condition. `endDeal` moves `posed` cards to the discard pile and clears `posed`.
- Fixture convention: hands dealt by the engine are sorted; hands given in fixtures are used as they are, and `giveCard` re-sorts hands after the exchange.

## Self-Check: PASSED

Files created exist; commits c50dcec, a6b5c24, 5448848 are in the branch history.
