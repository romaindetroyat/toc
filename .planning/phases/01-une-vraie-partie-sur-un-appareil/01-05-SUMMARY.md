---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 05
subsystem: testing
tags: [rules, scenarios, fixtures, traceability, sharp, webp, markdown]

requires:
  - phase: 01-01
    provides: "composeBoard(size), LAYOUT/placeXY calibrated cell centres, topology (ringIndex, EXIT)"
  - phase: 01-03
    provides: "Scenario type, RULES.md R-01 to R-08, fixtures r01-r08, tools/rules-trace.mjs with --images"
provides:
  - "RULES.md complete: R-01 to R-16 in French, « Points à valider » (G1 to G13, Q7, Q22) and « Décidé » with sources"
  - "68 new typed scenario fixtures (valet-sept.ts r09-r10, prises-maison.ts r11-r13, fin.ts r14-r16): 103 in total"
  - "tools/render-scenarios.mjs: before/after picture of every scenario on the real board"
  - "docs/regles/R-NN.k.webp (103 pictures) linked under each scenario line of RULES.md"
  - "Scenario.expect.capturedAtStep and the « alt » flag for alternative values of open points"
affects: [01-07, 01-10, 01-12, 01-13, phase-2]

requirements-completed: []

actuals:
  tokens: 21400
  tasks: 2
  commits: 2
plan_head_before: cae7a8413213cd0beeba29bb09f17e7adfa60d91
plan_head_after: 6b7c715237b8fa21ccbde78c06d8fea92cff5d18

tech-stack:
  added: []
  patterns:
    - "Alternative values of an open point are fixtures flagged « alt »: the engine tests skip them unless Romain picks that value"
    - "Pictures are generated from the fixtures (never hand-drawn), so a rule change = edit fixture, rerun render-scenarios"
    - "Image links sit as indented continuation lines under each scenario bullet, which rules-trace ignores"

key-files:
  created:
    - packages/engine/scenarios/valet-sept.ts
    - packages/engine/scenarios/prises-maison.ts
    - packages/engine/scenarios/fin.ts
    - tools/render-scenarios.mjs
    - docs/regles/ (103 webp pictures)
  modified:
    - RULES.md
    - packages/engine/scenarios/index.ts
    - packages/engine/src/types.ts

key-decisions:
  - "The plan's G11 (a 7 that brings the fourth pawn home mid-plan) is numbered G12, because plan 01-03 had already used G11 for « ordinary cards pass over other pawns »"
  - "Settled SUMMARY questions (Q6, Q8, Q13, Q15, Q20 and others) lose their « à valider » marker in R-04 to R-06 and are listed under « Décidé » with their requirement"
  - "G13 added: a player without cards is skipped until the next deal (default found in R-05, never listed before)"
  - "Valet with only a protected target reports jack-no-target (SUMMARY Q12 default), not blocked-protected"

patterns-established:
  - "Scenario pictures: left = before, right = after (or the same position with action pawns ringed white, allowed moves green, refused moves red)"

duration: 20min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 05: Les règles R-09 à R-16, les points à valider et les images Summary

**RULES.md is complete (16 rules, 103 scenarios, « Points à valider » and « Décidé »), every scenario is typed data, and each one is drawn before/after on Romain's real board; `rules-trace --images` passes.**

## Performance

- **Duration:** about 20 min
- **Completed:** 2026-10-13T15:37Z
- **Tasks:** 2
- **Files modified:** 8 plus 103 generated pictures

## Accomplishments

- R-09 Valet, R-10 le 7, R-11 prise, R-12 case de sortie protégée, R-13 entrée dans la maison, R-14 main injouable, R-15 joueur qui a fini and R-16 fin de partie written in French with Règle, Cas limites and Scénarios. D-01, D-02, D-03 and every D-04 item are stated as decided; every other default carries « à valider ».
- 68 new fixtures (R-09: 9, R-10: 13, R-11: 4, R-12: 10, R-13: 15, R-14: 4, R-15: 9, R-16: 4), far above the 55 required in total and covering the RESEARCH minimum inventory. Arithmetic checked by a throwaway script (no two pawns on the same cell or home slot in any before/after).
- `tools/render-scenarios.mjs` draws the 103 pictures (1280x640, webp q70) over `composeBoard(640)`; pawns are 18 px discs in the seat colour with the letter A to D.
- RULES.md ends with « Points à valider » and « Décidé »; the trace gate (`--images`) passes for 16 rules and 103 scenarios.

## Task Commits

1. **Task 1: Les règles R-09 à R-16, les points à valider et ce qui est déjà décidé** - `8a8a154` (feat)
2. **Task 2: Chaque scénario dessiné sur le vrai plateau** - `6b7c715` (feat)

## Points à valider (for plan 01-07, Romain decides)

Each has a proposed default, an alternative, and the rules and scenarios it touches.

| # | Question | Default | Alternative | Affects |
|---|----------|---------|-------------|---------|
| G1 | Progression of a pawn after a Valet swap | position-derived, (cell − EXIT) mod 72, a lap beyond the first is lost | keeps its laps | R-02, R-09, R-13; R-09.1, 09.2, 09.8 (default), 09.9 (alt), R-15.4 |
| G2 | Entry when a home pawn would be jumped | pawn continues a lap (like an occupied target) | move forbidden | R-13; R-13.7 |
| G3 | Pawn on its own exit after an extra lap | protected | protection only on the first pass | R-12; R-12.9 |
| G4 | Protected pawn blocks its own team-mates of the same colour | yes | own pawns may pass | R-08, R-12; R-08.4, 08.5, R-12.10 |
| G5 | Same pawn twice in one 7 plan | yes, consecutive steps merge | once per 7 | R-10; R-10.13 |
| G6 | Valet with my own protected pawn on my exit | not usable | usable | R-09; R-09.6 |
| G7 | Finished player: partner pawns are « own » for Valet and captures | yes, Valet swaps a partner pawn with an opponent | finished player cannot play the Valet | R-09, R-15; R-15.4, 15.6 |
| G8 | Exchange simultaneity | all four choose, then cross together | each pair exchanges when both chose | R-04; R-04.1, 04.2 |
| G9 | Who starts each deal, when the dealer changes | seat after dealer starts each deal, dealer changes per 52-card pack | dealer changes every deal | R-03; R-03.1 to 03.4 |
| G10 | Which card moves a pawn that is not the player's | only the Valet | another card could | R-07, R-09; R-07.3 |
| G11 | Ordinary cards passing over pawns | pass freely, only the 7 eats on the way (found in plan 01-03) | a pawn cannot jump another | R-07, R-10; R-07.5 |
| G12 | A 7 that brings my last pawn home mid-plan (the plan's « G11 », renumbered) | remaining steps may use the partner's pawns | the 7 uses only pawns controlled at the start of the turn, otherwise unplayable | R-10, R-15; R-15.8 (default), R-15.9 (alt) |
| G13 | Player with no cards is skipped until the next deal (new, from R-05) | skipped | keeps the turn but passes automatically (same result, extra display beat) | R-05, R-14; R-05.3, R-14.4 |
| Q7 | Does the exchanged card count in the 5-card deal | counted before the exchange (hand size unchanged anyway) | none in practice | R-04; R-04.4 |
| Q22 | Disconnect pause during exchange, dead-hand pose and bot turns | yes, all phases | only during play | phase 2 only, no phase 1 scenario |

« Décidé » records D-01..D-04, the three decided-differently items (Q10 → RULE-09, Q21 → D-20, Q29 → D-05) and Q6, Q8, Q9, Q11, Q12, Q13, Q14, Q15, Q16, Q17, Q18, Q20, Q23, Q24, Q25 with their sources.

## Files Created/Modified

- `RULES.md` - R-09 to R-16, « Points à valider », « Décidé », image links; settled Q markers in R-04 to R-06 aligned; header updated
- `packages/engine/scenarios/valet-sept.ts` - r09 (9) and r10 (13)
- `packages/engine/scenarios/prises-maison.ts` - r11 (4), r12 (10), r13 (15)
- `packages/engine/scenarios/fin.ts` - r14 (4), r15 (9), r16 (4)
- `packages/engine/scenarios/index.ts` - aggregates the three new files
- `packages/engine/src/types.ts` - `expect.capturedAtStep`, doc for the « alt » flag
- `tools/render-scenarios.mjs` - picture generator
- `docs/regles/*.webp` - 103 generated pictures

## Decisions Made

- Alternative values are written as fixtures with the `alt` flag (R-09.9, R-15.9) so Romain sees both sides; plan 01-10 must skip `alt` fixtures unless his answer selects them.
- Valet with only protected or absent targets reports `jack-no-target`, in line with the SUMMARY Q12 default; the RESEARCH derivation rule would have given `blocked-protected`, so plan 01-10 must follow the fixtures, not that derivation, for the Valet.
- Events listed in R-15.8, R-16.x, R-14.2 are a first proposal (a win preempts `playerFinished`; discard emits `handDiscarded` then `turn`); engine plans may adjust them together with RULES.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Gap numbering clash: the plan's G11 versus plan 01-03's G11**
- **Found during:** Task 1
- **Issue:** The plan defines G11 as « 7 brings the fourth pawn home mid-plan », but plan 01-03 already used G11 for « ordinary cards pass over other pawns » (written in R-07 and its fixtures), and the orchestrator asked to continue from G12.
- **Fix:** Kept 01-03's G11, numbered the plan's G11 as G12 (R-15.8 default, R-15.9 alt flagged G12). `grep -q G11 RULES.md` still passes through the real G11.
- **Files modified:** RULES.md, packages/engine/scenarios/fin.ts
- **Commit:** 8a8a154

**2. [Rule 2 - Missing Critical] Scenario.expect could not state where a 7 eats**
- **Found during:** Task 1 (R-10.4 to R-10.7 require « each with its atStep »)
- **Issue:** `events` lists only event types, so the `atStep` of mid-path captures could not be expressed.
- **Fix:** Added optional `expect.capturedAtStep` and documented the `alt` flag on `Scenario.flags`.
- **Files modified:** packages/engine/src/types.ts
- **Commit:** 8a8a154

**3. [Rule 1 - Bug] Stale « à valider » markers in R-04 to R-06**
- **Found during:** Task 1 (building the « Décidé » list)
- **Issue:** R-04, R-05 and R-06 (plan 01-03) marked Q6, Q8, Q13, Q15 and Q20 « à valider » although RULE-03, RULE-04 and RULE-14 settle them, contradicting the new « Décidé » section.
- **Fix:** Rewrote those markers as « acté par RULE-xx ». Added G13 for the one genuine default in R-05 (skipped player) that had no gap number.
- **Files modified:** RULES.md
- **Commit:** 8a8a154

**4. [Estimate miss] Picture size**
- **Found during:** Task 2
- **Issue:** A-04 assumed about 30 KB per picture; the wood texture makes each one about 110 KB at q70, and there are 103 pictures (not 60 to 80): about 12 MB in docs/regles. Lower quality or effort gains only 3 to 15 percent.
- **Decision:** Kept the plan's size and quality; flagged for the orchestrator.

**Total deviations:** 3 auto-fixed, 1 estimate miss. **Impact:** none on must-have truths.

## Issues Encountered

None. Node 22.22 imports the TypeScript fixtures and `packages/board/src/layout.ts` directly.

## Known Stubs

None.

## Threat Flags

None. T-01-SC mitigated: nothing installed; `pnpm-lock.yaml` and `package.json` unchanged (checked with `git diff`). T-01-26 mitigated: the background comes only from `composeBoard`, the script writes only `docs/regles/*.webp`, and `git status --porcelain assets/plateau` is empty.

## Verification Results

- `node tools/rules-trace.mjs` after Task 1: `rules-trace: OK (16 règles, 103 scénarios)`.
- `node tools/render-scenarios.mjs && node tools/rules-trace.mjs --images`: 103 images, `rules-trace: OK (16 règles, 103 scénarios)`.
- `pnpm typecheck` (tsc x2 + svelte-check 0 errors) and `pnpm lint` (Biome, 50 files): exit 0.
- Inventory size: `scenarios.length` is 103 (>= 55), exit 0. `grep -q "^## Points à valider" RULES.md` and `grep -q G11 RULES.md`: exit 0.
- Human-check (reading judgment, still for Romain): R-13.1 and R-12.1 were opened and match their text (pawn on cell 66 entering home slot 0; blue pawn at cell 30 before the protected red diamond, action ringed); R-10.4 matches (capture, jaune pawn back in its stable). R-09, R-03 not visually checked.

## Next Phase Readiness

- Plan 01-07 can now present « Points à valider » to Romain; RULE-20 stays pending until he validates RULES.md.
- Plans 01-10, 01-12 and 01-13 take the 103 fixtures as acceptance tests (skip `alt` ones unless chosen).

## Self-Check: PASSED

- Files exist: valet-sept.ts, prises-maison.ts, fin.ts, render-scenarios.mjs, docs/regles (103 webp), RULES.md.
- Commits `8a8a154` and `6b7c715` are ancestors of HEAD; `commits: 2`, `plan_head_before` and `plan_head_after` measured from the on-disk ledger.

---
*Phase: 01-une-vraie-partie-sur-un-appareil*
*Completed: 2026-10-13*
