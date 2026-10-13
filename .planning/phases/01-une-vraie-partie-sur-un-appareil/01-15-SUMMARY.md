---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 15
subsystem: game-session
tags: [controller, bots, director, render-state, turn-reducer, debug-params, svelte5, vitest]

requires:
  - phase: 01-14
    provides: "randomLegal(view, seat, rng) -> [Action, Rng], @toc/bots workspace package"
  - phase: 01-13
    provides: "renderInit/renderReduce/renderOf, playability, nextSteps"
  - phase: 01-12
    provides: "apply, legalActions, resolveMove, IllegalActionError"
  - phase: 01-10
    provides: "newGame, scenarioState, viewFor, sfc32 rng (next, shuffle)"
  - phase: 01-08
    provides: "director/animator contract (hopTimeline, anchorOf, facingFor, partsOf)"
provides:
  - "createGame (GameController.ts): local session with CSPRNG seeds, three horse-named level-1 bots paced like humans, human actions only through submit()"
  - "parseDebugParams (debugParams.ts): allow-listed scenario / etat / graine / vitesse=test, debug builds only"
  - "createDirector (director.ts): ordered event queue folding renderReduce, shared hop timeline for animation and clops, snapToEnd and hidden-tab fast-forward"
  - "reduceTurnUi / initialTurnUi / turnCtx (turnUi.ts): pure card -> knight -> preview -> confirm reducer with exchange and dead hand"
  - "createSession / loadDebugParams (session.svelte.ts): $state.raw view, render and ui for the game screen"
affects: [01-16, 01-17, 01-18, 01-19, 01-21, 01-22, 02-rooms]

actuals:
  tokens: 25000
  tasks: 2
  commits: 4
plan_head_before: ede8f58283d8c4161b183771b85e56f742449893
plan_head_after: a45921d5dac9b8749f8756974ecb9e0250e3b857

tech-stack:
  added: []
  patterns:
    - "The controller is the shell the Phase 2 Durable Object replaces: apply() for every action, viewFor() for every bot, events handed to a director with enqueue/idle"
    - "Bot think delay is drawn from the bot rng stream (no clock, no global random source) and read again at every step so the fast-forward switch acts at once"
    - "Turn reducer is pure: reduceTurnUi(state, event, ctx) returns { state, submit?, hint? }; only confirm, give and pose can submit"
    - "Preview = resolveMove(view, seat, action), the engine's own code, with the pawn tap mapped to the engine's candidate (a stable knight stands for the exit, A-11)"
    - "Director folds renderReduce after the animation of each event, then calls commit; hidden tab, snapToEnd and test mode apply events without motion or sound"
    - "Debug-only parser is loaded by a dynamic import inside an `if (__TOC_DEBUG__)` branch of loadDebugParams"

key-files:
  created:
    - apps/web/src/game/GameController.ts
    - apps/web/src/game/GameController.test.ts
    - apps/web/src/game/botNames.ts
    - apps/web/src/game/debugParams.ts
    - apps/web/src/game/debugParams.test.ts
    - apps/web/src/game/director.test.ts
    - apps/web/src/game/turnUi.ts
    - apps/web/src/game/turnUi.test.ts
    - apps/web/src/game/session.svelte.ts
  modified:
    - apps/web/src/game/director.ts
    - apps/web/package.json
    - pnpm-lock.yaml

key-decisions:
  - "createGame has an explicit start(): the session wires the Director and the listeners first, then starts the bot loop; submit() before start() applies the action but runs no bot"
  - "seed and botSeed are optional in createGame and default to randomSeed() (crypto.getRandomValues, four Uint32 words each); a debug graine fixes both, the bot seed being derived by botSeedFrom"
  - "The first dealer is drawn from the bot rng stream, so the human does not always start"
  - "speed may be a function, read before every bot step, so the persisted « Avance rapide » switch applies immediately"
  - "A scenario or etat makes the scenario's turn seat the human (humanSeat), shared by the session (board rotation) and the controller"
  - "Director keeps the plan-01-08 deps quarterTurns / facingOf / commit; the plan's `k` and `human` are not needed. initial? plus reset(view) give the render state; renderState is null until a view is given, so the plan-01-08 tracer screen keeps working unchanged"
  - "Director order per moving event is animate, fold, commit (render state updated before the screen clears the animation), the reverse of the tracer's order, which has no render state"
  - "Preview carries a structured description (verb, pawn, steps, entersHome) and the hint is the engine Reason code; the French sentences stay in i18n (plan 01-16)"
  - "The sync event has no payload: the reducer reads the context (view, playability, legal) from its third argument, built by turnCtx(view, seat)"
  - "Tapping a stable knight with the As or Roi selects the engine's exit candidate whichever stable knight of his colour was tapped"

requirements-completed: []

coverage:
  - id: D1
    description: "A local game runs through the engine: seeded from crypto.getRandomValues, three distinct horse-named bots, bots act after a 700-1300 ms think (200-300 fast, 0 test) with viewFor only, clockwise order, whole game to a winner"
    requirement: RULE-04
    verification:
      - kind: unit
        ref: "apps/web/src/game/GameController.test.ts#bots: think delay and view-only play (D-18)"
        status: pass
      - kind: unit
        ref: "apps/web/src/game/GameController.test.ts#plays a whole game of bots and human random moves to the end"
        status: pass
    human_judgment: false
  - id: D2
    description: "Nothing is played for the human: the turn, the give and the dead-hand discard wait indefinitely for submit(); an illegal submit changes nothing"
    requirement: RULE-16
    verification:
      - kind: unit
        ref: "apps/web/src/game/GameController.test.ts#human: nothing is played for him (D-19, D-20)"
        status: pass
      - kind: unit
        ref: "apps/web/src/game/turnUi.test.ts#with exactly one legal move nothing is played for him (D-19)"
        status: pass
      - kind: unit
        ref: "apps/web/src/game/turnUi.test.ts#a dead hand is laid down only on his pose (D-20)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Preview equals resolveMove (same path, same captured knights), partner capture flagged; unplayable card gives the hint of its reason and keeps the state"
    requirement: PLAY-02
    verification:
      - kind: unit
        ref: "apps/web/src/game/turnUi.test.ts#the preview is the engine's own resolveMove (PLAY-02)"
        status: pass
      - kind: unit
        ref: "apps/web/src/game/turnUi.test.ts#tapping an unplayable card"
        status: pass
    human_judgment: false
  - id: D4
    description: "Director processes events strictly in order, renderState after idle() equals renderOf(viewFor(state, human)), hidden tab / snapToEnd apply the queue at once with no sound"
    verification:
      - kind: unit
        ref: "apps/web/src/game/director.test.ts#Director: order and animation"
        status: pass
      - kind: unit
        ref: "apps/web/src/game/director.test.ts#Director: snapToEnd and hidden tabs (Pitfall 11)"
        status: pass
      - kind: unit
        ref: "apps/web/src/game/director.test.ts#Director: the render state equals the view projection"
        status: pass
    human_judgment: false
  - id: D5
    description: "Debug parameters are parsed only in debug builds and only when they pass the allow-list, length and shape checks"
    verification:
      - kind: unit
        ref: "apps/web/src/game/debugParams.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "session.svelte.ts wires controller, Director and reducer into $state.raw values for the screen"
    verification:
      - kind: other
        ref: "pnpm typecheck (svelte-check) passes; the store is first exercised by plan 01-16's screen and e2e"
        status: pass
    human_judgment: true
    rationale: "A Svelte rune store cannot run under the node test environment; its behaviour (view, render, ui following the controller and the Director, board locked until idle) is proven by plan 01-16's end-to-end tests."

duration: 13min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 15: Le contrôleur de partie, le metteur en scène et l'interaction du tour Summary

**A whole local game now runs through the engine as tested logic: `createGame` paces three horse-named level-1 bots like humans (700-1300 ms, bots see only `viewFor`, seeds from `crypto.getRandomValues`), the Director folds `renderReduce` event by event and snaps to the end on a hidden tab, and a pure reducer turns card, knight, preview and confirm into a single submitted action without ever playing for the human.**

## Performance

- **Duration:** about 13 min
- **Started:** 2026-10-13T19:01Z
- **Completed:** 2026-10-13T19:14Z
- **Tasks:** 2
- **Files:** 10 created or changed in `apps/web/src/game/`, plus `apps/web/package.json` and `pnpm-lock.yaml`

## Accomplishments

- `GameController.ts`: `createGame({ human, seed?, botSeed?, speed?, scenario?, director })` returns `{ human, names, view(), submit(), onChange(), stats(), thinking(), start(), dispose() }`. Bot step: wait for `director.idle()`, draw the think delay from the bot rng (normal `700 + 600u`, fast `200 + 100u`, test `0`), then `randomLegal(viewFor(state, bot), bot, botRng)` and `apply`. In the exchange the bots give one at a time; in play the bot whose turn it is acts. `submit()` is the only way the human acts; `IllegalActionError` becomes `{ ok: false, error: "illegal" }` with state, listeners and director untouched. `stats()` gives `{ dealsPlayed, captured: { nous, eux } }`.
- `botNames.ts`: Tornado, Jappeloup, Bucéphale, Ourasi, Marengo, Pégase, Comanche, Rossinante; three distinct names are drawn per game by a seeded shuffle, the human is « toi ».
- `debugParams.ts`: `parseDebugParams(hash, { debug? })` accepts `scenario` (id matching `R-NN.k` that exists), `etat` (base64url JSON, at most 4096 characters, strict key and shape check: known keys only, four specs per colour, integer progress within 1000, no duplicate card, no two knights on one cell or home slot, at most 5 cards per hand), `graine` (32 hex characters) and `vitesse=test`; each parameter is judged on its own and a release build parses nothing.
- `director.ts` extended: ordered queue (`enqueue`, `idle`, `snapToEnd`, `reset`, `onRender`, `renderState`, `dispose`), `renderReduce` after each event, one `hopTimeline(n, mode)` per `pawnMoved` / `pawnEnteredHome` feeding both `animator.hop` and `audio.scheduleClops`, modes normal / fast / reduced (a single 180 ms slide) / test (no motion), `visibilitychange` to hidden calls `snapToEnd()` and `pauseAmbience()`, visible resumes.
- `turnUi.ts`: states waiting, idle, finishedPrompt, cardSelected, preview, exchange, exchangeWaiting, deadHand, posed, empty; events sync, tapCard, tapPawn, confirm, cancel, changeCard, escape, selectGive, give, pose.
- `session.svelte.ts`: `createSession(env, debug)` builds Director, controller and reducer and exposes `view`, `render`, `ui`, `hint`, `thinking` as `$state.raw` values replaced as wholes; `ui` is synced only once the Director is idle (the board stays locked during animation); `loadDebugParams(hash)` loads the parser by a dynamic import inside an `if (__TOC_DEBUG__)` branch.

## Task Commits

1. **Task 1 RED: controller and debug parameter tests** - `8134ae0` (test)
2. **Task 1 GREEN: controller, bot names, debug parameters, `@toc/bots` dependency and lockfile** - `e848cfd` (feat)
3. **Task 2 RED: Director and turn reducer tests** - `0b16eb4` (test)
4. **Task 2 GREEN: Director, turn reducer, session store** - `a45921d` (feat)

**Plan metadata:** the docs commit that adds this file.

## Verification

- `pnpm install --frozen-lockfile`: passes; `git diff` of `pnpm-lock.yaml` is 3 lines, only the `@toc/bots` workspace link (T-01-SC: no external package).
- `pnpm exec vitest run apps/web/src`: 11 files, 177 tests, all pass (game folder: 4 files, 85 tests). `pnpm test` (whole repo): 26 files, 458 passed, 2 skipped (the alt scenarios R-09.9 and R-15.9), 0 failed.
- `pnpm typecheck` (tsc and svelte-check, 0 errors) and `pnpm lint` (biome, 109 files): pass.
- Acceptance greps: `getRandomValues`, `randomLegal(`, `viewFor(` in GameController.ts; `renderReduce` in director.ts; `resolveMove(` in turnUi.ts: all present. A test also asserts the controller source contains neither the global random source nor the clock.
- Regression: `playwright test e2e/tracer.spec.ts e2e/table.spec.ts --project=desktop` still passes (15 tests), so the plan-01-08 tracer screen works with the extended Director.

## Decisions Made

See `key-decisions`. In short: explicit `start()`, CSPRNG default seeds with a debug `graine` override, speed read per bot step, and a Director that keeps its plan-01-08 deps while adding the render-state fold.

## Deviations from Plan

None in the sense of Rules 1-4: no bug fix, no blocker, no architectural change. Interface details that differ from the plan's wording, all additive or naming:

- **Director deps:** the plan wrote `createDirector({ animator, audio, human, k, getMode })`. The plan-01-08 contract is `quarterTurns` (kept, not renamed to `k`) with `facingOf` and `commit`; `human` is not needed by the Director. Added `getMode`, `initial?` (with `reset(view)`), optional `animator.finish(pawn)`, optional `audio.pauseAmbience/resumeAmbience`, optional `document`. `renderState` is `RenderState | null` so the tracer screen, which gives no view, is unaffected.
- **Controller:** explicit `start()` (see key-decisions), optional seeds, function-valued `speed`, plus `thinking()` and the helpers `randomSeed`, `botSeedFrom`, `humanSeat`, `thinkDelay`. The first dealer is drawn from the bot rng stream.
- **Turn reducer:** `sync` carries no payload (the context is the third argument, built by `turnCtx`); `preview` also keeps the card's `candidates` so a tap on another knight switches the preview; `description` is a structured object instead of a French sentence (the copy belongs to i18n in plan 01-16).
- **Debug parser:** takes the hash and `{ debug }` and returns resolved objects (`scenario` is the fixture, `etat` the `before` block).

**Total deviations:** 0 auto-fixed. **Impact:** none on scope; every behaviour in the plan's `<behavior>` blocks is covered by a test.

## Issues Encountered

- The first RED commit of task 2 went in with a biome complaint (a test variable named `escape` shadowed the global); fixed in the GREEN commit. Nothing else.

## Known Stubs

None. `session.svelte.ts` is not imported by any screen yet: that is the plan's slice (plan 01-16 puts the game on screen), not a stub.

## Threat Flags

None. T-01-19 (debug parameters), T-01-20 (human actions validated by `apply`), T-01-21 (CSPRNG seeds) and T-01-22 (bots get `viewFor` only) are mitigated and covered by tests: `debugParams.test.ts`, the illegal-submit tests, the `getRandomValues` spy and the `randomLegal` call-argument test.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Notes for plan 01-16 and later:

- Create the screen's session with `createSession({ animator, facingOf, commit }, debug)`; call `session.start()` after the screen is mounted. `animator.hop` is the existing `hop(partsOf(els[pawn]), ...)`; implement the optional `animator.finish(pawn)` as `getAnimations().forEach(a => a.finish())` on the pawn's three groups so a hidden tab can end a running hop at once.
- `commit` is now called after `render` has been updated (animate, fold, commit): place pawns from `session.render.pawns`, and in `commit` only keep the facing, `flushSync()` and clear the animation.
- Load debug parameters with `await loadDebugParams(location.hash)` before `createSession`.
- Messages: `session.hint` is an engine `Reason` code (UI-SPEC keys) or `"illegal"` (« Ce coup n'est pas permis. Choisis-en un autre. »); `ui.kind === "preview"` carries `description`, `path`, `captured`, `partnerCapture`.
- As and Roi: a stable knight means « Sortir », a ring knight « Avancer »; the 7 and the Valet are selectable but yield no candidate until plans 01-18 and 01-21.
- Bot pacing: a bots-only game is about 990 actions (01-14), so at 1 s per bot move a long run of bot turns is normal; the « Avance rapide » switch (`settings.fast`) takes effect on the next bot step.
- RULE-04 and RULE-16 were already complete in REQUIREMENTS.md; PLAY-01 and PLAY-02 stay pending until the screen of plan 01-16 shows the highlighted cards and the preview, so `requirements-completed` is left empty here.

---
*Phase: 01-une-vraie-partie-sur-un-appareil*
*Completed: 2026-10-13*

## Self-Check: PASSED

Created files exist (GameController.ts, botNames.ts, debugParams.ts, turnUi.ts, session.svelte.ts and the four test files in `apps/web/src/game/`); commits `8134ae0`, `e848cfd`, `0b16eb4` and `a45921d` are in the branch history; `git rev-list --count` from `ede8f58` gives 4.
