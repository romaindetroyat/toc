---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 08
subsystem: ui
tags: [svelte5, svg, rotation, knights, waapi, facing, playwright]

requires:
  - phase: 01-01
    provides: "topology, LAYOUT, placeXY, LAST_CARD_SLOT, hopTimeline, director and animator"
  - phase: 01-02
    provides: "Board.svelte, Game.svelte, DebugGeometry.svelte, tracer and board e2e specs"
  - phase: 01-06
    provides: "settings.lastColor, ColorTile with its 64 px knight slot"
provides:
  - "packages/board rotate.ts: quarterTurnsFor, rotatePoint, screenSideOf (D-05)"
  - "geometry.ts: anchorOf, screenDelta, facingFor, placeKey, Facing"
  - "Board turns only the art by k quarter turns; overlays stay upright at rotated anchors"
  - "KnightDefs (four painted-wood knight symbols plus shared shadow, mounted once in App.svelte) and Pawn (static anchor, mover/arc/facing groups)"
  - "Game draws sixteen pawns in screen-y order from a places record; director sets per-hop facing"
  - "e2e/table.spec.ts: rotation per colour, hop on the rotated board, knight screenshots at 390/900/2100 px"
affects: [01-09, 01-16, 01-21, later motion and game plans]

actuals:
  tokens: 40000
  tasks: 2
  commits: 3
plan_head_before: 9d8159b70f204fe93b817c1b6d8b44805f5377e5
plan_head_after: df912edb0fd5b7344d5e378d3aa1a108e16a21d6

tech-stack:
  added: []
  patterns:
    - "Only the board art is rotated (CSS on the img); every overlay is placed at anchorOf(place, k) and stays upright"
    - "One <symbol> per colour reused with <use>; ids exist once per document (KnightDefs mounted in App.svelte)"
    - "Pawn = static outer anchor attribute + animated inner groups found by data-role (mover, arc, facing)"
    - "Facing is animated as per-hop steps on the facing group in the same WAAPI call as the hop"
    - "A moving pawn is re-ordered on top with flushSync before its animation starts, so no DOM move cuts it"

key-files:
  created:
    - packages/board/src/rotate.ts
    - packages/board/src/rotate.test.ts
    - apps/web/src/board/geometry.ts
    - apps/web/src/board/geometry.test.ts
    - apps/web/src/board/KnightDefs.svelte
    - apps/web/src/board/Pawn.svelte
    - apps/web/e2e/table.spec.ts
  modified:
    - packages/board/src/index.ts
    - apps/web/src/board/Board.svelte
    - apps/web/src/board/DebugGeometry.svelte
    - apps/web/src/board/animator.ts
    - apps/web/src/routes/Game.svelte
    - apps/web/src/game/director.ts
    - apps/web/src/ui/ColorTile.svelte
    - apps/web/src/App.svelte
    - apps/web/src/i18n/fr/board.ts
  deleted:
    - apps/web/src/board/Knight.svelte

key-decisions:
  - "KnightDefs is a zero-size <svg> mounted once in App.svelte (not in Game.svelte) because the launch screen's ColorTile references the same symbols and ids must be unique"
  - "Director takes quarterTurns instead of placeOf and calls anchorOf itself; animator.hop takes the pawn's three inner groups and a facings array"
  - "Pawn is a button only when it has onselect; the other fifteen are role=img with pointer-events none (UI-SPEC: only candidates are focusable)"
  - "Facing mirror lives on the inner facing group and the shadow stays outside it, so the shadow offset never flips"

requirements-completed: [FX-02, FX-01]

coverage:
  - id: D1
    description: "The board is turned by quarter turns so the player's colour is at the bottom (Bleu 0, Vert 90, Rouge 180, Jaune -90), partner at the top, next seat on the left; pawns stay upright"
    requirement: FX-01
    verification:
      - kind: unit
        ref: "packages/board/src/rotate.test.ts"
        status: pass
      - kind: unit
        ref: "apps/web/src/board/geometry.test.ts#anchorOf"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/table.spec.ts#table {colour}: ma couleur en bas, le partenaire en haut, le siège suivant à gauche"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/table.spec.ts#table: le plateau tourne avec la couleur choisie, les cavaliers restent droits"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sixteen Staunton knights in painted wood, four tints, one symbol per colour, no SVG filter"
    requirement: FX-02
    verification:
      - kind: e2e
        ref: "apps/web/e2e/table.spec.ts#table {colour}: ma couleur en bas... (16 data-pawn present)"
        status: pass
    human_judgment: true
    rationale: "Whether the knights read as Staunton knights in painted wood, and the four colours stay distinguishable (yellow on oak), is a visual judgment. The executor reviewed knights-390/900/2100.png; Romain should confirm."
  - id: D3
    description: "A knight's head faces its direction of travel on screen and keeps its facing on near-vertical moves"
    requirement: FX-02
    verification:
      - kind: unit
        ref: "apps/web/src/board/geometry.test.ts#facingFor"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/table.spec.ts#table: les cavaliers regardent dans le sens de la marche"
        status: pass
    human_judgment: false
  - id: D4
    description: "For each colour the human's pawn 0 starts on its exit diamond and a tap hops it 4 cells clockwise on the rotated board"
    requirement: FX-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e/table.spec.ts#table {colour}: le premier cheval part de son losange et bondit de 4 cases"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/tracer.spec.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "At board widths 390, 900 and about 2100 px the knights (about 17, 39, 90 px) stay legible in four colours"
    requirement: FX-02
    verification:
      - kind: e2e
        ref: "apps/web/e2e/table.spec.ts#captures du plateau à {390,900,2100} px (apps/web/test-results/knights-*.png)"
        status: pass
    human_judgment: true
    rationale: "Backstop truth: screenshots are produced by the spec, legibility is judged by eye"

duration: 12min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 08: S'asseoir à la table, plateau tourné vers sa couleur et seize cavaliers Staunton Summary

**The board turns by quarter turns toward the chosen colour (only the art rotates, every anchor goes through `anchorOf(place, k)`), and sixteen painted-wood Staunton knights are drawn from four `<symbol>`s with no SVG filter, their heads turned by `facingFor` along the screen delta of each hop.**

## Performance

- **Duration:** about 12 min
- **Completed:** 2026-10-13T15:55Z
- **Tasks:** 2 (Task 1 as TDD: RED then GREEN commit)
- **Files:** 7 created, 9 modified, 1 deleted

## Accomplishments

- `rotate.ts` (pure): `quarterTurnsFor` (bleu 0, vert 1, rouge 2, jaune 3), `rotatePoint` applying (x, y) -> (2560 - y, x), `screenSideOf` (bottom, left = next seat, top = partner, right). Tests prove four turns are the identity, the human's last-card slot lands at (1280, 1570) and the partner's at (1280, 990) for all four colours, the human's stables have their centroid in the lower half, and the UI-SPEC side examples hold.
- Board: the `<img>` and the loading backdrop turn by `k * 90deg`; the overlay svg is never turned; DebugGeometry draws ring, stables, homes, diamonds, entry squares, card slots, talon and discard at rotated anchors.
- Game reads `settings.lastColor` once. The tracer pawn is the human's pawn 0 on its exit diamond; a tap still hops 4 cells clockwise (`data-place` ring:EXIT+4) for all four colours on phone and desktop projects.
- KnightDefs: per-colour symbols (viewBox 110 x 190, feet at the bottom centre) with a light-body-dark gradient, one white highlight, three grain and three mane strokes clipped to the silhouette (fixes the draft's mane ticks escaping the outline), base bevel, eye with glint, 3-unit `#2B1D12` outline; one shared shadow ellipse. Pawn: static outer anchor, `mover` / `arc` / `facing` groups, `data-pawn`, `data-place`, `data-ring`, `data-facing`, home pawns at 90 %.
- Facing: `facingFor` keeps the previous facing for `|dx| < 0.35 |dy|` and for a zero move; the director computes it per hop from the rotated points and the animator plays it as steps on the facing group inside the same WAAPI call as the hop.
- Sixteen pawns are drawn in screen-y order with the moving pawn on top. ColorTile now shows the knight symbol (37 x 64 px) instead of the disc.

## Task Commits

1. **Task 1 RED:** `7decd39` test(01-08): board rotation toward the player and anchor geometry (RED)
2. **Task 1 GREEN:** `fe721f8` feat(01-08): turn the board so the chosen colour sits at the bottom
3. **Task 2:** `df912ed` feat(01-08): sixteen Staunton knights in painted wood, head turned the way they travel

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] KnightDefs mounted in App.svelte instead of Game.svelte**
- **Found during:** Task 2
- **Issue:** The plan has Game render KnightDefs, but ColorTile (launch screen, a different route) must use the same symbols; rendering the defs in both would duplicate every id.
- **Fix:** KnightDefs is a zero-size `<svg>` (not `display:none`, which breaks gradients in some browsers) mounted once in `App.svelte`; Game and ColorTile both reference it.
- **Files modified:** `apps/web/src/App.svelte`, `apps/web/src/board/KnightDefs.svelte`
- **Commit:** `df912ed`

**2. [Rule 2 - Missing Critical] Accessible names for the pawns in the French catalogue**
- **Issue:** The old Knight carried an inline French label; sixteen pawns need names from the catalogue (UI-SPEC: « Cheval bleu »).
- **Fix:** `board.pawn` added to `i18n/fr/board.ts`; only the pawn with an action is a focusable button, the rest are `role="img"` with `pointer-events="none"` (avoids a Svelte a11y warning and stops fifteen inert pawns from taking taps).
- **Commit:** `df912ed`

**3. [Plan interpretation] director.ts and animator.ts signatures**
- The plan says the director computes hop points with `anchorOf`; `placeOf` is replaced by `quarterTurns` in `DirectorDeps`, `commit` gets the final facing, `facingOf(pawn)` is added, and `animator.hop` takes the pawn's three inner groups (`partsOf(el)`) plus a facings array. Only Game consumes them.
- **Commit:** `df912ed`

**4. [Plan interpretation] Knight screenshots at 2100 px**
- Game caps the board at 880 px, so the screenshot test overrides `--board-size` to `100vw` (viewport squares of 390, 900, 2100) to get the board widths and knight sizes the plan names. Desktop project only, saved to `apps/web/test-results/knights-*.png` (gitignored).

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical), 2 plan interpretations.
**Impact:** none on the must-haves.

## Issues Encountered

- The first run of the rotation e2e asserted `transform: none` for k = 0; the computed value is the identity matrix. The test now derives the angle from the matrix. No code impact.
- Playwright reports 11 skipped tests: the pre-existing mobile skips in `board.spec.ts` plus the three screenshot tests (desktop project only).

## User Setup Required

None.

## Known Stubs

- `Game.svelte` places the sixteen pawns statically (each in its own stable slot, the human's pawn 0 on its exit diamond) and only that pawn is tappable. Intentional per the plan; plan 01-16 replaces it with the engine-driven render state.
- The 120 ms head turn before a backward 4 (UI-SPEC Pawns "Facing") is not implemented: facing flips at the start of a move. It belongs with the backward-4 motion plan; this plan has no backward path.

## Threat Flags

None. T-01-SC mitigated (no new package). T-01-27 mitigated: one symbol per colour reused through `<use>`, no SVG filter or blur, static outer anchors, animation only on inner groups, knights screenshotted at three sizes.

## Verification Results

- `pnpm exec vitest run packages/board apps/web/src`: 85 passed (full `pnpm exec vitest run`: 99 passed); `rotate.test.ts` and `geometry.test.ts` included.
- `pnpm typecheck` (tsc on engine and board, svelte-check on web): 0 errors, 0 warnings; `pnpm lint`: clean.
- `pnpm --filter @toc/web exec playwright test e2e/table.spec.ts e2e/tracer.spec.ts e2e/board.spec.ts e2e/launch.spec.ts e2e/audio.spec.ts`: 47 passed, 11 skipped.
- Acceptance: `grep -q "quarterTurnsFor(" Game.svelte`, `test ! -e Knight.svelte`, `grep -q "knight-jaune" KnightDefs.svelte`, `svelte-check` exit 0: all pass.
- Executor review of `knights-390.png`, `knights-900.png` and a 2100 px crop: the silhouette reads as a Staunton knight at 39 px and 90 px, as a recognisable horse head at 17 px; the four tints stay distinct and the yellow knights stand out on the oak thanks to the outline. The human check stays open for Romain.

## Next Phase Readiness

Plan 01-16 can replace the static `places` record in `Game.svelte` with the engine-driven render state: `Pawn`, `partsOf`, `director` (quarterTurns, facingOf, commit with facing) and `anchorOf` are the interfaces to keep.

## Self-Check: PASSED

- All created files exist on disk; commits `7decd39`, `fe721f8`, `df912ed` are ancestors of HEAD; `commits: 3` measured from the on-disk ledger; Knight.svelte is absent (intentional deletion).
