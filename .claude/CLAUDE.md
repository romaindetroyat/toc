<!-- GSD:project-start source:PROJECT.md -->

## Project

**TOC en ligne**

Une adaptation numérique du TOC, le jeu de « petits chevaux » où l'on avance avec des cartes plutôt qu'avec des dés, joué à 4 en 2 équipes de 2. C'est une application web installable (PWA) qui permet à une famille et à un cercle d'amis de jouer ensemble depuis leurs téléphones et ordinateurs. Les places vides sont tenues par des joueurs gérés par l'ordinateur, de force réglable. Le jeu reprend le plateau illustré que Romain a dessiné pour la version physique du jeu, avec des pions en forme de cavaliers animés et sonorisés.

**Core Value:** Une vraie partie de TOC, fidèle aux règles maison, jouable à distance entre proches sur n'importe quel appareil, avec l'ambiance du plateau original (chevaux animés, bruitages). Romain veut l'ensemble dès la première version jouable : règles justes, multijoueur, IA et ambiance.

### Constraints

- **Hébergement** : Cloudflare (Workers, Durable Objects pour les tables temps réel, D1/KV pour les comptes et l'historique) — choix de Romain
- **Plateforme** : PWA, aussi soignée sur téléphone que sur ordinateur
- **Graphismes** : reprendre fidèlement le plateau existant ; ne pas le redessiner
- **Sons** : bruitages libres de droits (CC0 ou équivalent) ou générés par le code, pour pouvoir publier sans problème de licence
- **Langue** : interface en français

<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->

## Technology Stack

## Headline Decisions

## Recommended Stack

### Core Technologies

| Technology | Version (verified) | Purpose | Why Recommended |
|------------|--------------------|---------|-----------------|
| TypeScript | 7.0.2 (`latest`; 5.x/6.x line still works) | Language everywhere | One language for engine, server, client. TS 7 is the native-compiled line; it is `latest` on npm. If a tool (typescript-eslint, svelte-check) lags, pin 5.9/6.x for type-checking only. Confidence MEDIUM on TS 7 tool compatibility, HIGH on TS itself. |
| Node.js | 22.x LTS (>=22.12) | Build/dev runtime | Required by Vite 8 / vite-plugin-svelte 7 (`^20.19 \|\| ^22.12 \|\| >=24`). |
| pnpm | 10.34.x (11/12 exist; see note) | Workspaces, lockfile | Strict, fast, workspace protocol, industry default for Vite/Cloudflare monorepos. npm shows 12.11.2 as latest; prefer 10.x unless you verify 12 against Wrangler/CI first. Confidence MEDIUM on exact major. |
| Vite | 8.3.4 | Dev server/bundler | Both `@cloudflare/vite-plugin` (^6.1\|\|^7\|\|^8) and `vite-plugin-pwa` 2.0 (up to ^8) and `@sveltejs/vite-plugin-svelte` 7 (needs ^8) support it. |
| Svelte | 5.57.2 | UI framework | Compile-time, tiny runtime (matters for a phone PWA), fine-grained runes reactivity suits a game state store, native `transition`/`animate`/`flip` and good SVG support. Mutable-looking `$state` maps nicely onto an immutable server snapshot pushed over WebSocket. |
| @sveltejs/vite-plugin-svelte | 7.3.1 | Svelte compile in Vite | Needs Vite 8 and Svelte >=5.46.4. |
| Cloudflare Workers + Static Assets | Wrangler 4.149.0 | Hosting of SPA + API + WebSocket entry | One deploy unit (Worker serves the built SPA and routes `/api`, `/ws`). Pages is legacy for new work; use Workers with assets. |
| @cloudflare/vite-plugin | 1.63.1 | Run Worker+DO inside Vite dev (workerd) | Same runtime in dev and prod; HMR for client and Worker in one `vite dev`. Peer: wrangler ^4.149.0. |
| Durable Objects (SQLite-backed) | n/a (`new_sqlite_classes` migration) | One authoritative room per game table | Single-threaded, strongly consistent per-room actor: the correct primitive for hidden hands and server-authoritative rules. SQLite storage is the only kind on the Free plan and the recommended one on paid; use it to persist game state so a game survives eviction and supports "stop and resume later". |
| WebSocket Hibernation API (`ctx.acceptWebSocket`, `webSocketMessage`, `serializeAttachment`) | built in | Realtime transport | Idle DOs are not billed for duration and can be evicted while sockets stay open. Card games are mostly idle (waiting for a human), so this is a large cost win. Constraint: no `setTimeout`/`setInterval` for game timers - use `ctx.storage.setAlarm()` for turn / reconnect deadlines; keep all state in SQLite, rebuild in-memory caches in constructor. |
| Hono | 4.13.13 | HTTP router on the Worker | Tiny, first-class Workers support, typed RPC client (`hc`) shared with the SPA, ideal host for better-auth's handler mount. |
| Cloudflare D1 | n/a (Wrangler migrations) | Accounts, friends, game history, stats, leaderboard | Relational queries (friends, rankings, stats aggregates) are D1's job; live game state is NOT in D1. Free tier is ample for a family circle. |
| Drizzle ORM / drizzle-kit | 0.45.4 / 0.31.11 | Typed schema + migrations for D1 | Matches better-auth's peer range (`drizzle-orm ^0.45.2`, drizzle-kit >=0.31.4). Do not jump to Drizzle 1.0 beta. |
| better-auth | 1.7.7 | Auth (sessions, passkeys, email OTP/magic link, OAuth if wanted) | See "Auth recommendation" below. |
| Zod | 4.6.7 | Runtime validation of every WebSocket message and API body | Server must treat all client frames as hostile. Share schemas from `packages/protocol`. (Valibot 1.5.0 is a smaller alternative; choose one and use it everywhere.) |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| partysocket | 1.3.0 | Auto-reconnecting WebSocket client (backoff, buffering) | Use client-side ONLY, even with raw DOs. It is framework-agnostic and removes hand-written reconnect logic that the "pause until player returns" feature depends on. Confidence MEDIUM-HIGH. |
| vite-plugin-pwa | 2.0.0 | Manifest + service worker generation | Use `strategies: 'injectManifest'` with a small custom SW (precache app shell + the 4 board webp + sounds; never intercept `/ws` or `/api/auth`). Peers: `workbox-build ^7.4.1`, `workbox-window ^7.4.1` (both 7.4.1). |
| workbox-window | 7.4.1 | SW registration / update prompt | "Nouvelle version disponible" prompt flow (`registerType: 'prompt'`), not silent auto-update mid-game. |
| @vite-pwa/assets-generator | 2.0.0 | Generate all PWA icons (maskable, Apple touch) from one SVG | One-time script in the build. |
| @simplewebauthn/browser / server | 14.0.0 / 14.0.3 | WebAuthn | NOT needed directly: better-auth's passkey plugin wraps SimpleWebAuthn. Listed only so you do not add it twice. |
| @better-auth/passkey | 1.7.7 | Passkey plugin (separate package in 1.7 line) | Primary sign-in: biometric on phones, no passwords for family members. Verify import path against docs when installing (plugin was moved out of core in recent versions). Confidence MEDIUM. |
| Resend (`resend`) | 6.32.1 | Transactional email for magic link / email OTP | Free tier (family scale) and a plain `fetch` API that works on Workers. Needs a verified sending domain (SPF/DKIM). Alternative: Cloudflare's own email sending if enabled on the account; verify availability before committing. Confidence MEDIUM. |
| Motion (`motion`) | 14.1.0 | Optional: spring/path animation helper (vanilla `animate()`) | Only if WAAPI + Svelte transitions prove insufficient for the "swap" arc or spring feel. Vanilla build is ~2.3 kB for `animate` mini; React peers are optional. Not a day-one dependency. |
| fast-check | 4.10.2 | Property-based tests for the rules engine | Strongly recommended: random games must preserve invariants (52-card conservation, no pawn on same cell, safe-square never crossed, exact-count home entry, 7 splits sum to 7). |
| @paralleldrive/cuid2 or `crypto.randomUUID()` | built in | IDs | Prefer `crypto.randomUUID()` (no dependency). Game RNG: seed per game with a small PRNG (e.g. mulberry32/sfc32) stored in DO so deals are reproducible and replayable from history. |
| Paraglide JS (`@inlang/paraglide-js`) | 2.27.0 | i18n | OPTIONAL. UI is French-only in v1. Recommended approach: a single `fr.ts` messages module with typed keys. Adopt Paraglide only if a second language is planned. Do not add i18next (26.x, heavy) for one language. |
| svgo | 4.1.0 | Optimise hand-made pawn SVG | Build-time only. |
| sharp | 0.35.5 | Build-time image work (webp variants, 1x/2x, LQIP, icon rasterising) | Dev dependency only, never in the Worker. The 4 x 1280px webp quarters are already fine; consider generating 640px variants for small phones. |

### Development Tools

| Tool | Version | Purpose | Notes |
|------|---------|---------|-------|
| Vitest | **4.1.11 (pin to ^4.1, NOT 5.x)** | Unit tests for engine, protocol, bots, UI logic | `@cloudflare/vitest-pool-workers@0.23.0` peers `vitest ^4.1.0`; npm `latest` is already 5.0.4, so an unpinned `pnpm add -D vitest` will break the Workers pool. Pin and add a Renovate/Dependabot rule. |
| @cloudflare/vitest-pool-workers | 0.23.0 | Run DO/D1/Worker integration tests inside workerd | Test the Durable Object end to end (two fake clients, reconnect, alarm) with real SQLite. Pre-1.0: expect config churn; pin exact version. |
| Playwright (`@playwright/test`) | 1.64.0 | E2E: 4 browser contexts = 4 players, mobile viewport (portrait), PWA install/offline smoke, visual snapshots of board | Run against `wrangler dev`/`vite preview`. Use multiple `browserContext`s to play a whole scripted game. |
| @testing-library/svelte | 5.4.2 | Component tests (optional) | Run under jsdom 30.x/happy-dom for components only; keep logic tests in plain Vitest. |
| Biome (`@biomejs/biome`) | 2.5.15 | Lint + format (one tool) | Faster and simpler than ESLint+Prettier across the monorepo; Svelte file support is partial, so also run `svelte-check` for `.svelte`. If strict Svelte lint rules are wanted, add ESLint 10 + eslint-plugin-svelte for the web package only. |
| svelte-check | latest matching Svelte 5 | Type-check `.svelte` | Run in CI. |
| Wrangler | 4.149.0 | Dev, D1 migrations, deploy, secrets, types | Use `wrangler types` to generate `Env` bindings types (preferred over hand-maintained `@cloudflare/workers-types`). Config file `wrangler.jsonc`. |
| @cloudflare/workers-types | 5.20261013.1 | Types | Only if not using `wrangler types`. partyserver peers `^5.20260703.1`, so use the 5.x line consistently. |
| GitHub Actions | n/a | CI: typecheck, vitest, playwright, `wrangler deploy` | Cloudflare Workers Builds is an alternative; Actions gives Playwright caching. |
| Turborepo (turbo) | 2.11.7 | OPTIONAL task cache | Skip at first. pnpm `-r`/`--filter` is enough for 4 packages; add only if CI time hurts. |

## Proposed Monorepo Layout

## Frontend: Why Svelte 5 (not React / Solid / vanilla)

- **Bundle and boot:** a game for phones on mobile data; Svelte ships almost no framework runtime. React 19.3 adds ~40+ kB gz baseline and a reconciler for something that is mostly one SVG scene and a few panels.
- **SVG fit:** Svelte treats SVG elements as ordinary template nodes; per-pawn `transform` bound to reactive state is trivial, and `animate:flip` / `transition:` cover capture/return-to-stable effects.
- **Solid 1.9.17** is equally fast and a defensible second choice; rejected only for smaller ecosystem for PWA/i18n/testing recipes and team familiarity risk. Choose Solid if you strongly prefer JSX.
- **React** only if a React-only library is required (none is). Motion's richest API is React-first, which is not enough reason.
- **No SvelteKit:** this app is an authenticated SPA; the server is a Worker + DO, not SSR. SvelteKit would add an adapter layer (and `@vite-pwa/sveltekit` 1.1.0 workarounds) for no gain. A tiny hash/History router (or `svelte-spa-router`-style 50 lines) for ~6 screens (login, lobby/friends, table, game, history, stats).
- Confidence: HIGH that Svelte 5 + Vite is a sound fit; MEDIUM that it beats Solid (taste).

## Animation Recommendation

- **Primary: Web Animations API (`element.animate()`)** on SVG `<g>` groups, driven by an **animation queue** consuming engine events. Pawn motion cell by cell = sequence of short animations (~120-220 ms each, durations tied to card distance for the speed/cadence requirement); capture = a "lunge" keyframe on the capturer then a parabolic hop of the victim to its stable; swap (Jack) = two arcs crossing. WAAPI is compositor-friendly, promise-based (`await anim.finished`) which makes sequencing and sound sync trivial, and has zero bundle cost.
- Animate `transform` (translate/rotate/scale) on `<g>` wrappers, NOT SVG attributes like `cx`/`x`, and avoid animating CSS `filter` (drop-shadow) per frame on mobile; pre-bake the shadow in the pawn SVG and scale/offset a separate shadow ellipse.
- **Motion 14.1.0 (`animate` from `motion`)** is the fallback if you need springs, path-following (`offset-path`) or timeline helpers; the vanilla core is small. Confidence MEDIUM.
- **GSAP 3.15.0:** the license was relaxed (free for commercial use since Webflow acquired it), so it is not a legal blocker, and MotionPathPlugin is excellent, but it is ~25-70 kB and overkill. Use only if complex timelines become painful.
- Always honour `prefers-reduced-motion` (shorten to fades) and provide a "skip animations/fast mode" setting; bots at level 5 play fast and the queue must be able to fast-forward/coalesce when the tab was in background (animations paused by browser) - on `visibilitychange` snap to the latest state.

## Audio Recommendation

- **Hand-rolled Web Audio API module (~150 lines)**, not Howler 2.2.4 (last release 2023-09, effectively unmaintained; its sprite/pool abstractions don't help the main feature).
- Key reason: the hoof cadence must follow speed. Decode one short CC0 hoof sample into an `AudioBuffer` once, then **schedule N `AudioBufferSourceNode.start(t0 + i*interval)` calls on the `AudioContext` clock** with `interval` derived from pawn speed, small random `playbackRate`/gain jitter (humanisation), and a `GainNode` per sound class (master, hooves, neigh, UI). Scheduling on the audio clock (not `setTimeout`) keeps cadence tight while the main thread is busy animating.
- iOS/Safari: create/resume the `AudioContext` inside the first user gesture (the "Rejoindre / Jouer" tap); expose a visible mute toggle; persist in `localStorage` (try/catch). Prefer `.m4a`/AAC or `.mp3` fallbacks plus `.ogg`/opus - Safari decode of opus-in-webm/ogg is not guaranteed for all versions; the safest single format is AAC in m4a (or WAV for tiny samples; samples are < 100 kB each).
- Precache all sounds in the service worker so the game works with the first-load gesture offline.
- Confidence: HIGH for approach; MEDIUM for exact format matrix (test on real iPhone).
- **Tone.js 15.1.22**: not needed (synthesis/sequencing framework, ~150+ kB). Optional **procedural fallback**: if no good CC0 hoof sample exists, synthesise hooves with filtered noise bursts + a low sine thump via `OfflineAudioContext` (satisfies "generated by the code" in PROJECT.md).

### CC0 sound sources (licence must be verified per file - LOW confidence on availability)

| Source | Licence | Notes |
|--------|---------|-------|
| Freesound.org (filter: License = Creative Commons 0) | CC0 per file | Search "horse hoof", "horse gallop", "horse neigh/whinny", "cobblestone footsteps". Roughly two-thirds of the site is CC0, but each file carries its own licence - record the URL, author and licence in `assets/audio/LICENSES.md`. Download needs a free account. Best primary source. |
| OpenGameArt.org (filter licence = CC0) | CC0 / CC-BY / etc. per submission | Beware mixed-licence packs (the "horse gallop" pack found in research mixes CC0 and CC-BY 4.0, so the pack is only safe file-by-file; the zebra whinny is CC-BY). Search "horse", "hoof", "neigh". |
| Kenney.nl audio packs | CC0 | Reliable CC0 for UI clicks, card flips/slides ("Casino Audio", "Interface Sounds", "Impact Sounds"); has no horse sounds as far as found. |
| Pixabay Sound Effects / Mixkit | Own licences (royalty-free, NOT CC0) | Acceptable for publishing in practice but not CC0; PROJECT.md asks for CC0 "ou équivalent". Mixkit explicitly is "Mixkit License". Prefer only if CC0 sources fail, and record it. |
| Sonniss GDC bundles | Royalty-free licence (not CC0) | Large quality packs; read licence about redistribution inside a public repo. |
| Generated in code (Web Audio synthesis) | Yours | Guaranteed licence-clean fallback for hooves and card sounds. |

## PWA Recommendation

- **vite-plugin-pwa 2.0.0 + Workbox 7.4.1 (injectManifest)**: precache the build (JS/CSS/HTML), the board images and the audio; runtime strategy `NetworkOnly` for `/api/*` and WebSocket (never cache auth or game traffic), `StaleWhileRevalidate` for avatars if any. `registerType: 'prompt'` so an update never reloads a game in progress.
- The game is online-only: offline support = installable shell + offline page ("Pas de connexion") + solo-vs-bots could theoretically run offline using the shared engine (nice differentiator, low cost because the engine already runs client-side; keep as optional later phase).
- Manifest: `lang: "fr"`, `display: "standalone"`, `orientation: "any"` (board must be playable in portrait), maskable icons, `theme_color` matching the board border. Verify iOS: Apple touch icon, splash, and that WebSockets keep working when the PWA is backgrounded (they won't - design the reconnect/pause flow for that: it is the normal case on phones).
- Web Push for "c'est ton tour" is possible on installed iOS 16.4+/Android PWAs but needs VAPID + subscription storage in D1; defer past v1 unless demanded.
- Confidence: HIGH.

## Cloudflare Architecture Notes (drives roadmap)

- **Worker routes:** `/api/auth/*` -> better-auth; `/api/*` -> Hono (friends, history, stats, tables); `/ws/table/:id` -> authenticate cookie/session, then `env.GAME_ROOM.get(idFromName(tableId)).fetch(request)`; everything else -> static assets with SPA fallback.
- **DO `GameRoom`:** holds the authoritative engine state in SQLite (snapshot + event log), per-socket attachment `{userId, seat}`, sends each player only their own hand (project each message per seat: hands hidden, partner-swap card hidden). Alarms: turn timer, disconnect-grace deadline (the "pause then bot takes over" open question), bot "think time" delays. On game end, write the summary to D1 once (from the DO via the D1 binding, idempotently keyed by game id).
- **Bots run inside the DO** by calling the same `engine`, with level-dependent search depth; strong levels (4-5) should be CPU-budgeted (e.g. time-boxed Monte-Carlo / expectimax, a few ms) because DO CPU is limited to 30 s per request by default and the room is single-threaded. Do not run heavy search on the main loop of a room with 3 humans.
- **Free plan viability:** SQLite-backed DOs are available on the Workers Free plan (100k requests/day, 13,000 GB-s/day, 100k rows written/day; each alarm set = 1 row written; WebSocket messages count 20:1 toward requests - verify exact ratio in the pricing page). A family-scale game fits; budget row writes by writing one compact snapshot row per move, not per frame. Paid plan ($5/mo) removes the worry; plan for it if it grows.
- **D1 limits:** not for realtime. Write-heavy history is only game-end rows.
- **Secrets:** `BETTER_AUTH_SECRET`, `RESEND_API_KEY` through `wrangler secret`; never in `wrangler.jsonc`.

## Auth Recommendation (family and friends)

## Why NOT PartyKit / PartyServer

- `partyserver` 0.5.10 (the maintained Cloudflare-owned successor; `partykit` 0.0.115 is the older hosted-platform CLI) is a thin convenience layer over Durable Objects: room naming, connection lifecycle hooks (`onConnect/onMessage/onClose`), hibernation opt-in, broadcast helpers, and `routePartykitRequest`.
- It would save maybe 100 lines. Costs: pre-1.0 API churn, an extra abstraction between you and DO alarm/SQLite semantics (which are central to this game: reconnect deadlines, resumable state), and its docs/examples assume simple broadcast rooms, whereas TOC needs per-seat projections of hidden state.
- Use raw DO + the ~60 lines of glue; keep `partysocket` on the client only (it is independent of PartyServer).
- Choose PartyServer instead if the team wants Yjs/CRDT collaborative state (not this game).
- Also skip Cloudflare's `agents` SDK (0.28.0): oriented to AI agents.

## Installation

# Workspace root

# apps/web

# apps/worker

# Optional, only when needed

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Svelte 5 | Solid 1.9.17 | Team prefers JSX; equal performance. |
| Svelte 5 | React 19.3 + Motion | If you need React ecosystem components or hire React devs; heavier and unneeded here. |
| Svelte 5 SPA | SvelteKit | If SEO/SSR landing pages or file-based routing become desirable; adds adapter complexity on Workers. |
| Raw Durable Object | PartyServer 0.5.10 | Many simple broadcast rooms, Yjs sync, or if the team wants less boilerplate and accepts churn. |
| better-auth | Hand-rolled + SimpleWebAuthn | If better-auth/D1/Workers integration blocks; full control, more risk. |
| better-auth | Clerk / Auth0 / Cloudflare Access | Overkill/costly for family; Access (Zero Trust, free <50 users) is a valid "invite-only gate" in front of the app but gives poor UX/integration for in-app accounts and friends. |
| Supabase Auth (already connected) | n/a | Rejected: PROJECT.md chose Cloudflare as single backend; splitting identity into another provider adds cross-service latency and JWT plumbing. |
| WAAPI | Motion 14.1 / GSAP 3.15 | Springs, motion paths, complex timelines. |
| Custom Web Audio | Howler 2.2.4 | Only for trivial sprite playback; unmaintained since 2023. |
| D1 | Durable Object SQLite only | Cross-room queries (friends, rankings) need one shared DB; keep D1. KV is eventually consistent - fine for config, WRONG for friends/history. |
| Biome | ESLint 10 + Prettier | If Svelte-specific lint rules are mandatory. |
| pnpm workspaces | npm workspaces | Acceptable (Node 22 ships npm 10.9), slower, weaker hoisting control. |
| Vitest 4.1 pinned | Vitest 5.0.4 | After `@cloudflare/vitest-pool-workers` publishes a release that peers vitest 5. |
| Resend | Cloudflare email sending / MailChannels | If Cloudflare Email Service is available on the account and you want everything on one vendor; verify first. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Three.js / react-three-fiber | Explicitly out of scope; heavy on mobile; SVG fake-3D already validated | SVG pawns with gradients, baked shadow |
| Socket.IO / `ws` on Workers | No Node server; Socket.IO's long-polling fallback and rooms don't map to DOs | Native WebSocket + Hibernation API |
| DO WebSockets WITHOUT hibernation (`ws.accept()`) | Keeps the DO billed for duration the whole time a table is open | `ctx.acceptWebSocket()` |
| `setTimeout`/`setInterval` for turn/reconnect timers inside the DO | Prevents hibernation and is lost on eviction | `ctx.storage.setAlarm()` + persisted deadlines |
| Trusting the client for rules/hands | Cheating; project requirement for server authority | Engine runs on server; client engine used only for preview/legal-move hints |
| Sending the full game state to every socket | Leaks other hands and the partner swap card | Per-seat projection of state |
| KV for friends / game history | Eventually consistent, no queries | D1 |
| Lucia (3.2.2) | Deprecated by its author in 2025 (now a learning resource); oslo 1.2.1 likewise | better-auth (or arctic 3.7.0 for bare OAuth) |
| Passwords-only auth | Family members reuse/forget; password reset email flow = same email dependency anyway | Passkeys + email OTP |
| Howler.js for hoof cadence | Timer-based scheduling, unmaintained | Web Audio scheduling on the audio clock |
| Animating SVG `filter: drop-shadow` or many `cx/cy` attributes per frame | Jank on mid-range phones | `transform` on `<g>`, pre-baked shadows |
| Unpinned `vitest@latest` | Pulls 5.x, incompatible with workers pool 0.23.0 | `vitest@^4.1.11` |
| Cloudflare Pages for new app | Cloudflare steers new projects to Workers + Static Assets (the Cloudflare MCP even ships a `migrate_pages_to_workers_guide`) | Workers with `assets` binding |
| Workbox `generateSW` default with `skipWaiting` auto-update | Hot-swaps code mid-game | `injectManifest` + prompt update |
| Server-side rendering / Next.js | Not needed; poor fit for DO WebSockets | SPA |

## Stack Patterns by Variant

- Everything above works (SQLite-backed DO only). Minimise rows written (one snapshot UPSERT per move), avoid chatty heartbeats (rely on protocol-level auto-response `ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'))` so pings don't wake the DO), keep bot think-time alarms coarse.
- State lives in DO SQLite (persists indefinitely) and a `games` row in D1 marks it `paused`; the lobby lists "Parties en cours". Re-instantiate on first socket. No extra tech.
- First optimise (bitboards/precomputed distances in `engine`). Then run the search in the DO with a time budget. Only if still insufficient, evaluate a Worker `ctx.waitUntil` offload or a Web Worker on the client for solo mode. Do not introduce WASM unless profiling demands it.
- Keep the SVG `viewBox` square, scale to `min(100vw, 100dvh - hand)`, and put the hand fan below the board; rotate the board so the local player's colour is always at the bottom (CSS transform on the board group, not different art).

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @cloudflare/vitest-pool-workers@0.23.0 | vitest ^4.1.0 (+ @vitest/runner, @vitest/snapshot ^4.1.0) | NOT vitest 5.x. Pre-1.0; pin exact. |
| @cloudflare/vite-plugin@1.63.1 | vite ^6.1 \|\| ^7 \|\| ^8; wrangler ^4.149.0 | Keep wrangler in the same minor family. |
| vite-plugin-pwa@2.0.0 | vite up to ^8; workbox-build/workbox-window ^7.4.1; @vite-pwa/assets-generator ^1 \|\| ^2; Node >=20.19 | OK with Vite 8. |
| @sveltejs/vite-plugin-svelte@7.3.1 | vite ^8; svelte ^5.46.4; Node ^20.19 \|\| ^22.12 \|\| >=24 | Requires Vite 8. |
| better-auth@1.7.7 | drizzle-orm ^0.45.2 or >=1.0.0-rc.1 <2; drizzle-kit >=0.31.4; vitest ^2-^5 | Use drizzle-orm 0.45.x. |
| partyserver@0.5.10 | @cloudflare/workers-types ^4.20260424.1 \|\| ^5.20260703.1 | Only relevant if adopted (not recommended). |
| motion@14.1.0 | react optional peers | Vanilla `animate` works without React. |
| TypeScript 7.0.2 | tooling lag risk | Verify svelte-check, Biome, vitest transforms on scaffold; fall back to 5.9. |

## Open Items for Roadmap-Phase Research

- Confirm better-auth 1.7 passkey package name/import path and D1 + per-request init pattern in official docs at implementation time.
- Confirm email provider (Resend vs Cloudflare email sending) and register a domain (needed for passkey RP ID and SPF/DKIM).
- Audit CC0 neigh/hoof samples (spike early; fallback is synthesis).
- Exact Cloudflare free-tier numbers (WebSocket message billing ratio, DO CPU limits) should be re-read on developers.cloudflare.com/durable-objects/platform/pricing before capacity claims.
- iOS Safari PWA audio unlock and WebSocket-on-background behaviour need a real-device test.

## Sources

- npm registry (`npm view`, 2026-10-13): versions and peerDependencies for typescript 7.0.2, vite 8.3.4, vitest 5.0.4 (latest) / 4.1.11, @cloudflare/vitest-pool-workers 0.23.0, @cloudflare/vite-plugin 1.63.1, wrangler 4.149.0, svelte 5.57.2, vite-plugin-pwa 2.0.0, better-auth 1.7.7, hono 4.13.13, partyserver 0.5.10, partysocket 1.3.0, drizzle-orm 0.45.4, motion 14.1.0, gsap 3.15.0, howler 2.2.4 (last published 2023-09), etc. - HIGH
- Cloudflare Durable Objects pricing / changelog pages (developers.cloudflare.com/durable-objects/platform/pricing, /changelog/) via web search snippet - free-plan SQLite DO availability, daily limits, alarm billing - MEDIUM (secondary snippet; re-verify numbers)
- Hibernation API details (no timers, serializeAttachment, alarms) - third-party skill summaries plus long-standing Cloudflare docs - MEDIUM
- better-auth: third-party skill pages only (no D1 adapter, use Drizzle/Kysely; plugins Passkey/Magic Link/Email OTP; v1.4 breaking changes) - MEDIUM/LOW; verify on better-auth.com
- OpenGameArt (horse gallop pack node 167525 mixed CC0/CC-BY; zebra whinny CC-BY), Mixkit (Mixkit License), Freesound CC0 filter, Kenney CC0 - web search - LOW-MEDIUM; per-file licence check required
- Not available this session: Context7 and Exa/Firecrawl MCP tools were not accessible; findings rely on npm registry plus web search and training knowledge for API behaviour.

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
