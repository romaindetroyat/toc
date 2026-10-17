---
phase: 03-l-ordinateur-la-force-choisie
plan: 01
subsystem: bots
tags: [bots, engine, seven, settings, svelte, launch, playwright, purity]

requires:
  - phase: 01-une-vraie-partie-sur-un-appareil
    provides: engine (legalActions, movesForCard, sevenPlans, viewFor), randomLegal, GameController, settings store, Launch screen, Segmented, SeatChip
provides:
  - "@toc/bots: BotLevel, BOT_LEVELS, DEFAULT_BOT_LEVEL, parseBotLevel, LEVEL_PARAMS, createThinker, chooseAction (one entry point for levels 1 to 5)"
  - "@toc/bots: team evaluation (evaluate.ts) and distinct candidates (candidates.ts)"
  - "engine: sevenOutcomes(board, seat, card), one plan per distinct end board of a 7"
  - "settings.botLevels { partner, left, right }, validated per role, default Galopeur"
  - "Launch screen section « Force de l’ordinateur » with StrengthPicker rows"
  - "createGame({ levels }) and the session mapping roles to colours"
  - "packages/bots/test/purity.test.ts guard"
affects: [03-02, 03-03, 03-04, 03-05, 03-06, 03-07, phase-2 durable object]

actuals:
  tokens: 14700
  tasks: 2
  commits: 2
plan_head_before: 603a234a17261ee87da1fd85cb8be6af2b329ba3
plan_head_after: 64903cb461a011d150323aaf79006658eb5f942c

tech-stack:
  added: []
  patterns:
    - "Bot API: (PlayerView, seat, level, Rng, Budget?) -> Thought { action, rng, difficulty, candidates }; work in units, never time"
    - "Candidates are scored as boards; same rank + same end board collapse to the first card in hand order"
    - "Levels differ only by LEVEL_PARAMS (epsilon, softmax temperature)"
    - "Strength remembered per role (partner/left/right), mapped to colours with screenSideOf"

key-files:
  created:
    - packages/bots/src/levels.ts
    - packages/bots/src/evaluate.ts
    - packages/bots/src/candidates.ts
    - packages/bots/src/thinker.ts
    - packages/bots/src/thinker.test.ts
    - packages/bots/test/purity.test.ts
    - packages/bots/tsconfig.test.json
    - packages/engine/test/props/sevenOutcomes.test.ts
    - apps/web/src/i18n/fr/bots.ts
    - apps/web/src/ui/StrengthPicker.svelte
    - apps/web/e2e/force.spec.ts
  modified:
    - packages/bots/src/index.ts
    - packages/bots/package.json
    - packages/engine/src/seven.ts
    - apps/web/src/settings/settings.ts
    - apps/web/src/settings/settings.test.ts
    - apps/web/src/routes/Launch.svelte
    - apps/web/src/game/session.svelte.ts
    - apps/web/src/game/GameController.ts
    - apps/web/src/game/GameController.test.ts
    - apps/web/e2e/launch.spec.ts

key-decisions:
  - "Level 1 also builds its candidates, only to fill Thought.difficulty and Thought.candidates for the pacing of 03-05; its action and rng are exactly randomLegal's"
  - "sevenOutcomes keeps sevenPlans' order and first plans: a visited set on completable's key (board, remaining, last, used) cannot hide the first path to any board"
  - "The bots purity guard also forbids module-level let/Map/Set and the name GameState in the deciding (non-test) files"

patterns-established:
  - "One pure bot entry point (chooseAction / createThinker) for every level, fed by viewFor(state, bot) only"

requirements-completed: [BOT-01, BOT-02, BOT-04]

coverage:
  - id: D1
    description: "Per-seat strength picker on the launch screen, Galopeur by default, remembered per role, hostile storage falls back silently"
    requirement: BOT-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e/force.spec.ts (phone + desktop)"
        status: pass
      - kind: unit
        ref: "apps/web/src/settings/settings.test.ts#parseSettings: the computer's strength per role (D-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each computer seat plays at its level through chooseAction with its own PlayerView"
    requirement: BOT-04
    verification:
      - kind: unit
        ref: "apps/web/src/game/GameController.test.ts#bots: each seat plays at its level (BOT-01)"
        status: pass
      - kind: unit
        ref: "packages/bots/src/thinker.test.ts#the bot takes a PlayerView only"
        status: pass
    human_judgment: false
  - id: D3
    description: "Level 1 is exactly randomLegal; levels 2 to 5 play legal moves with one team evaluation and their own noise; mixed-level games end with a winner"
    requirement: BOT-02
    verification:
      - kind: unit
        ref: "packages/bots/src/thinker.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "sevenOutcomes gives the same boards as sevenPlans + applyPlan, and the bots' 7 candidates come from it"
    verification:
      - kind: unit
        ref: "packages/engine/test/props/sevenOutcomes.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Look of the strength rows on the launch screen (horse names without numbers, layout)"
    verification: []
    human_judgment: true
    rationale: "Wording and whether a number shows next to the name are « à confirmer par Romain » (D-02); the per-screen layouts come in 03-03"

duration: 16min
completed: 2026-10-15
status: complete
---

# Phase 3 Plan 01: Traceur — la force choisie au lancement, retenue, et jouée dans la partie Summary

**Per-seat horse-level picker (Poulain … Champion) on the launch screen, remembered per role in toc.settings.v1, driving one pure bot entry point (chooseAction on the seat's PlayerView) whose levels 2–5 score distinct boards with a team evaluation, and an engine sevenOutcomes that cuts the worst 7 from 418 ms to 17 ms.**

## Performance

- **Duration:** about 16 min
- **Started:** 2026-10-15T10:28:55Z
- **Completed:** 2026-10-15T10:45Z
- **Tasks:** 2
- **Files modified:** 21 (11 created, 10 modified)

## Accomplishments

- `@toc/bots` gains `levels.ts` (BotLevel 1–5, `parseBotLevel`, `LEVEL_PARAMS`: level 2 ε 0.5 T 20, level 3 T 8, level 4 T 3, level 5 T 0), `evaluate.ts` (home 100 + 2 × slot, out 20 + 70 − distanceToEntry, stable 0; partner knights equal to own, opponents subtracted), `candidates.ts` and `thinker.ts` (`createThinker` / `chooseAction`, `Budget = { plies }`, `Thought = { action, rng, difficulty, candidates }`).
- Level 1 returns exactly randomLegal's action and next rng (50 views tested). Levels 2–5 with one candidate play it with difficulty 0 and an untouched rng; whole games (2v1, 3v2, 4v3, 5v4, both seatings, 2 seeds) all end with a winner.
- Settings: `botLevels { partner, left, right }`, each field validated by `parseBotLevel`, fallback 3 per seat; phase-1 stored objects still load.
- Launch screen: the visual team summary is replaced by « Force de l’ordinateur » with three rows (partner, left = next seat clockwise, right), each a small SeatChip + « Partenaire » / « Adversaire » and a radio group named « Force de {Couleur}, ton partenaire » / « …, adversaire ». The sr-only team sentences, tiles, note, button and « Réglages » are unchanged.
- Session maps the roles to colours with `screenSideOf`; `createGame({ levels })` calls `chooseAction(viewFor(state, bot), bot, levels[bot] ?? 3, botRng)`; `thinkDelay` unchanged (03-05 replaces it).
- Engine `sevenOutcomes`: same search as `sevenPlans` with a visited set; property-tested against the full enumeration.

## 7 candidate timing (Task 2)

Measured with a scratch script on the property's boards (3 834 7-turns of the 30 seeded games, 484 100 plans, 15 461 distinct outcomes), this container, Node 22:

| One 7's candidates | mean | p50 | p99 | worst | total |
|--------------------|------|-----|-----|-------|-------|
| Before: sevenPlans + applyPlan grouped (Task 1) | 3.67 ms | 0.17 ms | 60.7 ms | 418 ms | 14.1 s |
| After: sevenOutcomes | 0.66 ms | 0.16 ms | 5.5 ms | 17.2 ms | 2.5 s |

## Task Commits

1. **Task 1: Traceur — « Trotteur » choisi pour le partenaire, retenu, et joué dans la partie** - `82d438d` (feat)
2. **Task 2: Le 7 en quelques plateaux (sevenOutcomes) et la pureté du paquet des ordinateurs** - `64903cb` (feat)

## Verification (end gate)

- `pnpm typecheck` OK (svelte-check 0 errors), `pnpm lint` OK, `pnpm test`: 41 files, **853 passed, 2 skipped** (baseline 824 passed, 2 skipped).
- `node tools/rules-trace.mjs`: OK (16 règles, 122 scénarios).
- `node tools/selfplay.mjs --games 200`: 200 finished, 0 failed (level 1 unchanged).
- Playwright `force.spec.ts launch.spec.ts partie.spec.ts partie-complete.spec.ts`, both projects: **33 passed, 1 skipped, 0 failed** (the skip is partie-complete's own phone skip).
- frameClock invariant: no `.animate(` in apps/web/src/board outside frameClock.ts (untouched).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] launch.spec.ts counted every radio on the page**
- **Found during:** Task 1
- **Issue:** `page.getByRole("radio")` toHaveCount(4) and the 128 × 128 loop would now see the 15 strength options.
- **Fix:** both are scoped to the « Choisis ta couleur » radiogroup; the assertions themselves are unchanged.
- **Files modified:** apps/web/e2e/launch.spec.ts
- **Commit:** 82d438d

**2. [Rule 3 - Blocking] The bots' purity guard was not typechecked**
- **Found during:** Task 2
- **Issue:** packages/bots/tsconfig.json includes `src` only; the guard in `packages/bots/test` uses node: modules.
- **Fix:** `packages/bots/tsconfig.test.json` (types node, include test) and the typecheck script runs both, as the engine does.
- **Files modified:** packages/bots/tsconfig.test.json, packages/bots/package.json
- **Commit:** 64903cb

**3. [Rule 2 - Missing critical] Guard for the plan's prohibitions**
- **Found during:** Task 2
- **Issue:** the plan forbids a GameState or module-level memory in packages/bots/src, but the copied engine guard checked neither.
- **Fix:** the guard also refuses, in non-test files, the name GameState and module-level `let`/`var` or `new Map/Set/WeakMap/WeakSet`; its blindness check covers them.
- **Files modified:** packages/bots/test/purity.test.ts
- **Commit:** 64903cb

### Other notes

- The GameController level tests were written alongside the implementation rather than strictly before it (the bot and settings tests did go RED first).
- The property test compares the view's outcomes with the state's on every 10th 7-turn (the full board comparison runs on all 3 834); the file takes about 23 s.
- `launch.yourTeamLabel` and `launch.opponentsLabel` are no longer used by Launch.svelte; left in the catalogue.

## Known Stubs

Intentional, scheduled by the phase plans:
- packages/bots/src/thinker.ts: the exchange give at levels 2–5 is randomLegal's (plan 03-02 adds the give of D-09).
- packages/bots/src/thinker.ts: level 5 is the greedy T = 0 pick; `Budget` is accepted but unused (plan 03-04 adds the search).
- packages/bots/src/evaluate.ts: no risk or hand terms yet (plan 03-02).
- apps/web/src/ui/StrengthPicker.svelte: stacked form only, no option title; the launch screen scrolls on 1280 × 800 (plan 03-03 layouts).

## Threat Flags

None: no new network, auth or storage surface beyond the planned botLevels field (T-03-01, mitigated and tested).

## Self-Check: PASSED

- All created files exist; commits 82d438d and 64903cb are ancestors of HEAD.
