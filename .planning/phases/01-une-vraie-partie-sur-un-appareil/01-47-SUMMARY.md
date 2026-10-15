---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 47
subsystem: ui
status: complete
tags: [layout, compact, phone-landscape, plateau-sur-toute-la-hauteur, recette-3, uat-24, gap-closure]
requires:
  - "01-46 (wave 37 done; the compact bar of 01-37 and the screen store of 01-36)"
provides:
  - "ui/screen.svelte.ts: Chrome = bar | compact | rotate, COMPACT_QUERY (same media query string as before)"
  - "Game.svelte compact grid: --strip 60px, --strip-button 58px, --prompt-row 24px, --board-size = max(0, min(100vw − 2 × strip − insets, (100dvh − prompt row − insets) / ratio)), head room 0 on the stage; columns minmax(strip, 1fr) board minmax(strip, 1fr); rows 1fr / prompt row / board / 1fr"
  - "ActionZone `compact` and `part` (all | prompt | buttons | fast); SevenPanel `compact` and `part` (all | line | chips | buttons); PawnTray `part` (all | chips | close) and `compact`; HandFan `compact` (column)"
  - "cards/fan.ts: COLUMN_CARD (52 x 73), COLUMN_STEP 44, COLUMN_SHIFT 6, columnHeight, columnLayout (bandLayout and bandVisible removed)"
  - "InfoBar form « pill » with the sheet « Infos de la partie », prop `gear`; ui/SettingsButton.svelte (the gear and its settings sheet)"
  - "Toast: centred over the felt in the compact mode, at most 3/4 of the board wide"
  - "i18n game.compact (short labels), game.info.score / pillAria / sheetTitle, game.tray.question"
  - "e2e/compact.spec.ts: the tracer « traceur : à 750 × 342, le plateau sur toute la hauteur, la Dame se joue depuis les bandes » and the width checks at five sizes"
affects: ["01-48 (rewrites the old compact state tests and the other specs listed below, captures, UI-SPEC section)", "01-54 (Romain's re-test)"]
tech-stack:
  added: []
  patterns:
    - "One component drawn in parts (a `part` prop), each instance placed in its own grid area, so the DOM (and Tab) order follows the design while the reducer events stay the same"
    - "Items of a strip share the strip's grid area with align-self start / end and a max-height of 100 % minus what stands at the other end, so they never overlap"
    - "A display: contents region ([data-seven-panel]) whose three parts are grid items of the page"
key-files:
  created:
    - apps/web/src/ui/SettingsButton.svelte
  modified:
    - apps/web/src/ui/screen.svelte.ts
    - apps/web/src/ui/screen.test.ts
    - apps/web/src/routes/Game.svelte
    - apps/web/src/ui/ActionZone.svelte
    - apps/web/src/ui/HandFan.svelte
    - apps/web/src/cards/fan.ts
    - apps/web/src/cards/cards.test.ts
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/ui/SevenPanel.svelte
    - apps/web/src/ui/PawnTray.svelte
    - apps/web/src/ui/Toast.svelte
    - apps/web/src/i18n/fr/game.ts
    - apps/web/e2e/compact.spec.ts
    - apps/web/e2e/tourne.spec.ts
    - apps/web/e2e/ecrans.spec.ts
    - apps/web/e2e/finition.spec.ts
decisions:
  - "Strip buttons are 58 px wide, not 52: « Annuler » measures 52.4 px in Label 14 bold (Nunito) and the button has 2 px borders; letter-spacing −0.01em. The strip stays 60 px (à confirmer par Romain)"
  - "As/Roi keeps its two amber buttons (« Sortir », « +n ») stacked, as decided in 01-36/01-37, an exception to « one primary at most »"
  - "In the column, unplayable cards are dimmed by an opaque walnut veil (rgb(43 29 18 / 0.6)) instead of 40 % opacity: overlapping see-through cards showed the card under them"
  - "The selected card keeps its place in the stack (it does not jump on top), so the card under it still shows its index"
  - "« Avance rapide » is its own ActionZone part (« fast ») so that it comes before the board in the DOM, as the Tab order of the design asks"
  - "The prompt row and the board are kept together and centred in the height (rows 1fr / 24 px / board / 1fr): a width-limited screen (480 x 320) no longer leaves the prompt row far above the board"
  - "The compact prompt row puts a partner's-capture warning first, so the one-line ellipsis never cuts it; during « Lequel ? » it says « Lequel de ces chevaux ? » (new copy, à confirmer par Romain)"
  - "The column's empty hand shows « Plus de cartes » only; its body line is read out but not shown (no room in 60 px)"
  - "The toast is placed by measuring the felt's box (retried on the next frames until the board exists, and on resize), at most 3/4 of the board wide (1/2 made it too tall at 480 x 320)"
metrics:
  duration: "36 min"
  completed: 2026-10-15
  tasks: 2
  files: 17
estimate:
  tokens: 110000
  tasks: 2
actuals:
  tokens: 13700
  tasks: 2
  commits: 2
plan_head_before: 4332959d0ae5b17b0f8395b59f647808ba92291f
plan_head_after: c4ed0ea1877e0d52b13dbe9ef2fd95693aa64925
---

# Phase 1 Plan 47: Le plateau sur toute la hauteur du téléphone (1/2) Summary

**On a phone held sideways, the galet now fills the height under a 24 px prompt row. The hand is a column of 52 x 73 cards in a 60 px strip at its left. The buttons are stacked in a 60 px strip at its right. The info became a small pill that opens « Infos de la partie ». The board is 630 px wide at 750 x 342 (533 before) and 724 px at 844 x 390 (625 before). The computer's bar does not change.**

## What was built

### Task 1 (tracer), 2597474: the frame and a plain turn

- **screen.svelte.ts:**
  - the mode `compact-bar` is now `compact`, and `COMPACT_BAR_QUERY` is now `COMPACT_QUERY` (the query string is unchanged);
  - the header describes bar, compact (Romain's « Plateau sur toute la hauteur ») and rotate;
  - screen.test.ts follows.
  - The specs tourne, ecrans and compact read `"compact"`, and the finition comment says so. No `compact-bar` is left in apps/web/src or apps/web/e2e.
- **Game.svelte:** the 01-37 band block is replaced by the compact grid, using the variables `--strip`, `--strip-button`, `--prompt-row` and `--board-size`. The stage has `--head-room: 0`. The DOM order is:
  1. the info;
  2. `.tools` (the gear and « Avance rapide »);
  3. the stage;
  4. `.prompt-row`;
  5. `.chips` (the tray);
  6. `.actions`;
  7. `.hand`.

  `band` became `compact` everywhere. The bar's markup is unchanged: the ActionZone and the HandFan are now rendered through snippets (`zone(part)`, `hand()`), which give the same DOM.
- **ActionZone:**
  - `part="prompt"` is the aria-live `[data-action-zone]` (with `data-state`), one line with « … » and the full text in its title. The exchange's givers take the line's place, and their sentence is read out but not shown;
  - `part="buttons"` (`[data-action-buttons]`) stacks the buttons at the bottom of the right strip, the primary one lowest. The short labels come from `game.compact`; the accessible names and titles keep the full labels;
  - `part="fast"` is « Avance rapide » as an icon only, with aria-pressed and a title;
  - the same handlers fire as before.
- **HandFan and fan.ts:**
  - `columnLayout(count, height)`: bottom-aligned, the cards 44 px apart, the last one whole;
  - the box holds five cards (249 px) and never jumps;
  - the selected card moves `translateX(6px)`;
  - ArrowUp and ArrowDown also walk through the column;
  - bandLayout and bandVisible are removed. cards.test.ts has four column cases (249 px for five, steps of at least 44, 73 px for one card, the 6 px move inside 60 px).
- **PawnTray:** `part` all | chips | close; « Autre cheval » is the short label.
- **compact.spec.ts:** a new tracer and the width checks (see Verification). `expectStrips` checks, for every visible strip item (the pill, the gear, « Avance rapide », the buttons, the cards, the chips):
  - it is inside the screen;
  - it is in its own strip, never over the board's rectangle;
  - the board is centred and below the prompt row.
- Tracer gate: the verify was re-run end to end and passed (unit tests, typecheck, lint, compact traceur|tailles 6 passed, ecrans + tracer 28 passed, the grep for `compact-bar` empty), then the plan went on.

### Task 2, c4ed0ea: the other states in the strips

- **InfoBar form « pill »** (`[data-info-bar][data-form=pill]`):
  - a 52 x 44 button showing the turn dot (amber on the human's turn), the glyph of the seat whose turn it is, and « n–m » in tabular figures;
  - its accessible name is « Infos de la partie : {ligne du tour}, nous n sur 8, eux m sur 8 »;
  - a tap opens the Sheet « Infos de la partie », which holds the InfoBar in its column form without the gear, and « Fermer ». Échap closes it, as for any sheet.
- **SettingsButton.svelte:** the gear and its settings sheet, taken out of InfoBar. InfoBar uses it in its `[data-settings-slot]`. In the compact mode Game.svelte puts it at the top of the right strip, in its own `[data-settings-slot]`, so the 01-38 focus code still finds it.
- **SevenPanel parts** (Game wraps them in a `display: contents` `[data-seven-panel]` region):
  - `line` (`[data-seven-line]`, prompt row): « Reste n » (or « Tout est réparti. ») in amber, then the instruction and the plan, joined by « · », with an ellipsis;
  - `chips` (`[data-seven-chips]`, left strip): the 44 x 44 step chips, 4 px apart, in a column that scrolls (the tray's chips while the tray is open);
  - `buttons` (`[data-seven-buttons]`, right strip): « Retour », « Effacer », « Jouer » (« Autre cheval » while the tray is open).
- **Toast:** in the compact mode it is centred on the felt, at most min(480, 3/4 of the board) wide. Elsewhere it is unchanged.
- **Measured fixes:**
  - the strip buttons are 58 px wide;
  - on a computer the key badges stay over their button, and the buttons are 12 px apart when the badges show;
  - the unplayable veil;
  - the prompt row and the board are centred together.

## Where each control sits (checked in Chromium at 844 x 390, 750 x 342 and 480 x 320, phone emulation; 750 x 342 also as a computer window)

A script took 18 states at each size and measured every strip item against the board's box. In every state at every size:
- nothing is over the board's rectangle;
- the page never scrolls;
- no control is under 44 x 44.

The only items reported outside the screen are the 7's step chips 7 (and 6 at 480 x 320), inside their scrolling column, as designed.

| State | Left strip (top / bottom) | Prompt row | Right strip (top / bottom) |
|---|---|---|---|
| À toi de jouer | pill / hand column | « À toi de jouer. Choisis une carte. » | gear / — |
| Carte choisie, aperçu (Dame) | pill / hand, the Dame moved 6 px | « Dame de cœur : avance de 12 cases. » | gear / « Annuler », « Jouer » |
| As/Roi question | pill / hand | « Que veux-tu faire ? » | gear / « Sortir », « +1 » (both amber) |
| As, avancer (two knights lit) | pill / hand | « Choisis un cheval. » | gear / « Autre carte » |
| Lequel ? | pill / chips A, B (44 x 56) | « Lequel de ces chevaux ? » | gear / « Autre cheval » |
| 7, nothing spread / a knight chosen | pill / step chips 1–7 (scrolling) | « Reste 7 · Choisis un cheval. » / « … Combien de pas pour ce cheval ? » | gear / « Retour », « Effacer », « Jouer » |
| 7, all spread | pill / — | « Tout est réparti. · Cheval A : 4 pas · Cheval B : 3 pas » | gear / « Retour », « Effacer », « Jouer » |
| 7 with « Lequel ? » | pill / chips A, B | « Reste 7 · Lequel de ces chevaux ? » | gear / « Autre cheval » |
| Échange, before / after the choice | pill / hand (all raised) | « Choisis la carte à passer à Marengo. » | gear / « Passer » |
| Échange, waiting | pill / hand | the givers (check / hourglass) | gear / — |
| Main morte | pill / hand (veiled) | the message, ending in « … » | gear / « Poser » |
| Prise du partenaire | pill / hand | « Attention : tu vas manger un cheval de ton équipe. » first | gear / « Annuler », « Jouer » |
| Attente des ordinateurs | pill / hand | the bots' line | gear, « Avance rapide » / — |
| Infos | the sheet « Infos de la partie » over the game | | |
| Fin | the end screen over the game; « Plus de cartes » in the left strip | | |
| Message (toast) | centred on the felt: 182–662 x 177–237 at 844 x 390, 139–611 x 153–213 at 750 x 342, 105–375 x 135–209 at 480 x 320 | | |

Board measured: **724 x 362 at 844 x 390**, **630 x 315 at 750 x 342** and **360 x 180 at 480 x 320**. The strips are 60 px at each size.

Screenshots (in /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/):
- 01-47-{844x390,750x342,480x320}-{idle,carte-choisie,as-question,as-avancer,as-apercu,lequel,sept-vide,sept-pastilles,sept-reparti,sept-lequel,echange,echange-choisie,echange-attente,main-morte,partenaire,attente,infos,fin}.png;
- 01-47-750x342-pc-*.png (a computer window, with the key badges);
- 01-47-{844x390,750x342,480x320}-message.png (the toast).

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green, **787 passed, 2 skipped** (the four band cases of cards.test.ts replaced by four column cases).
- `pnpm exec vitest run apps/web/src`: 417 passed.
- `playwright test e2e/compact.spec.ts --grep "traceur|tailles"`: **6 passed, 6 skipped, 0 failed** (desktop project; the phone project skips the explicit viewports).
  - The tracer at 750 x 342 checks:
    - the board measures 630 ± 2 px, at least 615;
    - the strips are clear of the board;
    - the cards are 52 x 73 and at least 44 px apart, in the left strip;
    - the selected Dame moves 6 px;
    - « Annuler » (accessible name « Annuler ce coup ») stands above « Jouer » in the right strip;
    - bleu0 lands on the drawn cell 15.
  - Widths (formula ± 2 px, then the minimum): 844 x 390 → 724 (≥ 710); 750 x 342 → 630 (≥ 615); 667 x 375 → 547 (≥ 535); 568 x 320 → 448 (≥ 435); 480 x 320 → 360 (≥ 350).
- `playwright test e2e/ecrans.spec.ts e2e/tracer.spec.ts`: **28 passed, 14 skipped, 0 failed**. The computer's bar is unchanged, and tracer.spec passes on the phone project, which is in the compact mode.
- `node tools/rules-trace.mjs`: « rules-trace: OK (16 règles, 118 scénarios) ».
- The frameClock invariant holds: there is no `.animate(` in apps/web/src/board outside frameClock.ts.
- `grep -rn "compact-bar" apps/web/src apps/web/e2e`: empty. Acceptance greps: COMPACT_QUERY, `export function columnLayout`, `prompt-row`, `"pill"`, « Infos de la partie », `"chips"` are all present.
- **Full Playwright suite (for the record; the plan defers it to 01-48): 305 passed, 84 skipped, 33 failed** (baseline 338 / 84 / 0). Every failure is a spec that still asserts the 01-37 compact bar (or its sizes), on the desktop project's small windows or on the phone project, which is compact. None is a broken behaviour. 01-48 rewrites them:
  - compact.spec.ts, the ten old state tests at 750 x 342 and 480 x 320: they read `var(--band)` (now 0), expect the 64/120 px band and its buttons inside it, « Avance rapide » with its visible label, and a `[data-seven-panel]` box;
  - finition.spec.ts:262, « le panneau du 7 tient sous le plateau ou à côté », 4 sizes on both projects (8 tests): `[data-seven-panel]` has no box any more (display: contents);
  - finition.spec.ts:370 (phone), the Tab order: the info pill now comes before « Réglages », as the design asks;
  - partie.spec.ts:39, :151, :199 (phone): they read « Donneur », « Donne 1 sur 3 » and « Nous 7/8 » in `[data-info-bar]`, which is now the pill (those lines are in its sheet);
  - reglages.spec.ts:210 (phone): it looks for « Réglages » inside `[data-info-bar]`, but the gear now stands in the right strip;
  - cartes-speciales.spec.ts:20 (phone): « Sortir » and « Avancer de 1 » are no longer side by side (they are stacked);
  - cartes-speciales.spec.ts:265 (phone): it expects the visible title « Le 7 : répartis tes pas », which is now only the region's accessible name;
  - cibles.spec.ts:59, the exchange at five sizes: it measures horizontal slices between the cards (now 0, the column is vertical; each card shows 44 px vertically);
  - cibles.spec.ts:147 and :185: the 7 panel's box and `[data-seven-region]`;
  - table.spec.ts:175, « captures du plateau à 625 px »: at 844 x 390 the board is now 724 px.
- The preview server started for the screenshots (port 4175) was stopped by its PIDs.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] « Annuler » did not fit a 52 px button**
- **Found during:** Task 1 (the screenshot at 750 x 342).
- **Issue:** « Annuler » is 52.4 px in Label 14 bold, and a 52 px button with 2 px borders leaves 48 px, so the word overflowed.
- **Fix:** the strip buttons are `--strip-button` 58 px wide, with letter-spacing −0.01em; « Autre cheval » and the 7's buttons use the same width. The cards stay 52 px.
- **Commits:** 2597474, then c4ed0ea (56 → 58 px).

**2. [Rule 1 - Bug] Overlapping unplayable cards were see-through**
- **Found during:** Task 2 (the dead-hand screenshot).
- **Issue:** at 40 % opacity, the column's overlapping cards showed the card under them, upside-down index included.
- **Fix:** the card stays opaque, under a walnut veil of 60 % (it looks the same as 40 % on the page's background).
- **Commit:** c4ed0ea

**3. [Rule 1 - Bug] The toast stayed at the bottom, over the bottom ring row**
- **Found during:** Task 2 (the sound-failure toast, shown before the board is laid out).
- **Fix:** the felt is looked for again on the next frames (up to 2 s) and on resize. The width is 3/4 of the board: at 1/2 it was 172 px tall at 480 x 320.
- **Commit:** c4ed0ea

**4. [Rule 1 - Bug] A computer's key badge reached over the board**
- **Found during:** Task 1 (the computer-window screenshot). The « Entrée » badge on « Jouer » stuck out 4 px to the left, past the strip.
- **Fix:** in the strip's columns the badge sits 2 px from the button's right edge, and the buttons are 12 px apart when badges show (computers only).
- **Commit:** c4ed0ea

### Choices within the plan's latitude

- **API shape:**
  - ActionZone has a fourth part, « fast »: the design's Tab order (pill, Réglages, Avance rapide, knights, …) puts « Avance rapide » before the board, while the buttons come after it;
  - the gear became `SettingsButton.svelte` (a new file), so the pill form has no gear and the right strip holds the same button;
  - `[data-seven-panel]` is a `display: contents` region around the 7's three parts;
  - Task 1 also carried the PawnTray parts and the `game.compact` copy (ActionZone needed them), and Task 2 the rest of game.ts.
- **Layout:**
  - the prompt row and the board are centred together, rows `1fr / 24px / board / 1fr`, rather than the board alone centred under a fixed top row;
  - the hand's box is the height of five cards (249 px), so the column never jumps as cards are played;
  - in the compact mode, the hand is replaced by the « Lequel ? » chips while the tray is open. HandFan unmounts and mounts again, and its received-card and deal animations do not replay.
- **Copy:** the tray's question in the prompt row is « Lequel de ces chevaux ? » (new, à confirmer par Romain). The plan said « the tray's existing question », but no such text existed.
- **The width checks** run at all five TARGETS sizes (the plan asked for 844 x 390 and 750 x 342), with captures at three of them in test-results/galet-emulation-*.png.

## Known Stubs

None.

## Known overlap (for 01-48 and Romain)

- In a preview, the destination badge (« +3 ») of a top-row cell is drawn above the cell, so it rises into the prompt row and can cover the end of the line (seen on the filled 7 at 750 x 342, « Cheval B : 3 pa… »). The design accepts a lifted top-row knight's head in that row; the badge is the same head room. Nothing else in the strips or the row touches the galet.

## Threat Flags

None. T-01-74 is mitigated here:
- the tracer and the five width checks;
- the 18-state script at three sizes (no control over the board, outside the screen or under 44 px, no scroll).

01-48 turns those checks into specs. T-01-73 is accepted: the accessible names and titles keep the full labels. No package was added (T-01-SC).

## Commits

The measured range `4332959..c4ed0ea` holds 2 commits:
- 2597474 (Task 1, tracer)
- c4ed0ea (Task 2)

This SUMMARY is committed separately.

## Self-Check: PASSED

- FOUND: apps/web/src/ui/SettingsButton.svelte, apps/web/src/cards/fan.ts (columnLayout), apps/web/src/ui/screen.svelte.ts (COMPACT_QUERY), apps/web/src/routes/Game.svelte (prompt-row, --strip, part=), apps/web/src/ui/InfoBar.svelte ("pill"), apps/web/src/ui/SevenPanel.svelte ("chips"), apps/web/src/i18n/fr/game.ts (Infos de la partie)
- FOUND: 2597474, c4ed0ea (ancestors of HEAD)
