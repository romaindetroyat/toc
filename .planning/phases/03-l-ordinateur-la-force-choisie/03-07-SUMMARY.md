---
phase: 03-l-ordinateur-la-force-choisie
plan: 07
subsystem: verification
tags: [verification, ladder, bench, playwright, uat, flaky-test]

requires:
  - phase: 03-l-ordinateur-la-force-choisie
    provides: "03-01 to 03-06: the five levels, the Champion, the pace, the thinking sign, #/banc, tools/ladder.mjs, tools/bench-bots.mjs, the 5 → 4 record"
provides:
  - "The phase's evidence in one place: full gates green, the « Échelle des niveaux » table (4 steps), the bench table, the no-cheat sample count"
  - ".planning/phases/03-l-ordinateur-la-force-choisie/03-UAT.md: Romain's 21 acceptance tests (8 at the table, 13 « À confirmer »), all [pending]"
  - "A deterministic botRunner yield test (the flaky « 1 failed | 932 passed » of the phase)"
affects: [phase-3 verification, /gsd-verify-work 3]

actuals:
  tokens: 3650
  tasks: 2
  commits: 2
plan_head_before: 8644ecf60eb5b51145b7a34fd66145fece77314c
plan_head_after: 3ec511715316df06457561a202e67915f58f2dc5

tech-stack:
  added: []
  patterns:
    - "Prove an event-loop yield in Node without racing a timer: a microtask queued at one slice boundary has run by the next, and one MessageChannel message is posted per boundary"

key-files:
  created:
    - .planning/phases/03-l-ordinateur-la-force-choisie/03-UAT.md
  modified:
    - apps/web/src/game/botRunner.test.ts

key-decisions:
  - "The 5 → 4 record of 03-04 stands: git diff 57467d4..HEAD -- packages/bots/src packages/engine/src is empty, so the 12-minute run was not repeated"
  - "No e2e spec needed adapting: the full suite was green on its first run"
  - "Two « À confirmer » items added beyond the plan's list (from the 03-02 and 03-04 choices): the Champion's strength bounded by time (300 units), and the spread between levels (Galopeur 98 % over Trotteur, Pur-sang 66 % over Galopeur)"

patterns-established: []

requirements-completed: [BOT-01, BOT-02, BOT-03, BOT-04, BOT-05]

coverage:
  - id: D1
    description: "Full gates green on the final code: typecheck, lint, vitest, selfplay 200, rules-trace 16 / 122, full Playwright on both projects"
    verification:
      - kind: other
        ref: "pnpm typecheck && pnpm lint && pnpm test; node tools/selfplay.mjs --games 200; node tools/rules-trace.mjs --images; pnpm --filter @toc/web exec playwright test"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each level beats the one below « nettement » (p̂ ≥ 60 %, Wilson lower bound > 55 %, 400 paired games)"
    requirement: BOT-02
    verification:
      - kind: other
        ref: "node tools/ladder.mjs --a 2/3/4 --b 1/2/3 --games 400 --workers 4 (exit 0); 03-04-ladder-5-4.txt verdict PASS"
        status: pass
    human_judgment: false
  - id: D3
    description: "Level-5 decision time on the fixed bench within its ceiling on this machine"
    requirement: BOT-05
    verification:
      - kind: other
        ref: "node tools/bench-bots.mjs --level 5 --check (exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Romain's acceptance tests and open choices"
    verification: []
    human_judgment: true
    rationale: "03-UAT.md, 21 tests [pending]: real iPhone, feel of the pace and strength, wording"

duration: 18min
completed: 2026-10-15
status: complete
---

# Phase 3 Plan 07: Vérification finale, l'échelle des niveaux, et la recette de Romain Summary

**Every gate passes on the final code. On the gates' first run, 1 vitest failure appeared and 0 Playwright failures. That vitest failure was the phase's flaky test: the botRunner « yields to the event loop » case, which raced a `setTimeout(0)` that Node can starve. It is now deterministic. The ladder passes all four steps (92.5 %, 98.3 %, 66.3 %, 81.8 %). The Champion's bench p95 is 197–228 ms (ceiling 250 ms). Romain has 21 acceptance tests in French in 03-UAT.md, 13 of them « À confirmer ».**

## Performance

- **Duration:** about 18 min (12:38 to 12:56 UTC)
- **Tasks:** 2
- **Files:** 2 (1 created, 1 modified)

## Gates (final code)

| Gate | Result | Baseline before 03-07 |
|------|--------|-----------------------|
| `pnpm typecheck` | OK (svelte-check 307 files, 0 errors) | OK |
| `pnpm lint` | OK (biome, 180 files) | OK |
| `pnpm test` | 49 files, **933 passed, 2 skipped** | 933 / 2 |
| `node tools/selfplay.mjs --games 200` | **200 finished, 0 failed** (seed 1, 10.6 s) | 200 finished |
| `node tools/rules-trace.mjs --images` | **OK (16 règles, 122 scénarios)** | 16 / 122 (unchanged) |
| Playwright, full suite, both projects | **408 passed, 96 skipped, 0 failed** (504 tests, 6.9 min) | end of phase 1: 353 passed, 89 skipped, 0 failed |
| `node tools/bench-bots.mjs --level 5 --check` | exit 0 | exit 0 |

- `pnpm test` ran **7 times** after the fix, all 933 passed / 2 skipped: 5 runs in a row (2 of them while the three ladders loaded the 4 cores), 1 run while the full Playwright suite ran, and the final gate.
- The Playwright run was the first and only one. It ran with `pnpm test` alongside it, and nothing failed or was retried (the config has no retries). The 7 new skips over phase 1 are the two project guards of `banc.spec.ts`: its desktop-only measured runs in the phone project, and its phone smoke in the desktop project. Phase 3 added no other `skip` or `fixme` in e2e (`git diff 603a234..HEAD -- apps/web/e2e`).
- **Specs adapted in this plan: none.** The specs that encoded the level-1 bot or the old 700–1300 ms think were already adapted in 03-01 (launch.spec radio scope) and 03-05 (rythme.spec, and the exchange « second wait » unit test). The full suite found nothing more.

## Échelle des niveaux

Bar: p̂ ≥ 60 % and Wilson 95 % lower bound > 55 %, 400 games = 200 pairs with swapped deals, seed 1, 4 workers.

| Step | Games | Wins of the higher level | p̂ | Wilson 95 % | Verdict | Source |
|------|-------|--------------------------|----|-------------|---------|--------|
| 2 → 1 (Trotteur vs Poulain) | 400 | 370 | 92.5 % | [89.5 %, 94.7 %] | PASS | fresh run, final code |
| 3 → 2 (Galopeur vs Trotteur) | 400 | 393 | 98.3 % | [96.4 %, 99.1 %] | PASS | fresh run, final code |
| 4 → 3 (Pur-sang vs Galopeur) | 400 | 265 | 66.3 % | [61.5 %, 70.7 %] | PASS | fresh run, final code |
| 5 → 4 (Champion vs Pur-sang) | 400 | 327 | 81.8 % | [77.7 %, 85.2 %] | PASS | 03-04 record (`03-04-ladder-5-4.txt`) |

- The three fresh runs give exactly the counts of 03-02, as expected: the ladder is seeded, and levels 2 to 4 have not changed since 03-02. Their timing columns (for example a 3 → 2 max of 1077 ms) are inflated, because `pnpm test` was running at the same time. The bench below is the timing evidence.
- **5 → 4 validity (T-03-17):** `git diff 57467d4..HEAD -- packages/bots/src packages/engine/src` is empty. 57467d4 is the 03-04 commit that recorded the run. Its Task 3 notes that the code of levels.ts, evaluate.ts, search.ts and determinize.ts had not changed since the run, comments aside. The recorded run therefore describes the shipped bot.

Fresh outputs:

```
ladder: A=2 (Trotteur) vs B=1 (Poulain), 400 games (200 pairs), seed 1
games: 400 (400 finished, 0 failed)
A wins: 370 / 400, p̂ = 92.5 %
Wilson 95 %: [89.5 %, 94.7 %]
pairs: 2–0 171, 1–1 28, 0–2 1
wall time: 34.7 s (4 workers)
verdict: PASS (bar: p̂ ≥ 60 % and Wilson lower bound > 55 %)

ladder: A=3 (Galopeur) vs B=2 (Trotteur), 400 games (200 pairs), seed 1
games: 400 (400 finished, 0 failed)
A wins: 393 / 400, p̂ = 98.3 %
Wilson 95 %: [96.4 %, 99.1 %]
pairs: 2–0 193, 1–1 7, 0–2 0
wall time: 25.4 s (4 workers)
verdict: PASS (bar: p̂ ≥ 60 % and Wilson lower bound > 55 %)

ladder: A=4 (Pur-sang) vs B=3 (Galopeur), 400 games (200 pairs), seed 1
games: 400 (400 finished, 0 failed)
A wins: 265 / 400, p̂ = 66.3 %
Wilson 95 %: [61.5 %, 70.7 %]
pairs: 2–0 80, 1–1 105, 0–2 15
wall time: 23.1 s (4 workers)
verdict: PASS (bar: p̂ ≥ 60 % and Wilson lower bound > 55 %)
```

## Bench (this container, quiet machine, 40 fixed positions × 3 repeats)

| Level | Decisions | p50 | p95 | max | Units per decision | Slowest position |
|-------|-----------|-----|-----|-----|--------------------|------------------|
| 2 Trotteur | 120 | 0.2 ms | 11.2 ms | 18.4 ms | 14.5 | partie 2, action 85, jaune, 70 candidats (7 : 64 issues) |
| 3 Galopeur | 120 | 0.2 ms | 12.2 ms | 13.7 ms | 14.5 | partie 2, action 85, jaune, 70 candidats (7 : 64 issues) |
| 4 Pur-sang | 120 | 0.2 ms | 12.0 ms | 18.6 ms | 14.5 | partie 3, action 174, bleu, 49 candidats (7 : 41 issues) |
| 5 Champion | 120 | 46.0 ms | 227.7 ms | 417.0 ms | 293.6 | partie 5, action 56, vert, 40 candidats (7 : 34 issues) |

`--level 5 --check` run: p50 43.1 ms, p95 197.4 ms, max 462.4 ms. `check: OK (level 5 p95 ≤ 250 ms and max ≤ 600 ms on this machine)`, exit 0.

In the browser (03-06, Chromium on this machine, Champion, `#/banc`): p95 171 / 182 ms and max 363 / 309 ms at 1280 × 800 / 844 × 390, with the longest frozen frame at 32 / 43 ms. The real iPhone figure is UAT test 7.

## No-cheat property (BOT-04, from 03-04)

`packages/bots/src/noCheat.test.ts` checks each of levels 1 to 5 on **100 fast-check samples** (seed 20261015 + level; level 5 at 40 units), 500 samples in all. Each redealt state must give the same view and the same Thought. The redeal changes the hidden cards in more than half of the samples, and the test asserts it. The cheating stub fails on the first sample, which shrinks to a new game in the exchange. The test ran green in every `pnpm test` above.

## Task Commits

1. **Task 1: Tout au vert, l'échelle complète et les temps de décision** - `2ca8fe1` (test): the deterministic yield test. The reports are in this SUMMARY.
2. **Task 2: La recette de Romain dans 03-UAT.md** - `3ec5117` (docs)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Flaky test] botRunner « yields to the event loop between slices of the Champion's search »**
- **Found during:** Task 1. The first `pnpm test` gave « 1 failed | 932 passed | 2 skipped ». This is the same count the orchestrator saw once after 03-06. The test passes alone (3 out of 3 runs).
- **Issue:** the test scheduled `setTimeout(0)` and expected it to run before the Champion's sliced think resolved. Node handles up to 1000 messages of one MessagePort in a single event-loop turn (`MessagePort::OnMessage` processing limit) before it reaches the timers phase. So under load the whole sliced search can finish before the timer. The yield is still real: each slice is a separate MessagePort callback, and the stack unwinds between slices. The test measured Node's scheduler, not the runner. Product code is unaffected: in the browser each message is its own task, and banc.spec's « Plus longue image figée » (32–43 ms) shows that the page keeps painting.
- **Fix:** two deterministic checks with the same intent. (a) A microtask queued at each slice boundary must have run by the next boundary, which a synchronous loop can never do. (b) One `MessageChannel` message is posted per boundary, counted through a temporary subclass of the global, so the yield is a macrotask and not a promise. The move is still compared with `chooseAction`. No wall-clock assertion is left. The case would fail for a synchronous loop (a) and for a promise-only yield (b).
- **Files modified:** apps/web/src/game/botRunner.test.ts
- **Commit:** 2ca8fe1
- **Evidence:** 7 green `pnpm test` runs after the fix, including runs under ladder load and during Playwright.

### Other notes

- The other wall-clock tests were reviewed: `seven.test.ts` « nextSteps stays under 5 ms » takes the best of 7 runs after a warm-up. The GameController pace tests run on fake timers, and the other botRunner cases use the counting clock or settle synchronously. None failed in 7 runs, so they were left unchanged.
- 03-UAT.md has 13 « À confirmer » items, two more than the plan's 11 (items 20 and 21), from choices that 03-02 and 03-04 made for Romain.
- I did not edit STATE.md, ROADMAP.md, REQUIREMENTS.md, WINDOWS.md, .claude/CLAUDE.md or the config. No package was added (T-03-SC).

## UAT list (03-UAT.md)

1. La force de chaque ordinateur au lancement (iPhone tenu en largeur, puis ordinateur)
2. Chaque place joue à sa force
3. Contre deux Champions : un vrai jeu d’équipe
4. Le Champion comme partenaire, et la carte qu’il te passe
5. Le temps de réflexion
6. Le signe « réfléchit »
7. Le banc d’essai sur l’iPhone (#/banc, Safari puis l’app de l’écran d’accueil)
8. L’échelle des niveaux (lecture), with the four-step table
9. À confirmer : pas de chiffre à côté du nom de la force
10. À confirmer : les mots de l’écran de lancement
11. À confirmer : la mémoire par rôle plutôt que par couleur
12. À confirmer : la respiration du signe « réfléchit »
13. À confirmer : la disposition de l’écran de lancement
14. À confirmer : le résumé des équipes remplacé par les lignes de force
15. À confirmer : le banc d’essai caché à l’adresse #/banc
16. À confirmer : les seuils du verdict du banc
17. À confirmer : ce que veut dire « nettement plus fort »
18. À confirmer : les temps de réflexion
19. À confirmer : la force non affichée pendant la partie
20. À confirmer : la force du Champion bornée par le temps
21. À confirmer : l’écart entre les niveaux

## Known Stubs

None.

## Threat Flags

None. T-03-17 is mitigated: the 5 → 4 record was accepted on an empty bot and engine diff, the other steps were re-run, and their seeds and commands are printed. T-03-SC: no package was added.

## Self-Check: PASSED

- 03-UAT.md exists (21 `###` tests, 13 « À confirmer », 21 `result: [pending]`). apps/web/src/game/botRunner.test.ts is modified.
- Commits 2ca8fe1 and 3ec5117 are ancestors of HEAD.
