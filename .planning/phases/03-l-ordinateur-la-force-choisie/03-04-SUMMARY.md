---
phase: 03-l-ordinateur-la-force-choisie
plan: 04
subsystem: bots
tags: [bots, champion, monte-carlo, determinization, no-cheat, fast-check, bench, ladder]

requires:
  - phase: 03-l-ordinateur-la-force-choisie
    provides: "03-02: evaluate / scoreCandidates / giveScores, playGame, tools/ladder.mjs, LEVEL_PARAMS frozen"
provides:
  - "@toc/bots search.ts createSearch: flat Monte-Carlo over imagined deals, anytime, budget in work units"
  - "@toc/bots determinize.ts determinize(view, seat, rng) -> [World, Rng] and knowledge.ts unknownCards / hiddenCounts / partnerHolds"
  - "level 5 in the play phase steps the search through createThinker / chooseAction (default CHAMPION_BUDGET 300 units)"
  - "engine PlayerView.givenToPartner (the seat's own give)"
  - "@toc/bots benchPositions() (40 fixed decisions) and tools/bench-bots.mjs (--level, --repeat, --check)"
  - "the 5 -> 4 ladder record 03-04-ladder-5-4.txt"
affects: [03-05, 03-06, 03-07, phase-2 durable object]

actuals:
  tokens: 16746
  tasks: 3
  commits: 3
plan_head_before: 6c152fb584a8ffbd8496ff8906d408b1cc27713d
plan_head_after: 57467d44cc3c707c9c6f94002029a5b5d6bc630a

tech-stack:
  added: []
  patterns:
    - "Level 5 = PIMC: top 6 by static score plus every opponent capture and home entry; one imagined deal per round, every kept candidate rolled out 4 plies on the same deal with the noiseless policy for every seat"
    - "A deal is started only when its whole cost (kept x (1 + plies)) still fits the budget: units never exceed it, and the move does not depend on how the host slices step()"
    - "determinize.ts is the one bots file allowed to name GameState (an imagined one), by an explicit allow-list in the purity guard"
    - "No-cheat property: redeal the hidden cards keeping what the seat knows; the views must be equal and every level's Thought too; a cheating stub must fail it"

key-files:
  created:
    - packages/bots/src/knowledge.ts
    - packages/bots/src/determinize.ts
    - packages/bots/src/search.ts
    - packages/bots/src/search.test.ts
    - packages/bots/src/noCheat.test.ts
    - packages/bots/src/bench.ts
    - packages/bots/src/bench.test.ts
    - tools/bench-bots.mjs
    - .planning/phases/03-l-ordinateur-la-force-choisie/03-04-ladder-5-4.txt
  modified:
    - packages/bots/src/thinker.ts
    - packages/bots/src/levels.ts
    - packages/bots/src/index.ts
    - packages/bots/src/thinker.test.ts
    - packages/bots/src/teamplay.test.ts
    - packages/bots/test/purity.test.ts
    - packages/engine/src/types.ts
    - packages/engine/src/view.ts
    - packages/engine/test/deal.test.ts
    - packages/engine/test/props/render.test.ts
    - tools/ladder.mjs

key-decisions:
  - "Level 5 budget 300 units (6 kept x 10 deals x (1 + 4 plies)): 12 deals failed the bench (p95 258.8 ms, max 691 ms); 11 passed by only 6 ms; 10 is the most that passes with a margin"
  - "No lever of Task 3 step 3 was needed: the 100-game probe at 300 units gave 85 %, the 400-game run 81.8 %; level 4's T stays 3"
  - "Level 5's Thought.units counts only its search plies (0 for a single candidate, as in the plan); levels 1 to 4 and every exchange keep one unit per candidate"
  - "Captures kept on top of the top K are captures of opponents only (eating the partner is never forced into the search)"
  - "determinize.ts may name GameState (it builds an imagined one from the view): an explicit one-file allow-list in purity.test.ts rather than a type alias that would dodge the guard silently"

patterns-established:
  - "Re-run `node tools/bench-bots.mjs --level 5 --check` whenever search.ts, determinize.ts, evaluate.ts or the level-5 constants change"

requirements-completed: [BOT-02, BOT-03, BOT-04, BOT-05]

coverage:
  - id: D1
    description: "Level 5 chooses by a Monte-Carlo search over imagined deals, anytime, within its unit budget, deterministic"
    requirement: BOT-02
    verification:
      - kind: unit
        ref: "packages/bots/src/search.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Level 5 beats level 4 « nettement » over 400 paired games"
    requirement: BOT-02
    verification:
      - kind: other
        ref: "node tools/ladder.mjs --a 5 --b 4 --games 400 --workers 4 (03-04-ladder-5-4.txt, exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Level 5 team play: escapes, eats its partner's threat, enters home, gives As/Roi/4"
    requirement: BOT-03
    verification:
      - kind: unit
        ref: "packages/bots/src/teamplay.test.ts#level 5, the Champion, plays for its team"
        status: pass
    human_judgment: false
  - id: D4
    description: "Hidden cards never change the move of levels 1 to 5; the negative control fails; GameState is a type error; givenToPartner is the seat's own give only"
    requirement: BOT-04
    verification:
      - kind: unit
        ref: "packages/bots/src/noCheat.test.ts"
        status: pass
      - kind: unit
        ref: "packages/engine/test/deal.test.ts#viewFor: givenToPartner"
        status: pass
    human_judgment: false
  - id: D5
    description: "Level-5 decision time on the fixed bench: p95 <= 250 ms and max <= 600 ms on this machine"
    requirement: BOT-05
    verification:
      - kind: other
        ref: "node tools/bench-bots.mjs --level 5 --check (exit 0)"
        status: pass
    human_judgment: false

duration: 29min
completed: 2026-10-15
status: complete
---

# Phase 3 Plan 04: Le Champion — il cherche sur les donnes qu'il peut imaginer, joue pour son équipe, et ne triche jamais Summary

**Level 5 now runs a flat Monte-Carlo search over the deals it can imagine from its own view: it keeps its 6 best candidates plus every capture and home entry, uses 10 imagined deals and rolls out 4 plies for every seat, within 300 work units. It beats the Pur-sang 327 / 400 = 81.8 % (Wilson lower bound 77.7 %). A fast-check redeal property proves that no level reads the hidden hands, and a cheating stub fails that same property.**

## Performance

- **Duration:** about 29 min
- **Started:** 2026-10-15T11:18:33Z
- **Completed:** 2026-10-15T11:47Z
- **Tasks:** 3
- **Files modified:** 20 (9 created, 11 modified)

## Accomplishments

- `knowledge.ts` builds the unknown pool from the view only: FULL_DECK minus the hand, the discard, every posed hand, and the card passed to the partner while the partner still holds it. `hiddenCounts` gives the hidden sizes per seat and of the talon, and `partnerHolds` returns that passed card.
- `determinize(view, seat, rng)` draws a uniform imagined deal. It shuffles the pool with the engine's `shuffle`, deals each seat its public size, places the passed card in the partner's hand, and draws an exchange choice for each seat that has given. Every public field is copied, so `viewFor(world, seat)` deep-equals the view. The world's rng comes from the bot's rng.
- `createSearch(view, seat, rng, budget)` works in rounds. Each round draws one imagined deal; every kept candidate is applied, then rolled out up to 4 plies with each seat's best scored move from its own view, stopping at the end of the deal or the game. Scores are `evaluate` for the bot's team ± 10 000 for a game over. `result()` is the best mean, or the static best before the first deal. A deal starts only if its full cost fits, so `units ≤ budget` holds exactly and slicing never changes the move. Difficulty = min(1, log2 K / 4) × (1 − min(1, gap / 30)).
- `createThinker` sends level 5 in the play phase to the search. The exchange still takes the best give, and a single candidate is played at once (units 0, difficulty 0).
- `PlayerView.givenToPartner = state.given[seat] ?? state.received[PARTNER[seat]]`. It holds the seat's own choice during the exchange and the passed card after the cross, and is null before the seat chooses and at a new deal.
- `benchPositions()` returns 40 fixed decisions from 8 fixed-seed games between levels 2 to 4: 12 hard 7s (10 to 64 distinct boards) and 28 ordinary choices, each with 3 or more candidates. `tools/bench-bots.mjs` prints p50, p95, max and units per decision, and `--check` holds level 5 to the phone-derived ceiling.

## Task 1 probe (100 games, starting budget 360 units = 12 deals)

```
ladder: A=5 (Champion) vs B=4 (Pur-sang), 100 games (50 pairs), seed 1
games: 100 (100 finished, 0 failed)
A wins: 78 / 100, p̂ = 78.0 %
Wilson 95 %: [68.9 %, 85.0 %]
pairs: 2–0 30, 1–1 18, 0–2 2
A decisions: 13425, mean 40.40 ms, p95 159.84 ms, max 1313.9 ms, units 2869850
B decisions: 13028, mean 0.33 ms, p95 1.26 ms, max 28.5 ms, units 48441
wall time: 148.7 s (4 workers)
verdict: PASS (bar: p̂ ≥ 0 % and Wilson lower bound > 0 %)
```

## Bench (final values, this container, 3 repeats)

```
bench: 40 positions, repeat 3, level 5 budget 300 units
level 2 (Trotteur): 120 decisions, p50 0.3 ms, p95 13.4 ms, max 21.0 ms, units 14.5 per decision
level 3 (Galopeur): 120 decisions, p50 0.2 ms, p95 11.2 ms, max 20.5 ms, units 14.5 per decision
level 4 (Pur-sang): 120 decisions, p50 0.2 ms, p95 11.3 ms, max 11.8 ms, units 14.5 per decision
level 5 (Champion): 120 decisions, p50 50.5 ms, p95 225.2 ms, max 441.7 ms, units 293.6 per decision
  slowest: partie 5, action 56, vert, 40 candidats (7 : 34 issues)
check: OK (level 5 p95 ≤ 250 ms and max ≤ 600 ms on this machine)
```

Calibration (`--level 5 --check`):

| Deals | Units | Level-5 p95 (ms) | Level-5 max (ms) | Check |
|---|---|---|---|---|
| 12 | 360 | 258.8 | 691.3 | FAIL |
| 11 | 330 | 244.0 | 550.9 | OK, 6 ms short of the ceiling |
| 10 | 300 | 215.7–242.3 (5 runs) | 441.7–492.5 | OK, **kept** |
| 9 | 270 | 197.6 | 443.4 | OK |

A profile of the bench shows where the time goes: 86 % in the rollouts, and 57 % in `sevenOutcomes` called by the rollout policy when an imagined hand holds a 7.

## Ladder runs (committed values, 300 units, seed 1, 4 workers)

Probe (Task 3, 100 games): 85 / 100, p̂ 85.0 %, Wilson [76.7 %, 90.7 %], PASS. It is above 62 %, so no lever was used.

The phase's one 400-game confirmation run (`03-04-ladder-5-4.txt`):

```
ladder: A=5 (Champion) vs B=4 (Pur-sang), 400 games (200 pairs), seed 1
games: 400 (400 finished, 0 failed)
A wins: 327 / 400, p̂ = 81.8 %
Wilson 95 %: [77.7 %, 85.2 %]
pairs: 2–0 133, 1–1 61, 0–2 6
A decisions: 55635, mean 33.27 ms, p95 129.85 ms, max 2017.7 ms, units 9957597
B decisions: 53374, mean 0.30 ms, p95 1.16 ms, max 42.7 ms, units 195848
wall time: 486.9 s (4 workers)
verdict: PASS (bar: p̂ ≥ 60 % and Wilson lower bound > 55 %)
```

4 → 3, re-run unchanged: 265 / 400, p̂ 66.3 %, Wilson [61.5 %, 70.7 %], PASS. This is the same count as 03-02, because levels 2 to 4 were not touched.

## No-cheat property (Task 2)

- Each of levels 1 to 5 is checked on **100 fast-check samples** (seed 20261015 + level, k from 0 to 400 random legal actions, level 5 at 40 units). Each sample checks that the redealt state gives the same view and the same Thought. The redeal really changes the hidden cards in more than half of the samples, and the test asserts it.
- **Negative control:** the cheating stub, which picks a candidate or give from the ranks of the hidden hands, fails on the first sample. The counterexample shrinks (17 shrinks) to `[[0,0,0,0], 0, [0,0,0,0]]`: a new game in the exchange, where the redeal changes the give.
- The type errors are asserted with `// @ts-expect-error` on `chooseAction(state, …)` and `createThinker(state, …)`.

## Task Commits

1. **Task 1: Traceur — le Champion choisit son coup par une recherche sur des donnes imaginées depuis sa vue** - `9bff85f` (feat)
2. **Task 2: Ce qu'un humain sait à sa place — la carte passée, la preuve qu'il ne triche pas, le jeu d'équipe du Champion** - `a3b0026` (feat)
3. **Task 3: Le banc d'essai fixe, le budget du Champion, et la seule échelle 5 contre 4 de la phase** - `57467d4` (chore)

## Verification (end gate)

- `pnpm typecheck` OK (svelte-check 0 errors). `pnpm lint` OK (170 files).
- `pnpm test`: 46 files, **903 passed, 2 skipped**. The baseline was 875 passed, 2 skipped. The 28 new tests are 12 in search.test.ts, 7 in noCheat.test.ts, 4 in teamplay.test.ts, 3 in deal.test.ts and 2 in bench.test.ts.
- `node tools/rules-trace.mjs`: OK (16 règles, 122 scénarios). `node tools/selfplay.mjs --games 200`: 200 finished, 0 failed.
- `node tools/bench-bots.mjs --level 5 --check`: exit 0. The 5 → 4 record says `verdict: PASS`. The 4 → 3 run exits 0.
- The code of levels.ts, evaluate.ts, search.ts and determinize.ts has not changed since the recorded 400-game run, apart from comments.
- Playwright: the plan names no spec, so none was run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `--min 0 --lower 0` was refused by tools/ladder.mjs**
- **Found during:** Task 1 (the probe command of the plan)
- **Issue:** `fraction()` accepted only values strictly between 0 and 1, so the plan's probe command would have exited 2.
- **Fix:** 0 is now accepted as a bar, for a probe that reports without judging. A failed game still fails the run.
- **Files modified:** tools/ladder.mjs
- **Commit:** 9bff85f

**2. [Rule 3 - Blocking] The purity guard forbids the name GameState in the bots' deciding files**
- **Found during:** Task 1
- **Issue:** determinize must return a state for `apply` to play in, but `purity.test.ts` rejects the token `GameState` in every non-test file.
- **Fix:** determinize.ts is now allowed to name it, through a one-file allow-list in the guard. It exports `type World = GameState`, documented as built from the view alone. The module-memory and clock rules still apply to it.
- **Files modified:** packages/bots/test/purity.test.ts, packages/bots/src/determinize.ts
- **Commit:** 9bff85f

**3. [Rule 1 - Test contract] Existing tests that the new field or the search legitimately change**
- `thinker.test.ts`: the single-candidate case now expects `units: 0` for level 5, as the plan says. The mixed-level whole games give level 5 a 60-unit budget, because they check legality, not strength (31 s otherwise).
- `deal.test.ts` « never contains a card id of another seat's hand » and the render property « a view never carries another seat's cards » now treat the seat's own passed card (`givenToPartner`) as a card it may know.
- **Commits:** 9bff85f, a3b0026

### Other notes

- I added `bench.test.ts` (Rule 2), which checks benchPositions' contract (at least 30 decisions, at least 8 hard 7s, 3 or more candidates each, deterministic). It was not in the plan's file list.
- Task 2's engine field and its tests were written before the RED run. The determinize test against Task 1's code was the failing (RED) case. The commits stay per task: Task 1's tree was verified without the engine change (56 bot tests and the typecheck green) before it was committed.
- I did not edit STATE.md, ROADMAP.md, REQUIREMENTS.md or WINDOWS.md (the orchestrator owns tracking).

## Known Stubs

None. The 03-02 stub (« level 5 is still the greedy T = 0 pick, Budget unused ») is resolved.

## Threat Flags

None new. T-03-09 is mitigated: worlds come from the view only, with the noCheat property, its negative control and the type errors. T-03-10 is mitigated: `givenToPartner` holds the seat's own give only, as deal.test.ts asserts. T-03-11 is mitigated: units ≤ budget is asserted, the result is anytime, and the bench check passes. T-03-SC: no package was added.

**Note for 03-05 / 03-06 (BOT-05):** the bench meets its ceiling, but full games have rare slow outliers that the bench does not cover. Across 55 635 level-5 decisions in the 400-game run, the slowest took 2.0 s, and the slowest in the Task 3 probe took 1.4 s, with 4 workers sharing 4 cores. A single-threaded scan of 12 games (767 decisions) peaked at 423 ms, with p99 at 216 ms. The slow decisions are the ones where imagined opponents hold 7s during the rollouts. The browser runner's hard deadline and the anytime `result()` planned in 03-05 bound them on a phone. The level-5 bench p95 sits 8–34 ms under its 250 ms ceiling, depending on the run.

## Self-Check: PASSED

- Created files exist: knowledge.ts, determinize.ts, search.ts, search.test.ts, noCheat.test.ts, bench.ts, bench.test.ts, tools/bench-bots.mjs, 03-04-ladder-5-4.txt.
- Commits 9bff85f, a3b0026 and 57467d4 are ancestors of HEAD.
