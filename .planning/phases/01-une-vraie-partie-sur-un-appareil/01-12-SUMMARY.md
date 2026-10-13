---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 12
subsystem: engine
tags: [engine, movement, walk, legal-actions, apply, scenarios, vitest]

requires:
  - phase: 01-10
    provides: "startGame/newGame, giveCard, endDeal, isDealOver, viewFor, RuleSet/DEFAULT_RULES on state"
  - phase: 01-03
    provides: "Engine contract types (Action, Reason, GameEvent, Scenario) and the RULES.md fixtures"
provides:
  - "path.ts: walk(), exitWalk(), isProtected(), blocksPath(), the single movement path (home entry D-01..D-03, protected exit, backward 4)"
  - "moves.ts: controlledPawns, ownPawns, movesForCard, swapEnds (As, Roi, advances, 4, Valet; G1, G6, G7, G10, G11)"
  - "legal.ts: deterministic legalActions and playability with the UI-SPEC reason codes"
  - "apply.ts: apply, resolveMove (preview on a PlayerView), IllegalActionError with a code"
  - "scenario.ts: scenarioState(before, seed)"
  - "scenarios.test.ts: every non-7 RULES.md fixture as an executable test"
affects: [01-13, 01-14, 01-15, 02-rooms]

requirements-completed: [RULE-04, RULE-05, RULE-06, RULE-07, RULE-08, RULE-09, RULE-12, RULE-13, RULE-14, RULE-15, RULE-16, RULE-18]

actuals:
  tokens: 18500
  tasks: 2
  commits: 4
plan_head_before: d38f2ebaa65ea73aa4769404b2769afba601c565
plan_head_after: bc363b96a1005f8c35a4e6f8db28b9945373e21c

tech-stack:
  added: []
  patterns:
    - "One walk() for legality, preview, capture and animation paths; resolveMove re-derives its action from movesForCard, so apply and preview share the code"
    - "apply accepts only actions deep-equal to an element of legalActions and never mutates its input"
    - "Every rule choice read through board.rules (state.rules), never the module constants"

key-files:
  created:
    - packages/engine/src/path.ts
    - packages/engine/src/moves.ts
    - packages/engine/src/legal.ts
    - packages/engine/src/apply.ts
    - packages/engine/src/scenario.ts
    - packages/engine/test/helpers.ts
    - packages/engine/test/path.test.ts
    - packages/engine/test/flags.test.ts
    - packages/engine/test/scenarios.test.ts
    - packages/engine/test/turn.test.ts
  modified:
    - packages/engine/src/index.ts

key-decisions:
  - "Home entry: the entry square is crossed at progress q >= 70 with q = 70 mod 72; r steps beyond it enter slot r-1 if slots 0..r-1 are empty; an occupied target continues the lap; a home pawn before the target continues (G2 continue) or forbids the move (G2 illegal)"
  - "playability checks the Valet first (always jack-no-target), then blocked-protected (re-run with protection ignored), then no-pawn-to-exit, then no-pawn-can-move: R-12.4 and R-09.6 need the Valet before the protection check"
  - "gameWon replaces playerFinished and turn: a move that wins emits cardPlayed, the movement, gameWon only (R-16.1, R-16.4)"
  - "When the last hand empties, apply emits a nominal turn (next seat) then the end-of-deal events, so R-14.2 [handDiscarded, turn] holds"
  - "ORDINARY_CARDS_PASS_OVER_PAWNS false makes ordinary cards eat what they pass; ONLY_OWN_PAWNS_MOVE false lets the 5 move any ring pawn (alternative readings, not default)"
  - "Stable pawns are interchangeable: only the lowest-index stable controlled pawn is offered for an exit (A-11)"

status: complete
completed: 2026-10-13
---

# Phase 1 Plan 12: Le moteur, un seul chemin pour tous les déplacements, le tour de jeu et les scénarios Summary

**One `walk()` plays every card except the 7 (exit, advance, backward 4, Valet, captures, protected exit, exact home entry), with `legalActions`/`apply`/`resolveMove` on top and the RULES.md fixtures running as tests.**

## Accomplishments

- `walk()` implements D-01 to D-04 and G2/G3/G4: progress is signed and unbounded, entry needs the exact count onto an empty slot and is then mandatory, a missed entry goes round again, a home pawn advances by exact count without jumping, the backward 4 stays on the ring.
- `movesForCard` builds every candidate from `walk()`/`exitWalk()`/`swapEnds()`; `controlledPawns` returns the partner's pawns once a seat's four are home (RULE-17).
- `legalActions` is deterministic (hand order, pawn order, target id) and offers the discard only when nothing else is legal; `playability` returns the UI-SPEC reason codes.
- `apply` emits `cardPlayed`, the movement events, `playerFinished` once, then `turn` or `gameWon`; skips seats without cards; ends the deal when the last hand empties; throws `IllegalActionError` (with a code) for anything not in `legalActions` and never mutates its input.
- `resolveMove(viewFor(state, seat), seat, action)` gives the same pawns and movement events as `apply`.
- 103 RULES.md fixtures run through `scenarioState` and the engine: 80 pass, 19 are `todo` (all involve the 7, plan 01-13), 2 are `alt` skips (R-09.9, R-15.9), 2 are documented fixture contradictions (below).

## Task Commits

1. Task 1 RED, path and flag tests: `171ddff` (test)
2. Task 1, walk / moves / scenarioState: `43e5fcf` (feat)
3. Task 2 RED, scenarios and turn tests: `4624933` (test)
4. Task 2, legal / apply / scenario tests green: `bc363b9` (feat)

## Verification

- `pnpm exec vitest run packages/engine`: 7 files, 193 passed, 4 skipped, 19 todo; full `pnpm exec vitest run`: 308 passed, 4 skipped, 19 todo
- `pnpm typecheck` (engine both tsconfigs, board, web) and `pnpm lint`: pass
- `node tools/rules-trace.mjs --images`: OK (16 règles, 103 scénarios)
- `purity.test.ts` still passes; plain Node import and `legalActions(newGame(...), 'jaune')` exits 0
- Scratch fuzz (not committed): 300 random games, random legal choices with the 7 treated as dead: all 300 reach `won`, never two pawns on a cell, 52 cards always conserved

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `scenario.ts` committed with Task 1**
- **Found during:** Task 1
- **Issue:** The path and flag tests build states with `scenarioState`, which the plan assigns to Task 2.
- **Fix:** `scenario.ts` and its export were written and committed in the Task 1 feat commit.
- **Commit:** 43e5fcf

**2. [Rule 1 - Bug] Reason order in `playability`**
- **Found during:** Task 2 design against R-12.4 and R-09.6
- **Issue:** The plan lists « protection ignored → blocked-protected » before « Valet → jack-no-target », but R-12.4 (protected target) expects `jack-no-target`.
- **Fix:** The Valet check comes first.
- **Commit:** bc363b9

**3. [Rule 3 - Blocking] Extra files and exports**
- `test/helpers.ts` and `test/turn.test.ts` (not in `files_modified`) hold the probe tests and shared builders; `sameAction`, `ownPawns`, `isFinished`, `exitWalk`, `swapEnds`, `ALL_PAWNS` are exported because `apply`, tests and plan 01-13 need them.

### Documented fixture issues (RULES.md, for the orchestrator to put to Romain)

**A. R-13.13 and R-13.15 play a 4 as a forward move.** Both fixtures use `4S` to go forward (66 + 4 = 70 « pile sur le carré 16 »; 140 + 4 enters slot 1), and the image R-13.13 draws a pawn moving forward. R-08 (and R-02.2, R-08.1 to R-08.5, R-12.2) say the 4 goes back. I implemented RULES.md R-08 (the 4 is backward); the two scenarios are `it.skip` with the reason, and a separate test asserts the engine's actual behaviour (66 to 62, 140 to 136). The intended home behaviour is covered by `path.test.ts` (66 + 4 stops on the entry square, 140 + 4 enters slot 1). Fixing requires editing the two fixtures (another card or another start progress) and regenerating the two images; I did not touch them. No card gives a forward 4, so Romain should say which cards or squares he meant.

**B. Single-hand fixtures end the deal.** R-14.2 and R-16.2 give a hand to the acting seat only and expect `handSizes bleu 0` / `phase play` right after the move. By the Scenario convention the other hands are empty, so the engine (as plan 01-10 and this plan require) ends the deal and deals the next one. The test harness hands a talon card to the next seat when a single-card, single-hand fixture is played, which is what the fixtures mean. The engine is unchanged.

**C. `expect.events` matching.** The harness compares the exact event kinds after dropping `dealt`/`handDealt`/`reshuffled` unless the fixture lists them. For R-14.2 to hold, when every hand is empty `apply` emits `turn` (nominal next seat) before the end-of-deal events.

**Total deviations:** 3 auto-fixed, plus 3 documented fixture issues. **Impact:** none on the engine API; A needs a decision from Romain.

## Known Stubs

None. The 7 is intentionally absent (A-12): `movesForCard` returns nothing for it, `apply` rejects `seven` actions, `playability` gives a 7 the generic reason `no-pawn-can-move` until plan 01-13 adds `seven-incomplete`. A hand whose only playable card is a 7 is treated as dead in this plan.

## Notes for later plans

- Plan 01-13: add the 7 inside `movesForCard`/`legalActions`/`apply` using `walk(..., { capturePassed: true })` (captures carry `atStep`), replace the `reject` branch for `seven` in `apply`, and un-todo the 19 fixtures in `scenarios.test.ts` (the `sevenDependent` helper selects them). `playerFinished` mid-plan (R-15.8) must be emitted right after the `pawnEnteredHome` that completes the colour, before the remaining steps.
- `no-pawn-to-exit` is implemented as specified but cannot be reached by a legal position (exit blocked means an own pawn on the exit, which can always be moved by the same card unless protection blocks it, and that gives `blocked-protected` first); it is untested for that reason.
- `apply` ignores `EMPTY_HAND_SKIPPED` like the exchange ignores `EXCHANGE_SIMULTANEOUS`: only the validated value `true` exists.

## Threat Flags

None. T-01-09 (tampering with `apply`) is mitigated and tested in `turn.test.ts` (illegal action throws, frozen input unchanged).

## Self-Check: PASSED

All created files exist; commits 171ddff, 43e5fcf, 4624933, bc363b9 are in the branch history; `git rev-list --count` from the ledger base gives 4.
