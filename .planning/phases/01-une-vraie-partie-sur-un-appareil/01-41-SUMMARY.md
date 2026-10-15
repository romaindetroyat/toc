---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 41
subsystem: board
status: complete
tags: [plateau-galet, paysage-obligatoire, cleanup, gates, uat, gap-closure]
requires:
  - "01-36 (the bar on the computer, the board-width targets asserted in ecrans.spec)"
  - "01-37 (the compact bar on the phone held sideways, compact.spec targets and captures)"
  - "01-38 (« Tourne ton téléphone », tourne.spec, the computer players waiting)"
  - "01-40 (one landscape galet, no layout concept left, Caveat in the rule pictures)"
provides:
  - "packages/board/src/scene.ts: the only board geometry, now also defining Point, ScreenSide, quarterTurnsFor (bleu 0, vert 1, rouge 2, jaune 3) and screenSideOf"
  - "packages/board: layout.ts, layout.test.ts, rotate.ts, rotate.test.ts and the measured layout data file deleted; index.ts re-exports art, hopTimeline, motion and scene; package.json exports \".\" only; tsconfig includes src only; biome.json without the exclusion"
  - "scene.test.ts: the two rotate.test.ts cases it lacked (the general side relation for every human, the UI-SPEC examples with vert at the bottom)"
  - "01-UAT.md: tests 8 to 22 pending (re-tests 3 and 4, the twelve items « à confirmer par Romain » of the addendum « Plateau galet », the computer players waiting behind the invitation)"
affects: ["phase 1 sign-off (Romain's re-test)"]
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - packages/board/src/scene.ts
    - packages/board/src/scene.test.ts
    - packages/board/src/index.ts
    - packages/board/package.json
    - packages/board/tsconfig.json
    - biome.json
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UAT.md
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/deferred-items.md
  deleted:
    - packages/board/src/rotate.ts
    - packages/board/src/rotate.test.ts
    - packages/board/src/layout.ts
    - packages/board/src/layout.test.ts
    - packages/board/layout.json
decisions:
  - "The rotate.test.ts case « agrees with where the seat's last-card slot lands after the rotation » is not carried over: it measured the raster LAST_CARD_SLOT through the point rotation, both gone. Its galet counterparts already exist in scene.test.ts (the homes, stables and holes on the side screenSideOf names, the felt cards' angles per side)"
  - "Point's doc now reads « a point (x, y) on the galet, in scene units (the 3200 x 1600 scene) unless stated otherwise », since art.ts also uses it for mock-up values"
  - "Three stale app comments (k described as a turn of the board) are logged in deferred-items.md and not edited, because the plan forbids any change to the app"
metrics:
  duration: "15 min"
  completed: 2026-10-14
  tasks: 2
  files: 13
estimate:
  tokens: 55000
  tasks: 2
actuals:
  tokens: 7900
  tasks: 2
  commits: 2
plan_head_before: e24f58dcd5f36c8b16813e714efc222f661240b6
plan_head_after: 90414b0ebb0a2cf77978fbdeec85dd94ef4cf6e1
---

# Phase 1 Plan 41: L'ancienne géométrie quitte packages/board, toutes les vérifications, puis le re-test de Romain Summary

**packages/board now has one geometry, the landscape galet in scene.ts. That file also holds Point and the seat helpers. The measured raster layout, its data file, the quarter-turn point rotation and their tests are deleted, and nothing changed: the 112 rule pictures re-render byte for byte, and every gate is green. 01-UAT.md carries the 15 pending entries of Romain's end-of-phase re-test.**

Phase 1 n'est pas marquée terminée tant que 01-UAT.md n'a pas enregistré le re-test de Romain (tests 3 et 4, et chaque point à confirmer).

## What was built

### Task 1 (tracer), c56289b: the seat helpers move into scene.ts, the rotation goes
- `ScreenSide`, `quarterTurnsFor` and `screenSideOf` are defined in scene.ts with the same bodies as before (bleu 0, vert 1, rouge 2, jaune 3; bottom for the human, top for the partner, left for the next seat, right for the previous).
- rotate.ts and rotate.test.ts are deleted, and index.ts no longer re-exports them.
- Coverage check before deleting rotate.test.ts (8 tests). Against scene.test.ts:
  - covered already: quarterTurnsFor's four values, the UI-SPEC examples with bleu;
  - galet counterparts already present: the stables on the human's side, the side of each seat's felt card;
  - gone with the code: rotatePoint (2 tests), and the 2 tests of the raster last-card slots through the rotation;
  - missing, now added (deviation 1): the general relation for every human, and the UI-SPEC examples with vert at the bottom.
- Tracer gate:
  - typecheck, lint, vitest 757 passed, 2 skipped;
  - pictures re-rendered, `git status docs/regles` empty, rules-trace OK;
  - `e2e/tracer.spec.ts`: 15 passed, 1 skipped, 0 failed on both projects.
  - The gate passed, so the plan went on.

### Task 2, 90414b0: the measured layout leaves the package, the gates, the re-test
- scene.ts defines `export type Point = readonly [number, number]` instead of importing it from layout.ts. Its header no longer mentions a layout.
- Deleted: layout.ts, layout.test.ts (5 tests) and the measured layout data file at the package root.
- index.ts exports art, hopTimeline, motion and scene. package.json keeps only the "." export, tsconfig.json includes `src` only, and biome.json drops the excluded data file.
- The typecheck found no leftover import: nothing outside packages/board used the deleted modules.
- 01-UAT.md: tests 8 to 22 appended in French (see the list below). Current Test is test 8, the Summary reads total 22, passed 1, issues 6, pending 15, the status stays `partial` and `updated` is set. Tests 1 to 7 and the Gaps are unchanged.
- deferred-items.md: two out-of-scope finds (see « Deferred »).

## Gates (final, on the committed tree)

| Gate | Result |
|------|--------|
| `pnpm typecheck` (tsc per package, svelte-check) | 0 errors |
| `pnpm lint` (Biome) | 144 files, no fixes (146 before: the two deleted .ts files) |
| `pnpm test` (vitest) | 36 files, **752 passed, 2 skipped** |
| `node tools/render-scenarios.mjs` | 112 images, `git status --porcelain docs/regles` empty (byte for byte) |
| `node tools/rules-trace.mjs --images` | « rules-trace: OK (16 règles, 112 scénarios) » |
| G14 / G15 guards and frameClock (6 files, verbose) | 222 passed, 2 skipped |
| `e2e/animations.spec.ts` | 52 passed (both projects), :782 and :807 included |
| Full Playwright (phone = iPhone 13 landscape, desktop) | **333 passed, 83 skipped, 0 failed** (5.9 min), the same as the baseline |
| Repository greps of the verify | none prints a line |

Vitest count: the baseline was 764 passed. 764 − 8 (rotate.test.ts) + 1 (the case added to scene.test.ts) − 5 (layout.test.ts) = 752. The 2 skipped are unchanged.

Named guards, all green:
- scenarios.test.ts: R-02.3, R-08.7, R-13.12, R-13.16 to R-13.21 (G14), and R-10.6, R-10.7, R-10.14, R-15.10 (G15);
- path.test.ts: « a pawn at progress -2 enters at the exact count (G14) », the describe « entry after backing with the 4 (G14) » (8 cases), and « with capturePassed, every opponent pawn on a crossed cell is captured at its step; the partner's pawn is passed (G15) »;
- seven.test.ts: « passes own pawns and the partner's pawn without eating them (G15) »;
- flags.test.ts: the describes « G14 ENTRY_WITHOUT_FULL_LAP » (4 cases) and « G15 SEVEN_EATS_PASSED_PARTNER » (6 cases);
- props/invariants.test.ts: « engine invariants over 200 random games driven by the level-1 bot » (2 cases).

Frame clock:
- `animateNow` is used by animator.ts, cardFx.ts and Particles.svelte (3 of 3);
- no `.animate(` call in apps/web/src/board outside frameClock.ts;
- frameClock.test.ts passes (2 cases).
- animations.spec.ts:782, « une carte jouée se fond en 150 ms, le cheval glisse en 180 ms avec un seul sabot, sans particules » (reduced motion): passed on phone and desktop.
- animations.spec.ts:807, « une image chargée au départ du cheval ne le retarde pas : il glisse toujours 60 ms après la carte » (the regression of e0479d5): passed on phone and desktop.

Board-size specs in this full run:
- ecrans.spec (01-36): 13 passed on desktop, 13 skipped on phone;
- compact.spec (01-37): 16 passed, 16 skipped;
- finition.spec: 33 passed, 3 skipped;
- tourne.spec (01-38, the invitation): 12 passed, 4 skipped.
The skips are project-conditional, as in 01-36 to 01-40.

## For Romain's re-test

### Captures (regenerated by this run, git-ignored)
- `apps/web/test-results/galet-emulation-1280x800.png` (01-36, the bar on the computer)
- `apps/web/test-results/galet-emulation-844x390.png` (01-37, compact bar, one row)
- `apps/web/test-results/galet-emulation-750x342.png` (01-37, Playwright's iPhone 13 landscape window)
- `apps/web/test-results/galet-emulation-480x320.png` (01-37, compact bar, two rows)

### Board widths: target (addendum) against measured (Chromium emulation, insets 0)

| Window | Mode | Target (addendum) | Measured (01-36 / 01-37) | Step |
|--------|------|-------------------|--------------------------|------|
| 844 × 390 | compact bar, one row | ≥ 610 (≈ 625) | 624.92 | 20.9 |
| 750 × 342 | compact bar, one row | ≥ 520 (≈ 533) | 532.91 | 17.8 |
| 667 × 375 | compact bar, one row | ≥ 545 (≈ 559) | 559 | 18.7 |
| 568 × 320 | compact bar, two rows | ≥ 370 (≈ 383) | 383.38 | 12.8 |
| 480 × 320 | compact bar, two rows | ≥ 360 (≈ 372) | 372 | 12.4 |
| 1024 × 640 | bar | ≥ 900 (≈ 920) | 920.13 | 30.8 |
| 1280 × 800 | bar | ≥ 1200 (≈ 1227) | 1226.84 | 41.0 |
| 1440 × 900 | bar | ≥ 1390 (1408) | 1408 | 47.1 |
| portrait (390 × 844, 375 × 667, 320 × 480) | tourner | the invitation, no board | asserted by tourne.spec | — |

The assertions behind these rows passed again in this plan's full run. Each row is within 2 px of its formula and within 0.1 px in the 01-36 and 01-37 measurements.

### Real devices (computed, not asserted; Romain measures)
- iPhone 13, app installed, held sideways (notch 47 + 47 px at the sides, 21 px at the bottom): ≈ 585 px wide, cells ≈ 19.6 px apart, ring knights ≈ 18.6 px.
- iPhone 13 in Safari, held sideways: ≈ 533 px (cells ≈ 17.8 px) with 342 px visible, or ≈ 493 px (≈ 16.5 px) if Safari also reports its 21 px bottom inset.

### UAT re-test items (01-UAT.md, all `result: [pending]`)
- 8: re-test 3, the knights' legibility and size on the landscape galet (iPhone held sideways, 1280 × 800), and the « Lequel ? » tray under 44 px.
- 9: re-test 4, the galet on the iPhone held sideways (Safari, then installed), « Tourne ton téléphone » upright, and on the computer (mouse, keyboard, resizing), with the measured width.
- 10: to confirm, the felt (noise texture cut to the felt, the green ellipse).
- 11: to confirm, the seating by colour (bottom human, left next, top partner, right previous; the drawing never turns).
- 12: to confirm, the knight sizes (0.95 / 0.82 / 0.78 step, feet 0.28 w below the centre).
- 13: to confirm, the felt cards turned toward their seats, the piles, the card size, the whole felt as « Sur le tapis ».
- 14: to confirm, the screen taller than wide (« Tourne ton téléphone », « Élargis la fenêtre », the body line, the pictogram, the game kept).
- 15: to confirm, the screen modes and thresholds (bar from 960 × 600, compact bar, rotate).
- 16: to confirm, the computer's bottom bar (160 px, three zones, the board ≈ 1227 px at 1280 × 800).
- 17: to confirm, the phone's compact bar (96 px info column, one 64 px row from 640 px, else 56 + 64 px).
- 18: to confirm, what the compact bar keeps from the dock (64 × 90 cards, 44 px slices and buttons, unchanged focus and keys).
- 19: to confirm, the size targets and the real-device expectations.
- 20: to confirm, the rule pictures on the landscape galet, « avant » above « après », Caveat numbers.
- 21: to confirm, the shadows without blur.
- 22: to confirm (a consequence of the implementation, not Romain's words), the computer players wait while the invitation shows.

Any change Romain asks for there becomes a new gap plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing test] scene.test.ts lacked two rotate.test.ts cases (a gap of 01-32)**
- **Found during:** Task 1, the coverage check the plan asks for before deleting rotate.test.ts.
- **Issue:** scene.test.ts tested screenSideOf only through examples with bleu and jaune at the bottom. It had no direct check of the general relation for every human (bottom, top = partner, left = next, right = previous). It also lacked the UI-SPEC examples with vert at the bottom.
- **Fix:** the vert examples were added to « screenSideOf follows the UI-SPEC examples », and a new case « screenSideOf is bottom for the human, top for the partner, left for the next seat, right for the previous » loops over the four colours.
- **Files modified:** packages/board/src/scene.test.ts (so this file changed, though the plan expected it not to)
- **Commit:** c56289b

No gate failed, so no earlier plan's bug had to be fixed.

## Deferred (logged in deferred-items.md, not fixed: out of scope or forbidden here)
- Three app doc comments still call k « quarter turns of the board » or speak of « the board rotation »: session.svelte.ts:51, director.ts:122 and geometry.ts:30. They are comments only, and the plan forbids changing the app. None matches the verify greps.
- 01-UI-SPEC.md, addendum « Plateau galet » (not in this plan's files): item 2 still writes `sceneXY(place, k, layout)`, and « Faits techniques » still says the portrait scene is kept in the code « pour l'instant ».

## Known Stubs

None.

## Threat Flags

None: deletions and one moved type and two functions, no new surface. T-01-65 is accepted as planned (removed guards were for the raster board; seat helpers stay tested in scene.test.ts; pictures byte-identical). T-01-SC: no package added.

## Self-Check: PASSED

- FOUND: packages/board/src/scene.ts (contains `export type Point`, `export function quarterTurnsFor`, `export function screenSideOf`)
- FOUND: packages/board/src/index.ts (art, hopTimeline, motion, scene)
- GONE: packages/board/src/rotate.ts, rotate.test.ts, layout.ts, layout.test.ts, packages/board/layout.json
- FOUND: 01-UAT.md with 15 `result: [pending]`, `pending: 15`, `total: 22`, `status: partial`
- FOUND: apps/web/test-results/galet-emulation-1280x800.png, -844x390.png, -750x342.png, -480x320.png
- FOUND commits: c56289b, 90414b0 (ancestors of HEAD)
