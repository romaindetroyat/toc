---
phase: 02-jouer-en-ligne-entre-proches
plan: 07
status: complete
subsystem: online-table
tags: [resume, reconnect, expiry, reclaim, durable-objects, alarms, deleteAll, svelte5, playwright, workerd]

requires:
  - phase: 02-jouer-en-ligne-entre-proches
    provides: "02-06 presence, pause, derived chef de table (hostOf), saved status, PROTOCOL_VERSION 2, TablePlate, the client heartbeat; 02-04 the summary and « Mes parties en cours »; 02-02 the leak oracle and property"
provides:
  - "@toc/protocol v3: client frames stop, reclaim { seat }, reclaimAnswer { seat, accept }; server frames reclaimRequest { seat, name } (chef de table only) and reclaimResult { accepted } (asker only); TableSummary.missing"
  - "@toc/table: EXPIRY_MS (30 days) as the expire deadline, armed at creation, re-armed when it fires early, Reduced.purge when idle; activity = an accepted hello or client frame; stop (chef de table, playing or paused, any phase); leave in a game = offline + pause; reclaims per seat (who, typed name, since)"
  - "GameRoom: a purge closes every socket with 4004 then ctx.storage.deleteAll() (storage and alarm); create() arms the expiry alarm"
  - "Client: connection.link none/banner/plate (2 s, 10 s), lastDownMs, serverError, reconnect(); plate.ts connectionState, closeNotice, the connection plate first; the reconnect banner (data-reconnect-banner); « Arrêter la partie » and in-game « Quitter la table » in « Réglages »; notices serveur, demande, refusee, « C’est moi, {Nom} »; ReclaimDialog; « En pause : on t’attend »"
  - "e2e-online/reprise.spec.ts (phone, desktop)"
affects: [02-08, 02-09, 02-10]

tech-stack:
  added: []
  patterns:
    - "Activity is stamped once in reduce() (a hello or client frame that changed the table), never in individual handlers, so ticks and socket closes never push the 30-day clock"
    - "A reducer result may ask the shell for an irreversible effect (purge); the Durable Object performs it and caches nothing afterwards"
    - "Frames that follow the derived host (reclaimRequest) are re-sent by reduce() whenever the host changes or the host says hello"
    - "This device's own connection is state of the connection (downSince + timers at 2 s and 10 s), worded by a pure function (connectionState)"

key-files:
  created:
    - packages/table/src/resume.test.ts
    - apps/worker/test/resume.test.ts
    - apps/web/src/ui/ReclaimDialog.svelte
    - apps/web/e2e-online/reprise.spec.ts
  modified:
    - packages/protocol/src/frames.ts
    - packages/protocol/src/frames.test.ts
    - packages/table/src/table.ts
    - packages/table/src/reduce.ts
    - packages/table/src/presence.ts
    - packages/table/src/summary.ts
    - packages/table/src/index.ts
    - packages/table/src/oracle.ts
    - packages/table/src/summary.test.ts
    - packages/table/test/leak.test.ts
    - apps/worker/src/GameRoom.ts
    - apps/worker/test/{api,bots,leak,lobby,pause,room}.test.ts (hello v 3)
    - apps/web/src/net/connection.svelte.ts
    - apps/web/src/net/plate.ts
    - apps/web/src/net/plate.test.ts
    - apps/web/src/net/tables.ts
    - apps/web/src/net/tables.test.ts
    - apps/web/src/net/api.ts
    - apps/web/src/net/api.test.ts
    - apps/web/src/routes/Table.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/routes/WaitingRoom.svelte
    - apps/web/src/ui/TablePlate.svelte
    - apps/web/src/ui/TableList.svelte
    - apps/web/src/ui/SettingsSheet.svelte
    - apps/web/src/ui/SettingsButton.svelte
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/ui/Sheet.svelte
    - apps/web/src/i18n/fr/table.ts
    - apps/web/src/i18n/fr/reglages.ts

key-decisions:
  - "PROTOCOL_VERSION 2 → 3: a version-2 chef de table would drop reclaimRequest and leave the asker waiting forever; older pages get 4002 and « Nouvelle version du jeu ». The DO migration tag v1 is unchanged; no new migration."
  - "Activity (the 30-day clock and the home row's « il y a… ») = a hello or a client frame the table accepted; a computer's move on a tick no longer counts."
  - "A reclaim is refused at once (reclaimResult { accepted: false }) when the seat is online, not a person's, already asked for, when the asker is seated or already asked for another seat, in the waiting room, or when there is no chef de table to ask. A wrong answer frame gets an error code (not-host, refused)."
  - "Accepted: the asker holds the seat, the old person record is removed (their token later says hello unseated), the creator role follows the creator's seat, a handed-over seat is regained (welcome.regained), the pause ends if nobody else is missing."
  - "A pending reclaim survives the asker going offline (a blip); it is dropped when the seat's own player returns (the asker reads « Demande refusée »)."
  - "« Jouer ici » opens a new connection (not a page reload); « Quitter la table » in a game keeps the table in « Mes parties en cours »."
  - "« La table ne répond pas » covers the server's bad-frame and a 5xx from GET /api/tables/:id, asked once the connection has been slow for 10 s (tableHealth); a browser cannot read the status of a failed WebSocket upgrade."

requirements-completed: [NET-02, HIST-01]

coverage:
  - id: D1
    description: "Reload or network loss → the welcome deep-equals viewFor of the stored game (hand, deal, knights, turn); no event replay"
    requirement: NET-02
    verification:
      - kind: unit
        ref: "packages/table/src/resume.test.ts"
        status: pass
      - kind: integration
        ref: "apps/worker/test/resume.test.ts (eviction, reconnect, 4001, 4002)"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e-online/reprise.spec.ts (reload, setOffline, second tab)"
        status: pass
  - id: D2
    description: "The chef de table stops at any moment; the game resumes days later exactly; the home lists it « Sauvegardée »"
    requirement: HIST-01
    verification:
      - kind: unit
        ref: "packages/table/src/resume.test.ts (stop, read again 3 days later, resume)"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e-online/reprise.spec.ts (storageState, « Reprendre la partie »)"
        status: pass
  - id: D3
    description: "30 idle days: purged by the alarm (deleteAll, 4004, 404); 29 days resumes, 31 purges; early firing re-arms"
    requirement: HIST-01
    verification:
      - kind: unit
        ref: "packages/table/src/resume.test.ts"
        status: pass
      - kind: integration
        ref: "apps/worker/test/resume.test.ts (sqlite_master empty, getAlarm null, GET 404, late socket 4004)"
        status: pass
  - id: D4
    description: "Host-approved reclaim of one's own offline seat; never an online seat, never without the host's yes"
    requirement: NET-02
    verification:
      - kind: unit
        ref: "packages/table/src/resume.test.ts"
        status: pass
      - kind: property
        ref: "packages/table/test/leak.test.ts (208 reclaims, 85 accepted, 101 refused; 562 stops, 994 leaves)"
        status: pass
      - kind: integration
        ref: "apps/worker/test/resume.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e-online/reprise.spec.ts"
        status: pass
  - id: D5
    description: "Own connection: nothing < 2 s, banner 2–10 s, plate after 10 s; connection > saved > pause"
    requirement: NET-02
    verification:
      - kind: unit
        ref: "apps/web/src/net/plate.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e-online/reprise.spec.ts (banner after ~2.1 s, plate after ~10.2 s)"
        status: pass

estimate:
  tokens: 150000
actuals:
  tokens: 27600    # chars/4 of the added lines of the plan's five commits (110 356 characters)
  tasks: 3
  commits: 5       # git rev-list --count plan_head_before..HEAD before this SUMMARY
plan_head_before: cd5250833fc84809f915a400f92841dfb13bcd0a
plan_head_after: b2dfc4ea831ff6007ae846cb27ea1fdfd728a420

duration: 55min
completed: 2026-10-17
---

# Phase 2 Plan 07: Recharger, perdre le réseau, arrêter et reprendre des jours après Summary

**The welcome snapshot is now the guaranteed resync after a reload, a network loss or a second tab. The chef de table can stop the game at any moment from « Réglages ». Anyone can leave a game, which pauses it for the others. The same link or « Mes parties en cours » brings back the exact game. A table idle for 30 days deletes itself through its own alarm (deleteAll, 4004, 404). A player who began in another app gets their own seat back with « C’est moi, {Nom} », once the chef de table says « Rendre sa place ».**

## What was built

- **Server (Task 1).**
  - **Protocol version 3.** Three new client frames: `stop`, `reclaim`, `reclaimAnswer`. Two new server frames: `reclaimRequest` and `reclaimResult`. The summary gains `missing`.
  - **Expiry deadline.** `deadlines.expire` is armed at the creation and taken into `nextDeadline`. It fires at most about once every 30 days: early, it moves to `lastActivity + EXPIRY_MS`; at or past that time the tick answers `purge`.
  - **Old snapshots.** A snapshot from before this plan gets its expiry at its next change.
  - **Purge in `GameRoom`.** It forgets the person on every socket, closes them with 4004, then awaits `ctx.storage.deleteAll()`. That also deletes the alarm at our compatibility date (verified: `sqlite_master` is empty and `getAlarm()` is null).
  - **Reclaims.** One pending reclaim per seat. Pending requests are sent again to whoever becomes chef de table, or to the chef de table on their hello.
  - **Leak property.** It now drives stops, refused stops, in-game leaves and reclaims (accepted and refused). The oracle knows the two reclaim frames.
- **Client (Task 2).**
  - **The connection** tracks `downSince`. It is set by a non-final close, by the browser's `offline` event (which also pings at once) and by `pagehide`. Timers at 2 s and 10 s move `link`. The welcome clears it and records `lastDownMs`. Back online after a drop, the socket is reopened so that a welcome always comes. `remoteGame` already resets the Director on every welcome.
  - **In the game:** `data-reconnect-banner` replaces the prompt row (phone) or the action zone (computer), and the board, hand and state buttons are inert. `TablePlate` shows `data-plate="connection"` before any other plate.
  - **In the waiting room:** the same banner under the heading, the seats inert, and the same plate after 10 s.
  - **Notices:** « La table ne répond pas », « C’est ta place ? » with one « C’est moi, {Nom} » per offline seat, « Demande envoyée » and « Demande refusée ». The chef de table gets `ReclaimDialog`: a Sheet that a tap outside does not close, with « Refuser » focused.
  - **« Réglages » online:** « Arrêter la partie » (chef de table only, confirmed by « Arrêter la partie ? ») and the in-game « Quitter la table ? ». « Abandonner la partie » never shows online.
  - **Home:** « En pause : on t’attend » comes from the summary's missing colours.
- **E2E (Task 3).** `reprise.spec.ts` covers reload, `setOffline`, a second tab, stop then resume from `storageState`, the in-game leave, and the reclaim refused then accepted.

## setOffline: what detected the drop

Chromium's `context.setOffline(true)` did **not** close the socket. The client's ping, sent at the `offline` event, got no pong. After `PONG_MS` the client reconnected: the first close came **5 003 to 5 008 ms** after `setOffline`, with code 1006, in all six runs.

The banner showed after 2 071 to 2 130 ms and the plate after 10 165 to 10 256 ms. The server did not see the drop meanwhile: Bruno saw no pause in that window. It would see it on the 75 s sweep, or when Ana's new hello closes her old socket.

## Screenshots (looked at)

Taken by `reprise.spec.ts` with `TOC_SHOTS` against `wrangler dev`, at 1280 × 800 (desktop project) and 844 × 390 (phone project):

- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-07-bandeau-1280x800.png and 02-07-bandeau-844x390.png (reconnect banner)
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-07-connexion-perdue-1280x800.png and -844x390.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-07-mes-parties-1280x800.png and -844x390.png (« Sauvegardée · maintenant »)
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-07-arreter-1280x800.png and -844x390.png (« Arrêter la partie ? »)
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-07-sauvegardee-1280x800.png and -844x390.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-07-ailleurs-1280x800.png and -844x390.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-07-cest-moi-1280x800.png and -844x390.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-07-rendre-sa-place-1280x800.png and -844x390.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-07-refusee-1280x800.png and -844x390.png

What they show:
- The banner pill sits centred in the phone's prompt row and at the right of the computer's action zone.
- The connection plate is centred on the board with its two buttons on one line.
- The French typography is right: « Arrêter la partie ? », « 30 jours », « «  Bruno  » ».

Two toasts in the shots are older ones still within their 4 s:
- « Bruno a rejoint la table. » from the waiting room, under the stop and reclaim dialogs on the computer.
- « De retour à la table. » on the « Partie ouverte ailleurs » notice.

Nothing was changed after looking.

## Commits

| Commit | Type | What |
|--------|------|------|
| 4d70036 | test | RED: protocol v3 frames, table resume.test.ts, leak property with stops/leaves/reclaims, oracle frames, workerd resume.test.ts |
| 16a9df2 | feat | expiry, stop, in-game leave, reclaim in the core; purge with deleteAll and the creation alarm in GameRoom |
| ee14510 | test | RED: connectionState, connection plate priority, closeNotice, rowStatus |
| 6d3e070 | feat | own connection banner/plate, online « Réglages », notices, reclaim UI and ReclaimDialog, « on t’attend » |
| b2dfc4e | test | reprise.spec.ts |

## Verification (exact counts)

- `pnpm typecheck`: exit 0 (svelte-check 476 files, 0 errors, 0 warnings).
- `pnpm lint`: exit 0 (257 files).
- `pnpm test`: **75 files, 1 214 passed, 2 skipped**, against 1 167 + 2 at the end of 02-06. The first gate run had 1 failure, which did not recur; see Deferred Issues. The next three runs were all green.
- `pnpm exec vitest run --project worker`: 7 files, 24 passed.
- Full local Playwright (phone + desktop): **455 passed, 99 skipped, 0 failed** on the second run. The first run had 1 timing failure, see Deferred Issues.
- Online Playwright (`playwright.online.config.ts`, all specs): **34 passed, 0 failed** (28 before + reprise.spec.ts 6). `reprise.spec.ts` also passed `--repeat-each 2` on both projects (12/12) and once more with screenshots.
- The suites ran one after another. Nothing listens on 8787 afterwards (checked in /proc/net/tcp).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PROTOCOL_VERSION 2 → 3**
- **Found during:** Task 1.
- **Issue:** a version-2 chef de table would drop `reclaimRequest`, and the asker would wait forever.
- **Fix:** bumped to version 3. The worker tests send `v: 3`. No DO migration changes.
- **Commits:** 4d70036, 16a9df2

**2. [Rule 1 - Bug] The pause plate's focus stole the reclaim dialog's focus**
- **Found during:** Task 3.
- **Issue:** the plate's choices appearing under the open « Rendre sa place à … ? » dialog took the focus from « Refuser ».
- **Fix:** `focusFirst` does nothing while a Sheet is open.
- **Commit:** 6d3e070

**3. [Rule 2 - Missing] Files outside the plan's list**
- Leak instruments: `oracle.ts` knows the reclaim frames, and `leak.test.ts` drives stops, leaves and reclaims (T-02-31).
- `Sheet.svelte`: `focusClose`, so « Refuser » can be focused without being the primary button.
- Settings plumbing: `InfoBar.svelte` and `SettingsButton.svelte` pass `onstop`, `onleave` and `inGame`.
- `WaitingRoom.svelte`: the banner and the plate there.
- `api.ts`: `tableHealth` for the 5xx case.
- `reglages.ts`: « Arrêter la partie ».
- Test fixtures given the summary's new `missing` field: `summary.test.ts`, `api.test.ts`, `tables.test.ts`.
- **Commits:** 4d70036, 16a9df2, 6d3e070

**4. [Scope] Reclaim refusals**
- A reclaim refused at once uses the same `reclaimResult { accepted: false }` as the chef de table's « Refuser ». This covers an online seat, a seated asker, a duplicate request and a table without a chef de table. The asker always ends on « Demande refusée ».
- An asker may have only one pending request at a time.

**5. [Scope] Activity no longer includes a computer's move**
- The home row's « il y a … » now follows the people only.

### Deferred Issues

- One unidentified failure in the first full `pnpm test` gate run (1 213 passed, 1 failed). It did not recur in the three runs that followed, so I could not identify which test it was. The likely suspects are the wall-clock-bound workerd tests run alongside the CPU-heavy Node tests.
- One timing failure in the first full local Playwright run. `animations.spec.ts` « la bannière de donne reste 1,2 s » measured 1 951 ms against a 1 600 ms limit, under two parallel workers. This is a local game test that this plan does not touch. It passed 6/6 alone, and the full rerun was green.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model:
- **T-02-28:** a reclaim works only for an offline person's seat, only for an unseated asker, with one pending per seat and per asker, and only on the derived host's accept. The dialog quotes the typed name and focuses « Refuser ».
- **T-02-30:** expiry is tested at 29 and 31 days, and when it fires early it is re-armed.
- **T-02-31:** only the welcome resyncs, with no event replay; the leak property re-ran with the new commands.
- **T-02-32:** version 3 closes older clients with 4002.
- **T-02-SC:** no package added.

## À confirmer par Romain

- **Tables saved before this deploy.** A table saved before this plan has no expiry deadline until its next change (open its link once). Until then nothing deletes it.
- **A real network loss.** Like `setOffline` here, it is noticed by the server only on the 75 s sweep or on the player's reconnection. Meanwhile the others do not see the pause. The 02-06 thresholds are still to be tuned on real phones.
- **Reclaim of a computer-played seat.** A seat the computer plays because its player is away (handed over) can also be reclaimed. The new device then gets it back from the computer.

## Self-Check: PASSED

- Files present:
  - packages/table/src/resume.test.ts
  - apps/worker/test/resume.test.ts
  - apps/web/src/ui/ReclaimDialog.svelte
  - apps/web/e2e-online/reprise.spec.ts
- Commits 4d70036, 16a9df2, ee14510, 6d3e070 and b2dfc4e are all ancestors of HEAD.
- Acceptance greps pass:
  - `deleteAll` in GameRoom.ts
  - `EXPIRY_MS` in the table core
  - `data-reconnect-banner` in Game.svelte
  - « Rendre sa place » in ReclaimDialog.svelte
  - « Partie ouverte ailleurs » in i18n/fr/table.ts
  - `setOffline` and `storageState` in reprise.spec.ts
