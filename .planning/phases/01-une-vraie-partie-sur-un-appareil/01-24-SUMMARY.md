---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 24
subsystem: finishing
tags: [svelte, abandon, audio-failure, error-boundary, tapis, responsive, keyboard, playwright, fx-01, fx-06]
status: complete

requires:
  - phase: 01-23
    provides: "SettingsSheet mounted from the info bar gear; Sheet.svelte stack of open sheets"
  - phase: 01-20
    provides: "card faces (large cards in the Tapis sheet)"
  - phase: 01-17
    provides: "felt table drawn in the board SVG (accessible name « Sur le tapis »)"
  - phase: 01-04
    provides: "audio shell: status / onStatus / unlock"
provides:
  - "ui/ConfirmDialog.svelte: « Abandonner la partie ? » with « Continuer à jouer » primary and focused, no backdrop close"
  - "SettingsSheet: « Abandonner la partie » text button, in game only (onabandon prop passed by InfoBar)"
  - "Game.svelte: toast « Le son n’a pas pu démarrer… » with « Réessayer » when the audio status is failed; abandon disposes the session and goes to #/"
  - "audio/engine.ts: unlock() asks the browser again on each tap after a failure (so « Réessayer » can work)"
  - "App.svelte: svelte:boundary with the French error screen (no error text, stack or state) and « Recharger la page »; debug-only route #/panne"
  - "ui/TapisSheet.svelte + invisible 44 px+ felt button in Board.svelte: « Sur le tapis » in large form (D-08)"
  - "Game layout that fits 320x480, 375x667, 390x844, 480x320 and 1280x800 without scrolling the page"
  - "e2e/finition.spec.ts, e2e/jouer.ts (shared drivers), reglages.spec.ts extended"
affects: [phase-01-uat]

actuals:
  tokens: 14000
  tasks: 3
  commits: 4
plan_head_before: bf73f48b9ec9037f0961f95b67f7a5e74c6756fc
plan_head_after: ac3fd2d119967aebbaaa95d56f327891b9ee9d5a

tech-stack:
  added: []
  patterns:
    - "A confirmation reuses Sheet: closeIsPrimary makes the safe answer the primary button and gives it the focus, closeOnBackdrop false"
    - "The action zone has a fixed height (--action) so the hand never moves and the board is sized for it"
    - "Fan width given back to the screen margin: fanSpread() subtracts what the turned outer cards reach past the gutter"
    - "Shared whole-game driver in e2e/jouer.ts (playToEnd) for the full-game specs"

key-files:
  created:
    - apps/web/src/ui/ConfirmDialog.svelte
    - apps/web/src/ui/TapisSheet.svelte
    - apps/web/e2e/finition.spec.ts
    - apps/web/e2e/jouer.ts
  modified:
    - apps/web/src/App.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/ui/SettingsSheet.svelte
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/ui/Sheet.svelte
    - apps/web/src/ui/HandFan.svelte
    - apps/web/src/ui/SevenPanel.svelte
    - apps/web/src/ui/DealBanner.svelte
    - apps/web/src/board/Board.svelte
    - apps/web/src/audio/engine.ts
    - apps/web/src/cards/fan.ts
    - apps/web/src/cards/cards.test.ts
    - apps/web/e2e/reglages.spec.ts
    - apps/web/e2e/partie-complete.spec.ts
    - apps/web/e2e/animations.spec.ts

key-decisions:
  - "The copy was already in i18n/fr/game.ts (abandon, failures, error, tapis), so reglages.ts was not touched"
  - "The felt tap target is an invisible HTML button in Board.svelte over the felt square (not in FeltTable): no knight, with its 92-unit body, ever comes inside the felt square, so it never hides a knight tap, and it stays above the hit layer that catches misses"
  - "The action zone is a fixed 120 px (128 below 360 px wide) instead of 72 px growing to 160: the measured prompts reach 120 to 144 px, which pushed the hand off the screen; the board is sized for that budget, so a 375x667 board is 341 px wide instead of 375"
  - "Échap in the disambiguation tray deselects the card (the tray goes with it), which is what the reducer already did"

patterns-established:
  - "Assert fit with scrollWidth/scrollHeight of the document plus bounding boxes of the chrome, at every size, in every state of the first turn"

requirements-completed: [FX-06, FX-01]

duration: 62 min
completed: 2026-10-13
---

# Phase 1 Plan 24: Abandonner, pannes de son, tapis en grand et finition Summary

**Abandon with a safe-by-default confirmation, a toast with « Réessayer » when the sound cannot start, a friendly error boundary, the « Sur le tapis » sheet, and a game layout verified at five screen sizes, by keyboard and for a whole game without sound.**

## Performance

- **Duration:** about 62 min
- **Tasks:** 3 (4 commits: task 1, task 2, layout fixes found by task 3, task 3 tests)
- **Files modified:** 19

## Accomplishments
- « Abandonner la partie » in Réglages (in game only) opens « Abandonner la partie ? » with « Continuer à jouer » focused; Échap and « Continuer à jouer » keep the game, a tap outside does nothing, confirming disposes the session and returns to #/.
- When the AudioContext cannot be created the toast « Le son n’a pas pu démarrer. La partie reste jouable sans son. » appears with « Réessayer »; the game goes on (an exchange and a move are played in the spec with the AudioContext made to throw).
- An unexpected error shows « Oups, le jeu a rencontré un problème. » with « Recharger la page » and nothing else (no error text, no stack).
- Tapping the felt (or Entrée on it) opens « Sur le tapis »: one row per seat with the last card in large form (or « — »), « Talon : n cartes » and « Défausse : n cartes ».
- FX-01 is now checked, not assumed: board square and the whole chrome inside the screen, no page scroll, at 320x480, 375x667, 390x844, 480x320 and 1280x800, in the exchange, with a card selected, in the preview, after the move, and with the 7 panel.
- Keyboard: Tab order Réglages, lit knights, felt, action buttons, hand; arrows walk the hand, Entrée selects, Échap closes a sheet, closes the tray or deselects; every control has a French name.
- A whole game is played to the end screen with « Son » off.

## Task Commits

1. **Task 1: abandon, audio failure, error screen** - `fe6bdcd` (feat)
2. **Task 2: the felt in large form** - `70206e4` (feat)
3. **Task 3 (layout fixes found by the new checks)** - `6edebb7` (fix)
4. **Task 3: final checks and the hidden-tab flake** - `ac3fd2d` (test)

**Plan metadata:** the docs commit that adds this summary.

## Verification (commands and results)

| Command | Result |
|---------|--------|
| `pnpm typecheck` | 0 errors, 0 warnings (svelte-check 267 files) |
| `pnpm lint` | Checked 136 files, no fixes |
| `pnpm test` | 34 files, 617 passed, 2 skipped |
| `node tools/rules-trace.mjs --images` | `rules-trace: OK (16 règles, 103 scénarios)` |
| `pnpm --filter @toc/web exec playwright test` | 254 passed, 28 skipped (project-specific skips), 0 failed |
| `pnpm --filter @toc/web exec svelte-check --tsconfig ./tsconfig.json` | 0 errors |

## The « onglet caché » flake (animations.spec.ts)

Reproduced: 1 failure in 24 runs (`--repeat-each 24 --workers 6`), the final assertion `flightsOf(records, "exchange")` to have length 4 receiving 0.
Cause: a race inside the spec. The sound cue `carte-echange` is logged when the Director schedules the step, and the four exchange cards are recorded by the spec's requestAnimationFrame recorder only once Svelte has mounted them and they have taken off. The test polled the cue, then read the records once; when the poll landed between the two, it saw 0. The code is not at fault (the flights do happen).
Fix: the test now waits for the four flight records (`expect.poll`, 10 s) instead of reading them once. After the fix: 60 of 60 passes with `--repeat-each 60 --workers 8`. The test is not skipped or relaxed (it still demands exactly four).

## Decisions Made
See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] « Réessayer » could not retry**
- **Found during:** Task 1
- **Issue:** `unlock()` created the AudioContext only if `!createFailed`, so after a failure no later tap could ever try again.
- **Fix:** it asks the browser again on each call and clears the failure flag on success.
- **Files modified:** `apps/web/src/audio/engine.ts` (not in the plan's files)
- **Committed in:** `fe6bdcd`

**2. [Rule 3 - Blocking] Sheet could not make a button primary and focused**
- **Issue:** the abandon dialog needs « Continuer à jouer » as the primary, default-focused button.
- **Fix:** `Sheet.svelte` gained `closeIsPrimary` (backward compatible).
- **Files modified:** `apps/web/src/ui/Sheet.svelte`, `InfoBar.svelte` (passes `onabandon`)
- **Committed in:** `fe6bdcd`

**3. [Rule 1 - Bug] SevenPanel crashed when its list region unmounted**
- **Found during:** the full suite after the error boundary was added (cibles.spec: tapping the second close knight in the 7 panel showed the error screen)
- **Issue:** `if (region !== undefined) region.scrollTop = region.scrollHeight` ran with `region === null` after unmount (`bind:this` sets null); `Cannot read properties of null (reading 'scrollHeight')`. Before the boundary the error was tolerated; with it the game would have shown the error screen.
- **Fix:** `if (region)`.
- **Files modified:** `apps/web/src/ui/SevenPanel.svelte`
- **Committed in:** `6edebb7`

**4. [Rule 1 - Bug] The game did not fit the small screens (FX-01)**
- **Found during:** Task 3 (the new fit checks)
- **Issue:** the action zone grew with its prompt (88 to 144 px measured) beyond the 72 px the board was sized for, pushing the hand off the screen (page height 508 at 320x480, 698 at 375x667, 816 at 1280x800); the landscape layout was 524 px wide at 480; the 7 step chips (332 px) overflowed a 320 px phone; the turned outer cards of a 5-card fan stuck out by 6 px at 320; the deal banner was 385 px tall on a 108 px board; the outer margin of the landscape layout leaked out of the page.
- **Fix:** fixed-height action zone (`--action`), board sized for it, `width: fit-content; max-width: 100%` in landscape and no outer margin below 400 px high, `display: flow-root` on the game, wrapping step chips, `fanSpread()` (with unit test) and more room under the cards, a container-query compact plate in `DealBanner`.
- **Files modified:** `Game.svelte`, `HandFan.svelte`, `SevenPanel.svelte`, `DealBanner.svelte`, `cards/fan.ts`, `cards/cards.test.ts`
- **Committed in:** `6edebb7`
- **Visible consequence:** boards on height-limited phones are a little smaller (375x667: 341 px instead of 375; 320x480: 165 px instead of 212). Worth Romain's eye in the UAT.

**5. [Plan variance] Felt target lives in Board.svelte, not FeltTable.svelte**
- The target must sit above the SVG hit layer (which catches board misses), so it is an HTML button in `Board.svelte`; `FeltTable.svelte` is unchanged.

**6. [Plan variance] Extra spec helper file and a refactor**
- `e2e/jouer.ts` holds the shared drivers (exchange, untilOwnTurn, playSimpleMove, snapshot, playToEnd); `partie-complete.spec.ts` now calls `playToEnd` (same loop and assertions). 10 files instead of 9 for the spec side.

**7. [Rule 1 - Test race] `animations.spec.ts` « onglet caché »** — see the flake section above (file not in the plan's list).

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bugs), 3 variances. No package added.

## Issues Encountered
- The Échap behaviour in the disambiguation tray is « deselect the card », which closes the tray with it (as the reducer already did); the spec asserts the tray is gone.
- Unplayable cards, once another card is selected, are no longer labelled « pas jouable »; the naming check reads them before a selection (not changed, not in scope).

## Known Stubs
None.

## Threat Flags
None beyond the plan: the error screen renders no error text or state (T-01-33, asserted by the spec); abandon needs an explicit confirm with « Continuer à jouer » focused. The debug route `#/panne` is behind the compile-time `__TOC_DEBUG__` switch and is absent from the production bundle (checked: no « panne de test » string in a release build).

## Human checks still open (batched for the end-of-phase UAT)
1. Real iPhone (Safari tab, preview over the local network, `pnpm --filter @toc/web preview --host`): tap « Jouer la partie » with the ringer switch off, then on; sound should start on the first tap (or the « Pas de son sur iPhone ? » hint explains it); send Safari to the background and come back: sound resumes. (A-19: if the preview is not reachable from the iPhone, wait for a deployed build.)
2. One full game on a phone in portrait and one on a computer: fluid, legible, faithful to the original board; knights, sounds and card figures accepted; « Réglages » cuts the sound and reduces animations as labelled.
3. Look at the smaller boards on short phones (see deviation 4).
4. Listen: ambience fade-in and volume (from plan 01-23).

## Next Phase Readiness
- Every automated success criterion of phase 1 has evidence; the device-only checks above remain for the UAT.

## Self-Check: PASSED

---
*Phase: 01-une-vraie-partie-sur-un-appareil*
*Completed: 2026-10-13*
