# Phase 2: Jouer en ligne entre proches - Research

**Researched:** 2026-10-17
**Domain:** Server-authoritative realtime card/board game on Cloudflare Workers + SQLite-backed Durable Objects (WebSocket Hibernation, alarms), shared pure TypeScript engine/bots, Svelte 5 client
**Confidence:** HIGH for platform mechanics (verified by spikes run in this container against workerd/wrangler 4.151.1) and for the codebase seams; MEDIUM for free-plan CPU behaviour and real-phone background behaviour (need a real-device / deployed check).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Implementation Decisions (Romain, 2026-10-17)**

*Identity and joining*
- **D-01:** No account yet. On opening a table link, the player types a first name once; the device remembers it, plus a private device token, so a reconnect finds the same seat. Romain: « Un prénom, retenu par l'appareil (Recommandé) ». Phase 4 accounts will replace it. — **Reversibility:** costly — the seat-ownership model (device token) will be migrated to accounts in phase 4.
- **D-02:** Inviting is by a link to share (plus a QR code), sent by SMS/WhatsApp; whoever opens it joins the table. Romain: « Lien à partager (Recommandé) ». The table id must be unguessable.
- **D-03:** Seats: in the waiting room each person takes a free colour; the creator can move people and sets the computer strength for the remaining seats (reuse phase 3's strength picker), then starts the game. Romain: « Chacun choisit, le créateur peut changer (Recommandé) ».

*Disconnects, pause and resume*
- **D-04:** When a human disconnects, the game pauses for everyone. After **1 minute**, the creator chooses: wait more, hand the seat to the computer (the player gets it back on return), or save the game. Romain: « 1 minute (Recommandé) ». Timers use Durable Object alarms, never setTimeout.
- **D-05:** If the creator is the one disconnected, the role passes to the next connected player and comes back to the creator on return. Romain: « Le joueur suivant (Recommandé) ».
- **D-06:** A stopped or saved game is found again by the same table link and by a « Mes parties en cours » list on the home screen of that device. Saved games are kept **30 days** without activity, then deleted. Romain: « Même lien + liste sur l'accueil (Recommandé) », « 30 jours (Recommandé) ».

*Chat, end of game*
- **D-07:** Chat is **quick messages only** — no keyboard: a set of ready-made French messages/reactions (e.g. « Bien joué ! », « Aïe », « À toi », « Merci partenaire »…). Romain: « Messages rapides seulement ». This narrows NET-05 (« chat texte ») — record it in REQUIREMENTS as Romain's choice. Bonus: no moderation of free text needed.
- **D-08:** At the end, the winning team is announced to all; « Revanche » restarts with the same seats and teams once everyone agrees. Romain: « Mêmes places (Recommandé) ».

*Scope around it*
- **D-09:** The local game against the computer stays: home screen shows « Jouer contre l'ordinateur » (as today, works offline) and « Créer une table en ligne ». Romain: « Oui, deux boutons (Recommandé) ».
- **D-10:** No spectators for now. Romain: « Non, pas pour l'instant (Recommandé) ».

### Claude's Discretion
- Protocol details (Zod-validated messages, per-seat projection so no hand ever leaks, event log + snapshot in DO SQLite), reconnection with partysocket, bot pacing inside the DO via alarms, the HIST-01 game-end record (D1 table, written once), table id format, QR code generation (no new heavy dependency), the exact quick-message list (« à confirmer par Romain »), the waiting-room and pause UI in the galet style.

### Deferred Ideas (OUT OF SCOPE)
- Free-text chat (Romain chose quick messages only).
- Spectators.
- Accounts/friends (phase 4), history/stats UI (phase 5).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|----|-------------------------------|------------------|
| RULE-19 | Chaque joueur ne connaît que sa propre main ; les cartes jouées sont publiques ; le serveur n'envoie jamais à un client la main d'un autre joueur. | Pattern 4 (every outbound frame built only from `viewFor`/`eventsFor`), Pitfall 1, the leak-oracle property test (Validation map SC2). |
| NET-01 | Quatre joueurs sur des téléphones ou ordinateurs différents jouent la même partie en temps réel ; le serveur valide chaque coup. | Patterns 1-3 (pure table core + GameRoom DO + `apply` as the only validator), Pattern 8 (bots for empty seats), Pattern 14 (client). |
| NET-02 | Un joueur qui recharge la page ou perd le réseau retrouve la partie dans son état exact en se reconnectant. | Pattern 5 (device token + `hello` → `welcome` snapshot), partysocket reconnect, Director `reset(view)`. |
| NET-03 | Quand un humain se déconnecte, la partie se met en pause et tous les joueurs le voient. | Pattern 7 (presence from sockets + heartbeat sweep via `getWebSocketAutoResponseTimestamp`), Pitfall 5. |
| NET-04 | Après un délai, le créateur choisit : attendre encore, confier la place à l'ordinateur, ou sauvegarder. | Pattern 3 (deadline queue, 60 s `pauseChoice` deadline), Pattern 6 (host role D-05), Pattern 7. |
| NET-05 | Les joueurs d'une table échangent par chat texte pendant la partie. **Narrowed by D-07 to quick messages** — the plan must update REQUIREMENTS.md NET-05 and ROADMAP SC5 wording. | Pattern 10 (enum of message ids validated server-side, rate-limited). |
| PLAY-07 | À la fin, l'équipe gagnante est annoncée et les joueurs peuvent relancer une revanche à la même table. | Pattern 11 (rematch votes, same seats, new seed, `gameNo + 1`). |
| HIST-01 | Une partie peut être interrompue puis reprise plus tard dans l'état exact où elle était. | Pattern 2 (snapshot row per action in DO SQLite = exact resume), Pattern 9 (stop/save, same link, « Mes parties en cours », 30-day expiry), Pattern 12 (D1 game-end record, idempotent). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Hosting is Cloudflare: Workers, **SQLite-backed Durable Objects** for live tables, D1 for cross-table records. KV is wrong for history. Pages is not to be used for new work.
- WebSockets use the **Hibernation API** (`ctx.acceptWebSocket`, `webSocketMessage`, `serializeAttachment`); **no `setTimeout`/`setInterval` in the DO** — use `ctx.storage.setAlarm()`; all state in SQLite; in-memory fields are caches only.
- Server is authoritative; **never trust the client** for rules or hands; **per-seat projection** of every message (hands and the partner-swap card hidden).
- **Zod** validates every WebSocket message and API body, schemas shared from a protocol package.
- `partysocket` on the client only; no PartyServer, no `agents` SDK, no Socket.IO.
- Vitest pinned to the 4.1 line (`vitest@^4.1.11`), not unpinned latest. (Update: the Workers pool package was renamed — see State of the Art.)
- Ping/pong through `ctx.setWebSocketAutoResponse` so heartbeats do not wake the DO.
- Bots run in the DO with CPU budgets; one compact snapshot UPSERT per move (row-write budget).
- Secrets through `wrangler secret`, never in `wrangler.jsonc`.
- UI in French; the board « galet », landscape-only (« paysage obligatoire ») on phone and desktop.
- No raw HTML sinks in `apps/web/src` (enforced by `apps/web/src/no-raw-html.test.ts`): any QR code or chat text must be rendered as Svelte nodes, never `{@html}`.
- GSD workflow: changes go through GSD commands. **Concurrency note for the planner:** plan 03-11 is editing `apps/web` on the same tree right now; phase-2 plans that touch `apps/web` (moving `pace.ts`/`botNames.ts`, session seam, routes) must run after 03-11 is merged.

## Summary

Everything this phase needs already exists in pure form: the engine's `apply` validates every move and throws `IllegalActionError`, `viewFor(state, seat)` and `eventsFor(events, seat)` are the only projection functions and already strip other seats' cards (including the exchanged card), the bots are pure functions of a `PlayerView` with work budgets, `@toc/board` exports a pure `eventsDuration(events, mode)` that tells the server how long a play animates, and the client's Director accepts `enqueue(events)` and `reset(view)`. The phase is therefore mostly a **shell**: a pure table state machine (lobby, host role, pause, hand-over, save, rematch, chat, deadlines) wrapped by one SQLite-backed `GameRoom` Durable Object per table, a thin Worker router, a shared Zod protocol package, and a remote implementation of the client's `GameController` contract.

The platform mechanics were verified in this container, not just read: a spike with wrangler 4.151.1 and `@cloudflare/vitest-plugin` 1.4.4 on vitest 4.1.11 ran a SQLite DO with a hibernatable WebSocket, evicted it with `evictDurableObject` (the socket and its attachment survived), fired an alarm with `runDurableObjectAlarm`, and answered `"ping"` with `"pong"` through `setWebSocketAutoResponse` under `wrangler dev`. The real engine, bots and board bundle into a DO at 77.68 KiB (20.57 KiB gzip), and a full Champion self-play game ran inside workerd. The embedded-assets deploy variant (`wrangler.embarque.jsonc`) accepts a DO binding plus a `new_sqlite_classes` migration when its JS entry imports the TypeScript server module (dry-run and `wrangler dev` both succeeded).

Two findings change the plan relative to CLAUDE.md: `@cloudflare/vitest-pool-workers` is **deprecated and renamed `@cloudflare/vitest-plugin`** (1.4.4, peers `vitest ^4.1.0 || ^5.0.0`, config through a `cloudflareTest()` Vite plugin); and on the **Workers Free plan a DO invocation is held to the Workers CPU limit (10 ms)**, while the Champion needs p50 ≈ 49 ms and max ≈ 518 ms of CPU per decision (levels 2-4: p95 ≈ 11 ms) on this machine — so Romain's Cloudflare plan must be confirmed before planning the bot slicing strategy.

**Primary recommendation:** Build `packages/protocol` (zod/mini schemas) + `packages/table` (pure table reducer with an explicit `now`, emitting per-seat outboxes and deadlines) first, prove "no hidden card in any frame" with a fast-check property test on the pure core, then wrap it in a thin `apps/worker` `GameRoom` DO (SQLite snapshot + event log + deadline table + one alarm) and a `RemoteGame` client that plugs into the existing session/Director.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rules, shuffle/deal, move validation | DO (`GameRoom` → `@toc/engine.apply`) | — | Server-authoritative (NET-01); the deck seed comes from `crypto.getRandomValues` inside the DO. |
| Per-seat projection (no hidden card) | DO via pure `@toc/table` outbox (`viewFor`/`eventsFor`) | — | RULE-19: a frame is built for one seat or it is public; never a shared broadcast of state. |
| Table lifecycle (lobby, seats, host, pause, save, rematch, chat) | Pure `@toc/table` reducer | DO shell persists/sends | Pure = Node-testable with fast-check, deterministic with injected `now`. |
| Timers (bot think, 60 s pause deadline, presence sweep, 30-day expiry) | DO SQLite `deadlines` table + single alarm | Pure core computes deadlines | One alarm slot per DO; at-least-once delivery. |
| Bot decisions | DO alarm handler (`@toc/bots.chooseAction`) | — | Bots see `viewFor(state, bot)` only (BOT-04). |
| Socket identity (seat ownership) | DO (attachment `{seat, tokenHash, helloAt}`) | Client device token (localStorage) | D-01; no accounts until phase 4. |
| HTTP routes (create table, table summary, WS upgrade, Origin check) | Worker (`apps/worker/src/index.ts`) | — | Thin, stateless; forwards upgrades to `env.GAME_ROOM.getByName(id)`. |
| Static SPA | Workers static assets (`wrangler.jsonc`) or embedded files (`wrangler.embarque.jsonc`) | — | Two deploy configs, one server module. |
| Game-end record (HIST-01 support) | D1 `games` table written once by the DO | — | Cross-table history for phase 5; DO SQLite remains the resume source of truth. |
| Animation, sound, turn UI | Browser (existing Director, turnUi) | — | Fed by server events (`enqueue`) and snapshots (`reset`). |
| Reconnect/backoff, heartbeat | Browser (`partysocket/ws` + 20 s `"ping"`) | DO auto-response | Pings never wake the DO. |
| « Mes parties en cours », name, device token | Browser localStorage | Worker `GET /api/tables/:id` for status | D-06 list is per device. |
| QR code | Browser (lazy-loaded `uqr` matrix → Svelte SVG) | — | Rendered as nodes, no raw HTML. |

## Standard Stack

### Core (already in the repo — verified by reading the files this session)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@toc/engine` | workspace | `apply`, `startGame`, `viewFor`, `eventsFor`, `IllegalActionError` | The single rules implementation; erasable-syntax TS that wrangler/esbuild bundle as-is [VERIFIED: spike bundle 77.68 KiB]. |
| `@toc/bots` | workspace | `chooseAction`, `createThinker`, `CHAMPION_BUDGET`, `parseBotLevel` | Pure, PlayerView-only, work units not time [VERIFIED: packages/bots/src/thinker.ts:164-202]. |
| `@toc/board` | workspace | `eventsDuration(events, mode)` for server pacing | Same timing the Director animates with [VERIFIED: packages/board/src/motion.ts:174-183]. |
| svelte / vite / @sveltejs/vite-plugin-svelte | 5.57.2 / 8.3.4 / 7.3.1 | Client | Existing (`apps/web/package.json`). |
| vitest | 4.1.11 installed (`^4.1.11` in root package.json) | Unit + workerd tests | Existing [VERIFIED: node_modules/vitest/package.json]. |
| @playwright/test | 1.64.0 | Multi-context e2e | Existing (`apps/web/package.json`); Chromium preinstalled at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` per `apps/web/playwright.config.ts`. |
| typescript | 6.0.3 | Type-checking | Existing root devDependency (not 7.x). |

### To add (pin exact versions)

| Library | Version | Where | Purpose | Why |
|---------|---------|-------|---------|-----|
| wrangler | 4.151.1 | root devDependency | `wrangler dev`, `deploy`, `types`, D1 migrations | Not installed in the repo today (no `node_modules/.bin/wrangler`); the configs reference `./node_modules/wrangler/config-schema.json`. Same version `@cloudflare/vitest-plugin@1.4.4` depends on [VERIFIED: npm registry]. |
| @cloudflare/vitest-plugin | 1.4.4 | `apps/worker` devDependency | Run DO/D1 tests inside workerd (`cloudflareTest()` plugin, `cloudflare:test` helpers) | Successor of the deprecated `@cloudflare/vitest-pool-workers`; peers `vitest ^4.1.0 \|\| ^5.0.0` [VERIFIED: npm registry; spike passed]. |
| zod | 4.6.7 | `packages/protocol` dependency | Validate every client frame (server) and every server frame (client) | CLAUDE.md choice; import from `zod/mini` (tree-shakable functional API: `object`, `strictObject`, `discriminatedUnion`, `literal`, `array`, `safeParse`, checks `maxLength`/`maxSize`/`regex`) [VERIFIED: zod@4.6.7 tarball `v4/mini/schemas.d.ts`]. Zod 4 skips its `new Function` JIT on Cloudflare (`navigator.userAgent` includes "Cloudflare") [VERIFIED: zod `v4/core/util.js:218-230`]. |
| partysocket | 1.3.0 | `apps/web` dependency | Reconnecting WebSocket (`partysocket/ws` `ReconnectingWebSocket`, ~15 KB unminified, dep `event-target-polyfill`) | CLAUDE.md choice; options `maxEnqueuedMessages`, `shouldReconnectOnClose`, `reconnect()`, URL provider function [VERIFIED: partysocket@1.3.0 `ws.d.ts`]. |
| uqr | 0.1.3 | `apps/web` dependency, **dynamic import** | QR code: `encode(text) → { size, data: boolean[][] }` | Zero dependencies, ~27 KB unminified ESM, MIT, maintainers pi0/antfu (unjs). Use `encode()` and draw the matrix as one SVG `<path>` (no `renderSVG` string → no raw HTML) [VERIFIED: uqr@0.1.3 `dist/index.d.mts`]. |

### Not added in phase 2 (deliberate deviations from CLAUDE.md, with reasons)

| Listed in CLAUDE.md | Decision | Reason |
|---------------------|----------|--------|
| Hono | **Skip until phase 4** | Phase 2 has four routes (`POST /api/tables`, `GET /api/tables/:id`, `GET /ws/table/:id`, fallback). A 40-line `fetch` router is enough; Hono earns its place when better-auth mounts in phase 4. |
| @cloudflare/vite-plugin | **Skip in phase 2** | It changes the build layout (`dist/client` + generated worker config) that `tools/build-embedded-worker.mjs`, `vite preview` e2e and the embedded deploy rely on, while 03-11 edits `apps/web`. Use `wrangler dev` (serves built SPA + Worker + DO on one origin, verified) and a Vite `server.proxy` for `/api` and `/ws` (`ws: true`) during HMR dev. |
| @cloudflare/vitest-pool-workers 0.23.0 | **Replace by @cloudflare/vitest-plugin 1.4.4** | Deprecated: "has been renamed to @cloudflare/vitest-plugin. This package will not receive future updates." [VERIFIED: npm `deprecated` field]. |
| @cloudflare/workers-types | **Skip** | Use `wrangler types` (generates `Env` with `GAME_ROOM: DurableObjectNamespace<…GameRoom>` plus runtime types) [VERIFIED: spike]. |
| drizzle-orm / drizzle-kit | **Skip** | One D1 table, one idempotent INSERT; plain `env.DB.prepare(...).bind(...).run()` + a SQL migration file. Drizzle comes with better-auth in phase 4. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| uqr | qrcode-generator 2.0.4 | Older, larger (555 KB unpacked), callback API; fine but heavier. |
| uqr | hand-rolled QR | Reed-Solomon, masks, version tables: hundreds of lines and easy to get subtly wrong (see Don't Hand-Roll). |
| partysocket | hand-rolled reconnect | ~80 lines incl. backoff/jitter/timeouts; partysocket is small and maintained by Cloudflare. |
| wrangler dev + proxy | @cloudflare/vite-plugin | One `vite dev` with HMR for the Worker too; adopt in phase 4 if the build layout is reworked anyway. |

**Installation (when the plans run, after 03-11 is merged):**
```bash
pnpm add -Dw wrangler@4.151.1
pnpm --filter @toc/protocol add zod@4.6.7
pnpm --filter @toc/web add partysocket@1.3.0 uqr@0.1.3
pnpm --filter @toc/worker add -D @cloudflare/vitest-plugin@1.4.4
```
pnpm 10 prints "Automatically ignored builds: esbuild, workerd"; the spike's tests and `wrangler dev` worked without approving them [VERIFIED: spike]. Adding `"pnpm": { "onlyBuiltDependencies": ["esbuild", "workerd"] }` is optional.

**Version verification (npm registry, 2026-10-17):** wrangler 4.151.1 (2026-10-16), @cloudflare/vitest-plugin 1.4.4 (2026-10-16), zod 4.6.7 (2026-10-12), partysocket 1.3.0 (2026-06-23), uqr 0.1.3 (2026-04-03), @cloudflare/vite-plugin 1.64.0 (peers `wrangler ^4.151.0`), vitest latest 5.0.5 (the repo stays on 4.1.11).

## Package Legitimacy Audit

`gsd-tools query package-legitimacy check --ecosystem npm` returned **SUS** for every package below; the reasons were only `unknown-downloads` (the downloads API is not reachable from this sandbox) and, for some, `too-new` (their *latest* version is days old). No `postinstall` script on any of them; every repo URL is the expected official one.

| Package | Registry | Age (first publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|---------------------|-----------|-------------|---------|-------------|
| wrangler | npm | years (latest 1 day) | unknown | github.com/cloudflare/workers-sdk | SUS (too-new, unknown-downloads) | Approved — official Cloudflare CLI; pin 4.151.1 |
| @cloudflare/vitest-plugin | npm | 2026-08-20 (latest 1 day) | unknown | github.com/cloudflare/workers-sdk | SUS (too-new, unknown-downloads) | Approved — named by the deprecation notice of the official package; pin 1.4.4 |
| zod | npm | years (latest 5 days) | unknown | github.com/colinhacks/zod | SUS (too-new, unknown-downloads) | Approved — CLAUDE.md choice; pin 4.6.7 |
| partysocket | npm | years (latest 2026-06-23) | unknown | github.com/cloudflare/partykit | SUS (unknown-downloads) | Approved — CLAUDE.md choice; pin 1.3.0 |
| uqr | npm | 2023-08 (latest 2026-04-03) | unknown | github.com/unjs/uqr | SUS (unknown-downloads) | **Flagged** — discovered by name from training knowledge; planner adds `checkpoint:human-verify` before install |
| hono, @cloudflare/vite-plugin, @cloudflare/workers-types, qrcode-generator | npm | — | — | official repos | SUS | Not installed in phase 2 |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** all, for missing download data only; `uqr` is the one whose recommendation rests on training knowledge (`[ASSUMED]` provenance) — gate its install behind `checkpoint:human-verify`. The planner may treat the four Cloudflare/CLAUDE.md packages as approved by the project's own stack decision but should still pin them exactly.

## Architecture Patterns

### System Architecture Diagram

```
 Phone/PC browser (Svelte SPA)                         Cloudflare
 ┌─────────────────────────────────┐        ┌───────────────────────────────────────────────────────────┐
 │ Home: « Jouer contre l'ordi »   │ POST   │ Worker fetch (apps/worker/src/index.ts)                   │
 │       « Créer une table en      │ /api/  │  ├─ /api/tables         → new 128-bit id → stub.create()  │
 │         ligne » , Mes parties ──┼───────►│  ├─ /api/tables/:id     → stub.summary() (public only)    │
 │ #/table/<id>  (link / QR)       │ GET    │  ├─ /ws/table/:id       → Origin check → stub.fetch(req)  │
 │   Salon → Partie                │        │  └─ else → static assets (ASSETS / embedded manifest)     │
 │                                 │  WS    │                       │ getByName(id)                     │
 │ RemoteGame (partysocket/ws) ◄───┼═══════►│  GameRoom DO (one per table, SQLite, hibernating sockets) │
 │   hello{v,token,name} ─────────►│        │   webSocketMessage ─► zod parse ─► @toc/table.reduce()    │
 │   ◄─ welcome{you,table,view,seq}│        │        (state, cmd, now) → state', outbox[], deadlines[]  │
 │   ◄─ events{seq, eventsFor(S)}  │        │   commit: SQLite snapshot + event log + deadlines (sync)  │
 │   ◄─ table{seats,host,pause,..} │        │   send outbox: per-seat frames only (viewFor/eventsFor)   │
 │   act{base,action} / chat / ... │        │   setAlarm(min(deadlines.at))                             │
 │ Director.enqueue / reset(view)  │        │   alarm() ─► due: botMove | pauseChoice | sweep | expire  │
 │ turnUi, HandFan, animations     │        │        botMove: chooseAction(viewFor(state,bot)) → apply  │
 │ "ping" every 20 s ──► "pong"    │◄───────│   setWebSocketAutoResponse(ping/pong): DO stays asleep    │
 └─────────────────────────────────┘        │   gameWon ─► D1 games INSERT … ON CONFLICT DO NOTHING     │
                                            └───────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
packages/
├── engine/            # unchanged
├── bots/              # + src/pace.ts (moved from apps/web/src/game/pace.ts) and src/names.ts (BOT_NAMES)
├── board/             # unchanged (eventsDuration already pure)
├── protocol/          # NEW @toc/protocol: zod/mini schemas C2S/S2C, PROTOCOL_VERSION, QUICK_MESSAGES ids,
│                      #   TABLE_ID / DEVICE_TOKEN / NAME validators, TablePublic type
└── table/             # NEW @toc/table: pure table reducer (lobby, host, pause, hand-over, save, rematch,
                       #   chat, deadlines, per-seat outbox, leak oracle for tests). Depends on engine, bots,
                       #   board, protocol. No I/O, no clock, no Math.random.
apps/
├── web/               # + src/net/ (device store, RemoteGame, socket), routes Salon/online Game, Home buttons
└── worker/            # NEW @toc/worker: src/index.ts (router + exports GameRoom), src/GameRoom.ts (DO shell),
                       #   src/schema.ts (DO SQLite DDL), migrations/0001_games.sql (D1), test/*.test.ts,
                       #   vitest.config.ts (cloudflareTest), worker-configuration.d.ts (wrangler types)
worker-embedded/index.js   # imports { handleRequest, GameRoom } from "../apps/worker/src/index.ts"
wrangler.jsonc             # + main, assets.binding/run_worker_first, durable_objects, migrations, d1_databases
wrangler.embarque.jsonc    # + the same durable_objects / migrations / d1_databases blocks
```

### Pattern 1: Pure table core, thin DO shell
**What:** All table logic is a pure reducer `reduce(table, command, ctx) → { table, outbox, deadlines }` where `ctx = { now, seed? }` and `outbox` items are `{ to: Color | "all-seated" | socketId, msg }` already projected. The DO only parses frames, calls the reducer, commits, sends, re-arms the alarm. Mirrors `GameController` (a thin shell around the engine) [VERIFIED: apps/web/src/game/GameController.ts header].
**When:** Always. It is what makes the no-leak property test, the pause state machine and the 30-day expiry testable in plain Node with any `now`.
**Rule:** the core never embeds a `GameState` in a message; it calls `viewFor(state, seat)` / `eventsFor(events, seat)` — the only projection builders [VERIFIED: packages/engine/src/view.ts:24, :58].

### Pattern 2: GameRoom DO — SQLite snapshot + event log, hibernation, attachments
- Constructor: create schema if missing (synchronous `ctx.storage.sql.exec`), `ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"))`, lazily load the snapshot into an in-memory cache. Nothing held only in fields.
- Tables (DO SQLite):
  - `meta(key TEXT PRIMARY KEY, value TEXT)` — tableId, createdAt, creatorTokenHash, status (`lobby|playing|paused|saved|finished`), lastActivity, gameNo, seq.
  - `seats(seat TEXT PRIMARY KEY, kind TEXT, name TEXT, token_hash TEXT, level INTEGER, handed_over INTEGER)`.
  - `snapshot(id INTEGER PRIMARY KEY CHECK (id = 1), seq INTEGER, game TEXT, bot_rng TEXT)` — one UPSERT per accepted action (the full `GameState` JSON, a few KB).
  - `events(seq INTEGER PRIMARY KEY, game_no INTEGER, seat TEXT, action TEXT, events TEXT, at INTEGER)` — raw, **server-only** log (replay/debug/phase 5).
  - `deadlines(kind TEXT PRIMARY KEY, at INTEGER, payload TEXT)` — see Pattern 3.
  - `chat(id INTEGER PRIMARY KEY, seat TEXT, msg TEXT, at INTEGER)` — keep the last 30.
- Writes of one handler with no intervening `await` are atomic ("Any series of write operations with no intervening await will automatically be submitted atomically") [CITED: developers.cloudflare.com/durable-objects/api/sqlite-storage-api — `transaction`]. Consume SQL cursors synchronously (`.toArray()`/`.one()`) [CITED: same page].
- Socket attachment: `{ seat: Color | null, tokenHash: string | null, helloAt: number }`, max 16,384 bytes serialized [CITED: durable-objects/best-practices/websockets — "Maximum serialized size is 16,384 bytes"]. Survives eviction while the socket lives [VERIFIED: spike `evictDurableObject` → attachment `{seat:"bleu"}` read back].
- Enumerate sockets with `ctx.getWebSockets()`; a table has at most a handful, so no tags are needed (tags are fixed at accept time, before `hello`).
- Compat date `2026-10-01` gives `web_socket_auto_reply_to_close` (≥ 2026-04-07) and `deleteAll()` also deleting the alarm (≥ 2026-02-24) [CITED: websockets page; api-storage-other-methods partial].

### Pattern 3: One alarm, many deadlines (idempotent)
`deadlines` holds at most one row per kind: `botMove` (payload `{seat, seq|dealKey}`), `pauseChoice` (`{pauseId}`), `sweep`, `expire`, `d1Retry`. After every commit: `setAlarm(min(at))` only if it changed (each `setAlarm` is one row written [CITED: pricing — "Each setAlarm() is billed as a single row written"]). `alarm()` pops every due row and re-validates it against current state (seq unchanged, still paused, seat still bot-controlled…) before acting — alarms are at-least-once and retried up to 6 times with backoff from 2 s on throw [CITED: durable-objects/api/alarms]. An alarm "can be delayed by up to a minute due to maintenance" [CITED: api-storage-alarms partial] — harmless for these uses.
- `expire`: not re-armed on every action; when it fires, if `lastActivity + 30 d > now` re-arm at that time, else `ctx.storage.deleteAll()` and close sockets with 4004.

### Pattern 4: Protocol and per-seat projection (RULE-19)
Client → server (`zod/mini` `discriminatedUnion("t", …)`, `strictObject` so unknown keys are refused, frame ≤ 4 KB checked before `JSON.parse`):
- `hello {v, token, name}` — must be the first frame; other frames before it are ignored.
- `sit {seat}`, `stand {}`, `assign {seat, to: "bot", level}` / `move {from, to}` (host), `start {}` (host)
- `act {base, action}` — `base` = the `seq` the client's view is at; `base !== seq` → `error{code:"stale"}` + fresh `welcome` (kills double taps and replays after reconnect). `action` is re-validated by `apply` anyway.
- `pause {choice: "wait" | "bot" | "save", level?}` (host), `stop {}` (host, SC4: « arrêter à tout moment »), `resume {}` (host), `chat {msg: QuickMessageId}`, `rematch {agree: boolean}`, `reclaim {seat}` (see Pitfall 7).

Server → client:
- `welcome {you: {seat, isHost}, table: TablePublic, view: PlayerView | null, seq, chat: last N}` — the **only** snapshot; built with `viewFor(state, you.seat)`.
- `events {seq, events}` — `eventsFor(rawEvents, seat)` per socket; one frame per socket per batch.
- `table {…TablePublic}` — seats (kind, name, level, connected), host seat, status, pause `{missing, since, choiceAt, choosing}`, `thinking: Color | null`, rematch votes, gameNo.
- `chat {from, msg, at}`, `error {code}` (codes only — never echo `IllegalActionError.message`, which embeds `JSON.stringify(action)` [VERIFIED: packages/engine/src/apply.ts:133-142]).

Hidden values that must never leave the DO: other seats' `hands`, other seats' `given`/`received`, `talon` order, `GameState.rng` (it determines every future deal), the bot rng, other devices' token hashes. `viewFor` already omits all of them; `PlayerView.givenToPartner` is the viewer's own give [VERIFIED: packages/engine/src/types.ts:121-154, view.ts].

### Pattern 5: Device identity (D-01) and resume (NET-02)
- localStorage `toc.device.v1 = { token, name }`: token = 32 random bytes (`crypto.getRandomValues`) base64url; name = NFC, control characters stripped, 1-20 chars. Validated on read like `toc.settings.v1` (untrusted storage pattern) [VERIFIED: apps/web/src/settings/settings.ts:38 `export const STORAGE_KEY = "toc.settings.v1";`].
- The token travels **only in the `hello` frame** (never in a URL). The DO stores `SHA-256(tableId + ":" + token)` per seat, so a table's storage cannot be replayed into another table.
- Reconnect: partysocket reopens → client sends `hello` again → DO finds the seat by hash, re-attaches, sends `welcome` → client calls `director.reset(view)` [VERIFIED: apps/web/src/game/director.ts:158 `reset(view: PlayerView): void;`]. Missed events are not replayed in v1 (simpler, nothing to leak); the Director already snaps when the tab was hidden.
- A second socket for the same seat closes the older one with code `4001` ("partie ouverte ailleurs"); the client sets `shouldReconnectOnClose: (e) => e.code < 4000` so 4001/4002/4004 do not loop.
- `maxEnqueuedMessages: 0`: partysocket flushes its buffer **before** the `open` event [VERIFIED: partysocket ws.d.ts doc of `send`], which would put stale actions ahead of `hello`.

### Pattern 6: Host role (D-03, D-05)
`host = creator if connected, else the first connected human clockwise from the creator's seat (COLORS order), else null`. Derived on every reduce, never stored, so it returns to the creator automatically. Host-only commands are checked in the core. `COLORS` order: `["bleu", "jaune", "rouge", "vert"]` [VERIFIED: packages/engine/src/topology.ts:6]; teams are face-to-face partners `bleu↔rouge`, `jaune↔vert` (`Team = "bleu-rouge" | "jaune-vert"`) [VERIFIED: topology.ts:27-34] — choosing a colour in the waiting room chooses a team.

### Pattern 7: Presence, pause, hand-over, save (D-04, NET-03/04, SC3/SC4)
- Connected = an authenticated socket for the seat whose last heartbeat is recent. Client sends `"ping"` every 20 s; the DO auto-answers `"pong"` without waking [VERIFIED: spike under `wrangler dev`]; the client calls `ws.reconnect()` if no pong within 5 s.
- `sweep` deadline every 30 s while `playing`/`paused` with humans: a socket whose `ctx.getWebSocketAutoResponseTimestamp(ws)` (or `helloAt`) is older than 75 s is closed (4000) and its seat marked gone [CITED: durable-objects/api/state — `getWebSocketAutoResponseTimestamp`]. 75 s because Chrome throttles chained timers of hidden tabs to about once a minute [ASSUMED]. `webSocketClose` / `pagehide` (client closes with 1000) give the fast path.
- Pause (all phases, `PAUSE_IN_ALL_PHASES: true = true` [VERIFIED: packages/engine/src/rules.ts:174]): a human seat that is not `handed_over` goes missing → status `paused`, `botMove` deadline removed, `pauseChoice` at `now + 60 000`, broadcast `table`. While paused: `act` refused (`error{code:"paused"}`), chat allowed.
- At `pauseChoice`: `choosing = true` for the host (if no human is connected at all → auto `saved`). `wait` → new `pauseChoice` at +60 s; `bot` → seat `handed_over = 1` with the host's level (default Galopeur 3), resume; `save` → status `saved` (state kept; `expire` armed).
- The returning player (same token hash) gets the seat back at once: `handed_over = 0`, any pending `botMove` for that seat dropped.
- `saved` → when players come back through the link, the host sees « Reprendre la partie »; missing humans go through the same pause flow.

### Pattern 8: Bots inside the DO, pacing
- Decide when the bot becomes due (in the handler that made it due): `thought = chooseAction(viewFor(state, bot), bot, level, botRng, budget)`; store `{seat, base: seq, action}` in the `botMove` payload with `at = now + eventsDuration(lastBatch, "normal") + paceFor(thought, "normal", u) − decideMs`. On fire: same `seq`, not paused, still bot-controlled → `apply` → commit → send. The local controller follows the same "decide first, wait the remainder" rule [VERIFIED: apps/web/src/game/GameController.ts:215-264].
- Exchange: each bot gives on its own staggered deadline; validity check is `phase === "exchange" && given[seat] === null` (not `seq`, which moves with every give).
- `thinking` in `TablePublic` = the seat of the pending `botMove` (the « réfléchit » sign).
- CPU per decision on this machine (`node tools/bench-bots.mjs --repeat 2`, 40 positions): level 2-4 p50 0.2 ms, p95 ≈ 11 ms, max ≈ 19 ms; **level 5 p50 48.7 ms, p95 221.8 ms, max 517.6 ms, 293.6 units/decision** [VERIFIED: run this session]. A full level-5 self-play game (296 decisions) took ~11 s wall in workerd (~38 ms/decision) [VERIFIED: spike].
- DO CPU limit: "By default, the maximum CPU time per Durable Objects invocation (HTTP request, WebSocket message, or Alarm) is set to 30 seconds" and "Durable Objects are Worker scripts, and have the same per invocation CPU limits as any Workers do"; Workers Free = 10 ms CPU per request [CITED: do-faq-limits partial; workers/platform/limits]. Paid plan: no issue. Free plan: Champion would exceed → see Open Question 1.
- `paceFor` currently lives in `apps/web/src/game/pace.ts` and imports `Speed` from `./GameController.ts` [VERIFIED: pace.ts:14]; move it (and `BOT_NAMES`) into `@toc/bots` so the DO can import it, re-exporting from the old path to keep apps/web stable.

### Pattern 9: Saved games and « Mes parties en cours » (D-06, HIST-01, SC4)
- Device list `toc.tables.v1 = [{ id, seat, joinedAt }]` (validated, max 20). Home shows each with `GET /api/tables/:id` → `{ status, seats: [{seat, kind, name}], gameNo, updatedAt }` or 404 (expired → remove the entry).
- Exact resume = the snapshot row: hands, deal, pawns, turn, rng — `welcome.view` is rebuilt from it with `viewFor`.
- Expiry: 30 days after `lastActivity` → `deleteAll()` (also removes the alarm at this compat date).

### Pattern 10: Quick messages (D-07)
`QUICK_MESSAGES` = ordered list of ids in `@toc/protocol` (`bien-joue`, `aie`, `a-toi`, `merci-partenaire`, `bravo`, `oups`, `patience`, `bonne-partie`, `revanche`), French text in `apps/web/src/i18n/fr/`. Server accepts only an id from the enum, rate-limit 3 per 5 s per seat (in-memory counter is fine), keeps the last 30. The list is « à confirmer par Romain » [ASSUMED wording].

### Pattern 11: Revanche (D-08, PLAY-07)
After `gameWon`: `table.rematch = { votes: Record<Color, boolean> }`, bots vote yes. When every connected human agrees: `gameNo + 1`, same seats/levels, new deck seed from `crypto.getRandomValues`, `firstDealer` = next seat after the previous first dealer [ASSUMED], `startGame(...)` → `events` for each seat (`openDeal`).

### Pattern 12: HIST-01 game-end record in D1 (idempotent)
On `gameWon` (same handler, after the SQLite commit): `INSERT INTO games (game_id, table_hash, game_no, started_at, ended_at, winner, seats, deals, captures) VALUES (?…) ON CONFLICT(game_id) DO NOTHING`, `game_id = tableHash + ":" + gameNo`. The D1 call is async I/O — set `meta.d1Written` only after success; on failure arm `d1Retry`. Store a hash of the table id, never the id itself (the id is a capability). Make the binding optional at runtime (`if (env.DB)`) so a missing D1 permission on the deploy token cannot block the phase.

### Pattern 13: Table id, link, QR (D-02)
- Id: 16 bytes from `crypto.getRandomValues` → base64url, 22 chars, validated `^[A-Za-z0-9_-]{22}$` before any `getByName` (so random paths never instantiate objects). `getByName` works at this compat date [VERIFIED: spike].
- `POST /api/tables` creates the id and calls the DO's `create({creatorName})`; the creator becomes host on his first `hello` (store the creator token hash at that first hello on a `lobby` table that has no creator yet, or pass it in `create`).
- Link: `https://toc.romaindetroyat.workers.dev/#/table/<id>` (fits the hash router in `App.svelte`; the id never reaches server logs as a path). Share with `navigator.share({ title, text, url })` when present, else copy to clipboard.
- QR: `const { encode } = await import("uqr")` only in the invite sheet; draw `data` as a single `<path d="M x y h1 v1 h-1 z …">` in an SVG with a 4-module quiet zone.

### Pattern 14: Client — reuse the session and the Director
- `RemoteGame` implements the existing `GameController` contract (`human`, `names`, `view()`, `openingDeal()`, `submit()`, `onChange`, `onError`, `stats()`, `thinking()`, `start()`, `dispose()`) [VERIFIED: GameController.ts:80-104]. `submit` sends `act{base: seq, action}` and returns `{ok: true}` (pending); a server `error{stale|illegal}` maps to the existing `hint = "illegal"` + `sync` path in `session.svelte.ts`. Incoming `events` go to `director.enqueue`; `welcome` goes to `director.reset(view)`.
- `createSession` gains an injectable controller factory (today it calls `createGame` directly [VERIFIED: session.svelte.ts:158]); the local game keeps working unchanged (D-09).
- Names: `welcome`/`table` carry each seat's prénom or horse name; the client shows « toi » for its own seat.
- iOS/Android background: the socket dies or freezes; `pageshow`, `visibilitychange` (visible) and `online` call `ws.reconnect()`; `pagehide` closes with 1000 so others see the pause immediately.

### Pattern 15: Two deploy configs, one server module
- `wrangler.jsonc` (assets upload; Romain's machine): add `"main": "./apps/worker/src/index.ts"`, `assets.binding: "ASSETS"`, `assets.run_worker_first: ["/api/*", "/ws/*"]` (array form disables the navigate-header heuristic and keeps SPA fallback for the rest) [CITED: workers/static-assets/routing/single-page-application — needs Wrangler ≥ 4.20.0].
- `wrangler.embarque.jsonc` (cloud container; proxy swaps the assets-upload JWT, so assets stay embedded): keep `main: "./worker-embedded/index.js"`; `index.js` imports `{ handleRequest, GameRoom }` from `../apps/worker/src/index.ts`, re-exports `GameRoom`, tries `handleRequest` first, then the embedded files. Verified: dry-run listed `env.GAME_ROOM (GameRoom) Durable Object` and `wrangler dev` served both the embedded HTML and the DO [VERIFIED: spike].
- Both configs carry byte-identical `durable_objects`, `migrations: [{ "tag": "v1", "new_sqlite_classes": ["GameRoom"] }]`, `d1_databases` and `compatibility_date`. Add a test in `tools/` that parses both JSONC files and asserts these blocks are equal and that neither sets `vars.TOC_TEST_MODE`.
- Current values to keep [VERIFIED: wrangler.jsonc, wrangler.embarque.jsonc]: `"name": "toc"`, `"compatibility_date": "2026-10-01"`, `"find_additional_modules": false`, rules `{ "type": "Text", "globs": ["**/dist/**/*.js", "**/*.html", "**/*.css", "**/*.svg", "**/*.webmanifest"], "fallthrough": false }` and the `Data` rule for images/fonts/audio.

### Anti-Patterns to Avoid
- **Broadcasting one message to all sockets that contains state or raw events.** Every frame is built per socket from `viewFor`/`eventsFor`, or contains only public table data.
- **Game state only in DO fields / `setTimeout` in the DO.** Lost on eviction and blocks hibernation [CITED: websockets page — "Events such as alarms, incoming requests, and scheduled callbacks prevent hibernation. This includes setTimeout and setInterval"].
- **Several `setAlarm` call sites.** Only the commit step arms `min(deadlines.at)`.
- **Trusting `seat` or `action.t` from the client.** Seat comes from the attachment; the action goes through `apply`.
- **Sending `IllegalActionError.message` to clients.** Codes only.
- **Token or seat in the WebSocket URL.** URLs land in logs; use the `hello` frame.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Move legality on the server | A server-side check list | `apply()` (throws `IllegalActionError`) | One rules implementation; it already rejects malformed frames (`bad-action`). |
| Hiding cards | Ad-hoc field deletion | `viewFor` / `eventsFor` | Already the documented boundary, tested in phase 1/3. |
| Bot pacing math | New timing constants | `paceFor` (moved) + `eventsDuration` | Same feel as the local game. |
| Frame validation | `typeof` ladders | `zod/mini` schemas in `@toc/protocol` | Shared both sides, typed, strict objects. |
| Reconnect/backoff | Custom timers | `partysocket/ws` | Jittered backoff, timeouts, `reconnect()`. |
| QR encoding | Reed-Solomon + masks | `uqr.encode` | Error-prone spec; tiny dependency. |
| Random ids/tokens/seeds | `Math.random` | `crypto.getRandomValues`, `crypto.subtle.digest("SHA-256")` | Unguessable, available in Workers and browsers. |
| DO test harness | Mocked `DurableObjectState` | `@cloudflare/vitest-plugin` (`runInDurableObject`, `runDurableObjectAlarm`, `evictDurableObject`) | Real workerd + SQLite; verified working here. |
| Timer multiplexing | Many alarms | One `deadlines` table + `setAlarm(min)` | DO has a single alarm slot [CITED: alarms page]. |

**Key insight:** the risky parts (rules, hidden information, timing) are already pure and tested; new code should only *route* them, never re-derive them.

## Common Pitfalls

### Pitfall 1: A hidden card leaks in a frame
**What goes wrong:** a convenience field (full state in `welcome`, raw events in `events`, the rng, `error.message`, a debug payload) reveals another hand or the future deck.
**How to avoid:** frames only from `viewFor`/`eventsFor` + public table data; codes-only errors; a leak-oracle test (Validation map SC2) on the pure core over thousands of random games with reconnects, and one workerd test that captures real socket frames.
**Warning signs:** any `GameState` type reaching `@toc/protocol` types; `JSON.stringify(state)` near `send`.

### Pitfall 2: Hibernation loses the in-memory table
**What goes wrong:** works in dev, breaks after eviction. **How to avoid:** SQLite is the source of truth; every workerd test calls `evictDurableObject(stub)` between steps (sockets stay hibernated, attachments survive) [VERIFIED: spike].

### Pitfall 3: Duplicate or stale actions
**What goes wrong:** double tap, retry after reconnect, or a bot alarm delivered twice applies a move twice. **How to avoid:** `act.base` must equal `seq`; deadlines carry their expected `seq`; alarm handlers re-check before acting; `maxEnqueuedMessages: 0` on the client.

### Pitfall 4: Bots outrun the animations
**What goes wrong:** the server plays faster than clients animate; queues grow and the human sees stale boards. **How to avoid:** bot deadline includes `eventsDuration(lastBatch, "normal")` (≈ 1.2 s average per action measured on a level-5 game: 349 539 ms / 296 actions) [VERIFIED: spike]; clients in fast/reduced modes simply finish early.

### Pitfall 5: A locked phone looks connected
**What goes wrong:** iOS freezes the page; the TCP socket lingers, no `webSocketClose`, no pause. Conversely Chrome throttles hidden-tab timers so a background desktop tab misses heartbeats. **How to avoid:** heartbeat + sweep with a 75 s silence threshold, plus `pagehide` close for the fast path. Tune on real phones at UAT [ASSUMED thresholds].

### Pitfall 6: Free-plan CPU kills the Champion
**What goes wrong:** on Workers Free, an alarm running a 50-500 ms Champion decision exceeds the 10 ms CPU limit ("Error 1102 / exceededCpu"). **How to avoid:** confirm the plan (Open Question 1). Paid: run `chooseAction` in one alarm. Free: slice `createThinker().step(units)` over chained alarms (~40 units ≈ 6 ms per slice) keeping the thinker in memory and restarting from scratch if evicted, or cap the online Champion budget.

### Pitfall 7: In-app browsers have their own storage
**What goes wrong:** a player opens the WhatsApp link in WhatsApp's in-app browser, later in Safari → different localStorage → new device token → cannot get their seat back. **How to avoid:** `reclaim {seat}` for a *disconnected* human seat, approved by the host (« C'est moi, Marie ») [ASSUMED UX, confirm with Romain]; the invite sheet suggests « Ouvrir dans Safari/Chrome ».

### Pitfall 8: Config drift between the two wrangler files
**What goes wrong:** one deploy omits the DO block or the migration; a later deploy fails or drops the class. **How to avoid:** the config-equality test (Pattern 15); deploy with `--dry-run --outdir` first and check the bindings list.

### Pitfall 9: Text-module glob captures a dependency
**What goes wrong:** the embedded config treats `**/dist/**/*.js` as Text. Today it matches `apps/web/dist/assets/*.js` (wanted) [VERIFIED: dry-run of a copy of the real dist emitted `…-DebugGeometry-DY20EmlY.js` as a separate text module]; a server dependency that ships nested `dist/<dir>/*.js` would be imported as a string. zod resolves outside `dist/` and is fine. **How to avoid:** narrow the glob to `apps/web/dist/**/*.js` and check `--dry-run --outdir` output (only web files emitted as separate modules; zod inlined in `index.js`).

### Pitfall 10: Old client vs new server after a deploy
**What goes wrong:** a deploy restarts DOs (all sockets drop) and an open tab speaks an older protocol. **How to avoid:** `PROTOCOL_VERSION` in `hello`; mismatch → close 4002 → « Nouvelle version : recharger ».

### Pitfall 11: Test-only shortcuts reaching production
**What goes wrong:** zero-pace bots or client-chosen seeds enabled in prod. **How to avoid:** only `TOC_TEST_MODE` (a `vars` entry passed by `wrangler dev --var TOC_TEST_MODE:1` or the vitest `miniflare.bindings`) enables them; config test asserts deploy configs never set it.

## Code Examples

### GameRoom shell (APIs verified in the spike)
```ts
// Source: spike run in this session + developers.cloudflare.com/durable-objects (websockets, state, alarms)
import { DurableObject } from "cloudflare:workers";

export class GameRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    createSchema(ctx.storage.sql);                       // CREATE TABLE IF NOT EXISTS …, synchronous
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }
  async fetch(request: Request): Promise<Response> {     // the Worker already checked Origin + id format
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ seat: null, tokenHash: null, helloAt: Date.now() });
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== "string" || raw.length > 4096) return;
    const parsed = parseClientFrame(raw);                 // @toc/protocol, zod/mini safeParse
    if (!parsed.ok) return ws.send(frame({ t: "error", code: "bad-frame" }));
    this.run(parsed.cmd, ws);                             // reduce → commit (sync SQL) → send outbox → arm alarm
  }
  async webSocketClose(ws: WebSocket) { this.run({ t: "gone" }, ws); }
  async alarm() { this.run({ t: "tick" }, null); }        // pops due deadlines, re-validates each
}
```

### Worker router (no framework)
```ts
const TABLE_ID = /^[A-Za-z0-9_-]{22}$/;
export async function handleRequest(req: Request, env: Env): Promise<Response | null> {
  const url = new URL(req.url);
  const ws = url.pathname.match(/^\/ws\/table\/([^/]+)$/);
  if (ws) {
    if (req.headers.get("Upgrade") !== "websocket") return new Response("Upgrade attendu", { status: 426 });
    if (!sameOrigin(req, env) || !TABLE_ID.test(ws[1]!)) return new Response("Refusé", { status: 403 });
    return env.GAME_ROOM.getByName(ws[1]!).fetch(req);
  }
  // POST /api/tables, GET /api/tables/:id …
  return null;                                            // caller falls back to assets / embedded files
}
```

### vitest config for the worker package
```ts
// Source: @cloudflare/vitest-plugin@1.4.4 dist/pool/index.d.mts (cloudflareTest, wrangler.configPath, miniflare)
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
export default defineConfig({
  plugins: [cloudflareTest({
    wrangler: { configPath: "../../wrangler.jsonc" },
    miniflare: { bindings: { TOC_TEST_MODE: "1" } },
  })],
  test: { include: ["test/**/*.test.ts"] },
});
```
Root `vitest.config.ts` keeps its Node project and adds this one through `test.projects`.

### Hibernation + alarm test (pattern that passed in the spike)
```ts
import { env } from "cloudflare:workers";
import { evictDurableObject, runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
const stub = env.GAME_ROOM.getByName(id);
const res = await stub.fetch("http://x/ws", { headers: { Upgrade: "websocket" } });
const ws = res.webSocket!; ws.accept();
// … hello, sit, start …
await evictDurableObject(stub);                           // sockets hibernate, attachments survive
await runInDurableObject(stub, (_room, state) =>          // make the 60 s pause deadline due now
  state.storage.sql.exec("UPDATE deadlines SET at = 0 WHERE kind = 'pauseChoice'"));
expect(await runDurableObjectAlarm(stub)).toBe(true);
```

### Leak oracle (pure core test)
```ts
const CARD = /\b(1[0-3]|[1-9])[SHDC]\b/g;
function leaked(frameJson: string, state: GameState, seat: Color): string[] {
  const known = new Set<string>([...state.hands[seat], ...state.discard,
    ...COLORS.flatMap((c) => state.posed[c]), ...COLORS.flatMap((c) => state.lastPlayed[c] ?? []),
    ...(viewFor(state, seat).givenToPartner ? [viewFor(state, seat).givenToPartner!] : [])]);
  return [...frameJson.matchAll(CARD)].map((m) => m[0]).filter((c) => !known.has(c));
}
```
(Run it against the state *after* the batch for `events` frames and against the state the `welcome` was built from; card ids are `` `${Rank}${Suit}` `` with suits `"S" | "H" | "D" | "C"` [VERIFIED: packages/engine/src/types.ts:30-36]. Note that a `handDealt` event of the *new* deal carries the seat's new hand, which is in `state.hands[seat]` after the batch.)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@cloudflare/vitest-pool-workers` + `defineWorkersProject` | `@cloudflare/vitest-plugin` + `cloudflareTest()` in `plugins` | renamed (plugin first published 2026-08-20) | Use the new package; CLAUDE.md's pin 0.23.0 is stale. |
| `cloudflare:test` `env` / `SELF` | `import { env, exports } from "cloudflare:workers"`; `exports.default.fetch()` | deprecated in the type docs | Both still work; prefer the new imports. |
| Attachment limit 2,048 bytes | 16,384 bytes | — | Room for `{seat, tokenHash, helloAt}` and more. |
| `webSocketClose` must call `ws.close()` | runtime auto-replies to Close frames (compat ≥ 2026-04-07) | 2026-04 | Calling `close()` stays harmless. |
| `deleteAll()` leaves the alarm | `deleteAll()` deletes the alarm (compat ≥ 2026-02-24) | 2026-02 | 30-day purge is one call. |
| `run_worker_first: true` or navigate heuristic | `run_worker_first: ["/api/*", "/ws/*"]` | Wrangler 4.20 | Assets never invoke the Worker. |
| Worker 1-10 MB compressed size limit | 64 MiB uncompressed, "no compressed size limit" | — | Embedded build (~1.7 MB) is far below. |

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | everything | ✓ | v22.22.0 | — |
| pnpm | workspace | ✓ | 10.28.0 in PATH (`packageManager: pnpm@10.34.7`) | — |
| wrangler | dev/deploy/types | ✗ in repo, ✓ installable | 4.151.1 (scratch install worked) | add as root devDependency |
| workerd (via wrangler / vitest-plugin) | DO runtime locally | ✓ | 1.20261012.1 (spike ran) | — |
| Chromium for Playwright | e2e | ✓ | `/opt/pw-browsers/chromium-1194` | — |
| Cloudflare account access | deploy, `wrangler d1 create` | ✗ in this session (`wrangler whoami`: not authenticated) | — | deploy step runs where the proxy injects the token; human checkpoint |
| developers.cloudflare.com | docs | ✗ (proxy 403) | — | docs read from raw.githubusercontent.com/cloudflare/cloudflare-docs (same source) |

**Missing with no fallback:** none for building and testing. **Needs a human/deploy checkpoint:** creating the D1 database and the first deploy with the `v1` migration.

## Validation Map (per success criterion)

Test infrastructure: root `pnpm test` (vitest 4.1.11, Node project) + `apps/worker` workerd project (`@cloudflare/vitest-plugin`); Playwright online config with `webServer: "VITE_TOC_DEBUG=1 pnpm --filter @toc/web build && pnpm exec wrangler dev -c wrangler.jsonc --port 8787 --var TOC_TEST_MODE:1"` (one origin for SPA, `/api`, `/ws` — verified that `wrangler dev` serves WebSockets and the auto-response).

| SC | Behavior | Automated check | Type |
|----|----------|-----------------|------|
| SC1 | 4 devices join by link, full game, empty seats are bots, server deals and refuses illegal moves | workerd: 4 fake sockets hello/sit/start then random legal `act`s until `gameWon`; 1 socket + 3 bots driven by `runDurableObjectAlarm` until `gameWon`; illegal `act` → `error{illegal}` and state unchanged. Playwright: 2-4 contexts join via `#/table/<id>`, pick colours, start, see the same first move | integration + e2e |
| SC2 | No frame reveals another hand, incl. after reconnect; played cards public | Node fast-check on `@toc/table`: ≥ 200 random games with random seat mixes, disconnects and reconnects; `leaked(frame) === []` for every outbound frame; workerd: capture every socket frame of a full game and run the same oracle | property + integration |
| SC3 | Reload/network loss → exact state; pause visible to all; after 1 min the host gets 3 choices | workerd: close socket → others get `table.pause`; new socket + `hello` → `welcome.view` deep-equals `viewFor(snapshot, seat)`; deadline made due → `choosing`; each of wait/bot/save; handed-over seat returns on hello. Playwright: `context.setOffline(true)` → others show the pause banner; reload → same board | integration + e2e |
| SC4 | Host stops anytime; resume days later exactly | Node: `stop` → `saved`; core with `now + 29 d` resumes, `now + 31 d` expires; workerd: `evictDurableObject` then reconnect → identical view; `expire` due → `deleteAll` → `GET /api/tables/:id` 404 | unit + integration |
| SC5 | Quick chat; winner announced; rematch same seats | Node: chat id enum + rate limit; `gameWon` → `table.winner` to all; all votes → `gameNo + 1`, same seats, new deal events per seat; workerd: D1 row written once even when the alarm/handler runs twice | unit + integration |
| — | Hibernation safety | every workerd scenario runs `evictDurableObject` between steps | integration |
| — | Config sync | `tools/wrangler-configs.test.ts`: identical DO/migration/D1 blocks, no `TOC_TEST_MODE` | unit |
| — | Real devices | UAT: iPhone + Android, lock screen/app switch, WhatsApp in-app link, QR scan, sound after reconnect, 4 humans one full game | manual |

## Security Domain

### Applicable ASVS Categories (level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | partial | No accounts (D-01); device token = 256-bit random bearer secret, sent only in `hello`, stored hashed per table. |
| V3 Session Management | yes | Socket bound to seat via attachment after `hello`; one live socket per seat (older closed 4001); protocol version gate. |
| V4 Access Control | yes | Seat from attachment, never from frames; host-only commands checked in the core; per-seat projection; table id = 128-bit capability. |
| V5 Input Validation | yes | `zod/mini` strict schemas, 4 KB frame cap, name normalization (NFC, no control chars, ≤ 20), enum chat ids, `apply` for actions. |
| V6 Cryptography | yes | `crypto.getRandomValues` (ids, tokens, deck seeds), `crypto.subtle.digest("SHA-256")`; never `Math.random`. |
| V8 Data Protection | yes | `GameState.rng`, talon and hands never leave the DO; D1 stores a table-id hash, not the id. |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reading other hands from frames/devtools | Information disclosure | `viewFor`/`eventsFor` only; leak-oracle tests |
| Predicting future deals | Information disclosure | rng never serialized to clients |
| Cross-site WebSocket hijacking | Spoofing | `Origin` must equal the request origin (allow-list localhost in test mode); token in `hello`, not cookies |
| Forged or replayed moves | Tampering | `apply` validation; `act.base === seq` |
| Seat takeover by a link holder | Elevation | token-hash ownership; `reclaim` needs host approval |
| Table id guessing | Information disclosure | 128-bit id; format check before `getByName` |
| Chat/frame flooding | DoS | 4 KB cap, chat rate limit, frames before `hello` ignored |
| XSS via names/chat | Tampering | Svelte text nodes only (`no-raw-html.test.ts`), enum chat |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Romain's account is (or will move to) Workers Paid; otherwise the Champion needs sliced alarms | Pattern 8, Pitfall 6 | Champion fails with 1102 on Free; plan must add slicing |
| A2 | Free-plan DOs are held to 10 ms CPU per invocation (docs say both "same as Workers" and "30 s default") | Pattern 8 | If 30 s applies on Free too, slicing is unnecessary |
| A3 | Heartbeat 20 s / silence 75 s / sweep 30 s are right for iOS lock and Chrome background throttling | Pattern 7 | Pauses too late or spurious pauses |
| A4 | Quick-message list and wording | Pattern 10 | Romain rewords (cheap) |
| A5 | Hand-over level defaults to Galopeur (3), host can change it | Pattern 7 | Minor UX |
| A6 | Rematch first dealer = next seat after previous first dealer | Pattern 11 | Minor rule choice for Romain |
| A7 | Reclaim of a disconnected seat by a new device needs host approval | Pitfall 7 | Security/UX tradeoff for Romain |
| A8 | Newcomers after start cannot take a bot seat in phase 2 | Open Q3 | Scope |
| A9 | `uqr` is a sound QR dependency (unjs, zero deps) | Stack | Swap for qrcode-generator |
| A10 | Output gates hold `ws.send` until the SQLite writes of the handler are durable | Pattern 2 | A crash could show a move that was not stored; low impact (client resyncs) |

## Open Questions

1. **Which Cloudflare plan is the « toc » Worker on?** Known: the Champion needs up to ~0.5 s CPU; Free = 10 ms per invocation (with some isolate flexibility). Recommendation: ask Romain; if Free and he keeps it, plan a slicing task (Pitfall 6) and a deployed `wrangler tail` check for `exceededCpu`.
2. **Does the deploy token have D1 permission?** Recommendation: optional binding (Pattern 12) + a human checkpoint to `wrangler d1 create toc` and paste the `database_id` into both configs.
3. **Late joiners after start:** phase 2 recommendation is « La partie a commencé » plus host-approved reclaim of a disconnected human seat; giving a bot seat to a newcomer is a later idea unless Romain wants it.
4. **Quick-message list** — confirm with Romain (CONTEXT says « à confirmer »).
5. **REQUIREMENTS/ROADMAP wording for NET-05 and SC5** (« chat texte » → « messages rapides », D-07) — the planner adds a doc task.

## Sources

### Primary (HIGH confidence)
- Spikes run in this session (scratch dirs, not committed): wrangler 4.151.1 dry-run/dev with DO + `new_sqlite_classes`; `@cloudflare/vitest-plugin` 1.4.4 + vitest 4.1.11 test with `evictDurableObject`, `runDurableObjectAlarm`, `runInDurableObject`, `exports.default.fetch` upgrade; auto-response ping/pong under `wrangler dev`; engine+bots+board bundled in a DO and a full level-5 game; embedded-entry wrapper with the real `apps/web/dist`.
- npm registry and package tarballs: @cloudflare/vitest-pool-workers (deprecation), @cloudflare/vitest-plugin types, zod 4.6.7 (`v4/mini`, `allowsEval`), partysocket 1.3.0 (`ws.d.ts`), uqr 0.1.3 (`index.d.mts`), wrangler 4.151.1.
- Repo files read this session: packages/engine/src/{types,view,events,state,apply,rules,topology,rng}.ts, packages/bots/src/{index,thinker,levels}.ts, packages/board/src/motion.ts, apps/web/src/game/{GameController,session.svelte,director,pace,botRunner,botNames}.ts, apps/web/src/{App.svelte,settings/*}, wrangler.jsonc, wrangler.embarque.jsonc, worker-embedded/index.js, tools/build-embedded-worker.mjs, package manifests, vitest/playwright configs; `node tools/bench-bots.mjs --repeat 2`.

### Secondary (MEDIUM confidence — official docs read from github.com/cloudflare/cloudflare-docs sources, since developers.cloudflare.com is blocked here)
- durable-objects/platform/limits, platform/pricing (+ partials durable-objects-pricing, do-faq-limits), best-practices/websockets, api/state, api/alarms, api/sqlite-storage-api (+ partials api-storage-other-methods, api-storage-alarms); workers/platform/limits; workers/static-assets/routing/{worker-script,single-page-application}.
- .planning/research/{PITFALLS,ARCHITECTURE,STACK}.md (project research of 2026-10-13).

### Tertiary (LOW confidence)
- Chrome hidden-tab timer throttling and iOS background socket behaviour (training knowledge; validate on devices).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions from the registry, the key packages exercised in spikes.
- Architecture: HIGH — follows the existing pure-engine/thin-shell pattern; DO mechanics verified in workerd.
- Pitfalls: MEDIUM-HIGH — platform ones verified; device/background and free-plan CPU need real checks.

**Research date:** 2026-10-17
**Valid until:** 2026-11-16 (Cloudflare tooling moves weekly; re-check wrangler/vitest-plugin pins before installing).
