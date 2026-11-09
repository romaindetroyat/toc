# Phase 4: Comptes, amis et application installable - Research

**Researched:** 2026-10-17
**Domain:** Passkey-only accounts without e-mail on Cloudflare Workers + D1 (WebAuthn, session cookie, backup code, invitations, friends), Web Push from Durable Objects (VAPID + aes128gcm with WebCrypto, iOS 16.4+ installed web apps), installable PWA with vite-plugin-pwa injectManifest and a prompt-to-update flow, on the existing embedded-assets deploy
**Confidence:** HIGH for the server mechanics (WebAuthn registration and login, VAPID signing and payload encryption ran inside workerd in this session; the injectManifest service worker built with Vite 8.3.4) and for the codebase seams; MEDIUM for iOS installed-app behaviour (passkeys, cookies and push in a Home Screen web app need a real-iPhone check) and for production-only Workers limits.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
**Implementation Decisions (Romain, 2026-10-17)**

*Accounts*
- **D-01: No e-mail at all.** Asked « Pour envoyer les codes par e-mail, il faut un nom de domaine à toi… En as-tu un ? », Romain answered « Pas d'e-mail ». Accounts are a unique pseudo plus a passkey; there is no e-mail address, no e-mail code and no e-mail recovery. This narrows ACCT-01: record it in REQUIREMENTS.md as Romain's choice. No Resend, no domain purchase. — **Reversibility:** moderate. E-mail could be added later as an optional recovery path.
- **D-02: Recovery by a backup code.** When the account is created, the player gets a recovery code to keep (a screenshot or on paper). It lets them add a passkey on a new device. Romain: « Code de secours (Recommandé) ». The code is shown once, stored only as a hash, and can be regenerated from the account.
- **D-03: Sign-up by invitation only.** A new account needs an invitation link from a registered player, so the circle stays among relatives. Romain: « Sur invitation (Recommandé) ». Bootstrapping Romain's own first account is the planner's call: for example a one-time setup link or a secret set with `wrangler secret`, never committed.
- **D-04: Unique pseudo** across the game. Romain: « Unique (Recommandé) ». Case-insensitive uniqueness and allowed characters are the planner's call; accents must be allowed (French names).
- **D-05: Guests stay.** Anyone can still join a table by its link with a first name and no account, as in phase 2. An account adds friends, notifications and, later, history. Romain: « On les garde (Recommandé) ». Signing in on a device must keep that device's seats in its current games: the device token goes with the account.

*Friends and tables*
- **D-06: Signing up through someone's invitation link makes you friends automatically.** Romain: « Oui, automatiquement (Recommandé) ». A registered player can also add a friend by code or link (ACCT-03), and sees their friends list.
- **D-07: Tables are joined by the shared link plus friends.** The phase 2 link keeps working. On top of it, the creator can invite a friend in one tap, and the friend gets a notification. Romain: « Lien + amis (Recommandé) ». Seats, teams and per-seat computer strength reuse the phase 2 waiting room. The solo game is the existing local game (« Jouer contre l'ordinateur »).

*Installable app and notifications*
- **D-08: Notifications only when the app is closed.** « C'est ton tour » and « on t'invite » are sent only when the player doesn't have the game open, never while they are playing. Romain: « Seulement app fermée (Recommandé) ». This uses Web Push (VAPID keys as Worker secrets, subscriptions in D1) and must work on an installed iPhone app (iOS 16.4+). The research must confirm the iOS constraints and how the Durable Object knows a player is « away », e.g. no open socket for that account.
- **D-09: The PWA follows CLAUDE.md:** vite-plugin-pwa with injectManifest, a prompt-to-update flow (an update never reloads a game in progress), an icon and a splash screen built from the logo of plan 02-04b, `lang: fr`, and a landscape orientation, since the board is landscape only.

### Claude's Discretion
- The auth library: CLAUDE.md suggests better-auth with its passkey plugin and Drizzle on D1. The research must check it works passkey-only and without e-mail on Workers and D1, or recommend a smaller hand-rolled passkey flow with SimpleWebAuthn. Any new package needs Romain's approval, asked through the usual AskUserQuestion.
- The session handling (cookie on the Worker's origin), the D1 schema (users, passkeys, recovery codes, invitations, friendships, push subscriptions), how a socket hello carries the account, how the phase 2 device token links to an account, the exact screens (galet style, French), and the free-plan budget (D1 rows, push sends).

### Deferred Ideas (OUT OF SCOPE)
- E-mail (codes, recovery, notifications): Romain chose « Pas d'e-mail ».
- A custom domain: none for now.
- Romain as an administrator who can reset an account: not chosen; the backup code is the recovery.

Also out of scope (CONTEXT « Phase Boundary »): history, stats and leaderboard UI (phase 5); spectators; free-text chat.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md) | Research Support |
|----|-------------------------------|------------------|
| ACCT-01 | Un joueur crée un compte (pseudo unique) sur invitation et se connecte par passkey ; il récupère son compte avec un code de secours. *(Sans e-mail, choix de Romain le 2026-10-17 : « Pas d'e-mail ».)* | Option B (SimpleWebAuthn, verified in workerd), Pattern 1 (ceremonies), Pattern 2 (RP ID), Pattern 3 (backup code), Pattern 5 (invitations, bootstrap), Pattern 9 (D1 schema), pseudo rules (Pattern 5). |
| ACCT-02 | La session reste ouverte entre les visites, y compris dans l'application installée. | Pattern 4 (HttpOnly `__Host-` cookie, 400-day sliding session in D1, cold start reads `/api/me` from the precached shell), Pitfall 4 (iOS installed app has its own cookie jar). |
| ACCT-03 | Un joueur ajoute un ami avec un code ou un lien d'invitation, et voit sa liste d'amis. | Pattern 5 (128-bit link, 40-bit short code for signed-in players, rate-limited in the account's PlayerHub), `friendships` table (Pattern 9). |
| ACCT-04 | Un joueur crée une table, invite des amis, répartit les places et les équipes, et règle le niveau de l'ordinateur pour chaque place libre. | Existing phase 2 waiting room + Pattern 10 (« Inviter un ami » → `POST /api/tables/:id/invite` → PlayerHub notice or push), Pattern 4 (account seats). |
| ACCT-05 | Un joueur lance une partie solo contre trois joueurs gérés par l'ordinateur. | Already built (« Jouer contre l'ordinateur », `#/ordinateur`); Pattern 8 makes it start offline from the installed app (precache). |
| APP-01 | Le jeu s'installe comme application (PWA) sur téléphone et ordinateur, avec une icône et un écran de démarrage. | Pattern 8 (manifest + `orientation: "landscape"`, existing 02-04b icons, iOS `apple-touch-startup-image` generated by `tools/build-icons.mjs` with sharp, install prompts). |
| APP-02 | Une mise à jour du jeu ne recharge jamais une partie en cours ; le joueur est invité à mettre à jour. | Pattern 8 (`registerType: "prompt"`, `injectRegister: false`, SW waits for `SKIP_WAITING`; the « Nouvelle version » prompt is never shown during a game), Pitfall 7. |
| APP-03 | Le joueur reçoit une notification quand c'est son tour ou qu'on l'invite à une table (sur iOS : application installée). | Pattern 6 (PlayerHub = presence of an open app), Pattern 7 (VAPID + aes128gcm with WebCrypto, verified in workerd; Apple requirements quoted), Pattern 10 (triggers from GameRoom deadlines). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Cloudflare only: Workers (not Pages), SQLite-backed Durable Objects for live state, D1 for accounts/friends/history; KV is wrong for friends/history.
- Hibernation API for every WebSocket (`ctx.acceptWebSocket`), no `setTimeout`/`setInterval` in a DO (alarms only), ping/pong through `setWebSocketAutoResponse`.
- Server-authoritative; never trust the client; per-seat projection; Zod validates every WebSocket message and API body, schemas shared from `packages/protocol` (the repo uses `zod/mini`).
- Secrets through `wrangler secret`, never in `wrangler.jsonc` (applies to VAPID private key, pepper, bootstrap code).
- PWA: vite-plugin-pwa 2.0 `injectManifest`, `registerType: 'prompt'`, never intercept `/ws` or `/api` (CLAUDE.md names `/api/auth`; this research extends it to all `/api/*`), precache shell + images; `lang: "fr"`.
- UI in French; « galet » board, landscape on phone and desktop; no raw HTML sinks in `apps/web/src` (`no-raw-html.test.ts`).
- Vitest stays on the 4.1 line; workerd tests through `@cloudflare/vitest-plugin` (phase 2 finding).
- **Conflicts to resolve in favour of the later decision:** CLAUDE.md's PWA section says `orientation: "any"` (portrait playable); D-09 and the CLAUDE.md constraint « paysage obligatoire » say landscape → use `"landscape"`. CLAUDE.md recommends better-auth + Drizzle + Resend + Hono; D-01 removes Resend, and this research recommends against better-auth/Drizzle/Hono for this phase (see Standard Stack, with numbers). Any new package needs Romain's approval (CONTEXT, Claude's Discretion).
- GSD workflow: changes go through GSD commands.

## Summary

The phase is mostly server plumbing around primitives that already exist. Phase 2 left a thin Worker router (`handleRequest` returns `null` for what is not its own, so both deploy entries share it), one SQLite `GameRoom` Durable Object per table whose sockets carry `{ who, helloAt }` attachments, a device token that travels only in the `hello` frame, a D1 database « toc » bound as `DB` with SQL migrations in `apps/worker/migrations`, and a phase 2 waiting room that already handles seats, teams and per-seat computer strength. Phase 4 adds: a D1 account schema, about fifteen `/api/*` routes, a session cookie read by the Worker (also on the WebSocket upgrade, so the account reaches the GameRoom through a header the Worker sets), one new Durable Object class per account (`PlayerHub`) that knows whether the player has the app open and either shows an in-app notice or sends a Web Push, and the PWA layer (service worker, manifest, update prompt, iOS splash images).

The auth library question has a clear answer. **better-auth 1.7.10 cannot do accounts without e-mail cleanly**: its core user table declares `email` as `required: true, unique: true`, so every account would need a fake address; its passkey-first registration exists (`registration.requireSession: false` + `resolveUser` + `afterVerification`) but expects the user row to exist already, so invitation gating, pseudo creation, backup codes, friends and push stay custom anyway. Bundled for workerd it weighs 2,584 KiB with 89.9 ms of local startup CPU, against 711 KiB / 26.1 ms for **SimpleWebAuthn 14.0.3 + a Web Push library + our own code**. A hand-rolled flow on `@simplewebauthn/server` was run end to end inside workerd in this session (software ES256 authenticator → `verifyRegistrationResponse` → `verifyAuthenticationResponse`, `verified: true`, no `nodejs_compat`), and VAPID signing + aes128gcm encryption with `@block65/webcrypto-web-push` 2.0.0 ran in the same Worker. Both fit the Free plan's 10 ms CPU per request (≈0.8 ms per login verification, ≈2 ms per push message, measured in Node on this machine).

Two platform facts shape the design. **Free-plan CPU kills slow password hashing**: PBKDF2 at 100,000 iterations costs ≈21 ms CPU here, and production Workers cap PBKDF2 iterations through the runtime's limit enforcer; so the backup code must carry enough entropy (100 bits) to be stored as a peppered HMAC-SHA-256, with attempts limited per account in that account's Durable Object. **iOS only delivers Web Push to an installed Home Screen web app (iOS 16.4+), only after a permission request made from a user gesture, and revokes the permission if a push does not show a notification** (Apple: « Safari doesn't support invisible push notifications ») — so « only when the app is closed » (D-08) must be decided on the server (PlayerHub presence), never by a silent push.

**Primary recommendation:** Option B — `@simplewebauthn/server` 14.0.3 + `@simplewebauthn/browser` 14.0.0, our own `__Host-` session cookie backed by a D1 `sessions` table, raw SQL migration `0002_accounts.sql` (no Drizzle), the existing fetch router (no Hono), `@block65/webcrypto-web-push` 2.0.0 for push, one `PlayerHub` SQLite DO per account for presence/notices/push/rate limits, and vite-plugin-pwa 2.0.0 + workbox-precaching/workbox-window 7.4.1 for the service worker. RP ID = `toc.romaindetroyat.workers.dev` with the `rp_id` stored per passkey so a domain move stays possible.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| WebAuthn options/verification, challenge storage | Worker (`apps/worker/src/auth/*`) | D1 `challenges`, `passkeys` | Stateless Worker per request; challenges single-use in D1. |
| Passkey ceremony in the browser | Browser (`@simplewebauthn/browser`) | OS authenticator (iCloud Keychain, Google Password Manager, Windows Hello) | `navigator.credentials` only exists client-side. |
| Session (cookie → user) | Worker (cookie parse + D1 `sessions` lookup) | Browser (HttpOnly cookie, never readable by JS) | Same-origin cookie, sent on fetch and on the WebSocket upgrade. |
| Account on a table socket | Worker sets a trusted header on the upgrade | GameRoom attachment + `@toc/table` person `account` | The DO is reachable only through the Worker; the client never names its account. |
| Backup code verification + attempt limits | `PlayerHub` DO of the target account | D1 `users.backup_mac` | Strongly consistent per account, no KV, no D1 write per failure. |
| Invitations, friendships, pseudo uniqueness | Worker + D1 | — | Relational, cross-account (UNIQUE `pseudo_key`). |
| « App is open » presence, in-app notices | `PlayerHub` DO (hibernating socket per open app) | Browser (`/ws/me`, visibility frame) | D-08 needs the server to know the app is open; GameRoom only knows its own table. |
| Web Push send (VAPID, encryption, 404/410 cleanup) | `PlayerHub` DO | D1 `push_subscriptions` | One place per account: dedupe, rate limit, JWT cache. |
| « C'est ton tour » trigger | GameRoom (pure `@toc/table` deadline `notify`) | PlayerHub decides push vs in-app | The table knows who is missing (D-04 pause). |
| Showing the notification, click → table | Service worker (`push`, `notificationclick`) | — | Must show a notification for every push (Apple). |
| Precache, offline start, update prompt | Service worker + `virtual:pwa-register` | Svelte update store | APP-02: the page decides when to apply the waiting worker. |
| Install prompt / iOS instructions, splash | Browser (manifest, `beforeinstallprompt`, `apple-touch-startup-image`) | Build (`tools/build-icons.mjs`, sharp) | No server part. |
| Solo game | Browser (existing local game) | Service worker precache | Works offline once installed (ACCT-05). |

## Standard Stack

### Core (already in the repo — read this session)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| wrangler | 4.151.1 (root devDependency) | dev, deploy, `types`, D1 migrations, `check startup` | `"wrangler": "4.151.1"` in root `package.json` [VERIFIED: package.json]. |
| @cloudflare/vitest-plugin | 1.4.4 (`apps/worker` devDependency) | workerd tests with real D1/DO | `"@cloudflare/vitest-plugin": "1.4.4"` [VERIFIED: apps/worker/package.json]. |
| zod | 4.6.7 (`packages/protocol`) | All new API bodies, hub frames | `import * as z from "zod/mini"` [VERIFIED: packages/protocol/src/frames.ts:21]. |
| partysocket | 1.3.0 (`apps/web`) | Reconnecting socket — reuse for `/ws/me` | [VERIFIED: apps/web/package.json]. |
| uqr | 0.1.3 (`apps/web`) | QR of the invitation link (reuse the 02 InviteSheet) | [VERIFIED: apps/web/package.json]. |
| sharp | 0.35.5 (root devDependency) | iOS splash images in `tools/build-icons.mjs` | `"sharp": "0.35.5"` [VERIFIED: package.json]; replaces `@vite-pwa/assets-generator`. |
| @playwright/test | 1.64.0 | e2e incl. **built-in virtual WebAuthn** (`context.credentials`) | [VERIFIED: playwright-core 1.64.0 types.d.ts:21202 `export interface Credentials`]. |
| vite / svelte | 8.3.4 / 5.57.2 | client | [VERIFIED: apps/web/package.json]. |

### To add (pin exact versions; each needs Romain's approval)

| Library | Version | Where | Purpose | Why |
|---------|---------|-------|---------|-----|
| @simplewebauthn/server | 14.0.3 | `apps/worker` dependency | `generateRegistrationOptions`, `verifyRegistrationResponse`, `generateAuthenticationOptions`, `verifyAuthenticationResponse`; helpers `isoBase64URL`, `isoCBOR`, `decodeClientDataJSON` | Maintained since 2020 (103 versions), MIT, no install scripts; verified in workerd this session without `nodejs_compat` [VERIFIED: spike]. 321 KB minified / 89 KB gzip in a Worker bundle [VERIFIED: esbuild spike]. |
| @simplewebauthn/browser | 14.0.0 | `apps/web` dependency | `startRegistration({ optionsJSON })`, `startAuthentication({ optionsJSON })`, `browserSupportsWebAuthn`, `WebAuthnError` | 8.6 KB minified / 2.9 KB gzip, zero deps [VERIFIED: esbuild spike, npm registry]. Keeps iOS 16/17 working (no reliance on `PublicKeyCredential.parseCreationOptionsFromJSON`). |
| @block65/webcrypto-web-push | 2.0.0 | `apps/worker` dependency | `buildPushPayload(message, subscription, vapid)` → `{ headers, method, body }`; `vapidHeaders` | WebCrypto only (RFC 8291 aes128gcm + RFC 8292 VAPID), 17 KB unpacked, one dep (`uint8array-extras`), ran in workerd this session [VERIFIED: spike]. Discovered by name from training knowledge → `[ASSUMED]` provenance, gate with `checkpoint:human-verify`. |
| vite-plugin-pwa | 2.0.0 | `apps/web` devDependency | injectManifest build of `src/sw.ts`, `virtual:pwa-register` | D-09 / CLAUDE.md; peers `vite ^…|| ^8.0.0`, built a service worker with Vite 8.3.4 in this session [VERIFIED: scratch build]. |
| workbox-precaching | 7.4.1 | `apps/web` devDependency | `precacheAndRoute(self.__WB_MANIFEST)`, `cleanupOutdatedCaches()` in the service worker | Required by injectManifest docs [CITED: vite-pwa docs guide/inject-manifest.md]; pulls workbox-core/routing/strategies 7.4.1. |
| workbox-window | 7.4.1 | `apps/web` devDependency | Used by `virtual:pwa-register` | « You will need to add `workbox-window` as a `dev` dependency » [CITED: vite-pwa docs frameworks/svelte.md]; pnpm's strict layout needs it declared. |

### Not added (deliberate deviations from CLAUDE.md, with reasons)

| Listed in CLAUDE.md | Decision | Reason |
|---------------------|----------|--------|
| better-auth 1.7.x + @better-auth/passkey | **Reject** | See Option A vs B below: e-mail is a required unique column, passkey-first sign-up still needs custom user creation, 3.6× the bundle and 3.5× the startup CPU, a pre-1.0-style release cadence (1.7.10 published 2026-10-16), and its passkey plugin pins `@simplewebauthn/server ^13.3.1` (one major behind). |
| drizzle-orm / drizzle-kit | **Skip** | ~9 tables, hand-written SQL migration like `0001_games.sql`; D1 `batch()` gives transactions. Drizzle was only wanted as better-auth's adapter. |
| Hono | **Skip** | The existing router (`handleRequest`) plus a 30-line route table covers ~15 routes; cookies and CSRF checks are a few lines (Code Examples). Revisit only if routes double. |
| Resend | **Removed by D-01** | No e-mail. |
| @vite-pwa/assets-generator 2.0.0 | **Skip** | `tools/build-icons.mjs` already renders every icon with sharp; adding the iOS landscape splash sizes there is ~30 lines and avoids `cac/unconfig/sharp-ico`. |
| web-push 3.6.7 | **Reject** | Node-only (`https`, `crypto`), last published 2024-01 [VERIFIED: npm registry `time.modified`]. |
| @cloudflare/vite-plugin | **Still skip** | Same reason as phase 2 (embedded build layout). |

### Option A vs Option B (question 1)

| Criterion | A: better-auth 1.7.10 + @better-auth/passkey 1.7.10 (D1 via Kysely) | B: @simplewebauthn/server 14.0.3 + own session (~350 lines) |
|-----------|------------------------------------------------------------|----------------------------------------------|
| No e-mail | Core user schema: `email: { type: "string", unique: true, required: true, ...}` [VERIFIED: @better-auth/core@1.7.10 dist/db/get-tables.mjs:160-166] → fake `…@toc.invalid` addresses | Native: users have a pseudo and a WebAuthn user handle only |
| Username-only sign-up gated by invitation | Possible with `registration: { requireSession: false, resolveUser, afterVerification }`; `resolveUser` is mandatory without a session (`if (!opts.registration?.resolveUser) throw APIError.from("BAD_REQUEST", PASSKEY_ERROR_CODES.RESOLVE_USER_REQUIRED)`), and with `createSession` it calls `findUserById(targetUserId)` so the user must already exist [VERIFIED: @better-auth/passkey@1.7.10 dist/index.mjs:23-49, 360-411] → a custom pre-step creates the user and checks the invitation anyway | The sign-up options route checks the invitation and pseudo, the verify route writes user + passkey + friendship + session in one D1 batch |
| Backup code, friends, push | Not provided (backup codes exist only inside the two-factor plugin) → custom | Custom (same code either way) |
| D1 on Workers | Accepted directly (`D1Database` in the `database` option) [VERIFIED: @better-auth/core src/types/database.ts:17, init-options.ts:630]; must be built per request (`betterAuth({ database: env.DB, … })` inside `fetch`, or module-level with `env` from `cloudflare:workers`) [ASSUMED pattern]; schema via its own CLI | Plain `env.DB.prepare().bind()` like `apps/worker/src/record.ts` |
| Bundle in the Worker | 2,584.48 KiB uncompressed / 464.68 KiB gzip; esbuild minified 1,144,842 B (308,236 gzip) [VERIFIED: `wrangler check startup` + esbuild spike] | 710.76 KiB / 130.97 KiB gzip for SimpleWebAuthn + push lib + test authenticator; SimpleWebAuthn alone 321,492 B minified (88,669 gzip) [VERIFIED: same] |
| Startup CPU (local profile) | 89.9 ms active [VERIFIED: `wrangler check startup`] | 26.1 ms active [VERIFIED: same] — both under the 1 s startup limit [CITED: workers/platform/limits « Worker startup time »] |
| Workers compatibility | Bundles without `nodejs_compat` (spike built) — runtime not exercised | Exercised: registration + login verified in workerd |
| Risk | Large surface, frequent releases, abstractions over cookies/CSRF we must still audit; two WebAuthn majors in the tree | ~350 lines we own; the crypto parts stay in SimpleWebAuthn |
| Fit | Poor (built around e-mail identities) | Good |

**Recommendation: Option B.**

**Installation (when the plans run, after Romain's approval):**
```bash
pnpm --filter @toc/worker add @simplewebauthn/server@14.0.3 @block65/webcrypto-web-push@2.0.0
pnpm --filter @toc/web add @simplewebauthn/browser@14.0.0
pnpm --filter @toc/web add -D vite-plugin-pwa@2.0.0 workbox-precaching@7.4.1 workbox-window@7.4.1
```

**Version verification (npm registry, 2026-10-17):** @simplewebauthn/server 14.0.3 (modified 2026-09-25), @simplewebauthn/browser 14.0.0 (2026-09-02), @block65/webcrypto-web-push 2.0.0 (2026-09-15), vite-plugin-pwa 2.0.0 (2026-10-03), workbox-* 7.4.1 (2026-05-04), better-auth 1.7.10 (2026-10-16), @better-auth/passkey 1.7.10, hono 4.13.13, drizzle-orm 0.45.4, @pushforge/builder 2.0.5, web-push 3.6.7 (2024-01-16). Note: CLAUDE.md lists better-auth 1.7.7; latest is 1.7.10.

## Package Legitimacy Audit

`gsd-tools query package-legitimacy check --ecosystem npm` returned **SUS** for every package, with reasons only `unknown-downloads` (the downloads API is unreachable from this sandbox) and, for some, `too-new` (latest version days old). No `postinstall`/`install` script on any recommended package; repository URLs are the expected ones.

| Package | Registry | Age (first publish) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|---------------------|-----------|-------------|---------|-------------|
| @simplewebauthn/server | npm | 2020-05 (103 versions) | unknown | github.com/MasterKale/SimpleWebAuthn | SUS (too-new, unknown-downloads) | Approved pending Romain — CLAUDE.md names SimpleWebAuthn; pin 14.0.3 |
| @simplewebauthn/browser | npm | 2020-05 (68 versions) | unknown | github.com/MasterKale/SimpleWebAuthn | SUS (unknown-downloads) | Approved pending Romain; pin 14.0.0 |
| @block65/webcrypto-web-push | npm | 2023-04 (9 versions) | unknown | github.com/block65/webcrypto-web-push | SUS (unknown-downloads) | **Flagged** — found by name from training knowledge (`[ASSUMED]`); `checkpoint:human-verify` before install; fallback: hand-port its ~150 lines (RFC 8291/8292) with a decrypt round-trip test |
| vite-plugin-pwa | npm | 2020-08 (136 versions) | unknown | github.com/vite-pwa/vite-plugin-pwa | SUS (too-new, unknown-downloads) | Approved pending Romain — D-09 names it; pin 2.0.0 |
| workbox-precaching, workbox-window (+ workbox-core/routing/strategies transitively) | npm | 2019 (Google) | unknown | github.com/googlechrome/workbox | SUS (unknown-downloads) | Approved pending Romain; pin 7.4.1 |
| better-auth, @better-auth/passkey | npm | — | unknown | github.com/better-auth/better-auth | SUS (too-new) | Not installed |
| @pushforge/builder | npm | 2025-04 | unknown | github.com/draphy/pushforge | SUS | Not installed (alternative to block65, zero deps, 6.3 KB minified) |

Transitive packages brought by `@simplewebauthn/server` 14.0.3: `@peculiar/x509`, `@peculiar/asn1-*` (ecc, rsa, x509, schema, android, x509-post-quantum), `@hexagon/base64`, `@levischuck/tiny-cbor`, `reflect-metadata` [VERIFIED: npm view dependencies]. `vite-plugin-pwa` brings `workbox-build` (babel, rollup) at build time only.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** all, for missing download data only; `@block65/webcrypto-web-push` is the one whose recommendation rests on training knowledge — the planner adds `checkpoint:human-verify` before installing it.

## Architecture Patterns

### System Architecture Diagram

```
 Browser / installed app (Svelte SPA, served by the service worker when installed)
 ┌──────────────────────────────────────────────┐
 │ #/invitation/<code>  pseudo → passkey create ─┼─POST /api/auth/signup/{options,verify}──┐
 │ « Se connecter » (usernameless passkey) ──────┼─POST /api/auth/login/{options,verify}───┤
 │ « Code de secours » pseudo+code → new passkey ┼─POST /api/auth/recover{,/verify}────────┤   Worker « toc » (handleRequest)
 │ #/amis, #/compte, Home (Mes parties, amis) ───┼─GET/POST/DELETE /api/me, /api/friends…─┤   ├─ cookie __Host-toc_session → D1 sessions
 │ « Activer les notifications » (gesture) ──────┼─POST /api/push/subscriptions───────────┤   ├─ Origin + JSON checks on every POST/DELETE
 │ Waiting room « Inviter un ami » ──────────────┼─POST /api/tables/:id/invite────────────┤   ├─ D1: users, passkeys, sessions, challenges,
 │                                               │                                         │   │      invitations, friendships, push_subscriptions,
 │ App open: /ws/me (hub socket, vis frames) ════┼═════════ upgrade + cookie ══════════════╪══►│      table_members  (+ games from phase 2)
 │ Table:    /ws/table/:id  (hello{v,token,name})┼═════════ upgrade + cookie ══════════════╪══►├─ /ws/me → PLAYER_HUB.getByName(userId).fetch
 └──────────────────────────────────────────────┘                                         │   └─ /ws/table/:id → GAME_ROOM.getByName(id).fetch
   ▲ notice{invite|turn} (in-app toast)                                                    │        with header x-toc-account (set by the Worker)
   │                                                                                       ▼
 Service worker (sw.js)                         GameRoom DO (per table)            PlayerHub DO (per account, SQLite)
 ├─ precache shell, cards, fonts, icons         ├─ attachment {who, helloAt, account}  ├─ sockets of the open app (+visible flag)
 ├─ push → showNotification (always)            ├─ hello: account → its person (D-05)  ├─ notify(kind,…): open & visible → notice frame
 ├─ notificationclick → focus / openWindow      ├─ pause (D-04) → deadline notify+30 s │                  else → D1 push_subscriptions
 └─ message SKIP_WAITING (only when the page    └─ alarm: notify → RPC hub.notify() ───┼─►               → buildPushPayload → fetch
    asks: never during a game)                                                         │                  (web.push.apple.com, FCM, Mozilla)
                                                                                       ├─ dedupe + rate limits (invites, short codes)
                                                                                       └─ backup-code attempts / lockout
```

### Recommended Project Structure

```
packages/protocol/src/
├── account.ts        # NEW: normalizePseudo, pseudoKey, BACKUP_CODE / INVITE_LINK / SHORT_CODE regexes,
│                     #   zod/mini bodies of every /api route, MeResponse, FriendEntry, hub frames, HUB_VERSION
└── frames.ts         # unchanged shape (PROTOCOL_VERSION stays 5 unless a table frame changes)
packages/table/src/
├── table.ts          # Person gains `account: string | null` (never in frames); snapshot loader defaults it
├── reduce.ts         # hello command gains `account`; new deadline kind `notify`; outbox item `notify`
apps/worker/src/
├── index.ts          # router: adds /api/auth/*, /api/me*, /api/friends*, /api/invitations*, /api/push/*,
│                     #   /api/tables/:id/invite, /ws/me; exports GameRoom and PlayerHub
├── http.ts           # NEW: json(), readJson(max), requireSameOrigin(), cookie get/set, route table
├── auth/
│   ├── webauthn.ts   # NEW: RP config, options/verify wrappers around @simplewebauthn/server
│   ├── session.ts    # NEW: create/read/refresh/revoke sessions, cookie attributes
│   ├── backup.ts     # NEW: generate (Crockford base32), normalize, HMAC with pepper
│   └── routes.ts     # NEW: signup, login, add passkey, recover, logout, backup-code regeneration
├── social.ts         # NEW: invitations, friendships, table invites
├── push.ts           # NEW: subscription routes, sendPush(sub, payload) with JWT cache, 404/410 cleanup
├── PlayerHub.ts      # NEW: DO per account (presence sockets, notify, rate limits, recovery attempts)
├── GameRoom.ts       # attachment gains account; notify outbox → hub RPC after commit
apps/worker/migrations/0002_accounts.sql   # NEW (D1)
apps/web/src/
├── sw.ts             # NEW service worker (precache, push, notificationclick, SKIP_WAITING)
├── pwa/update.svelte.ts   # NEW: registerSW + needRefresh store + « pas pendant une partie » rule
├── pwa/install.svelte.ts  # NEW: beforeinstallprompt, iOS standalone detection
├── account/          # NEW: api client (me, auth ceremonies, friends, push), store, screens
├── routes/           # + Invitation.svelte, Account.svelte, Friends.svelte; Home/WaitingRoom gain account parts
tools/build-icons.mjs # + iOS landscape apple-touch-startup-image PNGs
tools/vapid-keys.mjs  # NEW: one-off P-256 key pair printer (public → var, private → wrangler secret)
```

### Pattern 1: Passkey ceremonies with SimpleWebAuthn (ACCT-01)

Options (all ceremonies):
- `rpName: "TOC"`, `rpID` and `expectedOrigin` from a fixed config (Pattern 2), `attestationType: "none"` (default).
- Registration: `userName` = `userDisplayName` = the pseudo; `userID` = the account's random 32-byte WebAuthn user handle (`users.webauthn_user_id`, never the pseudo or the D1 id); `authenticatorSelection: { residentKey: "required", userVerification: "preferred" }` (discoverable credential → usernameless login, no pseudo enumeration at login); `excludeCredentials` = the account's passkeys when adding one. The spike's options came back as `{"residentKey":"required","userVerification":"preferred","requireResidentKey":true}` with algorithms `-8, -7, -257` [VERIFIED: spike output].
- Login: `generateAuthenticationOptions({ rpID, userVerification: "preferred" })` with no `allowCredentials`; on verify, look up `passkeys.id = response.id`, check `response.response.userHandle` equals the owner's `webauthn_user_id`, call `verifyAuthenticationResponse({ …, credential: { id, publicKey, counter, transports }, requireUserVerification: false })`, then update `counter` and `last_used_at` (synced passkeys report 0; SimpleWebAuthn accepts 0→0) [ASSUMED counter behaviour].
- Challenges: one D1 row per ceremony `(challenge PK, purpose, user_id, pending JSON, expires_at = now + 5 min)`. The verify route decodes the challenge from `clientDataJSON` (`decodeClientDataJSON` helper), deletes the row (`DELETE … WHERE challenge = ? AND purpose = ? AND expires_at > ?`, check `meta.changes === 1`) — single use — then passes the string as `expectedChallenge`.

Routes (all POST bodies JSON ≤ 8 KB, zod/mini strict objects):
| Route | Auth | Effect |
|-------|------|--------|
| `POST /api/auth/signup/options {invitation, pseudo}` | none | invitation valid (unused, unexpired) and pseudo free → challenge `register` with `pending {pseudoDisplay, pseudoKey, invitationHash, userHandle}` → creation options |
| `POST /api/auth/signup/verify {response}` | none | verify → consume invitation (`UPDATE invitations SET used_by=?, used_at=? WHERE code_hash=? AND used_by IS NULL AND expires_at>?`, require `changes === 1`) → `DB.batch([INSERT users, INSERT passkeys, INSERT friendships ×2, INSERT sessions])` → `Set-Cookie` → `{ me, backupCode }` (shown once) |
| `POST /api/auth/login/options` / `…/verify {response}` | none | usernameless login → session cookie |
| `POST /api/auth/passkeys/options` / `…/verify` | session | add a passkey on this device (excludeCredentials) |
| `DELETE /api/auth/passkeys/:id` | session | refuse deleting the last passkey |
| `POST /api/auth/recover {pseudo, code}` | none | PlayerHub of that account checks the code (Pattern 3) → challenge `recover` bound to `user_id` → creation options |
| `POST /api/auth/recover/verify {response}` | none | new passkey → **revoke every session of the account** (lost phone) → new session → **new backup code** shown once (the used one is spent) |
| `POST /api/auth/backup-code` | session + fresh passkey assertion (≤ 5 min, step-up via login options) | regenerate (D-02) |
| `POST /api/auth/logout` | session | delete the session row, expire the cookie |
| `GET /api/me` | session | `{ id, pseudo, passkeys: [...], hasBackupCode, push: boolean }` or 401; refreshes the session (Pattern 4) |

Client: `startRegistration({ optionsJSON })` / `startAuthentication({ optionsJSON })` [VERIFIED: @simplewebauthn/browser 14.0.0 esm/methods/*.d.ts]; map `WebAuthnError`/`NotAllowedError` (user cancelled) to calm French messages; check `browserSupportsWebAuthn()` before showing account actions (old browsers keep the guest flow, D-05).

### Pattern 2: RP ID and origin (question 2)

- `rpID = "toc.romaindetroyat.workers.dev"`, `expectedOrigin = "https://toc.romaindetroyat.workers.dev"`, defined once (e.g. `vars.RP_ID`/`vars.ORIGIN` identical in both wrangler files, asserted by `tools/wrangler-configs.test.ts`), never derived from the request's Host in production. In `TOC_TEST_MODE` only, also accept `rpID "toc.test"`/origin `https://toc.test` (workerd tests: `export const ORIGIN = "https://toc.test";` [VERIFIED: apps/worker/test/helpers.ts:7]) and `localhost`/`http://localhost:8787` (Playwright: `baseURL: "http://localhost:8787"` [VERIFIED: apps/web/playwright.online.config.ts:23]).
- `workers.dev` is on the Public Suffix List (private section) [VERIFIED: publicsuffix/list public_suffix_list.dat line 12761 `workers.dev`], so `romaindetroyat.workers.dev` is a registrable domain and `toc.romaindetroyat.workers.dev` a valid RP ID for its own origin. Using the exact host (not `romaindetroyat.workers.dev`) keeps other Workers of the account from using these passkeys; the trade-off is that version preview URLs (other hosts) cannot sign in [ASSUMED preview host format].
- iOS installed app: passkeys are saved to iCloud Keychain and shared between Safari and the Home Screen app for the same RP ID [ASSUMED — real-iPhone UAT]. Desktop without a platform authenticator uses the browser's built-in « hybrid » QR flow to a phone (spec transport `hybrid`) [CITED: w3c/webauthn index.bs « hybrid »].
- **Cost of moving to a custom domain later:** passkeys are bound to the RP ID, so a new origin cannot use them directly. Two ways:
  1. **Related Origin Requests:** keep `rpID = "toc.romaindetroyat.workers.dev"` and serve `https://toc.romaindetroyat.workers.dev/.well-known/webauthn` (`application/json`, `{"origins": ["https://<new domain>"]}`); the new origin then calls WebAuthn with the old RP ID [CITED: w3c/webauthn index.bs §sctn-related-origins, lines 4529-4560]. Supported in Chrome and Safari, Firefox still considering [CITED: web.dev/articles/webauthn-related-origin-requests via search summary]. The workers.dev route must stay on forever.
  2. **Re-enrolment:** each player signs in on the new domain once (recovery code, or a one-time transfer token issued while signed in on the old origin) and creates a new passkey for the new RP ID.
  Either way, per-origin state is lost on a move: the installed app (reinstall), push subscriptions (re-subscribe), the session cookie, localStorage (device token, « Mes parties en cours »). **Mitigations now (cheap):** store `rp_id` on every passkey row; keep RP ID/origin in config only; tie table seats to accounts (Pattern 4) so seats survive a lost localStorage. If Romain might ever buy a domain, doing it **before** phase 4 ships costs nothing (Open Question 1).

### Pattern 3: Backup code (question 3, D-02)

- **Format:** 20 symbols of Crockford base32 (alphabet without I, L, O, U) = **100 bits**, shown as five groups of four, e.g. `K7QM-2XRA-P9DW-HT4E-NB6Z` [ASSUMED format]. Generated with `crypto.getRandomValues`. Input normalisation: uppercase, drop spaces and dashes, map `O→0`, `I/L→1`. Shown once with « Copier » and a print-friendly view; the screen asks « J'ai noté mon code » before continuing.
- **Storage:** `users.backup_mac = base64url(HMAC-SHA-256(key = TOC_PEPPER, data = userId + ":" + code))`; comparison with `crypto.subtle.timingSafeEqual` (Workers extension: « Compare two buffers in a way that is resistant to timing attacks » [CITED: workers/runtime-apis/web-crypto.mdx:486-492]). `TOC_PEPPER` is a 32-byte secret (`wrangler secret put`).
- **Why not PBKDF2/scrypt:** with 100 bits of entropy an offline guess is infeasible even with the pepper, so a slow KDF adds nothing; and it would not fit: PBKDF2-SHA256 at 100,000 iterations took 20.8 ms CPU on this machine [VERIFIED: node bench] against the Free plan's « CPU time per HTTP request | 10 ms » [CITED: workers/platform/limits.mdx:73]. Production also caps PBKDF2 iterations through the runtime's limit enforcer (`"Pbkdf2 failed: iteration counts above ", max, " are not supported"`) [VERIFIED: workerd src/workerd/api/crypto/impl.c++:256-263]; local workerd accepted 600,000 [VERIFIED: spike], and the production cap is reported as 100,000 [CITED: lord.technology/2024/02/21/hashing-passwords-on-cloudflare-workers.html].
- **Rate limiting without KV:** the Worker resolves `pseudoKey → userId` in D1 (unknown pseudo → generic « Pseudo ou code incorrect » after the same HMAC work), then calls `PLAYER_HUB.getByName(userId).checkBackupCode(mac)`; the hub keeps `attempts(at)` in its own SQLite, refuses while locked (5 failures → 15 min, doubling up to 24 h; reset on success) and compares with `users.backup_mac` read from D1. Strongly consistent per account, no D1 write per failure, and no Durable Object is created for random pseudos. The Workers Rate Limiting binding (« permissive, eventually consistent, and intentionally designed to not be used as an accurate accounting system » [CITED: workers/runtime-apis/bindings/rate-limit.mdx:220]) may be added per IP as a second layer; its Free-plan availability is not stated in the doc [ASSUMED available].
- **Flow to add a passkey with it:** recover → challenge `recover` (5 min, single use, bound to the user) → registration ceremony on the new device → all sessions revoked, new session, new backup code shown (Pattern 1). The account page then lists passkeys so the lost device's one can be removed.

### Pattern 4: Sessions, cold start, the account on table sockets, the device token (question 4, ACCT-02, D-05)

- **Cookie, not bearer token.** `Set-Cookie: __Host-toc_session=<43-char base64url of 32 random bytes>; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=34560000` (400 days). `__Host-` forbids `Domain` and requires `Path=/` + `Secure` [CITED: MDN Set-Cookie, mdn/content set-cookie/index.md:170]. Chrome caps any cookie lifetime at 400 days [CITED: developer.chrome.com/blog/cookie-max-age-expires]. A cookie is sent automatically on same-origin `fetch` and on the WebSocket upgrade, and HttpOnly keeps it out of reach of any script; a bearer token would have to live in localStorage (script-readable, subject to WebKit's 7-day cap on script-writable storage in Safari).
- **D1 `sessions`:** key = SHA-256(token) (a DB leak does not leak live tokens); `expires_at`, `seen_at`. **Sliding:** `GET /api/me` re-issues the cookie and updates the row only when `seen_at` is older than 7 days (≤ 1 row write per device per week). Logout deletes the row; recovery deletes all rows of the account.
- **Cold start of the installed app:** the service worker serves the precached shell offline-fast; `App.svelte` calls `GET /api/me`; the cookie (HttpOnly, server-set) is in the installed app's own cookie jar. WebKit keeps home-screen apps' server-set cookies (only JavaScript-created cookies and CNAME-cloaked ones get the 7-day cap; home-screen apps keep their own days-of-use counter) [CITED: bugs.webkit.org/show_bug.cgi?id=237350 (John Wilander), osnews summary of the WebKit clarification]. **The installed iOS app does not share cookies or localStorage with Safari** [ASSUMED, consistent with the WebKit material] → the player signs in once inside the installed app (the passkey is shared, so it is one tap). Offline: show the last known pseudo from localStorage (display only) and keep the solo game available.
- **The account on the table socket:** the Worker reads the cookie on `GET /ws/table/:id`, looks up the session, then forwards a **new** upgrade request to the GameRoom carrying `x-toc-account: <userId>` and `x-toc-pseudo: <encodeURIComponent(pseudo)>`, after deleting any client-sent copies (phase 2 already forwards upgrades with `stub.fetch(url, { headers: { Upgrade: "websocket" } })` in its tests). The GameRoom's `fetch` stores `account` in the attachment next to the existing fields — today `type Attachment = { who: string | null; helloAt: number };` [VERIFIED: apps/worker/src/GameRoom.ts:62]. The **`hello` frame does not change** (`t: z.literal("hello"), v: z.int(), token: …DEVICE_TOKEN_RE, name: z.string().check(z.maxLength(200))` [VERIFIED: packages/protocol/src/frames.ts:87-92]); for an account socket the server uses the pseudo, not `hello.name`. So `PROTOCOL_VERSION = 5` [VERIFIED: frames.ts:39 `export const PROTOCOL_VERSION = 5;`] can stay unless a table frame gains a field (bump to 6 if `SeatPublic` gets an account marker).
- **Person identity with accounts (D-05, « the device token goes with the account »):** today a person is `SHA-256(tableId + ":" + token)` (`` new TextEncoder().encode(`${tableId}:${token}`) `` [VERIFIED: GameRoom.ts:72-78]). Add `account: string | null` to `Person` (today `{ who: string; name: string; seat: Color | null; online: boolean }` [VERIFIED: packages/table/src/table.ts:12-18]) and resolve the socket's `who` at hello:
  1. account socket and a person already linked to that account → that person's `who` (any device of the account gets the seat back; the older socket is closed with 4001 as today);
  2. else account socket and the device person `hash(tableId:token)` exists **unlinked** → that person, now linked (`account`, name = pseudo) — this is how signing in keeps the device's seats;
  3. else account socket → a new person `who = SHA-256(tableId + ":acct:" + userId)`;
  4. guest socket whose device person is linked to an account → treat as a new guest (a linked seat needs its account; avoids a signed-out shared tablet reusing someone's seat) [ASSUMED policy — confirm with Romain].
  No `who` is ever renamed (votes, creator, pause lists stay valid). After signing in mid-table the client calls the existing `reconnect()` so the next upgrade carries the cookie.
- **Cross-device « Mes parties en cours »:** when a person becomes linked, the GameRoom writes `table_members(user_id, table_id, seat, joined_at)` to D1 after the commit (best effort, like the phase 2 game record); Home merges `GET /api/me/tables` with the device list `toc.tables.v1` [VERIFIED: apps/web/src/net/tables.ts:13]; a table that answers 404 is removed from both.

### Pattern 5: Invitations, friends, pseudo, bootstrap (D-03, D-04, D-06, ACCT-03)

- **Invitation link:** 16 random bytes → base64url (22 chars, same shape as table ids), URL `https://toc.romaindetroyat.workers.dev/#/invitation/<code>` (hash route: the code never reaches server logs as a path). Stored as `invitations.code_hash = SHA-256(code)`, `kind 'link'`, `expires_at = now + 7 days`, single use [ASSUMED policy — Open Question 2]. `GET /api/invitations/:code` → `{ inviter: pseudo, valid }` (only the holder learns the inviter's pseudo). Opening it **signed out** → sign-up (pseudo + passkey) → automatic two-way friendship with the inviter (D-06). Opening it **signed in** → « Devenir ami avec Marie » → friendship. Share sheet reuses the phase 2 InviteSheet (Web Share / copy, QR with `uqr`).
- **Short friend code** (ACCT-03 « par un code », signed-in players only): 8 Crockford base32 symbols (40 bits), `TOC-K7QM-2XRA`, valid 24 h, `kind 'code'`. Guessing is capped by the **requester's** PlayerHub (10 failures/hour) — sign-up is never possible with a short code, so unauthenticated guessing has nothing to hit.
- **Friend list:** `GET /api/friends` → `[{ id, pseudo, since }]`; `DELETE /api/friends/:id` removes both directions.
- **Pseudo (D-04):** display = NFC, whitespace collapsed, control/bidi characters removed (reuse the `HIDDEN` regex of `normalizeName`, `const HIDDEN = /[\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;` [VERIFIED: packages/protocol/src/names.ts:41]), 2-20 code points, allowed `^[\p{Script=Latin}\p{M}0-9 '’._-]+$` (accents yes, other scripts no → no Cyrillic look-alikes) [ASSUMED rule]. Uniqueness key `pseudo_key` = NFD → strip `\p{M}` → `toLowerCase()` → collapse spaces, so « Élodie » and « elodie » collide (case- and accent-insensitive). `UNIQUE(pseudo_key)` in D1 settles races; the sign-up says « Ce pseudo est déjà pris » only to an invitation holder.
- **Bootstrap (Romain's first account, D-03):** secret `TOC_BOOTSTRAP` (≥ 128-bit random, `wrangler secret put`) accepted as an invitation code **only while `users` is empty** (`SELECT 1 FROM users LIMIT 1`), compared with `timingSafeEqual`; no inviter → no friendship. After the first account it is dead weight; it can be deleted with `wrangler secret delete`.

### Pattern 6: PlayerHub — one Durable Object per account (D-08 « away », D-07 in-app invite)

- Binding `PLAYER_HUB`, class `PlayerHub`, migration `{ "tag": "v2", "new_sqlite_classes": ["PlayerHub"] }` appended in **both** wrangler files (the config test enforces identical blocks; current `"migrations": [{ "tag": "v1", "new_sqlite_classes": ["GameRoom"] }]` [VERIFIED: wrangler.jsonc:20, wrangler.embarque.jsonc:24]).
- `GET /ws/me` (cookie required, same Origin) → `PLAYER_HUB.getByName(userId).fetch(upgrade)`; the app opens it whenever it runs signed in (any screen). Hibernation + `setWebSocketAutoResponse("ping","pong")` as in GameRoom. Client frame `vis { visible: boolean }` on `visibilitychange`; server frame `notice { kind: "invite" | "turn", from, table, at }`. Own `HUB_VERSION`.
- **Away = no open hub socket whose last `vis` was visible** (a hidden desktop tab counts as away; an iOS app in the background loses its socket within seconds [ASSUMED, see 02 Pitfall 5]).
- RPC `notify({ kind, table, from, gameNo?, pauseId? })`: dedupe in hub SQLite (`sent(kind, key, at)`; e.g. one `turn` per table+pause, one `invite` per sender+table per 10 min); present → `notice` frame (in-app toast « Marie t'invite à sa table » [Rejoindre]); away → Web Push (Pattern 7). Also rate limits (invites sent per hour, short-code failures) and backup-code attempts (Pattern 3).
- Cost: one DO request per app open + incoming frames ÷ 20; pings are free (auto-response) [CITED: durable-objects pricing partial footnotes 2-3].

### Pattern 7: Web Push without heavy dependencies (question 5, APP-03)

- **Keys:** P-256 VAPID pair generated once (`tools/vapid-keys.mjs`, WebCrypto): public key (65-byte raw, base64url) in `vars.VAPID_PUBLIC_KEY` (identical in both configs) and served by `GET /api/push/key`; private scalar `d` in `wrangler secret put VAPID_PRIVATE_KEY`. Subject = `https://toc.romaindetroyat.workers.dev` (no e-mail, D-01): Apple accepts « a URL or `mailto:` » as the JWT subject [CITED: developer.apple.com « Sending web push notifications in web apps and browsers », BadJwtToken row].
- **Sending:** `buildPushPayload({ data, options: { ttl, urgency: "high", topic } }, subscription, { subject, publicKey, privateKey })` → `fetch(endpoint, { method, headers, body })` [VERIFIED: block65 2.0.0 dist/lib/payload.d.ts, ran in workerd]. The library pads every message to the 4,096-byte record (`content-length: 4096` in the spike; max plaintext 3,993 bytes) [VERIFIED: dist/lib/encrypt.js]. Apple: « The payload size is over the limit of 4 KB » → keep payloads small JSON `{ t, title, body, url, tag }`, French text built server-side. **JWT caching:** Apple says « Don't refresh your JWT more frequently than once per hour » [CITED: Apple doc] while `vapidHeaders` signs a new 12 h JWT per call → cache the `authorization` header per push-service origin for ≤ 1 h in the hub instance (and re-sign on eviction). `Topic` ≤ 32 base64url chars (e.g. `t-<8 chars of table hash>`) so a newer turn notice replaces an undelivered one; `TTL` 1800-3600 s.
- **Responses:** 201 ok; **404/410 → delete the subscription**; 429 → back off; 403 `BadJwtToken`/`VapidPkHashMismatch` → config error, log once [CITED: Apple doc status table]. Allow `https://*.push.apple.com` outbound (no firewall here).
- **iOS 16.4+ requirements** [CITED: Apple doc]: « Add web push to Home Screen web apps in iOS 16.4 or later »; permission « with a gesture… call the push subscription method immediately from the gesture's event handler »; « Safari doesn't support invisible push notifications. Present push notifications to the user immediately after your service worker receives them. If you don't, Safari revokes the push notification permission for your site. » No Apple Developer Program needed. So: show « Activer les notifications » only in the installed app on iOS (`matchMedia("(display-mode: standalone)")` or `navigator.standalone`), and in Safari tabs explain « Installe l'application pour être prévenu » (Partager → Sur l'écran d'accueil). Android/desktop browsers: same button, no install needed. `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })` (Chrome rejects without `userVisibleOnly: true` [CITED: MDN PushManager.subscribe]).
- **Storage:** D1 `push_subscriptions(endpoint PK, user_id, p256dh, auth, created_at, ok_at)`; `POST /api/push/subscriptions` upserts (an endpoint moving to another account is reassigned), `DELETE` removes; SW `pushsubscriptionchange` re-subscribes and re-posts (same-origin fetch carries the cookie).
- **Service worker:** `push` → always `showNotification(title, { body, tag, icon: "/icons/icon-192.png", lang: "fr", data: { url } })` (even if a client is open — iOS would revoke otherwise); `notificationclick` → focus a window client and `navigate(url)`, else `clients.openWindow(url)`.
- **Who sends, when:** the GameRoom never fetches push endpoints; it calls the hub. Sending happens inside the hub RPC (awaited), so no `waitUntil` is needed; DO `waitUntil` exists and « prevents eviction until it settles or for up to 15 minutes » [CITED: durable-objects/api/state.mdx:78-84] if fire-and-forget is ever preferred.
- **Budget:** ≈2.0 ms CPU per encrypted message [VERIFIED: node bench, 200 runs] → a player with 3 devices ≈ 6 ms, inside the Free 10 ms; ≤ 5 subrequests per notify (Free: « Subrequests per invocation | 50 » [CITED: workers/platform/limits.mdx:198]). Push services are free.

### Pattern 8: PWA — injectManifest, prompt update, manifest, splash, embedded deploy, offline (question 6)

- **Plugin config** (verified building with Vite 8.3.4 in a scratch project: `PWA v2.0.0 mode injectManifest … files generated dist/sw.js`, sw.js 16.23 kB / 5.46 kB gzip [VERIFIED]):
  ```ts
  VitePWA({
    strategies: "injectManifest", srcDir: "src", filename: "sw.ts",
    registerType: "prompt", injectRegister: false, manifest: false,   // keep public/manifest.webmanifest
    injectManifest: {
      globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2,ico,webmanifest}"],
      globIgnores: ["**/Bench-*", "**/DebugGeometry-*", "**/debugParams-*"],
    },
  })
  ```
  Vite 8 prints « inlineDynamicImports option is deprecated » during the SW build — harmless [VERIFIED: scratch build].
- **SW code:** `cleanupOutdatedCaches(); precacheAndRoute(self.__WB_MANIFEST);` (its `directoryIndex` serves `/` from `index.html`; all routes are hash routes so every navigation is `/`), `message` → `SKIP_WAITING` → `self.skipWaiting()` (the prompt contract: « You need to include on your service worker at least this code » [CITED: vite-pwa docs guide/prompt-for-update.md]), plus `push`/`notificationclick`/`pushsubscriptionchange`. **No runtime routes**: `/api/*` and `/ws/*` are never matched, so they always go to the network (WebSocket connections never pass through a service worker's fetch event anyway [ASSUMED]). No `clientsClaim`/automatic `skipWaiting`.
- **Prompt flow (APP-02):** `registerSW({ immediate: true, onNeedRefresh, onRegisteredSW })` from `virtual:pwa-register` (vanilla; feed a Svelte 5 `$state` store in `pwa/update.svelte.ts` rather than the Svelte-4-store `virtual:pwa-register/svelte`). Rule: `needRefresh && !inGame` → Home banner « Nouvelle version disponible » [Mettre à jour] → `updateSW(true)` (posts SKIP_WAITING, reloads on controller change). `inGame` = route `#/partie` or a table whose status is `playing`/`paused`; during a game only a discreet badge on the gear (like 02-10b's badge), never a reload. **The local game is not persisted** (no `toc.game…` key exists; only `toc.settings.v1`, `toc.device.v1`, `toc.tables.v1`, `toc.soundchoices.v1` [VERIFIED: grep of apps/web/src]), so reloading during a solo game would lose it — the rule matters for solo too. On `CLOSE_VERSION` (4002) from a table: call `registration.update()`, then `updateSW(true)` if a worker is waiting, else `location.reload()`. Check for updates on `visibilitychange → visible` (no polling timer needed).
- **Manifest** (keep `apps/web/public/manifest.webmanifest`, which has `"display": "standalone"`, `"background_color": "#2B1D12"` and the 192/512/maskable icons [VERIFIED: manifest.webmanifest:9-17]): add `"orientation": "landscape"` (D-09), `"id": "/"`, `"categories": ["games"]`. Android builds its splash from `name` + `background_color` + the 512 icon [CITED: meta.discourse.org « Generating Splash Screens for iOS PWA »]; manifest orientation is honoured by installed apps where supported, iOS ignores it [ASSUMED] → the existing `RotatePrompt` stays.
- **iOS splash:** iOS does not build a launch screen from the manifest; it needs `<link rel="apple-touch-startup-image" media="(device-width: …px) and (device-height: …px) and (-webkit-device-pixel-ratio: …) and (orientation: landscape)" href="/splash/…png">` per device size [CITED: meta.discourse.org thread; Apple Safari Web Content Guide (archived)]. Generate the landscape PNGs (logo centred on `#2B1D12`) in `tools/build-icons.mjs` with sharp; device list = current iPhone/iPad logical sizes [ASSUMED list — check on a real device]. Add `<meta name="apple-mobile-web-app-title" content="TOC">` and a status-bar style meta.
- **Install UX:** Android/desktop Chrome/Edge: capture `beforeinstallprompt`, show « Installer l'application » on Home; iOS Safari (not standalone): an instruction sheet; already standalone: nothing.
- **Embedded deploy (`wrangler.embarque.jsonc`):** `tools/build-embedded-worker.mjs` walks all of `apps/web/dist`, so `sw.js` and `manifest.webmanifest` are embedded automatically; the entry serves them with `content-type` from `TYPES` (`js: "text/javascript; charset=utf-8"`, `webmanifest: "application/manifest+json"` [VERIFIED: worker-embedded/index.js:17]) and `"cache-control": hashed ? "public, max-age=31536000, immutable" : "no-cache"` (non-`/assets/` files, so `/sw.js` and `/index.html` revalidate) [VERIFIED: worker-embedded/index.js:37-41]. The Text rule `"**/apps/web/dist/*.js"` (`*` crosses `/`) [VERIFIED: wrangler.embarque.jsonc:18] makes `sw.js` a separate text module from the web build, which `tools/check-bundle.mjs` accepts (it only requires separate modules to match web-build files by sha1). The upload config serves `sw.js` as a static asset; `run_worker_first` stays `["/api/*", "/ws/*"]` [VERIFIED: wrangler.jsonc:15]. Paths with a dot that are not files get 404 in the embedded entry (`if (path.includes(".")) return new Response("Introuvable", { status: 404 });` [VERIFIED: worker-embedded/index.js:33]) — fine for `/sw.js`; a future `/.well-known/webauthn` (Pattern 2) must be answered by `handleRequest`.
- **Offline local game:** precache covers the shell, card SVGs, fonts, knight images and the synthesized sounds' code (no audio files exist; `apps/web/src/audio` synthesizes [VERIFIED: ls]). The total build is ≈2.2 MB, no file above workbox's default 2 MiB per-file limit (largest `index-*.js` 420,571 B) [VERIFIED: du/ls of apps/web/dist]. Online actions show « Pas de connexion ».

### Pattern 9: D1 schema (question 7) — `apps/worker/migrations/0002_accounts.sql`

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,                    -- 16 random bytes, base64url
  pseudo TEXT NOT NULL,                   -- as shown (NFC)
  pseudo_key TEXT NOT NULL UNIQUE,        -- case- and accent-insensitive key (D-04)
  webauthn_user_id TEXT NOT NULL UNIQUE,  -- WebAuthn user handle, 32 random bytes base64url
  backup_mac TEXT,                        -- HMAC-SHA-256(TOC_PEPPER, id:code), base64url (D-02)
  backup_at INTEGER,
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE passkeys (
  id TEXT PRIMARY KEY,                    -- credential id, base64url
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rp_id TEXT NOT NULL,                    -- domain move (Pattern 2)
  public_key BLOB NOT NULL,               -- COSE key from registrationInfo.credential.publicKey
  counter INTEGER NOT NULL,
  transports TEXT,                        -- JSON array
  device_type TEXT, backed_up INTEGER, label TEXT,
  created_at INTEGER NOT NULL, last_used_at INTEGER
);
CREATE INDEX passkeys_user ON passkeys (user_id);
CREATE TABLE sessions (
  id_hash TEXT PRIMARY KEY,               -- SHA-256 of the cookie token
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, seen_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  auth_at INTEGER NOT NULL                -- last passkey assertion (step-up for the backup code)
);
CREATE INDEX sessions_user ON sessions (user_id);
CREATE TABLE challenges (
  challenge TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('register', 'login', 'add', 'recover', 'stepup')),
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  pending TEXT,                           -- JSON for sign-up: pseudo, pseudo_key, invitation hash, user handle
  expires_at INTEGER NOT NULL
);
CREATE TABLE invitations (
  code_hash TEXT PRIMARY KEY,             -- SHA-256 of the link code or short code
  kind TEXT NOT NULL CHECK (kind IN ('link', 'code')),
  inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  used_by TEXT REFERENCES users(id) ON DELETE SET NULL, used_at INTEGER
);
CREATE INDEX invitations_inviter ON invitations (inviter_id);
CREATE TABLE friendships (                -- two rows per friendship (both directions)
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id)
) WITHOUT ROWID;
CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  p256dh TEXT NOT NULL, auth TEXT NOT NULL,
  created_at INTEGER NOT NULL, ok_at INTEGER
);
CREATE INDEX push_user ON push_subscriptions (user_id);
CREATE TABLE table_members (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  table_id TEXT NOT NULL,                 -- the member's own link (a capability they already hold)
  seat TEXT, joined_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, table_id)
) WITHOUT ROWID;
```
- D1 enforces foreign keys by default (« identical to … `PRAGMA foreign_keys = on` ») [CITED: d1/sql-api/foreign-keys.mdx]; `batch()` statements « are SQL transactions … it aborts or rolls back the entire sequence » [CITED: d1/worker-api/d1-database.mdx:99] — but a batch cannot abort on « 0 rows changed », hence the invitation is consumed by a separate `UPDATE … WHERE used_by IS NULL` checked with `meta.changes` (Pitfall 6).
- Expired `challenges`/`invitations`/`sessions` are swept opportunistically (`DELETE … WHERE expires_at < ?` on the matching route, at most once per hour per isolate) — no cron needed.
- **Raw SQL, not Drizzle:** same migration style as `0001_games.sql`, applied by `readD1Migrations` + `applyD1Migrations` in the workerd tests (`bindings: { TOC_TEST_MODE: "1", TEST_MIGRATIONS: migrations }`, `d1Databases: { DB: "toc-games-test" }` [VERIFIED: apps/worker/vitest.config.ts:17-18]) and by `wrangler d1 migrations apply toc --remote` at deploy (`"migrations_dir": "apps/worker/migrations"` [VERIFIED: wrangler.jsonc:22]).
- **Free-plan row budget:** « Rows read | 5 million / day », « Rows written | 100,000 / day », 5 GB [CITED: partials/workers/d1-pricing.mdx]; an index adds a written row per indexed write [CITED: same, definition 6]. Estimates: sign-up ≈ 15 rows written (user + 2 unique indexes, passkey + index, 2 friendships, session + index, invitation, challenge in/out); login ≈ 6; session refresh ≤ 1/week/device; push subscribe 2; friend add 4; table join 1. A family of 20 people stays below ~1,000 writes/day (1 % of the quota) and a few thousand reads/day (one session lookup per API call and per socket upgrade).

### Pattern 10: Tables with accounts and notification triggers (ACCT-04, ACCT-05, APP-03)

- **Invite a friend to a table (D-07):** waiting room « Inviter un ami » lists friends (`GET /api/friends`) → `POST /api/tables/:id/invite { friendId }` → Worker checks session, friendship (D1), table exists and is not finished (`stub.summary()`), then `PLAYER_HUB.getByName(friendId).notify({ kind: "invite", from: pseudo, table: id })`. The link (table id) is in the notice/push; the friend opens `#/table/<id>`, joins as their account. The phase 2 link and QR keep working for guests.
- **« C'est ton tour » (D-08 + D-04):** a human who leaves pauses the table for everyone (D-04), so in practice « ton tour » means « the table is waiting for you ». In `@toc/table`: when the table pauses because an account person is missing (or a saved game is resumed while they are missing), add a deadline `notify` at `now + 30 s` [ASSUMED delay] carrying `{ who, pauseId }`; on fire, if still paused and still missing, emit an outbox item `{ notify: account, kind: "turn", table, from: hostPseudo }`; the GameRoom shell awaits `PLAYER_HUB.notify` after the commit (like `record()`), best effort, no retry. The pure core never sees `userId`s beyond the `account` field.
- **Solo (ACCT-05):** unchanged « Jouer contre l'ordinateur » (`#/ordinateur` → `#/partie`); the SW precache makes it start offline from the installed app.
- **Phase 5 readiness (optional, cheap):** at game end also write `game_players(game_id, user_id, colour)` for account seats so history (HIST-02) starts now; the phase 2 record deliberately stores no person id.

### Anti-Patterns to Avoid
- **Fake e-mails or the pseudo as WebAuthn user handle.** The handle is a random 32-byte value; the pseudo is only `user.name`/`displayName`.
- **Deciding « away » in the service worker** (silent push when a page is visible): iOS revokes the permission. Decide on the server, always show the notification.
- **Session token in localStorage or in the WebSocket URL.** Cookie only; the account reaches the DO via a Worker-set header.
- **Trusting `x-toc-account` from the client.** The Worker deletes and re-sets it; the DO is reachable only through the Worker.
- **PBKDF2/scrypt for the backup code on the Free plan.** Entropy + peppered HMAC instead.
- **Auto-update (`skipWaiting` on install, `registerType: "autoUpdate"`).** Hot-swaps code mid-game (CLAUDE.md « What NOT to use »).
- **Runtime-caching `/api/*`** (stale `/api/me` after logout, cached errors).
- **Allowing a null `Origin` on cookie-authenticated routes.** Phase 2's `sameOrigin` lets `origin === null` pass (`return origin === null || origin === url.origin;` [VERIFIED: apps/worker/src/index.ts:31]) — fine for anonymous table creation, wrong once a cookie authenticates the request.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| WebAuthn attestation/assertion parsing, COSE keys, signature checks | CBOR/COSE/ECDSA code | `@simplewebauthn/server` | Many algorithms (EdDSA, ES256, RS256), DER/raw signature formats, flags, counters — verified in workerd. |
| Browser WebAuthn JSON ↔ ArrayBuffer, error mapping | Manual base64url + `navigator.credentials` calls | `@simplewebauthn/browser` | 2.9 KB gzip; older iOS lacks `parseCreationOptionsFromJSON`. |
| Web Push encryption (RFC 8291) and VAPID (RFC 8292) | ECDH/HKDF/AES-GCM by hand | `@block65/webcrypto-web-push` (or a vendored port with a decrypt round-trip test) | Byte-exact info strings, padding, record size; easy to get subtly wrong. |
| Precache manifest with revisions, cache cleanup | Own cache list in sw.js | `workbox-precaching` via injectManifest | Revision hashing, outdated-cache cleanup, directory index. |
| SW registration/update lifecycle | `navigator.serviceWorker` event juggling | `virtual:pwa-register` (`registerSW`) | Waiting-worker detection and controlled reload. |
| Random secrets, codes, ids | `Math.random` | `crypto.getRandomValues`, `crypto.subtle.digest`, HMAC, `crypto.subtle.timingSafeEqual` | Unguessable; constant-time compare. |
| Rate limiting | KV counters | The account's PlayerHub DO SQLite | Consistent per account; KV is eventually consistent. |
| iOS splash images | A new generator dependency | `tools/build-icons.mjs` + sharp (already installed) | Same pipeline as the 02-04b icons. |
| WebAuthn in e2e | CDP scripting | Playwright 1.64 `context.credentials.install()` / `create()` / `get()` | Built in, resident ES256 credentials. |

**Key insight:** the security-critical crypto is all in small, maintained libraries or WebCrypto; what we write is routing, SQL and policy, which is exactly where accounts-without-e-mail differ from every framework's defaults.

## Runtime State Inventory

Phase 4 is not a rename, but it migrates seat ownership (phase 2 D-01: « costly — the seat-ownership model (device token) will be migrated to accounts in phase 4 »).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | GameRoom snapshots of existing tables store `Person` without `account` (`{ who, name, seat, online }` [VERIFIED: table.ts:12-18]); D1 `games` rows (no person id). Device localStorage `toc.device.v1` (`DEVICE_KEY` [VERIFIED: apps/web/src/net/device.ts:10]) and `toc.tables.v1`. | Code edit: snapshot loader defaults `account: null` (no data migration; old tables keep guest seats until a signed-in hello links them). D1: additive migration `0002`. localStorage untouched. |
| Live service config | Worker « toc » on workers.dev; D1 database « toc » (`a5700309-…`, already bound). No dashboard-only config found. | `wrangler d1 migrations apply toc --remote` at deploy (needs D1 Edit on the token, granted in phase 2 D-14). |
| OS-registered state | None — verified: no cron triggers, no scheduled tasks in either wrangler file. | None. |
| Secrets/env vars | New: `VAPID_PRIVATE_KEY`, `TOC_PEPPER`, `TOC_BOOTSTRAP` (secrets); `VAPID_PUBLIC_KEY`, `RP_ID`, `ORIGIN` (vars, identical in both configs). `TOC_TEST_MODE` must stay out of both. | `wrangler secret put …` once per secret (same Worker name for both configs) — human/deploy checkpoint. Extend `tools/wrangler-configs.test.ts` to compare `vars` and the new DO/migration blocks. |
| Build artifacts | `worker-embedded/manifest.js` is regenerated from `apps/web/dist` (will now include `sw.js`); Durable Object classes: adding `PlayerHub` needs migration tag `v2`. | Rebuild + `tools/check-bundle.mjs`; append `v2` in both configs. |

## Common Pitfalls

### Pitfall 1: Silent pushes on iOS
**What goes wrong:** the SW skips `showNotification` when it thinks the app is open; Safari revokes the permission. **How to avoid:** always show; decide presence server-side (PlayerHub); use `tag` to collapse. **Warning signs:** pushes stop arriving on an iPhone after a few tests.

### Pitfall 2: Push permission requested outside a gesture, or in a Safari tab on iOS
**What goes wrong:** the prompt never appears or `subscribe` rejects. **How to avoid:** call `Notification.requestPermission()` + `subscribe()` directly in the button's click handler, only in the installed app on iOS. **Warning signs:** `NotAllowedError` without a prompt.

### Pitfall 3: Old app version talking to the new server for days
**What goes wrong:** with prompt updates, a precached old client can live until the player accepts. **How to avoid:** keep `/api` additive (new fields optional, old routes kept for one release); table sockets keep `PROTOCOL_VERSION` + 4002; the hub has its own version; on 4002 call `registration.update()` and apply when not in a game.

### Pitfall 4: Signed in on Safari, signed out in the installed iOS app
**What goes wrong:** the Home Screen app has its own cookie jar and storage, so the player « loses » their account and their « Mes parties » list after installing [ASSUMED]. **How to avoid:** after install, the first screen offers « Se connecter » (one passkey tap); seats follow accounts (Pattern 4), and `/api/me/tables` restores the list. **Warning signs:** UAT on iPhone shows a guest name prompt inside the installed app.

### Pitfall 5: Cross-site requests riding the cookie
**What goes wrong:** a form or WebSocket from another site acts as the player. **How to avoid:** `SameSite=Lax` (cookies not sent on cross-site POST or subresource/WebSocket requests [ASSUMED Lax semantics for WS handshakes]), **plus** `Origin` must equal the Worker's origin (non-null) on every cookie-authenticated POST/DELETE and on `/ws/*` upgrades, plus `content-type: application/json` required (cross-site JSON needs a CORS preflight that the Worker never grants). GET routes have no side effects.

### Pitfall 6: Double use of an invitation, or two sign-ups taking the same pseudo
**What goes wrong:** D1 `batch()` rolls back on errors but not on « 0 rows updated ». **How to avoid:** consume the invitation with a guarded `UPDATE … WHERE used_by IS NULL AND expires_at > ?` and require `meta.changes === 1` before the user batch; rely on `UNIQUE(pseudo_key)` to fail the batch, then release the invitation (`used_by = NULL`) and answer « Ce pseudo vient d'être pris ».

### Pitfall 7: Update applied in the middle of a game
**What goes wrong:** the « Mettre à jour » button (or the 4002 handler) reloads during a solo game, which is not persisted. **How to avoid:** the prompt is gated by `inGame`; 4002 during an online game already breaks that game, so reloading there is acceptable; never call `updateSW` from a timer.

### Pitfall 8: Service worker caching interferes with existing e2e suites
**What goes wrong:** `vite preview`/`wrangler dev` e2e runs now register `sw.js`; stale precache between runs or intercepted reloads make tests flaky. **How to avoid:** `use: { serviceWorkers: "block" }` in `playwright.config.ts` and `playwright.online.config.ts`, and one dedicated PWA spec that allows them.

### Pitfall 9: Recovery code brute force through many pseudos
**What goes wrong:** per-account lockout does not stop an attacker spraying one guess per account. **How to avoid:** 100-bit codes make spraying pointless; keep the generic error and equal work for unknown pseudos; optionally a per-IP Rate Limiting binding.

### Pitfall 10: Free-plan CPU in the auth and push paths
**What goes wrong:** a slow KDF, a cold start plus verification, or pushing to many devices in one invocation exceeds 10 ms (Error 1102). **How to avoid:** no KDF (Pattern 3); push per account inside its hub (≤ a few subscriptions); measured 0.81 ms per login verification and 2.03 ms per push message in Node [VERIFIED: bench]; watch `exceededCpu` in `wrangler tail` after deploy.

### Pitfall 11: Config drift for the new Durable Object
**What goes wrong:** the embedded config misses `PLAYER_HUB` or migration `v2`; a deploy fails or drops the class. **How to avoid:** extend the config-equality test; `wrangler deploy --dry-run --outdir` + `tools/check-bundle.mjs` (also check that `PlayerHub` is defined in `index.js`, like the existing GameRoom check).

### Pitfall 12: `__Host-` cookie in local http dev
**What goes wrong:** `Secure` cookies on `http://localhost:8787` (wrangler dev, Playwright) are accepted by Chromium (localhost is trustworthy) but not by every browser [ASSUMED]. **How to avoid:** cookie name and `Secure` chosen from the request scheme only in `TOC_TEST_MODE`; production always `__Host-`. Run auth e2e in Chromium.

## Code Examples

### Software authenticator for workerd tests (ran in workerd this session)
```ts
// Source: spike in this session (scratchpad authn.ts) — @simplewebauthn/server/helpers isoBase64URL, isoCBOR
import { isoBase64URL, isoCBOR } from "@simplewebauthn/server/helpers";
export async function softAuthenticator(rpID: string, origin: string) {
  const kp = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", kp.publicKey)) as JsonWebKey;
  const credId = crypto.getRandomValues(new Uint8Array(16));
  const cose = new Map<number, unknown>([[1, 2], [3, -7], [-1, 1],
    [-2, isoBase64URL.toBuffer(jwk.x!)], [-3, isoBase64URL.toBuffer(jwk.y!)]]);
  const rpIdHash = await sha256(enc(rpID));
  let counter = 0;
  return {
    async create(challenge: string) {                     // → RegistrationResponseJSON, fmt "none"
      const clientDataJSON = enc(JSON.stringify({ type: "webauthn.create", challenge, origin, crossOrigin: false }));
      const authData = cat(rpIdHash, u8(0x45, 0, 0, 0, 0), new Uint8Array(16), u8(0, credId.length), credId, isoCBOR.encode(cose as never));
      const attestationObject = isoCBOR.encode(new Map<string, unknown>([["fmt", "none"], ["attStmt", new Map()], ["authData", authData]]) as never);
      return { id: b64(credId), rawId: b64(credId), type: "public-key", clientExtensionResults: {},
        response: { clientDataJSON: b64(clientDataJSON), attestationObject: b64(attestationObject), transports: ["internal"] } };
    },
    async get(challenge: string, userHandle: string) {    // → AuthenticationResponseJSON
      counter++;
      const clientDataJSON = enc(JSON.stringify({ type: "webauthn.get", challenge, origin, crossOrigin: false }));
      const authData = cat(rpIdHash, u8(0x05, 0, 0, 0, counter));
      const raw = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, kp.privateKey, cat(authData, await sha256(clientDataJSON))));
      return { id: b64(credId), rawId: b64(credId), type: "public-key", clientExtensionResults: {},
        response: { clientDataJSON: b64(clientDataJSON), authenticatorData: b64(authData), signature: b64(rawToDer(raw)), userHandle } };
    },
  };
}
// helpers: enc (TextEncoder), u8(...bytes), cat(...arrays), sha256, b64 = isoBase64URL.fromBuffer,
// rawToDer (WebCrypto ECDSA gives r||s; WebAuthn wants DER: 0x30 len 0x02 r 0x02 s, leading 0x00 when the high bit is set)
```
Flags: `0x45` = UP | UV | AT at registration, `0x05` = UP | UV at login. With it, `verifyRegistrationResponse` and `verifyAuthenticationResponse` both returned `verified: true` in workerd [VERIFIED: spike].

### Verify a login (Worker)
```ts
// Source: @simplewebauthn/server 14.0.3 esm/authentication/verifyAuthenticationResponse.d.ts
import { verifyAuthenticationResponse } from "@simplewebauthn/server";
import { decodeClientDataJSON } from "@simplewebauthn/server/helpers";

const { challenge } = decodeClientDataJSON(body.response.response.clientDataJSON);
const consumed = await env.DB.prepare(
  "DELETE FROM challenges WHERE challenge = ?1 AND purpose = 'login' AND expires_at > ?2").bind(challenge, now).run();
if (consumed.meta.changes !== 1) return json({ error: "expired" }, 400);
const pk = await env.DB.prepare(
  "SELECT p.*, u.webauthn_user_id FROM passkeys p JOIN users u ON u.id = p.user_id WHERE p.id = ?1")
  .bind(body.response.id).first<PasskeyRow>();
if (pk === null || body.response.response.userHandle !== pk.webauthn_user_id) return json({ error: "unknown" }, 400);
const result = await verifyAuthenticationResponse({
  response: body.response, expectedChallenge: challenge, expectedOrigin: RP.origin, expectedRPID: RP.id,
  credential: { id: pk.id, publicKey: new Uint8Array(pk.public_key), counter: pk.counter, transports: JSON.parse(pk.transports ?? "[]") },
  requireUserVerification: false,
});
if (!result.verified) return json({ error: "refused" }, 400);
// UPDATE passkeys SET counter, last_used_at; INSERT sessions; Set-Cookie
```

### Session cookie
```ts
const COOKIE = "__Host-toc_session";
export const sessionCookie = (token: string) =>
  `${COOKIE}=${token}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${400 * 24 * 3600}`;
export const clearCookie = () => `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
export function readCookie(request: Request): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return v.join("=") || null;
  }
  return null;
}
/** Cookie-authenticated writes: the Origin must be ours (never null), the body JSON. */
export function writeAllowed(request: Request, url: URL): boolean {
  return request.headers.get("Origin") === url.origin &&
    (request.headers.get("content-type") ?? "").startsWith("application/json");
}
```

### Forwarding the account on the table socket
```ts
// apps/worker/src/index.ts — replaces `return env.GAME_ROOM.getByName(id).fetch(request);`
const me = await sessionUser(request, env);                 // null for guests
const headers = new Headers({ Upgrade: "websocket" });
if (me !== null) {
  headers.set("x-toc-account", me.id);
  headers.set("x-toc-pseudo", encodeURIComponent(me.pseudo));
}
return env.GAME_ROOM.getByName(id).fetch(new Request(request.url, { headers }));
// GameRoom.fetch: server.serializeAttachment({ who: null, helloAt: Date.now(), account: me ?? null })
```

### Sending one push (PlayerHub)
```ts
// Source: @block65/webcrypto-web-push 2.0.0 dist/lib/payload.d.ts (ran in workerd this session)
import { buildPushPayload } from "@block65/webcrypto-web-push";
const req = await buildPushPayload(
  { data: { t: "invite", title: "TOC", body: "Marie t'invite à sa table", url: `/#/table/${table}`, tag: `inv-${table}` },
    options: { ttl: 3600, urgency: "high", topic: topicFor(table) } },
  { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
  { subject: env.ORIGIN, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY },
);
const res = await fetch(sub.endpoint, { method: "POST", headers: req.headers, body: req.body });
if (res.status === 404 || res.status === 410) await deleteSubscription(env.DB, sub.endpoint);
```

### Service worker
```ts
/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from "workbox-precaching";
declare let self: ServiceWorkerGlobalScope;
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
self.addEventListener("message", (e) => { if (e.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("push", (e) => {
  const d = (e.data?.json() ?? {}) as { title?: string; body?: string; tag?: string; url?: string };
  e.waitUntil(self.registration.showNotification(d.title ?? "TOC",            // always, even if a page is open
    { body: d.body, tag: d.tag, icon: "/icons/icon-192.png", lang: "fr", data: { url: d.url ?? "/" } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL(e.notification.data?.url ?? "/", self.location.origin).href;
  e.waitUntil((async () => {
    const [client] = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (client) { await client.focus(); await client.navigate(url); } else await self.clients.openWindow(url);
  })());
});
```
(This shape built with vite-plugin-pwa 2.0.0 + Vite 8.3.4 in the scratch project [VERIFIED].)

### Playwright e2e with a virtual passkey
```ts
// Source: playwright-core 1.64.0 types.d.ts:21202 (interface Credentials)
test("inscription par invitation puis connexion", async ({ browser }) => {
  const context = await browser.newContext();
  await context.credentials.install();                 // before the page touches navigator.credentials
  const page = await context.newPage();
  await page.goto(`/#/invitation/${code}`);
  // … pseudo, « Créer mon compte » → the virtual authenticator answers navigator.credentials.create()
  const [cred] = await context.credentials.get({ rpId: "localhost" });
  // a second context can re-seed it: context2.credentials.create("localhost", { id, userHandle, privateKey, publicKey, signCount })
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Passkeys only on the exact RP ID's origins | Related Origin Requests (`/.well-known/webauthn`) | Chrome/Safari 2024 (spec L3) | A later domain move need not strand passkeys (Chrome/Safari). |
| `@simplewebauthn/types` separate package | Types shipped in server/browser; `startRegistration({ optionsJSON })` object form | v11+ | Use the object-form API of 14.x. |
| Playwright WebAuthn only through CDP `WebAuthn.addVirtualAuthenticator` | `browserContext.credentials` (`install`, `create`, `get`, `delete`) | Playwright 1.6x (present in 1.64.0) | Simple passkey e2e; CDP stays a fallback. |
| Cookies with multi-year expiry | Capped at 400 days (rfc6265bis, Chrome M104) | 2022 | Sliding refresh keeps sessions alive. |
| Web Push only for Safari macOS | Home Screen web apps on iOS/iPadOS 16.4+ | 2023 | APP-03 works on iPhone, installed only. |
| better-auth passkeys require a session | `registration.requireSession: false` + `resolveUser` | better-auth 1.4+ era | Still needs a user row and an e-mail (Option A rejected). |
| `generateSW` auto-update | injectManifest + prompt | — | Matches APP-02. |

**Deprecated/outdated:** `web-push` (Node-only, 2024); Lucia (deprecated, per CLAUDE.md); `@cloudflare/vitest-pool-workers` (renamed, phase 2).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build, tools | ✓ | v22.22.0 | — |
| pnpm | workspace | ✓ | per `packageManager: pnpm@10.34.7` | — |
| wrangler (repo) | dev, `check startup`, D1 migrations, secrets | ✓ | 4.151.1 | — |
| workerd via wrangler/vitest-plugin | DO + D1 tests, WebAuthn spike | ✓ | ran this session | — |
| Chromium for Playwright | e2e incl. virtual passkeys | ✓ | `/opt/pw-browsers/chromium-1194` (phase 2) | — |
| Cloudflare account access | `d1 migrations apply --remote`, `secret put`, deploy | via the deploy token only | — | human/deploy checkpoint |
| A real iPhone (iOS ≥ 16.4) and an Android phone | passkeys in the installed app, push, splash, cookie persistence | ✗ here | — | UAT by Romain |
| webkit.org, web.dev, w3.org, passkeys.dev | docs | ✗ (proxy 403) | — | spec read from github.com/w3c/webauthn; Apple doc via developer.apple.com JSON; MDN from github.com/mdn/content |

**Missing with no fallback:** none for building and testing. **Needs a human checkpoint:** secrets (`VAPID_PRIVATE_KEY`, `TOC_PEPPER`, `TOC_BOOTSTRAP`), the remote D1 migration, the first deploy with DO migration `v2`, and the iPhone/Android UAT.

## Testing Strategy (question 9)

`workflow.nyquist_validation` is `false` in `.planning/config.json`, so no Nyquist section; the map below is what the plans should verify.

| Area | Automated check | Type |
|------|-----------------|------|
| Pseudo rules, backup code format/normalisation, invitation/short-code formats, API body schemas | Node vitest on `@toc/protocol/account.ts` (+ fast-check: `pseudoKey` idempotent, accent/case collisions) | unit |
| Sign-up by invitation, login, add passkey, recovery, logout, step-up regeneration | workerd (`@cloudflare/vitest-plugin`, real D1 with `0002` applied) driving `SELF.fetch` with the **software authenticator** above and a cookie jar helper | integration |
| Invitation single use, expired, pseudo race, bootstrap only when no user | workerd | integration |
| CSRF: missing/foreign Origin, non-JSON body, null Origin with cookie → 403 | workerd | integration |
| Backup-code lockout (5 failures → locked), generic error for unknown pseudo | workerd (PlayerHub via `runInDurableObject`, time moved through its SQLite like phase 2's deadline tests) | integration |
| Account on table sockets: link guest seat on sign-in, second device gets the seat (4001 to the older), linked seat refused to a guest | Node (`@toc/table` reducer with `account`) + workerd (upgrade with cookie) | unit + integration |
| Notify: pause → +30 s deadline → hub RPC; hub present → `notice`, away → push request built | Node core + workerd with an injected `send` function | unit + integration |
| Push encryption | Node test that **decrypts** the aes128gcm body with the subscription's private key (RFC 8291) and checks the VAPID JWT `aud`/`exp ≤ 24 h`/`sub` | unit |
| Configs | `tools/wrangler-configs.test.ts`: identical DO bindings, migrations (`v1`,`v2`), vars; no `TOC_TEST_MODE`; `check-bundle` finds `PlayerHub` and `sw.js` from the web build | unit |
| e2e (Chromium, `wrangler dev`) | `context.credentials.install()`: invitation → sign-up → backup code shown → logout → login; friend list; waiting-room « Inviter un ami » shows the in-app notice in the friend's context | e2e |
| PWA | dedicated spec with service workers allowed: `sw.js` registers, `context.setOffline(true)` + reload → Home and `#/ordinateur` work; a new build → « Nouvelle version disponible » shown on Home, not on `#/partie`; SW `push` handler shows a notification (synthetic `PushEvent` evaluated in the worker, `grantPermissions(["notifications"])`) | e2e |
| Real devices | iPhone: install, splash, passkey create/login in the installed app, cold start stays signed in, push when closed (turn + invite), none while playing; Android: same; desktop Chrome install | manual UAT |

## Security Domain

`security_enforcement: true`, ASVS level 1, block on high.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | WebAuthn passkeys (discoverable, ES256/EdDSA/RS256), no passwords, no e-mail; backup code 100 bits, peppered HMAC, per-account lockout in PlayerHub; invitation-only sign-up; bootstrap secret valid only with zero users. |
| V3 Session Management | yes | `__Host-` HttpOnly Secure SameSite=Lax cookie, 32-byte token, SHA-256 at rest, 400-day sliding expiry, logout and recovery revoke; sockets re-authenticated at every upgrade. |
| V4 Access Control | yes | Friendship checked for table invites; account seat resolution only from Worker-set headers; host-only commands unchanged; a linked seat needs its account. |
| V5 Input Validation | yes | zod/mini strict bodies (≤ 8 KB), pseudo normalisation + Latin-only allow-list, code formats, table id format before `getByName`. |
| V6 Cryptography | yes | `crypto.getRandomValues`, SHA-256, HMAC-SHA-256, `timingSafeEqual`, ECDSA P-256 (VAPID), aes128gcm (library); no `Math.random`, no custom crypto. |
| V7 Error/Logging | yes | Codes only to clients; never log tokens, codes, push keys or endpoints in full. |
| V8 Data Protection | yes | Minimal personal data (pseudo); push payloads end-to-end encrypted, no hand/state in them; table ids stored only for their own members. |
| V13 API | yes | Origin + JSON content type on writes; GET side-effect free; `cache-control: no-store` on every `/api` answer (existing `json()` helper). |

### Known Threat Patterns

| ID | Pattern | STRIDE | Mitigation |
|----|---------|--------|------------|
| T-04-01 | CSRF on cookie routes | Spoofing/Tampering | SameSite=Lax + non-null same Origin + JSON body; no state-changing GET |
| T-04-02 | Cross-site WebSocket hijacking of `/ws/me` or a table with the cookie | Spoofing | Origin must equal (non-null) when a session cookie is present; Lax cookie |
| T-04-03 | Pseudo enumeration | Information disclosure | Usernameless login; « pseudo pris » only after a valid invitation; recovery error generic with equal work |
| T-04-04 | Invitation link guessing | Elevation | 128-bit codes, hashed at rest, 7-day expiry, single use; short codes (40 bits) only for signed-in friend adds, rate-limited per requester |
| T-04-05 | Backup code brute force | Elevation | 100 bits + lockout per account + generic error; rotation on use |
| T-04-06 | Stolen/lost phone | Elevation | Recovery revokes all sessions; passkey list with delete; backup-code regeneration needs a fresh passkey assertion |
| T-04-07 | Session token theft | Spoofing | HttpOnly (no JS access), no raw HTML sinks (existing test), hashed at rest |
| T-04-08 | Spoofed account header to the DO | Elevation | Worker deletes then sets `x-toc-account`; DO not routable from outside |
| T-04-09 | Push spam / notification flooding by a friend | DoS | Hub dedupe + per-sender rate limits; only friends can invite |
| T-04-10 | Push endpoint reassignment / stale endpoints | Information disclosure | Upsert by endpoint to the current account; delete on 404/410 and on logout of that device |
| T-04-11 | Bootstrap code reused later | Elevation | Accepted only while `users` is empty; delete the secret afterwards |
| T-04-12 | Homoglyph impersonation in pseudos | Spoofing | Latin-only allow-list + accent/case-insensitive uniqueness key |
| T-04-13 | Shared-device seat reuse after sign-out | Elevation | Linked seats require their account (Pattern 4, rule 4) |
| T-04-14 | Old cached client with new API | Tampering (integrity of state) | Additive API, protocol versions, prompt update (Pitfall 3) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Passkeys created in Safari or the installed iOS app are shared (iCloud Keychain) and WebAuthn works in a Home Screen web app | Pattern 2 | Sign-in inside the installed app fails on iPhone → needs a different flow |
| A2 | The installed iOS app has its own cookie jar and storage, separate from Safari, and keeps server-set cookies across cold starts | Pattern 4, Pitfall 4 | ACCT-02 behaviour on iPhone differs; UAT decides |
| A3 | Invitation links are single use, valid 7 days | Pattern 5 | Romain may want a reusable « lien de famille » (Open Question 2) |
| A4 | Backup code format (20 Crockford symbols, 5×4) and lockout numbers (5 → 15 min, doubling) | Pattern 3 | UX/security tuning only |
| A5 | Pseudo allow-list (Latin script, digits, space, `'’._-`, 2-20) and accent-insensitive uniqueness | Pattern 5 | Romain may want emojis or other scripts |
| A6 | « C'est ton tour » = the table paused waiting for you, sent 30 s after the pause | Pattern 10 | Romain may expect turn pushes in some other situation (Open Question 3) |
| A7 | A linked seat cannot be resumed by a signed-out device | Pattern 4 | Shared tablets behave differently than expected |
| A8 | Manifest `orientation` is ignored on iOS; iPhone/iPad splash size list | Pattern 8 | Splash missing on some devices (cosmetic) |
| A9 | `@block65/webcrypto-web-push` is a sound dependency (found by name from training) | Stack | Swap for `@pushforge/builder` or a vendored port |
| A10 | Workers Rate Limiting binding is usable on the Free plan | Pattern 3 | Only the optional per-IP layer is lost |
| A11 | Production PBKDF2 cap is 100,000 iterations | Pattern 3 | None for the recommendation (no KDF used) |
| A12 | SameSite=Lax cookies are not sent on cross-site WebSocket handshakes | Pitfall 5 | Origin check still blocks; defence in depth only |
| A13 | Chromium accepts `Secure` cookies on `http://localhost` | Pitfall 12 | e2e cookie handling needs the test-mode name switch |
| A14 | better-auth must be initialised per request (or with `env` from `cloudflare:workers`) | Option A | Irrelevant if Option B is chosen |
| A15 | Synced passkeys report counter 0 and SimpleWebAuthn accepts 0 → 0 | Pattern 1 | A counter check would wrongly refuse logins; tests with Playwright credentials cover it |

## Open Questions

1. **A domain before launch?** What we know: passkeys, the installed app, push subscriptions and cookies are all bound to `toc.romaindetroyat.workers.dev`; moving later means reinstalling the app, re-subscribing and either Related Origin Requests (Chrome/Safari only, workers.dev kept forever) or re-enrolling passkeys. Recommendation: ask Romain once more whether a domain is likely within a year; if not, go with workers.dev and the cheap mitigations (Pattern 2).
2. **One invitation link per person, or a reusable family link?** Recommendation: single use, 7 days (keeps the circle closed, D-03); offer « Créer un autre lien » in one tap.
3. **What exactly triggers « C'est ton tour » given D-04's pause?** Recommendation: notify a missing account player 30 s after the table pauses for them (and when a saved game is resumed without them); no push for players present at the table, even in a background tab (D-08 « jamais pendant qu'il joue »).
4. **Shared family devices:** after « Se déconnecter », should that device still resume the account's seats as a guest? Recommendation: no (Pattern 4, rule 4).
5. **Package approval:** `@simplewebauthn/server@14.0.3`, `@simplewebauthn/browser@14.0.0`, `@block65/webcrypto-web-push@2.0.0`, `vite-plugin-pwa@2.0.0`, `workbox-precaching@7.4.1`, `workbox-window@7.4.1` (AskUserQuestion, with `checkpoint:human-verify` before the push library).
6. **Doc tasks:** ROADMAP Phase 4 success criterion 1 already says « pas d'e-mail » and REQUIREMENTS ACCT-01 already carries the D-01 note [VERIFIED: ROADMAP.md, REQUIREMENTS.md:53]; the planner only checks CLAUDE.md's PWA « orientation any » line against D-09 if CLAUDE.md is ever regenerated.

## Sources

### Primary (HIGH confidence)
- Spikes run in this session (scratchpad, not committed): workerd (`wrangler dev`, compat date 2026-10-01, no flags) running SimpleWebAuthn 14.0.3 registration + authentication with a software ES256 authenticator, PBKDF2 probes, and `@block65/webcrypto-web-push` 2.0.0 VAPID + aes128gcm; `wrangler check startup` for both options; esbuild size comparison; Node CPU benches (PBKDF2, login verification, push encryption); a Vite 8.3.4 + vite-plugin-pwa 2.0.0 injectManifest build.
- Package tarballs read: better-auth 1.7.10, @better-auth/core 1.7.10 (`dist/db/get-tables.mjs`, `src/types/database.ts`, `init-options.ts`), @better-auth/passkey 1.7.10 (`dist/index.mjs`, `index-*.d.mts`), @simplewebauthn/server 14.0.3 and browser 14.0.0 (`.d.ts`), vite-plugin-pwa 2.0.0 (`dist/index.d.ts`, `svelte.d.ts`), @block65/webcrypto-web-push 2.0.0 (`encrypt.js`, `vapid.js`, `payload.d.ts`), playwright-core 1.64.0 (`types.d.ts` Credentials).
- npm registry (`npm view`): versions, dates, dependencies, install scripts, maintainers.
- Repo files read this session: apps/worker/src/{index,GameRoom}.ts, apps/worker/{vitest.config.ts,package.json,migrations/0001_games.sql,test/helpers.ts,test/apply-migrations.ts}, packages/protocol/src/{index,names,frames}.ts, packages/table/src/{table,reduce}.ts (types), apps/web/src/net/{device,api,connection.svelte,tables}.ts, apps/web/src/settings/store.svelte.ts, apps/web/src/{main.ts,App.svelte,routes/Home.svelte}, apps/web/{index.html,vite.config.ts,public/manifest.webmanifest,package.json,playwright*.config.ts}, wrangler.jsonc, wrangler.embarque.jsonc, worker-embedded/index.js, tools/{build-embedded-worker,check-bundle,build-icons}.mjs, tools/wrangler-configs.test.ts, .planning (04-CONTEXT, ROADMAP, REQUIREMENTS, 02-CONTEXT, 02-RESEARCH).
- workerd source: `src/workerd/api/crypto/pbkdf2.c++`, `impl.c++` (PBKDF2 limit enforcer).
- W3C WebAuthn Level 3 editor's draft source (github.com/w3c/webauthn `index.bs`): related origins, Signal API, hybrid transport.
- Public Suffix List (github.com/publicsuffix/list): `workers.dev`.
- Chrome DevTools Protocol `WebAuthn.pdl` (fallback for virtual authenticators).

### Secondary (MEDIUM confidence — official docs read from their source repositories or JSON)
- Cloudflare docs (github.com/cloudflare/cloudflare-docs): workers/platform/limits (CPU 10 ms Free, subrequests 50, startup 1 s, size), workers/runtime-apis/web-crypto (`timingSafeEqual`), workers/runtime-apis/bindings/rate-limit, d1/platform/limits, partials/workers/d1-pricing, d1/sql-api/foreign-keys, d1/worker-api/d1-database (batch transactions), durable-objects/platform/pricing + partials (requests, WebSocket 20:1, auto-response), durable-objects/api/state (`waitUntil`).
- Apple Developer « Sending web push notifications in web apps and browsers » (developer.apple.com JSON): iOS 16.4 Home Screen web apps, gesture, no invisible pushes, JWT subject/expiry/refresh, 4 KB, status codes.
- vite-pwa docs (github.com/vite-pwa/docs): guide/inject-manifest.md, guide/prompt-for-update.md, frameworks/svelte.md.
- MDN (github.com/mdn/content): Set-Cookie (`__Host-`), PushManager.subscribe, manifest orientation, Clients.matchAll.
- developer.chrome.com/blog/cookie-max-age-expires (400-day cap) via search.

### Tertiary (LOW confidence — search summaries, to confirm on devices)
- web.dev « Related Origin Requests » support statement (search summary; site blocked here).
- WebKit Bugzilla 237350 and the WebKit 7-day-cap clarification (home-screen apps' own counter, server-set cookies kept).
- meta.discourse.org thread on iOS splash screens.
- lord.technology post on the 100,000 PBKDF2 cap in production.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions from the registry; SimpleWebAuthn and the push library exercised in workerd; the PWA plugin built with Vite 8.
- Architecture: HIGH for the Worker/DO/D1 shape (extends verified phase 2 patterns); MEDIUM for PlayerHub presence semantics on phones (background socket behaviour).
- Pitfalls: MEDIUM-HIGH — platform ones measured or quoted from Apple/Cloudflare; iOS installed-app cookie/passkey behaviour needs a real iPhone.

**Research date:** 2026-10-17
**Valid until:** 2026-11-16 (better-auth/SimpleWebAuthn/wrangler move fast; re-check pins before installing).
