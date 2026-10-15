---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 43
subsystem: rules-docs
status: complete
tags: [rules, g16, seven, home-entry, gap-closure, uat-26, rules-trace]
requires:
  - "01-42 (G16 in the engine: KNIGHT_MUST_ENTER, sevenMustEnter, \"must-enter\")"
provides:
  - "packages/engine/scenarios/prises-maison.ts: scenarios R-13.22 to R-13.27 (flags G16, plus seven and G5 where they apply)"
  - "RULES.md: G16 in R-13 (rule, edge cases, six scenarios with pictures), a pointer in R-10, the dated G16 entry in « Décisions de Romain », D-02 pointing to G16, header dated 2026-10-15"
  - "docs/regles/R-13.22.webp to R-13.27.webp (1200 × 1200)"
  - ".planning/REQUIREMENTS.md: RULE-15 carries G16 for the 7"
affects: ["01-54 (UAT re-test entry: Romain confirms the 7 reading of G16)"]
tech-stack:
  added: []
  patterns:
    - "A rule change lands as data scenarios run against the engine, listed in RULES.md and drawn by render-scenarios; earlier pictures stay byte-identical"
key-files:
  created:
    - docs/regles/R-13.22.webp
    - docs/regles/R-13.23.webp
    - docs/regles/R-13.24.webp
    - docs/regles/R-13.25.webp
    - docs/regles/R-13.26.webp
    - docs/regles/R-13.27.webp
  modified:
    - packages/engine/scenarios/prises-maison.ts
    - RULES.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/deferred-items.md
decisions:
  - "The 7 reading of G16 (enters or does not move, may stop on its carré 16 and enter later, never makes the 7 unplayable) is written as « À confirmer par Romain » in the G16 entry and as « lecture à confirmer par Romain » in R-13, never as his words"
  - "Romain's words keep the document's typographic apostrophes (’); the words themselves are those of 01-CONTEXT.md"
metrics:
  duration: "25 min"
  completed: 2026-10-15
  tasks: 2
  files: 10
estimate:
  tokens: 45000
  tasks: 2
actuals:
  tokens: 2600
  tasks: 2
  commits: 2
plan_head_before: 50cbecf062b6fbea8c9d2d6738f185be79e0de78
plan_head_after: 461baf116cdcb70412ad0ab518ea91ae7649f252
---

# Phase 1 Plan 43: Règle G16 dans RULES.md, ses scénarios et leurs images Summary

**G16 is now written where Romain reads the rules. RULES.md R-13 states it card by card, and the « Décisions de Romain » entry quotes his remark, « Seulement pour ce cheval », « Oui, autorisé » with its option text, and « Oui, on garde ». The 7 reading is labelled « à confirmer par Romain ». Six scenarios, R-13.22 to R-13.27, run against the engine unchanged and pass, and are drawn on the galet. rules-trace now counts 16 règles and 118 scénarios.**

## What was built

### Task 1 (tracer), 70eba46: six G16 scenarios run against the engine
Six fixtures appended to prises-maison.ts, rule R-13, turn bleu:

| Scenario | Position and hand | What it pins |
|----------|-------------------|--------------|
| R-13.22 | bleu0 at 70, 2S + 9S | the 2 (enters) and the 9 (goes round) are both legal on bleu0: Romain's example, « Oui, autorisé » |
| R-13.23 | bleu0 68, bleu1 10, 7S | refused: [bleu0 7] (passes) and [bleu0 2, bleu1 5] (stops short); allowed: [bleu0 3, bleu1 4] (enters) and [bleu1 7] (does not move) |
| R-13.24 | same, 7S | [bleu0 2, bleu1 1, bleu0 4] is legal and ends with bleu0 in home slot 3, bleu1 at 11 |
| R-13.25 | bleu0 at 70, 2S + 4S | the 4 still moves it back to 66 |
| R-13.26 | bleu0 alone at 70, 7S | [bleu0 7] is legal and goes round to 77 |
| R-13.27 | bleu0 at 70, bleu1 in home slot 1, 2S + 5S | the 2 and the 5 on bleu0 are both legal (the target slot is taken) |

- All six passed against the engine at the first run: no engine bug to report to 01-42, no fixture bent.
- R-13 « Scénarios » lists the six with their picture lines.
- Tracer gate: `scenarios.test.ts` 116 passed, 2 skipped; `node tools/rules-trace.mjs` printed « rules-trace: OK (16 règles, 118 scénarios) »; lint clean. The gate passed, so the plan went on.

### Task 2, 461baf1: the written rule, Romain's words, RULE-15 and the pictures
- RULES.md header: status « … puis précisées le 2026-10-15 (G16) », date 2026-10-15, and the intro says the 7 reading is à confirmer par Romain.
- R-13 « Règle »: the G16 paragraph, judged card by card (ordinary card = D-02, another card stays free; the 7 brings the knight home or leaves it, may stop on its carré 16, « lecture à confirmer par Romain »; the 4 and the Valet are not concerned).
- R-13 « Cas limites »: one bullet per scenario (R-13.22 to R-13.27) and the bullet « G16 ne rend jamais le 7 injouable ».
- « Décisions de Romain », after G15: « G16 — La carte qui peut faire rentrer un cheval le fait rentrer (décision du 2026-10-15) », with his remark verbatim, « Seulement pour ce cheval », the question about the 2 and the 9, « Oui, autorisé » and the option text, « Oui, on garde », the one-sentence diagnosis, « Retenu », « À confirmer par Romain » (the 7, including the case where two knights need the same slot), and « Précise D-02. Constante KNIGHT_MUST_ENTER. Touche R-13 (et un renvoi en R-10) ; scénarios R-13.22 à R-13.27. »
- « Décidé »: D-02 ends « (R-13 ; précisé par G16 le 2026-10-15) ». G1 to G15 are untouched.
- REQUIREMENTS.md RULE-15 gains « ; avec le 7, un pion qu'un partage du 7 peut faire entrer dans une case vide n'est bougé que pour y entrer (décision G16 du 2026-10-15) ». Checkbox and traceability row unchanged.
- `node tools/render-scenarios.mjs`: « 118 images dans docs/regles/ »; exactly six new files, `git diff --exit-code -- docs/regles` clean, so the 112 earlier pictures are byte-identical. All six are 1200 × 1200.

### What the pictures show
- **R-13.22** (no `after`, drawn « avant » / « le coup »): bleu A on its carré 16, ringed in green in the lower half. Both allowed moves (the 2 and the 9) are on the same knight, so the picture shows one green ring; the caption and the text say which cards.
- **R-13.23**: bleu A two cells before its carré 16, bleu B on cell 10; in « le coup » both A and B are ringed in green. There is **no red ring**: the renderer draws one halo per pawn and an allowed move wins over a refused one on the same pawn, and every knight of the refused plans also moves in an allowed plan. The picture is readable but does not show the refusals; the R-13 text does. Logged in deferred-items.md (changing the renderer could alter the 112 earlier pictures).
- R-13.24 (checked too): « après » shows bleu A in the last home slot and bleu B one cell further.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green, vitest **769 passed, 2 skipped** (37 files; baseline 763 + the 6 scenarios).
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 118 scénarios) ».
- `ls docs/regles/*.webp | wc -l` = 118; earlier pictures unchanged.
- Acceptance greps: 6 fixture ids, 6 list lines, the G16 title, « Seulement pour ce cheval », « Oui, autorisé », « à confirmer par Romain », KNIGHT_MUST_ENTER; G16 in REQUIREMENTS.md.
- frameClock invariant: no `.animate(` in apps/web/src/board outside frameClock.ts.
- Playwright, full suite (the plan names none; run because the debug route of the app imports the scenario set): **333 passed, 83 skipped, 0 failed** (5.7 min), same as the baseline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Correctness] R-10 pointer to G16**
- **Found during:** Task 2
- **Issue:** R-10 « Le 7 » says the 7 is split « comme le joueur veut ». Since 01-42, a 7 that can bring a knight home cannot send it past; RULES.md must say what the engine does (T-01-69).
- **Fix:** one bullet in R-10 « Cas limites »: « Si un partage du 7 peut faire rentrer un cheval, le 7 fait rentrer ce cheval ou ne le bouge pas (G16, voir R-13). » The R-10 rule sentence itself is unchanged. The G16 entry says « Touche R-13 (et un renvoi en R-10) ».
- **Commit:** 461baf1

**2. [Wording] Small differences from the plan's literal strings**
- D-02 reads « (R-13 ; précisé par G16 le 2026-10-15) » instead of a second parenthesis after « (R-13) ».
- RULE-15's appended text uses the straight apostrophe of REQUIREMENTS.md (« qu'un », « n'est »), not the typographic one of the plan.
- The 7 case in R-13 is labelled « lecture à confirmer par Romain » (lowercase, matching the acceptance grep), and in the G16 entry « À confirmer par Romain : » as the plan asks.

**3. [Picture] R-13.23 shows no red ring** — see « What the pictures show »; renderer limitation logged in deferred-items.md, not fixed (prohibition on changing earlier pictures).

## Notes for Romain (re-test 01-54)
- Re-read R-13, the G16 entry and pictures R-13.22 to R-13.27. The one point to confirm: with the 7, the knight that a split can bring home either enters or does not move; it may pause on its carré 16 and enter with a later step of the same 7; and if no split can respect this (two knights needing the same slot), the 7 plays as before.

## Self-Check: PASSED

- Files exist: the six pictures R-13.22 to R-13.27, prises-maison.ts with R-13.27, RULES.md with G16.
- Commits 70eba46 and 461baf1 are ancestors of HEAD; `git rev-list --count 50cbecf..461baf1` = 2.
