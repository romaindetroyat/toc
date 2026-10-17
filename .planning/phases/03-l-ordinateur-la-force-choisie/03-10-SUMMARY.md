---
phase: 03-l-ordinateur-la-force-choisie
plan: 10
subsystem: web-ui
status: complete
gap_closure: true
gap: "Romain, 2026-10-17: the cards are hard to read, above all on the iPhone and the card received from the partner"
tags: [hand, cards, compact-mode, readability, uat-gap]
requires: ["03-09", "01-47 compact layout", "packages/board scene geometry"]
provides:
  - "leftClearance(y0, y1) in @toc/board: how far the galet's left side stays bare in a band"
  - "cornerCard / cornerLayout in apps/web/src/cards/fan.ts: the phone's hand in the galet's corner"
  - "the received card's thick border in the partner's seat colour (data-received), named « …, reçue de {Partenaire} »"
  - "106 x 148 computer cards in the unchanged 160 px bar"
affects: [apps/web game screen (hand on phone and computer), card faces, e2e hand checks]
tech-stack:
  added: []
  patterns:
    - "layout measured against the scene geometry (pure function in @toc/board) rather than guessed"
    - "the game screen clips at the screen's edges (.game overflow: clip); hand cards may run past them"
key-files:
  created: []
  modified:
    - packages/board/src/scene.ts
    - packages/board/src/scene.test.ts
    - apps/web/src/cards/fan.ts
    - apps/web/src/cards/cards.test.ts
    - apps/web/src/cards/faces.ts
    - apps/web/src/app.css
    - apps/web/src/ui/Card.svelte
    - apps/web/src/ui/HandFan.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/i18n/fr/game.ts
    - apps/web/e2e/compact.spec.ts
    - apps/web/e2e/finition.spec.ts
    - apps/web/e2e/cibles.spec.ts
    - apps/web/e2e/partie.spec.ts
    - apps/web/e2e/animations.spec.ts
    - apps/web/e2e/ecrans.spec.ts
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md
    - .planning/phases/03-l-ordinateur-la-force-choisie/03-UI-SPEC.md
decisions:
  - "Phone hand (03-10): a cascade of large cards from the bottom of the left strip, each as far right as leftClearance allows, past the screen's left edge when the strip is narrower; the galet's bare corner (about 110 px) is too small for whole 80 px cards without covering cells"
  - "Phone card size: the largest 5:7 card (at most 80 x 112) such that five fit under the info pill with each slice 3 px past the card's middle: 79 x 110 at 844 x 390, 67 x 94 at 750 x 342, 61 x 86 at 320 px high"
  - "Phone index stacked in the top-right corner (always on screen), rank 25 % / suit 20 % of the card height; the middle art only on the shown part and under the slice of covered cards"
  - "Received card: 6 px inset border of PALETTE.hex[partner] with a 1 px walnut inner line, no tag, no amber; read name « …, reçue de {Partenaire} »"
  - "Computer: 106 x 148 cards in the same 160 px bar, their lower edge under the screen's edge, board still 1227 px at 1280 x 800; index 26/22 px weight 800; red suits #A8140E"
metrics:
  duration: "about 95 min (after waiting for 03-09)"
  completed: "2026-10-17"
actuals:
  tokens: 14000
  tasks: 3
  commits: 5
plan_head_before: f5dee8db20674d7f247979f3fcbb59a0657ceacd
plan_head_after: c08d314cacd1c4ba209ba30f2b082d8727f6f385
---

# Phase 3 Plan 10: Des cartes qu'on lit Summary

Larger, readable cards: on the phone the hand is a cascade of 79 × 110 cards (at 844 × 390) standing
from the bottom of the left strip over the galet's bare side, placed by a new scene-geometry
function so they never cover a cell or a knight; the partner's card wears only a thick border of the
partner's colour; on the computer the cards are 20 % larger in the same bar, the board unchanged.

## What was built

- **`leftClearance(y0, y1)`** (`packages/board/src/scene.ts`): the scene x of the leftmost thing of
  the game in a band of heights (every ring cell with the knight, halo and ghost ring it may carry,
  every home and stable dot with its knight, the riders with their thinking glow, the felt).
- **`cornerCard` / `cornerLayout`** (`apps/web/src/cards/fan.ts`): card size and slice from the strip's
  height; each card's top-left corner, bottom-aligned, right edges at the clearance less 2 px and the
  6 px selection move, never right of the card under it. The old column helpers (01-47) are removed.
- **HandFan / Card / Game**: the compact fan covers the whole left strip (taps pass through except on
  cards), measures the board through the stage element, and places each card; the index stands in the
  top-right corner; the middle art is centred on the shown part (`--cut`) and hidden under the slice of
  covered cards (`--middle-top`). `.game` clips at the screen's edges so nothing scrolls.
- **The received card**: `received` is now `{ color, name }`; a `.border` span draws the 6 px seat-colour
  border; `data-received` is the test hook; the « Reçue » tag and the amber outline are gone.
- **Computer**: `cardSize` regular 106 × 148; the fan box is 160 px with the card's top 10 px under it;
  index 26/22 px, weight 800; pips 56 px; red suits `#A8140E` (7.4:1 instead of 6.0:1).

## Sizes achieved (Chromium emulation, insets 0)

| Window | Board width | Card | Slice | Shown on screen (last card) |
|--------|-------------|------|-------|-----------------------------|
| 1280 × 800 | 1227 px (unchanged) | 106 × 148 (was 88 × 124) | fan, 56 px (49 at 960 wide) | lower edge under the screen |
| 844 × 390 | 724 px (unchanged) | 79 × 110 (was 52 × 73) | 58 px | 57 px (65) |
| 750 × 342 | 630 px (unchanged) | 67 × 94 | 50 px | 56 px (63) |
| 667 × 375 | 547 px (unchanged) | 75 × 105 | 55 px | 55 px (70) |
| 568 × 320 | 448 px (unchanged) | 61 × 86 | 46 px | 55 px (whole) |
| 480 × 320 | 360 px (unchanged) | 61 × 86 | 46 px | 54 px (whole) |

On an iPhone the safe-area inset (about 47 px each side in landscape) gives the cards room left of the
strip, so they show whole or nearly whole there; this could not be emulated in Playwright.

## Screenshots (looked at, iterated v1 → v2 → final)

`/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/03-10-final-{1280x800,844x390,750x342,667x375,568x320,480x320}-{echange,recue,choisie}.png`,
plus `-recue-zoom.png` crops of the phone sizes, and the `03-10-before-*` originals. « echange » is
the choice of the card to pass, « recue » the turn right after the exchange with the received card
bordered, « choisie » a card chosen with its preview.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Covered card centres were not tappable**
- **Found during:** Task 2 (first screenshots)
- **Issue:** with slices of exactly half the card (56 px of 112), the next card covered each card's
  centre; a tap (and Playwright's click) at the middle hit the next card.
- **Fix:** `cornerCard` takes the largest card whose slice passes its middle by 3 px (79 × 110 instead of
  80 × 112 at 844 × 390); unit test over every height 280–600.
- **Commit:** 0e9f5ca

**2. [Rule 1 - Bug] The hand's box swallowed taps on the info pill**
- **Found during:** Task 3 (phone partie.spec)
- **Issue:** the `.hand` wrapper spans the whole left strip, over the pill.
- **Fix:** `pointer-events: none` on the wrapper; the cards keep `auto`.
- **Commit:** 0e9f5ca

**3. [Design, documented] « En éventail dans le coin »**
- The bare corner is too small for whole cards (measured from the scene geometry before building), so
  the hand is a cascade leaning into the corner and running past the screen's left edge rather than a
  rotated fan; the index moved to the top-right corner. Recorded in 03-UI-SPEC « Des cartes qu'on lit »
  and in its « À confirmer par Romain » list (items 9–12).

### Specs changed (assertions, not skipped)

- `compact.spec`: hand cards left `STRIP_ITEMS`/`controlsOf`; new `expectHand` (under the info, 44 × 44
  shown, no drawn cell nor knight covered); the tracer's 52 × 73 / 44 px checks became 67 × 94 / 50 px.
- `finition.spec`: hand cards checked by `expectCardsShown` (top index on screen, 44 × 44 shown) instead of
  « whole card inside the screen ».
- `cibles.spec`: added 44 px of each card on the screen.
- `partie.spec`, `animations.spec`: « Reçue » text replaced by the border's colour/width and the read name.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green — 49 files, 945 passed, 2 skipped (pre-existing
  `it.skip` scenario alternatives in packages/engine).
- Full Playwright suite, both projects: **410 passed, 96 skipped (project-specific skips), 0 failed**.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: packages/board/src/scene.ts (leftClearance), apps/web/src/cards/fan.ts (cornerLayout)
- FOUND commits: 4eb0e13, d7fc030, 0e9f5ca, 0ff2acd, c08d314
