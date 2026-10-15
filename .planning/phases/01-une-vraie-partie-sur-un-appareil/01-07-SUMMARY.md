---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 07
subsystem: rules
tags: [rules, validation, constants, cards, licence]

requires:
  - phase: 01-05
    provides: "RULES.md complete with « Points à valider » G1-G13, Q7, Q22; 103 scenario fixtures and pictures"
provides:
  - "RULES.md validated by Romain on 2026-10-13: header « Validé par Romain le 2026-10-13 », section « Décisions de Romain » with the retained value of every point"
  - "packages/engine/src/rules.ts: one named, documented constant per validated point, exported from the engine index"
  - "assets/cartes/CHOIX.md: card figures come from svg-cards 4.0.2 (LGPL-2.1), D-24"
affects: [01-10, 01-12, 01-13, 01-14, 01-20]

requirements-completed: [RULE-20]

actuals:
  tokens: 9000
  tasks: 3
  commits: 2
plan_head_before: a9a7693e9caef0d16d4d88f8165171ab0e343b4a
plan_head_after: see git log (docs commit follows cb22260)

tech-stack:
  added: []
  patterns:
    - "Every rule choice is a typed constant in rules.ts citing its G-number, its RULES.md section and the validation date; the engine never hard-codes a choice"

key-files:
  created:
    - packages/engine/src/rules.ts
    - assets/cartes/CHOIX.md
  modified:
    - RULES.md
    - packages/engine/src/index.ts

key-decisions:
  - "Every point (G1-G13, Q7, Q22) takes its default value: no correction from Romain"
  - "Constants follow the RULES.md numbering (G11 = ordinary cards pass over pawns, G12 = 7 continues with the partner, G13 = empty hand skipped), not the plan's older numbering where G11 was the 7 case"
  - "Card figures: svg-cards 4.0.2 under LGPL-2.1, integrated at plan 01-20"

duration: 15min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 07: Romain valide les règles (et choisit les figures des cartes) Summary

**RULES.md is validated as written (all defaults), frozen as 16 named constants in `packages/engine/src/rules.ts`, and the card figures are chosen: svg-cards 4.0.2 (LGPL-2.1).**

## Validation des règles

Option id: **valider**. Romain's words, verbatim, in order:

- After seeing RULES.md, the « Points à valider » table (G1 to G13, Q7, Q22 with defaults and alternatives) and the pictures R-09.8, R-09.9, R-13.7 and R-10.13: « Une fois ça corrigé, c'est bon, tu peux continuer » (the « ça » was an unrelated display bug of the top-row knights, now fixed).
- Asked to confirm « Ton "c'est bon, tu peux continuer" vaut-il validation de RULES.md avec tous les choix par défaut (G1 à G13, Q7, Q22) ? », he chose: « Oui, valider tel quel ».

So every « à valider » point takes its default value. No correction. The scenarios flagged « alt » (R-09.9 for G1, R-15.9 for G12) stay as alternatives that are not implemented; fixtures and pictures are unchanged because no expectation moved.

Retained values (constants in `packages/engine/src/rules.ts`):

| Point | Constant | Value |
|---|---|---|
| G1 | `SWAP_PROGRESS` | `'position'` |
| G2 | `HOME_JUMP_BLOCKED` | `'continue'` |
| G3 | `PROTECTED_AFTER_EXTRA_LAP` | `true` |
| G4 | `PROTECTED_BLOCKS_OWNER` | `true` |
| G5 | `SEVEN_SAME_PAWN_TWICE` | `true` |
| G6 | `SWAP_OWN_PROTECTED` | `false` |
| G7 | `FINISHED_PARTNER_PAWNS_ARE_OWN` | `true` |
| G8 | `EXCHANGE_SIMULTANEOUS` | `true` |
| G9 | `DEALER_ROTATION` / `FIRST_PLAYER` | `'perCycle'` / `'afterDealer'` |
| G10 | `ONLY_OWN_PAWNS_MOVE` | `true` |
| G11 | `ORDINARY_CARDS_PASS_OVER_PAWNS` | `true` |
| G12 | `SEVEN_CONTINUES_WITH_PARTNER` | `true` |
| G13 | `EMPTY_HAND_SKIPPED` | `true` |
| Q7 | `EXCHANGE_KEEPS_HAND_SIZE` | `true` |
| Q22 | `PAUSE_IN_ALL_PHASES` | `true` |

## Figures des cartes

Option id: **svg-cards** (Romain chose « svg-cards (Recommandé) »). The orchestrator verified on the npm registry: svg-cards@4.0.2, licence LGPL-2.1, repository git+https://github.com/htdebeer/SVG-cards.git, maintainers htdebeer and desphilboy, created 2018-03-08, no install or postinstall scripts (only a dummy « test » script). Recorded in `assets/cartes/CHOIX.md` with the licence obligations (credit, licence text, replaceable separate files). The package is NOT installed in this plan; integration is plan 01-20.

## Performance

- **Duration:** about 15 min
- **Tasks:** 3 (Tasks 1 and 2 were decisions already resolved by Romain; Task 3 applied them)
- **Files modified:** 4

## Accomplishments

- RULES.md: status « Validé par Romain le 2026-10-13 », « Points à valider » renamed « Décisions de Romain » with the retained value of each point, every « à valider » marker removed from the rule sections.
- `rules.ts` exports the 16 constants, each documented with its G-number, RULES.md section and validation date; re-exported from `packages/engine/src/index.ts`.
- Card-face source recorded for plan 01-20.

## Task Commits

1. **Task 1 and Task 2 (checkpoint:decision)** — no commit, resolved by Romain (see above).
2. **Task 3: apply the decisions** — `cb22260` (feat)

**Plan metadata:** the docs commit of this SUMMARY follows.

## Verification

- `node tools/rules-trace.mjs --images`: `rules-trace: OK (16 règles, 103 scénarios)`
- `pnpm --filter @toc/engine typecheck`: pass
- `pnpm lint` (biome check): pass; `pnpm test`: 114 tests pass
- `! grep -q "à valider" RULES.md`, `grep -q "Validé par Romain le" RULES.md`, `test -f assets/cartes/CHOIX.md`: pass
- `import('./packages/engine/src/rules.ts')` under Node: `EXCHANGE_SIMULTANEOUS === true`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Constants numbering aligned on RULES.md, three constants added**
- **Found during:** Task 3
- **Issue:** The plan lists G1 to G11 with G11 = the 7 that continues with the partner, but RULES.md (since plans 01-03 and 01-05) numbers it G12 and uses G11 for « ordinary cards pass over pawns » and G13 for « empty hand skipped ». Q7 and Q22 are also validated points.
- **Fix:** Constants cite the RULES.md numbering; added `ORDINARY_CARDS_PASS_OVER_PAWNS` (G11), `EMPTY_HAND_SKIPPED` (G13), `EXCHANGE_KEEPS_HAND_SIZE` (Q7) and `PAUSE_IN_ALL_PHASES` (Q22) next to the ones the plan names. `SEVEN_CONTINUES_WITH_PARTNER` is G12.
- **Files modified:** packages/engine/src/rules.ts
- **Commit:** cb22260

No fixture or picture was changed: all defaults were validated, so no expectation moved and `node tools/render-scenarios.mjs` was not re-run. The plan's files_modified list for scenarios and docs/regles is therefore not touched.

## Known Stubs

None.

## Issues Encountered

None.

## Next Phase Readiness

The engine plans (01-10, 01-12, 01-13, 01-14) can start: the rules are validated and frozen. Plan 01-20 can integrate svg-cards@4.0.2 (no precondition on user-supplied files, since option `svg-cards` was chosen).

## Self-Check: PASSED

- FOUND: RULES.md, packages/engine/src/rules.ts, assets/cartes/CHOIX.md
- FOUND: commit cb22260
