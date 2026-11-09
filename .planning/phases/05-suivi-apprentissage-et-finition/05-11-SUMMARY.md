---
phase: 05-suivi-apprentissage-et-finition
plan: 11
subsystem: verification
tags: [gate, playwright, smoke, bundle, d1-budget, uat, deploy]
status: complete

requires:
  - phase: 05-suivi-apprentissage-et-finition
    plan: 10
    provides: the accessibility audit, the knights' full names, every screen of the phase
provides:
  - "Every gate green on the main tree, run one after another (counts below)"
  - "The release build and the embedded Worker measured locally: 2 205.57 KiB gzip, bindings without TOC_TEST_MODE, no figure, scenario set or axe shipped"
  - "The D1 budget of the phase for a family of 20 (writes and reads, at start, after a month, after a year)"
  - "tools/smoke-online.mjs checks the results routes: 401 without a cookie, 403 for a solo report without our Origin"
  - "05-UAT.md: 46 tests in French, all pending, 32 « À confirmer » headings"
  - "The orchestrator's deploy steps, migration 0003 first (copied below)"
affects: [orchestrator deploy of phase 5, Romain's UAT, /gsd-verify-work 5]

actuals:
  tokens: 11600
  tasks: 3
  commits: 2
plan_head_before: 18501242c8cd3ae8b5fb3d3ca4d3a0f137216d55
plan_head_after: 7e86610b7c25f5e57ad3bb8f8a77d2c84b7eab79

tech-stack:
  added: []
  patterns:
    - "A temporary Playwright probe for the gallery, run against the online config's wrangler dev and deleted before any commit"

key-files:
  created:
    - .planning/phases/05-suivi-apprentissage-et-finition/05-11-SUMMARY.md
  modified:
    - tools/smoke-online.mjs
    - .planning/phases/05-suivi-apprentissage-et-finition/05-UAT.md
    - .planning/phases/05-suivi-apprentissage-et-finition/deferred-items.md

key-decisions:
  - "No spec needed adapting: every suite passed on its first run, so Task 1 has no commit"
  - "The budget reads « 10 result views » per person and per day (the conservative reading) and gives the reads at start, after a month and after a year, because the ranking's reads grow with the circle's history"
  - "« Current Test » first pointed at the rules text (Task 2, as before the plan), then at test 1, the first check the deployed phase allows (Task 3)"

requirements-completed: [HIST-02, HIST-03, HIST-04, PLAY-06, APP-04, APP-05]

duration: 35min
completed: 2026-11-07
---

# Phase 5 Plan 11: Vérification finale, le coût sur l’offre gratuite, la recette de Romain et les étapes de mise en ligne Summary

**All gates pass. The release Worker is 2 205.57 KiB gzip, with no test switch, figures, scenarios or axe in it. The smoke run now checks the four results routes. 05-UAT.md gives Romain his 46 tests and questions in French. The deploy steps put remote D1 migration 0003 before the Worker. One finding: the friends ranking's D1 reads grow with history (see the budget).**

## Performance

- **Duration:** about 35 min of wall clock, mostly the suites (local 11.5 min, online 11.1 min)
- **Completed:** 2026-11-07
- **Tasks:** 3 (no TDD task in this plan, so no RED/GREEN pair)
- **Files modified:** 2 in the task commits, plus this SUMMARY and deferred-items.md

## Accomplishments

- Every gate is green on the main tree. The suites ran one at a time, and nothing listened on 4173, 4174 or 8787 before or after.
- The release build and the dry run of deploy step 1 were measured and compared with 05-04's measure.
- The D1 budget table is below. The friends ranking re-reads every seat row of the circle on each opening, so its reads grow with history. This is logged in deferred-items.md and in 05-UAT.md test 13.
- `tools/smoke-online.mjs` has four new HTTP steps. They pass against the local `wrangler dev`.
- 05-UAT.md is complete. The gallery of every new screen is in the scratchpad and I looked at each picture.

## Task Commits

1. **Task 1, everything green, size and budget:** no commit. Every suite passed on its first run, so no spec had to change. The measures are in this SUMMARY.
2. **Task 2, the smoke run and Romain's tests:** `6a11e06` feat(05-11): the smoke run checks the results routes, and Romain's tests of the phase
3. **Task 3, the first test after the deploy:** `7e86610` docs(05-11): Romain's first test right after the deploy

## Gate (one suite after another, main tree)

| Command | Result |
|---------|--------|
| `pnpm typecheck` | OK (svelte-check: 644 files, 0 errors, 0 warnings) |
| `pnpm lint` | OK, 427 files, run again after the smoke edit |
| `pnpm test` (Node and workerd) | **136 files, 2 182 passed, 2 skipped**. The 2 skips are the engine's open-point alternatives (`it.skip`, as before). |
| `node tools/selfplay.mjs --games 200` | 200 finished, 0 failed |
| `node tools/rules-trace.mjs` | **OK (16 règles, 125 scénarios)**. The plan says 122, but 04-14 added three R-12 scenarios (122 → 125). |
| Local Playwright (`playwright.config.ts`, both projects) | **667 passed, 189 skipped** (per-device skips), 0 flaky, 11.5 min |
| Online Playwright (`playwright.online.config.ts`, both projects) | **134 passed, 16 skipped**, 0 flaky, 11.1 min. quatre.spec played a 603-move game with four browsers. |
| PWA Playwright (`playwright.pwa.config.ts`, both projects) | **12 passed** |
| Release build, embedded Worker, dry run, `check-bundle` | OK: « bundle OK: 62 separate modules, all from the web build; the rest is inlined » |
| `node tools/smoke-online.mjs http://localhost:8787` | all checks passed (output below) |

No spec was adapted and no product code changed. The two known flaky tests (deferred-items 05-09 and 05-10) passed on their first run.

## The shipped size (release build, no VITE_TOC_DEBUG)

| | 05-04 (after) | 05-11 | Change |
|---|---|---|---|
| `apps/web/dist` raw | 3 101 638 B | 3 182 074 B | +80 436 B |
| `dist` as one tar, gzip -9 | 2 044 887 B | 2 066 460 B | +21 573 B |
| main chunk `index-*.js` | 580 470 B | 643 858 B | +63 388 B |
| main chunk gzip -9 | 187 321 B | 206 376 B | +19 055 B |
| Dry-run Worker (`wrangler deploy --dry-run -c wrangler.embarque.jsonc`) | — | **4 174.84 KiB, gzip 2 205.57 KiB** | — |

05-05 to 05-10 added the lessons, the results panels and the audit fixes. The Worker is about 0.8 MB under research A1's 3 MB Free-plan limit.

- **Bindings in the dry run:** `env.GAME_ROOM (GameRoom)`, `env.PLAYER_HUB (PlayerHub)`, `env.DB (toc)`, `env.RP_ID ("toc.romaindetroyat.workers.dev")`, `env.ORIGIN ("https://toc.romaindetroyat.workers.dev")`. TOC_TEST_MODE is not among them.
- **Durable Object migrations:** `wrangler.embarque.jsonc` still has v1 `GameRoom` and v2 `PlayerHub`, unchanged.
- **What the release files hold:** grep of `apps/web/dist` and `.wrangler/dry`:
  - No rule-figure image: `dist` has no `regles/`, no `R-*.webp` and no figure file (D-15, drawn live).
  - No scenario set: « réparti en 3 + 4 sur deux pions » and « sur sa sortie » are absent.
  - No test package: `axe-core`, `AxeBuilder`, `fast-check` and `@playwright` are absent.
  - « vitest », « scenarios » and « TOC_TEST_MODE » show up only in comments of `index.js.map`, the dry run's source map. Wrangler does not upload it (no `upload_source_maps`).
  - The Worker's own `env.TOC_TEST_MODE` check is in `index.js` as before. Without the binding it is off.

## D1 budget (measured rows from 05-01 and 05-05; estimate for a family of 20)

| Action | Rows written | Rows read |
|--------|--------------|-----------|
| A finished online game with n accounts (one batch) | 5 + n: legacy games 3, played 2, one game_seats row per account (7 with two accounts) | — |
| The same game recorded again (retry) | 0 | — |
| A solo report, added | 3 | 5 |
| A solo report, sent again | 0 | 5 |
| History page of 20 (`GET /api/me/results`) | 0 | 44 (13 for a last page of 5) |
| « Mes chiffres » (`GET /api/me/stats`) | 0 | about 2 per own game + 2 (8–9 for 3 games, 102 for 50) |
| Ranking (`GET /api/me/ranking`) | 0 | about 2 per seat row of every circle member, solo rows included, + session, friendships and users (214 for 11 people with 90 seat rows) |
| Any results route without a cookie | 0 | 0 |

**Assumptions:**
- 20 people, 2 devices each, everyone friends with everyone.
- Per person and per day: 3 online games (2 accounts per table, the case that writes the most), 2 solo games and 10 openings of « Mes résultats ».
- The plan's « 10 result views » is read as per person, the conservative reading.

| Per day | Estimate | Free plan | Share |
|---------|----------|-----------|-------|
| Rows written: 30 tables × 7 + 40 solo × 3 + phase 4's ≈ 250 | ≈ 580 | 100 000 | 0.6 % |
| Rows read, day 1, each opening loads all three panels | ≈ 63 000 | 5 000 000 | 1.3 % |
| Rows read, after a month, same | ≈ 1.3 M | 5 000 000 | 26 % |
| Rows read, after a year, same | ≈ 15 M | 5 000 000 | **≈ 300 %**; the limit is reached around day 120 |
| Rows read, after a year, history 10 times but stats and ranking once a day per person | ≈ 1.6 M | 5 000 000 | 31 %; the limit is reached around year 3 |

How the reads were worked out, after d days:
- Each person has 5d games.
- The circle has 100d seat rows.
- One opening of all three panels reads about 44 + (10d + 2) + (200d + 40).
- If the « 10 result views » are for the whole family, the one-year figure falls to about 0.77 M (15 %).

**Verdict:**
- Writes stay far below the limit.
- Reads fit for a long time at family scale, but the ranking's reads grow linearly with the circle's history: `game_seats` is keyed `(user_id, ended_at, game_id)` and `ranked` is filtered after the scan.
- No change was made here (a schema change). The fix options are in deferred-items.md, and Romain sees the trade-off in test 13 (the Paid plan, or a per-account counter).
- Durable Object rows (the tables' own SQLite, and PlayerHub's rate-limit row per solo report) are counted apart from D1, as in 04-12.

## Smoke run against the local `wrangler dev` (started like the online config, test vars)

```
smoke-online: http://localhost:8787
ok   GET / — 200 text/html; charset=utf-8
ok   POST /api/tables — 201 {"id":"UAOKK2p1Qe5glylNMhNiZg"}
ok   GET /api/tables/<id> — 200 status lobby
ok   GET /api/tables/<unknown> — 404 {"error":"not-found"}
ok   GET /api/me (no cookie) — 401 {"error":"signed-out"}
ok   GET /api/push/key — 200 key of 87 characters
ok   GET /api/invitations/<random code> — 200 state unknown
ok   POST /api/auth/login/options — 200 rpId localhost (site localhost)
ok   GET /sw.js — 200 text/javascript; charset=utf-8, cache-control « public, max-age=0, must-revalidate »
ok   GET /manifest.webmanifest — 200 application/manifest+json, orientation landscape, lang fr
ok   GET /api/me/results (no cookie) — 401 {"error":"signed-out"}
ok   GET /api/me/stats (no cookie) — 401 {"error":"signed-out"}
ok   GET /api/me/ranking (no cookie) — 401 {"error":"signed-out"}
ok   POST /api/me/results/solo (no Origin) — 403 {"error":"origin"}
ok   WebSocket — welcome, assis en bleu, trois ordinateurs de force 5, partie lancée, 4 actions jouées, la carte passée comprise, en 13 s (0 coup(s) en retard rejoué(s)), attente la plus longue d’un ordinateur 2.8 s, partie arrêtée (sauvegardée)
smoke-online: all checks passed
```

The new steps write nothing. Node's fetch sends no Origin, so the solo POST is refused by the Origin check before the body or the session is read. They are not skipped by `--read-only`.

## Deploy steps (for the orchestrator; this plan runs none of them)

Run from the repository root at the commit that passed Task 1, in this order. `$CF` stands for `CLOUDFLARE_API_TOKEN=placeholder CLOUDFLARE_ACCOUNT_ID=d8e3da702508ff6c73870012c228a19d npx -y wrangler@4` (the proxy injects the real token, as in phases 2 and 4).

1. Local build and checks (no network): `pnpm --filter @toc/web build` (production, no VITE_TOC_DEBUG), `node tools/build-embedded-worker.mjs`, `pnpm exec wrangler deploy --dry-run --outdir .wrangler/dry -c wrangler.embarque.jsonc`, `node tools/check-bundle.mjs .wrangler/dry`. The dry run's bindings must list GAME_ROOM, PLAYER_HUB, DB and the vars RP_ID and ORIGIN, and not TOC_TEST_MODE.
2. Remote D1 migration, before the deploy (the new Worker writes and reads played and game_seats): `$CF d1 migrations apply toc --remote -c wrangler.embarque.jsonc`. It must apply 0003_results.sql only (0001 and 0002 are already applied). Record its output. If it fails, do not deploy: the new Worker's record batches would fail and wait for the hourly retry, and solo reports would answer 500.
3. Deploy: `$CF deploy -c wrangler.embarque.jsonc`. No Durable Object migration changes (v1 GameRoom and v2 PlayerHub as before), no new secret. Record the version id and the printed bindings. Rolling back to the phase-4 Worker stays possible: it ignores the two new tables.
4. Smoke: `NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt node tools/smoke-online.mjs https://toc.romaindetroyat.workers.dev`. Every HTTP step must pass.
5. Fill « La mise en ligne » in 05-UAT.md (version, migration output, smoke output), then Romain runs the tests of 05-UAT.md.

**Note for step 1:**
- « The commit that passed Task 1 » is this plan's HEAD (or the docs commit after it). 05-11 changed no product code, only `tools/smoke-online.mjs` and planning files.
- The gates ran on the product code of `1850124`.
- Step 1 was run here exactly as written. The bindings list in « The shipped size » above is the expected output.
- « La mise en ligne » is test 14 of 05-UAT.md.

## 05-UAT.md

The file has 46 tests, all `result: pending`, and its Summary counts 46 pending.

**Tests (1 to 14):**
1. « Tes parties dans « Mes résultats » »
2. « Tes chiffres »
3. « Le classement entre amis »
4. « Une partie contre l’ordinateur sans réseau »
5. « Les règles pendant une partie » (05-04's test 2, kept as written)
6. « Faire les huit leçons » (05-06's test 3, updated: the lessons now open from « Apprendre », and « Quitter les leçons » goes back to the page)
7. « La première fois »
8. « Les formes sur les chevaux »
9. « VoiceOver sur l’iPhone »
10. « TalkBack sur Android »
11. « Relire le texte de la feuille « Règles » » (05-04's test 1, kept word for word)
12. « Relire les phrases du guide » (05-06's test 4, kept word for word)
13. « Le budget de l’offre gratuite de Cloudflare »
14. « La mise en ligne » (for the orchestrator to fill in)

**À confirmer (15 to 46), each heading « À confirmer : … » quoting the choice made:**
- 15–26: UI-SPEC items 1 to 12, in order. Headings 15, 18, 21, 22 and 26 say « déjà décidé par toi » (D-11/D-14, D-12, D-13, D-15, D-10) and why they stay listed.
- 27–32: research assumptions A1 to A6. A4 states the crediting choice. A5 states the 30 s floor, the other thresholds and 30 reports a day.
- 33: the open question, the lesson board 5 to 9 % smaller.
- 34–35: the two unresolved UI-SPEC rows, look-alike pseudos and no ranking by pairs.
- 36–46: the plan SUMMARYs' remaining items:
  - the « novembre 2026 » note
  - the stable marks' place
  - the « Le coup » figures
  - « par force » counting
  - the last plank on the computer
  - the phone pill
  - the solo plank line
  - refused or kept solo reports
  - the cut « Règles » tile line
  - the short and long button names
  - what the screen reader reads

The other SUMMARY items are folded into the UI-SPEC headings they belong to (05-01, 05-08, 05-09) or into the tests.

**Current Test:** test 1, an online game and then « Mes résultats » on both devices. It is the first check the deployed phase allows.

The French follows the file's typography (U+202F inside « », before ; ! ? and %, U+00A0 before :). It uses the tutoiement and the gender-neutral rule: no « connecté », « nouveau venu » or « tous les deux » about a player. The old test bodies were copied byte for byte.

## Romain's real-device checks, in order (after the deploy)

1. An online game with a relative who has an account and a person without one, then both open « Mes résultats »: the right teams and result (tests 1 to 3).
2. A game against the computer in airplane mode: the plank's line, back online, the game in the history, counted in « Mes chiffres » and not in « Classement » (test 4).
3. In a game, « Règles » with the book: « Les cartes » and « Le 7 », the computers waiting (test 5).
4. The eight lessons from « Apprendre », one wrong tap in each (test 6), and « Première fois ? » on a new phone (test 7).
5. The shapes on the knights and the stable marks at arm's length, switched off and on (test 8).
6. VoiceOver: the home, the rules, a lesson, the lit knights' names (test 9); TalkBack if the family has an Android (test 10).
7. Reviews of the rules text and the guide's lines (tests 11 and 12), then the « À confirmer » list.

Each answer goes into 05-UAT.md test by test, and every failure becomes a gap for `/gsd-plan-phase 5 --gaps`.

## Screenshots (looked at)

All files are in `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/`, as `05-11-<name>-844x390.png` and `05-11-<name>-1280x800.png`. They were taken from the final code, a debug build under `wrangler dev`, with reduced motion.

| Name | What it shows |
|------|---------------|
| `accueil-invite` | home without an account: « Se connecter », « Règles » (its line cut to « Les cartes, le 7, la … »), « Apprendre » |
| `accueil-compte` | home with an account: « Mes amis », « Mon compte », « Règles », « Apprendre », « Mes résultats » |
| `premiere-fois` | « Première fois ? » with « Apprendre en 10 minutes » focused and « Plus tard » |
| `apprendre` | #/apprendre with lessons 1 and 2 done, « Continuer : leçon 3 » |
| `lecon1` | lesson 1, « Bienvenue ! » with « Suivant » |
| `lecon6` | lesson 6, the 7's chips with chip 3 ringed |
| `lecon8` | lesson 8, the Roi chosen, « Passer cette carte » |
| `planche` | lesson 1's « Bravo ! » plank |
| `marques` | knights of the four colours on the ring, at home and in the stables, with their shapes, and the stable marks |
| `regles-cartes` | the rules sheet on « Les cartes », the Valet's row outlined |
| `regles-sept` | the rules sheet on « Le 7 », with « Avant » / « Après » |
| `regles-maison` | the rules sheet on « Règles de la maison » |
| `reglages`, `reglages-formes` | Réglages with « Formes sur les chevaux » and « Règles du jeu » |
| `fin-solo` | the solo end plank with « Partie ajoutée à tes résultats. » under the figures |
| `resultats-historique` | « Mes résultats », the history panel |
| `resultats-fiche` | the detail sheet: « Mamie (sans compte) l’ordinateur a fini à sa place », « Pur-sang (ordinateur) » |
| `resultats-chiffres` | « Mes chiffres » |
| `resultats-classement` | « Classement »: 1er, 2e, 2e, 4e, one's own row outlined with « toi » |
| `resultats-le-classement` | the sheet « Le classement » |

How they were made:
- A temporary probe spec (`e2e-online/zz-shots-0511.spec.ts`) took most of them. It was deleted before any commit.
- The `resultats-*` files come from 05-09's TOC_SHOTS test, renamed.
- For `fin-solo` the probe answered the solo POST with 201 itself, because the seeded game under reduced motion can end below the 30 s floor (see deferred-items).

Everything fits and nothing overlaps.

## Deviations from Plan

### Plan wording

**1. rules-trace prints 125 scenarios, not 122**
- **Found during:** Task 1.
- **Issue:** The must-have quotes « OK (16 règles, 122 scénarios) ». Plan 04-14 added R-12.11 to R-12.13 (122 → 125), as its SUMMARY records.
- **Fix:** None needed. 125 is the right count and is recorded here.

**2. Task 1 has no commit**
- **Issue:** Every suite passed on its first run, so there was no spec to adapt and nothing to commit.
- **Fix:** The measures are in this SUMMARY.

**3. « Current Test » in two steps**
- **Issue:** Task 2 had to complete 05-UAT.md, and Task 3 had to point « Current Test » at the first test after the deploy.
- **Fix:** Task 2 left « Current Test » on the rules text (now test 11), as it stood before the plan. Task 3 moved it to test 1, so each task has its own commit.

### Auto-fixed Issues

None. No product code changed.

### Findings, not fixed (out of scope; deferred-items.md)

- **The ranking's D1 reads grow with the circle's history.** At the plan's family pace, with every opening going to « Classement », the Free plan's daily read limit would be reached after about four months. This needs a schema or index change, which is a decision for a later plan. It is put to Romain in UAT test 13.
- **The seeded e2e solo game can end below the 30 s floor** under reduced motion. The real spec does not reduce motion and passes.

## Known Stubs

None.

## Threat Flags

None. The smoke steps only read. The threat register's mitigations hold:
- T-05-30: deploy step 2 comes before step 3.
- T-05-31: TOC_TEST_MODE is absent from the bindings.
- T-05-32: the smoke output is here, and test 14 is waiting for the deploy record.
- T-05-33: the budget table above.
- T-05-SC: no package was added.

## Deploy Notes

- This plan ran no remote command: no remote D1 migration, no deploy, no secret and no tail. Use the deploy steps above, migration 0003 first.
- No Durable Object migration change (v1 GameRoom, v2 PlayerHub), no PROTOCOL_VERSION change, no new secret or package. The wrangler configs are untouched.
- `apps/web/dist` and `worker-embedded/` currently hold the release build from step 1 (gitignored). The orchestrator's step 1 rebuilds them anyway.

## For Romain to confirm

- Everything in 05-UAT.md, starting with test 1 after the deploy. The 32 « À confirmer » items stand as written unless he says otherwise.
- Test 13: whether the ranking's growing reads are acceptable for now (Paid plan later, or a counter to plan).

## Self-Check: PASSED

- FOUND: tools/smoke-online.mjs (contains /api/me/results, /api/me/ranking and /api/me/results/solo), .planning/phases/05-suivi-apprentissage-et-finition/05-UAT.md (32 « À confirmer » headings, « Relire le texte », « Relire les phrases du guide », « VoiceOver », « Current Test »)
- FOUND commits: 6a11e06, 7e86610 (ancestors of HEAD)
- FOUND: 40 screenshots 05-11-*.png in the scratchpad, looked at
- Ports 4173, 4174 and 8787 free; no wrangler or workerd process left; the probe spec deleted
