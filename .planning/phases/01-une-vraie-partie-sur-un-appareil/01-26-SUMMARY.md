---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 26
subsystem: engine-rules
tags: [engine, rules, seven, captures, g15, scenarios, property-test, rules-md, gap-closure, uat-7]
status: complete

requires:
  - phase: 01-25
    provides: "G14 (home entry without the full lap), rules-trace at 16 règles, 110 scénarios"
provides:
  - "RuleSet switch SEVEN_EATS_PASSED_PARTNER (false, G15 of 2026-10-14) in packages/engine/src/rules.ts"
  - "ringStretch() captures in passing only knights of the other team (teamOf), unless SEVEN_EATS_PASSED_PARTNER"
  - "Scenarios R-10.6 inverted, R-10.7 with an opponent (vert0), new R-10.14 and R-15.10 with their pictures"
  - "Property test: no knight of the mover's team is captured before the last cell of a move; counter seen.teamPassedBySeven"
  - "RULES.md G15 entry with Romain's words; R-07, R-10, R-11, R-15 texts; RULE-11, PROJECT.md and 01-CONTEXT.md D-04 updated"
affects: [phase-01-uat, 01-27, 01-28]

requirements-completed: [RULE-11, RULE-10, RULE-12, RULE-17, RULE-20]

actuals:
  tokens: 5400
  tasks: 3
  commits: 3
plan_head_before: e7537f438e14d09520008a96d290217026c7e6cb
plan_head_after: cd0cd50111f6319b8404f435af72cc58a6e00620

tech-stack:
  added: []
  patterns:
    - "A rule change by Romain after validation is a new numbered RuleSet switch (G15), documented in RULES.md « Décisions de Romain » with his words; the old rule stays playable behind the switch"
    - "Passing captures spare the team of the knight that moves (pawnColor(id)), so a finished player moving his partner's knights spares the whole team without reading G7"

key-files:
  created:
    - docs/regles/R-10.14.webp
    - docs/regles/R-15.10.webp
  modified:
    - packages/engine/src/rules.ts
    - packages/engine/src/path.ts
    - packages/engine/scenarios/valet-sept.ts
    - packages/engine/scenarios/fin.ts
    - packages/engine/test/seven.test.ts
    - packages/engine/test/path.test.ts
    - packages/engine/test/flags.test.ts
    - packages/engine/test/props/invariants.test.ts
    - apps/web/src/game/turnUi.test.ts
    - RULES.md
    - .planning/REQUIREMENTS.md
    - .planning/PROJECT.md
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-CONTEXT.md
    - docs/regles/R-10.6.webp
    - docs/regles/R-10.7.webp

key-decisions:
  - "G15 (Romain, 2026-10-14, UAT test 7): the 7 eats the opponent knights it passes, passes the knights of its own team (own and partner's) without eating them, and eats the partner only when a step stops on him (mandatory). Switch SEVEN_EATS_PASSED_PARTNER = false; true plays the rule of 2026-10-13 (Q23)"
  - "The passing rule lives only in ringStretch() (path.ts); seven.ts, moves.ts, the bots and the web app inherit it through engine events"

duration: 25min
completed: 2026-10-14
---

# Phase 1 Plan 26: Le 7 dépasse le partenaire sans le manger (G15) Summary

**The 7 now passes the partner's knights without eating them: ringStretch() only eats knights of the other team in passing (switch SEVEN_EATS_PASSED_PARTNER, G15). A step that stops on a partner still eats him. 4 scenarios and pictures, plus seven, path, flags, property and turnUi tests, back the change, and RULES.md, RULE-11, PROJECT.md and CONTEXT.md record Romain's decision.**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-10-14
- **Tasks:** 3/3
- **Files modified:** 17 (13 text files, 4 pictures)

## Accomplishments

- `SEVEN_EATS_PASSED_PARTNER: boolean = false` in rules.ts: constant with the G15 doc comment, RuleSet field and DEFAULT_RULES entry right after ENTRY_WITHOUT_FULL_LAP. The header sentence now names G14 and G15.
- path.ts: ringStretch() computes the mover's team once (`teamOf(pawnColor(id))`). It eats a passed knight only when `opts.capturePassed`, the knight is not own, and either `board.rules.SEVEN_EATS_PASSED_PARTNER` is on or the knight belongs to the other team. Landing and protection are unchanged. The WalkOpts doc comment and the file header were updated.
- Scenarios: R-10.6 « Le 7 dépasse le pion du partenaire sans le manger » (rouge0 stays at 45). R-10.7 eats jaune0 at step 2 and vert0 at step 5. New R-10.14 « Le 7 qui s’arrête sur le pion du partenaire le mange » (rouge0 at 48, atStep 6). New R-15.10 « Quand j’ai fini, le 7 dépasse les pions de mon partenaire sans les manger ».
- Tests:
  - seven.test.ts: the partner is passed and the partner it stops on is eaten.
  - path.test.ts: vert0 and jaune0 are eaten, rouge0 is passed. With the switch on, rouge0 is eaten too.
  - flags.test.ts: new describe « G15 SEVEN_EATS_PASSED_PARTNER » covering both values, landing, and the finished player with G7 true and G7 false. With G7 false the plan is still accepted, and rouge1 is spared by default and eaten when the switch is on.
  - invariants.test.ts: team-capture check after every action. The turnUi preview test proves the assistant shows exactly previewPlan's captures.
- Property test (200 games, seed 20261015 and GAMES unchanged). Recorded values:
  - **seen.teamPassedBySeven = 677**: 7 actions that passed a partner-colour knight which stayed on its cell.
  - seen.entries = 2763 and seen.entriesWithoutLap = 170. These were 2751 and 178 after 01-25; the games differ now that partners survive the 7.
  - Mutation check: with the constant temporarily set to true, the property test failed with « jaune0 ate vert0 of its own team in passing (step 0 of 6) ». The constant was put back before any commit.
- RULES.md:
  - R-10 rule text and edge case, R-10.6 title, R-10.14 line.
  - R-07 edge case, R-11 rule text and first edge case.
  - R-15 edge case and R-15.10 line.
  - « Décisions de Romain » G15 entry with Romain's words, the G11 entry, and the Q23 line in « Décidé ».
- Other documents: REQUIREMENTS.md RULE-11 (still [x], Complete) and its footer. PROJECT.md 7 bullet and Key Decisions row. 01-CONTEXT.md D-04 revision note for test 7.

## Task Commits

1. **Task 1 (tracer): G15 switch, ringStretch(), R-10.6/R-10.7/R-10.14, seven/path tests, RULES.md R-10 rule text** - `daca87a` (feat)
2. **Task 2: R-15.10, G15 flags describe, property team-capture check, turnUi preview test, RULES.md edge cases** - `3412d5a` (test)
3. **Task 3: G15 in « Décisions de Romain », RULE-11, PROJECT.md, CONTEXT.md; pictures redrawn** - `cd0cd50` (docs)

Tracer gate: the Task 1 `<verify>` passed before Task 2 started (engine vitest green, `rules-trace: OK (16 règles, 111 scénarios)`), and both acceptance one-liners exited 0.

## Verification

- `pnpm exec vitest run packages/engine apps/web/src/game/turnUi.test.ts`: 11 files passed (361 tests, 2 skipped: the pre-existing "alt" scenarios R-09.9 and R-15.9).
- `node tools/render-scenarios.mjs`: 112 images. Only R-10.6 and R-10.7 changed; R-10.14 and R-15.10 were added.
- `node tools/rules-trace.mjs --images`: `rules-trace: OK (16 règles, 112 scénarios)`.
- `pnpm typecheck && pnpm lint && pnpm test`: exit 0; 34 files, 656 passed, 2 skipped.
- `pnpm --filter @toc/web exec playwright test e2e/cartes-speciales.spec.ts e2e/animations.spec.ts e2e/partie-complete.spec.ts --project=desktop`: 38 passed. The first run had 1 timing failure, described under Deviations.
- Acceptance one-liners all exit 0: R-10.6 passes the partner, R-10.14 lands on the partner, finished player with G7 false. `grep -c SEVEN_EATS_PASSED_PARTNER rules.ts` = 3. The Task 3 greps and file tests pass. Before the Task 2 commit, `git status --porcelain -- apps/web/src` listed only turnUi.test.ts.
- Pictures checked by eye. R-10.6: on the right half the red A is still on the ring. R-10.14: on the right half the red A is back in its stable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test followed the old rule] G11 flags test « false: ordinary cards also eat what they pass »**
- **Found during:** Task 1 (engine vitest run)
- **Issue:** This test (G11 switched off) used the partner rouge0 as the passed knight and expected it to be eaten. G15 covers passing captures by ordinary cards when G11 is off too (the plan's G15 definition says so), so the test failed.
- **Fix:** The test was not relaxed but extended. jaune0 (opponent, cell 9) is now added next to rouge0 (partner, cell 8). With G11 off, the 6 eats jaune0 and passes rouge0. A new case with SEVEN_EATS_PASSED_PARTNER on expects both to be eaten.
- **Files modified:** packages/engine/test/flags.test.ts. This file belongs to Task 2 in the plan; the change went into the Task 1 commit to keep that commit green.
- **Commit:** daca87a

**2. [Rule 2 - Stronger check] Property test also checks the capturer**
- **Found during:** Task 2
- **Issue:** The plan's check compares atStep with the latest movement path but does not say whose path it is.
- **Fix:** checkTeamCaptures() also asserts that `pawnCaptured.by` is the knight of the latest movement event, so atStep is compared with the right path.
- **Files modified:** packages/engine/test/props/invariants.test.ts
- **Commit:** 3412d5a

**3. Playwright timing flake (not fixed: out of scope, not caused by this plan)**
- On the first run, `animations.spec.ts:782` (reduced motion, a Queen move with no 7 and no capture) measured the knight starting 83 ms after the card ended, against 60 ± 12. It passed 3 times out of 3 with `--repeat-each=3`, and the whole set then passed (38/38). This is load-sensitive timing on a path this plan does not touch. The test was not changed.

**4. Small additions**
- R-15.10 lists its events (`cardPlayed`, `pawnMoved`, `turn`) so the fixture also checks that nothing is captured at the event level.
- The turnUi test also compares the victims shown in the preview with the pawnCaptured events of previewPlan, for both positions.
- The flags G7-true case runs with both G15 values: rouge1 is « own » there, so it is never eaten in passing.

## Known Stubs

None.

## Threat Flags

None. T-01-35 is mitigated: the passing rule stays in ringStretch() only, and the property test now also checks that no team knight is captured before the last cell of a move, alongside the existing generator = validator check for the 7. No package was added (T-01-SC).

## Human Check Pending (backstop)

Romain needs to re-read RULES.md R-07, R-10, R-11, R-15 and the G15 entry of « Décisions de Romain », and look at docs/regles/R-10.6.webp, R-10.7.webp, R-10.14.webp and R-15.10.webp, to confirm they say what he decided on 2026-10-14.

## Self-Check: PASSED

- docs/regles/R-10.14.webp and docs/regles/R-15.10.webp exist, as do all 15 modified files.
- Commits daca87a, 3412d5a, cd0cd50 are ancestors of HEAD.
