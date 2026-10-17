---
phase: 02-jouer-en-ligne-entre-proches
plan: 01
status: complete
subsystem: online-table
tags: [cloudflare-workers, durable-objects, sqlite, websocket-hibernation, zod, partysocket, svelte5, playwright, workerd]

requires:
  - phase: 01-une-vraie-partie-sur-un-appareil
    provides: "@toc/engine (apply, startGame, viewFor, eventsFor), @toc/board (eventsDuration), the session, the Director, the game screen"
  - phase: 03-l-ordinateur-la-force-choisie
    provides: "@toc/bots chooseAction (pure, PlayerView only), DEFAULT_BOT_LEVEL"
provides:
  - "@toc/protocol: zod/mini client frames (hello, sit, start, act) and server frames (welcome, events, table, error), PROTOCOL_VERSION, close codes 4001/4002/4004, table id, device token and first-name rules"
  - "@toc/table: pure reducer reduce(table, command, ctx) for hello, sit, start, act, gone, tick; the only frame builders (welcomeFor, eventsFrameFor, tablePublic) from viewFor/eventsFor; computer deadline; nextDeadline"
  - "apps/worker: handleRequest router (POST /api/tables, GET /ws/table/:id) and the SQLite-backed GameRoom Durable Object (hibernating sockets, attachments, one alarm, snapshot + event log)"
  - "Both deploy configs carry GAME_ROOM and the v1 new_sqlite_classes migration; a test keeps them in sync"
  - "Web: device identity toc.device.v1, partysocket table connection, createRemoteGame (GameController over the socket), createSession(makeController), Game online prop, #/table/<id> route (first name, connecting, waiting room, notices)"
  - "playwright.online.config.ts (wrangler dev + TOC_TEST_MODE) and its first two-browser spec"
affects: [02-02, 02-03, 02-04, 02-05, 02-06, 02-07, 02-08, 02-09, 02-10]

actuals:
  tokens: 34863    # chars/4 of the hand-written added lines (lockfile 5306 and the generated worker-configuration.d.ts 156587 excluded, reported apart)
  tasks: 2         # Task 1 approved before execution (02-CONTEXT « Package approval »), Task 2 executed
  commits: 3
plan_head_before: 39462f9c4b1bb202d8ba87c23acea602afe731c4
plan_head_after: 12dd8051adb8add74de0fd504fa361992593edac

tech-stack:
  added: ["wrangler 4.151.1", "@cloudflare/vitest-plugin 1.4.4", "zod 4.6.7 (zod/mini)", "partysocket 1.3.0"]
  patterns:
    - "Pure table reducer, thin Durable Object shell: reduce → synchronous SQLite commit → per-person sends → one alarm"
    - "Every server frame built in packages/table/src/frames.ts from viewFor/eventsFor or public data only"
    - "A person is SHA-256(tableId:token), computed in the DO; the token travels only in hello"
    - "Vitest projects: node + worker (workerd via cloudflareTest)"

key-files:
  created:
    - packages/protocol/src/frames.ts
    - packages/protocol/src/names.ts
    - packages/table/src/table.ts
    - packages/table/src/reduce.ts
    - packages/table/src/frames.ts
    - apps/worker/src/index.ts
    - apps/worker/src/GameRoom.ts
    - apps/worker/src/storage.ts
    - apps/worker/vitest.config.ts
    - apps/worker/worker-configuration.d.ts
    - apps/web/src/net/device.ts
    - apps/web/src/net/connection.svelte.ts
    - apps/web/src/net/remoteGame.ts
    - apps/web/src/routes/Table.svelte
    - apps/web/src/ui/NamePrompt.svelte
    - apps/web/src/i18n/fr/accueil.ts
    - apps/web/src/i18n/fr/table.ts
    - apps/web/playwright.online.config.ts
    - apps/web/e2e-online/online.ts
    - apps/web/e2e-online/tracer.spec.ts
    - tools/wrangler-configs.test.ts
    - packages/bots/src/names.ts
  modified:
    - package.json
    - pnpm-lock.yaml
    - biome.json
    - vitest.config.ts
    - wrangler.jsonc
    - wrangler.embarque.jsonc
    - worker-embedded/index.js
    - apps/web/package.json
    - apps/web/vite.config.ts
    - apps/web/tsconfig.json
    - apps/web/src/App.svelte
    - apps/web/src/game/session.svelte.ts
    - apps/web/src/routes/Game.svelte
    - apps/web/src/game/botNames.ts
    - packages/bots/src/index.ts

key-decisions:
  - "BOT_NAMES moved to @toc/bots now (planned for 02-03): the pure table core names its computers and cannot import apps/web; apps/web/src/game/botNames.ts re-exports it"
  - "An unseated newcomer's hello sends nothing to the others: TablePublic (as planned) lists seats, not unseated people; 02-05 adds « Sans place » if wanted"
  - "Seated players get a table frame (status playing, horse names) then their events frame at the start; table frames go out whenever the public table changes, which also carries the thinking seat"
  - "The remote controller buffers frames until the screen calls start(), so the opening deal is played before what followed it"
  - "@toc/protocol depends on @toc/engine (workspace) for COLORS and the Action/PlayerView/GameEvent types; zod is its only external dependency"
  - "base64url is hand-written in @toc/protocol (no btoa in the ES2022 lib, same output in Node, workerd and browsers)"

patterns-established:
  - "Online specs: apps/web/e2e-online with playwright.online.config.ts; tables created with POST /api/tables {test:{pace:'zero'}} under TOC_TEST_MODE=1"
  - "Comparing two screens: tablePicture(page) = knights by logical place + felt cards + discard size, keys sorted"

requirements-completed: [NET-01, RULE-19]

coverage:
  - id: D1
    description: "Two browsers open one table link, type a first name, take Bleu and Jaune, the creator starts, both pass a card, and a move on one shows on the other"
    requirement: NET-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/tracer.spec.ts (phone, desktop) via playwright.online.config.ts"
        status: pass
  - id: D2
    description: "Each socket receives only its own hand; no frame carries a token, a token hash, a GameState, the rng or the talon"
    requirement: RULE-19
    verification:
      - kind: unit
        ref: "packages/table/src/reduce.test.ts#seats Galopeur horses on the free seats and deals each person only their own hand"
        status: pass
      - kind: integration
        ref: "apps/worker/test/room.test.ts#joins, seats, starts, deals each hand to its owner only, and plays through evictions"
        status: pass
  - id: D3
    description: "The Durable Object survives eviction between every step (SQLite snapshot, hibernating sockets, alarm-driven computers); unknown ids close with 4004 and write nothing"
    requirement: NET-01
    verification:
      - kind: integration
        ref: "apps/worker/test/room.test.ts"
        status: pass
  - id: D4
    description: "Both wrangler configs declare the same GameRoom binding and v1 SQLite migration, and never TOC_TEST_MODE"
    verification:
      - kind: unit
        ref: "tools/wrangler-configs.test.ts"
        status: pass

duration: 33min
completed: 2026-10-17
---

# Phase 2 Plan 01: Traceur en ligne Summary

**Two browsers join one table by its `#/table/<id>` link and play the same game through a SQLite-backed `GameRoom` Durable Object: zod/mini frames, a pure table reducer whose only frame builders are `viewFor`/`eventsFor`, hibernating sockets, one alarm for the computer players, and a remote `GameController` that plugs into the existing session and Director.**

## Performance

- **Duration:** about 33 min (2026-10-17T06:33:06Z to 07:06Z, SUMMARY after)
- **Tasks:** 2 (Task 1 approved beforehand, Task 2 the tracer)
- **Files:** 53 changed in the plan's three commits (lockfile and the generated Env types included)

## Package legitimacy (Task 1)

Approved by Romain before any install, recorded in 02-CONTEXT.md « Package approval (2026-10-17) ». His reply, verbatim, to « Pour le jeu en ligne, j'ai besoin d'ajouter 5 outils libres… Tu valides leur installation ? »:

> « Oui, les 5 (Recommandé) »

Installed in this plan, exact pins: `wrangler 4.151.1` (root devDependency), `zod 4.6.7` (@toc/protocol), `partysocket 1.3.0` (@toc/web), `@cloudflare/vitest-plugin 1.4.4` (@toc/worker devDependency). `uqr 0.1.3` is approved but not installed here (plan 02-05). vitest stays on `^4.1.11` (4.1.11 installed).

pnpm's ignored-builds notice, on each install: « Ignored build scripts: esbuild@0.28.2, workerd@1.20261012.1. Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts. » Not approved: the workerd tests and `wrangler dev` run without them, as the research spike found.

## Accomplishments

- `@toc/protocol` (zod/mini): strict client frames with the six engine action shapes, the 4096-character cap checked before `JSON.parse`, name normalization (NFC, white space collapsed, control and bidi characters removed, 1 to 20 code points), table id (22 base64url) and device token (43 base64url) rules, server frames with an envelope check.
- `@toc/table`: the pure reducer. First hello makes the creator (host); sit/seat-taken/started; start by the seated host only, free seats become Galopeur horses (first dealer, then names, from the table's bot stream as in `createGame`), deal from `ctx.seed()`; act checks base (stale → error + welcome to that person only), `apply` is the only judge (illegal → code only, table unchanged), each seated person gets `eventsFor`/`viewFor`; the bot deadline is `now` under the zero test pace, else `now + eventsDuration(last batch)`; a tick plays one computer action with `chooseAction(viewFor(state, bot))`. Purity guard on `packages/table/src`.
- `apps/worker`: `handleRequest` (POST /api/tables → 201 `{ id }` from 16 random bytes; WS upgrade: 426 without Upgrade, 404 on a malformed id before any `getByName`, 403 on a foreign Origin; other `/api` → 404); `GameRoom` with `acceptWebSocket`, attachments `{ who, helloAt }`, ping/pong auto-response, `create` RPC, unknown ids closed 4004 with nothing written, version mismatch 4002, a second socket of the same device closes the older one 4001, `run()` = reduce → synchronous commit → per-person sends → `setAlarm`/`deleteAlarm` only on change. No timer function.
- Configs: `wrangler.jsonc` gains `main`, `assets.binding`, `run_worker_first ["/api/*", "/ws/*"]`, the DO binding and migration; `wrangler.embarque.jsonc` the same two blocks; `worker-embedded/index.js` tries `handleRequest` first and re-exports `GameRoom`.
- Web: `toc.device.v1` (validated like the settings), partysocket connection (`maxEnqueuedMessages: 0`, no reconnect on codes ≥ 4000, hello on every open), `createRemoteGame`, `createSession(env, debug, colour, makeController)`, `Game` online prop (board turned to the server's seat, no « Abandonner », end plank leads home), `Table.svelte` (first name, connecting, waiting room with `data-seat-tile`/`data-seat-state`, « Lancer la partie » for the seated host, notices for 4004, 4001, 4002 and a started table), Vite proxy for `/api` and `/ws`.

## Commits

| Commit | Type | What |
|--------|------|------|
| 338f032 | chore | The four packages pinned exactly, scaffolds of @toc/protocol, @toc/table, @toc/worker |
| 1cc1b8e | test | RED: protocol, reducer, purity, workerd, config sync, device, remote controller, online e2e |
| 12dd805 | feat | GREEN: protocol, table core, Worker and GameRoom, configs, web connection, route and session seam |

## Verification (exact counts)

- `pnpm typecheck`: exit 0 (8 workspace projects incl. `@toc/worker`; svelte-check 445 files, 0 errors, 0 warnings).
- `pnpm lint`: exit 0, 220 files, 0 errors, 0 warnings.
- `pnpm test` (vitest, projects node + worker): **58 files, 1011 passed, 2 skipped** (baseline 954 passed, 2 skipped; +57 new: protocol 11, table reducer 14, table purity 3, device 7, remote game 8, wrangler configs 5, worker 7 in workerd, and the typography guard's one case per new catalogue file, accueil.ts and table.ts; the existing suites unchanged).
- `pnpm exec vitest run --project worker`: 7 passed (the scenario test evicts the object before every step).
- `playwright test -c playwright.online.config.ts e2e-online/tracer.spec.ts`: **2 passed** (phone, desktop); also 6/6 with `--repeat-each 3`.
- `playwright test e2e/partie.spec.ts e2e/tracer.spec.ts`: 27 passed, 1 skipped (the existing keyboard-only case on phone).
- Full local Playwright: **416 passed, 96 skipped, 0 failed** (same as baseline).
- `node tools/rules-trace.mjs`: OK (16 règles, 122 scénarios).
- `wrangler deploy -c wrangler.embarque.jsonc --dry-run --outdir …` (after `node tools/build-embedded-worker.mjs`): bindings list `env.GAME_ROOM (GameRoom) Durable Object`, total 1901.06 KiB / gzip 966.40 KiB; only the web build's JS files are separate text modules, zod and the server code are inlined. No deploy.

### wrangler dev

Started by the online Playwright config (and once by hand to read its output), from the repository root:

```
VITE_TOC_DEBUG=1 pnpm --filter @toc/web build
WRANGLER_SEND_METRICS=false pnpm exec wrangler dev -c wrangler.jsonc --port 8787 --var TOC_TEST_MODE:1 --show-interactive-dev-session=false
```

Bindings shown: `env.GAME_ROOM (GameRoom) Durable Object local`, `env.ASSETS Assets local`, `env.TOC_TEST_MODE ("(hidden)") Environment Variable local`. Warnings: « Proxy environment variables detected. We'll use your proxy for fetch requests. » and twice « [wrangler:warn] Unable to fetch the `Request.cf` object! Falling back to a default placeholder… » (no outbound access to Cloudflare from the sandbox; harmless locally). The workerd tests print workerd's own « NOSENTRY SQLite alarm handler canceled… / alarm overdue, running despite AlarmManager mismatch » lines when `runDurableObjectAlarm` races the alarm that is already due under the zero test pace; the tests pass.

## How two browsers join a table locally

1. `VITE_TOC_DEBUG=1 pnpm --filter @toc/web build`, then from the repository root `pnpm exec wrangler dev -c wrangler.jsonc --port 8787` (add `--var TOC_TEST_MODE:1` for instant computers with a `{ "test": { "pace": "zero" } }` body).
2. `curl -X POST http://localhost:8787/api/tables` → `{"id":"<22 characters>"}`.
3. Open `http://localhost:8787/#/table/<id>` in two browsers (or a normal and a private window): each types a first name, taps a free colour; the first one who said hello sees « Lancer la partie ».

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Horse names moved to @toc/bots ahead of 02-03**
- **Found during:** Task 2 (table core)
- **Issue:** the pure table core must name its computers with the same horses as the local game, but BOT_NAMES lived in apps/web, which a package cannot import.
- **Fix:** `git mv apps/web/src/game/botNames.ts packages/bots/src/names.ts`, exported from `@toc/bots`; `apps/web/src/game/botNames.ts` re-exports it (GameController and its tests unchanged). Plan 02-03 finds this part already done (it still moves `pace.ts`).
- **Files:** packages/bots/src/names.ts, packages/bots/src/index.ts, apps/web/src/game/botNames.ts
- **Commit:** 12dd805

**2. [Rule 3 - Blocking] Biome scanned generated files**
- **Issue:** Biome's VCS integration is off, so it linted `apps/worker/worker-configuration.d.ts` (generated, 16 k lines) and the `.wrangler/tmp` bundles `wrangler dev` leaves behind.
- **Fix:** both excluded in `biome.json`.
- **Commit:** 12dd805

**3. [Rule 1 - Bug] Test corrections made during GREEN (in the feat commit)**
- The reducer test expected a table frame to the creator when an unseated newcomer says hello; nothing public changes then (TablePublic lists seats only), so the test now expects none, and the workerd scenario no longer waits for that frame.
- The workerd scenario needed a 60 s timeout (it plays the exchange and two plays with an eviction before each step) and a predicate on `next()` so it waits for the events frame of its own act, not an earlier computer frame.
- The e2e compared knights with `JSON.stringify` of objects whose key order follows each board's drawing order; the helper now sorts by knight, and compares knights plus felt cards plus discard size, because the first human move can be a dead hand that moves no knight (seen on the phone project).
- `structuredClone` and `btoa` are not in the ES2022 lib the packages typecheck with: the reducer copies through JSON (the table is JSON by design) and base64url is hand-written.

**4. [Rule 2 - Critical] Origin check on table creation and Vite proxy origin**
- POST /api/tables also refuses a foreign Origin (403), like the upgrade; the Vite dev proxy presents `http://localhost:8787` as Origin for `/api` and `/ws` so `vite dev` next to `wrangler dev` passes the check.

**5. [Scope] Extra notices on the table route**
- Besides « Cette table n’existe plus » (4004) and « Connexion à la table… », the route shows the UI-SPEC notices for 4001 (« Partie ouverte ailleurs »), 4002 (« Nouvelle version du jeu ») and a started table without a seat (« La partie a déjà commencé »), so a closed connection never leaves a blank screen. Copy from 02-UI-SPEC, in `i18n/fr/table.ts`.

## Known Stubs

Intentional, each resolved by a later plan of this phase:

| Where | What | Resolved by |
|-------|------|-------------|
| apps/web/src/routes/Table.svelte | Waiting room is the tracer's: four seat tiles and « Lancer la partie »; no strength picker, invite sheet, move sheet, « Libérer ma place », rotate gate or layouts of the UI-SPEC | 02-05 |
| apps/web/src/routes/Table.svelte | The first-name prompt's context line is the generic « Tu as reçu une invitation… » (no GET /api/tables/:id yet to name the creator) | 02-04 |
| apps/web/src/routes/Game.svelte | Online: no « Abandonner la partie »; the end plank's two buttons lead to `#/` | 02-07 (stop, leave), 02-09 (« Revanche », « Quitter la table ») |
| packages/table/src/reduce.ts | No pause on disconnect, no heartbeat sweep, no host hand-over; the computers act without think time | 02-06, 02-03 |

None of these blocks this plan's goal (two devices, one table, server-validated moves, own hand only).

## Threat Flags

None beyond the plan's threat model: the new surface is exactly POST /api/tables and /ws/table/:id (T-02-03, T-02-04, T-02-05, T-02-07 mitigated as planned).

## Self-Check: PASSED

- Files: packages/protocol/src/frames.ts, packages/table/src/reduce.ts, apps/worker/src/GameRoom.ts, apps/worker/src/index.ts, apps/web/src/net/remoteGame.ts, apps/web/src/routes/Table.svelte, tools/wrangler-configs.test.ts, apps/web/e2e-online/tracer.spec.ts: all present.
- Commits 338f032, 1cc1b8e, 12dd805: all ancestors of HEAD.
