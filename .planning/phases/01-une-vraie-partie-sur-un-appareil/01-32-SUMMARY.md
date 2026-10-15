---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 32
subsystem: board
status: complete
tags: [board, plateau-galet, landscape, portrait, svg, e2e, tdd, gap-closure]
requires:
  - "01-29 (packages/board scene/art pattern, KNIGHT, BoardArt as explicit SVG)"
  - "01-30 (anchorOf = sceneXY, Board box with --head-room)"
  - "01-31 (Overlay/HitLayer sized by knightScale, relational specs)"
  - "bd249db (cardFx seatSlot = seatCard, FeltTable/FaceUpCard from SCENE.card)"
provides:
  - "packages/board scene.ts: Layout, LAYOUTS, MOCKUP, sceneOf(layout), SCENE (transitional portrait alias), KNIGHT, knightScale, PALETTE (galet), bottomOf, sceneSideOf, sceneXY, seatCard, stableCentre, ringPolyline, boardOutline, riderBox, FeltShape, Scene"
  - "packages/board art.ts: Art, ArtDef, ArtShape (outline, image, hand font, fillDef/filter/clip), boardArt(k, layout), feltPath, artSvg(art, options)"
  - "BoardArt.svelte draws defs + shapes for a layout; Board.svelte layout prop, data-board-layout, scene aspect ratio, felt button shaped like the felt, drawing in its own svg layer"
  - "anchorOf(place, k, layout); DirectorDeps.layout; SessionEnv.layout"
  - "Game.svelte debug parameter plateau=largeur|hauteur, --board-ratio"
  - "e2e tracer « traceur : le galet en largeur à 1280 × 800 »"
affects: ["01-33", "01-34", "01-35", "01-36", "01-37", "01-38", "01-39"]
tech-stack:
  added: []
  patterns:
    - "Every geometry function takes the layout as its last parameter (transitional default « portrait », removed in 01-39)"
    - "Drawing data = { defs, shapes }; defs referenced by fixed « toc- » ids, artSvg refuses an undeclared reference"
    - "CSS box-shadows of the mock-up rendered as offset detail copies and an inner-shadow crescent path, no blur filter"
    - "The static board drawing in its own svg with will-change: transform"
key-files:
  created:
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/tdd/01-32-red.json
  modified:
    - packages/board/src/scene.ts
    - packages/board/src/scene.test.ts
    - packages/board/src/art.ts
    - packages/board/src/art.test.ts
    - apps/web/src/board/BoardArt.svelte
    - apps/web/src/board/Board.svelte
    - apps/web/src/board/geometry.ts
    - apps/web/src/routes/Game.svelte
    - apps/web/src/game/director.ts
    - apps/web/src/game/session.svelte.ts
    - apps/web/e2e/tracer.spec.ts
    - apps/web/src/board/cardFx.test.ts
decisions:
  - "Scene units = mock-up units x 2 for both galet plateaus (landscape 3200 x 1600, portrait 2000 x 3000); the noise frequencies are halved accordingly"
  - "The Director reads the layout once at the start of each move (anchors()), so a move never mixes two plateaus"
  - "The tracer's ground point is compared with cell 9 moved by its rest offset from cell 3: the mock-up's feet stand 0.28 w below the cell centre"
metrics:
  duration: "75 min"
  completed: 2026-10-14
  tasks: 2
  files: 12
estimate:
  tokens: 110000
  tasks: 2
actuals:
  tokens: 48100
  tasks: 2
  commits: 3
plan_head_before: 926acad9ddd5e574d174cf4b5b3d9a3121632f7b
plan_head_after: 86e761d0c30695661250a2245aa5067386ea22a7
---

# Phase 1 Plan 32: Le plateau galet en largeur dans la vraie partie, et la géométrie et le dessin des deux plateaux galet Summary

Both galet plateaus of design/plateau-galet.dc.html are now pure, tested data in packages/board. The game draws them from that data: the portrait galet by default, and the landscape galet with `plateau=largeur` (debug builds only). In the landscape tracer at 1280 x 800, bleu0 hops cell by cell from cell 3 to cell 15.

## What was built

- **scene.ts.** The geometry is ported from renderVals() as written:
  - It uses `shape()`, the six iterations of s, `at()`, cellPos through startIdx, the frame origins C and `frame()`. Everything is computed in mock-up units, then multiplied by 2. Both layouts are computed once, at module load.
  - The scene carries the layout, step, centre, ring superellipse (a, b, n), the felt's bounding box and shape, the stitch, the talon, the défausse, the pile scale, the card size and the head room.
  - Home dots leave the carré along normalize(2N − T), one every 1.05 step. Stable dots sit at frame(2.4|3.5, 2.0|3.1), and stableCentre is their mean.
  - Riders use cornerTh with f 0.6 or 0.66 and height 2.6 s or 2.5 s, at the picture's 157:209 ratio. Seat cards follow the mock-up's `off` rule.
  - Knight widths are 0.95, 0.82 and 0.78 step.
- **art.ts.** `boardArt(k, layout)` returns `{ layout, width, height, defs, shapes }`, painted in the mock-up's order:
  - the walnut outer rim, then the oak outline;
  - the grain rect (noise `toc-grain`, clipped by `toc-board-clip`), then the outline's fine line and the track;
  - the felt filled with the `toc-felt-light` gradient, then the texture rect (noise `toc-felt`, opacity 0.5, clipped by `toc-felt-clip` to the felt's own outline), the felt rim and the dashed stitch;
  - the 4 rider images;
  - per seat, the 4 home dots and the 4 stable dots (gradients `toc-hole-<colour>`), each over its drop shadow;
  - the 72 cells, each over its drop shadow, with the discs' inner-shadow crescent and the Caveat number at the mock-up's tilt.

  `artSvg(art, { width, height, fontFamily, handFamily?, images? })` serialises defs and shapes. It escapes every value, refuses NaN and undeclared def ids, and writes an image only when it is given an href.
- **Web.**
  - BoardArt draws every def and shape as explicit SVG elements. Images are skipped until 01-33.
  - Board takes `layout`, carries `data-board-layout`, uses the scene's aspect ratio, and shapes the felt button to the felt (50 % radius for the ellipse, the corner radius in percent for the rectangle). The drawing sits in its own svg with `will-change: transform`.
  - `anchorOf(place, k, layout)`. The Director gets an optional `layout()`, read once per move (movement and swap). The session passes it on.
  - Game.svelte reads `plateau=largeur|hauteur` from an allow-list, only in debug builds. It sets `--head-room` and `--board-ratio` from sceneOf, and every `--board-size` formula uses `(var(--board-ratio) + var(--head-room))`. A landscape plateau in today's side panel is 912 px wide at 1280 x 800.

## Measured values

| | landscape (pc-galet) | portrait (tel-galet) |
|---|---|---|
| scene | 3200 x 1600 | 2000 x 3000 |
| step / 2 (mock-up s) | 53.52547 | 54.18516 |
| step (scene) | 107.05094 | 108.37032 |
| ring a, b (scene) | 1511.04, 711.04 | 910.48, 1410.48 |
| headRoom | 0.0216620 | 0.0353575 |
| felt | ellipse rx 600 ry 224 (box 1000, 576, 1200 x 448) | rect 640, 1080, 720 x 840, r 88 |
| talon / défausse | (1450, 800) / (1750, 800), pile 0.95 | (1000, 1391.5) / (1000, 1608.5), pile 0.82 |

A 7th iteration moves s by less than 0.001 on both plateaus (scene test).

## By-eye check

I took screenshots of the game at 1280 x 800 with `plateau=largeur` and on the phone project with the portrait default.
- **Both plateaus:** the wood grain stays inside the oak outline, and the felt texture stays inside the felt only (the dark board around them shows no grain). The cells show the handwritten numbers with their tilt, the colour losanges « 18 » and the carrés « 16 », the hollow home dots and the stable dots under the knights.
- **Transitional, as planned:** the felt's cards and piles (01-35) and the deal badge (01-36) still sit where the old geometry put them.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green, 38 files, 770 passed and 2 skipped (745 before; the C+ scene and art tests were replaced by the galet invariants for both layouts and all four k).
- `pnpm exec vitest run packages/board`: 84 passed.
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 112 scénarios) ».
- `playwright test e2e/tracer.spec.ts` (Task 1 gate): 15 passed, 1 skipped (the landscape tracer is desktop-only).
- Full Playwright suite: 284 passed, 44 skipped, 0 failed in 5.1 min. Phone: 121 passed, 43 skipped. Desktop: 163 passed, 1 skipped. animations.spec timings are included and green.
- Acceptance greps: sceneOf / data-board-layout / plateau=largeur / --board-ratio are all present. `grep -c "toc-" art.ts` gives 8. The frame-clock invariant of e0479d5 holds: animateNow is in animator.ts, cardFx.ts and Particles.svelte, and there is no `.animate(` outside frameClock.ts.
- The landscape tracer recorder took 143 frames. The ground point came within 1.47 px of cell 9, against a quarter step of 7.63 px (the step is 30.51 px).

## TDD Gate Compliance (Task 2)

- **RED:** commit 80d9483. `pnpm exec vitest run packages/board/src/art.test.ts --reporter=tap-flat` exited 1. The target test was « holds the galet's dots, riders, board and felt, and no other role (landscape) », which failed with `expected [] to have a length of 16`. `gsd-tools check tdd-red-evidence` gave **RED_EVIDENCE_OK** (target_test_failed). Semantic assessment: the failure comes from the planned missing drawing (no lanes, defs or riders), not from a load, syntax or fixture fault; 8 tests of the same file passed. The record is in `tdd/01-32-red.json`. The scene invariants passed at once against the Task 1 port. A mutation check (wider discs and losanges) made the overlap tests fail, so they can fail.
- **GREEN:** commit 86e761d, with all 84 board tests passing.
- **REFACTOR:** none.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The tracer's ground-point threshold could not be met as written**
- **Found during:** Task 1
- **Issue:** The plan asked that the shadow's centre come within a quarter step of cell 9's centre. The mock-up stands a knight's feet 0.28 w below the cell centre, and the pre-baked shadow sits 4 sprite units lower still. So the ground point is about 0.30 step below the centre of the cell the knight stands on. Measured on the path: the raw minimum was 8.23 px = 0.27 step, above 0.25.
- **Fix:** The recorder compares the shadow's centre with cell 9's centre moved by the offset the shadow has from cell 3's centre at rest, before the keys are pressed. Result: 1.47 px, or 0.048 step.
- **Files modified:** apps/web/e2e/tracer.spec.ts
- **Commit:** e33bc67

**2. [Rule 3 - Blocking] cardFx.test.ts quoted the C+ seat places as literals**
- **Found during:** Task 1 (`pnpm test`)
- **Issue:** One test from bd249db asserted the C+ coordinates (1000, 2143.4) and so on. This file is outside the plan's file list.
- **Fix:** It now asserts the portrait galet's places, which come straight from the mock-up's `off` rule: bottom (1000, 1809.4), top (1000, 1190.6), left (750.6, 1500), right (1249.4, 1500). The tolerance is unchanged.
- **Commit:** e33bc67

**3. [Rule 1] The ghost check in tracer.spec still used the C+ step**
- **Fix:** 126.156 was replaced by the portrait galet's 108.37, which makes the half-step check stricter.
- **Commit:** e33bc67

**4. [Rule 1] The painting-order test I wrote in RED was too strict**
- **Issue:** The mock-up draws the outline's fine line (a detail of the board) after the grain. The order checks now compare objects, not details.
- **Commit:** 86e761d

**5. A stale plan ledger was left by the stopped C+ 01-32 run**
- **Issue:** `.git/gsd-plan-head-before-01-32` held 1ab8e71, which would have counted bd249db and the docs commits as this plan's.
- **Fix:** It was reset to 926acad before the first commit.

## Known Stubs

These are transitional by plan, not blockers for this plan's goal:
- **Rider images:** the rider image shapes exist in boardArt, but BoardArt skips them and artSvg needs an href. Romain's riders are shipped in 01-33.
- **Landscape plateau, other layers:** on the landscape plateau the knights' sizes and overlays (Pawn, Overlay, HitLayer, Particles, DebugGeometry) still use the portrait default (01-34). The felt cards, piles and FaceUpCard use the SCENE alias (01-35), and DealBanner is fixed in 01-36.
- **Rules pictures:** tools/render-scenarios.mjs still runs with the transitional defaults (portrait). The rules pictures were not regenerated (01-33).

## Threat Flags

None beyond the plan's register. T-01-50: explicit elements, escaped artSvg, declared def ids only. T-01-51: the drawing has its own layer, and the animation timings are green. T-01-52: debug builds only, with an allow-list of two values. T-01-SC: no package added.

## Self-Check: PASSED

- FOUND: packages/board/src/scene.ts, art.ts, scene.test.ts, art.test.ts, apps/web/src/board/Board.svelte, BoardArt.svelte, apps/web/e2e/tracer.spec.ts
- FOUND commits: e33bc67, 80d9483, 86e761d
