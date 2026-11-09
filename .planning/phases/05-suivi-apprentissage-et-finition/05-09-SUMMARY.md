---
phase: 05-suivi-apprentissage-et-finition
plan: 09
subsystem: ui
tags: [svelte, results, history, stats, ranking, playwright, a11y]
status: complete

requires:
  - phase: 05-suivi-apprentissage-et-finition
    plan: 01
    provides: Results.svelte, GameRow.svelte, results/api.ts history(), results/format.ts rowOf(), HistoryPage
  - phase: 05-suivi-apprentissage-et-finition
    plan: 05
    provides: StatsAnswer, RankingAnswer, GET /api/me/stats, GET /api/me/ranking, POST /api/me/results/solo
  - phase: 05-suivi-apprentissage-et-finition
    plan: 07
    provides: solo games in the history and the figures, the plank lines in resultats.ts
provides:
  - "#/resultats, #/resultats/chiffres, #/resultats/classement: the navigation and the three panels"
  - "ResultsNav (stacked tabs or a segmented row), HistoryList (months, paging by 20, end line), GameSheet"
  - "StatsPanel with NumberTile: the filter, three tiles, knights, partners (8 then all), levels"
  - "RankingPanel with RankRow and RankingSheet: shared ranks, one's own row, unranked rows, empty states, « Le classement »"
  - "results/api.ts stats() and ranking() over one strict read; results/format.ts wording for months, the sheet, rates and the ranking"
affects: [05-10 accessibility audit (new routes, a live region, two new sheets), 05-11 deploy and UAT]

actuals:
  tokens: 25300
  tasks: 3
  commits: 7
plan_head_before: 9279474ba1698e5fc95f7565ee66f303b290fc97
plan_head_after: 0318ae0a372fb0594c3c04c1553a6cd66ed312c0

tech-stack:
  added: []
  patterns:
    - "One page with sub-routes in the hash: the page listens to hashchange, mounts one panel per tab ({#key}), and moves the focus to that panel's sr-only h2"
    - "Every GET of the page goes through one read<T>(path, parse), which maps 401, offline, any other status and out-of-shape answers"
    - "Intl always writes the rate; the space before % is then forced to U+202F"

key-files:
  created:
    - apps/web/src/ui/ResultsNav.svelte
    - apps/web/src/ui/HistoryList.svelte
    - apps/web/src/ui/GameSheet.svelte
    - apps/web/src/ui/StatsPanel.svelte
    - apps/web/src/ui/NumberTile.svelte
    - apps/web/src/ui/RankingPanel.svelte
    - apps/web/src/ui/RankRow.svelte
    - apps/web/src/ui/RankingSheet.svelte
  modified:
    - apps/web/src/routes/Results.svelte
    - apps/web/src/ui/GameRow.svelte
    - apps/web/src/results/api.ts
    - apps/web/src/results/api.test.ts
    - apps/web/src/results/format.ts
    - apps/web/src/results/format.test.ts
    - apps/web/src/i18n/fr/resultats.ts
    - apps/web/e2e-online/resultats.spec.ts
    - apps/web/e2e/lecons.spec.ts

key-decisions:
  - "A row's hook (data-game-row) is the game key without the account part of a solo id (« solo:<user_id>:<uuid> » becomes the uuid), so no account id reaches the DOM, not even the player's own"
  - "The end line « C’est tout… » shows only after a second page has loaded; with a single page, the left column's note already says the same"
  - "The space before « % » is always U+202F: Node's ICU writes U+00A0 there, and the catalogue's typography wants U+202F"
  - "Partner and level figures are Label 700 at the right of a 44 px row, so the longest line fits a 296 px column"
  - "« Créer une table en ligne » in the ranking runs the home's flow (POST /api/tables, markNewTable, then the table link). It skips the first-name prompt because the page is for accounts only"

requirements-completed: [HIST-02, HIST-03, HIST-04]

duration: 80min
completed: 2026-11-07
---

# Phase 5 Plan 09: « Mes résultats » en entier Summary

**#/resultats is now the whole page:**
- a « Mes résultats » navigation (« Historique », « Mes chiffres », « Classement »), on hash routes that the back button walks;
- the history by month, with « Voir les parties plus anciennes » and a detail sheet for each game;
- the figures, with their filter, tiles, knights, partners and computer levels;
- the friends ranking, with shared ranks, one's own row outlined in cream, « Pas encore au classement » and the « Le classement » sheet.

**It is proven end to end** with two friends, a guest, a computer and a solo game.

## Performance

- **Duration:** about 80 min (13:15 to 14:35 UTC). That includes four full local runs, because two unrelated timing flakes showed up.
- **Tasks:** 3, each RED then GREEN, plus one test-only fix.
- **Files:** 17 (8 created, 9 modified), +2 710 / −130 lines.

## Accomplishments

**Navigation (`ResultsNav`)**
- A `<nav>` named « Mes résultats » holds three hash links. The current one has `aria-current="page"` and a cream fill, never amber.
- In two columns and on the computer: three stacked tabs of 48 px in the left column, with the note « Les parties comptent depuis novembre 2026. » under them.
- Under 640 px wide and held upright: a segmented row of 44 px above the panel, with the note at the bottom of the page. Icons are hidden under 360 px.
- Changing tabs moves the focus to the panel's sr-only h2 (« Historique », « Mes chiffres », « Classement entre amis »). The back button walks the tabs.

**History (`HistoryList`)**
- Games are grouped under month headings (« Novembre 2026 »). A month with one game still gets its heading.
- « Voir les parties plus anciennes » (secondary, 48 px; « Chargement… » with `aria-busy` while loading) appends the next page after the cursor. It never adds a game twice.
- When nothing is left, the end line appears and the polite live region says « 25 parties ».
- A failing page shows the toast « Impossible de charger la suite. Réessaie dans un instant. » and the button stays.
- States: loading, then « La connexion est lente. » after 10 s; empty, with « Jouer contre l’ordinateur »; error, with « Réessayer ». A signed-out answer and the offline page are handled by `Results.svelte`.

**Detail sheet (`GameSheet`)**
- Title « Partie du samedi 24 octobre ». Kind: « En ligne, à la table de {Créateur} » or « Contre l’ordinateur ».
- The result, then the knights home for each team.
- « Ton équipe » and « L’équipe adverse »: a `SeatChip`, the name, and tags (« toi », « (sans compte) », « (ordinateur) », « l’ordinateur a fini à sa place »).
- The times « De 20 h 31 à 21 h 14 (43 min) » (« 1 h 05 » from one hour), the deals, the knights eaten per team, and the counting line (ranked, one account online, or solo).
- A computer always appears by its level. Closing the sheet gives the focus back to the row.

**Figures (`StatsPanel`, `NumberTile`)**
- The filter is `Segmented` « Parties comptées » with « Toutes » | « En ligne » | « Contre l’ordinateur ». It is not saved. A change is announced, for example « En ligne : 7 parties ».
- Three tiles in a `<dl>`, each 72 px high (Display number, Label under it): « Parties », « Victoires », « Réussite » (« 67 % », or « – » with no game).
- « Chevaux »: three 44 px rows.
- « Avec mes partenaires »: up to 8 rows, then « Voir tous mes partenaires ».
- « Contre l’ordinateur, par force », with its intro. It is shown for « Toutes » and « Contre l’ordinateur » only.
- Empty states: « Pas encore de chiffres », and « Aucune partie de ce genre pour l’instant. » for an empty filter.

**Ranking (`RankingPanel`, `RankRow`, `RankingSheet`)**
- The intro, then ranked rows (56 px): the rank (« 1er », « 2e »…), the initial disc, the pseudo with « toi », « {n} parties · {v} victoires » and the rate.
- One's own row has a 2 px cream outline inside it.
- Each row reads as one sentence, for example « 2e, Marie, 67 %, 12 parties, 8 victoires ».
- « Pas encore au classement » lists players with « {n} parties sur 5 ».
- No friends: « Pas encore d’amis sur TOC » with « Mes amis ».
- Friends but nobody ranked: « Personne n’est encore au classement » with « Créer une table en ligne ».
- « Comment ça marche ? » opens « Le classement », which holds the three D-13 paragraphs.

**API client (`results/api.ts`)**
- `stats()` and `ranking()` share `read<T>()` with `history()`. Every answer is parsed by its strict schema, and a hostile answer becomes the error state.

## Task Commits

1. **Task 1, the navigation, the history and the sheet:** `6131157` (test, RED), `2711cbc` (feat)
2. **Task 2, « Mes chiffres »:** `1cdb0bf` (test, RED), `8377aee` (feat)
3. **Task 3, « Classement » and the whole path:** `4155607` (test, RED), `66b2477` (feat)
4. **Test fix (gate):** `0318ae0` measures the lessons' guide band once it has settled

## Gate

| Suite | Result |
|-------|--------|
| `pnpm typecheck && pnpm lint && pnpm test` | green: **2167 passed, 2 skipped** (133 files; 2145 at 05-08) |
| Full local Playwright (`playwright.config.ts`) | **611 passed, 133 skipped, 0 failed** (9.7 min), on the fourth run. The first three each had one timing failure in a spec this plan does not touch (see Deviations). |
| Online Playwright (`playwright.online.config.ts`) | **126 passed, 8 skipped, 0 failed** (11.2 min). resultats.spec has 7 tests on two projects: 9 passed, 5 skipped (desktop-only and TOC_SHOTS cases). |
| Plan verify | node results, i18n and no-raw-html (101 passed); online resultats, solo-resultats and amis (22 passed in one run; the one failure in that run was fixed, see Deviations 1) |
| Ports 8787, 4173, 4174 after the runs | closed (checked by connecting) |

The suites ran one after another, never at the same time.

## Measures (the UI-SPEC's ≈ values re-measured)

| Viewport | Layout | Right column | Number tile | « 100 % » in Display | Rows in sight (history) |
|----------|--------|--------------|-------------|----------------------|-------------------------|
| 844 × 390 | two columns (280 + 480), stacked tabs 48 | 480 | 154.7 | 58 | 4 (UI-SPEC ≈ 4) |
| 1280 × 800 | computer (320 + 520) | 520 | 168 | 58 | 9 (UI-SPEC ≈ 9) |
| 750 × 342 | two columns | 414 | 132.7 | 58 | 3 |
| 640 × 360 | two columns | 304 (UI-SPEC 296) | 96 (UI-SPEC 93) | 58 (UI-SPEC ≈ 70) | 3 |
| 480 × 320 | one column, segmented row 44 | 448 | 144 | 58 | 2 |

- « Voir les parties plus anciennes » is 226 px (UI-SPEC ≈ 228).
- At 844 × 390, 750 × 342, 640 × 360, 480 × 320, 1280 × 800 and 390 × 844 (upright, not behind « Tourne ton téléphone »):
  - no panel scrolls sideways;
  - every link, button and radio in the page is at least 44 × 44 (e2e « tient à chaque taille »);
  - the number tiles stay 72 px high.

## Screenshots (looked at)

In `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/` (TOC_SHOTS test in resultats.spec.ts, answers served by the test, reduced motion):
- `05-09-historique-844x390.png`, `05-09-historique-1280x800.png`: two months, three rows (online win, solo loss, a 20-character pseudo cut by an ellipsis), the cream current tab and the note.
- `05-09-fiche-844x390.png`, `05-09-fiche-1280x800.png`: an online game. A guest's seat finished by the computer reads « Mamie (sans compte) l’ordinateur a fini à sa place », and the computer reads « Pur-sang (ordinateur) ». At 844 × 390 the teams and the facts scroll inside the sheet, as in the UI-SPEC fit.
- `05-09-chiffres-844x390.png`, `05-09-chiffres-1280x800.png`: the filter, the three tiles (« 67 % »), « Chevaux »; at 1280 × 800 also the partners and the levels.
- `05-09-classement-844x390.png`, `05-09-classement-1280x800.png`: « 1er », « 2e », « 2e », « 4e ». One's own row has the cream outline and « toi », with no amber anywhere. Then « Pas encore au classement » and « Comment ça marche ? ».
- `05-09-le-classement-844x390.png`, `05-09-le-classement-1280x800.png`: the three paragraphs; they scroll inside the sheet at 844 × 390.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test] The 640 × 360 tile check measured during the resize**
- **Found during:** Task 3 verify (online resultats + solo-resultats + amis)
- **Issue:** Right after `setViewportSize(640 × 360)`, the page could still have the computer grid. That leaves a 208 px column, and « 100 % » overflowed for a moment.
- **Fix:** The test waits for `main[data-layout="two"]` before measuring.
- **Commit:** `66b2477`

**2. [Rule 2 - Security] No account id in a row's hook**
- **Issue:** 05-01's `data-game-row={game.id}` would put « solo:<user_id>:… » in the DOM for every solo game. The plan forbids any account id in the DOM.
- **Fix:** Added `gameKey()`, which drops the account part (unit-tested). The paging e2e asserts that the player's own id is nowhere in the page, and the path asserts the same for B's id.
- **Commit:** `2711cbc`

**3. [Rule 1 - Correctness] Node writes U+00A0 before « % »**
- **Issue:** `Intl.NumberFormat("fr", { style: "percent" })` gives « 67 % » with U+00A0 under Node's ICU. The UI-SPEC wants U+202F.
- **Fix:** `rate()` keeps Intl's rounding and digits and replaces the separator with U+202F.
- **Commit:** `8377aee`

**4. [Rule 3 - Blocking, test only] The lessons' guide-band measurement flaked twice under the full suite**
- **Found during:** the gate
- **Issue:** `e2e/lecons.spec.ts` « chaque phrase du guide dans la bande à 750 x 342 » read a band line as clipped: lesson 2 in run 1, lesson 7 in run 2. The cases passed 24/24 alone. 05-07 saw the same thing at 480 × 320.
- **Fix:** The case now polls for up to 2 s until the band reads as not clipped, then measures. A real clip still fails.
- **Logged in:** `deferred-items.md` (the root cause belongs to the lessons).
- **Commit:** `0318ae0`

### Other adjustments

- **`ranking()` landed in Task 2's commit.** It shares `read<T>()` with `stats()`. Its RED tests in Task 3 (`api.test.ts`) were green on arrival; the format and e2e parts of Task 3's RED failed as expected.
- **The e2e RED runs were not executed** (they need the full server build). The node RED runs were executed and failed as expected each time. Every e2e case then passed in GREEN.
- **Several e2e cases use answers served by `page.route`:** nine partners, the empty states, ties and one's own row, the six-size fit, and the screenshots. The real data path is the long test: two friends, Mamie, a computer and a solo game.
- **Unrelated flake, not fixed:** `e2e/reflexion.spec.ts` « au tour d’un ordinateur… » failed once on the phone project in run 3 (the computer's turn had passed before the check). It passed 24/24 alone and in run 4. No change was made.
- **The empty history's « Jouer contre l’ordinateur »** is now a link styled as the primary button (`#/ordinateur`), like the ranking's « Mes amis ».

No package, migration, wrangler or Durable Object change. STATE.md, ROADMAP.md, REQUIREMENTS.md, CLAUDE.md and the GSD config are untouched.

## Known Stubs

None. 05-01's stub (« the row is a button with no action yet ») is resolved: the row now opens its sheet.

## Threat Flags

None beyond the plan's threat model. Its mitigations are in place:

| Threat | Mitigation |
|--------|------------|
| T-05-25 | Text bindings only, so pseudos and guest names never become markup; no-raw-html test green; names in `title` attributes are plain text |
| T-05-26 | No account id in the DOM: rows use `gameKey`; the e2e checks the page for the player's own id and B's id |
| T-05-27 | Every answer is parsed by its strict schema; a failure shows the error state with « Réessayer » (api tests for hostile answers, e2e for a 503) |
| T-05-SC | No package added |

## Deploy Notes

- **Front end only:** no migration, no secret, no wrangler change, no new package. Rebuild and deploy as usual.
- The panels read GET /api/me/stats and GET /api/me/ranking (05-05). They need 0003_results.sql on the remote D1 before this Worker is deployed. That is the orchestrator's step in 05-11, and this plan did not run it.
- No remote command was run.

## Pour la recette (05-UI-SPEC « À confirmer » 4 à 7, et les points non résolus, pour 05-11)

4. **Les invités et les ordinateurs dans l’historique**
   - Un invité s’affiche « Mamie (sans compte) » dans les lignes. Dans la fiche d’une partie, c’est « Mamie » suivi de l’étiquette « (sans compte) ».
   - Les ordinateurs apparaissent par leur force (« Pur-sang », ou « Pur-sang (ordinateur) » dans la fiche), jamais par leur nom de cheval.
5. **Ce qui compte**
   - Une place confiée à l’ordinateur en cours de partie compte pour le compte qui l’avait. La fiche l’indique par « l’ordinateur a fini à sa place ».
   - Chaque fiche dit à quoi la partie compte : « Cette partie compte pour le classement entre amis. », « Elle ne compte pas pour le classement : il faut au moins deux joueurs avec un compte. » ou « Partie contre l’ordinateur : elle compte dans tes chiffres, pas au classement. ».
   - La ligne « C’est tout : les parties comptent depuis novembre 2026. » ne s’affiche qu’après avoir chargé une deuxième page.
6. **Mes chiffres**
   - Les trois nombres (« Parties », « Victoires », « Réussite »), les chevaux, les partenaires (8, puis « Voir tous mes partenaires ») et les forces, avec le filtre « Toutes », « En ligne », « Contre l’ordinateur ».
   - Dans « Avec mes partenaires », tous les invités sont regroupés sous « Joueurs sans compte ».
7. **Le classement entre amis**
   - On y entre après 5 parties classées. On classe au pourcentage de victoires, puis au nombre de victoires, puis au nombre de parties. Les ex æquo partagent leur rang (« 1er, 2e, 2e, 4e »).
   - Sa propre ligne est entourée de crème et porte « toi ».
   - « Comment ça marche ? » ouvre « Le classement ».

Points non résolus (UI-SPEC « UI Considerations ») :
- **Deux amis aux pseudos proches** : seuls le rond à l’initiale et le pseudo complet les distinguent, comme dans « Mes amis » (04). On suppose que cela suffit en famille.
- **Pas de classement par équipe de deux** : « Avec mes partenaires » donne les résultats de chacun avec chaque partenaire. Un classement par paires pourra venir si la famille le demande.

## Self-Check: PASSED

- FOUND: ResultsNav.svelte, HistoryList.svelte, GameSheet.svelte, StatsPanel.svelte, NumberTile.svelte, RankingPanel.svelte, RankRow.svelte, RankingSheet.svelte (apps/web/src/ui/)
- FOUND commits: 6131157, 2711cbc, 1cdb0bf, 8377aee, 4155607, 66b2477, 0318ae0 (ancestors of HEAD)
- Acceptance greps: data-results-tab, data-game-sheet, « Voir les parties plus anciennes », data-number-tile, api/me/stats, data-rank-row, « Comment ça marche », « 1 partie sur 5 » all present
