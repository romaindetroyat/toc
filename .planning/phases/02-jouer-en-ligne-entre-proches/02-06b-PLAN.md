---
phase: 02-jouer-en-ligne-entre-proches
plan: 06b
type: execute
wave: 6
depends_on: ["02-06"]
autonomous: true
gap_closure: true
files_modified:
  - apps/web/src/cards/fan.ts
  - apps/web/src/cards/cards.test.ts
  - apps/web/src/ui/HandFan.svelte
  - apps/web/src/ui/Card.svelte
  - apps/web/src/board/FeltTable.svelte
  - apps/web/e2e/compact.spec.ts
  - apps/web/e2e/cibles.spec.ts
  - apps/web/e2e/finition.spec.ts
  - .planning/phases/03-l-ordinateur-la-force-choisie/03-UI-SPEC.md
requirements: []
---

# Plan 02-06b: the phone's hand in one straight column, and a clean « 1er »

<objective>
Romain sent an iPhone screenshot (real device, held sideways, Dynamic Island on the left) on
2026-10-17: « Sur iphone, la carte du bas est décalée, je ne veux pas ça ». In the compact hand of
plan 03-10 each card goes as far right as the galet's bare side allows in its own band
(`cornerLayout` over `leftClearance`), so the lowest card (a Dame) leans far into the corner while the
others run left, past the strip and under the Dynamic Island.

Make the hand one straight vertical column: every card the same size and the same left edge, the
position set by the tightest clearance over the whole five-card box, never left of the strip (the
strip starts after `env(safe-area-inset-left)`, so no card sits under the Dynamic Island). Cards keep
the 03-10 size when it fits; otherwise the largest uniform 5:7 card that fits without covering a ring
cell, a knight, a dot, a rider or the felt. Keep: each card's top-right index visible, slices of at
least 44 px, digits 1-5 and the arrows, the 6 px nudge of the selected card, the partner's border on
the received card.

In the same screenshot the « 1er » token's superscript « er » is clipped and runs into the « 1 »
(`baseline-shift="super"` on a `tspan` under `dominant-baseline="central"` is not drawn alike by
WebKit): set « 1 » and « er » as two positioned texts that never overlap.
</objective>

<context>
- apps/web/src/cards/fan.ts: `cornerCard`, `cornerLayout` (plan 03-10).
- apps/web/src/ui/HandFan.svelte: the compact hand (`--cut`, `--middle-top`, the key hint).
- packages/board/src/scene.ts: `leftClearance(y0, y1)` (unchanged).
- apps/web/src/routes/Game.svelte: the compact layout (60 px strips, padding = safe-area insets);
  on every iPhone held sideways the board is width-limited, so the left strip is 60 px wide.
- 03-UI-SPEC « Des cartes qu’on lit (plan 03-10) » and the « 1er » token row.
</context>

<tasks>

<task type="auto">
  <name>Task 1: one straight column of uniform cards inside the strip</name>
  <files>apps/web/src/cards/fan.ts, apps/web/src/cards/cards.test.ts, apps/web/src/ui/HandFan.svelte, apps/web/src/ui/Card.svelte</files>
  <action>
  - `cornerCard(height, maxWidth?)`: the 03-10 card, capped at `maxWidth` (5:7 kept).
  - `cornerLayout` returns `{ card, slots }`: the room is the strip's width plus the galet's bare
    side over the whole five-card box (`leftClearance` of its band), less CORNER_MARGIN and
    CORNER_SHIFT; the card is the largest `cornerCard(height, w)` whose width fits that room; every
    slot has the same `x = max(0, floor(room - w))`.
  - HandFan uses the layout's card for its size and slices; no more `--cut` (no card runs past the
    strip's left edge any more), the digit at 4 px from the card's left edge.
  - Unit tests: same x for every card, x >= 0, uniform size, the 03-10 size kept when the strip is
    wide enough, sizes at the target windows, and the old clearance / 44 px invariants.
  </action>
  <verify><automated>pnpm vitest run apps/web/src/cards</automated></verify>
  <done>Every card of the compact hand shares one left edge inside the strip; no ring cell covered.</done>
</task>

<task type="auto">
  <name>Task 2: « 1er » without overlap</name>
  <files>apps/web/src/board/FeltTable.svelte</files>
  <action>Two `text` elements: « 1 » anchored at its end and « er » at its start on the same x (a
  0.5 px gap), « er » raised, both `dominant-baseline="central"`; no `tspan`, no `baseline-shift`.</action>
  <verify><automated>pnpm typecheck</automated></verify>
  <done>The token reads « 1er » with the « er » up and clear of the « 1 ».</done>
</task>

<task type="auto">
  <name>Task 3: specs and UI-SPEC</name>
  <files>apps/web/e2e/compact.spec.ts, apps/web/e2e/cibles.spec.ts, apps/web/e2e/finition.spec.ts, .planning/phases/03-l-ordinateur-la-force-choisie/03-UI-SPEC.md</files>
  <action>
  - compact.spec: the traceur's card size and the column (same x, x >= strip's left edge);
    `expectHand` asserts one left edge and nothing past the screen's left edge; a test with the
    iPhone's insets simulated (59 px each side, 21 px at the bottom) checks that no card stands
    in the inset.
  - cibles / finition: comments and the « nothing past the left edge » check for the corner.
  - 03-UI-SPEC: dated note quoting Romain, the new « Horizontal place » rule and the size table.
  </action>
  <verify><automated>pnpm --filter @toc/web exec playwright test</automated></verify>
  <done>Full local Playwright suite 0 failed; screenshots at 844 × 390, 750 × 342, 480 × 320 looked at.</done>
</task>

</tasks>

<verification>
pnpm typecheck && pnpm lint && pnpm test; full local Playwright suite, 0 failed.
</verification>

<output>.planning/phases/02-jouer-en-ligne-entre-proches/02-06b-SUMMARY.md</output>
