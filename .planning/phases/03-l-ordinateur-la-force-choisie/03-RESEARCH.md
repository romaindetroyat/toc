# Phase 3: L'ordinateur à la force choisie - Research

**Researched:** 2026-10-15
**Domain:** Game AI for a 4-player, 2-team, imperfect-information card-driven race game (TOC) in pure TypeScript; pacing and UI of computer seats in a Svelte 5 SPA; reuse later inside a Cloudflare Durable Object
**Confidence:** MEDIUM-HIGH. The codebase facts were read this session. The strength numbers come from a throw-away prototype run this session against the real engine, so their direction is measured, not assumed. The exact level parameters still have to be calibrated by the ladder tool. Phone CPU factors are assumed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Choosing the strength (Romain's choices, 2026-10-15)
- **D-01:** One strength setting per computer seat on the launch screen, under each name: the partner and each of the two opponents. Romain: « Une par place (Recommandé) ».
- **D-02:** The levels are shown as horse names, not numbers. Romain: « Noms de chevaux ». The suggestion he picked was Poulain (1), Trotteur (2), Galopeur (3), Pur-sang (4), Champion (5). The numbers 1–5 stay the internal values (BOT-01). The exact wording and whether a number shows next to the name are « à confirmer par Romain ».
- **D-03:** The default is level 3 (Galopeur) the first time, then the device remembers the last choice per seat. Romain: « 3, et on se souvient (Recommandé) ». Store it in the existing settings store (`apps/web/src/settings/store.svelte.ts`, localStorage with try/catch and validation, like `lastColor`).

#### Character of the levels
- **D-04:** Level 5 (Champion) must be as strong as possible: Romain: « Le plus fort possible » (he did not pick the « fort mais humain » option). It still never cheats (D-10) and still answers within the time cap (D-13). The search budget is the planner's call. It is CPU-time-boxed so a phone never freezes; the CLAUDE.md stack notes suggest time-boxed Monte-Carlo or expectimax over the sampled hidden hands.
- **D-05:** Levels 2 to 4 progress by making fewer and fewer mistakes. Romain: « Erreurs de moins en moins (Recommandé) ». All of them know how to play well, but low levels often go wrong (a poor card, a missed capture) and the Champion almost never does. Level 1 stays today's `randomLegal` (BOT-02).
- **D-06:** No personalities or styles: only the strength differs. Romain: « Non, juste la force (Recommandé) ».
- **D-07:** Each level must win clearly more often than the one below over many simulated games (BOT-02, success criterion 2). This is proven by a tool like `tools/selfplay.mjs`, with team-vs-team matches between levels.

#### Team play
- **D-08:** Romain ticked all four as essential: « Rentrer ses chevaux, Manger les adversaires, Se protéger, Aider le partenaire ». The strong levels weigh all four, and none dominates by default. The evaluation and weights are the planner's call and are tuned by simulation.
- **D-09:** The exchange card: the Champion gives what helps the partner most, given the partner's knights. Examples: an As or Roi when the partner has knights to bring out, a 4 to back toward its home. Romain: « Ce qui aide le partenaire (Recommandé) ». It reasons only on visible information (D-10).
- **D-10:** No cheating (BOT-04, success criterion 4). The bot sees only its own hand, the cards played, the board and the public counts. That includes the partner's hand: when Romain is the partner, the bot does not know his cards. Romain: « Oui, pareil (Recommandé) », meaning the bot treats a human partner like a computer partner. The bot API should take the seat view (`viewFor(state, bot)`), never the full state. A test changes the other hands and checks the move does not change.

#### Pace
- **D-11:** The thinking time depends on the move. With a single legal move or nearly, it is under half a second. A delicate choice takes up to about 2 seconds. Romain: « Selon le coup (Recommandé) ». The cap of a few seconds holds at every level (BOT-05).
- **D-12:** A discreet sign shows that a computer player is thinking: its name or pill « breathes » gently. Romain: « Oui, discrètement (Recommandé) ». It honours prefers-reduced-motion, with no animation, only a static marker.
- **D-13:** The existing « Avance rapide » setting also shortens the thinking: in fast mode the computer plays almost at once. Romain: « Oui (Recommandé) ». Today `thinkDelay(speed, u)` in `apps/web/src/game/GameController.ts` gives 700–1300 ms normal and 200–300 ms fast. It becomes a function of the move's difficulty and the speed setting. The search's own compute time counts inside the delay, not added to it.

### Claude's Discretion
- The search algorithm and its budget per level, the evaluation function and weights, how mistakes are injected at levels 2–4 (e.g. a softmax temperature or the probability of picking a worse move), and how the hidden hands are sampled for the Champion.
- Where the bot runs on the client (main thread with a time box, or a Web Worker if profiling demands it).
- How the strength picker looks on the launch screen (wood style, galet theme), within D-01 to D-03.

### Deferred Ideas (OUT OF SCOPE)
- Bot personalities and styles: Romain said no for now (D-06).
- Hints or a tutorial using the bot's evaluation for the human: phase 5 (learning).
- The online table's strength picker: phase 2 reuses D-01 to D-03.
- The sound work deferred from phase 1 (neighs, card sounds, end sounds): tracked in `.planning/phases/01-une-vraie-partie-sur-un-appareil/deferred-items.md`, not part of this phase.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (REQUIREMENTS.md, verbatim) | Research Support |
|----|-------------|------------------|
| BOT-01 | Chaque place gérée par l'ordinateur a une force réglable de 1 à 5. | `BotLevel = 1..5` exported by `@toc/bots`; per-role persistence in `settings.ts` (Pattern 9); `createGame({ levels })` picks the level per seat (Pattern 8). |
| BOT-02 | Le niveau 1 joue un coup légal au hasard ; chaque niveau supérieur gagne nettement plus souvent que le précédent dans des parties simulées. | Level 1 = `randomLegal` unchanged; levels 2–4 = one evaluation with decreasing noise (Pattern 4); `tools/ladder.mjs` with paired seeds and a stated statistical bar (Pattern 10). Prototype ladder measured this session (see « Prototype measurements »). |
| BOT-03 | Le niveau 5 joue pour son équipe (protéger, aider le partenaire, choisir la carte d'échange). | Team evaluation (Pattern 3: own + partner knights, risk term with card counting); determinized Monte-Carlo with team rollouts (Pattern 5); exchange choice by partner gain (Pattern 7); scenario tests for each behaviour. |
| BOT-04 | L'ordinateur ne joue qu'avec les informations qu'un humain aurait à sa place (pas de triche sur les mains cachées). | API takes `PlayerView` only (type discriminant already in the engine); determinization from the view only (Pattern 6, with one engine addition: the card given to the partner); fast-check « swap the hidden hands » property + a negative control + purity guard on `packages/bots/src`. |
| BOT-05 | L'ordinateur marque un temps de réflexion naturel avant de jouer et ne dépasse jamais quelques secondes. | Pure `paceFor(difficulty, speed, u)` replacing `thinkDelay`; search time counted inside; iteration budgets + host deadline; time-sliced inline runner (Pattern 8). |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Cloudflare is the host; phase 2 runs the authoritative game in a Durable Object. The bots run inside the DO later, CPU-budgeted, so `packages/bots` must not touch the DOM or timers (CLAUDE.md « Bots run inside the DO by calling the same engine, with level-dependent search depth; strong levels (4-5) should be CPU-budgeted (e.g. time-boxed Monte-Carlo / expectimax, a few ms) »).
- No `setTimeout`/`setInterval` in the DO; use `ctx.storage.setAlarm()` (relevant to how the think delay is hosted in phase 2, not to the bot code itself).
- Never trust the client for rules or hands; send only per-seat projections. The bot is a client of the projection too.
- fast-check is the property-test tool for the rules engine (« random games must preserve invariants »).
- Vitest is pinned to `^4.1` (not 5.x). TypeScript is 6.0.3 in this repo (root `package.json`), Node `>=22.12`, pnpm 10.34.7.
- Interface in French. Prefer a single typed messages module (`apps/web/src/i18n/fr/*.ts`), no i18n library.
- Animations: honour `prefers-reduced-motion` and the « Réduire les animations » setting; animate `transform`/`opacity`, never per-frame filters.
- GSD workflow enforcement: edits happen through GSD commands (planning/execution), not ad hoc.

## Summary

The engine already gives the bots almost everything they need: a per-seat `PlayerView` that is a type error to confuse with the full `GameState`, deterministic legal-move generation (`legalActions`, `movesForCard`), the 7 planner (`sevenPlans`, `applyPlan`, `previewPlan`), a seeded sfc32 RNG, and a level-1 bot (`randomLegal`) that is pure and seeded. The phase is mostly a new `packages/bots` layer on top of it, a pacing change in `GameController.ts`, a picker on `Launch.svelte`, and a breathing marker in the info bar.

A throw-away prototype (scratch files only, not in the repo) was run this session against the real engine. A 1-ply bot with a plain heuristic evaluation (knights home, distance to the carré 16, knights out, a threat penalty) beat `randomLegal` 100/100. The same evaluation with softmax noise gives a clean, monotone ladder: ε-mix (50 % random, else softmax T=20) beat random 94 %, softmax T=8 beat that 97 %, T=3 beat T=8 61.5 %, greedy (T=0) beat T=3 58 %. A determinized Monte-Carlo search (sample the hidden hands from the view, simulate one round with greedy players, score with the same evaluation) beat greedy 76 % (200 games, ± 5.9 %, 8 worlds × 4 plies). So « erreurs de moins en moins » is literally a temperature on one shared evaluation, and the Champion is that evaluation plus a search over sampled hands.

Two measured facts shape the design. First, the 7 explodes: up to 15 231 plans for one 7, but at most 129 distinct end positions (mean 4.7). A DFS over distinct boards found exactly the same outcomes as full enumeration on 1 664 boards (0 mismatches) and cut the worst case from 431 ms to 36 ms. The engine should gain a `sevenOutcomes` helper. Second, deployed Workers freeze `performance.now()` during CPU work, so a time-boxed loop cannot run in the Durable Object. The bot must use **iteration budgets** (also needed for reproducible tests), with the host adding a wall-clock deadline in the browser only.

**Primary recommendation:** Build one pure, anytime bot in `packages/bots`: `createThinker(view, seat, level, rng, budget)` with `step(n)`/`result()`, plus `chooseAction(...)` running it to completion. Use one hand-tuned team evaluation for levels 2–5. Levels 2–4 add softmax/ε noise. Level 5 runs flat Monte-Carlo over determinized hands with short greedy rollouts. Prove the ladder with a `tools/ladder.mjs` (paired seeds, 400 games per step, p̂ ≥ 60 % and Wilson lower bound > 55 %). Prove no-cheat with a fast-check hidden-hand swap property. Host the search on the main thread in time slices, with a Web Worker only if the phone profile demands it.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Choosing a move at a level (eval, noise, search) | Shared pure package `packages/bots` (runs in browser now, DO in phase 2) | — | Must be identical in browser and workerd; no DOM, no timers, no clock (phase-2 reuse, CONTEXT « pure, deterministic functions of (seat view, rng) »). |
| What a seat may know (the information set) | `packages/engine` (`viewFor`) | `packages/bots` (determinization) | The view is the hidden-hand boundary. The bot only samples worlds consistent with it. |
| 7 outcome enumeration | `packages/engine` (`seven.ts`) | — | Needs the private `microMove`/`completable` machinery; the bot must not re-implement 7 rules. |
| Think pacing (delay by difficulty and speed, search time counted inside) | Browser game shell `GameController.ts` (later: the DO with alarms) | `packages/bots` returns a `difficulty` number | Timers belong to the host. The bot only says how hard the decision was. |
| Running the search without freezing the UI | Browser runner (inline time-sliced; Web Worker optional) | — | Host concern; the bot exposes `step(n)` so any host can slice it. |
| Per-seat level choice and its persistence | Browser (`Launch.svelte`, `settings.ts`) | phase 2: table settings in DO/D1 | Local launch screen today; the online table reuses the same `BotLevel` type and validation. |
| « Thinking » sign | Browser UI (`InfoBar`, pill, `SeatChip`) | — | Pure presentation of `session.thinking`. |
| Ladder proof (level n beats n−1) | Node tool `tools/ladder.mjs` (worker_threads) | Vitest smoke | Long CPU job; deterministic seeds. |

## Standard Stack

No new npm dependency is needed. Everything is built on what is installed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@toc/engine` (workspace) | 0.0.0 | Rules, `viewFor`, legal moves, 7 planner, sfc32 RNG | The single source of truth for the rules; bots must drive everything through it (CONTEXT code_context). [VERIFIED: packages/engine/src/index.ts] |
| `@toc/bots` (workspace) | 0.0.0 | Bot levels 1–5 | Existing package, already depends on `@toc/engine` (`"@toc/engine": "workspace:*"`). [VERIFIED: packages/bots/package.json] |
| TypeScript | 6.0.3 | Language | Repo pin in root `package.json` (`"typescript": "6.0.3"`). [VERIFIED: /home/user/toc/package.json] |
| Svelte | 5.57.2 | Picker and thinking marker | Repo pin in `apps/web/package.json`. [VERIFIED: apps/web/package.json] |
| Vite | 8.3.4 | Build; Web Worker bundling if ever needed | Repo pin. [VERIFIED: apps/web/package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | ^4.1.11 | Unit, property and smoke tests | All bot tests (`packages/**/*.test.ts` is already in the root `include`). [VERIFIED: vitest.config.ts] |
| fast-check | 4.10.2 | No-cheat property, determinism, legality across random games | Installed at the root (`node_modules/fast-check/package.json` reads 4.10.2). [VERIFIED: node -e require(...).version] |
| `node:worker_threads` (Node 22 built-in) | Node 22.22.0 here | Parallel ladder games in `tools/ladder.mjs` | Tools may import `node:` modules (only `packages/engine/src` has the purity guard). [VERIFIED: node --version] |
| Web Worker (browser built-in) + Vite worker import | Vite 8.3.4 | Optional off-main-thread search | Only if the phone profile shows jank. Vite recommends `new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })`; `worker.format` defaults to `'iife'`. [CITED: github.com/vitejs/vite docs/guide/features.md « Web Workers »; docs/config/worker-options.md] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Flat Monte-Carlo over determinizations (PIMC) | Full ISMCTS (Cowling, Powley, Whitehouse 2012) | ISMCTS fixes PIMC's strategy fusion and is reported stronger in card games, but it needs an information-set tree and a much bigger implementation. Here the branching is small (p50 3, p90 10 candidates) and the horizon is short, so PIMC on a good evaluation is the better cost/benefit for v1. Revisit only if level 5 does not beat level 4 clearly. [CITED: Whitehouse PhD thesis, etheses.whiterose.ac.uk/8117; survey arxiv.org/pdf/1906.04439] |
| Softmax temperature for levels 2–4 | Fixed « blunder probability » (pick a random worse move with p) | ε alone makes level 2 look random half the time. Softmax keeps mistakes plausible (near-misses, not absurd moves). Use ε only for level 2, combined with softmax (measured: 94 % vs level 1). |
| Inline time-sliced search | Web Worker | A worker is truly parallel but adds a build entry, message plumbing and a Node-test gap. Start inline (the board is static while a bot thinks), keep the runner behind an interface, and switch if the phone profile demands it (CONTEXT discretion). |
| Hand-tuned weights | Learned evaluation (TD/NN) | Out of proportion for v1; a few weights tuned by the ladder tool are enough to beat level 4. |

**Installation:** none.

**Version verification:** no package is added. Installed versions were read from the repo `package.json` files and `node_modules` this session.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (none) | — | — | — | — | — | No external package is installed by this phase |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 Launch.svelte ──(levels per role: partner/left/right)──> settings.ts (localStorage, validated)
       │ « Jouer la partie »
       ▼
 session.svelte.ts ──levels by colour──> GameController.createGame({ levels, runner, speed })
                                               │
            bot's turn (director.idle) ────────┤
                                               ▼
                         view = viewFor(state, bot)   ← only the seat's knowledge
                                               │
                     ┌─────────────────────────┴───────────────────────────┐
                     │ BotRunner (host)                                      │
                     │  inline: slices of thinker.step(k) between yields    │
                     │  (or Web Worker running the same code)               │
                     │  deadline guard (browser only)                        │
                     └─────────────────────────┬───────────────────────────┘
                                               ▼
   @toc/bots createThinker(view, seat, level, rng, budget)
     ├─ exchange phase ─> giveChoice: score each card by partner gain − own loss ──┐
     ├─ play phase ─> candidates(view): movesForCard + engine sevenOutcomes (dedup) │
     │      ├─ 0/1 candidate ─> immediate result, difficulty 0                     │
     │      ├─ level 1 ─> randomLegal (unchanged)                                  │
     │      ├─ levels 2–4 ─> static eval → ε / softmax(T) pick                     │
     │      └─ level 5 ─> loop: sample world from view (determinize)              │
     │                     for each top-K candidate: apply, greedy rollout N plies,│
     │                     evaluate → running means; best mean wins                │
     └─ result(): { action, rng, difficulty, candidates } ◄────────────────────────┘
                                               │
     paceFor(difficulty, speed, u) − elapsed search ─> wait the rest (setTimeout)
                                               ▼
                         apply(state, bot, action) → events → Director (animations)
     session.thinking ──> InfoBar / pill / SeatChip « breathes » (static marker if reduced motion)
```

### Recommended Project Structure
```
packages/engine/src/
├── seven.ts          # + sevenOutcomes(board, seat, card): one plan per distinct end board
├── view.ts / types.ts# + PlayerView.givenToPartner (the card this seat passed this deal)
packages/bots/src/
├── index.ts          # exports BotLevel, BOT_LEVELS, parseBotLevel, chooseAction, createThinker, randomLegal
├── randomLegal.ts    # level 1, unchanged
├── levels.ts         # per-level parameters (ε, T, K, plies, iteration budget)
├── candidates.ts     # legal candidates with their resulting pawns (7 via sevenOutcomes)
├── evaluate.ts       # team evaluation: home, distance to carré 16, out, risk (card counting), weights
├── knowledge.ts      # unknown-card pool from the view; per-seat hidden counts
├── determinize.ts    # sample a GameState consistent with the view (for level-5 rollouts only)
├── exchange.ts       # giveChoice (D-09)
├── search.ts         # level 5: flat Monte-Carlo over determinizations, anytime
├── thinker.ts        # createThinker / chooseAction: one entry point for every level
└── *.test.ts         # unit, scenario, property tests (packages/**/*.test.ts is collected)
packages/bots/test/   # (optional) purity guard copy, ladder smoke
apps/web/src/game/
├── GameController.ts # levels per seat, BotRunner injection, paceFor replaces thinkDelay
├── botRunner.ts      # inline time-sliced runner (default) + optional worker runner
├── pace.ts           # paceFor(difficulty, speed, u): pure, unit-tested
apps/web/src/ui/StrengthPicker.svelte   # per-seat horse-level picker (reuses Segmented pattern)
apps/web/src/i18n/fr/bots.ts            # Poulain … Champion, labels
tools/ladder.mjs                         # level-vs-level team matches, statistics, exit code
tools/bench-bots.mjs (optional)          # decision-time percentiles per level on fixed positions
```

### Pattern 1: One pure, anytime bot API
**What:** Every level goes through one function family. The bot takes a `PlayerView`, a seat, a level, an sfc32 `Rng` and an iteration budget, and returns the action plus the advanced RNG, like `randomLegal` does today. The anytime form lets any host slice the work.
**When to use:** Always. The browser runner slices `step(k)`. The phase-2 DO calls `chooseAction` synchronously with a small budget. Tests call `chooseAction` with fixed budgets.
**Why iteration budgets:** deployed Workers freeze timers during CPU work: « APIs that return timers, including `performance.now()` and `Date.now()`, only advance or increment after I/O occurs ». A `while (now() < deadline)` loop would never stop in the DO. [CITED: developers.cloudflare.com/workers/runtime-apis/performance (docs source cloudflare-docs/src/content/docs/workers/runtime-apis/performance.mdx)] Fixed iteration counts also make every test reproducible.

### Pattern 2: Candidates with the 7 deduplicated by outcome
**What:** For each distinct card in hand, take `movesForCard(view, seat, card)` (each `Candidate` already carries its `walk`/`swap` result) and, for a 7, one representative plan per distinct end board. Score boards, not plans.
**Measured this session (30 random games, 18 821 play decisions):** total candidates per decision mean 43.5, p50 3, p90 10, p99 906, max 15 231. The 7 alone: plans mean 199, p99 3 728, max 15 228; distinct end boards mean 4.7, p90 8, max 129. `sevenPlans` alone: mean 1.97 ms, max 142 ms on this machine. [VERIFIED: scratch benchmark against packages/engine/src, this session]
**Engine addition (recommended):** `sevenOutcomes(board, seat, card): { plan: SevenPlan; pawns; captured }[]`. It is a DFS that keeps a visited set on `(boardKey, remaining, last pawn)` and checks each finished plan with the same `keepsDuty` (G16) as `applyPlan`. A scratch version built on `previewPlan` + `applyPlan` returned exactly the same outcome set as full enumeration on 1 664 boards (0 mismatches). Mean 0.88 ms against 3.22 ms; worst 36 ms against 431 ms. [VERIFIED: scratch seven.mjs, this session] A native version using `microMove` and the existing memoised `completable` will be faster. It must live in `seven.ts`, because `microMove`, `completable`, `keepsDuty` and `sevenMustEnter`'s context are module-private there.
**Note:** keep `legalActions` and `sevenPlans` unchanged (the UI and the invariants test rely on them).

### Pattern 3: One team evaluation (« rentrer, manger, se protéger, aider le partenaire »)
**What:** `evaluate(pawns, rules, team, knowledge?)` = Σ over the 8 knights of my team − Σ over the 8 opponents of `value(knight) − risk(knight)`. The partner's knights count exactly like mine (D-08 « aider le partenaire », and R-15: a finished player plays his partner's knights).

| Term | Covers | Starting value (prototype) | Notes |
|------|--------|----------------------------|-------|
| Knight home | rentrer | 100 + 2 × slot | A deeper slot is better: fewer exact counts are blocked later (G17 lets knights jump, the target slot must still be empty). |
| Knight out of the stable | sortir | 20 | Makes As/Roi exits worth playing. |
| Progress | rentrer | 1 per step, measured as `70 − distanceToEntry` | `distanceToEntry = (ENTRY[color] − ringIndex(color, progress) + 72) % 72`. Under G14 a knight backed up 4 from its exit (progress −4) is 2 steps from its carré 16, so the « 4 trick » is valued automatically. |
| Risk (threat) | se protéger | value × min(0.9, 0.35 × threats × 0.3) | Threats: an opponent knight 1–13 cells behind (not 11), with ≤ 7 counted fully (the 7 eats on the way); an opponent knight exactly 4 cells ahead (the 4 backward); my knight on an opponent's exit square while that opponent has stable knights (As/Roi exit eats). A knight protected on its own exit has no risk. |
| Captures | manger | implicit | An eaten opponent knight drops from its value to 0; eating the partner (forced landing, R-11) is penalised the same way. |

- **Improve the risk term with card counting (level 5, optional for 2–4):** the unknown pool is `FULL_DECK − own hand − discard − every posed hand − givenToPartner`. P(a seat with h unknown cards holds ≥ 1 card of rank r) = 1 − C(U − k_r, h) / C(U, h). Replace the flat « threat » weight by that probability per opponent and per capturing rank. This uses only public information and is exactly what a careful human does. [ASSUMED: formula is standard hypergeometric; the strength gain is not yet measured]
- **Hand potential (tunable):** a small bonus for keeping an As/Roi while knights wait in the stable, and a 4 while a knight sits just past its exit. Without it a 1-ply bot burns its Roi to advance 13 when it should keep it to exit. Rollouts at level 5 capture part of this anyway.
- **Weights are tuned by the ladder tool** (coordinate search or SPSA over 4–6 weights, judged by win rate against the current champion). Freeze the result as named constants in `evaluate.ts` with a comment that records the run (seed, games, result). [ASSUMED: tuning gains are typically a few percentage points]

### Pattern 4: Levels 2–4 = the same evaluation with less and less noise (D-05)
**What:** Score all candidates with Pattern 3, then pick with a softmax of temperature `T` over the scores (in eval units, so « T = 8 » reads « a move 8 progress steps worse is e⁻¹ as likely »), mixed with ε chance of a `randomLegal` move at level 2. No new knowledge per level, only fewer mistakes (D-05, D-06).

| Level | Name | Policy (starting point) | Measured this session (prototype, 200 games, ±95 % CI) |
|-------|------|-------------------------|-------------------------------|
| 1 | Poulain | `randomLegal` (unchanged, BOT-02) | — |
| 2 | Trotteur | ε = 0.5 random, else softmax T = 20 | 94.0 % ± 3.3 vs level 1 |
| 3 | Galopeur | softmax T = 8 | 97.0 % ± 2.4 vs level 2 (and 81 % ± 5.4 vs plain T = 20) |
| 4 | Pur-sang | softmax T = 3 (try 2–4) | 61.5 % ± 6.7 vs level 3 |
| 5 | Champion | determinized Monte-Carlo, T = 0 (Pattern 5) | 76 % ± 5.9 vs greedy T = 0 (8 worlds × 4 plies, 200 games); greedy T = 0 itself beat T = 3 58 % ± 6.8 |

[VERIFIED: scratch match.mjs against the real engine, this session; numbers are for the prototype eval and will move after tuning]
- The give at levels 2–4 uses the same softmax over Pattern 7 scores.
- Do not apply noise when there is only one candidate; the engine already enforces obligations (G16 entries, the mandatory play).
- The L3→L4 and L4→L5 gaps are the narrow ones. Tune T for level 4 after level 5 is fixed, so that both steps pass the bar (Pattern 10).

### Pattern 5: Level 5 = flat Monte-Carlo over determinized hands (PIMC)
**What:**
1. Candidates by Pattern 2; if 0 → discard; if 1 → play it (difficulty 0).
2. Keep the top K (6–8) by static score (always keep any capture and any home entry).
3. Loop over worlds until the iteration budget is spent: sample a `GameState` consistent with the view (Pattern 6). For each kept candidate, with **common random numbers** (the same world and the same rollout RNG for every candidate), apply it, then roll out N plies where every seat, partner included, plays the level-4-like greedy policy from its own sampled hand, and stop early at the end of the deal or the game. Score with Pattern 3 (± a large constant for a won/lost game). Add the score to the candidate's running mean.
4. The best mean wins (T = 0). `difficulty` = f(number of candidates, gap between the two best means).

**Measured (prototype, 100 games each vs greedy):** random-policy rollouts (8 worlds × 8 plies, or 16 × 4) scored 53 % and 59 % (not significant). Greedy-policy rollouts (4 worlds × 8 plies) scored 65 % ± 9.3 at 49 ms mean per decision on this machine, max 3.3 s. With **8 worlds × 4 plies** (one round) it scored **76.0 % ± 5.9 over 200 games** at 61 ms mean per decision, max 7.0 s. The maxima came from the un-deduplicated 7 inside rollouts; Pattern 2 removes them. So more worlds over one round beat fewer worlds over two rounds: prefer breadth (worlds) over depth (plies). [VERIFIED: scratch match.mjs, this session]
**Budget:** count work in « rollout plies » (one apply + one greedy policy call), not milliseconds. Starting budget: K ≤ 6 candidates × 8–16 worlds × 4 plies ≈ 200–400 rollout plies (the measured 76 % used 8 worlds × 4 plies × top-6). Calibrate it so a mid-range phone stays under ~1 s at p95 (see Environment and Pitfall 1). Measured cost in the unoptimised prototype: one determinization ≈ 15 µs, one greedy rollout ply ≈ 1.0 ms (3 901 samples), so 300 plies ≈ 300 ms here [VERIFIED: scratch plycost.mjs]. The prototype re-resolves every move, keys boards with `JSON.stringify` and still enumerates 7 plans. Removing those (Pattern 2, `Candidate.walk` already holds the end position) should make it several times cheaper [ASSUMED: speed-up not measured].
**Why not ISMCTS now:** small branching, short useful horizon (a round of 4 plies decides most captures), and the evaluation carries the long-term plan. PIMC's known weaknesses (strategy fusion, non-locality) matter most in trick-taking endgames, less here. [CITED: Whitehouse thesis abstract « ISMCTS … outperform[s] … PIMC … strategy fusion and non-locality », etheses.whiterose.ac.uk/8117] Keep the search behind `search.ts` so ISMCTS can replace it later.

### Pattern 6: Determinization consistent with what the seat knows (BOT-04)
**What the view already gives** (read in `packages/engine/src/types.ts:121-147`, verbatim field names): `hand` (« Own cards only »), `handSizes`, `talonSize`, `discard`, `lastPlayed`, `posed`, `given` (« Own exchange choice only »), `received` (« Card the viewer received at the last exchange »), `hasGiven`, `pawns`, `dealer`, `dealIndex`, `dealsPlayed`, `turn`, `phase`, `captures`, `winner`, `rules`. `viewFor` copies `given: state.given[seat]` and `received: state.received[seat]` (`packages/engine/src/view.ts:37-38`).
**Card bookkeeping in the engine:** a played card goes to the discard pile (`discard: [...state.discard, card]`, `apply.ts:246`). At the end of a deal the posed hands join it (`const discard = [...state.discard, ...COLORS.flatMap((color) => state.posed[color])];`, `state.ts:175`). At a reshuffle the pile is emptied (`discard: [],`, `state.ts:189`). Card ids are unique (52 cards, no duplicate). [VERIFIED: files read this session]
**The gap:** after the four gives cross, `given` is reset to null (`given: perColor((): CardId | null => null),`, `state.ts:145`) and the seat's own give survives only as the partner's `received` (`const received = perColor((color): CardId | null => given[PARTNER[color]]);`, `state.ts:134`), which the view does not expose. A human remembers the card he passed, so the bot may too. **Add `givenToPartner: CardId | null` to `PlayerView`** (= `state.received[PARTNER[seat]]` in play, `state.given[seat]` during the exchange). Do not give the bot private memory: it must stay a pure function of the view.
**Sampling a world:** unknown = `FULL_DECK` − `hand` − `discard` − all `posed` − `givenToPartner` (when it is not already in the discard or posed). Put `givenToPartner` in the partner's hand. Shuffle the rest with the bot's sfc32 (`shuffle` from the engine) and deal `handSizes[c]` (minus the fixed card for the partner) to each other seat; the remainder is the talon, in random order. Copy the public fields; `rng` of the sampled state comes from the bot's RNG. This is a uniform sample over hidden assignments consistent with the view (no inference from opponents' past choices; that would be legitimate public-information reasoning but is out of scope for v1).
**Exchange phase:** the give decision (Pattern 7) needs no world sampling.

### Pattern 7: The exchange card (D-09)
**What:** for each distinct card c in hand: `score(c) = partnerGain(c) − λ · ownLoss(c)`, with `partnerGain(c)` = the best eval improvement among `movesForCard(view, PARTNER[seat], c)` on the current board, and `ownLoss(c)` = the same for the bot itself (λ ≈ 0.6 in the prototype). Because `movesForCard` uses `controlledPawns` (`moves.ts:56`), a partner who has finished is credited with moving the bot's own knights, which is correct under R-15.
- This covers Romain's examples by construction: an As/Roi scores high when the partner has stable knights and none out (exit + « out » bonus); a 4 scores high when a partner knight sits just past its exit (backing 4 puts it 2 steps from its carré 16).
- Level 5 may add a tie-break for « never give my only exit card while my own knights wait » via `ownLoss`. The give is evaluated on public information only (the partner's knights), never on the partner's hand (D-10).
- Scenario tests: partner all in stable + bot holds As and 9 → gives As; partner knight at progress 1 + bot holds 4 and 6 → gives 4.

### Pattern 8: Hosting: pacing, runner, controller wiring (D-11, D-12, D-13)
- **`paceFor(difficulty, speed, u)`** (pure, `apps/web/src/game/pace.ts`) replaces `thinkDelay` (`GameController.ts:115`). It returns the target total think time. Suggested shape (normal): `0` candidates/1 candidate → 300–450 ms; else `450 + 1550 × difficulty` ms ± 10 % jitter, capped at 2 000 ms. Fast: about a quarter, ≤ 300 ms (« presque aussitôt »). Test: 0. Difficulty in [0, 1] from the bot: `min(1, log2(candidates)/4) × closeness`, with closeness = 1 − min(1, gap(best, second)/S) and S ≈ 30 eval units. [ASSUMED: shape and constants; tune by feel with Romain]
- **Search time counts inside the delay:** `start = now(); result = await runner.think(...); wait(max(0, paceFor(result.difficulty, speed, u) − (now() − start)))`. A hard cap (normal 2.5 s, fast 0.5 s) stops the runner early: the anytime `result()` is always valid.
- **Inline runner (default):** loop `thinker.step(k)` for ~8 ms, then yield to the event loop, until done or deadline. Yield with a `MessageChannel` message, not `setTimeout(0)`: background tabs throttle timers (Chrome clamps to ≥ 1 s) and `scheduler.yield()` is not in Safari. [ASSUMED: browser throttling specifics] While the page is hidden, run the remaining budget synchronously (nobody is watching; the Director snaps on `visibilitychange`).
- **Optional Web Worker runner:** same interface; `new Worker(new URL("./bot.worker.ts", import.meta.url), { type: "module" })` (detection only works with `new URL` written inline and static options [CITED: Vite features.md]). Messages carry the JSON-safe view, seat, level, rng and budget; terminate on dispose. Use it only if the phone profile shows dropped frames with the inline runner.
- **Controller wiring:** `CreateGameOptions` gains `levels?: Partial<Record<Color, BotLevel>>` (default 3) and `runner?: BotRunner` (tests inject a synchronous runner; production the inline one). The loop today calls `randomLegal(viewFor(state, bot), bot, botRng)` after the delay (`GameController.ts:227`). Move the decision before the wait. **After the wait, re-check that `nextBot()` and the state identity are unchanged**: in the exchange the human may give meanwhile (the existing comment at line 221 handles this). If either changed, discard the result and think again. Keep `setThinking(nextBot())` (line 215) around the whole think. Cancel the runner on `dispose()`.
- **Fast mode** is read again at every bot step (the existing `speed: () => Speed` contract).

### Pattern 9: Strength picker and persistence (D-01 … D-03)
- `@toc/bots` exports `type BotLevel = 1 | 2 | 3 | 4 | 5`, `BOT_LEVELS`, `DEFAULT_BOT_LEVEL = 3`, `parseBotLevel(unknown): BotLevel | null` (shared with phase 2's protocol validation).
- `apps/web/src/i18n/fr/bots.ts`: `{ 1: "Poulain", 2: "Trotteur", 3: "Galopeur", 4: "Pur-sang", 5: "Champion" }`, a section title (e.g. « Force de l’ordinateur ») and an accessible group name per seat. Whether a number shows next to the name is « à confirmer par Romain » (D-02).
- **Persist per role, not per colour (recommended):** `settings.botLevels = { partner, left, right }`. The roles map to colours with `screenSideOf(seat, human)` from `@toc/board` (« Bottom for the human, left for the next seat clockwise, top for the partner, right for the previous seat », `packages/board/src/scene.ts:35-41`). Then « mon partenaire est Champion » survives a change of colour. Validate each field with `parseBotLevel`, default 3, inside `parseSettings`. The storage key `toc.settings.v1` stays: unknown and missing keys already fall back (`settings.ts:28`, `lastColor` pattern at line 60). [ASSUMED: Romain prefers per-role memory; per-colour is the literal reading of « par place » — confirm in UI-SPEC]
- **Picker:** reuse the accessible `Segmented.svelte` radio-group pattern (one tab stop, arrow keys, `min-height: var(--touch)`), one row per computer seat under its `SeatChip`. Five horse names at 14 px fit the 480 px column, but the launch screen gains three rows: check the phone held sideways (« paysage obligatoire » applies to the game; on a ~390 px-high landscape screen the launch column (48 px padding, title, 2 × 2 tiles of ≥ 128 px, teams, button) probably already scrolls, and three more rows make it longer [ASSUMED: not measured]). The look is decided in the UI-SPEC (config `ui_phase: true`).
- **Thinking sign (D-12):** `session.thinking` already exists (`GameController.thinking()`, `session.svelte.ts`) and the action zone already says « {name} réfléchit… » (`i18n/fr/game.ts:96`). Add a `breathing` state to the turn chip in `InfoBar` (row and pill forms): a CSS keyframe on `opacity` (≈ 0.6 ↔ 1) and `transform: scale(1 ↔ 1.04)`, about 1.6 s, ease-in-out, infinite, `aria-hidden`. Under `settings.reduceMotion` or `@media (prefers-reduced-motion: reduce)` show a static marker instead (e.g. a « … » badge). This is the same dual switch as `EndScreen`/`HandFan` (`class:still={settings.reduceMotion}` + media query).

### Pattern 10: Ladder tool and the « nettement » bar (D-07)
- `tools/ladder.mjs --a 3 --b 2 --games 400 [--seed S] [--workers 4] [--min 0.60]`, modelled on `tools/selfplay.mjs` (same `actingSeat`, `draw4`, direct `.ts` imports), with `node:worker_threads`.
- **Paired seeds:** each deck seed is played twice with the teams swapped (seat and deal luck cancel). The deck order is fixed by the seed for the whole first pack, and later reshuffles depend on play. Report the game win rate, the pair outcomes (2–0 / 1–1 / 0–2), mean and max ms per decision for each side, and the total rollout plies.
- **Bar:** level n passes against n−1 when p̂ ≥ 60 % and the Wilson 95 % lower bound > 55 % over 400 games (200 pairs). Sample size: detecting 60 % against 50 % one-sided at α = 0.01 with power 0.9 needs n ≈ ((2.326·0.5 + 1.282·0.49)/0.10)² ≈ 321 games, so 400 leaves margin. Exit code 1 if the bar is not met. Games always end with a winner (selfplay: 50/50 finished, 0 failed this session).
- **Cost:** levels 1–4 are about 1 ms per decision; the prototype's level-5 team took about 7 s per game, so 400 games ≈ 48 min on one core, ~12 min with 4 workers. Run the full ladder as a verification step (output pasted into VERIFICATION). A Vitest smoke covers levels 1→4 with fixed seeds and small N (deterministic, so not flaky).

### Anti-Patterns to Avoid
- **Passing `GameState` or a closure over it to a bot:** breaks BOT-04; the `kind` discriminant makes it a type error, keep it that way (no `as any`).
- **Bot memory outside the view** (a module-level map of « cards I gave », caches keyed by seat): makes the bot impure and can leak across seats. Add knowledge to `PlayerView` instead.
- **`performance.now()`/`Date.now()` inside `packages/bots`:** non-deterministic tests, and frozen clocks in the DO. Budgets are counts.
- **Enumerating `sevenPlans` inside search or rollouts:** up to 15 k plans per 7 (Pattern 2).
- **Adding the think delay on top of the search time:** D-13 says the compute time counts inside.
- **Sharing one sampled world across seats, or letting a bot partner see the human's hand:** D-10 treats both partners alike.
- **Re-implementing move rules in the bot** (distances, entries, protection) for anything that decides legality: use `movesForCard`/`walk`/`sevenOutcomes`. Approximations are acceptable only inside the risk heuristic.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Legal moves, captures, home entry (G14–G17) | Bot-side move logic | `movesForCard`, `resolveMove`, `walk`, `applyPlan` | The engine is the single path validated by 100+ scenarios; G16/G17 edge cases are subtle. |
| 7 split search | A bot-side 7 enumerator | Engine `sevenOutcomes` (new, in `seven.ts`) | Needs the private memoised `completable` and `keepsDuty`. |
| Randomness | `Math.random`, `crypto` inside bots | engine `next`/`shuffle` (sfc32) passed in and returned | Reproducible games and tests; the engine purity guard forbids the others. |
| Persistent settings | A second storage module | `parseSettings`/`saveSettings` in `settings.ts` | Already validated, try/catch, unknown-key tolerant. |
| Accessible 5-choice control | A custom widget | `Segmented.svelte` pattern | Already a WAI-ARIA radio group with arrow keys and touch sizes. |
| Statistics | Ad-hoc « looks better » | Wilson interval + one-sided binomial bar in `ladder.mjs` | D-07 asks for « nettement », which needs a stated threshold. |

**Key insight:** the hard part of a TOC bot is not search, it is the rules (the 7, G16, G17, R-15). They already exist, tested, in the engine. The bot should be a thin scorer on top of the engine's candidates.

## Common Pitfalls

### Pitfall 1: Phone CPU and the 7 explosion
**What goes wrong:** a level-5 decision takes seconds on a phone, or a single 7 freezes the page.
**Why it happens:** up to 15 231 plans for one 7; the prototype's level 5 had a 3.3 s worst decision on this desktop. Mid-range phones run JS several times slower. [ASSUMED: 3–5× slower than this container]
**How to avoid:** `sevenOutcomes` (dedup), top-K pruning, iteration budgets, a host deadline, time slicing. Add a debug bench (e.g. a debug-only route or tool that times level-5 decisions on fixed positions and shows p50/p95/max) and run it on Romain's phone in the human-verify step.
**Warning signs:** `ladder.mjs` max ms/decision > 300 ms on desktop for level 5.

### Pitfall 2: Determinism lost to time budgets
**What goes wrong:** the same seed gives different bot moves on different machines; tests flake.
**How to avoid:** the bot only knows iteration counts. The deadline lives in the browser runner and, when it fires, makes the move depend on the device (accepted in production, never in tests: tests use `speed: "test"` and a synchronous runner).

### Pitfall 3: Leaking hidden information through the plumbing
**What goes wrong:** the bot is pure, but the host passes `viewFor(state, human)` or a stale view of another seat. Or the debug path derives the bot RNG from the deck seed (`botSeedFrom(seed)`, `GameController.ts:96-105`): a bot could in principle reconstruct the deck.
**How to avoid:** the controller test that checks « calls the bot with a PlayerView of its own seat » (exists for `randomLegal`) must be ported to the new entry point. Keep `botSeedFrom` debug-only (it is used only when `debug.graine` is set in `session.svelte.ts`). Never let bot code read `state.rng` (it is not in the view).

### Pitfall 4: Exchange-phase race
**What goes wrong:** the bot computes its give, the human gives during the think delay, and the code plays the stale decision for a different bot or after the phase changed.
**How to avoid:** compare `nextBot()` and the state object identity before applying; recompute if either changed (Pattern 8).

### Pitfall 5: Fake timers versus the runner
**What goes wrong:** `GameController.test.ts` uses `vi.useFakeTimers()`. A runner that yields with `setTimeout`/`MessageChannel` hangs or behaves differently under fake timers.
**How to avoid:** inject `runner` into `createGame`; tests use a synchronous runner. Unit-test the inline runner separately with real timers.

### Pitfall 6: G16 and must-play obligations at low levels
**What goes wrong:** the noise picks an « illegal-looking » move, or a softmax over 7 plans is dominated by thousands of equivalent plans.
**How to avoid:** sample only among engine candidates (G16 already filters 7 plans), and among *distinct outcomes* for the 7, so a 7 is one option per resulting board, not 15 000.

### Pitfall 7: The ladder proves the prototype, not the shipped bot
**What goes wrong:** levels are tuned with one evaluation, then the evaluation changes and nobody re-runs the ladder.
**How to avoid:** the ladder imports the real `@toc/bots` and uses the real per-level budgets; re-run it whenever `evaluate.ts` or `levels.ts` changes (note it in the plan's verification).

### Pitfall 8: Background tabs and slow devices
**What goes wrong:** time-sliced search stalls when the tab is hidden (throttled timers), and the human comes back to a bot still « thinking ».
**How to avoid:** `MessageChannel` yields; when `document.hidden`, finish the budget synchronously. The Director already snaps to the latest state on `visibilitychange`.

### Pitfall 9: Phase-2 Durable Object constraints
**What goes wrong:** the same budget that is fine on a phone blocks a DO room for other players.
**Facts:** DO « CPU per request: 30 seconds (default) / configurable to 5 minutes », and « Each incoming HTTP request or WebSocket message resets the remaining available CPU time to 30 seconds ». [CITED: developers.cloudflare.com/durable-objects/platform/limits] Timers are frozen during CPU work in deployed Workers (Pattern 1).
**How to avoid:** the per-level budget is a parameter; phase 2 picks a smaller one for the DO if needed. The bot never sleeps; the DO host uses alarms for the think delay.

## Code Examples

The values in these skeletons come from the files quoted, read this session. New names (`BotLevel`, `createThinker`, `sevenOutcomes`, `givenToPartner`, `paceFor`) are proposals.

### Existing signatures the bot builds on (verbatim)
```ts
// packages/engine/src/rng.ts:7,10,22
export type Rng = [number, number, number, number];
export function next(s: Rng): [number, Rng] {
export function shuffle<T>(xs: readonly T[], s: Rng): [T[], Rng] {

// packages/engine/src/legal.ts:14
export type LegalOpts = { sevenPlans?: "all" | "none" };

// packages/bots/src/randomLegal.ts:53 (level 1, unchanged)
export function randomLegal(view: PlayerView, seat: Color, rng: Rng): [Action, Rng] {

// packages/engine/src/types.ts:62-74 (the doc comment line above each member omitted)
export type Action =
  | { t: "give"; card: CardId }
  | { t: "exit"; card: CardId; pawn: PawnId }
  | { t: "move"; card: CardId; pawn: PawnId }
  | { t: "swap"; card: CardId; pawn: PawnId; target: PawnId }
  | { t: "seven"; card: CardId; plan: SevenPlan }
  | { t: "discard" };
```

### Proposed bot entry points
```ts
// packages/bots/src/thinker.ts (proposal)
import type { Action, Color, PlayerView, Rng } from "@toc/engine";

export type BotLevel = 1 | 2 | 3 | 4 | 5;
/** Work, not time: one unit = one apply + one policy call inside the search. */
export type Budget = { plies: number };
export type Thought = { action: Action; rng: Rng; difficulty: number; candidates: number };

export type Thinker = {
  /** Runs up to `units` more work; true when the search is finished. */
  step(units: number): boolean;
  /** Always valid, also before the search is finished (anytime). */
  result(): Thought;
};

export function createThinker(view: PlayerView, seat: Color, level: BotLevel, rng: Rng, budget?: Budget): Thinker;

/** Synchronous: tests, ladder, and later the Durable Object. */
export function chooseAction(view: PlayerView, seat: Color, level: BotLevel, rng: Rng, budget?: Budget): Thought {
  const thinker = createThinker(view, seat, level, rng, budget);
  while (!thinker.step(256)) {}
  return thinker.result();
}
```

### Hidden-hand swap property (BOT-04)
```ts
// packages/bots/src/noCheat.test.ts (proposal): fast-check, fixed seed, like invariants.test.ts
// 1. Reach a random state S by playing randomLegal from newGame(seed) for k actions.
// 2. For the seat b to act: S' = S with every card hidden from b redistributed:
//    pool = other hands (minus b's givenToPartner kept in the partner's hand) + talon, shuffled,
//    dealt back with the same hand sizes; talon = the rest.
// 3. expect(viewFor(S', b)).toEqual(viewFor(S, b));              // the swap is invisible to b
// 4. for each level 1..5 with a small fixed budget:
//      expect(chooseAction(viewFor(S', b), b, level, rng, budget))
//        .toEqual(chooseAction(viewFor(S, b), b, level, rng, budget));
// Negative control (the test is not blind): a deliberately cheating stub that reads S.hands
// through a closure must make the property fail on some sample.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Rule-based scripted bots | Heuristic eval + noise for « human » levels; determinized Monte-Carlo (PIMC) / ISMCTS for strong imperfect-information play | ISMCTS: Cowling, Powley, Whitehouse, IEEE TCIAIG 2012 | Monte-Carlo over sampled hands is the standard for card games with hidden hands; ISMCTS is the stronger but heavier refinement. [CITED: etheses.whiterose.ac.uk/8117; arxiv.org/pdf/1906.04439] |
| `setTimeout` think delay (700–1300 ms) | Difficulty-based pacing with search time inside it | This phase | D-11, D-13. |

**Deprecated/outdated in this codebase after the phase:** `thinkDelay(speed, u)` and its test « gives the three bots' cards one at a time, each after a 700 to 1300 ms think » (`GameController.test.ts:147`) are replaced by `paceFor` and new bounds.

## Prototype measurements (this session)

Scratch code only (`/tmp/.../scratchpad/proto.mjs`, `match.mjs`, `seven.mjs`, `bench.mjs`), never committed. Each line is a measurement against the real `packages/engine/src` on this container (4 cores, Node 22.22.0). Seeds were swapped between teams game by game.

| Experiment | Result |
|------------|--------|
| `tools/selfplay.mjs --games 50` (random vs random) | 50/50 finished; mean 41.6 deals, 814 actions; 3.3 s |
| Greedy (eval, T=0) vs random, 100 games | 100 % |
| Softmax T=20 vs random, 100 games | 100 % |
| ε=0.5 + T=20 vs random, 200 games | 94.0 % ± 3.3 |
| T=8 vs ε=0.5 + T=20, 200 games | 97.0 % ± 2.4 |
| T=8 vs T=20, 200 games | 81.0 % ± 5.4 |
| T=3 vs T=8, 200 games | 61.5 % ± 6.7 |
| Greedy vs T=3, 200 games | 58.0 % ± 6.8 |
| PIMC random rollouts (8×8 and 16×4) vs greedy, 100 games each | 53 % and 59 % (± 9.8): not significant |
| PIMC greedy rollouts, 4 worlds × 8 plies, top-6, vs greedy, 100 games | 65.0 % ± 9.3; 49 ms mean, 3.3 s max per decision |
| PIMC greedy rollouts, 8 worlds × 4 plies, top-6, vs greedy, 200 games | **76.0 % ± 5.9**; 61 ms mean, 7.0 s max per decision (7 not deduplicated) |
| Cost of one determinization / one greedy rollout ply (prototype) | ≈ 15 µs / ≈ 1.0 ms |
| Decision-time, greedy levels | ≈ 1 ms mean, 200–470 ms max (7 enumeration, before dedup) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A mid-range phone runs this JS 3–5× slower than this container | Pitfall 1, Pattern 5 | Budgets too large → thinking > 2 s on the phone. Mitigated by the deadline and the on-phone bench. |
| A2 | Per-role persistence (partner/left/right) is what Romain expects from « on se souvient » | Pattern 9 | Small: switch to per-colour storage; confirm in the UI-SPEC. |
| A3 | Pacing constants (300–450 ms single move, up to 2 000 ms, fast ≤ 300 ms) feel natural | Pattern 8 | Feel only; tune with Romain at UAT. |
| A4 | Card-counting risk and hand-potential terms improve level 5 | Pattern 3 | Wasted effort if they do not; the ladder decides. |
| A5 | Browser background throttling (timers ≥ 1 s) and no `scheduler.yield` in Safari | Pattern 8, Pitfall 8 | A hidden tab could stall a bot; the synchronous-when-hidden rule covers it. |
| A6 | PIMC with greedy rollouts will clear the 60 % bar against a tuned level 4 over 400 games (measured 76 % vs greedy T = 0, not yet vs T = 3) | Patterns 4–5 | If not: deepen rollouts, add card counting, or lower level-4 strength (T up) so both gaps pass. |
| A7 | Level-5 search with K ≤ 6, 8–16 worlds, 4 plies fits ~1 s p95 on a phone after dedup | Pattern 5 | Reduce worlds; the anytime design degrades gracefully. |

## Open Questions

1. **Does the level number show next to the horse name?**
   - What we know: D-02 leaves it « à confirmer par Romain ».
   - Recommendation: settle it in the UI-SPEC (`/gsd-ui-phase 3`); the picker component takes the label from `fr/bots.ts`, so both variants cost the same.
2. **Should the chosen level be visible during the game** (e.g. in the « Infos de la partie » sheet next to each horse name)?
   - What we know: not requested; harmless; helps Romain check « chaque place joue à sa force » (SC1).
   - Recommendation: offer it in the UI-SPEC as optional; no engine impact.
3. **Is « nettement » 60 % per step acceptable to Romain?**
   - What we know: D-07 asks for « nettement plus souvent »; L1→L2→L3 gaps are huge (> 90 %), L3→L4→L5 are the narrow steps (≈ 60–65 % in the prototype).
   - Recommendation: lock the bar in the plan (p̂ ≥ 60 %, Wilson lower bound > 55 %, 400 games) and show Romain the ladder table at verification.
4. **DO CPU on the Workers Free plan.**
   - What we know: the DO limits page lists 30 s CPU per request/message; the Workers page lists 10 ms CPU per HTTP request on Free. Which one binds a DO alarm or WebSocket handler on Free was not established this session.
   - Recommendation: phase-2 research; keep the level budget a parameter.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tools/ladder.mjs, tests | ✓ | 22.22.0 | — |
| pnpm | workspace scripts | ✓ | 10.34.7 | — |
| 4 CPU cores | parallel ladder | ✓ | `nproc` = 4 | run fewer games per invocation |
| Real mid-range phone | BOT-05 timing check | ✗ (not in this environment) | — | Debug bench page run by Romain at the human-verify checkpoint |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** the phone timing check moves to the human-verify step.

## Validation Architecture

The config has `workflow.nyquist_validation: false`, but the request for this research explicitly asked which tests prove each success criterion, so the section is included.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ^4.1.11 (+ fast-check 4.10.2), Playwright 1.64.0 for e2e |
| Config file | `/home/user/toc/vitest.config.ts` (includes `packages/**/*.test.ts`, `apps/web/src/**/*.test.ts`, `tools/**/*.test.ts`) |
| Quick run command | `pnpm vitest run packages/bots apps/web/src/game apps/web/src/settings` |
| Full suite command | `pnpm test && pnpm typecheck && pnpm lint` |
| Ladder (long) | `node tools/ladder.mjs --a N --b N-1 --games 400 --workers 4` for N = 2..5 |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BOT-01 / SC1 | `parseSettings` keeps valid levels, falls back to 3, ignores junk; roles map to colours via `screenSideOf` | unit | `pnpm vitest run apps/web/src/settings` | ✅ `settings.test.ts` (extend) |
| BOT-01 / SC1 | `createGame({ levels })` calls the bot with each seat's level (spy) | unit | `pnpm vitest run apps/web/src/game/GameController.test.ts` | ✅ (extend) |
| BOT-01 / SC1 | The picker persists across reload and starts the game with those levels | e2e | `pnpm --filter @toc/web exec playwright test` (new spec) | ❌ Wave 0 |
| BOT-02 / SC2 | Level 1 returns exactly `randomLegal`'s action and rng | unit | `pnpm vitest run packages/bots` | ❌ Wave 0 |
| BOT-02 / SC2 | Every level returns an action `apply` accepts across random games; deterministic for fixed (view, rng, budget); view not mutated | property | `pnpm vitest run packages/bots` | ❌ Wave 0 |
| BOT-02 / SC2 | L(n) beats L(n−1): p̂ ≥ 60 %, Wilson lower > 55 %, 400 paired games | simulation tool | `node tools/ladder.mjs …` (exit code) | ❌ Wave 0 |
| BOT-02 / SC2 | Smoke ladder L1<L2<L3<L4 with fixed seeds, small N | smoke | `pnpm vitest run packages/bots/test/ladder.test.ts` | ❌ Wave 0 |
| BOT-03 / SC3 | Scenario positions: takes a capture, protects a threatened knight, enters home, uses the 4 trick, gives As/Roi to a partner with stable knights, gives a 4 to a partner just past its exit | scenario unit | `pnpm vitest run packages/bots/src/teamplay.test.ts` | ❌ Wave 0 |
| BOT-03 / SC3 | « Vrai jeu d'équipe » seen at the table | manual UAT | Romain plays with a Champion partner and against Champions | — |
| BOT-04 / SC4 | Swapping hidden hands (consistent with the view) never changes the decision, every level | property | `pnpm vitest run packages/bots/src/noCheat.test.ts` | ❌ Wave 0 |
| BOT-04 / SC4 | Negative control: a cheating stub fails the property | unit | same file | ❌ Wave 0 |
| BOT-04 / SC4 | `GameState` passed to `chooseAction` is a type error (`@ts-expect-error`) | type | `pnpm typecheck` | ❌ Wave 0 |
| BOT-04 / SC4 | `packages/bots/src` uses no randomness/clock/timer/DOM/storage/network (purity guard, like `engine/test/purity.test.ts`) | static | `pnpm vitest run packages/bots` | ❌ Wave 0 |
| BOT-04 / SC4 | The controller passes `viewFor(state, bot)` of the acting seat only | unit | GameController test (port the existing one) | ✅ (extend) |
| BOT-04 | `PlayerView.givenToPartner` is the seat's own give and never another seat's | unit | `pnpm vitest run packages/engine` | ❌ Wave 0 |
| BOT-05 / SC5 | `paceFor`: ≤ 500 ms when ≤ 1 candidate; ≤ 2 000 ms normal; fast ≤ 300 ms; test 0; monotone in difficulty | unit | `pnpm vitest run apps/web/src/game/pace.test.ts` | ❌ Wave 0 |
| BOT-05 / SC5 | Search time counted inside: with a runner that « takes » X ms, total think = max(X, pace) and never above the cap (fake timers) | unit | GameController test | ✅ (extend) |
| BOT-05 / SC5 | Level-5 budget bound: work units per decision ≤ budget; desktop p100 under a generous bound on fixed positions | unit/bench | `pnpm vitest run packages/bots` + `node tools/bench-bots.mjs` | ❌ Wave 0 |
| BOT-05 / SC5 | On Romain's phone, level-5 p95 < ~1 s and nothing freezes | manual | debug bench + play | — |
| engine | `sevenOutcomes` = distinct end boards of `sevenPlans` + `applyPlan` on random boards (incl. G16 duty) | property | `pnpm vitest run packages/engine` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the quick run command.
- **Per wave merge:** the full suite command.
- **Phase gate:** full suite green and `tools/ladder.mjs` passing the bar for 2/1, 3/2, 4/3, 5/4 before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `packages/bots` test files for the new modules (unit, scenario, property, purity guard)
- [ ] `packages/engine` tests for `sevenOutcomes` and `givenToPartner`
- [ ] `apps/web/src/game/pace.test.ts`
- [ ] `tools/ladder.mjs` (and optionally `tools/bench-bots.mjs`)
- [ ] Playwright spec for the picker

## Security Domain

`security_enforcement: true`, ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — (no accounts in this phase) |
| V3 Session Management | no | — |
| V4 Access Control | yes (information access) | The bot receives only `PlayerView` (type discriminant `kind: "view"`), property-tested. |
| V5 Input Validation | yes | `parseBotLevel` on every stored or debug-supplied level (localStorage is untrusted, T-01-01 pattern in `settings.ts`); phase 2 reuses it on table settings. |
| V6 Cryptography | no | Bot RNG is a game PRNG (sfc32), seeded from `crypto.getRandomValues` by the host (`randomSeed`, `GameController.ts:89-93`). |
| V11 Business Logic / DoS | yes | Iteration budgets, host deadline, cancellation on dispose; no unbounded 7 enumeration. |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Bot reads hidden hands (cheating) | Information disclosure | View-only API; no bot memory; swap property test; controller test; `givenToPartner` exposes only the seat's own knowledge. |
| Bot RNG derived from deck seed | Information disclosure | Separate `botSeed` from `crypto.getRandomValues`; `botSeedFrom` stays debug-only. |
| Tampered localStorage level (e.g. 99, "5") | Tampering | `parseBotLevel`, default 3. |
| Search freezes the page / DO | Denial of service | Budgets in work units, deadline, time slicing, `sevenOutcomes`. |

## Sources

### Primary (HIGH confidence)
- Codebase, read this session: `packages/engine/src/{types,view,rng,legal,moves,seven,path,state,apply,rules,topology,deck}.ts`, `packages/bots/src/*`, `apps/web/src/game/{GameController,session.svelte}.ts`, `apps/web/src/routes/Launch.svelte`, `apps/web/src/settings/{settings,store.svelte}.ts`, `apps/web/src/ui/{SeatChip,Segmented,InfoBar}.svelte`, `packages/board/src/scene.ts`, `tools/selfplay.mjs`, `packages/engine/test/{purity,props/invariants}.test.ts`, `RULES.md`, `.planning/{ROADMAP,REQUIREMENTS}.md`, `03-CONTEXT.md`.
- Prototype measurements against the real engine (this session; see the table above).
- Cloudflare docs source (github.com/cloudflare/cloudflare-docs): `durable-objects/platform/limits.mdx` (CPU per request), `workers/runtime-apis/performance.mdx` (frozen timers), `workers/platform/limits.mdx` (CPU per HTTP request, Free 10 ms).
- Vite docs source (github.com/vitejs/vite): `docs/guide/features.md` « Web Workers », `docs/config/worker-options.md` (`worker.format` default `'iife'`).

### Secondary (MEDIUM confidence)
- ISMCTS and PIMC: Cowling, Powley, Whitehouse, « Information Set Monte Carlo Tree Search » (IEEE TCIAIG 2012), via Whitehouse's thesis record (etheses.whiterose.ac.uk/8117) and the card-game AI survey arxiv.org/pdf/1906.04439 (abstracts and search snippets only).

### Tertiary (LOW confidence)
- Phone/desktop JS speed ratio and browser throttling details (training knowledge; see A1, A5).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. No new dependency; everything read from the repo.
- Architecture (pure anytime bot, dedup 7, view-only determinization): HIGH. Grounded in the engine code and measured.
- Level ladder and strength: MEDIUM. The direction and rough gaps were measured; final parameters need tuning and the full 400-game runs.
- Pacing/UI: MEDIUM. Constants are assumptions to tune by feel.
- Pitfalls: MEDIUM-HIGH.

**Research date:** 2026-10-15
**Valid until:** 2026-11-15 (stable domain; re-check only if the engine's 7 or view types change)
