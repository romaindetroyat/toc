---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 40
subsystem: board
status: complete
tags: [plateau-galet, paysage-obligatoire, cleanup, rule-pictures, caveat, gap-closure]
requires:
  - "01-33 (the rule pictures on the landscape galet, 1200 x 1200)"
  - "01-38 (the Director and the session without layout; no portrait chrome)"
  - "01-39 (the raster board and its tools gone)"
provides:
  - "packages/board/src/scene.ts: one galet (MOCKUP = the pc-galet frame), computed once, exported as SCENE; knightScale(place), stableCentre(color, k), sceneXY(place, k), ringPolyline(), boardOutline(), riderBox(color, k), seatCard(seat, k); Scene without layout; FeltShape = the ellipse; `export type { Point }`"
  - "packages/board/src/art.ts: boardArt(k); Art without layout; feltPath draws the ellipse; Point from ./scene.ts"
  - "scene.test.ts and art.test.ts on the landscape galet only (19 portrait cases removed)"
  - "apps/web: Game, Board, BoardArt and geometry name no layout; [data-board] has no data-board-layout, [data-board-art] no data-art-layout"
  - "tools/render-scenarios.mjs: the four board drawings rasterised by the e2e's Chromium with the repository's Caveat embedded and checked loaded; docs/regles re-rendered (112 webp, 1200 x 1200, deterministic)"
affects: ["01-41"]
tech-stack:
  added: []
  patterns:
    - "A tool rasterises SVG text through the e2e's own Chromium with the font inlined as @font-face data URIs, network aborted, and a hard failure if the face is not loaded"
key-files:
  created: []
  modified:
    - apps/web/src/routes/Game.svelte
    - apps/web/src/board/Board.svelte
    - apps/web/src/board/BoardArt.svelte
    - apps/web/src/board/geometry.ts
    - apps/web/src/board/DebugGeometry.svelte
    - apps/web/src/board/cardFx.ts
    - packages/board/src/scene.ts
    - packages/board/src/scene.test.ts
    - packages/board/src/art.ts
    - packages/board/src/art.test.ts
    - tools/render-scenarios.mjs
    - docs/regles/*.webp (112)
decisions:
  - "MOCKUP keeps the landscape entry flattened (MOCKUP.width, .felt, .grain, .rider, .pile) rather than MOCKUP.landscape.*: there is nothing left to choose between"
  - "FeltShape keeps its `kind: \"ellipse\"` tag, so the shape stays self-describing and cardFx.test.ts's guard still reads"
  - "The Caveat check requires a loaded FontFace named Caveat as well as document.fonts.check(), because check() is also true when no face of that family exists at all (verified: with the @font-face removed the script exits 1)"
  - "The page loads Caveat explicitly (document.fonts.load('700 32px \"Caveat\"', '0123456789')) before awaiting document.fonts.ready, with font-display: block"
metrics:
  duration: "30 min"
  completed: 2026-10-14
  tasks: 3
  files: 11
estimate:
  tokens: 70000
  tasks: 3
actuals:
  tokens: 23300
  tasks: 3
  commits: 3
plan_head_before: 48f31212b97111f12da0e056e28e0babb1e9ac2f
plan_head_after: 9ef5b1ee486b244f6dcf326d4fe5f230f6029d22
---

# Phase 1 Plan 40: Un seul plateau dans le code, le galet en largeur, et les numéros des images en Caveat Summary

**The code now holds one board, the landscape galet: no portrait variant, no layout type, list, factory, parameter or field anywhere in packages/board, the app or the picture tool. The rule pictures now draw their cell numbers in the game's Caveat, rasterised through the e2e's Chromium from the repository's own OFL WOFF2 files.**

## What was built

### Task 1 (tracer), bc24032: the game names no layout
- **Game.svelte:** the `boardLayout` constant and `boardScene` are gone. `--head-room` and `--board-ratio` come from `SCENE`. `anchorOf(…, k)` takes no layout, and Board gets no `layout` prop.
- **Board.svelte:**
  - reads `SCENE` (viewBox, aspect ratio, felt box);
  - drops the `layout` prop and `data-board-layout`;
  - the felt button's radius is the ellipse's `50%`;
  - the CSS fallback for `--head-room` is now 0.0217 instead of portrait's 0.0354. It is never used, because Game always sets the variable.
- **BoardArt.svelte:** `{ k }` only, draws `boardArt(k)`, no `data-art-layout`.
- **geometry.ts:** `anchorOf(place, k)`.
- **art.ts (one line, see Deviations):** boardArt's default layout was `"portrait"`. It is now `"landscape"`.
- Tracer gate:
  - typecheck 0 errors, lint clean, vitest 783 passed, 2 skipped;
  - both greps are silent;
  - tracer, board, ecrans, compact and tourne: 65 passed, 41 skipped, 0 failed on both projects.
  - The gate passed, so the plan went on.

### Task 2, 9dcf3ad: packages/board keeps only the landscape galet
- **scene.ts:**
  - `MOCKUP` is the pc-galet frame alone;
  - `compute()` runs once into `GEOMETRY`, and `SCENE = GEOMETRY.scene`;
  - gone: `Layout`, `LAYOUTS`, `sceneOf`, `geometryOf` and the per-layout cache;
  - the seven geometry functions lose their layout parameter;
  - `Scene` loses `layout`, and `FeltShape` is the ellipse only. seatCard's formula reduces to the ellipse branch: same numbers;
  - `export type { Point }` (from ./layout.ts until 01-41).
  - The header quotes Romain's « Pour la version iphone, oblige à jouer en format paysage, ça permettra d'utiliser le même plateau » and « Oui, paysage obligatoire ».
- **art.ts:**
  - `boardArt(k: number)`, and `Art` has no `layout`;
  - `feltPath` draws the 96-point ellipse;
  - `MOCKUP.grain`, and every geometry call without a layout;
  - `Point` comes from ./scene.ts.
  - The shapes, their order and their attributes are unchanged. The pictures prove it, see below.
- **scene.test.ts / art.test.ts:**
  - the portrait cases are gone: the portrait size test, and the portrait run of each layout loop (convergence, ring ×4, seating ×2, no overlap ×3, knights ×2, boardArt ×6);
  - the landscape cases stay, unlooped and without a layout argument;
  - the synthetic `Art` objects lose `layout`;
  - `insideFelt` is the ellipse test;
  - the seat helpers (`quarterTurnsFor`, `bottomOf`, `screenSideOf`) are still tested through ./index.ts.
  - vitest: 764 passed, 2 skipped, which is 783 − 19 removed portrait cases.
- **render-scenarios.mjs:** reads `SCENE`, draws `boardArt(k)` and places pawns at `sceneXY(place, k)`. Re-rendered with sharp: `git status --porcelain docs/regles` was empty, so the 112 pictures are byte for byte identical. rules-trace --images OK.

### Task 3, 9ef5b1e: the cell numbers in Caveat
- **boardFor(k) now goes through Chromium:**
  - `@playwright/test` resolved with `createRequire(apps/web/package.json)`;
  - the executable is chosen as in playwright.config.ts: CHROMIUM_PATH, then /opt/pw-browsers/chromium-1194/chrome-linux/chrome if it exists, else Playwright's own, with `--no-sandbox`;
  - one browser and one page (1200 x 600, deviceScaleFactor 1) serve the four k, and the browser is closed in a `finally`.
- **The page:**
  - holds the same `artSvg(boardArt(k), …)` (handFamily « Caveat, DejaVu Sans, Arial, sans-serif ») inline;
  - two `@font-face` rules for « Caveat » (weights 400 to 700, the app.css unicode-ranges, `font-display: block`) with caveat-latin.woff2 and caveat-latin-ext.woff2 inlined as base64 data URIs;
  - zero margins and a transparent background (`omitBackground`, as librsvg's transparent PNG was);
  - `page.route("**/*", abort)`.
- **The font check:**
  - the script loads Caveat, awaits `document.fonts.ready`, then requires a loaded FontFace named Caveat and `document.fonts.check('700 32px "Caveat"')`. Otherwise it throws and exits non-zero.
  - Negative test: a copy with the CSS emptied exited 1 with « Caveat is not loaded (k = 0) ». It was deleted afterwards.
- **What stays in sharp:** the pawn layers, halos, the DejaVu Sans letters and labels, the 1200 x 1200 composition and the webp encoding (quality 70). Nothing about them changed.
- **Pictures:**
  - 112 webp, all 1200 x 1200;
  - two renders in a row: `diff -rq` is silent, so rendering is deterministic;
  - rules-trace: OK (16 règles, 112 scénarios).
- **Pictures looked at:**
  - **R-07.1** (Dame, bleu0 from 3 to 15): every ring number (1–17, the « 16 » carrés, the « 18 » losanges) is in Caveat: the open 4, the hooked 7, the handwritten 1. Compared with the previous DejaVu Sans version of the same picture.
  - **R-09.1** (the yellow pawn on the ring) and **R-13.4**: same Caveat numbers, unchanged board, riders, felt, pawns and pills.
  - PNG copies in the scratchpad: `…/scratchpad/shots/01-40-R-07.1.png`, `01-40-R-09.1.png`, `01-40-R-13.4.png`, and the previous version `01-40-R-07.1-before.png`.

## Gates (final)

| Gate | Result |
|------|--------|
| `pnpm typecheck` | 0 errors (svelte-check 283 files, 0 errors, 0 warnings) |
| `pnpm lint` | Biome: 148 files, no issue |
| `pnpm test` (vitest) | 38 files, **764 passed, 2 skipped** (baseline 783: −19 portrait cases) |
| rules-trace --images | **OK (16 règles, 112 scénarios)** |
| Pictures | 112 webp, all 1200 x 1200; two renders identical |
| frameClock | animateNow in animator.ts, cardFx.ts and Particles.svelte; no `.animate(` in apps/web/src/board outside frameClock.ts |
| e2e/animations.spec.ts | 52 passed (both projects) |
| Full Playwright (phone + desktop) | **333 passed, 83 skipped, 0 failed** (5.9 min), same as the baseline |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] boardArt defaulted to the portrait galet**
- **Found during:** Task 1 (tracer e2e: board, tracer, ecrans, compact and tourne failed: riders outside the board's box)
- **Issue:** the plan's interface said every package parameter defaults to landscape, but `boardArt(k, layout = "portrait")` did. Board used to pass `layout="landscape"` explicitly. With the prop removed, BoardArt drew the portrait galet inside the 2:1 board.
- **Fix:** boardArt's default set to `"landscape"` in Task 1 (one line of art.ts, which Task 2 then rewrote without the parameter).
- **Files modified:** packages/board/src/art.ts
- **Commit:** bc24032

**2. [Rule 3 - Blocking] Two app files branched on the rectangular felt**
- **Found during:** Task 2 (typecheck)
- **Issue:**
  - DebugGeometry.svelte drew a `<rect>` for a non-ellipse felt, and `x`, `y`, `w`, `h`, `r` no longer exist on FeltShape;
  - cardFx.ts had a dead `if (shape.kind !== "ellipse") return true`.
- **Fix:** the debug view draws the ellipse only, and the dead branch is removed. The behaviour is unchanged on the galet.
- **Files modified:** apps/web/src/board/DebugGeometry.svelte, apps/web/src/board/cardFx.ts
- **Commit:** 9dcf3ad

**3. [Rule 2 - Correctness] Caveat check hardened**
- **Found during:** Task 3
- **Issue:** `document.fonts.check()` is true when no face of that family exists at all. On its own it would not catch a missing @font-face.
- **Fix:** the check also requires a loaded FontFace named Caveat. Verified with a negative run (exit 1).
- **Files modified:** tools/render-scenarios.mjs
- **Commit:** 9ef5b1e

Also: the `artSvg` structural test's output height went from 900 to 300 (landscape proportions). Only the width is asserted.

## Known Stubs

None.

## Threat Flags

None. The renderer's surface is as the threat model describes (T-01-64): repository data only, network aborted, browser closed in `finally`, writes only docs/regles. No package was added (T-01-SC).

## For Romain

- No French UI wording changed and nothing changes in the game: same board, same knights' places, same screen sizes (the full e2e suite is unchanged).
- The rule pictures (docs/regles, shown in RULES.md) now write the cell numbers in the game's handwriting (Caveat) instead of a plain font. The pictures are otherwise the same. To re-test in 01-41.

## Self-Check: PASSED

- FOUND: packages/board/src/scene.ts (`export const SCENE`), packages/board/src/art.ts (`export function boardArt(k: number)`), tools/render-scenarios.mjs (caveat-latin.woff2, caveat-latin-ext.woff2, document.fonts.check)
- FOUND: bc24032, 9dcf3ad, 9ef5b1e in HEAD's history
- FOUND: 112 webp files in docs/regles
