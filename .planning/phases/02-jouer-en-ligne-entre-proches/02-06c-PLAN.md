---
phase: 02-jouer-en-ligne-entre-proches
plan: 06c
type: execute
wave: 6
depends_on: ["02-06b"]
autonomous: true
gap_closure: true
files_modified:
  - apps/web/src/cards/fan.ts
  - apps/web/src/cards/cards.test.ts
  - apps/web/src/routes/Game.svelte
  - apps/web/e2e/compact.spec.ts
  - apps/web/e2e/table.spec.ts
  - .planning/phases/03-l-ordinateur-la-force-choisie/03-UI-SPEC.md
requirements: []
---

# Plan 02-06c: a slightly smaller board, so the phone's cards are big again

<objective>
Plan 02-06b put the phone's hand in one straight column inside the left strip. The cost: on every
iPhone held sideways the board is width-limited, the left strip is 60 px and the galet's bare side
about 5 px, so the cards shrank from 79 x 110 (plan 03-10) to 56 x 79 at 844 x 390.

On 2026-10-17 Romain was asked: « Sur iPhone, les cartes sont maintenant bien alignées, mais pour
tenir dans la bande à gauche du plateau elles sont plus petites qu'avant (56 px de large au lieu de
79). Que préfères-tu ? » He answered « Plateau un peu réduit (Recommandé) ».

In the compact mode, the left strip becomes as wide as the 03-10 card needs (its target card, the
`cornerCard` of the strip's height, plus the selection nudge and the margin, less the galet's bare
side), never under 60 px; the right strip stays at 60 px. When a window has spare width (the board
height-limited), the board first moves right inside it; it only gets narrower when there is no spare
width left. Everything from 02-06b is kept: one left edge (the selected card 6 px right), nothing in
the safe area, no ring cell or board thing covered, the partner's border, the top-right index, a clean
« 1er ». The « bar » layout (computers, tablets) and every height-limited compact window whose strips
are already wide enough (959 x 400) are unchanged.

This answer takes precedence over « Plateau sur toute la hauteur » (03-UI-SPEC, plan 03-10) on phones
only, and only by the minimum needed.
</objective>

<context>
- apps/web/src/cards/fan.ts: `cornerCard`, `cornerLayout` (plans 03-10, 02-06b).
- apps/web/src/ui/HandFan.svelte: measures the strip and the board, calls `cornerLayout` (unchanged).
- packages/board/src/scene.ts: `leftClearance` (unchanged); its value over the whole galet is the
  bare side, 22.59 / 3200 of the board's width.
- apps/web/src/routes/Game.svelte: the compact grid (`--strip`, `--board-size`, the three columns).
- 02-06b-SUMMARY.md: the sizes measured after 02-06b.
</context>

<tasks>

<task type="auto">
  <name>Task 1: the left strip sized for the 03-10 card</name>
  <files>apps/web/src/cards/fan.ts, apps/web/src/cards/cards.test.ts, apps/web/src/routes/Game.svelte</files>
  <action>
  - fan.ts: `cornerStripWidth(width, height, insets, bare)`, the left strip the compact layout gives
    (the same formula as the CSS): the target card width `min(80, (h − 60) · 5/21, max(40, h − 224) · 5/7)`
    (the 03-10 card of the strip's height, 5:7, with no rounding), plus CORNER_SHIFT + CORNER_MARGIN
    and 1.5 px for the rounding of the real card, less the bare side `bare · board`; at least 60 px.
  - Game.svelte: `--galet-bare` (leftClearance over the whole galet / SCENE.width) on main.game;
    in the compact media query `--hand-card`, `--board-tall`, `--hand-strip` and
    `--board-size = max(0, min(100vw − hand strip − 60 px − insets, board-tall))`; the grid's left
    column `minmax(var(--hand-strip), 1fr)`.
  - Unit tests: at the target windows (with and without insets) the strip lets cornerLayout keep the
    full cornerCard; the board shrinks by under 12 %; 959 x 400 keeps its board.
  </action>
  <verify><automated>pnpm vitest run apps/web/src/cards</automated></verify>
  <done>At 844 x 390 the cards are 79 x 110 again in one column inside the strip; the board about 701 px.</done>
</task>

<task type="auto">
  <name>Task 2: specs and UI-SPEC</name>
  <files>apps/web/e2e/compact.spec.ts, apps/web/e2e/table.spec.ts, .planning/phases/03-l-ordinateur-la-force-choisie/03-UI-SPEC.md</files>
  <action>
  - compact.spec: the board's width and position from the new formula (left strip from the target
    card, right strip 60 px), the traceur's card size, the inset tests.
  - table.spec and any other spec asserting the old 724 px board at 844 x 390.
  - 03-UI-SPEC: dated note quoting Romain's question and answer, and the new size table.
  </action>
  <verify><automated>pnpm --filter @toc/web exec playwright test</automated></verify>
  <done>Full local and online Playwright suites 0 failed; screenshots at 844 x 390, 480 x 320 and
  844 x 390 with 59 px insets looked at.</done>
</task>

</tasks>

<verification>
pnpm typecheck && pnpm lint && pnpm test; full local Playwright suite and the online suite, 0 failed;
nothing left listening on port 8787.
</verification>

<output>.planning/phases/02-jouer-en-ligne-entre-proches/02-06c-SUMMARY.md</output>
