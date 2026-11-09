---
phase: 04-comptes-amis-et-application-installable
plan: 11
subsystem: web-accounts
tags: [friends, invitations, waiting-room, notices, hub, presence, accounts, svelte]

requires:
  - phase: 04-comptes-amis-et-application-installable
    provides: "04-04: the account seat rules, tagged list entries; 04-06: connectHub, noticeRule, inviteFriend, the invite route; 04-07: notifyMs, the turn notice; 04-08: pwaUpdate.holds; 04-09: SignInSheet, the account store; 04-10: FriendRow (page variant), InviteSheet kind, comptes.ts helpers"
provides:
  - "ui/InviteSheet.svelte: for a signed-in person, the Segmented « Mes amis » | « Lien et QR code » (data-invite-tab amis | lien, friendsAt prop); guests keep the 02 sheet"
  - "ui/FriendRow.svelte: the invite variant (data-friend-invite invite | sending | sent | here), inviteFriend in one tap"
  - "ui/NoticeCard.svelte: the in-app card (data-notice-card invite | turn, data-notice-card-live)"
  - "App.svelte: connectHub once, the place of the card's rules (route, table status, backup code, sign-up, recovery)"
  - "routes/Table.svelte: « Connecte-toi pour reprendre ta place » (data-notice compte) before any socket; a new connection when the account changes"
  - "account/hub.svelte.ts: tableOnScreen"
  - "account/flow.ts: inviteTabDefault, INVITE_SENT_MS, inviteRowState, inviteHere, cardText, cardAction, seatNeedsAccount, noticePlace"
  - "ui/stepIn.ts: cardIn, cardOut"
  - "e2e-online: amis-table.spec.ts; comptes.ts listenNotices, signOutHere; online.ts TableTest.notifyMs"
affects: [04-12]

estimate:
  tokens: 170000
  tasks: 3
actuals:
  tokens: 16500
  tasks: 3
  commits: 5
plan_head_before: 6113f3f59e2b57afc655f4ca0bf171e91ef7ca32
plan_head_after: 5f1ee3a23f7837340e9850ce4c46172d2b6aa7e4

tech-stack:
  added: []
  patterns:
    - "A route tells the app-wide card where the player is through one shared rune (tableOnScreen), and App passes the place to the hub inside untrack"
    - "Per-row answers kept in the component's module script for the page's life (« Invitation envoyée » survives the sheet closing)"
    - "A flex row that wraps its buttons under the text when the text would get under a minimum width"

key-files:
  created:
    - apps/web/src/ui/NoticeCard.svelte
    - apps/web/e2e-online/amis-table.spec.ts
  modified:
    - apps/web/src/ui/InviteSheet.svelte
    - apps/web/src/ui/FriendRow.svelte
    - apps/web/src/routes/WaitingRoom.svelte
    - apps/web/src/routes/Table.svelte
    - apps/web/src/App.svelte
    - apps/web/src/account/hub.svelte.ts
    - apps/web/src/account/flow.ts
    - apps/web/src/account/flow.test.ts
    - apps/web/src/i18n/fr/amis.ts
    - apps/web/src/i18n/fr/compte.ts
    - apps/web/src/ui/stepIn.ts
    - apps/web/e2e-online/comptes.ts
    - apps/web/e2e-online/online.ts

key-decisions:
  - "« Déjà à la table » shows from the server's `here` answer and also when the friend's pseudo is one of the names at the table (an account's person is named by its pseudo), so a friend who joined after the invite reads « Déjà à la table » when the sheet opens again"
  - "The « Mes amis » tab shows while the friends load, then falls to « Lien et QR code » with no friend; a tab the player chose is never changed; a list that cannot load opens on the link"
  - "The card counts the whole #/invitation/<code> route as sign-up, #/secours as recovery, and a backup code on screen (pwaUpdate.holds) as the backup flow"
  - "A table on screen tells the hub its status; while it connects the status is unknown and a card may show, then it is held as soon as the table reads playing, paused or saved"
  - "Table.svelte opens a new connection when the account id changes (a sign-in or a sign-out), not only when the name changes"
  - "On a phone held sideways the tab control is 44 px high with its borders (options 40 + 2 × 2), and 4 px above the link tab: « Copier le lien » ends 196 px into the 199 px body"
  - "The card's buttons stay beside the text only when the text keeps 160 px; « Revenir à la table » (182 px) puts them under it"

patterns-established:
  - "A screen that should hold the in-app card reports itself through noticePlace (route, tableStatus, backupCode)"

requirements-completed: [ACCT-04, APP-03]

coverage:
  - id: D1
    description: "inviteTabDefault, inviteRowState (invite, sending, sent 10 minutes, here, not-friend, rate, offline, server, not-here, started), inviteHere, cardText, cardAction (table id only), seatNeedsAccount, noticePlace"
    requirement: ACCT-04, APP-03
    verification:
      - kind: unit
        ref: "apps/web/src/account/flow.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Friends through A's link; « Mes amis » first; « Inviter » → « Invitation envoyée »; the link tab's two buttons in sight at 844 × 390; B's card on the home, read once, stacked inside 480 × 320; « Rejoindre »; « Déjà à la table »; a seat moved, two strengths, the start; the turn card once after notifyMs, never at the table; « Revenir à la table » ends the pause; a card held during a local game and shown on the home; a card dropped once its table started; « Connecte-toi pour reprendre ta place » with no table socket, then jaune after « Se connecter »"
    requirement: ACCT-04, APP-03
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/amis-table.spec.ts (1 test × 2 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The guest flow, the waiting room, the invitation sheet, pause and resume of phases 2 and 3"
    verification:
      - kind: e2e
        ref: "full online suite (100 passed), salle, invitation, pause, reprise, accueil, tracer, table-compte"
        status: pass
    human_judgment: false
  - id: D4
    description: "The card and the turn on real devices (a phone that locks during a game while a tablet shows the home)"
    verification: []
    human_judgment: true
    rationale: "Real devices; UAT in 04-12"

duration: "about 40 min (13:23 to 14:03 UTC, gate included)"
completed: 2026-10-18
status: complete
---

# Phase 4 Plan 11: Inviter un ami depuis la salle d’attente, la carte dans l’application, et la place d’un compte Summary

**From the waiting room, a signed-in player opens « Inviter » on « Mes amis » and invites a friend with one tap. The row turns into « Invitation envoyée » for 10 minutes. A friend who has TOC open sees « {Pseudo} t’invite à sa table. » at the top of the screen, and « Rejoindre » brings them to the table. A player missing from a paused table, with TOC open on another screen, sees « La table de {Créateur} t’attend : c’est ton tour. » with « Revenir à la table ». The card waits during a game, at a table that plays, on the backup-code screen and in sign-up or recovery. It shows later only if its table still waits. A signed-out device whose seat belongs to an account asks « Connecte-toi pour reprendre ta place » before it opens any socket. Guests see the phase-2 sheet unchanged.**

## Performance

- **Duration:** about 40 minutes, gate included.
- **Tasks:** 3. Tasks 1 and 2 are RED then GREEN; Task 3 is one commit (5 commits).
- **Files:** 15 (2 created, 13 modified).

## Accomplishments

### « Inviter à la table » with « Mes amis » (Task 1)

- **The sheet** (`InviteSheet.svelte`, prop `friendsAt`):
  - For a signed-in person, a Segmented « Mes amis » | « Lien et QR code » sits at the top of the body (`data-invite-tab`). This also applies to the sheet that opens by itself after the creation.
  - It opens on « Mes amis » while the friends load. With no friend, it falls to the link. A tab the player chose is never changed.
  - « Mes amis » lists the friends in the server's French alphabetical order.
    - While loading: « Chargement de tes amis… ».
    - With no friend: « Pas encore d’amis sur TOC. Partage plutôt le lien de la table. » and the text button « Lien et QR code ».
    - If the list fails: « Impossible de charger tes amis. » and « Réessayer ».
  - The link tab is the 02 content.
  - Guests (no account) get the 02 sheet with no tabs.
- **The row** (`FriendRow.svelte`, `variant="invite"`, `data-friend-invite`):
  - « Inviter » is secondary, 44 high and at least 96 wide. Its accessible name is « Inviter {Pseudo} à la table ».
  - A tap calls `inviteFriend`. The button reads « Envoi… » (`aria-busy`). Then it is replaced by check 16 + « Invitation envoyée » (Label 700, not a control), until 10 minutes after the answer.
  - The answer is kept per table and friend for the page's life, so it survives the sheet closing.
  - « Déjà à la table » shows as line 2, with no button. This happens on the server's `here`, and also when the pseudo is a name at the table.
  - Refusals:
    - `not-friend`: the toast « {Pseudo} n’est plus dans tes amis. », and the row goes.
    - `rate`: « Doucement : attends un peu avant d’inviter de nouveau. ».
    - Anything else: « L’invitation n’est pas partie. Vérifie le réseau, puis réessaie. ».
- **The waiting room** passes the table id and the names at the table (seated and unseated). Nothing else changes.

### The card and the account's seat (Task 2)

- **`NoticeCard.svelte`** (`data-notice-card invite | turn`):
  - It sits top centre, `8 px + safe-area-inset-top`, and is min(440, 100 % − 32) wide.
  - Style: bois sombre, radius 16, padding 16, the plate's sharp shadow, and a 2 px border of `--creme-attenuee` at 40 %.
  - From 600 px wide: icon 20, the text, « Plus tard », then the primary on one row (80 high for an invitation). The buttons go under the text when the text would keep less than 160 px, as « Revenir à la table » makes them. Below 600 px it is always stacked.
  - Accessibility:
    - `role="region"`, named by its text.
    - A polite live region reads each new card once.
    - It is not modal. App mounts it before the routes, so it comes first in the Tab order.
    - Échap while the focus is inside it is « Plus tard ».
  - Motion: in 200 ms (12 px down + fade), out 150 ms (fade); under reduced motion, 150 ms fades.
  - The primary sets `#/table/<id>`, only for a table id. From a waiting room it leaves the room as closing the page would.
- **App.svelte:**
  - `connectHub()` runs once and follows the account by itself: the socket opens while signed in and closes on sign-out.
  - The place goes to `hub.setPlace` through `noticePlace`: the route, the status of the table on screen (`tableOnScreen`, set by Table.svelte), the backup code (`pwaUpdate.holds`), sign-up (`#/invitation/…`) and recovery (`#/secours`).
- **Table.svelte:**
  - When the device's entry for the table is tagged with an account and nobody is signed in (`seatNeedsAccount`), it shows « Connecte-toi pour reprendre ta place » / « Ta place dans cette partie est liée à ton compte. ». The buttons are « Se connecter » (the sign-in sheet) and « Retour à l’accueil ». This comes before the first-name prompt and before any socket.
  - The sign-in sets the account, and the table connects.
  - Any change of the account id opens a new connection, so the next hello carries the cookie, or no longer does.

### End to end (Task 3)

`amis-table.spec.ts`, one chained test on both projects. The tables use `pauseMs 2000` and `notifyMs 1500`.

| Part | Phone | Desktop |
|------|-------|---------|
| invite (sign-ups, the tab, one tap, the link-tab fit, the card and 480 × 320, « Rejoindre », « Déjà à la table », seat moved, Champion and Poulain, start) | 10 s | 6 s |
| turn (B2 signed in, B's page closes, the card once, « Revenir à la table », pause over) | 3 s | 3 s |
| held (local game, invite held then shown on the home; a second invite dropped once its table started) | 5 s | 6 s |
| signed out (« Se déconnecter », the notice with no table socket, « Se connecter », jaune) | 2 s | 2 s |
| whole test | 20.9 s | 17.2 s |

Measured: at 844 × 390 the sheet body is 199.0 px, and « Copier le lien » ends 196.0 px into it, with the share button stood in for so both show.

## Task Commits

1. **Task 1 RED:** `99e4fa8` (test)
2. **Task 1 GREEN:** `e034c2e` (feat)
3. **Task 2 RED:** `a3a3e00` (test)
4. **Task 2 GREEN:** `202490e` (feat)
5. **Task 3:** `5f1ee3a` (test, with the two fit fixes below)

## Gate (at 5f1ee3a, one suite at a time)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | 0 errors (web: 578 files, plus the worker, the SW and the PWA spec) |
| `pnpm lint` | Biome, 372 files, clean |
| `pnpm test` | Vitest 115 files, **1 841 passed, 2 skipped** (the same 2 engine skips; 1 825 before) |
| Full local Playwright | **457 passed, 99 skipped, 0 failed** (7.6 min) |
| Full online Playwright | **100 passed, 0 failed** (8.6 min). It was 98: +2 amis-table |
| Task verifies | invitation + salle (12), tracer + table-compte + reprise (10), amis-table + salle + pause + reprise + invitation + accueil (30): all passed |
| Ports 8787 / 4173 / 4174 before and after each run | free (checked by connecting) |
| Acceptance greps; app.css custom properties since b19cfda | pass, 0 added |

## Screenshots

In `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/`, each at 844x390 and 1280x800:
- `04-11-inviter-mes-amis-*`, `04-11-invitation-envoyee-*`, `04-11-inviter-lien-*`
- `04-11-carte-invitation-*` (plus `04-11-carte-invitation-480x320.png`), `04-11-carte-tour-*`
- `04-11-connecte-toi-*`

I looked at them:
- The only amber is « Rejoindre » / « Revenir à la table » on the card, the link tab's primary and the notice's « Se connecter ».
- The invitation card is one row (80 high). The turn card puts its buttons under a one-line text.
- At 844 × 390 the link tab shows the link, « Partager le lien » and « Copier le lien » above « Fermer ».
- At 480 × 320 the card is stacked and inside the screen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The link tab was 1 px over the sheet's body at 844 × 390, even with the 4 px gap.** The Segmented is 48 high with its 2 px borders, not the 44 the UI-SPEC budgeted. In that height only, the options are 40 high, so the control is 44 with its borders. Measured: 196 of 199. The rule is scoped in InviteSheet; Segmented.svelte is unchanged. Commit `5f1ee3a`.

**2. [Rule 1 - Bug] The turn card's text wrapped into a 98 px column of five lines.** The UI-SPEC's one-row layout cannot hold « Revenir à la table » (182 px) and a two-line text in 440 px. The row now wraps its buttons under the text when the text would keep less than 160 px. The invitation stays on one row. Commit `5f1ee3a`.

**3. [Rule 2 - Correctness] « Déjà à la table » also comes from the names at the table.** The server says `here` only when « Inviter » is tapped. Without the names, a friend who joined after an invite would read « Invitation envoyée » for 10 minutes. Commit `e034c2e`.

### Plan-detail adjustments (no scope change)

4. **Files outside `files_modified`:** `ui/stepIn.ts` (`cardIn`, `cardOut`, next to `stepIn` and its reduced-motion rule).
5. **`seatNeedsAccount` and `cardText` signatures:** they take the account `{ id, pseudo }` and the `NoticeFrame`. The `own` flag decides « Ta table t’attend… », so no `me` argument is needed.
6. **In the e2e, A saves the first game after B2 leaves it for the local game.** Otherwise the second pause would send another turn card that replaces the invitation the test holds.
7. **Task 3 is one commit** (it has no RED step), and it carries fixes 1 and 2.

**Total deviations:** 3 auto-fixed (2 Rule 1, 1 Rule 2), 4 plan-detail notes.

## Known Stubs

None.

## Threat Flags

None beyond the register:
- **T-04-71:** the card sets `#/table/<id>` only for a table id (`cardAction`, tested), and the hub frame is parsed by its schema (04-06).
- **T-04-72:** the notice comes before any socket. The e2e counts no `/ws/table/` socket while it shows.
- **T-04-73:** cards are held in games, at tables that play and in sign-up flows, and only the latest is kept.
- **T-04-SC:** no package was added.
- The pseudos are text only, and `no-raw-html.test.ts` passes.

## To confirm with Romain

- **UI-SPEC « à confirmer » 10 and 11,** built as written:
  - « Inviter » opens on « Mes amis », and any signed-in person at the table can invite;
  - the card « Marie t’invite à sa table. » waits during a game, and « Rejoindre » leaves another waiting room without a question.
- **New lines, not in the UI-SPEC:**
  - the tab control's accessible name, « Inviter avec »;
  - « Impossible de charger tes amis. » with « Réessayer » in the sheet;
  - for a refusal the UI-SPEC does not name (`not-here`, the game `started`), the generic « L’invitation n’est pas partie. Vérifie le réseau, puis réessaie. »
- **A turn card for a resumed game** (`resumed`) uses the same text, with the name of the player who resumed: « La table de {Nom} t’attend : c’est ton tour. ».
- **A guest at the table with the same first name as a friend's pseudo** makes that friend's row read « Déjà à la table ». This is rare in a family circle. Pseudos are unique, but guest names are not.
- **Deploy notes (04-12):** no config, binding, secret or migration changed, and migration v1 is untouched. Nothing was deployed, and no remote wrangler command was run.

## Self-Check: PASSED

- The created files exist: NoticeCard.svelte and amis-table.spec.ts.
- Commits 99e4fa8, e034c2e, a3a3e00, 202490e and 5f1ee3a are ancestors of HEAD.
- `git rev-list --count 6113f3f..HEAD` is 5 before this summary's commit, and 6 with it.
