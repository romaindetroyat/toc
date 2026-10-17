---
phase: 02-jouer-en-ligne-entre-proches
plan: 09
status: complete
subsystem: online-table
tags: [rematch, end-of-game, d1, durable-objects, alarms, svelte5, playwright, workerd, a11y]

requires:
  - phase: 02-jouer-en-ligne-entre-proches
    provides: "02-08 protocol 3 with chat, the table reducer, presence and the sweep; 02-07 leave, expiry and the welcome resync; 02-06 hand-over (HANDOVER_LEVEL), SeatBadges; 02-02 the leak oracle; 01-50 the end plank"
provides:
  - "@toc/protocol 4: client frame rematch { agree }; TablePublic.status finished, winner, rematch (yes | no | offline | bot per colour); REMATCH_VOTES; test option before (a scenario's before block, MAX_BEFORE_CHARS 4096)"
  - "@toc/table rematch.ts: onGameWon, rematchVotes, vote, dropVote, everyoneAgrees, maybeStartRematch; Table.firstDealer, startedAt, endedAt, rematch; the sweep also runs while finished"
  - "@toc/table record.ts: GameRecord, gameRecordOf, keepRecord, recorded, onD1RetryDue, D1_RETRY_MS; Table.records (server-only), deadlines.d1Retry; Reduced.records; command recorded"
  - "apps/worker: migrations/0001_games.sql, src/record.ts (tableHash, writeGame: written | skipped | failed), src/env.d.ts (DB optional), GameRoom writes after the commit; vitest: miniflare D1 DB with the migrations"
  - "Client: EndScreen online mode (data-rematch-vote, data-vote, data-vote-line), net/votes.ts, the rematch flow in Game.svelte, connection and remoteGame by game number, « Quitter la table » on the plank"
  - "e2e-online/revanche.spec.ts (phone, desktop)"
affects: [02-10, 05]

tech-stack:
  added: []
  patterns:
    - "A reducer step may carry work for the shell after the commit (records), as purge does; the shell reports back with a command (recorded), so the pending state lives in the snapshot and survives eviction"
    - "A remote game is one game number: once the server names another, it stops feeding its Director and the screen builds the next one from the collected opening deal"
    - "The rematch's table frame is sent before its events, so a device knows the new game number before its first batch"

key-files:
  created:
    - packages/table/src/rematch.ts
    - packages/table/src/rematch.test.ts
    - packages/table/src/record.ts
    - apps/worker/migrations/0001_games.sql
    - apps/worker/src/record.ts
    - apps/worker/src/env.d.ts
    - apps/worker/test/env.d.ts
    - apps/worker/test/apply-migrations.ts
    - apps/worker/test/record.test.ts
    - apps/worker/test/rematch.test.ts
    - apps/web/src/net/votes.ts
    - apps/web/src/net/votes.test.ts
    - apps/web/e2e-online/revanche.spec.ts
  modified:
    - packages/protocol/src/frames.ts
    - packages/protocol/src/frames.test.ts
    - packages/table/src/table.ts
    - packages/table/src/reduce.ts
    - packages/table/src/frames.ts
    - packages/table/src/presence.ts
    - packages/table/src/summary.ts
    - packages/table/src/index.ts
    - packages/table/test/leak.test.ts
    - apps/worker/src/GameRoom.ts
    - apps/worker/vitest.config.ts
    - apps/worker/test/{api,bots,chat,leak,lobby,pause,room}.test.ts (hello v 4; diagnostics in bots and leak)
    - apps/worker/test/helpers.ts
    - apps/web/src/ui/EndScreen.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/routes/Table.svelte
    - apps/web/src/net/remoteGame.ts
    - apps/web/src/net/remoteGame.test.ts
    - apps/web/src/net/connection.svelte.ts
    - apps/web/src/net/{chat,notices,plate}.test.ts (TablePublic fixtures)
    - apps/web/src/i18n/fr/table.ts
    - apps/web/e2e-online/online.ts

key-decisions:
  - "PROTOCOL_VERSION 3 → 4: a page of version 3 cannot read status « finished » and would drop every table frame from the end on; it now gets 4002 « Nouvelle version du jeu ». DO migration tag v1 unchanged; old snapshots get the new fields in copyTable, and a won game still « playing » becomes « finished »."
  - "Votes are per seat. A person who goes offline (socket closed, swept, or « Quitter la table ») loses their vote and shows « hors ligne »; the rematch starts as soon as every seated person still online agrees (at least one), whether the last event is a vote or someone leaving."
  - "The sweep keeps running while the table is finished, so a silent phone (75 s) cannot hold the others' vote forever."
  - "Rematch: gameNo + 1, the same seats, names and levels; an offline person's seat goes to the computer at Galopeur (an existing hand-over keeps its level); fresh seed from ctx.seed (crypto in the object); firstDealer = nextColor(previous firstDealer), A6. The test start position is used for the first game only."
  - "Record: one per game number, pending in the snapshot until the object says recorded; game_id = base64url SHA-256(table id) + « : » + gameNo; INSERT … ON CONFLICT (game_id) DO NOTHING; retry after 1 min, 10 min, then every hour; no binding → skipped, logged once per object instance, cleared like a success (the game is never recorded later)."
  - "D1 binding: not added to either wrangler config (the plan forbids a database_id here; 02-10 adds it). DB is optional in apps/worker/src/env.d.ts; the tests bind a miniflare D1 in vitest.config.ts only."
  - "The plank's names on the discs are the seats' first names (« Toi » for this device), not « Bruno (ordinateur) »; the finished game on screen stays as it ended (names included) until the new one is built."

requirements-completed: [PLAY-07, HIST-01]

coverage:
  - id: D1
    description: "The winner announced to every device at once, each from its side; « Revanche » and « Quitter la table » replace the local buttons"
    requirement: PLAY-07
    verification:
      - kind: unit
        ref: "packages/table/src/rematch.test.ts; packages/protocol/src/frames.test.ts"
        status: pass
      - kind: integration
        ref: "apps/worker/test/rematch.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e-online/revanche.spec.ts"
        status: pass
  - id: D2
    description: "The vote (toggle, discs, line), the start when every online person agrees, same seats and teams, next first dealer, offline seat to Galopeur and back on return"
    requirement: PLAY-07
    verification:
      - kind: unit
        ref: "packages/table/src/rematch.test.ts; apps/web/src/net/votes.test.ts; apps/web/src/net/remoteGame.test.ts"
        status: pass
      - kind: property
        ref: "packages/table/test/leak.test.ts (every online person votes after each win; the new deal's frames pass the oracle)"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e-online/revanche.spec.ts"
        status: pass
  - id: D3
    description: "One anonymous D1 row per finished game, written once, retried by alarm, no binding never blocks"
    requirement: HIST-01
    verification:
      - kind: unit
        ref: "packages/table/src/rematch.test.ts (record cases)"
        status: pass
      - kind: integration
        ref: "apps/worker/test/record.test.ts"
        status: pass

estimate:
  tokens: 130000
actuals:
  tokens: 25700    # chars/4 of the added lines of the plan's nine commits (102 989 characters)
  tasks: 3
  commits: 9       # git rev-list --count plan_head_before..HEAD before this SUMMARY
plan_head_before: ca15fd7660e2cb1ebf1d97dc1104bde3a27b9a1d
plan_head_after: 20c79c7f04b79da3553c7f5223bcd3801d4cdc51

duration: 75min
completed: 2026-10-17
---

# Phase 2 Plan 09: La fin de partie pour tous, la revanche, et la trace de chaque partie Summary

**When a team brings its eighth knight home, the table becomes « finished » on the server and every device shows the end plank, each from its own side. Online, the plank offers « Revanche » (a toggle) and « Quitter la table ». Four discs show who agrees: computers always do, an offline player shows wifi-off. When every seated player still online agrees, « Tout le monde est d’accord : nouvelle partie ! » stays 1 s, the plank closes and a new game is dealt at the same table with the same seats, teams and computer strengths. The seat after the previous first dealer deals. Every finished game also leaves one anonymous row for phase 5's history in a D1 `games` table. The row is written once, a failed write is retried by alarm, and the game goes on untouched while the database does not exist yet.**

## What was built

- **Server, the end and the rematch (Task 1).**
  - Protocol 4: `rematch { agree }`; `TablePublic` gains `status: "finished"`, `winner` and `rematch` (each colour's yes, no, offline or bot).
  - `rematch.ts` in the core:
    - A winning play makes the table finished: no computer is due, the pause is cleared, and the end time is kept.
    - A seated person votes; anyone else, or a vote before the end, gets `refused`.
    - Going offline drops the person's vote.
    - When everyone online agrees, the rematch starts with gameNo + 1 and the same seats and levels. Offline people's seats are handed to Galopeur. The game gets a fresh seed and the next first dealer.
    - The rematch's table frame is sent before each seated person's own opening deal.
  - The test option `before` starts a TOC_TEST_MODE table from a near-end position, which the e2e and workerd tests use.
- **Server, the record (Task 2).**
  - `record.ts` in the core: the winning step carries `records`, kept pending in the snapshot, and `d1Retry` is armed one minute on. A due retry tick carries every pending record again (then +10 min, then every hour). `recorded` clears a record.
  - `GameRoom` commits and sends first, then awaits `writeGame` for each record. On written or skipped it runs `recorded`; on failed the record stays pending.
  - The `games` migration has an index on `table_hash`.
- **Client (Task 3).**
  - `EndScreen` online mode follows the UI-SPEC:
    - 28 px discs with the seat glyph on cream, a 1 px ink line and 14 px badges.
    - `role="list"` « Accord pour la revanche », with each disc named « Bruno, pas encore » and so on.
    - A polite vote line and `aria-pressed` with a check on « Revanche ».
    - Focus lands on « Revanche » and Tab stays on the plank.
    - The stats line is visually hidden below 360 px of height (online only).
    - The close takes 300 ms (150 ms fade under reduced motion).
  - The local plank is unchanged; `finition.spec.ts` and `partie-complete.spec.ts` pass in the full local suite.
  - `votes.ts` words the line from the server's votes.
  - The connection collects the opening deal of a new game number. The old remote game freezes at the new number. `Game.svelte` waits 1 s, closes the plank, then builds the new session, so the deal and its banner play.
  - « Quitter la table » on the plank sends `leave`, forgets the table on this device, closes with 1000 and goes home.

## Screenshots (looked at)

Taken by `revanche.spec.ts` with `TOC_SHOTS` against `wrangler dev`:

- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-09-annonce-1280x800.png and 02-09-annonce-844x390.png: Bruno's plank, « Défaite », the four discs (two hourglasses, two checks), « Revanche : il faut l’accord de tout le monde. ».
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-09-accord-1280x800.png and 02-09-accord-844x390.png: Ana's plank after her tap, « ✓ Revanche », her disc checked, « Tu es d’accord. En attente de Bruno… ».
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-09-revanche-1280x800.png and 02-09-revanche-844x390.png: the new game on Ana's screen, the deal banner « On rebat les cartes. Donneur : toi · Donne 1 sur 3 · 5 cartes · Bruno commence. », five new cards, the exchange prompt.

On the phone the plank uses its two columns: the result and the team on the left, the score, stats, vote row and buttons on the right. Nothing is cut. The fit at 750 × 342, 480 × 320 and 1280 × 800 is checked by the spec.

## Commits

| Commit | Type | What |
|--------|------|------|
| 6fee617 | test | RED: protocol 4, rematch.test.ts, the leak property votes after each win, workerd rematch.test.ts |
| f7a8c3f | feat | rematch.ts, finished, votes, the rematch start, the test start position |
| 2f2593f | test | RED: record cases (core), workerd record.test.ts |
| 0c29bf6 | feat | record.ts (core and worker), migration, env.d.ts, GameRoom writes, test D1 |
| adf8f9c | test | RED: votes.test.ts |
| bcd6d3b | feat | EndScreen online mode, votes.ts, the rematch flow, « Quitter la table » |
| c173d87 | test | revanche.spec.ts |
| c586c6a | test | remoteGame stops at the rematch's game number |
| 20c79c7 | test | the whole-game workerd tests report the close code on a missing reply |

## Verification (exact counts)

The suites ran one after another, never at the same time.

- `pnpm typecheck && pnpm lint && pnpm test`:
  - svelte-check: 490 files, 0 errors, 0 warnings.
  - Biome: 279 files, no fixes.
  - Vitest: **83 files, 1 305 passed, 2 skipped** (1 265 + 2 at the end of 02-08). Three full runs in a row were green; the first gate run had one failure (see Deferred Issues).
- `pnpm exec vitest run --project worker`: 10 files, 29 passed.
- Full local Playwright (phone + desktop): **455 passed, 99 skipped, 0 failed**, the same as 02-08.
- Online Playwright (`playwright.online.config.ts`, all specs): **44 passed, 0 failed**: 38 before plus revanche.spec.ts 6 (3 tests × phone, desktop).
- `wrangler deploy --dry-run -c wrangler.embarque.jsonc` (nothing deployed): only `env.GAME_ROOM` is bound; `tools/check-bundle.mjs` reports 42 separate modules, all from the web build.
- Nothing listens on 8787 or 4173 afterwards (checked in /proc/net/tcp), and no wrangler, workerd or preview process is left.

## D1: what is configured, and how to turn it on

- **Chosen:** no `d1_databases` block in either wrangler config, so no `database_id` in the repository (the plan's prohibition) and no auto-provisioning on deploy. The embedded deploy builds exactly as before (dry run above).
  - `DB` is optional (`apps/worker/src/env.d.ts`). Without it, every finished game is « skipped » (one log line per object instance) and the game is never blocked.
  - No Cloudflare resource was created, and no remote `wrangler d1` command was run.
- **To turn it on in production (plan 02-10, once the token has D1 Edit):**
  1. `pnpm exec wrangler d1 create toc-games` (or the name 02-10 picks), and note its `database_id`.
  2. Add the same block to **both** `wrangler.jsonc` and `wrangler.embarque.jsonc`: `"d1_databases": [{ "binding": "DB", "database_name": "toc-games", "database_id": "<id>", "migrations_dir": "apps/worker/migrations" }]`. Extend `tools/wrangler-configs.test.ts` to require the two blocks to be equal.
  3. `pnpm exec wrangler d1 migrations apply toc-games --remote -c wrangler.jsonc`, which creates `games` and its index.
  4. `pnpm --filter @toc/worker types` to regenerate `worker-configuration.d.ts` (it then declares `DB: D1Database`), and **delete `apps/worker/src/env.d.ts`**, whose optional `DB` would clash with the generated one. In `apps/worker/test/env.d.ts` keep only `TEST_MIGRATIONS`.
  5. Deploy as usual. Games that ended before step 5 are not recorded later: « skipped » is final.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Protocol version 3 → 4**
- **Issue:** a page of version 3 parses `TablePublic.status` with an enum without « finished ». It would silently drop every table frame from the end of a game on.
- **Fix:** `PROTOCOL_VERSION = 4` (older pages get 4002); hello is `v: 4` in the workerd tests.
- **Commit:** 6fee617, f7a8c3f

**2. [Rule 2 - Missing] The sweep while finished**
- **Issue:** with the sweep limited to playing or paused, a locked phone at the plank would hold everyone's rematch for as long as its socket stayed open.
- **Fix:** `wantsSweep` includes finished.
- **Commit:** f7a8c3f

**3. [Rule 2 - Missing] A leave or a socket gone may start the rematch**
- **Issue:** the plan names the vote as the trigger. But if A agreed and B then leaves, nobody online is left to vote.
- **Fix:** `gone` and `leave` at a finished table drop the vote and run `maybeStartRematch` too, so the order of events does not matter.

**4. [Rule 2 - Missing] Two games pending in D1**
- **Issue:** a rematch won before the first record was written would overwrite a single pending record.
- **Fix:** `Table.records` is a list, one per game number.

**5. [Rule 3 - Blocking] Files outside the plan's list**
- `apps/worker/test/apply-migrations.ts`: the setup file that applies the migrations before each test file.
- `apps/worker/test/env.d.ts`: the tests' `DB` and `TEST_MIGRATIONS` types.
- `apps/worker/test/helpers.ts`: `NEAR_END`, `closeCode()`.
- `packages/table/src/{presence,summary,index}.ts`.
- `packages/table/test/leak.test.ts`: the leak property now votes after each win.
- `apps/web/src/net/connection.svelte.ts`.
- `apps/web/src/net/{chat,notices,plate,remoteGame}.test.ts` fixtures.
- `remoteGame.test.ts` (a new case).

**6. [Scope] The second e2e table**
- **Issue:** the plan says « B's page closes before the end ». Closing it before the winning move would pause the game, and Ana could not play it without the pause plate's hand-over.
- **Fix:** Bruno's page closes at the plank, before the vote. That is the UI-SPEC case « A human offline at that moment ». Ana's vote alone starts the rematch, the jaune rider shows the bot badge, and Bruno's reopened link gives the seat back with « Tu reprends ta place ».
- **Also:** « Quitter la table » is tested from Bruno's plank (home, no row in « Mes parties en cours », Ana's jaune disc offline) rather than Ana's, which covers the same path.

**7. [Scope] No `d1_databases` block in the configs**
- **Why:** the plan forbids a database_id here and the orchestrator forbids creating resources. A block without an id could make wrangler provision a database on deploy.
- **Instead:** the binding is optional and documented above for 02-10.

### Deferred Issues

- **The intermittent workerd « timed out waiting for … events after its act ».**
  - **What happened:** the first gate run of this plan failed once in `bots.test.ts` with the same symptom as 02-07's and 02-08's `leak.test.ts` failure. The last frames were `table, events 310, table`. The act at 310 got neither its events nor any error frame, so the frame never reached the table, or the socket was gone. The 60 s wait is not tight.
  - **Ruled out:** the auto-response timestamp after an eviction. A workerd probe showed it survives `evictDurableObject`, so the 75 s sweep is not the cause.
  - **Not reproduced:** three full `pnpm test` runs in a row were green.
  - **Not done:** a longer timeout or fewer iterations would not fix a lost reply.
  - **Done:** both tests now report the client's close code and the stored table's status and seq, so the next occurrence names its cause.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model:
- **T-02-36:** the row holds a hash of the table id, first names, kinds, levels, counts and times. `record.test.ts` checks it has no table id, token, person id or card.
- **T-02-37:** game_id primary key with ON CONFLICT DO NOTHING; the record is written again and a retry alarm runs with it pending, and there is still one row.
- **T-02-38:** only seated people vote; computers count as yes; the start needs every online person.
- **T-02-39:** `before` is parsed only in `parseCreateTestOptions`, which the Worker calls only under TOC_TEST_MODE; the config test still forbids TOC_TEST_MODE in the deploy configs.
- **T-02-SC:** no package added.

## Not done here (left to the orchestrator)

STATE.md, ROADMAP.md and REQUIREMENTS.md were not touched (orchestrator instruction); PLAY-07 and HIST-01 are listed in `requirements-completed` above.

## À confirmer par Romain

- **Someone offline when the others agree:** the computer plays their seat at « Galopeur » for the rematch, and they get it back when they return (UI-SPEC « à confirmer »).
- **Leaving the plank starts the rematch for the others:** a player who leaves, or whose phone goes silent for 75 s, no longer holds the vote. If everyone else had agreed, the new game starts at once without them.
- **The first dealer of a rematch** is the seat after the previous game's first dealer (A6).
- **A game that ends before the database exists** is never recorded later.
- **No quick messages on the plank** (unchanged from 02-08).

## Self-Check: PASSED
