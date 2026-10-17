---
phase: 02-jouer-en-ligne-entre-proches
plan: 06b
status: complete
subsystem: web-ui
tags: [compact-mode, hand, iphone, safe-area, svg-typography, playwright]

requires:
  - phase: 02-jouer-en-ligne-entre-proches
    provides: "02-06 (the tree it ran on; no code dependency)"
  - phase: 03-l-ordinateur-la-force-choisie
    provides: "03-10 corner hand (cornerCard, cornerLayout, leftClearance) and 03-11 « 1er » token"
provides:
  - "The compact hand as one straight vertical column: one card size, one left edge, never left of the strip (so never under the iPhone's Dynamic Island)"
  - "cornerLayout returns { card, slots }; cornerCard(height, maxWidth) caps the card's width"
  - "« 1er » token drawn as two positioned texts (no tspan / baseline-shift)"
  - "compact.spec: simulated iPhone 14 / 15 Pro insets test; commence.spec: clean-token check"
affects: [02-10]

tech-stack:
  added: []
  patterns:
    - "Simulating iOS safe-area insets in Chromium specs: override main.game padding plus --inset-x / --inset-y with an injected style"

key-files:
  created:
    - .planning/phases/02-jouer-en-ligne-entre-proches/02-06b-PLAN.md
  modified:
    - apps/web/src/cards/fan.ts
    - apps/web/src/cards/cards.test.ts
    - apps/web/src/ui/HandFan.svelte
    - apps/web/src/ui/Card.svelte
    - apps/web/src/board/FeltTable.svelte
    - apps/web/e2e/commence.spec.ts
    - apps/web/e2e/compact.spec.ts
    - apps/web/e2e/cibles.spec.ts
    - apps/web/e2e/finition.spec.ts
    - .planning/phases/03-l-ordinateur-la-force-choisie/03-UI-SPEC.md

decisions:
  - "Column x = max(0, floor(room - w)), room = strip width + leftClearance over the whole five-card box - 2 px margin - 6 px selection nudge; the same x for 1 to 5 cards"
  - "The 03-10 size cannot be kept on a phone: on every iPhone held sideways the board is width-limited and the strip is 60 px, the galet's bare side is about 5 px at mid-height, so the largest uniform 5:7 card is 56 x 79 (54 x 75 at 480 x 320); a height-limited window with wider strips still gets 80 x 112"
  - "The board size and the 6 px selection nudge were kept rather than shrinking the board or dropping the nudge to win width"
  - "« 1 » (15 px, anchored at its end) and « er » (10 px, anchored at its start, 4.5 px higher) meet at the pill's middle, 1 px apart"

metrics:
  duration: 19min
  completed: 2026-10-17
  tasks: 3

actuals:
  tokens: 15000
  tasks: 3
  commits: 5
plan_head_before: bc9a9817b3b44a662a40a624fab7002ff1530f03
plan_head_after: c28b01d3459ff90f2cb5e5e874cfddd2e66a4ee9
---

# Phase 2 Plan 06b: the phone's hand in one straight column, and a clean « 1er » Summary

The phone's corner hand is now one straight column: every card is the same size and has the same left edge, inside the strip that starts after the safe area, so no card sits under the Dynamic Island. The column sits as far right as the galet's bare side allows over the whole five-card height. The « 1er » token now uses two positioned texts, so the « er » sits up and clear of the « 1 ».

Romain's iPhone screenshot of 2026-10-17: « Sur iphone, la carte du bas est décalée, je ne veux pas ça ».

## What changed

- `cornerLayout(count, strip, clearance, sceneWidth)` now returns `{ card, slots }`. It measures the room over the band of the five-card box, then picks the largest `cornerCard(height, w)` that fits by walking down from the 03-10 card. A smaller card makes a box that is no taller, so its room is never narrower. Every slot then gets the same `x = max(0, floor(room - w))`.
- `HandFan.svelte` takes its card size and slices from the layout. `--cut` and `strip.left` are gone, because no card runs past the strip any more. The key digit sits 4 px from the card's left edge. `Card.svelte` centres the middle pip on the whole card.
- `FeltTable.svelte` draws « 1er » as two `<text>` elements: « 1 » with `text-anchor=end` and « er » with `text-anchor=start`, 1 px apart, with « er » 4.5 px higher. There is no `tspan` and no `baseline-shift`.

## Card size and positions (measured in Chromium)

| Window | Insets (side, bottom) | Board | Card | Slice | Column x on screen | Card tops |
|--------|-----------------------|-------|------|-------|--------------------|-----------|
| 844 x 390 | 0, 0 | 724 | 56 x 79 | 51 | 1 | 107, 158, 209, 260, 311 |
| 750 x 342 | 0, 0 | 630 | 56 x 79 | 51 | 0 | 59, 110, 161, 212, 263 |
| 480 x 320 | 0, 0 | 360 | 54 x 75 | 49 | 0 | 49, 98, 147, 196, 245 |
| 844 x 390 | 59, 21 (simulated) | 606 | 56 x 79 | 51 | 59 | 86, 137, 188, 239, 290 |
| 750 x 342 | 59, 21 (simulated) | 512 | 55 x 77 | 49 | 59 | 48 ... 244 |
| 480 x 320 | 59, 21 (simulated) | 242 | 53 x 74 | 44 | 59 | 49 ... 225 |

In every state the selected card is 6 px right of the column. The received card keeps the partner's border, and its top-right index stays visible.

Before this plan the 03-10 cards were 79 x 110 at 844 x 390 and 67 x 94 at 750 x 342, each card at its own x. A wider card at one shared x would cover the left ring cells at mid-height, because the bare wood there is only about 5 px wide.

## Screenshots (looked at)

These were taken after the deal banner, with « Choisis la carte à passer » as the idle state with 5 cards:

- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06b-844x390-idle.png, -chosen.png, -received.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06b-750x342-idle.png, -chosen.png, -received.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06b-480x320-idle.png, -chosen.png, -received.png
- The same set with `-insets` in the name (59 px sides, 21 px bottom, simulated)
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06b-token-844x390.png and 02-06b-token-480x320.png (the « 1er » token at 4x)

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green, 73 files, 1169 passed, 2 skipped. Both skips were already there; this plan added none.
- Full local Playwright suite (`playwright.config.ts`): 454 passed, 0 failed, 98 skipped. All the skips are projects that a spec excludes by design (`isMobile` / explicit viewports).
- Online Playwright suite (`playwright.online.config.ts`): 28 passed, 0 failed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing check] Clean-token check added to commence.spec.ts**
- **Found during:** Task 2
- **Issue:** The plan listed only FeltTable.svelte for the « 1er » fix, so nothing guarded the typography.
- **Fix:** Added `expectCleanToken`: no tspan, « 1 » and « er » side by side, « er » raised, both inside the pill, at every side and size of the existing token test.
- **Files modified:** apps/web/e2e/commence.spec.ts
- **Commit:** c282522

**2. [Rule 1 - Bug] The column check in expectHand when the hand is only the selected card**
- **Found during:** Task 3
- **Issue:** In R-07.1 the hand is the Dame alone. Once she was selected, the « column » was the moved card itself.
- **Fix:** The column comes from a card that is not selected. A lone selected card is checked only against the strip and the screen edge.
- **Files modified:** apps/web/e2e/compact.spec.ts
- **Commit:** c28b01d

### Notes

- The measured `commits: 5` includes 8ce68a6 (`docs(phase-02): update tracking after wave 6`, ROADMAP.md only). The orchestrator made it during this plan. This plan made 4 commits: 96b05da, 27fbe71, c282522, c28b01d.
- STATE.md, ROADMAP.md and REQUIREMENTS.md were left untouched, as the orchestrator instructed.

## Known Stubs

None.

## Self-Check: PASSED
