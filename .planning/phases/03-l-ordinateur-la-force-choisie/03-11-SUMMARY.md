---
phase: 03-l-ordinateur-la-force-choisie
plan: 11
subsystem: web-ui, engine
status: complete
gap_closure: true
tags: [deal, first-player, banner, info-bar, felt, accessibility, e2e]
requires: ["03-10"]
provides:
  - "engine: exported firstPlayer(dealer, rules = DEFAULT_RULES), the one derivation of who starts a deal (G9)"
  - "deal banner line « Tu commences. » / « {Nom} commence. » on every deal"
  - "« 1er » token on the wood just outside the felt, on the first player's side, for the whole deal"
  - "« Commence : {Nom} » in the computer's bottom bar and the phone's « Infos de la partie » sheet"
affects: [DealBanner, InfoBar, FeltTable, Game.svelte, render reducer]
tech-stack:
  added: []
  patterns:
    - "pure placement module (starterToken.ts) unit-tested against every drawn cell, dot, knight head and rider at measured board scales"
key-files:
  created:
    - apps/web/src/board/starterToken.ts
    - apps/web/src/board/starterToken.test.ts
    - apps/web/src/i18n/commence.test.ts
    - apps/web/e2e/commence.spec.ts
  modified:
    - packages/engine/src/state.ts
    - packages/engine/src/render.ts
    - packages/engine/test/deal.test.ts
    - apps/web/src/i18n/fr/game.ts
    - apps/web/src/ui/DealBanner.svelte
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/board/FeltTable.svelte
    - apps/web/src/routes/Game.svelte
    - .planning/phases/03-l-ordinateur-la-force-choisie/03-UI-SPEC.md
decisions:
  - "Who starts is derived from the dealer through the engine's exported firstPlayer, never from render.turn (the turn moves during the deal)"
  - "The « 1er » token sits on the wood just outside the felt on the starter's side, not at a corner of the card place like « D »: the top and bottom card places sit between the talon and the défausse, so a corner token touched a pile"
  - "The « Commence : … » line is shown in the info bar's column form only (computer bottom bar and phone sheet), not in the hidden 56 px row form nor in the pill; the pill's accessible name is unchanged"
  - "The token is aria-hidden; screen readers hear who starts from the banner's existing polite live region"
metrics:
  duration: "about 45 min of execution after a 55 min wait for 03-10"
  completed: 2026-10-17
estimate:
  tokens: 20000
  tasks: 3
actuals:
  tokens: 10200
  tasks: 3
  commits: 6
plan_head_before: 6436efecf7e7bc64189a858c6c755fcf4664f9f5
plan_head_after: c843ddf5d9fa4ea954131f000f44dc185685660e
---

# Phase 3 Plan 11: Qui commence la donne Summary

The player who starts each deal (the seat after the dealer, RULES.md R-03 / G9) is now shown three ways. The deal banner ends with « Tu commences. » or « {Nom} commence. ». A walnut « 1er » pill sits on the wood next to the felt, on that player's side, for the whole deal. The computer's bottom bar and the phone's « Infos de la partie » sheet say « Commence : {Nom} ». All three read one exported engine derivation, `firstPlayer(dealer)`.

Romain, 2026-10-17: « Il faut aussi savoir quel joueur va jouer le premier la donne actuelle ». The whole proposal is marked « à confirmer par Romain » in 03-UI-SPEC.md (section « Qui commence la donne (plan 03-11) », item 13 of « À confirmer par Romain »).

## What shows where

| Surface | What it shows |
|---------|---------------|
| Deal banner (every deal, 1.2 s, all sizes) | Last line « Tu commences. » / « Pégase commence. », `.sub` style; inside the existing `aria-live="polite"` region, so screen readers hear it with the deal |
| Board, all deal long | « 1er » pill 34 × 24 px, walnut fill, 2 px cream outline, cream « 1 » + superscript « er » (the « D » disc is cream with a walnut letter). It sits 6 px outside the felt's rim on the starter's side, 50 scene units toward the stable at the top and bottom (the middle of the bare wood between stable and home lane). `aria-hidden`, takes no tap |
| Computer bottom bar (1280 × 800) | Third line « Commence : {Nom} » (« Commence : toi » for the player) under the unchanged « Donneur : X · Donne n sur 3 » |
| Phone « Infos de la partie » sheet | The same line (the sheet reuses the column form) |
| Phone info pill | Unchanged (visual and accessible name) |

## Tasks

| # | Task | Commit |
|---|------|--------|
| 0 | Plan | e857331 |
| 1 | Engine: export `firstPlayer`, use it in the render reducer, tests | ab8c029 |
| 2 | Banner line, « 1er » token (`starterToken.ts`), bar / sheet line, copy | 7784d2c |
| 3 | `commence.spec.ts`, 03-UI-SPEC note quoting Romain | 48c444a |
| 3b | Formatting of the spec (biome) | c843ddf |

`commits: 6` is measured with `git rev-list --count 6436efe..HEAD`. It includes `c8ff490 docs(02): capture phase context`, which another session committed on this branch during the run and which is not part of this plan. This plan made 5 commits.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green. 51 files, 954 passed, 2 skipped (both skips were already there in `packages/`). Before this plan: 49 files, 945 passed; the 9 new tests are 3 engine, 3 token geometry and 3 copy.
- Full Playwright suite, both projects (phone = iPhone 13 landscape 750 × 342, desktop 1280 × 800): **416 passed, 96 skipped (project-specific skips, the same 96 as after 03-10), 0 failed** (6.7 min). The 6 new tests are 3 in `commence.spec.ts` × 2 projects.
- `commence.spec.ts` covers four things. (1) The banner line, and that the token's seat is the seat after `data-dealer`. (2) « Commence : {same name} » appears in the bar or the sheet, and the token is still there after the exchange. (3) « Tu commences. » / « Commence : toi » when the player starts. (4) On all four sides, at 844 × 390, 750 × 342, 480 × 320 and 1280 × 800, the token's box meets none of: the drawing's 72 numbers, 192 discs and dots or 16 squares, the 16 knights, the talon, the défausse, the felt ellipse.
- `starterToken.test.ts` checks every seat and board turn `k` at the measured board scales of 2.00 to 9 units per px (1920 × 1080 is 2.00, 480 × 320 is 8.89). It proves the token is outside the felt and clear of every ring cell, every home and stable dot (each with the head of a knight standing on it) and every rider.

Screenshots, all viewed. They are the last build, identical in app code to HEAD:
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/03-11-v3-{844x390,750x342,480x320,1280x800}-1er-quatre.png` (the four sides on one sheet per size)
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/03-11-v3-{size}-1er-{bleu,jaune,rouge,vert}.png`
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/03-11-v3-{size}-banniere-rouge.png` (banner « … Pégase commence. »)
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/03-11-v3-{844x390,750x342,480x320}-infos-rouge.png` (sheet « Commence : Pégase »)
- Before: `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/03-11-base-*.png`; first try (corner of the card place, rejected): `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/03-11-v1-1280x800-board.png`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Token at the card place's corner touched the talon**
- **Found during:** Task 2 (screenshot at 1280 × 800)
- **Issue:** The plan placed the token at the top-left corner of the first player's card place, mirroring « D ». The bottom and top card places sit between the talon and the défausse, so the token overlapped the talon's edge. It would be worse on phones, where 24 px is up to 9 scene units per pixel.
- **Fix:** The token moved to the wood just outside the felt on the starter's side, centred in the bare wood between that side's stable and home lane. Its placement is now a pure module, `starterToken.ts`, unit-tested against every drawn thing of the game. The geometry test then caught a near miss at 480 × 320 with the head box of a knight on blue's first home dot. The token was recentred 50 scene units toward the stable and the gap tightened from 8 to 6 px.
- **Files modified:** apps/web/src/board/FeltTable.svelte, apps/web/src/board/starterToken.ts, apps/web/src/board/starterToken.test.ts
- **Commit:** 7784d2c

**2. [Rule 3 - Blocking] Copy test placed outside `i18n/fr/`**
- **Issue:** The plan named `apps/web/src/i18n/fr/game.test.ts`, but `typography.test.ts` scans every `./fr/**/*.ts` as raw catalogue text, so a test file there would be read as copy.
- **Fix:** The test lives at `apps/web/src/i18n/commence.test.ts`.
- **Commit:** 7784d2c

**3. [Rule 3 - Blocking] Formatting of the e2e spec**
- **Issue:** I committed Task 3 before running lint, and biome flagged formatting in `commence.spec.ts`.
- **Fix:** Ran `biome check --write` and committed separately (no amend).
- **Commit:** c843ddf

## Known Stubs

None.

## Threat Flags

None. The change only displays public information (the dealer is already public, and the starter is derived from it).

## Self-Check: PASSED

- FOUND: apps/web/src/board/starterToken.ts, apps/web/src/board/starterToken.test.ts, apps/web/src/i18n/commence.test.ts, apps/web/e2e/commence.spec.ts
- FOUND commits: e857331, ab8c029, 7784d2c, 48c444a, c843ddf (all ancestors of HEAD)
