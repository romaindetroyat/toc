---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 33
subsystem: board
status: complete
tags: [board, plateau-galet, riders, licences, rules-pictures, ui-spec, context, gap-closure]
requires:
  - "01-32 (both galet plateaus in packages/board, rider image shapes from riderBox, artSvg images option, BoardArt drawing layer)"
provides:
  - "apps/web/src/assets/plateau/cav-{bleu,jaune,rouge,vert}.png (Romain's riders, byte for byte from design/assets)"
  - "BoardArt draws the rider shapes as SVG images (data-rider, opacity 0.85, aria-hidden, pointer-events none)"
  - "LICENSES.md row plateau-cavaliers; credits sheet at 17 entries, two in « Plateau »"
  - "e2e « les cavaliers de Romain aux quatre coins » (portrait on both projects, landscape on desktop)"
  - "tools/render-scenarios.mjs on the LANDSCAPE galet, avant above après, 1200 x 1200; docs/regles/*.webp regenerated (112)"
  - "01-UI-SPEC.md « Addendum 2026-10-14 — Plateau galet » (with the paysage obligatoire decision); 01-CONTEXT.md galet notes under D-05, D-07, D-08"
affects: ["01-34", "01-35", "01-36", "01-37", "01-38", "01-39"]
tech-stack:
  added: []
  patterns:
    - "Rider pictures are Vite asset imports, one href per colour, mapped in BoardArt; the renderer inlines them as data URIs"
key-files:
  created:
    - apps/web/src/assets/plateau/cav-bleu.png
    - apps/web/src/assets/plateau/cav-jaune.png
    - apps/web/src/assets/plateau/cav-rouge.png
    - apps/web/src/assets/plateau/cav-vert.png
  modified:
    - apps/web/src/board/BoardArt.svelte
    - assets/audio/LICENSES.md
    - apps/web/src/i18n/fr/credits.ts
    - apps/web/e2e/board.spec.ts
    - apps/web/e2e/sons.spec.ts
    - apps/web/e2e/tracer.spec.ts
    - tools/render-scenarios.mjs
    - RULES.md
    - docs/regles/ (112 webp)
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-CONTEXT.md
decisions:
  - "Romain, 2026-10-14 (mid-plan): « Pour la version iphone, oblige à jouer en format paysage, ça permettra d'utiliser le même plateau », then « Oui, paysage obligatoire »: one plateau, the landscape galet, on computers and phones"
  - "Rule pictures on the landscape galet, avant above après, 1200 x 1200 (two 1200 x 600 halves)"
  - "In portrait the phone shows « Tourne ton téléphone » instead of the board (Safari cannot lock orientation); recorded as derived, à confirmer par Romain"
metrics:
  duration: "25 min"
  completed: 2026-10-14
  tasks: 3
  files: 15
estimate:
  tokens: 70000
  tasks: 3
actuals:
  tokens: 12400
  tasks: 3
  commits: 3
plan_head_before: 492fc5b718e9f1064b3111578a490ea48fbef172
plan_head_after: 7372088c8c522e5bda7fae412d4edad814078ea0
---

# Phase 1 Plan 33: Romain's riders on the galet, the rule pictures on the landscape galet, the « Plateau galet » contract and the decision log Summary

Romain's ink rider, recoloured for each colour, now stands in the four corners of both galet plateaus. The credits name him. The 112 RULES.md pictures are drawn on the landscape galet: « avant » above « après », with his riders. The UI contract and the decision log record what Romain decided on 2026-10-14, his mid-plan « paysage obligatoire » included, apart from what he still has to confirm.

## What was built

- **Task 1 (tracer), a7a8c49.**
  - The four PNGs were copied byte for byte (`cmp` exits 0 for each colour).
  - BoardArt imports them as Vite assets, maps each colour to its URL and draws every image shape as `<image>`. Each one carries `data-rider`, its box, `preserveAspectRatio="none"`, opacity 0.85, `aria-hidden` and `pointer-events="none"`.
  - LICENSES.md has a new row `plateau-cavaliers` after `plateau`. It covers `apps/web/src/assets/plateau/`, type `plateau`, author Romain, « Utilisés avec l’accord de l’auteur ».
  - The credits sheet lists 17 entries, two of them in « Plateau ».
  - board.spec has the new test « les cavaliers de Romain aux quatre coins ». It runs with `plateau hauteur` on both projects and with `plateau largeur` on desktop. It checks four riders, one per colour, in the right corner around the board's centre (bleu below-left, jaune above-left, rouge above-right, vert below-right) and inside the board. It also checks that each href answers 200 with an `image/*` content type.
- **Task 2, 70b4169.**
  - render-scenarios.mjs sets `LAYOUT = "landscape"` (the header gives Romain's reason) and uses `sceneOf(LAYOUT)` for SCALE (1200 / 3200) and RADIUS (0.46 step, about 18.5 px).
  - The riders are read from apps/web/src/assets/plateau/ as data URIs.
  - Each half is 1200 x 600. The two halves are stacked, giving pictures of 1200 x 1200.
  - The tool still writes only under docs/regles/.
  - RULES.md: its one sentence describing the pictures now says « en haut avant le coup, en bas après ». No rule text changed.
- **Task 3, 7372088.**
  - 01-UI-SPEC.md: the C+ addendum now carries the « Remplacé par » line. The addendum « Plateau galet » has:
    - « Décidé par Romain », with only his words;
    - twelve numbered derived points, « à confirmer par Romain », to be re-tested in 01-39;
    - the technical facts and the landscape size targets (1227 px at 1280 x 800);
    - the real-device expectations, an honest comparison with the portrait galet, and a UI Considerations table.
  - 01-CONTEXT.md: D-05, D-07 and D-08 each have a « Révisé par Romain le 2026-10-14 (… plateau galet) » note and a separate « à confirmer par Romain » note that ends with « Point repris dans la recette de fin de phase (plan 01-39). ».

## Pictures checked by eye

I looked at R-07.1 (Dame, cell 3 to 15), R-09.1 (Valet swap) and R-13.4 (home entry), converted to PNG. Each one shows the landscape galet twice (avant above, après or le coup below), with the four riders in their corners, the felt ellipse with its pill, and the pawn discs on the drawn cells:
- R-07.1: A moves from bleu's 3 to the cell after jaune's 16.
- R-09.1: bleu A and jaune A trade places.
- R-13.4: A goes from the ring into the first home dot.

librsvg drew the cell numerals in the fallback font (DejaVu Sans), because Caveat is not installed system-wide. The game always uses Caveat.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green, 38 files, 770 passed, 2 skipped (unchanged).
- `node tools/render-scenarios.mjs`: « 112 images dans docs/regles/ ». All 112 webp files are 1200 x 1200 (checked with sharp metadata).
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 112 scénarios) ».
- Task 1 gate: `playwright test e2e/board.spec.ts e2e/sons.spec.ts e2e/tracer.spec.ts` gave 59 passed, 9 skipped.
- Task 3 greps: all pass. « plateau galet » appears 3 times and « plan 01-39 » 3 times in 01-CONTEXT.md. « paysage obligatoire » is in the UI-SPEC.
- Full Playwright suite on both projects: 287 passed, 45 skipped, 0 failed in 5.1 min. The baseline was 284 / 44; the new tests are the 2 rider tests on desktop and 1 on phone, plus 1 skip for the landscape variant on phone.
- Frame-clock invariant: no `.animate(` in apps/web/src/board outside frameClock.ts. animateNow is in animator.ts, cardFx.ts and Particles.svelte, as before.

## Deviations from Plan

### User decision mid-plan (Romain, relayed by the coordinator)

**1. The rule pictures are drawn on the landscape galet, not the portrait one.**
- **Decision:** « Pour la version iphone, oblige à jouer en format paysage, ça permettra d'utiliser le même plateau », then « Oui, paysage obligatoire ». There is now one board, the landscape galet.
- **Change:** `LAYOUT = "landscape"`. Avant is above après, so the pictures are 1200 x 1200 instead of 1200 x 900. The plan's metadata check (1200 x 900) was replaced by a 1200 x 1200 check on all 112 files. The plan's must-have about the portrait galet and 2:3 halves is superseded. So is the acceptance grep `grep -q "portrait" tools/render-scenarios.mjs`: the tool now says `landscape`, and `assets/plateau` is still found.
- **Commit:** 70b4169

**2. RULES.md: one descriptive sentence changed.** « à gauche avant le coup, à droite après » became « en haut avant le coup, en bas après ». Without this, the document would have contradicted its own pictures. The rule text is untouched.
- **Commit:** 70b4169

**3. The UI-SPEC addendum and the CONTEXT notes record the « paysage obligatoire » decision.**
- **Romain's words:** quoted under « Décidé par Romain ».
- **The portrait galet:** stated as obsolete for the game, with its geometry left in the code for a later plan to remove.
- **« Compacter l’écran »:** applied to the phone held sideways, through the compact bar, as a derived point.
- **The twelve derived points**, adapted:
  - point 5 is now the taller-than-wide screen (« Tourne ton téléphone », live switch, the game kept and the bots waiting, « Élargis la fenêtre » on a computer window);
  - point 6 has the modes barre, barre compacte and tourner;
  - point 9 is what the compact bar keeps from the dock;
  - point 11 is the rule pictures on the landscape galet.
- **Size targets:** landscape screens only. 844 x 390 replaces 390 x 664 for the step and knight widths. The portrait screens show the invitation to turn the phone.
- **Wording:** « Tourne ton téléphone », the bots waiting and « Élargis la fenêtre » are the coordinator's or the planner's choices. They are marked « à confirmer par Romain ».
- **Commit:** 7372088

### Auto-fixed Issues

**4. [Rule 1 - Bug] tracer.spec required no SVG image on the board.**
- **Found during:** Task 1.
- **Issue:** The landscape tracer asserted `image, img` count 0, which the riders break.
- **Fix:** The tracer now asserts no `img`, no `image` other than a rider, and four `image[data-rider]`. This file is outside the plan's list.
- **Commit:** a7a8c49

**5. [Rule 2 - Missing] A French name for the credits row.**
- **Issue:** Without it, the sheet would show the raw id « plateau-cavaliers ».
- **Fix:** Added « Cavaliers du plateau » to apps/web/src/i18n/fr/credits.ts. sons.spec asserts it. The register's intro sentence now also mentions « cavaliers du plateau ».
- **Commit:** a7a8c49

**6. board.spec: the existing viewport and debug tests were wrapped in an anonymous `test.describe`.** Their desktop-only skip now applies only to them, so the new rider test also runs on the phone project. Test titles are unchanged.

### Not done (out of my scope)

01-UAT.md's decision line does not yet carry the « paysage obligatoire » words. The UI-SPEC and CONTEXT quote them from Romain's message as relayed. The orchestrator may want to add them to the UAT record.

## Known Stubs

None. The rider image shapes left as stubs by 01-32 are now drawn. On the landscape plateau, the knights, overlays, felt cards and deal badge still follow the transitional state described by 01-32. That work belongs to the plans after this one, which are being replanned.

## Threat Flags

None beyond the plan's register:
- T-01-53: the row names Romain with his agreement, is plain text and covers the folder, and licences.test.ts is green.
- T-01-54: the tool reads only repository files and writes only docs/regles, and artSvg escapes the data URIs.
- T-01-SC: no package was added.

## Self-Check: PASSED

- FOUND: apps/web/src/assets/plateau/cav-{bleu,jaune,rouge,vert}.png (cmp identical to design/assets), apps/web/src/board/BoardArt.svelte (data-rider), assets/audio/LICENSES.md (apps/web/src/assets/plateau/), tools/render-scenarios.mjs (landscape, assets/plateau), 01-UI-SPEC.md (Plateau galet)
- FOUND commits: a7a8c49, 70b4169, 7372088
