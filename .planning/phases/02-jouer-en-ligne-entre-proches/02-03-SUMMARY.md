---
phase: 02-jouer-en-ligne-entre-proches
plan: 03
status: complete
subsystem: online-table
tags: [bots, champion, durable-objects, alarms, free-plan, pace, sqlite, workerd, playwright]

requires:
  - phase: 02-jouer-en-ligne-entre-proches
    provides: "02-01 pure table core (reduce, tick, bot deadline) and GameRoom; 02-02 leak oracle"
  - phase: 03-l-ordinateur-la-force-choisie
    provides: "@toc/bots createThinker / chooseAction, the Champion's search (search.ts), the bench positions"
provides:
  - "@toc/bots: paceFor, hardCap, the pace constants and Speed (moved from apps/web); BOT_NAMES already there since 02-01"
  - "@toc/bots: Search.checkpoint() / Thinker.checkpoint() (JSON, compact actions) and createThinker(..., from) to resume a Champion think without scoring the root again"
  - "@toc/table bots.ts: SLICE_UNITS, FALLBACK_LEVEL, scheduleBot, thinkTick, stillDue, speedOf; Table.thinking (PendingThink); Command tick { retry }; LogEntry.bot { level, slices, fallback }"
  - "@toc/protocol parseCreateTestOptions: creation test options { pace, levels } (TOC_TEST_MODE only)"
  - "GameRoom.alarm(alarmInfo) passes isRetry; events log column `bot`; storage.commit returns rows written"
  - "tools/bench-bots.mjs --slice N"
  - "apps/web/e2e-online/ordinateurs.spec.ts; online.ts createTable(test with levels)"
affects: [02-04, 02-05, 02-06, 02-07, 02-10]

tech-stack:
  added: []
  patterns:
    - "Decide first, play at dueAt + eventsDuration(last batch) + paceFor(thought, u): the online table and the local game share one pace"
    - "A long computation of the Durable Object runs one bounded slice per alarm invocation, its JSON checkpoint stored with the snapshot, the next slice due at once"
    - "A retried alarm (alarmInfo.isRetry) makes the cheap decision instead of the costly one, and the log says so"

key-files:
  created:
    - packages/bots/src/pace.ts
    - packages/bots/src/pace.test.ts
    - packages/bots/src/resume.test.ts
    - packages/table/src/bots.ts
    - packages/table/src/bots.test.ts
    - apps/worker/test/bots.test.ts
    - apps/web/e2e-online/ordinateurs.spec.ts
  modified:
    - packages/bots/src/search.ts
    - packages/bots/src/thinker.ts
    - packages/bots/src/index.ts
    - apps/web/src/game/pace.ts
    - apps/web/src/game/GameController.ts
    - tools/bench-bots.mjs
    - packages/protocol/src/frames.ts
    - packages/protocol/src/frames.test.ts
    - packages/table/src/table.ts
    - packages/table/src/reduce.ts
    - packages/table/src/reduce.test.ts
    - packages/table/src/frames.ts
    - packages/table/src/index.ts
    - packages/table/test/leak.test.ts
    - apps/worker/src/GameRoom.ts
    - apps/worker/src/index.ts
    - apps/worker/src/storage.ts
    - apps/web/src/net/remoteGame.test.ts
    - apps/web/e2e-online/online.ts

key-decisions:
  - "SLICE_UNITS = 5, one rollout (1 + CHAMPION_PLIES units), the finest step the search has: no slice size reaches the planned p95 ≤ 5 ms strictly (N 1 to 5 all measure p95 5.0 to 5.5 ms, one rollout through a hard 7 costs up to 20-30 ms); 5 is the size nearest the target with the fewest slices (57 per decision, at most 60)"
  - "Kept actions are stored as short strings (\"s 7H bleu0:3 bleu1:4\") in the checkpoint: plain JSON actions reached 5.9 KB on hard 7s, the compact form stays under 2.6 KB"
  - "Exchange gives are made one computer at a time in COLORS order (like the local game), so their staggering is their own think time (≥ 300 ms under the normal pace); a pending exchange decision survives a person's give (its base is \"exchange\", not the seq)"
  - "Under the zero test pace there is no wait, no think time and no hard cap (hardCap(\"test\")), so a workerd test is reproducible whatever the machine's load; the decision tick also plays"
  - "The events log gains a `bot` column (JSON { level, slices, fallback }), not in the plan's file list: it is where the fallback mark lives and how the workerd test counts slices per decision; nothing is deployed yet, so no migration is needed"
  - "remoteGame.ts needed no change: a table frame already updated the table and ran onChange; Task 3 added the test that pins it"

patterns-established:
  - "Server-only decision state lives in Table.thinking (PendingThink) and never reaches tablePublic except its seat"
  - "Workerd tests that act on frames wait by wall time (FRAME_WAIT_MS), not by poll count, because the whole suite runs CPU-heavy Node tests alongside"

requirements-completed: [NET-01]

coverage:
  - id: D1
    description: "Pace and horse names live in @toc/bots; the web game re-exports them and plays as before"
    requirement: NET-01
    verification:
      - kind: unit
        ref: "packages/bots/src/pace.test.ts (moved unchanged); apps/web/src/game/GameController.test.ts"
        status: pass
  - id: D2
    description: "A Champion think cut anywhere and resumed from a JSON checkpoint gives the one-go decision (40 bench positions x slices 1, 7, 30, 64); checkpoints JSON-safe, < 4 KB; no root scoring on resume"
    requirement: NET-01
    verification:
      - kind: unit
        ref: "packages/bots/src/resume.test.ts"
        status: pass
      - kind: manual
        ref: "node tools/bench-bots.mjs --level 5 --slice N (N 1 to 60, every sliced decision equal); self-play digests 5 vs 4 equal before/after and sliced/unsliced"
        status: pass
  - id: D3
    description: "Online computers decide first and play at dueAt + animation + pace; Champion one slice per tick, best move at HARD_CAP_MS; level-1 fallback on a retried alarm; deadlines re-checked"
    requirement: NET-01
    verification:
      - kind: unit
        ref: "packages/table/src/bots.test.ts"
        status: pass
      - kind: integration
        ref: "apps/worker/test/bots.test.ts (three Champions through a deal, levels 2-4 to gameWon, retried alarm)"
        status: pass
  - id: D4
    description: "Alone at an online table, a computer giver shows the « réfléchit » sign before its give is counted, and the person plays two turns with the computers in between"
    requirement: NET-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/ordinateurs.spec.ts (phone, desktop)"
        status: pass

estimate:
  tokens: 130000
actuals:
  tokens: 17115    # chars/4 of the added lines (68 461 characters), .planning excluded
  tasks: 3
  commits: 8       # git rev-list --count plan_head_before..HEAD before this SUMMARY: 7 of this plan + dc5c75c (the orchestrator's « update tracking after wave 2 », landed during the run)
plan_head_before: 4083bbfb97255b57a7854fb5a2173d2ff012826f
plan_head_after: f0e83db49a0ed0a2330b720b372aad60384c1a8a

duration: 60min
completed: 2026-10-17
---

# Phase 2 Plan 03: Les ordinateurs de la table en ligne Summary

**The three empty seats of an online table are computer players that decide first and play at the local game's natural pace, the Champion searching in 5-unit slices across alarms from a JSON checkpoint stored with the table (same decisions as unsliced), with a 2.5 s cap and a level-1 fallback on a retried alarm; the « réfléchit » sign shows online.**

## What was built

- **One pace** (`packages/bots/src/pace.ts`): `paceFor`, `hardCap`, the constants and `Speed` moved from apps/web; `apps/web/src/game/pace.ts` re-exports them, `GameController.ts` re-exports `Speed`. `pace.test.ts` moved unchanged (same 8 cases).
- **A resumable Champion** (`search.ts`, `thinker.ts`): `checkpoint()` = `{ kept (compact action strings), statics, candidates, firstAction, r (the rng before the deal in progress), spent, worlds, sums, partial }`; `createSearch(..., from)` skips `scoreCandidates`/`keptCandidates` and redraws the deal in progress with `determinize(view, seat, r)`. Levels 1 to 4 and the exchange return `null` and ignore `from`.
- **The computers in the core** (`packages/table/src/bots.ts`): `Table.thinking` = `{ seat, base (seq | "exchange"), level, dueAt, waitMs, checkpoint, slices, thought, playAt, fallback }`. The commit that makes a computer due arms its deadline at `dueAt` (decide first); the decision tick fixes the thought (one tick for levels 1-4 and every exchange, one `SLICE_UNITS` slice per tick for the Champion, best so far at `dueAt + HARD_CAP_MS`), draws `u` from the bot rng after `thought.rng`, sets `playAt = max(now, dueAt + waitMs + paceFor(thought, "normal", u))`; a later tick plays it. `retry` → `chooseAction(view, seat, 1, botRng)` and `fallback: true`. A deadline whose seq moved or whose exchange give is no longer missing plays nothing and is recomputed. `tablePublic.thinking = table.thinking?.seat ?? null`.
- **The Durable Object**: `alarm(alarmInfo)` → `{ t: "tick", retry: alarmInfo?.isRetry === true }`; the events log keeps `bot` (level, slices, fallback); `commit` returns rows written (`cursor.rowsWritten`).
- **Test options**: `parseCreateTestOptions` (strict zod/mini, levels 1-5 per colour) in @toc/protocol, used by the Worker only under TOC_TEST_MODE; `createTable` applies them to `table.levels`.
- **Online sign**: remoteGame already notified on every table frame; a test pins it. `ordinateurs.spec.ts` (phone, desktop): Ana alone with Champion (jaune), Galopeur (rouge), Pur-sang (vert) at the normal pace; after her give, a computer giver breathes (`data-thinking`, `data-done="false"`); two turns of hers with the computers in between, no error screen.

## Slice measurements (Task 1, `node tools/bench-bots.mjs --level 5 --slice N --repeat 3`, 40 bench positions, this machine, 2026-10-17)

ms per slice include creating the thinker from the previous checkpoint, the step and the checkpoint's JSON round trip. Every sliced decision equalled the one-go decision in every run.

| N (units) | p50 ms | p95 ms | max ms | slices per decision (mean / max) |
|-----------|--------|--------|--------|----------------------------------|
| 1  | 0.49 | 5.03 | 32.6 | 65.0 / 144 |
| 2  | 0.52 | 5.26 | 30.8 | 65.0 / 144 |
| 4  | 0.54 | 5.21 | 40.0 | 58.1 / 72 |
| **5 (chosen)** | **0.55** | **5.47** | **25.9** | **57.3 / 60** |
| 6  | 0.99 | 9.23 | 26.1 | 31.9 / 48 |
| 8  | 1.13 (1.10) | 9.84 (10.14) | 38.7 (44.5) | 29.9 / 36 |
| 16 | 2.15 | 16.90 | 59.5 | 15.0 / 18 |
| 30 | 3.63 (3.66) | 23.12 (23.17) | 59.8 (49.9) | 9.9 / 10 |
| 60 | 7.74 | 39.82 | 137.5 | 5.0 / 5 |

Breakdown at N 1 to 8: the first slice of a decision (root scoring of up to 56 candidates) p95 15-21 ms, max 35 ms; later slices p95 4.6-4.9 ms at N ≤ 5; a resume alone p95 0.05 ms, max 1.4 ms. The cost floor is one rollout (5 units); a rollout through a hard 7 (each ply's policy enumerates the 7's plans) costs up to 20-30 ms and cannot be cut without storing an imagined GameState in the checkpoint.

**SLICE_UNITS = 5.** No N meets the planned "largest N with p95 ≤ 5 ms" strictly; N 1 to 5 are the same granularity (one rollout per slice) within noise (5.0-5.5 ms), and 5 gives the fewest slices among them (≤ 60 = ceil(300 / 5)). The bench is adversarial (12 of 40 positions are hard 7s). Whether workerd on the Free plan tolerates these slices (and the 15-35 ms first slice, comparable to a level-4 decision, p95 ≈ 11 ms) is the deployed CPU check of 02-10; a retried alarm falls back to level 1 either way.

## Same decisions, sliced or not (prohibition: no change to the search's results)

- `resume.test.ts`: 40 bench positions × slices 1, 7, 30, 64, JSON round trip at every boundary → `toEqual(chooseAction(...))`.
- `bench-bots --slice N`: 120 decisions per N, all equal (N 1, 2, 4, 5, 6, 8, 16, 30, 60).
- Self-play digest (winner, actions, units and decisions of both teams per game), level 5 vs 4, ladder seed 1: **20 games, code before this plan (591ac84 sources) vs after: 17/20, 5 559 actions, 500 602 Champion units, digest cf2292f66c4c2524 on both**; 6 games unsliced vs sliced at 5 units with a JSON round trip at every slice: digest 2e48a9b7670fe02a on both. The phase-3 ladder results therefore stand unchanged.
- Online: `bots.test.ts` checks the Champion's online move equals `chooseAction(viewFor(game, seat), seat, 5, botRng)`.

## Rows written (D-11, T-02-13; Free plan 100 000 rows a day)

- Measured in workerd (`apps/worker/test/bots.test.ts`, `cursor.rowsWritten`): a snapshot commit = **1 row**; a commit with one log line = **2 rows**; each `setAlarm` = 1 row (billing rule).
- Per Champion decision under the test pace: (slices − 1) × 2 + 3 rows. In the workerd deal: 12 Champion decisions (3 searched), slices mean 14.8, max 60 → **mean 30.7 rows, max 121 rows per decision** (368 rows for the deal's Champion decisions). Under the normal pace add one play tick (snapshot + log + alarm).
- Per whole game, measured on the pure core with the GameRoom's commit/arm rules (one person playing randomLegal, normal pace): **three Champions ≈ 15 500 rows per game** (3 games: 14 663 to 16 784; 7 574 alarm ticks, 230 computer moves) → about **6 such games a day** on the Free plan; **three Galopeurs ≈ 1 375 rows per game** (10 games, 821 to 1 923) → about 70 a day. Under the zero test pace, Galopeurs ≈ 841 rows. Romain sees these figures at the UAT (a Paid plan or a coarser slice would cut the Champion's rows by up to 10×, see the table above).

## Verification

- `pnpm typecheck` exit 0; `pnpm lint` exit 0 (231 files).
- `pnpm test`: **63 files, 1 053 passed, 2 skipped** (baseline 1 024 + 29: resume 11, table bots 13, workerd bots 3, protocol 1, remoteGame 1; pace's 8 moved, not added), three consecutive full runs green after the wait fix.
- Online Playwright (`playwright.online.config.ts`, all specs): **6 passed** (fuite, tracer, ordinateurs × phone, desktop); ordinateurs alone 4/4 twice with `--repeat-each 2`.
- Local Playwright (full suite, includes reflexion.spec.ts, rythme.spec.ts and every spec using the pace or the bots): **416 passed, 96 skipped, 0 failed** (same as baseline).
- `node tools/rules-trace.mjs`: OK (16 règles, 122 scénarios).
- `node tools/bench-bots.mjs --level 5 --slice 30 --repeat 1`: exit 0, every sliced decision equal.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Checkpoint over 4 KB on hard 7s**
- **Found during:** Task 1 (resume.test.ts, slices of 64)
- **Issue:** with every capture and home entry kept on top of the best 6, a hard 7 keeps up to 32 candidates; their plain JSON actions made the checkpoint 5.9 KB.
- **Fix:** `encodeAction`/`decodeAction` (one short string per action, e.g. `s 7C vert0:1 vert1:6`); the largest checkpoint is now about 2.6 KB. A codec test covers all six action shapes.
- **Files:** packages/bots/src/search.ts, packages/bots/src/resume.test.ts
- **Commit:** 3328330

**2. [Rule 3 - Blocking] SLICE_UNITS rule unreachable as written**
- **Found during:** Task 1 step 5
- **Issue:** no slice size has p95 ≤ 5 ms strictly; the search's smallest step is one rollout.
- **Fix:** measured N 1 to 60 (table above) and chose 5 (one rollout, p95 5.47 ms, ≤ 60 slices); documented at the constant. The fallback on retry and the deployed check of 02-10 cover the remaining risk.
- **Files:** packages/table/src/bots.ts

**3. [Rule 2 - Missing] Fallback mark and slice count need a log column**
- **Found during:** Task 2
- **Issue:** the plan's log entry `{ fallback: true }` had no column to live in.
- **Fix:** `events.bot TEXT` (JSON `{ level, slices, fallback }`) in `apps/worker/src/storage.ts` (not in the plan's file list); `commit` returns rows written for the row measurement.
- **Commit:** f4f85da

**4. [Rule 1 - Bug] Existing reduce test encoded the old timing**
- **Found during:** Task 2
- **Issue:** `reduce.test.ts` expected the first computer deadline at `now + eventsDuration(deal)`; the plan changes it to decide first.
- **Fix:** the test now checks the decision is due at once and the play at or after the animation; tick commands carry `retry: false` in reduce.test.ts and leak.test.ts.
- **Commit:** 6b38fde

**5. [Rule 1 - Bug] The thinking sign in the exchange shows only after the person's give**
- **Found during:** Task 3 (first run of ordinateurs.spec.ts)
- **Issue:** the givers' list (where `data-thinking` lives in the exchange) replaces the prompt only in `exchangeWaiting`, after the person has passed a card.
- **Fix:** the spec passes Ana's card first, then waits for a computer giver breathing with `data-done="false"` (the computers' gives are staggered by their think times, so one is still choosing).
- **Commit:** e633c8b

**6. [Rule 1 - Bug] Spec flake: a move judged by the action zone**
- **Found during:** end gate (desktop, full online run)
- **Issue:** late in a deal the computers can have no card left, so the zone returns to « À toi » at once and "left the person's turn" never shows.
- **Fix:** the spec waits for the table on screen (knights, felt) to change instead.
- **Commit:** 8a29159

**7. [Rule 1 - Bug] Workerd test flake under the whole suite**
- **Found during:** end gate (`pnpm test`, 2 failures in 5 runs: "timed out waiting for Ana's events after her act")
- **Issue:** the wait was 4 000 polls of 2 ms; with the CPU-heavy Node tests (resume, ladder) running alongside, a frame could take longer.
- **Fix:** wait by wall time (60 s) and name the last frames on timeout; three full runs green after.
- **Commit:** f0e83db

### Other notes

- `tools/bench-bots.mjs` also checks each sliced decision against the one-go decision (exit 1 on a mismatch).
- Task 1 found BOT_NAMES already in @toc/bots (02-01); only pace.ts moved.
- The ledger's commit count includes dc5c75c (the orchestrator's tracking commit made during this run).

## Known Stubs

None.

## Threat Flags

None: the creation test options gain `levels` but stay behind TOC_TEST_MODE (T-02-07); the checkpoint and `bot` log column stay server-only (`tablePublic` exposes only the thinking seat).

## Self-Check: PASSED

- Files: packages/bots/src/pace.ts, packages/bots/src/resume.test.ts, packages/table/src/bots.ts, packages/table/src/bots.test.ts, apps/worker/test/bots.test.ts, apps/web/e2e-online/ordinateurs.spec.ts all present.
- Commits in history: 591ac84, 3328330, 6b38fde, f4f85da, e633c8b, 8a29159, f0e83db.
- Acceptance greps: `export function paceFor` in packages/bots/src/pace.ts, `BOT_NAMES` in names.ts, `checkpoint` in search.ts, `@toc/bots` in apps/web/src/game/pace.ts, `SLICE_UNITS` and `createThinker(` in packages/table/src/bots.ts, `isRetry` in GameRoom.ts, `data-thinking` in ordinateurs.spec.ts, `runDurableObjectAlarm` in apps/worker/test/bots.test.ts.
