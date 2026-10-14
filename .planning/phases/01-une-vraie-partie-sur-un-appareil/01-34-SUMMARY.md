---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 34
subsystem: board
status: complete
tags: [board, plateau-galet, landscape, paysage-obligatoire, e2e, gap-closure]
requires:
  - "01-32 (both galet geometries, layout parameter with transitional portrait defaults, the landscape tracer)"
  - "01-33 (riders, rule pictures on the landscape galet, the « Plateau galet » contract with « paysage obligatoire »)"
provides:
  - "packages/board scene.ts: every layout default is « landscape », SCENE = sceneOf(\"landscape\")"
  - "anchorOf(place, k, layout = \"landscape\"); the Director's fallback layout is landscape"
  - "Game.svelte: boardLayout is the constant « landscape », no `plateau` debug parameter"
  - "DealBanner over a board of any ratio (board-size x --board-ratio)"
  - "Board.svelte: on a board under 314 px the enlarged felt button lets taps through to lit knights"
  - "tracer.spec: R-07.1 on the default board on both projects (2:1, halo, target, ghost, hop through cell 9, landing on 15, Dame on the felt)"
  - "board/finition/cibles/table specs on the 2:1 landscape galet"
affects: ["01-35", "01-36", "01-37", "01-38", "01-40"]
tech-stack:
  added: []
  patterns:
    - "Specs read the board's shape (its box), never its layout attribute"
    - "The step is measured on the page (centres of drawn cells 3 and 4), never a literal"
    - "A per-frame recorder queries its nodes again every frame (a lit knight is a button, replaced on « Jouer »)"
key-files:
  created: []
  modified:
    - packages/board/src/scene.ts
    - apps/web/src/board/geometry.ts
    - apps/web/src/game/director.ts
    - apps/web/src/routes/Game.svelte
    - apps/web/src/ui/DealBanner.svelte
    - apps/web/src/board/Board.svelte
    - apps/web/src/board/cardFx.test.ts
    - apps/web/src/i18n/fr/board.ts
    - apps/web/e2e/tracer.spec.ts
    - apps/web/e2e/board.spec.ts
    - apps/web/e2e/finition.spec.ts
    - apps/web/e2e/cibles.spec.ts
    - apps/web/e2e/table.spec.ts
decisions:
  - "The landscape galet is the only game board, without any parameter (Romain's « paysage obligatoire »); the portrait galet stays in scene.ts, unused, until 01-40"
  - "While knights are lit on a board under 314 px wide, the felt button (enlarged to 44 px past the felt) lets the tap through to the hit layer; it stays a 44 px target otherwise and for the keyboard"
metrics:
  duration: "24 min"
  completed: 2026-10-14
  tasks: 2
  files: 13
estimate:
  tokens: 70000
  tasks: 2
actuals:
  tokens: 6500
  tasks: 2
  commits: 3
plan_head_before: cb2ec9c8db12e6ed1afdcecdb8e8ec1cc3fa8e1f
plan_head_after: a213b37929bb8b9312a740a6ab413468f843b8ef
---

# Phase 1 Plan 34: Le galet en largeur devient le seul plateau du jeu Summary

The game now draws the landscape galet (3200 x 1600, step about 107.05) with no parameter, on every screen. This follows Romain's « paysage obligatoire ». The transitional defaults of 01-32 are flipped, so the knights, halos, hit targets, ghosts, letters, marks, glow, party, felt cards and debug view all stand on it with unchanged code. A whole Dame move (R-07.1) is now checked end to end on both projects: lit, previewed, hopped cell by cell, landed, and laid on the felt.

## What was built

- **Task 1 (tracer), c4deabf.**
  - scene.ts: every `layout: Layout = "portrait"` default is now `"landscape"`, and `SCENE = sceneOf("landscape")`. The header gives Romain's reason and says the portrait galet stays, unused, until 01-40. `anchorOf` gets the same default.
  - Game.svelte: `const boardLayout: Layout = "landscape"`. `PLATEAUX` and the `plateau` hash parameter are gone, so release and debug builds draw the same board. Board, the anchor and the session env still receive the constant.
  - tracer.spec:
    - `ghostOffCell` measures the step on the page.
    - The per-frame hop recorder is now a helper used by both R-07.1 tests. The main test on both projects now checks the 2:1 box, halo and target centred on bleu0, the ghost within half a step of cell 15, the ground point within a quarter step of cell 9 (recorded from before « Jouer »), the landing on drawn cell 15 (offCell ≤ 0.5), and the Dame inside the felt button below its centre.
    - The keyboard tracer lost `plateau=largeur` and its `data-board-layout` check. It stays desktop-only because the keyboard shortcuts are the computer's.
- **Task 2, a213b37.**
  - DealBanner: `.wrap` height is `board-size x var(--board-ratio, 0.5)`. The head-room fallback is now the landscape value.
  - board.ts: `loadFailed` and `retry` are removed.
  - board.spec:
    - « plateau galet en largeur, dessiné et jamais coupé » runs at the five viewports. It checks `|h − 0.5 w| ≤ 1.5`, that the board is inside the screen, that the page does not scroll (new), that there is no `img` and no `image` other than the riders, 72 cells, and no transform.
    - The riders test is a single test without a parameter, on both projects.
    - The debug-geometry test converts to scene units with the svg's viewBox width (3200).
  - finition.spec: `expectLandscapeGalet` checks 2:1. The 7 panel test checks the panel is below or beside the board, never on it.
  - cibles.spec: the board under the 7 panel is 2:1.
  - table.spec: the comment gives the landscape ring knight at about 0.0318 of the board width (about 12, 29 and 67 px).

## Measured board sizes (Playwright, insets 0)

| Viewport | Board (px) | Step (px) |
|---|---|---|
| 320 x 480 | 288 x 144 | 9.63 |
| 375 x 667 | 343 x 171.5 | 11.47 |
| 390 x 844 | 358 x 179 | 11.98 |
| 480 x 320 | 112 x 56 | 3.75 |
| 1280 x 800 | 912 x 456 | 30.51 |
| phone project (iPhone 13, 390 x 664) | 358 x 179 | 11.98 |

At 480 x 320 the board is 112 px wide. The side panel (320 + 48 px) leaves it only that much room. This is transitional: 01-37's compact band takes it to at least 360 px.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green. 38 files, 770 passed, 2 skipped (unchanged).
- Task 1 greps: no `PLATEAUX` or `"plateau"` in Game.svelte, and no `plateau=` in tracer.spec. `grep -c '= "portrait"'` gives 0 for scene.ts and for geometry.ts.
- `playwright test e2e/tracer.spec.ts`: 15 passed, 1 skipped (the keyboard tracer on phone).
- Frame-clock invariant: animateNow is still in animator.ts, cardFx.ts and Particles.svelte, and there is no `.animate(` in apps/web/src/board outside frameClock.ts. No motion code was changed.
- `! grep -rn "loadFailed\|retry:" apps/web/src/i18n/fr/board.ts`: exit 0.
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 112 scénarios) ».
- Full Playwright suite on both projects: **286 passed, 44 skipped, 0 failed** (5.0 min). Phone: 122 passed, 43 skipped. Desktop: 164 passed, 1 skipped.
  - The baseline was 287 / 45. The three rider runs (portrait on both projects, landscape on desktop) plus one phone skip became one rider test on both projects: 2 runs and no skip.
  - Nothing else changed in the counts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The deal banner made the page scroll on the landscape board (done in Task 1, planned in Task 2)**
- **Found during:** Task 1 (the tracer's hop check failed on desktop: 182.6 px, i.e. exactly 6 steps).
- **Issue:** DealBanner's `.wrap` was `board-size x 1.5` tall. On a 2:1 board that box reached 1550 px at 1280 x 800, so the document scrolled. When Playwright clicked the knight, the page scrolled by 194 px. « Jouer » then scrolled it back, so the recorder's reference cells were measured in the wrong place.
- **Fix:** The plan's Task 2 change (`var(--board-ratio)`) was applied in Task 1. board.spec now also asserts that the page does not scroll at the five viewports, with the banner showing.
- **Files modified:** apps/web/src/ui/DealBanner.svelte
- **Commit:** c4deabf

**2. [Rule 3 - Blocking] The Director's fallback layout and cardFx.test's literals**
- **Issue:** `director.ts` fell back to `"portrait"`, while the director tests compare with `anchorOf(place, k)`, which now defaults to landscape. That broke 6 tests. cardFx.test also asserted the portrait galet's seat-card places.
- **Fix:** The fallback is now `"landscape"`, the same transitional default. cardFx.test asserts the landscape places: bottom (1600, 914.6), top (1600, 685.4), left (1220, 800), right (1980, 800). Its describe titles no longer say C+. Both files are outside the plan's list.
- **Commit:** c4deabf

**3. [Rule 1 - Bug] The hop recorder held nodes that « Jouer » replaces**
- **Issue:** A knight the player can act on is drawn as a button, and the plain picture replaces it after « Jouer ». The 01-32 recorder kept references to the first nodes.
- **Fix:** The recorder queries the shadow and the place again on every frame. The rest offset is still measured before « Jouer ».
- **Commit:** c4deabf

**4. [Rule 1 - Bug] At 480 x 320 the felt button covered every knight (Board.svelte, outside the plan's list)**
- **Found during:** Task 2 (finition « tient entier » at 480 x 320 on both projects: the tap on the lit stable knight opened « Sur le tapis »).
- **Issue:** On the 112 x 56 px board, the felt is 42 x 16 px. Its button is raised to the 44 px minimum, which covers the board's vertical middle, and the 3 px knights stand entirely under it. The former portrait board was taller, so its knights stood clear of the felt.
- **Fix:** A container query on the board, `@container (max-width: 314px)`, below which the felt (448 / 3200 of the width) is under 44 px tall: while the hit layer is active (`:has([data-hit-layer])`), the felt button gets `pointer-events: none`. The tap then reaches the lit knight, or counts as a miss.
  - The felt is still a 44 x 44 target, still in the Tab order, and still opens with Entrée.
  - The 44 px and tray rules are unchanged.
  - On boards of 314 px and wider, behaviour is unchanged. In this transitional state that covers 375 x 667, 390 x 844, 1280 x 800 and the phone project. At 320 x 480 (288 px board) the rule does apply: a tap on the felt while knights are lit is a miss there too. That screen leaves the game in 01-38.
- **Commit:** a213b37

**5. [Plan rule, Task 2 step 4] The 7 panel fixture's second knight moved from cell 20 to cell 40**
- **Issue:** At 480 x 320 the step is 3.75 px. After the 4 steps, bleu0 is on cell 9, about 41 px from cell 20. Tapping bleu1 then opened the « Lequel ? » tray instead of the steps.
- **Fix:** Following the plan's rule (move the knights, never relax the 44 px rule), the fixture's second knight stands on cell 40, on the other side of the ring. The test's assertions are unchanged.
- **Commit:** a213b37

**6. Test titles.** The 7 panel test of finition.spec is now titled « le panneau du 7 tient sous le plateau ou à côté », and the cibles one « le galet en largeur reste 2:1 et dans l’écran, le panneau avec lui ».

### Not changed (as planned)

- art.ts `boardArt(k, layout = "portrait")` keeps its default. Its two callers always pass the layout, and the plan limited the flip to scene.ts and the anchor. It leaves with the layout concept in 01-40.
- Board.svelte's `layout = "portrait"` prop default and its CSS fallbacks are untouched. Game.svelte always passes the landscape constant.

## Commits

The measured range `cb2ec9c..a213b37` holds 3 commits. One of them, 7f12fa7 « docs(01): fix plan-check findings on 01-34 to 01-41 », was made by the orchestrator while this plan ran, not by this executor.

## Known Stubs

None added. These are still transitional, as planned and owned by later plans:
- the felt's piles, dead hands, « D » and active-seat ring still use the former 2560-unit constants (01-35);
- the side panel on a computer (01-36);
- the 112 px board at 480 x 320 (01-37);
- the portrait chrome on screens taller than wide (01-38).

## Threat Flags

None. T-01-56 is closed: no hash parameter chooses a board. T-01-55 is covered by the tracer's halo, target, ghost and landing checks on both projects.

## Self-Check: PASSED

- FOUND: packages/board/src/scene.ts (contains "landscape"), apps/web/e2e/tracer.spec.ts (contains "R-07.1")
- FOUND: c4deabf, a213b37 (ancestors of HEAD)
