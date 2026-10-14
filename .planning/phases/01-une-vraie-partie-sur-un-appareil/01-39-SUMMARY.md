---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 39
subsystem: build
status: complete
tags: [plateau-galet, paysage-obligatoire, licences, fx-05, build, docs, gap-closure]
requires:
  - "01-33 (the riders' licence row plateau-cavaliers, the credits sheet at 17 entries)"
  - "01-38 (no app source uses the raster board or its layout; the phone plays held sideways)"
provides:
  - "apps/web dev = vite, build = vite build: no compositing of the four quarters, no board image at the build output's root"
  - "tools/build-board.mjs and tools/calibrate-board (calibrate.mjs, calibrate.test.ts) removed; the generated apps/web/public/plateau-{640,1280,2560}.webp and their .gitignore line gone"
  - "assets/audio/LICENSES.md row `plateau`: the galet drawn by the code (packages/board/src/scene.ts, art.ts), Jeu TOC, Aucune œuvre tierce; Romain's quarters kept in assets/plateau, no longer shipped"
  - "01-CONTEXT.md D-05 records Romain's « Oui, mets-le à jour » (2026-10-14) about the instructions file, with the question as asked"
  - "PROJECT.md: Graphismes constraint (galet, same on computer and phone, always in landscape, « paysage obligatoire », quarters kept as his artwork), Rendu bullet, Context line, two Key Decisions rows, footer"
  - ".claude/CLAUDE.md: the Graphismes line only, word for word as in PROJECT.md"
  - "REQUIREMENTS.md FX-01 names the galet in landscape on a computer and on a phone held sideways; ROADMAP.md phase 1 criterion 2 opens « Sur un téléphone tenu en largeur comme sur un grand écran … sur le plateau galet »"
  - "01-CONTEXT.md galet notes: end-of-phase re-test in plan 01-41; the compact bar as revised in 01-37; « Élargis la fenêtre » of 01-38 as a derived consequence"
affects: ["01-40", "01-41"]
tech-stack:
  added: []
  patterns:
    - "The licence register names what ships: a board drawn by code is a row with no third-party work, the artwork it was drawn from is cited in the source cell"
key-files:
  created: []
  modified:
    - apps/web/package.json
    - .gitignore
    - assets/audio/LICENSES.md
    - .planning/PROJECT.md
    - .claude/CLAUDE.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/01-CONTEXT.md
  deleted:
    - tools/build-board.mjs
    - tools/calibrate-board/calibrate.mjs
    - tools/calibrate-board/calibrate.test.ts
decisions:
  - "The CLAUDE.md approval is recorded with the full question as the coordinator asked it (« … avec ta décision (plateau C+, ton dessin d’origine conservé dans le projet) ? ») rather than the plan's elided « … »; a derived sentence says the updated line describes the board decided later the same day (« galet partout », « Oui, paysage obligatoire »)"
  - "The register's intro sentence now reads « une illustration ou un dessin fait par le code par ligne »"
  - "PROJECT.md's Key Decisions row quotes « Là, on ne voit rien sur ordi » in full (01-CONTEXT.md D-07), the plan quoted its tail"
metrics:
  duration: "12 min"
  completed: 2026-10-14
  tasks: 2
  files: 11
estimate:
  tokens: 50000
  tasks: 2
actuals:
  tokens: 9700
  tasks: 2
  commits: 2
plan_head_before: 8ce3c209f85770c7b4408f818389a68eb417974f
plan_head_after: 5e09ed195fc518ba2095ef2b6290d91cde6cda17
---

# Phase 1 Plan 39: Le plateau image et ses outils quittent le jeu ; la licence du plateau et les documents du projet Summary

**The game builds, ships and plays from the galet alone (no compositing step, no board webp, no calibration tool), the licence register's board row names the galet drawn by the code, and PROJECT.md, CLAUDE.md (one line, after recording Romain's « Oui, mets-le à jour »), REQUIREMENTS FX-01, ROADMAP criterion 2 and the 01-CONTEXT galet notes say « plateau galet », always in landscape.**

## What was done

### Task 1 (tracer): no raster board in the build (commit a4a8219)
- `apps/web/package.json`: `dev` runs `vite`, `build` runs `vite build`.
- `git rm` of `tools/build-board.mjs` and of `tools/calibrate-board/` (calibrate.mjs and calibrate.test.ts). Nothing else imported them; `sharp` stays (build-knights, import-card-art use it).
- The three git-ignored `apps/web/public/plateau-*.webp` deleted from disk, their `.gitignore` line removed. `apps/web/public/cavaliers` stays.
- `assets/plateau` still holds its four quarters, unmodified (no change under that folder).
- Tracer gate: build, no webp at the root of `apps/web/dist` (only `dist/cavaliers/*.webp`), deleted paths absent, `pnpm test` green, `e2e/tracer.spec.ts` 15 passed, 1 skipped, 0 failed on both projects.

### Task 2: the register and the documents (commit 5e09ed1)
- Step 0 first: `01-CONTEXT.md` D-05 gains « **Révisé par Romain le 2026-10-14 (fichier d’instructions du projet) :** à la question « Le fichier d’instructions du projet (.claude/CLAUDE.md) dit « reprendre fidèlement le plateau existant ; ne pas le redessiner ». Je le mets à jour avec ta décision (plateau C+, ton dessin d’origine conservé dans le projet) ? », Romain a répondu « Oui, mets-le à jour ». » followed by a derived sentence about the galet decided later that day.
- `assets/audio/LICENSES.md`: the `plateau` row (same id, type, position) is now `packages/board/src/scene.ts, packages/board/src/art.ts` · plateau · « Plateau « galet » dessiné par le code, d’après la maquette choisie par Romain le 2026-10-14 et son plateau original (les quatre quarts restent dans assets/plateau, ils ne sont plus embarqués) » · Jeu TOC · Aucune œuvre tierce · —. French typography (U+202F inside the guillemets, typographic apostrophes). The register still has exactly two plateau rows (galet, riders), the sheet 17 entries.
- `PROJECT.md` and `.claude/CLAUDE.md` carry the identical Graphismes line (verified with `diff`), and « ne pas le redessiner » is gone from both constraint lists. Only that line of CLAUDE.md changed (one-line diff); the approval it rests on is recorded in 01-CONTEXT.md D-05.
- PROJECT.md: the Rendu bullet (galet, same everywhere, always in landscape, legible on both; checkbox untouched), the Context « Graphismes existants » line (quarters kept as Romain's artwork, no longer shipped; the game draws the galet in packages/board with his ink rider), two Key Decisions rows « — Pending » (galet with Romain's words only; « Compacter l'écran » with its details marked derived, 01-UI-SPEC addendum items 8 to 10), footer « Last updated: 2026-10-14 after the UAT (plateau galet, paysage obligatoire, écran compact) ».
- REQUIREMENTS.md FX-01 reworded (checkbox and traceability row kept), footer extended as the plan says.
- ROADMAP.md: only the opening of phase 1 criterion 2 changed.
- 01-CONTEXT.md galet notes of D-05, D-07, D-08: « plan 01-39 » → « plan 01-41 » (three notes); D-07's derived note describes the 01-37 compact bar (96 px info column, one 64 px row from 640 px wide, two rows of 56 and 64 px below); D-05's derived note adds « Élargis la fenêtre » for a computer window (01-38). Romain's quoted words and the C+ notes are unchanged.

## Verification

- `pnpm typecheck` (svelte-check 283 files, 0 errors, 0 warnings), `pnpm lint` (148 files, no fixes), `pnpm test`: 38 files, 783 passed, 2 skipped.
- `node tools/rules-trace.mjs --images`: OK (16 règles, 112 scénarios).
- Task 1 verify chain: exit 0 (see above). Acceptance grep: see deviation 2.
- Task 2 verify chain: every grep passes (with the register grep in its U+202F form, deviation 1), `pnpm test` green, `e2e/sons.spec.ts` 34 passed on both projects (17 credit entries, « Plateau » group of two).
- Full Playwright suite, both projects (phone = iPhone 13 landscape, desktop): 333 passed, 83 skipped, 0 failed (5.9 min), the same counts as before the plan; animations.spec :782 and :807 green on both projects; the frameClock invariant (apps/web/src/board/frameClock.test.ts) green in `pnpm test`.

## Deviations from Plan

### 1. [Rule 3 - Blocking] The register grep of Task 2's verify uses plain spaces
- **Found during:** Task 2
- **Issue:** the plan's action asks for French typography in the register (U+202F after « and before »), as every other row has, but its verify greps « Plateau « galet » dessiné par le code » with plain spaces. Both cannot hold.
- **Fix:** followed the action (U+202F, consistent with the `plateau-cavaliers` row) and ran the same grep with U+202F in the pattern; it passes. The plain-space grep was run too and reports no match, as expected.
- **Files:** assets/audio/LICENSES.md. **Commit:** 5e09ed1

### 2. [Rule 1 - Plan check] Task 1's acceptance grep `! grep -rn "plateau-" apps/web/src …` matches the riders' licence id
- **Found during:** Task 1
- **Issue:** `apps/web/src/i18n/fr/credits.ts:41` holds the credit title of the `plateau-cavaliers` row of 01-33, which the plan keeps (17 entries, « Plateau » group of two). The grep was meant for the raster images `plateau-640/1280/2560.webp`.
- **Fix:** none needed in code; checked the intent with `grep -rnE "plateau-[0-9]" apps/web/src apps/web/index.html apps/web/package.json .gitignore` (no match). The only remaining `plateau-` hit is the riders' id.

### 3. [Expected] Vitest count 787 → 783
- The 4 tests of `tools/calibrate-board/calibrate.test.ts` left with the tool, as the plan's Task 1 asks. No other test changed; skipped stays 2.

Plan otherwise executed as written. No package added, no test skipped or relaxed, no STATE.md or checkbox change.

## Known Stubs

None.

## Threat Flags

None (T-01-62 mitigated: the board row names the galet and the quarters' status; the build output check proves no board composite ships; T-01-SC: no package added).

## Next

- 01-40 (portrait galet geometry and layout parameter), 01-41 (former calibrated layout modules `packages/board/layout.json` / `layout.ts`, every gate and Romain's re-test, including his reading of PROJECT.md, CLAUDE.md, REQUIREMENTS.md, the ROADMAP criterion 2 and the credits' « Plateau » group).

## Self-Check: PASSED

- Deleted paths absent: tools/build-board.mjs, tools/calibrate-board, apps/web/public/plateau-*.webp; assets/plateau holds its 4 quarters, unchanged in git.
- Commits a4a8219 and 5e09ed1 are ancestors of HEAD.
- The Graphismes line is identical in .planning/PROJECT.md and .claude/CLAUDE.md, and CLAUDE.md has a one-line diff.
