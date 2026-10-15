---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 55
subsystem: engine
tags: [rules, home-entry, G17, gap-closure, tdd]
status: complete
requires: ["01-54"]
provides: ["G17 HOME_JUMP_ALLOWED: knights already home are jumped, on entry and inside the home"]
affects: [packages/engine, packages/bots, apps/web (through walk), RULES.md]
tech-stack:
  added: []
  patterns: ["rule switch read from state.rules (like G14 to G16), the old rule kept reachable"]
key-files:
  created:
    - docs/regles/R-13.28.webp
    - docs/regles/R-13.29.webp
    - docs/regles/R-13.30.webp
    - docs/regles/R-13.31.webp
  modified:
    - packages/engine/src/rules.ts
    - packages/engine/src/path.ts
    - packages/engine/scenarios/prises-maison.ts
    - packages/engine/test/path.test.ts
    - packages/engine/test/flags.test.ts
    - packages/engine/test/entry.test.ts
    - packages/engine/test/props/invariants.test.ts
    - docs/regles/R-13.7.webp
    - docs/regles/R-13.10.webp
    - docs/regles/R-13.19.webp
    - RULES.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-CONTEXT.md
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UAT.md
decisions:
  - "G17 (Romain, 2026-10-15): inside the home, entering from the carré 16 or moving deeper, a knight jumps the knights already home; only the target slot must be empty. Replaces G2 and the « sans sauter » of D-03"
  - "Switch HOME_JUMP_ALLOWED (default true); HOME_JUMP_BLOCKED (G2) is read only when it is false"
  - "Exact count onto an empty cell (D-01), mandatory entry (D-02), the 4 never entering (D-04), G14 and G16 unchanged; G16 now sees the entries a jump opens"
metrics:
  duration: 18min
  completed: 2026-10-15
  tasks: 3
  files: 19
actuals:
  tokens: 17000
  tasks: 3
  commits: 5
plan_head_before: ebfc0edfd476bac164154de88354930c7fd00fae
plan_head_after: cb0cf177f73bad173e6ad1086e48d506767f6861
---

# Phase 1 Plan 55: Règle G17, sauter les chevaux déjà rentrés dans l'arrivée Summary

walk() now jumps the knights already home, on entry from the carré 16 and inside the home, behind the G17 switch HOME_JUMP_ALLOWED (the old G2 still reachable), with RULES.md, four new scenarios and a mandatory-entry property invariant.

## What was done

- **Engine (TDD).** RED commit c9f5b0a (11 failing tests), GREEN commit 2dd0caf. `HOME_JUMP_ALLOWED: boolean = true` in rules.ts (constant, RuleSet, DEFAULT_RULES). In `walk()`:
  - on entry, only the target slot must be empty;
  - inside the home, a slot before the target may be occupied.
  - HOME_JUMP_BLOCKED (G2) is read only when the switch is off.
  
  The 7 (sevenPlans, nextSteps, previewPlan, applyPlan, sevenMustEnter), legalActions, the bots, the « +n » preview and the legal-move UI all go through `walk()`, so none of them changed. No signature changed.
- **Interactions checked by tests.**
  - Entry from 66 over slot 0 lands in slot 3. Entry from −4 (G14) lands in slot 2.
  - Three knights are jumped into slot 3.
  - An occupied target still sends the knight round (D-01).
  - The 4 never enters (D-04).
  - The entry is mandatory with an ordinary card (D-02).
  - A 7 step inside the home jumps.
  - G16 now lists a knight that only a jump brings home: bleu0 at 68 with bleu1 home, a 7. [bleu0 7] and [bleu0 3, bleu2 4] are refused, [bleu0 4, bleu2 3] is accepted.
  - With the switch off, G2 and D-03 come back.
- **Property invariant** (200 games, seed 20261015):
  - A forward move of a ring knight that stands on or crosses its carré 16 with 1 to 4 steps left onto an empty home slot must enter. Home slots are followed event by event through the action, so the 7 is covered.
  - The run counted 5451 such moves, 126 entries and 71 home moves that jumped a knight.
  - Mutation check: with the default flipped to false, the invariant fails (« rouge0 passed its home while 3 steps led to the empty slot 2 »).
- **RULES.md:**
  - R-13 rule text and cas limites rewritten;
  - G2 marked « Remplacé par G17 le 2026-10-15 »;
  - a new G17 entry under « Décisions de Romain » quotes his words and his answer exactly;
  - D-03 note, status and intro lines, and a note that the R-13.7 picture was redrawn.
- **Scenarios.**
  - Rewritten with the same ids: R-13.7 (the jump on entry, his reported case), R-13.10 (the jump inside the home) and R-13.19 (the jump after a backward 4).
  - New: R-13.28 (the last knight jumps three), R-13.29 (a 7 step jumps inside the home), R-13.30 (jumping onto an occupied cell: round again), R-13.31 (G16 with a jump).
  - Pictures drawn by tools/render-scenarios.mjs. The render is deterministic: only these 7 files changed.
- **Planning record:**
  - REQUIREMENTS RULE-15;
  - 01-CONTEXT.md: D-03 revised, plus a « Recette 4 » note quoting him;
  - 01-UAT.md: test 44 (issue, fixed by 01-55, re-test pending) and gap G-01-31.

## Gates (end of plan)

- `pnpm typecheck && pnpm lint && pnpm test`: green. Vitest gives 824 passed and 2 skipped, against a baseline of 804 passed and 2 skipped (+20).
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 122 scénarios) » (was 118).
- `node tools/selfplay.mjs --games 200`: 200 finished, 0 failed.
- frameClock invariant (vitest): green.
- Playwright, both projects (phone and desktop):
  - cartes-speciales, tracer, cibles, partie, partie-complete, animations: 125 passed, 21 skipped, 0 failed;
  - clavier: 21 passed, 17 skipped, 0 failed.
  - Total: 146 passed, 38 skipped, 0 failed. The full suite was not run.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, in a test] Wrong assumption in a new G2 comparison test**
- **Found during:** Task 1 (RED)
- **Issue:** I first wrote that under G2, bleu0 at 68 with bleu1 home could not be brought home by a 7. That is wrong: within the same 7, bleu1 can move from slot 0 to slot 3, then bleu0 can enter slot 0.
- **Fix:** the test now asserts the real G2 behaviour. sevenMustEnter is [bleu0], [bleu0 4, bleu2 3] is refused, and [bleu1 3, bleu0 3, bleu2 1] is accepted.
- **Commit:** c9f5b0a

**2. [Rule 3 - Blocking] Formatting of one scenario title**
- **Issue:** the 2dd0caf commit left a scenario title line too long for Biome (the lint in that commit's command chain was not gating).
- **Fix:** the line was formatted in the next commit (a1644e7). The lint is green at the end.

Otherwise the plan was executed as written. Three scenarios were rewritten to the jump in the feat commit rather than in Task 2, so that every commit after the RED one keeps the scenario tests green.

## Known Stubs

None.

## Self-Check: PASSED

- Files: rules.ts, path.ts, the four new pictures, RULES.md, 01-UAT.md and 01-CONTEXT.md exist.
- Commits found in the history: 077a863, c9f5b0a, 2dd0caf, a1644e7, cb0cf17.
