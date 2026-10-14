---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 36
subsystem: ui
status: complete
tags: [layout, plateau-galet, paysage-obligatoire, bottom-bar, computer, e2e, gap-closure]
requires:
  - "01-34 (the landscape galet is the only board)"
  - "01-35 (every felt layer on the landscape galet)"
provides:
  - "apps/web/src/ui/screen.svelte.ts: BAR_QUERY, COMPACT_BAR_QUERY, ROTATE_QUERY, chromeFrom(matches), the `screen` store ({ chrome: bar | compact-bar | rotate }) following matchMedia change events"
  - "Game.svelte: data-chrome on main.game; the bar layout (board across the width, one 160 px walnut band: info 240 / hand >= 336 / action 320-400 px); the compact-bar keeps the 01-24 side panel, rotate the portrait chrome"
  - "InfoBar `form` prop (row | column), ActionZone `bar` prop, SevenPanel `bar` prop"
  - "e2e/ecrans.spec.ts: the bar tracer, every turn state in the bar at 1024 x 640 and 1280 x 800, the three computer targets against the formula, the resize test, the capture test-results/galet-emulation-1280x800.png"
  - "board, finition and cartes-speciales specs at landscape sizes only"
affects: ["01-37", "01-38", "01-39", "01-40", "01-41"]
tech-stack:
  added: []
  patterns:
    - "One mode store from media queries whose strings are the CSS's own (a unit test reads both sources)"
    - "Layout groups with `display: contents` outside a mode, so one markup serves two layouts"
key-files:
  created:
    - apps/web/src/ui/screen.svelte.ts
    - apps/web/src/ui/screen.test.ts
    - apps/web/e2e/ecrans.spec.ts
  modified:
    - apps/web/src/routes/Game.svelte
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/ui/ActionZone.svelte
    - apps/web/src/ui/SevenPanel.svelte
    - apps/web/e2e/finition.spec.ts
    - apps/web/e2e/board.spec.ts
    - apps/web/e2e/cartes-speciales.spec.ts
decisions:
  - "The bar's columns are 240 px (info), minmax(336 px, 1fr) (hand) and minmax(320 px, 400 px) (action), so the bar fits from 960 px wide (240 + 336 + 320 + 2 gaps of 16 = 928 = 960 − 32)"
  - "The info's column form puts the turn and dealer lines on top and the two team pills side by side with the gear on one row under them"
  - "The compact-bar media query is a list, « (orientation: landscape) and (max-width: 959.98px), (orientation: landscape) and (max-height: 599.98px) », supported everywhere (no nested « or »)"
metrics:
  duration: "25 min"
  completed: 2026-10-14
  tasks: 3
  files: 10
estimate:
  tokens: 90000
  tasks: 3
actuals:
  tokens: 10700
  tasks: 3
  commits: 4
plan_head_before: a49993caebcb28056db2d31ccd110e36092f66e5
plan_head_after: 45f6fa6e3fbd16639d062be8220687bcf6a4ec83
---

# Phase 1 Plan 36: Sur ordinateur, le galet en largeur et la barre du bas Summary

On a computer (any landscape screen from 960 x 600) the landscape galet now spans the width: 1227 px at 1280 x 800, where the 01-24 side panel gave 912 px. Under it, one 160 px walnut bar holds three zones:
- the info at the left;
- the hand of regular 88 x 124 cards in the middle;
- the action zone at the right.

The 7 assistant takes the place of the hand and the action zone inside the bar. A new screen store (`bar`, `compact-bar`, `rotate`) gives the game screen its mode from the same media queries as the CSS. 01-37 and 01-38 fill the two other modes.

## What was built

- **Task 1 (tracer), e0d5fb2.**
  - **screen.svelte.ts:** the three query strings and `chromeFrom`. The `screen` store follows each query's `change` event. Outside a browser it reports `bar`.
  - **screen.test.ts:** reads the store's and Game.svelte's sources as text. It checks that both media queries appear verbatim in Game's style block and that `data-chrome={screen.chrome}` is on the game.
  - **Game.svelte:**
    - `data-chrome` on `main.game`.
    - Under the bar query: `--bar: 160px` and the board formula min(100vw − 32 px − insets, (100dvh − 160 px − insets) / (ratio + head room), 1600 px).
    - The grid is `"stage stage stage" / "info hand action"`, rows `minmax(0, 1fr) var(--bar)`.
    - The walnut band is a gradient on the layout across the screen. The stage is centred in the first row.
    - The former `(orientation: landscape)` rules are now scoped to the compact-bar query. The portrait rules are unchanged.
    - The style header describes the three modes (« à confirmer par Romain »).
    - The DOM order (info, stage, action or seven, hand), and so the Tab order, is unchanged.
  - **InfoBar `form="column"`:** no own height or background. The lines come first, then the pills side by side and the 44 x 44 gear. Texts, aria labels and the compact rule are unchanged.
  - **ActionZone `bar`:** the zone fills its column with no 72/160 bounds. The prompt is on top: Body 16, at most three lines, then it scrolls inside. The buttons are right-aligned under it, the As/Roi pair spans the width, and « Avance rapide » sits at the bottom right.
  - **ecrans.spec tracer (1280 x 800, R-07.1):**
    - `data-chrome="bar"`;
    - the board is at least 1200 px wide, within 2 px of the formula, and 2:1;
    - the info bar, the hand and the action zone are under the board, inside the screen, in one band of at most 161 px, left to right;
    - the gear is at least 44 x 44 and « Jouer » lies inside the action zone;
    - the Dame lands bleu0 on drawn cell 15 (offCell ≤ 0.5) and the page never scrolls.
  - Tracer gate: the verify was re-run and passed (ecrans plus tracer on both projects: 16 passed, 2 skipped), then the plan continued.
- **Task 2, 5b316d4.**
  - **SevenPanel `bar`:** two groups, `.top` and `.controls`, that are `display: contents` outside the bar, so the other modes are unchanged.
    - In the bar, the first line holds the title, « Reste n » and the prompt and plan. That line scrolls sideways and follows the newest row (scrollLeft).
    - The step chips and the three buttons sit side by side at 1280, and on two rows at 1024 with seven chips.
    - The panel is never taller than `--bar`. Its own tray takes the place of the chips.
  - **Game:** `.seven` spans `hand / action` in the bar. The columns were tuned so the bar fits from 960 px (see decisions).
  - **ecrans.spec at 1024 x 640 and 1280 x 800:** idle, As/Roi, « Avancer de 1 » then the knight, the preview, the « Lequel ? » tray (chips at least 56 px high) and its B preview. Then the exchange's waiting (natural pace, the three givers), the exchange choice with a card chosen, the dead hand, the waiting state with « Avance rapide » (icon and label), and the 7 at four fill levels:
    - nothing spread;
    - a knight chosen with the seven chips;
    - one knight and its steps;
    - everything spread, two plan rows, « Jouer » enabled.

    For each state, every button and tray chip is at least 44 x 44, inside the screen and inside the bar's band, the count of visible amber buttons is checked, and the page does not scroll.
- **Task 3, 7f8a5fd.**
  - **ecrans.spec:** the three board-width targets are checked against the formula (each with its formula in a comment). « redimensionner garde la partie »: a seeded game in test speed, one move played, the player's turn again, then the window goes 1280 x 800 → 1024 x 640 (bar) → 900 x 700 (compact-bar) → 1280 x 800 (bar). At each size:
    - the same hand, the same 16 places and the same turn;
    - every ring knight on its drawn cell (offCell ≤ 0.5);
    - the board still 2:1 and inside the screen;
    - the expected `data-chrome` and no page scroll.

    Back at 1280 x 800 the width is the bar's again, and there were no page errors. With a card selected it saves test-results/galet-emulation-1280x800.png.
  - **finition.spec:** SIZES are now 480x320, 568x320, 667x375, 844x390 and 1280x800, with a comment on 01-37 and 01-38. `expectBarBoard` checks at least 1200 px and within 2 px of the formula at 1280 x 800, in « tient entier » and in the 7-panel test. The fit, 7-panel and Tab-order checks are unchanged.
  - **board.spec:** the viewport matrix uses the same five landscape sizes, with assertions unchanged.
  - **cartes-speciales.spec:** the tray test cuts the desktop project to 667 x 375. Its comment explains why the tray still opens.

## Measured board widths (Chromium emulation, insets 0, R-07.1)

| Viewport | Mode | Formula (px) | Measured (px) | Step (px) |
|---|---|---|---|---|
| 960 x 600 | bar | (600 − 160) / 0.52166 = 843.5 | 843.45 | 28.2 |
| 1024 x 640 | bar | (640 − 160) / 0.52166 = 920.1 | 920.13 | 30.8 |
| 1280 x 800 | bar | (800 − 160) / 0.52166 = 1226.9 | 1226.84 | 41.0 |
| 1440 x 900 | bar | 1440 − 32 = 1408 (width-limited) | 1408 | 47.1 |
| 1920 x 1080 | bar | 1600 cap | 1600 | 53.5 |
| 900 x 700 | compact-bar (side panel until 01-37) | 900 − 368 = 532 | 532 | 17.8 |

Every row matches its formula within 0.1 px, and there is no document scroll at any of them (scrollWidth x scrollHeight equals the viewport).

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green. 39 files, **780 passed, 2 skipped**: 777 + the 3 screen.test cases.
- Task 1 acceptance grep (`matchMedia`, `data-chrome`, `min-width: 960px`): exit 0.
- Task 3 grep `! grep -nE "375, height: 667|width: 390, height: 844|width: 320, height: 480"` on board, finition and cartes-speciales: exit 0.
- `playwright test e2e/ecrans.spec.ts e2e/tracer.spec.ts`: 16 passed, 2 skipped (Task 1).
- `playwright test e2e/ecrans.spec.ts e2e/cartes-speciales.spec.ts e2e/clavier.spec.ts`: 53 passed, 25 skipped (Task 2, both projects).
- `playwright test e2e/ecrans.spec.ts e2e/finition.spec.ts e2e/board.spec.ts e2e/cartes-speciales.spec.ts`: green on both projects (Task 3).
- **Full Playwright suite, phone and desktop projects: 299 passed, 57 skipped, 0 failed** (5.3 min).
  - Against the 286 / 44 baseline, the difference is ecrans.spec's 13 tests: 13 more passed on desktop and 13 more skipped on phone, where explicit viewports do not apply.
  - Every other count is unchanged: board.spec still has 5 viewports, and finition still has 5 sizes, with 1280 skipped on phone.
  - animations.spec.ts:782 and :807 pass (the file is untouched).
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 112 scénarios) ».
- Frame-clock invariant: `animateNow` is in animator.ts, cardFx.ts and Particles.svelte (plus frameClock.ts, which defines it). There is no `.animate(` in apps/web/src/board outside frameClock.ts. No motion code changed.
- The preview server started for screenshots (port 4175) was stopped by PID.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The resize test's cell check needed exit cells mapped through their transform**
- **Found during:** Task 3.
- **Issue:** An exit cell is drawn as a turned square (`rect` with a transform). Its `getBBox()` is in its own coordinates, centred on 0,0, so a knight standing on an exit cell (rouge0 on ring:36) read 1709 units off.
- **Fix:** ecrans.spec's `offCell` maps the box centre through the cell's own `transform.baseVal.consolidate()` matrix. tracer.spec's helper is unchanged; it only checks plain cells.
- **Commit:** 7f8a5fd

**2. [Rule 3 - Blocking] The resize test plays one move before it records the game**
- **Issue:** At the seeded game's first turn every knight is still in its stable, so there was no ring knight to check.
- **Fix:** `untilOwnTurn`, `playSimpleMove`, then `untilOwnTurn` again before the snapshot.
- **Commit:** 7f8a5fd

**3. [Rule 2 - Correctness] A unit test ties the store's queries to the CSS**
- The plan's key link says « the CSS media queries are the store's query strings ». `screen.test.ts` (not in the plan's file list) asserts it on the sources, so the two cannot drift.
- **Commit:** e0d5fb2

### Choices within the plan's latitude

- **As/Roi keeps two amber buttons.** The plan's Task 2 test asks for « a single primary button visible » for the As/Roi question. Since 01-18, « Sortir un cheval » and « Avancer de 1|13 » are both `btn-primary`: two equal choices, in UI-SPEC « As/Roi mode ». The must-have says the single primary button is « unchanged ». The spec therefore asserts exactly 2 amber buttons in the As/Roi state and exactly 0 or 1 in every other state. The button style was not changed. UI-SPEC line 314 (« Only one primary (amber) button is visible at any time ») contradicts this pair; Romain can settle it at the re-test.
- **Column widths:** the planche's « info ≈ 240 px » and « action ≥ 320 px », with a 336 px minimum for the hand so that five regular cards fit at 960 px. At 1024 x 640: info 240, hand 336, action 384. At 1280 x 800: 240 / 576 / 400.
- `expectControls` requires at least one control (the gear). The exchange's waiting and the idle state have only the gear in the bar.
- ecrans.spec records the measured widths as test annotations (no console output).
- The resize test's capture waits 400 ms, past the action zone's 150 ms fade, before the screenshot. It is a picture only, with no assertion on it.

## For Romain's re-test (01-41, « à confirmer par Romain »)

- The bar's details: 160 px; info at the left with the pills and the gear on one row; the hand in the middle; the action zone at the right, at most 400 px. The board is 1227 px at 1280 x 800, not the planche's 1280: room is kept for the top-row heads and the bar.
- A selected card rises 16 px and grows 6 %, as on every screen. In the bar its top passes about 18 px above the band, over the galet's bottom rim. At 1024 x 640 it touches the lower edge of the bottom row's cells 1 and 2.
- The As/Roi question shows two amber buttons (see above).

## Known Stubs

None. Still transitional, as planned:
- the side panel on landscape screens below 960 x 600 (01-37 brings the compact band);
- the portrait chrome on screens taller than wide (01-38 brings « Tourne ton téléphone »).

## Threat Flags

None. T-01-58 is mitigated: ecrans.spec checks every state's controls (at least 44 x 44, inside the screen, inside the bar), no scroll at 1024 x 640 and 1280 x 800, and an unchanged game after three resizes. The controls send the same turnUi events, and turnUi, the key map and the Director are untouched. No package was added (T-01-SC).

## Commits

The measured range `a49993c..45f6fa6` holds 4 commits: e0d5fb2 (Task 1), 5b316d4 (Task 2), 7f8a5fd (Task 3) and 45f6fa6 (a comment in ecrans.spec naming the addendum's ≈ 1227 px, the plan's artifact check, after the full suite had run). This SUMMARY is committed separately.

## Self-Check: PASSED

- FOUND: apps/web/src/ui/screen.svelte.ts (contains "matchMedia"), apps/web/e2e/ecrans.spec.ts (contains "1227", since 45f6fa6), apps/web/src/routes/Game.svelte (contains "data-chrome", "min-width: 960px"), apps/web/test-results/galet-emulation-1280x800.png
- FOUND: e0d5fb2, 5b316d4, 7f8a5fd, 45f6fa6 (ancestors of HEAD)
