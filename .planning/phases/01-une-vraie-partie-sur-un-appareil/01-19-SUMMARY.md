---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 19
subsystem: knight-motion
tags: [waapi, motion-table, audio-cues, director, particles, reduced-motion, playwright, fx-03, fx-04, fx-05, fx-06]
status: complete

requires:
  - phase: 01-18
    provides: "Valet preview with swap { a, b, aTo, bTo } read from pawnsSwapped"
  - phase: 01-16
    provides: "Game screen with the Director wired to the Pawn groups (only ring moves were animated)"
  - phase: 01-15
    provides: "Director contract: animate, fold, commit; finish(pawn); getMode; reset"
  - phase: 01-08
    provides: "Pawn groups mover / arc / facing via partsOf; hopTimeline as the timing source"
  - phase: 01-04
    provides: "audio cue API and the voice pool"
provides:
  - "packages/board motion.ts: MOTION and REDUCED tables, scaleFor, eventDuration, eventsDuration, captureBeat, rearDuration, ejectDuration, partyDuration, volteFaceDuration"
  - "game/cues.ts: cuesFor(event, { mode, timeline, isFinalCapture, arrivalMs }) giving every sound with its offset"
  - "animator.ts: exitBound, hop (squash, ground shadow, settle), volteFace, rear, eject, swapArcs, homeSettle, party, winHop, finish, clear, with reduced variants"
  - "Pawn inner groups data-role shadow, squash, rear; Particles.svelte (8 crème and amber stars and circles)"
  - "Director: one t0 per step; exit, volte-face, hops, rear, eject, swap, settle or party, win hop; captures taken from the queue after their movement"
  - "window.__tocDebug.audio.cues (debug builds): every neigh and card sound asked for, with audio-clock time"
affects: [01-20, 01-21, 01-22, 01-23, 02-bots-pacing]

actuals:
  tokens: 23000
  tasks: 2
  commits: 3
plan_head_before: df88c3cb645486efb2c92bbda550d0d9f30a2764
plan_head_after: 7e39da13092eda78345f05db9353a0aa7a8f47bd

tech-stack:
  added: []
  patterns:
    - "One t0 per step: the Director starts every animation of a step at once, each with its own delay (leap, rear after arrival, ejection after the rear), and schedules the sounds on the audio clock from the same offsets, so nothing can drift"
    - "A capture is not an event of its own on screen: the Director takes the pawnCaptured / pawnSentHome pairs that follow a movement from the queue and plays them as part of the move"
    - "The settle of the last landing is a squash tail that runs on into the next event; clear() only drops the animations that hold an offset (mover, arc, facing)"
    - "The shadow stays on the ground (sibling of the arc group) and shrinks and fades while the knight is up; squash and rear pivot at the feet, rear inside the facing mirror so a left-facing knight rears backwards too"
    - "Director animator methods other than hop are optional: an animator without them skips the motion and the event is still applied"

key-files:
  created:
    - packages/board/src/motion.ts
    - packages/board/src/motion.test.ts
    - apps/web/src/game/cues.ts
    - apps/web/src/game/cues.test.ts
    - apps/web/src/game/director.motion.test.ts
    - apps/web/src/board/Particles.svelte
    - apps/web/e2e/animations.spec.ts
  modified:
    - packages/board/src/index.ts
    - apps/web/src/game/director.ts
    - apps/web/src/board/animator.ts
    - apps/web/src/board/Pawn.svelte
    - apps/web/src/board/Board.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/audio/engine.ts
    - apps/web/src/debug.ts

key-decisions:
  - "Pause between the rear and the ejection is nil: rear is two back-to-back animations (220 up, 280 down) and the victim leaves the instant the second ends; the whinny is cued at that moment, the snort at arrival"
  - "eventDuration counts the bounds only (4 cells 799 ms, backward 4 = 120 + 799); the 80 ms settle of the last landing is a squash tail that overlaps the next event, so bot pacing in phase 2 is not lengthened by it"
  - "A capture contributes to eventDuration as rear + ejection (1350 ms) on the final cell, and only what outlasts the move in the middle of a 7; eventDuration takes the path length of the move the capture belongs to"
  - "With reduced motion every capture is treated as a final-cell one (the move is a single slide), the whinny sounds but the snort does not (no rearing), and the swap and the ejection are fades that jump at their mid-point"
  - "The exit lands with a hoof clop (scheduled by the Director at the landing of the bound), cuesFor(pawnExited) stays exactly the neigh at take-off"
  - "The fourth knight's burst starts with the rear and outlasts it: the party takes 700 ms (partyDuration), the particles are mounted by Board above the knights and driven by their own WAAPI animations"
  - "Valet arcs bow sideways on opposite sides (the perpendicular flips with the direction of travel), so the two paths cross without overlapping"

patterns-established:
  - "The reduced-motion and fast-mode e2e checks read durations from document.getAnimations() through a requestAnimationFrame recorder installed before the page loads; they never depend on timing between assertions"
  - "Mid-animation screenshots freeze every knight animation at one step time (currentTime on all of them), shoot, and resume"

requirements-completed: [FX-03, FX-04, FX-05, FX-06]

coverage:
  - id: D1
    description: "Motion table and sound cues are pure single sources: durations of exit, move, backward 4, capture, swap, home in normal, fast and reduced modes; neighs at exit, capture (snort at arrival, whinny at the ejection or at the passing of a 7), swap and home entry; clops follow hopTimeline"
    requirement: FX-04
    verification:
      - kind: unit
        ref: "packages/board/src/motion.test.ts"
        status: pass
      - kind: unit
        ref: "apps/web/src/game/cues.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Director plays every knight event with one t0: exit bound, volte-face before a backward 4, hops, rear then ejection on the final cell, ejection at captureBeat during a 7, crossing swap, settle or party, win hop; fast scales everything, reduced drops the rear and the particles"
    requirement: FX-03
    verification:
      - kind: unit
        ref: "apps/web/src/game/director.motion.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/animations.spec.ts (sortie, 4 à reculons, prise sur la dernière case, le 7, Valet, maison, quatrième cheval)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Each action is voiced: sortie, ruade then plainte, plainte of the 7, surpris, joyeux, fête are cued at the time of their animation (checked through window.__tocDebug.audio.cues)"
    requirement: FX-05
    verification:
      - kind: e2e
        ref: "apps/web/e2e/animations.spec.ts (cues of each case)"
        status: pass
    human_judgment: true
    rationale: "The cues are asserted by id and time through the debug hook; whether the synthesized neighs sound right together with the pictures is a listening judgment for Romain (plan 01-22/01-23 sound review)."
  - id: D4
    description: "« Avance rapide » multiplies every duration by 0.4 with no clops closer than 50 ms; « Réduire les animations » (or prefers-reduced-motion) gives one 180 ms slide, 150 ms fades, a 150 ms crossfade for the Valet, no rear, no particles, one clop per move, sounds kept"
    requirement: FX-06
    verification:
      - kind: e2e
        ref: "apps/web/e2e/animations.spec.ts#Avance rapide and #Réduire les animations"
        status: pass
    human_judgment: false
  - id: D5
    description: "The look of the motion: the rear reads as a rear, the ejection arc is pleasant, the two Valet arcs cross legibly, the 8 stars read as a celebration on a phone"
    requirement: FX-03
    verification:
      - kind: e2e
        ref: "playwright: test-results/anim-ruade|ejection|sept-prise|echange|fete-{phone,desktop}.png"
        status: pass
    human_judgment: true
    rationale: "Easing, heights and sizes are within the D-11 to D-14 bounds but whether they look right is a visual judgment; the executor reviewed the screenshots (rear, ejection, crossing arcs, party) and the particles were enlarged after the first look."

duration: "50 min"
completed: 2026-10-13
---

# Phase 1 Plan 19: Les cavaliers s’animent et hennissent Summary

**Every knight action is now animated and voiced from one timing source: the stable exit bound, hops with squash and a ground shadow, the volte-face of the backward 4, the rear and the arc ejection of an eaten knight (mid-move with the 7), the crossing arcs of the Valet and the party of the fourth knight, with fast mode at ×0.4 and a calm slide-and-fade variant under reduced motion.**

## Accomplishments

- **Pure timing sources (Task 1, TDD):** `packages/board/src/motion.ts` holds the Motion Contract (`MOTION`, `REDUCED`, `scaleFor`, `eventDuration`, `eventsDuration`, `captureBeat`) and `apps/web/src/game/cues.ts` gives every sound cue with its offset. Test commit first (RED, modules missing), then the implementation (GREEN).
- **Animator:** WAAPI on the inner groups only. The shadow now stays on the ground and shrinks while the knight leaps; the body squashes 8 % on each landing and settles 80 ms after the last; the rear pivots at the feet inside the facing mirror.
- **Director:** one t0 per step. The hops, the rear (after arrival) and the ejections (after the rear, or at `captureBeat` during a 7) are started together with their own delays, the neighs scheduled on the audio clock from the same offsets. Captures are taken from the queue right after their movement, so the render state still folds event by event.
- **Fourth knight:** 500 ms rear plus a 700 ms burst of 8 crème and amber stars and circles (`Particles.svelte`, transform and opacity only), mounted by `Board`.
- **Reduced and fast:** one 180 ms slide, 150 ms fades for the eaten knight (out where it stood, in at the stable), a 150 ms crossfade for the Valet, no rear, no particles, one clop per move; fast scales every duration and keeps clops at least 50 ms apart.
- **Debug hook:** `window.__tocDebug.audio.cues` logs every neigh asked for (debug builds only).

## Task Commits

1. **Task 1 RED:** `a73cda7` test(01-19): failing tests for the motion table and the sound cues of every knight move
2. **Task 1 GREEN:** `7887f55` feat(01-19): one motion table for every knight animation and one function for its sound cues
3. **Task 2:** `7e39da1` feat(01-19): the knights leap, rear, fly back, cross and celebrate, each with its neigh

## Verification

- `pnpm exec vitest run` : 30 files, 533 passed, 2 skipped (pre-existing skips).
- `pnpm typecheck` (tsc and svelte-check, 0 errors) and `pnpm lint` (biome): clean.
- `pnpm --filter @toc/web exec playwright test e2e/animations.spec.ts e2e/tracer.spec.ts`: 38 passed (phone and desktop).
- Whole Playwright suite: 141 passed, 11 skipped (pre-existing), no regression in table, sons, audio, partie, cartes-speciales.
- Acceptance: `grep "export function eventDuration"` and `grep "captureBeat("` exit 0; `svelte-check --tsconfig ./tsconfig.json` exits 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Game.svelte, debug.ts and a new director test file are not in `files_modified`**
- **Found during:** Task 2
- **Issue:** The animator adapter (`env.animator`, the moving-pawn z-order, the burst state) lives in `routes/Game.svelte`, and the debug hook type lives in `debug.ts`; neither is in the plan's list. Director behaviour for the new motions also needed unit tests beyond the e2e spec.
- **Fix:** Game.svelte now builds the adapter for the new animator methods (`begin` raises every knight of a step before its animations start, `moving` replaces the single `movingPawn`, `burst` feeds Board); debug.ts declares `audio.cues`; `director.motion.test.ts` (16 tests) covers the Director's calls and cues.
- **Files modified:** apps/web/src/routes/Game.svelte, apps/web/src/debug.ts, apps/web/src/game/director.motion.test.ts
- **Verification:** typecheck, vitest and the whole e2e suite pass
- **Commit:** 7e39da1

**2. [Rule 1 - Bug] The two Valet knights overlapped at the crossing point**
- **Found during:** Task 2, review of the mid-swap screenshot
- **Issue:** The sideways bow was given opposite signs, but the perpendicular already flips with the direction of travel, so both knights bowed to the same side and coincided at the middle.
- **Fix:** both legs use the same sign, so they pass on either side of each other.
- **Files modified:** apps/web/src/board/animator.ts
- **Commit:** 7e39da1

**3. [Rule 1 - Bug] Particles were a few pixels wide on a phone**
- **Found during:** Task 2, review of the party screenshot
- **Issue:** Sizes were in board units of an unscaled mental model (8 to 14 units on a 2560 board).
- **Fix:** stars and circles enlarged (about 38 and 28 units, 230 reach).
- **Files modified:** apps/web/src/board/Particles.svelte
- **Commit:** 7e39da1

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs). **Impact:** none on scope; all changes are inside the knight-motion slice.

## Issues Encountered

- A first e2e run used a stale `vite preview` left listening on port 4173 (killing the pnpm wrapper does not kill vite), so the first screenshots came from the previous build; killed by PID, rebuilt and re-run, all green.

## Known Stubs

None.

## Next Phase Readiness

- Ready for plans 01-20 (card figures), 01-21 (the 7 panel: its captures already animate mid-move because the Director takes them from the queue) and 01-22 (card animations: `cuesFor` already maps cardPlayed, dealt and cardsExchanged to their sounds, deliberately not scheduled here).
- `eventsDuration(events, mode)` in packages/board is the hook Phase 2 can use to pace bots.
- The human check of the motion (rear, ejection arc, crossing Valet arcs, party) can start from `apps/web/test-results/anim-*.png` after running the animations spec.

## Self-Check: PASSED

- Created files exist: motion.ts, motion.test.ts, cues.ts, cues.test.ts, director.motion.test.ts, Particles.svelte, animations.spec.ts.
- Commits a73cda7, 7887f55 and 7e39da1 are ancestors of HEAD; `git rev-list --count` from the recorded base gives 3.
