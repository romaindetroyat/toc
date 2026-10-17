---
phase: 02-jouer-en-ligne-entre-proches
plan: 02
status: complete
subsystem: online-table
tags: [leak-oracle, fast-check, workerd, durable-objects, playwright, wrangler, deploy-dry-run]

requires:
  - phase: 02-jouer-en-ligne-entre-proches
    provides: "02-01: the pure table reducer and its frame builders, the GameRoom Durable Object, the workerd helpers, the online Playwright config"
provides:
  - "@toc/table/oracle: leakedCards, structuralProblems, frameProblems, hiddenCards, cardIdsIn, sameJson, canonical (test instrument, never imported by server sources)"
  - "A fast-check property over 200 random tables with reconnects, stale and illegal acts (pure core)"
  - "A workerd test judging every real socket frame of a whole game against the server's own history"
  - "apps/web/e2e-online/fuite.spec.ts: every frame two browsers receive"
  - "wrangler.embarque.jsonc Text glob narrowed to the web build; tools/check-bundle.mjs for --dry-run outputs"
affects: [02-03, 02-05, 02-06, 02-10]

actuals:
  tokens: 14881    # chars/4 of the added lines of the plan's four commits (lockfile excluded)
  tasks: 2
  commits: 4
plan_head_before: a052ce41d1fb9abe7d750a079ddcc6fc550a889e
plan_head_after: 3ac4c9698e42c364fe613c9259fd68a6825ff941

tech-stack:
  added: []
  patterns:
    - "One leak oracle for the core, workerd and the browser: card ids hidden from the reader in the stored state, public events of the same frame excused, plus structural checks"
    - "workerd history by replay: the stored game read in the same turn as the start, then the server's event log applied through apply(), checked equal to the snapshot at every step"
    - "Deploy readiness without an account: wrangler deploy --dry-run --outdir, then tools/check-bundle.mjs"

key-files:
  created:
    - packages/table/src/oracle.ts
    - packages/table/test/leak.test.ts
    - apps/worker/test/leak.test.ts
    - apps/web/e2e-online/fuite.spec.ts
    - tools/check-bundle.mjs
  modified:
    - packages/table/package.json
    - apps/worker/package.json
    - pnpm-lock.yaml
    - apps/web/e2e-online/online.ts
    - apps/web/e2e-online/tracer.spec.ts
    - tools/wrangler-configs.test.ts
    - wrangler.embarque.jsonc

key-decisions:
  - "The Text glob is **/apps/web/dist/*.js, not apps/web/dist/**/*.js: wrangler turns each glob into a glob-to-regexp pattern tested on the import path as written in worker-embedded/manifest.js (../apps/web/dist/...), where * spans slashes; the planned spelling matched nothing and the dry run failed"
  - "The workerd test reads the state history from the server's own log (replayed through apply from the start state read in the start's turn) instead of reading the snapshot between steps: under the test pace the alarm fires by itself, so a read between two computer moves is impossible"
  - "No frame builder needed a fix: the oracle found no leak at any level"
  - "@toc/bots linked as a workspace devDependency of @toc/worker (randomLegal for the human sockets); no external package added"

patterns-established:
  - "Leak checks: import { leakedCards, frameProblems } from \"@toc/table/oracle\" in server tests; the browser spec imports the same file by path (apps/web does not depend on @toc/table)"
  - "playOneMove(page) lives in apps/web/e2e-online/online.ts for every online spec"

requirements-completed: [RULE-19]

coverage:
  - id: D1
    description: "No frame of the pure core carries a card hidden from its reader, over 200 random tables (1 to 4 humans, 0 to 2 unseated people) with disconnects, reconnects, stale and illegal acts"
    requirement: RULE-19
    verification:
      - kind: property
        ref: "packages/table/test/leak.test.ts#holds over 200 random tables"
        status: pass
  - id: D2
    description: "The oracle catches a copied hand, another seat's handDealt or cardsExchanged card, GameState keys, person ids, error texts and a view that is not viewFor; it accepts a reshuffle batch whose played card already sits in a new hand"
    requirement: RULE-19
    verification:
      - kind: unit
        ref: "packages/table/test/leak.test.ts#the leak oracle"
        status: pass
  - id: D3
    description: "Every real socket frame of a whole workerd game (two humans, one dropping and returning twice, two computers on alarms, evictions) passes the oracle against the stored history; after a reconnect the welcome view is viewFor of the stored state"
    requirement: RULE-19
    verification:
      - kind: integration
        ref: "apps/worker/test/leak.test.ts"
        status: pass
  - id: D4
    description: "Every WebSocket frame two browsers receive through the exchange and three human turns shows only that page's cards; across the two devices no hand shows up in the other's frames"
    requirement: RULE-19
    verification:
      - kind: e2e
        ref: "apps/web/e2e-online/fuite.spec.ts (phone, desktop)"
        status: pass
  - id: D5
    description: "Both deploy configs dry-run with GAME_ROOM; the embedded output holds only web-build files as separate modules, zod and the server inlined"
    verification:
      - kind: unit
        ref: "tools/wrangler-configs.test.ts (Text glob, check-bundle cases)"
        status: pass
      - kind: manual
        ref: "wrangler deploy --dry-run (both configs) + node tools/check-bundle.mjs .wrangler/dry"
        status: pass

duration: 30min
completed: 2026-10-17
---

# Phase 2 Plan 02: Aucune main ne fuit Summary

**One leak oracle (`@toc/table/oracle`) judges every frame at three levels — 254 999 frames of 200 random pure-core games with 1 740 reconnects, all 1 354 frames of a whole workerd game with two reconnects and evictions, and every frame two real browsers receive — and finds no hidden card; the embedded deploy build's Text glob is narrowed to the web build and both configs dry-run with `GAME_ROOM`.**

## Performance

- **Duration:** about 30 min (2026-10-17T07:10Z to 07:40Z)
- **Tasks:** 2, each RED then GREEN
- **Files:** 12 changed (5 created, 7 modified), 1 412 insertions, 49 deletions

## Accomplishments

- `packages/table/src/oracle.ts`, exported as `@toc/table/oracle` and imported by no server source (a test scans `packages/table/src` and `apps/worker/src`):
  - `leakedCards(frameJson, before, after, seat)`: card ids in the frame text that are hidden from the reader in `after` (other seats' hands, given and received cards, the talon, less the reader's own cards, its own give once crossed and the face-up cards), not the reader's own before the batch, and not announced by a public event of the same frame (`cardPlayed`, `handDiscarded`). With no game, any card id is a leak.
  - `structuralProblems(frame, seat, forbidden)`: known frame type; `handDealt` cards only for the reader; `cardsExchanged` only the reader's card; no `hands`, `talon`, `rng`, `botRng`, `who`, `token`, `people`, `creator`, `deadlines`, `message`, `stack` key; no `"kind":"state"`; no per-seat `given`/`received` record outside `cardsExchanged`; no person id or token; no error text; error frames exactly `{ t, code }`; the view's seat and the welcome's `you.seat` are the reader's.
  - `frameProblems(frame, after, seat, forbidden)`: the structural checks plus a view deep-equal to `viewFor(after, seat)`, or null for an unseated reader or before the game.
- Pure-core property (fast-check, seed 20261017, numRuns 200, cap 400 commands per game): **200 games, 77 941 commands, 254 999 frames, 47 games won, 36 024 human acts, 24 241 computer ticks, 1 694 stale acts, 2 358 illegal acts, 1 740 reconnects, 2 265 reshuffle batches, 842 unseated welcomes during a game, 6 874 error frames** — each count asserted above zero. A mutation check (events frames built from the raw events instead of `eventsFor`) fails it at the first start, naming the leaked cards.
- workerd (`apps/worker/test/leak.test.ts`): Ana (bleu) connected throughout, Ben (jaune) closes his socket at steps 30 and 150 and comes back with hello when his turn comes, rouge and vert computers (level 3) on alarms, `evictDurableObject` every 25 steps. **1 354 frames over 383 seqs, 111 alarms run by the test (the others fired by themselves under the zero pace), 185 human acts, 2 reconnects, 13 evictions; the game reached `gameWon`.** Every frame of the four sockets passes `leakedCards` and `frameProblems` (person ids and both device tokens forbidden); Ana received an events frame for every seq; each reconnect welcome equals `viewFor` of the stored state at its seq.
- Browser (`apps/web/e2e-online/fuite.spec.ts`, phone and desktop): every frame of both pages passes `structuralProblems`; the first deal shows each page its five cards and three null hands; at every common seq, no card of one page's hand appears in the other page's frame unless a public event of that frame announces it.
- Deploy readiness: Text glob for scripts `**/apps/web/dist/*.js`; `tools/check-bundle.mjs <outdir> [--dist <dir>]` (exit 0 / 1 with the offending paths, 2 on bad usage) checks that each separate module is a web-build file (content sha1 and name), that the entry imports only those modules and `cloudflare:` built-ins, and that it defines `GameRoom`.

## Dry runs (no deploy)

Web built for production (`pnpm --filter @toc/web build`, no `VITE_TOC_DEBUG`), then `node tools/build-embedded-worker.mjs` (29 files embedded).

| Config | Bindings listed | Total / gzip | Bundle check |
|--------|-----------------|--------------|--------------|
| `wrangler.embarque.jsonc` (`--outdir .wrangler/dry`) | `env.GAME_ROOM (GameRoom) Durable Object` | 1 848.52 KiB / 956.70 KiB | `bundle OK: 29 separate modules, all from the web build; the rest is inlined` (2 JS modules: `index-*.js`, `Bench-*.js`) |
| `wrangler.jsonc` (`--outdir .wrangler/dry-assets`) | `env.GAME_ROOM (GameRoom) Durable Object`, `env.ASSETS Assets` | 152.63 KiB / 38.60 KiB (31 files read from apps/web/dist as assets) | n/a (assets uploaded apart) |

Both outdirs are under `.wrangler/` (gitignored).

## Commits

| Commit | Type | What |
|--------|------|------|
| 805b59b | test | RED: oracle unit cases and the 200-game property, oracle signatures only |
| 3069e94 | feat | GREEN: the oracle; property passes, no builder fix needed |
| 312cd6b | test | RED: workerd real-frame test, browser spec, glob and check-bundle tests |
| 3ac4c96 | feat | GREEN: narrowed Text glob, tools/check-bundle.mjs |

## Verification (exact counts)

- `pnpm typecheck`: exit 0 (svelte-check 447 files, 0 errors, 0 warnings; `@toc/table`, `@toc/worker` tsc clean).
- `pnpm lint`: exit 0, 225 files, no fixes.
- `pnpm test` (projects node + worker): **60 files, 1024 passed, 2 skipped** (baseline 1011 passed, 2 skipped; +13: table leak 8, worker leak 1, config glob 1, check-bundle 3). About 83 s wall time; the property alone takes about 38 s.
- `pnpm exec vitest run --project worker`: 8 passed.
- `playwright test -c playwright.online.config.ts e2e-online/fuite.spec.ts e2e-online/tracer.spec.ts`: **4 passed** (phone, desktop); also 12/12 with `--repeat-each 3`.
- Full local Playwright (`playwright test`, phone + desktop): **416 passed, 96 skipped, 0 failed** (6.7 min; same as baseline).
- `node tools/rules-trace.mjs`: OK (16 règles, 122 scénarios).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The planned glob spelling matched nothing**
- **Found during:** Task 2, first dry run
- **Issue:** `apps/web/dist/**/*.js` made the dry run fail on the `import f20 from "../apps/web/dist/assets/index-*.js"` line of `worker-embedded/manifest.js` (the script fell through to the bundler): wrangler builds an esbuild `onResolve` filter with glob-to-regexp from each glob and tests it on the import path as written, `../apps/web/dist/...`, where `*` spans slashes and the pattern is anchored.
- **Fix:** `**/apps/web/dist/*.js` (also catches a future top-level script such as a service worker, which `**/apps/web/dist/**/*.js` would miss), with a JSONC comment; the config test reproduces wrangler's matching and checks that a dependency's `dist/` path, `./dist/...` and `zod/mini` are not matched while the old glob would catch the first.
- **Files:** wrangler.embarque.jsonc, tools/wrangler-configs.test.ts
- **Commit:** 3ac4c96

**2. [Rule 3 - Blocking] « State read before and after the step » is impossible under the zero pace**
- **Found during:** Task 2 (a probe showed the alarm firing by itself right after the start)
- **Issue:** the plan's workerd test reads the stored state before and after each step; with zero-pace computers the alarm runs on its own between the test's calls, so several computer moves happen between two reads.
- **Fix:** the start is delivered inside the object with `runInDurableObject` (`room.webSocketMessage`), and the stored game is read in the same turn; every later state is the server's own event log replayed through `apply()`, and at each step the replayed state at the snapshot's seq must deep-equal the stored game (so the history is the server's, checked ~330 times). Frames are judged against the state of their own seq. No production code changed for it.
- **Files:** apps/worker/test/leak.test.ts
- **Commit:** 312cd6b

**3. [Scope] The workerd table has two humans and two computers, no fixed deck seed**
- The plan's behaviour mixes « one human socket and three bots » with « a second human (jaune) »; the test seats Ana (bleu) and Ben (jaune) with rouge and vert computers. The deck and computers' seeds come from `crypto` inside the object (no test seed option exists, and adding one would be a test-only production path); the human sockets' choices use a fixed seed. Game length is not a flake risk: with random humans and level-3 computers the measured games end in 320 to 430 actions, the caps are 3 000 steps and 600 alarms.

**4. [Rule 3 - Blocking] Workspace link for the human sockets' moves**
- `apps/worker` tests need `randomLegal`; `@toc/bots` is added as a `workspace:*` devDependency of `@toc/worker` (`pnpm install --offline`, lockfile +3 lines, no external package).
- **Commit:** 312cd6b

**5. [Rule 1 - Bug, test] The browser loop met a new deal**
- On desktop, two dead hands ended the first deal before the third human turn; the loop now passes the new exchange (not counted as a turn), which also checks a second `cardsExchanged`.
- **Commit:** 312cd6b

**6. [Refactor] `playOneMove` moved to `apps/web/e2e-online/online.ts`** so `tracer.spec.ts` and `fuite.spec.ts` share it (unchanged code).

**7. [Perf, test] Oracle tuned for the property's 255 000 frames:** the key walk joins its path only when reporting, and the view comparison uses `sameJson` (deep equality, key order ignored) instead of two `canonical` texts (property from 47 s to 38 s; the reducer itself, mostly the engine's legality and the table copy, accounts for about 24 s).

## Frame builder fixes

None: the property, the workerd test and the browser spec found no leak, so `packages/table/src/frames.ts` and `reduce.ts` are unchanged.

## Known Stubs

None.

## Threat Flags

None: no new endpoint or runtime surface; the oracle and check-bundle are test and build tools (T-02-08, T-02-09, T-02-10 mitigated as planned; T-02-SC: no package added).

## Self-Check: PASSED

- Files: packages/table/src/oracle.ts, packages/table/test/leak.test.ts, apps/worker/test/leak.test.ts, apps/web/e2e-online/fuite.spec.ts, tools/check-bundle.mjs: all present.
- Commits 805b59b, 3069e94, 312cd6b, 3ac4c96: all ancestors of HEAD.
