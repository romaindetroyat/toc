# Phase 2: Jouer en ligne entre proches - Context

**Gathered:** 2026-10-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Four relatives, each on their own device, play the same game in real time at a table whose server is authoritative (Cloudflare Worker + one SQLite-backed Durable Object per table, WebSocket Hibernation). The game survives disconnects and can be resumed days later. Requirements: RULE-19, NET-01..05, PLAY-07, HIST-01 (see ROADMAP phase 2).

Phase 3 (computer players at levels 1–5) is already done and its bots are pure functions of (PlayerView, seat, level, rng, work budget): they run inside the Durable Object for empty or handed-over seats.

Out of scope: accounts, passkeys, friends (phase 4); spectators; history, stats and leaderboard UI beyond what HIST-01 needs (phase 5); free-text chat (see D-07).

The game is already published at https://toc.romaindetroyat.workers.dev (Worker « toc »). Publishing from the cloud container uses `wrangler.embarque.jsonc` (assets embedded in the script), because the egress proxy replaces the assets-upload JWT with the account token. Phase 2 adds the Durable Object binding and its migration to the deploy config.

</domain>

<decisions>
## Implementation Decisions (Romain, 2026-10-17)

### Identity and joining
- **D-01:** No account yet. On opening a table link, the player types a first name once; the device remembers it, plus a private device token, so a reconnect finds the same seat. Romain: « Un prénom, retenu par l'appareil (Recommandé) ». Phase 4 accounts will replace it. — **Reversibility:** costly — the seat-ownership model (device token) will be migrated to accounts in phase 4.
- **D-02:** Inviting is by a link to share (plus a QR code), sent by SMS/WhatsApp; whoever opens it joins the table. Romain: « Lien à partager (Recommandé) ». The table id must be unguessable.
- **D-03:** Seats: in the waiting room each person takes a free colour; the creator can move people and sets the computer strength for the remaining seats (reuse phase 3's strength picker), then starts the game. Romain: « Chacun choisit, le créateur peut changer (Recommandé) ».

### Disconnects, pause and resume
- **D-04:** When a human disconnects, the game pauses for everyone. After **1 minute**, the creator chooses: wait more, hand the seat to the computer (the player gets it back on return), or save the game. Romain: « 1 minute (Recommandé) ». Timers use Durable Object alarms, never setTimeout.
- **D-05:** If the creator is the one disconnected, the role passes to the next connected player and comes back to the creator on return. Romain: « Le joueur suivant (Recommandé) ».
- **D-06:** A stopped or saved game is found again by the same table link and by a « Mes parties en cours » list on the home screen of that device. Saved games are kept **30 days** without activity, then deleted. Romain: « Même lien + liste sur l'accueil (Recommandé) », « 30 jours (Recommandé) ».

### Chat, end of game
- **D-07:** Chat is **quick messages only** — no keyboard: a set of ready-made French messages/reactions (e.g. « Bien joué ! », « Aïe », « À toi », « Merci partenaire »…). Romain: « Messages rapides seulement ». This narrows NET-05 (« chat texte ») — record it in REQUIREMENTS as Romain's choice. Bonus: no moderation of free text needed.
- **D-08:** At the end, the winning team is announced to all; « Revanche » restarts with the same seats and teams once everyone agrees. Romain: « Mêmes places (Recommandé) ».

### Scope around it
- **D-09:** The local game against the computer stays: home screen shows « Jouer contre l'ordinateur » (as today, works offline) and « Créer une table en ligne ». Romain: « Oui, deux boutons (Recommandé) ».
- **D-10:** No spectators for now. Romain: « Non, pas pour l'instant (Recommandé) ».

### Claude's Discretion
- Protocol details (Zod-validated messages, per-seat projection so no hand ever leaks, event log + snapshot in DO SQLite), reconnection with partysocket, bot pacing inside the DO via alarms, the HIST-01 game-end record (D1 table, written once), table id format, QR code generation (no new heavy dependency), the exact quick-message list (« à confirmer par Romain »), the waiting-room and pause UI in the galet style.

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` § Phase 2 — goal and five success criteria
- `.planning/REQUIREMENTS.md` — RULE-19, NET-01..05, PLAY-07, HIST-01
- `.claude/CLAUDE.md` — stack (Workers + SQLite DO + Hibernation API, alarms, Hono, Zod, partysocket, D1), French UI
- `RULES.md` — the house rules (G1–G17) the server enforces
- `.planning/phases/03-l-ordinateur-la-force-choisie/03-CONTEXT.md` and `03-RESEARCH.md` — the bots' API (pure, work-counted budgets, PlayerView only) to run in the DO
- `.planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md`, `03-UI-SPEC.md` — design contract (galet, phone landscape layout, cards, thinking sign)
- `wrangler.jsonc`, `wrangler.embarque.jsonc`, `worker-embedded/`, `tools/build-embedded-worker.mjs` — current deploy setup

</canonical_refs>

<code_context>
## Existing Code Insights

- `packages/engine`: pure rules, `viewFor(state, seat)` per-seat projection — the server's authority and the no-leak projection.
- `packages/bots`: `chooseAction`/`createThinker` with work budgets — run in the DO.
- `apps/web/src/game/GameController.ts`, `session.svelte.ts`, `director.ts`: today's local game loop; the online client should feed the same Director/animations from server events.
- `apps/web/src/routes/Launch.svelte` + `StrengthPicker.svelte`: reuse for the waiting room.
- `apps/web/src/settings/store.svelte.ts`: device-local storage pattern (for name, device token, « Mes parties »).

</code_context>

<deferred>
## Deferred Ideas

- Free-text chat (Romain chose quick messages only).
- Spectators.
- Accounts/friends (phase 4), history/stats UI (phase 5).

</deferred>

---

*Phase: 02-jouer-en-ligne-entre-proches*
*Context gathered: 2026-10-17*

## Addendum — Romain's answers after research (2026-10-17)

- **D-11:** Cloudflare plan stays **Free**. Romain: « Je reste en gratuit ». The Champion's search inside the Durable Object must respect the Free-plan CPU limit per invocation: split the search across several alarm invocations (resumable thinker state in SQLite), as described in 02-RESEARCH.md. — **Reversibility:** reversible — a paid plan later only removes the slicing need.
- **D-12:** Late arrivals cannot take a computer seat once the game has started. Romain: « Non ». Only the seat's own device (or the host-approved reclaim of one's own seat, see research pitfall on in-app browsers) gets back in.
- **D-13:** Quick messages: « Bien joué ! », « Aïe ! », « Merci partenaire », « À toi ! », « Pardon… », « On y est presque », « Bravo ! », « 😂 », plus emoji reactions 👏 😮 🐴 ❤️. Romain: « Ajoute des émojis ».
- **D-14:** HIST-01 uses a D1 database; Romain will give the deploy token the « D1 Edit » permission (« Je donne le droit au jeton »). Creating the database is a deploy step done from this environment once the permission exists; if it is missing at execution time, keep the D1 binding optional and report it.
