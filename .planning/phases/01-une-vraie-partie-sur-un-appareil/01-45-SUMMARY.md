---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 45
subsystem: web-turn-ui
status: complete
tags: [turn-ui, reducer, keyboard, seven, gap-closure, uat-27, recette-3, d-19]
requires:
  - "01-44 (the Recette 3 addendum opened in 01-UI-SPEC.md)"
provides:
  - "apps/web/src/game/turnUi.ts: preview and sevenBuilding states carry an optional auto: true; one movement candidate (after the As/Roi question, or after « Avancer ») opens that knight's preview; a 7 with a single split (sevenPlans(view, seat, card, 2)) opens filled; back/undoLast from an automatic step put the card down (or go back to the As/Roi question)"
  - "apps/web/e2e/jouer.ts: chooseKnight(page, onLit?), the knight of a simple card whether it is lit among several or chosen by itself"
  - "01-UI-SPEC.md: copy row « Only one pawn can play » emptied, Turn flow point 3, addendum « Recette 3 » subsection « Un seul cheval pour la carte »"
affects: ["01-54 (UAT re-test entry: Romain confirms the lone-knight reading)"]
tech-stack:
  added: []
  patterns:
    - "An automatic step is a normal reducer state flagged auto; only confirm, give and pose ever submit"
    - "One step back from an automatic state skips the choice that was never offered"
key-files:
  created: []
  modified:
    - apps/web/src/game/turnUi.ts
    - apps/web/src/game/turnUi.test.ts
    - apps/web/src/game/shortcuts.test.ts
    - apps/web/src/ui/ActionZone.svelte
    - apps/web/src/i18n/fr/game.ts
    - apps/web/e2e/tracer.spec.ts
    - apps/web/e2e/cartes-speciales.spec.ts
    - apps/web/e2e/clavier.spec.ts
    - apps/web/e2e/compact.spec.ts
    - apps/web/e2e/ecrans.spec.ts
    - apps/web/e2e/finition.spec.ts
    - apps/web/e2e/jouer.ts
    - apps/web/e2e/partie.spec.ts
    - apps/web/e2e/tourne.spec.ts
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md
decisions:
  - "« Only one knight » is counted per card (one movement candidate), not per board: a card that only one of several knights can play also skips the tap. Written as part of the reading « à confirmer par Romain »"
  - "In an automatic preview the knight wears the chosen-knight mark (data-selected), not a halo, as in any preview; for an exit the other stable knights stay lit"
  - "The filled 7 shows the panel's existing « Tout est réparti. » (data-remaining 0); « Retirer le dernier pas », Échap and « Tout annuler » put the card down, since its split is the only one"
  - "Tapping the lone knight again in its automatic preview keeps the preview automatic, so Échap never lands on a cardSelected that would reopen the same preview"
metrics:
  duration: "35 min"
  completed: 2026-10-15
  tasks: 2
  files: 15
estimate:
  tokens: 55000
  tasks: 2
actuals:
  tokens: 18300
  tasks: 2
  commits: 2
plan_head_before: 3bfd34ec2bdb558959fc4d1c26916695f4efcbc8
plan_head_after: 938c07e9edd4d4a951d11fd6be2b7db6b5fe7941
---

# Phase 1 Plan 45: Un seul cheval pour la carte : directement l'aperçu et « Jouer » Summary

**A card that only one knight can play now opens that knight's preview as soon as it is tapped: path, ghost, captures, the sentence, and « Jouer ». The same goes for the As or Roi after « Avancer » with one knight on the ring, and for a 7 with a single split, whose assistant opens already filled. The Valet still asks for both knights, and the As/Roi question is still asked when both moves are possible. Nothing is ever played without « Jouer » (D-19). Romain asked for this in his own words: « inutile de cliquer dessus pour jouer la carte, sauf valet évidemment ».**

## What was built

### Task 1 (tracer), cf667ff: the card goes straight to the preview

- turnUi.ts:
  - the preview state gains `auto?: true`;
  - `selectCard`, after the As/Roi question, goes through `litOrAuto`: one movement candidate gives `previewState(…, auto = true)`, and several give `cardSelected` as before;
  - in `back()`, an automatic preview returns the As/Roi question when it applies, otherwise IDLE;
  - in `stepFor`, a tap on the knight in an automatic preview keeps the flag;
  - the header quotes Romain and D-19.
- ActionZone.svelte: the `cardSelected` prompt is always `game.turn.chooseHorse`. The `singleHorse` key and its sentence « … touche-le. » are deleted from game.ts.
- turnUi.test.ts: new describe « un seul cheval pour la carte (recette 3, test 27) ». It covers:
  - the automatic preview with no submit;
  - confirm as the only event that submits;
  - back, changeCard, cancel, escape and a second card tap all return idle;
  - a repeat knight tap keeps the preview automatic;
  - two knights still give `cardSelected`;
  - an As that can only exit previews the exit.
  
  RED: 4 failed before the change.
- tracer.spec.ts: the Dame is played with card then « Jouer ». After the card tap the spec checks the description, the chosen-knight mark (centred on the knight, like the hit target) and the path. The keyboard tracer plays « 1 » then Entrée.
- Tracer gate: `vitest run apps/web/src/game` 252 passed, typecheck and lint clean, the grep for « touche-le » finds nothing, and every spec touched by the change passes on both projects (180 passed, 54 skipped). The gate passed, so the plan went on.

### Task 2, 938c07e: As/Roi after « Avancer », the single-split 7, the keyboard, the UI contract

- turnUi.ts:
  - `chooseMode("advance")` goes through `litOrAuto`, and back from that automatic preview returns to the question;
  - `singleSplit` runs `sevenPlans(ctx.view, ctx.seat, card, 2)`. When it returns exactly one plan, the 7 opens as `sevenBuilding` with that plan normalised, `remaining` 0, its preview and `auto: true`;
  - `back` and `undoLast` on that 7 return IDLE;
  - the Valet branch is untouched.
- Tests (RED: 3 failed before the change):
  - the As with an exit and one advancing knight: modeChoice, then the automatic preview, then back to modeChoice;
  - the filled 7: its plan and preview, confirm submits `seven`, and back, undoLast and cancelAll give idle;
  - a 7 filled through G12 (bleu0 3, then rouge0 4);
  - a 7 with two knights opens empty;
  - a Valet with one knight and one target gives jackPick.
- cartes-speciales.spec.ts:
  - the Roi asks the question, then « Avancer de 13 » previews at once;
  - the Valet asserts jackPick, then jackTarget;
  - new case: a lone-knight 7 opens on « Tout est réparti. » (`data-remaining` 0) with one row, a path and a ghost. Nothing moves in 1 s. « Tout annuler » gives the card back, and « Jouer » plays it to ring:17.
- clavier.spec.ts:
  - « 1 » then Entrée plays a lone knight's Dame;
  - a new two-knight Dame test plays « 1 », « b », Entrée;
  - Échap from the automatic preview puts the card down, and after « Avancer » it goes back to the question;
  - the « Jouer » / Entrée case of « chaque touche affichée » needs « 1 » only;
  - QUEEN_HAND now has two knights, so the letter and hint cases keep two lit knights.
- 01-UI-SPEC.md:
  - the copy row is now « (aucune consigne : le cheval est choisi et l’aperçu s’affiche, recette 3) »;
  - Turn flow point 3 gains the single-candidate rule (including the single 7 split) and « Jouer » still confirming;
  - the new subsection « Un seul cheval pour la carte » gives Romain's words, the reading « à confirmer par Romain », the cases (ordinary card, As/Roi, Valet, 7, Échap/Annuler/Changer de carte, keyboard) and the technical facts.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green. Vitest: **787 passed, 2 skipped** (37 files). The baseline was 771; this plan adds 16 cases in turnUi.test.ts and shortcuts.test.ts.
- `node tools/rules-trace.mjs`: « rules-trace: OK (16 règles, 118 scénarios) ».
- frameClock invariant: no `.animate(` in apps/web/src/board outside frameClock.ts.
- Playwright, full suite: **338 passed, 84 skipped, 0 failed** (422 tests, 5.8 min). The baseline was 335 passed and 83 skipped. This plan adds the lone-knight 7 test on both projects and the two-knight keyboard Dame, which the phone project skips.
- Acceptance greps: `auto: true` in turnUi.ts, `sevenPlans` in turnUi.ts and « Un seul cheval pour la carte » in 01-UI-SPEC.md are all found. No « touche-le » is left in apps/web/src or apps/web/e2e.
- D-19 (T-01-71): turnUi.test.ts checks that tapCard, chooseAdvance, the filled 7, back and the repeat knight tap never submit. Only confirm submits.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Specs and unit tests outside the plan's file list encoded the knight tap**
- **Found during:** Task 1 (the full Playwright run gave 40 failures) and Task 2.
- **Issue:** several screen specs played a lone knight's card by expecting a halo, then tapping the knight, or by expecting `cardSelected`. An automatic preview shows the chosen-knight mark (`data-selected`), not a halo. The affected files were compact, ecrans, finition, partie, tourne, the `playSimpleMove` helper in jouer.ts (also used by reglages.spec) and shortcuts.test.ts.
- **Fix:**
  - specs that check the lone-knight flow now expect the mark and drop the useless tap;
  - specs that check the layout or the Tab order of a selected card now use two-knight positions, so `cardSelected` keeps its coverage (finition HAND, compact/ecrans POSITIONS.as, clavier QUEEN_HAND, the shortcuts QUEENS fixture);
  - jouer.ts gains `chooseKnight`, which handles both cases.
- **Files modified:** apps/web/e2e/{compact,ecrans,finition,partie,tourne}.spec.ts, apps/web/e2e/jouer.ts, apps/web/src/game/shortcuts.test.ts.
- **Commits:** cf667ff, 938c07e.

**2. [Rule 3 - Blocking] Two Task 2 specs were also touched in Task 1, to keep each commit green**
- **Issue:** Task 1 changes the As that can only exit, and it deletes the sentence that the Roi spec of cartes-speciales asserted. The plan's single-knight Dame keyboard test in clavier also broke.
- **Fix:** Task 1 updated those three cases. Task 2 then rewrote the Roi case to the automatic preview.

**3. [Rule 1 - Coverage] Unit 7 fixtures that had become single-split**
- **Issue:** the 7 refusal test (« refuses a number of steps… ») and the G12 test, plus their twin in cartes-speciales, used bleu0 at 68 with a single rouge knight. That position has exactly one split, so the 7 now fills itself and the refusal could no longer be reached.
- **Fix:** those tests now have a second rouge knight, so several splits exist and they still check the refusal and the G12 hand-over. A new unit case checks that the old single-rouge position fills itself through G12.

## Known Stubs

None.

## Threat Flags

None. The change stays inside the client reducer, and no action path was added. T-01-71 is mitigated as planned.

## Notes for Romain (recette 01-54)

- The rule is read per card: « un seul cheval peut jouer cette carte ». A card that only one of your knights can play goes straight to « Jouer », even with other knights on the board. This is the planner's reading, still « à confirmer ».
- The 7 filled by itself shows « Tout est réparti. ». « Retirer le dernier pas » then puts the card down instead of emptying the assistant, because there is no other split to build.
- In the preview, the lone knight wears the « chosen » mark rather than the pulsing halo. For an exit, the other stable knights stay lit.

## Self-Check: PASSED

- FOUND: apps/web/src/game/turnUi.ts, apps/web/src/game/turnUi.test.ts, apps/web/e2e/jouer.ts, .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md
- FOUND: cf667ff, 938c07e (ancestors of HEAD)
