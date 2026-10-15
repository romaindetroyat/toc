---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 50
subsystem: ui
status: complete
tags: [ui, end-screen, galet, wood, recette-3, uat-30, gap-closure, e2e]
requires:
  - "01-49 (wave 40 done)"
provides:
  - "apps/web/src/ui/EndScreen.svelte: the end plank in the galet's wood (oak face with drawn grain, walnut rim and inner line, sharp offset shadow), Caveat 44 px title, the winning knights on discs of their galet colours with their names, the score « nous – eux », the stats, « Rejouer » and « Changer de couleur »; one column on a computer, two below 600 px high"
  - "EndScreen props score: { nous, eux } and names (the human as « Toi »), passed by Game.svelte from render.homeCounts and session.names"
  - "game.end.you, opponents, us, them, score(us, them)"
  - "Test hooks: [data-end-plank], [data-end-knight=<colour>], [data-end-score] with [data-score=nous|eux] .number"
  - "01-UI-SPEC.md: « La planche de fin de partie » in the addendum « Recette 3 de Romain »"
affects: ["01-54 (Romain's re-test: does the plank look good, on his iPhone and his computer)"]
tech-stack:
  added: []
  patterns:
    - "A silhouette drawn with a CSS mask of the image (never a filter) gives a sharp offset ink outline"
    - "The focus ring's walnut gap is drawn with a box-shadow on light surfaces so the amber ring stays visible"
    - "An e2e helper awaits the element's CSS animations (getAnimations().finished) before measuring its box"
key-files:
  created: []
  modified:
    - apps/web/src/ui/EndScreen.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/i18n/fr/game.ts
    - apps/web/e2e/partie.spec.ts
    - apps/web/e2e/finition.spec.ts
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md
decisions:
  - "The score comes from render.homeCounts (the source of the pill and the info bar), not a second count over render.pawns"
  - "The knight disc is 68 px (not 56) so the 57 px knight stands inside it; an ink silhouette (CSS mask, offset 2 px) detaches a knight from a disc of its own colour"
  - "« Toi » always comes first among the knights; on a phone the two stats take a line each"
metrics:
  duration: "18 min"
  completed: 2026-10-15
  tasks: 2
  files: 6
estimate:
  tokens: 50000
  tasks: 2
actuals:
  tokens: 7000
  tasks: 2
  commits: 2
plan_head_before: 909878dc53d4ce327d73ea947aa3b9f2e501b393
plan_head_after: 8365fceeab82181bf4048453f76687c0f60c7975
---

# Phase 1 Plan 50: La planche de fin de partie, dans le bois du galet Summary

**The end of a game is now a plank in the galet's wood over the dimmed board. It has an oak face with a drawn grain, a walnut rim with its fine inner line, and a sharp offset shadow. On it: « Victoire ! » (with an amber brush stroke) or « Défaite » in Caveat, the winning team's two knights (Romain's pictures) on discs of their galet colours with their names (« Toi » first), the score « nous – eux » in a carved cartouche, the stats, then « Rejouer » and « Changer de couleur ». It is one column on a computer and two on a phone held sideways. It fits 1280 × 800, 844 × 390, 750 × 342 and 480 × 320 without scrolling. There is no filter and no blur anywhere.**

## What was built

### Task 1 (tracer), 47f023a: the plank, the props, the copy, the win in partie.spec

- `EndScreen.svelte` rebuilt in place. The dialog semantics are unchanged: role, aria-modal, the title as its name (the sentence is now its description), focus on « Rejouer », the Tab trap, and the window focusin guard.
  - **Plank:** `PALETTE.board` face. The grain is three `repeating-linear-gradient` series of `PALETTE.track` hairlines and soft bands at 178–181°, under a lighter radial heart. It has a 6 px `PALETTE.rim` border, a 1 px `PALETTE.outlineLine` line 4 px inside it (two inset box-shadows), radius 28, the shadow `0 6px 0` in ink at 45 %, and ink text.
  - **Title:** Caveat 700 at 44 px. On a win, an inline SVG stroke in amber is drawn under it.
  - **Team:** a 68 px disc (radial `PALETTE.light` → `PALETTE.hex`, ink ring, faint cream inner ring, 3 px offset shadow). The `./cavaliers/<colour>.webp` knight (33 × 57) stands on it, with an ink silhouette behind (a `mask` of the same image, offset 2 px). The name sits under it in Label 700. On a defeat, « L’équipe adverse » is written above.
  - **Score:** the numbers in Caveat 700 28 px with tabular figures, « Nous » and « Eux » in Label, in a cream cartouche. The visible tally is aria-hidden; screen readers get « Score : nous n chevaux rentrés sur 8, eux m sur 8 ».
  - **Stats:** « Donnes jouées : n · Chevaux mangés : nous a, eux b » in Label, track colour, balanced wrap.
  - **Buttons:** « Rejouer » is the amber primary. « Changer de couleur » is on wood, with a 2 px walnut outline and ink text. Both are 48 px high with a sharp 3 px shadow that presses in on `:active`. On focus, the walnut gap of the focus ring is drawn on the oak.
  - **Layout:** max 520 px wide on a computer. Below 600 px high: two columns up to 680 px with a hairline divider, and tighter padding under 560 px wide. Max height 100dvh − 16 px.
  - **Motion:** the scrim fades in and the plank drops 12 px and fades in, over 300 ms. With reduced motion (`settings.reduceMotion` or the media query), there is only a 150 ms fade.
- `Game.svelte`:
  - `endScore`: knights home per team, from `render.homeCounts`.
  - `endNames`: `session.names` with the human as `copy.end.you`.
  - Both are passed as `score=` and `names=`.
- `game.ts`: `you`, `opponents`, `us`, `them`, `score()`, with NBSP before « : » and the typographic apostrophe.
- `partie.spec.ts`: the win (R-16.4) asserts:
  - `data-result="win"`, « 8 » for Nous and « 0 » for Eux, and the spoken score text;
  - Bleu « Toi » then Rouge, both images loaded with the right `src`;
  - no « L’équipe adverse », both buttons, focus on « Rejouer »;
  - the plank wholly inside the window and not scrolling, on both projects (the `plankInView` helper waits for the CSS animations to end first).

  Captures: `test-results/fin-victoire-{phone,desktop}.png`.

### Task 2, 8365fce: the defeat, finition, the UI contract

- `partie.spec.ts` defeat case, on both projects: a hand-made position. Bleu has only a 2 with two knights in the stable, so its hand is posed. Vert's 5 then brings its last knight home, and Jaune is already home. The test asserts:
  - `data-result="loss"`, « Défaite », the loss sentence, focus on « Rejouer »;
  - with emulated reduced motion, every plank animation is 150 ms and none moves;
  - « L’équipe adverse » with the Jaune and Vert knights, bot names (not « Toi », not empty), and the score 5 – 8;
  - the plank inside the project window, then inside 480 × 320, with Tab kept on it and the layout inert.

  Captures: `fin-defaite-{phone,desktop}.png` and `fin-defaite-480x320-{phone,desktop}.png`.
- `finition.spec.ts` (a whole game with « Son » off): the winning side's score reads 8 and the plank shows two knights. Nothing in finition measured the old panel, so nothing needed removing.
- `01-UI-SPEC.md`:
  - **« La planche de fin de partie »:** Romain's words; eight numbered points « à confirmer par Romain »; the typography exception (the Caveat 44 px title is a drawn element, the only text above Display); the technical facts (no filter, sharp shadows, `PALETTE`, the score from `render.homeCounts`, the tests and captures); a UI Considerations table with the 01-54 backstop.
  - **« End-of-game screen »:** now carries « Remplacé le 2026-10-15 … ».
  - **Copy rows:** three new rows (names, defeat caption, score).

## Screenshots (looked at critically, iterated twice)

All in `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/`:
`01-50-victoire-1280x800.png`, `01-50-defaite-1280x800.png`, `01-50-victoire-844x390.png`, `01-50-defaite-844x390.png`, `01-50-victoire-750x342.png`, `01-50-defaite-750x342.png`, `01-50-victoire-480x320.png`, `01-50-defaite-480x320.png`.

Changes made after looking at the screenshots:
- The first grain was too regular and looked like lined paper on the phone. It now has broad soft bands and fewer, finer hairlines.
- The discs went from 64 to 68 px.
- The score cartouche was tightened.
- The phone's stats wrapped mid-phrase (« nous / 0, eux 0 »). They now take a line each, with balanced wrap.

Plank boxes measured:
- 520 × 499 at 1280 × 800;
- 680 × 278 at 844 × 390 and 750 × 342;
- 464 × 290 at 480 × 320.

The scroll height equals the client height at every size.

## Verification

- `pnpm typecheck`: 0 errors. `pnpm lint`: no fixes (147 files).
- `pnpm test`: 38 files, **795 passed, 2 skipped** (unchanged: no unit test touched).
- `pnpm exec vitest run apps/web/src/i18n`: 13 passed (typography of the new strings).
- Playwright, full suite on both projects: **349 passed, 89 skipped, 0 failed** (6.1 min). Baseline was 347 / 89; the 2 new tests are the defeat case on the two projects.
- `node tools/rules-trace.mjs`: « rules-trace: OK (16 règles, 118 scénarios) ».
- frameClock invariant: no `.animate(` in `apps/web/src/board` outside `frameClock.ts` (EndScreen uses CSS keyframes, in `src/ui`).
- Acceptance: `grep score` and `grep cavaliers/` in EndScreen.svelte match; `grep -n blur` finds nothing.

## Deviations from Plan

### Design choices within the plan

**1. Disc 68 px, ink silhouette behind the knight**
- The plan gives a disc of the colour with the knight 56 px high. The knight (57 px, its picture's ratio) on a 56–64 px disc of its own colour blended into it. The disc is 68 px, and an ink silhouette drawn with a CSS `mask` (not a filter) and offset 2 px, like the plank's own shadow, outlines the knight.

**2. Score from `render.homeCounts`**
- The plan names `homeCount(render.pawns, colour)`. `render.pawns` in the web app holds places, not engine pawns. `render.homeCounts` is the same count, already used by the pill and the info bar.

**3. A carved cartouche around the score; the focus ring's walnut gap drawn on the oak**
- These are decoration and accessibility within the plank's design. Amber on oak alone is about 1.4:1, so the gap keeps the UI-SPEC's « 3 px amber, 2 px walnut offset » ring visible.

**4. finition.spec gained an assertion instead of losing one**
- Nothing there measured the old 400 px panel, so a whole-game check of the plank's score was added.

No auto-fixes (Rules 1–3) were needed. No package was added.

## Known Stubs

None.

## Threat surface

T-01-78 is mitigated as planned: the names are the fixed horse list and « Toi », rendered as Svelte text (no raw HTML). T-01-SC: no package added. There is no new network or input surface.

## For Romain (01-54)

At the end of a game, on his iPhone held sideways and on his computer: does the plank look good and look like the galet? That covers the wood, the rim, the title in handwriting, the two knights on their colour discs, the score « 8 – 5 » and the buttons. If not, what should change?

## Self-Check: PASSED

- FOUND: apps/web/src/ui/EndScreen.svelte (data-end-screen, data-end-plank), this SUMMARY
- FOUND commits: 47f023a, 8365fce (git rev-list --count 909878d..8365fce = 2)
