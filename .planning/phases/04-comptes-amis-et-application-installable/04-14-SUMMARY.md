---
phase: 04-comptes-amis-et-application-installable
plan: 14
subsystem: engine
tags: [gap, house-rule, g18, engine, rules, protection, saved-games, tdd]
status: complete

requires:
  - phase: 01
    provides: "the engine's single movement path (walk, exitWalk, swapEnds, isProtected), RULES.md and its scenario pictures, rules-trace"
  - phase: 02
    provides: "the table snapshot in the GameRoom Durable Object (storage.ts load/commit) and copyTable, the normaliser of old snapshots"
provides:
  - "G18 EXIT_ONLY_PROTECTION: only the knight just out of its stable is protected on its own losange, until it moves"
  - "Pawn.justOut on ring pawns (true from exitWalk, false at every walk end and both swap ends), read by isProtected"
  - "defaultJustOut and upgradeState: a state saved without the flag or the switch is read and upgraded with the tolerant default"
  - "copyTable upgrades table.game and drops a computer's pending decision made under the old rule; load() returns copyTable"
  - "PROTOCOL_VERSION 6"
  - "RULES.md R-12 rewritten, G18, G3 replaced, scenarios R-12.9 (redrawn), R-12.11, R-12.12, R-12.13 with pictures"
  - "04-UAT.md test 62"
affects: [phase-04-verification, bots, rules]

estimate:
  tokens: 45000
  tasks: 4
actuals:
  tokens: 30400
  tasks: 4
  commits: 8
plan_head_before: 887f0ed4470886aceed64c9de779a72549be574b
plan_head_after: 964b7bf99e9fb922975bb05018db4fa3e9cbaf5e

tech-stack:
  added: []
  patterns:
    - "A per-pawn rule fact the position cannot tell lives on the pawn, written explicitly by every engine path that builds a ring pawn; an absent field means « saved before » and gets a documented default"
    - "Old saves are upgraded in one place (upgradeState), called by the table normaliser (copyTable) and by the Durable Object's load()"

key-files:
  created:
    - packages/engine/test/protection.test.ts
    - docs/regles/R-12.11.webp
    - docs/regles/R-12.12.webp
    - docs/regles/R-12.13.webp
  modified:
    - packages/engine/src/types.ts
    - packages/engine/src/rules.ts
    - packages/engine/src/path.ts
    - packages/engine/src/moves.ts
    - packages/engine/src/seven.ts
    - packages/engine/src/scenario.ts
    - packages/engine/src/state.ts
    - packages/engine/scenarios/prises-maison.ts
    - packages/engine/test/props/invariants.test.ts
    - packages/engine/test/helpers.ts
    - packages/engine/test/path.test.ts
    - packages/engine/test/flags.test.ts
    - packages/engine/test/entry.test.ts
    - packages/engine/test/seven.test.ts
    - packages/engine/test/turn.test.ts
    - packages/engine/test/props/sevenOutcomes.test.ts
    - packages/table/src/table.ts
    - packages/table/src/resume.test.ts
    - apps/worker/src/storage.ts
    - apps/worker/test/resume.test.ts
    - apps/worker/test/*.test.ts (hello v 6)
    - packages/protocol/src/frames.ts
    - packages/protocol/src/frames.test.ts
    - packages/bots/src/evaluate.ts
    - packages/bots/src/teamplay.test.ts
    - RULES.md
    - docs/regles/R-12.9.webp
    - .planning/phases/04-comptes-amis-et-application-installable/04-UAT.md

key-decisions:
  - "The flag is `justOut?: boolean` on the ring pawn. The engine always writes it (exitWalk true; walk ends and both Valet ends false; an eaten knight goes back to { zone: stable }), so « absent » only ever means a pawn saved before G18 or a hand-written fixture"
  - "The tolerant default for a pawn without the flag: protected iff on its own losange at progress 0 (defaultJustOut). isProtected applies it at read time too, so even an un-upgraded view or state is read the same way"
  - "upgradeState fills every rule switch missing from an old state.rules from DEFAULT_RULES: a game saved before G18 plays G18 from now on (Romain's rule is a correction of the house rule, not a table option)"
  - "The GameRoom snapshot carries no version field (table_json as is), so no version was bumped there; old snapshots are handled by copyTable, which load() now runs. The Durable Object migration tag v1 is untouched"
  - "PROTOCOL_VERSION 5 → 6: a page with the old engine would read every knight on its 18 as protected and hide legal moves; CLOSE_VERSION makes it reload"
  - "A computer's pending decision (thought, checkpoint, play time) stored in an old snapshot is dropped by copyTable, so it decides again under G18 (a stale decision could be illegal now, and a failed apply in the alarm would retry the same thought)"
  - "Own knight on the losange, protected or ordinary, still makes a second exit impossible: decided by Romain on 2026-10-19 (« Garde le blocage »), recorded in RULES.md (R-06, R-12, G18) and scenario R-12.13"
  - "G3 (PROTECTED_AFTER_EXTRA_LAP) stays as a switch, read only when EXIT_ONLY_PROTECTION is false, following the G17/G2 pattern"
  - "Scenario fixtures: `{ p: 0 }` keeps meaning the knight just out (scenarioState and the test helper write defaultJustOut), so R-12.1 to R-12.8 and R-12.10 are unchanged"

requirements-completed: [RULE-12, RULE-20]

coverage:
  - id: D1
    description: "Just out with an As or a Roi: protected, nobody passes, lands on or swaps it; stays protected over a whole round of the other seats and its partner knight's move; loses it on its first move"
    requirement: RULE-12
    verification:
      - kind: unit
        ref: packages/engine/test/protection.test.ts
  - id: D2
    description: "Ordinary on its own losange after a lap (passed by a 3, eaten by a 2, swapped by the Valet, eaten in passing by a 7), after a missed entry, after a Valet swap, after a 4 back"
    requirement: RULE-12
    verification:
      - kind: unit
        ref: packages/engine/test/protection.test.ts
      - kind: scenario
        ref: "R-12.9, R-12.11, R-12.12"
  - id: D3
    description: "Own knight on the losange, protected or ordinary, blocks a second exit"
    requirement: RULE-12
    verification:
      - kind: unit
        ref: packages/engine/test/protection.test.ts
      - kind: scenario
        ref: "R-12.7, R-12.13"
  - id: D4
    description: "Old saves: upgradeState, copyTable on a table, a Durable Object snapshot rewritten in the old shape and reloaded (welcome view carries the flag)"
    verification:
      - kind: unit
        ref: packages/table/src/resume.test.ts
      - kind: integration
        ref: apps/worker/test/resume.test.ts
  - id: D5
    description: "Property invariants over 200 games: explicit flag on every ring knight, protected only when just out and unmoved, every exit protected, ordinary knights on their own losange occur"
    verification:
      - kind: property
        ref: packages/engine/test/props/invariants.test.ts
---

# Phase 4 Plan 14: Seul le cheval qui vient de sortir est protégé sur son 18 (G18) Summary

**G18 in the engine: a per-knight `justOut` flag set on exit and cleared by any move or swap; only that knight is protected on its own losange; old saved games are upgraded with the default « protected iff on its own losange at progress 0 ».**

## Performance

- **Started:** 2026-10-19T13:59:48Z
- **Completed:** 2026-10-19T14:58:00Z
- **Tasks:** 4
- **Commits:** 8 (plus this summary)

## What changed

- **Engine.** `Pawn` on the ring gains `justOut?: boolean`. `exitWalk` writes `true`; every `walk` end and both `swapEnds` write `false`; an eaten knight goes back to the stable. `isProtected` reads the flag under the new switch `EXIT_ONLY_PROTECTION` (G18, with Romain's words in `rules.ts`), and a missing flag falls back to `defaultJustOut` (progress 0). Every rule that uses protection already went through `isProtected` (passing in `ringStretch`, the 4, the 7 steps, landing, the Valet's target and played knight, G4 blocking via `protectorOf`, exits), so all of them follow G18. The 7's memo key now carries the flag. `upgradeState` (state.ts) makes an old state explicit.
- **Saved games.** `copyTable` runs `upgradeState` on `table.game` and, for a snapshot from before G18, drops a computer's pending decision so it decides again. `storage.ts load()` now returns `copyTable(snapshot)`, so the cached snapshot the Durable Object builds frames from is upgraded as well. A test rewrites a real Durable Object snapshot in the old shape, evicts it, and checks the stored table and the welcome view.
- **Protocol.** `PROTOCOL_VERSION` 6.
- **Bots.** `evaluate.ts` already used the engine's `isProtected` (no inference from position); only its comments changed. The bots' `determinize` copies pawns with the flag.
- **RULES.md.** R-12 rule and cas limites rewritten; R-06 notes; G18 dated 2026-10-19 with the four answers; G3 marked replaced; Q14 note. R-12.9 redrawn (an ordinary knight back on its 18 after a lap is passed, eaten and swapped); new R-12.11 (Valet), R-12.12 (4 backwards), R-12.13 (own ordinary knight still blocks a second exit). `node tools/rules-trace.mjs --images`: **OK (16 règles, 125 scénarios)** (122 before). Only the four R-12 pictures changed when every picture was rendered again; all four looked at.

## How old saved games are handled

- A ring pawn without `justOut` is read as protected iff it stands on its own losange at progress 0, both at read time (`isProtected`) and when upgraded (`upgradeState`).
- A state whose `rules` lacks `EXIT_ONLY_PROTECTION` (or any other switch) gets the validated values of `DEFAULT_RULES`: an online game saved before the deploy continues under G18. A knight sitting on its 18 since it came out stays protected until it moves; a knight that was back there after a lap becomes ordinary.
- The GameRoom snapshot has no version field, so none was bumped; `copyTable` is the upgrade path and `load()` now runs it. The DO migration tag v1 is unchanged.
- Local saves: the web app keeps no game state in local storage (only the list of tables, the device token and settings); solo games are created fresh by the engine. The debug « etat » loader builds states through `scenarioState`, which writes the flag.

## Gate (all green, run one after another after the last commit)

| Gate | Result |
|------|--------|
| `pnpm typecheck && pnpm lint && pnpm test` | 0 errors; Biome 376 files clean; Vitest 116 files, **1 866 passed, 2 skipped** (1 846 at 04-13 + 20 new; the same 2 engine skips) |
| Full local Playwright | **459 passed, 99 skipped, 0 failed** (7.2 min), as in 04-13 |
| Online Playwright (`playwright.online.config.ts`) | **108 passed, 0 failed** (8.9 min) |
| PWA Playwright | **10 passed** (34.3 s) |
| `node tools/selfplay.mjs --games 200` | 200 games finished, mean 777.5 actions, max 1 482 (11.2 s) |
| `node tools/rules-trace.mjs --images` | OK (16 règles, 125 scénarios) |
| Ports 8787, 4173, 4174 | nothing listening afterwards |

## TDD Gate Compliance

- RED `cbead40` (14 failing tests: the G18 cases and the table snapshot) before GREEN `23dc35d`.
- RED `88c3d9f` (the stale computer decision) before GREEN `964b7bf`.
- `f865539` (the Durable Object snapshot test) was written after GREEN as a regression lock of the load path; it passed on first run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] A computer's decision stored before G18 is made again**
- **Found during:** Task 4 (review of what an old snapshot carries)
- **Issue:** `table.thinking` may hold a decision or a search checkpoint computed under the old protection; under G18 it could be illegal (a 7 may now have to bring a knight home), and the alarm's retry would replay the same thought.
- **Fix:** `copyTable` drops `thought`, `checkpoint` and `playAt` of a pending think when the snapshot predates G18.
- **Files modified:** packages/table/src/table.ts, packages/table/src/resume.test.ts
- **Commits:** 88c3d9f, 964b7bf

**2. [Rule 3 - Blocking] Test expectations of ring pawns**
- About sixty `toEqual({ zone: "ring", progress: N })` expectations in the engine, bots and worker tests now carry `justOut` (the engine writes the flag explicitly); the engine test helper `board()` writes `defaultJustOut` like `scenarioState`. The worker tests send `hello` with v 6.

**3. Test file placement**
- The table-level snapshot tests went into the existing `packages/table/src/resume.test.ts`; a Durable Object level test was added in `apps/worker/test/resume.test.ts` (not in the plan's file list).

**4. 04-UAT.md summary counts**
- The summary said `passed: 0` while tests 3 and 60 pass; it now reads total 62, passed 2, pending 60.

## Decided with Romain (2026-10-19)

- Own knight on the losange, protected or ordinary, still blocks a second exit: « Garde le blocage ». Recorded as decided in RULES.md (R-06, R-12, G18) and scenario R-12.13.

## To check with Romain

- UAT test 62: G18 in a real game after the next deploy.
- Online games saved before the deploy switch to G18 (they do not keep the old rule until they end). A knight already back on its 18 after a lap in such a game becomes ordinary at once.

## Known Stubs

None.

## Next

Deploy (not done here), then Romain plays UAT 62.

## Self-Check: PASSED

- Files: protection.test.ts, R-12.11/12/13.webp, 04-14-PLAN.md present.
- Commits a2cd24e, cbead40, 23dc35d, f865539, 52d326f, 0aeef12, 88c3d9f, 964b7bf are ancestors of HEAD.
