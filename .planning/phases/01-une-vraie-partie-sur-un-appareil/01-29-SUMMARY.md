---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 29
subsystem: board
status: complete
tags: [board, geometry, svg, plateau-c-plus, rules-pictures, ui-spec, gap-closure]
requires:
  - "01-28 (keyboard hints; tree green before C+)"
  - "design/plateau-maquette.dc.html (renderVals, portrait, idees01)"
provides:
  - "packages/board/src/scene.ts: SCENE, MOCKUP, PALETTE, KNIGHT, knightScale, bottomOf, sceneSideOf, sceneXY, ringPolyline, seatCard, stableCentre"
  - "packages/board/src/art.ts: ArtShape, ArtRole, ArtTransform, boardArt(k), artSvg(shapes, options)"
  - "docs/regles/*.webp: 112 rule pictures on C+, 1200 x 900"
  - "01-UI-SPEC.md addendum « Plateau C+ » with « Écran compact (téléphone en portrait) »"
affects: ["01-30", "01-31", "01-32", "01-33", "01-34", "01-35", "01-36"]
tech-stack:
  added: []
  patterns:
    - "Board drawn as declarative shape data (role, cell, colour, paint) rendered by a serializer (tools) or Svelte markup (game, from 01-30)"
    - "Geometry computed in mock-up units with its numbers verbatim, exported in scene units = mock-up x 2"
    - "Seating by colour assignment (bottomOf(k)), the drawing never turns"
key-files:
  created:
    - packages/board/src/scene.ts
    - packages/board/src/art.ts
    - packages/board/src/scene.test.ts
    - packages/board/src/art.test.ts
  modified:
    - packages/board/src/index.ts
    - tools/render-scenarios.mjs
    - docs/regles/ (112 webp regenerated)
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-CONTEXT.md
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md
decisions:
  - "Shapes carry an optional `detail: true` flag for secondary strokes of one object (losange ink outline, felt inner line, stable inner shadow line); object counts ignore details"
  - "Rule-picture labels « avant » / « après » / « le coup » sit at the top of the felt, where no pawn stands, instead of the top-left corner that now holds a ring cell"
  - "Rule pictures are composed on a white background (the C+ board has rounded, transparent corners)"
  - "Stable inner shadow approximated by an inner line of the same colour and opacity (allowed by the plan)"
metrics:
  duration: "13 min"
  completed: 2026-10-14
  tasks: 3
  files: 9
estimate:
  tokens: 90000
  tasks: 3
actuals:
  tokens: 14600
  tasks: 3
  commits: 4
plan_head_before: 44cd96fa0ea279dd7dbcecea225fecdf80c753df
plan_head_after: 79f8e91b10f5f1161bb0b622b3a91210efcc7a8d
---

# Phase 1 Plan 29: La géométrie du plateau C+ et les images des règles Summary

Board C+ (mock-up « C+ · Portrait avec les idées du 01 ») ported verbatim from `renderVals()` into pure, tested geometry and a declarative shape list in packages/board (scene 2000 x 3000, step 126.156), the 112 RULES.md pictures redrawn on it at 1200 x 900, and the UI contract « Plateau C+ » plus the decision log written with Romain's choices kept apart from what he still has to confirm.

## What was built

- **scene.ts** (pure, erasable TS). It computes the ring exactly as the mock-up does: s starts at 50 and is iterated 6 times, giving s = 63.0778 and xL = yT = 43.754 in mock-up units. Everything is then exported x 2. `sceneXY(place, k)` places all 72 ring cells (starting from the bottom seat's index `(EXIT[b] + 71) % 72`), the 16 home slots (`frame(q, -1, (slot + 1) x 1.04)`) and the 16 stable holes (slot 0 is nearest the exit). It throws on an impossible place. `bottomOf(k)` is the inverse of `quarterTurnsFor`. The module also has `sceneSideOf`, `stableCentre`, `seatCard` (angle 0/90/180/270), `ringPolyline`, `KNIGHT` (feet 30.8, body 64.2, head 159.2, lift 12) with `knightScale` (1.0551 / 0.9175 / 0.8257), and `SCENE.headRoom` = 0.04656.
- **art.ts**. `boardArt(k)` returns the whole C+ portrait in the mock-up's painting order: board, walnut rim, band, dashed band edge, felt (border and inner line), 4 dashed links from stable to exit, 4 rails from the carré to the last home slot, 4 arrows, 4 stables with their 16 holes, 16 tinted lanes, then the 72 cells with their labels: losange « 18 » in the exit's colour, carré « 16 » in the colour of the exit two cells further, and discs numbered 1 to 17. There are no rule-reminder frames. `artSvg()` builds markup from typed fields only. Numbers must be finite and are rounded, and text and attribute values are escaped (T-01-41).
- **render-scenarios.mjs**. Each half is `artSvg(boardArt(k))` rasterised at 600 x 900, with k = `quarterTurnsFor(before.turn)`. Pawn discs (radius 17.4 px) sit at `sceneXY` x 0.3. The tool imports only from `packages/board/src/index.ts`. It no longer imports `build-board.mjs` or `layout.ts` directly, and it still writes only under docs/regles (T-01-40).
- **index.ts** also exports scene.ts and art.ts. No name clashes, typecheck clean.
- **01-CONTEXT.md**. D-05, D-07 and D-08 each have a « Révisé par Romain le 2026-10-14 (recette, test 4 ; plateau C+) » note. D-07 also has the « Compacter l'écran » note. Each of the three has a separate « Conséquence de mise en œuvre (…), à confirmer par Romain » note pointing to the re-test in 01-36.
- **01-UI-SPEC.md** now ends with « Addendum 2026-10-14 — Plateau C+ ». It is in French with U+202F and typographic apostrophes, and has these parts:
  - « Décidé par Romain »;
  - « Dérivé de la maquette ou du planificateur, à confirmer par Romain »;
  - the technical facts: scene numbers, palette, what is superseded, the responsive formulas, head room and the typography exception for the cell numerals;
  - the section « Écran compact (téléphone en portrait) », with the shared heights `--info`, `--prompt-row`, `--hand-row` and `--buttons-row`, the rule for the fan's box, the 7 assistant and the size-target table;
  - a UI Considerations table.

## Task commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Tracer: C+ geometry and first drawing, 112 pictures | 3c5ed96 | scene.ts, art.ts, render-scenarios.mjs, docs/regles |
| 2 (RED) | Geometry invariants and art content tests | 695ba84 | scene.test.ts, art.test.ts |
| 2 (GREEN) | Full C+ drawing, index exports | b8861a8 | art.ts, index.ts, render-scenarios.mjs, docs/regles |
| 3 | UI contract « Plateau C+ » and decision log | 79f8e91 | 01-CONTEXT.md, 01-UI-SPEC.md |

## TDD Gate Compliance

- RED: 695ba84 adds the scene and art tests. The 5 art tests failed against the Task 1 tracer content (72 plain discs and no other roles). The scene tests already passed, because scene.ts was written in full in the tracer task.
- GREEN: b8861a8 completes `boardArt`. All 59 tests in packages/board pass.
- REFACTOR: none needed.

## Verification

- `pnpm exec vitest run packages/board`: 59 passed (22 new).
- `pnpm typecheck`: 0 errors (svelte-check 277 files, 0 errors).
- `pnpm lint`: Biome clean (146 files).
- `pnpm test`: 38 files, 749 passed and 2 skipped. The earlier baseline was 727 passed and 2 skipped, and the 22 new board tests make up the difference.
- `node tools/render-scenarios.mjs`: « render-scenarios: 112 images dans docs/regles/ ». Every one of the 112 webp files is 1200 x 900.
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 112 scénarios) ».
- Task 3 greps: all pass. 01-CONTEXT.md has 3 « plateau C+ » notes and 3 « à confirmer par Romain » notes.
- Prohibitions respected:
  - no change to the engine, scenarios, RULES.md, assets/plateau or apps/web;
  - no new package;
  - no rule-reminder frame.

### Pictures checked by eye

- **R-07.1** (bleu at the bottom): blue stable at the bottom left with a dashed link to the losange 18 at centre − s. The carré 16 is at centre + s with the blue rail and lane going up. Yellow is on the left, red at the top, green on the right. The numbers 1 to 17 run in the direction of travel and the arrows sit at the four corners.
- **R-09.1** (Valet): blue A and yellow A swap places between the left column and the top row.
- **R-13.4** (home entry): blue A goes from the bottom row into home slot 3, the deepest one.
- **R-12.2** (rouge to play): red is at the bottom, green on the left (the next seat clockwise), blue at the top and yellow on the right. The protected green pawn sits on its losange.

All of them look like the C+ planche. Romain's recognition of the board stays a backstop (truth with `verification: backstop`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Picture labels hid a ring cell**
- **Found during:** Task 2, when checking R-07.1 by eye.
- **Issue:** The « avant » / « après » / « le coup » pill was still drawn at (8, 8). On C+ that corner holds the top-left ring cell, so the pill covered a cell and any pawn standing on it.
- **Fix:** The pill is now centred at the top of the felt, where no pawn ever stands.
- **Files modified:** tools/render-scenarios.mjs
- **Commit:** b8861a8

**2. [Choice within the plan's latitude] Secondary strokes flagged `detail: true`**
- Some objects need two SVG shapes to reproduce the mock-up's CSS: the losange's cream border plus its ink outline, the felt's border plus its inner line, and the stable's border plus its inner shadow line. The extra shape carries `detail: true`. The plan's counts (1 felt, 4 stables, 72 cells and so on) count objects without details. The role list is exactly the plan's.

**3. [Choice] White background for the pictures**
- The C+ board has rounded corners and is transparent outside them, so the pictures are composed on white instead of the former black.

**4. [Addition] Extra scene exports**
- `SCENE.centre`, `SCENE.ring` (left, right, top, bottom, radius), `KNIGHT.lift` and `sceneSideOf(color, k)` were added beside the plan's exports. The tests and the head-room computation use them, and later plans can read them. None of these names clash with existing exports.

Nothing was changed on STATE.md, ROADMAP.md or the requirement checkboxes, as the orchestrator instructed.

## Known Stubs

None. The app keeps the raster board until 01-30, as planned. The C+ modules are complete data, not stubs.

## Threat Flags

None. The only new markup producer is `artSvg`. It builds markup from typed fields, escapes text and attribute values, and only the local tool uses it (covered by T-01-41).

## Self-Check: PASSED

- FOUND: packages/board/src/scene.ts, art.ts, scene.test.ts, art.test.ts; docs/regles has 112 webp files.
- FOUND commits: 3c5ed96, 695ba84, b8861a8, 79f8e91 (all ancestors of HEAD).
