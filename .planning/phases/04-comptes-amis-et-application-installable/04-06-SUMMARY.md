---
phase: 04-comptes-amis-et-application-installable
plan: 06
subsystem: presence
tags: [accounts, friends, presence, durable-objects, hibernation, websocket, notifications, rate-limit]

requires:
  - phase: 04-comptes-amis-et-application-installable
    provides: "04-03: PlayerHub (SQLite, allow); 04-04: sessionUser on an upgrade, Person.account, the table socket route; 04-05: friendships, the account helpers of the workerd tests"
provides:
  - "packages/protocol/src/hub.ts: HUB_VERSION 1, MAX_HUB_FRAME_CHARS 256, NOTICE_FROM_MAX 20, hi, vis, notice, parseHubClientFrame, parseHubServerFrame"
  - "GET /ws/me: the signed-in app's hibernating socket to its own PlayerHub (session, our non-null Origin)"
  - "PlayerHub: presence sockets ({ hi, visible, seenAt }), present(now) with HUB_SILENCE_MS 45 s, notify({ kind, table, from, own?, resumed?, key, now? }) → notice | away | dup, INVITE_DEDUPE_MS 10 min, TURN_KEEP_MS 24 h"
  - "POST /api/tables/:id/invite { friendId } → sent | here; not-friend, not-here, started, 404, rate (30 an hour)"
  - "GameRoom.inviteInfo({ sender, friend }) → { status, senderHere, friendHere } | null, read-only"
  - "protocol: TableInviteBody, TableInviteAnswer, parseTableInviteAnswer"
  - "web account/hub.svelte.ts: connectHub() → { notice, status, closeCode, setPlace, dismiss, close }"
  - "web account/noticeRule.ts: decide, release, receive, placeChanged, settle"
  - "web account/api.ts: inviteFriend(tableId, friendId)"
affects: [04-07, 04-08, 04-11]

estimate:
  tokens: 150000
  tasks: 3
actuals:
  tokens: 18700
  tasks: 3
  commits: 7
plan_head_before: cba40d36facb6a8ca49a7a6e1f4b70547ac54a75
plan_head_after: 523113c881feec84333ddaef0122f3c050d78b31

tech-stack:
  added: []
  patterns:
    - "Presence decided by the Durable Object from hibernation attachments ({ hi, visible, seenAt }) and getWebSocketAutoResponseTimestamp: no timer, no alarm, no storage write per frame"
    - "Dedupe keys in the hub's SQLite (`sent`, WITHOUT ROWID, PRIMARY KEY (kind, key)), pruned on every notify"
    - "A read-only GameRoom RPC (inviteInfo) that never creates a schema for an unknown id"
    - "A pure rule module (noticeRule.ts) driven by a thin rune module (hub.svelte.ts) that follows the account store with $effect.root"

key-files:
  created:
    - packages/protocol/src/hub.ts
    - packages/protocol/src/hub.test.ts
    - apps/worker/src/invite.ts
    - apps/worker/test/presence.test.ts
    - apps/worker/test/table-invite.test.ts
    - apps/web/src/account/hub.svelte.ts
    - apps/web/src/account/noticeRule.ts
    - apps/web/src/account/noticeRule.test.ts
  modified:
    - packages/protocol/src/index.ts
    - packages/protocol/src/account.ts
    - packages/protocol/src/account.test.ts
    - apps/worker/src/PlayerHub.ts
    - apps/worker/src/GameRoom.ts
    - apps/worker/src/index.ts
    - apps/worker/test/helpers.ts
    - apps/worker/test/hub.test.ts
    - apps/web/src/account/api.ts
    - apps/web/src/account/api.test.ts

key-decisions:
  - "/ws/me checks Upgrade (426), then our non-null Origin (403), then the session (401): a cross-site upgrade costs no D1 read"
  - "notify remembers the key whether the player is present or away, so the push of 04-07 is never sent twice for one invite"
  - "The invite route answers « here » before the rate limit is charged; a dup is charged (it is still a call)"
  - "The not-here check comes before the started check: someone who is not at a table learns nothing new from the answer (the public summary already gives the status)"
  - "A held card is checked again (GET /api/tables/:id) only when the player leaves the place that held it; an offline answer drops it"
  - "inviteFriend never sends a malformed id: a bad table id is not-here, a bad friend id not-friend; 401 and 404 read as server"

patterns-established:
  - "Hub frames have their own version (HUB_VERSION) and close code 4002, separate from the table protocol (PROTOCOL_VERSION 5 unchanged)"

requirements-completed: []

coverage:
  - id: D1
    description: "Hub frames: hi and vis strict, 256 characters, notice with kind, table id, from (1 to 20 code points), own, resumed, at"
    verification:
      - kind: unit
        ref: "packages/protocol/src/hub.test.ts (6 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET /ws/me (426, 401, 403 for none, null and foreign Origin, 101), a forged x-toc-account reaches nobody, 4002, frames before hi ignored, presence (visible, hidden, closed, 45 s, a ping as a sign of life, two sockets), dedupe (invite 10 minutes, away remembered, turn keys)"
    requirement: APP-03
    verification:
      - kind: integration
        ref: "apps/worker/test/presence.test.ts (workerd, 14 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The table invite: sent with the notice, the same invite without a second frame, away, not-friend (stranger, oneself, nobody), not-here, started (playing, saved, paused, finished), 404, here, the 31st in an hour, Origin, JSON, session; inviteInfo read-only"
    requirement: ACCT-04
    verification:
      - kind: integration
        ref: "apps/worker/test/table-invite.test.ts (workerd, 10 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The card's rules (hold, release, only the latest, settle after a status) and inviteFriend's answers"
    verification:
      - kind: unit
        ref: "apps/web/src/account/noticeRule.test.ts, apps/web/src/account/api.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "The page's hub connection in a real browser (hi, vis, pings while visible, the card on screen)"
    verification: []
    human_judgment: true
    rationale: "connectHub() is started from App.svelte in 04-11, which draws the card and the « Mes amis » tab; no screen uses it yet"

duration: about 35 min
completed: 2026-10-18
status: complete
---

# Phase 4 Plan 06: L’application ouverte — la présence, « Inviter un ami » à la table Summary

**Romain, in his waiting room, invites his sister in one call: `POST /api/tables/:id/invite { friendId }` checks his session, that she is his friend, that he is at that table and that it still waits in its lobby, and allows him 30 invites an hour. If his sister has TOC open and visible, her PlayerHub sends « Romain t’invite à sa table » to her app at once over its own hibernating socket (`/ws/me`). If her app is hidden, locked or closed, the hub answers « away » and remembers the invite, so the push of 04-07 is sent once. The hub, never the browser, decides who is present. The page has the hub connection and the rules that hold the card during a game, a sign-up or a recovery and drop it once the table no longer waits. The card itself is drawn in 04-11.**

## Performance

- **Duration:** about 35 min (08:45 to 09:20 UTC), including the gate. The local Playwright suite took 7.1 min and the online suite 7.9 min.
- **Tasks:** 3, each committed as RED then GREEN.
- **Files:** 18 (8 created, 10 modified).

## Accomplishments

### The hub's socket and presence (Task 1)

- `packages/protocol/src/hub.ts`, exported from the index:
  - `HUB_VERSION` is 1. It is separate from the table protocol (still 5).
  - Client frames are `hi { v }` and `vis { visible }`, as strict objects. Anything else, and any text over 256 characters, is refused before `JSON.parse`.
  - The server frame is `notice { kind: invite | turn, table, from, own?, resumed?, at }`. `table` must be a table id, and `from` 1 to 20 code points, so an emoji first name fits.
- `GET /ws/me` in the Worker:
  - Without `Upgrade` it answers 426.
  - Without our own non-null Origin it answers 403. This is checked before the session, so a cross-site upgrade costs no D1 read.
  - Without a session it answers 401.
  - Otherwise it forwards to `PLAYER_HUB.getByName(me.id)` a new request carrying only `Upgrade` and `x-toc-account`. A forged `x-toc-account` from the client reaches nobody (tested).
- `PlayerHub`:
  - The constructor sets the `ping`/`pong` auto-response.
  - `fetch` accepts the hibernating socket with the attachment `{ hi: false, visible: false, seenAt }`.
  - A `hi` of another version is closed with 4002. Frames before `hi` and malformed frames are ignored.
  - `vis` updates `{ visible, seenAt }`.
  - A socket is present when it said hi, its last `vis` was visible, and its last sign of life is at most 45 s old (`HUB_SILENCE_MS`). The sign of life is the later of `seenAt` and the runtime's pong time.
  - `notify` first prunes `sent`: invites older than 10 minutes and turns older than a day. The same kind and key then answers `dup` and sends nothing. Otherwise the key is stored and the notice goes to every present socket (`notice`), or nobody is present (`away`).
  - There is no timer function and no alarm.

### « Inviter » at the table (Task 2)

- `GameRoom.inviteInfo({ sender, friend })` answers `{ status, senderHere, friendHere }`. The status is the summary's, so a won game reads `finished`. It answers `null` for an id with no table and creates no schema (tested).
- `POST /api/tables/:id/invite { friendId }` (`invite.ts`) checks, in this order:
  1. Our Origin (403), then the JSON body (415, 413, 400), then the session (401).
  2. The table id's format (404).
  3. The friendship in D1 (403 `not-friend`, also for oneself and for an id that is nobody).
  4. `inviteInfo`: no table gives 404, a caller who is not a person of the table gives 403 `not-here`, and a table playing, paused, saved or finished gives 409 `started`. If the friend is already a person of the table, the answer is 200 `{ state: "here" }` with no notice and no charge.
  5. The caller's hub `allow({ kind: "invite", max: 30, windowMs: 1 hour })`. The 31st call gives 429 `rate`.
  6. The friend's hub `notify({ kind: "invite", table, from: pseudo, key: sender:table })`. `notice`, `away` and `dup` all answer 200 `{ state: "sent" }`. If the hub throws, the answer is 500 `server`.
- The protocol gains `TableInviteBody` (strict `{ friendId }`, an opaque id), `TableInviteAnswer` and `parseTableInviteAnswer`.

### The page (Task 3)

- `noticeRule.ts` (pure):
  - `decide` holds a notice during `#/partie`, at a table that is `playing`, `paused` or `saved`, and in the `signup`, `recover` and `backup` flows. Anywhere else, a lobby or finished table included, it shows.
  - `release` shows an invite only while the table is `lobby`, and a turn only while it is `paused`. Any other status, a 404 or no answer drops it.
  - `receive` keeps only the latest notice.
  - `placeChanged` holds a shown card when the player enters a game. For a held card out of a game, it asks for the table's status first.
  - `settle` applies that status, unless a newer notice came meanwhile or the player went back into a game.
- `api.inviteFriend(tableId, friendId)` answers `sent` or `here`, or one of the reasons `not-friend`, `not-here`, `started`, `rate`, `offline` and `server`. A malformed id never leaves the page.
- `hub.svelte.ts` `connectHub()`:
  - It follows the account store with `$effect.root`: signed in, it connects; signed out, it closes and drops the notice. It also switches sockets when the account changes.
  - It uses partysocket with `maxEnqueuedMessages: 0`. On open it sends `hi`, then `vis` with the page's visibility, and it sends `vis` on every `visibilitychange`.
  - It pings every 20 s only while visible, and reconnects when no pong comes within 5 s.
  - `pagehide` closes the socket. `pageshow` and `online` reconnect it, and a return to visible pings at once.
  - Every frame goes through `parseHubServerFrame`. A close with 4002 stops reconnecting and exposes `closeCode` for the update flow of 04-08.
  - It exposes `notice` (the card to show now, or null), `setPlace`, `dismiss` and `close`.

## Costs (T-04-52, the Free plan)

**Durable Object requests per opened app:**

| Event | DO requests |
|-------|-------------|
| Opening the app (the `/ws/me` upgrade) | **1** |
| `hi` + `vis` on open (2 incoming frames at 20:1) | 0.1 |
| Each visibility change (1 frame) | 0.05 |
| Pings every 20 s while visible | **0**: the runtime answers them without waking the hub |
| A reconnect (network drop, `pagehide` then `pageshow`) | 1 + 0.1 |

The hub writes nothing to its storage for a socket: the attachment is in memory and survives hibernation.

**One table invite (measured in workerd with `x-toc-d1`, asserted in table-invite.test.ts):**

- **D1: 3 rows read** (the session, 2; the friendship, 1) **and 0 rows written.**
- **Durable Object requests: 3**: `GameRoom.inviteInfo`, the sender's `allow` and the friend's `notify`.
- **DO SQLite rows written: about 3**: one `limits` row with its index entry, and one `sent` row (WITHOUT ROWID). Pruned rows are deleted on later calls.
- A « here » answer stops after `inviteInfo` (D1 3 rows read, 1 DO request, nothing written).

## Task Commits

1. **Task 1 RED, the app's socket to its PlayerHub, presence and notify**: `cf9b157` (test)
2. **Task 1 GREEN**: `67b9cbc` (feat)
3. **Task 2 RED, inviting a friend to one's table in one call**: `5b5cceb` (test)
4. **Task 2 GREEN**: `aebb0a5` (feat)
5. **Task 3 RED, the notice rules and the table invite call of the page**: `5328873` (test)
6. **Task 3 GREEN**: `523113c` (feat)

## Gate (at 523113c, one suite at a time)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | 0 errors (web: 532 files) |
| `pnpm lint` | Biome, 333 files, clean |
| `pnpm test` | Vitest 104 files, **1 629 passed, 2 skipped** (the same 2 engine skips) |
| worker project (workerd) | 22 files, 190 passed (presence 14, table-invite 10; hub.test updated for the `sent` table) |
| Full local Playwright | **455 passed, 99 skipped, 0 failed** (7.1 min), unchanged |
| Full online Playwright | **56 passed, 0 failed** (7.9 min), unchanged |
| Ports 8787 / 4173 before and after each run | free (checked by connecting) |
| Leftover wrangler / workerd / vite / browser processes | none |

## Screenshots

None: this plan has no screen. The card (`NoticeCard.svelte`) and the waiting room's « Mes amis » tab are drawn in 04-11, which also starts `connectHub()` from App.svelte.

## Deviations from Plan

### Plan-detail adjustments (no scope change)

**1. `apps/worker/test/hub.test.ts` touched (not in `files_modified`).** Its « keeps no MAC » test listed the hub's SQLite tables, so it now expects `sent` as well. The assertion that no MAC is stored is unchanged.

**2. `packages/protocol/src/account.test.ts` touched.** It gains two small tests for `TableInviteBody` and `parseTableInviteAnswer`.

**3. Check order on `/ws/me`.** The route checks Upgrade, then Origin, then the session, where the plan listed the session before the Origin. Every case answers the status the plan names. A cross-site upgrade is refused before any D1 read.

**4. Check order on the invite route.** The Origin and JSON checks come before the session, as on every account write since 04-01. `not-here` is checked before `started`, and `here` is answered before the rate limit is charged.

**5. `noticeRule.ts` has more than `decide` and `release`.** It also has `receive`, `placeChanged` and `settle`, so that the « only the latest » rule and the race between a status answer and a newer notice are pure and tested. `hub.svelte.ts` only wires them.

**6. `inviteFriend` maps 401 and 404 to `server`.** The plan's reason list has no `signed-out` or `gone`, and the UI-SPEC's « server » toast covers both.

**Total deviations:** none auto-fixed; 6 plan-detail notes.

## Known Stubs

None in the code delivered here. `connectHub()` has no caller yet: App.svelte starts it in 04-11. Until then a signed-in app opens no `/ws/me` socket, so every invite answers « away » (and nothing is pushed before 04-07).

## Issues Encountered

- The local Playwright run logs « connect ECONNREFUSED 127.0.0.1:8787 », as in 04-01 to 04-05. It is noise: the local preview has no Worker.
- workerd prints « SQLite alarm handler canceled with requestScheduledAlarm » during the worker tests, as before this plan (GameRoom alarms). The tests pass.

## Threat Flags

None beyond the register:

- T-04-49: `/ws/me` needs a session and our non-null Origin. The hub is the cookie's account, and a forged `x-toc-account` is replaced (tested).
- T-04-50: only friends, only from a person of the table, only for a lobby. Each sender may send 30 invites an hour, and the same invite is sent once per 10 minutes, whether the friend is present or away.
- T-04-51: a notice carries the table id, a pseudo and the kind. Presence never leaves the hub, and no route reports it.
- T-04-52: the sockets hibernate and the runtime answers pings. Frames come only on open and on visibility changes (the costs above).
- T-04-SC: no package was added.

## To confirm with Romain

- **Any signed-in person at the table can invite their friends**, not only the chef de table (UI-SPEC row « à confirmer par Romain »). The server allows it.
- **An invite while the friend's app is closed is remembered for 10 minutes.** Inviting again within that window sends nothing: no second card and, from 04-07, no second push. The UI shows « Invitation envoyée » for those 10 minutes.
- **A held card comes back only if the table still waits.** An invite held during the friend's own game is dropped if Romain's table has started by the time the game ends.
- **Deploy notes:**
  - No new migration, binding, secret or var.
  - No Durable Object migration: v1 and v2 are unchanged. PlayerHub only gained a constructor, `fetch`, socket handlers and `notify`, and its SQLite table `sent` is created on first use.
  - `/ws/me` is under `run_worker_first`'s `/ws/*` and goes through `handleRequest` in the embedded entry.
  - No wrangler config changed, and no remote wrangler command ran.

## Self-Check: PASSED

- The created files exist: packages/protocol/src/hub.ts and hub.test.ts, apps/worker/src/invite.ts, apps/worker/test/presence.test.ts and table-invite.test.ts, apps/web/src/account/hub.svelte.ts, noticeRule.ts and noticeRule.test.ts.
- Commits cf9b157, 67b9cbc, 5b5cceb, aebb0a5, 5328873 and 523113c are ancestors of HEAD.
- `git rev-list --count cba40d3..HEAD` is 6 before this summary's commit, and 7 with it.
