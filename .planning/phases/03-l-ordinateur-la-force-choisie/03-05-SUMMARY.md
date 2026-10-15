---
phase: 03-l-ordinateur-la-force-choisie
plan: 05
subsystem: web-game
tags: [bots, pacing, runner, time-slicing, messagechannel, hard-cap, playwright]

requires:
  - phase: 03-l-ordinateur-la-force-choisie
    provides: "03-04: createThinker step/result (anytime level 5), Thought.difficulty and Thought.candidates, CHAMPION_BUDGET"
provides:
  - "apps/web/src/game/pace.ts: paceFor(thought, speed, u) and hardCap(speed), pure, named constants"
  - "apps/web/src/game/botRunner.ts: BotRunner, syncRunner, createInlineRunner (8 ms slices, MessageChannel yields, deadline, hidden page, cancel), ThinkCancelled"
  - "GameController: decide first, wait only the rest of the pace, drop a stale decision; CreateGameOptions.now and .runner"
  - "apps/web/e2e/rythme.spec.ts: think intervals measured in the browser"
affects: [03-06, 03-07, phase-2 durable object]

actuals:
  tokens: 12200
  tasks: 2
  commits: 2
plan_head_before: 077748da56bc86efc171a67e85ec715553f4f6fb
plan_head_after: 08f2ff001a686439570603f518f234a8832ea3c9

tech-stack:
  added: []
  patterns:
    - "The bot loop: idle -> due bot -> remember the state object -> thinking on -> start = now() -> await runner.think(deadline start + hardCap) -> u -> sleep(max(0, paceFor - elapsed)) -> idle -> play only if the state and the due bot are unchanged, else think again"
    - "The inline runner reads its clock once per step; a slice ends when 8 ms of that clock have passed, then it yields through one MessageChannel per think (closed when the think settles)"
    - "Node tests and tools keep the synchronous runner (the default), so a seeded game is the same on every machine; the test speed has no cap"

key-files:
  created:
    - apps/web/src/game/pace.ts
    - apps/web/src/game/pace.test.ts
    - apps/web/src/game/botRunner.ts
    - apps/web/src/game/botRunner.test.ts
    - apps/web/e2e/rythme.spec.ts
  modified:
    - apps/web/src/game/GameController.ts
    - apps/web/src/game/GameController.test.ts
    - apps/web/src/game/session.svelte.ts

key-decisions:
  - "The speed is read once the decision is made, so « Avance rapide » turned on during a think acts on that very step's wait; the cap is read when the think starts"
  - "A dropped decision keeps its rng advance (the bot's rng and the pace draw), so a seeded game stays reproducible"
  - "The hidden page finishes the remaining work synchronously but still stops at the deadline: the cap holds in every case"
  - "One runner step = one unit asked of the thinker = one Champion rollout; levels 1 to 4 end in one step"
  - "A cancelled think (dispose) is neither logged nor reported to the error screen"

patterns-established:
  - "Pace constants live in pace.ts only, named for the acceptance test with Romain (03-07)"

requirements-completed: [BOT-05]

coverage:
  - id: D1
    description: "paceFor follows the 03-UI-SPEC « Bot pacing » table: forced move 300-450 ms, real choice (450 + 1550 x difficulty) +-10 % <= 2000, fast a quarter <= 300, test 0; hardCap 2500 / 500 / none"
    requirement: BOT-05
    verification:
      - kind: unit
        ref: "apps/web/src/game/pace.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "The decision time counts inside the pace: played at max(decision, pace); a stale decision is dropped and remade; « Avance rapide » acts on the next step"
    requirement: BOT-05
    verification:
      - kind: unit
        ref: "apps/web/src/game/GameController.test.ts#bots: think time by the move, the decision counted inside it"
        status: pass
    human_judgment: false
  - id: D3
    description: "The inline runner yields between slices, ends slices at about 8 ms, stops at its deadline with a legal anytime move, finishes at once when hidden, stops on cancel; the controller passes the cap and cancels on dispose"
    requirement: BOT-05
    verification:
      - kind: unit
        ref: "apps/web/src/game/botRunner.test.ts"
        status: pass
      - kind: unit
        ref: "apps/web/src/game/GameController.test.ts#bots: the runner of the decision, its cap and its cancel"
        status: pass
    human_judgment: false
  - id: D4
    description: "In the browser, every think lasts <= 2.6 s at normal speed (Galopeurs and three Champions) and <= 0.7 s in « Avance rapide »"
    requirement: BOT-05
    verification:
      - kind: e2e
        ref: "apps/web/e2e/rythme.spec.ts (phone and desktop)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Whether the pace feels natural (constants to tune with Romain)"
    requirement: BOT-05
    verification: []
    human_judgment: true

duration: 19min
completed: 2026-10-15
status: complete
---

# Phase 3 Plan 05: Le rythme naturel — réfléchir selon le coup, calcul compris, avance rapide, jamais plus de quelques secondes Summary

**A computer player now decides first and then waits only what is left of a think time that depends on the move. A forced move takes 300 to 450 ms, and a delicate choice takes 450 + 1550 × difficulty ms (± 10 %, at most 2 s). « Avance rapide » takes a quarter of that, at most 300 ms. In the browser, the Champion searches in 8 ms slices separated by MessageChannel yields. A hard cap (2.5 s, or 0.5 s in « Avance rapide ») stops the search with its best move so far. A hidden page finishes the remaining work at once. A stale decision is never played, and leaving the game cancels the think.**

## Performance

- **Duration:** about 19 min (11:52 to 12:11 UTC)
- **Tasks:** 2 (tracer + auto)
- **Files:** 8 (5 created, 3 modified)

## Accomplishments

- `pace.ts`: `paceFor({ difficulty, candidates }, speed, u)` and `hardCap(speed)`. Both are pure and every constant is named (single 300 + 150 × u; base 450; span 1550; jitter ± 10 %; ceiling 2000; fast factor 0.25 with a 300 ceiling; caps 2500 / 500). A difficulty outside [0, 1], or NaN, is clamped. The header says the constants are tuned with Romain at the acceptance test.
- `GameController.ts`: `thinkDelay` is gone. The loop runs: idle → due bot → remember `state` → `setThinking(bot)` → `start = now()` → `await runner.think({ view: viewFor(state, bot), …, deadline })` → draw u → `sleep(max(0, paceFor(thought, speedOf(), u) − (now() − start)))` → idle → play only if `state` and `nextBot()` are unchanged, otherwise loop and think again. `CreateGameOptions` gains `now` (default `performance.now`) and `runner` (default `syncRunner`). `dispose()` calls `runner.cancel()`, and a cancellation is not reported.
- `botRunner.ts`: `syncRunner` wraps `chooseAction`. `createInlineRunner({ now, isHidden, sliceMs = 8 })` steps `createThinker` one unit at a time, reads its clock once per step, and ends a slice after 8 ms. It then yields through a MessageChannel, one channel per think, closed when the think settles. At each step the deadline is checked and `result()` is played once it passes. At a slice boundary, a hidden page finishes the work synchronously (still bounded by the deadline). `cancel()` rejects every pending think with `ThinkCancelled` and stops its stepping.
- `session.svelte.ts` passes `createInlineRunner({ now: () => performance.now(), isHidden: () => document.hidden })`.
- `rythme.spec.ts` (phone and desktop): a MutationObserver records each interval of « X réfléchit… » in the action zone. Three tests run it: normal speed (every interval ≤ 2600 ms, at least one ≥ 300 ms), « Avance rapide » (≤ 700 ms), and three Champions at normal speed (≤ 2600 ms).

## Task Commits

1. **Task 1 (tracer): un coup évident vite, un coup délicat jusqu'à 2 s, le calcul compté dedans** - `ee76eda` (feat)
2. **Task 2: l'écran ne se fige jamais : la recherche en tranches, le plafond, l'onglet caché** - `08f2ff0` (feat)

Tracer gate: Task 1's verify ran green end to end (vitest game, typecheck, lint, rythme.spec 4/4) before Task 2 started.

## Verification (end gate)

- `pnpm typecheck` OK (svelte-check 301 files, 0 errors). `pnpm lint` OK (175 files).
- `pnpm test`: 48 files, **927 passed, 2 skipped**, up from 903 / 2. The 24 new tests are 8 in pace.test.ts, 7 in botRunner.test.ts and a net 9 in GameController.test.ts (2 replaced, 6 pace/race cases added, 5 runner cases added).
- Playwright, named specs: `rythme.spec.ts` + `partie.spec.ts` **18 passed, 0 failed**. `animations`, `compact` and `ecrans` with `-g "échange"`: **8 passed, 0 failed, 4 skipped**. The skips are the existing project guards of the desktop-size tests in the phone project, not added here.
- Other specs that run the bots at natural pace, run because the pacing changed: `tourne`, `force`, `reglages`, `tracer` and `table` gave **124 passed, 8 skipped (existing guards), 0 failed**. `animations` and `sons` in full gave **90 passed, 0 failed**.
- `tools/rules-trace.mjs` and `tools/selfplay.mjs` were not re-run, because no file of packages/engine or packages/bots changed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test contract] The « second wait » exchange test**
- **Found during:** Task 1
- **Issue:** « reads the bot due after the second wait » expected vert's give to land at once after the hold was released. Under the plan's stale-decision rule, the human's give made meanwhile means vert's decision was made on an older state.
- **Fix:** the test now checks that the exchange does not complete at once on release, and that vert's new give completes it within its pace.
- **Commit:** ee76eda

**2. [Rule 1 - Spec expectation] At least 3 measured thinks, not 6**
- **Found during:** Task 1 (first rythme.spec run)
- **Issue:** the action zone says « réfléchit » only in the play phase's waiting states, not during the exchange, so only the bots between the player's two turns are measured.
- **Fix:** the spec expects at least 3 intervals. Each bound of the plan (≤ 2600 ms, ≥ 300 ms for one, ≤ 700 ms fast) is unchanged.
- **Commit:** ee76eda

### Other notes

- I added a third rythme test, with three Champions at normal speed (≤ 2600 ms), as browser evidence that the cap and the slicing bound the level-5 outliers that 03-04 recorded (up to ~2 s in full games).
- TDD order: the pace tests and the controller's runner tests failed first (missing module, 5 failing runner cases). botRunner.test.ts was written just after the runner module, so it was not run RED.
- I did not edit STATE.md, ROADMAP.md, REQUIREMENTS.md or WINDOWS.md (the orchestrator owns tracking).

## Known Stubs

None.

## Threat Flags

None new. T-03-12 is mitigated: 8 ms slices with MessageChannel yields, the hard cap, and a synchronous finish when hidden, with botRunner.test.ts asserting the yields, the deadline and the cancel. T-03-13 is mitigated: the thought is played only if the state object and the due bot are unchanged, and `apply` still validates it. T-03-SC: no package was added.

## Self-Check: PASSED

- Created files exist: pace.ts, pace.test.ts, botRunner.ts, botRunner.test.ts, rythme.spec.ts.
- Commits ee76eda and 08f2ff0 are ancestors of HEAD.
