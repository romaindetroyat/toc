# Phase 3: L'ordinateur à la force choisie - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Each seat held by the computer plays at a strength the player chooses, from level 1 (a random legal move, today's bot) to level 5 (a real team game). The computer never cheats: it decides only from what a human in its seat would know. It plays at a natural pace.

Romain moved this phase before phase 2 on 2026-10-15 (« OK, on passe à la phase 3 »). There is no online table yet. The strength is chosen on the existing local launch screen (`apps/web/src/routes/Launch.svelte`), and phase 2's online table will reuse the same per-seat choice. The bots must stay pure, deterministic functions of (seat view, rng). The same code must later run inside the Durable Object (phase 2), so it can never depend on the DOM or on timers.

Out of scope: online play, accounts, a tutorial or hints for the human, bot chat, and changing the rules.

</domain>

<decisions>
## Implementation Decisions

### Choosing the strength (Romain's choices, 2026-10-15)
- **D-01:** One strength setting per computer seat on the launch screen, under each name: the partner and each of the two opponents. Romain: « Une par place (Recommandé) ».
- **D-02:** The levels are shown as horse names, not numbers. Romain: « Noms de chevaux ». The suggestion he picked was Poulain (1), Trotteur (2), Galopeur (3), Pur-sang (4), Champion (5). The numbers 1–5 stay the internal values (BOT-01). The exact wording and whether a number shows next to the name are « à confirmer par Romain ».
- **D-03:** The default is level 3 (Galopeur) the first time, then the device remembers the last choice per seat. Romain: « 3, et on se souvient (Recommandé) ». Store it in the existing settings store (`apps/web/src/settings/store.svelte.ts`, localStorage with try/catch and validation, like `lastColor`).

### Character of the levels
- **D-04:** Level 5 (Champion) must be as strong as possible: Romain: « Le plus fort possible » (he did not pick the « fort mais humain » option). It still never cheats (D-10) and still answers within the time cap (D-13). The search budget is the planner's call. It is CPU-time-boxed so a phone never freezes; the CLAUDE.md stack notes suggest time-boxed Monte-Carlo or expectimax over the sampled hidden hands.
- **D-05:** Levels 2 to 4 progress by making fewer and fewer mistakes. Romain: « Erreurs de moins en moins (Recommandé) ». All of them know how to play well, but low levels often go wrong (a poor card, a missed capture) and the Champion almost never does. Level 1 stays today's `randomLegal` (BOT-02).
- **D-06:** No personalities or styles: only the strength differs. Romain: « Non, juste la force (Recommandé) ».
- **D-07:** Each level must win clearly more often than the one below over many simulated games (BOT-02, success criterion 2). This is proven by a tool like `tools/selfplay.mjs`, with team-vs-team matches between levels.

### Team play
- **D-08:** Romain ticked all four as essential: « Rentrer ses chevaux, Manger les adversaires, Se protéger, Aider le partenaire ». The strong levels weigh all four, and none dominates by default. The evaluation and weights are the planner's call and are tuned by simulation.
- **D-09:** The exchange card: the Champion gives what helps the partner most, given the partner's knights. Examples: an As or Roi when the partner has knights to bring out, a 4 to back toward its home. Romain: « Ce qui aide le partenaire (Recommandé) ». It reasons only on visible information (D-10).
- **D-10:** No cheating (BOT-04, success criterion 4). The bot sees only its own hand, the cards played, the board and the public counts. That includes the partner's hand: when Romain is the partner, the bot does not know his cards. Romain: « Oui, pareil (Recommandé) », meaning the bot treats a human partner like a computer partner. The bot API should take the seat view (`viewFor(state, bot)`), never the full state. A test changes the other hands and checks the move does not change.

### Pace
- **D-11:** The thinking time depends on the move. With a single legal move or nearly, it is under half a second. A delicate choice takes up to about 2 seconds. Romain: « Selon le coup (Recommandé) ». The cap of a few seconds holds at every level (BOT-05).
- **D-12:** A discreet sign shows that a computer player is thinking: its name or pill « breathes » gently. Romain: « Oui, discrètement (Recommandé) ». It honours prefers-reduced-motion, with no animation, only a static marker.
- **D-13:** The existing « Avance rapide » setting also shortens the thinking: in fast mode the computer plays almost at once. Romain: « Oui (Recommandé) ». Today `thinkDelay(speed, u)` in `apps/web/src/game/GameController.ts` gives 700–1300 ms normal and 200–300 ms fast. It becomes a function of the move's difficulty and the speed setting. The search's own compute time counts inside the delay, not added to it.

### Claude's Discretion
- The search algorithm and its budget per level, the evaluation function and weights, how mistakes are injected at levels 2–4 (e.g. a softmax temperature or the probability of picking a worse move), and how the hidden hands are sampled for the Champion.
- Where the bot runs on the client (main thread with a time box, or a Web Worker if profiling demands it).
- How the strength picker looks on the launch screen (wood style, galet theme), within D-01 to D-03.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` § « Phase 3: L'ordinateur à la force choisie » — goal and five success criteria
- `.planning/REQUIREMENTS.md` — BOT-01 to BOT-05

### Rules the bots must play by
- `RULES.md` — all house rules, including G14 (entry without a full lap), G15 (the 7 eats only opponents it passes), G16 (a 7 that can bring a knight home must) and G17 (jumping knights already home)
- `packages/engine/src/rules.ts` — the rule switches (ENTRY_WITHOUT_FULL_LAP, SEVEN_EATS_PASSED_PARTNER, KNIGHT_MUST_ENTER, HOME_JUMP_ALLOWED)

### Project constraints
- `.claude/CLAUDE.md` — stack (bots run inside the DO later, CPU-budgeted; no setTimeout in the DO; fast-check property tests), French UI
- `.planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md` — the design contract (galet wood style, type scale, colours, the launch screen, reduced motion)
- `.planning/phases/01-une-vraie-partie-sur-un-appareil/01-CONTEXT.md` — Romain's phase-1 decisions (the launch screen, « Avance rapide », the bot names)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/bots/src/randomLegal.ts`: today's level 1, `randomLegal(view, seat, rng)` returning `[action, rng]`. It is pure and seeded.
- `packages/engine`: the full rules, legal-move generation (`legal.ts`), the 7 plans (`seven.ts`, `sevenPlans`) and per-seat views (`viewFor`). The bots must drive everything through it.
- `tools/selfplay.mjs`: plays 200 games in about 11 s and is the base for the level-vs-level simulations.
- `packages/engine/test/props/invariants.test.ts`: the fast-check property tests to extend (no cheating, deterministic moves).
- `apps/web/src/game/botNames.ts`: the horse names of the bots.

### Established Patterns
- Bots are seeded (`botSeed` in `createGame`), so games are reproducible; keep that per level.
- `GameController.ts` drives the bot turn: `thinkDelay`, then `director.idle()`, then `randomLegal(viewFor(state, bot), bot, botRng)`. The new bot plugs in there per seat level.
- Settings live in `settings/store.svelte.ts` with validated parsing (`parseSettings`), which ignores unknown keys.

### Integration Points
- `Launch.svelte`: add the per-seat strength picker under each SeatChip.
- `GameController.createGame`: accept a level per seat and pick the bot by level.
- `InfoBar` / the phone pill and the desktop bar: the « thinking » sign (D-12).

</code_context>

<specifics>
## Specific Ideas

- The horse level names: Poulain, Trotteur, Galopeur, Pur-sang, Champion (Romain chose « Noms de chevaux »).
- « Le plus fort possible » for the Champion: aim for genuinely hard to beat, while respecting the time cap and the no-cheat rule.

</specifics>

<deferred>
## Deferred Ideas

- Bot personalities and styles: Romain said no for now (D-06).
- Hints or a tutorial using the bot's evaluation for the human: phase 5 (learning).
- The online table's strength picker: phase 2 reuses D-01 to D-03.
- The sound work deferred from phase 1 (neighs, card sounds, end sounds): tracked in `.planning/phases/01-une-vraie-partie-sur-un-appareil/deferred-items.md`, not part of this phase.

</deferred>

---

*Phase: 03-l-ordinateur-la-force-choisie*
*Context gathered: 2026-10-15*
