# Phase 5: Suivi, apprentissage et finition - Context

**Gathered:** 2026-11-07
**Status:** Ready for UI spec, research and planning

<domain>
## Phase Boundary

Players follow their games and measure themselves against friends; newcomers learn the rules by playing; the game is accessible to the whole family. Requirements: HIST-02, HIST-03, HIST-04, PLAY-06, APP-04, APP-05 (ROADMAP phase 5, mode mvp, UI hint yes).

Phases 1-4 are done and live at https://toc.romaindetroyat.workers.dev (Worker « toc », deployed with `wrangler.embarque.jsonc`). Accounts are a unique pseudo plus a passkey (phase 4); friends exist; guests without accounts still join tables by link. D1 « toc » holds `games` (0001, one anonymous row per finished online game: seats JSON with colour/kind/name/level, winner, deals, captures; no person id) and the accounts schema (0002). Solo games run entirely in the browser and are recorded nowhere today.

Out of scope: chat, spectators, replays of a game move by move, e-mail, new languages.
</domain>

<decisions>
## Implementation Decisions (Romain, 2026-11-07)

### What counts
- **D-01: History and stats cover online tables AND solo games**, when the player is signed in. A solo game is reported to the server when it ends. Romain: « En ligne et solo (Recommandé) ». The server must treat a solo report as client-claimed (no server authority over a local game): it may count in personal stats, never in the friends ranking (see D-02).
- **D-02: The friends ranking counts only games with at least two humans with an account** (as partners or opponents). Solo games count in personal stats, not in the ranking. Romain: « Avec au moins 2 humains (Recommandé) ».
- **D-03: Guests and computers appear in other players' history by their name**: « Mamie (invitée) », « Pur-sang ». They have no stats of their own. Romain: « Oui, par son prénom (Recommandé) ».
- **D-04: History starts fresh with phase 5.** The existing anonymous `games` rows are not linked to accounts. Romain: « On repart de zéro (Recommandé) ». Recording which account sat in which seat is new (a new migration; never change the DO migration tag v1).

### In-game help (PLAY-06)
- **D-05: A « Règles » sheet only**, reachable at any time in a game (and from the home). No line explaining the touched card under the hand. Romain: « Feuille seulement », confirmed « Pas de ligne ».
- **D-06: The sheet's text is a short, simple rewrite of RULES.md** (goal, each card's effect, safe squares, home entry, the 7, the Valet, the exchange, G14/G15/G18 house rules), illustrated with the existing rule figures. Romain reviews the text. Romain: « Tiré de RULES.md (Recommandé) ».

### Tutorial (APP-04)
- **D-07: Prepared lessons**: a sequence of short set-up situations with cards and knights already placed — exit with As/Roi, move, capture, the 4 backwards, the Valet swap, the split 7, entering home, the exchange card. About one minute each, each ending with « Bravo », about 10 minutes in all. Romain: « Leçons préparées (Recommandé) ».
- **D-08: Offered both at first launch and on the home**: the first time, « Première fois ? Apprendre en 10 minutes », skippable; afterwards a permanent entry on the home and in the « Règles » sheet. Romain: « les deux : la première fois et sur l'accueil ».
- **D-09: A guide that talks**: short bubbles, using « tu », with a halo on the card and the knight to touch. A wrong choice is explained and the step is retried; no failure state. Romain: « Un guide qui parle (Recommandé) ».

### Claude's Discretion
- The ranking method (Romain did not select it): planner's call, kept simple and explainable to a family (e.g. wins and win rate with a minimum number of games, per player; maybe per partner pair), shown among friends only.
- Which stats are shown (games, wins, win rate, knights captured and lost, by partner, by computer level), the history screen layout and paging, where history/stats/ranking live (« Mon compte », a new screen), empty states.
- APP-05 accessibility: seats recognisable other than by colour (letters or shapes already exist on knights — check and extend to banners, hands, history), 44 px touch targets audit, French everywhere, screen-reader labels, contrast; an audit then fixes.
- Lesson engine design (scripted states fed to the existing engine and UI, reusing GameController/director), lesson progress memory (localStorage, try/catch), wording.
- D1 schema for account-seat links and solo reports, the free-plan budget, protocol version bump if needed.
</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` § Phase 5 — goal and five success criteria
- `.planning/REQUIREMENTS.md` — HIST-02..04, PLAY-06, APP-04, APP-05
- `RULES.md` — the validated house rules, source of the « Règles » sheet (D-06)
- `.claude/CLAUDE.md` — stack and constraints (French UI, landscape only, galet board)
- `.planning/phases/04-comptes-amis-et-application-installable/04-CONTEXT.md` and 04 SUMMARYs — accounts, friends, sessions, PlayerHub, D1 0002_accounts
- `.planning/phases/02-jouer-en-ligne-entre-proches/02-CONTEXT.md` — D1 games row (D-14), table DO
- `apps/worker/migrations/0001_games.sql`, `0002_accounts.sql` — current D1 schema
- `.planning/phases/02-jouer-en-ligne-entre-proches/02-UI-SPEC.md`, `03-UI-SPEC.md`, `04-UI-SPEC.md` — design contract
- Rule figures from plan 01-29 (rule images) — reuse in the sheet and lessons
</canonical_refs>

<code_context>
## Existing Code Insights

- Routes in `apps/web/src/routes/` (Home, Account, Friends, Game, Table, WaitingRoom, Launch…); shared sheets in `apps/web/src/ui/` (`Sheet.svelte`); settings in `apps/web/src/settings/`; i18n in `apps/web/src/i18n/`.
- Game flow: `apps/web/src/game/GameController.ts`, `director.ts`, `turnUi.ts`, `shortcuts.ts` (the « ? » keyboard help exists, desktop only) — lessons should drive these with scripted states rather than a second UI.
- Engine in `packages/engine` (pure, events), bots in `packages/bots`; the table Durable Object writes the finished-game row to D1 once, idempotently.
</code_context>

<deferred>
## Deferred Ideas

- A line explaining the touched card under the hand: rejected (D-05).
- Linking pre-phase-5 games to accounts: rejected (D-04).
- Move-by-move replays of past games.
</deferred>

---

*Phase: 05-suivi-apprentissage-et-finition*
*Context gathered: 2026-11-07*
