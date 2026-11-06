---
phase: 04-comptes-amis-et-application-installable
plan: 15
subsystem: bots
tags: [gap, bots, exchange, d-09, pur-sang, champion, determinization, tdd, ladder]
status: complete

requires:
  - phase: 03
    provides: "the board give of D-09 (exchange.ts giveScores), the level noise (thinker.ts pickIndex), knowledge.ts unknownCards, the ladder and the bench"
  - phase: 02
    provides: "the online table's computers: every exchange decides in one alarm tick (SLICE_UNITS only slices the Champion's play search)"
provides:
  - "dealGiveScores: a hand-level value of each give, the bot's and the partner's hands after the exchange played out alone over the deal, the partner's hand imagined from the unseen cards in exact-weight strata (exit cards held, exit card passed back)"
  - "dealGives: the deal decides whether an As or a Roi goes or stays, the board give picks the card within that family; levels 4 and 5 give through it (levels.ts GIVE_METHOD), levels 2 and 3 keep the board give"
  - "chooseGive and playGame's gives option; ladder --give-a / --give-b and per-side give times; bench-bots --exchange on benchExchanges"
  - "engine resolveCandidate (resolveMove's second half)"
  - "04-UAT.md test 63; 04-15-ladder.txt; deferred-items.md (a pre-existing sheet focus race)"
affects: [phase-04-verification, bots, online-table-cpu]

estimate:
  tokens: 40000
  tasks: 4
actuals:
  tokens: 16000
  tasks: 4
  commits: 10
plan_head_before: 83a3df83d0c7b42c86e029398178b012b282fa2d
plan_head_after: 9d11b2d7bcfde3882179e1d5b8c34cd570af6879

tech-stack:
  added: []
  patterns:
    - "Stratified determinization: the hidden quantity that decides the choice (exit cards in the partner's hand, the card passed back) is enumerated with exact hypergeometric weights; random draws only average out the rest, dealt from one shuffled pile per stratum in consecutive runs"
    - "A greedy one-player play-out over a shared board cache: each board evaluated once, its children per (mover, rank) computed once, and the end of every play-out remembered per (board, mover, ranks left)"
    - "A hand-level model answers only the strategic question it is good at (does an exit card go?); the established one-move score keeps ordering the cards"

key-files:
  created:
    - packages/bots/src/exchange.test.ts
    - .planning/phases/04-comptes-amis-et-application-installable/04-15-PLAN.md
    - .planning/phases/04-comptes-amis-et-application-installable/04-15-ladder.txt
    - .planning/phases/04-comptes-amis-et-application-installable/deferred-items.md
  modified:
    - packages/bots/src/exchange.ts
    - packages/bots/src/thinker.ts
    - packages/bots/src/levels.ts
    - packages/bots/src/match.ts
    - packages/bots/src/bench.ts
    - packages/bots/src/index.ts
    - packages/bots/src/search.test.ts
    - packages/engine/src/apply.ts
    - tools/ladder.mjs
    - tools/bench-bots.mjs
    - .planning/phases/04-comptes-amis-et-application-installable/04-UAT.md

key-decisions:
  - "Refinement of phase 3 D-09 for Pur-sang and Champion only (Romain, 2026-11-06: « en mode intelligent, le partenaire ordinateur ne donne pas forcément systématiquement un as ou un roi s'il n'en a qu'un et qu'il faut qu'il sorte ses pions... Il doit pouvoir moduler ça en fonction de la stratégie. »). Trotteur and Galopeur keep the board give, so they still make more mistakes (phase 3 D-05)"
  - "The give is split: the deal model (dealGiveScores) decides only whether an exit card goes, by comparing the best exit card's deal score with the best other card's; the board give orders the cards of that family. Scoring every card by its deal score was measured weaker for the Champion (484 / 1000, 48.4 %) because the play-outs walk the 7 with one knight and ignore the opponents"
  - "The partner's hand is imagined in strata, not by plain sampling: 0, 1 or 2+ exit cards (hypergeometric) times « passes an exit card back » (k / size), 16 hands shared out by weight. Plain sampling with 6 hands picked the wrong card in about half the seeds of Romain's case"
  - "The card passed back by the partner is any card of its imagined hand: the bot knows nothing of the partner's choice (D-10), whether the partner is a person or a computer"
  - "In a play-out the 7 moves one knight 7 steps with the engine's walk (one micro-move of seven.ts); the splits and G16's duty stay the play decision's. applyPlan or sevenOutcomes on every board met cost up to 150 ms for one give"
  - "The play decisions are untouched: evaluate.ts, candidates.ts and search.ts are not modified, so home-first (rentrer ses chevaux) is exactly as before"
  - "The bench's own games keep the board give, so benchPositions are the positions calibrated in phase 3 (same slowest position, about 293 units at level 5)"

requirements-completed: []

coverage:
  - id: D1
    description: "A lone As or Roi with the bot's four knights in the stable and 2 to 6 other cards is kept when the partner has knights out (levels 4 and 5, 4 seeds each); at the start of the game it is kept in at least 36 of 40 seeds at each level"
    requirement: BOT-03
    verification:
      - kind: unit
        ref: packages/bots/src/exchange.test.ts
  - id: D2
    description: "Two exit cards, everyone in the stable: one exit card goes; own knights out, the partner's four in the stable: the As or the Roi goes"
    requirement: BOT-03
    verification:
      - kind: unit
        ref: packages/bots/src/exchange.test.ts
  - id: D3
    description: "The partner's real hand, redealt among the hidden cards (exit cards included), never changes dealGiveScores or the give at levels 2 to 5; the view is never modified; noCheat.test.ts still passes for every level"
    requirement: BOT-04
    verification:
      - kind: unit
        ref: packages/bots/src/exchange.test.ts
      - kind: property
        ref: packages/bots/src/noCheat.test.ts
  - id: D4
    description: "New give against old at the same level, paired seeds: Pur-sang 2091 / 4000 and 2095 / 4000 (seeds 1, 2), Champion 531 / 1000; the BOT-02 ladder steps all pass"
    requirement: BOT-02
    verification:
      - kind: benchmark
        ref: .planning/phases/04-comptes-amis-et-application-installable/04-15-ladder.txt
  - id: D5
    description: "Cost of one give, decided in one go: bench exchanges and real-game exchanges measured single-threaded against the level-4 play decision and the old give"
    requirement: BOT-05
    verification:
      - kind: benchmark
        ref: "node tools/bench-bots.mjs --exchange"
---

# Phase 4 Plan 15: Une carte d’échange plus fine pour les ordinateurs forts Summary

**Pur-sang and Champion now decide over the whole deal whether to give an As or a Roi: their own hand and the partner's imagined hand are played out with and without it, with exact weights for « does the partner already hold one? ». The board give of D-09 then picks the card. Measured stronger than the old give at both levels.**

## Romain's feedback, and what it refines

Romain, 2026-11-06: « en mode intelligent, le partenaire ordinateur ne donne pas forcément systématiquement un as ou un roi s'il n'en a qu'un et qu'il faut qu'il sorte ses pions... Il doit pouvoir moduler ça en fonction de la stratégie. En revanche, c'est bien quand la priorité est donnée à l'arrivée des pions pour ne pas prendre le risque de se faire échanger ou manger... »

This is a **refinement of phase 3 D-09** (« Ce qui aide le partenaire »). The old give scored each card as `partnerGain − 0.6 × ownLoss`, each the best gain of one move on the current board. At the start of a game it gave the lone As every time: 8 points for the As, 0 for every other card, because no other card can move a knight that is still in the stable. Giving it away left the bot's other cards unplayable for the whole deal.

The second half of his message, home-first, needed no change. `evaluate.ts`, `candidates.ts` and `search.ts` were not touched, so every play decision is the same as before.

## Performance

- **Started:** 2026-11-06T15:12:21Z
- **Completed:** 2026-11-06T19:30:00Z
- **Tasks:** 4
- **Commits:** 10 (plus this summary)

## How the new give works

1. **Imagined partner hands** (`dealGiveScores`). These come from the cards the bot cannot see (`unknownCards`, D-10), drawn with its own rng. They are drawn in strata: the partner holds 0, 1, or 2 or more exit cards (hypergeometric weight), and it passes back an exit card or not (weight k / size). Sixteen hands are shared out by weight. The other cards are dealt from one shuffled pile per stratum, in consecutive runs, so a 4 (which turns an As into a home entry) is neither missed nor doubled by luck.
2. **Play-outs.** For each card c and each imagined hand, two hands are played out alone on the current board, greedily, one card per turn: the bot's hand after the exchange (its cards less c, plus the card passed back) and the partner's (its cards less the one it passes, plus c). Each turn takes the best `evaluate + handBonus`. A hand with no legal move is laid down (R-14). The 7 walks one knight. The score of c is the weighted mean team gain.
3. **The decision** (`dealGives`). Does the best exit card score higher over the deal than the best other card? That decides the family. The board give then orders the cards of that family, as before. A hand without an As or a Roi, or with nothing else, has no such question: it costs what it cost before.
4. **Which levels.** 4 and 5 (`GIVE_METHOD`). Levels 2 and 3 keep the board give, and level 1 stays `randomLegal`.

## Measured strength (tools/ladder.mjs, paired seeds, teams swapped)

| Run | Games | New give wins | p̂ | Wilson 95 % | Pairs 2–0 / 1–1 / 0–2 |
|-----|-------|---------------|----|-------------|------------------------|
| Pur-sang, new vs old, seed 1 | 4000 | 2091 | 52.3 % | [50.7 %, 53.8 %] | 512 / 1067 / 421 |
| Pur-sang, new vs old, seed 2 | 4000 | 2095 | 52.4 % | [50.8 %, 53.9 %] | 477 / 1141 / 382 |
| Pur-sang, both seeds | 8000 | 4186 | 52.3 % | [51.2 %, 53.4 %] | sign test on decisive pairs z = 4.39 |
| Champion, new vs old, seed 1 | 1000 | 531 | 53.1 % | [50.0 %, 56.2 %] | 128 / 275 / 97 (z = 2.07, p ≈ 0.04) |

Versions measured on the way (seed 1, same seeds):

| Version | Pur-sang | Champion |
|---------|----------|----------|
| Every card by its deal score (first GREEN) | 2091 / 4000, 52.3 % | 484 / 1000, 48.4 %, [45.3 %, 51.5 %] |
| The deal decides the family, the board picks (applyPlan 7) | 2099 / 4000, 52.5 % | 527 / 1000, 52.7 %, [49.6 %, 55.8 %] |
| Same, the 7 walked (final) | see above | see above |

The Champion's interval touches 50 %. The pair-level sign test and the consistent Pur-sang gain point the same way, but with 1000 games the Champion's own gain alone is only borderline significant.

**BOT-02, the ladder** (final code, seed 1, 400 games, bar p̂ ≥ 60 % and Wilson lower bound > 55 %):

| Step | Wins | p̂ | Wilson 95 % | Verdict |
|------|------|----|-------------|---------|
| 5 → 4 | 300 / 400 | 75.0 % | [70.5 %, 79.0 %] | PASS |
| 4 → 3 | 269 / 400 | 67.3 % | [62.5 %, 71.7 %] | PASS |
| 3 → 2 | 393 / 400 | 98.3 % | [96.4 %, 99.1 %] | PASS |
| 2 → 1 | 371 / 400 | 92.8 % | [89.8 %, 94.9 %] | PASS |

5 → 4 with both levels on the old give, same seeds: 333 / 400, 83.3 %, [79.3 %, 86.6 %]. The new give helps Pur-sang as well, so the top step narrows by about 8 points. It still passes clearly. All outputs are in `04-15-ladder.txt`.

## CPU per decision (this machine, one thread, warmed up)

| What | p50 | p95 | p99 | max |
|------|-----|-----|-----|-----|
| New give, 40 bench exchanges (`bench-bots --exchange --level 5`) | 1.9 ms | 7.0 ms | | 21.9 ms |
| Old give, same bench (level 3) | 0.2 ms | 2.8 ms | | 25.5 ms |
| New give, 772 exchanges of level-4 games | 2.3 ms | 10.5 ms | | 40.2 ms |
| Old give, same positions | 0.2 ms | 3.2 ms | | 36.6 ms |
| New give, 2543 gives met in play | 2.1 ms | 10.3 ms | 17.3 ms | 49.0 ms |
| Level-4 play decision, play bench (for scale) | 0.1 ms | 10.8 ms | | 14.6 ms |

In the ladder runs (four workers on four cores, so times run high) the new give averaged 3.0 to 3.5 ms, p95 9.9 to 11.9 ms. The old give averaged 0.6 to 0.7 ms.

The give still decides in one go, so one alarm tick online. Its p95 is about that of a level-4 play decision, which also decides in one tick. Its worst case is close to the old give's worst case, which is set by that give's own enumeration of a hard 7. The rare tail (p99 17 ms, max 49 ms) sits inside the envelope the online table already has: the Champion's first slice costs 15 to 35 ms, and a retried alarm falls back to level 1. The Champion's play search budget (CHAMPION_BUDGET, SLICE_UNITS) is unchanged.

## Gate (one after another, after the last code commit)

| Gate | Result |
|------|--------|
| `pnpm typecheck && pnpm lint && pnpm test` | 0 errors; Biome 377 files clean; Vitest 117 files, **1 890 passed, 2 skipped** (1 866 at 04-14 + 24 new) |
| Full local Playwright | **459 passed, 99 skipped, 0 failed** (7.1 min), as at 04-14 |
| Online Playwright | **108 passed, 0 failed** (10.5 min), on the third full run; the first two failed one test each (see Deviations 4) |
| PWA Playwright | **10 passed** (34.8 s) |
| `node tools/selfplay.mjs --games 200` | 200 finished, 0 failed, mean 777.5 actions, median 752, max 1 482 (9.9 s) |
| Ports 8787, 4173, 4174 | nothing listening afterwards; no wrangler, workerd, vite or ladder process left |

## TDD Gate Compliance

- RED `e670f4c`: 17 of 21 new tests failing (the lone As or Roi, at the start and with the partner out; the no-cheat and determinism checks on the missing `dealGiveScores`; the level routing on the missing `chooseGive`). It came before GREEN `6b40d8d`.
- The `dealGives` tests (family checks, hands without an exit card) were added in `a6a4a82` together with the refinement that the ladder called for. They lock the final design.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plain sampling of the partner's hand was too noisy**
- **Found during:** Task 2
- **Issue:** with 6 sampled hands, the right card in Romain's case came out in about half the seeds. With 200 hands the model was right in every case. The noise came from two binary facts: whether the partner holds an exit card, and whether it passes one back.
- **Fix:** exact-weight strata on those two facts, 16 hands shared out by weight, the other cards dealt in consecutive runs. The lone exit card at the start of the game is kept in 193 of 200 seeds; every wider case in 50 of 50.
- **Commit:** 6b40d8d

**2. [Rule 1 - Bug] Every card by its deal score was weaker for the Champion**
- **Found during:** Task 3 (1000 games: 48.4 %)
- **Issue:** the two gives agreed on only 38 % of real positions. The deal score often gave away a 7 or a 4: its play-outs walk the 7 with one knight and ignore the opponents, so among ordinary cards it is a noisier guide than the board.
- **Fix:** `dealGives` keeps the deal's answer to one question only (does an exit card go?) and lets the board give order the family. Pur-sang went from 52.3 % to 52.5 % and the Champion from 48.4 % to 52.7 % (final code 53.1 %).
- **Commit:** a6a4a82

**3. [Rule 3 - Blocking] The give was too slow for one alarm tick**
- **Found during:** Tasks 2 and 3
- **Issue:** the first version cost p95 47 ms and max 75 ms on the bench, and one real position took 150 ms. The cost came from `sevenOutcomes`, then `applyPlan`'s G16 search on every board met, and from `resolveMove` looking each candidate up again.
- **Fix:** a board cache with per-node children; the end of each play-out remembered per (board, mover, ranks left); the 7 of a play-out walked with the engine's `walk`; and in the engine, `resolveCandidate`, the second half of `resolveMove`, so resolving a candidate does not run `movesForCard` again (one source for the movement, no behaviour change).
- **Files modified:** packages/bots/src/exchange.ts, packages/engine/src/apply.ts (not in the plan's file list)
- **Commits:** 6b40d8d, f42ba52, c253d54

**4. [Out of scope, deferred] A closing sheet can take the focus from the next one**
- The online test `amis.spec.ts:197` (phone) failed in the first two full runs and passed in the third. It passes alone (10 of 10). Run side by side with `amis-table.spec.ts`, it also fails with the old give (2 failures in 12 runs).
- The cause, in `apps/web/src/ui/Sheet.svelte`: `onDestroy` gives focus back to the opener unconditionally after the slide-out, so a confirmation opened meanwhile loses its focused safe answer. This is web code outside this plan, so it was not fixed. The analysis and a proposed fix are in `deferred-items.md`. It was not added to `.planning/WINDOWS.md`.

**5. Test placement and wording**
- The start-of-game case is checked as a frequency (kept in at least 36 of 40 seeds per level) rather than on 4 seeds. Its true margin is about 12 points with a spread of about 6. This matches « pas systématiquement ».
- `search.test.ts` « takes the best exchange card » now compares the Champion with `dealGives`.

**6. Measurement tooling not in the plan's detail**
- `TeamStats.giveMs` and the ladder's « A gives / B gives » lines, so the exchange time is reported apart from the play decisions.

## For Romain

- **UAT test 63** (pending): in a solo game with a Pur-sang or Champion partner, it keeps its only As or Roi when it needs it to bring its knights out, and still gives one when you have nothing out and it has knights out.
- At the start of the game, when the two choices are close, it may still give its As now and then (about 1 deal in 30 in the test position). That is the « moduler » he asked for, not a rule.
- Trotteur and Galopeur still give the old way (more mistakes, D-05).
- The Champion's lead over Pur-sang shrank (83 % to 75 %), because Pur-sang benefits from the new give too. It is still clearly ahead.

## Known Stubs

None.

## Threat Flags

None. The give reads only the view (T-04-83, tested). Its cost is bounded and measured (T-04-84). No new endpoint, storage or protocol change: PROTOCOL_VERSION is unchanged, since the give only changes which card a computer chooses.

## Next

Deploy (not done here), then Romain plays UAT 63. The sheet focus race (deferred-items.md) can be a quick fix later.

## Self-Check: PASSED

- Files: exchange.test.ts, exchange.ts, 04-15-PLAN.md, 04-15-ladder.txt, deferred-items.md present.
- Commits d1e1416, e670f4c, 6b40d8d, f42ba52, 04293fb, 4d1b3c5, a6a4a82, c253d54, e00cbd0, 9d11b2d are ancestors of HEAD (10 = `git rev-list --count 83a3df8..HEAD`).
- evaluate.ts, candidates.ts, search.ts, STATE.md, ROADMAP.md, CLAUDE.md and the config are unchanged since 83a3df8.
