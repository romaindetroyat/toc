---
phase: 05-suivi-apprentissage-et-finition
plan: 05
subsystem: api
tags: [d1, workers, zod, stats, ranking, solo, rate-limit]

requires:
  - phase: 05-suivi-apprentissage-et-finition
    plan: 01
    provides: played and game_seats (0003_results.sql), the record batch, GET /api/me/results, HistoryPage
  - phase: 04-comptes-amis-et-application-installable
    provides: sessions and sessionUser, friendships (two rows per friendship), PlayerHub.allow, readJson and writeAllowed, the Meter and x-toc-d1
provides:
  - "aggregate.ts: statsOf(rows, me) and rankingOf(rows, me), pure"
  - "GET /api/me/stats: « Mes chiffres » for « Toutes », « En ligne » and « Contre l’ordinateur » at once"
  - "GET /api/me/ranking: the friends ranking of the caller's circle"
  - "POST /api/me/results/solo: a solo game reported by a signed-in browser, client-claimed, never ranked"
  - "StatsBlock / StatsAnswer / parseStatsAnswer, RankingAnswer / parseRankingAnswer / RANKING_THRESHOLD, SoloReport / parseSoloReport / SOLO_ID_RE in @toc/protocol"
  - "plausible(report, now) and the SOLO_* thresholds exported from apps/worker/src/results.ts"
affects: [05-07 solo reports from the browser, 05-09 « Mes chiffres » and « Classement » panels, 05-11 deploy]

actuals:
  tokens: 17073
  tasks: 3
  commits: 6
plan_head_before: 95ffdc83e36f94ea934eb0f50ae3fae9772f342a
plan_head_after: 99d4d697eb73b2fe629b89d502b77244afa8a79b

tech-stack:
  added: []
  patterns:
    - "Session-bound GET reads in one READS map (results.ts): the session check once, then the read"
    - "Aggregation in pure TypeScript over one query's rows; exact rate order by cross-products"
    - "A client-claimed write: strict schema, a pure plausibility check with named thresholds, a per-account PlayerHub rate, an idempotent INSERT … SELECT bound to the parent row"

key-files:
  created:
    - apps/worker/src/aggregate.ts
    - apps/worker/test/aggregate.test.ts
    - apps/worker/test/results-api.test.ts
  modified:
    - packages/protocol/src/results.ts
    - packages/protocol/src/results.test.ts
    - apps/worker/src/results.ts
    - apps/worker/src/index.ts
    - apps/worker/test/helpers.ts

key-decisions:
  - "Partners are grouped by account id on the server and named by the pseudo stored in the newest game; ties on games go accounts by pseudo (fr, base), then « Joueurs sans compte », then computers by level (the server knows no level names)."
  - "A game counts under a computer level only when both opponents were computers from the start: a person's seat handed over to the computer is still a human opponent."
  - "Plausibility floor of 30 s (the plan's choice over research A5's 60 s), à confirmer; the other thresholds as named constants: 1..300 deals, 0..64 knights eaten or lost, ended at most 5 minutes ahead and at most 60 days ago."
  - "The schema keeps loose numeric bounds (0..100 000) so that an out-of-range count or deal number is answered « implausible », not « body »; a home above 4 and a wrong set of levels are « body »."
  - "The solo answer is { added: true } (201) or { added: false } (200): no id, not even the caller's."
  - "A resend counts toward the 30 a day (the rate is checked before the batch)."

patterns-established:
  - "seedGame / befriendRows / d1Of in apps/worker/test/helpers.ts: results and friendships seeded straight into the test D1, the x-toc-d1 header read as numbers"

requirements-completed: [HIST-03, HIST-04]

duration: 36min
completed: 2026-11-07
status: complete
---

# Phase 5 Plan 05: Les chiffres, le classement entre amis et le rapport des parties solo Summary

**The Worker now answers « Mes chiffres » (games, wins, knights, partners, computer levels, for the three filters at once) and the friends ranking (5 games to enter, rates compared by cross-products, shared ranks), and accepts a solo game from a signed-in browser through a strict, plausible, rate-limited, idempotent report that counts for the player alone and never in the ranking.**

## Performance

- **Duration:** about 36 min (09:06 to 09:42 UTC, gate included)
- **Tasks:** 3, each RED then GREEN
- **Files:** 8 (3 created, 5 modified), +1735 / −21 lines

## Accomplishments

- **`statsOf(rows, me)`** (pure) folds the player's `game_seats ⋈ played` rows into `{ all, online, solo }`. Each block has games, wins, captured, lost and home (the player's own seat), plus partners and levels.
  - **Partners:** the team mate's seat. Another account appears by its pseudo (grouped by account id, which never leaves the server), all guests together as `guests`, computers as `bot` by level.
  - **Levels:** a game counts here only when both opponents were computers. It goes under the stronger one's level.
- **`GET /api/me/stats`**: one session-bound query and no parameter. The answer is a strict `StatsAnswer`.
- **`rankingOf(rows, me)`** (pure) needs `RANKING_THRESHOLD` = 5 games to enter. Rates are compared as `b.wins × a.games − a.wins × b.games`, never as floats. Ties go to more wins, then more games, then the pseudo (`localeCompare("fr", { sensitivity: "base" })`). A rank is shared only when rate, wins and games are all equal. Players below 5 games are listed by games, then pseudo. The answer gives `friends` and marks one's own row with `me`.
- **`GET /api/me/ranking`** runs research Pattern 4's circle query: the caller, plus the `friend_id`s of the caller's own friendships, joined to `game_seats` rows with `ranked = 1` only.
- **`POST /api/me/results/solo`** is in `index.ts`'s `POSTS`, so our own non-null Origin is checked first. The rest runs in this order:
  - `readJson(SoloReport)` (415 / 413 / 400 body);
  - the session (401);
  - `plausible` (400 implausible);
  - `PlayerHub.allow({ kind: "solo", max: 30, windowMs: 86 400 000 })` (429 rate);
  - one batch: `played` (`solo:<user_id>:<uuid>`, kind solo, accounts 1), then its `game_seats` row, written by `INSERT … SELECT … FROM played WHERE id = ?` (ended_at and won come from the played row; ranked 0, solo 1). Both are `ON CONFLICT DO NOTHING`.
  - The answer is 201 `{ added: true }` or 200 `{ added: false }`.
- **Seats of a solo game:** the player's seat is the session's account and pseudo. The computers get `kind: "bot"`, `name: ""` and their level. The body carries no name and the strict schema refuses one.

## Task Commits

1. **Task 1, « Mes chiffres »:** `46fdd8f` (test, RED), `68cff9d` (feat)
2. **Task 2, the friends ranking:** `365b955` (test, RED), `1dddc1b` (feat)
3. **Task 3, the solo report:** `96e6e51` (test, RED), `99d4d69` (feat)

## D1 rows (measured, workerd, x-toc-d1)

| Route | Rows written | Rows read |
|-------|--------------|-----------|
| `GET /api/me/stats`, 3 games | 0 | **8 to 9** (session 2, seats and played rows) |
| `GET /api/me/stats`, 50 games | 0 | **102** |
| `GET /api/me/ranking`, a circle of 10 friends, 30 ranked games | 0 | **214** (session, friendships, users, every ranked seat row of the circle) |
| `POST /api/me/results/solo`, added | **3** (played row and its key, one WITHOUT ROWID seat row) | 5 |
| `POST /api/me/results/solo`, resent | **0** | 5 |
| Any route without a cookie (401, 403) | 0 | 0 (no query) |

Each solo report also writes one row (and its `(kind, at)` index entry) to the player's PlayerHub SQLite for the rate limit. That is Durable Object storage, not D1.

**Daily estimate (05-01's figure updated):** 05-01 put the total at about 490 D1 rows written a day for 20 people. Assume about 3 solo games a day per active player, so about 60 reports a day: that adds about 180 rows. The total is about 670 rows a day, against the Free plan's 100 000 (under 0.7 %). The two reads write nothing. Their reads grow with history: about 2 rows per game for stats, about 1 per ranked seat of the circle for the ranking. That stays well inside the 5 million rows read a day.

## Gate

| Suite | Result |
|-------|--------|
| `pnpm typecheck && pnpm lint && pnpm test` | green: **2090 passed, 2 skipped** (130 files, node and worker projects; 1933 at 05-01) |
| Full local Playwright (`playwright.config.ts`) | **491 passed, 107 skipped, 0 failed** (7.7 min) |
| Online Playwright (`playwright.online.config.ts`) | **112 passed, 2 skipped, 0 failed** (8.9 min) |
| Ports 8787, 4173, 4174 after the runs | closed (checked by connecting) |

The suites ran one after another. The online log has one workerd `Broken pipe` line from a socket closing during a test; no test failed.

## Screenshots

None: this plan has no screen. 05-09 draws « Mes chiffres » and « Classement ».

## Deviations from Plan

### Adjustments

**1. [Plan detail] Where the bounds are checked (schema or plausibility)**
- The plan lists « a count of 65 » and « 0 deals or 301 » under the plausibility refusals (`implausible`). For those to be reachable, the schema bounds captured, lost and deals loosely (0..100 000), and `plausible` enforces 0..64 and 1..300.
- `home` stays 0..4 in the schema, because a fifth knight cannot exist.
- The level rule (exactly the three other colours, none for the player) is a schema refinement, so a fourth level and the player's own level are 400 `body`, as the plan's list says.

**2. [Plan detail] Partner order on equal games**
- The plan says « most games first then name ». The server does not know the level names (they live in the web catalogue). On equal games it lists accounts by pseudo, then the guests, then the computers by level. This matches the plan's own example (B, guests, level 3).

**3. [Plan detail] The answer of a solo report**
- The plan gives the status codes but no body. It is `{ added: true | false }`, with no id, not even the caller's own.

**4. [Rule 2 - Correctness] The seat row's result comes from the played row too**
- `won` is computed in SQL from `played.winner` (with `ended_at`), so a resend can never pair the first game's key with another result.

No other deviation: no migration, no package, no wrangler or Durable Object migration change, and PROTOCOL_VERSION stays 6.

## Known Stubs

None. The routes are complete. The browser that sends solo reports (05-07) and the panels (05-09) are later plans, as the roadmap of the phase says.

## Threat Flags

None beyond the plan's threat model. Every mitigation is in place and tested:

| Threat | Mitigation |
|--------|------------|
| T-05-11 | Solo games are stored with ranked 0, checked by `plausible`, limited to 30 a day |
| T-05-12 | `solo:<user>:<uuid>`, ON CONFLICT DO NOTHING, the seat row bound to the played row |
| T-05-13 | Origin 403 before anything else, then 415 |
| T-05-14, T-05-15 | Session-bound queries, a circle made of the caller's own friendships only, answers with pseudos and counts only (asserted against every id) |
| T-05-16 | 8 192-byte body cap, 30 a day, one batch of two inserts |

## Deploy Notes

- Nothing new to apply: 0003_results.sql (05-01) already holds `played` and `game_seats`. It must be on the remote database before this Worker is deployed (orchestrator, 05-11).
- No Durable Object migration change. The PlayerHub gains a new `limits` kind, "solo", in its existing table.
- No new secret, binding or package.

## For Romain to confirm

- The solo plausibility thresholds (research A5, UI-SPEC « à confirmer »): at least **30 s** long, 1 to 300 deals, at most 64 knights eaten or lost per seat, ended at most 5 minutes ahead and at most 60 days ago, and **30 reports a day** per account.
- The ranking method (D-13 as written): 5 ranked games to enter; the rate, then wins, then games, then the pseudo; shared ranks.
- In « Contre l’ordinateur, par force », a game counts only when both opponents were computers from the start. A person's seat later handed to the computer stays a human opponent.

## Self-Check: PASSED
