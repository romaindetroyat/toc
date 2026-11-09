---
phase: 05-suivi-apprentissage-et-finition
plan: 04
subsystem: web
tags: [rules, sheet, figures, keyboard, accessibility, play-06]
status: complete

requires:
  - phase: 05-suivi-apprentissage-et-finition
    provides: 05-02 BoardArt `ids` prefix, knight-mark symbols and settings.knightMarks
  - phase: 01-jouer-une-partie-juste-en-solo
    provides: Sheet, KeyHint, the keyboard map (shortcuts.ts), the hold of the computers, the engine's scenarioState and placeOf
provides:
  - Sheet `size="large"` (header close button, a body its content lays out)
  - RulesSheet (« Règles du TOC »), CardRule, RuleFigure, RulesButton
  - rulesOpen.svelte.ts (`rulesOpen.count`, `holdForRules()`), read by Game.svelte's hold in solo
  - i18n/fr/regles.ts (tabs, texts, cards list, captions, alt texts, turn line)
  - game/ruleFigures.ts (RULE_FIGURES, figuresOf, figurePlaces)
  - « R » in keyIntent (`rules` context flag, `{ kind: "rules" }` intent) and in « Raccourcis clavier »
  - the five phase-5 icons in icons.ts: book-open, graduation-cap, trophy, history, chart-column
  - 05-UAT.md (tests 1 and 2)
affects: [05-06 lesson screen (book and R in lessons), 05-08 home tile, Réglages link, « Apprendre en jouant », 05-10 audit, 05-11 bundle check and UAT]

actuals:
  tokens: 25600
  tasks: 3
  commits: 6
plan_head_before: 8ecae17a4912f09f2b33036c7275702f6add3b9d
plan_head_after: 4cc43d3132f7009453938991a7a256695933f517

tech-stack:
  added: []
  patterns:
    - "A sheet that must hold the solo computers counts itself in a shared $state counter while mounted; the game's hold reads it, and also a local flag set in the same task as the tap or key"
    - "A rule figure is drawn live: two BoardArt halves with per-figure def ids and static <use> knights; positions are copied data checked against the scenarios by a test that is the only importer of @toc/engine/scenarios"
    - "A live region that must announce once is always mounted and only its text changes"

key-files:
  created:
    - apps/web/src/ui/RulesSheet.svelte
    - apps/web/src/ui/CardRule.svelte
    - apps/web/src/ui/RuleFigure.svelte
    - apps/web/src/ui/RulesButton.svelte
    - apps/web/src/ui/rulesOpen.svelte.ts
    - apps/web/src/i18n/fr/regles.ts
    - apps/web/src/game/ruleFigures.ts
    - apps/web/src/game/ruleFigures.test.ts
    - apps/web/e2e/regles.spec.ts
    - apps/web/e2e-online/regles-en-ligne.spec.ts
    - .planning/phases/05-suivi-apprentissage-et-finition/05-UAT.md
  modified:
    - apps/web/src/ui/Sheet.svelte
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/game/shortcuts.ts
    - apps/web/src/game/shortcuts.test.ts
    - apps/web/src/i18n/fr/clavier.ts
    - apps/web/src/ui/icons.ts
    - tools/copy-vendor-assets.mjs
    - apps/web/e2e/clavier.spec.ts

key-decisions:
  - "Two columns from a 688 px window (a 656 px dialog), decided by one media query shared by the CSS and the tablist's aria-orientation"
  - "The figure knights are plain <use> of the knight symbols, not Pawn: no data-pawn duplicates and no extra accessible names over the game"
  - "The five « Le coup » figures keep « Avant » on the upper half; the lower half reads « Le coup » with cream-and-walnut rings at the concerned knights' feet"
  - "The chosen card's row name ends « …, ta carte choisie. » (the effect's final period moved after it)"
  - "« R » also works under an online plate, like « ? » and « M »"
  - "The turn line is shown while the hand is the player's in play (turn or dead hand), not during the exchange"

patterns-established:
  - "Sheet size large for any later big sheet"

requirements-completed: [PLAY-06]

duration: 45min
completed: 2026-11-07
---

# Phase 5 Plan 04: La feuille « Règles », à tout moment de la partie Summary

**« Règles du TOC », a large sheet with ten tabs of French text, every card's effect and fifteen rule figures drawn live on the galet, opens from a book button or « R » at any moment of a game. The solo computers wait while it is open. Online the game goes on, and the sheet says « C’est à toi de jouer. » when the turn comes.**

## Performance

- **Duration:** about 45 min
- **Completed:** 2026-11-07
- **Tasks:** 3 (6 commits, TDD RED then GREEN for each)
- **Files modified:** 20

## Accomplishments

- **The large sheet.** `Sheet.svelte` takes `size="large"`.
  - From 600 px wide it is `min(880, 100vw − 32) × min(720, 100dvh − 16)`, centred. Under 600 px it fills the width and `100dvh − 8` from the bottom.
  - The header holds the title and a 44 × 44 `x` named « Fermer les règles ». There is no bottom button.
  - The normal size is unchanged.
- **`RulesSheet.svelte`.**
  - The tablist has one tab stop and is vertical from a 656 px dialog (208 px nav). Under that it is a row of 44 px chips that scrolls sideways.
  - Arrows (Haut/Bas or Gauche/Droite, wrapping), Début and Fin move between tabs. Each panel scrolls on its own and goes back to its top on a tab change.
  - It opens on « Les cartes » in a game, or on the last tab opened in this game.
  - The chosen card's row is outlined in cream, scrolled into view and named « …, ta carte choisie. ».
  - « Voir « Le Valet » » and « Voir « Le 7 » » open those tabs.
- **The book button.**
  - `RulesButton` is 44 × 44, `book-open`, « Règles du jeu », with `aria-keyshortcuts="R"` and a KeyHint shown on fine pointers.
  - On the phone it sits in the right strip under the gear. The strip's bottom block got `calc(100% − 3 × 44 − 4 × 4)`.
  - On the computer it is first in the info column's row: alone in solo, then « À la table » and « Messages » online.
- **The hold.** In a local game, `hold()` waits while `rulesShown || rulesOpen.count > 0`. Every hold is released on close and on destroy. Online it never waits (T-05-09).
- **« R ».**
  - `keyIntent` opens the rules in every state. Inside the sheet it closes them, and nothing else reaches the game. Under another sheet, in a field, with a modifier or on repeat it does nothing.
  - « Raccourcis clavier » has the row « R — Ouvrir les règles. ».
- **The figures.**
  - `ruleFigures.ts` holds the fifteen positions in PawnSpec form. They become places through the engine's `scenarioState` and `placeOf`.
  - `RuleFigure.svelte` draws two BoardArt halves (k 0, Bleu's seat), each with def ids prefixed `regle-<id>-<half>-`. The game's knights stand on them with their marks (following « Formes sur les chevaux »).
  - « Avant » / « Après » or « Avant » / « Le coup » appear as HTML pills. The drawing is one `role="img"` named by the alt sentence, followed by the caption.
  - The test checks every figure against its scenario, and no release file imports the scenario set.
- **Online.** The turn line sits at the top of the panel and stays in view while the panel scrolls: a bois sombre pill with an amber dot, « C’est à toi de jouer. » and « Revenir à la partie ». Its polite live region is always mounted, so the sentence is announced once. The sheet never closes by itself.
- **Icons.** book-open, graduation-cap, trophy, history and chart-column are in `icons.ts`, so later plans need not touch it.
- **05-UAT.md.** It is created in the 04-UAT format with two pending tests:
  1. The full text of the ten tabs, the cards list and the fifteen captions, for Romain to review.
  2. The rules during a game.

## Task Commits

1. **Task 1 RED:** `e3b7f3b` test(05-04): the rules sheet at any moment of a game (RED)
2. **Task 1 GREEN:** `6d5e9fa` feat(05-04): « Règles du TOC » from the book or « R », with the computers waiting in solo
3. **Task 2 RED:** `57bf869` test(05-04): fifteen live rule figures (RED)
4. **Task 2 GREEN:** `17a505a` feat(05-04): fifteen rule figures drawn live on the galet
5. **Task 3 RED:** `19e58a9` test(05-04): the online turn inside the rules sheet (RED)
6. **Task 3 GREEN:** `4cc43d3` feat(05-04): « C’est à toi de jouer » inside the rules sheet online, and Romain's text review

## Gate

- `pnpm typecheck` OK. `pnpm lint` OK (405 files).
- `pnpm test`: 128 files, 2053 passed, 2 skipped.
- Local Playwright, both projects: 491 passed, 107 skipped (8.1 min).
- Online suite (`playwright.online.config.ts`): 112 passed, 2 skipped (7.6 min).
- The suites ran one after another. Afterwards nothing was listening on 8787, 4173 or 4174 (checked by connecting). The screenshot preview server was stopped by its PID.

## Bundle size (release build, `pnpm --filter @toc/web build`, for 05-11)

| | Before 05-04 | After 05-04 | Change |
|---|---|---|---|
| `apps/web/dist` raw | 3 078 323 B | 3 101 638 B | +23 315 B |
| `dist` as one tar, gzip -9 | 2 037 861 B | 2 044 887 B | +7 026 B |
| main chunk `index-*.js` | 561 536 B | 580 470 B | +18 934 B |
| main chunk gzip -9 | 181 106 B | 187 321 B | +6 215 B |

`apps/web/public` has no `regles/` and no figure file. A grep of the release `dist` for the scenario titles (« réparti en 3 + 4 sur deux pions », « sur sa sortie ») finds nothing.

## Screenshots

These are in `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/`, taken with a debug build, reduced motion and DPR 2. I looked at them.

- `05-04-bande-844x390.png`, `05-04-bande-1280x800.png`: the book under the gear (phone), and under the team pills with its « R » badge (computer).
- `05-04-cartes-844x390.png`, `05-04-cartes-1280x800.png`: « Les cartes » with the Valet chosen. Its row is outlined, and on the phone it is scrolled into view.
- `05-04-cartes-figures-*.png`: the R-07.1 / R-08.1 figures under the list.
- `05-04-sept-*.png`, `05-04-sept-bas-*.png`: « Le 7 » and its two figures.
- `05-04-regles-maison-*.png`: « Règles de la maison ».
- `05-04-sortir-*.png`: R-06.1 « Avant » / « Le coup ».

What they show:
- Every text fits.
- The figures are crisp, with the stable marks and knight marks readable at 480 px.
- The 7's row is taller because its inline 44 px « Voir « Le 7 » » button sets the line height.

## Decisions Made

See `key-decisions` in the frontmatter. Two of them change what the UI-SPEC says:
- It allowed only « ? » and « M » under an online plate. « R » now works there too, since reading the rules harms nothing.
- It did not say where the turn line sits. I made it sticky at the top of the panel, so it stays visible however far the panel is scrolled.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `history` is only an alias in lucide-static 1.56**
- **Found during:** Task 1
- **Issue:** `icon-nodes.json` has no `history` entry. Only an SVG file of that name exists, and it is identical to `rotate-ccw-clock`.
- **Fix:** I added an `ALIASES` map in `tools/copy-vendor-assets.mjs`, so the UI-SPEC name `history` is kept and its drawing is read from `rotate-ccw-clock`. No new package.
- **Files modified:** tools/copy-vendor-assets.mjs, apps/web/src/ui/icons.ts
- **Commit:** 6d5e9fa

**2. [Rule 1 - Test count] The hint count in clavier.spec.ts**
- **Found during:** Task 1
- **Issue:** The book's « R » badge is a new visible key hint, so the « Entrée + 3 cards » count of the existing test went up by one.
- **Fix:** The expected count is now `1 + 3 + 1`, with a comment.
- **Commit:** 6d5e9fa

**3. [Rule 1 - Accessibility] Tab focus ring clipped by the nav's scroll box**
- **Found during:** Task 3
- **Issue:** The vertical nav scrolls (`overflow: auto`), which cut off the amber ring drawn 2 px outside a full-width tab.
- **Fix:** `.tab:focus-visible { outline-offset: -3px }` draws the ring inside the tab. The ring is still 3 px solid amber, and clavier.spec checks it.
- **Commit:** 4cc43d3

**4. [Plan wording] « the eleven card rows »**
- **Issue:** The plan's behaviour said « the eleven card rows », but the UI-SPEC cards list has seven rows covering the thirteen ranks.
- **Fix:** The e2e checks 7 rows and 13 chips, following the UI-SPEC table.

**5. [Spec detail] The tablist has `tabindex="-1"`**
- **Issue:** Svelte's a11y rules expect a focusable element when a keydown handler sits on a composite role.
- **Fix:** The tabs keep the single tab stop. The tablist itself is never in the Tab order.

I did not use `Pawn.svelte` for the figure knights, although the plan's action says « static Pawn knights ». Pawn sets `data-pawn` and an accessible name on every knight, which would duplicate the game's 16 `[data-pawn]` while the sheet is open over a game. The figure draws the same `#knight-{couleur}`, `#knight-shadow` and `#knight-mark-{couleur}` symbols at the same anchor and size (`anchorOf`, `knightScale`, `KNIGHT.feet`).

No package was added. No wrangler config, STATE.md, ROADMAP.md, REQUIREMENTS.md, CLAUDE.md or GSD config was touched.

## Known Stubs

None. « Apprendre en jouant » under the nav (outside games only) and the home and Réglages entries are 05-08's, as the plan's slice says. The `inGame` prop already chooses the opening tab.

## Threat Flags

None. No new endpoint, storage or trust boundary. The texts are static strings rendered as text (no-raw-html.test.ts passes).

## À confirmer par Romain (05-UAT.md)

1. **The whole text of the sheet** (test 1): ten tabs, the cards list and fifteen captions, all drafts (D-06).
2. **The rules during a game** (test 2): where the book is, the chosen card's outline, the computers waiting in solo, « C’est à toi de jouer » online, and whether the figures are readable on the iPhone. The figures are small at 480 px: knights about 15 px high.
3. **The five « Le coup » figures** (R-01.1, R-04.2, R-14.2 show only the stables with nothing ringed, like the docs pictures). Romain may prefer other figures for « Le but » and « Une donne ».

## Deploy Notes

No migration, secret or config change. The wrangler configs were not touched. Rebuild before deploying, as usual. The embedded Worker grows by about 23 KB raw (7 KB gzip).

## Self-Check: PASSED

- FOUND: apps/web/src/ui/RulesSheet.svelte, CardRule.svelte, RuleFigure.svelte, RulesButton.svelte, rulesOpen.svelte.ts, apps/web/src/i18n/fr/regles.ts, apps/web/src/game/ruleFigures.ts, ruleFigures.test.ts, apps/web/e2e/regles.spec.ts, apps/web/e2e-online/regles-en-ligne.spec.ts, 05-UAT.md
- FOUND commits: e3b7f3b, 6d5e9fa, 57bf869, 17a505a, 19e58a9, 4cc43d3
