---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 21
subsystem: game-screen
tags: [svelte5, turn-reducer, seven-splitter, previewPlan, nextSteps, touch-targets, playwright, d-17]

requires:
  - phase: 01-18
    provides: "turnUi reducer (hasCard, tapAt, tray), ActionZone, Overlay, HitLayer, PawnTray, e2e/cartes-speciales.spec.ts"
  - phase: 01-13
    provides: "engine 7 API: nextSteps, normalizePlan, isComplete, PlanFailure, controlledPawns (G12)"
  - phase: 01-19
    provides: "Director animates the 7's captures mid-move"
provides:
  - "turnUi: sevenBuilding state with pickSteps, undoLast, cancelAll, confirm; knightLetter; SevenPreview"
  - "engine: previewPlan(board, seat, card, plan), the first steps of a 7 played with the same micro-moves and checks as applyPlan"
  - "SevenPanel and StepChip: the 7 splitter that replaces the action zone and the hand"
  - "Overlay: one dashed path per micro-move, a ghost with its steps, the x badge of each knight eaten in transit"
  - "e2e: the 7 split over two knights, undo, cancel all, a refused chip, RULE-17; a whole game through the UI; 44 px targets at 320, 375 and 390"
affects: [01-22, 01-23, 01-24]

requirements-completed: [PLAY-03, RULE-10, RULE-17]

actuals:
  tokens: 20000
  tasks: 2
  commits: 3
plan_head_before: 2caddabda61006591424bc9d32e99157da122dc7
plan_head_after: 1ae30432d86afa2784111ebfe86f7ebe4d92c6e2

tech-stack:
  added: []
  patterns:
    - "The 7 reducer state keeps the raw choices (one entry per tap); the engine merges consecutive entries of one knight, so undo removes exactly the last tap"
    - "Every number of steps offered is nextSteps(view, seat, card, plan); the preview is previewPlan; confirm re-checks isComplete before submitting"
    - "A chip that is off is aria-disabled, not disabled, so a tap can say why"

key-files:
  created:
    - apps/web/src/ui/SevenPanel.svelte
    - apps/web/src/ui/StepChip.svelte
    - apps/web/e2e/partie-complete.spec.ts
    - apps/web/e2e/cibles.spec.ts
  modified:
    - packages/engine/src/seven.ts
    - packages/engine/test/seven.test.ts
    - apps/web/src/game/turnUi.ts
    - apps/web/src/game/turnUi.test.ts
    - apps/web/src/board/Overlay.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/ui/ActionZone.svelte
    - apps/web/src/i18n/fr/game.ts
    - apps/web/e2e/cartes-speciales.spec.ts

key-decisions:
  - "previewPlan was added to the engine: applyPlan only accepts a plan that sums to 7, so it cannot preview the first steps. previewPlan shares its body (playMerged) with applyPlan, so a preview can never differ from the real move."
  - "The reducer keeps one plan entry per tap (not merged); the preview and the submitted plan are merged by the engine (normalizePlan). Two consecutive taps on one knight show one path and one ghost, but « Retirer le dernier pas » takes back only the last tap."
  - "After each chip the selection is cleared: the player taps a knight again for each step (« pawn by pawn », D-17); tapping the selected knight again lets it go."
  - "Captures in transit are placed at the event's `at` place (where the victim stood when it was eaten), not at its current place, so a knight moved earlier in the plan is marked where it really was."
  - "When the plan holds knights of two colours (the partner's after the fourth knight is home, G12) the rows name the colour: « Cheval A bleu : 3 pas »."
  - "Panel layout: fixed 52 px list region (prompt + rows, 3 lines then it scrolls to the newest row), 44 px chip row, three buttons on one row down to 320 px; panel is 200 px at every width tested and the counter « Tout est réparti. » drops to 20 px so the header stays on one line."

patterns-established:
  - "A full-game e2e reads the screen in one page.evaluate snapshot per step and acts with locators; the loop ends only on the end screen"

coverage:
  - id: D1
    description: "The 7 is split knight by knight: chips from nextSteps, cumulative preview with captures in transit, Reste counter, undo of the last step, cancel all, Jouer only at Tout est réparti (one submit of { t: 'seven', card, plan })"
    requirement: PLAY-03
    verification:
      - kind: unit
        ref: "apps/web/src/game/turnUi.test.ts#the 7, knight by knight (PLAY-03, RULE-10, D-17)"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/cartes-speciales.spec.ts#le 7 : réparti sur deux chevaux, prise en chemin, un seul « Jouer »"
        status: pass
    human_judgment: true
    rationale: "Comfort of splitting a 7 with a thumb on a real phone is a judgment (plan human-check)."
  - id: D2
    description: "A chip that would make the 7 impossible to finish is off and explains itself on tap; a chip with no knight chosen asks for a knight"
    requirement: RULE-10
    verification:
      - kind: unit
        ref: "apps/web/src/game/turnUi.test.ts#refuses a number of steps that would make the 7 impossible to finish, and says so"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/cartes-speciales.spec.ts#le 7 : un nombre de pas qui empêcherait de finir est grisé et s’explique au toucher"
        status: pass
    human_judgment: false
  - id: D3
    description: "A player whose four knights are home plays his partner's knights with a number card and with a 7, and goes on with the partner's knights in the middle of a 7"
    requirement: RULE-17
    verification:
      - kind: unit
        ref: "apps/web/src/game/turnUi.test.ts#a finished player plays the 7 with his partner's knights (RULE-17)"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/cartes-speciales.spec.ts#RULE-17 : un joueur dont les quatre chevaux sont rentrés joue ceux de son partenaire"
        status: pass
    human_judgment: false
  - id: D4
    description: "A complete seeded game against three bots is played to Victoire ! or Défaite through taps alone (52 deals, 199 plays, 13 sevens, 18 Valets, 9 hands laid down), with deals of 5, 4, 4, 5 cards, four different dealers and the deal banner"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/partie-complete.spec.ts#une partie entière contre trois ordinateurs, au doigt, jusqu’à l’écran de fin"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every button, card slice, step chip, tray chip and candidate-knight hit circle is at least 44 x 44 screen px at 320x480, 375x667 and 390x844; the 7 panel fits under a square board at 375x667; halos are still under reduced motion"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/cibles.spec.ts"
        status: pass
    human_judgment: true
    rationale: "Measured boxes pass; a real finger on a real phone is the final word on reachability."

duration: about 1 h 40 min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 21: Le 7 réparti pas à pas, et une partie entière au doigt Summary

**The 7 is now split knight by knight with a live preview (paths, ghosts, captures in transit), undone one tap at a time and confirmed once, and a whole game against three bots is played from the first exchange to the end screen by taps alone, with every touch target at least 44 px.**

## Performance

- **Duration:** about 1 h 40 min
- **Tasks:** 2 (plus one engine commit the plan did not list)
- **Files:** 4 created, 9 modified

## Accomplishments

- `turnUi.ts`: tapping a playable 7 enters `sevenBuilding { plan, remaining, selected, steps, preview }`. `steps` is `nextSteps` for the plan so far, `preview` is read from the events of `previewPlan` (one path per micro-move, each capture with its `atStep`). `pickSteps`, `undoLast`, `cancelAll` and `confirm` are the new events; `confirm` submits `{ t: "seven", card, plan }` only at Reste 0 and only after `isComplete`. Chips outside `nextSteps` set a notice instead of changing the plan.
- `SevenPanel` and `StepChip`: heading, mini card chip (from 360 px), « Reste n » or « Tout est réparti. », a prompt line and one row per micro-move in a region that scrolls beyond three lines, chips 1 to the rest (44 x 44, off chips explain on tap), « Retirer le dernier pas », « Tout annuler » and « Jouer » (disabled until Reste 0). Tray chips take the place of the step chips when knights are too close. The panel replaces the action zone and the hand and is 200 px high from 320 to 390 px wide.
- `Overlay`: dashed path and chevrons per micro-move, a 55 % ghost where each moved knight will stand with its total « +n », and the × badge on each knight eaten on the way, before « Jouer ».
- E2E: `cartes-speciales.spec.ts` gains the two-knight 7 with a capture, undo, cancel all, an off chip, a chip with no knight, and RULE-17; `partie-complete.spec.ts` plays a whole game; `cibles.spec.ts` measures the targets and the panel at three small sizes and checks reduced motion.

## Task Commits

1. **Engine: previewPlan for the splitter** - `7192582` (feat)
2. **Task 1: the 7 split knight by knight** - `ea53dff` (feat)
3. **Task 2: a whole game through the UI, 44 px targets** - `1ae3043` (test)

**Plan metadata:** the docs commit that adds this file.

## Verification

- `pnpm exec vitest run`: 31 files, 570 tests pass (2 skipped, as before). `turnUi.test.ts` has 17 new cases for the 7; `seven.test.ts` has 5 for `previewPlan`.
- `pnpm typecheck` (tsc and svelte-check, 0 errors, 0 warnings) and `pnpm lint` (biome, 127 files): pass.
- `pnpm --filter @toc/web exec playwright test` on a fresh debug build: 165 passed, 25 skipped (explicit-viewport cases on the phone project, and `partie-complete` on the phone project), 0 failed.
- **Complete game through the UI:** `partie-complete.spec.ts` (seed `00c0ffee00c0ffee1234567890abcdef`, test speed, first playable card and first lit knight) reaches the end screen in about 85 s: 52 deals (the 01-14 self-play mean is 50.5 deals), 199 plays, 13 sevens, 18 Valets, 9 hands laid down, dealers Jappeloup, toi, Ourasi and Comanche, deal sizes 5, 4, 4, 5, 4, 4, ... , banners « Donne 1 sur 3 · 5 cartes » and « Donne 2 sur 3 · 4 cartes » seen. So yes: a complete game against three level-1 bots can be played from « Jouer la partie »'s game screen to « Victoire ! » or « Défaite » with the UI only (the spec opens `#/partie` directly rather than clicking the launch button, which `launch.spec.ts` covers).
- Screenshots read at 375x667 and 320x480: the panel with two rows and the done state; `Jouer` is on screen without scrolling at both sizes.

## Decisions Made

See `key-decisions`. In short: the engine gained `previewPlan` (a preview that cannot differ from the move), the reducer keeps raw taps so undo is exact, the selection clears after each chip, and the panel is a fixed 200 px.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The engine had no way to play a partial 7**
- **Found during:** Task 1 (the preview)
- **Issue:** The plan says the preview is « applyPlan on the view for the plan so far », but `applyPlan` rejects any plan that does not sum to 7 (`bad-plan`), so it cannot preview the first steps; the UI could not reuse engine code without copying the micro-move logic (which the engine forbids: no second movement code path).
- **Fix:** Added `previewPlan` to `packages/engine/src/seven.ts`; `applyPlan` and `previewPlan` now share `playMerged`, so the checks are identical and `applyPlan` behaves exactly as before. Five engine tests added (empty plan, partial plan with captures, agreement with `applyPlan` on a whole plan, refusals).
- **Files modified:** `packages/engine/src/seven.ts`, `packages/engine/test/seven.test.ts`
- **Verification:** `pnpm exec vitest run packages/engine` (256 pass before the plan's UI work, 570 overall at the end)
- **Committed in:** `7192582`

### Other differences from the plan text

- The reducer has no separate `pickSevenPawn` event: a tap on a lit knight goes through the existing `tapPawn` and `tapAt` (and the tray), which `stepFor` now answers for `sevenBuilding`. Same behaviour, one path less.
- `cibles.spec.ts` runs on the desktop project with explicit viewports (the phone project is already one size), and `partie-complete.spec.ts` is desktop only as the plan says.
- Playwright treats `aria-disabled="true"` as not actionable, so the specs tap off chips with `force: true`; real taps work (the chip stays a live button).
- Catalogue: `game.seven.planColour`, `game.seven.chooseSteps` and `game.seven.card` were added (existing entries untouched).
- Panel width at 320 px: the title is 16 px (18 px from 360 px) instead of the 20 px Heading so that the title and « Reste n » share one line; the mini card chip appears from 360 px.

**Total deviations:** 1 auto-fixed (1 blocking). **Impact:** the engine change is additive and keeps every existing test green.

## Issues Encountered

- The first layout wrapped the buttons into two rows at 320x480 (« Jouer » fell below the screen) and grew by 14 px when « Tout est réparti. » wrapped the header; both were found by measuring and fixed (basis widths, fixed list region, smaller done counter). The panel is now 200 px high in every state at 320, 375 and 390.

## Known Stubs

None. The 7 panel, its preview and the full game are wired to the engine end to end.

## Threat Flags

None. T-01-31 holds: the chips come only from `nextSteps`, the preview from `previewPlan`, `confirm` re-checks `isComplete` and the controller's `apply()` rejects anything else. No package was added (T-01-SC).

## User Setup Required

None.

## Next Phase Readiness

- Every card is now playable through the UI, and a whole game can be played to its end by taps alone (success criteria 2 and 3).
- Plan 01-22 (card animations) touches disjoint files. The 7 panel removes the hand while it is open, so any hand animation must tolerate the hand unmounting and remounting.
- For a human check on a real phone (plan `human-check`): the 7 panel at 375x667 and a full game with « Avance rapide ».

---
*Phase: 01-une-vraie-partie-sur-un-appareil*
*Completed: 2026-10-13*

## Self-Check: PASSED

Created files exist (SevenPanel.svelte, StepChip.svelte, partie-complete.spec.ts, cibles.spec.ts); commits `7192582`, `ea53dff` and `1ae3043` are in the branch history; `git rev-list --count` from `2caddab` gives 3.
