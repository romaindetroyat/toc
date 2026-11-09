---
phase: 04-comptes-amis-et-application-installable
plan: 03
subsystem: auth
tags: [accounts, recovery, backup-code, durable-objects, player-hub, lockout, rate-limit, migration-v2, d1]

requires:
  - phase: 04-comptes-amis-et-application-installable
    provides: "04-01: users.backup_mac (HMAC under TOC_PEPPER), auth/backup.ts (macOf, sameMac), auth/session.ts, auth/webauthn.ts, the software authenticator; 04-02: auth/challenge.ts (stored challenges, the sweep), the 405/Origin/JSON pattern and csrf.test.ts"
provides:
  - "PlayerHub, the SQLite Durable Object of each account (PLAYER_HUB.getByName(userId)), migration v2 in both wrangler configs"
  - "PlayerHub.checkBackupCode({ expected, given, now? }): 5 wrong codes lock 15 minutes, then 30, 60… up to 24 hours; a success resets; no MAC kept"
  - "PlayerHub.allow({ kind, max, windowMs, now? }): sliding-window rate limits per kind, for 04-05 (friend codes) and later plans"
  - "POST /api/auth/recover { pseudo, code } and POST /api/auth/recover/verify { response }"
  - "auth/challenge.ts takeBoundChallenge (a stored challenge taken without a session, returning its account)"
  - "auth/passkeys.ts keysOf exported"
  - "protocol: RecoverBody, RecoverVerifyBody, RecoverAnswer / parseRecoverAnswer, RecoverRefusal / parseRecoverRefusal"
  - "web account client: recover(pseudo, code) and recoverVerify(optionsJSON) with their reasons"
  - "tools/check-bundle.mjs requires both Durable Object classes in the dry-run entry"
affects: [04-05, 04-06, 04-07, 04-09, 04-12]

estimate:
  tokens: 120000
  tasks: 2
actuals:
  tokens: 17000
  tasks: 2
  commits: 5
plan_head_before: a825e399a01256afce8144d79e396eff5c98b583
plan_head_after: 180479a01d7fd26cff015a7078afc967c7d25610

tech-stack:
  added: []
  patterns:
    - "A per-account Durable Object reached only by RPC from the Worker, its times passed by the caller and compared on each call (no timer, no alarm)"
    - "A guarded D1 batch: the first statement's guarded UPDATE writes a fresh value, and every later statement runs only WHERE EXISTS that value, so the batch is all or nothing on a lost race"
    - "Equal work for an unknown pseudo: the same D1 lookup and the same HMAC, under an id no account can have, without naming any Durable Object"

key-files:
  created:
    - apps/worker/src/PlayerHub.ts
    - apps/worker/src/auth/recover.ts
    - apps/worker/test/hub.test.ts
    - apps/worker/test/recover.test.ts
  modified:
    - wrangler.jsonc
    - wrangler.embarque.jsonc
    - tools/wrangler-configs.test.ts
    - tools/check-bundle.mjs
    - worker-embedded/index.js
    - apps/worker/worker-configuration.d.ts
    - apps/worker/src/index.ts
    - apps/worker/src/auth/challenge.ts
    - apps/worker/src/auth/passkeys.ts
    - apps/worker/test/csrf.test.ts
    - packages/protocol/src/account.ts
    - packages/protocol/src/account.test.ts
    - apps/web/src/account/api.ts
    - apps/web/src/account/api.test.ts

key-decisions:
  - "After a lock has been served, the very next wrong code locks again (twice as long); the count of five applies only from a clean state, as the plan's behaviour list says"
  - "A recovery leaves the lost device's passkey in place; the toast of step 3 asks the player to remove it in « Clés d’accès » (UI-SPEC), and every session is already ended"
  - "The recovery's verify answers 200 (sign-up answers 201) with { me, backupCode }; me lists every passkey of the account with the new one current"
  - "429 locked carries Retry-After in seconds next to { error, until }"

patterns-established:
  - "Every new Durable Object class goes in DURABLE_OBJECTS of tools/check-bundle.mjs and in the exact-block test of tools/wrangler-configs.test.ts, in both configs"

requirements-completed: [ACCT-01]

coverage:
  - id: D1
    description: "PlayerHub declared identically in both configs with migration v2 after an untouched v1; the dry-run bundle defines both classes"
    verification:
      - kind: unit
        ref: "tools/wrangler-configs.test.ts"
        status: pass
      - kind: integration
        ref: "wrangler deploy --dry-run -c wrangler.embarque.jsonc + node tools/check-bundle.mjs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Backup-code lockout (5 → 15 min, doubling to 24 h, success resets) and sliding-window limits, no MAC kept, no alarm"
    verification:
      - kind: integration
        ref: "apps/worker/test/hub.test.ts (workerd, real SQLite)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Recovery on a new device: new passkey, every other session ended (push subscriptions by cascade), new session, new code; the old code wrong, the new one right"
    requirement: ACCT-01
    verification:
      - kind: integration
        ref: "apps/worker/test/recover.test.ts#POST /api/auth/recover/verify"
        status: pass
    human_judgment: false
  - id: D4
    description: "A wrong pseudo and a wrong code answered alike; an unknown pseudo reaches no hub; failed attempts write no D1 row"
    verification:
      - kind: integration
        ref: "apps/worker/test/recover.test.ts#POST /api/auth/recover"
        status: pass
    human_judgment: false
  - id: D5
    description: "The code is spent only when the passkey is saved: an expired challenge, a refused passkey or a code changed meanwhile spend nothing"
    verification:
      - kind: integration
        ref: "apps/worker/test/recover.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "The « Retrouver mon compte » screen on real phones (step 1 to 3)"
    verification: []
    human_judgment: true
    rationale: "The screen comes in 04-09/04-10; the real passkey dialog needs real devices (04-12 UAT)"

duration: about 32 min
completed: 2026-10-18
status: complete
---

# Phase 4 Plan 03: Un Durable Object par compte (migration v2), et retrouver son compte avec le code de secours Summary

**Paul lost his phone. On a new device he types his pseudo and his backup code, creates a passkey there and gets his account back. His old phone and every other device are signed out, and he gets a new code, shown once. The check runs in the account's own Durable Object, PlayerHub (migration v2, identical in both deploy configs; v1 untouched). After 5 wrong codes the account locks for 15 minutes, then 30, 60… up to 24 hours. A wrong pseudo and a wrong code get the same answer, and a failed attempt writes nothing to D1.**

## Performance

- **Duration:** about 32 min (06:53 to 07:25 UTC), including the full gate. The two Playwright suites took 7.0 and 7.1 min.
- **Started:** 2026-10-18T06:53:17Z
- **Completed:** 2026-10-18T07:25Z
- **Tasks:** 2
- **Files modified:** 18 (4 created, 14 modified)

## Accomplishments

- **PlayerHub** (`apps/worker/src/PlayerHub.ts`), one SQLite Durable Object per account (`PLAYER_HUB.getByName(userId)`):
  - `checkBackupCode({ expected, given, now? })` compares two MACs with `sameMac` (constant time) and keeps neither.
    - 5 wrong codes in a row lock the account until `now + 15 min`.
    - Once a lock has been served, each further wrong code locks it again for twice as long: 30 min, 1 h, 2 h… capped at 24 h.
    - While locked, even the right code gets `{ ok: false, reason: "locked", until }`.
    - A right code resets the count and the ladder.
  - `allow({ kind, max, windowMs, now? })`: true and counted for the first `max` calls inside the window, then false (not counted) until the oldest leaves it. Kinds are independent, and old entries are pruned. 04-05 uses it for friend codes.
  - Tables `attempts` and `limits` are created on first use. There is no timer function and no alarm: times are compared on each call (hub.test.ts checks `getAlarm()` is null).
  - Exported constants: `BACKUP_FAILURES` 5, `BACKUP_LOCK_MS` 15 min, `BACKUP_LOCK_MAX_MS` 24 h.
- **Configs**: both wrangler files now declare `[{ GAME_ROOM, GameRoom }, { PLAYER_HUB, PlayerHub }]` and `[{ tag v1, new_sqlite_classes [GameRoom] }, { tag v2, new_sqlite_classes [PlayerHub] }]`. The v1 object is unchanged, still the first, with the same text (`{ "tag": "v1", "new_sqlite_classes": ["GameRoom"] }`, asserted by the config test).
- **Bundle check**: `tools/check-bundle.mjs` requires every class of `DURABLE_OBJECTS` (GameRoom, PlayerHub) in the dry-run `index.js`, with one message per missing class.
- **Recovery** (`apps/worker/src/auth/recover.ts`):
  - `POST /api/auth/recover { pseudo, code }`:
    - A code that is not 20 symbols once read back → 400 `format`, without a D1 read.
    - Otherwise the pseudo is looked up (an invalid pseudo under a key no account has) and the code is MACed (under a fixed id no account can have when the pseudo is unknown).
    - Unknown pseudo → 400 `wrong`, without naming any Durable Object.
    - Known pseudo → its hub checks the code: wrong → 400 `wrong` (same status and body), locked → 429 `{ error: "locked", until }` with `Retry-After`.
    - Right code → 200 creation options for the account (its WebAuthn handle, `excludeCredentials` = its passkeys) and a stored `recover` challenge bound to the account, holding the MAC of the code given (never the code).
  - `POST /api/auth/recover/verify { response }`:
    - Takes the challenge (single use, `takeBoundChallenge`) and re-reads `users.backup_mac`, which must still equal the challenge's MAC (else 400 `expired`). Then SimpleWebAuthn verifies the registration (400 `refused`).
    - One guarded batch: (1) the new MAC replaces the old one only while the old one is still there; (2) the new passkey, (3) every session of the account deleted, (4) this device's session, all three only `WHERE EXISTS` the new MAC. So a lost race changes nothing and answers `expired`.
    - Answers 200 `{ me, backupCode }` with the Set-Cookie. `me` lists every passkey, with the new one current, so the lost phone's key can be removed in « Clés d’accès ».
- **Protocol**: `RecoverBody` (strict, pseudo ≤ 200, code ≤ 100), `RecoverVerifyBody`, `RecoverAnswer` / `parseRecoverAnswer`, `RecoverRefusal` / `parseRecoverRefusal` (format, wrong, locked with `until`).
- **Web client** (`apps/web/src/account/api.ts`):
  - `recover(pseudo, code)` → `{ ok, optionsJSON }` or `format` (also client-side, without a request), `wrong`, `locked` with `until`, `offline`, `server`.
  - `recoverVerify(optionsJSON)` → `{ ok, me, backupCode }` or `cancelled`, `expired`, `wrong-address`, `already-here`, `unsupported`, `offline`, `server`.

## D1 rows written (x-toc-d1, workerd, logged by recover.test.ts)

| Call | x-toc-d1 | Rows written |
|------|----------|--------------|
| Recover: code of the wrong format | w=0; r=0 | **0** (no D1 read either) |
| Recover: unknown pseudo, invalid pseudo, wrong code | w=0 | **0** |
| Recover: account locked (even the right code) | w=0 | **0** |
| Recover: right code (options) | w=2; r=4 | **2** (the challenge row and its index) |
| Recover verify (the account had 2 sessions, each with a push subscription) | w=12; r=23 | **12** |

What the verify's 12 rows are: the challenge deleted, the users row (new MAC), the new passkey, the 2 old sessions deleted, their 2 push subscriptions deleted by cascade, and the new session. Index entries count as rows written. Each further session or push subscription of the account adds its rows.

**A failed attempt writes nothing to D1.** It writes one row in the account's own hub SQLite, the attempts counter: only for a real account's wrong code, and nothing at all while it is locked. A whole recovery costs about 14 rows plus 2 per extra old session.

## Dry run of the embedded deploy (local, no deploy)

`pnpm --filter @toc/web build && node tools/build-embedded-worker.mjs && pnpm exec wrangler deploy --dry-run --outdir .wrangler/dry -c wrangler.embarque.jsonc && node tools/check-bundle.mjs .wrangler/dry`:

| Binding | Resource |
|---------|----------|
| env.GAME_ROOM (GameRoom) | Durable Object |
| env.PLAYER_HUB (PlayerHub) | Durable Object |
| env.DB (toc) | D1 Database |
| env.RP_ID ("toc.romaindetroyat.workers.dev") | Environment Variable |
| env.ORIGIN ("https://toc.romaindetroyat.workers.dev") | Environment Variable |

There is no TOC_TEST_MODE. check-bundle reports « bundle OK: 39 separate modules, all from the web build; the rest is inlined ».

## Task Commits

1. **Task 1 RED: PlayerHub counts backup-code tries and rate limits, migration v2 in both configs**: `26b5ace` (test)
2. **Task 1 GREEN: PlayerHub, one Durable Object per account with migration v2**: `4ec9f9f` (feat)
3. **Task 2 RED: recover the account with the pseudo and the backup code on a new device**: `ed2bfa4` (test)
4. **Task 2 GREEN: recover the account with the pseudo and the backup code on a new device**: `180479a` (feat)

## Gate (at 180479a, one suite at a time)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | 0 errors (web: 523 files) |
| `pnpm lint` | Biome, 315 files, clean |
| `pnpm test` | Vitest 95 files, **1 497 passed, 2 skipped** (the same 2 engine skips) |
| hub + recover + csrf (workerd) | worker project 17 files, 122 passed |
| Full local Playwright | **455 passed, 99 skipped, 0 failed** (7.0 min), unchanged from 04-02 |
| Full online Playwright | **54 passed, 0 failed** (7.1 min), unchanged from 04-02; wrangler dev ran with migration v2 |
| Ports 8787 / 4173 before and after each run | free (checked by connecting) |
| Leftover wrangler / workerd / vite / playwright / browser processes | none, before and after |

## Screenshots

None. This plan adds no screen: « Retrouver mon compte » (`#/secours`) uses these calls in 04-09/04-10.

## Decisions Made

See `key-decisions` above. The one the screen will show: **after a lock, a single wrong code locks again**, for twice as long. The UI's « Trop d’essais. Réessaie dans {durée}. » gets its duration from `until`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] check-bundle missed PlayerHub in the real dry run**
- **Found during:** Task 1 GREEN (the local dry run)
- **Issue:** esbuild renames the base class for the second module that imports it: `var PlayerHub = class extends DurableObject2`. The GameRoom-style pattern (`extends DurableObject\b`) reported « index.js does not define the PlayerHub class » on a good bundle.
- **Fix:** the pattern now accepts `DurableObject\d*`, with fixture cases for `DurableObject2` (passes) and `DurableObjectish` (refused).
- **Files modified:** tools/check-bundle.mjs, tools/wrangler-configs.test.ts
- **Commit:** 4ec9f9f

### Plan-detail adjustments (no scope change)

**1. Files touched beyond `files_modified`**
- `apps/worker/src/auth/challenge.ts` gains `takeBoundChallenge`. The recovery's verify has no session to name the account, so the challenge row is taken by challenge and purpose and returns its `user_id`.
- `apps/worker/src/auth/passkeys.ts` exports `keysOf`, for the recovery's `excludeCredentials`.
- `apps/worker/test/csrf.test.ts` lists both recovery routes in WRITES (the 04-02 pattern): 403 without our Origin, 415 without JSON, 405 to a GET, D1 unchanged.

**2. « The same number of hub calls » (Task 2 fails_when)**
- The behaviour list, the action and threat T-04-35 all say an unknown pseudo touches no PlayerHub (Pitfall 9). That is what is built and tested: an unknown or invalid pseudo makes 0 hub calls, and a real account's wrong code makes 1, to its own hub.
- So literally the counts differ (0 against 1). What is equal for both: the status (400), the body (`{"error":"wrong"}`), one D1 lookup, one HMAC, and no D1 write.
- The residual is the latency of one Durable Object round trip. A patient attacker could use it to tell a real pseudo from an unknown one. See « To confirm with Romain ».

**3. Extra checks the plan did not ask for**
- `Retry-After` on 429.
- A refused passkey (another origin) spends nothing.
- Another account's challenge recovers only that account.

**Total deviations:** 1 auto-fix, 3 plan-detail notes.

## Known Stubs

None. The routes, the hub and the client calls are wired end to end in the tests. The screen comes in 04-09/04-10.

## Issues Encountered

- The local Playwright run logs « http proxy error: /api/me … ECONNREFUSED 127.0.0.1:8787 », as in 04-01 and 04-02. The local preview has no Worker behind `/api`. It is noise, not a failure.
- `wrangler deploy --dry-run` tried to reach `sparrow.cloudflare.com` (telemetry). The proxy refused it, with no effect on the dry run.

## Threat Flags

None beyond the plan's register (T-04-34 to T-04-38). The two new endpoints are listed there, and csrf.test.ts covers both.

## To confirm with Romain

- **Telling pseudos apart by timing.**
  - A wrong code for a real pseudo costs one extra hop to that account's hub. An unknown pseudo does not, because the plan forbids creating hubs for random pseudos (Pitfall 9).
  - The answers are identical, but someone measuring response times many times could guess whether a pseudo exists. Pseudos are already visible to friends, so the plan accepts this.
  - If Romain wants it closed, an unknown pseudo could make one call to a single fixed « decoy » hub that counts nothing. It costs one Durable Object request per such attempt.
- **The lock ladder.** 5 tries, then 15 min. After that, every wrong code doubles the lock up to 24 hours, until one right code. A family member who mistypes their code five times waits 15 minutes.
- **Deploy notes:**
  - This plan adds Durable Object migration **v2** (`new_sqlite_classes: ["PlayerHub"]`), identical in both configs. It is applied automatically by the next `wrangler deploy -c wrangler.embarque.jsonc` (the orchestrator's end-of-phase deploy). It is permanent once deployed: renaming the class later needs a `renamed_classes` migration.
  - There is no new secret, var or D1 migration: it uses TOC_PEPPER and 0002 from 04-01. No remote wrangler command ran.
- **Real-device UAT** (04-12): a recovery on an iPhone and on an Android phone, with the old device then signed out.

## Self-Check: PASSED

- The key files exist: PlayerHub.ts, auth/recover.ts, hub.test.ts and recover.test.ts.
- Commits 26b5ace, 4ec9f9f, ed2bfa4 and 180479a are ancestors of HEAD.
- `git rev-list --count a825e39..HEAD` = 4 before this summary's commit, and 5 with it.
