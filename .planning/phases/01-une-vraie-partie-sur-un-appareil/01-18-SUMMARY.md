---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 18
subsystem: game-screen
tags: [svelte5, turn-reducer, as-roi, valet, tray, hit-layer, overlay, playwright, d-16, d-19]

requires:
  - phase: 01-17
    provides: "Game screen with info bar, felt, exchange, end screen; e2e/position.ts etat encoding; Game.svelte begin()"
  - phase: 01-16
    provides: "ActionZone, Overlay, HitLayer, i18n/fr/game.ts catalogue (mode chooser, Valet and tray copy)"
  - phase: 01-15
    provides: "reduceTurnUi, session store, turnCtx"
provides:
  - "turnUi reducer: modeChoice (As/Roi), jackPick, jackTarget, tray; events chooseExit, chooseAdvance, tapAt, chooseTrayOption, closeTray; trayLetters"
  - "ActionZone: « Que veux-tu faire ? » with « Sortir un cheval » and « Avancer de 1|13 » (48 px, side by side), Valet prompts, tray in place of the prompt"
  - "PawnTray: 2 to 4 chips (44 x 56, mini knight, letter A to D) and « Choisir un autre cheval »"
  - "Overlay: letter badges over the tray's knights, two crossing dashed arrows and a 55 % ghost of each knight for the Valet preview"
  - "HitLayer: reports the lit knights within 44 screen px of a tap (nearest first); the reducer taps one or opens the tray"
  - "e2e/cartes-speciales.spec.ts: chooser, exit preview, Valet two taps with no auto-play, tray at phone size"
affects: [01-19, 01-20, 01-21, 01-22, 01-23, 01-24]

requirements-completed: [PLAY-02, PLAY-04, RULE-09]

actuals:
  tokens: 21000
  tasks: 2
  commits: 2
plan_head_before: c77aefd3b0dfcb690849cf0af8610482245e24f1
plan_head_after: d9fb98090b23957aa8b0eeb27aae5874d038b800

tech-stack:
  added: []
  patterns:
    - "The reducer owns every disambiguation: HitLayer only reports which lit knights are near a tap; stepFor(state, pawn) is the single place that says what a tap on a knight means in each state"
    - "Under the tray, Game.svelte derives the lit knights and the selected knight from tray.next, so the board keeps its halos while the chips are shown"
    - "Stable knights of one colour are one option (A-11): the tray never offers them as a choice"
    - "Tray letters are the knight's index A to D, falling back to the place in the tray when two options would share a letter"

key-files:
  created:
    - apps/web/src/ui/PawnTray.svelte
    - apps/web/e2e/cartes-speciales.spec.ts
  modified:
    - apps/web/src/game/turnUi.ts
    - apps/web/src/game/turnUi.test.ts
    - apps/web/src/ui/ActionZone.svelte
    - apps/web/src/board/Overlay.svelte
    - apps/web/src/board/HitLayer.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/i18n/fr/game.ts

key-decisions:
  - "« Sortir » restricts the preview's candidates to the exit and « Avancer » restricts the selection to the ring knights, so the chosen mode is never silently overridden by a tap; « Annuler ce coup » returns to idle and the player taps the card again to change his mind."
  - "A tap is a hit when it lands within the usual hit radius of a lit knight (max(22 screen px, footprint/2)); among the lit knights within 44 screen px of the tap, one distinct option is tapped and two or more open the tray (capped at 4, nearest first). A tap with no knight in the hit radius is still a miss with the « Choisis un des chevaux éclairés. » line."
  - "Valet: in the second tap the chosen own knight stays selected and tapping it again goes back to the first tap (and from the swap preview back to its targets); other own knights are not lit then. The chosen target gets the same selected style as the knight."
  - "Swap preview carries { a, b, aTo, bTo } read from resolveMove's pawnsSwapped event, so the ghosts show exactly where the engine will put each knight."

patterns-established:
  - "A reducer state that holds a card (`hasCard`) can always be left by the card, Annuler, Changer de carte or Échap; only closeTray returns to the previous selection"

coverage:
  - id: D1
    description: "As and Roi ask « Que veux-tu faire ? » when both exit and advance are legal; « Sortir » previews the exit onto the diamond without a knight tap; the chooser is skipped when only one mode exists"
    requirement: PLAY-04
    verification:
      - kind: unit
        ref: "apps/web/src/game/turnUi.test.ts#As and Roi: « Sortir ou avancer » (D-16, PLAY-04)"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/cartes-speciales.spec.ts#As et Roi : « Que veux-tu faire ? » … and #le Roi : « Avancer de 13 » … and #une seule façon de jouer …"
        status: pass
    human_judgment: false
  - id: D2
    description: "Valet in two taps with a swap preview (two crossing dashed arrows, ghost of each knight, « Échange avec un cheval {Couleur}. »); a single legal swap still waits for « Jouer »"
    requirement: RULE-09
    verification:
      - kind: unit
        ref: "apps/web/src/game/turnUi.test.ts#the Valet in two taps (PLAY-02, RULE-09)"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/cartes-speciales.spec.ts#le Valet : mon cheval, puis celui à échanger … and #le Valet : un seul échange possible attend quand même « Jouer »"
        status: pass
    human_judgment: true
    rationale: "Screenshots at 800 x 1000 show the S-shaped arrows crossing and both ghosts; the look of the arrows against the real knights is Romain's call. The swap itself is not animated yet (plan 01-19)."
  - id: D3
    description: "Tray of 2 to 4 chips with letters A to D, the same letters over the knights, « Choisir un autre cheval » closes it with the card still selected"
    requirement: PLAY-02
    verification:
      - kind: unit
        ref: "apps/web/src/game/turnUi.test.ts#the tray: knights too close to tell apart"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/cartes-speciales.spec.ts#chevaux serrés : le plateau propose des pastilles A et B …"
        status: pass
    human_judgment: true
    rationale: "Verified at 390 x 664 (phone project) and 375 x 667 (desktop project cut down); a real finger on a real phone is the final word on the 44 px proximity rule."
  - id: D4
    description: "Nothing is ever submitted without « Jouer »: the reducer returns a submit only on confirm, give and pose; two seconds after a swap preview and an exit preview nothing has moved"
    requirement: RULE-16
    verification:
      - kind: unit
        ref: "apps/web/src/game/turnUi.test.ts#never submits a single legal swap on its own (D-19)"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/cartes-speciales.spec.ts (two-second checks in the exit, Valet and tray cases)"
        status: pass
    human_judgment: false

duration: about 1 h
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 18: As et Roi « Sortir ou avancer », le Valet en deux touches, et les chevaux serrés Summary

**The As and the Roi now ask « Sortir un cheval » or « Avancer de 1|13 » when both are possible, the Valet is played in two taps with a crossing-arrows preview and a ghost of each knight, and knights too close for a finger open a tray of lettered chips; nothing is played without « Jouer ».**

## Performance

- **Duration:** about 1 h
- **Tasks:** 2 (two task commits)
- **Files:** 2 created, 7 modified (apps/web only)

## Accomplishments

- `turnUi.ts` replaces the interim As/Roi rule (stable knight = exit, ring knight = advance) with `modeChoice`; `chooseExit` previews the exit with no knight tap and `chooseAdvance` lights the ring knights. The Valet is `jackPick` (his knights with at least one swap) then `jackTarget` (the knights he can swap with) then a `preview` that carries both destinations read from the engine's own `resolveMove`. `tapAt` takes the lit knights near a tap and either taps the single distinct option or opens `tray { options, next }` (2 to 4); `chooseTrayOption` continues as if that knight had been tapped and `closeTray` returns to the previous selection. Modes, Valet knights and targets come only from `legalActions` (T-01-23).
- `ActionZone` shows the question and two 48 px buttons side by side, the two Valet prompts (and the « Choisis un des chevaux éclairés. » line on a miss), the swap description « Échange avec un cheval {couleur}. », and renders `PawnTray` in place of the prompt.
- `PawnTray`: chips of 44 x 56 with the mini knight of the colour and its letter, and the secondary « Choisir un autre cheval ».
- `HitLayer` reports every lit knight within 44 screen px of a tap that hit one (nearest first); the keyboard path still picks directly. `Overlay` draws letter badges over the tray's knights and, for the swap, two S-shaped dashed arrows that cross half way with arrowheads, plus a 55 % ghost of each knight at the other's place and the same selected style on both knights. `Game.svelte` derives the lit and selected knights from the state under the tray, so the halos stay while the chips are shown.
- `e2e/cartes-speciales.spec.ts` (7 cases, phone and desktop projects, 14 runs): the chooser for As and Roi with its button sizes, exit preview with a two-second nothing-moves check then « Jouer »; « Avancer de 13 »; both single-mode cases with no chooser; the Valet with two targets (two arrows, two ghosts, two-second check, the knights exchanged after « Jouer »); a single legal swap still waits and « Annuler ce coup » gives the card back; the tray at phone size with letters A and B, closing it, and choosing « Cheval B, bleu ».

## Task Commits

1. **Task 1: the reducer learns « Sortir ou avancer », the Valet in two taps and the tray** - `543f106` (feat)
2. **Task 2: As/Roi chooser, Valet swap preview and the tray on screen** - `d9fb980` (feat)

**Plan metadata:** the docs commit that adds this file.

## Verification

- `pnpm exec vitest run apps/web/src`: 12 files, 211 tests, all pass (52 in `turnUi.test.ts`, about 30 new for the chooser, the Valet and the tray).
- `pnpm typecheck` (tsc and svelte-check, 0 errors, 0 warnings) and `pnpm lint` (biome, 117 files): pass.
- `pnpm --filter @toc/web exec playwright test e2e/cartes-speciales.spec.ts`: 14 passed. Whole suite on a fresh debug build: 117 passed, 11 skipped (the explicit-viewport cases on the phone project), 0 failed.
- Screenshots read at 375 x 667 and 800 x 1000: the chooser, the tray with letters over the knights and the swap preview.

## Decisions Made

See `key-decisions`. In short: the mode chosen is never overridden by a later tap, the tray opens only when two or more distinct lit knights are within 44 screen px of a tap that hit one (a tap near a single knight just taps it), and the Valet's chosen knight can be tapped again to go back.

## Deviations from Plan

### Auto-fixed Issues

None needing a rule: the plan was executed as written.

### Other differences from the plan text

- **Task 1 touches `ActionZone.svelte`.** The new reducer states made the `lines` switch of `ActionZone` non-exhaustive (svelte-check error), and Task 1's verify includes `pnpm typecheck`; the wording of the new states (question, Valet prompts, swap description) is in the Task 1 commit, the buttons, tray and styling in Task 2.
- **`PreviewDescription` and the preview state grew.** `verb` gained `"swap"` with an optional `target`, and the preview state has an optional `swap: { a, b, aTo, bTo }`; the existing fields are unchanged.
- **Jack in `jackTarget`.** The plan's reducer text does not say how to change one's mind in the second tap; tapping the chosen knight again goes back (documented in `key-decisions`).
- **Catalogue.** `game.tray.chip(letter, color)` ( « Cheval B, bleu ») was added for the chips' accessible name; existing entries are untouched.
- **Existing unit tests.** Two cases of `turnUi.test.ts` encoded the interim rules (an As with an exit and an advance previewing straight from a knight tap, and the Valet producing no candidate). They now describe the new flow (chooser, `jackPick`); the 7 still produces no candidate.
- **Tracer spec unchanged.** « un As montre la sortie de l’écurie » (all knights in the stable: a single mode) still passes as written.

**Total deviations:** 0 auto-fixed, 0 architectural.

## Issues Encountered

- My first spec run failed twice on a wrong expectation of mine: with a single candidate the prompt is « Un seul cheval peut jouer cette carte : touche-le. », not « Choisis un cheval. ». The spec was corrected; no product change.
- Screenshots taken right after a click show the action zone mid cross-fade (150 ms); the readable ones wait 600 ms.

## Known Stubs

- The Valet swap is not animated: the render state changes the two places at once, without the crossing arcs, bounds or the surprised neigh (plan 01-19). The preview ghosts overlap the real knights at 55 %, which is by design until then.
- A card selected with no candidate knight (the 7, until plan 01-21) still shows « Choisis un cheval. » with nothing lit and only « Changer de carte » to leave; a hand whose only playable card is a 7 still blocks the player there.
- `COURT_FIGURES` is still empty (plan 01-20).

## Threat Flags

None. T-01-23 holds: `turnUi.ts` builds modes, Valet knights, targets and tray options only from `legalActions` and `resolveMove`, and the controller still submits through `apply()`, which rejects anything else. No package was added (T-01-SC).

## User Setup Required

None.

## Next Phase Readiness

- Plan 01-19 can animate the swap: the preview already exposes `swap.aTo` and `swap.bTo`, and the engine event is `pawnsSwapped`.
- Plan 01-21 adds the 7 splitter on the same `hasCard` / `tapAt` foundations; the tray accepts any state that holds a card and answers `stepFor`, so a 7 state only has to implement its own step.
- The tray letters come from `trayLetters(options)`; the 7 panel's `Cheval {letter}` plan lines can reuse it.

---
*Phase: 01-une-vraie-partie-sur-un-appareil*
*Completed: 2026-10-13*

## Self-Check: PASSED

Created files exist (PawnTray.svelte, cartes-speciales.spec.ts); commits `543f106` and `d9fb980` are in the branch history; `git rev-list --count` from `c77aefd` gives 2.
