---
phase: 05-suivi-apprentissage-et-finition
plan: 10
subsystem: ui
tags: [a11y, axe, playwright, wcag, keyboard, svelte]
status: complete

requires:
  - phase: 05-suivi-apprentissage-et-finition
    plan: 08
    provides: the home's links row, « Première fois ? », « Apprendre à jouer »
  - phase: 05-suivi-apprentissage-et-finition
    plan: 09
    provides: « Mes résultats » (three panels, the detail sheet, « Le classement »)
provides:
  - "e2e/audit.ts: audit(page, surface) — axe (WCAG 2.0/2.1 A and AA, the board drawing left out), 44 px targets, accessible names, the French deny-list, one main and one h1, lang fr"
  - "e2e/accessibilite.spec.ts (local) and e2e-online/accessibilite.spec.ts (Worker): every surface of the UI-SPEC audit list at 844 x 390, 750 x 342, 480 x 320 and 1280 x 800"
  - "contrast.test.ts (token pairs), i18n/denyList.ts + denyList.test.ts (catalogue), i18n/literals.ts (shared literal reader)"
  - "board/knightName.ts: « Cheval bleu A, à toi, à 12 cases de sa sortie », used by Pawn and HitLayer"
  - "clavier.spec.ts: the phase's new screens with the keyboard alone, the amber ring, Échap back to the opener"
affects: [05-11 deploy and UAT (VoiceOver, à confirmer items below)]

actuals:
  tokens: 23500
  tasks: 3
  commits: 5
plan_head_before: 152a7b81cb16917d47b6a0e12dc40edf6b546b4c
plan_head_after: ed7e50e5e0194d7d53a0c13f20174c8bd365207e

tech-stack:
  added:
    - "@axe-core/playwright 4.14.0 (devDependency of apps/web, exact pin; brings axe-core 4.14.0)"
  patterns:
    - "One audit helper for both e2e suites; each test gathers the findings of its surfaces and asserts the list empty, so a failure prints every finding at once"
    - "WCAG 2.5.3 « Label in Name »: an aria-label holds the control's visible words in order, then any extra; decorations that are not words of the label (key badges, card indices) are painted by CSS from an attribute"

key-files:
  created:
    - apps/web/e2e/audit.ts
    - apps/web/e2e/accessibilite.spec.ts
    - apps/web/e2e-online/accessibilite.spec.ts
    - apps/web/src/contrast.test.ts
    - apps/web/src/i18n/denyList.ts
    - apps/web/src/i18n/denyList.test.ts
    - apps/web/src/i18n/literals.ts
    - apps/web/src/board/knightName.ts
    - apps/web/src/board/knightName.test.ts
  modified:
    - apps/web/package.json
    - pnpm-lock.yaml
    - apps/web/src/board/Pawn.svelte
    - apps/web/src/board/HitLayer.svelte
    - apps/web/src/board/FeltTable.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/ui/Card.svelte
    - apps/web/src/ui/KeyHint.svelte
    - apps/web/src/ui/SeatTile.svelte
    - apps/web/src/account/flow.ts
    - apps/web/src/results/format.ts
    - apps/web/src/i18n/fr/board.ts
    - apps/web/src/i18n/fr/game.ts
    - apps/web/src/i18n/fr/accueil.ts
    - apps/web/src/i18n/fr/compte.ts
    - apps/web/src/i18n/fr/lecons.ts
    - apps/web/src/i18n/fr/table.ts
    - apps/web/src/i18n/fr/resultats.ts
    - apps/web/src/i18n/typography.test.ts
    - apps/web/e2e/clavier.spec.ts
    - apps/web/e2e/cibles.spec.ts

key-decisions:
  - "axe 4.14 runs label-content-name-mismatch (WCAG 2.5.3) under wcag21a; it gave 518 of the 778 findings. Fixed by names, not exempted: each name now holds the visible words in order"
  - "Key badges (« Entrée », « R », « 1 »…) and the cards' printed indices are painted by CSS from an attribute: they are a keyboard cue and the picture of a card, not words of the control's label; both were already aria-hidden"
  - "Short and full labels agree: « Autre carte » / « Choisir une autre carte », « Retirer » / « Retirer le dernier pas », « Effacer » / « Tout effacer » (à confirmer par Romain)"
  - "The audit measures after two quiet frames: a 150 ms fade read mid-way gave a false contrast finding on the backup code screen; this is a measuring fix, not an exemption"
  - "In a lesson, Entrée presses « Suivant » only when no other control has the focus"

requirements-completed: [APP-05]

duration: 100min
completed: 2026-11-07
---

# Phase 5 Plan 10: L’audit d’accessibilité de chaque écran, et ses corrections Summary

**Every screen is now measured at four sizes by axe and by the project's own checks (44 px, names, French, structure), and every finding is fixed; the knights are named in full, the token contrast and the catalogue's French are unit-tested, and the phase's new screens work with the keyboard alone.**

## Package legitimacy

- Romain's approval, 05-CONTEXT.md addendum, 2026-11-07: **« D-10: `@axe-core/playwright` approved as a test-only dev dependency for the APP-05 audit. « Oui (Recommandé) » »**. It is the blocking human gate of this install (the research flagged it [SUS] for recency and unknown downloads only).
- Installed with `pnpm --filter @toc/web add -D -E @axe-core/playwright@4.14.0`, nothing else. The lockfile adds exactly two packages.
- What landed (checked on disk):

| Package | Version | Licence | Repository | Install scripts |
|---------|---------|---------|------------|-----------------|
| @axe-core/playwright | 4.14.0 | MPL-2.0 | github.com/dequelabs/axe-core-npm | none |
| axe-core | 4.14.0 | MPL-2.0 | github.com/dequelabs/axe-core | none |

- Its peer `playwright-core` resolves to the repo's 1.64.0. It is a devDependency of apps/web only, imported only by `e2e/audit.ts`, so the release build does not contain it (05-11's check-bundle and dry run confirm the Worker bundle).
- The API was checked against the installed types (research A2): default export `AxeBuilder`, `withTags`, `exclude`, `analyze`, as assumed.

## The audit

`audit(page, surface)` (e2e/audit.ts), for each surface:
- reduced motion, then waits until no finite animation runs (two quiet readings, each after two frames);
- **axe** with `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, excluding only `[data-board-art]` (the board drawing, whose numbers are decorative). axe leaves disabled controls out of `color-contrast` itself. These are the UI-SPEC's two exemptions; no other was added;
- **44 × 44** (0.2 px tolerance, no exception) for every visible button, link, field, tab, switch, radio, card, chip, step, focusable element and knight hit circle;
- a **non-empty accessible name** for each;
- the **deny-list** (« Loading », « Error », « Close », « Cancel », « Submit », « OK », « undefined », « null », « NaN », « [object ») over the visible text, every aria-label, title, alt and placeholder, the svg titles, the document title and Playwright's accessibility tree;
- **one main, one h1, `lang="fr"`**.

Surfaces, each at 844 × 390, 750 × 342, 480 × 320 and 1280 × 800 (desktop project, explicit viewports):
- **Local** (`e2e/accessibilite.spec.ts`, 45 tests): the home as a guest with « Réglages », « Crédits et licences », « Règles » from « Réglages » and from the tile, « Se connecter »; the home with a first name and three tables in « Mes parties en cours »; « Raccourcis clavier »; « Première fois ? » on a new device; the iPhone install strip and « Installer TOC »; « Retrouver mon compte »; « Apprendre à jouer », lesson 1 (guide, the ringed As), « Les leçons », « Bravo ! »; the solo setup and its « Réglages »; the game in each turn state of compact.spec.ts (idle, the As question, two lit knights, preview, the Valet's two steps, « Lequel ? », the 7 empty / seven chips / all spread, dead hand, posed, waiting for the computers, the exchange and a chosen card); the game's « Réglages », « Règles », « Sur le tapis », « Infos de la partie » (pill sizes); the end plank. Plus one test of the knights' full names.
- **Online** (`e2e-online/accessibilite.spec.ts`, 8 tests): a used and a fresh invitation, the backup code and its question, the home signed in, « Mon compte », « Mes amis » with « Inviter un proche », « Ajouter avec un code » and « Donner mon code », « Mes résultats » empty, then the history, the detail sheet, « Mes chiffres », « Classement » and « Le classement » (answers served by the test, as in resultats.spec.ts); a guest's first-name prompt, the waiting room, « Inviter à la table », « Réglages », « Messages rapides », the online game and its « Messages rapides ».

## Findings and fixes

The RED run (Task 1) gave **778 finding lines** over the surfaces and sizes (518 axe `label-content-name-mismatch`, 168 axe `aria-prohibited-attr`, 92 « 0 h1 »), plus the knights' names. Nothing was found for 44 px targets, missing names, the deny-list, `lang`, `main`, or the token contrast.

| # | Surface (sizes) | Rule or check | Element | Fix |
|---|-----------------|---------------|---------|-----|
| 1 | Every game state, lessons, online game (all four) | axe label-content-name-mismatch (WCAG 2.5.3) | the hand's cards: corners « A ♠ » read as « A A » vs « As de pique, jouable » | The indices and pips are painted by CSS from `data-glyph` (Card.svelte), as the court figures are pictures; the card's only text is its name |
| 2 | Game, lessons, online (all four, fine pointer) | axe label-content-name-mismatch | buttons with a key badge: « Jouer » + « Entrée », « Passer » + « Entrée »/« P », « Retirer le dernier pas » + « ⌫ », « Sortir » + « S », « +1 » + « A » | KeyHint paints its key from `data-key-hint` (CSS `content: attr()`); the badge stays aria-hidden and looks the same |
| 3 | Game (844, 750, 480) | axe label-content-name-mismatch | compact « Autre carte » named « Changer de carte » | Full name « Choisir une autre carte » (game.buttons.changeCard) |
| 4 | Game, the 7 (all four) | axe label-content-name-mismatch | compact « Effacer » named « Tout annuler »; « Retour » named « Retirer le dernier pas » | Full label « Tout effacer »; compact « Retirer » |
| 5 | Home, every page with the tiles (all four) | axe label-content-name-mismatch | small tiles: « Règles » (« Règles du jeu »), « Apprendre » (« Apprendre à jouer (…) »), « Se connecter » (« Se connecter ou créer un compte »), « Ton prénom » (« Changer de prénom (…) »), « Mes résultats », « Mes amis », « Mon compte (…) » | Each name is its two lines in order: « Règles : les cartes, le 7, la maison », « Apprendre : en 10 minutes », « Se connecter : créer un compte », « Ton prénom : Marie », « Mes résultats : parties et classement », « Mes amis : inviter un proche », « Mon compte : Zoé » |
| 6 | « Apprendre à jouer », « Les leçons » (all four) | axe label-content-name-mismatch | lesson rows « Leçon 1, Sortir un cheval » vs visible « 1 Sortir un cheval Environ 1 minute » | « Leçon 1, Sortir un cheval, environ 1 minute » (« …, faite » unchanged) |
| 7 | Game, pill sizes (844, 750, 480) | axe label-content-name-mismatch | the info pill shows « 0–0 » | « Infos de la partie : À toi de jouer, 0–0, nous 0 sur 8, eux 0 sur 8 » |
| 8 | « Mes résultats » history (all four, online) | axe label-content-name-mismatch | rows named « Victoire, 8 à 5, le 6 novembre à 21 h 14, … » | The row's visible words in order, then the kind: « Victoire · 8 – 5, Avec Marie · contre Paul et Pur-sang, 6 nov., 21 h 14, en ligne » |
| 9 | Waiting room (all four, online) | axe label-content-name-mismatch | the partner's free seat shows « Partenaire » | « Prendre la place Rouge, ordinateur Galopeur, partenaire » (the tag joins every seat's sentence; aria-describedby dropped); the creator's move button follows the same rule: « Jaune : Bruno, en ligne, déplacer » |
| 10 | Home with tables (all four) | axe label-content-name-mismatch | « Mes parties en cours » rows « Reprendre la partie : … Ta couleur : Bleu. » | « Bleu, {line 1}, {line 2}, reprendre la partie » |
| 11 | Every game surface (all four) | axe aria-prohibited-attr (WCAG 4.1.2) | the felt's talon and défausse `<g aria-label>` without a role | `role="img"` (FeltTable.svelte) |
| 12 | Game, lessons, end plank, game sheets (all four) | structure: 0 h1 | the game screen had no h1 | An sr-only h1 (« Partie contre l’ordinateur », « Partie en ligne », « Leçon 1 : Sortir un cheval »), not drawn while « Tourne ton téléphone » shows its own |
| 13 | Backup code (480 and 1280, one run) | axe color-contrast | text read during the screen's 150 ms fade-in | A measuring fix: the audit now waits two quiet frames (a transition may start a frame after its element). The colours themselves pass (crème on noyer 15:1) |
| 14 | Every knight | knight names | « Cheval bleu » only | knightName (Task 2) |
| 15 | A lesson (keyboard, Task 3) | focus | Entrée on the focused lesson pill pressed « Suivant » | Entrée presses « Suivant » only when no other control has the focus |

- **« Crédits et licences »**: the plan expected text links under 44 px. There are none: the sources and URLs are plain text, not links, so there was nothing to fix.
- **Contrast** (`contrast.test.ts`): every declared pair passes; the lowest text pair is crème atténuée on bois sombre (6.39:1), the highest crème on noyer (15.4:1). White on `PALETTE.hex.vert` is only 4.41:1, but it is used only for the board drawing's decorative « 16 » / « 18 » cell numbers, which the UI-SPEC exempts, so it is not in the test.
- **Deny-list** (`denyList.test.ts`): the catalogue holds none of the words. The test stays as a guard.

## Knight names

`knightName(pawn, place, human, names, { lit, target })` (board/knightName.ts, strings in i18n/fr/board.ts):
- « Cheval bleu A, à toi, à 12 cases de sa sortie », « Cheval rouge C, à ton partenaire Marie, à l’écurie », « Cheval jaune B, adversaire, à la maison », « sur sa case de sortie », « à 1 case » in the singular, counted from each colour's own exit;
- « , jouable » when lit, « , à toucher » for a lesson's target.
- Pawn.svelte uses it for every knight (lit or not) and HitLayer for the lit knights' buttons. Game.svelte passes the human seat and `session.names`: the people's names online, the horse names in solo. game.hand.pawn and game.hand.place are gone (one source).

## Keyboard (Task 3)

clavier.spec.ts, desktop, six new tests:
- the home: gear, the two choices, « Se connecter », « Règles », « Apprendre »; « Règles » opens and Échap gives the focus back to the tile;
- « Apprendre à jouer »: the h1 has the focus, « Accueil » just before it, then « Commencer », « Règles du jeu », the eight lessons; the rules sheet gives the focus back;
- a lesson: Entrée presses « Suivant »; the pill opens « Les leçons » with Entrée and gets the focus back after Échap;
- « Règles »: Bas, Fin, Début, Haut choose the tab and the ring follows;
- « Règles » over « Réglages »: Échap closes the top one and gives the focus to « Règles du jeu », then to the gear;
- « Mes résultats »: « Accueil », the three tabs, the rows; a row's sheet and « Le classement » give the focus back; Entrée on « Mes chiffres » focuses the panel's heading.
- Each control the focus reaches shows the amber ring (computed outline 3 px solid rgb(255, 176, 46)).
- The one gap found (row 15 above) is fixed in Game.svelte.

cibles.spec.ts also measures the book « Règles du jeu », « Suivant » and the lesson pill at its five viewports.

## Task Commits

1. **Task 1, the audit (RED):** `795d593`
2. **Task 2, the knights' names (RED):** `6a431b5`; **every finding fixed (GREEN):** `b5092f2`
3. **Task 3, the keyboard (RED):** `dbb7dde`; **the lesson's Entrée (GREEN):** `ed7e50e`

## Gate

| Suite | Result |
|-------|--------|
| `pnpm typecheck && pnpm lint && pnpm test` | green: **2182 passed, 2 skipped** (136 files; 2167 at 05-09) |
| Full local Playwright (`playwright.config.ts`) | **667 passed, 189 skipped, 0 failed** (11.7 min), first run |
| Online Playwright (`playwright.online.config.ts`) | **134 passed, 16 skipped, 0 failed** (12.1 min), second run. The first run had 133 passed and 1 failed: `compte.spec.ts` « l’écran du code ne se quitte pas par mégarde… » on the phone project measured the backup-code panel at 80 px instead of 56 right after a resize. That test and screen are untouched by this plan; it passed 8/8 alone and in the second full run. Logged in `deferred-items.md`. |
| Plan verifies | Task 1: the package check script, `pnpm install --frozen-lockfile`, typecheck, lint. Task 2: node tests, typecheck, lint, accessibilite + cibles + board + partie (local), accessibilite (online). Task 3: typecheck, lint, clavier + accessibilite. All green |
| Ports 8787, 4173, 4174 after the runs | closed (checked by connecting) |

The suites ran one after another, never at the same time.

## Screenshots (looked at)

In `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/`, reduced motion:
- `05-10-partie-cartes-844x390.png`, `05-10-partie-cartes-1280x800.png`: the hand's indices and pips and the key badges, now painted by CSS, look as before (« A ♠ », « 7 ♥ », « D ♦ », badges « 1 »…« 5 », « R », « Entrée »).
- `05-10-partie-autre-carte-844x390.png`, `05-10-partie-autre-carte-1280x800.png`: « Autre carte » on the phone strip, « Choisir une autre carte » in the computer's bar; it fits the bar.
- `05-10-sept-844x390.png`, `05-10-sept-1280x800.png`: the 7: « Retirer » / « Effacer » in the strip, « Retirer le dernier pas » / « Tout effacer » in the bar, with « ⌫ » and « Entrée ».
- `05-10-accueil-844x390.png`, `05-10-accueil-1280x800.png`: the home's tiles, unchanged to the eye.
- `05-10-lecon-844x390.png`, `05-10-lecon-1280x800.png`: lesson 1 with the guide, « Suivant » and its « Entrée » badge.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] WCAG 2.5.3 names across the app (findings 1 to 10)**
- **Found during:** Task 1 (axe `label-content-name-mismatch`)
- **Issue:** 518 findings: names that did not contain the controls' visible words.
- **Fix:** names rebuilt from the visible words; key badges and card indices painted by CSS.
- **Files outside the plan's list:** ui/KeyHint.svelte, ui/SeatTile.svelte, account/flow.ts, results/format.ts, i18n/fr/{game,accueil,compte,lecons,table,resultats}.ts, board/HitLayer.svelte, board/FeltTable.svelte. The specs that looked controls up by the old names follow the new ones (accueil, apprendre, cartes-speciales, cibles, clavier, finition, lecons; online accueil, compte, connexion, resultats, salle, solo-resultats; unit flow.test, format.test).
- **Commit:** `b5092f2`

**2. [Rule 1 - Bug] Entrée in a lesson (finding 15)**
- **Found during:** Task 3
- **Fix:** routes/Game.svelte. **Commit:** `ed7e50e`

**3. [Rule 3 - Blocking] The catalogue's literal reader shared**
- **Issue:** denyList.test.ts needs typography.test.ts's `stringLiterals`; importing one test file from another would run its tests twice.
- **Fix:** moved to `i18n/literals.ts`, imported by both; `deniedWords` lives in `i18n/denyList.ts`, imported by the unit test and by e2e/audit.ts. **Commit:** `795d593`

**4. [Rule 1 - Test] The audit read a fade (finding 13)**
- **Fix:** settle() waits for two quiet readings after two frames. **Commit:** `b5092f2`

### Other adjustments

- contrast.test.ts reads app.css from disk through `process.getBuiltinModule("node:fs")`: the web tsconfig has no Node types, and Vite's `?raw` of a CSS file is empty under Vitest.
- The deny-list and contrast unit tests were green on arrival (no finding); they stay as guards.
- No new colour or size token; app.css is unchanged.

No migration, wrangler or Durable Object change. STATE.md, ROADMAP.md, REQUIREMENTS.md, CLAUDE.md and the GSD config are untouched.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model:

| Threat | Mitigation |
|--------|------------|
| T-05-SC | D-10 quoted above; exact pin 4.14.0; version, axe-core version, licence, repository and the absence of install scripts checked; lockfile committed |
| T-05-28 | devDependency of apps/web only, imported only by e2e/audit.ts |
| T-05-29 | No exemption beyond the UI-SPEC's two; every finding and its fix above |

## Deploy Notes

- Front end and tests only: no migration, no secret, no wrangler change. The new devDependency is not shipped.
- 0003_results.sql must still be applied to the remote D1 by the orchestrator before the Worker is deployed (05-09's note). No remote command was run.

## Pour la recette (05-11)

À confirmer par Romain :
1. **Les noms courts et longs des boutons** s’accordent maintenant : « Autre carte » / « Choisir une autre carte » (avant : « Changer de carte »), « Retirer » / « Retirer le dernier pas » (avant : « Retour »), « Effacer » / « Tout effacer » (avant : « Tout annuler »).
2. **Ce que lit le lecteur d’écran** sur les petites tuiles, les leçons, la pastille d’infos, les lignes de l’historique et les places de la salle d’attente : les mots affichés, dans l’ordre, puis le reste (« Règles : les cartes, le 7, la maison », « Victoire · 8 – 5, Avec Marie · contre Paul, 6 nov., 21 h 14, en ligne »).
3. **Les chevaux** sont lus en entier : « Cheval rouge C, à ton partenaire Marie, à l’écurie ». À écouter avec VoiceOver sur l’iPhone (le plateau, les chevaux éclairés).

## Self-Check: PASSED

- FOUND: e2e/audit.ts, e2e/accessibilite.spec.ts, e2e-online/accessibilite.spec.ts, src/contrast.test.ts, src/i18n/denyList.ts, src/i18n/denyList.test.ts, src/i18n/literals.ts, src/board/knightName.ts, src/board/knightName.test.ts (apps/web/)
- FOUND commits: 795d593, 6a431b5, b5092f2, dbb7dde, ed7e50e (ancestors of HEAD)
- Acceptance greps: `AxeBuilder` in audit.ts, `"@axe-core/playwright": "4.14.0"` in package.json, `knightName` in Pawn.svelte, « à ton partenaire » in board.ts
- 10 screenshots 05-10-*.png in the scratchpad, looked at
