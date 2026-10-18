---
phase: 04-comptes-amis-et-application-installable
plan: 02
subsystem: auth
tags: [accounts, passkeys, login, session, csrf, backup-code, simplewebauthn, d1]

requires:
  - phase: 04-comptes-amis-et-application-installable
    provides: "04-01: migration 0002, http.ts (writeAllowed, readJson), db.ts (Meter, x-toc-d1), auth/session.ts, auth/backup.ts, auth/webauthn.ts, auth/signup.ts, the software authenticator and the account client"
provides:
  - "POST /api/auth/login/options (usernameless, stateless signed challenge, nothing written) and /verify (new session, counter and last_used_at)"
  - "POST /api/auth/logout: this device's session row and its push subscription (cascade) go, the cookie expires"
  - "The sliding session: GET /api/me renews a session seen more than 7 days ago (REFRESH_AFTER_MS), 400 days (SESSION_TTL_MS)"
  - "POST /api/auth/passkeys/options and /verify (excludeCredentials), DELETE /api/auth/passkeys/:id (never the last, its sessions end)"
  - "POST /api/auth/backup-code/options and /verify: step-up by one of the account's own passkeys, then a new backup code shown once"
  - "auth/challenge.ts: storeChallenge / takeChallenge (moved from signup.ts), loginChallenge / checkLoginChallenge, the spent row, the hourly sweep of expired challenges and sessions"
  - "Web account client: logIn, logOut, addPasskey, removePasskey, newBackupCode with their reasons; store signedIn / signedOut"
  - "csrf.test.ts: the Origin and content-type checks on every cookie-authenticated write of 04-01 and 04-02"
affects: [04-03, 04-05, 04-07, 04-09, 04-10, 04-12]

actuals:
  tokens: 27000
  tasks: 2
  commits: 5
plan_head_before: 3961afb9f2618e14c073e1d9f06e252fd11c9d80
plan_head_after: 4d162732db981a9de7a793205b7fadff774d697c

tech-stack:
  added: []
  patterns:
    - "Stateless login challenge: 32 random bytes + purpose + expiry, HMAC-SHA-256 under TOC_PEPPER; recorded as spent (a challenges row, purpose login) in the login's own batch, only after the assertion verified"
    - "Stored ceremony challenges bound to an account and a purpose, taken by a DELETE that must remove exactly one row"
    - "Expired challenges and sessions swept at most once an hour per isolate (no cron, no timer)"
    - "Cookie-authenticated DELETE: Origin check only, no body"

key-files:
  created:
    - apps/worker/src/auth/challenge.ts
    - apps/worker/src/auth/login.ts
    - apps/worker/src/auth/passkeys.ts
    - apps/worker/test/login.test.ts
    - apps/worker/test/passkeys.test.ts
    - apps/worker/test/csrf.test.ts
  modified:
    - packages/protocol/src/account.ts
    - packages/protocol/src/account.test.ts
    - apps/worker/src/index.ts
    - apps/worker/src/me.ts
    - apps/worker/src/auth/session.ts
    - apps/worker/src/auth/signup.ts
    - apps/worker/test/helpers.ts
    - apps/worker/test/authenticator.ts
    - apps/web/src/account/api.ts
    - apps/web/src/account/api.test.ts
    - apps/web/src/account/webauthn.ts
    - apps/web/src/account/webauthn.test.ts
    - apps/web/src/account/store.svelte.ts

key-decisions:
  - "Adding a passkey moves this device's session onto the new key (sessions.passkey_id), so « cet appareil » is the key just made, and removing the old key does not sign this device out"
  - "Add verify answers 409 already-here when the browser created a key the account already has; the client maps the browser's InvalidStateError to the same reason"
  - "The write routes answer 405 (Allow: POST) to a GET, so no GET can change anything; GET /api/me only renews the caller's own session"
  - "logOut forgets the account (toc.me.v1) even when the network call fails"

patterns-established:
  - "Every new account write is listed in csrf.test.ts WRITES, which checks 403 for a missing, foreign, null or http Origin, 415 for a non-JSON body, 405 for a GET, and that D1 is unchanged"
  - "Workerd tests log x-toc-d1 per call so each SUMMARY can record the D1 cost"

requirements-completed: [ACCT-01, ACCT-02]

coverage:
  - id: D1
    description: "Usernameless login on another device with the account's passkey; unknown key, foreign user handle, spent, forged or expired challenge and bad signature refused"
    requirement: ACCT-01
    verification:
      - kind: integration
        ref: "apps/worker/test/login.test.ts (workerd + D1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Stays signed in: the session slides 400 days, renewed at most once a week"
    requirement: ACCT-02
    verification:
      - kind: integration
        ref: "apps/worker/test/login.test.ts#the sliding session"
        status: pass
    human_judgment: false
  - id: D3
    description: "Logout ends this device only (its push subscription by cascade)"
    verification:
      - kind: integration
        ref: "apps/worker/test/login.test.ts#POST /api/auth/logout"
        status: pass
    human_judgment: false
  - id: D4
    description: "Add a passkey (excludeCredentials), list them, remove one but never the last, its sessions end"
    verification:
      - kind: integration
        ref: "apps/worker/test/passkeys.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "A new backup code only after a fresh assertion of the account's own passkey"
    verification:
      - kind: integration
        ref: "apps/worker/test/passkeys.test.ts#a new backup code"
        status: pass
    human_judgment: false
  - id: D6
    description: "Origin and JSON checks on every cookie-authenticated write"
    verification:
      - kind: integration
        ref: "apps/worker/test/csrf.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Signing in on a computer with a phone's passkey (QR code, hybrid transport) on real devices"
    verification: []
    human_judgment: true
    rationale: "The software authenticator replaces the platform dialog; cross-device sign-in needs real devices (04-12 UAT)"

duration: about 44 min across two runs
completed: 2026-10-18
status: complete
---

# Phase 4 Plan 02: Sign in with a passkey, sign out, manage passkeys, a new backup code Summary

**A player signs in on any device with their account's passkey without typing a pseudo. The login challenge is HMAC-signed under the pepper and writes nothing to D1 until an assertion verifies. They stay signed in through a 400-day session renewed at most once a week, and sign out one device at a time. They can add a passkey (excludeCredentials) or remove one (never the last; its sessions end), and get a new backup code only after a fresh assertion of one of their own passkeys. Every cookie-authenticated write needs our non-null Origin and a JSON body.**

## Performance

- **Duration:** about 44 min in total. The tasks took 15 min (06:03 to 06:18 UTC). The first executor was then cut off by a container restart during the local Playwright run. The resumed run redid the gate and wrote this summary (06:25 to 06:47 UTC).
- **Started:** 2026-10-18T06:03:05Z
- **Completed:** 2026-10-18T06:46:41Z
- **Tasks:** 2
- **Files modified:** 19

## Accomplishments

- **Login** (`auth/login.ts`):
  - Options carry no allowCredentials, use userVerification preferred, and write nothing (`x-toc-d1: w=0;r=0`).
  - Verify:
    - Finds the passkey by credential id.
    - Requires the response's userHandle to equal the owner's WebAuthn handle.
    - Accepts a counter staying at 0, for synced passkeys.
    - Writes the new session, the counter, last_used_at and the spent challenge in one batch.
  - Refusals:
    - A forged, expired or already spent challenge → `expired`.
    - An unknown key or a foreign user handle → `unknown`.
    - A bad signature → `refused`.
- **Logout** deletes this device's session row, and its push subscription goes with it by cascade. The cookie is cleared (Max-Age=0), and the account's other devices stay signed in.
- **Sliding session** (`auth/session.ts` `refresh`): GET /api/me renews the cookie and moves expires_at 400 days on, but only when the session was last seen more than 7 days ago. Otherwise it writes nothing.
- **Challenges** (`auth/challenge.ts`):
  - The stored, single-use, account-bound challenges of 04-01 moved here, and signup.ts now uses them.
  - The stateless login challenge also lives here.
  - Expired challenges and sessions are swept at most once an hour per isolate.
- **Passkeys** (`auth/passkeys.ts`):
  - Add: options exclude the account's keys and bind an `add` challenge to the account. Verify stores the label from the User-Agent and the rp_id.
  - Remove: one's own key goes (204) and the sessions opened with it end. The last key gets 409 `last`, and another account's key gets 404.
  - GET /api/me lists the keys newest first, with `current` and `backedUp`.
- **New backup code**:
  - The options allow only the account's passkeys, behind a `stepup` challenge bound to the account (5 minutes).
  - Verify checks the assertion and then, in one batch, writes the new code's MAC, backup_at and auth_at = now.
  - The new code (20 symbols) is answered once and the old code stops matching. Another account's key → `refused`.
- **Web client** (`apps/web/src/account/api.ts`):
  - `logIn`, `logOut`, `addPasskey`, `removePasskey` and `newBackupCode` each return `{ ok }` or a reason. The reasons are cancelled, unknown, expired, already-here, last, wrong-address, unsupported, offline, server and signed-out.
  - `logOut` forgets toc.me.v1 even offline.
  - The store gains `signedIn(me)` and `signedOut()`.
- **Protocol**: `EmptyBody`, `LoginVerifyBody` (length-capped AuthenticationResponse), `AddPasskeyVerifyBody`, `BackupCodeVerifyBody` and the answer parsers, with tests.

## D1 rows written per call (x-toc-d1, workerd, logged by login.test.ts and passkeys.test.ts)

| Call | x-toc-d1 | Rows written |
|------|----------|--------------|
| Login options | w=0; r=0 | **0** |
| Login verify | w=6; r=6 | **6** |
| Logout | w=2; r=4 | **2** |
| Refresh (GET /api/me, seen 8 days ago) | w=1; r=5 | **1** |
| GET /api/me, seen 1 day ago | w=0 | **0** |
| Add a passkey: options | w=2; r=6 | **2** |
| Add a passkey: verify | w=5; r=5 | **5** |
| Remove a passkey | w=3; r=18 | **3** |
| New backup code: options | w=2; r=5 | **2** |
| New backup code: verify | w=4; r=9 | **4** |

Here is what these counts mean against the Free plan:
- **A sign-in** (options + verify) costs 6 rows, and an anonymous caller who never presents a valid assertion costs 0 (T-04-29).
- **A device used every day** costs at most 1 row a week for its session.
- **Adding a passkey** costs 7 rows, and **a new backup code** costs 6.

## Task Commits

1. **Task 1 RED: usernameless login, the sliding session, logout and the Origin checks**: `3f8e792` (test)
2. **Task 1 GREEN: sign in with a passkey without a pseudo, stay signed in, sign out**: `efd0786` (feat)
3. **Task 2 RED: add or remove a passkey, a new backup code behind a passkey**: `6d2c682` (test)
4. **Task 2 GREEN: add or remove a passkey, and a new backup code confirmed by a passkey**: `4d16273` (feat)

No fix commit was needed on resume: both tasks' acceptance greps pass, and the behaviour lists are covered by login.test.ts, passkeys.test.ts, csrf.test.ts and api.test.ts.

## Gate (at 4d16273, run after the resume, one suite at a time)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | 0 errors (web: 523 files) |
| `pnpm lint` | Biome, 311 files, clean |
| `pnpm test` | Vitest 93 files, **1 455 passed, 2 skipped** (the same 2 engine skips) |
| login + passkeys + csrf (workerd) | 3 files, 37 passed |
| Full local Playwright | **455 passed, 99 skipped, 0 failed** (7.0 min), unchanged from 04-01 |
| Full online Playwright | **54 passed, 0 failed** (8.9 min), unchanged from 04-01 |
| Ports 8787 / 4173 before and after each run | free (checked by connecting) |
| Leftover wrangler / workerd / vite / playwright / browser processes | none, before and after |

## Screenshots

None. This plan adds no screen: the « Se connecter » sheet and the « Mon compte » screens that use these calls come in 04-09 and 04-10.

## Decisions Made

See `key-decisions` above. The one with UI consequences:
- **This device's session moves onto a key added on it.** « cet appareil » then points to the new key, and removing the old one does not sign this device out.

## Deviations from Plan

### Plan-detail adjustments (no scope change)

**1. Files touched beyond `files_modified`**
- `apps/worker/src/auth/signup.ts`: action step 2 asks for its challenges to move to challenge.ts.
- `apps/web/src/account/webauthn.ts` and `webauthn.test.ts`: action step 4 maps InvalidStateError to already-here through webauthn.ts. They also gained `getPasskey`, the authentication ceremony.
- `apps/worker/test/authenticator.ts`: the software passkey can report a fixed counter, for the « counter 0 accepted » case.
- `apps/worker/src/http.ts` is listed but needed no change: writeAllowed and readJson from 04-01 were enough.

**2. Write routes answer 405 to a GET**
- The plan says « a GET with side effects does not exist ». csrf.test.ts proves it with a 405 and `Allow: POST` on every write route, and checks that D1 is unchanged.

**3. Resume after a container restart**
- The previous executor committed both tasks and died during the local Playwright run.
- This run killed no process, because none was left. It re-checked the acceptance criteria, ran the whole gate and wrote this summary.

**Total deviations:** 0 auto-fixes and 3 plan-detail notes.

## Known Stubs

None. The server routes and the client calls are wired end to end in the tests. The screens that call them are planned in 04-09 and 04-10.

## Issues Encountered

- The local Playwright run logs « http proxy error: /api/me … ECONNREFUSED 127.0.0.1:8787 », as in 04-01. The local preview has no Worker behind `/api`, so `me()` reads offline and the guest home is unchanged. It is noise, not a failure.

## Threat Flags

None beyond the plan's register (T-04-28 to T-04-33). Every new endpoint is listed in it, and csrf.test.ts covers each write.

## To confirm with Romain

- **Real-device sign-in** (04-12 UAT), on a computer with a phone's passkey through the QR code (hybrid transport), on iPhone and on Android. The software authenticator cannot prove this.
- **The session lifetime:** 400 days, renewed at most once a week. It ends only by « Se déconnecter » or by removing the key it was opened with. This is the ACCT-02 « reste connecté » reading (T-04-33 accepted).
- **Deploy notes:** nothing new. This plan uses TOC_PEPPER and migration 0002 from 04-01, with no new secret, var or migration. No remote wrangler command ran.

## Self-Check: PASSED

- The key files exist: challenge.ts, login.ts, passkeys.ts, login.test.ts, passkeys.test.ts and csrf.test.ts.
- Commits 3f8e792, efd0786, 6d2c682 and 4d16273 are ancestors of HEAD.
- `git rev-list --count 3961afb..HEAD` = 4 before this summary's commit, and 5 with it.
