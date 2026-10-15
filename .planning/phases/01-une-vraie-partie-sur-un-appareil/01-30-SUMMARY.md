---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 30
subsystem: board
status: complete
tags: [board, plateau-c-plus, svg, layout, knights, e2e, gap-closure]
requires:
  - "01-29 (packages/board scene.ts and art.ts: SCENE, KNIGHT, knightScale, bottomOf, sceneXY, boardArt)"
provides:
  - "apps/web/src/board/BoardArt.svelte: board C+ drawn from boardArt(k) as Svelte SVG markup (data-board-art, data-bottom, data-cell, data-exit, data-entry)"
  - "Board.svelte without raster: viewBox 0 0 2000 3000, aspect-ratio 2/3, data-bottom, felt button over SCENE.felt"
  - "anchorOf(place, k) = sceneXY(place, k)"
  - "Pawn.svelte at the C+ sizes (knightScale), feet KNIGHT.feet x size below the anchor, 150 ms zone easing"
  - "Game.svelte 2:3 width formulas with --head-room"
affects: ["01-31", "01-32", "01-33", "01-34", "01-35", "01-36"]
tech-stack:
  added: []
  patterns:
    - "Board drawing rendered from declarative shape data, one Svelte branch per shape kind, no markup strings"
    - "Knight size and feet offset on data-role=\"zone\" groups eased by a CSS transition, never touched by WAAPI"
key-files:
  created:
    - apps/web/src/board/BoardArt.svelte
  modified:
    - apps/web/src/board/Board.svelte
    - apps/web/src/board/geometry.ts
    - apps/web/src/board/geometry.test.ts
    - apps/web/src/board/Pawn.svelte
    - apps/web/src/board/HitLayer.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/e2e/tracer.spec.ts
    - apps/web/e2e/board.spec.ts
    - apps/web/e2e/table.spec.ts
    - apps/web/e2e/finition.spec.ts
    - apps/web/e2e/cibles.spec.ts
decisions:
  - "data-cell is carried only by the main shape of each ring cell (disc, losange or carré), not by its label or its secondary stroke, so there are exactly 72 [data-board-art] [data-cell]"
  - "The knight's size lives on three data-role=\"zone\" groups (feet offset outside the mover, the two former scale(size) groups as CSS transforms), so the mover's translations and the arc heights stay in scene units exactly as the animator computes them"
  - "The sprite <use> stays at y = -186 (the feet 4 sprite units above its bottom edge, as before); the knight's top is therefore 4 x size units lower than the mock-up's formula, below a pixel at every supported size"
metrics:
  duration: "12 min"
  completed: 2026-10-14
  tasks: 2
  files: 12
estimate:
  tokens: 80000
  tasks: 2
actuals:
  tokens: 10100
  tasks: 2
  commits: 2
plan_head_before: df45584465a8700ee83418a2a6fa2a9533985528
plan_head_after: 602fecc193d84c92f058a58045f6a9dcc6f30966
---

# Phase 1 Plan 30: Le plateau C+ dans la partie Summary

The game now draws board C+ from `boardArt(k)` as plain Svelte SVG markup on a portrait 2:3 board without any raster image. Each knight stands on its drawn C+ cell, home slot or stable hole, at the mock-up's sizes (0.92 / 0.8 / 0.72 step). The board width follows the 2:3 formulas with `--head-room`, and no page scrolls at any of the five supported sizes.

## What was built

- **BoardArt.svelte** (new). `<g data-board-art data-bottom role="img" aria-label="Le plateau du jeu de TOC">` has one `{#if}` branch per shape kind (rect, circle, polyline, path, text). Every paint field and transform is bound as an attribute and nothing is built from a markup string (T-01-42). Ring cells carry `data-cell`. The losanges carry `data-exit={color}` and the carrés `data-entry={color}`. The numerals use `var(--font-ui)` and are `aria-hidden`. The group has `pointer-events: none`. The drawing is `$derived` once per k (T-01-43).
- **Board.svelte**. These are gone:
  - the `<img>`, srcset and sizes;
  - the loading backdrop, the status and the attempt counter;
  - « Réessayer » and the failure block, with their styles.

  The SVG has viewBox `0 0 2000 3000` and draws `<BoardArt>` first, then the existing layers in the same order. `px = SCENE.width / width`. The root always has the class `loaded` and carries `data-k` and `data-bottom`. Its width is `--board-size`, with `aspect-ratio: 2 / 3` and `margin-top: width x --head-room`. It has no background. The felt button is placed over `SCENE.felt` with percentages computed from the scene (44 x 44 minimum kept).
- **geometry.ts**. `anchorOf(place, k)` returns `sceneXY(place, k)` and keeps its signature, so the Director, the session, the animator and their tests are unchanged. geometry.test.ts checks three things:
  - anchorOf equals sceneXY for every place and all four k;
  - for each colour, its exit is in the lower half and its partner's in the upper half;
  - the next seat clockwise is on the left and the previous one on the right.
- **Pawn.svelte**. The size is `knightScale(place)`. A `zone` group outside the mover translates the feet `KNIGHT.feet x size` below the anchor, and the two former `scale(size)` groups became CSS-transform `zone` groups. All three ease over 150 ms (`transition: transform 150ms ease-out`). There is no transition with « Réduire les animations » or `prefers-reduced-motion`. The hit circle of a selectable knight follows the sprite body at its size (cy = −(KNIGHT.body + KNIGHT.feet) x size, r = 0.65 x KNIGHT.w x size).
- **Game.svelte**. `<main class="game" style:--head-room={SCENE.headRoom}>`. The board width is:
  - portrait: `min(100vw − inset-x − 2 x space-md, (100dvh − chrome − inset-y) / (1.5 + head-room), 880px / 1.5)`;
  - landscape: `min((100dvh − 32px − inset-y) / (1.5 + head-room), 100vw − 368px − inset-x)`;
  - short landscape: the same without the 32 px.

  The style header comment was rewritten for the 2:3 board (D-07).

### Board sizes measured (width x height, CSS px)

| Screen | Board | Limited by |
|--------|-------|------------|
| 320 x 480 | 103.5 x 155.2 | height ((480 − 320) / 1.5466) |
| 375 x 667 | 229.5 x 344.3 | height |
| 390 x 844 | 344.0 x 516.0 | height ((844 − 312) / 1.5466) |
| 480 x 320 (landscape) | 112.0 x 168.0 | width (480 − 368) |
| 1280 x 800 (landscape) | 496.6 x 744.9 | height ((800 − 32) / 1.5466) |
| phone project (iPhone 13, 390 x 664) | 227.6 x 341.4 | height |

As the plan's size note expected, this is the intermediate state: the chrome of 01-24 is unchanged, and 01-33 compacts the phone screen. I checked the screenshots at 1280 x 800 and on the phone project by eye: the camps are seated as specified (bleu at the bottom, rouge at the top, jaune on the left, vert on the right), the stables are full of knights and nothing on the board is cut.

## Task commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Tracer: the game draws C+ and a knight hops to the right cell | 74d435b | BoardArt.svelte, Board.svelte, geometry.ts, geometry.test.ts, Pawn.svelte, HitLayer.svelte, Game.svelte, tracer.spec.ts |
| 2 | The specs read the 2:3 board, whole suite green | 602fecc | board.spec.ts, table.spec.ts, finition.spec.ts, cibles.spec.ts, geometry.test.ts |

## Verification

- `pnpm typecheck`: 0 errors (svelte-check, 278 files).
- `pnpm lint`: Biome clean (146 files).
- `pnpm test`: 38 files, 749 passed and 2 skipped. The anchorOf block went from 3 tests to 3: « equals sceneXY », « exits low/high » and the new « next left, previous right ».
- `pnpm exec vitest run apps/web/src/board`: green. no-raw-html.test.ts passes and scans BoardArt.svelte.
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 112 scénarios) ».
- `playwright test e2e/tracer.spec.ts`: 14 passed on phone and desktop. This includes bleu0 on `[data-cell="3"]` before the Dame and on `[data-cell="15"]` after it, within 0.5 scene units.
- Full Playwright suite on both projects: **281 passed, 43 skipped, 0 failed** (5.2 min). That includes animations.spec.ts (timings, T-01-43), reglages, cibles (44 px) and finition (no scroll at the five sizes).
- The plan's acceptance greps pass (`data-board-art`, `sceneXY`, `knightScale`, `--head-room`, `data-board-art` in board.spec, `data-bottom` in table.spec).
- None of the specs opened the tray on the smaller board, so no position had to be moved and the 44 px rule is unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The hit layer's miss rectangle covered only the old square**
- **Found during:** Task 1.
- **Issue:** HitLayer.svelte catches a tap that misses every lit knight with a transparent `<rect>` of 2560 x 2560. In the 2000 x 3000 scene it would have left the bottom sixth of the board without a « miss ».
- **Fix:** The rect is now `SCENE.width x SCENE.height`. The target offsets themselves are left for 01-31, as planned.
- **Files modified:** apps/web/src/board/HitLayer.svelte (not in the plan's file list).
- **Commit:** 74d435b

**2. [Choice] Three `zone` groups instead of one size group**
- The plan asks for the size to sit "on its own group". I used one feet-offset group outside the mover plus the two existing scale groups, all with class `zone` and `data-role="zone"`. A single group around the mover would have scaled the mover's translations, and a single group around the arc would have scaled the hop heights, which the animator computes in scene units. The three groups ease together. Giving them `data-role="zone"` also keeps the CSS transitions out of the e2e recorders' « particle » bucket.

**3. [Choice] The sprite offset was kept**
- `<use y="-186">` is unchanged, so the feet are 4 sprite units above the sprite's bottom edge, as before, and the shadow symbol stays where it was. The knight therefore sits 4 x size scene units lower than the mock-up's `top = y − h + 0.28 w`. That is under 0.3 px at 1280 x 800.

**4. [Spec adaptation] The unit test count is unchanged**
- The two old « rotation » anchorOf tests were replaced by the C+ ones the plan describes. I added the seating test (next on the left, previous on the right) so the total stays at 749.

**5. [Scope note] i18n strings `loadFailed` and `retry` were left in board.ts**
- They are now unused. Removing the former raster layer and its texts is planned for 01-34 and 01-35.

Nothing was changed on STATE.md, ROADMAP.md or the requirement checkboxes, as the orchestrator instructed.

## Known Stubs

None. As the plan says, the felt cards (FeltTable, cardFx, Overlay's seat slot) still use the old 2560 coordinates, so they now sit off-centre on the C+ felt until 01-32. The knight-relative offsets of the halos and hit targets come in 01-31. DebugGeometry's felt and card boxes are old-layout until 01-35. All of these are scheduled work in the next plans, not stubs of this plan's goal.

## Threat Flags

None. BoardArt is the only new markup producer. It uses bound attributes only and no-raw-html.test.ts scans it (T-01-42). No package was added (T-01-SC).

## Self-Check: PASSED

- FOUND: apps/web/src/board/BoardArt.svelte
- FOUND commits: 74d435b, 602fecc (both ancestors of HEAD)
