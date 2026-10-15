---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 27
subsystem: web-ui
status: complete
tags: [gap-closure, keyboard, shortcuts, accessibility, uat-5]
requires:
  - phase: 01-26
    provides: "G15, rules-trace at 16 règles, 112 scénarios, vitest 656 passed"
provides:
  - "Pure key map keyIntent(input, ctx) and litKnights(flow, places) in apps/web/src/game/shortcuts.ts"
  - "Reducer event { t: 'back' } (one step back, the keyboard's Échap)"
  - "Help sheet « Raccourcis clavier » opened with « ? » (ShortcutsSheet.svelte, i18n/fr/clavier.ts)"
  - "UI-SPEC « Addendum 2026-10-14 — Raccourcis clavier (ordinateur) »: the contract of 01-27 and 01-28"
affects: [01-28]
tech-stack:
  added: []
  patterns:
    - "Keyboard shortcuts as a pure key → reducer-event map; Game.svelte only reads the key and the focus and dispatches"
    - "One capture-phase window keydown listener; handled keys are preventDefault-ed but not stopped (the audio first-gesture unlock listens on the document)"
key-files:
  created:
    - apps/web/src/game/shortcuts.ts
    - apps/web/src/game/shortcuts.test.ts
    - apps/web/src/ui/ShortcutsSheet.svelte
    - apps/web/src/i18n/fr/clavier.ts
    - apps/web/e2e/clavier.spec.ts
  modified:
    - apps/web/src/game/turnUi.ts
    - apps/web/src/game/turnUi.test.ts
    - apps/web/src/routes/Game.svelte
    - apps/web/src/board/HitLayer.svelte
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md
decisions:
  - "Échap is now the reducer's back (one step), not escape (drop the card); escape, cancel, changeCard and closeTray are unchanged and keep their tests"
  - "Handled shortcut keys are not stopPropagation-ed: a shortcut key must still reach the audio first-gesture unlock and resume retry on the document; HitLayer's knight handler skips defaultPrevented keys instead"
  - "Lit knights come from one function (litKnights) shared by HitLayer, Overlay and the key map"
metrics:
  duration: 26min
  completed: 2026-10-14
  tasks: 3
  files: 10
estimate:
  tokens: 85000
  tasks: 3
actuals:
  tokens: 18900
  tasks: 3
  commits: 4
plan_head_before: 539b9cc5052f6d74e7ffdaf36e013dc94cf7c810
plan_head_after: e99e98cce5ec618969e3e0906f0655cefe0020f8
---

# Phase 1 Plan 27: Jouer au clavier sur ordinateur (raccourcis directs et aide « ? ») Summary

You can now play the whole turn from the keyboard on a computer. Digits pick the card (or the steps of the 7), letters pick the lit knight, « Entrée » plays, « Échap » goes back one step, « S »/« A » answer the As/Roi question, « P » passes the card or lays the hand down, « Retour arrière » takes back a step of the 7, and « ? » opens the « Raccourcis clavier » sheet. Every key goes through the existing turnUi reducer.

## What was built

- **Contract** (01-UI-SPEC.md, « Addendum 2026-10-14 — Raccourcis clavier (ordinateur) »): the key map table, the rules (guards, physical digits with `event.code` for AZERTY, the Entrée focus rule), the « Échap » step-back table, the key-hint contract for 01-28 (fine pointer only, walnut/crème corner badges, `aria-keyshortcuts`, which buttons carry a key and which do not), the help sheet and its UI Considerations rows. The backstop is Romain re-running UAT test 5.
- **Key map** (`apps/web/src/game/shortcuts.ts`, pure, no DOM):
  - `keyIntent(input, ctx)` returns `TurnUiEvent[]`, the help intent, or null. It never returns an engine Action.
  - `litKnights(flow, places)` builds the one list of lit knights. HitLayer, Overlay and the key map all use it.
  - Two lit knights with the same letter send `tapAt`, so the tray opens. In the tray, a letter picks its chip (`trayLetters`).
- **Reducer** (`turnUi.ts`): new event `{ t: "back" }` handled by a private `back()`, which follows every row of the step-back table and never submits.
- **Screen** (`Game.svelte`):
  - One capture-phase window keydown listener builds the KeyContext and dispatches each event through the same helpers as a tap (`pickPawn`, `pickNear`, `pickTrayOption`, `chooseExit`, `send`).
  - The KeyContext holds the hand in fan order, the lit knights, `concealed`, the focus kind and `blocked`. `blocked` is true when a sheet layer is open, when the end screen is up, or when there is no game.
  - The old Échap window handler was removed.
  - `shortcutsOpen` mounts `ShortcutsSheet` with its opener.
- **Help** (`ShortcutsSheet.svelte` + `i18n/fr/clavier.ts`): 9 rows with `<kbd>` key caps (Label 14/700, walnut fill, crème border, no amber). The catalogue also holds `clavier.keys` and `clavier.link` for 01-28.

## Verification

| Gate | Result |
|------|--------|
| `pnpm exec vitest run apps/web/src` | 386 passed (shortcuts 57, turnUi 81 with « back: one step back (Échap) », typography incl. clavier.ts) |
| `pnpm typecheck` (svelte-check 272 files) | 0 errors, 0 warnings |
| `pnpm lint` (Biome) | clean |
| `pnpm test` | 725 passed, 2 skipped (was 656 passed, 2 skipped) |
| `node tools/rules-trace.mjs --images` | `rules-trace: OK (16 règles, 112 scénarios)` (unchanged) |
| Playwright desktop: clavier, cartes-speciales, audio, sons | 43 passed |
| Playwright desktop: partie-complete | passed |
| Playwright both projects: finition + partie-complete | 34 passed, 4 skipped. All 4 skips existed before this plan: phone skips for the 1280 × 800 pair, « sans le son » and partie-complete |
| Tracer gate (Task 1 verify, re-run before expanding) | vitest + typecheck + lint + clavier/finition desktop: 19 passed |

The 12 tests of `e2e/clavier.spec.ts` (desktop; the phone project skips them):
- the Dame tracer
- « cinq tours au clavier » (As « Sortir », 4, 7 split 3+4, Valet, Roi « Avancer », then the exchange of the next deal)
- « Échap revient d'un pas »
- « Retour arrière »
- the same-letter Valet tray
- « P » on a dead hand
- AZERTY `&`/Digit1
- the sheet guard
- « ? » help
- the end screen staying inert
- two added tests: the first shortcut unlocks the audio, and the Entrée focus rule

Only one test clicks anything: it opens Réglages for the sheet-guard check, which the plan allows.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Shortcut keys were cut off from the audio first-gesture unlock**
- **Found during:** Task 3 self-review
- **Issue:** the plan asked the listener to call `event.preventDefault()` and `event.stopPropagation()`. A window capture listener runs before the document capture listener of `unlockOnFirstGesture()` and before the document listeners of the audio resume retry. So on a game opened directly (reload, PWA relaunch), a keyboard-only player's first key never started the sound. The new e2e test failed before the fix (`data-audio` stayed empty).
- **Fix:** handled keys are only preventDefault-ed. That still cancels the native activation of a focused card or button. HitLayer's knight key handler now returns early on `event.defaultPrevented`, so « Entrée » on the previewed knight plays once and does not also tap it.
- **Files modified:** apps/web/src/routes/Game.svelte, apps/web/src/board/HitLayer.svelte (outside the plan's file list), apps/web/e2e/clavier.spec.ts
- **Commit:** e99e98c

**2. [Rule 1 - Test assumption] The next deal is not always five cards**
- **Found during:** Task 3, « cinq tours au clavier »
- **Issue:** I had written an assertion of my own (not in the plan) that the exchange hand holds 5 cards. The second deal has 4.
- **Fix:** the test now waits for the hand to be visible before pressing « 1 ». The plan's own assertions are untouched.
- **Commit:** a235f73

### Additions beyond the plan
- Two extra e2e tests (first-shortcut audio unlock; Entrée on « Annuler ce coup » vs on the previewed knight), plus extra unit cases: a 7 row with a selected knight, `?` on AZERTY's KeyM, and case-insensitive letters.

## Known Stubs

None. `clavier.keys` and `clavier.link` are written now and first used by plan 01-28 (key hints and the Réglages link), as the plan specifies.

## Threat Flags

None. No new network, storage or auth surface. T-01-36/37/38 are mitigated as planned: reducer events only (unit test), blocked behind sheets, fields and the end screen (unit + e2e), repeat ignored (unit).

## Self-Check: PASSED

- FOUND: apps/web/src/game/shortcuts.ts, apps/web/src/game/shortcuts.test.ts, apps/web/src/ui/ShortcutsSheet.svelte, apps/web/src/i18n/fr/clavier.ts, apps/web/e2e/clavier.spec.ts
- FOUND commits: 02134dc, d726210, a235f73, e99e98c
