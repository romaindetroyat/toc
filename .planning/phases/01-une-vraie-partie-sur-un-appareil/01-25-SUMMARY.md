---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 25
subsystem: engine-rules
tags: [engine, rules, home-entry, g14, scenarios, property-test, rules-md, gap-closure, uat-6]
status: complete

requires:
  - phase: 01-24
    provides: "phase 1 complete (UAT run by Romain); 01-UAT.md test 6 gap « Entrée dans la maison sans tour complet »"
provides:
  - "RuleSet switch ENTRY_WITHOUT_FULL_LAP (true, G14 of 2026-10-14) in packages/engine/src/rules.ts"
  - "walk() opens the home entry on any forward arrival on or crossing of the carré 16, lap done or not (private helper entryOpensAt in path.ts)"
  - "Scenarios R-02.3 and R-13.12 inverted; new R-08.7, R-13.16 to R-13.21 with their pictures"
  - "Property test: every pawnEnteredHome goes forward through the colour's ENTRY cell; counters seen.entries and seen.entriesWithoutLap"
  - "RULES.md G14 entry with Romain's words; RULE-15, PROJECT.md and 01-CONTEXT.md D-04 updated"
affects: [01-26, phase-01-uat]

requirements-completed: [RULE-15, RULE-08, RULE-09, RULE-10, RULE-20]

actuals:
  tokens: 7200
  tasks: 3
  commits: 3
plan_head_before: 1c130428ae08a38656f449bee5417c1d61ac1128
plan_head_after: 64b263bfe06daaa1747a4dc77eb5de31422f3d64

tech-stack:
  added: []
  patterns:
    - "A rule change by Romain after validation is a new numbered RuleSet switch (G14 and following), documented in RULES.md « Décisions de Romain » with his words, the old rule kept playable behind the switch"
    - "Property-test entry check follows each pawn's progress through the action's events, so a pawn moved twice by one 7 is tracked"

key-files:
  created:
    - docs/regles/R-08.7.webp
    - docs/regles/R-13.16.webp
    - docs/regles/R-13.17.webp
    - docs/regles/R-13.18.webp
    - docs/regles/R-13.19.webp
    - docs/regles/R-13.20.webp
    - docs/regles/R-13.21.webp
  modified:
    - packages/engine/src/rules.ts
    - packages/engine/src/path.ts
    - packages/engine/scenarios/prises-maison.ts
    - packages/engine/scenarios/table.ts
    - packages/engine/scenarios/cartes.ts
    - packages/engine/test/path.test.ts
    - packages/engine/test/flags.test.ts
    - packages/engine/test/props/invariants.test.ts
    - RULES.md
    - .planning/REQUIREMENTS.md
    - .planning/PROJECT.md
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-CONTEXT.md
    - docs/regles/R-02.3.webp
    - docs/regles/R-13.12.webp

key-decisions:
  - "G14 (Romain, 2026-10-14, UAT test 6): a knight that reaches or crosses its carré 16 moving forward enters its home at the exact count onto an empty slot, full lap or not; entry stays mandatory; never moving backward. Switch ENTRY_WITHOUT_FULL_LAP = true; false plays the rule of 2026-10-13"
  - "The entry decision stays in walk() only (entryOpensAt: ringIndex(color, q) === ENTRY[color] and (G14 or q >= 70)); legality, previews, the 7, bots and apply inherit it"

duration: 12min
completed: 2026-10-14
---

# Phase 1 Plan 25: Entrer dans la maison sans avoir fait le tour complet (G14) Summary

**Home entry without the full lap: walk() now opens the entry at every forward arrival on or crossing of the carré 16 (switch ENTRY_WITHOUT_FULL_LAP, G14), so a knight that backed with the 4 enters at the exact count; 9 scenarios and pictures, path/flags/property tests and RULES.md, RULE-15, PROJECT.md and CONTEXT.md record Romain's decision.**

## Performance

- **Duration:** about 12 min
- **Completed:** 2026-10-14
- **Tasks:** 3/3
- **Files modified:** 21 (12 text files, 9 pictures)

## Accomplishments

- `ENTRY_WITHOUT_FULL_LAP: boolean = true` in rules.ts (constant, RuleSet field, DEFAULT_RULES entry, G14 doc comment, header numbering sentence).
- path.ts: private `entryOpensAt(color, q, rules)` replaces the `q >= 70 && (q - 70) mod 72 = 0` test in the forward branch of walk(); everything else (exact count, occupied target, G2, ring stretch, home path) is unchanged. Backward walks never reach that branch, so the 4 still never enters.
- From −4: 2 → ring −2; 3/4/5/6 → home slots 0/1/2/3 (path for 3: ring 69, ring 70, home 0); 7 → ring 3; 10 → ring 6; home knight in slot 0 + 5 → ring 1 (G2 continue) or `home-blocked` (G2 illegal); the 4 → −8. Backing 4 from progress 2 → ring −2. With the switch off, −2 playing 3 → ring 1.
- Scenarios: R-02.3 and R-13.12 now enter home slot 2; new R-08.7, R-13.16 (5-action script: back 4, then 3 enters slot 0), R-13.17, R-13.18, R-13.19, R-13.20 (7 split 4+3, bleu0 into slot 1), R-13.21 (Valet places bleu0 at 69, then 3 enters slot 1).
- Property test (200 games, seed 20261015 unchanged): every entry from the ring goes forward, by consecutive cells, through the colour's ENTRY cell. Recorded values: **seen.entries = 2751, seen.entriesWithoutLap = 178** (entries that crossed the carré 16 below progress 70, which the rule of 2026-10-13 refused).
- RULES.md: R-02, R-08, R-09 (G1 note), R-13 rule texts and edge cases, vocabulary (Carré 16, Progression), header (Statut, Date 2026-10-14), « Décisions de Romain » G14 entry with Romain's words, D-04 line in « Décidé ». REQUIREMENTS.md RULE-15 wording (still [x], Complete) and footer; PROJECT.md rule decision and Entrée bullet; 01-CONTEXT.md D-04 revision sub-bullet (original kept).

## Task Commits

1. **Task 1 (tracer): G14 switch, walk(), R-02.3/R-13.12 inverted, path tests, RULES.md rule texts** - `baab359` (feat)
2. **Task 2: edge cases as scenarios and tests (R-08.7, R-13.16 to R-13.21, flags, property test, RULES.md edge cases)** - `1a1701b` (test)
3. **Task 3: G14 in RULES.md « Décisions de Romain », RULE-15, PROJECT.md, CONTEXT.md; pictures redrawn** - `64b263b` (docs)

Tracer gate: the Task 1 `<verify>` (engine vitest + rules-trace, 103 scenarios) was green before expanding; all its acceptance commands exited 0.

## Verification

- `pnpm exec vitest run packages/engine`: 10 files, all passed (2 skipped are the pre-existing "alt" scenarios R-09.9 and R-15.9).
- `node tools/render-scenarios.mjs`: 110 images; only R-02.3 and R-13.12 changed, the 7 new ones added.
- `node tools/rules-trace.mjs --images`: `rules-trace: OK (16 règles, 110 scénarios)`.
- `pnpm typecheck && pnpm lint && pnpm test`: exit 0; 34 files, 645 passed, 2 skipped.
- `pnpm --filter @toc/web exec playwright test e2e/partie-complete.spec.ts e2e/cartes-speciales.spec.ts --project=desktop`: 13 passed.
- Plan acceptance one-liners (−4 + 5S → home slot 2; −2 + 3S with the switch off → ring 1), `grep -c ENTRY_WITHOUT_FULL_LAP rules.ts` = 3, `grep -c G14 RULES.md` = 8 or more, the Task 3 greps and file tests: all pass.
- Pictures checked by eye: R-13.12 (right half: blue A in home slot 2) and R-13.21 (right half: blue A in home slot 1, yellow A at its new place).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] entriesWithoutLap counts the entries that really need G14**
- **Found during:** Task 2
- **Issue:** The plan defines the counter as "entries whose knight had a progress below 70 in `before`". Nearly every entry fits that (a knight at 66 playing 5 enters under the old rule too), so the "> 0" assertion would prove nothing about G14.
- **Fix:** The counter counts entries whose crossing progress (progress at the start of the micro-move + ring cells of the path) is below 70, which only G14 allows. Also added `seen.entries >= GAMES * 8` and a check that the ring cells of an entering path are consecutive forward cells. Progress is followed through the action's events (pawnMoved, pawnSentHome), so a 7 that moves the same knight twice is checked correctly.
- **Files modified:** packages/engine/test/props/invariants.test.ts
- **Commit:** 1a1701b

**2. [Rule 2 - Missing test] Two must-have truths had no test in the task actions**
- **Found during:** Task 2
- **Issue:** The truths "from −4 the 4 still goes backward to −8" and "with cards: the 3, 5 and 6" were not covered by any listed test.
- **Fix:** path.test.ts case "the 4 from -4 still goes backward, to -8"; flags.test.ts case with the 3S, 6S and 4S from −4 (home slot 0, home slot 3, ring −8).
- **Files modified:** packages/engine/test/path.test.ts, packages/engine/test/flags.test.ts
- **Commit:** 1a1701b

**3. [Rule 3 - Blocking] Biome formatting of the R-13.12 title**
- **Found during:** Task 1 (right after committing)
- **Issue:** The longer R-13.12 title went over Biome's line width, so `pnpm lint` would fail.
- **Fix:** `biome format --write` on prises-maison.ts, folded into the Task 1 commit with `--amend` before any other work (the commit was local and not pushed).
- **Commit:** baab359

**4. Small editorial additions**
- R-13.19 has flags `["G2", "G14"]` instead of `["G14"]`: it depends on HOME_JUMP_BLOCKED too. Flags are labels; only "alt" changes how tests run.
- RULES.md « Décisions de Romain »: the plan puts the G14 entry right after the intro paragraph, which puts it before G1. I added the line « Les points validés le 2026-10-13 : » before G1 so the two groups read apart.

## Known Stubs

None.

## Threat Flags

None. The change stays inside walk() (T-01-34 mitigated: one movement path, plus the new forward-through-ENTRY property check). No package added (T-01-SC).

## Human Check Pending (backstop)

Romain re-reads RULES.md R-02, R-08, R-09, R-13 and the G14 entry of « Décisions de Romain », and looks at docs/regles/R-02.3.webp, R-08.7.webp, R-13.12.webp and R-13.16.webp to R-13.21.webp, to confirm they say what he decided on 2026-10-14.

## Self-Check: PASSED

- All 7 new pictures and the 14 modified files exist on disk.
- Commits baab359, 1a1701b, 64b263b are ancestors of HEAD.
