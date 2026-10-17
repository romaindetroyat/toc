---
phase: 03-l-ordinateur-la-force-choisie
plan: 09
subsystem: web-ui
status: complete
gap_closure: true
gap: "03-UAT.md tests 6 and 12 (« Pas assez visible »)"
tags: [thinking-sign, reduced-motion, board, css-animation, uat-gap]
requires: ["03-06 thinking sign (.respire)", "03-08"]
provides:
  - "a seat-colour pulsing ring around every thinking glyph (respire-halo)"
  - "the thinking seat's glyph before « {Nom} réfléchit… » (data-thinking-line)"
  - "a breathing glow around the thinking seat's rider on the board (data-thinking-glow, respire-lueur)"
affects: [apps/web game screen (computer bar, phone pill and prompt row, info sheet, exchange list), board]
tech-stack:
  added: []
  patterns:
    - "CSS keyframes on transform/opacity only; the board glow is a composited HTML layer between the drawing's svg and the knights' svg"
    - "ring colour passed per element through --respire-seat (light seat tints --seat-*-clair)"
key-files:
  created: []
  modified:
    - apps/web/src/app.css
    - apps/web/src/ui/SeatChip.svelte
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/ui/ActionZone.svelte
    - apps/web/src/board/Board.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/e2e/reflexion.spec.ts
    - .planning/phases/03-l-ordinateur-la-force-choisie/03-UI-SPEC.md
decisions:
  - "Thinking sign (03-09): glyph swells to × 1.22 without fading, inside a ring of the seat's light tint pulsing 0.55 → 1; reduced motion keeps the ring steady at 0.9 plus « … »"
  - "Board thinking glow: PALETTE.hex radial glow, 1.7 × rider height, centred on the seat's ink rider (not the stable, which already carries the amber turn glow); shown in the exchange too; steady 0.85 under reduced motion"
  - "« {Nom} réfléchit… » starts with the seat glyph (SeatChip label={false}, aria-hidden), placed outside the text box because the bar's text scrolls and the phone's line clips"
metrics:
  duration: "about 40 min"
  completed: "2026-10-17"
actuals:
  tokens: 6300
  tasks: 3
  commits: 7
plan_head_before: c546f81cd1f31413c35185ce02365a53332766b2
plan_head_after: 8c2576ce55bdcc3d2a058b255b87cf1361703cc0
---

# Phase 3 Plan 09: Un signe « réfléchit » qui se voit Summary

The thinking sign now shows in four places at once, each in the thinking seat's colour. The glyph
swells to × 1.22 inside a soft, pulsing ring. « {Nom} réfléchit… » starts with that glyph on the
computer and on the phone. On the board, a calm glow breathes around the seat's ink rider. With
reduced motion, the ring and the glow stay lit without moving, and « … » follows the name. This
answers Romain's « Pas assez visible » of 2026-10-17 (UAT tests 6 and 12).

## What the sign looks like now

- **Computer, bottom bar:** the turn glyph (cream chip, seat glyph) grows to 1.22 and back over 1.6 s.
  It wears a 2 px ring 4 px out with an 8 px glow, in the seat's light tint (bleu `#5C86D4`, jaune
  `#F7D35A`, rouge `#EE6B5E`, vert `#5CC27A`). The ring is visible from the first frame (opacity
  0.55) and grows to full opacity at × 1.15 with the breath. « Tour de {Nom} » still fades to 0.7.
- **Computer, action zone:** the same breathing glyph and ring stand before « {Nom} réfléchit… ».
- **Phone:** in the prompt row over the board, the glyph and its ring stand before « {Nom}
  réfléchit… ». The info pill's glyph chip breathes in a tighter ring (2 px out); the turn dot no
  longer moves. The « Infos de la partie » sheet looks like the bar.
- **Exchange list:** the thinking giver's hourglass breathes in a ring of its seat colour. Its name
  is now in full cream, where it used to be muted.
- **Board (both layouts, play and exchange):** a radial glow in the seat's board colour sits around
  its ink rider, under the knights, and breathes. It goes from opacity 0.5 at scale 0.9 to opacity 1
  at scale 1.06.
- **Reduced motion (system or « Réduire les animations »):** nothing moves. The ring stays at 0.9,
  the board glow stays at 0.85, and « … » follows the name as before.
- Never amber. No `.animate(` was added to apps/web/src/board: everything is CSS keyframes on
  transform and opacity. The room for the ring is reserved by fixed margins, so nothing shifts when
  the sign starts.

## Screenshots (looked at)

Before (03-06) and after, at 1280×800 and 844×390. The animated shots are frozen at the peak of the
breath (−800 ms):

- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/03-09-before-desktop-tour.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/03-09-before-phone-tour.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/03-09-after-desktop-tour.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/03-09-after-phone-tour.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/03-09-after-desktop-tour-autre.png (rouge)
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/03-09-after-phone-tour-autre.png (rouge)
- The `-echange` and `-reduit` variants of each before and after (desktop and phone) are in the same folder.

## Tasks

| # | Task | Commits |
|---|------|---------|
| 1 | Ring and stronger breath (bar, pill, sheet, exchange list, prompt glyph) | ce5ad1d, a79820d, 8c2576c |
| 2 | Board glow around the thinking seat's rider | ba4bc22 |
| 3 | reflexion spec, UI-SPEC note, screenshots | b79354b, 3b93779 |

Plan commit: ea41bd3.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green. Vitest 939 passed and 2 skipped, the same as
  the baseline.
- Playwright `reflexion`, `compact`, `ecrans` and `finition`, phone and desktop: 73 passed, 35
  skipped, 0 failed.
- Full Playwright run: 410 passed, 96 skipped, 0 failed, the same as the baseline.
- `reflexion.spec.ts` now also checks these points:
  - while a bot thinks, the ring runs `respire-halo` and the board glow runs `respire-lueur` for the
    same seat;
  - the prompt glyph `data-thinking-line` matches the thinking seat;
  - on the player's turn, the glow and the glyph are gone;
  - with reduced motion, the ring is steady at opacity 0.9 and visible, and the glow has no
    animation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Ring clipped by the scrolling text and the clipping action column**
- **Found during:** Task 1 (screenshots)
- **Issue:**
  - On the computer, a glyph placed inside the prompt's text box was cut, because the text scrolls
    after three lines.
  - The exchange list's first ring was cut by the `.action` column (`overflow-y: auto`).
- **Fix:**
  - The glyph now stands outside the text box (a new `.said` row).
  - The bar's givers list is indented 12 px, and each giver icon keeps 4 px of space on each side.
- **Commits:** ce5ad1d, a79820d

**2. [Rule 1 - Bug] The phone exchange row's widened clip box broke compact.spec**
- **Found during:** the full Playwright run
- **Issue:** padding plus a negative margin on `.row .givers` made the list's box larger than the
  24 px prompt row. compact.spec checks that the list stays inside the row (750 × 342 and
  480 × 320 failed).
- **Fix:** the list keeps its box and clips sideways only (`overflow-x: clip; overflow-y: visible`,
  with `overflow: hidden` as the fallback). The first icon keeps 8 px of space.
- **Commit:** 8c2576c

### Design choices inside the brief

- The board glow surrounds the rider, not the stable: the stable already carries the amber turn
  glow, and two glows on the same spot would mix seat colour with amber.
- The glyph no longer fades (it used to dip to 0.7): fading made it less visible. Only the text still
  fades, which keeps the 0.7 contrast floor of the UI-SPEC.

## Known Stubs

None.

## Threat Flags

None. The change is presentation only: no new input, network or storage surface.

## Self-Check: PASSED

- All modified files exist; commits ea41bd3, ce5ad1d, ba4bc22, a79820d, b79354b, 3b93779 and
  8c2576c are ancestors of HEAD.
