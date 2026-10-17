---
phase: 02-jouer-en-ligne-entre-proches
plan: 04
status: complete
subsystem: online-table
tags: [svelte5, home, routing, first-name, durable-objects, workerd, localStorage, playwright]

requires:
  - phase: 02-jouer-en-ligne-entre-proches
    provides: "02-01 the Worker router, GameRoom, the table route and NamePrompt; 02-03 the online computers"
provides:
  - "« Accueil » at #/ (Home.svelte, ChoiceTile.svelte) in four layouts; the solo setup at #/ordinateur with « Accueil » in its button row"
  - "Six Lucide icons for the phase (users, share-2, message-circle, wifi-off, bot, crown) in ui/icons.ts"
  - "@toc/protocol TableSummary (status lobby | playing | paused | saved | finished) and parseTableSummary; @toc/table summary(table); GameRoom.summary() RPC; GET /api/tables/:id"
  - "apps/web net/api.ts: createTable(), tableSummary(id), browserApi"
  - "NamePrompt: screen form and the sheet « Changer de prénom », busy and create errors"
  - "apps/web net/tables.ts (toc.tables.v1: loadTables, rememberTable, forgetTable, restoreTable, rowText, statusText, timeAgo) and ui/TableList.svelte"
  - "Table route: invitation line from the summary, gone table before the prompt, slow connecting after 10 s, « Pas de connexion » notice, rememberTable on the first welcome"
affects: [02-05, 02-06, 02-07, 02-09, 02-10]

tech-stack:
  added: []
  patterns:
    - "Public read of a table without joining: GET /api/tables/:id → GameRoom.summary() reads sqlite_master first, so an unknown id writes nothing"
    - "Device-local lists validated entry by entry (settings.ts pattern), with a StorageLike injected"
    - "Only the Worker's own JSON 404 ({ error: \"not-found\" }) erases a list entry; any other failure leaves it « unknown »"

key-files:
  created:
    - apps/web/src/routes/Home.svelte
    - apps/web/src/ui/ChoiceTile.svelte
    - apps/web/src/ui/TableList.svelte
    - apps/web/src/net/api.ts
    - apps/web/src/net/api.test.ts
    - apps/web/src/net/tables.ts
    - apps/web/src/net/tables.test.ts
    - packages/table/src/summary.ts
    - packages/table/src/summary.test.ts
    - apps/worker/test/api.test.ts
    - apps/web/e2e/accueil.spec.ts
    - apps/web/e2e-online/accueil.spec.ts
  modified:
    - apps/web/src/App.svelte
    - apps/web/src/routes/Launch.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/routes/Table.svelte
    - apps/web/src/ui/NamePrompt.svelte
    - apps/web/src/ui/icons.ts
    - apps/web/src/i18n/fr/accueil.ts
    - apps/web/src/i18n/fr/launch.ts
    - apps/web/src/i18n/fr/table.ts
    - tools/copy-vendor-assets.mjs
    - packages/protocol/src/frames.ts
    - packages/table/src/index.ts
    - apps/worker/src/index.ts
    - apps/worker/src/GameRoom.ts
    - "apps/web/e2e: audio, banc, finition, force, launch, partie, reglages, sons, table, tracer specs"

key-decisions:
  - "A spec's goto(\"/\") that only resets the document before another goto stays \"/\" (it now loads the home, harmless); only the gotos that reach the launch screen moved to /#/ordinateur. Moving the reset ones too turned a full navigation into a same-document hash change and kept a test's injected style tag alive (clavier.spec.ts)"
  - "The sound test's « Retour » and the bench's back link still lead to #/ (now the home); the error screen's reload goes to #/ as planned"
  - "summary() maps a won game to « finished »; « paused » and « saved » are in the union for 02-06 / 02-07 only"
  - "The solo tile's pictogram is the knight picture used as a CSS mask over a walnut fill (no filter)"
  - "Row line 1 before a summary answers (checking, offline) reads « Table en ligne »: the entry stores no names (id, seat, joinedAt as planned)"
  - "The list column takes the height of the tiles' column with contain: size, so its list scrolls inside it on the computer and in two columns"

patterns-established:
  - "e2e-online specs that compare accessible names use \\s for the catalogue's no-break spaces"

requirements-completed: [NET-01, HIST-01]

coverage:
  - id: D1
    description: "#/ shows « Accueil » with two oak tiles, no amber, the name line and « Mes parties en cours »; fits 1280 × 800, 1024 × 640, 844 × 390, 750 × 342, 667 × 375, 640 × 360; one scrolling column at 568 × 320 and 480 × 320; portrait scrolls without « Tourne ton téléphone »; never sideways"
    requirement: NET-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e/accueil.spec.ts (phone, desktop)"
        status: pass
  - id: D2
    description: "The solo setup at #/ordinateur with « Accueil »; abandon and « Changer de couleur » return there; the local game unchanged"
    requirement: NET-01
    verification:
      - kind: e2e
        ref: "full local Playwright suite (442 passed, 96 skipped, 0 failed)"
        status: pass
  - id: D3
    description: "GET /api/tables/:id: public fields only (no person id, token hash, table id or card), 404 for an unknown id with no schema left, malformed ids never reach getByName"
    requirement: NET-01
    verification:
      - kind: unit
        ref: "packages/table/src/summary.test.ts"
        status: pass
      - kind: integration
        ref: "apps/worker/test/api.test.ts (workerd)"
        status: pass
  - id: D4
    description: "Create from the home after the first-name prompt; the invited person's prompt names the creator; offline creation shows only the toast"
    requirement: NET-01
    verification:
      - kind: unit
        ref: "apps/web/src/net/api.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e-online/accueil.spec.ts (phone, desktop)"
        status: pass
  - id: D5
    description: "« Mes parties en cours »: hostile toc.tables.v1 cleaned, rows with « Avec … » and status · time, remove and « Remettre » at its place, unknown tables removed with one toast, a table joins on its first welcome"
    requirement: HIST-01
    verification:
      - kind: unit
        ref: "apps/web/src/net/tables.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e-online/accueil.spec.ts; apps/web/e2e/accueil.spec.ts (20 rows)"
        status: pass

estimate:
  tokens: 140000
actuals:
  tokens: 20584    # chars/4 of the added lines (82 334 characters), .planning and the generated icons.ts (3 087 characters) excluded
  tasks: 3
  commits: 6
plan_head_before: 607810e1207203f3f82a6a9baec2f0389b6e1324
plan_head_after: d2ddabaa1e204ddfae489cddab87e01b44b32373

duration: 65min
completed: 2026-10-17
---

# Phase 2 Plan 04: L'accueil, le prénom et « Mes parties en cours » Summary

**The game now opens on « Accueil »: two oak tiles (the game against the computer, unchanged at `#/ordinateur`, and « Créer une table en ligne »), the first name typed once, and this device's tables with who sits there and how each stands, read from a new public `GET /api/tables/:id` that names the creator to an invited person.**

## What was built

- **Routes:** `#/` → `Home`, `#/ordinateur` → `Launch` (its button row is now `[Accueil] 16 [Réglages] 16 [Jouer la partie]`), `#/partie`, `#/sons`, `#/banc`, `#/table/<id>` unchanged. The local abandon and « Changer de couleur » lead to `#/ordinateur`; the error screen's reload to `#/`.
- **Home** (`data-home`, `data-layout`): the gear first in DOM order, « TOC » (with the tagline on the computer and in portrait), the two `ChoiceTile`s (`data-home-choice="ordinateur|table"`, oak, radius 16, sharp 3 px shadow that sinks on press, 112 / 96 high), the name line « Ton prénom : {Prénom} » with « Changer » (accessible name « Changer de prénom »), and the list column. Layouts: computer (320 + 480), two columns (280 + up to 480, from 640 wide), one column (tiles side by side, the page scrolls), portrait (column of 480).
- **Create flow:** the online tile → (no name: the screen prompt with « Les autres joueurs le verront à la table. ») → `POST /api/tables` with « Création de la table… » (`aria-busy`) → `#/table/<id>`. Offline (`navigator.onLine` false): the toast « Pas de connexion : la table en ligne a besoin d’Internet. » only. A server or network failure shows the two copy-table lines under the field (or a toast when no prompt was needed).
- **Summary:** `summary(table)` = `{ status, creatorName, seats: { kind, name } per colour, gameNo, updatedAt }`; `GameRoom.summary()` returns null without creating a schema; the Worker answers 200 / 404 with `cache-control: no-store`, 405 for other methods, and checks the id format before `getByName`. The browser validates the JSON with `parseTableSummary` (strict).
- **Table route:** before the prompt it fetches the summary for « {Créateur} t’invite à une partie de TOC. » (a 404 shows « Cette table n’existe plus » at once); « Connexion à la table… » gains the slow line and « Retour à l’accueil » after 10 s; no network at first load shows « Pas de connexion » with « Réessayer » and « Retour à l’accueil » (and retries by itself on the `online` event); the first welcome and each change of seat call `rememberTable`.
- **« Mes parties en cours »:** `toc.tables.v1` entries `{ id, seat, joinedAt }`, validated entry by entry, newest per id, at most 20. `TableList` rows (`data-table-row`): 64 px, the colour chip, « Avec Bruno, Tornado et Céline » / « Personne d’autre pour l’instant », « {statut} · {il y a …} » from `Intl.RelativeTimeFormat("fr", { numeric: "auto" })`, « Vérification… » then filled per answer, « État inconnu (hors ligne) », last activity first, the remove button 44 × 44 with « Partie retirée de la liste. » + « Remettre », and one « effacée » toast for every table the server no longer knows.
- **Icons:** `users`, `share-2`, `message-circle`, `wifi-off`, `bot`, `crown` added to `ICON_NAMES` and regenerated with `node tools/copy-vendor-assets.mjs` (fonts unchanged, ISC header kept).

## Local specs edited for the new start address (Task 1 step 6)

`audio`, `banc`, `finition`, `force`, `launch`, `partie`, `reglages`, `sons`, `table`, `tracer` (`apps/web/e2e/*.spec.ts`):
- every `goto("/")` that reaches the launch screen → `goto("/#/ordinateur")` (24 places), `http://localhost:4173/` → `…/#/ordinateur` in launch.spec.ts;
- `toHaveURL(/#\/$/)` after « Abandonner la partie » and « Changer de couleur » → `/#\/ordinateur$/` (reglages, partie);
- reglages: the seeded-game trick `location.hash = "#/"` → `"#/ordinateur"`; after « Recharger la page » the error screen now lands on the home (`[data-home-choice="ordinateur"]` visible, URL still `#/`);
- sons: « Retour » leads to the home (title « … ramène à l’accueil »);
- force: the tab order gains the new « Accueil » link before « Réglages ».
Nothing else changed in them.

## Screenshots (looked at)

- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-04-1280x800.png`
- `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-04-844x390.png`

Both taken against `wrangler dev` with three real tables of « Romain » (alone in a waiting room; with Céline and Bruno; a game with Céline and two computers). No scroll at either size; text columns aligned; the gear clear of the rows.

## Commits

| Commit | Type | What |
|--------|------|------|
| 7463b33 | feat | Task 1: « Accueil » at #/, solo setup at #/ordinateur, ChoiceTile, six icons, accueil.spec.ts, the specs' start address |
| 9d6e29d | test | Task 2 RED: TableSummary schema, summary / workerd / api tests (stubs) |
| 402cba9 | feat | Task 2 GREEN: summary(), GET /api/tables/:id, api.ts, NamePrompt screen + sheet, create flow, table route states |
| 1f6ab4d | test | Task 3 RED: tables.test.ts (stub tables.ts), e2e-online/accueil.spec.ts |
| 199af6d | feat | Task 3 GREEN: tables.ts, TableList, rememberTable on welcome, Worker-only 404, 20-row spec |
| d2ddaba | refactor | Home writes data-home-choice on each tile |

## Verification (exact counts)

- `pnpm typecheck`: exit 0 (svelte-check 457 files, 0 errors, 0 warnings).
- `pnpm lint`: exit 0 (240 files).
- `pnpm test`: **67 files, 1 080 passed, 2 skipped** (baseline 1 053 + 27: summary 5, web api 6, workerd api 5, tables 11).
- Full local Playwright (phone + desktop): **442 passed, 96 skipped, 0 failed** (baseline 416 + 26 of accueil.spec.ts).
- Online Playwright (`playwright.online.config.ts`, all specs): **12 passed** (accueil × 3, fuite, ordinateurs, tracer; phone and desktop).
- `node tools/rules-trace.mjs`: OK (16 règles, 122 scénarios).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reset gotos must stay full navigations**
- **Found during:** Task 1, first full local run (`clavier.spec.ts` « les boutons d’action et le 7 montrent leur touche » failed on desktop).
- **Issue:** many specs call `goto("/")` right before `goto("/#/partie?…")` to reload the document; turned into `goto("/#/ordinateur")`, the next goto became a same-document hash change and kept a test's injected style.
- **Fix:** the 47 gotos immediately followed by another goto (plus one followed by a resize then a goto in tourne.spec.ts) were put back to `goto("/")`; only the 24 that reach the launch screen moved.
- **Commit:** 7463b33

**2. [Rule 1 - Bug] Specs that pinned the old address or the old tab order**
- force.spec.ts tab order (the new « Accueil » link), sons.spec.ts and reglages.spec.ts (« Retour » and « Recharger la page » land on the home), partie/reglages URL checks → `#/ordinateur`. Listed above.
- **Commit:** 7463b33

**3. [Rule 2 - Robustness] A foreign 404 must not erase the device list**
- **Found during:** Task 3 (the local preview proxies `/api` to `wrangler dev` when it runs, else fails).
- **Fix:** `tableSummary` returns "gone" only for the Worker's JSON `{ error: "not-found" }` 404; an HTML 404 is "unknown" (test case added). The local 20-row spec routes `/api/tables/*` to a 503 so it never depends on a Worker being up.
- **Commit:** 199af6d

**4. [Rule 1 - Bug, test] The online spec's accessible-name pattern used plain spaces**
- The RED spec (1f6ab4d) wrote « Reprendre la partie : … Ta couleur : Bleu. » with plain spaces; the catalogue has U+00A0 before « : ». The GREEN commit matches them with `\s`.
- **Commit:** 199af6d

**5. [Scope] Copy not in the UI-SPEC: « Table en ligne »**
- Row line 1 while a row is checking or offline needs a text, and the entry stores no names. « Table en ligne » is used (in `i18n/fr/table.ts`, `list.unknownPlayers`). **À confirmer par Romain.**

**6. [Scope] Unseated device rows and the creator's server error**
- A row whose device has no seat yet shows no chip and its accessible name has no « Ta couleur » part.
- With a stored name (no prompt on screen), a server error during creation shows « La table n’a pas pu être créée. Réessaie dans un instant. » as a toast; with the prompt it shows under the field as planned. The online tile reads « Création de la table… » (`aria-busy`) meanwhile.

**7. [Rule 1 - Bug] The plan's artifact check « data-home-choice » in Home.svelte**
- **Found during:** self-check (the hook was written inside ChoiceTile from a `choice` prop).
- **Fix:** ChoiceTile takes it as its `"data-home-choice"` prop and Home writes `data-home-choice="ordinateur|table"` on each tile; accueil, sons, reglages, launch specs rerun locally (112 passed) and the online accueil spec (6 passed).
- **Commit:** d2ddaba

### Other notes

- The first full local run had one failure in `sons.spec.ts` « les quatre versions des sabots sonnent différemment » (phone) that passed on rerun alone and in the end-gate run: an audio-render timing flake under load, unrelated to the routes.
- `wrangler dev` (for the screenshots) and `vite preview` were started by hand and stopped by PID.

## Known Stubs

| Where | What | Resolved by |
|-------|------|-------------|
| apps/web/src/net/tables.ts `statusText(status, missingIsMe)` | « En pause : on t’attend » is never chosen yet: nothing exposes which seat a pause waits for | 02-06 |
| packages/protocol TableStatus | « paused » and « saved » never produced by `summary()` yet | 02-06, 02-07 |
| Waiting room | The invite sheet does not open by itself after creation | 02-05 |

None blocks this plan's goal.

## Threat Flags

None beyond the plan's threat model: `GET /api/tables/:id` is T-02-15 / T-02-16 (public fields only, format check before `getByName`, no schema on an unknown id, both tested in workerd); toc.tables.v1 is T-02-17 (validated, 20 at most); first names stay text nodes (T-02-18); no package added (T-02-SC).

## Self-Check: PASSED

- Files: apps/web/src/routes/Home.svelte, apps/web/src/ui/ChoiceTile.svelte, apps/web/src/ui/TableList.svelte, apps/web/src/net/api.ts, apps/web/src/net/tables.ts, packages/table/src/summary.ts, apps/worker/test/api.test.ts, apps/web/e2e/accueil.spec.ts, apps/web/e2e-online/accueil.spec.ts: all present.
- Commits 7463b33, 9d6e29d, 402cba9, 1f6ab4d, 199af6d, d2ddaba: all ancestors of HEAD.
- Acceptance greps: `data-home-choice` in Home.svelte, `#/ordinateur` in App.svelte, « Jouer contre l’ordinateur » in accueil.ts, `export function summary` in summary.ts, `/api/tables/` in apps/worker/src/index.ts, « Création de la table » in accueil.ts, `toc.tables.v1` in tables.ts, `data-table-row` in TableList.svelte, `rememberTable(` in Table.svelte.
