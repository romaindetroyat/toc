---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 46
subsystem: board-motion
status: complete
tags: [motion, deal, cards, gap-closure, uat-28, recette-3, fx-03]
requires:
  - "01-45 (the Recette 3 addendum of 01-UI-SPEC.md, extended here)"
provides:
  - "packages/board/src/motion.ts: MOTION.dealCard 300 and MOTION.dealStagger 55 (were 250 and 40), with Romain's words of recette 3 in a comment"
  - "01-UI-SPEC.md: Motion Contract row « Deal » at 55ms / 300ms, addendum « Recette 3 » subsection « La donne un peu moins rapide »"
affects: ["01-54 (UAT re-test entry: Romain confirms the deal pace or gives another one)"]
tech-stack:
  added: []
  patterns:
    - "One source of truth for the deal pace: MOTION, read by cardFx dealFlights, HandFan flips and cardsDuration/eventDuration"
key-files:
  created: []
  modified:
    - packages/board/src/motion.ts
    - packages/board/src/motion.test.ts
    - apps/web/src/board/cardFx.test.ts
    - apps/web/e2e/animations.spec.ts
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md
decisions:
  - "The planner's reading is applied as written, still « à confirmer par Romain »: 300 ms per card and 55 ms apart, a first deal of 20 cards in 1345 ms (538 ms in « Avance rapide », 150 ms fade when motion is reduced)"
  - "The deal capture keeps its armed freeze (armShot/shootArmed) and its freeze time LEAD + 300; only the comments and the asserted numbers change"
metrics:
  duration: "15 min"
  completed: 2026-10-15
  tasks: 2
  files: 5
estimate:
  tokens: 30000
  tasks: 2
actuals:
  tokens: 3300
  tasks: 2
  commits: 2
plan_head_before: 5c713033c8333af87bcd173cccb660280578b83a
plan_head_after: 7a3b11416bcc8f258b0e39295777fe2e4486dbdf
---

# Phase 1 Plan 46: La donne un peu moins rapide Summary

**The deal now flies each card for 300 ms with 55 ms between two cards (it was 250 ms and 40 ms), so the 20 cards of a first deal land in about 1.35 s instead of 1.01 s. The player's own cards turn face up at the same pace. « Avance rapide » keeps its × 0.4 (120 ms and 22 ms), and « Réduire les animations » keeps its single 150 ms fade. Romain had said: « La distribution de cartes est un tout petit peu trop rapide ».**

## What was built

### Task 1 (tracer), 8866d89: the two constants, from the unit tests to the deal in the browser

- motion.ts: `dealCard: 300`, `dealStagger: 55`, with a comment that gives the date, Romain's words and the old values. No other timing changes.
- motion.test.ts:
  - the MOTION table check expects `[300, 55]`;
  - the deal lasts `300 + 19 × 55` = 1345 ms for 20 cards and `300 + 15 × 55` for 16;
  - « Avance rapide » gives 538 ms;
  - the `dealt` events take the new durations;
  - reduced motion is still 150 ms.
- cardFx.test.ts: `dealFlights` gives card n a delay of n × 55 ms and 300 ms of flight. In fast mode it gives 120 ms and 22 ms.
- animations.spec.ts:
  - the normal deal test is now « la donne : 20 cartes de 300 ms à 55 ms d’intervalle … ». It checks `near(duration, 300, 1)`, each delay i × 55 read from the card's own delay, and flips of 300 ms at i × 55;
  - the fast test is now « la donne : 20 cartes de 120 ms espacées de 22 ms, la main se retourne en 120 ms ». It checks 120 and i × 22 with the same tolerances as before (2 ms and 6 ms);
  - the armed freeze of commit 550cec2 is unchanged;
  - no tolerance was widened.
- RED: before the constants changed, 6 unit cases failed in motion.test.ts and cardFx.test.ts. GREEN: `vitest run packages/board apps/web/src/board apps/web/src/game` gives 352 passed, and typecheck and lint are clean. animations.spec.ts gives **52 passed** on both projects, including the reduced-motion cases and the hidden-tab regression.
- Tracer gate: the `<verify>` chain passed end to end, so the plan went on.

### Task 2, 7a3b114: the motion contract and the recette 3 addendum

- 01-UI-SPEC.md, Motion Contract: the « Deal » row now reads « stagger 55ms, 300ms each (révisé le 2026-10-15, recette 3 : 40 ms et 250 ms avant) ». The own-card flips are noted at the same pace, and the Fast mode sentence (× 0.4) is unchanged.
- New subsection « La donne un peu moins rapide » in the addendum « Recette 3 de Romain »:
  - Romain's words (test 28);
  - the reading « à confirmer par Romain »: 300 ms and 55 ms, ≈ 1,35 s for 20 cards and ≈ 1,13 s for 16, fast mode at 120 ms and 22 ms (≈ 0,54 s), reduced motion still 150 ms;
  - the technical facts: MOTION is the single source, read by `dealFlights`, `HandFan.svelte` and `cardsDuration` (through `eventDuration`). The Director waits for the cards to land, so the deal sound, the banner and the bots' pacing follow without any hard-coded number.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green. Vitest gives **787 passed, 2 skipped** (37 files), the same as the baseline: this plan changes the expected values and adds two assertions inside existing cases, but no new case.
- `node tools/rules-trace.mjs`: « rules-trace: OK (16 règles, 118 scénarios) ».
- frameClock invariant: no `.animate(` in apps/web/src/board outside frameClock.ts (0 matches).
- Playwright, full suite: **338 passed, 84 skipped, 0 failed** (422 tests, 5.9 min). There were no flaky or retried tests.
- Deal stability:
  - normal deal test with `--repeat-each=10 --workers=6`: **20 passed** (10 per project);
  - fast deal test, same flags: **20 passed**.
- Acceptance: `grep -q "dealCard: 300"` and `grep -q "dealStagger: 55"` on motion.ts both exit 0. The UI-SPEC greps find « stagger 55ms, 300ms each » and « La donne un peu moins rapide ».

## Deviations from Plan

None: the plan was executed exactly as written. The deal capture needed no fix for the longer deal. Its freeze time `LEAD + 300` was kept, because the screenshot is only a saved image and is never compared. Besides the plan, motion.test.ts gained two literal assertions (1345 and 538) taken from the plan's `<behavior>`.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: packages/board/src/motion.ts (dealCard: 300, dealStagger: 55)
- FOUND: .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md (« La donne un peu moins rapide »)
- FOUND: 8866d89, 7a3b114 (ancestors of HEAD)
