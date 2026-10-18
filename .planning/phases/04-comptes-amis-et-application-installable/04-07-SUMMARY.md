---
phase: 04-comptes-amis-et-application-installable
plan: 07
subsystem: notifications
tags: [web-push, vapid, rfc8291, rfc8292, durable-objects, alarms, pwa, notifications]

requires:
  - phase: 04-comptes-amis-et-application-installable
    provides: "04-01: push_subscriptions (session_hash ON DELETE CASCADE), @block65/webcrypto-web-push; 04-04: Person.account; 04-06: PlayerHub presence and notify (notice, away, dup)"
provides:
  - "packages/table/src/notify.ts: NOTIFY_AFTER_MS 30 s, notifyMsOf, settleNotify, TurnNotice; Table.notifyAt and deadlines.notify; Reduced.notify"
  - "GameRoom: each Reduced.notify item → PLAYER_HUB.getByName(account).notify({ kind: turn, … }) after the commit, best effort"
  - "packages/protocol/src/push-fr.ts: pushText, pushTag, pushPayload, PUSH_BODY_MAX"
  - "apps/worker/src/push.ts: vapidOf, isPushEndpoint, topicFor, buildPush, pushKeyRoute, pushRoute"
  - "PlayerHub: nobody present → one Web Push per subscription (answer « push »), 404/410 delete, 429 kept, 403 logged once, the authorization reused an hour per push service"
  - "GET /api/push/key, POST and DELETE /api/push/subscriptions"
  - "tools/vapid-keys.mjs: a new secret d.x.y on stdout, --public"
  - "web: pwa/platform.ts (isAppleMobile, iosVersion, atLeast, isStandalone, browserPlatform), account/push.ts (pushState, enablePush, disablePush, refreshKey), api.ts (pushKey, saveSubscription, deleteSubscription)"
  - "protocol: PushSubscriptionBody, PushEndpointBody, PushKeyAnswer, parsePushKeyAnswer"
affects: [04-08, 04-10, 04-11, 04-12]

estimate:
  tokens: 180000
  tasks: 3
actuals:
  tokens: 37900
  tasks: 3
  commits: 9
plan_head_before: 21ab58262c6709922878308c46f22729e8e61292
plan_head_after: 089b958d8ea5c670b03773b2f6bec565375765ad

tech-stack:
  added: []
  patterns:
    - "One post-step of the reducer (settleNotify in reduce.settle) keeps a server-only schedule in step with the pause's missing list, so every path that changes it is covered in one place"
    - "One Worker secret holds both halves of a key pair (d.x.y); the public half is derived, never configured"
    - "An outbound fetch behind an instance method (PlayerHub.deliver) that re-checks the allow-list and that the workerd tests replace through runInDurableObject"
    - "The production alarm delivery helper (deliverAsProduction) shared in test/helpers.ts"

key-files:
  created:
    - packages/table/src/notify.ts
    - packages/table/src/notify.test.ts
    - packages/protocol/src/push-fr.ts
    - packages/protocol/src/push-fr.test.ts
    - apps/worker/src/push.ts
    - apps/worker/test/turn.test.ts
    - apps/worker/test/push.test.ts
    - apps/worker/test/push-decrypt.ts
    - apps/worker/test/subscriptions.test.ts
    - tools/vapid-keys.mjs
    - tools/vapid-keys.test.ts
    - apps/web/src/pwa/platform.ts
    - apps/web/src/pwa/platform.test.ts
    - apps/web/src/account/push.ts
    - apps/web/src/account/push.test.ts
  modified:
    - packages/table/src/table.ts
    - packages/table/src/reduce.ts
    - packages/table/src/index.ts
    - packages/table/src/oracle.ts
    - packages/protocol/src/frames.ts
    - packages/protocol/src/frames.test.ts
    - packages/protocol/src/account.ts
    - packages/protocol/src/index.ts
    - apps/web/src/i18n/typography.test.ts
    - apps/web/src/account/api.ts
    - apps/web/playwright.online.config.ts
    - apps/web/e2e-online/comptes.ts
    - apps/worker/src/GameRoom.ts
    - apps/worker/src/PlayerHub.ts
    - apps/worker/src/invite.ts
    - apps/worker/src/index.ts
    - apps/worker/vitest.config.ts
    - apps/worker/test/helpers.ts
    - apps/worker/test/pace.test.ts
    - apps/worker/test/env.d.ts

key-decisions:
  - "The notice schedule is reconciled after every command in reduce.settle (settleNotify), instead of calls from each presence function: a return, a hand-over, a save, a reclaim or a rematch all cancel it the same way"
  - "Only the alarm's tick sends a due notice; « Reprendre la partie » sends at once (resumed). A frame arriving after the time leaves the deadline due for the alarm"
  - "A resumed notice names the chef de table who resumed (the creator whenever the creator is here), so a missing creator is never told « {own name} a repris la partie »"
  - "notify answers « push » when at least one message went out; « away » when there was nothing to send (no subscription, no VAPID secret)"
  - "The hub knows its account from ctx.id.name; callers also pass `account`, and a mismatch sends no push"
  - "Topic per kind and table: t-… for a turn, i-… for an invite, so a turn never replaces an undelivered invite"
  - "GET /api/push/key needs no session (the key is public); the subscription routes check Origin, then JSON, then the session"

patterns-established:
  - "Server-only table fields are added to the oracle's FORBIDDEN_KEYS (notifyAt)"

requirements-completed: [APP-03]

coverage:
  - id: D1
    description: "« C’est ton tour »: 30 s after an account seat goes missing, exactly at its time and once; a guest never; a second seat 10 s later its own time; cancelled by a return, a hand-over, a save; « Attendre encore » keeps it; a resume without them at once (resumed, the resumer named); older snapshots; never in a frame"
    requirement: APP-03
    verification:
      - kind: unit
        ref: "packages/table/src/notify.test.ts (18 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The notice under production's alarm delivery (Date.now() equal to scheduledTime): B's hub socket gets the turn frame, A's (at the table) nothing, the next alarm after the notice time, the hub keeps the key; B back before the time: nothing; a resume tells B at once"
    requirement: APP-03
    verification:
      - kind: integration
        ref: "apps/worker/test/turn.test.ts (workerd, 3 tests); pace.test.ts unchanged and green"
        status: pass
    human_judgment: false
  - id: D3
    description: "Web Push: decrypt round trip (RFC 8291) for two subscriptions, VAPID JWT aud/exp/sub checked with its own key, TTL 3600, urgency high, topic ≤ 32; the hour of reuse per push service; 410/404 deleted, 429 kept, 403 logged once; no secret; no subscription; present player; dup; SSRF filter"
    requirement: APP-03
    verification:
      - kind: integration
        ref: "apps/worker/test/push.test.ts (workerd, 13 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "French push texts with phase-1 typography, < 110 characters with a 20-character pseudo, no emoji; the key tool's output and refusals"
    verification:
      - kind: unit
        ref: "packages/protocol/src/push-fr.test.ts (8), apps/web/src/i18n/typography.test.ts (push-fr block), tools/vapid-keys.test.ts (4)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The subscription routes (key, POST, DELETE, sizes, hosts, upsert, 10 per account, Origin, JSON, session) and the cascade on logout and recovery (D-12)"
    requirement: APP-03
    verification:
      - kind: integration
        ref: "apps/worker/test/subscriptions.test.ts (workerd, 14 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The browser's push module: the eight states in the UI-SPEC order, the permission asked synchronously in the tap, subscribe with userVisibleOnly and the pre-fetched key, off, a new server key; the platform facts"
    verification:
      - kind: unit
        ref: "apps/web/src/account/push.test.ts (21), apps/web/src/pwa/platform.test.ts (6)"
        status: pass
    human_judgment: false
  - id: D7
    description: "A real push on a real iPhone and Android phone when the app is closed, none while playing"
    verification: []
    human_judgment: true
    rationale: "The service worker that shows the push comes in 04-08 and the « Activer les notifications » panel in 04-10; then UAT on devices"

duration: about 50 min
completed: 2026-10-18
status: complete
---

# Phase 4 Plan 07: « C’est ton tour » et les notifications quand l’application est fermée (Web Push) Summary

**When Paul's phone locks during a game, the table pauses as before, and 30 s later the GameRoom's own alarm tells his PlayerHub « C’est ton tour ». If TOC is open and visible elsewhere, the hub shows the in-app card. Otherwise it sends an encrypted Web Push (VAPID from one secret, RFC 8291) to each of his devices: « C’est ton tour ! — La table de Romain t’attend : la partie est en pause jusqu’à ton retour. » A saved game resumed without him tells him at once. Nobody at the table is ever told. Each device registers or removes its subscription through `/api/push/subscriptions`, and the browser module knows which of the seven notification states to show. The service worker (04-08) and the panel (04-10) come next.**

## Performance

- **Duration:** about 50 min (09:25 to 10:15 UTC), including the gate. The local Playwright suite took 7.2 min and the online suite 7.4 min.
- **Tasks:** 3, each committed as RED then GREEN, plus one RED/GREEN fix found during Task 2 (the name in a resumed notice).
- **Files:** 35 (15 created, 20 modified).

## Accomplishments

### « C’est ton tour » in the table core and the GameRoom (Task 1)

- `notify.ts`:
  - `NOTIFY_AFTER_MS` is 30 000 (to confirm at UAT). The test option `notifyMs` (100 ms to 2 minutes, `parseCreateTestOptions`) shortens it.
  - `settleNotify` runs after every command in `reduce.settle`. Each seat of the pause's missing list whose person has an account gets `notifyAt[seat]` = when it was first seen missing + 30 s. `deadlines.notify` is the earliest of them.
  - At the alarm's tick at or after that time (`at ≤ now`), each due seat that is still missing gives one `Reduced.notify` item `{ account, kind: "turn", from, own, resumed: false, key: table:pauseSince }`. Its entry becomes `null` (already told for this absence), and the deadline moves to the next entry or goes.
  - A seat that stops being missing loses its entry. That covers a return, a hand-over to the computer, a save, a reclaim and a won game. « Attendre encore » keeps the time.
  - A saved game resumed while account seats are missing tells them at once (`resumed: true`), with no 30 s entry.
  - Guests get nothing. `notifyAt` is server-only, `{}` for older snapshots, and in the oracle's forbidden keys.
- `GameRoom.run` gives each item to `PLAYER_HUB.getByName(account).notify(...)` after the commit. It is awaited with the D1 writes and is best effort: a failure is logged once and dropped. `arm()` is unchanged, so the debug rule holds: whole ms, rounded up, never at or before the running alarm's time.
- `deliverAsProduction` moved from `pace.test.ts` to `test/helpers.ts`. `turn.test.ts` uses it: the notice alarm runs with `Date.now()` equal to `scheduledTime`, and B's hub socket gets the frame. The next alarm is after the notice's time.

### Web Push from the PlayerHub (Task 2)

- `push-fr.ts` holds the UI-SPEC texts with phase-1 typography (U+202F before « ! », U+00A0 before « : »). `typography.test.ts` covers it through an `import.meta.glob` of the file. The tags are `tour-{table}` and `inv-{table}`, and names are cut to 20 code points. The longest body with a 20-character pseudo is 86 characters.
- `tools/vapid-keys.mjs`:
  - With no option it prints one line `d.x.y` and writes no file.
  - `--public` reads a secret on stdin and checks it: three 32-byte fields, a point on the curve, and a scalar that signs what the point verifies. It then prints the 87-character public key.
  - Any malformed input exits 1 without echoing it.
- `push.ts`:
  - `vapidOf` derives the public key from the secret.
  - `isPushEndpoint` accepts only https on the default port with no credentials, at most 1 024 characters. The host must be `web.push.apple.com` or `*.push.apple.com`, `fcm.googleapis.com`, `*.push.services.mozilla.com` or `*.notify.windows.com`. `push.toc.test` is accepted only in TOC_TEST_MODE.
  - `topicFor` gives `t-` or `i-` plus 8 characters of the table's SHA-256.
  - `buildPush` calls `buildPushPayload` with TTL 3600, urgency high and the subject `env.ORIGIN`.
- `PlayerHub.notify`: when nobody is present, it reads the account's subscriptions (one D1 query, at most 10 rows) and filters them through the allow-list again. It then builds and delivers one message each, in parallel:
  - **201** is fine.
  - **404 or 410** deletes the row.
  - **429** keeps the row and nothing is retried.
  - **403** is logged once per instance and drops the cached authorization.
  - The authorization is cached per push-service origin for at most one hour.
  - With no VAPID secret it logs once, sends nothing and answers « away ».
  - `deliver` re-checks the allow-list, so even a direct RPC call can reach only a push service.
- `vitest.config.ts` generates a test-only VAPID pair with Node WebCrypto when it loads. It is never written to disk.

### Each device's subscription and the browser module (Task 3)

- **`GET /api/push/key`** answers `{ key }`, or 503 `push-off` without the secret. It needs no session and sets `cache-control: no-store`.
- **`POST /api/push/subscriptions`** checks our Origin (403), then the JSON body (415, 413, 400), then the session (401).
  - An endpoint outside the allow-list answers 400 `endpoint`. A p256dh that is not a 65-byte point starting with 0x04, or an auth that is not 16 bytes, answers 400 `keys`.
  - Otherwise it answers 201 and upserts the row with this account and this session's hash. An endpoint known for another account moves to this one.
  - The same batch keeps the account's 10 newest rows.
- **`DELETE /api/push/subscriptions { endpoint }`** answers 204 for one's own row and 404 otherwise.
- Logout and recovery remove the device's rows by cascade. Both are asserted in workerd, and a logout leaves the account's other devices' rows in place.
- `pwa/platform.ts`:
  - `isAppleMobile` also treats iPadOS reporting as a Mac with touch as an iPad.
  - `iosVersion` reads `OS 17_4`, or Safari's `Version/` for an iPad reporting as a Mac. `atLeast` compares versions.
  - `isStandalone` checks the standalone display mode or `navigator.standalone`. `browserPlatform` reads all of these from the page.
- `account/push.ts`:
  - `pushState` gives the UI-SPEC states in order: unsupported, install-first, ios-too-old, blocked, failed, then ask, on or off.
  - `enablePush` calls `requestPermission()` synchronously, before any await. Once the permission is granted it calls `subscribe({ userVisibleOnly: true, applicationServerKey })` with the key the panel fetched before the tap, then POSTs. It answers on, ask, blocked or failed, and a failed save unsubscribes the device again.
  - `disablePush` sends the DELETE (nothing when offline) and then unsubscribes.
  - `refreshKey` replaces a subscription made with another key when the permission is still granted. Otherwise it answers « ask ».
- `playwright.online.config.ts` passes `--var VAPID_PRIVATE_KEY:<TEST_VAPID>`. `TEST_VAPID` is in `comptes.ts`, generated once with the tool and labelled test only, never deployed. A manual `wrangler dev` check confirmed that `/api/push/key` serves the key `vapid-keys.mjs --public` derives from it.

## Costs (Free plan, T-04-SC, Pitfall 10)

| Item | Value |
|------|-------|
| Push sends per notice | **one per subscription** of the account (at most 10), none when a socket is present, none for a dup |
| CPU per encrypted message, measured in workerd | **0.60 ms** (50 runs of `buildPush`: ECDH, HKDF, AES-GCM on the 4 096-byte record, plus one ECDSA signature) |
| D1 per notice | **one query** reading the account's rows through `push_user` (n rows read for n subscriptions); **2 rows written per gone subscription** (the row and its index entry), only on 404/410. Derived from the queries; the hub has no meter |
| D1 per subscription saved (measured, `x-toc-d1`) | **w=3; r=6** |
| DO requests per turn notice | 1 (the hub's `notify`), inside the GameRoom's alarm |
| Subrequests per notice | n push fetches (n ≤ 10, Free: 50) |

## Task Commits

1. **Task 1 RED**: `d635f0d` (test)
2. **Task 1 GREEN**: `c388be8` (feat)
3. **Task 2 RED**: `637e2f1` (test)
4. **Task 2 GREEN**: `0f296d5` (feat)
5. **Fix RED, the resumer's name**: `1692d66` (test)
6. **Fix GREEN**: `56b556a` (fix)
7. **Task 3 RED**: `05beb29` (test)
8. **Task 3 GREEN**: `089b958` (feat)

## Gate (at 089b958, one suite at a time)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | 0 errors (web: 537 files) |
| `pnpm lint` | Biome, 348 files, clean |
| `pnpm test` | Vitest 112 files, **1 720 passed, 2 skipped** (the same 2 engine skips) |
| worker project (workerd) | 25 files, 220 passed (turn 3, push 13, subscriptions 14; pace, presence, table-invite unchanged and green) |
| Full local Playwright | **455 passed, 99 skipped, 0 failed** (7.2 min), unchanged |
| Full online Playwright | **56 passed, 0 failed** (7.4 min), unchanged |
| Ports 8787 / 4173 before and after each run | free (checked by connecting) |
| Leftover processes | My manual `wrangler dev` on port 8799 (the `/api/push/key` check, TOC_TEST_MODE, local only) left a workerd behind. It was found after the suites and stopped by PID. It did not use 8787 or 4173. None remain. |

## Screenshots

None. This plan has no screen. The « Notifications » panel is drawn in 04-10 and the service worker that shows a push comes in 04-08.

## Deviations from Plan

### Plan-detail adjustments (no scope change)

**1. One reconciliation step instead of calls from each presence function.** `settleNotify` runs in `reduce.settle` after every command and compares the schedule with the pause's missing list. `presence.ts` is unchanged. Every path that changes the missing list cancels or schedules the same way: startPause, onGone, onHello, applyChoice, resume, stop, a reclaim and a won game.

**2. A resumed notice names the chef de table who resumed.** This is a Rule 1 fix with its own RED/GREEN. The plan says `from: the creator's name`. When the creator is the missing one, another chef de table resumes, and the creator would have read « {own name} a repris la partie ». `from` is now `hostOf(table)` for a resumed notice. That is the creator whenever the creator is at the table, so the UI-SPEC's usual case is unchanged.

**3. `notify` answers « push » (a string, no count).** The count of sends is one per subscription. The tests count it through the replaced `deliver`. « away » still means nothing went out, so `invite.ts` and the presence tests are unchanged.

**4. `NotifyInput.account` (optional).** The hub uses `ctx.id.name`, which workerd provides for `getByName`. The GameRoom and `invite.ts` also pass the account, and a mismatch sends no push. `invite.ts` was touched for that one field.

**5. Topic per kind.** `t-…` for a turn and `i-…` for an invite, where the plan wrote `t-` for both. A turn notice must not replace an undelivered invitation to the same table.

**6. `enablePush` may also answer « ask».** If the prompt is dismissed, the permission stays « default ». The UI-SPEC state for that is « ask ».

**7. `deleteSubscription` maps 404 to « unknown».**

**8. Files touched outside `files_modified`:**
- `apps/worker/test/helpers.ts` and `pace.test.ts`: the production-delivery helper moved into helpers.ts.
- `packages/table/src/oracle.ts`: `notifyAt` added to the forbidden keys.
- `apps/worker/test/env.d.ts`: the test binding.
- `apps/worker/src/invite.ts`: deviation 4.

**9. The browser module takes the PushManager as a dependency.** The panel (04-10) gets the registration and the key before the tap, so nothing is awaited between the tap and `requestPermission()`.

**Total deviations:** 1 auto-fixed (Rule 1), 8 plan-detail notes.

## Known Stubs

None in the code delivered here. Three parts are not wired yet, by plan:
- `enablePush`, `disablePush`, `refreshKey`, `pushKey` and `browserPlatform` have no caller. The « Notifications » panel (04-10) calls them, and the install flow (04-08) reuses `platform.ts`.
- No device can hold a subscription before 04-08's service worker registers, so no real push is sent yet.

## Issues Encountered

- The local Playwright run logs « connect ECONNREFUSED 127.0.0.1:8787 », as in the earlier 04 plans. It is noise: the local preview has no Worker.
- workerd prints « SQLite alarm handler canceled with requestScheduledAlarm » during the worker tests, as before.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: outbound-fetch | apps/worker/src/PlayerHub.ts | `deliver` is a public method, so it can be called over RPC. Only the Worker holds hub stubs, and `deliver` re-checks the push-host allow-list (T-04-53). |
| threat_flag: public-endpoint | apps/worker/src/push.ts | `GET /api/push/key` needs no session. It serves only the public half of the VAPID pair. |

Everything else is in the register: T-04-53 (https, allow-list, test host only in test mode, 1 024 characters, checked on save and on send), T-04-54 (aes128gcm; the payload is the kind, a pseudo, the link and the tag), T-04-55 (one secret, never in the repo; the test pairs are generated at start, and the e2e pair is labelled), T-04-56 (upsert to the current account; delete on 404/410, logout and recovery), T-04-57 (one turn notice per table and pause, deduplicated by the hub; 10 subscriptions per account) and T-04-58 (presence decided on the server). T-04-SC: no package was added.

## To confirm with Romain

- **30 s** before « C’est ton tour » (`NOTIFY_AFTER_MS`, CONTEXT addendum), to confirm at UAT.
- **A resumed game names whoever resumed it.** Normally that is the creator (« Romain a repris la partie »). If the creator is the one missing, it is the chef de table who resumed (deviation 2).
- **A player told once per absence.** Someone who comes back and leaves again within the same pause is not told a second time (the hub's key is the table and the pause). A new pause tells them again.
- **Deploy notes (for 04-12):**
  - A new Worker secret, VAPID_PRIVATE_KEY: `node tools/vapid-keys.mjs | $CF secret put VAPID_PRIVATE_KEY -c wrangler.embarque.jsonc`. Without it the routes answer `push-off` and no push is sent (logged once per hub).
  - There is no new var, binding or migration. Durable Object migrations v1 and v2 are unchanged. Tables get `notifyAt` on their next change, and older snapshots load without it.
  - No wrangler config changed, and no remote wrangler command ran.
  - `/api/push/*` is under `run_worker_first`'s `/api/*`.
  - Push hosts are reached by plain `fetch` from the PlayerHub. Cloudflare needs no allow-list for this.

## Self-Check: PASSED

- The created files exist: notify.ts and notify.test.ts, push-fr.ts and push-fr.test.ts, apps/worker/src/push.ts, turn.test.ts, push.test.ts, push-decrypt.ts, subscriptions.test.ts, tools/vapid-keys.mjs and vapid-keys.test.ts, pwa/platform.ts and platform.test.ts, account/push.ts and push.test.ts.
- Commits d635f0d, c388be8, 637e2f1, 0f296d5, 1692d66, 56b556a, 05beb29 and 089b958 are ancestors of HEAD.
- `git rev-list --count 21ab582..HEAD` is 8 before this summary's commit, and 9 with it.
