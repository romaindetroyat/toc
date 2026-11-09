---
phase: 04-comptes-amis-et-application-installable
plan: 01
subsystem: auth
tags: [accounts, passkeys, simplewebauthn, d1, session-cookie, invitation, backup-code, svelte, playwright]

requires:
  - phase: 02-jouer-en-ligne-entre-proches
    provides: "The Worker router (handleRequest), the D1 binding DB and migration 0001, the workerd test harness, the online Playwright config, the home layouts, Notice, ConfirmDialog, toast"
provides:
  - "The six packages Romain approved, at exact pins"
  - "D1 migration 0002: the whole account schema of the phase (users, passkeys, sessions, challenges, invitations, friendships, push_subscriptions, table_members), no e-mail"
  - "@toc/protocol account.ts: normalizePseudo, pseudoKey, the Crockford backup code, isInvitationCode, deviceLabel, strict bodies and answer parsers of the account API"
  - "Worker: GET /api/invitations/:code, POST /api/auth/signup/options and /verify, GET /api/me, POST /api/test/invitation (test mode), x-toc-d1 meter (test mode)"
  - "auth/session.ts (HttpOnly cookie, SHA-256 key in D1, sessionUser), auth/backup.ts (HMAC under TOC_PEPPER, timingSafeEqual), auth/webauthn.ts (rpFor from vars RP_ID / ORIGIN)"
  - "Web: #/invitation/<code> (pseudo step, passkey, « Ton code de secours »), the account store and its toc.me.v1 cache, the home tile « Mon compte »"
  - "e2e-online/comptes.ts: mintInvitation, uniquePseudo, passkeyContext, signUp; TEST_PEPPER / TEST_BOOTSTRAP (test-only)"
affects: [04-02, 04-03, 04-04, 04-05, 04-06, 04-07, 04-08, 04-09, 04-10, 04-11, 04-12]

actuals:
  tokens: 44000
  tasks: 2
  commits: 3
plan_head_before: eae78959cfc28cdfab5a73c3bdd1eed18cf85b7e
plan_head_after: a1740aea749ae220d4a9cf2b6df774dec616d900

tech-stack:
  added:
    - "@simplewebauthn/server 14.0.3 (apps/worker)"
    - "@block65/webcrypto-web-push 2.0.0 (apps/worker, unused until 04-07)"
    - "@simplewebauthn/browser 14.0.0 (apps/web)"
    - "vite-plugin-pwa 2.0.0, workbox-precaching 7.4.1, workbox-window 7.4.1 (apps/web dev, unused until 04-08)"
  patterns:
    - "Account routes: writeAllowed (non-null Origin equal to the Worker's) then readJson (415 / 413 / 400) on every POST"
    - "One Meter per request around D1; x-toc-d1 on every /api answer in test mode"
    - "Single-use claim by guarded UPDATE / INSERT ... WHERE NOT EXISTS checked with meta.changes, then one D1 batch; the claim is released when the batch fails"
    - "The passkey ceremony behind a Ceremonies seam, so the page's rules run in Node"

key-files:
  created:
    - apps/worker/migrations/0002_accounts.sql
    - packages/protocol/src/account.ts
    - apps/worker/src/http.ts
    - apps/worker/src/db.ts
    - apps/worker/src/me.ts
    - apps/worker/src/auth/webauthn.ts
    - apps/worker/src/auth/session.ts
    - apps/worker/src/auth/backup.ts
    - apps/worker/src/auth/signup.ts
    - apps/worker/test/authenticator.ts
    - apps/worker/test/signup.test.ts
    - apps/web/src/account/api.ts
    - apps/web/src/account/webauthn.ts
    - apps/web/src/account/cache.ts
    - apps/web/src/account/store.svelte.ts
    - apps/web/src/routes/Invitation.svelte
    - apps/web/src/ui/PseudoForm.svelte
    - apps/web/src/ui/BackupCodeScreen.svelte
    - apps/web/src/ui/SmallTile.svelte
    - apps/web/src/i18n/fr/compte.ts
    - apps/web/e2e-online/comptes.ts
    - apps/web/e2e-online/compte.spec.ts
  modified:
    - wrangler.jsonc
    - wrangler.embarque.jsonc
    - tools/wrangler-configs.test.ts
    - apps/worker/src/index.ts
    - apps/worker/vitest.config.ts
    - apps/worker/worker-configuration.d.ts
    - apps/worker/test/helpers.ts
    - apps/worker/test/env.d.ts
    - apps/web/src/App.svelte
    - apps/web/src/routes/Home.svelte
    - apps/web/playwright.online.config.ts
    - tools/copy-vendor-assets.mjs
    - apps/web/src/ui/icons.ts

key-decisions:
  - "invitations.inviter_id is nullable: the test-mode invitations have no inviter (the plan's « no inviter »); every real invitation (04-05) has one"
  - "The pending sign-up lives in challenges.pending, read back with DELETE ... RETURNING (single use and data in one statement)"
  - "Sign-up verify answers 201; verify's 409 is reported to the page as « taken-meanwhile » (its own UI-SPEC copy)"
  - "The session cookie's token is checked for the 43-character base64url shape before any D1 read"
  - "On a fine pointer the pseudo field keeps the autofocus; the step's h1 takes the focus otherwise; headings focused programmatically show no ring"
  - "The backup-code screen's phone columns are at most 384 px (UI-SPEC 360), so the code holds on one line at 844 × 390"

patterns-established:
  - "Test-only secrets: fixed values in apps/worker/vitest.config.ts (workerd) and e2e-online/comptes.ts (wrangler dev --var), never in a wrangler file (config test)"
  - "Local D1 migrations applied by the online webServer command (--local only)"

requirements-completed: [ACCT-01, ACCT-02]

coverage:
  - id: D1
    description: "Six approved packages at exact pins, no install script"
    verification:
      - kind: other
        ref: "Task 1 verify (node one-liner + pnpm install --frozen-lockfile + typecheck + lint)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sign-up by invitation: pseudo, passkey, backup code once, friendship with the inviter, session cookie"
    requirement: ACCT-01
    verification:
      - kind: integration
        ref: "apps/worker/test/signup.test.ts (23 cases, workerd + D1)"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e-online/compte.spec.ts (phone + desktop)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Still signed in after a reload and on a new page (HttpOnly cookie, GET /api/me)"
    requirement: ACCT-02
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/compte.spec.ts#créer son compte par une invitation, et le garder après un rechargement"
        status: pass
    human_judgment: false
  - id: D4
    description: "A passkey on a real iPhone / Android / computer at toc.romaindetroyat.workers.dev"
    verification: []
    human_judgment: true
    rationale: "Playwright's virtual authenticator replaces the platform dialog; the real system dialogs and iCloud / Google sync need a device (04-12 UAT)"

duration: 42min
completed: 2026-10-18
status: complete
---

# Phase 4 Plan 01: the first account end to end Summary

**A proche opens `#/invitation/<code>`, chooses a pseudo and creates a passkey (SimpleWebAuthn 14). They see « Ton code de secours » once, as an HMAC-only secret, then land on the home with « Mon compte », and an HttpOnly session cookie keeps them signed in. The migration, the shared rules, the Worker routes, the browser ceremony and the home tile all ship in one slice.**

## Performance

- **Duration:** about 42 min (05:17 to 05:59 UTC)
- **Started:** 2026-10-18T05:17:20Z
- **Completed:** 2026-10-18T05:58:55Z
- **Tasks:** 2
- **Files modified:** 43 (including the lockfile and two generated files)

## Package legitimacy

Romain approved the six packages on 2026-10-18 through AskUserQuestion (04-CONTEXT addendum). This was the phase's package-legitimacy gate:

- Question: « Pour les comptes, les notifications et l'application installable, j'ai besoin d'ajouter 6 outils libres… Tu valides leur installation ? »
- Answer: « Oui, les 6 (Recommandé) »

I checked each package on the registry before installing it:

| Package | Pin | Repository | Install scripts |
|---------|-----|------------|-----------------|
| @simplewebauthn/server | 14.0.3 | github.com/MasterKale/SimpleWebAuthn | none |
| @block65/webcrypto-web-push | 2.0.0 | github.com/block65/webcrypto-web-push | none (only dev/test/preversion) |
| @simplewebauthn/browser | 14.0.0 | github.com/MasterKale/SimpleWebAuthn | none |
| vite-plugin-pwa | 2.0.0 | github.com/vite-pwa/vite-plugin-pwa | none (build/dev scripts only) |
| workbox-precaching | 7.4.1 | github.com/googlechrome/workbox | none |
| workbox-window | 7.4.1 | github.com/googlechrome/workbox | none |

- The transitive packages of @simplewebauthn/server are @peculiar/x509 2.2.0, @peculiar/asn1-* 2.11.0, @peculiar/utils, @hexagon/base64 1.1.28, @levischuck/tiny-cbor 0.2.11 and reflect-metadata 0.2.2. The push library brings uint8array-extras 1.6.0.
- None of the new packages, direct or transitive, has an install script. The only install scripts in the store are esbuild's and workerd's, which were already in the repository.
- pnpm reported no « ignored builds » for the new packages.
- vite and vitest stay on 8.3.4 and 4.1.11. The lockfile only gained terser in vite's peer context, from workbox-build.
- better-auth, Drizzle, Hono and Resend are not installed (04-RESEARCH option B, D-01).

## Accomplishments

- **D1 migration `0002_accounts.sql`**: the phase's eight account tables, keeping the three additions the plan asked for (`invitations.id`, `sessions.passkey_id` with cascade, `push_subscriptions.session_hash` with cascade). No column holds an e-mail address; « e-mail » appears once, in the header line that says so.
- **Shared rules** (`@toc/protocol` account.ts):
  - Pseudos: NFC, hidden and bidi characters removed, 2 to 20 Latin letters with their accents, plus digits, space and `' ’ . _ -`.
  - `pseudoKey` ignores case and accents. Its idempotence is checked with fast-check.
  - The backup code is 20 Crockford symbols (100 bits), shown as five groups of four.
  - The module also holds the strict, length-capped bodies and the answer parsers.
- **Worker routes**:
  - Invitation states (ok, used, expired, unknown). The bootstrap code is valid only while `users` is empty and is compared in constant time.
  - Sign-up options: the Origin check comes first, then 415, 413 and 400 for a bad body, then the invitation is checked before the « pseudo taken » answer. They answer with a resident-key passkey request and a 5-minute challenge row.
  - Sign-up verify:
    - The challenge row is deleted with `RETURNING` (single use), then SimpleWebAuthn checks the answer.
    - The invitation is claimed by a guarded UPDATE, or the bootstrap user row by a guarded INSERT.
    - One batch then writes the user, the passkey (`rp_id`, device label), both friendship rows, `used_by` and the session.
    - Losing the race for a pseudo releases the claim and answers 409.
  - `GET /api/me` answers 200 or 401, and expires a dead cookie.
- **Session**:
  - The cookie is `__Host-toc_session`: HttpOnly, Secure, SameSite=Lax, Path=/, valid 400 days. Only test mode over http uses `toc_session` without Secure.
  - D1 keeps only the SHA-256 of the token.
  - The workerd test scans every account row for the backup code, the token and the pepper.
- **Web**:
  - `#/invitation/<code>` covers the loading, unknown, used, expired, offline and unsupported cases, the pseudo step and the code screen. « J’ai gardé mon code » opens a confirmation whose focused safe answer is « Revoir mon code ».
  - After the sign-up: the home with the welcome toast and the « Mon compte » tile, which survives a reload and opening a new page.
  - The guest home is unchanged.

## D1 cost of a sign-up (x-toc-d1, workerd, logged by signup.test.ts)

| Sign-up | options call | verify call | Total rows written |
|---------|--------------|-------------|--------------------|
| By invitation, with an inviter | w=2; r=3 | w=15; r=4 | **17** |
| Bootstrap (first account) | w=2; r=2 | w=12; r=5 | **14** |

Against the Free plan's 100 000 rows written per day, that is about 5 800 sign-ups a day. GET /api/me costs 2 reads and writes nothing.

## Worker bundle (local dry run, no upload)

These steps ran locally only: `pnpm --filter @toc/web build && node tools/build-embedded-worker.mjs`, then `wrangler deploy --dry-run --outdir .wrangler/dry -c wrangler.embarque.jsonc`.

- **Bundle size:** the entry `index.js` is 961 951 B (188 994 B gzip). The whole upload is 2 991.17 KiB (1 356.72 KiB gzip), including 39 embedded web files.
- **Bindings listed:** GAME_ROOM, DB, RP_ID and ORIGIN.
- **check-bundle:** `node tools/check-bundle.mjs .wrangler/dry` passes: « bundle OK: 39 separate modules, all from the web build; the rest is inlined ».

## Task Commits

1. **Task 1: the six approved packages at exact versions**: `1aaf32c` (chore)
2. **Task 2 RED: sign-up, session, account rules, configs, web logic, e2e**: `2ee877c` (test)
3. **Task 2 GREEN: the first account end to end**: `a1740ae` (feat)

## Gate (at a1740ae)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | 0 errors (web: 523 files) |
| `pnpm lint` | Biome, 305 files, clean |
| `pnpm test` | Vitest 90 files, **1 396 passed, 2 skipped** (the same 2 engine skips as before) |
| Full local Playwright | **455 passed, 99 skipped, 0 failed** (6.7 min), the same as 02-10b |
| Full online Playwright | **54 passed, 0 failed** (6.6 min): the 48 of 02-10b plus compte.spec × 2 projects × 3 tests |
| Port 8787 / 4173 after the runs | closed (checked by connecting, since `ss` is absent from the container) |

## Screenshots (looked at)

All in `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/`:
- `04-01-invitation-844x390.png`, `04-01-invitation-1280x800.png`: the pseudo step. The second was retaken after the focus fix, so the field holds the focus.
- `04-01-pseudo-error-844x390.png`, `04-01-pseudo-error-1280x800.png`: « Ton pseudo doit avoir au moins 2 caractères. ».
- `04-01-code-844x390.png` (retaken: the code on one line), `04-01-code-1280x800.png`, `04-01-code-750x342.png` (the code wraps to two lines).
- `04-01-confirm-844x390.png`, `04-01-confirm-1280x800.png`: « Tu as bien gardé ton code ? ».
- `04-01-home-844x390.png`, `04-01-home-1280x800.png`: the « Mon compte » tile and the welcome toast.
- `04-01-used-844x390.png`, `04-01-used-1280x800.png`: « Cette invitation a déjà servi ».

## Decisions Made

See `key-decisions` above. The main ones:
- **Nullable `inviter_id`:** needed for the test-only invitation the plan describes.
- **Pending sign-up:** read back from the challenge row in one `DELETE … RETURNING`.
- **Verify's 409:** reported to the page as « taken-meanwhile », which has its own copy in the UI-SPEC.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The Worker cannot import zod (pnpm strict layout)**
- **Found during:** Task 2 GREEN
- **Issue:** I first validated the pending sign-up and the test-mint body with `zod/mini` inside apps/worker, which does not depend on zod.
- **Fix:** I moved the mint body schema to `@toc/protocol` (`TestInvitationBody`). The pending record, which is the server's own JSON, is now checked by hand (`readPending`). No dependency was added.
- **Commit:** a1740ae

**2. [Rule 3 - Blocking] `crypto` is untyped in @toc/protocol**
- **Issue:** The package's lib is plain ES, so `newBackupCode`'s default source did not typecheck.
- **Fix:** A module-scoped `declare const crypto: { getRandomValues… }`, with a comment. Every runtime the package runs on has Web Crypto.
- **Commit:** a1740ae

**3. [Rule 1 - Bug] The step's h1 stole the field's autofocus and showed the amber ring**
- **Found during:** Task 2, screenshot review
- **Fix:** On a fine pointer the field keeps the focus, and the h1 takes it otherwise. A programmatically focused h1 shows no ring, since it is not a control.
- **Files:** Invitation.svelte, BackupCodeScreen.svelte
- **Commit:** a1740ae

**4. [Rule 1 - Bug] The backup code wrapped at 844 × 390**
- **Issue:** The UI-SPEC's 312.3 px measure omits the 0.06em letter-spacing, about 29 px.
- **Fix:** The phone's two columns go up to 384 px instead of 360. 784 px plus the gutters fits 844.
- **Remaining case:** at 750 × 342 the columns are 347 px and the code wraps to two lines, between groups, as the contract allows at 640.
- **Commit:** a1740ae

**5. [Additive] `account/cache.ts` + `cache.test.ts`**
- **Issue:** The cached account (toc.me.v1) is pure logic, but the runes store cannot be imported by the Node tests.
- **Fix:** I moved that logic to its own module, with its test. Neither file is in `files_modified`.
- **Commit:** 2ee877c, a1740ae

**6. [Plan detail] `credentials.install` in compte.spec.ts**
- **Issue:** The acceptance grep looks for it in the spec itself.
- **Fix:** The main test now creates its context inline, and the helper `passkeyContext` is used by the other two tests.

**Total deviations:** 4 auto-fixed (2 blocking, 2 bugs) and 2 plan-detail adjustments. No scope creep.

## Known Stubs (intentional, resolved by later plans of this phase)

| What | Where | Why / when |
|------|-------|------------|
| The « Mon compte » tile links to `#/compte`, which falls back to the home | apps/web/src/routes/Home.svelte | The page comes in 04-10 (the plan says so) |
| « Cette invitation a déjà servi » has no « Se connecter » button, and the pseudo step has no « J’ai déjà un compte » | Invitation.svelte | Signing in comes in 04-02 |
| The signed-in cases of an invitation (« Ajouter {Inviteur} à tes amis ? ») are not handled | Invitation.svelte | 04-05 |
| No leave guard on the code screen (beforeunload, hash guard) | BackupCodeScreen.svelte | 04-09 (the plan says so) |

None of these blocks this plan's goal: sign up, keep the code, stay signed in.

## Issues Encountered

- Under the local `vite preview`, `/api/me` goes through the preview's `/api` proxy to a missing Worker. The preview logs ECONNREFUSED and answers an error. `me()` then reads « offline » and the guest home stays unchanged, so all 455 local tests pass. Only the log is noisy.
- `ss` is not installed in the container, so port checks were done by connecting to the port. The two earlier `ss … || echo free` checks proved nothing; every check after them used `/dev/tcp`.

## Threat Flags

None beyond the plan's register. The new endpoints are the ones in T-04-20 to T-04-27:
- `POST /api/test/invitation` exists only under `TOC_TEST_MODE`, and the test proves a 404 without it.
- `x-toc-d1` is sent only in test mode, and the test proves it is absent otherwise.

## To confirm with Romain

- The pseudo rules (« Élodie » = « elodie »; Latin letters and accents only): UI-SPEC « à confirmer ».
- At deploy (04-12, the orchestrator's step), three things are needed:
  - `wrangler secret put TOC_PEPPER`: 32 random bytes.
  - `wrangler secret put TOC_BOOTSTRAP`: 22 base64url characters. Romain's first account comes from `https://toc.romaindetroyat.workers.dev/#/invitation/<that code>`.
  - `wrangler d1 migrations apply toc --remote` for 0002.

  None of these ran here.

## Self-Check: PASSED

- The key files exist: 0002_accounts.sql, account.ts, signup.ts, session.ts, backup.ts, Invitation.svelte, compte.spec.ts, comptes.ts.
- Commits 1aaf32c, 2ee877c and a1740ae are ancestors of HEAD (`git rev-list --count eae7895..HEAD` = 3).
