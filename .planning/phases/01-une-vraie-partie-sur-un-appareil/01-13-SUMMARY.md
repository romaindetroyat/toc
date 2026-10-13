---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 13
subsystem: engine
tags: [engine, seven, plan, nextSteps, render-state, fold, fast-check, vitest]

requires:
  - phase: 01-12
    provides: "walk() with capturePassed (captures carry atStep), movesForCard, legalActions, apply, scenarios harness"
  - phase: 01-10
    provides: "newGame/startGame, viewFor, state.rules, sfc32 rng"
provides:
  - "seven.ts: applyPlan, nextSteps, isComplete, sevenPlans, canPlaySeven, normalizePlan (the 7 as one ordered plan of micro-moves)"
  - "legal.ts: legalActions lists every 7 plan (opts.sevenPlans 'all' | 'none'); playability gives seven-incomplete / blocked-protected"
  - "apply.ts: a seven action is validated by playing its plan, atomically"
  - "render.ts: RenderState, renderInit, renderOf, renderReduce (public-information fold of engine events)"
  - "Every RULES.md scenario runs against the engine: 101 pass, 2 alt skips (R-09.9, R-15.9), 0 todo"
affects: [01-14, 01-15, 01-16, 02-rooms]

requirements-completed: [RULE-10, RULE-11, RULE-16, RULE-17]

actuals:
  tokens: 19500
  tasks: 2
  commits: 4
plan_head_before: 8989b797efe24b4aa568bb67566095be944fe387
plan_head_after: 0ae36270cfb6cbe59fd1020087ca815f6f99526c

tech-stack:
  added: []
  patterns:
    - "Every 7 micro-move is a forward walk() with { capturePassed: true, ownIds }, checked at the moment it happens; the plan is atomic"
    - "Existence search memoised on (board, steps left, last pawn, used pawns when G5 is off); nextSteps, playability and sevenPlans all use it"
    - "walk() reads the ring occupancy once per call (one scan of the 16 pawns instead of one per cell)"
    - "RenderState folds public events only; hands are sizes, never cards"

key-files:
  created:
    - packages/engine/src/seven.ts
    - packages/engine/src/render.ts
    - packages/engine/test/seven.test.ts
    - packages/engine/test/props/render.test.ts
  modified:
    - packages/engine/src/legal.ts
    - packages/engine/src/apply.ts
    - packages/engine/src/moves.ts
    - packages/engine/src/path.ts
    - packages/engine/src/types.ts
    - packages/engine/src/index.ts
    - packages/engine/test/scenarios.test.ts

key-decisions:
  - "Consecutive entries of one pawn are merged before they are played (RULES.md R-10, 'n'en font qu'un'); sevenPlans lists the merged form only, apply accepts a plan that spells the merge in two entries as the same plan"
  - "G12: after a micro-move brings the fourth pawn home the movers and 'own' pawns are recomputed from the board (the partner's); with SEVEN_CONTINUES_WITH_PARTNER off they stay those held at the start of the turn (R-15.9 alternative)"
  - "playerFinished is emitted right after the pawnEnteredHome that completes a colour, unless that move wins the game (then apply emits gameWon only)"
  - "nextSteps returns Partial<Record<PawnId, number[]>> with an entry (possibly empty) for every pawn controlled at the start; steps for the pawn of the last entry are counted from before that entry (they merge)"
  - "legalActions(..., { sevenPlans: 'none' }) still returns [] rather than the discard when only the 7 is playable, so the discard rule stays honest"
  - "The deal events drive RenderState: reshuffled gathers the 52 cards, dealt moves the felt cards to the discard count and opens the exchange with nextColor(dealer) to play, handDealt takes from the talon"

status: complete
completed: 2026-10-13
---

# Phase 1 Plan 13: Le moteur, le 7 réparti et l'état de rendu Summary

**The 7 is played as an ordered, atomic plan of micro-moves that eats what it passes, with a lazy `nextSteps` and an existence-pruned `sevenPlans`; every RULES.md scenario now passes, and `renderReduce` folds engine events into the exact state `renderOf(view)` projects.**

## Accomplishments

- `applyPlan` plays each micro-move through `walk(..., { capturePassed: true, ownIds })`: own pawns are passed, every other pawn passed or landed on is eaten (`pawnCaptured.atStep` is the index of its cell in that micro-move's path), protected pawns block, home entry follows R-13 per micro-move, and a captured pawn frees its cell for the rest of the plan. The first failing micro-move rejects the whole plan and nothing is mutated.
- `nextSteps(view, seat, card, partialPlan)` offers only the step counts after which the 7 can still be completed exactly; `sevenPlans` enumerates every valid plan (pruned by the same search); `canPlaySeven` decides playability (`seven-incomplete`, or `blocked-protected` when the search with protection ignored finds a plan).
- `legalActions` lists every plan of each 7 (`opts.sevenPlans: 'none'` skips them); the discard is offered only when no card, the 7 included, can be played. `apply` validates a `seven` action by playing its plan.
- G12 is honoured mid-plan: the move that brings the fourth pawn home emits `pawnEnteredHome` then `playerFinished`, and the remaining steps use the partner's pawns (R-15.8); with the flag off the whole 7 uses the pawns held at the start (R-15.9 behaviour, tested).
- `render.ts`: `RenderState` (pawns as places, lastPlayed, posed, talon/discard/hand sizes, dealer, dealIndex, turn, homeCounts, captures, phase, winner), `renderOf(view)`, `renderInit(view)`, `renderReduce(rs, event)`. Property test over 200 fixed-seed games (actions drawn uniformly from `legalActions` with the engine's own sfc32): the fold equals `renderOf(viewFor(state, seat))` after every action and for each seat, all 15 event kinds occur, and no view ever shows a card the seat may not know.
- The 19 `it.todo` fixtures are real tests: R-10.1 to R-10.13, R-12.3, R-12.10, R-13.3, R-15.3, R-15.8, R-16.3. No fixture needed changing.

## Task Commits

1. Task 1 RED, the 7 as an ordered plan: `2048197` (test)
2. Task 1, seven.ts / legal / apply / scenarios green: `d5d2b92` (feat)
3. Task 2 RED, render fold property: `101d2c5` (test)
4. Task 2, render.ts: `0ae3627` (feat)

## Verification

- `pnpm exec vitest run packages/engine`: 9 files, 248 passed, 2 skipped (the alt scenarios R-09.9 and R-15.9), 0 failed, 0 todo; full `pnpm exec vitest run`: 363 passed, 2 skipped
- `pnpm typecheck` and `pnpm lint`: pass; `node tools/rules-trace.mjs --images`: OK (16 règles, 103 scénarios); `purity.test.ts` still passes
- `nextSteps` and `playability` stay under 5 ms (best of 7 after warm-up) on four boards in `seven.test.ts`: hemmed in by protected pawns, two-free-cells dead end, open board with opponents, stuck cluster. In a scratch fuzz of 100 random games the worst `nextSteps` took 1.7 ms
- Scratch fuzz (not committed): 100 random games from `legalActions`, 52 cards conserved at every step, all 100 reach `won`; the largest `legalActions` (32768 plans of one 7) takes about 110 ms

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shared helpers moved out of apply.ts**
- **Found during:** Task 1
- **Issue:** seven.ts needs `placeOf`, `stablePlace`, `homeCount` and `winningTeam`, which were private to apply.ts; importing apply from seven would be a cycle.
- **Fix:** `placeOf` and `stablePlace` now live in path.ts, `homeCount` and `winningTeam` in moves.ts (exported), apply.ts imports them. No behaviour change.
- **Files modified:** packages/engine/src/path.ts, moves.ts, apply.ts

**2. [Rule 2 - Performance guard for T-01-13] walk() builds the ring occupancy once per call**
- **Found during:** Task 1 design (the existence search calls walk tens of thousands of times)
- **Issue:** `occupantsAt` scanned the 16 pawns for every crossed cell.
- **Fix:** `ringOccupancy(board)` is built once per walk and read per cell; results (order of captures included) are unchanged, `blocksPath` keeps its signature.
- **Files modified:** packages/engine/src/path.ts

**3. [Rule 3 - Blocking] apply restructured**
- The movement branches share `movedState` and `finishMove` (state update and victory check) so the 7 and the other cards finish a move the same way; the seven branch no longer calls `legalActions` (it would enumerate every plan) and the other branches call it with `{ sevenPlans: 'none' }`.

**4. [Doc] types.ts contract comment** now says `nextSteps` returns `Partial<Record<PawnId, number[]>>` (plan text, instead of the earlier `Map`), and lists `sevenPlans` and the `legalActions` option.

### Plan details settled during execution

- The render-fold test plays the first 5 games to the end (all reach `gameWon`) and stops the other 195 after 250 actions, to keep the suite at about 15 s for the two property tests; the fold is compared after every action, not only at the end.
- `normalizePlan`, `canPlaySeven` and `PlanFailure`/`SevenOpts` are exported from seven.ts in addition to the four planned exports.

**Total deviations:** 3 auto-fixed (1 Rule 2, 2 Rule 3), plus one documentation change. **Impact:** none on the planned API.

## Notes for the orchestrator and later plans

- No RULES.md fixture contradicted the engine; nothing to put to Romain from this plan.
- A 7 can have a very large number of plans (32768 measured with four free pawns). `legalActions` returns them all by design (the apply/legal equivalence property of plan 01-14); a bot that does not need them should call `legalActions(view, seat, { sevenPlans: 'none' })` or build a plan with `nextSteps`, and the UI builds a 7 step by step with `nextSteps` and `normalizePlan`.
- Plans that spell one pawn's consecutive entries separately (`[{A,3},{A,4}]`) are accepted by `apply` (they equal `[{A,7}]`, RULES.md R-10) but are not in `legalActions`; plan 01-14's "apply accepts exactly legalActions" property should compare merged forms (`normalizePlan`).
- `RenderState.turn` after `dealt` is `nextColor(dealer)`, which is exact for the only validated FIRST_PLAYER value (`afterDealer`).

## Known Stubs

None.

## Threat Flags

None. T-01-18 (tampering with a seven plan) is mitigated and tested in `seven.test.ts` (malformed, mis-summed, mid-way failing and wrong-seat plans throw `IllegalActionError`, input state frozen and unchanged); T-01-13 (cost of the search) is bounded by the memoised existence search and the 5 ms tests.

## Self-Check: PASSED

All created files exist (seven.ts, render.ts, seven.test.ts, props/render.test.ts); commits 2048197, d5d2b92, 101d2c5 and 0ae3627 are in the branch history; `git rev-list --count` from the ledger base gives 4; the plan acceptance greps (`export function nextSteps`, `export function renderReduce`) exit 0.
