---
phase: quick-261109-6an
plan: 01
subsystem: engine, bots, web game screen
status: complete
tags: [fairness, deck-count, sheet, keyboard, accessibility]
requires: [viewFor / PlayerView (packages/engine/src/view.ts)]
provides:
  - "@toc/engine: partnerHolds, unknownCards, deckCount, DeckCount, RANKS"
  - "apps/web: « Les cartes du paquet » sheet, key « T », row button, « Sur le tapis » button"
affects: [packages/bots/src/knowledge.ts, apps/web/src/routes/Game.svelte, InfoBar, TapisSheet]
tech-stack:
  added: []
  patterns: [one pure engine function shared by the bots and the UI, permanent statistical engine test]
key-files:
  created:
    - packages/engine/src/unseen.ts
    - packages/engine/test/unseen.test.ts
    - packages/engine/test/fairness.test.ts
    - packages/bots/src/knowledge.test.ts
    - apps/web/src/i18n/fr/paquet.ts
    - apps/web/src/ui/DeckSheet.svelte
    - apps/web/src/ui/DeckButton.svelte
    - apps/web/e2e/paquet.spec.ts
  modified:
    - packages/engine/src/deck.ts
    - packages/engine/src/index.ts
    - packages/bots/src/knowledge.ts
    - apps/web/src/i18n/fr/cards.ts
    - apps/web/src/i18n/fr/clavier.ts
    - apps/web/src/game/shortcuts.ts
    - apps/web/src/game/shortcuts.test.ts
    - apps/web/src/routes/Game.svelte
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/ui/TapisSheet.svelte
    - apps/web/src/ui/icons.ts
    - tools/copy-vendor-assets.mjs
    - apps/web/e2e/clavier.spec.ts
    - apps/web/e2e-online/regles-en-ligne.spec.ts
decisions:
  - "The count lives in @toc/engine (unseen.ts); packages/bots/src/knowledge.ts re-exports unknownCards and partnerHolds, so the sheet and the computer read the very same functions (identity test)."
  - "Ways in: « T » everywhere; on the computer an icon button right after « Règles du jeu » in the info row; on every screen a « Les cartes du paquet » button in « Sur le tapis » under the talon and défausse counts. The phone's right strip is full at 480 x 320, so on the phone the way in is the felt, then « Sur le tapis »."
  - "The solo and lesson computers wait while the sheet is open (deckShown joins the `held` derivation, online === undefined), exactly like « Règles du TOC »; online the game goes on."
metrics:
  duration: "~50 min"
  completed: 2026-11-09
  tasks: 3
actuals:
  tokens: 15700
  tasks: 3
  commits: 4
plan_head_before: e09cc719ebd81dff2f7bbaac00027db07c94b3fc
plan_head_after: 51f07b1875fd0f4148ff074471e52e33474a8473
---

# Quick task 261109-6an: « Les cartes du paquet » and the deal-fairness test Summary

The human now sees, rank by rank, exactly what a computer player remembers about the pack: one pure `deckCount(view)` in `@toc/engine` (built on the `unknownCards` and `partnerHolds` the bots now re-export) feeds a new sheet « Les cartes du paquet ». « T », an info-row button and a button in « Sur le tapis » open it. A permanent engine test deals 18 000 hands across 3000 seeded games and checks that every seat gets the same share of each rank and of the key cards.

## What was built

- **Engine** (`packages/engine/src/unseen.ts`): `partnerHolds` and `unknownCards` moved here from the bots without any change in behaviour, plus `DeckCount` / `deckCount(view)`. It returns how many of each rank's 4 cards are still hidden, the total, the deal of the pack (1 to 3), its size and the talon. The function only accepts a `PlayerView`, so a `GameState` is a type error, and a `@ts-expect-error` test locks that in. `RANKS` is now exported from `deck.ts`.
- **Bots**: `knowledge.ts` re-exports the engine's two functions, and `hiddenCounts` is unchanged. `knowledge.test.ts` checks that they are the same function objects (`toBe`) and that hidden hands plus the talon add up to `deckCount(view).total`.
- **Sheet** (`DeckSheet.svelte`, built on the normal Sheet): it shows the deal line « Donne N sur 3 de ce paquet · … au talon », then the 13 ranks in a 7-column grid. Each rank has its name, 4 dots and a digit, with a screen-reader line such as « Valet : 3 cachées sur 4 ». As, 7, Valet and Roi get a 2 px `--brun-aide-memoire` border and a bold name, so colour is not the only cue. A muted explanation comes last. The count is derived live from the session's `PlayerView`.
- **Keys**: `KeyIntent { kind: "deck" }` and `KeyContext.deck`. « T » opens the sheet, and closes it again from inside. It does nothing under another sheet or inside the rules, and it also works under a table plate. It is listed in « Raccourcis clavier ».
- **Buttons**: `DeckButton.svelte` (44 x 44, lucide `gallery-vertical-end`, KeyHint « T ») sits second in the computer's info row. That row now holds Règles, Paquet, À la table, Messages: 188 px out of 240, so no wrap is needed. `TapisSheet` gets a `btn-secondary` « Les cartes du paquet » button. Clicking it closes « Sur le tapis » and opens the new sheet in the same task, and when that sheet closes the focus goes back to the felt.

## Fairness test

`packages/engine/test/fairness.test.ts` plays 3000 games of 6 deals each (2 packs per game, 6000 packs in all), with the first dealer cycling and the seeds taken from a fixed sfc32 stream.
- Every seat's count of each rank and of the 16 key cards must stay within 8 hypergeometric standard deviations. For the key cards that bound is about 3.8 % of the expected 24 000.
- The 52 cards must be conserved after every deal.
- At least 99 % of the games must have distinct first hands for Bleu.
- **Measured duration: 0.39 to 0.45 s** (timeout 5000 ms).

## Verification

- `pnpm typecheck`, `pnpm lint`, `pnpm test`: all green (139 files, 2199 tests passed, 2 skipped).
- `e2e/paquet.spec.ts`: 8 passed, 4 skipped by design (keyboard and info-row tests run on the computer only). It covers « T », the counts and the deal line, the row button, the « Sur le tapis » path on both projects, the lesson, the solo pause, and the fit plus `audit()` at 844 x 390 (phone) and 1280 x 800 (desktop). The deal line and all 13 ranks show without scrolling.
- Full local Playwright: 659 passed, 193 skipped, 16 failed. Every failure was the same problem, which was already there before this task and is unrelated to it: `e2e/accessibilite.spec.ts` audits of the home page (« l’accueil … », « Première fois ? », « Installer TOC », at 4 sizes) reported axe `label-content-name-mismatch` on `button[data-small-tile="regles"]`. Commit d336cec had shortened the tile's visible line without updating its accessible name. It failed the same way when rerun alone.
- Online Playwright (`-c playwright.online.config.ts`): 130 passed, 16 skipped, 4 failed. All 4 were the same tile problem, in `e2e-online/accessibilite.spec.ts` « un compte … » at 4 sizes. `e2e-online/regles-en-ligne.spec.ts` (the info row now has 4 buttons) passed.
- After the orchestrator's fix 65320a0 (the tile's accessible name is now « Règles : cartes, 7, maison »), reruns: `e2e/accessibilite.spec.ts` + `e2e/accueil.spec.ts` 93 passed, 47 skipped, 0 failed; `e2e-online/accessibilite.spec.ts` 8 passed, 8 skipped, 0 failed. Both suites are now clean.
- Screenshots (deviceScaleFactor 2) are in `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/quick-paquet-844x390.png` and `quick-paquet-1280x800.png` (plus `-game-` and `-tapis-` variants). The probe position did not load, so they show a real new game during the exchange, and its counts match the hand on screen.
- No changes under apps/worker, packages/protocol, wrangler, migrations, CLAUDE.md or config.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `e2e/clavier.spec.ts` counted the visible key hints as 5**
- **Found during:** Task 3 gate
- **Issue:** the new KeyHint « T » on the row button makes 6 hints on a computer.
- **Fix:** expected count 1 + 3 + 1 + 1, with a comment.
- **Commit:** 526c923

Notes:
- The test in `unseen.test.ts` for a hand laid down accounts for Vert already knowing the card it passed to Jaune, so Vert sees one fewer newly revealed card.
- The ledger base was reset to e09cc71 because the orchestrator committed the PLAN after the ledger was first recorded. Commit 51f07b1 (deferred items, docs) was made by the orchestrator, not this executor; it is included in the measured count of 4.

## For Romain to judge

- On the phone, the button in « Sur le tapis » comes after the four seat rows (100 px each). At 844 x 390 that sheet scrolls, so the button is below the fold, under the talon and défausse counts as the plan asked. If it is too hidden, it could move to the top of « Sur le tapis ».
- At 844 x 390 the explanatory paragraph scrolls inside the sheet. The deal line and the 13 ranks do not need scrolling.

## Known Stubs

None.

## Self-Check: PASSED
