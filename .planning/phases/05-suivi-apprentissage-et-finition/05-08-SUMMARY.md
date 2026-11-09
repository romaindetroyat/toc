---
phase: 05-suivi-apprentissage-et-finition
plan: 08
subsystem: web
tags: [home, tutorial, rules, first-launch, waiting-room, app-04, play-06, hist-02]
status: complete

requires:
  - phase: 05-suivi-apprentissage-et-finition
    plan: 04
    provides: RulesSheet (tab, inGame), rulesOpen counter, the book-open / graduation-cap / trophy icons
  - phase: 05-suivi-apprentissage-et-finition
    plan: 06
    provides: "#/apprendre/<n> lessons, lessonProgress.ts (toc.tutorial.v1), LessonsSheet rows"
  - phase: 05-suivi-apprentissage-et-finition
    plan: 01
    provides: "#/resultats"
provides:
  - "#/apprendre: « Apprendre à jouer » (routes/Lessons.svelte, data-lessons-page), primary by progress, the eight lessons"
  - "FirstTimeSheet « Première fois ? » (data-first-time-sheet), once per brand-new device"
  - "lessonProgress.firstTimeDue(storage) and nextLesson(done)"
  - "The home's links row (data-home-links): « Règles », « Apprendre », « Mes résultats » signed in"
  - "« Règles du jeu » first in every Réglages (data-settings-rules); RulesSheet `onlearn` → « Apprendre en jouant » (data-rules-learn)"
  - "The waiting room's newcomer hint (data-newcomer-hint)"
  - "ui/LessonRow.svelte, shared by the page and « Les leçons »"
affects: [05-09 « Mes résultats » page (entry from the home), 05-10 accessibility audit (new surfaces), 05-11 UAT and deploy]

actuals:
  tokens: 21200
  tasks: 3
  commits: 8
plan_head_before: c184c24fb55e77c99c4cbc4f25d43927d5244bfd
plan_head_after: 8cfdec792bf6115099e592d6922dc066d1bf3652

tech-stack:
  added: []
  patterns:
    - "A sheet whose answer changes the route sets a flag and changes the hash in its own onDestroy (after its outro), so the new screen never appears under it"
    - "Every Playwright suite starts its devices with toc.tutorial.v1 already offered (use.storageState, inherited by browser.newContext()); a spec that tests the first launch resets it with test.use({ storageState: empty })"
    - "A row of tiles whose count per row depends on its column's width uses a container query, not the viewport"

key-files:
  created:
    - apps/web/src/routes/Lessons.svelte
    - apps/web/src/ui/FirstTimeSheet.svelte
    - apps/web/src/ui/LessonRow.svelte
    - apps/web/e2e/apprendre.spec.ts
  modified:
    - apps/web/src/game/lessonProgress.ts
    - apps/web/src/game/lessonProgress.test.ts
    - apps/web/src/App.svelte
    - apps/web/src/routes/Home.svelte
    - apps/web/src/routes/WaitingRoom.svelte
    - apps/web/src/ui/LessonsSheet.svelte
    - apps/web/src/ui/RulesSheet.svelte
    - apps/web/src/ui/SettingsSheet.svelte
    - apps/web/src/i18n/fr/accueil.ts
    - apps/web/src/i18n/fr/lecons.ts
    - apps/web/src/i18n/fr/reglages.ts
    - apps/web/src/i18n/fr/regles.ts
    - apps/web/src/i18n/fr/table.ts
    - apps/web/e2e/accueil.spec.ts
    - apps/web/e2e-online/accueil.spec.ts
    - apps/web/e2e-online/salle.spec.ts
    - apps/web/e2e-pwa/pwa.spec.ts
    - apps/web/playwright.config.ts
    - apps/web/playwright.online.config.ts
    - apps/web/playwright.pwa.config.ts

key-decisions:
  - "A played device (first name, account or tables) gets toc.tutorial.v1 written silently as { offered: false, done: [] }; a value that cannot be parsed counts as played (any doubt means not shown); a storage that throws on reading or writing never shows the sheet"
  - "The home asks firstTimeDue only after a tick, and only when no sheet layer, no in-app card and no sign-in sheet is up; otherwise it waits for the next home visit and writes nothing"
  - "« Apprendre en jouant » appears only where leaving costs nothing: the home's « Règles » tile and Réglages on the home and the solo setup. Not in a game, a lesson, the waiting room (seat) or on #/apprendre itself (it would lead to the same page)"
  - "The newcomer hint sits just above the waiting room's action row (the end of the column's content), so the action row stays the column's sticky bottom"
  - "The links row's tiles are SmallTile `fill` in a CSS grid: repeat(3, minmax(0, 152px)), two per row under a 400 px column (container query), full-width pairs in one column and portrait"

requirements-completed: [APP-04, PLAY-06, HIST-02]

duration: 80min
completed: 2026-11-07
---

# Phase 5 Plan 08: L’accueil, « Apprendre à jouer » et la première fois Summary

**A brand-new device is offered « Apprendre en 10 minutes » once; the home always has « Règles », « Apprendre » (with « Leçon 3 sur 8 ») and, signed in, « Mes résultats »; #/apprendre shows where the player stopped; every Réglages starts with « Règles du jeu »; the rules outside a game lead to the lessons; a newcomer in the waiting room is pointed to the rules.**

## Performance

- **Duration:** about 80 min
- **Completed:** 2026-11-07
- **Tasks:** 3 (RED then GREEN each, plus two test-only fixes found by the full suites)
- **Files modified:** 24

## Accomplishments

- **`firstTimeDue(storage)`** (lessonProgress.ts):
  - no `toc.tutorial.v1` and no sign of play → true, and `{ offered: true, done: [] }` is written at once;
  - a first name in `toc.device.v1` (the home always writes a token, so the name is what counts), a non-empty `toc.me.v1` or `toc.tables.v1` (even `[]`), or a value that cannot be parsed → false, key written silently with `offered: false`;
  - key present, whatever it holds → false, nothing written;
  - a storage that throws on read or write, or no storage → false, nothing written.
  `nextLesson(done)` gives the first lesson not done, or null.
- **« Première fois ? »** (`FirstTimeSheet.svelte`): the normal sheet with the UI-SPEC text, the primary « Apprendre en 10 minutes » (graduation-cap, focused), the note, and « Plus tard » as the sheet's own close (Échap does the same). The primary opens `#/apprendre/1` once the sheet has slid away.
- **#/apprendre** (`Lessons.svelte`, a « Page », not behind « Tourne ton téléphone »): the text, the primary « Commencer » / « Continuer : leçon {n} » / « Jouer contre l’ordinateur » (play icon), « Revoir depuis le début » when all are done (progress kept), the note and « Règles du jeu » (the rules on « Le but »). The right column is an `<ol>` of eight 56 px rows (`LessonRow.svelte`, now shared with « Les leçons »), named « Leçon 3, Manger, faite ». A hostile progress reads as empty.
- **The links row** (`data-home-links`): « Règles » (book-open, « Les cartes, le 7, la maison », a button named « Règles du jeu » opening the rules over the home on « Le but », focus back to the tile), « Apprendre » (graduation-cap, « En 10 minutes » / « Leçon {n} sur 8 » / « Leçons faites », named « Apprendre à jouer ({line 2}) »), and signed in « Mes résultats » (trophy, « Parties et classement »). It sits under the list (8, 16 on the computer) in two columns and on the computer, right after the account tiles in one column and in portrait. The list shrinks and scrolls inside its column; nothing is covered. No amber.
- **Réglages**: « Règles du jeu » is the first link everywhere. It opens the rules as a nested sheet, like the credits: « Le but » on the home, the solo setup and the waiting room; « Les cartes » in a solo game, an online game and a lesson. Échap closes the rules, then Réglages, each giving the focus back. The solo computers wait through the rules sheet's own `rulesOpen` count.
- **« Apprendre en jouant »** (RulesSheet `onlearn`): a 48 px secondary button with the graduation cap, under the tabs in two columns (the nav's width, 16 below the last tab). In one column it is the last item of « Le but ». It closes the sheets, then opens #/apprendre.
- **The waiting room**: a seated device without a finished lesson sees « Première fois ? Lis les règles en attendant. » and the 44 px text button « Règles du jeu » (the rules on « Le but », no « Apprendre en jouant »). The tutorial is never offered there.

## Task Commits

1. **Task 1 RED:** `328569e` test(05-08): learning from the home and the first time (RED)
2. **Task 1 GREEN:** `f41f10a` feat(05-08): « Apprendre à jouer » at #/apprendre, and « Première fois ? » once on a new device
3. **Task 2 RED:** `c703d97` test(05-08): the home's links row (RED)
4. **Task 2 GREEN:** `0cc6847` feat(05-08): « Règles », « Apprendre » and « Mes résultats » on the home
5. **Task 3 RED:** `da3478c` test(05-08): rules from Réglages, learning from the rules, the newcomer hint (RED)
6. **Task 3 GREEN:** `c45d8d4` feat(05-08): « Règles du jeu » in every Réglages, « Apprendre en jouant » outside games, the newcomer hint
7. **Test fix:** `ba2dfd0` test(05-08): the one-column keyboard case waits for the layout before tabbing
8. **Test fix:** `8cfdec7` test(05-08): the PWA suite's copy origin starts as a device already offered the lessons

## Gate

| Suite | Result |
|-------|--------|
| `pnpm typecheck && pnpm lint && pnpm test` | green: **2145 passed, 2 skipped** (133 files; 418 files linted) |
| Full local Playwright (`playwright.config.ts`, both projects) | **611 passed, 133 skipped, 0 failed** (9.8 min) |
| Online Playwright (`playwright.online.config.ts`) | **119 passed, 5 skipped, 0 failed** (9.7 min) |
| PWA suite (`playwright.pwa.config.ts`, not in the gate; its spec was touched) | 12 passed |
| Ports 8787, 4173, 4174 after the runs | closed (checked by connecting) |

The suites ran one after another. The first full local run had one failure, a race in the new one-column keyboard case: it pressed Tab before the layout had switched. The fix is `ba2dfd0`, after which the full suite was run again (the figures above).

## Measures (the UI-SPEC's ≈ values re-measured)

| Viewport | Right column | Tiles | List height, no strip (5 tables) |
|----------|--------------|-------|----------------------------------|
| 844 × 390 | 480 | 3 × 152 signed in, 2 × 152 guest | 216 (UI-SPEC 210) |
| 1280 × 800 | 480 | 3 × 152 | 206 (UI-SPEC 200) |
| 750 × 342 | 414 (UI-SPEC 406) | 3 × 132.7 (UI-SPEC 130) | 216 |
| 640 × 360 | 304 (UI-SPEC 296) | 148, two per row (UI-SPEC 144) | 160 signed in (two rows) |

The phone project (iPhone 13 held sideways, Safari not installed) also shows the 04 install strip, which is two rows high (104 px) at 844 × 390. With it the list keeps about 1.6 rows of 64 px in sight (104 px). The tests accept 96 px when a strip is up.

The lessons page measures: rows 56 high; at 844 × 390 the left column and five rows are in sight; at 1280 × 800 everything is in sight; upright and at 480 × 320 there is no sideways scroll.

## Screenshots (looked at)

In `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/`, debug build, reduced motion, DPR 2:
- `05-08-accueil-invite-844x390.png`, `05-08-accueil-invite-1280x800.png`: a guest with a first name, five tables, lessons 1 and 2 done (« Leçon 3 sur 8 »).
- `05-08-accueil-compte-844x390.png`, `05-08-accueil-compte-1280x800.png`: signed in, the three tiles.
- `05-08-premiere-fois-844x390.png`, `05-08-premiere-fois-1280x800.png`: the first-launch sheet, the primary focused.
- `05-08-apprendre-844x390.png`, `05-08-apprendre-1280x800.png`: #/apprendre with two lessons done (« Continuer : leçon 3 »).
- `05-08-reglages-844x390.png`, `05-08-reglages-1280x800.png`: Réglages scrolled to « Règles du jeu », the first link.
- `05-08-regles-apprendre-844x390.png`, `05-08-regles-apprendre-1280x800.png`: the rules from the home's Réglages, « Apprendre en jouant » under the tabs.
- `05-08-salle-nouveau-844x390.png`, `05-08-salle-nouveau-1280x800.png`: the waiting room's hint above the action row.

What they show:
- Everything fits.
- The links row lines up with the bottom of the account tiles.
- **« Les cartes, le 7, la maison » is cut to « Les cartes, le 7, la … »** in a 152 px tile. The full line is in the tile's `title`, and its accessible name is « Règles du jeu ». See « Pour la recette ».

## Decisions Made

See `key-decisions` in the frontmatter.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The first-launch sheet would cover every home in the test suites**
- **Found during:** Task 1
- **Issue:** About a hundred cases across the local, online and PWA suites open `#/` on a fresh context, and the new modal sheet would make the home inert behind it.
- **Fix:** Each Playwright config's `use.storageState` now starts devices with `toc.tutorial.v1 = { offered: true, done: [] }`. A probe confirmed that `browser.newContext()` inherits it. `apprendre.spec.ts` resets it with `test.use({ storageState: { cookies: [], origins: [] } })`. The PWA spec's own copy server runs on another origin, so it sets the key with an init script (`seenLessons`).
- **Files modified:** playwright.config.ts, playwright.online.config.ts, playwright.pwa.config.ts, e2e-pwa/pwa.spec.ts (not in the plan's list; test infrastructure only)
- **Commits:** f41f10a, 8cfdec7

**2. [Rule 1 - Test] Fixed widths in the RED specs**
- **Found during:** Task 2 GREEN
- **Issue:** The RED cases used the UI-SPEC's estimated widths (130 at 750 px, 144 at 640 px). The real columns are 414 and 304 wide.
- **Fix:** The tests now compute `min(152, (W − 8(n − 1)) / n)` from the measured row. The list check allows for the phone project's install strip. The 1280 × 800 case and the keyboard case run on the desktop project only, as in lecons.spec.
- **Commit:** 0cc6847

**3. [Rule 1 - Test] Two fast Échap presses in salle.spec**
- **Issue:** The second press reached the rules sheet while it was still sliding out.
- **Fix:** The test waits for the rules to close before the second press.
- **Commit:** c45d8d4

**4. [Rule 2 - Polish] Link-buttons were underlined**
- **Issue:** An `<a class="btn btn-primary">` kept the link underline. These are the first anchor buttons in the app.
- **Fix:** `text-decoration: none` on the lessons page's and the first-time sheet's anchor buttons.
- **Commit:** c45d8d4

### Plan and spec adjustments

- **`LessonRow.svelte`** (a new file) holds the lesson row, now shared by #/apprendre and « Les leçons ». `LessonsSheet.svelte` was changed to use it. lecons.spec still passes.
- **The existing waiting-room fit test** now uses a device with a finished lesson. The UI-SPEC fit table has no hint in it, and at 640 × 360 the hint would make the host's column scroll (allowed by the two-column CSS, but not by that test). The new newcomer test checks the hint's own fit: no sideways scroll, and the action row in sight at 844 × 390, 640 × 360 and 1280 × 800.
- **« Apprendre en jouant »** is left out on #/apprendre itself and in the waiting room, beyond the « in a game or a lesson » the plan lists (see key-decisions).
- **The hint's place:** it sits just above the waiting room's action row, not after it, so the sticky action row stays at the bottom.

No package was added. No wrangler config, STATE.md, ROADMAP.md, REQUIREMENTS.md, CLAUDE.md or GSD config was touched.

## Known Stubs

None. 05-06's stub (« #/apprendre shows the home ») is now resolved.

## Threat Flags

None. No new network surface. The four storage keys are read in try/catch through their own parsers or as « present », and any doubt means the sheet does not show (T-05-23). The waiting room offers only the rules (T-05-24).

## Pour la recette (05-UI-SPEC « À confirmer » 2, 3, 11, for 05-11)

2. **L’accueil** : en bas de la colonne de droite, sous « Mes parties en cours », les petites tuiles « Règles », « Apprendre » et, avec un compte, « Mes résultats ». À voir : la deuxième ligne de « Règles », « Les cartes, le 7, la maison », est coupée (« Les cartes, le 7, la … ») dans une tuile de 152 px. Faut-il une ligne plus courte (par exemple « Cartes, 7, maison ») ? Sur l’iPhone, quand le bandeau « Installe TOC » est affiché, la liste n’a plus que la place d’une ligne et demie.
3. **La première fois** : sur un appareil neuf, « Première fois ? » propose « Apprendre en 10 minutes » ou « Plus tard », une seule fois. Elle ne s’ouvre pas sur un appareil qui a déjà un prénom, un compte ou une partie. Dans la salle d’attente, un nouveau venu assis voit « Première fois ? Lis les règles en attendant. » avec « Règles du jeu ».
11. **Quitter les leçons** : « Quitter les leçons » dans « Réglages » d’une leçon, sans question, ramène maintenant à la page « Apprendre à jouer », où les leçons faites restent cochées.

## Deploy Notes

No migration, secret or wrangler change, and no new package. This is a front-end change only: rebuild and deploy as usual.

## Self-Check: PASSED

- FOUND: apps/web/src/routes/Lessons.svelte, apps/web/src/ui/FirstTimeSheet.svelte, apps/web/src/ui/LessonRow.svelte, apps/web/e2e/apprendre.spec.ts
- FOUND commits: 328569e, f41f10a, c703d97, 0cc6847, da3478c, c45d8d4, ba2dfd0, 8cfdec7
