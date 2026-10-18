---
phase: 04-comptes-amis-et-application-installable
plan: 12
subsystem: verification
tags: [e2e, playwright, leak-oracle, smoke, uat, free-plan-budget, deploy, toast, svelte]

requires:
  - phase: 04-comptes-amis-et-application-installable
    provides: "04-01 to 04-11: accounts, friends, PlayerHub, push, the installable app, the home, « Mon compte », « Mes amis », the table invite and the in-app card; their SUMMARYs' x-toc-d1 measures and « à confirmer » choices"
provides:
  - "apps/web/e2e-online/parcours.spec.ts: the phase's whole path across three browsers, with the leak oracle on every table frame and the accounts' ids, handles and session tokens forbidden"
  - "apps/web/e2e/message-ephemere.spec.ts and the Toast.svelte fix: a message up when the board appears no longer loops (Svelte effect_update_depth_exceeded) nor drops the game's update on the phone"
  - "tools/smoke-online.mjs: the account, push, service-worker and manifest checks, and --read-only for the live site"
  - "04-UAT.md: 21 tests and 38 « À confirmer » items in French, all pending; the real-device steps of Task 3"
  - "The Free-plan budget of the phase, and the deploy steps (already run by the orchestrator)"
affects: [phase-04-verification, phase-05]

estimate:
  tokens: 120000
  tasks: 3
actuals:
  tokens: 13600
  tasks: 2
  commits: 4
plan_head_before: e50938bd1ba28a8efca172091d0b106928a179b9
plan_head_after: c3ff578511c9be2daa6596b20cb5ba0137580e51

tech-stack:
  added: []
  patterns:
    - "A spec that crosses the phase's features listens to every page's table socket from the first navigation, then checks each frame for its reader at the end"
    - "A Svelte effect never reads the $state it writes; a helper answers what the effect needs to know (measure() → boolean)"
    - "A live smoke run that only reads: --read-only skips the steps that create something"

key-files:
  created:
    - apps/web/e2e-online/parcours.spec.ts
    - apps/web/e2e/message-ephemere.spec.ts
    - .planning/phases/04-comptes-amis-et-application-installable/04-UAT.md
  modified:
    - apps/web/src/ui/Toast.svelte
    - tools/smoke-online.mjs

key-decisions:
  - "The Toast effect loop is a genuine bug, fixed with a RED/GREEN pair: on a phone held sideways, a toast still up when the board appeared made Svelte stop a looping effect, and the update of that moment (a knight's move after « Jouer ») was lost on screen"
  - "parcours.spec.ts makes its table through the test API (createTable with pauseMs 2 s and notifyMs 1.5 s), as amis-table.spec.ts does: the home tile cannot shorten the pause or the 30 s"
  - "The smoke run accepts for /sw.js a cache-control that forces revalidation: no-cache (the deployed embedded Worker) or max-age=0 with must-revalidate (the static assets of a local wrangler dev)"
  - "04-UAT.md test 7 is titled « Pas besoin de se reconnecter », not « Rester connecté »: the gender-neutral rule of the UI-SPEC rules out « connecté » for a player"

requirements-completed: []

coverage:
  - id: D1
    description: "All gates green after the phase: typecheck, lint, unit (Node and workerd), selfplay 200, rules-trace, local, online and PWA Playwright"
    verification:
      - kind: other
        ref: "Task 1 verify command, one suite at a time (see « Gate »)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The phase's path across browsers: link, sign-up, friends, table invite, card, seats and strengths, game, turn on another device, stop; no hand and no account id in any frame"
    requirement: ACCT-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/parcours.spec.ts (phone + desktop; 12/12 in a 6× repeat after the fix)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The smoke run's account, push, service-worker and manifest checks"
    verification:
      - kind: other
        ref: "node tools/smoke-online.mjs http://localhost:8787 (all passed); --read-only against the live site (all passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The installed app on a real iPhone and Android phone, push when closed, QR sign-in on the computer"
    verification: []
    human_judgment: true
    rationale: "Task 3, a blocking human checkpoint: pending with Romain (04-UAT.md)"

duration: about 62 min
completed: 2026-10-18
status: awaiting-device-checks
checkpoint: "Task 3 (checkpoint:human-verify, gate blocking): Romain's checks on the iPhone, an Android phone and the computer are pending; the steps are in 04-UAT.md"
---

# Phase 4 Plan 12: Vérification finale, le parcours entre navigateurs, le budget de l’offre gratuite, la mise en ligne et la recette sur iPhone et Android Summary

**Every gate is green after the phase. One spec plays the whole phase-4 path between three browsers with the leak oracle on every table frame. That spec found a real phone bug: a toast still up when the board appeared made Svelte stop a looping effect, and a knight's move was lost on screen. It is fixed with a RED/GREEN pair. The smoke run now checks the accounts, push and the installable app, and passes locally and, read-only, on the live site. 04-UAT.md holds 21 tests and 38 « À confirmer » items in French. The real-device checks (Task 3) are pending with Romain.**

## Performance

- **Duration:** about 62 min (14:09 to 15:11 UTC)
- **Started:** 2026-10-18T14:09:45Z
- **Completed:** 2026-10-18T15:11:00Z
- **Tasks:** 2 of 3 done; Task 3 is Romain's real-device checkpoint, not waited for (orchestrator's instruction)
- **Files modified:** 5

## Accomplishments

- **The phase's path across browsers** (`parcours.spec.ts`, both projects). Each run:
  - A signs up through a minted invitation, opens « Mes amis » and makes a link with « Inviter un proche ».
  - B opens the link in another browser and signs up. Each is in the other's list, and the link is no longer pending.
  - A's table: A invites B with « Inviter » in the « Mes amis » tab. B's home shows the card, and « Rejoindre » brings B into the waiting room under the pseudo.
  - B sits on rouge; A moves B to jaune, sets rouge to Trotteur and vert to Pur-sang, and starts.
  - The exchange and three human turns are played.
  - B's game page closes. B2 (B's passkey copied, on the home) gets « La table de {A} t’attend : c’est ton tour. » once, and « Revenir à la table » gives it jaune back.
  - A stops the game: « Partie sauvegardée » on A and B2.
  - Every frame of A's, B's and B2's table pages passes `structuralProblems` for its reader. The forbidden strings are both accounts' ids (`/api/me`), their WebAuthn user handles and their session tokens. The deal shows each page only its own five cards. At the same seq, no page holds a card of the other side's hand unless a public event shows it. No page logs a Svelte error.
  - **Duration:** 12 to 28 s a run; in the final gate, phone 17 s and desktop 16 s. The splits were accounts and friends 3 s, the table 2 s, the exchange and three turns 7 to 8 s, the turn on another device 3 s and the stop 1 s. 59 to 61 frames were checked and 26 compared.
- **The bug it found, fixed** (`Toast.svelte`, RED `b333b08`, GREEN `6ca516e`):
  - Before the fix, the toast's effect wrote `place` and then read it.
  - When a toast was still up as the game's board appeared in the compact mode (a phone held sideways), every run of that effect invalidated itself. Svelte stopped the loop (`effect_update_depth_exceeded`) and dropped the batch's other updates.
  - In the parcours, B's knight stayed in its stable after « Jouer » in 4 runs out of 6 on the phone, and in 1 of 2 in the first online gate.
  - Now `measure()` answers whether the board was found, and the effect never reads `place`.
  - `e2e/message-ephemere.spec.ts` (the sound's failure toast before the board) logged 11 such errors before the fix and none after. The parcours passed 12 of 12 in a 6× repeat after the fix.
  - The diagnosis used a temporary dev-mode Svelte build with an instrumented `dist`. `svelte.config.js` was restored, and neither was committed.
- **The smoke run** (`tools/smoke-online.mjs`):
  - New HTTP steps, each of which must pass:
    - `/api/me` answers 401 without a cookie.
    - `/api/push/key` answers 200 with an 87-character key. `push-off` is reported, not failed.
    - An unknown invitation code answers `unknown`.
    - The login options' `rpId` equals the site's host.
    - `/sw.js` is JavaScript, with a cache-control that makes the browser revalidate it.
    - The manifest says landscape and fr.
  - `--read-only` skips POST /api/tables and the WebSocket game.
- **04-UAT.md**, in French, in the 02/03 format:
  - Tests 1 to 21: the iPhone, Android and the computer; the budget; and the deploy done by the orchestrator.
  - Items 22 to 59, « À confirmer »:
    - the 17 items of the UI-SPEC, in their order;
    - the 30 s;
    - A1, A2, A4 and A8;
    - the two unresolved rows (look-alike pseudos, no « en ligne » marker);
    - 14 choices from the SUMMARYs of 04-02 to 04-11;
    - the budget.
  - It starts with the 9 real-device steps of Task 3.
  - Every result is pending.

## Gate (at 1457fcb, after the fix, one suite at a time)

| Check | Result |
|-------|--------|
| `pnpm typecheck` | 0 errors (web: 580 files, plus the worker, the SW and the PWA spec) |
| `pnpm lint` | Biome, 374 files, clean |
| `pnpm test` | Vitest 115 files, **1 841 passed, 2 skipped** (the same 2 engine skips; Node and workerd projects) |
| `node tools/selfplay.mjs --games 200` | 200 finished, 0 failed (seed 1) |
| `node tools/rules-trace.mjs` | **OK (16 règles, 122 scénarios)** |
| Full local Playwright | **459 passed, 99 skipped, 0 failed** (7.5 min): 457 before, plus message-ephemere × 2 projects |
| Full online Playwright | **102 passed, 0 failed** (8.9 min). It was 100; parcours × 2 projects was added |
| PWA Playwright | **10 passed** (5 × 2 projects, 34 s) |
| Ports 8787 / 4173 / 4174 after each run | free (checked by connecting) |

The online suite holds **the 48 tests of phases 2 and 3**, all passing and none edited: accueil 6, avance 2, fuite 2, invitation 4, messages 4, ordinateurs 2, pause 4, quatre 2, reprise 6, revanche 6, salle 8, tracer 2. The other 54 tests are phase 4's: compte 8, connexion 6, invitation-compte 10, secours 4, table-compte 2, amis 10, compte-page 10, amis-table 2 and parcours 2.

**Adapted specs: none.** No spec encoded a superseded behaviour: the 02 name line and the guest-only assumptions had already been adapted by 04-09 to 04-11, and every phase-2 and phase-3 spec passed unchanged.

The first full online run (before the fix) was **101 passed, 1 failed**: parcours on the phone, B's knight not moving. That failure led to the fix above.

## Free-plan budget (from the x-toc-d1 measures of 04-01 to 04-08)

**D1 rows per action** (workerd, x-toc-d1; index entries count as rows written):

| Action | Rows written | Rows read | Source |
|--------|--------------|-----------|--------|
| Sign-up by a player's link (options + verify) | **17** | 7 | 04-01 |
| Sign-up by the bootstrap code | 14 | 7 | 04-01 |
| Sign-in (options + verify) | **6** (options 0) | 6 | 04-02 |
| Session refresh (GET /api/me, seen more than 7 days ago) | **1**, at most once a week per device | 5 | 04-02 |
| GET /api/me otherwise | 0 | 2 | 04-01 |
| Sign-out | 2 | 4 | 04-02 |
| Table join with an account: linked, or the seat changes | **1** (table_members upsert) | 1 (the session, on the upgrade) | 04-04 |
| A guest's join or seat change | 0 | 0 | 04-04 |
| Table invite of a friend | **0** | 3 | 04-06 |
| Invitation link: create / accept | 4 / 4 | 3 / 6 | 04-05 |
| Friend add by code: create (4, or 5 replacing) + redeem (2) | **6** | 6 | 04-05 |
| Friend removed | 2 | 6 | 04-05 |
| Push subscription saved | **3** | 6 | 04-07 |
| Notice (turn or invite) | **0**; 2 per gone subscription (404/410) | n (n subscriptions) | 04-07 |
| Add a passkey / remove one / new backup code | 7 / 3 / 6 | 11 / 18 / 14 | 04-02 |
| Recovery by the backup code | about 14, plus 2 per extra old session | 27 | 04-03 |
| A failed recovery or friend code | 0 (one row in the account's hub SQLite) | 0 to 4 | 04-03, 04-05 |
| A finished game (HIST-01, phase 2) | 3 (the row, its key, the table_hash index) | 0 | 02-09, 0001 |

**Push sends per notice:** one per subscription of the account (at most 10). There is none when the account has a socket open (D-08), and none for a duplicate within the pause or the 10 minutes of an invite. Each send costs 0.60 ms of CPU to encrypt and one subrequest (Free: 50 per invocation).

**Durable Object requests per opened app** (04-06):
- The `/ws/me` upgrade costs **1**.
- `hi` + `vis` cost 0.1 (incoming WebSocket frames at 20:1), and each visibility change 0.05.
- Pings cost 0: the runtime answers them without waking the hub.
- A reconnect costs 1.1, a table invite 3 (inviteInfo, allow, notify) and a turn notice 1 (the hub's notify, inside the GameRoom's alarm).

**Estimate for a family of 20.** Each has 2 devices and plays 3 games a day, which makes about 20 tables a day of 3 people and a computer. The assumptions:
- 10 app opens a day per device;
- 2 invites per table, half of them to a closed app;
- 1 turn notice per table;
- 2 subscriptions per account;
- 2 new friendships and 2 sign-ins a day.

| Item | Per day | Free plan per day | Share |
|------|---------|-------------------|-------|
| D1 rows written | about 250: table_members 120, game rows 60, sign-ins 12, friends 12, refreshes 6, the rest rare | 100 000 | 0.25 % |
| D1 rows read | about 3 500: /api/me 800, /api/me/tables about 2 000, friends' lists, invites, notices | 5 000 000 | < 0.1 % |
| DO requests of the account layer | about 650: app opens 480, invites 120, notices 20, the rest rare | 100 000 | 0.65 % |
| Push sends | about 80: 40 notices × 2 subscriptions | no quota at Apple, Google or Mozilla | — |

**The games stay the big item.** These are the phase 2/3 figures (02-03), counted on the Durable Objects' own SQLite, apart from D1:
- A game with three Galopeurs writes about 1 375 rows.
- A game with three Champions writes about 15 500 rows and runs about 7 600 alarms, which are 7 600 DO requests.
- So 20 tables a day with Galopeurs is about 27 500 rows. Champion-heavy days would pass the Free plan after about 6 such games.

The account layer adds under 1 % to every quota. The exact Free-plan numbers (rows written per day on DO SQLite, the 20:1 WebSocket ratio) should be re-read on Cloudflare's pricing page before any capacity claim. This is test 20 and item 59 in 04-UAT.md.

## Deploy steps (already run by the orchestrator; this plan ran none of them)

The orchestrator ran these before this plan. They are kept verbatim from the plan as the record:
- the secrets TOC_PEPPER, TOC_BOOTSTRAP and VAPID_PRIVATE_KEY are set;
- remote D1 migration 0002 is applied;
- Durable Object migration v2 (PlayerHub) is deployed;
- origin/claude/phase-4-comptes at e50938b (through 04-11) is live at https://toc.romaindetroyat.workers.dev;
- the smoke checks passed: the bootstrap invitation answered `{"state":"ok","bootstrap":true}`, `/api/push/key` returns a key, and `/sw.js` and `/manifest.webmanifest` return 200;
- the bootstrap link was given to Romain.

**New, from this plan:** the Toast fix (`6ca516e`) is a product change, so it is not live yet. One more `$CF deploy -c wrangler.embarque.jsonc` from this branch ships it. It needs no migration, no secret and no config change, and the Durable Object migrations v1 and v2 are unchanged. Test 21 of 04-UAT.md leaves the version line « à compléter » for that deploy. Until it ships, a phone can lose a move on screen when a toast is still up as a game starts.

## Deploy steps (for the orchestrator; this plan runs none of them)

Run from the repository root at the commit that passed Task 1, in this order. `$CF` stands for `CLOUDFLARE_API_TOKEN=placeholder CLOUDFLARE_ACCOUNT_ID=d8e3da702508ff6c73870012c228a19d npx -y wrangler@4` (the proxy injects the real token, as in phase 2). No value of a secret is ever printed, logged, committed or written into the repository.

1. Local build and checks (no network): `pnpm --filter @toc/web build` (production, no VITE_TOC_DEBUG), `node tools/build-embedded-worker.mjs`, `pnpm exec wrangler deploy --dry-run --outdir .wrangler/dry -c wrangler.embarque.jsonc`, `node tools/check-bundle.mjs .wrangler/dry`. The dry run's bindings must list GAME_ROOM, PLAYER_HUB, DB and the vars RP_ID and ORIGIN, and not TOC_TEST_MODE.
2. Remote D1 migration, before the deploy (the new code reads the new tables): `$CF d1 migrations apply toc --remote -c wrangler.embarque.jsonc`. It must apply 0002_accounts.sql only (0001 is already applied). Record its output.
3. Secrets, each generated locally and piped, before the deploy:
   - `node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))" | $CF secret put TOC_PEPPER -c wrangler.embarque.jsonc` — set once for good: changing it later invalidates every backup code and friend code.
   - `node tools/vapid-keys.mjs | $CF secret put VAPID_PRIVATE_KEY -c wrangler.embarque.jsonc` — the public key is derived from it by the Worker; changing it later makes every device subscribe again.
   - `umask 077 && node -e "process.stdout.write(require('node:crypto').randomBytes(16).toString('base64url'))" > /root/.toc-bootstrap && $CF secret put TOC_BOOTSTRAP -c wrangler.embarque.jsonc < /root/.toc-bootstrap` — the file is outside the repository, readable by root only.
4. Deploy: `$CF deploy -c wrangler.embarque.jsonc`. It applies the Durable Object migration v2 (PlayerHub); v1 is unchanged. Record the version id and the printed bindings. After this deploy, rolling back to a version without the PlayerHub class is not possible without a deleted_classes migration.
5. Smoke: `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/smoke-online.mjs https://toc.romaindetroyat.workers.dev`. Every HTTP step must pass.
6. Romain's first account: give Romain, privately and only to him, the link `https://toc.romaindetroyat.workers.dev/#/invitation/` followed by the content of /root/.toc-bootstrap, then delete the file (`rm -f /root/.toc-bootstrap`). Once his account exists the code is dead (it works only while no account exists); `$CF secret delete TOC_BOOTSTRAP -c wrangler.embarque.jsonc` may remove it.
7. Optional, during Romain's first sign-in: `$CF tail toc --format json`, counting outcomes other than ok (exceededCpu in particular).
8. Then resume this plan at Task 3 (the human checkpoint) and update 04-UAT.md with the deploy, smoke and tail results.

Note on step 5 since this plan: the extended smoke run also does POST /api/tables and a WebSocket game on the site it is pointed at. For a check that writes nothing, add `--read-only`.

## Smoke runs

**Local**, `node tools/smoke-online.mjs http://localhost:8787`. The local `wrangler dev` was started like the online Playwright config: TOC_TEST_MODE and the test-only values, with the local D1 migrated. It was stopped by PID afterwards.

```
smoke-online: http://localhost:8787
ok   GET / — 200 text/html; charset=utf-8
ok   POST /api/tables — 201 {"id":"FlaFFiYnp6xpzbsex13dCg"}
ok   GET /api/tables/<id> — 200 status lobby
ok   GET /api/tables/<unknown> — 404 {"error":"not-found"}
ok   GET /api/me (no cookie) — 401 {"error":"signed-out"}
ok   GET /api/push/key — 200 key of 87 characters
ok   GET /api/invitations/<random code> — 200 state unknown
ok   POST /api/auth/login/options — 200 rpId localhost (site localhost)
ok   GET /sw.js — 200 text/javascript; charset=utf-8, cache-control « public, max-age=0, must-revalidate »
ok   GET /manifest.webmanifest — 200 application/manifest+json, orientation landscape, lang fr
ok   WebSocket — welcome, assis en bleu, trois ordinateurs de force 5, partie lancée, 4 actions jouées, la carte passée comprise, en 11 s (0 coup(s) en retard rejoué(s)), attente la plus longue d’un ordinateur 3.2 s, partie arrêtée (sauvegardée)
smoke-online: all checks passed
```

**Live read-only smoke**, `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/smoke-online.mjs https://toc.romaindetroyat.workers.dev --read-only`. No account was created, the bootstrap code was not used, and no table was made.

```
smoke-online: https://toc.romaindetroyat.workers.dev
ok   GET / — 200 text/html; charset=utf-8
skip POST /api/tables and the WebSocket game — --read-only
ok   GET /api/tables/<unknown> — 404 {"error":"not-found"}
ok   GET /api/me (no cookie) — 401 {"error":"signed-out"}
ok   GET /api/push/key — 200 key of 87 characters
ok   GET /api/invitations/<random code> — 200 state unknown
ok   POST /api/auth/login/options — 200 rpId toc.romaindetroyat.workers.dev (site toc.romaindetroyat.workers.dev)
ok   GET /sw.js — 200 text/javascript; charset=utf-8, cache-control « no-cache »
ok   GET /manifest.webmanifest — 200 application/manifest+json, orientation landscape, lang fr
smoke-online: all checks passed
```

## Real devices (Task 3, pending with Romain)

Task 3 is a blocking human checkpoint. The orchestrator asked not to wait at it.

The nine steps are written at the top of 04-UAT.md, mapped to its tests 1, 2, 3, 6, 7, 12, 13, 14 and 15:
- the installed app on the iPhone (icon, splash, passkey, cold start signed in, notifications when closed and none while playing);
- Android;
- the computer's QR sign-in;
- the iPhone in airplane mode.

Romain's answers go test by test into 04-UAT.md, and here under this heading. Every failure becomes a gap for `/gsd-plan-phase 4 --gaps`.

**Status: pending.**

## Task Commits

1. **Task 1 RED: a toast up when the board appears loops on the phone**: `b333b08` (test)
2. **Task 1 GREEN: the toast no longer loops nor drops the game's update**: `6ca516e` (fix)
3. **Task 1: the phase's path across browsers with the frame check**: `1457fcb` (test)
4. **Task 2: the smoke run's account, push and app checks; 04-UAT.md**: `c3ff578` (feat)

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A toast up when the board appears looped without end and lost a game update (phone)**
- **Found during:** Task 1, the first online gate (parcours on the phone, B's knight not leaving its stable after « Jouer »).
- **Issue:**
  - `Toast.svelte`'s effect called `measure()`, which writes `place`, then read `place`.
  - Once the board appeared in the compact mode under a toast, each run invalidated itself, and Svelte stopped it with `effect_update_depth_exceeded`. This was seen on both A's and B's pages.
  - The stop dropped the other updates of that batch, including the knight's move.
  - This bug has existed since 01-47 and 02-06. The phase-4 toasts that come just before a game starts made it frequent: « {Pseudo} a changé ta place : tu es maintenant Jaune. » and « … a rejoint la table. ».
- **Fix:** `placeNow()` computes the place, and `measure()` keeps it and answers whether the board was found. The effect uses that answer and never reads `place`.
- **Test:** `e2e/message-ephemere.spec.ts` logged 11 errors before the fix (RED) and none after. parcours.spec.ts also asserts that no page logs a Svelte error.
- **Files modified:** apps/web/src/ui/Toast.svelte, apps/web/e2e/message-ephemere.spec.ts
- **Commits:** b333b08, 6ca516e

### Plan-detail adjustments

1. **The table is made through the test API in parcours.spec.ts.** The plan says « A creates a table ». The home tile cannot shorten the pause or the 30 s, so the spec uses `createTable` with `pauseMs` and `notifyMs`, as amis-table.spec.ts does. The home tile's creation is covered by the phase-2 specs.
2. **B2's frame count.** B2 comes back only for the end, so its page must receive more than 1 frame. A and B must receive more than 5.
3. **The smoke run's /sw.js check accepts « max-age=0, must-revalidate » as well as « no-cache ».** Both make the browser revalidate. The local `wrangler dev` (static assets) sends the first, and the deployed embedded Worker sends no-cache (live: « no-cache »).
4. **`--read-only` in the smoke run.** The orchestrator allows only read-only checks against the live site, so this flag skips the table and the WebSocket game.
5. **UAT test 7's title.** The plan's « Rester connecté » became « Pas besoin de se reconnecter » because of the gender-neutral rule.
6. **The UAT has 59 entries.** There are 21 tests and 38 « À confirmer » items, beyond the 21 + 23 minimum. The extra items are the choices the plan SUMMARYs left to confirm.
7. **Task 3 is not waited for** (orchestrator's instruction). Its steps are in 04-UAT.md, and this SUMMARY's status is `awaiting-device-checks`.
8. **No screenshots.** This plan adds no screen. The Toast fix only stops the loop: the toast's place over the felt is unchanged.

**Total deviations:** 1 auto-fixed bug and 8 plan-detail notes.

## Known Stubs

None. In 04-UAT.md, test 21's line « Version à noter ici après ce déploiement : à compléter » is left for the orchestrator's next deploy (the Toast fix). It is not code.

## Issues Encountered

- The first parcours phone failure looked like a flake. It passed 2 of 2, then failed 4 of 6, the same knight each time. The trace's console showed `effect_update_depth_exceeded` on both table pages right after « Jouer ». A temporary dev-mode Svelte build, with the scheduler instrumented in `dist` (nothing committed), named the looping effect.
- An `rm -rf` of a scratch directory was refused by the sandbox's safety check. New empty scratch directories were used instead, and nothing in the repository was removed.
- `ss` is absent: ports were checked by connecting. The manual `wrangler dev` runs (diagnosis, local smoke) were stopped by PID. None are left, and 8787, 4173 and 4174 are free.

## Threat Flags

None. No endpoint, auth path or schema changed. The smoke run's new steps only read, and the login options are stateless. Secrets:
- no secret value is in the repository, this SUMMARY or 04-UAT.md;
- the TEST-ONLY values passed to the local `wrangler dev` are the ones already public in `e2e-online/comptes.ts`;
- the bootstrap code was not used.

## To confirm with Romain

Everything is in 04-UAT.md:
- tests 1 to 21;
- the 38 « À confirmer » items: the 17 of the UI-SPEC, the 30 s, A1, A2, A4, A8, the two unresolved rows, the SUMMARYs' choices and the budget.

## Self-Check: PASSED

- The files exist: apps/web/e2e-online/parcours.spec.ts, apps/web/e2e/message-ephemere.spec.ts, apps/web/src/ui/Toast.svelte, tools/smoke-online.mjs, 04-UAT.md.
- Commits b333b08, 6ca516e, 1457fcb and c3ff578 are ancestors of HEAD. `git rev-list --count e50938b..HEAD` is 4 before this summary's commit, and 5 with it.
