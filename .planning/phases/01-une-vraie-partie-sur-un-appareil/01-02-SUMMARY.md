---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 02
subsystem: ui
tags: [svelte5, svg, srcset, playwright, vitest, calibration, i18n, xss-guard]

requires:
  - phase: 01-01
    provides: "Board.svelte, Game.svelte, layout.json and LAYOUT, topology, calibrate(), composite board variants, DEBUG switch, Playwright config"
provides:
  - "Board with srcset 640/1280/2560, oak and felt loading backdrop, 200 ms fade, « Réessayer » error state"
  - "Game screen board size rule (portrait and landscape, safe-area insets): always square, centred, never cropped"
  - "DebugGeometry overlay (?debug=geometry), compiled out of production bundles"
  - "Test guards: calibration drift, topology constants, layout invariants, French typography, raw-HTML sinks"
affects: [01-03, 01-08, 01-09, 01-16, phase-2]

actuals:
  tokens: 8300
  tasks: 2
  commits: 2
plan_head_before: f1fda2196f2208dc522f4139aa32bbe2c2e7b566
plan_head_after: f3be21e79982421ea1aa971560a61989493355ec

tech-stack:
  added: []
  patterns:
    - "Debug-only modules are loaded by dynamic import() inside a branch that tests __TOC_DEBUG__ directly (not the re-exported DEBUG), so the bundler drops the module from dist"
    - "Text-scanning guards use import.meta.glob with ?raw (no Node types in apps/web)"
    - "Overlay labels sized in screen px through --px (board units per screen pixel), set on the board root"

key-files:
  created:
    - apps/web/src/board/DebugGeometry.svelte
    - apps/web/src/i18n/fr/board.ts
    - apps/web/e2e/board.spec.ts
    - tools/calibrate-board/calibrate.test.ts
    - packages/engine/src/topology.test.ts
    - packages/board/src/layout.test.ts
    - apps/web/src/i18n/typography.test.ts
    - apps/web/src/no-raw-html.test.ts
  modified:
    - apps/web/src/board/Board.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/App.svelte
    - apps/web/src/debug.ts

key-decisions:
  - "Debug overlay gate uses the global __TOC_DEBUG__ literal in Game.svelte: gating on the re-exported DEBUG constant left an orphan DebugGeometry chunk (with data-debug-geometry) in dist"
  - "Board size rule lives in CSS on .game (--board-size) with an orientation media query, Board.svelte reads var(--board-size)"
  - "Réessayer cache-busts with ?r=N on every srcset entry and on src"

patterns-established:
  - "Plain Node-free guard tests for apps/web via import.meta.glob raw imports"
  - "Detector self-tests next to every scanning guard, so a guard cannot pass vacuously"

requirements-completed: [FX-01]

coverage:
  - id: D1
    description: "At 320x480, 375x667, 390x844, 480x320 and 1280x800 the board is a square inside the viewport and the img loads one of the three plateau variants"
    requirement: FX-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e/board.spec.ts#plateau carré, net et jamais coupé (five viewports, desktop project)"
        status: pass
    human_judgment: true
    rationale: "Squareness, containment and variant name are asserted; sharpness on a real phone screen is a visual judgment"
  - id: D2
    description: "Loading shows oak with felt (no spinner); failure shows « Le plateau n’a pas pu se charger. » and a 44 px « Réessayer » that reloads the board"
    requirement: FX-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e/board.spec.ts#l’image du plateau en erreur"
        status: pass
    human_judgment: true
    rationale: "Error and retry behaviour is automated; the look of the oak/felt backdrop and 200 ms fade is a visual judgment"
  - id: D3
    description: "?debug=geometry in a debug build overlays the 72 ring indices, stables, homes, diamonds, entry squares and felt slots; production dist holds no overlay code"
    requirement: FX-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e/board.spec.ts#?debug=geometry (72 labels, label 71 visible)"
        status: pass
      - kind: other
        ref: "pnpm --filter @toc/web build && ! grep -rq data-debug-geometry apps/web/dist"
        status: pass
    human_judgment: true
    rationale: "Executor reviewed the overlay screenshots at 390x844 and 1280x800 (every label sits on its drawn cell); Romain's own look stays in the end-of-phase review"
  - id: D4
    description: "Calibration reproduces layout.json within 1.5 units, Appendix B values within 2 units, quarter rotation drift at most 12 px; topology and layout invariants hold"
    requirement: FX-01
    verification:
      - kind: unit
        ref: "tools/calibrate-board/calibrate.test.ts, packages/engine/src/topology.test.ts, packages/board/src/layout.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "French typography (U+202F, U+00A0, ’) over i18n/fr and no raw-HTML sink in apps/web/src are enforced by tests"
    verification:
      - kind: unit
        ref: "apps/web/src/i18n/typography.test.ts, apps/web/src/no-raw-html.test.ts"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 02: Le plateau, net et juste sur tous les écrans Summary

**Board served as 640/1280/2560 srcset with an oak and felt loading backdrop, a working « Réessayer », a UI-SPEC square sizing rule from 320x480 to desktop, a debug-only geometry overlay compiled out of production, and five test guards for calibration drift, topology, layout, French typography and raw-HTML sinks.**

## Performance

- **Duration:** about 9 min (start time not captured at spawn; estimated from the previous commit time)
- **Completed:** 2026-10-13T15:06Z
- **Tasks:** 2
- **Files modified:** 12 (8 created, 4 modified)

## Accomplishments

- `Board.svelte`: `srcset` of the three composites with `sizes` equal to the measured board width, oak `#D8C6B0` square with the felt `#005400` at 853..1707 while loading (no spinner), 200 ms fade (none under `prefers-reduced-motion`), error state with the typographic message and a 44 px « Réessayer » that cache-busts every source.
- `Game.svelte`: `--board-size` follows the UI-SPEC rule, portrait `min(100vw, 100dvh − 260px, 880px)`, landscape `min(100dvh − 32px, 100vw − 368px)`, safe-area insets subtracted; the tracer knight and its hop are untouched (tracer spec still passes on phone and desktop).
- `DebugGeometry.svelte`: numbered markers for the 72 ring cells, stables (E0..E3), homes (M0..M3), diamonds, entry squares and felt slots, labels at 14 screen px through `--px`. Reviewed on screenshots at 390x844 and 1280x800: every label sits on its drawn cell.
- Five guards: calibration (72 cells, pitch 122..145, layout.json within 1.5 units, Appendix B within 2 units, rotation drift at most 12 px), topology (EXIT, ENTRY, PARTNER, clockwise cycle, negative and overflowing `ringIndex`, `forwardCells`), layout (72 distinct points, exits and entries on diamonds and squares, slot ordering), French typography over `i18n/fr`, raw-HTML sinks over `apps/web/src`. Each text guard has detector self-tests, and a temporary violating file made both fail (then removed).

## Task Commits

1. **Task 1: board srcset, loading and error states, overlay** - `ba0671e` (feat)
2. **Task 2: test guards** - `f3be21e` (test)

**Plan metadata:** committed right after this file (docs: complete plan)

## Decisions Made

- The overlay import is gated on `__TOC_DEBUG__` itself (declared global in `debug.ts`), not on `DEBUG`. With `DEBUG` the production build emitted an orphan `DebugGeometry-*.js` chunk containing `data-debug-geometry`, which would fail the acceptance grep.
- Board sizing is plain CSS (`.game` custom property plus an `orientation: landscape` media query) so there is no JS layout code to keep in sync; `Board.svelte` falls back to `min(100vw, 100dvh, 880px)` when the variable is absent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] App router ignored a hash query**
- **Found during:** Task 1 (debug route)
- **Issue:** `App.svelte` matched `hash === "#/partie"`, so `#/partie?debug=geometry` fell through to the launch screen.
- **Fix:** route is the part of the hash before `?`.
- **Files modified:** `apps/web/src/App.svelte` (not listed in the plan's `files_modified`)
- **Commit:** `ba0671e`

**2. [Rule 1 - Bug] Production dist kept the overlay chunk**
- **Found during:** Task 1 (acceptance grep)
- **Issue:** with `if (DEBUG && …) import(...)` the bundler still emitted the dynamic chunk, so `data-debug-geometry` was in `dist`.
- **Fix:** gate on the `__TOC_DEBUG__` literal in `Game.svelte`; `debug.ts` now declares it as a global (comment updated). The acceptance grep passes.
- **Files modified:** `apps/web/src/routes/Game.svelte`, `apps/web/src/debug.ts` (the latter not in `files_modified`)
- **Commit:** `ba0671e`

**3. [Rule 3 - Blocking] Web tests could not use Node types**
- **Found during:** Task 2 (svelte-check)
- **Issue:** `apps/web/tsconfig.json` has no Node types, so `node:fs` in the two web guards failed type-checking.
- **Fix:** both guards read sources with `import.meta.glob(..., { query: "?raw" })` instead of `fs`; no tsconfig change.
- **Files modified:** `apps/web/src/i18n/typography.test.ts`, `apps/web/src/no-raw-html.test.ts`
- **Commit:** `f3be21e`

---

**Total deviations:** 3 auto-fixed (1 bug, 2 blocking). **Impact:** two extra small files touched (`App.svelte`, `debug.ts`); no scope creep, all must-have truths hold.

### Environment and process notes (not code deviations)

- A preview server from wave 1 was still listening on port 4173 and, with `reuseExistingServer: true`, served a stale build (every e2e failed). I killed that process by PID; Playwright then built and served the debug build itself.
- The new `board.spec.ts` is skipped in the phone project (`isMobile`), because device emulation would override the explicit viewport matrix; the plan asks for the desktop project.

## Issues Encountered

- At 480x320 landscape the UI-SPEC formula gives a 112 px board (`100vw − 368`): square and uncropped as required, but small. That is the spec's value; the right panel is not built yet. Worth a look when the info bar and hand land (plan 01-09).
- Debug labels overlap on narrow boards (ring pitch is about 19 px at 390 px width, labels are 14 px): acceptable for a debug view.

## Known Stubs

None.

## Threat Flags

None. T-01-SC mitigated (no package added, `pnpm-lock.yaml` and `package.json` unchanged). T-01-03 mitigated (`no-raw-html.test.ts`; no raw-HTML tag or innerHTML/outerHTML in `apps/web/src`). T-01-25 mitigated (dynamic import behind the compile-time flag, hash value matched against an allow-list `["geometry"]`, production `dist` grep for `data-debug-geometry` is empty).

## Verification Results

- `pnpm exec vitest run tools packages apps/web/src`: 6 files, 35 tests passed.
- `pnpm typecheck` (tsc x2 + svelte-check, 160 files, 0 errors) and `pnpm lint` (Biome, 37 files): exit 0.
- `pnpm --filter @toc/web exec playwright test e2e/board.spec.ts e2e/tracer.spec.ts`: 10 passed (desktop: five viewports, error and retry, overlay, no-overlay, tracer; phone: tracer), 8 skipped (board spec in the phone project).
- Production build (no `VITE_TOC_DEBUG`): `! grep -rq "data-debug-geometry" apps/web/dist` exits 0.
- `pnpm --filter @toc/web exec svelte-check --tsconfig ./tsconfig.json`: 0 errors, 0 warnings.
- Human check (overlay alignment on phone and desktop windows) done by the executor on screenshots; Romain's review remains in the end-of-phase checkpoint.

## Next Phase Readiness

- Plan 01-03 and later plans can rely on `pnpm exec vitest run tools packages apps/web/src` guarding geometry, topology, French copy and raw-HTML sinks.
- Every new French string in `apps/web/src/i18n/fr` is checked automatically; new Svelte or TS files under `apps/web/src` are scanned for raw-HTML sinks.
- Rotation per D-05 (plan 01-08) will reuse the same `Board` and `--px` conventions.

## Self-Check: PASSED

- All created files exist on disk, commits `ba0671e` and `f3be21e` are ancestors of HEAD, `plan_head_before`/`plan_head_after` and `commits: 2` measured from the on-disk ledger.

---
*Phase: 01-une-vraie-partie-sur-un-appareil*
*Completed: 2026-10-13*
