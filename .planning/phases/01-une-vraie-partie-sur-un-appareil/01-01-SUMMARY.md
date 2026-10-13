---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 01
subsystem: ui
tags: [pnpm-workspace, svelte5, vite8, typescript6, playwright, web-audio, waapi, sharp, biome, vitest]

requires: []
provides:
  - "pnpm workspace (apps/web, packages/engine, packages/board, tools) with TS 6.0.3, Biome, Vitest 4.1, Playwright"
  - "packages/engine topology: COLORS, EXIT, ENTRY, PARTNER, PawnId, Place, ringIndex, forwardCells, GameEvent pawnMoved"
  - "packages/board: calibrated layout.json (72 ring cells, stables, homes, diamonds, squares), LAYOUT, placeXY, hopTimeline"
  - "tools/calibrate-board/calibrate.mjs and tools/build-board.mjs (board composite, art untouched)"
  - "apps/web walking skeleton: hash router, Launch, Game, Board, Knight, animator, director, audio engine and synth"
  - "Playwright tracer spec on phone and desktop projects"
affects: [01-02, 01-03, 01-09, 01-16, phase-2, phase-3]

actuals:
  tokens: 11460
  tasks: 2
  commits: 1
plan_head_before: 0cae0c7f73972c1046549c2ceb9dead044068b46
plan_head_after: e3641dccbeda51450255e88c1a4c0964835b16d9

tech-stack:
  added:
    - "typescript 6.0.3"
    - "vitest 4.1.11"
    - "fast-check 4.10.2"
    - "@biomejs/biome 2.5.15"
    - "sharp 0.35.5"
    - "@types/node 22.20.5"
    - "vite 8.3.4"
    - "svelte 5.57.2"
    - "@sveltejs/vite-plugin-svelte 7.3.1"
    - "svelte-check 4.7.6"
    - "@playwright/test 1.64.0"
    - "@fontsource-variable/nunito 5.3.0 (installed, not yet used)"
    - "@fontsource-variable/caveat 5.3.0 (installed, not yet used)"
    - "lucide-static 1.56.0 (installed, not yet used)"
  patterns:
    - "Just-in-time workspace packages (exports point at src/*.ts, no build step); erasable TypeScript only, relative imports with explicit .ts"
    - "Events are the only input of animation and audio: Director plays one event at a time"
    - "One hopTimeline() call per move feeds both WAAPI (animator.hop) and Web Audio (scheduleClops), same lead"
    - "Outer <g transform> = static anchor, inner <g> animated by WAAPI, feet at local (0,0)"
    - "Compile-time debug switch __TOC_DEBUG__ (dev or VITE_TOC_DEBUG=1); debug branches vanish from production bundles"

key-files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - pnpm-lock.yaml
    - tsconfig.base.json
    - biome.json
    - vitest.config.ts
    - packages/engine/src/topology.ts
    - packages/engine/src/events.ts
    - packages/board/layout.json
    - packages/board/src/layout.ts
    - packages/board/src/hopTimeline.ts
    - packages/board/src/hopTimeline.test.ts
    - tools/calibrate-board/calibrate.mjs
    - tools/build-board.mjs
    - apps/web/src/routes/Launch.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/board/Board.svelte
    - apps/web/src/board/Knight.svelte
    - apps/web/src/board/animator.ts
    - apps/web/src/game/director.ts
    - apps/web/src/audio/engine.ts
    - apps/web/src/audio/synth.ts
    - apps/web/e2e/tracer.spec.ts
    - apps/web/playwright.config.ts
  modified:
    - .gitignore

key-decisions:
  - "pnpm 10.28.0 self-switched to the pinned packageManager pnpm@10.34.7 through the registry, so packageManager is 10.34.7 as planned (flagged assumption A-02 resolved)"
  - "Biome formats with its default double quotes (the plan left quote style open); the French string catalogue therefore uses double quotes as plan 01-02's typography test expects"
  - "Debug offsets are exposed as window.__tocDebug.audio.scheduled (last move) plus .history (all moves), only when __TOC_DEBUG__ is true"
  - "Director takes a commit(pawn, place) dependency and the animator a leadMs argument so the WAAPI start and the audio t0 share the same 60 ms lead"

patterns-established:
  - "FIRST-file convention: topology.ts, hopTimeline.ts, animator.ts, audio/engine.ts and director.ts are now the in-repo analogs for their layers"
  - "Svelte state holding engine data uses $state.raw and is replaced whole"
  - "Hit areas are an invisible circle inside the pawn group so Playwright and fingers hit the knight"

requirements-completed: [FX-01, FX-04]

coverage:
  - id: D1
    description: "Tapping « Jouer la partie » on #/ opens #/partie and shows Romain's four quarters assembled as one square board (jaune top-left, rouge top-right, bleu bottom-left, vert bottom-right)"
    requirement: FX-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e/tracer.spec.ts#tracer: Jouer la partie -> plateau -> le cavalier bleu bondit de 4 cases (phone and desktop)"
        status: pass
    human_judgment: true
    rationale: "Automation proves the image loads and the route opens; whether the composite is faithful and sharp is a visual judgment (screenshot reviewed by the executor, Romain's review of the art stays in the end-of-phase checkpoint)"
  - id: D2
    description: "The blue knight on the blue diamond hops clockwise to ring index 4 in hopTimeline(4).total = 799 ms with exactly 4 clops scheduled at [199.75, 399.5, 599.25, 799] on the AudioContext clock"
    requirement: FX-04
    verification:
      - kind: unit
        ref: "packages/board/src/hopTimeline.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/tracer.spec.ts#tracer (animation duration 799 ms, scheduled offsets, data-ring 0 to 4)"
        status: pass
    human_judgment: false
  - id: D3
    description: "AudioContext created and resumed synchronously inside the « Jouer la partie » click; state is 'running' after the click"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/tracer.spec.ts#tracer (body data-audio = running)"
        status: pass
    human_judgment: true
    rationale: "Headless Chromium reaches 'running'; iOS Safari behaviour (silent switch, unlock) can only be proven on a real iPhone (plan 01-24)"
  - id: D4
    description: "packages/board/layout.json holds 72 ring cells, diamonds at ring indices 0/18/36/54, entry squares at 70/16/34/52, 4 stables and 4 homes per colour, pitch between 122 and 145 board units"
    verification:
      - kind: other
        ref: "node tools/calibrate-board/calibrate.mjs -> {\"exitsAndEntriesOk\":true,\"pitchMin\":122.7,\"pitchMax\":144.8}"
        status: pass
    human_judgment: false
  - id: D5
    description: "Workspace scaffold: typecheck (tsc + svelte-check), lint (Biome), Vitest and Playwright green; engine importable by plain Node 22"
    verification:
      - kind: other
        ref: "pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm exec vitest run packages/board && pnpm --filter @toc/web exec playwright test e2e/tracer.spec.ts"
        status: pass
    human_judgment: false

duration: 10min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 01: Squelette jouable (Walking Skeleton) Summary

**pnpm/Svelte 5 walking skeleton: « Jouer la partie » unlocks Web Audio, shows Romain's composited board, and a tap on the blue knight hops it 4 cells in 799 ms with 4 synthesised hoof clops scheduled from the same hopTimeline() call, proven by Playwright on phone and desktop.**

## Performance

- **Duration:** about 10 min (start time was not captured at spawn; estimated from file timestamps)
- **Started:** about 2026-10-13T14:45:00Z (estimate)
- **Completed:** 2026-10-13T14:55:10Z
- **Tasks:** 2 (Task 1 resolved by Romain before spawn, Task 2 executed)
- **Files modified:** 42 (all created, plus .gitignore modified)

## Package legitimacy

Task 1 (`checkpoint:human-verify`, `gate="blocking-human"`) was resolved by the human before this executor started.

- Romain's reply, verbatim: **« approuvé »**
- Context shown to Romain before he approved: the orchestrator ran `npm view` on all 14 packages and confirmed each is published from its official repository (microsoft/TypeScript, vitest-dev/vitest, dubzzz/fast-check, biomejs/biome, lovell/sharp, DefinitelyTyped, vitejs/vite, sveltejs/svelte, sveltejs/vite-plugin-svelte, sveltejs/language-tools, microsoft/playwright, fontsource/font-files x2, lucide-icons/lucide), with the expected maintainers, existing since 2012 to 2023, and with no preinstall, install or postinstall scripts. The three ASSUMED names (@fontsource-variable/nunito 5.3.0, @fontsource-variable/caveat 5.3.0, lucide-static 1.56.0) exist under the expected publishers. All 14 were approved, none dropped. TypeScript pinned to 6.0.3 (svelte-check lags on TS 7) was disclosed and accepted.
- Task 2 installed exactly the approved packages at the approved versions, with no substitution. `pnpm install` printed no build-script or lifecycle-script activity. `pnpm-lock.yaml` is committed.

## Accomplishments

- Greenfield pnpm workspace with typecheck (tsc for the packages, svelte-check for Svelte), Biome lint, Vitest and Playwright (phone = iPhone 13 emulated, desktop = 1280x800) all green from a frozen lockfile.
- Pure `packages/engine` topology (exits 0/18/36/54, entries 70/16/34/52, `ringIndex`, `forwardCells`, `pawnMoved`) importable both by Vite and by plain Node 22.
- Board geometry by detection: `calibrate.mjs` reproduces RESEARCH Appendix B within 0.1 unit (72 cells, `exitsAndEntriesOk` true, pitch 122.7 to 144.8), writing `layout.json`; `build-board.mjs` composites the four quarters (art only placed and scaled) into `plateau-{640,1280,2560}.webp`.
- One `hopTimeline` drives both the WAAPI mover and arc animations and the Web Audio clops (`scheduleClops` on the AudioContext clock, same 60 ms lead), with `MIN_CLOP_GAP_MS` and 6 unit tests on the invariants.
- Production bundle contains no `__tocDebug` (checked with grep: 0 occurrences), and the source has no `{@html}` or `innerHTML`.

## Task Commits

1. **Task 1: package legitimacy checkpoint** - resolved by Romain (« approuvé »), no commit
2. **Task 2: tracer** - `e3641dc` (feat)

**Plan metadata:** committed right after this file (docs: complete plan)

## Files Created/Modified

- `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.base.json`, `biome.json`, `vitest.config.ts`, `.gitignore` - workspace scaffold
- `packages/engine/src/{topology,events,index}.ts` - pure topology and the `pawnMoved` event
- `packages/board/layout.json`, `src/{layout,hopTimeline,index}.ts`, `src/hopTimeline.test.ts` - calibrated geometry, `LAYOUT`/`placeXY`, the single timing source and its tests
- `tools/calibrate-board/calibrate.mjs`, `tools/build-board.mjs` - detection and board composite
- `apps/web/src/{App,routes/Launch,routes/Game,board/Board,board/Knight}.svelte` - router, launch screen, game screen, board and knight
- `apps/web/src/{board/animator,game/director,audio/engine,audio/synth,debug,main,i18n/fr/launch}.ts`, `app.css` - animation, event queue, Web Audio, debug switch, entry, strings, styles
- `apps/web/{package.json,tsconfig.json,vite.config.ts,svelte.config.js,index.html,playwright.config.ts}`, `e2e/tracer.spec.ts` - app config and the tracer spec

## Decisions Made

- `packageManager: pnpm@10.34.7`: pnpm 10.28.0 switched itself to it during install, so no fallback to 10.28.0 was needed.
- Biome keeps its default double-quote style; its `recommended` preset field was migrated to `preset: recommended` with `biome migrate` (Biome 2.5.15 deprecation notice).
- `packages/engine/tsconfig.json` includes `scenarios`, created with a `.gitkeep` so the include path exists for plan 01-03.
- The knight is drawn from the Appendix C silhouette without the mane ticks (known weakness of the draft), with an eye and nostril added; acceptance sizes 17/39/90 px remain a visual review for a later plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Tracer spec asserts the animation duration before waiting for data-ring = 4**
- **Found during:** Task 2 (e2e design)
- **Issue:** The plan lists "wait for data-ring = 4" then "assert a running or finished animation lasts 799 ms". After landing, the Director commits the new place and the animator cancels the mover animation (otherwise the fill-forwards offset would double the static anchor move), so no 799 ms animation is left in `document.getAnimations()` once data-ring is 4.
- **Fix:** The spec waits (`waitForFunction`) for an animation with a 799 ms effect duration right after the click, then waits for data-ring = 4, then checks the scheduled offsets. Same three assertions, in the order that the real lifecycle allows.
- **Files modified:** `apps/web/e2e/tracer.spec.ts`
- **Verification:** both Playwright projects pass
- **Committed in:** `e3641dc`

**2. [Rule 3 - Blocking] Director and animator signatures extended for lock-step start**
- **Found during:** Task 2 (director, animator)
- **Issue:** The plan asks for the audio `t0 = now + 0.06` "from the same t0 as the WAAPI start", but a WAAPI animation started "now" begins on the next frame, not 60 ms later, so the clops would lag the hops by about 45 ms. The plan's `createDirector({ animator, audio, placeOf })` also gave no way to move the static anchor after the hop.
- **Fix:** `animator.hop(mover, arc, points, timeline, leadMs)` passes `delay: leadMs` to both animations (duration unchanged, still 799), `createDirector` takes a fourth `commit(pawn, place)` dependency, and `animator.ts` exports `clear(mover, arc)` which Game.svelte calls right after `flushSync()` so the anchor move and the animation drop land in the same task (no flicker).
- **Files modified:** `apps/web/src/board/animator.ts`, `apps/web/src/game/director.ts`, `apps/web/src/routes/Game.svelte`
- **Verification:** e2e passes; `data-ring` goes 0 to 4 and the scheduled offsets equal `hopTimeline(4).clops`
- **Committed in:** `e3641dc`

**3. [Rule 2 - Missing Critical] Voice cap and debug history in the audio engine**
- **Found during:** Task 2 (audio engine)
- **Issue:** The plan's `scheduleClops` had no polyphony bound (UI-SPEC and RESEARCH say to steal the oldest voice); a 26-clop gallop in a later plan would otherwise be unbounded.
- **Fix:** Cap of 24 live voices, oldest stopped first; debug mode also records every call in `window.__tocDebug.audio.history` (the spec reads `.scheduled`, the last call).
- **Files modified:** `apps/web/src/audio/engine.ts`, `apps/web/src/debug.ts`
- **Committed in:** `e3641dc`

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 missing critical)
**Impact on plan:** All three are small, local, and keep every must-have truth intact. No scope creep.

### Environment and process notes (not code deviations)

- The commit trailer names Sonnet 5.5, following the attribution reminder the session supplied, instead of the "Opus 5.5" line in the orchestrator's environment notes.
- Playwright uses the planned path `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (verified present), so no executablePath deviation was needed.

## Issues Encountered

- After a mouse click the knight group shows a thin focus outline rectangle (SVG `<g role="button">` gets `:focus-visible` in Chromium). Cosmetic, left for the UI plan that builds halos and focus styling.
- `pkill -f` on the preview server killed the executor's own shell once (the pattern matched the command line); no repo impact.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None. The tracer trigger (a tap on the blue knight enqueues one `pawnMoved`) is an intentional placeholder, replaced by the engine-driven card to cheval to « Jouer » flow in plan 01-16; the event, Director, animator and audio contracts stay as built.

## Threat Flags

None. T-01-SC mitigated (Task 1 gate, exact pins, lockfile committed). T-01-02 mitigated (`__TOC_DEBUG__` compile-time switch; production bundle has no `__tocDebug`; plan 01-02 adds the geometry-overlay dist check).

## Verification Results

- `pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint && pnpm exec vitest run packages/board && pnpm --filter @toc/web exec playwright test e2e/tracer.spec.ts`: exit 0 (6 Vitest tests passed, 2 Playwright tests passed: phone and desktop).
- `node tools/calibrate-board/calibrate.mjs`: prints `{"exitsAndEntriesOk":true,"pitchMin":122.7355286785371,"pitchMax":144.82769072245816}`, regenerates a byte-identical `layout.json`.
- `layout.json` ring length 72 (node check exits 0); `import('./packages/engine/src/topology.ts')` under plain Node exits 0 with `ENTRY.bleu === 70` and `EXIT.vert === 54`.
- `pnpm --filter @toc/web exec svelte-check --tsconfig ./tsconfig.json`: 109 files, 0 errors, 0 warnings.
- Flagged assumption A-01 confirmed: headless Chromium reaches AudioContext state `running` after the Playwright click.
- Tracer feedback gate: the tracer carries only an automated `<verify>` (no `blocking-human`, `human_verify_mode` end-of-phase), so `<verify>` was re-run end to end and passed: tracer verified end-to-end, expansion may proceed. Real-device iOS audio stays in plan 01-24.

## Next Phase Readiness

- Plan 01-02 can harden the board slice (calibration invariants as tests, srcset variants, loading and error states, debug overlay, typography and raw-HTML guards) on top of `LAYOUT`, `Board.svelte` and `layout.json`.
- Fonts (Nunito, Caveat) and `lucide-static` are installed but not yet wired; `index.html` and `app.css` use the system-ui fallback.
- `packages/engine/scenarios/` exists (with `.gitkeep`) for plan 01-03.

## Self-Check: PASSED

- All key files exist on disk (checked below with `[ -f ]`), commit `e3641dc` is an ancestor of HEAD, and `plan_head_before`/`plan_head_after` were measured from the on-disk ledger.

---
*Phase: 01-une-vraie-partie-sur-un-appareil*
*Completed: 2026-10-13*
