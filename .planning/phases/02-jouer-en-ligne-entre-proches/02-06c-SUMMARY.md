---
phase: 02-jouer-en-ligne-entre-proches
plan: 06c
status: complete
subsystem: web-ui
tags: [compact-mode, hand, iphone, safe-area, layout, playwright]

requires:
  - phase: 02-jouer-en-ligne-entre-proches
    provides: "02-06b one-column corner hand (cornerLayout over leftClearance, inset-safe strip)"
  - phase: 03-l-ordinateur-la-force-choisie
    provides: "03-10 corner card size (cornerCard)"
provides:
  - "The compact left strip sized for the 03-10 card (--hand-strip), the right strip 60 px, the board moved right into spare width before it narrows"
  - "fan.ts: cornerTargetWidth(height) and compactLayout(width, height, insets, bare), the TS twin of the CSS"
  - "Game.svelte: --galet-bare (leftClearance over the whole galet / SCENE.width) on main.game"
  - "compact.spec: compactFrame, every compact card checked against the 03-10 card of its strip"
affects: [02-10]

tech-stack:
  added: []
  patterns:
    - "A CSS layout term that depends on scene geometry gets its constant from TS through a style: custom property (--galet-bare), and a pure TS twin of the formula for unit tests"

key-files:
  created:
    - .planning/phases/02-jouer-en-ligne-entre-proches/02-06c-PLAN.md
  modified:
    - apps/web/src/cards/fan.ts
    - apps/web/src/cards/cards.test.ts
    - apps/web/src/routes/Game.svelte
    - apps/web/src/ui/HandFan.svelte
    - apps/web/e2e/compact.spec.ts
    - apps/web/e2e/table.spec.ts
    - .planning/phases/03-l-ordinateur-la-force-choisie/03-UI-SPEC.md

decisions:
  - "Left strip = max(60, (card + 9.5 − bare·(100vw − insets − 60)) / (1 − bare), card + 9.5 − bare·tall board), card = min(80, (h − 60)·5/21, max(40, h − 224)·5/7) px: the 03-10 card unrounded + 6 px nudge + 2 px margin + 1.5 px rounding slack, less the galet's bare side (22.59/3200 of the board's width)"
  - "Only the left strip widens; the right strip keeps its 60 px minimum (the 58 px buttons and the gear need it), so the board shifts right by about 11.5 px and narrows by about 3 % at 844 x 390 (724 to 701 px)"
  - "Pure CSS calc (no round(), no JS measurement) so the safe-area insets keep working through env() and the simulated-inset tests"
  - "With the iPhone's 21 px bottom inset the 03-10 card of the 369 px strip is 74 x 103; the card-size rule of 03-10 (five slices past each middle) was not loosened to reach 76"

metrics:
  duration: 20min
  completed: 2026-10-17
  tasks: 2

actuals:
  tokens: 9000
  tasks: 2
  commits: 3
plan_head_before: d28fdd90c864bc8e6b60997e3f07b857e30e7eb9
plan_head_after: 3b78b40fb7c4706c25d0dbb22bb974313397f8e8
---

# Phase 2 Plan 06c: a slightly smaller board, so the phone's cards are big again Summary

On landscape phones the left strip is now as wide as the 03-10 card needs, and the right strip stays at 60 px. The board moves right into any spare width and narrows only when none is left. At 844 × 390 it loses about 3 % of its width (724 to 701 px), and the hand's column is back to 79 × 110 cards. The 02-06b guarantees still hold: one left edge, the selected card 6 px right, nothing in the safe area, no ring cell covered, the partner's border, the top-right index and a clean « 1er ».

Romain was asked on 2026-10-17: « Sur iPhone, les cartes sont maintenant bien alignées, mais pour tenir dans la bande à gauche du plateau elles sont plus petites qu'avant (56 px de large au lieu de 79). Que préfères-tu ? » He answered « Plateau un peu réduit (Recommandé) ».

## What changed

- `Game.svelte`, in the compact media query:
  - `--hand-card` is the target card (`cornerCard` of the strip's height, unrounded).
  - `--board-tall` is the height-limited board.
  - `--hand-strip` is the left strip that card needs, over the galet's bare side, at least 60 px.
  - `--board-size = max(0, min(100vw − hand strip − 60 px − insets, board-tall))`.
  - The grid is `minmax(var(--hand-strip), 1fr) board minmax(var(--strip), 1fr)`.
  - `--galet-bare` comes from `leftClearance(−∞, ∞) / SCENE.width` on `main.game`.
- `fan.ts`: `cornerTargetWidth` and `compactLayout` are the TS twin of the CSS, used by the unit tests. `cornerLayout` and `HandFan.svelte` were not changed in behaviour (only a comment in HandFan); the wider strip they measure is enough.
- The « bar » layout is unchanged: 1226.8 px at 1280 × 800, bar 160 px, checked by `e2e-online/pause.spec`. At 959 × 400 the board is unchanged: 752 px, centred, 103.5 px strips.

## Card size and positions (measured in Chromium, after the deal banner)

| Window | Insets (side, bottom) | Card before → after | Column x on screen before → after | Board w × h before → after |
|--------|-----------------------|---------------------|-----------------------------------|----------------------------|
| 844 × 390 | 0, 0 | 56 × 79 → **79 × 110** | 1 → 1 | 724 × 362 → 700.9 × 350.4 (−3.2 %) |
| 750 × 342 | 0, 0 | 56 × 79 → **67 × 94** | 0 → 1 | 630 × 315 → 617.7 × 308.8 (−1.9 %) |
| 480 × 320 | 0, 0 | 54 × 75 → **61 × 86** | 0 → 2 | 360 × 180 → 351.1 × 175.5 (−2.5 %) |
| 844 × 390 | 47, 21 | 56 × 79 → **74 × 103** | 47 → 48 | 630 × 315 → 611.2 × 305.6 (−3.0 %) |
| 844 × 390 | 59, 21 | 56 × 79 → **74 × 103** | 59 → 60 | 606 × 303 → 587.1 × 293.5 (−3.1 %) |
| 750 × 342 | 59, 21 | 55 × 77 → **62 × 87** | 59 → 60 | 512 × 256 → 503.9 × 252.0 (−1.6 %) |
| 480 × 320 | 59, 21 | 53 × 74 → **54 × 75** | 59 → 60 | 242 × 121 → 240.6 × 120.3 (−0.6 %) |
| 959 × 400 | 0, 0 | 80 × 112 → 80 × 112 | 20 → 20 | 752 × 376 → 752 × 376 (unchanged) |
| 1280 × 800 (bar) | 0, 0 | unchanged | unchanged | 1226.8 → 1226.8 |

In every state the selected card is 6 px right of the column. At 844 × 390 the selected card's right edge is at x = 86, still clear of the ring cells (checked by `expectHand`). The received card keeps the partner's dark-red border.

All the cards are the 03-10 card for their strip's height (`cornerCard(h)`). With the iPhone's 21 px bottom inset, the strip is 369 px high and that card is 74 × 103, which was already its 03-10 size. I did not loosen the slice rule to reach 76. The worst board loss at any target window is 3.8 % (667 × 375), well under the 12 % limit.

## Screenshots (looked at)

- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06c-844x390-idle.png, 02-06c-844x390-chosen.png, 02-06c-844x390-received.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06c-480x320-idle.png, 02-06c-480x320-chosen.png, 02-06c-480x320-received.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06c-844x390-insets59-idle.png, 02-06c-844x390-insets59-chosen.png, 02-06c-844x390-insets59-received.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06c-750x342-idle.png, 02-06c-750x342-chosen.png, 02-06c-750x342-received.png (extra)

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green, 73 files, 1171 passed, 2 skipped. The skips were already there.
- Full local Playwright suite (`playwright.config.ts`): 455 passed, 0 failed, 99 skipped. The skips are projects that a spec excludes by design. The added inset case makes it one more passed and one more skipped than 02-06b's run.
- Online Playwright suite (`playwright.online.config.ts`): 28 passed, 0 failed.
- The suites ran one after the other. Afterwards nothing answered on port 8787 or port 4173.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing check] The compact card size checked in every compact state**
- **Found during:** Task 2
- **Issue:** The plan updated only the traceur and the inset tests, so a regression back to smaller cards would pass elsewhere.
- **Fix:** `expectHand` now asserts that every card is `cornerCard` of the strip's height. The inset tests also check the left strip, the board, the 60 px right strip and the card. A third inset case covers 844 × 390 with a 59 px inset. The traceur checks the page's `--galet-bare` against leftClearance.
- **Files modified:** apps/web/e2e/compact.spec.ts
- **Commit:** 3b78b40

### Notes

- `HandFan.svelte` got a one-line comment update only. It was not in the plan's `files_modified`.
- STATE.md, ROADMAP.md and REQUIREMENTS.md were left untouched, as instructed.

## Known Stubs

None.

## Self-Check: PASSED
