---
phase: 02-jouer-en-ligne-entre-proches
plan: 05
status: complete
subsystem: online-table
tags: [waiting-room, lobby, durable-objects, zod, svelte5, qr-code, uqr, web-share, clipboard, playwright, workerd]

requires:
  - phase: 02-jouer-en-ligne-entre-proches
    provides: "02-01 the table reducer, frames and GameRoom; 02-02 the leak oracle and property; 02-03 the online computers; 02-04 the home, the first name, « Mes parties en cours » and the table route"
  - phase: 03-l-ordinateur-la-force-choisie
    provides: "StrengthPicker (inline / stacked / narrow), parseBotLevel, the level names"
provides:
  - "@toc/protocol: client frames stand, move { who, to }, level { seat, level 1-5 literals }, leave; error code table-full; TablePublic.unseated (first names of the online people without a seat)"
  - "@toc/table: stand, sit from a seat, host-only move and swap, host-only level on free seats, leave (the creator keeps the role), table-full; lobbyChange (welcome to whoever changed seat, table frame to the others)"
  - "apps/web net/notices.ts: tableNotices(prev, next, me) → « {Nom} a rejoint la table. », « {Nom} a quitté la table. », « {Créateur} a changé ta place : tu es maintenant {Couleur}. »"
  - "WaitingRoom.svelte (computer, two columns, one column with the sticky band; rotate prompt upright), SeatTile.svelte, MoveSheet.svelte, Notice.svelte"
  - "StrengthPicker « seat » variant (role word « Ordinateur »), ConfirmDialog generalised ({ title, body, safeLabel, otherLabel, destructive }), Réglages online (« Quitter la table », no « Tester les sons »)"
  - "InviteSheet.svelte (link, QR, share, copy; opens by itself once for the creator) and QrCode.svelte (uqr as its own chunk, one SVG path)"
  - "e2e-online: salle.spec.ts, invitation.spec.ts"
affects: [02-06, 02-07, 02-08, 02-09, 02-10]

tech-stack:
  added: ["uqr 0.1.3 (exact, apps/web dependency, dynamic import only)"]
  patterns:
    - "A waiting-room change answers with a welcome to each person whose seat changed and a table frame to everyone else online (lobbyChange)"
    - "Toasts of the room derived on the client from two public tables in a row (tableNotices), people counted by first name"
    - "A one-shot sessionStorage mark (toc.invite.v1) carries « just created » from the home to the waiting room"

key-files:
  created:
    - packages/table/src/lobby.test.ts
    - apps/worker/test/lobby.test.ts
    - apps/web/src/net/notices.ts
    - apps/web/src/net/notices.test.ts
    - apps/web/src/routes/WaitingRoom.svelte
    - apps/web/src/ui/SeatTile.svelte
    - apps/web/src/ui/MoveSheet.svelte
    - apps/web/src/ui/Notice.svelte
    - apps/web/src/ui/InviteSheet.svelte
    - apps/web/src/ui/QrCode.svelte
    - apps/web/e2e-online/salle.spec.ts
    - apps/web/e2e-online/invitation.spec.ts
  modified:
    - packages/protocol/src/frames.ts
    - packages/protocol/src/frames.test.ts
    - packages/table/src/reduce.ts
    - packages/table/src/frames.ts
    - packages/table/src/reduce.test.ts
    - packages/table/test/leak.test.ts
    - apps/worker/test/helpers.ts
    - apps/worker/test/leak.test.ts
    - apps/web/package.json
    - pnpm-lock.yaml
    - apps/web/src/routes/Table.svelte
    - apps/web/src/routes/Home.svelte
    - apps/web/src/ui/StrengthPicker.svelte
    - apps/web/src/ui/ConfirmDialog.svelte
    - apps/web/src/ui/SettingsSheet.svelte
    - apps/web/src/ui/SettingsButton.svelte
    - apps/web/src/ui/Toast.svelte
    - apps/web/src/i18n/fr/table.ts
    - apps/web/src/i18n/fr/bots.ts
    - apps/web/src/i18n/fr/reglages.ts
    - apps/web/src/net/remoteGame.test.ts
    - apps/web/e2e-online/accueil.spec.ts

key-decisions:
  - "PROTOCOL_VERSION stays 1: the changes are additive (four new client frames, one new error code, one new TablePublic key); a page from before reads the new table frames (zod object, unknown keys dropped) and deploys are atomic"
  - "The creator's « Quitter la table » keeps their record (unseated, offline) so the name in « Table de {Créateur} » and the role come back with them; anyone else is removed. After the start a seated person's leave is refused (started) until 02-07"
  - "A freed seat keeps the table's level for its colour (Galopeur unless the creator chose one before someone sat there), as the plan words it; the UI-SPEC's « a seat freed by a human gets Galopeur » differs only in that corner (à confirmer par Romain)"
  - "Refusal codes: a move of a seat nobody holds → illegal; a level on a person's seat → seat-taken; a level outside 1-5 reaching the core → bad-frame; an unseated sit at four people → table-full"
  - "« La table est complète » is the waiting room's right-column block of the UI-SPEC (grid still visible, data-notice=\"complete\", « Retour à l’accueil » in place of « Inviter »), not a full-screen Notice"
  - "uqr is called with border 0: the 4-module quiet zone is drawn by QrCode (viewBox = modules + 8); data-modules is the uqr size without border"
  - "Leaving the waiting room also removes the table from this device's « Mes parties en cours »"
  - "The toast sits above open sheets (z-index 65 > 60), so « Lien copié. » shows over « Inviter à la table » on phones"

patterns-established:
  - "Online specs check fit with document scroll sizes per viewport (salle.spec.ts), as the local launch and home specs do"
  - "A share sheet is stood in for in e2e by an init script defining Navigator.prototype.share; removed by deleting it"

requirements-completed: [NET-01]

coverage:
  - id: D1
    description: "The server checks every waiting-room command: only the host moves, swaps, sets levels and starts; a taken seat is refused; levels 1-5 only; nobody sits, stands, moves or sets a level after the start; four people → table-full"
    requirement: NET-01
    verification:
      - kind: unit
        ref: "packages/table/src/lobby.test.ts; packages/protocol/src/frames.test.ts"
        status: pass
      - kind: integration
        ref: "apps/worker/test/lobby.test.ts (workerd, an eviction before each step)"
        status: pass
  - id: D2
    description: "Unseated people and late arrivals never receive a view or an events frame (D-10, D-12); the leak property (now with stand, sit back, move and level, and lobby commands during the game) still finds no leak"
    requirement: NET-01
    verification:
      - kind: unit
        ref: "packages/table/src/lobby.test.ts#start with unseated people, and late arrivals"
        status: pass
      - kind: property
        ref: "packages/table/test/leak.test.ts#holds over 200 random tables"
        status: pass
      - kind: integration
        ref: "apps/worker/test/lobby.test.ts"
        status: pass
  - id: D3
    description: "The waiting room of the UI-SPEC: take, change and free a seat; the creator sets Rouge to Champion (seen live), moves Bruno to Vert (Bruno told), starts after « Lancer sans Céline ? »; Céline sees « La partie a déjà commencé »; a fifth person sees « La table est complète »; « Quitter la table » from Réglages; toasts « a rejoint » / « a quitté »"
    requirement: NET-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/salle.spec.ts (phone, desktop)"
        status: pass
      - kind: unit
        ref: "apps/web/src/net/notices.test.ts"
        status: pass
  - id: D4
    description: "Fits 1280 × 800, 1024 × 640 (computer), 844 × 390, 750 × 342, 667 × 375, 640 × 360 (two columns, no scroll, action row in view); one scrolling column at 568 × 320 and 480 × 320 with the action row visible at the top and at the bottom; upright → « Tourne ton téléphone », the room inert"
    requirement: NET-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/salle.spec.ts#the waiting room fits the target sizes"
        status: pass
  - id: D5
    description: "« Inviter à la table » opens by itself once for the creator; QR module count equals uqr's for the table link; share data (title, text, url); copy → clipboard and « Lien copié. »; refused copy → toast and the link selected; without navigator.share only « Copier le lien », primary; « Inviter » reopens, Échap returns the focus; a second device reaches the room by the copied link"
    requirement: NET-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/invitation.spec.ts (phone, desktop)"
        status: pass
      - kind: unit
        ref: "apps/web/src/no-raw-html.test.ts"
        status: pass

estimate:
  tokens: 150000
actuals:
  tokens: 25600    # chars/4 of the added lines of the plan's four commits (102 329 characters), lockfile excluded
  tasks: 3
  commits: 4       # git rev-list --count plan_head_before..HEAD before this SUMMARY
plan_head_before: 4a408bf018754db8c4e184a802d1aff681c36fe4
plan_head_after: 88db904e89a3b0baf05077317311d3934c3aa8cd

duration: 45min
completed: 2026-10-17
---

# Phase 2 Plan 05: La salle d'attente et l'invitation Summary

**The tracer's four seat buttons became the waiting room of the UI-SPEC: each person takes or frees a colour, the chef de table sets each computer's strength and moves or swaps people (all checked by the server, host only, before the start), starts after « Lancer sans … ? », and invites with « Inviter à la table » (the link, its uqr QR code drawn as one SVG path, share and copy), which opens by itself right after the creation.**

## What was built

- **Server rules (Task 1).** Four new client frames, strict zod objects: `stand`, `move { who, to }` (seat colours), `level { seat, level }` (the literals 1 to 5, never a string) and `leave`. The core: `stand` frees the seat; `sit` from a seat moves the person; `move` by the host goes to a free seat or swaps two people; `level` by the host on a free seat is saved at once and appears in every table frame; `leave` frees the seat and removes the person (the creator's record stays so the role comes back); an unseated `sit` at four people answers `table-full`; after the start `sit`, `stand`, `move` and `level` answer `started`. `TablePublic.unseated` lists the online people without a seat. A change of seat sends a welcome to whoever moved and a table frame to the others; an unseated newcomer's hello now tells the others too.
- **Toasts.** `tableNotices(prev, next, me)` compares two public tables: arrivals and departures counted by first name (two « Marie » count twice), never the device itself, and « {Créateur} a changé ta place : tu es maintenant {Couleur}. » only when this device did not ask for its own change and is not the host.
- **Waiting room (Task 2).** `WaitingRoom.svelte` with the three layouts of the UI-SPEC (the solo setup's structure and media queries), the 2 × 2 grid of `SeatTile`s (you / free / human / offline, crown, partner outline and « Partenaire », 150 ms content cross-fade, a button only when the tap does something), « Libérer ma place », the right column per viewer (creator: « Force de l’ordinateur » rows with the `seat` StrengthPicker or « Quatre joueurs à la table : pas d’ordinateur. », the count line « 2 joueurs et 2 ordinateurs. »; others: « En attente du départ » and « Rouge : ordinateur, Champion »; unseated: « Choisis ta place »; full: « La table est complète »), « Sans place : … », and the action row `[Réglages][Inviter][Lancer la partie]`. `MoveSheet` lists « Vers {Couleur} (place libre) » / « Échanger avec {Nom} ({Couleur}) ». `Notice` now draws every connecting and error screen of the table route. Réglages at an online table offers « Quitter la table » (confirmed) and hides « Tester les sons ».
- **Invitation (Task 3).** `QrCode.svelte` imports uqr when mounted, encodes the link at level L without border, draws the modules as one `<path>` in a viewBox of size + 8, walnut on cream, crisp edges, whole-pixel modules (164 px for the deployed link, version 4), with the loading square and « Code QR indisponible : partage le lien. ». `InviteSheet.svelte`: the link field selects itself, « Partager le lien » (share-2) through `navigator.share` with title « TOC » and « {Prénom} t’invite à une partie de TOC ! », « Copier le lien » (copy icon, primary without share), « Lien copié. » or the failure toast with the field selected. The home marks a just-created table in sessionStorage; the waiting room takes the mark and opens the sheet once.

## uqr chunk (production build)

- `dist/assets/dist-BsbcV6pe.js`: **10 072 bytes, 3 752 bytes gzip**, loaded only by `QrCode.svelte`'s `import("uqr")`. The main chunk (`index-*.js`, 372 324 bytes, 126 045 gzip) holds no uqr code (grep for its internals finds nothing).
- Embedded deploy dry run (`node tools/build-embedded-worker.mjs`, then `wrangler deploy -c wrangler.embarque.jsonc --dry-run` into a fresh outdir): 39 files embedded, `env.GAME_ROOM (GameRoom)`, total 2 140.18 KiB / gzip 1 192.99 KiB, `tools/check-bundle.mjs`: « bundle OK: 39 separate modules, all from the web build ». No deploy.

## Screenshots (looked at)

- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-05-salle-createur-1280x800.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-05-salle-createur-844x390.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-05-salle-invite-1280x800.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-05-salle-invite-844x390.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-05-salle-sansplace-1280x800.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-05-salle-sansplace-844x390.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-05-invitation-1280x800.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-05-invitation-844x390.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-05-invitation-partage-1280x800.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-05-invitation-partage-844x390.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-05-invitation-partage-750x342.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-05-invitation-partage-480x320.png
  (these four with a stand-in share sheet)

Taken against `wrangler dev` (Romain on Bleu, Marie-Charlotte on Rouge, Céline unseated, Vert set to Champion). What they showed and what changed after looking: the compact tile's check disc covered the chip (moved astride the corner); the QR caption wrapped to two lines and made the sheet scroll at 844 × 390 (now one line); at 750 × 342 « Copier le lien » was cut (below 420 px of height the sheet's text line is screen-reader only and the link and buttons are 4 apart, so both buttons are in view; the QR caption may still need a short scroll of the sheet body, and at 480 × 320 « Copier le lien » sits about 12 px under the fold when « Partager le lien » is also shown).

## Commits

| Commit | Type | What |
|--------|------|------|
| 8e9347e | test | RED: protocol lobby frames, lobby.test.ts, workerd lobby test, notices tests (stub) |
| 6ad9271 | feat | GREEN: protocol frames and table-full, core lobby commands, tableNotices, leak property with lobby commands, workerd waits by wall time |
| c0d941d | feat | Waiting room, SeatTile, MoveSheet, Notice, StrengthPicker seat variant, ConfirmDialog, Réglages online, salle.spec.ts |
| 88db904 | feat | uqr 0.1.3, QrCode, InviteSheet, auto-open after creation, toast above sheets, invitation.spec.ts |

## Verification (exact counts)

- `pnpm typecheck`: exit 0 (svelte-check 469 files, 0 errors, 0 warnings).
- `pnpm lint`: exit 0 (248 files).
- `pnpm test`: **70 files, 1 107 passed, 2 skipped** (baseline 1 082 + 25: protocol 2, table lobby 16, notices 6, workerd lobby 1; three new files).
- `pnpm exec vitest run --project worker`: 17 passed, three runs in a row after the wall-time wait.
- Online Playwright (`playwright.online.config.ts`, all specs): **24 passed, 0 failed** (baseline 12 + salle 8 + invitation 4).
- Full local Playwright (phone + desktop): **452 passed, 96 skipped, 0 failed** (includes launch, force, reglages: 80 passed when run alone).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, test] A 02-01 reducer test pinned the old silence on an unseated hello**
- **Found during:** Task 1 GREEN
- **Issue:** `reduce.test.ts` expected no frame to the creator when an unseated person says hello; the plan adds « Sans place » to the public table, so the others now get a table frame.
- **Fix:** the test expects that table frame with `unseated: ["Ana", "Ben"]`.
- **Commit:** 6ad9271

**2. [Rule 1 - Bug, test] Workerd waits counted polls, not time**
- **Found during:** Task 1 verify (`leak.test.ts` « timed out waiting for jaune's events after its act » in 1 of 3 runs of the worker project, the new lobby test running alongside)
- **Fix:** `until` in `apps/worker/test/leak.test.ts` and `next` in `helpers.ts` wait by wall time (60 s), as `bots.test.ts` has since 02-03. Three full worker runs green after.
- **Commit:** 6ad9271

**3. [Rule 3 - Blocking] Fixtures without `unseated`** — `apps/web/src/net/remoteGame.test.ts`'s TablePublic gained `unseated: []` (typecheck). Commit 6ad9271.

**4. [Rule 2 - Missing] The toast was under open sheets** — `Toast.svelte` z-index 50 → 65 (sheets are 60), else « Lien copié. » and the copy-failure toast hid behind « Inviter à la table » on phones. Not in the plan's file list. Commit 88db904.

**5. [Rule 1 - Bug, test] The online home spec met the sheet that now opens by itself** — `e2e-online/accueil.spec.ts` checks the sheet is open after the creation and closes it with « Fermer » before taking a seat (the 02-04 SUMMARY listed this auto-open as a stub for 02-05). Commit 88db904.

**6. [Scope] Files outside the plan's list** — `SettingsButton.svelte` passes `online` and `onleave` to the sheet (the room's gear); `packages/table/test/leak.test.ts` gains the lobby commands (stand and sit back, a move by a non-host, a level before the start; sit, stand, move or level during the game as noise) so the 02-02 property covers them; `apps/web/src/i18n/fr/bots.ts` and `reglages.ts` hold the new words.

**7. [Rule 1 - Layout] The invite sheet on low screens** — the UI-SPEC's height count left out the sheet's own « Fermer »; at 342 px and below the body would scroll past « Copier le lien ». Below 420 px of height the text line is visually hidden (still read) and the right column's gaps are 4, so both buttons are in view at 750 × 342; the QR caption is one line. At 480 × 320 the body still scrolls a little (see Screenshots).

### Other notes

- uqr's default border is 1 module; QrCode asks for `border: 0` and draws the 4-module quiet zone itself, and the e2e compares with `encode(link, { ecc: "L", border: 0 }).size`.
- Stray `wrangler dev` processes: a first `kill` of the pnpm wrapper left wrangler and workerd running, and one online run reused that server with a stale build (it failed, then passed once the tree was stopped by PID and the config rebuilt). Every count above comes from runs with a fresh build.

## Known Stubs

None that blocks this plan's goal. Planned later: the reconnect banner and plate in the waiting room (02-06), « Messages » in the action row and bubbles over the tiles (02-08), the creator role's hand-over while the creator is away (02-06).

## Threat Flags

None beyond the plan's threat model: the new surface is the four lobby frames (T-02-19, T-02-20, T-02-21 mitigated in the core and tested at three levels), the QR path from booleans (T-02-22, no-raw-html.test.ts green), uqr exact and in its own chunk (T-02-SC).

## À confirmer par Romain

- A seat freed by a person keeps the strength the chef de table had chosen for that colour (Galopeur by default) instead of always going back to Galopeur.
- Leaving the waiting room with « Quitter la table » also removes the table from « Mes parties en cours » on that device.

## Self-Check: PASSED

- Files: packages/table/src/lobby.test.ts, apps/worker/test/lobby.test.ts, apps/web/src/net/notices.ts, apps/web/src/routes/WaitingRoom.svelte, apps/web/src/ui/SeatTile.svelte, MoveSheet.svelte, Notice.svelte, InviteSheet.svelte, QrCode.svelte, apps/web/e2e-online/salle.spec.ts, invitation.spec.ts: all present.
- Commits 8e9347e, 6ad9271, c0d941d, 88db904: all ancestors of HEAD.
- Acceptance greps: `not-host` in lobby.test.ts, `tableNotices` in notices.ts, `data-seat-state` in SeatTile.svelte, « Lancer sans » and « La partie a déjà commencé » in i18n/fr/table.ts, `"uqr": "0.1.3"` in apps/web/package.json, `import("uqr")` in QrCode.svelte, `data-invite-sheet` in InviteSheet.svelte, `data-seat-tile` in WaitingRoom.svelte.
