---
phase: 03-l-ordinateur-la-force-choisie
plan: 02
subsystem: bots
tags: [bots, ladder, evaluation, exchange, worker_threads, wilson]

requires:
  - phase: 03-l-ordinateur-la-force-choisie
    provides: "03-01: BotLevel, LEVEL_PARAMS, evaluate, candidatesFor, createThinker / chooseAction, sevenOutcomes"
provides:
  - "@toc/bots playGame / ladderSeeds / seatStreams (match.ts): one pure game between two team levels, injected clock"
  - "tools/ladder.mjs: level-vs-level on paired seeds, Wilson 95 % interval, verdict, exit 0/1/2"
  - "evaluate.ts: risk term (se protéger), handBonus (cards kept), scoreCandidates"
  - "exchange.ts: giveScores (D-09), used by levels 2 to 5 in the exchange"
  - "Thought.units (work spent)"
  - "levels.ts: frozen named constants with their ladder runs"
affects: [03-04, 03-05, 03-07, phase-2 durable object]

actuals:
  tokens: 13830
  tasks: 3
  commits: 3
plan_head_before: f8cd98f15cef0702563d5e63a9b65c0b111a816d
plan_head_after: 1ce1485030f28e4399e40ff4775988e98b6ac487

tech-stack:
  added: []
  patterns:
    - "Ladder: pair i = (deal seed, bot seed) from one sfc32 stream, played twice with the teams swapped; one bot stream per seat"
    - "Bar « nettement »: p̂ ≥ 60 % and Wilson 95 % lower bound > 55 % over 400 games"
    - "Play scores = evaluate(after) + handBonus(cards kept, after); give scores = partner's best gain − 0.6 × own best gain"
    - "packages/bots never reads a clock: the ladder injects performance.now through playGame's time hook"

key-files:
  created:
    - packages/bots/src/match.ts
    - packages/bots/src/exchange.ts
    - packages/bots/src/teamplay.test.ts
    - packages/bots/test/ladder.test.ts
    - tools/ladder.mjs
  modified:
    - packages/bots/src/evaluate.ts
    - packages/bots/src/thinker.ts
    - packages/bots/src/thinker.test.ts
    - packages/bots/src/index.ts
    - packages/bots/src/levels.ts

key-decisions:
  - "Starting level parameters kept (level 2 ε 0.5 T 20, level 3 T 8, level 4 T 3): every step passed with p̂ ≥ 63 % on the first run, so no tuning was triggered"
  - "The 4 is kept (handBonus) when the 4 backward brings a knight nearer its carré 16, which under G14 is progress 0 to 2, not « 1 to 3 cells past the exit »"
  - "giveScores scores one card per rank (two cards of a rank are worth the same), so the softmax of levels 2 to 4 does not favour a duplicated rank"
  - "Risk is symmetric: every ring knight, ours and theirs, loses value × min(0.9, 0.1 × threats)"

patterns-established:
  - "Re-run the three ladder steps whenever evaluate.ts or levels.ts changes (research Pitfall 7); the runs are recorded in levels.ts"

requirements-completed: [BOT-02, BOT-03]

coverage:
  - id: D1
    description: "The ladder tool: paired seeds, Wilson interval, verdict and exit code; deterministic smoke"
    requirement: BOT-02
    verification:
      - kind: unit
        ref: "packages/bots/test/ladder.test.ts"
        status: pass
      - kind: other
        ref: "node tools/ladder.mjs --a 2 --b 1 --games 400 --workers 4 (exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Levels 2 → 1, 3 → 2 and 4 → 3 each win « nettement » over 400 paired games"
    requirement: BOT-02
    verification:
      - kind: other
        ref: "node tools/ladder.mjs --a 2 --b 1 / --a 3 --b 2 / --a 4 --b 3 --games 400 --workers 4 (all exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The team evaluation's four goals and the exchange card on fixed positions; same give whatever the partner's hand"
    requirement: BOT-03
    verification:
      - kind: unit
        ref: "packages/bots/src/teamplay.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Fewer and fewer mistakes from level 2 to level 4 (D-05)"
    requirement: BOT-02
    verification:
      - kind: unit
        ref: "packages/bots/src/teamplay.test.ts#fewer and fewer mistakes (D-05)"
        status: pass
    human_judgment: false

duration: 14min
completed: 2026-10-15
status: complete
---

# Phase 3 Plan 02: Les niveaux 2 à 4 — le jeu d'équipe, la carte d'échange, et l'échelle qui le prouve Summary

**A level ladder on 400 paired games (worker_threads, Wilson 95 %) proves Trotteur > Poulain 92.5 %, Galopeur > Trotteur 98.3 % and Pur-sang > Galopeur 66.3 %. Behind it is one team evaluation that now prices threats on knights and the cards kept, plus an exchange give scored as partner gain − 0.6 × own loss on public information.**

## Performance

- **Duration:** about 14 min
- **Started:** 2026-10-15T10:49:00Z
- **Completed:** 2026-10-15T11:03Z
- **Tasks:** 3
- **Files modified:** 10 (5 created, 5 modified)

## Accomplishments

- `playGame({ levels, dealSeed, botSeed, budgets?, time? })` plays one pure game with every action going through `apply`. Each seat has its own sfc32 stream (`seatStreams`), and decision time is measured only through an injected clock. `ladderSeeds(seed, pairs)` is the stream shared by the tool and the smoke test.
- `tools/ladder.mjs` splits the pairs across worker threads. It prints p̂, the Wilson 95 % interval, the pairs 2–0 / 1–1 / 0–2, ms per decision (mean, p95, max) and units per side, the wall time and the verdict. Exit codes: 0 PASS, 1 FAIL or a failed game (printed with its seeds), 2 bad arguments (odd `--games`, level outside 1–5, missing `--a`/`--b`, unknown option, bar outside (0, 1)).
- `evaluate.ts` adds a risk term for every ring knight not protected on its own exit. Threats are: an opponent 1–7 cells behind (full), 8–13 behind except 11 (half), an opponent exactly 4 ahead, and an opponent's exit while that opponent has stable knights. It also adds `handBonus`: 10 per As/Roi kept while a controlled knight waits in the stable, and 10 per 4 kept while a controlled knight stands where the 4 backward helps. New export: `scoreCandidates`.
- `exchange.ts`'s `giveScores` reads the view's board and the bot's own hand only. Levels 2–4 pick the give through ε + softmax, level 5 takes the best, and level 1 is still exactly randomLegal.
- Head to head (scratch, not committed): this evaluation beat 03-01's 305 / 400 = 76.3 % at T = 0, and 303 / 400 = 75.8 % at T = 3.

## Ladder runs (committed values, seed 1, 4 workers, this container)

```
ladder: A=2 (Trotteur) vs B=1 (Poulain), 400 games (200 pairs), seed 1
games: 400 (400 finished, 0 failed)
A wins: 370 / 400, p̂ = 92.5 %
Wilson 95 %: [89.5 %, 94.7 %]
pairs: 2–0 171, 1–1 28, 0–2 1
A decisions: 120817, mean 0.41 ms, p95 1.51 ms, max 119.5 ms, units 459609
B decisions: 118349, mean 0.31 ms, p95 1.12 ms, max 53.1 ms, units 515160
wall time: 25.2 s (4 workers)
verdict: PASS (bar: p̂ ≥ 60 % and Wilson lower bound > 55 %)
```

```
ladder: A=3 (Galopeur) vs B=2 (Trotteur), 400 games (200 pairs), seed 1
games: 400 (400 finished, 0 failed)
A wins: 393 / 400, p̂ = 98.3 %
Wilson 95 %: [96.4 %, 99.1 %]
pairs: 2–0 193, 1–1 7, 0–2 0
A decisions: 67535, mean 0.33 ms, p95 1.24 ms, max 78.0 ms, units 246538
B decisions: 64362, mean 0.30 ms, p95 1.16 ms, max 73.9 ms, units 240635
wall time: 12.7 s (4 workers)
verdict: PASS (bar: p̂ ≥ 60 % and Wilson lower bound > 55 %)
```

```
ladder: A=4 (Pur-sang) vs B=3 (Galopeur), 400 games (200 pairs), seed 1
games: 400 (400 finished, 0 failed)
A wins: 265 / 400, p̂ = 66.3 %
Wilson 95 %: [61.5 %, 70.7 %]
pairs: 2–0 80, 1–1 105, 0–2 15
A decisions: 62254, mean 0.38 ms, p95 1.47 ms, max 71.6 ms, units 230948
B decisions: 61163, mean 0.38 ms, p95 1.46 ms, max 54.7 ms, units 227214
wall time: 13.7 s (4 workers)
verdict: PASS (bar: p̂ ≥ 60 % and Wilson lower bound > 55 %)
```

- Task 1, before the new terms: 2 → 1 was 359 / 400 = 89.8 % (Wilson [86.4 %, 92.4 %]), PASS.
- An extra check on seed 2: 4 → 3 was 266 / 400 = 66.5 % (Wilson [61.7 %, 70.9 %]), PASS.
- The win counts are deterministic: reruns gave identical counts, and the 10-game smoke gave 10/10, 9/10 and 3/10 on two runs.
- The 4 → 3 smoke is a « finishes every game » check only. Its 3/10 on seed 7 is within the noise of 10 games.

## Task Commits

1. **Task 1: Traceur — l'échelle Trotteur contre Poulain sur 400 parties appariées** - `21bd7a4` (feat)
2. **Task 2: Le jeu d'équipe — se protéger, la main, et la carte passée au partenaire** - `870f2eb` (feat)
3. **Task 3: Régler et prouver l'échelle 1 → 4** - `1ce1485` (chore)

## Verification (end gate)

- `pnpm typecheck` OK (svelte-check 0 errors), `pnpm lint` OK (162 files).
- `pnpm test`: 43 files, **875 passed, 2 skipped**. The baseline was 853 passed, 2 skipped; the new tests are 7 in ladder.test.ts and 15 in teamplay.test.ts.
- `node tools/rules-trace.mjs`: OK (16 règles, 122 scénarios).
- `node tools/selfplay.mjs --games 200`: 200 finished, 0 failed.
- The three ladder steps exit 0 on the committed values (outputs above).
- Playwright: the plan names no spec. Because bot moves change inside the game, I ran the 03-01 set (`force`, `launch`, `partie`, `partie-complete`) on both projects: **33 passed, 1 skipped, 0 failed**, the same as the baseline (the skip is partie-complete's own phone skip).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The 4 kept « while a knight sits 1 to 3 cells past its exit »**
- **Found during:** Task 2
- **Issue:** Under G14, a 4 played from progress 3 lands at −1, one cell past the carré 16 (71 steps from it). That is the worst cell, not the trick. The trick works from progress 0, 1 and 2, which end 2, 1 and 0 steps from the carré 16.
- **Fix:** `handBonus` credits a kept 4 when the 4 backward brings a controlled knight nearer its carré 16. The condition is computed with `distanceToEntry`, which amounts to progress 0–2.
- **Files modified:** packages/bots/src/evaluate.ts
- **Commit:** 870f2eb

**2. [Rule 3 - Blocking] Thought's exact shape in a 03-01 test**
- **Found during:** Task 1
- **Issue:** `thinker.test.ts` compares a whole Thought with `toEqual`, and Thought now carries `units`.
- **Fix:** `units: 1` was added to the expected object. The assertion is otherwise unchanged.
- **Files modified:** packages/bots/src/thinker.test.ts
- **Commit:** 21bd7a4

### Other notes

- `giveScores` returns one card per rank, the first in hand order, rather than one per card id (see key decisions).
- `match.ts` also exports `seatStreams` and `ladderSeeds`, so the ladder, the smoke test and later tools draw the same seeds.
- The « over 10 paired games » smoke is 5 pairs × 2 games for each level pair (seed 7).
- No weight or level tuning was needed. The head-to-head check of the new evaluation used a scratch copy of 03-01's bot files, deleted before any commit.
- I did not edit STATE.md, ROADMAP.md, REQUIREMENTS.md or WINDOWS.md (the orchestrator owns tracking).

## Known Stubs

Intentional, scheduled by the phase plans (unchanged from 03-01):
- packages/bots/src/thinker.ts: level 5 is still the greedy T = 0 pick, and `Budget` is accepted but unused. Plan 03-04 adds the search and the 5 → 4 ladder step, and may soften level 4 if 5 → 4 is narrow.

The 03-01 stubs for the exchange give and the evaluation's missing risk and hand terms are resolved by this plan.

## Threat Flags

None. No network, auth or storage surface was added. T-03-05 (the give reads only the view) is mitigated and tested by « gives the same card whatever the partner's hidden hand ». T-03-06 (ladder arguments) is validated, with exit 2 tested. T-03-SC: no package added; worker_threads is built in.

## Self-Check: PASSED

- Created files exist: packages/bots/src/match.ts, packages/bots/src/exchange.ts, packages/bots/src/teamplay.test.ts, packages/bots/test/ladder.test.ts, tools/ladder.mjs.
- Commits 21bd7a4, 870f2eb and 1ce1485 are ancestors of HEAD.
