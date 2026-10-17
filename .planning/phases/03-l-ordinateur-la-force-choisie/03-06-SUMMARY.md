---
phase: 03-l-ordinateur-la-force-choisie
plan: 06
subsystem: web-ui
tags: [bots, thinking-sign, reduced-motion, bench, lazy-route, playwright]

requires:
  - phase: 03-l-ordinateur-la-force-choisie
    provides: "03-05: session.thinking, createInlineRunner; 03-04: benchPositions; 03-03: Segmented wrap / disabled"
provides:
  - "app.css: @keyframes respire / respire-texte, .respire, .respire-texte, .respire-mark, switched by .still and prefers-reduced-motion"
  - "InfoBar thinking prop (row, column, pill, and the sheet's copy); ActionZone thinking giver row; data-thinking test hook"
  - "Bench.svelte at #/banc (lazy chunk, linked from nowhere), i18n/fr/banc.ts, game/benchStats.ts"
  - "e2e/reflexion.spec.ts, e2e/banc.spec.ts"
affects: [03-07 recette (à confirmer 4, 7, 8; Romain runs #/banc on his iPhone), phase-2 online table (thinking sign reusable)]

actuals:
  tokens: 11200
  tasks: 2
  commits: 2
plan_head_before: 7a7096ee1fdb995e8db6bddc8e2106bd4aa7c031
plan_head_after: 6c140968793747a67b93c6fcc2e1a40bf409f393

tech-stack:
  added: []
  patterns:
    - "A breathing element is wrapped in its own inline-flex box (.glyph, .giver-icon) so the scale has a centre and never shifts the layout"
    - "Lazy route: {#await import('./routes/Bench.svelte') then bench}<bench.default />{:catch}rethrow to the error boundary"
    - "A bench run is cancelled by bumping a run id and cancelling the runner; a ThinkCancelled rejection is not an error"

key-files:
  created:
    - apps/web/src/routes/Bench.svelte
    - apps/web/src/i18n/fr/banc.ts
    - apps/web/src/game/benchStats.ts
    - apps/web/src/game/benchStats.test.ts
    - apps/web/e2e/reflexion.spec.ts
    - apps/web/e2e/banc.spec.ts
  modified:
    - apps/web/src/app.css
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/ui/ActionZone.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/App.svelte

key-decisions:
  - "The turn row breathes only when thinking === render.turn and is not the human (the bot loop waits for the director to be idle before thinking, so they agree)"
  - "In the exchange the givers row of the thinking bot breathes only while it has not given"
  - "The bench yields one task (setTimeout 0) between two decisions, as the game's pace does; otherwise levels 1 to 4 would run all 40 decisions in one task and the frozen-frame number would measure the bench, not the game"
  - "benchPositions() is computed once, after « Coup 1 sur 40 » is painted and before the frame watch starts: its few hundred ms are not counted"
  - "No warm-up pass: the first decision is cold, as in a real game"
  - "A run stopped with « Arrêter la mesure » is judged on what it measured; an interrupted run is not (03-UI-SPEC)"
  - "Each decision uses the bench tool's first-repeat rng [1, i × 104729 + 3, i + 5, 0x9e3779b9], so every device measures the same work"

requirements-completed: [BOT-05]

coverage:
  - id: D1
    description: "While a bot thinks, its giver row (exchange) and its turn line (bar, pill) breathe with the animation « respire », the name fading (« respire-texte »), the « … » hidden; nothing breathes on the player's turn"
    requirement: BOT-05
    verification:
      - kind: e2e
        ref: "apps/web/e2e/reflexion.spec.ts (phone and desktop)"
        status: pass
    human_judgment: false
  - id: D2
    description: "With prefers-reduced-motion or « Réduire les animations », animation none and the « … » mark shown"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/reflexion.spec.ts#quand le système… / quand « Réduire les animations »…"
        status: pass
    human_judgment: false
  - id: D3
    description: "The sign does not shift the bar, the pill or the givers"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/compact.spec.ts, apps/web/e2e/ecrans.spec.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "#/banc: empty state, Champion run with progress, five rows, verdict, copy; stop keeps the measured decisions; hidden page interrupts with no verdict; copy failure shows the toast and the « Mes résultats » box; the launch screen never loads the Bench chunk"
    requirement: BOT-05
    verification:
      - kind: e2e
        ref: "apps/web/e2e/banc.spec.ts"
        status: pass
      - kind: unit
        ref: "apps/web/src/game/benchStats.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Whether the breath is discreet but noticeable, and the Champion's numbers on Romain's real iPhone (UI-SPEC à confirmer 4, 7, 8)"
    requirement: BOT-05
    verification: []
    human_judgment: true
    rationale: "No real phone in this environment; Romain runs #/banc and watches a game in 03-07"

duration: 30min
completed: 2026-10-15
status: complete
---

# Phase 3 Plan 06: Le signe « réfléchit » et le banc d'essai de l'ordinateur Summary

**While a computer player thinks, its sign breathes gently: the turn glyph in the bar, the phone pill's turn part, and its hourglass in the exchange givers. The name only fades. With reduced motion a fixed « … » shows instead. The hidden page `#/banc` times every level on the 40 fixed bench positions through the game's own sliced runner. It gives the median, p95, max and the longest frozen frame, a verdict against 1 s / 2 s / 100 ms, and « Copier les résultats ».**

## Performance

- **Duration:** about 30 min (12:04 to 12:34 UTC)
- **Tasks:** 2 (tracer + auto)
- **Files:** 11 (6 created, 5 modified)

## Accomplishments

- `app.css`: `@keyframes respire` (scale 1 → 1.12, opacity 1 → 0.7 → 1), `respire-texte` (opacity only), `.respire` / `.respire-texte` at 1600 ms ease-in-out infinite, and `.respire-mark` (Label 14 / 700, `--creme-attenuee`, hidden by default). Under `.still` or `prefers-reduced-motion: reduce` the animations are `none` and the mark shows. There are no transitions, so the sign starts at rest and stops at once.
- `InfoBar`: a `thinking` prop, passed on to the sheet's column copy. In the row and column forms, the glyph chip sits in a `.glyph` box that breathes and carries `data-thinking`. « Tour de » and the name fade, and a `.respire-mark` follows the name. In the pill, `.pill-turn` breathes, and the mark follows the glyph chip, set at 16 px line height. `class:still` is on both roots. The sign never shows on the human.
- `ActionZone`: the thinking bot's giver row (`!done && color === thinking`) gets the hourglass in a breathing `.giver-icon` box, the name fading, and the mark. This holds in the desktop zone and the compact prompt row, and `class:still` is on the zone.
- `Game.svelte`: `thinking={session.thinking}` is passed to `InfoBar`.
- `Bench.svelte` (#/banc, its own 9 kB chunk) has the header « Retour » and the title, then the intro. Below them are « Force mesurée » and the five-level `Segmented` (default Champion, disabled while running, wrapped under 416 px). Next comes « Lancer la mesure », which becomes « Arrêter la mesure » while running, then « Coup i sur n » with a progressbar named « Avancement de la mesure ». The result card shows the empty state, or « Résultats » with five `dl` rows, the verdict with a check or x icon, « Copier les résultats », and the read-only « Mes résultats » box when the copy fails. The other states are « Mesure arrêtée après i coups. », « Mesure interrompue : … » with no verdict, and the error heading, body and « Recharger la page ». The page reads no game, session or setting.
- `game/benchStats.ts`: `percentile` (nearest rank, the same as `tools/bench-bots.mjs`), `resultsOf`, `fastEnough`, and the named thresholds `VERDICT_P95_MS` 1000, `VERDICT_MAX_MS` 2000 and `VERDICT_FROZEN_MS` 100.
- `i18n/fr/banc.ts`: every bench string, `ms()` (« 1 240 ms » with U+202F), and `resultsText()` (the 8 copied lines, U+00A0 before « : »).

## Measured in Chromium on this machine (Champion, 40 decisions)

| Viewport | p50 | p95 | max | longest frozen frame | verdict |
|----------|-----|-----|-----|----------------------|---------|
| 1280 × 800 | 42 ms | 171 ms | 363 ms | 32 ms | Assez rapide |
| 844 × 390 (iPhone 13 emulation) | 36 ms | 182 ms | 309 ms | 43 ms | Assez rapide |

A whole Champion run takes about 6 s here.

## Screenshots

Saved in `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/`:
- the thinking sign: `03-06-reflexion-1280x800-{echange,tour,tour-zoom}.png`, `03-06-reflexion-844x390-{echange,tour,tour-zoom}.png`, and the reduced-motion « … » in `03-06-reflexion-still-1280x800-{echange,tour,tour-zoom}.png` and `03-06-reflexion-still-844x390-{echange,tour,tour-zoom}.png`
- the bench: `03-06-banc-{1280x800,844x390}-{vide,mesure,resultats}.png`

## Task Commits

1. **Task 1 (tracer): le nom de l'ordinateur qui réfléchit respire** - `a6633e5` (feat). Tracer gate: its verify ran end to end (typecheck, lint, no-raw-html, reflexion + compact + ecrans 40 passed, 0 failed) before Task 2 started.
2. **Task 2: le banc d'essai #/banc** - `6c14096` (feat)

## Verification (end gate)

- `pnpm typecheck` OK (svelte-check 306 files, 0 errors). `pnpm lint` OK (180 files).
- `pnpm test`: 49 files, **933 passed, 2 skipped**, up from 927 / 2. The 6 new tests are 5 in benchStats.test.ts and the typography case for banc.ts.
- Playwright, Task 1: `reflexion.spec.ts` + `compact.spec.ts` + `ecrans.spec.ts` **40 passed, 0 failed, 32 skipped**. The skips are the existing `isMobile` guards of the explicit-viewport tests.
- Playwright, Task 2: `banc.spec.ts` + `launch.spec.ts` **17 passed, 0 failed, 7 skipped**. The skips are banc.spec's desktop-only runs in the phone project, plus its phone smoke in the desktop project.
- `node tools/rules-trace.mjs`: OK (16 règles, 122 scénarios). No `.animate(` call in apps/web/src/board outside frameClock.ts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Spec expectation] The bot's turn comes after the player's move**
- **Found during:** Task 1 (first reflexion.spec run)
- **Issue:** with the spec's seed the player plays first after the exchange, so no bot's turn follows the exchange directly.
- **Fix:** the turn test reaches the player's turn and checks that nothing breathes. It then plays one simple move, catches the bot's breathing turn line, and checks again on the player's next turn.
- **Commit:** a6633e5

**2. [Rule 1 - Bench correctness] One task boundary between two bench decisions**
- **Found during:** Task 2 (design)
- **Issue:** levels 1 to 4 end in one runner step, so 40 awaited decisions would run in one task. The « Plus longue image figée » would then measure the bench loop, not the game, where the pace always separates two decisions.
- **Fix:** `setTimeout(0)` between decisions. It is outside the timed interval.
- **Commit:** 6c14096

### Other notes

- I added a small pure helper outside the plan's file list, `apps/web/src/game/benchStats.ts`, with its unit test, so that the verdict thresholds and the percentile are tested at their bounds. Only Bench.svelte imports it, so it lives in the bench chunk.
- « Mesure arrêtée après {i} coups. » says « coup » for 0 or 1, which is French grammar. The e2e stops after 2 or more decisions.
- The « Coups mesurés » row is a count. The other four rows end in « ms », and banc.spec checks both.
- I did not edit STATE.md, ROADMAP.md, REQUIREMENTS.md or WINDOWS.md (the orchestrator owns tracking).

## Known Stubs

None.

## Threat Flags

None new. T-03-14 is mitigated: Bench.svelte imports only @toc/bots, the runner, the catalogues, Segmented, Icon and the toast, with no session, game or settings store. T-03-15 is accepted: the user agent is copied only on a tap. T-03-16 is accepted: the lazy chunk is asserted not to load on `/`, and the runner is sliced, stoppable and stops when hidden. T-03-SC: no package was added.

## Self-Check: PASSED

- Created files exist: Bench.svelte, banc.ts, benchStats.ts, benchStats.test.ts, reflexion.spec.ts, banc.spec.ts.
- Commits a6633e5 and 6c14096 are ancestors of HEAD.
