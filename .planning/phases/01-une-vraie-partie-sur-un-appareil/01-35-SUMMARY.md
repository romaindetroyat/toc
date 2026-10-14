---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 35
subsystem: board
status: complete
tags: [board, plateau-galet, felt, cards, flights, gap-closure]
requires:
  - "01-34 (the landscape galet is the only board; SCENE, seatCard and every geometry default are landscape)"
provides:
  - "cardFx.ts on the galet felt: talonAt = SCENE.talon, posedSlots fanned along the seat's side inside the ellipse, lay flights facing their seat, the exchange from place to place bowing to its own left"
  - "FeltTable: talon and défausse beside the felt's centre at SCENE.pile, dead hands facing their seat, « D » at the screen top-right of the dealer's card box"
  - "FaceUpCard `scale` prop; CardFlights backs at SCENE.card"
  - "Overlay: the amber turn ring around seatCard(turn seat, k), turned like the card, `data-turn-ring`"
  - "DebugGeometry: the felt's ellipse (`data-debug-felt`) and its box (`data-debug-felt-box`), piles at SCENE.pile"
  - "tracer.spec (R-07.1): piles inside the felt on either side of its centre, ring on the human's place, the Dame inside the ring's box; board.spec: debug ellipse and piles"
affects: ["01-36", "01-40", "01-41"]
tech-stack:
  added: []
  patterns:
    - "A fan's step is found by bisection against the felt's ellipse for every tilt tiltOf can give, floored to whole scene units"
key-files:
  created: []
  modified:
    - apps/web/src/board/cardFx.ts
    - apps/web/src/board/cardFx.test.ts
    - apps/web/src/board/FeltTable.svelte
    - apps/web/src/board/FaceUpCard.svelte
    - apps/web/src/board/CardFlights.svelte
    - apps/web/src/board/Overlay.svelte
    - apps/web/src/board/DebugGeometry.svelte
    - apps/web/e2e/tracer.spec.ts
    - apps/web/e2e/board.spec.ts
decisions:
  - "A dead hand's fan keeps half a card between cards where the ellipse allows it and tightens otherwise: five cards are 45 units apart at the bottom and the top, 30 at the sides (any tilt from -4 to +4 degrees stays inside)"
  - "An exchanged card keeps its seat's angle all the way (its partner's place is the same box, a back reads the same either way up) and bows to the left of its way"
metrics:
  duration: "20 min"
  completed: 2026-10-14
  tasks: 2
  files: 9
estimate:
  tokens: 70000
  tasks: 2
actuals:
  tokens: 10900
  tasks: 2
  commits: 3
plan_head_before: c94d8287223e5f621eaae301147903db69b3aae6
plan_head_after: 5085178fdb8a0ba1079213844e1db08b711d633e
---

# Phase 1 Plan 35: Le tapis et ses cartes sur le galet en largeur Summary

Every card and marker on the felt now sits on the landscape galet's green ellipse, and every card motion starts and lands there:
- each seat's last card lies in front of its seat and faces it;
- the talon and the défausse lie on either side of the centre;
- dead hands are fanned along their seat's side, inside the ellipse;
- the « D » sits at the top-right corner of the dealer's card place;
- the amber turn ring surrounds the active seat's card place.

Nothing under apps/web/src uses the former 2560-unit felt constants or the quarter-turn point rotation any more.

## What was built

- **Task 1 (tracer), 5019f2d.**
  - **cardFx:** `talonAt(k)` is `SCENE.talon`. The header describes the galet felt (cards facing their seats, « à confirmer par Romain », item 4 of the addendum).
  - **FaceUpCard:** new `scale` prop. The corners, the pip, the offsets and the corner radius scale with it.
  - **FeltTable:** the talon (three levels or a dashed outline) and the défausse (FaceUpCard or a dashed outline) are at `SCENE.talon` (1450, 800) and `SCENE.defausse` (1750, 800), sized `SCENE.card` x `SCENE.pile` (0.95). The talon's CardBack now gets that size; before, it fell back to CardBack's 160 x 224 default.
  - **Overlay:** the turn ring is a rounded rect of `SCENE.card` plus 10 units on each side, centred on `seatCard(turn, k).at` and turned by its angle. It is amber, 4 screen px, and carries `data-turn-ring={seat}`. The local slot table and `rotatePoint` are gone.
  - **cardFx.test:** slots are checked inside the ellipse (it was the bounding box). New test: the talon is `SCENE.talon` for every k, left of the centre, with the défausse right of it. The deal starts at the talon for every k.
  - **tracer.spec, R-07.1, before « Jouer »:**
    - `[data-talon]` and `[data-discard]` lie inside `[data-felt-button]`, the talon left of its centre and the défausse right of it;
    - the centre of `[data-turn-ring="bleu"]` is within 2 px of the felt's vertical axis, in its lower half;
    - after « Jouer », the centre of the Dame is inside the ring's box recorded before.
- **Task 2 (TDD).**
  - **RED, fe3af53.** New tests:
    - every dealt card starts at the talon and ends at its seat's edge, for every k and for normal and fast;
    - no deal or exchange flight carries a face, in any mode;
    - the exchange goes from each place to the partner's, and leaves turned like its seat's card;
    - both cards of a pair bow to their own left, at 110 units;
    - dead-hand fans for every k, every seat and 1 to 5 cards: same y (bottom/top) or same x (sides), centred on the place, at most half a card apart, and every corner inside the ellipse for every tilt from -4 to +4;
    - the side fans are tighter than the bottom and top ones;
    - lay flights land on their posed place with the seat's angle plus the card's tilt, in every mode.
  - **GREEN, 5085178.**
    - **cardFx:** `posedSlots` fans along the seat's side. Its step is half a card when that fits; otherwise it is the largest step that fits, found by bisection and floored to whole units. For five cards that gives 45 units at the bottom and the top and 30 at the sides.
      - `layFlights` leaves the edge already facing the seat and lands with angle plus tilt.
      - `exchangeFlights` keeps the seat's angle and bows to the left of its way.
      - The deal leaves the talon at the pile's scale (0.95).
      - Timings, easings and fast-mode scaling are unchanged. Every motion still starts through `animateNow()`.
    - **FeltTable:** dead hands are drawn with their seat's angle. The « D » sits at the top-right corner on screen of the dealer's card box: w x h for the bottom and top seats, h x w for the side seats. Same size and text as before.
    - **CardFlights:** CardBack at `SCENE.card`.
    - **DebugGeometry:** the felt is drawn as its ellipse (`data-debug-felt`), with a dashed bounding box (`data-debug-felt-box`). The seat cards are turned, and the piles are at `SCENE.card` x `SCENE.pile`.
    - **board.spec:** the debug ellipse fills the felt button's box (± 2 px), and both pile boxes lie inside it on either side of its centre.

## Fan steps measured (k = 0)

| Seat side | 2 cards | 3 cards | 4 cards | 5 cards |
|---|---|---|---|---|
| bottom / top (row) | 69.6 | 69.6 | 60 | 45 |
| left / right (column) | 69.6 | 61 | 41 | 30 |

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green. 38 files, **777 passed, 2 skipped** (770 + 7 new cardFx tests).
- `pnpm exec vitest run apps/web/src/board`: green. `frameClock.test.ts`: 2 passed.
- Greps: there is no `rotatePoint|LAST_CARD_SLOT|FELT_SQUARE|CARD_SIZE|\bTALON\b|\bDEFAUSSE\b` in apps/web/src. `animateNow` is in animator.ts, cardFx.ts and Particles.svelte (3 files). There is no `.animate(` in apps/web/src/board outside frameClock.ts.
- `playwright test e2e/tracer.spec.ts e2e/finition.spec.ts`: 48 passed, 4 skipped.
- `playwright test e2e/animations.spec.ts e2e/board.spec.ts e2e/partie-complete.spec.ts`: 62 passed, 8 skipped. Both named cases pass on phone and desktop:
  - animations.spec.ts:782 « une carte jouée se fond en 150 ms, le cheval glisse en 180 ms avec un seul sabot, sans particules »;
  - animations.spec.ts:807 « une image chargée au départ du cheval ne le retarde pas : il glisse toujours 60 ms après la carte ».
- Full Playwright suite on both projects: **286 passed, 44 skipped, 0 failed** (5.0 min). This matches the 01-34 baseline. The new assertions are inside existing tests.
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 112 scénarios) ». The rule pictures do not draw the felt's cards.
- Visual check (screenshots at 1280 x 800 and 844 x 390, reduced motion, debug build on port 4174, stopped by PID afterwards):
  - the piles are beside the centre and the ring is on the human's place;
  - the « D » is at the top-right of vert's turned place;
  - four dead hands are fanned and facing their seats, all inside the ellipse.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The exchange's bow went to the card's right, against its comment**
- **Found during:** Task 2 (the new « own left » test).
- **Issue:** the bow offset was `(-dy, dx)`. With y growing downwards, that is the right of the way, while the comment (and the plan) say the card bows to its own left. Both cards of a pair still passed on either side of each other, so the old test did not catch it.
- **Fix:** the offset is now `(dy, -dx)`, the left of the way. The test asserts this through a cross product, for every k and card.
- **Commit:** 5085178

**2. [Rule 1 - Bug] The talon's top card and the deal's backs were 160 x 224, not the galet card**
- **Issue:** FeltTable and CardFlights called CardBack without a size, so it fell back to the former 160 x 224 default.
- **Fix:** both now pass the galet's size: the talon at `SCENE.card` x `SCENE.pile`, the flights at `SCENE.card`. CardBack.svelte (outside the plan's list) is unchanged; its default and its doc comment « 160 x 224 on the felt » are now unused by the felt. 01-39/01-40 cleanup can drop them.
- **Commits:** 5019f2d, 5085178

### Choices within the plan's latitude

- An exchanged card keeps its seat's angle all the way (0 or 180 for one pair, 90 or 270 for the other). The partner's place is the same box, and a back reads the same either way up, so no half turn mid-flight was added.
- The deal's first keyframe is drawn at the pile's scale (0.95), so a dealt card does not grow as it leaves the talon. Its middle and end scales (0.9, 0.7) are unchanged.
- FaceUpCard's corner radius now scales with the card: 12 x 139.2/160 ≈ 10.4 units at scale 1, instead of 12.
- `data-debug-felt` is the ellipse. The bounding box gets a new `data-debug-felt-box`.
- `talonAt` keeps its `k` parameter, as `_k`, so the Director's call sites are unchanged.
- The plan asked to remove « the test of the portrait galet's seat places ». 01-34 had already turned it into the landscape places test, which stays, so there was nothing to remove.

## Known Stubs

None.

## For Romain's re-test (01-41, not defects of this plan)

- A dead hand of 4 or 5 cards at the bottom or the top covers part of the talon and the défausse while it lies there. The piles sit 150 units either side of the centre, and the fan, kept inside the ellipse, runs over them. This is a consequence of item 4's geometry.
- The side seats' fans are tight: 30 units, about 17 px at 1280 x 800, for five cards. Each card's rank is still visible at the edge, but « Sur le tapis » is the place to read them in large form.
- The « D » keeps its 12-screen-px radius. For the bottom seat it touches the défausse's left edge. When vert both deals and plays, the turn ring's stroke crosses it.

## Threat Flags

None. T-01-57 is mitigated: the felt still reads only `render.lastPlayed`, `render.posed`, `render.talonSize`, `render.discardSize` and the défausse's top card, and cardFx.test asserts that no deal or exchange flight carries a face, in any mode. No package was added (T-01-SC).

## Commits

The measured range `c94d828..5085178` holds 3 commits: 5019f2d (Task 1), fe3af53 (Task 2 RED) and 5085178 (Task 2 GREEN). This SUMMARY is committed separately.

## Self-Check: PASSED

- FOUND: apps/web/src/board/cardFx.ts (contains "seatCard", "SCENE.talon"), apps/web/src/board/FeltTable.svelte (contains "SCENE", "posedSlots"), apps/web/src/board/cardFx.test.ts (contains "feltShape"), apps/web/src/board/Overlay.svelte (contains "seatCard")
- FOUND: 5019f2d, fe3af53, 5085178 (ancestors of HEAD)
