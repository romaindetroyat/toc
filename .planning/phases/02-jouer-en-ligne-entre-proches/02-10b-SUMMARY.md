---
phase: 02-jouer-en-ligne-entre-proches
plan: 10b
status: complete
subsystem: online-table
tags: [avance-rapide, pace, protocol, durable-object, settings, playwright]

requires:
  - phase: 02-jouer-en-ligne-entre-proches
    provides: "02-03 server-paced computers (speedOf, scheduleBot, thinkTick), 02-06 derived host (hostOf), 02-08 online chrome (« Avance rapide » hidden), the slow-online-bots alarm fix"
provides:
  - "Table.fast: the table-wide « Avance rapide », server-owned, in the SQLite snapshot, off by default, kept by the rematch"
  - "Client frame speed { fast } (zod, strict), the derived chef de table only, else not-host"
  - "TablePublic.fast; PROTOCOL_VERSION 5"
  - "speedOf(table) = fast when on (zero test pace stays test): fast think time (<= 300 ms), FAST_HARD_CAP_MS, waitMs = eventsDuration(events, \"fast\")"
  - "« Réglages » switch (chef de table; others disabled), gear badge [data-fast-badge], waiting-room line [data-fast-line], toasts « {Nom} a mis / a enlevé l’avance rapide. »"
  - "Online pages animate in fast mode while the table is fast; settings.tableFast remembers the creator's choice for new tables"
affects: [02-UAT, phase-02-verification]

tech-stack:
  added: []
  patterns:
    - "A table-wide setting: server-owned flag in Table, public in TablePublic, set by a host-only frame through hostOf, announced by notices.ts"

key-files:
  created:
    - .planning/phases/02-jouer-en-ligne-entre-proches/02-10b-PLAN.md
    - packages/table/src/fast.test.ts
    - apps/web/src/ui/tableSpeed.ts
    - apps/web/e2e-online/avance.spec.ts
  modified:
    - packages/protocol/src/frames.ts
    - packages/protocol/src/frames.test.ts
    - packages/table/src/table.ts
    - packages/table/src/bots.ts
    - packages/table/src/reduce.ts
    - packages/table/src/frames.ts
    - packages/table/src/index.ts
    - apps/worker/test/pace.test.ts
    - apps/worker/test/*.test.ts (hello v 5)
    - apps/web/src/game/session.svelte.ts
    - apps/web/src/net/notices.ts
    - apps/web/src/settings/settings.ts
    - apps/web/src/i18n/fr/reglages.ts
    - apps/web/src/i18n/fr/table.ts
    - apps/web/src/ui/SettingsSheet.svelte
    - apps/web/src/ui/SettingsButton.svelte
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/routes/WaitingRoom.svelte
    - .planning/phases/02-jouer-en-ligne-entre-proches/02-UI-SPEC.md

decisions:
  - "PROTOCOL_VERSION 5: a version-4 page would strip TablePublic.fast and animate at the normal speed while the table plays fast, so its moves would lag ever further behind (02-07 / 02-09 rule)"
  - "The switch lives in « Réglages » (first row), where the chef de table's « Arrêter la partie » already is; the others see it disabled with the chef de table's name"
  - "The indicator is a 20 px badge on the « Réglages » gear (it exists in every layout and points at the switch), plus a line in the waiting room"
  - "A switch applies from the next computer decision (the wait and think time are fixed when due / decided); a Champion reads its cap at each slice"
  - "Speed may be switched in every status (lobby, playing, paused, saved, finished) by the derived host"

metrics:
  duration: "about 75 min (after the 02-10 wait)"
  completed: 2026-10-17

actuals:
  tokens: 23000
  tasks: 5
  commits: 9
plan_head_before: 6a5d9597accc5df8d69ee9d2910d5a66c4f4b07a
plan_head_after: 85f463cc96a70a4b0dc462d9b63bfef74a343f4e
---

# Phase 2 Plan 10b: table-wide « Avance rapide » Summary

**Romain's « Oui, ajoute l’avance rapide » (2026-10-17): the chef de table switches a server-owned `Table.fast` from « Réglages ». The computers then think at the fast pace (at most 300 ms) and wait for the fast animations. Every page plays the moves fast and shows a badge on the gear. The others get a toast « Ana a mis l’avance rapide. ». Protocol 5.**

## What changed

- **Protocol** (`packages/protocol`): the client frame `{ t: "speed", fast: boolean }` (strict zod), `TablePublic.fast` (required in the server schema), `PROTOCOL_VERSION` 5.
- **Server** (`packages/table`): `Table.fast` (createTable false; copyTable `??= false` for older snapshots; untouched by the rematch). `setSpeed` in reduce: only `hostOf(table)` may switch it, else `not-host`; the same value sends nothing; in any other case everyone online gets the table frame. `speedOf` returns `"fast"` when on, and `"test"` under the zero pace whatever the flag. `waitMs` is `eventsDuration(events, speed)`. `thinkTick` was already pace-generic (`paceFor`, `hardCap`).
- **Web**: `createSession(…, tableFast)` animates online in fast mode while `table.fast` is on (reduced motion still wins; the local game is unchanged). In « Réglages », the first row is the `Switch` « Avance rapide »: the chef de table can switch it, the others see it disabled with « Seul le chef de table, {Nom}, peut la changer. ». The gear carries `[data-fast-badge]` and the accessible name « Réglages (avance rapide pour toute la table) ». The waiting room shows the line « Avance rapide pour toute la table. ». `notices.ts` adds the « a mis / a enlevé » toasts to both the lobby and the game for everyone but the chef de table. `settings.tableFast` remembers the chef de table's last choice, and a table this device just created sends it once (the invite sheet's new-table mark).

## Measured fast-mode computer turns (workerd, real pace, alarms as in production)

`apps/worker/test/pace.test.ts`, « Avance rapide on: each Galopeur plays within 0.3 s of the fast animation ». Two people and two Galopeurs; the chef de table switches the mode on before the start.

| seat | seq | delay after the due commit | fast animation | delay − animation |
|------|-----|----------------------------|----------------|-------------------|
| rouge | 7 | 578 ms | 360 ms | 218 ms |
| vert | 8 | 472 ms | 360 ms | 112 ms |
| rouge | 11 | 866 ms | 759 ms | 107 ms |
| rouge | 14 | 806 ms | 546 ms | 260 ms |
| rouge | 17 | 700 ms | 480 ms | 220 ms |
| rouge | 20 | 321 ms | 140 ms | 181 ms |

Budget asserted: fast animation + `FAST_CEILING_MS` (300) + 250 ms slack. Every turn came within the fast animation plus 107 to 260 ms. The pure test in `fast.test.ts` asserts `now − dueAt ≤ eventsDuration(last, "fast") + 300` for every computer turn of a game in play.

## Gate (at 85f463c)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | 0 errors (web: 493 files) |
| `pnpm lint` | Biome, 285 files, clean |
| `pnpm test` | Vitest 85 files, **1 332 passed, 2 skipped** (the 2 skips are the engine's scenario alternatives, there before this plan) |
| Full local Playwright | **455 passed, 99 skipped, 0 failed** (7.3 min), the same as 02-10 |
| Full online Playwright (`playwright.online.config.ts`) | **48 passed, 0 failed** (8.4 min): the 46 from 02-10 plus avance.spec × 2 |
| Port 8787 after the runs | free |

## Screenshots (looked at)

- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-10b-reglages-1280x800.png`: the switch on, in the first row of « Réglages », with its helper; the badge visible on the gear behind.
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-10b-reglages-844x390.png`: the same on the phone held sideways.
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-10b-badge-1280x800.png`: Bea's page with the badge on the gear in the info column and the toast « Ana a mis l’avance rapide. ».
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-10b-badge-844x390.png`: the badge at the top of the right strip and the toast over the board.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Web test fixtures needed the new required field**
- **Found during:** Task 2 (typecheck)
- **Issue:** `TablePublic.fast` is required, so four web unit-test fixtures (chat, notices, plate, remoteGame) no longer typechecked.
- **Fix:** I added `fast: false` to each one, in the server GREEN commit.
- **Commit:** 07586a3

**2. [Rule 1 - Test expectation] The settings test for an older stored object**
- **Found during:** Task 4
- **Issue:** The new `tableFast` field defaults to false, and the exact `toEqual` on an older object did not list it.
- **Fix:** I added `tableFast: false` to the expected object.
- **Commit:** 85f463c

**3. Process: one RED commit was amended**
- **Issue:** I amended the UI RED commit (ed37f7f → e7fbbec) for a Biome formatting fix. It had already been pushed by the orchestrator. After its note, I made no more amends; the orchestrator reconciles the branch.

### Plan notes

- The protocol GREEN commit (30b5fde) left `@toc/table` failing the typecheck until the server GREEN commit (07586a3), because `tablePublic` did not yet build the new field. Vitest does not typecheck, so each RED/GREEN pair behaved as intended.

## Known Stubs

None.

## Threat Flags

None. The new `speed` frame is a strict zod object and is checked host-only in the reducer (`not-host`). It carries no secret, and the public flag is a boolean.

## Self-Check: PASSED

- Files exist: 02-10b-PLAN.md, fast.test.ts, tableSpeed.ts, avance.spec.ts.
- Commits are ancestors of HEAD: 7456f22, 20fcaf4, eb24086, 30b5fde, 95a911b, 07586a3, bf8ccab, e7fbbec, 85f463c.
