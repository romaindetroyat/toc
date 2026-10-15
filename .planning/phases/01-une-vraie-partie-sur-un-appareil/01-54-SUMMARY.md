---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 54
subsystem: testing
status: complete
tags: [verification, uat, recette-4, gap-closure, comments, sound-deferral]
requires:
  - "01-42 to 01-51 (done); 01-52 and 01-53 deferred by Romain on 2026-10-15"
provides:
  - "Every gate green after round 3, with counts (below)"
  - "The three stale seat-index comments of 01-41 fixed (comment-only)"
  - "01-UAT.md: tests 31 to 43 pending, tests 9 and 19 with the full-height phone sizes, total 43 / pending 28"
  - "The deferral of the neighs, card sounds and end-of-game sounds recorded in 01-CONTEXT.md, 01-UAT.md and deferred-items.md"
affects: ["Romain's recette 4 (01-UAT.md tests 8 to 22 and 31 to 43)", "phase 1 closure"]
actuals:
  tokens: 4400
  tasks: 2
  commits: 2
plan_head_before: 56a97046197cf500147789de04a739b8f3fa2366
plan_head_after: 58d0b359391f04e3434cd667db8446806f70a755
tech-stack:
  added: []
  patterns: []
key-files:
  created:
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-54-SUMMARY.md
  modified:
    - apps/web/src/game/session.svelte.ts
    - apps/web/src/game/director.ts
    - apps/web/src/board/geometry.ts
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/deferred-items.md
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UAT.md
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-CONTEXT.md
key-decisions:
  - "Plans 01-52 and 01-53 are deferred by Romain (« OK, continue, laisse les sons de côté sauf les sabots des chevaux, et montre moi quand c'est prêt. »): neighs, card sounds and « Victoire »/« Défaite » are notes in the UAT, never pending tests; only the hooves keep a re-test (37) and a reading to confirm (42)"
  - "Test count unchanged from the plan (43, pending 28): no entry of 31 to 43 was only about the deferred sounds, so each was kept and narrowed to the hooves where needed"
requirements-completed: [RULE-15, RULE-20, PLAY-02, FX-01, FX-03, FX-05]
metrics:
  duration: "about 25 min"
  completed: 2026-10-15
---

# Phase 1 Plan 54: Toutes les vérifications après la recette 3, puis la recette 4 de Romain Summary

**Every automated gate passes after round 3 (vitest 804 passed / 2 skipped, rules-trace 16 règles / 118 scénarios, selfplay 200/200, Playwright 353 passed / 89 skipped / 0 failed on both projects). The three stale seat-index comments are fixed. 01-UAT.md now holds Romain's recette 4: re-tests 31 to 38 and readings to confirm 39 to 43, all pending. Following Romain's « laisse les sons de côté sauf les sabots des chevaux », the neighs, the card sounds and the end-of-game sounds are recorded as deferred, not as tests.**

Phase 1 n’est pas marquée terminée tant que 01-UAT.md n’a pas enregistré la recette 4 de Romain (tests 31 à 43, et les tests 8 à 22 encore en attente).

## What was built

### Task 1 (tracer), f742b8c: every gate, and the three stale comments

- `session.svelte.ts` (`Session.k`) and `director.ts` (`quarterTurns`): « The human's seat index (quarterTurnsFor): which colour sits at the bottom of the galet. » `geometry.ts` (`facingFor`): the delta is read on the galet as the human sees it; the board never turns. Comments only.
- `deferred-items.md`: « Fixed in 01-54 » under « Found during 01-41 », and a new section « Deferred by Romain (2026-10-15) » for 01-52 and 01-53.

### Task 2, 58d0b35: la recette 4 dans 01-UAT.md

- Tests 31 to 38, one re-test per remark of round 3. Tests 39 to 43 are « À confirmer (lecture du planificateur) » entries. Each quotes 01-CONTEXT.md « Recette 3 de Romain » and never puts words in Romain's mouth.
- Tests 9 and 19: new `expected:` lines with the full-height phone layout and the 01-48 size table (724, 630, 547, 448, 360 px; iPhone 13 computed ≈ 594 px in Safari, ≈ 630 px installed). Their notes and `result: [pending]` are kept.
- Summary: total 43, passed 1, issues 14, pending 28, skipped 0, blocked 0. Status partial. Current Test 8, its expected line now copied in full. The Gaps section and tests 1 to 30 are unchanged, apart from the expected lines of 9 and 19.
- 01-CONTEXT.md, « Recette 3 de Romain »: the deferral is recorded under « Les sons à retravailler », with a sentence on the D-22/D-23 line and in the section's intro.

## Gates (counts)

| Gate | Result |
|------|--------|
| `pnpm typecheck` | 0 errors (svelte-check: 283 files, 0 errors, 0 warnings) |
| `pnpm lint` | 147 files, no fixes |
| `pnpm test` | 38 files, **804 passed, 2 skipped** (= baseline) |
| Named guards (scenarios, path, seven, flags, entry, props/invariants, frameClock) | 7 files, **239 passed, 2 skipped** |
| G14 / G15 / G16 by name | R-02.3, R-08.7, R-10.6, R-10.7, R-10.14, R-13.12, R-13.16 to R-13.27, R-15.10, the G14/G15/G16 flag cases and the entry.test.ts G16 cases: **41 passed, 0 failed**. The property test (200 random games, including the G16 invariants: G16 never changes whether a 7 is playable, every applied 7 that moves a knight of the duty brings it home): 3 passed |
| `node tools/rules-trace.mjs --images` | « rules-trace: OK (16 règles, 118 scénarios) », images unchanged (clean tree) |
| `node tools/selfplay.mjs --games 200` | 200 finished, 0 failed (seed 1), mean 42.87 deals, wins jaune-vert 109 / bleu-rouge 91, **wall time 11.6 s** |
| animateNow | animator.ts, cardFx.ts and Particles.svelte all start through `animateNow()` (3/3); no `.animate(` in `apps/web/src/board` outside `frameClock.ts` |
| Stale comments | no « quarter turns of the board » left in `apps/web/src` |
| Playwright, full suite | **353 passed, 89 skipped, 0 failed, 0 flaky** in 6.4 min. Phone: 136 passed, 85 skipped. Desktop: 217 passed, 4 skipped. The skips are the project-conditional ones (the baseline after 01-50 was 349 / 89; 01-51 added its sound-page specs) |

Captures regenerated by the run: `apps/web/test-results/galet-emulation-*.png` (01-48), `fin-victoire-*.png` and `fin-defaite-*.png` (01-50).

## Romain's re-test (recette 4), the new entries

- 31. Re-test 23 : le son en mode silencieux (the hooves, and today's neighs and card sounds, with the switch on silent; note: their new versions are deferred)
- 32. Re-test 24 : le plateau sur toute la hauteur (≈ 594 px in Safari, ≈ 630 px installed)
- 33. Re-test 25 : les cavaliers tournés vers leur camp
- 34. Re-test 26 : la règle G16
- 35. Re-test 27 : un seul cheval, directement « Jouer »
- 36. Re-test 28 : la donne un peu moins rapide
- 37. Re-test 29 : la page des sons à choix, pour les sabots (note: neighs and cards deferred, only version A)
- 38. Re-test 30 : la planche de fin de partie (note: « Victoire »/« Défaite » sounds deferred)
- 39. À confirmer : la règle G16 avec le 7
- 40. À confirmer : la disposition du téléphone tenu en largeur
- 41. À confirmer : le 7 rempli tout seul, et Échap
- 42. À confirmer : le choix des sabots (note: the neighs, cards and end sounds part of the reading is deferred)
- 43. À confirmer : la planche de fin de partie (Caveat 44 px, a typography exception)

## Deviations from Plan

1. **[Romain's instruction, 2026-10-15] Sounds other than the hooves deferred.** The plan depends on 01-53 and wrote tests 31, 37 and 42 for neighs, card sounds and « Victoire »/« Défaite ». Romain wrote « OK, continue, laisse les sons de côté sauf les sabots des chevaux, et montre moi quand c'est prêt. », so 01-52 and 01-53 were not executed. The checks never expected their work. Test 37 and the reading 42 now cover the hooves only. Notes on tests 31, 37, 38 and 42 quote Romain's deferral, and no pending test asks him to judge the deferred sounds. The deferral is also in 01-CONTEXT.md (Recette 3) and deferred-items.md. 01-CONTEXT.md is outside the plan's `files_modified`, and was edited at the orchestrator's request. The counts stay those of the plan (43 tests, 28 pending), because every entry still has something to check.
2. **[Rule 1, documentation] Current Test expected line.** The Current Test block (test 8) carried a truncated copy of test 8's expected line, missing the « Lequel ? » sentence. It now holds the full line.

No gate failed, so no earlier plan needed a fix.

## Observations (not fixed, out of scope)

- Tests 17 and 18 still describe the old compact bar of 01-37, which 01-47/01-48 replaced on the phone. The plan forbids changing tests 1 to 30 apart from 9 and 19, so they are untouched. Romain's answer to test 40 (the new layout) supersedes them; the next UAT pass may mark them as replaced.
- `apps/web/src/ui/HandFan.svelte` (lines 117 and 147) starts two Web Animations directly: the hand's flip-open after the deal and the partner's card joining the hand. They are UI effects, not Director-led, and outside `apps/web/src/board`, so the animateNow rule does not cover them.
- `updated:` in the UAT frontmatter was 12:00Z, a time still in the future when the plan ran. It is now the real time of the edit (08:06Z).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: apps/web/src/game/session.svelte.ts, apps/web/src/game/director.ts, apps/web/src/board/geometry.ts, 01-UAT.md, 01-CONTEXT.md, deferred-items.md
- FOUND: f742b8c, 58d0b35 (ancestors of HEAD)
- 01-UAT.md: `### 43.` present, no `### 44.`, `total: 43`, `pending: 28`, gaps G-01-23 to G-01-30 present (one each)
