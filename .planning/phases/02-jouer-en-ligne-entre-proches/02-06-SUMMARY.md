---
phase: 02-jouer-en-ligne-entre-proches
plan: 06
status: complete
subsystem: online-table
tags: [presence, pause, durable-objects, alarms, hibernation, websocket-heartbeat, svelte5, playwright, workerd]

requires:
  - phase: 02-jouer-en-ligne-entre-proches
    provides: "02-01 the table reducer, frames, GameRoom and the client connection; 02-02 the leak oracle and property; 02-03 the online computers and their deadline; 02-05 the waiting room, the StrengthPicker seat variant, tableNotices"
provides:
  - "@toc/protocol v2: client frames pause { choice wait|bot|save, level? (bot only) } and resume; TablePublic.status paused|saved, pause { missing, since, choiceAt, choosing } | null, seats[c].handedOver, now (server clock); WelcomeFrame.regained; error codes paused, refused; CLOSE_SILENT 4000; test option pauseMs (500 to 60 000)"
  - "@toc/table presence.ts: PAUSE_MS 60 000, SWEEP_MS 30 000, SILENCE_MS 75 000, HANDOVER_LEVEL 3, hostOf (derived), onGone, onHello, onPauseChoiceDue, applyChoice, resume, wantsSweep; deadlines bot | pauseChoice | sweep (nextDeadline = min); computerLevel (a handed-over seat plays as a computer)"
  - "GameRoom: every alarm first closes sockets silent for SILENCE_MS (getWebSocketAutoResponseTimestamp, else helloAt) with 4000 and runs gone"
  - "Client: connection ping 20 s / pong 5 s / pagehide 1000 / pageshow-visible-online reconnect / 4000 reconnects / serverOffset; plate.ts plateFor; gameNotices; TablePlate, TablePlayers, SeatBadges; StrengthPicker « handover » form; « {Nom} (ordinateur) » names"
  - "e2e-online/pause.spec.ts (phone, desktop)"
affects: [02-07, 02-08, 02-09, 02-10]

tech-stack:
  added: []
  patterns:
    - "Presence is a reducer concern: gone / hello / tick move the table between playing, paused and saved; the Durable Object only turns socket closes and silent sockets into gone"
    - "One tick handles every due deadline (sweep, pauseChoice, bot); reduce() keeps the sweep deadline armed exactly while a game runs or waits with a seated person online"
    - "The host is derived on every frame (hostOf), never stored: the creator in the waiting room; in a game the creator when online, else the next seated person online clockwise"
    - "Client toasts of the game are derived from two public tables in a row (gameNotices); the returning player's own toast comes from welcome.regained"
    - "Focus on content that appears is given by a mount action on the element, not by a bound reference read after tick() (that reference may be set a microtask later)"

key-files:
  created:
    - packages/table/src/presence.ts
    - packages/table/src/presence.test.ts
    - apps/worker/test/pause.test.ts
    - apps/web/src/net/plate.ts
    - apps/web/src/net/plate.test.ts
    - apps/web/src/ui/TablePlate.svelte
    - apps/web/src/ui/TablePlayers.svelte
    - apps/web/src/board/SeatBadges.svelte
    - apps/web/e2e-online/pause.spec.ts
  modified:
    - packages/protocol/src/frames.ts
    - packages/protocol/src/frames.test.ts
    - packages/table/src/table.ts
    - packages/table/src/reduce.ts
    - packages/table/src/frames.ts
    - packages/table/src/bots.ts
    - packages/table/src/index.ts
    - packages/table/src/bots.test.ts
    - packages/table/src/lobby.test.ts
    - packages/table/test/leak.test.ts
    - apps/worker/src/GameRoom.ts
    - apps/worker/test/helpers.ts
    - apps/worker/test/leak.test.ts
    - apps/worker/test/{api,bots,lobby,room}.test.ts (hello v 2)
    - apps/web/src/net/connection.svelte.ts
    - apps/web/src/net/remoteGame.ts
    - apps/web/src/net/notices.ts
    - apps/web/src/net/notices.test.ts
    - apps/web/src/net/remoteGame.test.ts
    - apps/web/src/game/session.svelte.ts
    - apps/web/src/routes/Game.svelte
    - apps/web/src/routes/Table.svelte
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/ui/StrengthPicker.svelte
    - apps/web/src/ui/Toast.svelte
    - apps/web/src/board/Board.svelte
    - apps/web/src/i18n/fr/table.ts
    - apps/web/e2e-online/online.ts

key-decisions:
  - "PROTOCOL_VERSION 1 → 2: the status gains paused and saved (an older page drops those frames) and the server now closes sockets that never ping after 75 s, which a version-1 page would take as final (it stopped reconnecting on any code ≥ 4000). A page from before is closed with 4002 and shows « Nouvelle version du jeu » (already handled). The DO migration tag v1 is unchanged."
  - "The derived host (D-05) applies once the game has started; in the waiting room the creator keeps the role even while offline (the 02-05 rule « nobody else may start or move people meanwhile »)."
  - "No pause once the game is won (the rematch is 02-09); a gone while the host is choosing and nobody seated is left online saves the game at once (the same rule as at the end of the minute)."
  - "« Pas encore là » on the saved plate lists the seated people offline whose seat is not handed over (a handed-over seat plays on when the game resumes)."
  - "French elision in the new copy: « En attente d’Ana… », « jusqu’au retour d’Ana » (table.of)."
  - "The returning player's toast « Tu reprends ta place. … » rides on the welcome (regained: true); the others read « {Nom} reprend sa place. » from the table diff."

requirements-completed: [NET-03, NET-04]

coverage:
  - id: D1
    description: "A seated person not handed over who goes (socket closed, or silent 75 s) pauses the game in every phase, exchange included: no computer runs, acts answer paused, the minute is a pauseChoice deadline (alarm); a second missing seat joins without moving it"
    requirement: NET-03
    verification:
      - kind: unit
        ref: "packages/table/src/presence.test.ts"
        status: pass
      - kind: integration
        ref: "apps/worker/test/pause.test.ts (workerd, evictions, alarm, 4000 sweep)"
        status: pass
  - id: D2
    description: "After the minute the derived host chooses wait / bot (level, Galopeur by default) / save; anyone else gets not-host, before the minute refused; resume plays on or restarts the pause flow; nobody online at the end of the minute saves"
    requirement: NET-04
    verification:
      - kind: unit
        ref: "packages/table/src/presence.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e-online/pause.spec.ts (phone, desktop)"
        status: pass
  - id: D3
    description: "Return: the pause ends when nobody is missing; a handed-over seat is given back at once and its pending computer move dropped; the role passes clockwise while the creator is away and comes back"
    requirement: NET-04
    verification:
      - kind: unit
        ref: "packages/table/src/presence.test.ts; apps/web/src/net/notices.test.ts"
        status: pass
      - kind: integration
        ref: "apps/worker/test/pause.test.ts"
        status: pass
  - id: D4
    description: "No frame leaks a card through pauses, choices and resumes (the 02-02 property drives them: 1 484 pauses, 166 waits, 361 hand-overs, 177 saves, 518 resumes over 200 tables)"
    requirement: NET-03
    verification:
      - kind: property
        ref: "packages/table/test/leak.test.ts"
        status: pass
      - kind: integration
        ref: "apps/worker/test/leak.test.ts"
        status: pass
  - id: D5
    description: "The plates, « À la table », the rider badges, « Partie en pause », toasts at the top of the board; plates fit 480 × 320, 750 × 342, 844 × 390, 1280 × 800; the computer's bar 154.8 px with its fourth row, board 1 227 px at 1280 × 800"
    requirement: NET-04
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/pause.spec.ts"
        status: pass
      - kind: unit
        ref: "apps/web/src/net/plate.test.ts"
        status: pass

estimate:
  tokens: 160000
actuals:
  tokens: 33150    # chars/4 of the added lines of the plan's five commits (132 612 characters)
  tasks: 3
  commits: 5       # git rev-list --count plan_head_before..HEAD before this SUMMARY
plan_head_before: cdc0d0ab81270644fceb7e6d506d4e5925350f82
plan_head_after: 21b69b51db70a5d339f968dce012a91434ec62b1

duration: 75min
completed: 2026-10-17
---

# Phase 2 Plan 06: Un joueur s'absente — la pause pour tous, puis le choix du chef de table Summary

**When a seated player's socket closes (or stays silent 75 s while the client pings every 20 s), the server pauses the game for everyone in every phase; one minute later, by Durable Object alarm, the chef de table (the creator, or the next person online clockwise) chooses to wait, to hand the seat(s) to the computer at a chosen strength, or to save; a returning player gets the seat back at once. Every device shows the plate with a countdown counted from the server's clock, the three choices, the saved plate with « Reprendre la partie », the players list « À la table » and wifi-off / bot badges on the riders.**

## What was built

- **Server (Task 1).** `presence.ts` holds the state machine (playing → paused → playing / saved → playing or paused) and `hostOf`. The table gains `pause`, `deadlines.pauseChoice` and `deadlines.sweep`, and a person's seat gains `handedOver` (a level). `dueBot`, `stillDue` and `scheduleBot` treat a handed-over seat as a computer at that level, so the Champion's slicing and pacing apply unchanged. `tick` handles every due deadline in one call (sweep re-arms, pause minute → choosing or saved, then the computer). `reduce()` keeps the sweep deadline armed exactly while a game runs or waits with a seated person online. The frames carry the pause block, `handedOver` per seat, the derived host's seat and the server's `now`. A welcome that gave a seat back says `regained: true`. In `GameRoom`, every alarm first closes, with 4000, each socket whose last sign of life is older than 75 s. That is its auto-response timestamp, or its hello when it never pinged. The object then runs `gone` for each such person who has no other open socket. No timer anywhere in the object or the core.
- **Client (Task 2).** The connection pings every 20 s. With no pong within 5 s it reconnects. It closes with 1000 on `pagehide` and reconnects on `pageshow`, on a visible tab and on `online`. The 4000 code is reconnected, while 4001, 4002 and 4004 still end the connection. `serverOffset` is measured on every table frame. `plateFor` is pure and words the pause for one, two or three names. Its countdown line « Dans 0:42, tu pourras / {Hôte} pourra choisir la suite. » uses `choiceAt − (now + offset)`. It also covers « {Hôte} choisit la suite… », the chef de table's « {A} n’est pas de retour. Que veux-tu faire ? » and the saved plate. `TablePlate` is the UI-SPEC plate:
  - **Look:** bois sombre, radius 16, sharp 4 px shadow, width min(440, board − 16), centred on the board and clamped 8 px in the viewport, over a 30 % walnut veil on the board only.
  - **Motion:** in 200 ms (12 px + fade), out 150 ms; 150 ms fades under reduced motion.
  - **Content and focus:** a hidden countdown, a polite live region, three stacked buttons with the focus on the first, and the level step (StrengthPicker's new `handover` form, Galopeur by default, `[Retour][Confier la place]`). The saved plate shows `[Retour à l’accueil][Reprendre la partie]` for the chef de table, and « {Hôte} peut reprendre la partie. » for the others.
  - **Behaviour:** every plate button wakes the sound.
  - **Under the plate:** the board, the hand, the state buttons, the 7's and tray chips and « Avance rapide » are inert. The prompt row or action zone says « Partie en pause ». Game shortcuts are ignored except « ? », and toasts stand at the top of the board.
  - **Names:** `gameNotices` produces the choice toasts, the return toasts and the three chef-de-table toasts. A handed-over seat reads « {Nom} (ordinateur) » in the turn line, the thinking prompt and the bot sentence, because the session's names are now state. Turn-line names are cut at 128 px with the full name in `title`.
- **Players and badges (Task 3).** `TablePlayers` lists four 48 px rows. Each has the chip, the name cut at 160 px, the tags (toi, partenaire, adversaire, crown and chef de table) and the state line (en ligne / hors ligne with wifi-off / hors ligne · l’ordinateur joue à sa place (Pur-sang) with bot / ordinateur · {Niveau}), plus one hidden sentence per row. It appears as a section of « Infos de la partie » on the phone. On the computer it opens from a 44 px `users` button on a fourth row of the bar. `SeatBadges` draws 24 px discs on the riders through a new `badges` layer of `Board`, over the thinking glow and under the knights.

## Measurements

- Computer bar with the fourth row: info column **154.8 px** (≤ 160) at 1280 × 800 and 1024 × 640; board **1 226.8 px** at 1280 × 800 (unchanged), 920.1 px at 1024 × 640.
- Plate fit (pause.spec.ts): inside the viewport and never wider than min(440, board − 16) at 480 × 320, 750 × 342, 844 × 390 and 1280 × 800, for the pause plate and the saved plate.
- Veil: `rgba(43, 29, 18, 0.3)`, z 39, exactly the board's box.

## Screenshots (looked at)

- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06-pause-1280x800.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06-pause-844x390.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06-choix-1280x800.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06-choix-844x390.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06-force-1280x800.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06-force-844x390.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06-sauvegardee-1280x800.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-06-sauvegardee-844x390.png

These were taken by pause.spec.ts with `TOC_SHOTS` set, against `wrangler dev`. The desktop project gives 1280 × 800 and the phone project resizes to 844 × 390. Ana is on Bleu, Bruno on Jaune, with computers on Rouge and Vert. What they showed:
- The plate sits centred over the felt and the « Partie en pause » line takes the prompt's place.
- The wifi-off badge is on the missing player's rider.
- The `users` button sits on the bar's fourth row.
- At 844 × 390 the three choices fill the plate's width on one line each, and the level step shows the five horse names inline.
- The saved plate wraps its body in two lines at 440 px.

One thing was changed after looking: the turn line read « Tour d’ Ana ». The row's flex gap split the prefix from a name that starts with a vowel, a phase-1 defect made visible by first names. The prefix and the name now share one box, and the retaken saved screenshot reads « Tour d’Ana ».

## Commits

| Commit | Type | What |
|--------|------|------|
| 66e6858 | test | RED: protocol pause/resume and v2, presence.test.ts, workerd pause.test.ts, test clients ping |
| 9605dd0 | feat | presence.ts, reducer routing and tick, frames, GameRoom sweep, leak property with pauses |
| c563494 | test | RED: plate.test.ts, gameNotices, handed-over names |
| c5c19fc | feat | connection heartbeat and page life, plate.ts, TablePlate, Game/Table wiring, toasts, names |
| 21b69b5 | feat | TablePlayers, InfoBar « À la table », SeatBadges, focus actions, « Tour d’Ana », pause.spec.ts |

## Verification (exact counts)

- `pnpm typecheck`: exit 0 (svelte-check 475 files, 0 errors, 0 warnings).
- `pnpm lint`: exit 0 (254 files).
- `pnpm test`: **73 files, 1 167 passed, 2 skipped**, against a baseline of 1 107 passed + 2 skipped. The new test cases written: presence 26, plate 9, protocol 3, gameNotices 4, remoteGame 1, workerd pause 1. Three new test files were added. The run's +60 was not broken down further.
- `pnpm exec vitest run --project worker`: 6 files, 18 passed.
- Online Playwright (`playwright.online.config.ts`, all specs): **28 passed, 0 failed** (baseline 24 + pause.spec.ts 4). This includes tracer.spec.ts. pause.spec.ts also passed on its own in four more runs (two of them with screenshots).
- Full local Playwright (phone + desktop, including compact.spec.ts and ecrans.spec.ts): **452 passed, 96 skipped, 0 failed**. It was run twice, the second time after the InfoBar change.
- No `wrangler dev` left behind: nothing listens on 8787 after the runs (checked in /proc/net/tcp). Playwright started and stopped its own server.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] An older client would be swept and never reconnect: PROTOCOL_VERSION 1 → 2**
- **Found during:** Task 1. A version-1 page never pings, so the new sweep closes it with 4000. Its connection treated every code ≥ 4000 as final and it would stay stuck. It also drops frames whose status is paused or saved.
- **Fix:** version 2. Old pages get 4002 and the existing « Nouvelle version du jeu » notice. The client reconnects on 4000. Worker tests send `v: 2`.
- **Commits:** 66e6858, 9605dd0, c5c19fc

**2. [Rule 3 - Blocking] Workerd test clients never pinged**
- **Issue:** long workerd tests (a whole game) would have their socket swept after 75 s.
- **Fix:** `helpers.ts` clients send "ping" every 10 s and skip the "pong". `connect(id, {}, { ping: false })` keeps a client silent for the sweep test.
- **Commit:** 66e6858

**3. [Rule 1 - Bug, test] Existing tests met the pause**
- `bots.test.ts` expected no deadline while a person is due; it now expects only the sweep.
- `lobby.test.ts` gains `handedOver: null` in the public seat.
- The pure leak property now drives pauses, minutes, the three choices, non-host choices and resumes.
- The workerd leak test brings Ben back while the game waits for him.
- **Commit:** 9605dd0

**4. [Rule 1 - Bug] The plate's first choice was not focused one time in two**
- **Found during:** Task 3, pause.spec.ts.
- **Issue:** a `bind:this` reference read after `tick()` could still be null.
- **Fix:** the focus is given by mount actions on the first choice and on the level picker.
- **Commit:** 21b69b5

**5. [Rule 1 - Bug, pre-existing] « Tour d’ Ana » in the turn line**
- **Issue:** the flex gap split the elided prefix from the name.
- **Fix:** the prefix and the name share one box, and the prefix keeps its trailing space (`white-space: pre`).
- **Commit:** 21b69b5

**6. [Plan wording vs UI-SPEC] Bruno's toast when Ana leaves.** The plan's e2e text has Bruno read « Bruno est chef de table jusqu’au retour d’Ana. ». The UI-SPEC gives the new chef de table « Tu es chef de table jusqu’au retour de {Créateur}. », and the spec checks that line on Bruno's page. The others read « Bruno est chef de table … » (notices.test.ts).

**7. [Rule 2 - Missing] Files outside the plan's list**
- `session.svelte.ts`: names are state, so « (ordinateur) » follows the table.
- `Toast.svelte`: sits at the top of the board while a plate is up (UI-SPEC).
- `Board.svelte`: a `badges` layer between the glow and the knights.
- `Table.svelte`: the regained toast and the connection passed to Game.
- `online.ts`: the `pauseMs` option.
- `remoteGame.test.ts` and `notices.test.ts`: fixtures with the new fields.

**8. [Scope] The lobby keeps the creator as host.** The derived host applies once the game has started, because the 02-05 lobby tests and rule require it.

### Other notes

- « Avance rapide » is still shown online. It is inert under a plate. The UI-SPEC hides it online and gives its slot to « Messages », which is plan 02-08's change.
- The reconnect banner and the connection plate (data-plate="connection") are plan 02-07's, as its plan states.

## Known Stubs

None that blocks this plan's goal.

## Threat Flags

None beyond the plan's threat model:
- **T-02-24:** hostOf is checked in the core, and non-host choices are refused in unit, property and e2e tests.
- **T-02-26:** one live socket per person (4001), and silent sockets are closed after 75 s by the alarm sweep (workerd test).
- **T-02-27:** public fields only (handedOver level, pause colours and times, now), and the leak property passes with pauses.
- **T-02-SC:** no package added.

## À confirmer par Romain

- The thresholds 20 s / 75 s / 30 s (ping / silence / sweep) are to be tuned on real phones at UAT (A3).
- « Pas encore là » on the saved plate omits a player whose seat the computer was already playing.
- A game that is won is not paused when a player leaves (the rematch comes with 02-09).

## Self-Check: PASSED

- Files present:
  - packages/table/src/presence.ts and presence.test.ts
  - apps/worker/test/pause.test.ts
  - apps/web/src/net/plate.ts and plate.test.ts
  - apps/web/src/ui/TablePlate.svelte and TablePlayers.svelte
  - apps/web/src/board/SeatBadges.svelte
  - apps/web/e2e-online/pause.spec.ts
- Commits 66e6858, 9605dd0, c563494, c5c19fc and 21b69b5 are all ancestors of HEAD.
- Acceptance greps pass:
  - `pauseChoice` and `PAUSE_MS` in presence.ts
  - `getWebSocketAutoResponseTimestamp` in GameRoom.ts
  - `data-plate` in TablePlate.svelte
  - `pagehide` in connection.svelte.ts
  - « Confier sa place à l’ordinateur » and « chef de table » in i18n/fr/table.ts
  - `data-seat-badge` in SeatBadges.svelte
