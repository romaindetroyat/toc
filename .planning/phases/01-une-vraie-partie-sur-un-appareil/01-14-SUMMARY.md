---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 14
subsystem: bots
tags: [bots, randomLegal, property-tests, fast-check, selfplay, invariants, vitest]

requires:
  - phase: 01-13
    provides: "nextSteps, normalizePlan, sevenPlans, applyPlan, legalActions({ sevenPlans: 'none' }), playability"
  - phase: 01-12
    provides: "legalActions, apply, IllegalActionError"
  - phase: 01-10
    provides: "newGame, viewFor, sfc32 rng (next)"
provides:
  - "@toc/bots workspace package: randomLegal(view, seat, rng) -> [Action, Rng], the level-1 bot, view-only"
  - "props/invariants.test.ts: engine invariants over 200 fixed-seed games driven by randomLegal for all four seats"
  - "tools/selfplay.mjs --games N [--seed S]: self-play harness measuring game length"
  - "Measured length of a random-bot game (10 000 games): mean 50.5 deals, max 133, mean 992 actions, max 2654"
affects: [01-15, 01-16, 02-rooms, bots-levels-2-to-5]

requirements-completed: [RULE-02, RULE-16, RULE-18]

actuals:
  tokens: 6800
  tasks: 2
  commits: 3
plan_head_before: c39209c2839b3dab3cf39197102500e71e6db4c1
plan_head_after: 99d54cf958d0325887e045490f1b8510bc5e1011

tech-stack:
  added: []
  patterns:
    - "A bot takes a PlayerView (kind 'view') and an Rng and returns [Action, Rng]: pure, no global random source, a GameState is a type error (ts-expect-error test)"
    - "The 7 is built by a random walk over nextSteps, never by listing sevenPlans (up to 32768 plans)"
    - "Heavy property checks (sampled legal actions, mutated actions) run on one step in five and on every 7; cheap ones (52 cards, exclusive cells) on every step"

key-files:
  created:
    - packages/bots/package.json
    - packages/bots/tsconfig.json
    - packages/bots/src/index.ts
    - packages/bots/src/randomLegal.ts
    - packages/bots/src/randomLegal.test.ts
    - packages/engine/test/props/invariants.test.ts
    - tools/selfplay.mjs
  modified:
    - pnpm-lock.yaml

key-decisions:
  - "randomLegal calls legalActions(view, seat, { sevenPlans: 'none' }) and adds the 7 through playability + a nextSteps random walk; consecutive picks of one pawn are merged with normalizePlan as they go"
  - "The invariants test imports the bot by relative path (../../../bots/src/index.ts) instead of adding @toc/bots as an engine dependency, so the engine package keeps no dependency on the bots"
  - "Game length is counted as dealsPlayed + 1 (the deal in which the game ends included)"

status: complete
completed: 2026-10-13
---

# Phase 1 Plan 14: L'ordinateur de niveau 1, les propriétés et des milliers de parties Summary

**`randomLegal` plays a uniformly random legal move from a PlayerView only (including a random-walk 7 split over `nextSteps`); the engine invariants hold over 200 fixed-seed games driven by four such bots, and 10 000 self-play games show a random game lasts about 50 deals and 990 actions.**

## Accomplishments

- `@toc/bots` (private, `exports "."` -> `./src/index.ts`, dependency `@toc/engine` workspace:*): `randomLegal(view: PlayerView, seat, rng): [Action, Rng]`. Exchange: a uniformly random card. Dead hand: the discard. Otherwise one playable card chosen uniformly (cards from `legalActions(..., { sevenPlans: 'none' })`, plus the 7 when `playability` says it is playable), then one of that card's actions uniformly; for the 7, repeatedly a random pawn among those `nextSteps` offers and a random step count until 7 steps are placed. The rng argument is never mutated and the new state is returned.
- `randomLegal.test.ts` (7 tests): every returned action applies over six whole games (give, move, exit, seven, discard all seen), cards come from the hand, 7 plans are complete (`isComplete`), the dead-hand discard is chosen exactly when it is the only legal action, determinism, rng not mutated, variety, and a `@ts-expect-error` check that a `GameState` is rejected by the type system (T-01-12).
- `props/invariants.test.ts` (fast-check, `seed: 20261015`, 200 games all played to `gameWon`, every seat driven by `randomLegal`): after every action the 52 cards are each in exactly one of talon / hands / discard / posed (RULE-02), no two pawns share a ring cell or a home slot; on one step in five and on every 7, two sampled legal actions apply and mutated actions (a card not held, a pawn the card does not offer, a swap pair not offered, a discard while cards are playable, a 7 summing to 6 or 8, a 7 moving a foreign pawn, the same action from the wrong seat) throw `IllegalActionError`; on boards with at most 3 movable pawns (own plus partner's, off the stable) every composition of 7 over them is tried and `applyPlan`'s verdict equals membership in `sevenPlans` after `normalizePlan` (merged and unmerged spellings), and the bot's own 7 is one of the listed plans; every deal ends within 60 actions (RULE-16); every game reaches `gameWon` within 5000 actions (RULE-18); replaying the recorded actions from the same seed gives identical JSON, and the state survives a JSON round trip. A second test asserts the run was not vacuous (200 wins, thousands of legal applies and refused mutations, 7 boards and plans checked).
- `tools/selfplay.mjs --games N [--seed S]`: four `randomLegal` bots per game, prints games, mean/median/max/min deals, mean/median/max actions, mean captures, wins per team and wall time; exits 1 if a game throws or exceeds 5000 actions (2 on bad arguments). It imports the TypeScript sources directly (Node type stripping).

## Self-play report (RESEARCH Open Question 4, Assumption A5)

`node tools/selfplay.mjs --games 10000` (seed 1), run once, output verbatim:

```
games: 10000 (10000 finished, 0 failed), seed 1
mean deals: 50.48
median deals: 49
max deals: 133
min deals: 16
mean actions: 991.8
median actions: 965
max actions: 2654
mean captures per game: 34.7
wins: jaune-vert 4957, bleu-rouge 5043
wall time: 570.9 s
exit 0
```

Reading: a game of four random bots lasts about 50 deals (the 5/4/4 cycle makes one reshuffle every 3 deals, so about 17 cycles) and about 990 actions; none of 10 000 games failed or came near the 5000-action cap (longest 2654). Random play therefore terminates reliably, and there is no sign of a bias between the two teams (49.6% / 50.4%). A smarter bot should finish sooner. About 17 captures per team per game. The 300-game verification run gave mean 51.4 deals, max 100.

## Task Commits

1. Task 1 RED, bot tests and package skeleton: `3a04e4c` (test)
2. Task 1 GREEN, `randomLegal` and lockfile: `e282ec4` (feat)
3. Task 2, invariants property test and self-play harness: `99d54cf` (test)

## Verification

- `pnpm install --frozen-lockfile`, `pnpm exec vitest run packages/engine packages/bots`: 11 files, 258 passed, 2 skipped (the alt scenarios R-09.9 and R-15.9), 0 failed, 0 todo; the invariants file takes about 30 s (render property file about 15 s)
- `pnpm typecheck` (including the `@ts-expect-error` type-level test) and `pnpm lint`: pass
- `node tools/selfplay.mjs --games 300`: exit 0, prints "max deals: 100"
- `git diff --stat pnpm-lock.yaml`: 6 insertions, only the `packages/bots` importer entry with `@toc/engine: link:../engine`; no external package added (T-01-SC)
- Acceptance greps: `grep -q "PlayerView" packages/bots/src/randomLegal.ts` and `nextSteps(` in the bot, `randomLegal` in invariants.test.ts and selfplay.mjs: all present

## Deviations from Plan

None - plan executed as written. Details settled during execution:

- The plan says "every action in legalActions ... applies (sampled)": two actions are sampled per checked step, and checked steps are one in five plus every 7 (the first version checked every step with 3 samples and took 77 s; this version takes about 30 s). The cheap invariants (cards, cells) are checked after every action.
- The seven agreement check is capped at two boards per game; it ran on enough boards to pass the non-vacuity assertions.
- The invariants test imports the bot by relative path rather than through a workspace dependency (see key-decisions).
- The RED commit for task 1 holds the tests and the package skeleton; the lockfile was committed with the implementation after `pnpm install` linked the package.

## Notes for the orchestrator and later plans

- `randomLegal` is the template for levels 2 to 5: same signature (`PlayerView`, seat, `Rng` -> `[Action, Rng]`), never call `legalActions` with the default `sevenPlans: 'all'` in a bot (110 ms and 32768 plans for one 7), build 7s with `nextSteps`.
- Bot level 1 is deliberately naive: it does not prefer captures, home entries or partner help. A random game is about 990 actions, which matters for plan 01-15's bot pacing (animation/think delays multiply by that when four bots play alone) and for any "watch a bot game" demo.
- Plan 01-15 must derive bot rng from the game state's seed stream or a separate seeded stream (not `Math.random`), as the harness does.

## Known Stubs

None.

## Threat Flags

None. T-01-12 (bot sees hidden cards) is mitigated by the `PlayerView` parameter type, with a type-level test, on top of the leak property of plan 01-13; T-01-SC holds (no external package, lockfile diff is the workspace entry only).

## Self-Check: PASSED

Created files exist (packages/bots/{package.json,tsconfig.json,src/index.ts,src/randomLegal.ts,src/randomLegal.test.ts}, packages/engine/test/props/invariants.test.ts, tools/selfplay.mjs); commits 3a04e4c, e282ec4 and 99d54cf are in the branch history; `git rev-list --count` from the base c39209c gives 3.
