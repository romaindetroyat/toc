---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 42
subsystem: engine
status: complete
tags: [rules, g16, seven, home-entry, gap-closure, uat-26]
requires:
  - "01-41 (phase gates green, the 112 rule pictures)"
provides:
  - "packages/engine/src/rules.ts: KNIGHT_MUST_ENTER (G16) in RuleSet and DEFAULT_RULES, read from state.rules"
  - "packages/engine/src/seven.ts: exported sevenMustEnter(board, seat), memoised per (board object, seat); the PlanFailure \"must-enter\"; applyPlan, isComplete, canPlaySeven, sevenPlans and nextSteps honour G16 with unchanged signatures; previewPlan never applies it"
  - "packages/engine/test/entry.test.ts: the G16 cases (Romain's 2 and 9, the 68/10 splits, the alone-on-the-ring 7, the safety board)"
  - "flags.test.ts « G16 KNIGHT_MUST_ENTER », props/invariants.test.ts G16 invariants and counters"
affects: ["01-43 (RULES.md G16 entry, scenarios and pictures, REQUIREMENTS RULE-15)"]
tech-stack:
  added: []
  patterns:
    - "A rule on the finished 7 plan is checked where remaining reaches 0 in completable(): the memo stays valid because its key holds every position"
    - "Goal search (sevenMustEnter) reuses the memoised existence search with the goal knight in the memo key"
key-files:
  created:
    - packages/engine/test/entry.test.ts
  modified:
    - packages/engine/src/rules.ts
    - packages/engine/src/seven.ts
    - packages/engine/test/flags.test.ts
    - packages/engine/test/props/invariants.test.ts
    - apps/web/src/game/turnUi.test.ts
    - apps/web/e2e/cartes-speciales.spec.ts
decisions:
  - "The duty is checked on positions: each knight of sevenMustEnter ends where it started or in its home (a forward-only knight that moved can never be back on its start cell). A duty knight eaten by its own side's 7 (only possible with G7 off) would make the plan refuse; no such board exists at the default rules"
  - "sevenMustEnter pre-filters the candidates to the controlled ring knights that reach their carré 16 within the first 6 steps (G14 any lap, progress 70 and over when G14 is off), then runs one goal search each"
  - "The duty is computed for the knights the seat controls at the start of the 7; partner knights taken over mid-plan (G12) carry no duty"
metrics:
  duration: "40 min"
  completed: 2026-10-15
  tasks: 2
  files: 7
estimate:
  tokens: 55000
  tasks: 2
actuals:
  tokens: 4720
  tasks: 2
  commits: 3
plan_head_before: 7b8731e589176ee00c71c5cff2e3ddef83d345d8
plan_head_after: cbe65b847ffb71ba086a54ae2ad1f6cfd6870bf2
---

# Phase 1 Plan 42: Règle G16, la carte qui peut faire rentrer un cheval le fait rentrer (moteur) Summary

**G16 is in the engine, switchable by KNIGHT_MUST_ENTER. A 7 whose split can leave a knight in its home either brings that knight home or leaves it where it stood. The knight may stop on its carré 16 and enter with a later step of the same 7. Every other card is unchanged, as Romain ruled card by card (« Avec le 9, il peut continuer son tour »). The rule never makes a 7 unplayable, and no app or bot source changed.**

## What was built

### Task 1 (tracer), 9af8599: the switch, sevenMustEnter and the G16-aware 7 search
- rules.ts:
  - `KNIGHT_MUST_ENTER: boolean = true`, with a doc comment in the G14/G15 format: Romain's words, « Oui, autorisé », and what false gives back (the rule of 2026-10-14);
  - added to RuleSet and DEFAULT_RULES;
  - the header says that G16 continues the numbering.
- seven.ts:
  - `Ctx` carries `mustEnter` and `start`, and `keepsDuty` checks a finished plan.
  - `completable()` runs that check, and the goal check, where `remaining` reaches 0. The goal knight is in the memo key.
  - `playMerged` refuses with `"must-enter"` after the last micro-move for applyPlan (and so isComplete and apply). previewPlan passes an empty duty.
  - `sevenMustEnter(board, seat)`:
    - returns [] when the switch is off;
    - otherwise filters the controlled ring knights near their carré 16, then runs one goal search per candidate (without G16);
    - is memoised in a WeakMap per board object and seat.
  - Every exported entry point fills the duty from the board (`newSearch` calls sevenMustEnter).
- entry.test.ts, cases ending in « (G16) »:
  - the 2 and the 9 on bleu0 at 70;
  - the 68/10 includes and excludes;
  - `[bleu0 2, bleu1 1, bleu0 4]`, which ends in home slot 3;
  - nextSteps offers bleu0 `[1 … 6]` (and bleu1 `[1, 2, 3, 4, 7]`);
  - `"must-enter"` and IllegalActionError;
  - previewPlan of `[bleu0 2]`;
  - bleu0 alone at 70, where the 7 goes round to 77.
- Tracer gate:
  - entry, scenarios, path, seven and flags: 225 passed, 2 skipped;
  - typecheck and lint pass;
  - selfplay: 200/200 games finished.
  - The gate passed, so the plan went on.

### Task 2, 10ce63e: the switch, the safety and the 200-game properties
- flags.test.ts « G16 KNIGHT_MUST_ENTER »:
  - true: `[bleu0 7]` and `[bleu0 2, bleu1 5]` are refused with `"must-enter"`, and nextSteps offers bleu0 `[1 … 6]`;
  - false: both are accepted again (bleu0 ends at 75 and at 70), and nextSteps offers `[1 … 7]`.
- The safety. When the goal searches find a duty, sevenMustEnter checks that the G16 search can still complete a 7 from the start; if it cannot, it returns []. A short search over the bleu boards near the home found 18 such boards out of 3198. The unit case uses `["S", {h:3}, {p:69}, {p:70}]`:
  - each knight alone can be brought home, but both would need slot 2;
  - sevenMustEnter is [] there, canPlaySeven is true, and sevenPlans is identical with and without G16.
  - Disabling the safety makes this case fail (checked, then restored).
- props/invariants.test.ts checks two G16 invariants on every board holding a 7:
  - canPlaySeven with G16 equals canPlaySeven without it;
  - every applied 7 leaves in its home each knight it moved that sevenMustEnter listed before the move.

## Measurements

| What | Before (7b8731e) | After (10ce63e) |
|------|------------------|-----------------|
| `node tools/selfplay.mjs --games 200` | 200 finished, 0 failed, wall 11.0 s (mean 923.7 actions, 46.98 deals) | 200 finished, 0 failed, wall 10.1 s (11.1 s on the Task 1 run; mean 840.5 actions, 42.87 deals) |
| props/invariants.test.ts (200 games) | 28.6 s | about 31 s |
| vitest | 752 passed, 2 skipped | 763 passed, 2 skipped (+9 entry, +2 flags) |
| rules-trace | OK (16 règles, 112 scénarios) | OK (16 règles, 112 scénarios), pictures unchanged |

The wall time did not grow, so sevenMustEnter needed no profiling. Games are about 9 % shorter: knights stop passing their homes on a 7.

G16 counters on the 200 property games (seed 20261015):
- sevensWithDuty: 820 sevens played while a duty was listed;
- dutyKnightsMoved: 616 of those moved a duty knight, and each one entered;
- dutySafety: 4 boards used the safety;
- botSevens: 9694 sevens in total.

The test asserts that all three G16 counters are above 0.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green, vitest 763 passed, 2 skipped (37 files).
- `node tools/selfplay.mjs --games 200`: 200 finished, 0 failed.
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 112 scénarios) », `git status` clean afterwards.
- Playwright, full suite (the plan names none, but the 7's offers changed):
  - first run: 331 passed, 83 skipped, 2 failed (the same case on phone and desktop, deviation 4);
  - after cbe65b8: **333 passed, 83 skipped, 0 failed** (5.7 min).
- The frameClock invariant holds: there is no `.animate(` in apps/web/src/board outside frameClock.ts.
- The acceptance greps pass: KNIGHT_MUST_ENTER, `export function sevenMustEnter`, `"must-enter"`, G16 in invariants, « G16 KNIGHT_MUST_ENTER » in flags.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] apps/web/src/game/turnUi.test.ts expected the pre-G16 offer**
- **Found during:** Task 2 (`pnpm test`)
- **Issue:** the case « refuses a number of steps that would make the 7 impossible to finish » puts bleu0 at 68 with home slots 1 to 3 taken and expected the offers `[3, 7]`. The 7 would send bleu0 past its home while `[bleu0 3, rouge0 4]` brings it home, so G16 now offers `[3]` only.
- **Fix:** the expectation is `[3]`, and the comment explains G16. The rest of the case (refused 1 and 9, then 3 accepted) is unchanged.
- **Effect on the acceptance criterion:** `git diff --stat 7b8731e..HEAD -- apps/web/src packages/bots/src` lists this one test file (4 insertions, 2 deletions). No production caller under apps/web/src or packages/bots/src changed.
- **Commit:** 10ce63e

**4. [Rule 3 - Blocking] apps/web/e2e/cartes-speciales.spec.ts expected the « 7 pas » chip on**
- **Found during:** the end-of-plan Playwright run
- **Issue:** « le 7 : un nombre de pas qui empêcherait de finir est grisé et s'explique au toucher » uses the same position as the turnUi case and expected the « 7 pas » chip to be enabled.
- **Fix:** the chip is expected greyed (`aria-disabled="true"`), and the comment explains G16. The rest of the case is unchanged.
- **Commit:** cbe65b8 (outside the plan's two tasks, test only)

**2. [Order] The safety landed with Task 1**
- sevenMustEnter was written with its safety in Task 1, because the plan's own definition (the 7 is never made unplayable) belongs to the same function. Task 2's RED for the safety was shown by disabling the safety, which made the unit case fail, and then restoring it. The property counters were added afterwards and pass.

**3. [Test expectation] bleu1's offers in the 68/10 position**
- The plan lists only bleu0's offers. My first draft of the test expected bleu1 `[1 … 7]`; G16 gives `[1, 2, 3, 4, 7]`, because 5 or 6 steps on bleu1 leave bleu0 1 or 2 steps that stop it short of its home. The test asserts the correct offer.

## Notes for Romain (01-43 and the re-test)
- A 7 that can split so that a knight enters must bring it in or leave it alone. That knight may stop on its carré 16 and enter with a later step of the same 7. The UI therefore offers fewer step counts on that knight: in the turnUi case, 3 only instead of 3 or 7.
- When two knights could each enter but not both (for example, both would need the same slot), G16 is dropped for that 7, which plays as before. This happened on 4 boards in 200 games. It is the planner's reading, « à confirmer par Romain ».

## Self-Check: PASSED

- Files exist: packages/engine/test/entry.test.ts, packages/engine/src/seven.ts (sevenMustEnter, "must-enter"), packages/engine/src/rules.ts (KNIGHT_MUST_ENTER).
- Commits 9af8599, 10ce63e and cbe65b8 are ancestors of HEAD; `git rev-list --count 7b8731e..HEAD` = 3.
