---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 44
subsystem: board
status: complete
tags: [board, galet, riders, gap-closure, uat-25, recette-3, rule-pictures]
requires:
  - "01-43 (the 118 rule pictures, rules-trace 16 règles / 118 scénarios)"
provides:
  - "packages/board/src/scene.ts: riderBox(color, k) also returns angle 0 | 90 | 180 | 270, the ROT of the colour's seat frame (the angle seatCard gives that seat's card)"
  - "packages/board/src/art.ts: the rider image is drawn about its centre, x = -w/2, y = -h/2, transform { translate: centre, rotate: angle } (no rotate key at 0)"
  - "apps/web/src/board/BoardArt.svelte: the rider image carries its transform and data-rider-angle"
  - "docs/regles/*.webp: the 118 pictures redrawn with the turned riders"
  - "01-UI-SPEC.md: « Addendum 2026-10-15 — Recette 3 de Romain » opened with « Les cavaliers du galet tournés vers leur camp »"
affects: ["01-45 to 01-53 (append their subsections to the Recette 3 addendum)", "01-54 (UAT re-test entry: Romain confirms the riders' angle)"]
tech-stack:
  added: []
  patterns:
    - "A turned picture of the drawing is an image at (-w/2, -h/2) with translate(centre) rotate(angle); the geometry keeps the upright box and adds the angle"
key-files:
  created: []
  modified:
    - packages/board/src/scene.ts
    - packages/board/src/scene.test.ts
    - packages/board/src/art.ts
    - packages/board/src/art.test.ts
    - apps/web/src/board/BoardArt.svelte
    - apps/web/e2e/table.spec.ts
    - docs/regles/ (118 webp)
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md
decisions:
  - "The rider's angle is the seat card's ROT, read from the same seat frame (quarterOf), so the riders and the felt cards can never disagree"
  - "riderBox keeps describing the upright 157:209 box (x, y, w, h); only the drawing turns it, so the corner, centre and size stay those of 01-32"
metrics:
  duration: "25 min"
  completed: 2026-10-15
  tasks: 2
  files: 8
estimate:
  tokens: 45000
  tasks: 2
actuals:
  tokens: 3800
  tasks: 2
  commits: 2
plan_head_before: 2fbf60b27e10feecee52c2d5a1be20770c237536
plan_head_after: 61201b25d2aa07a349e211a677d16ca77d213577
---

# Phase 1 Plan 44: Les cavaliers à l'encre du galet, sabots vers leur camp Summary

**Each of Romain's four ink riders now turns by the quarter turn of its colour's side, as the felt cards do: 0° at the bottom (unchanged), 90° on the left, 180° at the top, 270° on the right. The hooves point to the edge of each camp (« Quart de tour (Recommandé) »). The turn comes from riderBox, is applied about the picture's centre in the game and in the 118 rule pictures, and keeps every rider in its corner, clear of the felt and of every place.**

## What was built

### Task 1 (tracer), ea861b8: the side's angle, from the geometry to the game
- scene.ts: `riderBox(color, k)` returns `{ x, y, w, h, angle }`; `angle = ROT[quarterOf(color, k)]`, the same angle `seatCard` gives that seat. The doc comment quotes Romain's words and his choice.
- art.ts: the rider image is `x = -w/2, y = -h/2, w, h` with `transform { translate: [centre], rotate: angle }`; the bottom rider has no `rotate` key. Painting order and opacity 0.85 unchanged.
- BoardArt.svelte: the image passes `transform={transformOf(shape.transform)}` and `data-rider-angle`. Still `aria-hidden`, `pointer-events="none"`; the PNGs are untouched.
- Tests:
  - scene.test.ts: the rider test uses the turned footprint (w and h swapped at 90°/270°, same centre). For every k it stays off the felt and the 104 places, and all four of its corners lie in the rider's quadrant. New test: each rider's angle equals its seat card's angle and its side's angle (bottom 0, left 90, top 180, right 270), for every k.
  - art.test.ts: the image's centre and size equal riderBox's, its rotate equals the angle (absent at 0), no scale. New test: `artSvg` writes `translate(…)` alone for bleu and `rotate(90)`, `rotate(180)`, `rotate(270)` for jaune, rouge and vert (k = 0).
  - table.spec.ts « table: les cavaliers du galet tournés vers leur camp, sabots vers chaque bord »: with bleu and then vert at the bottom, the bottom colour has angle 0 (no rotate in its transform), the next colour on the left 90, the partner at the top 180, the one on the right 270.
- Clearance measured for k = 0 to 3 (cells as discs of 0.5 step): at least **1.29 steps** between each turned rider and every ring, home or stable place, as the planner had computed. The left and right riders become 278 × 209 units: the top one spans y 352 to 561, the bottom one y 1039 to 1248, so both stay off the felt (which starts at y 576).
- Tracer gate: `vitest run packages/board` 56 passed; typecheck and lint clean; `table.spec.ts` + `board.spec.ts` 36 passed, 10 skipped. The gate passed, so the plan went on.

### Task 2, 61201b2: rule pictures and the Recette 3 addendum
- `node tools/render-scenarios.mjs`: « 118 images dans docs/regles/ »; all 118 changed (every picture shows the riders).
- **Determinism:** I copied docs/regles to the scratchpad, rendered again and ran `cmp` on all 118 pairs: **0 differences**.
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 118 scénarios) ».
- **The look of R-01.1 and R-13.22:** in both halves of each picture the blue rider stands upright below. The yellow one lies on its side with its hooves to the left edge. The red one is upside down with its hooves to the top. The green one lies on its side with its hooves to the right. At 1200 px they read as clearly as the upright one did. They stay quiet decoration behind the pawns and the green halo of R-13.22, and they do not collide with the stables, homes or felt.
- 01-UI-SPEC.md:
  - new final section « ## Addendum 2026-10-15 — Recette 3 de Romain »: the source (01-UAT.md tests 23 to 30, 01-CONTEXT.md « Recette 3 ») and the rule of one subsection per change, continued by 01-45 to 01-53;
  - its first subsection, « Les cavaliers du galet tournés vers leur camp »: his words, his choice « Quart de tour (Recommandé) », what is « À confirmer par Romain », and the technical facts (angle from riderBox, turn about the centre, corner and size unchanged, clearance measured, pictures re-rendered and deterministic);
  - the riders bullet of « Plateau galet » / « Faits techniques » gains « (tournés vers leur camp depuis le 2026-10-15, addendum « Recette 3 ») ».

### Screenshots (game, debug build via `vite preview`)
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/01-44-board-1280x800.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/01-44-board-844x390.png
- Close-ups of each rider at 2×: zoom-bleu.png, zoom-jaune.png, zoom-rouge.png, zoom-vert.png in the same folder.
- What they show, with bleu at the bottom: bleu upright with its hooves down, jaune with its hooves to the left edge, rouge upside down with its hooves up, vert with its hooves to the right edge. The DOM reads `bleu:0 jaune:90 rouge:180 vert:270` at both sizes.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green. Vitest gave **771 passed, 2 skipped** (37 files): the baseline 769 plus the 2 new board tests.
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 118 scénarios) »; `ls docs/regles/*.webp | wc -l` = 118.
- frameClock invariant: no `.animate(` in apps/web/src/board outside frameClock.ts.
- Playwright: I ran the full suite, beyond table.spec.ts, because board.spec.ts and tracer.spec.ts also measure the rider images. Result: **335 passed, 83 skipped, 0 failed** (418 tests, 5.8 min). That is the baseline 333 plus the new table test on both projects.
- Acceptance greps: `angle` in scene.ts and `data-rider-angle` in BoardArt.svelte, both present; the addendum heading is present once.
- Prohibitions held: `apps/web/src/assets/plateau/cav-*.png` are unchanged, and no rider is a tap target (`pointer-events="none"`, board.spec.ts still passes).

## Deviations from Plan

None. The plan was executed as written. The plan had said that « e2e/table.spec.ts checks the table drawing (riders present via [data-rider]) », but that check actually lives in board.spec.ts. The new angle test went into table.spec.ts as the plan asked.

## Threat model
- T-01-70 is mitigated: two renders compared byte for byte (0 differences), and rules-trace --images is OK.
- T-01-SC: no package was added.

## Notes for Romain (re-test 01-54)
- The top rider is now seen upside down from your place, and the side riders lie on their sides. This is the quarter turn you chose, the same as the felt cards. If the upside-down one bothers you, another angle can be set per side in `riderBox`.

## Self-Check: PASSED

- Files exist: scene.ts (riderBox with angle), BoardArt.svelte (data-rider-angle), the 118 pictures, 01-UI-SPEC.md with the addendum.
- Commits ea861b8 and 61201b2 are ancestors of HEAD; `git rev-list --count 2fbf60b..HEAD` = 2 before this SUMMARY commit.
