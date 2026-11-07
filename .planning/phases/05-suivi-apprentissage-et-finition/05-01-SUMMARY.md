---
phase: 05-suivi-apprentissage-et-finition
plan: 01
subsystem: database
tags: [d1, durable-objects, svelte, zod, history, tracer]

requires:
  - phase: 02-jouer-en-ligne-entre-proches
    provides: the GameRecord path (commitPlay → keepRecord → GameRoom.record → writeGame, d1Retry), the games row of 0001
  - phase: 04-comptes-amis-et-application-installable
    provides: Person.account (04-04), sessions and sessionUser, the « Page » layout, OfflinePage, requireSignIn, the Meter and x-toc-d1
provides:
  - foldTally / emptyTally / Tally in @toc/engine (per-seat captured and lost from engine events)
  - Table.tally (server-only), folded in commitPlay, reset at the start and the rematch
  - GameRecord seats with account, captured, lost, home; GameRecord.creatorName
  - D1 migration 0003_results.sql (played, game_seats WITHOUT ROWID)
  - writeGame's single batch (legacy games row + played + guarded game_seats)
  - GET /api/me/results with keyset paging (before=<ended_at>:<game_id>, 20 a page)
  - HistoryPage / HistoryGame / HistorySeat / HISTORY_CURSOR_RE / parseHistoryPage in @toc/protocol
  - "#/resultats: the history panel (GameRow, results/api.ts history(), results/format.ts rowOf())"
affects: [05-05 stats and ranking, 05-07 solo reports, 05-09 Mes résultats page, 05-11 deploy]

actuals:
  tokens: 27296
  tasks: 3
  commits: 6
plan_head_before: 9e3ba4ae3759db514e4e0ecc322d9eaa50850fad
plan_head_after: 77120d55191eaaa2ec71b505189a0ac254c907d4

tech-stack:
  added: []
  patterns:
    - "A new D1 table is written in the existing record batch, each account row as INSERT … SELECT … WHERE EXISTS (users) ON CONFLICT DO NOTHING"
    - "Keyset paging with the explicit OR form, cursor read by an anchored regex shared in @toc/protocol and bound as parameters"
    - "A server-only per-game accumulator on the table (tally) defaulted by copyTable ??= and reset where a game starts"

key-files:
  created:
    - packages/engine/src/tally.ts
    - packages/engine/test/tally.test.ts
    - packages/table/src/record.test.ts
    - packages/protocol/src/results.ts
    - packages/protocol/src/results.test.ts
    - apps/worker/migrations/0003_results.sql
    - apps/worker/src/results.ts
    - apps/worker/test/results.test.ts
    - apps/web/src/results/api.ts
    - apps/web/src/results/api.test.ts
    - apps/web/src/results/format.ts
    - apps/web/src/results/format.test.ts
    - apps/web/src/routes/Results.svelte
    - apps/web/src/ui/GameRow.svelte
    - apps/web/src/i18n/fr/resultats.ts
    - apps/web/e2e-online/resultats.spec.ts
  modified:
    - packages/engine/src/index.ts
    - packages/table/src/record.ts
    - packages/table/src/table.ts
    - packages/table/src/reduce.ts
    - packages/table/src/rematch.ts
    - packages/table/src/rematch.test.ts
    - packages/protocol/src/index.ts
    - apps/worker/src/record.ts
    - apps/worker/src/index.ts
    - apps/worker/test/helpers.ts
    - apps/worker/test/record.test.ts
    - apps/web/src/App.svelte

key-decisions:
  - "One game_seats row per account per game (the primary key user_id, ended_at, game_id): an account seated twice keeps its first seat in colour order and counts once in accounts. The table cannot seat one account twice anyway (resolveWho rule 1)."
  - "The legacy games row copies only the 02-09 seat fields (colour, kind, name, level, handedOver), so the account id never reaches it."
  - "A record without account and tally (pending from before 05-01) writes the games row alone, through a StoredRecord type with the new fields optional."
  - "A seat handed to the computer keeps its person's account (won or lost counts for it), as UI-SPEC « What counts » proposes."
  - "The history answer gives a computer seat its stored horse name in `name` with its level; the page always shows the level name."

patterns-established:
  - "results/format.ts: pure wording of a history row (line 1, line 2, date, time, accessible sentence) with Intl fr and U+00A0 around « h »"
  - "Screenshots of a page from its spec, behind TOC_SHOTS, with the API answer served by page.route"

requirements-completed: [HIST-02]

coverage:
  - id: D1
    description: "A finished online game with an account writes played and one game_seats row per account in the record's batch; the games row is unchanged and holds no account id"
    requirement: HIST-02
    verification:
      - kind: integration
        ref: "apps/worker/test/results.test.ts#writes played and one game_seats row per account seat, beside the unchanged games row"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rewrites and retries add no row; a vanished account is skipped; a pre-05-01 record writes the games row only; ranked only with two distinct accounts"
    requirement: HIST-02
    verification:
      - kind: integration
        ref: "apps/worker/test/record.test.ts#the results of a finished game in D1 (plan 05-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET /api/me/results: the caller's games newest first, 20 a page, no gap at ties, no other account's id, 401 signed out, 400 cursor"
    requirement: HIST-02
    verification:
      - kind: integration
        ref: "apps/worker/test/results.test.ts#the history of a player, page by page"
        status: pass
    human_judgment: false
  - id: D4
    description: "#/resultats shows each account its game: « Victoire · 8 – 0 » / « Défaite · 0 – 8 », line 2 with « Mamie (sans compte) » and the computer by level, the full sentence as the accessible name"
    requirement: HIST-02
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/resultats.spec.ts#une partie à deux comptes, un invité et un ordinateur, dans « Mes résultats »"
        status: pass
      - kind: automated_ui
        ref: "playwright:05-01-resultats-844x390.png, 05-01-resultats-1280x800.png"
        status: pass
    human_judgment: true
    rationale: "Romain reads the French wording of a row and the look of the page at UAT"

duration: 47min
completed: 2026-11-07
status: complete
---

# Phase 5 Plan 01: Traceur « Mes résultats » Summary

**A finished online game with accounts now writes who sat where and what each seat did (played and game_seats, new migration 0003) in the record's existing idempotent D1 batch, and each account reads it at #/resultats as « Victoire · 8 – 0 · Avec Mamie (sans compte) · contre … » through a session-scoped, keyset-paged GET /api/me/results.**

## Performance

- **Duration:** about 47 min
- **Started:** 2026-11-07T05:55:30Z
- **Completed:** 2026-11-07T06:42Z
- **Tasks:** 3 (each RED then GREEN)
- **Files:** 28 changed (16 created, 12 modified)

## Accomplishments

- `foldTally` in `@toc/engine`: a capture is credited to the seat of the batch's last `cardPlayed` (G7), the eaten colour loses one. The table folds it in `commitPlay` before `keepRecord`, resets it at the start and in `maybeStartRematch`, and `copyTable` defaults it.
- The record gains `account`, `captured`, `lost`, `home` per seat and `creatorName`. It stays server-only: a table test asserts that no frame carries an account id or a tally.
- `0003_results.sql` adds `played` (id = the games row's game_id; kind, times, winner, seats JSON, deals, creator, accounts) and `game_seats` (user_id, ended_at, game_id) WITHOUT ROWID. 0001 and 0002 are untouched, and so are the wrangler files.
- `writeGame` is one `db.batch`: the legacy games row, unchanged in columns and seat fields, plus, when an account sat at the table, `played` and one guarded `game_seats` row per account. Everything is ON CONFLICT DO NOTHING. A failed batch writes nothing and the record stays pending.
- `GET /api/me/results` reads the session only. Seats come back as me, account, guest or bot, with no account id. It pages 20 at a time with `next = <ended_at>:<game_id>`, and a malformed cursor gets 400 `{ error: "cursor" }`. The answer is `HistoryPage` (strict zod), and the page checks it.
- `#/resultats` uses the « Page » layout with the history rows, including loading, error with « Réessayer », the empty state with « Jouer contre l’ordinateur », the signed-out redirect (home, sign-in sheet, toast) and the offline page. The route is not behind « Tourne ton téléphone ».

## Task Commits

1. **Task 1: tracer, a two-account game reaches D1 and « Mes résultats »**: `b4b57fd` (test, RED), `84fa9ef` (feat)
2. **Task 2: safe rewrites and pages of 20**: `9326c3e` (test, RED), `0401e54` (feat)
3. **Task 3: the row said in French**: `481b486` (test, RED), `77120d5` (feat)

## D1 rows (measured, workerd, D1Result meta)

| What | Rows written | Rows read |
|------|--------------|-----------|
| One finished two-account game (one batch) | **7**: legacy games 3 (row, key, table_hash index), played 2 (row and key), game_seats 1 per account (WITHOUT ROWID) | — |
| The same record written again (retry, lost answer) | **0** | — |
| `GET /api/me/results`, a full first page of 20 | 0 | **44** (session 2 + 21 seat rows + 21 played rows) |
| `GET /api/me/results`, a last page of 5 | 0 | **13** |

**Daily estimate for 20 people:** the 04-12 estimate was about 250 rows written a day. Phase 5 adds 2 + n rows per online game with n accounts. About 60 online games a day with about 2 accounts each is about 240 rows. That makes about 490 rows a day against the Free plan's 100 000 (under 0.5 %). Solo reports (05-05, about 3 rows each) come on top and stay far below the limit.

## Gate

| Suite | Result |
|-------|--------|
| `pnpm typecheck && pnpm lint && pnpm test` | green: **1933 passed, 2 skipped** (123 files, node and worker projects) |
| Full local Playwright (`playwright.config.ts`) | **461 passed, 99 skipped, 0 failed** (7.1 min) |
| Online Playwright (`playwright.online.config.ts`) | **110 passed, 2 skipped, 0 failed** (9.8 min): 108 at 04-16, plus `resultats.spec.ts` on both projects; the 2 skipped are the TOC_SHOTS screenshot test |
| Ports 8787, 4173, 4174 after the runs | closed (checked by connecting) |

## Screenshots (looked at)

- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/05-01-resultats-844x390.png`
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/05-01-resultats-1280x800.png`
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/05-01-vide-844x390.png`
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/05-01-vide-1280x800.png`

Each shows three games: an online win, an online loss with a guest partner, and a 20-character pseudo cut by an ellipsis in line 2. The rows are 64 high and nothing scrolls sideways.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The 02-09 record tests compared the whole record**
- **Found during:** Task 1
- **Issue:** `packages/table/src/rematch.test.ts` used `toEqual` on the full record and failed once the new fields existed.
- **Fix:** Its expectations gained `account`, `captured`, `lost`, `home` and `creatorName`. The test file was not in the plan's list.
- **Commit:** `84fa9ef`

**2. [Rule 3 - Blocking] Typing a pending record from before 05-01**
- **Found during:** Task 1 (typecheck)
- **Issue:** `apps/worker/test/record.test.ts` writes a record in the 02-09 shape.
- **Fix:** `writeGame` takes a `StoredRecord` (the new fields optional), and the snapshot test casts the old shape.
- **Commit:** `84fa9ef`

**3. [Plan conflict] One game_seats row per account, not one per seat**
- **Issue:** The plan says « a person holding two seats … gets one row per seat », but its own primary key `(user_id, ended_at, game_id)` allows only one row per account per game.
- **Fix:** The key was kept as written. An account seated twice keeps its first seat in colour order and counts once (`accounts`, ranked 0). The workerd test asserts this. The table cannot actually seat one account twice: resolveWho rule 1 gives the account its linked person on every device.
- **Commit:** `84fa9ef`, test in `9326c3e`

**4. [Test bug] The RED test's NBSP constant**
- **Issue:** `format.test.ts` declared U+00A0 as a plain space in the RED commit.
- **Fix:** It became `" "` in GREEN.
- **Commit:** `77120d5`

### Other adjustments

- Line 1 was computed inside `GameRow` in Task 1. Task 3 moved it into `results/format.ts` (`rowOf`), as planned for that task.
- The left column of the page shows the D-04 note « Les parties comptent depuis novembre 2026. » (from the UI-SPEC navigation section, which 05-09 completes), so the column is not empty.
- The table test « no frame carries the record » does not check `creatorName`: the public table frame has carried it since 02.
- The e2e RED was not run. Without the route, `#/resultats` falls through to the home, so it could only fail. The node and workerd RED runs were executed and failed as expected.
- The screenshots come from a TOC_SHOTS-gated test in `resultats.spec.ts`, which serves the API answer through `page.route`.

## Known Stubs

- `apps/web/src/ui/GameRow.svelte`: the row is a button with no action yet. Its detail sheet comes in 05-09, as the plan says. Navigation, months, paging, « Mes chiffres » and « Classement » are 05-09 too. This does not block the plan's goal: each game is listed and readable.

## Threat Flags

None: the only new surface is `GET /api/me/results`, which is in the plan's threat model (T-05-01, T-05-05). The mitigations are in place: session-bound, no id parameter, cursor parsed by an anchored regex and bound, no other account's id in the answer (asserted), text bindings only (no-raw-html test green).

## Deploy Notes

- **D1 migration `0003_results.sql` must be applied to the remote database before the Worker that uses it is deployed** (orchestrator step, 05-11). Without it, every online record batch fails and retries hourly, and `GET /api/me/results` answers 500. This plan applied it locally only (workerd tests, `wrangler d1 migrations apply toc --local` in the online config). No remote command was run.
- No Durable Object migration change (tag v1 GameRoom, v2 PlayerHub untouched), no new class, PROTOCOL_VERSION stays 6, no new secret or package.
- At deploy, a table mid-game counts its tally from the deploy on (partial counts, D-04). A record pending from before writes its games row only.

## For Romain to confirm

- The guest wording « Mamie (sans compte) » (D-12) and computers shown by level (« Pur-sang »), never by horse name.
- A seat handed to the computer during the game still counts for its account, win or loss (UI-SPEC « À confirmer » 5).
- The note « Les parties comptent depuis novembre 2026. »

## Self-Check: PASSED
