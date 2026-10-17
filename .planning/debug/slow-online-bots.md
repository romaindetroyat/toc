---
status: resolved
trigger: "« Les ordinateurs sont beaucoup trop lents quand on joue à deux joueurs humains » — 2 humans + 2 computers (Galopeur or below), production, a computer turn takes more than 15 s"
created: 2026-10-17
updated: 2026-10-17
---

## Current Focus

hypothesis: confirmed (see reasoning_checkpoint and Resolution)
bug_class: Bohrbug (deterministic given production's exact-time alarm delivery)
test: production check after a deploy (this session may not deploy): `NODE_USE_ENV_PROXY=1 node probe.mjs https://toc.romaindetroyat.workers.dev bleu jaune 20 300` (scratchpad/slowbots), every computer turn should take 0.3–2 s plus the animation
expecting: no turn on a 60 s grid any more
next_action: none (resolved, verified in production on 2026-10-17; Romain's check on real phones is UAT test 6 of 02-UAT.md)

reasoning_checkpoint:
  hypothesis: "A computer's play deadline playAt is fractional; the runtime arms the alarm at floor(playAt) and production runs it with Date.now() == floor(playAt), so the tick finds playAt still ahead, does nothing, and GameRoom re-sets the same truncated time; an unchanged alarm time is no write and no request to the alarm service, so the alarm is dropped until the platform's ~60 s rescan. A computer made due « at once » inside an alarm handler (the next computer, every Champion slice) is armed at that same time too."
  confirming_evidence:
    - "production computer turns: 9 of 11 take ~60 s and end on a 60.02 s grid; local real pace 1.2–3.2 s"
    - "production whole-ms alarms (pause minute) run at exactly their time (late 0 ms 4 times in 5, 2 ms once); local 1–6 ms late"
    - "workerd: setAlarm(x.837) is stored and delivered as x (scheduledTime x); ActorSqlite::setAlarm of an unchanged time writes nothing; the clamp comment calls alarm-time uniqueness « required for correctness »"
    - "workerd test with production's delivery (Date.now() == scheduledTime, an alarm left at its own time dropped): stalls at seq 3, rouge thinking, deadline 1792257059060.1294 (fractional)"
  falsification_test: "a workerd test that runs every alarm with Date.now() == scheduledTime and plays 2 people + 2 Galopeurs at the real pace: if computers still moved within 3 s + animation before the fix, the hypothesis would be wrong (they stall)"
  fix_rationale: "GameRoom arms whole ms rounded up (the alarm never sits below its deadline) and, while an alarm handler runs, never arms at or before that alarm's scheduledTime (scheduledTime + 1 at least), so every handler leaves a changed alarm the runtime schedules"
  blind_spots: "the ~60 s recovery is the platform's (inferred from the 60.02 s grid, not documented); the fix is verified in workerd with production's delivery emulated and locally, not in production (no deploy allowed here)"
  candidate_causes:
    - "code: fractional playAt vs whole-ms alarms (confirmed)"
    - "code: re-arming the running alarm's own time for « due at once » deadlines (confirmed: mutant M2 stalls at seq 4, vert due inside rouge's alarm)"
    - "environment: alarms delivered early by a lagging clock (eliminated: production runs them at exactly their time)"
    - "config: Free-plan CPU limit on decisions (eliminated: DO CPU limit is 30 s per request, and a retry would fall back in ~2 s, not 60 s)"
  and_gate: "yes: the stall needs the fractional deadline AND production's exact-time delivery (local delivery 1–21 ms late hides it); the arm() cache only keeps a lost alarm lost within the instance (and setAlarm of the same time would be a no-op anyway)"

## Symptoms

expected: a Galopeur (or lower) computer seat plays 0.3–2 s after it becomes due, plus the previous move's animation time (pace.ts, bots.ts thinkTick: playAt = dueAt + waitMs + paceFor)
actual: with 2 humans + 2 computers on production (toc.romaindetroyat.workers.dev), each computer turn waits more than 15 s
errors: none reported
reproduction: online table, 2 humans seated, 2 computers at Galopeur or below, start, wait for a computer turn
started: seen by Romain on real phones on production (phase 2 online table)

## Eliminated

- hypothesis: waitMs (eventsDuration of the last batch) is huge
  evidence: bounded by the motion table; seen 0–2250 ms in both probes; local turns are on pace with the same values
  timestamp: 2026-10-17

- hypothesis: the client waits for animations or keeps « réfléchit » stuck
  evidence: the Node probe has no UI and sees the server's events frame itself ~60 s late, with the server's now in the table frame
  timestamp: 2026-10-17

- hypothesis: alarms are delivered early because the object's clock lags the alarm service
  evidence: production whole-ms alarms run with Date.now() exactly at their time (0 ms, 4 of 5), never before
  timestamp: 2026-10-17

- hypothesis: Free-plan CPU limit kills Galopeur decisions
  evidence: Durable Objects get 30 s CPU per request (saved limits page); a failed alarm retries after ~2 s with the level-1 fallback, not 60 s on a fixed grid
  timestamp: 2026-10-17

## Evidence

- timestamp: 2026-10-17
  checked: local repro, wrangler dev (clean worktree at 27b6362, server code identical to HEAD) on port 8799 without TOC_TEST_MODE, probe scratchpad/slowbots/probe.mjs, 2 humans (bleu, jaune) + rouge/vert Galopeur
  found: computer turns 1.190–3.190 s from the frame that made them due (e.g. seq 13 3.190 s with 2163 ms of animation before it); run-before-1.log
  implication: the real pace works when alarms come on time; the bug is not in pace/waitMs

- timestamp: 2026-10-17
  checked: production probe, table 0WZxsLTToEg61gGQJGFM9g, same setup (run-prod-1.log)
  found: computer turns 20.3, 60.0, 60.0, 60.0, 59.2, 60.0, 59.6, 2.64, 2.21, 54.8, 59.6 s; every slow turn ends on a fixed grid 22.781, 82.802, 142.827, 202.848, 262.868, 322.893, 382.917, 442.944, 502.961 s (period 60.02 s), whatever made the computer due (a socket message or an alarm)
  implication: in production the alarm meant to play the computer is usually not delivered; something wakes the object every ~60 s and then it plays at once

- timestamp: 2026-10-17
  checked: workerd sources (actor-sqlite, actor-state, alarm-scheduler)
  found: setAlarm() of an unchanged time writes nothing and requests nothing from the alarm scheduler, yet cancels the deferred delete; after a successful run the scheduler forgets the alarm; the JS clamp comment says alarm times must be unique « which is required for correctness »; the local scheduler waits until clock >= scheduled time because « timer.now() was behind the real time by a few ms, leading to premature alarm() execution »
  implication: an alarm handler that re-sets the time it was fired for loses the alarm; locally alarms are never early, so this path is never taken in tests

- timestamp: 2026-10-17
  checked: pause-probe.mjs, the pause's minute (choiceAt public, a whole-ms deadline) answered « wait » 5 times in production, 3 times locally
  found: production lateness srvNow - choiceAt = 2, 0, 0, 0, 0 ms (the handler's Date.now() is exactly the alarm's time 4 times in 5); local 5, 6, 1 ms
  implication: whole-ms future alarms work in production; production runs an alarm with Date.now() == its scheduled time, locally a few ms later

- timestamp: 2026-10-17
  checked: workerd test (throwaway): setAlarm(Date.now() + 300.837), getAlarm(), the alarm's AlarmInvocationInfo
  found: getAlarm() 1792256813444 for a request of 1792256813444.837 (truncated to the ms); alarm() gets { scheduledTime: 1792256813444 }; locally Date.now() at delivery was 21 ms later; the test isolate and the GameRoom share Date.now and the class
  implication: a fractional deadline is armed at the ms below it; delivered at that ms (production) the deadline is still 0.837 ms in the future

- timestamp: 2026-10-17
  checked: packages/table/src/bots.ts thinkTick / scheduleBot, packages/bots pace.ts, packages/board motion.ts
  found: playAt = dueAt + eventsDuration(...) + paceFor(...) is fractional (paceFor = (450 + 1550 d) × (0.9 + 0.2 u), SINGLE_SPAN_MS × u; eventsDuration seen 1834.5714285714284); botTick plays only when now >= deadline.at and thinkTick only when now >= playAt
  implication: at production delivery (now == floor(playAt)) the tick does nothing, GameRoom.arm() re-sets playAt, the runtime stores floor(playAt) again = the alarm being run: no write, no request to the alarm service, deferred delete cancelled → the alarm is dropped; the computer waits for the platform's ~60 s rescan

- timestamp: 2026-10-17
  checked: the « due at once » deadlines armed from an alarm handler (next computer after a computer's move: dueAt = now; Champion slices: dueAt in the past, clamped by setAlarm to Date.now())
  found: with production's Date.now() == scheduledTime, both resolve to the alarm's own time
  implication: second instance of the same loss: once the play is fixed, rouge → vert (and every Champion slice) would re-arm the running alarm's time

- timestamp: 2026-10-17
  checked: apps/worker/test/pace.test.ts before the fix (production delivery emulated: Date.now() reads scheduledTime in the handler, an alarm the handler leaves at scheduledTime is deleted)
  found: both production cases stall at seq 3 (rouge's give in the exchange, as rouge's first give in production), deadline fractional; the workerd-delivery case passes
  implication: reproduction of the production stall in workerd (RED, d2d0912)

- timestamp: 2026-10-17
  checked: pace.test.ts after the fix (25f3753), 3 runs; revert check; mutants M1–M3
  found: 3/3 green each run; revert brings the seq-3 stall back; M1 and M2 killed, M3 survived and was dropped from the fix
  implication: each kept part of the fix is needed and sufficient in workerd with production's delivery

## Resolution

root_cause: "A computer's play time (playAt = dueAt + eventsDuration + paceFor) is fractional, alarms are whole ms (truncated), and production runs an alarm with Date.now() exactly at its scheduledTime. The play alarm came at floor(playAt): the tick found the play 0.x ms ahead, did nothing, and GameRoom.arm() set the same truncated time again, which is no write and nothing scheduled, so production dropped the alarm until its rescan about 60 s later. Same loss for a computer made due at once inside an alarm (rouge then vert, the exchange's gives, every Champion slice): its deadline resolved to the running alarm's own time."
fix: "apps/worker/src/GameRoom.ts: arm() rounds the deadline up to a whole ms, and while an alarm handler runs (this.firing = alarmInfo.scheduledTime) never arms at or before that alarm's time (firing + 1 at least)."
oracle_type: derived (the pace contract of packages/bots pace.ts: a turn within CHOICE_CEILING_MS + 1 s of the animation of the batch that made it due, the Champion within HARD_CAP_MS + 1 s)
verification:
  reproduction_before: "pace.test.ts production cases: stalled at seq 3, rouge thinking, deadline 1792257059060.1294 / 1792257074091.3528 (15 s without a move); workerd-delivery case passes (1.2–2.2 s)"
  fixed_after: "pace.test.ts 3/3 passed, 3 runs in a row; production delivery Galopeur turns 0.65–2.98 s (budgets 3.3–4.9 s), Champions 0.66–3.36 s with a 60-slice decision"
  revert: "unfixed GameRoom with the final test: 2 failed (stalled at seq 3), 1 passed"
  mutation: "M1 no Math.ceil: killed (stall seq 3, fractional deadline); M2 no firing + 1: killed (stall seq 4, vert due inside rouge's alarm); M3 max(Date.now(), scheduledTime) in run: survived, so it was removed from the fix"
  gate: "pnpm typecheck OK; pnpm lint OK (282 files); vitest --project worker 11 files 33 tests passed; vitest node packages/table + packages/bots 20 files 234 tests passed"
  local_probe: "wrangler dev :8799, 2 people + 2 Galopeurs, real pace: before 1.19–3.19 s, after 0.99–2.59 s (workerd delivery never showed the bug)"
  production_probe_before: "table 0WZxsLTToEg61gGQJGFM9g: 20.3, 60.0, 60.0, 60.0, 59.2, 60.0, 59.6, 2.64, 2.21, 54.8, 59.6 s"
  production_probe_after: "run on the live site after the deploy (2026-10-17): the probe measured computer turns of 0.6–1.3 s, no turn on the 60 s grid any more"
  production_smoke: "tools/smoke-online.mjs on https://toc.romaindetroyat.workers.dev after the deploy: longest computer wait 2.4–2.8 s across the runs"
  guardrail_verdict: accepted (verified in production)
files_changed: [apps/worker/src/GameRoom.ts, apps/worker/test/pace.test.ts]
commits: [d2d0912 RED, 25f3753 GREEN]
