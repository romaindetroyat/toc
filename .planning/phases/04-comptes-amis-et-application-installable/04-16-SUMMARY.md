---
phase: 04-comptes-amis-et-application-installable
plan: 16
subsystem: pwa
tags: [gap, pwa, update, app-02, d-09, service-worker, sheet, focus, tdd]
status: complete

requires:
  - phase: 04
    provides: "the prompt update flow of 04-08 (update.svelte.ts, rules.ts canPromptUpdate, the home strip, the in-game line in « Réglages »); Sheet.svelte's focus handling (phase 1, 02-07); the verifier's two-tab probe (04-VERIFICATION.md)"
provides:
  - "update.svelte.ts onNeedReload: only the tab that asked (« Mettre à jour », or the 4002 « Recharger la page ») reloads on the controller change; every other tab is marked takenOver and keeps running"
  - "bringNewVersion: SKIP_WAITING when a worker waits, else a reload at once (the new version already controls this page)"
  - "Sheet.svelte: the focus goes back to the opener on teardown only when the body or this sheet holds it"
  - "e2e-pwa: the two-tab update test; e2e reglages: the sheet focus race test"
affects: [phase-04-verification, app-02, web-ui]

actuals:
  tokens: 3000
  tasks: 3
  commits: 2
plan_head_before: eadd75d0eedf7d50f293eb8ab62c261b3f9160a9
plan_head_after: b84a11367fd3e4ea19334006bb6dd8b05f1cf707

tech-stack:
  added: []
  patterns:
    - "vite-plugin-pwa prompt mode: an onNeedReload of our own, since the library's default reloads every tab that saw the waiting worker"
    - "A page that outlives its worker (taken over by a newer one) updates by a plain reload, not by SKIP_WAITING"
    - "Focus return on teardown only when the focus is free (body, or still inside the closing dialog)"

key-files:
  created: []
  modified:
    - apps/web/src/pwa/update.svelte.ts
    - apps/web/src/ui/Sheet.svelte
    - apps/web/e2e-pwa/pwa.spec.ts
    - apps/web/e2e/reglages.spec.ts
    - .planning/phases/04-comptes-amis-et-application-installable/deferred-items.md

key-decisions:
  - "A tab outside a game that did not ask is not reloaded either: it keeps the strip « Nouvelle version disponible », and its « Mettre à jour » reloads at once. The player did not ask there, and may be in the middle of something (a friend code typed in « Mes amis », the solo setup, « Mon compte »)."
  - "The old code running under the new worker is safe: the release build has three lazy chunks, workbox-window (loaded at start), uqr (QrCode, a content-hashed third-party chunk whose name only changes with uqr or the bundler; a failed import shows the QR's « failed » state) and the bench (#/banc). Cards, knights and fonts are content-hashed too, and a running game has already loaded them."

requirements-completed: [APP-02]

duration: 40min
completed: 2026-11-06
---

# Phase 4 Plan 16: an update never reloads another tab's game; sheet focus Summary

**« Mettre à jour » in one TOC tab now reloads that tab only: a solo game or a table in another tab keeps running and offers the update once it is back on the home. A sheet that closes no longer takes the focus from a confirmation opened while it slides out.**

## Performance

- **Duration:** about 40 min
- **Completed:** 2026-11-06
- **Tasks:** 3 (RED, GREEN, gate)
- **Files modified:** 4 code and test files, plus deferred-items.md

## Accomplishments

- The gap from 04-VERIFICATION.md (truth 4b, APP-02 with two tabs) is closed. The verifier's probe `deux-onglets.spec.ts` now prints `GAME TAB SAME DOCUMENT AFTER UPDATE IN OTHER TAB: true … nav: reload` and passes. Its `reload` comes from its own `controlled()` reload, before the update.
- The two-tab path is in the PWA suite. On both projects, the home applies the update and reloads into v2. The game tab keeps its document (`navigation.type` stays « navigate », marker kept), its board and its hand, with no strip, and « Réglages » still shows the in-game line. Once back on the home, that tab shows the strip, and « Mettre à jour » reloads it into v2.
- The 4002 « Recharger la page » goes through the same `bringNewVersion`. A table whose tab was taken over by another tab's update reloads at once instead of posting SKIP_WAITING to nobody.
- The deferred Sheet focus race is fixed and has its own test.

## Task Commits

1. **Task 1: RED, the two-tab update test and the sheet focus test**: `92c068a` (test)
2. **Task 2: GREEN, onNeedReload and the Sheet focus guard**: `b84a113` (fix)
3. **Task 3: gate, the deferred item marked resolved, this SUMMARY**: the docs commit that follows

## RED evidence

- `e2e-pwa/pwa.spec.ts` « « Mettre à jour » dans un onglet ne recharge pas la partie d’un autre onglet (APP-02) » failed on phone and desktop at `expect(await sameDocument(game)).toBe(true)`: the game tab had been reloaded.
- `e2e/reglages.spec.ts` « abandon: une confirmation ouverte pendant que les crédits se ferment garde le focus sur « Continuer à jouer » » failed on phone and desktop at the second `toBeFocused()`, after the credits were gone: « Continuer à jouer » was "inactive" because the focus had moved to the dialog. The test opens the confirmation while three layers are up (Réglages, the credits sliding out, the confirmation), so it exercises the race every time.

## Gate

Run one after another, never at the same time. Ports 8787, 4173 and 4174 were free before and after each run (checked by connecting to them).

| Check | Result |
|-------|--------|
| `pnpm typecheck && pnpm lint && pnpm test` | 0 errors (581 files in svelte-check); Biome 377 files clean; Vitest 117 files, **1 890 passed, 2 skipped** |
| Full local Playwright | **461 passed, 99 skipped, 0 failed** (7.0 min); 459 at 04-15, plus the 2 new runs of the focus test |
| PWA Playwright | **12 passed** (30 s); 10 at 04-15, plus the 2 new runs of the two-tab test |
| Online Playwright | **108 passed, 0 failed** (8.1 min), on the first run |
| `amis.spec.ts:197` with `amis-table.spec.ts`, phone, 2 workers, `--repeat-each=10` | **20 of 20 passed** (2.4 min) |
| Verifier probe `verif04/pw/deux-onglets.spec.ts` | passed |

## Decisions Made

- **A tab outside a game that did not ask keeps the prompt and is not reloaded.** The plan left this to the executor. That tab already shows « Nouvelle version disponible ». Since the new worker already controls it, its « Mettre à jour » reloads at once. A reload nobody asked for could drop work in progress there: a friend code being typed, the solo setup, a passkey step in « Mon compte ». The backup code screen is still protected by `holds`.
- **How an old page applies the update:** `bringNewVersion` posts SKIP_WAITING when `registration.waiting` holds a worker, and the reload then follows on the controller change. When nothing is waiting, it reloads directly. That happens when the registration is known, or when the page was taken over. Before this plan, a taken-over tab would have stayed on « Mise à jour… » for good.
- **What an old page under the new worker needs** (the verifier's second "missing" item). In the release build, three chunks load later than the app itself:
  - `workbox-window`, already loaded at start;
  - `uqr` (the QR code), a content-hashed third-party chunk whose name stays the same across builds unless uqr or the bundler changes. If its import fails, `QrCode.svelte` shows its "failed" state and the link text stays usable;
  - the bench (`#/banc`).

  Card SVGs, knight PNGs and fonts are content-hashed, and a game in progress has already loaded them. Nothing else is fetched lazily, so no extra handling is needed.

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] « Mettre à jour » in a tab that was taken over**
- **Found during:** Task 2
- **Issue:** Once another tab has applied the update, nothing is waiting any more. `updateSW(true)` posts SKIP_WAITING to nobody, so neither the game tab (back on the home) nor a table's 4002 « Recharger la page » would reload.
- **Fix:** `bringNewVersion` (above), shared by `applyUpdate` and `applyUpdateOrReload`. The two-tab test covers the game tab's later update.
- **Files modified:** apps/web/src/pwa/update.svelte.ts
- **Commit:** b84a113

**2. The two-tab test's game tab is opened as a first load.** Following the plan's "navigation type stays navigate", the home tab is made controlled (with its reload) and the game is then opened in a fresh page. The verifier's probe made the game tab controlled by reloading it, so its type was already « reload ».

**3. No STATE.md / ROADMAP.md / REQUIREMENTS.md updates.** The exec prompt forbids touching STATE.md and ROADMAP.md. The orchestrator tracks progress.

## Screenshots

None. The plan adds no screen and changes no layout: the strip, the in-game line and the sheets look exactly as at 04-15.

## Deploy notes

- Nothing to configure: no wrangler change, no migration, no secret, no package. Durable Object migration tag v1 is untouched.
- The fix protects updates *from* the build that ships it onward. The tabs decide what to do with their own code, so the update *to* this build is still handled by the old pages' code. When a player applies it, every open TOC tab of that browser still reloads, this one time. Every later update reloads only the tab that asks.

## For Romain to confirm

- With two TOC tabs or windows, « Mettre à jour » in one leaves a game in the other alone. A second tab on the home (or « Mon compte », « Mes amis », the solo setup) does not reload by itself either: it keeps showing « Nouvelle version disponible » until « Mettre à jour » is tapped there. Say if you would rather have such tabs reload on their own.

## Known Stubs

None.

## Next Phase Readiness

- Truth 4b of 04-VERIFICATION.md can be re-verified: both the probe and the committed two-tab test pass. The real-device update check (UAT 16, 34) is still for Romain after a deploy.

## Self-Check: PASSED

- Commits 92c068a and b84a113 are ancestors of HEAD.
- The four modified code and test files exist; no stub patterns in the changed source.
