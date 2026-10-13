---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 23
subsystem: settings-ui
tags: [svelte, settings, audio-mix, ambience, reduced-motion, sheet, playwright, fx-06]
status: complete

requires:
  - phase: 01-06
    provides: "settings store (toc.settings.v1), parseSettings clamping, updateSettings"
  - phase: 01-04
    provides: "audio engine setMix / startAmbience / pauseAmbience / stopAmbience, safe before unlock"
  - phase: 01-11
    provides: "Sheet.svelte with optional opener, CreditsSheet"
  - phase: 01-17
    provides: "info bar with the empty 44x44 settings slot"
  - phase: 01-22
    provides: "reduced-motion paths for cards and knights (Director mode read live from settings)"
provides:
  - "game/audioSettings.ts: mixFromSettings (settings to engine Mix) and shouldPlayAmbience (sound and ambience on, page visible, audio ready)"
  - "ui/Switch.svelte, ui/Slider.svelte: generic controls (role switch, native range with a 44 px thumb), dimmed and disabled states"
  - "ui/SettingsSheet.svelte: Réglages (Son, Bruitages, Ambiance + Volume de l’ambiance, Réduire les animations, Tester les sons, Crédits et licences), applies every change at once"
  - "Entry points: « Réglages » text button on the launch screen, 44x44 gear in the info bar"
  - "Game.svelte: mix applied from the settings, ambience started/paused/stopped by the settings and the page visibility"
  - "Debug builds: window.__tocDebug.audio.gains (bus gains the mix asks for) and .ambience (on | paused | off)"
affects: [01-24]

actuals:
  tokens: 9000
  tasks: 2
  commits: 3
plan_head_before: 2e2da5110e2b4b67c05ce1fe6f06b07bb70e8ac5
plan_head_after: 94a9465e2ec72dbd92d0b7ea34d2e8680168f4dd

tech-stack:
  added: []
  patterns:
    - "A sheet stack in Sheet.svelte: only the top sheet answers to Échap and to focus leaving, so a sheet can open over another"
    - "Settings reach the audio buses through one pure mapping (mixFromSettings) applied by an $effect in SettingsSheet and in Game"
    - "Debug-only e2e probes live in window.__tocDebug.audio behind the compile-time DEBUG switch (gains, ambience)"

key-files:
  created:
    - apps/web/src/game/audioSettings.ts
    - apps/web/src/game/audioSettings.test.ts
    - apps/web/src/ui/Switch.svelte
    - apps/web/src/ui/Slider.svelte
    - apps/web/src/ui/SettingsSheet.svelte
    - apps/web/src/i18n/fr/reglages.ts
    - apps/web/e2e/reglages.spec.ts
  modified:
    - apps/web/src/audio/engine.ts
    - apps/web/src/debug.ts
    - apps/web/src/ui/Sheet.svelte
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/routes/Launch.svelte
    - apps/web/src/routes/Game.svelte

key-decisions:
  - "SettingsSheet renders CreditsSheet as a sibling and Sheet.svelte keeps a module-level stack of open sheets; a naive nesting made the two focus traps fight (focusin loop)"
  - "« Son » off dims the Bruitages and Ambiance rows (and the volume) but leaves them usable; « Ambiance » off dims and disables the volume slider, still visible"
  - "Ambience lifecycle in Game: stop for good when Son or Ambiance goes off, pause with the hidden tab, start (1.5 s fade-in by the engine) once the audio status is ready; it stops when the player leaves the game screen"
  - "The debug bus gains are the gains the last setMix asked for (written in the shell setMix, valid before and after unlock), not a read of the GainNode, so the specs are deterministic with a suspended context"
  - "The Game window keydown ignores Échap while a sheet is open, so closing Réglages does not deselect the card behind it"

patterns-established:
  - "Sheet over sheet: render the second sheet as a sibling, pass the button that opened it as `opener`"
  - "Dependent controls: dim with opacity 0.4 on the whole row, disable only what the spec says is disabled"

requirements-completed: [FX-06]

duration: 14 min
completed: 2026-10-13

coverage:
  - id: D1
    description: "Réglages opens from the launch screen and from the 44x44 gear of the game, with the five settings at their defaults and every control a 44 px target"
    requirement: FX-06
    verification:
      - kind: e2e
        ref: "apps/web/e2e/reglages.spec.ts#la feuille propose les cinq réglages, aux valeurs par défaut"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/reglages.spec.ts#la roue dentée de la barre d’info (44 x 44) ouvre la même feuille"
        status: pass
    human_judgment: false
  - id: D2
    description: "Changes apply instantly and persist in toc.settings.v1 across a reload; reduce-motion starts from prefers-reduced-motion and the player's choice then wins"
    requirement: FX-06
    verification:
      - kind: e2e
        ref: "apps/web/e2e/reglages.spec.ts#chaque réglage change aussitôt, est gardé et revient après rechargement"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/reglages.spec.ts#allumé au départ, et le choix du joueur l’emporte ensuite"
        status: pass
    human_judgment: false
  - id: D3
    description: "Son off silences everything, Bruitages off the effects only, Ambiance off or its volume the ambience only (bus gains), with dimmed dependent rows and a disabled volume"
    requirement: FX-06
    verification:
      - kind: unit
        ref: "apps/web/src/game/audioSettings.test.ts#mixFromSettings"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/reglages.spec.ts#« Son » coupe tout, « Bruitages » les effets, « Ambiance » et son volume l’ambiance"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/reglages.spec.ts#« Son » coupé en partie met aussitôt le bus principal à zéro"
        status: pass
    human_judgment: false
  - id: D4
    description: "The ambience starts in the game, pauses with the hidden page and stops when Ambiance or Son goes off"
    requirement: FX-06
    verification:
      - kind: unit
        ref: "apps/web/src/game/audioSettings.test.ts#shouldPlayAmbience"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/reglages.spec.ts#l’ambiance démarre dans la partie, se met en pause avec la page et s’arrête quand on la coupe"
        status: pass
    human_judgment: true
    rationale: "The e2e proves the request to the engine (debug flag); whether the countryside loop is actually audible with a 1.5 s fade-in is a listening judgement for Romain"
  - id: D5
    description: "Réduire les animations on makes the next move a single 180 ms animation"
    requirement: FX-06
    verification:
      - kind: e2e
        ref: "apps/web/e2e/reglages.spec.ts#« Réduire les animations » fait du coup suivant un seul glissement de 180 ms"
        status: pass
    human_judgment: false
  - id: D6
    description: "« Tester les sons » opens #/sons and « Crédits et licences » opens the credits sheet over Réglages (Échap closes them one by one, focus returns to the opener)"
    requirement: FX-06
    verification:
      - kind: e2e
        ref: "apps/web/e2e/reglages.spec.ts#« Tester les sons » ouvre la page de test des sons"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/reglages.spec.ts#« Crédits et licences » ouvre les crédits, Échap les ferme un par un"
        status: pass
    human_judgment: false
---

# Phase 1 Plan 23: « Réglages » Summary

**Réglages sheet (Son, Bruitages, Ambiance with volume, Réduire les animations, sound test and credits links) reachable from the launch screen and the in-game gear, wired to the audio buses, the ambience lifecycle and the motion mode through one pure settings-to-mix mapping.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-13T21:42:00Z
- **Completed:** 2026-10-13T21:56:00Z
- **Tasks:** 2 (3 commits: TDD red, task 1, task 2)
- **Files modified:** 13

## Accomplishments
- `mixFromSettings` and `shouldPlayAmbience` are pure and unit-tested (every switch combination, visibility and readiness).
- `SettingsSheet` with the generic `Switch` and `Slider`: changes apply at once, persist in `toc.settings.v1`, and dim or disable dependent controls as the UI-SPEC says.
- The launch screen « Réglages » button and the 44x44 info-bar gear open the same sheet; « Crédits et licences » opens over it, « Tester les sons » goes to `#/sons`.
- `Game.svelte` applies the mix and runs the ambience lifecycle (start when ready, pause when the tab is hidden, stop when Son or Ambiance goes off or the player leaves the game).
- `e2e/reglages.spec.ts` (11 cases on phone and desktop) covers defaults, persistence, bus gains, dimming, links, the credits-over-settings Escape order, the ambience request and the 180 ms reduced move.

## Task Commits

1. **TDD red: audioSettings tests** - `3d24962` (test)
2. **Task 1: Réglages from the launch screen** - `c5cf4dd` (feat)
3. **Task 2: Réglages in game, ambience lifecycle** - `94a9465` (feat)

**Plan metadata:** the docs commit that adds this summary.

## Files Created/Modified
- `apps/web/src/game/audioSettings.ts` - settings to engine mix, ambience rule
- `apps/web/src/ui/Switch.svelte`, `Slider.svelte` - generic controls
- `apps/web/src/ui/SettingsSheet.svelte` - the sheet; applies the mix, hosts the credits sheet
- `apps/web/src/i18n/fr/reglages.ts` - French copy with the French typography
- `apps/web/src/ui/Sheet.svelte` - stack of open sheets (only the top one handles Échap and focus)
- `apps/web/src/ui/InfoBar.svelte` - gear button and sheet; `routes/Launch.svelte` - « Réglages » button
- `apps/web/src/routes/Game.svelte` - mix, ambience lifecycle, Échap guard while a sheet is open
- `apps/web/src/audio/engine.ts`, `debug.ts` - `busGainsFor`, debug-only `gains` and `ambience`
- `apps/web/e2e/reglages.spec.ts` - e2e spec

## Decisions Made
See `key-decisions` in the frontmatter. Noteworthy: the debug bus gains are the requested gains (deterministic with a suspended context), and the Director mode needed no change because `session.svelte.ts` already reads `settings.reduceMotion` and `settings.fast` on every use.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Sheet over sheet made the two focus traps loop**
- **Found during:** Task 1 (opening « Crédits et licences » from Réglages)
- **Issue:** Each `Sheet` refocuses itself when the focus leaves its dialog and closes on Échap; two open at once would fight for the focus and both close on one Échap.
- **Fix:** `Sheet.svelte` keeps a module-level stack of open sheets; only the top one answers to Échap and `focusin`. `SettingsSheet` renders `CreditsSheet` as a sibling.
- **Files modified:** `apps/web/src/ui/Sheet.svelte` (not in the plan's `files_modified`)
- **Verification:** e2e « Crédits et licences » (Échap closes the credits first, then Réglages, focus returns to each opener)
- **Committed in:** `c5cf4dd`

**2. [Rule 3 - Blocking] Debug type declarations**
- **Found during:** Task 1 and Task 2
- **Issue:** `window.__tocDebug.audio` is typed in `apps/web/src/debug.ts`; the new `gains` and `ambience` probes needed declaring there (not in `files_modified`).
- **Fix:** two optional fields added; they are written only inside `if (DEBUG && window.__tocDebug)` branches (compile-time constant), so production builds drop them (T-01-24).
- **Files modified:** `apps/web/src/debug.ts`
- **Committed in:** `c5cf4dd`, `94a9465`

**3. [Rule 2 - Missing critical] Échap in the game also deselected the card behind an open sheet**
- **Found during:** Task 2
- **Issue:** `Game.svelte`'s window keydown sends `escape` to the turn flow even when a sheet is open.
- **Fix:** it returns early when a `[data-sheet-layer]` exists.
- **Files modified:** `apps/web/src/routes/Game.svelte`
- **Committed in:** `94a9465`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** All three are small and necessary for the planned behaviour. No scope creep; no package added.

## Issues Encountered
- A full e2e run (`playwright test`, 212 passed, 25 skipped) had one failure, `animations.spec.ts` « onglet caché » on desktop (the final assertion counts four exchange card flights recorded by a requestAnimationFrame loop). It passes 6 of 6 when run alone and on the phone project in the full run; it looks like a timing race of that spec's recorder under load, unrelated to this plan (nothing there touches settings or sheets). Not modified.
- The slider thumb is 43.99997 px tall while the sheet slides in (transform rounding), so the 44 px assertion in the spec has 0.01 px of slack.

## Known Stubs
None.

## Threat Flags
None. The only new surface is `window.__tocDebug.audio.gains` and `.ambience`, behind the compile-time `DEBUG` switch (T-01-24 mitigated; no package added, T-01-SC).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 01-24 can add « Abandonner la partie » at the bottom of `SettingsSheet` (in-game only) and the audio and error states; `SettingsSheet` is already mounted from the info bar.
- To check by ear (Romain): the ambience fade-in and its volume curve at 30 %, and that « Son » off is truly silent on a phone.

## Self-Check: PASSED

---
*Phase: 01-une-vraie-partie-sur-un-appareil*
*Completed: 2026-10-13*
