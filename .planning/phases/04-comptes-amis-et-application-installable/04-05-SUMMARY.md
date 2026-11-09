---
phase: 04-comptes-amis-et-application-installable
plan: 05
subsystem: friends
tags: [accounts, friends, invitations, friend-codes, d1, durable-objects, rate-limit, localstorage]

requires:
  - phase: 04-comptes-amis-et-application-installable
    provides: "04-01: D1 0002 (invitations, friendships), the sign-up batch with the two friendship rows, auth/session.ts, http.ts (json, readJson, writeAllowed), the Meter; 04-03: PlayerHub.allow; 04-04: the workerd account helpers"
provides:
  - "apps/worker/src/social.ts: POST/GET /api/invitations, DELETE /api/invitations/:id, POST /api/invitations/:code/accept, POST /api/friends/code, POST /api/friends/code/redeem, GET /api/friends, DELETE /api/friends/:id"
  - "GET /api/invitations/:code answers own and friend for a signed-in caller (auth/signup.ts), and only for links (kind 'link')"
  - "PlayerHub.release({ kind, at }): one counted call given back"
  - "protocol: own and friend states, MAX_PENDING_INVITATIONS, CreatedInvitation, PendingInvitation, FriendEntry, FriendAnswer, FRIEND_CODE_LENGTH, FRIEND_CODE_TTL_MS, newFriendCode, formatFriendCode, normalizeFriendCode, FriendCodeRedeemBody, FriendCodeAnswer and their parsers"
  - "web account/api.ts: createInvitation, pendingInvitations, disableInvitation, acceptInvitation, friendCode, redeemFriendCode, friends, removeFriend (SocialResult, SocialFailure)"
  - "web account/invites.ts: toc.invites.v1 (rememberInvite, loadInvites, forgetInvite, codeFor)"
affects: [04-09, 04-10, 04-11, 04-12]

estimate:
  tokens: 120000
  tasks: 2
actuals:
  tokens: 22000
  tasks: 2
  commits: 5
plan_head_before: 9494a9dade08537919b5503ee75db5f559b508bf
plan_head_after: bfc676959e9643983db196c21aede66da3286a66

tech-stack:
  added: []
  patterns:
    - "A per-account limit inside one INSERT … SELECT … WHERE (SELECT COUNT(*) …) < 10: D1 runs the statement alone, so parallel calls cannot pass the limit"
    - "Rate limit on failures only: charge the hub before the lookup (allow), give the call back (release) when it was not a failure; parallel calls stay inside the limit"
    - "Short codes at rest as HMAC-SHA-256 under the pepper (a 40-bit code under a bare hash would be guessable from a leaked database)"

key-files:
  created:
    - apps/worker/src/social.ts
    - apps/worker/test/invitations.test.ts
    - apps/worker/test/friends.test.ts
    - apps/web/src/account/invites.ts
    - apps/web/src/account/invites.test.ts
  modified:
    - apps/worker/src/auth/signup.ts
    - apps/worker/src/index.ts
    - apps/worker/src/PlayerHub.ts
    - apps/worker/test/helpers.ts
    - apps/worker/test/hub.test.ts
    - packages/protocol/src/account.ts
    - packages/protocol/src/account.test.ts
    - apps/web/src/account/api.ts
    - apps/web/src/account/api.test.ts

key-decisions:
  - "The friend-code limit charges the requester's hub before the lookup and gives the call back unless the code was unknown or expired (PlayerHub.release), rather than a peek: parallel redemptions can never get an 11th lookup"
  - "A friend code is kept as HMAC-SHA-256(TOC_PEPPER, 'friend-code:' + code); creating or redeeming one answers 503 config without the pepper, like the other account routes"
  - "POST /api/friends/code answers the code in its canonical 8 symbols; the page shows it with formatFriendCode (TOC-XXXX-XXXX)"
  - "normalizeFriendCode drops the TOC prefix only when exactly 8 symbols follow it, so a code that itself starts with T0C still reads back"
  - "Accepting a test-mode invitation (no inviter) answers 410 unknown: there is nobody to befriend"
  - "GET /api/friends answers at most 500 friends, sorted in the Worker with localeCompare(…, 'fr', { sensitivity: 'base' }), ties by id"

patterns-established:
  - "Friends routes live in social.ts behind socialRoute(); the state of a link stays with the sign-up (invitationRoute)"

requirements-completed: [ACCT-03]

coverage:
  - id: D1
    description: "Invitation links: 22-character code, SHA-256 only in D1, 7 days, 10 pending at most (also with 16 parallel calls), used and expired not counted, list newest first, disable, the states with own and friend, accept (friend, own not spent, already not spent, used/expired/unknown 410), sign-up through a player's link"
    requirement: ACCT-03
    verification:
      - kind: integration
        ref: "apps/worker/test/invitations.test.ts (workerd, 17 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Friend codes (HMAC at rest, the newest replaces the older, read back as typed), redeem (format not counted, unknown, expired, own, already, 10 failures an hour before any lookup, also in parallel, per requester), the list in French order, removal both ways"
    requirement: ACCT-03
    verification:
      - kind: integration
        ref: "apps/worker/test/friends.test.ts (workerd, 15 tests), apps/worker/test/hub.test.ts (release)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The protocol's codes and answers; the page's calls and their reasons; toc.invites.v1 against expired, malformed, duplicate and hostile storage"
    verification:
      - kind: unit
        ref: "packages/protocol/src/account.test.ts, apps/web/src/account/api.test.ts, apps/web/src/account/invites.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "« Mes amis », the code sheet and the signed-in invitation screens"
    verification: []
    human_judgment: true
    rationale: "No screen in this plan: 04-09 (the invitation screen) and 04-10 (« Mes amis », the code sheet) draw them"

duration: about 30 min
completed: 2026-10-18
status: complete
---

# Phase 4 Plan 05: Les amis — liens d’invitation, codes amis et la liste Summary

**Romain creates an invitation link for his sister. Only the link's SHA-256 goes into D1. The link lasts 7 days and serves once, and an account can have 10 pending at most, a limit that holds even when calls run in parallel. His sister signs up through it and is in his friends at once. His cousin already has an account, so they swap friend codes (TOC-XXXX-XXXX, 24 hours, kept as an HMAC under the pepper). Each player's failed codes are capped at 10 an hour in their own PlayerHub. Everyone gets a friends list in French alphabetical order and can remove a friend in both directions at once. The page has every call, and the device remembers the links it made so it can share them again.**

## Performance

- **Duration:** about 30 min (08:11 to 08:41 UTC), including the gate. The local Playwright suite took 7.0 min and the online suite 6.0 min.
- **Tasks:** 2, each committed as RED then GREEN.
- **Files:** 14 (5 created, 9 modified).

## Accomplishments

### Invitation links (Task 1)

- `POST /api/invitations` (session, our Origin, JSON `{}`) answers 201 `{ id, code, expiresAt }`.
  - The code and the id are each 16 random bytes in base64url (22 characters).
  - D1 keeps only SHA-256 of the code. The test checks that no column holds the code.
  - The link expires 7 days after creation (D-11).
  - The insert is guarded: `INSERT … SELECT … WHERE (SELECT COUNT(*) of pending links) < 10`. The 11th pending link gets 409 `{ error: "limit" }`. Used and expired links do not count. With 16 parallel calls, exactly 10 succeed.
- `GET /api/invitations` lists the caller's pending links as `[{ id, createdAt, expiresAt }]`, newest first, with no codes.
- `DELETE /api/invitations/:id` (our Origin) removes one of the caller's own pending links and answers 204. The code then answers `unknown`. Another account's link, a used link or a bad id gets 404.
- `GET /api/invitations/:code` answers, for a valid link and a signed-in caller:
  - `own`, with `inviter` and `expiresAt`, for the link's author.
  - `friend` when the inviter is already a friend.
  - `ok` for anyone else, as before.
  - The session is read only in that case. Signed-out callers see the 04-01 states unchanged. Only `kind = 'link'` rows are matched.
- `POST /api/invitations/:code/accept` (our Origin, JSON `{}`, session):
  - Someone else's valid link: the guarded claim (`used_at`) runs as at sign-up, then one batch writes the two friendship rows and `used_by`. Answer: 200 `{ friend: { id, pseudo, since } }`. If the batch fails, the claim is released.
  - One's own link: 409 `own`, and the link is not spent.
  - Already friends: 200 `{ already: true, friend }`, and the link is not spent.
  - Used, expired or unknown links (and test invitations, which have no inviter): 410 with that state.
- Signing up through a player's link makes both accounts friends and spends the link (the 04-01 batch, now tested end to end).

### Friend codes, the list, removal (Task 2)

- Protocol:
  - `FRIEND_CODE_LENGTH` is 8 and `FRIEND_CODE_TTL_MS` is 24 hours.
  - `newFriendCode()` draws one byte per symbol, so there is no bias.
  - `formatFriendCode` gives « TOC-K7QM-2XRA ».
  - `normalizeFriendCode` accepts the code with or without the prefix, with dashes, spaces, any dash variant and lower case, and reads O as 0 and I or L as 1. It refuses 7 or 9 symbols. A property test checks that every new code reads back as itself.
- `POST /api/friends/code` answers 201 `{ code, expiresAt }`.
  - One batch deletes the caller's older code and inserts the new one as `kind 'code'`, with `code_hash = HMAC-SHA-256(TOC_PEPPER, "friend-code:" + code)`.
  - If two codes collide on the primary key, the code is drawn again (up to 3 times).
- `POST /api/friends/code/redeem { code }`:
  1. A code that cannot be read back gets 400 `format` and is not counted.
  2. The requester's hub then runs `allow({ kind: "code-fail", max: 10, windowMs: 1 hour })`. A refusal gets 429 `rate`, and the code is never looked up.
  3. An unknown or expired code gets 404 `unknown` and stays counted.
  4. Every other outcome gives the call back (`PlayerHub.release`): one's own code (409 `own`), already friends (200 `{ already, friend }`), or a new friendship (200 `{ friend }`, two rows written).
  5. The code stays valid until it expires, so several relatives can use it.
- `GET /api/friends` answers `[{ id, pseudo, since }]`, sorted with `localeCompare(…, "fr", { sensitivity: "base" })` (Ana, bruno, Élodie, émile, Zoé).
- `DELETE /api/friends/:id` (our Origin) deletes both rows in one statement and answers 204. Someone who is not a friend, or a bad id, gets 404.

### The page

- `account/api.ts` adds `createInvitation`, `pendingInvitations`, `disableInvitation`, `acceptInvitation`, `friendCode`, `redeemFriendCode`, `friends` and `removeFriend`.
  - Each returns a `SocialResult` whose reasons are `limit`, `own`, `used`, `expired`, `unknown`, `format`, `rate`, `offline`, `server` and `signed-out`.
  - Every answer is read with the shared schemas.
  - A malformed id or code never leaves the page: the result is `unknown` or `format` without a request.
- `account/invites.ts` handles `toc.invites.v1`:
  - `rememberInvite` keeps at most 10 links, newest first.
  - `loadInvites` drops expired, malformed and duplicate entries (by id or code), copes with a storage that throws, and ignores `__proto__` keys.
  - `forgetInvite` removes one link, and `codeFor(id)` returns the link this device made, or null.
  - The functions take the storage and the clock, so they run under Node.

## D1 rows written (workerd, logged with x-toc-d1)

| Event | Rows written | Rows read |
|-------|--------------|-----------|
| Create a link (`POST /api/invitations`) | **4** (the row and its index entries) | 3 |
| Disable a link | **1** | 3 |
| Accept a link (`…/accept`) | **4** (the claim, two friendship rows, used_by) | 6 |
| Sign up through a player's link | unchanged from 04-01 (the two friendship rows were already in its batch) | — |
| Create a friend code (first one) | **4** | 2 |
| Create a friend code that replaces one | **5** (the delete of the older code and the insert) | 4 |
| Redeem a friend code (new friendship) | **2** (two friendship rows, WITHOUT ROWID) | 4 |
| Remove a friend | **2** (both rows) | 6 |
| `GET /api/friends`, `GET /api/invitations`, the state of a link | 0 | a session read and the list |

A failed friend code writes nothing to D1: its count lives in the requester's PlayerHub SQLite.

## Task Commits

1. **Task 1 RED, invitation links made by a player**: `3e7419d` (test)
2. **Task 1 GREEN**: `1bfb58b` (feat)
3. **Task 2 RED, friend codes, the friends list and the links kept by this device**: `78a145e` (test)
4. **Task 2 GREEN**: `bfc6769` (feat)

## Gate (at bfc6769, one suite at a time)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | 0 errors (web: 528 files) |
| `pnpm lint` | Biome, 325 files, clean |
| `pnpm test` | Vitest 100 files, **1 585 passed, 2 skipped** (the same 2 engine skips) |
| worker project (workerd) | 20 files, 166 passed (invitations 17, friends 15, hub +1) |
| Full local Playwright | **455 passed, 99 skipped, 0 failed** (7.0 min), unchanged |
| Full online Playwright | **56 passed, 0 failed** (6.0 min), unchanged |
| Ports 8787 / 4173 before and after each run | free (checked by connecting) |
| Leftover wrangler / workerd / vite / browser processes | none |

## Screenshots

None: this plan has no screen. « Mes amis » and the code sheet come in 04-10, and the signed-in invitation states in 04-09.

## Deviations from Plan

### Plan-detail adjustments (no scope change)

**1. `PlayerHub.ts` and `hub.test.ts` touched (not in `files_modified`).**
- The plan wanted the hub « consulted first and charged on each unknown or expired code ». `allow` both checks and counts, and it has no way to look without counting.
- A peek would let parallel redemptions all pass a check at 9 failures. So the Worker charges first and gives the call back with a new `release({ kind, at })` RPC when the code was not a failure.
- The outcome is the same, and it holds under concurrency (friends.test.ts sends 14 parallel failures: 10 are looked up, 4 get 429).
- No Durable Object migration is needed (a new method only).

**2. Check order.** Every write checks our Origin (403), then the JSON body (415, 413, 400), then the session (401), as the other account routes do. The plan listed « session, Origin ».

**3. invites.ts signatures take the storage and the clock:** `loadInvites(storage, now)`, `rememberInvite(storage, invite, now)`, `forgetInvite(storage, id, now)`, `codeFor(storage, id, now)`. This follows the `net/tables.ts` pattern, so it runs under Node.

**4. Friend code answer.** `POST /api/friends/code` answers the 8 canonical symbols, and the page formats them.

**Total deviations:** none auto-fixed. 4 plan-detail notes.

## Known Stubs

None in the code delivered here. `routes/Invitation.svelte` does not yet draw `own` and `friend`: a signed-in player who opens a valid link still sees the sign-up form, as before this plan. Plan 04-09 draws those rows with `acceptInvitation`. Plan 04-10 draws « Mes amis » and the code sheet with the other calls and `invites.ts`.

## Issues Encountered

- `signUpPerson` leaves its test invitation (no inviter) in `invitations`, so one assertion counts only rows with an inviter.
- The local Playwright run logs « http proxy error: /api/me … ECONNREFUSED 127.0.0.1:8787 », as in 04-01 to 04-04. It is noise: the local preview has no Worker.

## Threat Flags

None beyond the register:

- T-04-44: HMAC under the pepper, 24 hours, 10 failures an hour per requester, signed-in only.
- T-04-45: 128-bit links, SHA-256 at rest, single use, 7 days, 10 pending.
- T-04-46: the inviter's pseudo goes only to a code holder; the pending list shows only the caller's own links.
- T-04-47: 10 pending, enforced in one statement.
- T-04-48: `writeAllowed` on every POST and DELETE, tested for each route.

No friend search and no pseudo lookup exist. Every new route is one the plan names.

## To confirm with Romain

- **A friend code serves several times for 24 hours** (as planned). Anyone Romain shows it to within the day can add him. « Nouveau code » ends the old one at once.
- **Opening one's own link or a friend's link never spends it.** The UI-SPEC copy says so (« Ce lien reste valable pour un autre proche… »).
- **Signed in on someone's link, the sign-up form still shows until 04-09.** In the meantime the server would let a signed-in player make a second account through someone else's link, since the sign-up does not look at the session. 04-09 replaces that screen with « Ajouter {Inviteur} à tes amis ? ».
- Two UI-SPEC items are already marked « à confirmer »: the toast at 10 pending links, and « Partager ce lien » only on the device that made the link.
- **Deploy notes:**
  - No new migration: `invitations` and `friendships` exist since 0002.
  - No new binding, secret or var, and no Durable Object migration (v1 and v2 unchanged). PlayerHub only gained an RPC method.
  - Friend codes need `TOC_PEPPER`, which the accounts already need since 04-01.
  - No wrangler config changed, and no remote wrangler command ran.

## Self-Check: PASSED

- The created files exist: apps/worker/src/social.ts, apps/worker/test/invitations.test.ts, apps/worker/test/friends.test.ts, apps/web/src/account/invites.ts and invites.test.ts.
- Commits 3e7419d, 1bfb58b, 78a145e and bfc6769 are ancestors of HEAD.
- `git rev-list --count 9494a9d..HEAD` is 4 before this summary's commit, and 5 with it.
