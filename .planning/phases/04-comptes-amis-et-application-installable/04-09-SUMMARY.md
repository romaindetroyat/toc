---
phase: 04-comptes-amis-et-application-installable
plan: 09
subsystem: web-accounts
tags: [accounts, passkeys, webauthn, invitation, recovery, backup-code, home, svelte]

requires:
  - phase: 04-comptes-amis-et-application-installable
    provides: "04-01 to 04-05: the account client (signUp, invitationState with own and friend, acceptInvitation, logIn, recover, recoverVerify, myTables, forgetMyTable), the account store and toc.me.v1, SmallTile, PseudoForm, BackupCodeScreen; 04-04: mergeTables, visibleTables, account-tagged entries; 04-08: HomeStrip, holdUpdates, canPromptUpdate"
provides:
  - "account/flow.ts (pure): homeTiles, signInLine, signInToast, invitationRow, dateText, pseudoError, prefill, lockText, formatCodeInput, recoverError, recoverKeyError"
  - "ui/SignInSheet.svelte (data-signin-sheet, data-signin-use, data-signin-line), mounted once by App.svelte; store.svelte.ts: signInSheet, openSignIn(opener, after), closeSignIn, sessionEnded"
  - "net/tables.ts: linkTables (a sign-in tags this device's guest entries with the account)"
  - "Home: the small-tile row (data-small-tile prenom | connexion | amis | compte) in every layout; TableList merged with GET /api/me/tables"
  - "routes/Invitation.svelte: every row (data-invitation loading | unknown | used | expired | unsupported | offline | add-friend | already-friend | own | ok)"
  - "ui/BackupCodeScreen.svelte: form signup | recovery | regeneration (data-backup-code={form}), beforeunload, the router's leave guard (ui/leaveGuard.ts)"
  - "routes/Recover.svelte at #/secours (data-recover-step 1 | 2 | 3, data-recover-error)"
  - "ui/stepIn.ts: the step change (200 ms, 12 px from the right; 150 ms fade reduced)"
  - "The server refuses a second account to a signed-in caller: signup options and verify answer 409 signed-in"
affects: [04-10, 04-11, 04-12]

estimate:
  tokens: 190000
  tasks: 3
actuals:
  tokens: 36950
  tasks: 3
  commits: 8
plan_head_before: 0d9fdf89d0774a9f4cde75bbfb7c25c1a6a834d8
plan_head_after: 52f88ab5293523566d14d4c1a676c2444ccb1862

tech-stack:
  added: []
  patterns:
    - "One app-wide sheet driven by the account store (openSignIn with the opener for the focus and an `after` callback for the page that opened it)"
    - "A 401 where the page believed it signed in ends the session once (sessionEnded); a 404 or HTML (no Worker) only clears"
    - "The router asks a leave guard first on each hash change; the guard undoes the change with pushState and opens its confirmation"
    - "The invitation page renders whatever invitationRow returns; the component only maps actions to calls"

key-files:
  created:
    - apps/web/src/account/flow.ts
    - apps/web/src/account/flow.test.ts
    - apps/web/src/ui/SignInSheet.svelte
    - apps/web/src/routes/Recover.svelte
    - apps/web/src/ui/leaveGuard.ts
    - apps/web/src/ui/stepIn.ts
    - apps/web/e2e-online/connexion.spec.ts
    - apps/web/e2e-online/invitation-compte.spec.ts
    - apps/web/e2e-online/secours.spec.ts
  modified:
    - apps/web/src/App.svelte
    - apps/web/src/routes/Home.svelte
    - apps/web/src/routes/Invitation.svelte
    - apps/web/src/ui/SmallTile.svelte
    - apps/web/src/ui/TableList.svelte
    - apps/web/src/ui/BackupCodeScreen.svelte
    - apps/web/src/ui/Notice.svelte
    - apps/web/src/ui/icons.ts
    - apps/web/src/account/store.svelte.ts
    - apps/web/src/account/api.ts
    - apps/web/src/account/api.test.ts
    - apps/web/src/net/tables.ts
    - apps/web/src/net/tables.test.ts
    - apps/web/src/i18n/fr/compte.ts
    - apps/web/src/i18n/fr/accueil.ts
    - apps/web/e2e-online/comptes.ts
    - apps/web/e2e-online/compte.spec.ts
    - apps/web/e2e-online/accueil.spec.ts
    - apps/web/e2e/accueil.spec.ts
    - apps/worker/src/auth/signup.ts
    - apps/worker/test/signup.test.ts
    - tools/copy-vendor-assets.mjs

key-decisions:
  - "A signed-in browser cannot sign up a second account: signup options and verify answer 409 signed-in (verify before the challenge is spent); the invitation page then reloads as signed in and shows « Ajouter {Inviteur} à tes amis ? »"
  - "Signing in (sheet or recovery) tags this device's guest entries with the account (linkTables); the sign-in toast says so when there were some"
  - "The backup-code guard lives in the router: App.svelte asks leaveBlocked() before following a hash change. A capture-phase listener did not reliably run before the router's"
  - "The session-ended toast shows only for a real 401 while a cached account existed, once per sign-in"
  - "Removing an account row from « Mes parties en cours » also forgets it for the account (DELETE /api/me/tables); « Remettre » puts it back on this device, tagged"
  - "An invitation with no inviter (the bootstrap, a test link) opened while signed in reads « Cette invitation n’existe pas »: the server refuses to accept it"
  - "A used link opened while signed in offers only « Retour à l’accueil » (no « Se connecter »)"

patterns-established:
  - "Every hand-made passkey context that reuses a copied key re-syncs it (copyPasskey) before its next use: the server refuses a counter that goes backwards"

requirements-completed: [ACCT-01, ACCT-02]

coverage:
  - id: D1
    description: "homeTiles, signInLine, signInToast, invitationRow, dateText, pseudoError, prefill, lockText, formatCodeInput, recoverError, recoverKeyError; linkTables"
    requirement: ACCT-01, ACCT-02
    verification:
      - kind: unit
        ref: "apps/web/src/account/flow.test.ts (18 tests), apps/web/src/net/tables.test.ts (linkTables)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A synced passkey signs in on a new device and finds the account's table; signed out, the account rows hide and come back; an unknown key; a 20-character pseudo in the small tile at 844 × 390, 480 × 320 and 1280 × 800"
    requirement: ACCT-02
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/connexion.spec.ts (3 tests × 2 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every invitation row, the signed-in rows, the taken pseudo, the prefill and seats line, « J’ai déjà un compte », the welcome naming the friend, a browser signed in meanwhile"
    requirement: ACCT-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/invitation-compte.spec.ts (5 tests × 2 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The code screen: the back button and a hash change keep it and ask; beforeunload; two columns at 844 × 390, one at 1280 × 800, the code on one line"
    requirement: ACCT-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/compte.spec.ts (new test × 2 projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Recovery on a new device, the old device's session ended, the old code refused, the same line for a wrong pseudo or code, the 15-minute lock"
    requirement: ACCT-02
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/secours.spec.ts (2 tests × 2 projects)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Passkeys on a real iPhone (Safari and the installed app), the computer's QR code to a phone, WhatsApp's in-app browser"
    verification: []
    human_judgment: true
    rationale: "Device-only behaviour; UAT in 04-12"

duration: about 50 min of work in this session (11:25 to 12:15 UTC, gate included), after the first executor's 3 commits
completed: 2026-10-18
status: complete
---

# Phase 4 Plan 09: L’accueil avec le compte, « Se connecter », l’invitation complète et « Retrouver mon compte » Summary

**Every way into an account is now on screen. The home shows two small tiles under the choice tiles: « Ton prénom » and « Se connecter » for a guest, « Mes amis » and « Mon compte » when signed in. « Mes parties en cours » merges the account's tables from other devices. The sign-in sheet signs in with a passkey (on a computer the browser offers the phone's QR code). An invitation link shows the right row in every case: expired, used, unknown, offline, a browser without passkeys, a signed-in player who adds the inviter, an inviter who is already a friend, and the player's own link. The backup code cannot be lost by a stray tap. On a new phone, « Retrouver mon compte » takes the pseudo and the code, makes a new passkey, shows a new code, and signs the other devices out.**

## Performance

- **Duration:** about 50 minutes in this session. A previous executor made the first 3 commits before a container restart.
- **Tasks:** 3, each RED then GREEN, plus the server refusal the orchestrator added (RED then GREEN).
- **Files:** 31 (9 created, 22 modified).

## Accomplishments

### The home, « Mes parties en cours » and « Se connecter » (Task 1)

- **`flow.homeTiles`** gives the UI-SPEC table:
  - a guest with a first name gets « Ton prénom » / « {Prénom} » (accessible name « Changer de prénom ({Prénom}) ») and « Se connecter » / « Créer un compte » (« Se connecter ou créer un compte »);
  - a guest without a first name gets « Se connecter » alone;
  - a signed-in player gets « Mes amis » / « Inviter un proche » (→ `#/amis`) and « Mon compte » / « {Pseudo} » (→ `#/compte`, title the full pseudo).
- **`SmallTile`:** link or button with `aria-haspopup="dialog"`, `data-small-tile-sub` on line 2, a `fill` form for the one-column and portrait layouts, and a bindable element for the focus.
- **`Home`:**
  - The row sits where the 02 name line was, in all four layouts. The tiles swap without motion.
  - Choice tile 2 reads « Invite tes amis ou partage un lien » when signed in.
  - Keyboard order: gear, tile 1, tile 2, small tile 1, small tile 2, the list, the strip.
- **`TableList`:**
  - Signed in, it shows `mergeTables(device, GET /api/me/tables)`. Signed out, it shows `visibleTables(device, null)`.
  - It asks again whenever the account changes.
  - A table that answers 404 leaves the device list and the account's list (`forgetMyTable`).
- **`SignInSheet`:**
  - It has every UI-SPEC state. The result line sits in a polite live region.
  - Without WebAuthn, one line replaces the primary and the recovery link.
  - On success: `signedIn`, then `linkTables`, then the toast (« Bonjour {Pseudo} ! », or the version with the linked tables), then the focus on « Mon compte ».
- **The store:**
  - A real 401 while a cached account existed clears the account and shows, once per sign-in, « Ta session a pris fin : connecte-toi de nouveau. » with « Se connecter ».
  - A 404 or HTML (the local preview) only clears.
- **Icons:** log-in, key-round and handshake, regenerated with `copy-vendor-assets.mjs`.

### The invitation, the pseudo step and the code screen (Task 2)

- **`flow.invitationRow`** decides each row in this order:
  - loading;
  - offline (no network, or the server failing);
  - unknown, used and expired;
  - signed in: own link, already a friend (with « jusqu’au {date} »), add the inviter;
  - signed out: no WebAuthn, else the pseudo step.
  - The rows a signed-in player sees win over the passkey check.
- **`Invitation.svelte`** renders the row. Its actions are home, friends, retry, copy-link, sign-in and accept:
  - « Ajouter à mes amis » goes busy (« Ajout… », `aria-busy`), then shows the toast « {A} est maintenant dans tes amis. » and goes to `#/amis`.
  - On the pseudo step:
    - the field is prefilled when the first name passes the pseudo rules;
    - the seats line shows when the device has guest tables;
    - « J’ai déjà un compte » opens the sheet, and a sign-in reloads the link.
  - **The server's `signed-in` refusal** (signed in meanwhile in another tab) refreshes the account and reloads the link, so the signed-in row shows.
- **`BackupCodeScreen`:**
  - It has three forms: sign-up, recovery (« Ton nouveau code de secours » + « L’ancien code ne marche plus, et tes autres appareils ont été déconnectés. ») and regeneration.
  - `beforeunload` is armed while the screen is up.
  - The router asks `leaveBlocked()` first on each hash change. The guard pushes the screen's address back and opens « Tu as bien gardé ton code ? ».
  - Only « Oui, je l’ai gardé » disarms it.
  - It already held updates (04-08).
- **`Notice`:** its primary can be busy.

### « Retrouver mon compte » (Task 3)

- **`#/secours`:**
  - Step 1 has two labelled fields. They sit side by side at 844 × 390 (`[pseudo 180][code flex]`), with the context line under the primary. On the computer they are stacked.
  - The code field adds dashes while the player types. It reads lower case, O as 0 and I or L as 1.
  - Entrée submits. The focused field scrolls into view.
  - A wrong pseudo and a wrong code show the same line, with both fields `aria-invalid`.
  - The lock text comes from `lockText`: 15 minutes, 30 minutes, 1 heure, 2, 4, 8, 16 and 24 heures, rounded up.
- **Step 2:** « Code accepté » and « Créer ma clé d’accès ». Cancelling stays on this step. When the delay is over, the player goes back to step 1 with its line.
- **Step 3:** the code screen in its recovery form. Then `#/compte` (the home until 04-10) with the toast « Compte retrouvé. Retire la clé de l’appareil perdu dans « Clés d’accès ». ».
- The device's guest tables pass to the account, as at a sign-in.

### Measured (Chromium 1194)

| Viewport | Element | Size |
|----------|---------|------|
| 844 × 390 | small tiles, guest and signed in | 136 × 48 each, 8 apart (x 30 and 174) |
| 1280 × 800 | small tiles | 152 × 48 each, 16 apart |
| 480 × 320 | small tiles (one column) | 220 × 48 each; a 20-character pseudo holds whole |
| 844 × 390 | sign-in sheet | 480 × 351; body 199 visible of 287 (the primary, the note and the recovery link in sight; the hint scrolls), as the UI-SPEC computed |
| 1280 × 800 | sign-in sheet | 480 × 439, everything in sight |
| 844 × 390 and 1280 × 800 | code panel | 56 high (one line), no scroll |

## Task Commits

1. **Extra (orchestrator), RED:** `36f0901` (test). The server refuses a second account to a signed-in caller.
2. **Extra, GREEN:** `04a188c` (fix).
3. **Task 1 RED:** `3de75b1` (test).
4. **Task 1 GREEN:** `6e1e339` (feat).
5. **Task 2 RED:** `2a42686` (test).
6. **Task 2 GREEN:** `80e7b7c` (feat).
7. **Task 3 RED:** `570e868` (test).
8. **Task 3 GREEN:** `52f88ab` (feat).

## Gate (at 52f88ab, one suite at a time)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | 0 errors (web: 563 files, plus the worker, the SW and the PWA spec) |
| `pnpm lint` | Biome, 366 files, clean |
| `pnpm test` | Vitest 115 files, **1 798 passed, 2 skipped** (the same 2 engine skips) |
| Full local Playwright | **457 passed, 99 skipped, 0 failed** (7.1 min) |
| Full online Playwright | **78 passed, 0 failed** (8.5 min). It was 56: +6 connexion, +10 invitation-compte, +2 compte, +4 secours |
| PWA Playwright (extra) | 10 passed |
| Ports 8787 / 4173 / 4174 before and after each run | free (checked by connecting) |
| UI acceptance greps, app.css custom properties since b19cfda | pass, 0 added |

## Screenshots

In `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/`, each at 844x390 and 1280x800:
- `04-09-home-guest-*`, `04-09-home-signed-in-*`, `04-09-signin-sheet-*`, `04-09-session-ended-*`
- `04-09-invitation-expired-*`, `04-09-invitation-pseudo-*`, `04-09-invitation-own-*`, `04-09-invitation-add-friend-*`
- `04-09-backup-code-*`, `04-09-backup-code-leave-*`
- `04-09-secours-1-*`, `04-09-secours-1-error-*`, `04-09-secours-2-*`, `04-09-secours-3-*`, `04-09-secours-done-*`
- `04-09-home-long-pseudo-480x320.png`, `04-09-home-long-pseudo-844x390.png`

I looked at them:
- Nothing on the home is amber.
- At 844 × 390 the small tiles fill the 280 left column. The signed-in sub line of choice tile 2 takes two lines inside its 96 px tile.
- The confirmation opens over the code after the back button.
- The recovery fields sit side by side on the phone.
- The code panel holds one line at both sizes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `bind:element` on a prop with a fallback crashed the home.** Svelte throws `props_invalid_value` when a bound prop that has a fallback receives `undefined`. The home showed the error screen. `element` now has no fallback. Fixed before the Task 1 GREEN commit.

**2. [Rule 1 - Test bug] The synced-passkey simulation.** Device 2 used the copied key, so device 1's copy had an older counter, and the server rightly refused it. `copyPasskey` now replaces an existing copy, and the spec re-syncs before device 1 signs in again. Commit `6e1e339`.

**3. [Rule 1 - Test too strict] A 20-character pseudo is not always cut at 152 px.** The computer's tile gives line 2 136 px, which can hold « Marie-Madeleine xxxx » whole. The spec now requires the cut only at 136. Ellipsis, no overflow and the 48 height are still checked at every size. Commit `6e1e339`.

**4. [Rule 1 - Bug] The capture-phase hash guard did not stop the router.** The home replaced the code screen. The router now asks `ui/leaveGuard.ts` first. Commit `80e7b7c`.

**5. [Rule 1 - Test setup] The back-button spec now opens the home first.** Otherwise « back » leaves the document, and only `beforeunload` can act there. The spec checks that too. Commit `80e7b7c`.

**6. [Rule 1 - RED commit] The Task 3 RED commit's flow.test.ts missed its new imports.** A formatter reordered the block, so my import edit did not apply. The RED still failed, with ReferenceError. The imports are fixed in `52f88ab`.

### Plan-detail adjustments (no scope change)

7. **Files outside `files_modified`:**
   - `ui/Notice.svelte`: a busy primary;
   - `ui/leaveGuard.ts` and `ui/stepIn.ts`: new;
   - `net/tables.ts` and its test: `linkTables`;
   - `account/api.ts` and its test, `apps/worker/src/auth/signup.ts` and its test: the orchestrator's extra item.
8. **`PseudoForm.svelte` is unchanged.** It already had the prefill input, the errors with `aria-invalid` and `aria-describedby`, the focus, the busy line, the geometry and the fine-pointer autofocus. « J’ai déjà un compte » and the seats line live in `Invitation.svelte`, under the form.
9. **The data-invitation hooks:** the pseudo step keeps `ok`, and no WebAuthn keeps `unsupported` (the existing specs use them). The new hooks are `add-friend`, `already-friend` and `own`.
10. **`recoverError("server")`** reads « Le compte n’a pas pu être retrouvé. Réessaie dans un instant. ». The UI-SPEC says « as the sign-up step », but that line says « créé ». This is listed for Romain below.
11. **The update strip on `#/secours` and the invitation page (orchestrator item 4).** `<HomeStrip kinds={["update"]} />` sits at the bottom of each page's column. The 04-08 rules (`canPromptUpdate`) never offer an update at `#/invitation` or `#/secours`, as the UI-SPEC « Update » table says (« Sign-up, recovery, the backup-code screen: never »), so these strips stay empty. The 04-08 SUMMARY's note that `canPromptUpdate` names `#/secours` is wrong: the route is not in `UPDATE_ROUTES`. I did not add it, because doing so would break the UI-SPEC rule and `rules.test.ts`.
12. **The in-app card (04-11)** can tell the code screen is up from `currentPlace().backupCode`, which is `pwaUpdate.holds > 0`. Nothing renders the card yet.

**Total deviations:** 6 auto-fixed (Rule 1), 6 plan-detail notes.

## Known Stubs

None. `#/amis` and `#/compte` still fall back to the home until 04-10, and the specs accept that (the plan says « or the home until 04-10 »).

## Threat Flags

None beyond the register:
- **T-04-63:** the code is never stored, `beforeunload` and the router guard are armed, and no strip shows on the screen.
- **T-04-64:** pseudos are rendered as text, and `no-raw-html.test.ts` passes.
- **T-04-65:** account rows hide when signed out, and a 401 clears `toc.me.v1`.
- **T-04-SC:** no package was added.

## To confirm with Romain

- **UI-SPEC « à confirmer » 1, 2, 3, 4, 5 and 17,** built as written:
  - the small tiles;
  - the words: « clé d’accès », « pseudo », « code de secours »;
  - the prefilled pseudo;
  - « Tu as bien gardé ton code ? »;
  - the sign-in sheet with its QR note;
  - the « Créer un compte » hint only on the home.
- **New choices:**
  - The recovery's server line: « Le compte n’a pas pu être retrouvé. Réessaie dans un instant. ».
  - « L’ajout n’a pas marché. Réessaie dans un instant. » when « Ajouter à mes amis » fails on the server.
- **Removing an account table from « Mes parties en cours »** also removes it from the account's other devices. « Remettre » brings it back on this device only.
- **Deploy notes (04-12):** no config, binding, secret or migration changed, and migration v1 is untouched. The worker change (409 signed-in) ships with the next deploy. Nothing was deployed, and no remote wrangler command was run.

## Self-Check: PASSED

- The created files exist: flow.ts, flow.test.ts, SignInSheet.svelte, Recover.svelte, leaveGuard.ts, stepIn.ts, connexion.spec.ts, invitation-compte.spec.ts and secours.spec.ts.
- Commits 36f0901, 04a188c, 3de75b1, 6e1e339, 2a42686, 80e7b7c, 570e868 and 52f88ab are ancestors of HEAD.
- `git rev-list --count 0d9fdf8..HEAD` is 8 before this summary's commit, and 9 with it.
