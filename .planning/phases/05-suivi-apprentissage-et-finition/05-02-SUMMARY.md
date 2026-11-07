---
phase: 05-suivi-apprentissage-et-finition
plan: 02
subsystem: board
tags: [svg, accessibility, settings, svelte, app-05]
status: complete

requires:
  - phase: 01-jouer-une-partie-juste-en-solo
    provides: the galet drawing (packages/board art.ts, scene.ts), KnightDefs symbols, Pawn groups, settings store, Réglages sheet
  - phase: 03-ordinateurs-de-force-reglable
    provides: the « 1er » token (starterToken.ts) and its clearance test
provides:
  - SEAT_MARKS and markPath in @toc/board (round, triangle, square, star; one source for every mark)
  - knight-mark-{couleur} symbols, drawn by the board knights and the knight tray only
  - settings.knightMarks (default true) and the « Formes sur les chevaux » switch in Réglages
  - stable-mark shapes in boardArt(k) and stableMarkAt(color, k)
  - prefixArt(art, prefix) and BoardArt's optional `ids` prop (several boards on one page)
affects: [05-04 rule figures (BoardArt ids prefix, marks drawn for free), 05-10 audit, 05-11 confirmations]

actuals:
  tokens: 12800
  tasks: 2
  commits: 4
plan_head_before: 4e41c379516674f665da0a71f50caa2a5e7f5dc6
plan_head_after: 6305f74c70eeb7949d2b3dca3d7a0ce0af18e9eb

tech-stack:
  added: []
  patterns:
    - "A per-seat overlay on the knight is its own <symbol> used beside the knight's <use> inside the rear group, so the card back and tiles (which use knight-{couleur}) never get it"
    - "A board decoration is placed in its seat frame per screen side (the drawing never turns) and proven clear of every game object by a clearance test at every k"
    - "Def ids of a drawing prefixed through a pure prefixArt(), the empty prefix returning the drawing unchanged"

key-files:
  created:
    - packages/board/src/marks.ts
    - packages/board/src/marks.test.ts
    - apps/web/src/board/stableMarks.test.ts
    - apps/web/e2e/marques.spec.ts
  modified:
    - packages/board/src/index.ts
    - packages/board/src/art.ts
    - packages/board/src/art.test.ts
    - apps/web/src/board/BoardArt.svelte
    - apps/web/src/board/KnightDefs.svelte
    - apps/web/src/board/Pawn.svelte
    - apps/web/src/ui/PawnTray.svelte
    - apps/web/src/ui/SettingsSheet.svelte
    - apps/web/src/settings/settings.ts
    - apps/web/src/settings/settings.test.ts
    - apps/web/src/i18n/fr/reglages.ts
    - apps/web/e2e/reglages.spec.ts

key-decisions:
  - "The knight mark is its own symbol knight-mark-{couleur} (05-RESEARCH Pattern 7 / Pitfall 7), not drawn inside knight-{couleur} as the UI-SPEC first said"
  - "Knight mark centred at x 55, y 152 of the 110 x 190 sprite (the pedestal), disc 60, shape 40, ink 3"
  - "Stable marks placed per screen side in the seat frame: bottom/top ta 4.9 na 2.55, left ta 0.8 na 1.6, right ta 0.15 na 1.6 (margins 0.45 / 0.53 / 0.54 step)"
  - "Stable mark line kept at the UI-SPEC's 1.5 scene units (STABLE_MARK.line, one constant if Romain wants it bolder)"

patterns-established:
  - "prefixArt for any second board on a page; the game board passes no prefix"

requirements-completed: [APP-05]

duration: 45min
completed: 2026-11-07
---

# Phase 5 Plan 02: Les formes des places, sur les chevaux et à côté des écuries Summary

**Each seat's shape (Bleu round, Jaune triangle, Rouge square, Vert star) on every knight's base, switchable in « Réglages », and beside every stable on the wood, from one SEAT_MARKS source in packages/board, with clearance tests at every turn of the board and per-board def ids.**

## Performance

- **Duration:** about 45 min
- **Completed:** 2026-11-07
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- `packages/board/src/marks.ts`: `SEAT_MARKS` (D-14, never a diamond) and `markPath(shape, cx, cy, r)`, closed paths symmetric about the vertical axis, so a mirrored knight shows the same mark.
- `KnightDefs.svelte`: one `knight-mark-{couleur}` symbol per colour (cream disc 60 units, 3-unit ink line, seat-coloured shape 40 units, ink stroke 3), centred on the pedestal (x 55, y 152). `Pawn.svelte` draws it inside the rear group right after the knight, so it hops, squashes and rears with the knight. `PawnTray.svelte` draws it on its chips too. The card back, colour tiles, seat tiles and the overlay's ghost still use only `knight-{couleur}` and never show a mark.
- `settings.knightMarks` is on by default and parsed on its own with `bool()`. Any non-boolean falls back to on (T-05-07). The switch « Formes sur les chevaux » with the UI-SPEC helper sits right after « Réduire les animations » in the one `SettingsSheet` used on the home, the solo setup, the waiting room and the game.
- `boardArt(k)` draws a `stable-mark` per colour: a cream disc of 0.9 step with an ink line, then the seat's shape of 0.6 step in its colour, painted after the dots and before the cells, `aria-hidden`, always shown. `stableMarkAt(color, k)` places it in the seat frame for its screen side. The offsets and their margins are recorded in a comment in art.ts.
- `prefixArt(art, prefix)` and `BoardArt`'s `ids` prop prefix every def id and `url(#…)`. The game board passes nothing and keeps its `toc-` ids. `artSvg` accepts prefixed ids.

## Task Commits

1. **Task 1 RED:** `3d54021` test(05-02): seat shapes on the knights and their switch (RED)
2. **Task 1 GREEN:** `04e564d` feat(05-02): the seat's shape on every knight, with its switch in Réglages
3. **Task 2 RED:** `8c8db90` test(05-02): stable marks and per-board ids (RED)
4. **Task 2 GREEN:** `6305f74` feat(05-02): each stable's shape on the wood beside it, and per-board ids

## Gate

- `pnpm typecheck` OK, `pnpm lint` OK (394 files).
- `pnpm test`: 125 files, 1950 passed, 2 skipped. The first run of the full gate had 1 failing test that I did not identify. Two clean reruns that followed both passed fully, so it looks like an unrelated timing flake.
- Local Playwright (both projects): 473 passed, 99 skipped (7.4 min).
- Online suite (`playwright.online.config.ts`): 110 passed, 2 skipped (8.6 min).
- Nothing was left listening on 8787 or 4173 (checked by connecting).

## Screenshots

Under `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/`. They show knights of all four colours on the ring, at home and in the stables:
- `05-02-marques-on-844x390.png`, `05-02-marques-on-1280x800.png` (marks on)
- `05-02-marques-on-844x390-zoom.png` (detail of the knight and stable marks at phone size)
- `05-02-marques-off-844x390.png`, `05-02-marques-off-1280x800.png` (switch off: the knights are plain and the stable marks stay)

What the screenshots show: at 844 × 390 the knight mark is about 12 px and the shape is readable for Bleu, Rouge and Vert. The yellow triangle on cream is the weakest: its ink outline carries it. The stable marks clear the cells, dots, riders, « 1er » token and felt.

## Decisions Made

- The mark is a separate symbol, as the research says, because the card back and tiles share `knight-{couleur}`.
- Stable marks are placed per side, not with one formula, because the knights stand upright. On the right side the stable's knights reach upward, so that mark sits a little further from its stable than on the left.
- The stable line stays at 1.5 scene units, as the UI-SPEC says. It is thin (about 0.3 to 0.6 px) but visible, and it keeps the mark from looking like an empty ring cell, which has a thick ink border. One constant (`STABLE_MARK.line`) changes it.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test bound] « Beside its stable » bound relaxed from 2.6 to 3.2 steps**
- **Found during:** Task 2 GREEN
- **Issue:** I picked the bound of 2.6 steps myself in the RED test. The right side's mark has to sit 2.96 steps from its stable centre to clear the upright stable knights' heads by 0.1 step.
- **Fix:** Bound set to 3.2 steps. The test still requires the mark to be nearer its own stable than any other, and farther from the felt than its stable.
- **Files modified:** packages/board/src/art.test.ts
- **Commit:** 6305f74

**2. [Rule 1 - Shape size] Triangle height 1.7 r instead of a first 1.8 r**
- **Found during:** Task 1 GREEN
- **Issue:** At 1.8 r the triangle overflowed its 2r box (the RED test caught it).
- **Fix:** Height set to 1.7 r.
- **Commit:** 04e564d

There were no architectural changes and no new packages. `scene.ts` was not touched: the stable-mark position is derived in art.ts from the stable dots.

## Known Stubs

None.

## À confirmer par Romain (for 05-11)

1. **Les formes sur les chevaux, allumées par défaut** (UI-SPEC « à confirmer » 1): look at them at arm's length on the iPhone, especially the yellow triangle.
2. **Où sont les marques des écuries**: at the top and bottom they sit beside the stable on the far side from the felt; on the left and right they sit on the outer side of the stable, toward the board's middle line. Their ink line is thin (UI-SPEC value).

## Deploy Notes

No migration, secret or config change. The wrangler configs were not touched. Rebuild before deploying, as usual.

## Self-Check: PASSED

- FOUND: packages/board/src/marks.ts, packages/board/src/marks.test.ts, apps/web/src/board/stableMarks.test.ts, apps/web/e2e/marques.spec.ts
- FOUND commits: 3d54021, 04e564d, 8c8db90, 6305f74
