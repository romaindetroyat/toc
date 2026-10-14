---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 37
subsystem: ui
status: complete
tags: [layout, plateau-galet, paysage-obligatoire, compact-bar, phone-landscape, e2e, gap-closure]
requires:
  - "01-36 (the screen store and its compact-bar mode, the computer's bar)"
provides:
  - "Game.svelte: the compact-bar layout (--info-col 96px, --band-edge 12px, --band-row 64px, --band-buttons 184px, --band 64px or 56 + 64 px) in place of the 01-24 side panel; the board formula max(0, min(100vw − 96 − 12 − insets, (100dvh − band − insets) / (ratio + head room)))"
  - "fan.ts: BAND_CARD (64 x 90), BAND_ROW, BAND_TOP, BAND_LIFT, bandLayout(n, width), bandVisible(selected, row)"
  - "HandFan `band`, InfoBar `form=\"side\"`, ActionZone `band`, PawnTray `band`, SevenPanel `band`"
  - "e2e/compact.spec.ts: the tracer at the iPhone 13 landscape window, every turn state at 750 x 342 and 480 x 320, the five landscape phone targets against the formula, captures test-results/galet-emulation-844x390.png, -750x342.png, -480x320.png"
  - "cibles.spec.ts at the five landscape phone sizes"
  - "01-UI-SPEC.md addendum « Plateau galet »: items 5 (copy), 8, 9, 10 and « Objectifs de taille » revised, the re-test in plan 01-41"
affects: ["01-38", "01-39", "01-40", "01-41"]
tech-stack:
  added: []
  patterns:
    - "Two grid items in one area (info and stage in « top »), the stage's margins being the formula's own terms, so the board formula subtracts exactly what renders"
    - "A cut card: the card's box is what shows of it (the slot's height), its face drawn as a full card inside, so no box ever passes the screen's edge"
key-files:
  created:
    - apps/web/e2e/compact.spec.ts
  modified:
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md
    - apps/web/src/routes/Game.svelte
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/ui/ActionZone.svelte
    - apps/web/src/ui/HandFan.svelte
    - apps/web/src/cards/fan.ts
    - apps/web/src/cards/cards.test.ts
    - apps/web/src/ui/PawnTray.svelte
    - apps/web/src/ui/SevenPanel.svelte
    - apps/web/e2e/cibles.spec.ts
decisions:
  - "In the band's hand, each card's box is the part that shows (56 px, 64 px once selected) and its face is drawn as a full 64 x 90 card inside, cut at the screen's bottom edge: finition.spec's « nothing ends below the screen » holds unchanged"
  - "The info column's own form « side » (a grid: the gear, the lines, the pills stacked) hides « Tour de » visually as the existing below-360 px rule does, so it fits the 200 px a 320 px high screen leaves beside the board (à confirmer par Romain)"
  - "In the one-row band, the 7 assistant's « Lequel ? » tray takes the whole row and its 20 px line steps aside while the tray is up: 20 + 56 px do not fit in 64 (à confirmer par Romain)"
  - "As/Roi keeps its two amber buttons in the compact bar, as in the computer's bar of 01-36 (the spec asserts exactly 2 there, 0 or 1 elsewhere)"
metrics:
  duration: "60 min"
  completed: 2026-10-14
  tasks: 3
  files: 11
estimate:
  tokens: 110000
  tasks: 3
actuals:
  tokens: 21600
  tasks: 3
  commits: 5
plan_head_before: dbb0ea0e344278ecd807f023418134b3dfe25b71
plan_head_after: 77e46890a2fb1ae15b01297483770edd9e68166a
---

# Phase 1 Plan 37: Sur le téléphone tenu en largeur, la barre compacte Summary

On every landscape screen below 960 x 600 (a phone held sideways, a small window) the side panel of 01-24 is gone. The info now stands in a 96 px column at the left of the galet, and the compact bar runs under them across the screen:
- from 640 px wide, one 64 px row: the hand of flat 64 x 90 cards at the left, the prompt in the middle, the state's buttons at the right;
- below 640 px, two rows of 56 px (prompt, buttons) and 64 px (hand).

The board is 533 px wide in Playwright's iPhone 13 landscape window (750 x 342), where the 01-24 side panel gave 382 px. That is 625 px at 844 x 390 and, by calculation, about 585 px with cells about 19.6 px apart on Romain's installed iPhone 13 held sideways.

## What was built

- **Task 1 (tracer), cd9e5f9.**
  - **01-UI-SPEC.md**, addendum « Plateau galet » (the part « Décidé par Romain » untouched):
    - item 8 revised (the opening sentence of the plan, the 96 px column, one 64 px row from 640 px, two rows below, the formula with 108 px and a 64 or 120 px band, the 7 and the tray in the bar);
    - item 9 revised (flat 64 x 90 cards, 8 px top and lift, 56 px shown, 44 px slices, buttons, unchanged texts, focus order, shortcuts and targets);
    - « Objectifs de taille » rewritten with the five compact rows, their calculation and step, the real-device list and the honest comparison with the 136 px bar;
    - item 5 gained the invitation's copy;
    - the UI Considerations row now reads « 64 px (trois lignes) ou 56 px (deux lignes) »;
    - the re-test is now plan 01-41, and the range 01-34 à 01-41.
  - **fan.ts:** the band's geometry (`BAND_CARD`, `BAND_ROW`, `BAND_TOP`, `BAND_LIFT`, `bandLayout`, `bandVisible`). cardSize, fanLayout and the regular fan are unchanged. **cards.test.ts** covers four behaviours: 44 px slices with five cards in 240 px, one to five cards inside the row, the lifted card at or below the row's top, and at least 56 px of each card shown.
  - **HandFan `band`:**
    - the `.fan` box is var(--band-row);
    - the slots are flat, and each slot's height is what shows of its card (56 px, 64 px once selected);
    - the card's face is drawn as a full 90 px card and cut at the box's bottom edge.
  - **InfoBar `form="side"`:** a grid with the gear (44 x 44) on top, the turn and dealer lines wrapping under it, then the two pills stacked.
  - **ActionZone `band`:**
    - a two-column grid, the prompt at the left in Label 14 (it scrolls inside past its row) and the buttons' area of --band-buttons at the right, kept in every state;
    - « Avance rapide » takes that area with its icon and label;
    - the exchange's givers take the prompt's place, the sentence stays for screen readers.
  - **Game.svelte:**
    - under the store's compact-bar query, the side panel rules (and the max-height 400 px block) are replaced;
    - the info and the stage share the « top » area, the stage's margins being --info-col and --band-edge, so the board formula subtracts exactly what renders;
    - the band rows, the walnut band and `overflow: clip`, then the two-row rule below 640 px;
    - Game passes `band` to HandFan, ActionZone and SevenPanel, and `form="side"` to InfoBar;
    - the DOM order is unchanged and the style header describes the three modes.
  - **compact.spec.ts tracer** at `devices["iPhone 13 landscape"].viewport` on R-07.1:
    - data-chrome compact-bar, and the info at the left of the board;
    - both band boxes 64 px on one row, the hand left of the action zone;
    - the board within 2 px of the formula, at least 520 px, and 2:1;
    - after the Dame, every card's top 8 px under the band's top (the selected card's at its top);
    - « Jouer » at least 44 x 44, right of the fan, and bleu0 on the drawn cell 15 (offCell ≤ 0.5);
    - no scroll.
  - Tracer gate: the verify was re-run end to end and passed (compact, tracer, ecrans on both projects: 29 passed, 15 skipped), then the plan continued.
- **Task 2, a9d810a.**
  - **PawnTray `band`:** the chips on one line in the prompt's place, « Choisir un autre cheval » filling the buttons' area. The action zone passes it on.
  - **SevenPanel `band`:**
    - one row: a grid with the 20 px line (the title, « Reste n », the prompt and the plan, scrolling sideways) over the 44 px step chips (scrolling sideways when narrower), and the three buttons at the right;
    - two rows: the line and the plan in the 56 px row, the chips and the buttons in the 64 px row;
    - never taller than --band; its tray takes the chips' place.
  - **compact.spec.ts** at 750 x 342 and 480 x 320, for each state below:
    - the states: idle, As (« Avancer de 1 », the knight, the preview), Roi (« Avancer de 13 »), the « Lequel ? » tray and its B preview, the exchange's waiting at natural pace (the three givers inside the zone), the exchange choice before and after a card is chosen, the dead hand, the waiting state with « Avance rapide » (label, aria-pressed), and the 7 at four fill levels up to « Tout est réparti. » with two plan rows;
    - every control at least 44 x 44 and inside the screen, the band's own inside the band;
    - the amber count, var(--band) resolved to 64 or 120 and the band's boxes starting at its top;
    - every shown prompt whole at 750 x 342, and no scroll;
    - at 480 x 320, the board at least 360 px.
- **Task 3, 22f4563.**
  - **compact.spec.ts:** the size matrix « émulation Chromium (insets 0) », each size with its formula in a comment:
    - checked at each size: data-chrome, the band rows, the info column, the board against the formula and its target, 2:1, a move played (the Dame, bleu0, « Jouer », the drawn cell 15) and no scroll;
    - with a card selected it saves the captures test-results/galet-emulation-844x390.png, -750x342.png and -480x320.png.
  - **cibles.spec.ts:**
    - VIEWPORTS are now 480 x 320, 568 x 320, 667 x 375, the descriptor's window and 844 x 390;
    - the two describes at 375 x 667 move to 667 x 375, and the comments speak of the phone held sideways;
    - the 44 px rule, its tolerance and its assertions are unchanged.
- **Fixes found while running the suite:** b5382e3 and 77e4689, see the deviations.

## Measured (Chromium emulation, insets 0, R-07.1)

| Window | Rows | Formula (px) | Measured board (px) | Step (px) | Hand box | Action zone box |
|---|---|---|---|---|---|---|
| 844 x 390 | one | min(736, 326 / 0.52166) = 624.9 | 624.92 | 20.9 | 240 x 64 at (12, 326) | 572 x 64 at (260, 326) |
| 750 x 342 (iPhone 13 landscape) | one | min(642, 278 / 0.52166) = 532.9 | 532.91 | 17.8 | 240 x 64 at (12, 278) | 478 x 64 at (260, 278) |
| 667 x 375 | one | min(559, 596.2) = 559 | 559 | 18.7 | 240 x 64 at (12, 311) | 395 x 64 at (260, 311) |
| 568 x 320 | two | min(460, 200 / 0.52166) = 383.4 | 383.38 | 12.8 | 544 x 64 at (12, 256) | 544 x 56 at (12, 200) |
| 480 x 320 | two | min(372, 383.4) = 372 | 372 | 12.4 | 456 x 64 at (12, 256) | 456 x 56 at (12, 200) |

- The info column is 96 x 198 px at each size. At 480 x 320 it stands beside a 200 px top row with 2 px to spare.
- The descriptor's viewport, printed by `node -e` in apps/web (Playwright 1.64.0): `{"viewport":{"width":750,"height":342},"screen":{"width":390,"height":844},"isMobile":true,"hasTouch":true}`.

## For Romain's re-test (01-41): device estimates, computed, not results

- iPhone 13 installed, held sideways: insets 47 + 47 at the sides and 21 at the bottom, so 750 x 369 usable. min(844 − 94 − 108, (390 − 21 − 64) / 0.52166) ≈ 585 px, cells ≈ 19.6 px apart.
- iPhone 13 in Safari, held sideways: the visible height is not known here.
  - If it is 342 px, as in the descriptor: ≈ 533 px (17.8 px).
  - If Safari also reports the 21 px bottom inset: ≈ 493 px (16.5 px).
- Derived details, « à confirmer par Romain »:
  - the 96 px column, the 64 px row and the 640 px threshold;
  - « Tour de » hidden visually in the column;
  - the selected card rising 8 px;
  - the 7's tray taking the whole row in the one-row band;
  - the As/Roi pair of amber buttons;
  - the chips of the 7 scrolling sideways at 480 x 320, where 3 to 4 of 7 chips show at once.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green, **784 passed, 2 skipped**. That is 780 plus the four band cases of cards.test.ts.
- `pnpm exec vitest run apps/web/src/cards`: 22 passed.
- Task 1 verify, `playwright test e2e/compact.spec.ts e2e/tracer.spec.ts e2e/ecrans.spec.ts`: 29 passed, 15 skipped.
- Task 2 verify, `playwright test e2e/compact.spec.ts e2e/cartes-speciales.spec.ts e2e/clavier.spec.ts e2e/ecrans.spec.ts`: 68 passed, 40 skipped.
- Task 3 greps: animateNow is in animator.ts, cardFx.ts and Particles.svelte; there is no `.animate(` in apps/web/src/board outside frameClock.ts; there is no `368px` in Game.svelte. Exit 0. No motion code changed.
- **Full Playwright suite, phone and desktop projects: 321 passed, 79 skipped, 0 failed** (5.6 min, final run after the last commit).
  - Against the 299 / 57 baseline: compact.spec adds 16 tests (passed on desktop, skipped on phone), and cibles.spec grows from 13 to 19 tests (+6 passed on desktop, +6 skipped on phone).
  - finition.spec passes unchanged, including its 480 x 320 size, the 7 panel and the Tab order. animations.spec.ts :782 and :807 pass.
- One earlier full run had a single failure: animations.spec.ts:535 (« la donne : 20 cartes… »), a 30 s timeout waiting frame by frame for the deal's flights, at 1280 x 800 in the bar, which this plan does not touch. Re-run alone with `--repeat-each=2` on both projects it passed 4 out of 4, and the final full run passed. It is recorded here as a timing flake under load, not fixed.
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 112 scénarios) ».
- Acceptance greps: `640 px` is present, no `plan 01-39` remains, and `--band-row` and `--info-col` are in Game.svelte. `grep -q "La partie t.attend"` matches only under a UTF-8 locale (`LC_ALL=C.UTF-8`): the shell's locale here is unset (C), where `.` does not match the 3-byte typographic apostrophe the plan asks for.
- The preview server started for screenshots (port 4175) was stopped by its PID.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A selected band card passed the screen's bottom edge while it rose**
- **Found during:** Task 3 (full suite, finition.spec « échange, carte choisie », 480 to 844 px).
- **Issue:** The card's height came from the custom property --card-h, which switches at once, while its slot's height and transform animate over 200 ms. The card's box therefore ended up to 8 px below the screen during the rise.
- **Fix:** In the band the card is 100 % of its slot's (animated) height. The top and the height move together, so the bottom edge never moves.
- **Files modified:** apps/web/src/ui/HandFan.svelte
- **Commit:** b5382e3

**2. [Rule 1 - Bug] A slice was briefly under 44 px when the hand appeared**
- **Found during:** Task 3 (cibles.spec at 750 x 342, slice 43.3 px).
- **Issue:** The band's slots are first laid out at width 0, then slid over 200 ms to their measured places.
- **Fix:** Until the measured width has been applied (one frame after it is known), the band's slots take their places without the transition. The regular fan is unchanged.
- **Commit:** b5382e3

**3. [Rule 1 - Bug] The band's card rules reached the digit badges**
- **Found during:** final screenshot check.
- **Issue:** KeyHint's badge carries the class `card` (at="card"), so `.band .slot :global(.card) { height: 100% }` made the « 1 » badge 90 px high over the card.
- **Fix:** The rules target `.card[data-card]` (the card's root).
- **Test:** compact.spec.ts now checks that every visible key hint is at most 24 px high. With the faulty HandFan this check failed (« a key hint is 90 px high ») before the fix.
- **Commit:** 77e4689

**4. [Rule 3 - Blocking] One cibles.spec assertion adapted to the band's sideways plan**
- **Issue:** In « beaucoup d’étapes : la liste défile dans le panneau », the plan list now scrolls sideways in the compact bar (UI-SPEC item 8, this plan's Task 2), not downwards.
- **Fix:** The assertion accepts either direction: `scrollHeight > clientHeight || scrollWidth > clientWidth`. The panel's constant height and « the newest row in view » are unchanged. This is not one of the 44 px rule's assertions.
- **Commit:** 22f4563

### Choices within the plan's latitude

- **Card boxes cut, not overflowing.** The card's box is the shown part and the face is drawn inside as a full card. Card.svelte is untouched; HandFan styles it through scoped `:global` rules. This keeps finition.spec's « [data-hand] [data-card] ends inside the screen » true without changing it.
- **InfoBar gets a third form, « side »,** rather than a narrower « column »: the computer's bar keeps its own column form.
- **« Tour de » hidden visually in the side column.** Below 360 px the existing rule already hides it. Without it the column needed 215 px where a 320 px high screen gives 200.
- **The 7's tray in the one-row band** takes the whole row and the 20 px line steps aside: the 44 x 56 chips (the unchanged tray rule) and the line do not fit in 64 px together. In two rows the line stays.
- **As/Roi: exactly 2 amber buttons**, as decided in 01-36 for the computer's bar. Every other state shows 0 or 1.
- **The hand column is fixed at 240 px** in the one-row band (the plan's 640 px budget). In two rows the hand takes the band's full width (456 or 544 px), with slices of 56 px.
- No other spec needed its locators adapted: no spec located the side panel on a landscape window.

## Known Stubs

None. Still transitional, as planned: the portrait chrome on screens taller than wide (01-38 brings « Tourne ton téléphone » and the phone project in landscape).

## Threat Flags

None. T-01-59 is mitigated:
- compact.spec.ts checks every state's controls at 750 x 342 and 480 x 320: at least 44 x 44, inside the screen and the band, no scroll;
- cards.test.ts proves 44 px slices with five cards;
- cibles.spec.ts keeps the 44 px rule at five landscape phone sizes;
- the controls send the same turnUi events, and turnUi, the key map and the Director are untouched.

No package was added (T-01-SC).

## Commits

The measured range `dbb0ea0..77e4689` holds 5 commits:
- cd9e5f9 (Task 1)
- a9d810a (Task 2)
- b5382e3 (fix: the rise and the first placement)
- 22f4563 (Task 3)
- 77e4689 (fix: the key hints, with its check)

This SUMMARY is committed separately.

## Self-Check: PASSED

- FOUND: apps/web/src/cards/fan.ts (contains "64"), apps/web/e2e/compact.spec.ts (contains "533"), 01-UI-SPEC.md (contains "640 px"), apps/web/src/routes/Game.svelte (contains "compact", "--band-row", "--info-col"), apps/web/src/ui/HandFan.svelte (imports "../cards/fan.ts")
- FOUND: apps/web/test-results/galet-emulation-844x390.png, -750x342.png, -480x320.png
- FOUND: cd9e5f9, a9d810a, b5382e3, 22f4563, 77e4689 (ancestors of HEAD)
