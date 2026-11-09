---
phase: 04-comptes-amis-et-application-installable
plan: 10
subsystem: web-accounts
tags: [accounts, friends, passkeys, push, notifications, invitations, friend-code, svelte]

requires:
  - phase: 04-comptes-amis-et-application-installable
    provides: "04-02: logOut, addPasskey, removePasskey, newBackupCode; 04-05: invitations, friend codes, friends, invites.ts; 04-07: push.ts (pushState, enablePush, disablePush, refreshKey), api pushKey / saveSubscription / deleteSubscription, pwa/platform.ts; 04-08: HomeStrip, InstallSheet, canPromptUpdate; 04-09: flow.ts, the account store, BackupCodeScreen, Recover.svelte"
provides:
  - "routes/Account.svelte at #/compte (data-account, data-account-identity, data-account-pseudo, data-account-right, data-account-section notifications | cles | code)"
  - "routes/Friends.svelte at #/amis (data-friends, data-friends-actions, data-friends-right, data-friends-empty, data-invite-row, data-invite-share-again, data-invite-disable)"
  - "ui/Page.svelte + ui/pageLayout.svelte.ts: the « Page » layout family (computer 320 + 48 + 520, two columns 280 + 24 + 480, one column, portrait) with the update strip"
  - "ui/NotificationsPanel.svelte (data-notifications = loading | error | the seven states), ui/PasskeyList.svelte (data-passkey-row, data-current, data-passkey-last, data-passkey-add), ui/FriendRow.svelte (data-friend-row, page variant), ui/FriendCodeSheet.svelte (data-friend-code-sheet, data-friend-code, data-friend-code-error), ui/OfflinePage.svelte (data-notice page-hors-ligne)"
  - "ui/InviteSheet.svelte kind=\"proche\" (data-invite-kind), QrCode label prop"
  - "account/browserPush.ts: browserPushFacts, browserPushManager(wait), currentPermission, requestPermission, toc.push.v1 (the switch turned off)"
  - "account/flow.ts: notificationPlatform, notificationsView, passkeyLine, signOutBody, accountSeats, friendSince, friendSentence, initial, pendingLine, friendCodeInput, friendCodeResult"
  - "account/invites.ts: keepPending; toc.friendcode.v1 (rememberFriendCode, loadFriendCode)"
  - "account/store.svelte.ts: requireSignIn"
  - "ui/stepIn.ts: rowFade (150 ms, instant under reduced motion)"
  - "e2e-online/comptes.ts: stubPush, pushStubState, accountContext, IPHONE_17_UA, apiInvitation, befriend"
affects: [04-11, 04-12]

estimate:
  tokens: 190000
  tasks: 3
actuals:
  tokens: 38300
  tasks: 3
  commits: 6
plan_head_before: 5f674b0659f369be0c32c0c2b247033316badc64
plan_head_after: dda004571d086597761706febf47fb6e8caa5549

tech-stack:
  added: []
  patterns:
    - "One « Page » layout component with left/right snippets and test-hook attributes; the update strip placed by the layout"
    - "A confirmation stays up while the server answers, then closes with its opener set to where the focus should go next (a sheet that is sliding out pulls the focus back otherwise)"
    - "What a closing sheet shows is kept in its own state (`…Shown`), never read from the value set back to null"
    - "The browser's push is stood in for in the online suites (service workers are blocked there): navigator.serviceWorker.ready / getRegistration, Notification.permission / requestPermission (counted), navigator.standalone, all in localStorage"

key-files:
  created:
    - apps/web/src/routes/Account.svelte
    - apps/web/src/routes/Friends.svelte
    - apps/web/src/ui/Page.svelte
    - apps/web/src/ui/pageLayout.svelte.ts
    - apps/web/src/ui/NotificationsPanel.svelte
    - apps/web/src/ui/PasskeyList.svelte
    - apps/web/src/ui/OfflinePage.svelte
    - apps/web/src/ui/FriendRow.svelte
    - apps/web/src/ui/FriendCodeSheet.svelte
    - apps/web/src/account/browserPush.ts
    - apps/web/src/i18n/fr/amis.ts
    - apps/web/e2e-online/compte-page.spec.ts
    - apps/web/e2e-online/amis.spec.ts
  modified:
    - apps/web/src/App.svelte
    - apps/web/src/routes/Recover.svelte
    - apps/web/src/ui/InviteSheet.svelte
    - apps/web/src/ui/QrCode.svelte
    - apps/web/src/ui/stepIn.ts
    - apps/web/src/ui/icons.ts
    - apps/web/src/account/flow.ts
    - apps/web/src/account/flow.test.ts
    - apps/web/src/account/invites.ts
    - apps/web/src/account/invites.test.ts
    - apps/web/src/account/store.svelte.ts
    - apps/web/src/i18n/fr/compte.ts
    - apps/web/src/i18n/fr/appli.ts
    - apps/web/e2e-online/comptes.ts
    - apps/web/e2e-online/secours.spec.ts
    - tools/copy-vendor-assets.mjs

key-decisions:
  - "The notification switch turned on again, with the permission already granted, does not call Notification.requestPermission at all; only « Activer les notifications » asks, from its click handler"
  - "A subscription this device holds is saved again when « Notifications » opens: the server may have dropped it with an ended session, and the page would otherwise say « Activées » for a device that gets nothing"
  - "« Se déconnecter » ends this device's push with disablePush (DELETE, then unsubscribe), so a later sign-in on the device does not believe it is still subscribed; then logOut"
  - "The switch's off position is kept on the device (toc.push.v1), so « Désactivées sur cet appareil. » survives a restart"
  - "« Parties concernées : n. » counts this device's entries tagged with the account that hold a seat"
  - "A server without a VAPID key (push-off) shows the section's error with « Réessayer »"
  - "« Donner mon code » keeps the code per account (toc.friendcode.v1) until it expires, so reopening the sheet never changes a code a proche is typing; « Nouveau code » always asks"
  - "The code field reads « TOC » once, keeps « T », « TO » and « TOC » as typed while the player types the prefix, and adds the dash only when a fifth symbol comes (a backspace never loops)"

patterns-established:
  - "Pages for signed-in players call requireSignIn on any 401 (or when the store clears the account): home, sign-in sheet, session-ended toast"

requirements-completed: [ACCT-01, ACCT-03, APP-03]

coverage:
  - id: D1
    description: "notificationsView (seven states, three platforms), passkeyLine, signOutBody, accountSeats, friendSince, friendSentence, initial, pendingLine, friendCodeInput, friendCodeResult; keepPending, the stored friend code"
    requirement: ACCT-01, ACCT-03, APP-03
    verification:
      - kind: unit
        ref: "apps/web/src/account/flow.test.ts, apps/web/src/account/invites.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "« Mon compte »: the sections in order; notifications only from the tap (asked once), on, saved by the server, off, on again without a prompt, blocked with the platform line; on the phone, an iPhone in Safari is told to install first; passkeys already here, a second key, the last key kept and the focus moved; a new backup code; « Se déconnecter » with a seat; signed out → home + sheet + toast; the fit"
    requirement: ACCT-01, APP-03
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/compte-page.spec.ts (5 tests × 2 projects), secours.spec.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "« Mes amis »: a link signs a proche up into both lists and leaves the pending list; a code given and typed with every answer; a removal on both sides; a disabled link opens nothing; a link made elsewhere has no share; the 11th link's toast; the fit with three friends and a link"
    requirement: ACCT-03
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/amis.spec.ts (5 tests × 2 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Real push on an installed iPhone and Android (the permission prompt, the blocked path in Réglages)"
    verification: []
    human_judgment: true
    rationale: "Device-only behaviour; UAT in 04-12"

duration: "about 55 min (12:21 to 13:16 UTC, gate included)"
completed: 2026-10-18
status: complete
---

# Phase 4 Plan 10: « Mon compte » et « Mes amis » Summary

**« Mon compte » and « Mes amis » are on screen. « Mon compte » shows the pseudo, the creation date and « Se déconnecter », then three sections. « Notifications » turns push on from the tap only, offers a switch « Sur cet appareil », and explains the blocked and iPhone cases. « Clés d’accès » lists the passkeys, adds this device's and never removes the last. « Code de secours » makes a new code behind the passkey. « Se déconnecter » names the games it concerns and ends this device's session, rows and notifications. « Mes amis » lists the friends and removes them both ways. It makes single-use invitation links with their QR code, lists the pending ones (shareable only from the device that made them) and disables them. Its code sheet gives and takes friend codes.**

## Performance

- **Duration:** about 55 minutes, gate included.
- **Tasks:** 3, each RED then GREEN (6 commits).
- **Files:** 29 (13 created, 16 modified).

## Accomplishments

### « Mon compte » (Task 1)

- **The page** (`#/compte`) uses the « Page » layout, now one component (`ui/Page.svelte`) shared with « Mes amis »:
  - computer: 320 + 48 + 520;
  - phone held sideways: 280 + 24 + 480;
  - one column under 640 wide, and portrait.
- **The header** has « Accueil » and the h1; the h1 takes the focus.
- **The identity column:** « Ton pseudo », the pseudo (ellipsis, title), « Compte créé le {date} », « Se déconnecter » and « Sur cet appareil seulement. ».
- **Loading and errors:**
  - The cached pseudo shows at once.
  - « Clés d’accès » and « Code de secours » say « Chargement… » until `/api/me` answers, and show their own error with « Réessayer ».
  - « Notifications » does the same with the push key.
- **Signed out** (a 401, or the store clearing the account): the home, the sign-in sheet open, and « Ta session a pris fin : connecte-toi de nouveau. ».
- **Offline:** the new offline page (« Pas de connexion », « Réessayer », « Jouer contre l’ordinateur »). It reloads by itself on `online`. `#/secours` uses it for its first step.
- **« Notifications »** (`data-notifications`) shows one of the seven states from `pushState`:
  - The push key is fetched when the panel mounts.
  - The primary's click handler calls `enablePush` directly, so the permission is asked inside the tap and nowhere else.
  - Then the switch « Sur cet appareil »: off unsubscribes, on subscribes again without a prompt.
  - Blocked shows `bell-off` and the platform's way to allow them (iOS, Android, computer), then « Reviens ici ensuite. ».
  - An iPhone in Safari is told to install first, and « Installer l’application » opens the install sheet.
  - Each change is read once in a polite live region.
- **« Clés d’accès »** (`PasskeyList`):
  - Rows are 56 high and read as one sentence (« Linux, cet appareil, ajoutée le 18 octobre »), with « · synchronisée » for synced keys.
  - The last key's remove button is disabled, with the note.
  - « Ajouter une clé d’accès » has the toasts « Clé ajoutée. », « Cet appareil a déjà une clé pour ton compte. » and « Ajout annulé. ».
  - Removing asks « Retirer la clé ? » (destructive). The row fades out in 150 ms (instant under reduced motion), and the focus goes to the next remove button or to « Ajouter une clé d’accès ».
- **« Code de secours »:** « Créé le {date}. », then « Créer un nouveau code ». It asks « Remplacer ton code de secours ? », then the passkey, then shows « Ton nouveau code de secours » once, and comes back with « Nouveau code enregistré. ». A cancelled passkey gives « Code non remplacé : la clé d’accès n’a pas été confirmée. ».
- **« Se déconnecter »:**
  - It asks « Se déconnecter de cet appareil ? » with the D-12 body, plus « Parties concernées : n. » when this device holds seats. « Rester sur mon compte » is the focused primary.
  - Confirming ends this device's push (DELETE, then unsubscribe), then the session (`logOut`).
  - The account-tagged rows hide, and the guest home says « Session fermée sur cet appareil. ».
- **Icons:** log-out, bell and bell-off (and link and user-plus for « Mes amis »), regenerated.

### « Mes amis » (Tasks 2 and 3)

- **Left column:**
  - « Inviter un proche » (`link` icon, busy « Création du lien… ») creates a link, remembers it on this device and opens the invite sheet's new variant: « Inviter un proche », « Ce lien sert une fois, jusqu’au {date}. », « Lien d’invitation », « Code QR du lien d’invitation », and the shared text « {Pseudo} t’invite sur TOC… ».
  - The 11th link gives « Tu as déjà 10 liens en attente. Désactive-en un pour en créer un autre. ». Offline and failures have their toasts.
  - « Ajouter avec un code » and the note follow.
- **The friends list:**
  - French alphabetical order; the h2 is read only.
  - Rows: the oak initial disc (the first grapheme in upper case), the pseudo, « Dans tes amis depuis {mois année} », and the remove x.
  - Empty, loading (« La connexion est lente. » after 10 s) and error with « Réessayer ».
  - Removing asks « Retirer {Pseudo} de tes amis ? » (destructive), then shows « {Pseudo} n’est plus dans tes amis. ». The focus goes to the next row or to « Inviter un proche ».
- **« Invitations en attente »:**
  - Rows « Lien du {date} » / « Valable jusqu’au {date} · une seule fois ».
  - « Partager ce lien » only when this device made the link (`codeFor`).
  - « Désactiver ce lien » asks « Désactiver ce lien ? » (destructive), then shows « Lien désactivé. ».
  - Links the server no longer lists are forgotten on the device (`keepPending`).
- **« Ajouter avec un code »:**
  - The Segmented « Afficher » opens on « Entrer un code ». The labelled field adds « TOC- » and the dash while typing. « Ajouter » goes busy (« Ajout… »), and every UI-SPEC result line shows in a polite region. A friend added closes the sheet with its toast, and the list reloads.
  - « Donner mon code » shows the cream panel (spelled « T O C, … » for screen readers), « Valable 24 heures. … », « Copier le code » and « Nouveau code ». The code received is reused while valid.
- **The update strip** is at the bottom of the right column on both pages (after the header in one column). The 04-08 rules allow an update on `#/compte` and `#/amis`.

### Measured (Chromium 1194)

| Viewport | Page | Measure |
|----------|------|---------|
| 844 × 390 | « Mon compte » | columns 280 and 480; the identity column and « Activer les notifications » in sight (the button ends at about 199); the page scrolls for the rest, as the UI-SPEC says |
| 1280 × 800 | « Mon compte » | columns 320 and 520; no scroll with one key |
| 844 × 390 | « Mes amis », 3 friends and 1 link | columns 280 and 480; header 12 → 56; right column 72 → 368 (296, the UI-SPEC's budget); no scroll; rows 56 |
| 1280 × 800 | « Mes amis », 3 friends and 1 link | columns 320 and 520; no scroll |

## Task Commits

1. **Task 1 RED:** `5a6bc7f` (test)
2. **Task 1 GREEN:** `00a8f35` (feat)
3. **Task 2 RED:** `326bbd6` (test)
4. **Task 2 GREEN:** `4bf8c80` (feat)
5. **Task 3 RED:** `92a26b4` (test)
6. **Task 3 GREEN:** `dda0045` (feat)

## Gate (at dda0045, one suite at a time)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | 0 errors (web: 576 files, plus the worker, the SW and the PWA spec) |
| `pnpm lint` | Biome, 371 files, clean |
| `pnpm test` | Vitest 115 files, **1 825 passed, 2 skipped** (the same 2 engine skips; 1 798 before) |
| Full local Playwright | **457 passed, 99 skipped, 0 failed** (7.3 min) |
| Full online Playwright | **98 passed, 0 failed** (7.9 min). It was 78: +10 compte-page, +10 amis |
| Ports 8787 / 4173 / 4174 before and after each run | free (checked by connecting) |
| Acceptance greps; app.css custom properties since b19cfda | pass, 0 added |

## Screenshots

In `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/`, each at 844x390 and 1280x800:
- `04-10-compte-*`, `04-10-compte-notifications-on-*`, `04-10-compte-bloquees-*`, `04-10-compte-se-deconnecter-*`, `04-10-compte-nouveau-code-*`
- `04-10-amis-vide-*`, `04-10-amis-*`, `04-10-amis-inviter-un-proche-*`, `04-10-amis-code-entrer-*`, `04-10-amis-code-donner-*`, `04-10-amis-retirer-*`
- `04-10-hors-ligne-*`

I looked at them:
- The only amber is the page's primary (« Activer les notifications », « Inviter un proche ») and the safe answers.
- The last key's x is at 40 %.
- At 844 × 390 « Mes amis » holds three friends and a link without scrolling.
- The invite sheet hides its text line under 420 px of height, as the 02 sheet does.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A closing sheet read a value already set back to null.** The invite sheet read `sheet.opener` while sliding out, and the error screen took over. The confirmations of a removal had the same risk. Each sheet now reads its own `…Shown` state. Commit `dda0045`.

**2. [Rule 1 - Bug] `bind:button` with a `$bindable(null)` fallback crashed « Mes amis ».** This is the same Svelte rule 04-09 met. The prop has no fallback now. Commit `4bf8c80`.

**3. [Rule 1 - Bug] The focus after a removal went back to the sheet.** A sheet that is sliding out pulls the focus into itself. The confirmation now stays up while the server answers, then closes with its opener set to the next button. Commits `00a8f35` and `4bf8c80`.

**4. [Rule 1 - Bug] The h2 of « Invitations en attente » kept the browser's margins** (33 px too high at 844 × 390). Commit `dda0045`.

**5. [Rule 2 - Correctness] A held subscription is saved again when the panel opens, and « Se déconnecter » unsubscribes the device as well as deleting the server's row.** Without this, the panel could say « Activées » for a device the server no longer knows. Commit `00a8f35`.

**6. [Rule 3 - Blocking] The online suites block service workers, so the e2e stands in for the PushManager** (`stubPush` in `comptes.ts`). The page finds the registration with `getRegistration`, else `ready` (at most 10 s), so it never hangs without a worker. Commit `5a6bc7f`.

### Plan-detail adjustments (no scope change)

7. **Files outside `files_modified`:**
   - `ui/Page.svelte` and `ui/pageLayout.svelte.ts`: the shared layout;
   - `account/browserPush.ts`: the browser's push facts and manager;
   - `ui/QrCode.svelte`: a `label` prop for the variant;
   - `ui/stepIn.ts`: `rowFade`;
   - `account/store.svelte.ts`: `requireSignIn`;
   - `i18n/fr/appli.ts`: the offline page's copy, the catalogue the UI-SPEC names for it;
   - `e2e-online/secours.spec.ts`: the recovery now lands on « Mon compte ».
8. **The icons link and user-plus came with Task 1's commit**, with the other three, rather than in Task 2's.
9. **The phone project's notification test** runs with an iOS 17.4 user agent. It first checks the Safari-tab state (install first), then the installed app (`navigator.standalone`). The device's own iOS 15 agent would only ever show « Cet iPhone ne reçoit pas… ».

**Total deviations:** 6 auto-fixed (4 Rule 1, 1 Rule 2, 1 Rule 3), 3 plan-detail notes.

## Known Stubs

None.

## Threat Flags

None beyond the register:
- **T-04-67:** pseudos are text only, and `no-raw-html.test.ts` passes.
- **T-04-68:** « Clés d’accès » lists and removes keys.
- **T-04-70:** the permission is asked only in the tap's handler, and the e2e counts the calls (one).
- **T-04-SC:** no package was added.

## To confirm with Romain

- **UI-SPEC « à confirmer » 6, 7, 8, 9 and 12,** built as written:
  - the order of « Mon compte »'s sections;
  - keys named after the device, without renaming;
  - the sign-out question with « Parties concernées »;
  - 10 pending links, shareable only from the device that made them;
  - the friend code TOC-XXXX-XXXX valid 24 hours.
- **New lines, not in the UI-SPEC:**
  - « La clé n’a pas pu être retirée. Réessaie dans un instant. »
  - « L’ajout n’a pas marché. Réessaie dans un instant. » (a key, or a friend code)
  - « Le code n’a pas pu être remplacé. Réessaie dans un instant. »
  - « Le retrait n’a pas marché. Réessaie dans un instant. » (a friend)
  - « Le lien n’a pas pu être désactivé. Réessaie dans un instant. »
  - « Impossible de charger tes invitations en attente. »
  - « Le code n’a pas pu être créé. Réessaie dans un instant. »
  - « Suis les instructions de ton appareil… » while a key is being added.
- **Removing a key shows no toast:** the row goes and the focus moves. The UI-SPEC names none.
- **Deploy notes (04-12):** no config, binding, secret or migration changed, and migration v1 is untouched. Nothing was deployed, and no remote wrangler command was run.

## Self-Check: PASSED

- The created files exist: Account.svelte, Friends.svelte, Page.svelte, pageLayout.svelte.ts, NotificationsPanel.svelte, PasskeyList.svelte, OfflinePage.svelte, FriendRow.svelte, FriendCodeSheet.svelte, browserPush.ts, amis.ts, compte-page.spec.ts and amis.spec.ts.
- Commits 5a6bc7f, 00a8f35, 326bbd6, 4bf8c80, 92a26b4 and dda0045 are ancestors of HEAD.
- `git rev-list --count 5f674b0..HEAD` is 6 before this summary's commit, and 7 with it.
