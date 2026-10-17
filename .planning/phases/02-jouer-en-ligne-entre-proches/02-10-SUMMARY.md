---
phase: 02-jouer-en-ligne-entre-proches
plan: 10
status: complete
subsystem: online-table
tags: [e2e, playwright, smoke, uat, d1, deploy, durable-objects, alarms]

requires:
  - phase: 02-jouer-en-ligne-entre-proches
    provides: "02-01 to 02-09: the online table end to end (protocol 4, GameRoom, waiting room, pause, resume, reclaim, quick messages, rematch, D1 record); the debug fix of the 7 in up to seven parts"
provides:
  - "apps/web/e2e-online/quatre.spec.ts: a whole game between four browsers, no computer seat, every received frame checked by the structural leak oracle for its seat (phone and desktop)"
  - "online.ts playTogether and listenFrames; jouer.ts playStep (playToEnd's step, shared)"
  - "tools/smoke-online.mjs: HTTP checks plus a best-effort WebSocket game against three computers (--level, --turns, --verbose) for any running Worker"
  - "Client: a bad-frame that answers this device's own act reopens the turn (« Ce coup n’est pas permis »), createActWatch"
  - "tools/wrangler-configs.test.ts: the D1 block is identical in both deploy configs, or absent from both"
  - "02-UAT.md: 19 tests and 30 « À confirmer » items for Romain, in French, all pending"
affects: [03, 04, 05]

tech-stack:
  added: []
  patterns:
    - "An act waits for its answer: the first events, welcome or act error after it on the socket is its reply (frames of one socket are answered in order)"
    - "A multi-page e2e loop taps whichever page has something to do, reads the page again when a control vanished under a tap"

key-files:
  created:
    - apps/web/e2e-online/quatre.spec.ts
    - tools/smoke-online.mjs
    - .planning/phases/02-jouer-en-ligne-entre-proches/02-UAT.md
  modified:
    - apps/web/e2e/jouer.ts
    - apps/web/e2e-online/online.ts
    - apps/web/e2e-online/fuite.spec.ts
    - apps/web/src/net/remoteGame.ts
    - apps/web/src/net/remoteGame.test.ts
    - apps/web/src/net/connection.svelte.ts
    - tools/wrangler-configs.test.ts

key-decisions:
  - "Deploy, D1 creation, remote migrations and wrangler tail are left to the orchestrator (its instruction); no Cloudflare resource was created and no remote wrangler command was run. Both configs still have no d1_databases block, so the repo deploys without D1 exactly as before."
  - "A bad-frame that answers the page's own act is a refused move (the turn opens again, like « illegal »); any other bad-frame is still « La table ne répond pas ». No protocol change."
  - "The four-browser game runs once per project (four desktops, then four phones held sideways)."
  - "02-UAT.md omits 02-07's « Tables saved before this deploy »: no online table was ever live before the 02-07 code, so no table can lack its expiry deadline."

requirements-completed: [RULE-19, NET-01, NET-02, NET-03, NET-04, NET-05, PLAY-07, HIST-01]

estimate:
  tokens: 110000
actuals:
  tokens: 13600    # chars/4 of the lines this plan added: 30 317 in apps/web and tools, 23 955 in 02-UAT.md
  tasks: 3
  commits: 8       # git rev-list --count plan_head_before..HEAD; 5 are this plan's, 3 (d2d0912, 25f3753, adfa4c8) a parallel debug session's on the same branch
plan_head_before: 27b636214ce4bdb3d7afde8ab1c6678175354ad6
plan_head_after: 66bbf39895007b8442a83ff6f2c437d72e44ec5f

duration: 84min
completed: 2026-10-17
---

# Phase 2 Plan 10: Vérification finale, une partie à quatre navigateurs, la recette de Romain Summary

**Four browsers played whole games through the server with no computer seat. On the desktop and on four phones held sideways they reached the plank, each from its own side, with 285 to 809 moves in 2 to 4 minutes. Every frame each page received passed the leak oracle for its seat. Every gate is green at 66bbf39.**

A smoke tool now checks the online tables on any running Worker. Run against the version already live, it found that every computer move waited 60 s. A parallel debug session then fixed that in GameRoom (25f3753); the fix is not deployed yet.

A bad-frame that answers a player's own move now reopens the turn. 02-UAT.md gives Romain 19 tests on real phones and 30 choices to confirm.

## What was built

- **Task 1, the four-browser game.**
  - `jouer.ts`: `playToEnd`'s per-step body is now `playStep(page, snapshot, stats)`. The taps are the same, so the local suite is unchanged.
  - `online.ts`:
    - `playTogether(pages)` lets whichever page has something to tap tap it, until all four show the plank. The cap is 15 min.
    - `listenFrames` was moved out of `fuite.spec.ts`.
  - `quatre.spec.ts`:
    - Ana, Bruno, Chloé and David take bleu, jaune, rouge and vert. « Quatre joueurs à la table : pas d’ordinateur. » shows, and Ana starts the game.
    - All four pages end on the plank: bleu and rouge agree, jaune and vert agree, and the two teams differ.
    - Every frame passes `structuralProblems(frame, seat)`. The opening deal shows only the page's own five cards.
    - Each seat played more than 5 moves.
- **Task 2, the smoke tool (the deploy itself is the orchestrator's).**
  - `tools/smoke-online.mjs [base] [--turns N] [--level 1-5] [--verbose]` runs these HTTP checks: GET / gives 200 and `<div id="app">`, POST /api/tables gives 201 and a 22-character id, GET of that id gives 200 and « lobby », and an unknown id gives 404.
  - Then it plays over WebSocket: hello, then welcome, sit bleu, three computers at the chosen level, start, then N moves with randomLegal on its own view, then « stop ».
    - It pings every 20 s, as the app does.
    - A stale give is retried.
    - If the socket cannot open, that is reported but not counted as a failure.
  - `wrangler-configs.test.ts` requires the same `d1_databases` block in both configs, or none in either. The block needs `binding` DB and `migrations_dir` apps/worker/migrations.
- **Task 3.** `02-UAT.md` is in French, in 03-UAT's format, with 49 headings, all pending:
  - 18 tests from the plan, plus test 19, « Un 7 partagé en cinq morceaux ou plus », from the debug note.
  - The 16 UI-SPEC items.
  - A3 (20 s / 75 s / 30 s) and A6 (the rematch's first dealer).
  - The unresolved row: the same first name twice.
  - 11 items from the SUMMARYs:
    - 02-04: « Table en ligne ».
    - 02-05: a freed seat keeps its strength; leaving the waiting room removes the table from the list.
    - 02-06: « Pas encore là »; no pause once the game is won.
    - 02-07: a real network loss; reclaiming a handed-over seat.
    - 02-08: four bubbles at 480 × 320; no « Messages » without a seat.
    - 02-09: leaving the plank starts the rematch; a game that ends before D1 exists.

## The four-browser game (full online run at 66bbf39)

| Project | Moves played | 7s | Valets | Hands laid down | Deals | Taps | Frames checked | Winners | Time |
|---------|--------------|----|--------|-----------------|-------|------|----------------|---------|------|
| desktop | 285 | 19 | 24 | 23 | 21 | 856 | 1 600 | bleu-rouge | 116 s |
| phone | 809 | 61 | 60 | 28 | 52 | 2 229 | 4 212 | bleu-rouge | 151 s |

Earlier runs: 423 moves in 170 s, and 592 moves in 240 s (desktop); 541 moves in 156 s, and 617 moves in 138 s (phone). Each deck is random, so each game differs.

Screenshots (looked at): /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-10-quatre-phone-bleu.png, 02-10-quatre-phone-jaune.png, 02-10-quatre-phone-rouge.png and 02-10-quatre-phone-vert.png, in the same folder. They show the four planks at 844 × 390. Jaune reads « Victoire ! », « Ton équipe a rentré ses 8 chevaux. », 8–6, with Toi and David, four hourglass discs, « Revanche » and « Quitter la table ». Nothing is cut.

## Verification (exact counts; suites run one after another)

| Gate | Result |
|------|--------|
| `pnpm typecheck` (at 66bbf39) | svelte-check 491 files, 0 errors, 0 warnings; every package tsc green |
| `pnpm lint` (at 66bbf39) | Biome, 282 files, no fixes |
| `pnpm test` (at 66bbf39, with the parallel fix) | Vitest 84 files, **1 313 passed, 2 skipped** |
| `node tools/selfplay.mjs --games 200` | 200 finished, 0 failed; 40.3 deals and 790 actions per game on average; 14.0 s |
| `node tools/rules-trace.mjs` | « OK (16 règles, 122 scénarios) », the same as before the phase |
| Full local Playwright | **455 passed, 99 skipped, 0 failed** (7.7 min), the same as 02-09 |
| Full online Playwright (`playwright.online.config.ts`, both projects, at 66bbf39) | **46 passed, 0 failed** (5.5 min): the 44 from before plus quatre.spec × 2 |
| `tools/wrangler-configs.test.ts` | 10 passed |
| `node tools/smoke-online.mjs http://localhost:8787` (local `wrangler dev`) | all passed. Three Champions: 4 actions in 16 s, longest wait 3.3 s. Three Galopeurs: 3 actions in 9 s, longest wait 2.6 s |

- Before the parallel fix, the gate gave 83 files, 1 309 passed and 2 skipped.
- Afterwards nothing listens on 8787 or 4173 (checked in /proc/net/tcp), and no wrangler, workerd or preview process of this plan is left. The local `wrangler dev` started for the smoke was stopped by its process group id.

## The live site (the version already deployed before this plan)

`NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/smoke-online.mjs` gave this. Node's fetch and its WebSocket both work through the proxy.

```
ok   GET / — 200 text/html; charset=utf-8
ok   POST /api/tables — 201 {"id":"Y5_KtTDXT8iCHEYbXottJA"}
ok   GET /api/tables/<id> — 200 status lobby
ok   GET /api/tables/<unknown> — 404 {"error":"not-found"}
  2.1 s  events 2 turn rouge exchange
  58.6 s  events 3 …   118.6 s  events 4 …   178.7 s  events 5 …   238.8 s  events 6 …   298.8 s  events 7
ok   WebSocket — … trois ordinateurs de force 3, … attente la plus longue d’un ordinateur 60.1 s
```

- Every computer move waited about 60 s, on a fixed grid. Galopeurs did, Champions did too (the `--level 5` run: 56, 60, 60 and 60 s). Locally the longest wait is 3 s. So this is alarm timing, not the Free-plan CPU.
- This matches `.planning/debug/slow-online-bots.md`, a parallel session from Romain's report. Its fix, 25f3753, is in HEAD and covered by the gates above, but it is **not deployed**.
- The first live run failed with close 4000: the tool did not ping yet, and the server closed it as silent after 75 s. The tool now pings.
- The smoke runs left five small tables on the live Worker (four of them F6vIpCjkFL8rzIOhXA06Fw, XSVONEo8LNWDec691-weMg, NB_bZ7iMEoYlMHhBwzju0g, Y5_KtTDXT8iCHEYbXottJA). They are stopped or saved and are deleted after 30 days.
- The D-11 CPU check with `wrangler tail` was not run here (orchestrator). 02-UAT test 6 asks Romain to watch for a computer that thinks more than 10 s, and says that the minute-long wait is corrected in this version.

## Done by the orchestrator: deploy, D1, tail

Run from /home/user/toc, in this order:

```bash
# 1. Production build (no VITE_TOC_DEBUG), embedded Worker, dry run
pnpm --filter @toc/web build
node tools/build-embedded-worker.mjs
pnpm exec wrangler deploy --dry-run --outdir .wrangler/dry -c wrangler.embarque.jsonc
node tools/check-bundle.mjs .wrangler/dry          # bindings: GAME_ROOM (+ DB once added), never TOC_TEST_MODE

# 2. D1 (D-14), only if the token has « D1 Edit »
P="CLOUDFLARE_API_TOKEN=placeholder CLOUDFLARE_ACCOUNT_ID=d8e3da702508ff6c73870012c228a19d"
env $P npx -y wrangler@4 d1 list                    # permission error → skip D1, quote the error
env $P npx -y wrangler@4 d1 create toc              # unless a database « toc » is already listed
#   add to BOTH wrangler.jsonc and wrangler.embarque.jsonc:
#   "d1_databases": [{ "binding": "DB", "database_name": "toc", "database_id": "<id>", "migrations_dir": "apps/worker/migrations" }]
pnpm exec vitest run --project node tools/wrangler-configs.test.ts   # both blocks equal, binding DB
pnpm --filter @toc/worker types                     # worker-configuration.d.ts then declares DB: D1Database
#   delete apps/worker/src/env.d.ts (its optional DB clashes); keep only TEST_MIGRATIONS in apps/worker/test/env.d.ts
pnpm typecheck && pnpm test
env $P npx -y wrangler@4 d1 migrations apply toc --remote -c wrangler.embarque.jsonc   # creates games + its index

# 3. Deploy (migration tag v1 unchanged)
env $P npx -y wrangler@4 deploy -c wrangler.embarque.jsonc

# 4. Check the live site: HTTP, then computers at level 3 and 5 (each wait should now be about 3 s, not 60 s)
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/smoke-online.mjs --level 3 --turns 2 --verbose
NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/smoke-online.mjs --level 5 --turns 3 --verbose

# 5. D-11, best effort, during step 4 in another shell: count outcomes other than « ok » (exceededCpu)
env $P npx -y wrangler@4 tail toc --format json
```

- Games that end before step 3 with D1 are never recorded: « skipped » is final (02-09).
- After deploying, update 02-UAT tests 6 and 18 with the smoke result, the tail result and the D1 status.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A bad-frame answering a move left the turn waiting (debug note follow-up)**
- **Found during:** the brief (follow-up in `.planning/debug/lost-move-reply.md`).
- **Issue:** online, any `bad-frame` set `serverError`, which showed « La table ne répond pas » and left the turn « waiting ».
- **Fix:** `createActWatch()` in `remoteGame.ts`, used by the remote game and by the connection.
  - After an act, the first events frame, welcome, `illegal`, `stale` or `bad-frame` is its answer.
  - A `bad-frame` that answers it calls `onRefused`, so the turn opens again with « Ce coup n’est pas permis. Choisis-en un autre. ».
  - Any other `bad-frame` is still the server error.
- **Tests:** RED e8a9892, then GREEN a8afb1a. Two cases in `remoteGame.test.ts`.
- **Commits:** e8a9892, a8afb1a

**2. [Rule 1 - Bug, test] The smoke client was closed as silent**
- **Issue:** the live server closed the smoke's socket with 4000 after 75 s without a ping.
- **Fix:** the tool pings every 20 s, as the app does.
- **Commit:** b041975

**3. [Rule 1 - Bug, test] The four-browser loop hung on a second « Jouer » of the winning 7**
- **Found during:** the first full online run, desktop.
- **Issue:** online, the 7's panel stays until the server's events come back. A second « Jouer » then waited without limit on the board, which turns inert at the end.
- **Fix:** taps now time out after 15 s and the page is read again, 10 times at most. The cap's error names each page's state and plate.
- **Commit:** 66bbf39

**4. [Scope] Task 2 steps 1, 3 and 5 (D1, deploy, tail) were not run**
- **Why:** the orchestrator's instruction: the deploy is its job, from this container, after this plan.
- **Instead:**
  - The exact commands are listed above.
  - The repo stays deployable without D1: no `d1_databases` block, and DB is optional.
  - A new config test guards the block the orchestrator will add.
- **Partly done:** step 2's dry run was not run here (it is the first command of the list). The smoke ran against the version already live, and found the 60 s computer moves.

**5. [Scope] The suites' order and an unrelated failure**
- **What happened:** the first full online run had 2 failures out of 46 while a parallel debug session was also running workerd and a `wrangler dev`:
  - quatre desktop: deviation 3.
  - `reprise.spec.ts` on phone: the second tab's « Partie ouverte ailleurs » did not show within 5 s.
- **Outcome:** both passed on the rerun under no load, and in the final full run (46 passed). No product change was made for `reprise`.

**6. [Scope] Commits of another session in this plan's range**
- d2d0912, 25f3753 and adfa4c8 (the slow-computers fix and its debug note) were committed to this branch by a parallel debug session during this plan.
- They are in the measured count (8) but are not this plan's.

### Deferred Issues

- Deploying the alarm fix (25f3753) and checking it on the live site (smoke step 4 above) are the orchestrator's.
- D1 creation and the tail check are the orchestrator's (above).

## Known Stubs

None.

## Threat Flags

None. `tools/smoke-online.mjs` uses only the public API and a random device token, and its tables expire like any other. No secret is in the repository or this summary: the commands use `CLOUDFLARE_API_TOKEN=placeholder`, and the account id was already in 02-CONTEXT's deploy line.

## Not done here (left to the orchestrator)

- STATE.md, ROADMAP.md, REQUIREMENTS.md and the config were not touched.
- The deploy, D1 and tail (above).

## Self-Check: PASSED

- Created files exist: `apps/web/e2e-online/quatre.spec.ts`, `tools/smoke-online.mjs`, `02-UAT.md`.
- Commits e8a9892, a8afb1a, 7bff464, b041975 and 66bbf39 are ancestors of HEAD.
- 02-UAT.md has 49 « ### » headings, 30 of them « À confirmer », and 49 « result: pending ».
