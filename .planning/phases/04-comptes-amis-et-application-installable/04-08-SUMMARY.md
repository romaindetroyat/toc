---
phase: 04-comptes-amis-et-application-installable
plan: 08
subsystem: pwa
tags: [pwa, service-worker, vite-plugin-pwa, workbox, injectManifest, splash, install, offline, web-push]

requires:
  - phase: 04-comptes-amis-et-application-installable
    provides: "04-01: vite-plugin-pwa 2.0.0, workbox-precaching 7.4.1, workbox-window 7.4.1; 02-04b: the logo and icons; 04-07: pwa/platform.ts, the push payload { t, title, body, url, tag }, GET /api/push/key and POST /api/push/subscriptions"
provides:
  - "apps/web/src/sw.ts → dist/sw.js: precache of the build (38 entries in production), no runtime route, SKIP_WAITING on the page's message only, every push shown, notificationclick on our origin only, pushsubscriptionchange"
  - "pwa/rules.ts: canPromptUpdate, inGameUpdateLine, applyOrReload, stripFor, toc.install.v1 (INSTALL_HIDE_MS, installHiddenRecord, readInstallHidden), appleCanInstall"
  - "pwa/update.svelte.ts: pwaUpdate { needRefresh, dismissed, busy, holds }, startUpdates, checkForUpdate, applyUpdate, applyUpdateOrReload, holdUpdates, currentPlace"
  - "pwa/install.svelte.ts: install { prompt, apple, standalone, hiddenUntil }, startInstall, hideInstall, canInstall, promptInstall"
  - "ui/HomeStrip.svelte (data-home-strip offline | update | install, data-install-via prompt | apple), ui/InstallSheet.svelte (data-install-sheet)"
  - "« Réglages »: « Installer l’application » (data-install-app) and the in-game update line (data-update-line)"
  - "account.reachable: false when GET /api/me got no answer at all"
  - "manifest orientation landscape, id /, categories games; 21 iOS launch screens (tools/build-icons.mjs DEVICES, splashName, splashMedia)"
  - "playwright.pwa.config.ts + e2e-pwa/pwa.spec.ts: the one suite with service workers allowed; every other suite blocks them"
affects: [04-09, 04-10, 04-11, 04-12]

estimate:
  tokens: 180000
  tasks: 3
actuals:
  tokens: 25200
  tasks: 3
  commits: 7
plan_head_before: c96340b7e4dac9195b1cad5baef15a5869ea3f80
plan_head_after: be5de70a66d687b9d58abdd1ca38651946cd77fd

tech-stack:
  added: []
  patterns:
    - "Pure rules (rules.ts) for where an update may be offered and which strip shows; the $state stores only hold what the browser said"
    - "A screen that must never be reloaded holds the updates through an $effect (holdUpdates, written with untrack)"
    - "Service workers blocked in every Playwright config and every hand-made context; one config allows them"
    - "A test serves its own copy of the build (node:http, free port) to change sw.js and watch the update flow"
    - "Push delivery in e2e through CDP ServiceWorker.deliverPushMessage on the session that enabled the domain"

key-files:
  created:
    - apps/web/src/sw.ts
    - apps/web/tsconfig.sw.json
    - apps/web/tsconfig.e2e-pwa.json
    - apps/web/src/pwa/rules.ts
    - apps/web/src/pwa/rules.test.ts
    - apps/web/src/pwa/splash.test.ts
    - apps/web/src/pwa/update.svelte.ts
    - apps/web/src/pwa/install.svelte.ts
    - apps/web/src/ui/HomeStrip.svelte
    - apps/web/src/ui/InstallSheet.svelte
    - apps/web/src/i18n/fr/appli.ts
    - apps/web/public/splash (21 PNG)
    - tools/build-icons.d.mts
    - apps/web/playwright.pwa.config.ts
    - apps/web/e2e-pwa/pwa.spec.ts
  modified:
    - apps/web/vite.config.ts
    - apps/web/package.json
    - apps/web/tsconfig.json
    - apps/web/src/main.ts
    - apps/web/src/routes/Table.svelte
    - apps/web/src/routes/Home.svelte
    - apps/web/src/routes/Launch.svelte
    - apps/web/src/ui/SettingsSheet.svelte
    - apps/web/src/ui/BackupCodeScreen.svelte
    - apps/web/src/account/store.svelte.ts
    - apps/web/src/i18n/fr/reglages.ts
    - apps/web/src/ui/icons.ts
    - apps/web/index.html
    - apps/web/public/manifest.webmanifest
    - apps/web/playwright.config.ts
    - apps/web/playwright.online.config.ts
    - apps/web/e2e-online/online.ts
    - apps/web/e2e/launch.spec.ts
    - tools/build-icons.mjs
    - tools/copy-vendor-assets.mjs
    - tools/wrangler-configs.test.ts

key-decisions:
  - "The update is offered only on #/, #/compte, #/amis and #/ordinateur, never while a backup code is on screen; applyUpdate itself refuses elsewhere (defence in depth). The 4002 notice is the one path that applies at a table"
  - "The offline strip comes from navigator.onLine or a GET /api/me that got no answer at all; a 404, a 5xx or HTML (the local preview's proxy answers 502) is an answer"
  - "iOS launch screens are 16-colour PNGs with the home's rounded corners: 0.8 MB for 21 screens instead of 1.9 MB, so the embedded Worker stays at 2.1 MB gzip, under the Free plan's 3 MB"
  - "The debug parameters' chunk is precached (debug builds only): the debug build's game loads it at every start and could not start offline without it"
  - "The solo setup shows only the update strip (the APP-02 table lists it), at the bottom of its right column on the computer and in two columns, after the header otherwise"
  - "Another iOS browser (Chrome, Firefox, Edge) gets the install steps from iOS 16.4; Safari always"

patterns-established:
  - "Every new Playwright context passes serviceWorkers: block (deviceOptions does it for the online suite)"

requirements-completed: [APP-01, APP-02, ACCT-05]

coverage:
  - id: D1
    description: "Where an update may be offered, the in-game line, the 4002 apply-or-reload, the strip priority, the 30-day install delay and its storage, which Apple browsers can install"
    requirement: APP-02
    verification:
      - kind: unit
        ref: "apps/web/src/pwa/rules.test.ts (46 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "One landscape launch screen per DEVICES entry, linked in order, every file linked once and sized to its screen; the iOS meta tags; the manifest's new and kept fields"
    requirement: APP-01
    verification:
      - kind: unit
        ref: "apps/web/src/pwa/splash.test.ts (7 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The embedded entry serves /sw.js as JavaScript and the manifest with no-cache, hashed assets immutable, a missing dotted path 404; the web build carries sw.js at its root"
    verification:
      - kind: unit
        ref: "tools/wrangler-configs.test.ts (2 new tests)"
        status: pass
      - kind: integration
        ref: "wrangler deploy --dry-run -c wrangler.embarque.jsonc + tools/check-bundle.mjs; local wrangler dev of the embedded variant, headers read with curl"
        status: pass
    human_judgment: false
  - id: D4
    description: "Registration and control; the precache (shell, fonts, knights; no bench, splash or /api); the offline start with a solo game played from #/ordinateur; a new version that waits during a game then « Mettre à jour » on the home under the new worker; a push shown with its title, body and tag; the served manifest and icons"
    requirement: APP-01, APP-02, APP-03, ACCT-05
    verification:
      - kind: e2e
        ref: "apps/web/e2e-pwa/pwa.spec.ts (5 tests × 2 projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Install from a real iPhone, iPad and Android phone, the splash on device, a real push when the app is closed"
    verification: []
    human_judgment: true
    rationale: "Device-only behaviour (04-RESEARCH A1, A2, A8); UAT in 04-12"

duration: about 45 min of work (10:21 to 11:10 UTC, gate included)
completed: 2026-10-18
status: complete
---

# Phase 4 Plan 08: L’application installable Summary

**TOC now has its own service worker, built by vite-plugin-pwa in injectManifest mode. It precaches the build and never touches /api or /ws. It waits for the player before updating: « Nouvelle version disponible » shows only on the home and the pages around it, never in a game, at a table or while a backup code is on screen. In a game, « Réglages » says the version will install back on the home. The worker shows every push, and a tap opens the table. The app installs with a landscape manifest and 21 iOS launch screens (the logo on the walnut). The home's strip says when the network is gone, when a version waits, or how to install TOC: the browser's prompt on Android and computer, Safari's steps on iPhone and iPad. Offline, the installed app starts from its precache and plays a full game against the computer.**

## Performance

- **Duration:** about 45 minutes of work, including the gate. The local Playwright suite took 7.3 min, the online suite 8.1 min and the PWA suite 35 s.
- **Tasks:** 3. Tasks 1 and 2 are RED then GREEN, then Task 3 and two fixes.
- **Files:** 56 (36 created, including 21 splash PNGs; 20 modified).

## Accomplishments

### The service worker and the update flow (Task 1)

- **`vite.config.ts`:**
  - VitePWA uses `strategies: injectManifest` with `src/sw.ts`.
  - `registerType: prompt`, `injectRegister: false`, `manifest: false` (the manifest stays `public/manifest.webmanifest`), dev options off.
  - `globIgnores` leaves out the bench, the geometry overlay and `splash/**`.
  - **Precache in production: 38 entries, 2 069 KiB.** The debug build has 39 (the debug parameters' chunk).
  - The « inlineDynamicImports option is deprecated » warning is printed during the SW build. It is harmless (04-RESEARCH).
- **`sw.ts`:**
  - `cleanupOutdatedCaches` and `precacheAndRoute`. There is no runtime route and no fetch handler of our own.
  - `SKIP_WAITING` is handled only as a message from the page. There is no `clientsClaim` and no automatic `skipWaiting`.
  - **push** always calls `showNotification` with the payload's title, body and tag, `icon /icons/icon-192.png`, `lang fr` and `data.url`. The fields are capped. A payload that is not JSON shows « TOC ».
  - **notificationclick** resolves the URL against the worker's own origin, so another origin opens the home (T-04-62). It focuses an open window and navigates it, else it opens one.
  - **pushsubscriptionchange** fetches `/api/push/key`, subscribes with `userVisibleOnly`, and POSTs `/api/push/subscriptions` with the cookie.
  - It is type-checked by `tsconfig.sw.json` (webworker lib). `dist/sw.js` has no import or export statement, so it registers as a classic worker.
- **`pwa/rules.ts` (pure):**
  - `canPromptUpdate` is true on `#/`, `#/compte`, `#/amis` and `#/ordinateur`. It is false in a game, at any table, at `#/invitation`, at `#/secours`, on other pages, and whenever a backup code is on screen.
  - `inGameUpdateLine` is true at `#/partie` and at `#/table/<id>`.
  - `applyOrReload` decides for the 4002 notice: apply a waiting worker, else look for one and apply it, else reload.
- **`pwa/update.svelte.ts`:**
  - `registerSW({ immediate, onNeedRefresh, onRegisteredSW })` runs once from `main.ts`, in every build. Errors are silent.
  - New versions are looked for on `visibilitychange` to visible, never on a timer. That also clears « Plus tard ».
  - `applyUpdate()` refuses where the rules do. Otherwise it calls `updateSW(true)`, which posts SKIP_WAITING and reloads on the controller change.
  - `applyUpdateOrReload()` serves the 4002 notice. A worker that is installing after `registration.update()` is waited for at most 10 s, then the page reloads.
  - `holdUpdates()` is used by `BackupCodeScreen` while it is shown.
- **`Table.svelte`:** the « Nouvelle version du jeu » notice's « Recharger la page » calls `applyUpdateOrReload`.
- **Harness:** `serviceWorkers: "block"` is set in `playwright.config.ts`, in `playwright.online.config.ts`, in `deviceOptions()` (every hand-made context of the online suite) and in `launch.spec.ts`'s own `newContext`. A grep found no other `newContext`.

### The icon, the splash, « Installer TOC » and the strips (Task 2)

- **Manifest:** it gains `"orientation": "landscape"`, `"id": "/"` and `"categories": ["games"]`. Every 02-04b field is unchanged.
- **`index.html`:**
  - `apple-mobile-web-app-title` « TOC » and `apple-mobile-web-app-status-bar-style` `black-translucent`.
  - One `apple-touch-startup-image` per device, in the order of `DEVICES`, each with `(orientation: landscape)`.
- **`tools/build-icons.mjs`:**
  - `DEVICES` lists 12 iPhone sizes (iPhone 8 to the 17 Pro Max and the Air) and 9 iPad sizes. Each is the CSS size held upright, with its ratio.
  - Each launch screen is drawn landscape at its pixel size: the logo with the home's 22 % rounded corners, centred on #2B1D12, its side 30 % of the height, no text.
  - The PNGs use a 16-colour palette: **813 KB for all 21**. With 256 colours they weighed 1.9 MB, which would have put the embedded Worker over 3 MB gzip. I looked at the result and the logo reads well.
  - The existing icons are regenerated byte for byte (git shows no change).
- **`rules.ts`:**
  - `stripFor`: offline > update > install (`install-prompt` or `install-apple`) > none. It never shows install in standalone mode, nor before `installHiddenUntil`.
  - `toc.install.v1` holds `{ hiddenUntil }` for 30 days. Damaged values are ignored.
  - `appleCanInstall`: Safari always; Chrome, Firefox, Edge, Opera or the Google app on iOS from 16.4; never on a Mac without touch.
- **`install.svelte.ts`:** it keeps `beforeinstallprompt` (preventDefault). « Installer » shows the browser's prompt. Accepted gives the toast « TOC est installé. Ouvre-le depuis ton écran d’accueil. »; dismissed hides the strip 30 days. `appinstalled` clears the prompt.
- **`HomeStrip.svelte`:**
  - It uses the UI-SPEC values only: bois sombre, radius 12, the 40 % border, padding 8 with the border inside, Label 700 text, secondary buttons 44 high, and the x « Plus tard » at 44 × 44.
  - Offline and update are `role="status"`. Install is a `section` named « Installer TOC ».
  - The text and the buttons wrap onto two rows by flex-wrap when they do not fit.
  - In: 200 ms (8 px up + fade). Out: 150 ms fade. Reduced motion: 150 ms fades.
- **`InstallSheet.svelte`:** the intro, then three ordered steps with 28 px cream discs and the `share` / `square-plus` glyphs inline (aria-hidden). Step 4 shows only when signed in.
- **Placement:**
  - **Home:** at the bottom of the right column on the computer and in two columns; after the header in one column and in portrait.
  - **`#/ordinateur`:** the update strip only (see deviations).
  - **« Réglages »:** « Installer l’application » between « Crédits et licences » and the game links while installing is possible, and the update line under the switches in a game or at a table.
- **Icons:** four Lucide icons were added through `copy-vendor-assets.mjs`: refresh-cw, download, share and square-plus. `app.css` has no new custom property (acceptance check passes).

### Strip measured (Chromium 1194)

| Viewport | Layout | Strip | Size |
|----------|--------|-------|------|
| 844 × 390 | two columns, right column 480 | offline | 480 × 56 (one row) |
| 844 × 390 | two columns | update | 480 × 56 (one row) |
| 844 × 390 | two columns, iPhone | install « Comment faire » | 480 × 104 (two rows, as the UI-SPEC computed) |
| 640 × 360 | two columns, right column 304 | offline | 304 × 56 |
| 640 × 360 | two columns, iPhone | install | 304 × 104 |
| 1280 × 800 | computer, right column 480 | offline / update | 480 × 56 |
| 844 × 390 | `#/ordinateur`, right column 520 | update | 520 × 56, no scroll |

### The PWA suite (Task 3)

- **`playwright.pwa.config.ts`:** `testDir e2e-pwa`, the Chromium fallback, the phone and desktop projects with `serviceWorkers: "allow"`, and the debug build served by `vite preview` on port 4174.
- **`pwa.spec.ts`, 5 tests on each project:**
  - **Registration:** `ready`, scope `/`, the controller is `/sw.js` after one reload. The precache holds `/index.html`, the main chunk, the fonts and the knights. It holds no `Bench-`, no `/splash/` and no `/api/`.
  - **Offline start (ACCT-05):** after `setOffline(true)` and a reload, the strip `offline` appears **in 141 ms (phone) and 157 ms (desktop)**. Then « Jouer contre l’ordinateur » → `#/ordinateur` → « Jouer la partie » → `#/partie` shows the board and the hand. Two of the player's moves are played (exchange, cards, knights), with reduced motion.
  - **Update (APP-02):**
    - A copy of `dist` is served by the spec's own `node:http` server on a free port. It loads `#/partie`, then the copy's `sw.js` gains a test-only « VERSION? → v2 » answer.
    - A `visibilitychange` event makes the app find it. A worker waits; in the game no strip shows, the page does not reload, and « Réglages » shows the line.
    - On `#/` the strip `update` shows « Nouvelle version disponible » (role status), still in the same document.
    - « Mettre à jour » reloads, and the controller answers v2.
  - **Push (APP-03):** notifications are granted, and `ServiceWorker.deliverPushMessage` delivers the 04-07 payload. `getNotifications()` then lists exactly that title, body, tag and `data.url`.
  - **Manifest:** orientation landscape, id `/`, lang fr, standalone, categories games. Every icon answers 200 as image/png, and `/sw.js` is served as JavaScript.

## Embedded deploy (asked by the orchestrator)

| Check | Result |
|-------|--------|
| `node tools/build-embedded-worker.mjs` after the production build | 62 files embedded; `worker-embedded/manifest.js` lists `"/sw.js"` |
| `wrangler deploy --dry-run --outdir .wrangler/dry -c wrangler.embarque.jsonc` | Total Upload 3 931.66 KiB / **gzip 2 139.41 KiB** (was 1 388 KiB before this plan; Free plan limit 3 MB) |
| `node tools/check-bundle.mjs .wrangler/dry` | bundle OK, 62 separate modules, all from the web build |
| Local `wrangler dev -c wrangler.embarque.jsonc --port 8799` (local only), headers by curl | `/sw.js`: 200, `text/javascript; charset=utf-8`, `cache-control: no-cache`, byte-identical to `dist/sw.js`. `/manifest.webmanifest`: `application/manifest+json`, no-cache. `/`: text/html, no-cache. `/splash/*.png`: image/png. `/assets/index-*.js`: `public, max-age=31536000, immutable`. `/sw-old.js`: 404 |
| `Service-Worker-Allowed` | not needed: the worker is `/sw.js`, so its default scope is the whole origin |
| The upload variant (`wrangler.jsonc`) | `sw.js` and the manifest are plain static assets; `run_worker_first` is still `["/api/*", "/ws/*"]`; no config changed |

The server stopped by PID after each check. Ports 8787, 8799, 4173 and 4174 are free, and no workerd, wrangler or vite process is left.

## Task Commits

1. **Task 1 RED:** `f49f54c` (test)
2. **Task 1 GREEN:** `890ac31` (feat)
3. **Task 2 RED:** `a6e4c8f` (test)
4. **Task 2 GREEN:** `5b0c19f` (feat)
5. **Fix, the solo setup's strip:** `fe5b0ab` (fix)
6. **Task 3:** `a2a6f94` (test)
7. **Fix, the PWA spec's types:** `be5de70` (fix)

## Gate (at be5de70, one suite at a time)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | 0 errors (web: 554 files, plus the worker's and the PWA spec's own tsconfigs) |
| `pnpm lint` | Biome, 359 files, clean |
| `pnpm test` | Vitest 114 files, **1 777 passed, 2 skipped** (the same 2 engine skips) |
| Full local Playwright | **455 passed, 99 skipped, 0 failed** (7.3 min), unchanged |
| Full online Playwright | **56 passed, 0 failed** (8.1 min), unchanged |
| PWA Playwright (`playwright.pwa.config.ts`) | **10 passed** (5 × 2 projects, 35 s) |
| Ports 8787 / 4173 / 4174 before and after each run | free (checked by connecting) |

## Screenshots

In `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/`:
- `04-08-home-install-844x390.png`, `04-08-home-install-1280x800.png` (no strip on the desktop: no prompt in headless Chromium), `04-08-home-install-640x360.png`
- `04-08-install-sheet-844x390.png`, `04-08-install-sheet-640x360.png`
- `04-08-home-offline-844x390.png`, `04-08-home-offline-1280x800.png`, `04-08-home-offline-640x360.png`
- `04-08-home-update-844x390.png`, `04-08-home-update-1280x800.png`
- `04-08-reglages-update-line-844x390.png`, `04-08-reglages-update-line-1280x800.png`
- `04-08-ordinateur-update-844x390.png`, `04-08-ordinateur-update-1280x800.png`

I looked at them. The strips use the UI-SPEC values, and nothing is amber on the home. The iPhone install strip takes two rows at 844 × 390, as the UI-SPEC computed. The sheet's glyphs sit inline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The backup-code hold looped.** Found while running the Task 1 online specs: `holdUpdates()` wrote and read `pwaUpdate.holds` inside the screen's `$effect`, and the sign-up's backup-code screen never appeared. The count is now written in `untrack`. Commit `890ac31`, before the commit.

**2. [Rule 1 - Bug] The debug build's game could not start offline.** `globIgnores` from 04-RESEARCH left out `debugParams-*`, and the debug build loads that chunk at every game start. The error screen showed offline. It is now precached. The chunk does not exist in production builds, so the production precache is unchanged at 38 entries. Commit `a2a6f94`.

**3. [Rule 1 - Bug] The solo setup's update strip spilled out of the left column** in two columns (seen on the screenshot): « Mettre à jour » overflowed the 200 px column. The strip now sits where the UI-SPEC puts it: the bottom of the right column on the computer and in two columns, after the header in one column and in portrait. Commit `fe5b0ab`.

**4. [Rule 3 - Blocking] The PWA spec needs Node's types** for its own static server. It is excluded from the app's svelte-check program and checked by `tsconfig.e2e-pwa.json`. Commit `be5de70`. I first committed Task 3 with that typecheck failing (my check only grepped for the summary line), and fixed it in the next commit.

### Plan-detail adjustments (no scope change)

5. **`stripFor` returns `install-prompt` or `install-apple`.** The DOM hook stays `data-home-strip="install"`, plus `data-install-via="prompt|apple"`.
6. **`appleCanInstall`** adds the iOS 16.4 rule for other browsers on iOS (UI-SPEC « Safari, or another browser on iOS 16.4+ »).
7. **`#/ordinateur` shows only the update strip.** The UI-SPEC's update table lists it, and the offline and install strips are home-only.
8. **The offline strip uses `account.reachable`,** set by the account store (`store.svelte.ts`, not in `files_modified`) from whether `/api/me`'s fetch threw. The store also asks again on the `online` event (UI-SPEC « Offline »). The local preview's proxy answers 502, which is an answer, so the local suites see no offline strip.
9. **Splash:** 16 colours and rounded corners (key decisions). `tools/build-icons.d.mts` types the tool for the web test.
10. **Files touched outside `files_modified`:** `ui/BackupCodeScreen.svelte` (the hold), `account/store.svelte.ts` (reachability), `tools/build-icons.d.mts`, `apps/web/tsconfig.e2e-pwa.json`.
11. **No local spec assertion changed.** On the phone project (an iPhone user agent), the home now shows the iOS install strip. Every existing spec passed with it.

**Total deviations:** 4 auto-fixed (3 Rule 1, 1 Rule 3), 7 plan-detail notes.

## Known Stubs

None. `holdUpdates` and `canPromptUpdate` already name `#/compte`, `#/amis` and `#/secours`, whose pages come in 04-09 and 04-10. Those pages add `<HomeStrip kinds={["update"]} />` at the bottom of their right column (UI-SPEC « Update »). Until then the rule simply has no page there to render a strip.

## Issues Encountered

- The local Playwright runs log « http proxy error: /api/me … ECONNREFUSED 127.0.0.1:8787 » as before. It is noise: the preview has no Worker.
- I ran `git stash list` once while checking file state. It is read-only and changed nothing; no other stash command was used.

## Threat Flags

None beyond the register.
- **T-04-60:** no runtime route, and the precache holds no `/api/`. The spec asserts both.
- **T-04-61:** `canPromptUpdate`, and `applyUpdate` refuses elsewhere; no timer.
- **T-04-62:** the click URL is checked against the worker's origin.
- **T-04-59:** prompt update, plus the 4002 apply.
- **T-04-SC:** no package added.

## To confirm with Romain

- **Splash screens on a real iPhone and iPad** (A8). The size list goes from the iPhone 8 to the 17 Pro Max and the Air, and from the iPad mini 5 to the iPad Pro 13" M4. They use the home's rounded corners and a 16-colour palette (UI-SPEC « à confirmer » 16).
- **UI-SPEC « à confirmer » 13, 14 and 15**, built as written:
  - The update strip shows on the home and the solo setup. In a game it is only the line in « Réglages », with no badge on the gear.
  - « Plus tard » on the install strip hides it 30 days.
  - The offline strip text.
- **iPhone users now see « Installe TOC comme une application. »** on the home until they install or tap « Plus tard ».
- **Deploy notes (04-12):**
  - The embedded Worker grows from 1.39 MB to 2.14 MB gzip (the splash PNGs and the worker). It stays under the Free plan's 3 MB.
  - No config, secret, binding or migration changed. Migration v1 is untouched.
  - The first visit after the deploy installs the worker. From then on, each new deploy is offered as « Nouvelle version disponible » on the home.
  - No remote wrangler command was run, and nothing was deployed.

## Self-Check: PASSED

- The created files exist: sw.ts, tsconfig.sw.json, tsconfig.e2e-pwa.json, pwa/rules.ts and rules.test.ts, splash.test.ts, update.svelte.ts, install.svelte.ts, HomeStrip.svelte, InstallSheet.svelte, i18n/fr/appli.ts, public/splash (21 files), tools/build-icons.d.mts, playwright.pwa.config.ts and e2e-pwa/pwa.spec.ts.
- Commits f49f54c, 890ac31, a6e4c8f, 5b0c19f, fe5b0ab, a2a6f94 and be5de70 are ancestors of HEAD.
- `git rev-list --count c96340b..HEAD` is 7 before this summary's commit, and 8 with it.
