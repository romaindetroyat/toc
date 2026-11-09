---
phase: 04-comptes-amis-et-application-installable
plan: 04
subsystem: accounts-at-the-table
tags: [accounts, durable-objects, websocket, d1, table-members, seats, origin, leak-oracle, svelte, playwright]

requires:
  - phase: 04-comptes-amis-et-application-installable
    provides: "04-01: D1 0002 (table_members), auth/session.ts (sessionUser, hasCookie), http.ts (writeAllowed, json), the account store and toc.me.v1, e2e-online/comptes.ts; 04-02: the DELETE-with-Origin pattern; 04-03: the workerd account helpers"
provides:
  - "packages/table accounts.ts: resolveWho (rules 1-4 of 04-RESEARCH Pattern 4), linkPerson, newPerson, memberChanges; Person.account (server-only); the hello command's optional account; Reduced.members"
  - "oracle.ts: the key `account` is forbidden in frames; personSecrets(table) lists the people's ids and accounts for frameProblems' `forbidden`"
  - "Worker: a table upgrade with a session needs our non-null Origin; it reaches the GameRoom as a new Request carrying x-toc-account / x-toc-pseudo, set by the Worker only"
  - "GameRoom: the attachment keeps the account; the hello hashes device, guest and account ids, resolveWho picks the person; table_members written after the commit (best effort)"
  - "members.ts: writeMembers, GET /api/me/tables (newest first, at most 20), DELETE /api/me/tables/:id (Origin, 204)"
  - "protocol: AccountTable, parseAccountTables, MAX_ACCOUNT_TABLES"
  - "web: TableEntry.account, rememberTable(…, account), visibleTables, mergeTables; account/api.ts myTables, forgetMyTable; Table.svelte plays under the pseudo without the first-name prompt"
  - "e2e-online/table-compte.spec.ts"
affects: [04-05, 04-06, 04-07, 04-09, 04-11, 04-12]

estimate:
  tokens: 160000
  tasks: 3
actuals:
  tokens: 22000
  tasks: 3
  commits: 7
plan_head_before: c275893717f5b8c6e96c2b6ca8818fe76d860444
plan_head_after: d71dcb15752c635aeb0c9eae0c884e8de84ed2a2

tech-stack:
  added: []
  patterns:
    - "The Worker forwards a table upgrade as a new Request built from scratch (Upgrade plus the headers it sets), so no client header reaches the Durable Object"
    - "The Durable Object does every await (the hashes) first, then reads the table again and decides synchronously (resolveWho on the table as it is after the await)"
    - "A per-command diff in reduce() (memberChanges) instead of hooks in each handler: every path that links a person or moves a linked seat is covered, including the reclaim"

key-files:
  created:
    - packages/table/src/accounts.ts
    - packages/table/src/accounts.test.ts
    - apps/worker/src/members.ts
    - apps/worker/test/account-seat.test.ts
    - apps/web/e2e-online/table-compte.spec.ts
  modified:
    - packages/table/src/table.ts
    - packages/table/src/reduce.ts
    - packages/table/src/oracle.ts
    - packages/table/src/index.ts
    - packages/protocol/src/account.ts
    - apps/worker/src/index.ts
    - apps/worker/src/GameRoom.ts
    - apps/worker/src/me.ts
    - apps/worker/test/helpers.ts
    - apps/worker/test/leak.test.ts
    - apps/web/src/net/tables.ts
    - apps/web/src/net/tables.test.ts
    - apps/web/src/account/api.ts
    - apps/web/src/account/api.test.ts
    - apps/web/src/routes/Table.svelte

key-decisions:
  - "Rule 3 writes a members row at once (seat null): an account that opens a table link without sitting still finds it on its other devices, like the device list, which also remembers an unseated table"
  - "table_members.joined_at is the first link's time and stays; a seat change only updates the seat (one row written either way)"
  - "The stricter Origin rule applies when the cookie opens a valid session; a stale or unknown cookie is a guest and keeps the phase-2 rule"
  - "A failed session lookup on the upgrade (D1 down) is not caught: the upgrade fails and the client's reconnect tries again, rather than seating a signed-in player as a guest"
  - "On the device list, a guest welcome never changes an entry tagged with an account (rule 4: that seat stays the account's); a welcome for another account retags the entry"
  - "The hello command's account is optional (absent = a guest), so every phase-2 test and the leak property kept their commands"

patterns-established:
  - "Server-only Person fields: add them to oracle.ts FORBIDDEN_KEYS and to personSecrets"

requirements-completed: [ACCT-02, ACCT-04]

coverage:
  - id: D1
    description: "resolveWho rules 1-4, linking without renaming any who, the pseudo as name, never relinked to another account, members on link/sit/stand/move/leave, older snapshots"
    verification:
      - kind: unit
        ref: "packages/table/src/accounts.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Rules 1-4 with real sockets, the forged x-toc-account with and without a cookie, the Origin of a cookie-carrying upgrade, the table_members rows"
    requirement: ACCT-04
    verification:
      - kind: integration
        ref: "apps/worker/test/account-seat.test.ts (workerd)"
        status: pass
    human_judgment: false
  - id: D3
    description: "No frame carries an account id: a whole game with an account seat through reconnects and evictions"
    verification:
      - kind: integration
        ref: "apps/worker/test/leak.test.ts (Ana signed in)"
        status: pass
    human_judgment: false
  - id: D4
    description: "GET /api/me/tables (newest first, 20 at most, 401 signed out) and DELETE /api/me/tables/:id (403 without our Origin, 204)"
    requirement: ACCT-02
    verification:
      - kind: integration
        ref: "apps/worker/test/account-seat.test.ts#GET and DELETE /api/me/tables"
        status: pass
    human_judgment: false
  - id: D5
    description: "A guest seat kept after signing up on the same device; no first-name prompt; the pseudo on the other device; the tagged entry"
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/table-compte.spec.ts (phone and desktop)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Signing in on a second real device takes the seat back, the first one sees « Partie ouverte ailleurs »"
    verification: []
    human_judgment: true
    rationale: "Covered in workerd (rule 1, 4001); the real two-device feel belongs to the 04-12 UAT"

duration: about 37 min
completed: 2026-10-18
status: complete
---

# Phase 4 Plan 04: Le compte à la table Summary

**Léo sat at bleu as a guest on his phone. He creates his account on that phone, reopens the table link and is still at bleu, now under his pseudo, without typing a first name. The Worker reads the session cookie on the upgrade and forwards the account in two headers only it can set. The GameRoom picks the person with the four rules of 04-RESEARCH Pattern 4. D1's table_members now lists the account's tables on every device. A signed-out device can no longer take an account's seat, and guests play exactly as in phase 2.**

## Performance

- **Duration:** about 37 min (07:27 to 08:04 UTC), including the full gate. The local Playwright suite took 6.9 min and the online one 7.8 min.
- **Tasks:** 3, each as a RED commit then a GREEN commit.
- **Files:** 20 (5 created, 15 modified).

## Accomplishments

### The table core (packages/table)

- `Person.account`: the account a person is linked to, or null for a guest. It is server-only, and `copyTable` sets null on older snapshots.
- `resolveWho(table, { device, guest, account })` picks the person:
  1. An account with a linked person gets that person, on any device.
  2. Otherwise, an account whose device person exists unlinked gets the device person, which the hello then links.
  3. Otherwise, an account gets `account.who`, a new person.
  4. A device with no account whose device person is linked gets `guest`, a new guest with no seat.
  - Every other device gets its device person, as in phase 2.
- The hello command takes an optional `account: { id, pseudo }`.
  - It links an unlinked person; their name becomes the pseudo.
  - A linked person's name follows the pseudo, never `hello.name`.
  - It never relinks a person who belongs to another account.
  - No `who` changes, so the creator, votes, pause and reclaims stay valid.
- `Reduced.members` comes from `memberChanges(before, after)`, worked out once in `reduce()`. It lists each linked person who became linked or whose seat changed, and each linked person who left (seat null). It is absent when empty.
- The oracle forbids the key `account` in any frame. `personSecrets(table)` lists every person's `who` and account, for the `forbidden` argument of `frameProblems`.

### The Worker and the GameRoom

- The `GET /ws/table/:id` checks:
  - The phase-2 `sameOrigin` check runs first, so a foreign Origin always gets 403.
  - If the cookie opens a session, the Origin must also be present and non-null, else 403.
  - The upgrade then reaches the GameRoom as `new Request(url, { headers })`, carrying only `Upgrade`. For a session it also carries `x-toc-account` and `x-toc-pseudo` (`encodeURIComponent`). A copy the client sent never gets through.
- The GameRoom:
  - The attachment is now `{ who, helloAt, account }`.
  - At hello, it hashes `tableId:token`, `tableId:guest:token` and, for an account, `tableId:acct:userId` in one `Promise.all`.
  - It then reads the table again and calls `resolveWho`. It closes the person's older sockets with 4001, as before, and runs the hello with the account.
  - After the commit, `run()` writes `members` through `writeMembers`. The write is awaited together with any game records. A failure is logged and ignored; a missing database is logged once.
- `members.ts`:
  - `writeMembers` does one upsert per account (`ON CONFLICT DO UPDATE SET seat`), and the join time stays.
  - `GET /api/me/tables` returns `[{ tableId, seat, joinedAt }]`, newest first, at most 20, or 401 without a session.
  - `DELETE /api/me/tables/:id` needs our Origin (403 otherwise), then a session (401), and answers 204. Other methods get 405.
  - `me.ts` routes both.

### The page

- `tables.ts`:
  - `TableEntry.account` is kept only when it is a 22-character id. A malformed tag is dropped, but the entry stays.
  - `rememberTable(…, account?)` tags the entry. A guest's welcome never changes an entry tagged with an account.
  - `visibleTables(entries, accountId | null)` hides another account's entries, and every tagged entry when signed out.
  - `mergeTables(device, accountTables, accountId)` returns one list: the device's seat and join time win, newest first, at most 20, and rows that do not parse are skipped.
- `account/api.ts`: `myTables()` returns `AccountTable[]`, or null when signed out, offline, failing or the answer is malformed. `forgetMyTable(id)` deletes one table from the account's list.
- `Table.svelte`: `playName = account pseudo ?? device first name`.
  - When signed in, there is no NamePrompt and the hello carries the pseudo.
  - The welcome tags the device's entry with the account id.
  - Both values are strings, so `/api/me` confirming the same account opens no new connection. Signing in or out does reconnect.
  - A guest's path is unchanged.

## D1 rows written (workerd, logged by account-seat.test.ts)

| Event | Rows written |
|-------|--------------|
| A person becomes linked (rule 2 or 3) | **1** (one upsert into `table_members`, WITHOUT ROWID, no secondary index) |
| A linked person sits, stands, is moved or leaves | **1** (the same upsert, the seat only) |
| A hello that links nothing new (rule 1 on another device, a reload) | **0** |
| A guest's hello or seat change | **0** |
| `GET /api/me/tables` | 0 (one session read, one list read) |
| `DELETE /api/me/tables/:id` | 1 |

The table upgrade with a cookie costs one D1 read (the session), and nothing on the game path reads D1.

## Task Commits

1. **Task 1 RED, the table core recognises an account**: `e5b37fe` (test)
2. **Task 1 GREEN**: `e81e2a0` (feat)
3. **Task 2 RED, the session cookie reaches the table, and the account's tables in D1**: `d35f684` (test)
4. **Task 2 GREEN**: `52c7bad` (feat)
5. **Task 3 RED, at the table under one's pseudo, and the table list tagged by the account**: `4389634` (test)
6. **Task 3 GREEN**: `d71dcb1` (feat)

## Gate (at d71dcb1, one suite at a time)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | 0 errors (web: 526 files) |
| `pnpm lint` | Biome, 320 files, clean |
| `pnpm test` | Vitest 97 files, **1 533 passed, 2 skipped** (the same 2 engine skips) |
| worker project (workerd) | 18 files, 134 passed (account-seat 12, leak with an account seat) |
| Task 3 verify (6 online specs × 2 projects) | 24 passed |
| Full local Playwright | **455 passed, 99 skipped, 0 failed** (6.9 min), unchanged |
| Full online Playwright | **56 passed, 0 failed** (7.8 min): the 54 of 04-03 plus table-compte on both projects |
| Ports 8787 / 4173 before and after each run | free (checked by connecting) |
| Leftover wrangler / workerd / vite / browser processes | none |

## Screenshots

A throwaway spec (not committed) took them against `wrangler dev`, with Léo signed in at bleu and Bruno a guest at jaune:

- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/04-04-salle-compte-844x390.png`: the signed-in device's waiting room. Bleu shows « Léonie … » with the crown and « toi », and the title reads « Table de Léonie … ».
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/04-04-salle-compte-1280x800.png`
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/04-04-salle-invite-voit-pseudo-844x390.png`
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/04-04-salle-invite-voit-pseudo-1280x800.png`: Bruno's view. Bleu reads « Léonie asgbni, en ligne », the creator line uses the pseudo, and the toast says « Léonie asgbni a rejoint la table. »

## Deviations from Plan

### Plan-detail adjustments (no scope change)

**1. Files touched beyond `files_modified`**
- `apps/worker/test/leak.test.ts`: Ana now signs in, so the whole-game leak test runs with an account seat, and her account id is in `forbidden`. The plan's behaviour list asks for exactly this (« the leak test … still passes with an account seat at the table »).
- `apps/web/e2e-online/comptes.ts` is listed but needed no change: `passkeyContext`, `mintInvitation`, `signUp` and `uniquePseudo` were enough.

**2. The members outbox is a diff, not per-handler pushes.** The plan said hello, sit, stand, move and leave « push members ». `reduce()` now diffs the people before and after every command (`memberChanges`). That covers the same handlers, plus a reclaim that removes a linked person, with one code path.

**3. `frameProblems` keeps its signature.** It cannot see the table. So the « refuses a frame containing a person's account value » check comes from `personSecrets(table)` passed as `forbidden`, plus the key `account` added to `FORBIDDEN_KEYS`.

**4. The e2e RED was not run before GREEN.** The node RED (tables, api) failed as expected before the GREEN. The new online spec was first run after the GREEN, inside the Task 3 verify, and passed on both projects.

**Total deviations:** none auto-fixed. 4 plan-detail notes.

## Known Stubs

None. `mergeTables`, `visibleTables`, `myTables` and `forgetMyTable` are ready and tested, and nothing on screen calls them yet. As the plan says, the home's merged list and the signed-out hiding are wired in 04-09.

## Issues Encountered

- In workerd, the test side's `close` event for a socket the test closed itself arrives only with the next ping, about 10 s later. account-seat.test.ts therefore does not await it; the 4001 close from the server is awaited and is immediate.
- The local Playwright run logs « http proxy error: /api/me … ECONNREFUSED 127.0.0.1:8787 », as in 04-01 to 04-03. The local preview has no Worker, so this is noise.

## Threat Flags

None beyond the register (T-04-39 to T-04-43):

- T-04-39, a forged header: tested with and without a cookie.
- T-04-40, the Origin with a cookie: tested with none, `null`, foreign and http.
- T-04-41, rule 4: tested in the core and in workerd.
- T-04-42: the oracle, plus the workerd leak test with an account seat.

`DELETE /api/me/tables/:id` is a new cookie write, behind our Origin like `DELETE /api/auth/passkeys/:id`.

## To confirm with Romain

- **Sign-out on a shared device (D-12, rule 4).**
  - After « Se déconnecter », the tablet comes back to that table as a new guest without a seat, while the account's seat stays paused « on attend ».
  - The tablet can still ask « C'est moi, … » through the phase-2 reclaim. If the chef de table agrees, that guest takes the seat and the account loses it.
  - Is that fine, or should a linked seat refuse the reclaim? Plan 04-11 adds the « Connecte-toi pour reprendre ta place » notice.
- **« … a rejoint la table » after signing in.** When a guest signs up and comes back, the others get « Léonie … a rejoint la table. ». The person had in fact left the table page to sign up, so the toast is true, but it does not say that « Léo » became « Léonie ».
- **Deploy notes:**
  - No new migration: `table_members` exists since 0002, already in the phase's D1 migrations.
  - No new binding, secret or var, and no Durable Object migration (v1 and v2 unchanged).
  - No wrangler config changed, and no remote wrangler command ran.
- **Real-device UAT (04-12):** sign in on a second real device at a running table. That device should get the seat, and the first should show « Partie ouverte ailleurs ».

## Self-Check: PASSED

- The created files exist: packages/table/src/accounts.ts and accounts.test.ts, apps/worker/src/members.ts, apps/worker/test/account-seat.test.ts, apps/web/e2e-online/table-compte.spec.ts.
- Commits e5b37fe, e81e2a0, d35f684, 52c7bad, 4389634 and d71dcb1 are ancestors of HEAD.
- `git rev-list --count c275893..HEAD` is 6 before this summary's commit, and 7 with it.
