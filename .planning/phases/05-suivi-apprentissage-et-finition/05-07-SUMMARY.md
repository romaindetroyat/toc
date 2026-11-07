---
phase: 05-suivi-apprentissage-et-finition
plan: 07
subsystem: results
tags: [solo, history, stats, pending-queue, localStorage, end-plank, playwright]
status: complete

requires:
  - phase: 05-suivi-apprentissage-et-finition
    plan: 01
    provides: foldTally / emptyTally, played and game_seats, GET /api/me/results, the history row (bot icon for solo)
  - phase: 05-suivi-apprentissage-et-finition
    plan: 03
    provides: createGame's script option (lessons only)
  - phase: 05-suivi-apprentissage-et-finition
    plan: 05
    provides: SoloReport / parseSoloReport, POST /api/me/results/solo (201, 200, 400, 401, 429), GET /api/me/stats and /api/me/ranking
provides:
  - "GameStats.solo: SoloResult | null, the result of a real solo deal once won (createGame options clock and newId)"
  - "results/solo.ts: soloReportOf (checked with SoloReport) and sendSoloReport (answers mapped to added, already, refused, signed-out, later, offline)"
  - "results/pending.ts: toc.pending.v1 (account-tagged, at most 50, checked on read), reportNow, flushPending for one account"
  - "results/report.svelte.ts: reportSolo once per game id and the plank's status"
  - "EndScreen: the solo line « Partie ajoutée à tes résultats. » or « Pas de connexion : … au retour du réseau. » (data-solo-report)"
  - "account store: the waiting games of the account are sent whenever the server names it (setAccount)"
affects: [05-09 « Mes chiffres » panels (solo games now arrive), 05-10 accessibility audit (a new live region on the plank), 05-11 deploy and UAT]

actuals:
  tokens: 10200
  tasks: 2
  commits: 4
plan_head_before: a61b82bba1a59a8fc47460e67fe5cc3ef2ca54d4
plan_head_after: 284626ab28e3e5b35af6c1c046caa8c1d80b8a54

tech-stack:
  added: []
  patterns:
    - "A client-claimed result built only from a real deal (no scenario, no script), dated by an injected wall clock, id made at creation"
    - "An account-tagged localStorage queue: queue first, then send, remove on 201/200/400, keep on 401/429/5xx/offline, flush only for the account the server names"
    - "A live region that stays mounted on the plank; its span appears only when there is something to say"

key-files:
  created:
    - apps/web/src/results/solo.ts
    - apps/web/src/results/solo.test.ts
    - apps/web/src/results/pending.ts
    - apps/web/src/results/pending.test.ts
    - apps/web/src/results/report.svelte.ts
    - apps/web/e2e-online/solo-resultats.spec.ts
  modified:
    - apps/web/src/game/GameController.ts
    - apps/web/src/game/GameController.test.ts
    - apps/web/src/net/remoteGame.ts
    - apps/web/src/net/remoteGame.test.ts
    - apps/web/src/ui/EndScreen.svelte
    - apps/web/src/account/store.svelte.ts
    - apps/web/src/i18n/fr/resultats.ts

key-decisions:
  - "A game is real when createGame has neither scenario nor script; script: {} counts as scripted, so no lesson can ever report"
  - "deals in the report is state.dealsPlayed, the same number the online record (05-01) and the plank use"
  - "413 and 415 are dropped like 400 (the server will never take that body); 403 and any other code wait like 429/5xx"
  - "flushPending stops at the first offline or signed-out answer (the rest would fail alike) and keeps everything not settled"
  - "The flush hangs off setAccount, so it runs after GET /api/me at start and back online, after a sign-in and after a sign-up; one flush at a time per account"
  - "The wall clock's default is the system clock; the controller's source check now allows that one line only, and still forbids the clock anywhere near a seed"

requirements-completed: [HIST-02, HIST-03]

duration: 25min
completed: 2026-11-07
---

# Phase 5 Plan 07: Les parties contre l’ordinateur dans « Mes résultats » Summary

**A real solo game finished while signed in now reaches « Mes résultats » and « Mes chiffres », never the ranking. The game folds its own tally and dates itself. The report waits in an account-tagged toc.pending.v1 queue until the server takes it, and the end plank says « Partie ajoutée à tes résultats. » or that it will be added when the network is back.**

## Performance

- **Duration:** about 25 min of work (10:57 to 11:17 UTC for the four commits), plus about 28 min of gate runs
- **Tasks:** 2, each RED then GREEN
- **Files:** 13 (6 created, 7 modified), +1027 / −9 lines

## Accomplishments

- **`createGame`** has two new options: `clock` (the wall clock, default the system clock) and `newId` (default `crypto.randomUUID`).
  - It keeps `startedAt` from creation and folds `foldTally` over every batch in `play()`. It fixes `endedAt` at the winning play.
  - `stats().solo` is the `SoloResult` once a real deal is won: id, times, human, winner, deals, the levels of the three computers (default Galopeur), and each seat's captured, lost and home. Home is read from the final pawns.
  - It is null before the end, for a scenario or `etat`, for any scripted game, and online (`remoteGame` returns `solo: null`).
- **`soloReportOf`** rebuilds the result as a plain object and checks it with `parseSoloReport`, the Worker's own schema. A result out of shape is never sent. The report has no name.
- **`sendSoloReport`** POSTs JSON with `credentials: "same-origin"`; the browser sends our Origin. The answers mean:
  - 201 → added, 200 → already;
  - 400, 413, 415 → refused;
  - 401 → signed-out;
  - anything else → later;
  - no answer or `navigator.onLine === false` → offline.
- **`toc.pending.v1`** holds entries `{ account, report }`:
  - one entry per account and game, at most 50, the oldest dropped;
  - every entry checked on read: exactly two keys, an account id of the account shape, a valid `SoloReport`;
  - storage errors are swallowed.
  - `reportNow` queues the game, sends it, and removes it once settled. `flushPending(account)` sends only that account's games, oldest first.
- **`reportSolo`** sends each game id once per page, so a remount of the plank never sends it twice. It sets the plank's status: added (201 or 200), offline, or idle for everything else.
- **EndScreen:** for a local game whose `stats().solo` is set, with `account.current` set, `reportSolo` runs once.
  - A Label line in `PALETTE.track` shows under the figures, inside an `aria-live` paragraph that stays mounted.
  - A guest gets no line and no request, and a failure shows nothing.
- **Account store:** `setAccount` (GET /api/me at start and back online, sign-in, sign-up) starts `flushPending(id)` in the background. It runs once at a time per account and never shows an error.

## Task Commits

1. **Task 1, the result, its report and the queue:** `8d065ea` (test, RED), `ed1d1d0` (feat)
2. **Task 2, the plank line and the flush:** `61bf1e6` (test, RED), `284626a` (feat)

## Gate

| Suite | Result |
|-------|--------|
| `pnpm typecheck && pnpm lint && pnpm test` | green: **2138 passed, 2 skipped** (133 files) |
| Full local Playwright (`playwright.config.ts`) | first run 546 passed, 1 failed (`lecons.spec.ts` « chaque phrase du guide dans la bande à 480 x 320 › leçon 5 », the band line measured as clipped); that test passed 27/27 alone (`--repeat-each 3`); full rerun **547 passed, 131 skipped, 0 failed** (8.5 min) |
| Online Playwright (`playwright.online.config.ts`) | **115 passed, 5 skipped, 0 failed** (8.9 min); solo-resultats: 3 passed on desktop, 3 skipped on phone |
| Plan verify | node tests for game, results, net, account, i18n; `solo-resultats` + `resultats` online; `partie` + `finition` local (45 passed) |
| Ports 8787, 4173, 4174 after the runs | closed (checked by connecting) |

The suites ran one after another. The lesson failure is in 05-06's band measurement, which this plan does not touch (lessons never reach the end plank or the solo result). It looks like a timing flake under load.

**Seeded game duration:** the `00c0ffee…` deal at test speed, played through the screen, took **43 to 46 s** here (spec annotation and probe log). The plan's estimate was about 85 s. This is above the Worker's 30 s plausibility floor (05-05), but not by much: on a much faster machine the « added » test could get a 400 « implausible ». See « For Romain to confirm ».

## Screenshots (looked at)

- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/05-07-added-1280x800.png`: « Défaite », 6 – 8, « Donnes jouées : 22 · Chevaux mangés : nous 9, eux 11 », and under it « Partie ajoutée à tes résultats. »
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/05-07-added-844x390.png`: two columns, the line under the figures, plank 302 px high, no scroll
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/05-07-offline-1280x800.png`: the offline line on two balanced lines
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/05-07-offline-844x390.png`: the offline line on two lines in the right column, plank 322 px high in 390, no scroll

They were taken with a temporary probe spec, deleted afterwards and never committed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The controller's « no clock in the random source » check**
- **Found during:** Task 1 GREEN
- **Issue:** `GameController.test.ts` forbids `Date.now` anywhere in the controller's source (T-01-21/22: seeds never come from the clock). The plan asks for a `Date.now` default for the wall clock.
- **Fix:** The test now allows exactly the one line `const clock = options.clock ?? (() => Date.now());`. It still forbids `Date.now` and `new Date` elsewhere, and adds a check that the clock never feeds a seed, `Rng` or shuffle. The option's comment says « the system clock ».
- **Files modified:** apps/web/src/game/GameController.test.ts, apps/web/src/game/GameController.ts
- **Commit:** ed1d1d0

**2. [Plan detail] `remoteGame.test.ts` updated**
- The online controller's exact `stats()` expectation now includes `solo: null`. The file is not in the plan's list; the behaviour is (« null … for the online controller »).

**3. [Plan detail] The plank's markup**
- The figures and the new line are wrapped in a `.figures` grid, so an empty line adds no gap. `[data-stat]` selectors and the phone-height rules are unchanged.

**4. [Plan detail] The status is pure logic out of the runes module**
- Vitest runs without the Svelte compiler, so the queue-then-send logic (`reportNow`) lives in `pending.ts` with Node tests. `report.svelte.ts` keeps only the `$state`, the once-per-id guard and the status mapping.

No package, no migration, no wrangler or Durable Object change. `session.svelte.ts` and `Game.svelte` are untouched, and PROTOCOL_VERSION stays 6.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model. Its mitigations are in place and tested:

| Threat | Mitigation |
|--------|------------|
| T-05-20 | Entries are tagged with the account. `flushPending` sends only the account the server just named (Node test plus the online offline-then-flush spec). |
| T-05-21 | Every entry is checked on read with `SoloReport`, exact keys and the account-id shape; malformed entries are never sent. |
| T-05-22 | `real` = no scenario and no script; tests cover a won scenario, a won scripted real deal and the online controller. |
| T-05-SC | No package added. |

## Deploy Notes

- Nothing new to apply. The Worker route and 0003 are from 05-01 and 05-05; 0003 must be on the remote D1 before deploy (orchestrator, 05-11).
- A new localStorage key on devices: `toc.pending.v1`.

## For Romain to confirm

- The two plank lines and their place under the figures (UI-SPEC « What counts »), shown on a loss as well as a win.
- A refused game (400, for example a game shorter than 30 s) is dropped silently, and a 401 keeps it until the same account signs in again.
- The 30 s plausibility floor (05-05) against our own seeded test game, which takes about 45 s here. If CI machines get much faster, the e2e game should be slowed (or the floor revisited).

## Self-Check: PASSED

- Files: solo.ts, solo.test.ts, pending.ts, pending.test.ts, report.svelte.ts and solo-resultats.spec.ts exist.
- Commits 8d065ea, ed1d1d0, 61bf1e6 and 284626a are ancestors of HEAD.
