---
phase: 05-suivi-apprentissage-et-finition
plan: 06
subsystem: tutorial
tags: [lessons, tutorial, guide, svelte, playwright, app-04]
status: complete

requires:
  - phase: 05-suivi-apprentissage-et-finition
    plan: 03
    provides: LESSONS, lessonStep, lessonGate, lessonHalo, createGame's script, lecons.ts
  - phase: 05-suivi-apprentissage-et-finition
    plan: 04
    provides: RulesSheet, RulesButton, « R », Sheet
provides:
  - "#/apprendre/<1-8>: Game.svelte in lesson mode (createSession's `lesson`, the guide's gate before the turn reducer)"
  - "GuideBand (data-guide-band), the cream guide halo on knights, cards, buttons and 7 chips (data-guide-halo), « , à toucher » in the target's name"
  - "LessonPlank « Bravo ! » (data-lesson-plank) with the joyful neigh"
  - "LessonsSheet « Les leçons » from the lesson pill « Leçon n sur 8 »; « Quitter les leçons » in Réglages"
  - "lessonProgress.ts: toc.tutorial.v1 { offered, done } read untrusted, markDone once, memory when storage fails"
  - "05-UAT.md tests 3 « Faire les huit leçons » and 4 « Relire les phrases du guide »"
affects: [05-08 lessons page #/apprendre, first-launch offer, « Apprendre en jouant » in the rules sheet; 05-10 accessibility audit; 05-11 deploy and UAT]

actuals:
  tokens: 23700
  tasks: 3
  commits: 6
plan_head_before: 9870cc3151e3e6cb5b633a9530468d90866eedc3
plan_head_after: 4a17af867f6c3a129a4e51b0b17164d5ac2a902a

tech-stack:
  added: []
  patterns:
    - "A lesson is a mode of the game screen: createSession(…, lesson) and the guide's gate in session.send, never a second screen"
    - "The plank shows once the lesson's last step is passed and the Director is idle (checked in syncWhenIdle), never mid-move"
    - "The guide halo on HTML targets is one global class (.guide-halo::after, app.css); on a hand card it rides a layer of its own over the fan; on a knight it is an SVG group under the knights"
    - "A sheet whose choice changes the route waits for its own slide-out (ongone) before changing the hash"

key-files:
  created:
    - apps/web/src/game/lessonProgress.ts
    - apps/web/src/game/lessonProgress.test.ts
    - apps/web/src/ui/GuideBand.svelte
    - apps/web/src/ui/LessonPlank.svelte
    - apps/web/src/ui/LessonsSheet.svelte
    - apps/web/e2e/lecons.spec.ts
  modified:
    - apps/web/src/App.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/game/session.svelte.ts
    - apps/web/src/app.css
    - apps/web/src/board/Overlay.svelte
    - apps/web/src/board/Pawn.svelte
    - apps/web/src/board/HitLayer.svelte
    - apps/web/src/board/Board.svelte
    - apps/web/src/board/FeltTable.svelte
    - apps/web/src/ui/HandFan.svelte
    - apps/web/src/ui/Card.svelte
    - apps/web/src/ui/ActionZone.svelte
    - apps/web/src/ui/SevenPanel.svelte
    - apps/web/src/ui/StepChip.svelte
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/ui/SettingsButton.svelte
    - apps/web/src/ui/SettingsSheet.svelte
    - apps/web/src/i18n/fr/lecons.ts
    - apps/web/src/i18n/fr/reglages.ts
    - .planning/phases/05-suivi-apprentissage-et-finition/05-UAT.md

key-decisions:
  - "« Suivant » is not ringed and its name does not end « , à toucher »: it is the only button of a narration line and it takes the focus; the halo table of the UI-SPEC lists knights, cards, « Jouer », « Passer cette carte » and the 7 chips only"
  - "In a compact lesson the band takes the 7's prompt row too, so « Reste n » moves to the top of the chips' column (it is the only count of the split there)"
  - "The info column of a lesson also drops the dealer, deal and first-player lines with the team pills: a lesson is not a game"
  - "The guide bubble uses 2 px vertical padding (not 4): two Body lines (48) + padding + its 2 px border fill the 56 px band exactly, three fill the 80 px one"
  - "Guide lines come from the session in this order: a wrong choice's line (4 s, or until the next event the gate lets through), then the game's own refusal, then the step's line"

patterns-established:
  - "createSession's sixth argument `lesson`: the lesson's position and scripted gives, the guide's gate, `session.lesson` { at, halo, wrong, done }"

requirements-completed: [APP-04]

duration: 70min
completed: 2026-11-07
---

# Phase 5 Plan 06: Une leçon sur l’écran de jeu, avec le guide qui parle Summary

**The eight lessons of 05-03 now play on the game screen itself at #/apprendre/1 to 8: a guide band above the board says each step with « tu », a cream ring shows what to touch, a wrong tap is explained and changes nothing, and a « Bravo ! » plank with the joyful neigh ends each lesson and marks it done in toc.tutorial.v1.**

## Performance

- **Duration:** about 70 min
- **Completed:** 2026-11-07
- **Tasks:** 3 (each RED then GREEN)
- **Files modified:** 26

## Accomplishments

- **Route and mode.** `App.svelte` sends `#/apprendre/<1-8>` to `<Game lesson={n} />`, keyed by `n` and behind « Tourne ton téléphone » like the game. Any other number, or anything else after the prefix, shows the home (05-08 adds `#/apprendre`). `Game.svelte` in lesson mode:
  - Bleu at the bottom, the lesson's position and hand; no computer moves (lesson 8's three others pass their scripted cards);
  - the deal banner, « D », « 1er », the team pills, the dealer/deal/first-player lines and « Avance rapide » are hidden (Messages is online only);
  - only the test speed of the debug parameters applies (`?vitesse=test`).
- **Session.** `createSession(…, lesson)` builds the controller with `lesson.before` and `lesson.script`. `send()` asks `lessonGate` before `reduceTurnUi`:
  - refused: nothing changes, the wrong line shows for 4 s (`WRONG_LINE_MS`) or until the next event that passes; lesson 6's refusal applies its `reset` (cancelAll, then the 7 again);
  - « Suivant » (`{ t: "next" }`) counts a narration line;
  - accepted moves are kept in `played`; `session.lesson` exposes `at`, `halo`, `wrong` and `done`. `done` turns true once the last step is passed and the Director is idle, so the plank never appears mid-move.
  - Without a lesson nothing changes (partie, compact, cartes-speciales and the whole suite pass).
- **The band** (`GuideBand.svelte`, `data-guide-band`, `aria-live="polite"`, always mounted): the logo in a 40 px cream disc, a cream bubble with a tail, Body 16, the quoted names (« Jouer ») in bold, 150 ms fade + 4 px up (fade only when reduced). It takes the compact prompt row's place (56 px, 80 px under 640 px wide) and sits above the board on a computer; both board formulas read its height.
- **The guide halo**, cream and walnut, never amber:
  - a knight: an SVG ring `KNIGHT.w / 2 + 26` units (4 walnut, 10 cream, 4 walnut) under the knights, pulsing 1 → 1.12 over 1.2 s on its own group;
  - a hand card: a ring 3 px outside the amber outline on a layer over the fan (it never takes a tap), opacity 1 → 0.45;
  - « Jouer », « Passer cette carte », the 7's « Jouer » and a step chip: `.guide-halo::after` in `app.css`, 3 px outside, 6 px out under the focus ring;
  - all still under reduced motion (the in-app switch or the system's setting);
  - the target's accessible name ends « , à toucher » (Card, HitLayer target, Pawn, the buttons, StepChip).
- **« Suivant »** replaces the state's buttons on a narration line (the strip's lowest 58 px button on a phone, the action zone's primary on a computer), takes the focus when it appears, and Entrée presses it. On lesson 8's last line it appears only once the cards have crossed.
- **The plank** (`LessonPlank.svelte`, `data-lesson-plank`): role dialog named by « Bravo ! », described by the recap, focus on the primary, Tab between the two buttons, the game behind inert, the « 4e cheval rentré (joyeux) » neigh. It is the end plank's oak, at most 400 px and board width − 32, centred on the board and in the screen's height, over a 30 % walnut veil on the board only. The buttons stack under 400 px of board. « Revoir la leçon » restarts the lesson, « Leçon suivante » opens the next one. The last plank has « Revoir les leçons » (#/apprendre) and « Jouer contre l’ordinateur » (#/ordinateur).
- **Progress** (`lessonProgress.ts`): `readProgress` / `markDone` on `toc.tutorial.v1` `{ offered, done }`:
  - `done` keeps only the integers 1 to 8, once each, sorted; anything else reads as empty progress;
  - a lesson is written once;
  - a throwing or missing storage keeps the progress in memory for the page, never an exception.
  The plank marks its lesson.
- **The pill and « Les leçons ».** The info pill (phone) and the turn line (computer) become « Leçon n sur 8 », named « Leçon 3 sur 8 : Manger, voir les leçons » (two lines on a phone so it fits the strip). It opens `LessonsSheet.svelte`:
  - the eight lessons as links (`data-lesson`, `data-done`), named « Leçon 1, Sortir un cheval, faite »;
  - a disc with the number or a check, « Environ 1 minute » or « Faite »; the current lesson outlined in cream;
  - « Recommencer cette leçon », « Fermer ».
  A row opens its lesson once the sheet has slid away; the current row restarts it.
- **Réglages in a lesson:** « Quitter les leçons » (no confirmation, to `#/apprendre`, which shows the home until 05-08) replaces « Abandonner la partie »; « Raccourcis clavier » stays. The book button and « R » open « Règles » on « Les cartes » while the lesson waits.
- **05-UAT.md:** tests 3 « Faire les huit leçons » and 4 « Relire les phrases du guide » (every line, wrong line and recap of `lecons.ts`, generated from the catalogue). The Summary counts are now 4 pending.

## Task Commits

1. **Task 1 RED:** `2ee5a9e` test(05-06): lesson 1 on the game screen (RED)
2. **Task 1 GREEN:** `0439057` feat(05-06): lesson 1 on the game screen, with the guide's band, its halo and « Bravo ! »
3. **Task 2 RED:** `7d12e8f` test(05-06): the eight lessons and every line in the band (RED)
4. **Task 2 GREEN:** `146a28a` feat(05-06): the eight lessons play to the end, the 7's count beside its chips
5. **Task 3 RED:** `45d027c` test(05-06): the lessons pill, the sheet and leaving (RED)
6. **Task 3 GREEN:** `4a17af8` feat(05-06): the lesson pill and « Les leçons », « Quitter les leçons », the guide's lines for Romain

## Gate

| Suite | Result |
|-------|--------|
| `pnpm typecheck && pnpm lint && pnpm test` | green: **2099 passed, 2 skipped** (131 files, node and worker projects; 2090 at 05-05) |
| Full local Playwright (`playwright.config.ts`, both projects) | **547 passed, 131 skipped, 0 failed** (8.7 min; 491 at 05-05) |
| Online Playwright (`playwright.online.config.ts`) | **112 passed, 2 skipped, 0 failed** (10.2 min) |
| Ports 8787, 4173, 4174 after the runs | closed (checked by connecting) |

The suites ran one after another. The plan's verify commands passed task by task: lecons, partie and compact (task 1); lecons and cartes-speciales (task 2); lecons, reglages and regles (task 3). `lecons.spec.ts` alone has 80 cases across both projects; 24 are skipped on the phone project on purpose, because the explicit viewports and the keyboard cases run on the desktop project only.

## Board width in a lesson (measured, `lecons.spec.ts`)

| Viewport | UI-SPEC | Measured | Band |
|----------|---------|----------|------|
| 844 × 390 | 668 | 668 | 56 |
| 750 × 342 | 572 | 572 (± 2) | 56 |
| 667 × 375 | 526 | 526 (± 2) | 56 |
| 480 × 320 | 351 | 351 (± 2) | 80 |
| 1280 × 800 | ≈ 1119 | 1119.5 | 56 |

The band and the board never overlap, the band is exactly as wide as the board and centred on it, and the page does not scroll at any of the five sizes.

## Every guide line in the band

All 37 lines of `lecons.ts` (the guide, wrong and narration lines of the eight lessons) are shown in the band by playing each lesson with each declared wrong choice. Each one fits in at most 2 lines at 750 × 342 and at most 3 at 480 × 320, and none is clipped. **No line had to be shortened**, so `lecons.ts` keeps 05-03's drafts word for word.

## Screenshots (looked at)

In `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/`, each at 844 × 390 and 1280 × 800:
- `05-06-lecon1-suivant-*.png`: lesson 1, « Bienvenue ! » with « Suivant »
- `05-06-lecon3-erreur-*.png`: lesson 3, the 8 ringed, the wrong line after the 3
- `05-06-lecon6-pastilles-*.png`: lesson 6, the chip « 3 » ringed, « Reste 7 » over the chips on the phone
- `05-06-lecon8-echange-*.png`: lesson 8, the Roi chosen, « Passer cette carte » ringed
- `05-06-lecon8-recu-*.png`: lesson 8, the received 7 with Rouge's border and « Suivant »
- `05-06-bravo-*.png`: the « Bravo ! » plank of lesson 4
- `05-06-derniere-planche-*.png`: the last plank
- `05-06-les-lecons-*.png`: « Les leçons » from the pill

## Decisions Made

See `key-decisions` in the frontmatter. One more: the knight ring is drawn under the knights, in Overlay's `under` layer, like the amber halo. Only its own group pulses, never the knight.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The card ring took the taps of the card under it on a phone**
- **Found during:** Task 1 GREEN (lecons.spec.ts, phone project)
- **Issue:** The ring's layer followed the card's slot, and `.compact .slot { pointer-events: auto }` outranked its `pointer-events: none`, so a tap on the ringed As hit the ring.
- **Fix:** `.compact .slot.guide-slot` and the ring itself never take a pointer.
- **Files modified:** apps/web/src/ui/HandFan.svelte
- **Commit:** 0439057

**2. [Rule 1 - Bug] Lesson 6 on a phone lost « Reste n »**
- **Found during:** Task 2 RED (the lesson-6 case on the phone project and at 750 × 342 and 480 × 320)
- **Issue:** On a phone the 7's counter lives in the prompt row, and in a lesson the band takes that row.
- **Fix:** SevenPanel's `counter` prop puts « Reste n » (amber, as in the row, `data-remaining`, live) over the chips' column in a compact lesson.
- **Files modified:** apps/web/src/ui/SevenPanel.svelte, apps/web/src/routes/Game.svelte
- **Commit:** 146a28a

**3. [Rule 1 - Bug] Choosing another lesson in « Les leçons » left the old screen alive for the sheet's slide-out**
- **Found during:** Task 3 GREEN
- **Issue:** The keyed route destroys the old game only after the sheet's global outro ends (250 ms), so two game screens, two bands and two key listeners were alive at once.
- **Fix:** A row closes the sheet first; `ongone` (the sheet's onDestroy, after its outro) then changes the hash. The current lesson's row restarts it instead.
- **Files modified:** apps/web/src/ui/LessonsSheet.svelte, apps/web/src/routes/Game.svelte
- **Commit:** 4a17af8

### Plan and spec adjustments

- **Files beyond the plan's list:** `app.css` (the shared `.guide-halo` class), `Board.svelte` and `FeltTable.svelte` (a `markers` prop hides « D » and « 1er »), `HitLayer.svelte` (« , à toucher » on the tap target, which is what the screen reader reaches), `StepChip.svelte` (the chip's own ring) and `SettingsButton.svelte` (passes `onquitlessons`). No package, colour or size token was added.
- **Bubble padding:** 2 px vertically instead of the UI-SPEC's 4. With 4 px and the 2 px border, two Body lines are 60 px and do not fit the 56 px band.
- **« Suivant » is not ringed** and keeps its plain name (see key-decisions).
- **The keyboard case of lesson 5:** after the Valet and Bleu's knight, « A » means both Bleu's knight (already chosen) and Jaune 66. As in a game, it opens the tray, and the spec presses the chip's letter. This is the game's existing behaviour, not a lesson rule.
- **Lesson rows** in « Les leçons » carry `data-lesson={n}` (the UI-SPEC hook) inside `[data-lessons-sheet]`. The screen's `<main>` also carries `data-lesson` and `data-lesson-step` (`done` once over).

## Known Stubs

- `#/apprendre` (« Quitter les leçons », « Revoir les leçons ») shows the home until plan 05-08 adds the lessons page. This is by design (plan 05-06 « This Plan's Slice »).

## Threat Flags

None. No new network surface: a lesson sends no request and never writes `toc.tables.v1` (lecons.spec.ts asserts both). `toc.tutorial.v1` is parsed field by field (T-05-18).

## À relire par Romain (UAT)

- Test 4: every guide line, wrong line and recap is still a draft (D-09).
- Test 3: the lesson board is 5 to 9 % smaller than the game board (UI-SPEC « à confirmer » 10).
- On the computer, the last plank's « Jouer contre l’ordinateur » breaks onto two lines inside the 400 px plank.
- On a phone the pill reads « Leçon 3 » over « sur 8 », so it fits the strip.

## Deploy Notes

No migration, secret or wrangler change, and no new package. A front-end change only: rebuild and deploy as usual. Before 05-08 there is no link to the lessons yet; they open by address (`#/apprendre/1`).

## Self-Check: PASSED

- FOUND: apps/web/src/game/lessonProgress.ts, apps/web/src/game/lessonProgress.test.ts, apps/web/src/ui/GuideBand.svelte, apps/web/src/ui/LessonPlank.svelte, apps/web/src/ui/LessonsSheet.svelte, apps/web/e2e/lecons.spec.ts
- FOUND commits: 2ee5a9e, 0439057, 7d12e8f, 146a28a, 45d027c, 4a17af8
