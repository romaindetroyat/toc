---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 48
subsystem: ui
status: complete
tags: [layout, compact, phone-landscape, plateau-sur-toute-la-hauteur, recette-3, uat-24, gap-closure, e2e]
requires:
  - "01-47 (the compact mode: full-height galet, strips, prompt row, pill)"
provides:
  - "e2e/compact.spec.ts: the 7 tracer at 750 x 342, « chaque état du tour, plateau sur toute la hauteur » at 750 x 342 and 480 x 320 (13 states), the five sizes with strips at 60 px and the prompt row at 24 px, five captures"
  - "Overlay.svelte badgeAt(y, size): a « +n » badge never rises above the board's top edge"
  - "01-UI-SPEC.md: « Le plateau sur toute la hauteur du téléphone » in the addendum « Recette 3 de Romain »"
affects: ["01-54 (Romain's re-test on his iPhone)"]
tech-stack:
  added: []
  patterns:
    - "A control in a scrolling column is checked by its part inside the column, and the column must then scroll"
key-files:
  created: []
  modified:
    - apps/web/e2e/compact.spec.ts
    - apps/web/src/board/Overlay.svelte
    - apps/web/e2e/cibles.spec.ts
    - apps/web/e2e/finition.spec.ts
    - apps/web/e2e/partie.spec.ts
    - apps/web/e2e/reglages.spec.ts
    - apps/web/e2e/cartes-speciales.spec.ts
    - apps/web/e2e/table.spec.ts
    - apps/web/e2e/board.spec.ts
    - apps/web/src/board/Board.svelte
    - apps/web/src/ui/InfoBar.svelte
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md
decisions:
  - "The « +n » badge of a top-row cell is lowered just enough to stay on the board, everywhere (computer included): the prompt row stands right over the galet on the phone"
  - "The As/Roi question keeps its two amber buttons: the state checks expect exactly 2 primaries there, 1 at most elsewhere (exception of 01-36, kept by 01-47)"
  - "The 7's step chips already need their scrolling column at 750 x 342 (chips 6 and 7 below the edge), not only at 480 x 320: written into the UI-SPEC as a point to confirm"
  - "InfoBar's « side » form (the 96 px column of 01-37) was unused since 01-47 and is removed"
metrics:
  duration: "24 min"
  completed: 2026-10-15
  tasks: 2
  files: 12
estimate:
  tokens: 90000
  tasks: 2
actuals:
  tokens: 23500
  tasks: 2
  commits: 2
plan_head_before: 916fd893476e9aadc9f699e5be2edecd673156dc
plan_head_after: 0b4639e469e87802fd2f885524c9199a65e0a593
---

# Phase 1 Plan 48: Le plateau sur toute la hauteur du téléphone (2/2) Summary

**Every state of a turn is now proven in the browser beside the full-height galet, at 750 × 342 and 480 × 320. The five phone sizes measure exactly the formula (724, 630, 547, 448 and 360 px), with 60 px strips and a 24 px prompt row. The other specs follow the new layout, and the whole Playwright suite passes on both projects: 341 passed, 0 failed. A « +n » badge no longer covers the end of the prompt line. The layout is written into 01-UI-SPEC.md for Romain to confirm.**

## What was built

### Task 1 (tracer), daa2b7d: compact.spec.ts

- **The 7 tracer** at 750 × 342: tap the 7, then a knight and 4 steps, the other knight and 3 steps, then « Jouer ». It checks:
  - « Reste 7 » → « Reste 3 » → « Tout est réparti. » in the one-line prompt row, over the board;
  - the seven 44 × 44 chips in the left strip;
  - « Jouer » in the right strip;
  - both knights leave their cells.
- **« chaque état du tour, plateau sur toute la hauteur, à ${name} »** at 750 × 342 and 480 × 320, six tests per size covering:
  - no card chosen;
  - the As question and the Roi question;
  - two lit knights;
  - the preview, including the one that comes by itself for a lone knight (Dame);
  - the bots' wait with « Avance rapide » (icon only, its title);
  - the Valet's two taps and its preview;
  - « Lequel ? », alone and inside the 7;
  - the 7 with nothing spread, its seven chips, one knight given its steps, and all spread;
  - the exchange, with and without a card chosen, and its waiting line;
  - the dead hand and the posed hand.

  In each state `expectState` checks:
  - every visible control outside the board (buttons, cards, chips) is inside the screen and never over the board's rectangle (only the board's own knights, hit layer and felt may be);
  - every target is at least 44 × 44;
  - at most three state buttons, and the exact number of primaries (1 at most, 2 for As/Roi);
  - the prompt row is one line of 24 px or less, right over the board;
  - no « +n » badge above the board's top edge;
  - `document.scrollingElement` cannot be scrolled, even by a script.

  A control inside a scrolling column (the 7's chips) is measured by its part inside the column, and the column must then really scroll.
- **The size block** now covers the five sizes. At each one:
  - the board is within 2 px of the formula and above its minimum;
  - both strips are 60 ± 1 px (every size is width-limited);
  - the prompt row's top is 24 px above the board, and the row is 24 px or less;
  - a capture is taken.
- **`expectStrips`** (from 01-47) now also handles the scrolling chip column (see deviation 2).
- **Tracer gate:** after the commit, compact.spec (19 passed), typecheck and lint were green, so the plan went on.

### Task 2, 0b4639e: the other specs, comments, UI contract

| Spec | 01-47 failure | Change (intent kept) |
|---|---|---|
| cibles.spec.ts:59 (×5 sizes) | measured horizontal slices between the cards | the slice is measured along the hand: across in the bar's fan, down in the column. Still ≥ 44 px |
| cibles.spec.ts:147 | `[data-seven-panel]` box (now display: contents) | « le 7 autour du plateau »: the board stays 2:1 and inside the screen. The line is over the board, the buttons are in the right strip, « Jouer » is reachable and the page has no scroll |
| cibles.spec.ts:185 | the plan list scrolled inside the panel | after 7 micro-moves, the line, the buttons and the board keep their boxes. The line is cut with « … » and its title holds the whole plan, ending with the newest row (the 01-47 design: one line) |
| finition.spec.ts:262 (×4 sizes, both projects) | `[data-seven-panel]` box | « l’assistant du 7 tient sous le plateau ou autour de lui »: the bar keeps the panel check. On the phone, each of the three parts (line, chips, buttons) must be above, beside or below the board, in three states |
| finition.spec.ts:370 (phone) | the first Tab stop is « Réglages » | on the phone it is the info pill (« Infos de la partie : … »), then « Réglages ». The bar is unchanged |
| partie.spec.ts:39, :151, :199 (phone) | « Donneur », « Donne 1 sur 3 », « Nous n/8 » in `[data-info-bar]` | `checkInfo`: on the phone it opens the pill's sheet, checks the same texts there and closes it with Échap |
| reglages.spec.ts:210 (phone) | the gear inside `[data-info-bar]` | the gear is looked for in `[data-settings-slot]` (bar or right strip); still 44 × 44, and the focus still returns to it |
| cartes-speciales.spec.ts:20 (phone) | « Sortir » / « Avancer de 1 » side by side | in the compact mode they must be stacked, one under the other. The bar still expects them side by side |
| cartes-speciales.spec.ts:265 (phone) | visible title « Le 7 : répartis tes pas » | the region's accessible name is checked on both projects; the visible title on the bar only |
| table.spec.ts:175 | 844 × 390 board of 625 px | the compact formula, 724 px (knights-724.png) |

- **Stale comments.** Board.svelte (the felt's 314 px container query), board.spec.ts, finition.spec.ts (« side panel until 01-37 ») and cartes-speciales.spec.ts (« compact bar of 01-37 ») now describe the full-height layout. InfoBar's unused « side » form is removed, with its 60 lines of CSS and its type member. The « row » form's comment now says that it is only the hidden form behind « Tourne ton téléphone ».
- **01-UI-SPEC.md**, addendum « Recette 3 de Romain », new subsection « Le plateau sur toute la hauteur du téléphone »:
  - « Décidé par Romain »: his words and his choice;
  - « Dérivé du planificateur, à confirmer par Romain », twelve numbered points: the prompt row, the strips, the hand column, the pill and its sheet, « Réglages »/« Avance rapide », the state buttons, the short labels table, the 7 and « Lequel ? » in the strips, the toast, the « +n » badge and the small phones;
  - « Faits techniques »: the mode name `compact`, the formula and grid, the parts, the focus order, `badgeAt`, the proofs;
  - « Objectifs de taille »: the measured widths next to the formula and the 01-37 widths, then the iPhone 13 computations (Safari ≈ 594 px, step ≈ 19,9 px; installed ≈ 630 px, step ≈ 21,1 px);
  - the « UI Considerations » table.

  Items 8, 9 and 10 of « Plateau galet » now point to the new subsection. Two stale mentions from deferred-items.md are fixed: `sceneXY(place, k)`, and the portrait scene is described as removed by 01-40.

## Measured widths (Chromium emulation, insets 0)

| Window | Formula | Measured | Before (01-37) | Step |
|---|---|---|---|---|
| 844 × 390 | min(724, 732) | 724 | 625 | ≈ 24.2 px |
| 750 × 342 | min(630, 636) | 630 | 533 | ≈ 21.1 px |
| 667 × 375 | min(547, 702) | 547 | 559 | ≈ 18.3 px |
| 568 × 320 | min(448, 592) | 448 | 383 | ≈ 15.0 px |
| 480 × 320 | min(360, 592) | 360 | 372 | ≈ 12.0 px |

## Captures

Each capture shows a turn in progress: the Dame selected and its lone knight's preview, with « Annuler »/« Jouer » in the right strip. test-results/ is emptied by every Playwright run, so copies are kept in the session scratchpad:
- `apps/web/test-results/galet-emulation-844x390.png`
- `apps/web/test-results/galet-emulation-750x342.png`
- `apps/web/test-results/galet-emulation-667x375.png`
- `apps/web/test-results/galet-emulation-568x320.png`
- `apps/web/test-results/galet-emulation-480x320.png`
- copies: `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots-01-48/galet-emulation-{844x390,750x342,667x375,568x320,480x320}.png`

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green. svelte-check reports 0 errors and 0 warnings, Biome is clean, and vitest has **787 passed, 2 skipped** (unchanged).
- `playwright test e2e/compact.spec.ts --project=desktop`: **19 passed**.
- **Full Playwright suite, both projects (phone = iPhone 13 landscape, desktop = 1280 × 800): 341 passed, 87 skipped, 0 failed** (428 tests). Before: 305 passed, 84 skipped, 33 failed (422 tests). The 6 new tests are the 7 tracer and one extra state test per size. Each of them runs on the desktop project and is skipped on the phone project, which uses explicit viewports; that adds the 3 skips.
- ecrans.spec.ts is untouched and passes: the computer's bar widths are unchanged (1227 px at 1280 × 800).
- `node tools/rules-trace.mjs`: « rules-trace: OK (16 règles, 118 scénarios) ».
- The frameClock invariant holds: there is no `.animate(` in apps/web/src/board outside frameClock.ts.
- `grep -rniE "side panel until|until 01-37" apps/web/src apps/web/e2e` is empty. `grep -c "plateau sur toute la hauteur" e2e/compact.spec.ts` gives 2 (both describe titles).
- The preview server started for these runs (port 4173) was stopped by its PIDs.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] A « +n » badge of a top-row cell rose into the prompt row** (the overlap 01-47 reported)
- **Found during:** Task 1. The new state check fails on « le 7, tout réparti » at 750 × 342 and 480 × 320 with the old Overlay. This was proven by putting the old file back for one run: 2 failed. The check passes with the fix.
- **Fix:** `badgeAt(y, size)` in Overlay.svelte keeps the top of the badge's circle (21 px radius plus its stroke) at or below the scene's top edge, for both the destination badge and the 7's ghost badges. The badge moves down only when it would leave the board.
- **Commit:** daa2b7d

**2. [Rule 1 - Test bug] `expectStrips` (01-47) required every step chip inside the screen**
- **Found during:** Task 1. At 750 × 342 the « 7 pas » chip ends at y = 384 inside its scrolling column (6 and 7 are below the edge); at 480 × 320, « 6 pas » too. 01-47 accepted this as designed.
- **Fix:** a chip is measured by its part inside its column, and a cut chip requires the column to scroll. Nothing else was relaxed. The 44 × 44 size, the strip side and the screen bounds are still checked on the visible part.
- **Commit:** daa2b7d

### Expectations updated because the layout legitimately changed

See the Task 2 table. Each of these specs measured the 01-37 band or the old info bar. Each one keeps its intent:
- targets ≥ 44;
- nothing over the board;
- everything on screen with no scroll;
- the same texts, now read in the pill's sheet;
- the Tab order as the 01-47 design gives it.

One expectation is weaker than before: cibles « beaucoup d’étapes » no longer asserts that the newest row is visible. In the 24 px line it is cut by « … » by design, so the test now checks that the title ends with it.

### Choices within the plan's latitude

- The 7 tracer sits in the existing tracer describe, before the state tests. The state tests cover 13 states per size, more than the 10 listed: they add the Roi, the bots' wait and the 7 with « Lequel ? ».
- The UI-SPEC « à confirmer » list adds three points from 01-47's decisions: the 58 px buttons, the badge, and the chips scrolling at 750 × 342.

## Known Stubs

None.

## Threat Flags

None. T-01-75 is accepted: the captures are of a local seeded game. No package was added (T-01-SC).

## For Romain (plan 01-54)

- On the iPhone 13 the board should be about 594 px wide in Safari (it was about 493) and about 630 px in the installed app (about 585).
- With the 7, the step chips 6 and 7 are below the edge of the left strip on a phone held sideways. Slide the column to reach them.
- The short button labels, the « Infos de la partie » pill and the « Lequel de ces chevaux ? » line are new copy for him to confirm.

## Commits

The measured range `916fd89..0b4639e` holds 2 commits:
- daa2b7d (Task 1, tracer)
- 0b4639e (Task 2)

This SUMMARY is committed separately.

## Self-Check: PASSED

- FOUND: apps/web/e2e/compact.spec.ts (« plateau sur toute la hauteur » ×2, 480), apps/web/src/board/Overlay.svelte (badgeAt), 01-UI-SPEC.md (« Le plateau sur toute la hauteur du téléphone »)
- FOUND: daa2b7d, 0b4639e (ancestors of HEAD)
- FOUND: the five captures in test-results/ and in the scratchpad copy
