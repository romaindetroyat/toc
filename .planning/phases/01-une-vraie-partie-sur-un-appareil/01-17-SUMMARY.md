---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 17
subsystem: game-table
tags: [svelte5, info-bar, felt-table, card-back, exchange, dead-hand, deal-banner, end-screen, playwright, d-07, d-08, d-20, d-21]

requires:
  - phase: 01-16
    provides: "Game screen: Board snippets, ActionZone, HandFan, session, e2e/position.ts, the 56 px info-bar slot"
  - phase: 01-15
    provides: "session store, reduceTurnUi (exchange, deadHand, posed, empty, finishedPrompt), controller stats(), RenderState"
  - phase: 01-13
    provides: "RenderState (lastPlayed, posed, talonSize, discardSize, dealer, dealIndex, homeCounts, winner)"
provides:
  - "InfoBar: turn, dealer and deal, team scores, bot names never truncated, compact rule below 360 px"
  - "CardBack and FeltTable: the felt as a card table (last card per seat, talon, défausse, posed hands, dealer disc)"
  - "Exchange UI: waiting rows with hourglass or check, « Échange fait » line, « Reçue » marker"
  - "HandFan empty state (« Plus de cartes »), ActionZone bot lines and « Avance rapide » while the hand is empty or posed"
  - "DealBanner (1.2 s plate at every deal) and EndScreen (« Victoire ! » / « Défaite », stats, « Rejouer », « Changer de couleur »)"
  - "Game.svelte begin(): a session can be replaced, so « Rejouer » restarts with the same colour"
  - "e2e/partie.spec.ts: exchange, simple move, dead hand, end of game, replay"
affects: [01-18, 01-19, 01-20, 01-21, 01-22, 01-23, 01-24]

requirements-completed: [PLAY-05, RULE-03, RULE-16, RULE-17, RULE-18]

actuals:
  tokens: 13000
  tasks: 2
  commits: 2
plan_head_before: a8767c01da5d3ca931bffedc805be464b08ab1dc
plan_head_after: dcf767cfff1bf473c5f5ca75b71b917b9a11a2ac

tech-stack:
  added: []
  patterns:
    - "Board mounts FeltTable first inside its SVG (render and discardTop props), then the under/children/over/hits layers"
    - "Felt cards are drawn as SVG (rect and text from cardFace), upright; only their anchors follow the board rotation (rotatePoint); tilt is a hash of the card id, -4 to +4 degrees"
    - "Game.svelte owns the SessionEnv (animator, facings, commit) and begin(debug, colour) replaces the session after unmounting the board with tick()"
    - "French elision helper de(name) in the catalogue: « de Marengo », « d’Ourasi »"

key-files:
  created:
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/ui/CardBack.svelte
    - apps/web/src/board/FeltTable.svelte
    - apps/web/src/ui/DealBanner.svelte
    - apps/web/src/ui/EndScreen.svelte
    - apps/web/e2e/partie.spec.ts
  modified:
    - apps/web/src/board/Board.svelte
    - apps/web/src/ui/ActionZone.svelte
    - apps/web/src/ui/HandFan.svelte
    - apps/web/src/ui/SeatChip.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/game/session.svelte.ts
    - apps/web/src/i18n/fr/game.ts

key-decisions:
  - "The défausse shows the latest discarded card that is not already drawn as a seat's last card or in a posed hand: every played card is in the engine's discard AND is its seat's last card, so showing the raw top card drew the same card twice. An empty outline means every discarded card is lying in front of its seat."
  - "« Échange fait. Tu as reçu … » is a leading line in the action zone (not a reducer state) from the end of the exchange until the player picks a card; it stays through the bots' plays so a fast game cannot skip it."
  - "« Plus de cartes » lives in the hand zone (HandFan with zero cards), as the UI-SPEC empty state says; the action zone keeps the bot lines and « Avance rapide » for the empty and posed states."
  - "The end screen is a fixed full-viewport scrim (walnut at 70 %) with a centred dialog, so it fits at 320 px; focus is trapped between its two buttons and lands on « Rejouer »."
  - "« Rejouer » keeps only the debug speed (`vitesse`) of the opened game: a replay never replays a scenario or seed."

patterns-established:
  - "Elision in French sentences goes through the catalogue helper de(name) (Ourasi starts with a vowel)"
  - "Specs that depend on a bot's name match « de X » or « d’X » with a regex: bot names are random"

coverage:
  - id: D1
    description: "Exchange: choose a card, « Passer cette carte », waiting rows, « Échange fait », received card marked « Reçue »"
    requirement: PLAY-05
    verification:
      - kind: e2e
        ref: "apps/web/e2e/partie.spec.ts#l’échange : choisir, passer, attendre, recevoir une carte marquée « Reçue »"
        status: pass
    human_judgment: false
  - id: D2
    description: "Info bar (turn, dealer and deal, Nous/Eux n/8) and the felt as a card table (talon, empty défausse at start, last card in front of the seat)"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/partie.spec.ts#l’échange … (info bar, talon 32, défausse 0) and #un coup simple … (card on the felt)"
        status: pass
    human_judgment: true
    rationale: "Screenshots at 390 x 664, 320 x 568 and 1280 x 800 were read and look right; Romain's eye on a real phone is the final word on the felt's legibility (the Tapis sheet of plan 01-24 covers the unreadable small cards)."
  - id: D3
    description: "Simple move with preview: nothing moves for two seconds, « Jouer » moves the knight and the card lands on the felt"
    requirement: RULE-16
    verification:
      - kind: e2e
        ref: "apps/web/e2e/partie.spec.ts#un coup simple : carte, cheval, aperçu, rien ne bouge seul, « Jouer », la carte sur le tapis"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dead hand: « Poser mes cartes » appears, nothing happens for two seconds, the click lays the cards on the felt, « Tu attends la prochaine donne. », « Plus de cartes » in the hand zone"
    requirement: RULE-16
    verification:
      - kind: e2e
        ref: "apps/web/e2e/partie.spec.ts#main injouable : rien ne se pose seul, « Poser mes cartes » étale la main sur le tapis"
        status: pass
    human_judgment: false
  - id: D5
    description: "Finished player: « Tes quatre chevaux sont rentrés. Tu joues avec ceux de … » and the partner's knights carry the halos"
    requirement: RULE-17
    verification:
      - kind: e2e
        ref: "apps/web/e2e/partie.spec.ts#fin de partie : « Victoire ! », les chiffres, « Changer de couleur » revient au départ"
        status: pass
    human_judgment: false
  - id: D6
    description: "End screen: « Victoire ! », sentence, deals and captures, « Rejouer » focused, « Changer de couleur » to #/, « Rejouer » restarts with the same colour"
    requirement: RULE-18
    verification:
      - kind: e2e
        ref: "apps/web/e2e/partie.spec.ts#fin de partie : « Victoire ! » … and #fin de partie : « Rejouer » ouvre une nouvelle partie avec la même couleur"
        status: pass
    human_judgment: false
  - id: D7
    description: "Deal banner for 1.2 s at every deal; pacing and feel of the table against the bots"
    verification: []
    human_judgment: true
    rationale: "The banner was seen in a screenshot; the plan's human check (play a few deals on a phone and a computer) is judgment on feel and pacing."

duration: about 1 h
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 17: La table — bandeau, tapis, échange de carte, main posée et fin de partie Summary

**The game screen now reads like a table: an info bar with turn, dealer and team scores, a felt with the talon, the défausse, each seat's last card and posed dead hands, the exchange with « En attente de… » rows and a « Reçue » card, a dead hand the player poses himself, the deal banner, and an end screen with « Rejouer » that restarts with the same colour.**

## Performance

- **Duration:** about 1 h
- **Tasks:** 2 (two task commits)
- **Files:** 6 created, 7 modified (apps/web only)

## Accomplishments

- `InfoBar` (56 px, walnut): turn dot, seat glyph and « À toi de jouer » / « Tour de {Nom} » (the name never shrinks; below 360 px the prefix is hidden visually and stays for screen readers, the teams zone narrows to 96), « Donneur : {Nom} · Donne {k} sur 3 » (may ellipsise), « Nous {n}/8 » with a cream outline and « Eux {n}/8 », and a 44 x 44 slot kept for the settings button of plan 01-23. During the exchange and after the end it says « Échange des cartes » / « Partie terminée ».
- `CardBack` (oak, 2 px #A46F2A inner border, walnut knight silhouette from the knight sprite) and `FeltTable`: last card of each seat in front of its place (160 x 224 units, tilt hashed per card), talon with three thickness levels, défausse with its top card or a dashed outline, posed hands fanned in a row (screen top and bottom) or a column (sides) at 50 % overlap, dealer disc « D » (24 screen px) at the corner of the dealer's slot, felt group named « Sur le tapis ». Everything comes from the render state plus the public discard.
- Exchange: ActionZone waiting state lists the other three players with a check or an hourglass; « Échange fait. Tu as reçu {la carte} de {Partenaire}. » leads the zone after the exchange; the existing « Reçue » tag stays on the card in hand until it is played.
- Hand and action zone: « Plus de cartes » with its body in the hand zone when the hand is empty; the action zone keeps « Tu attends la prochaine donne. », the bots' thinking and result lines and « Avance rapide » while the player waits with no cards.
- `DealBanner` (walnut plate at 70 %, 1.2 s, scale-in or fade-only under reduced motion; the first deal of a shuffle also says « On rebat les cartes. Donneur : {Nom} ») and `EndScreen` (fixed scrim, dialog panel, « Victoire ! » / « Défaite » in Caveat, the winning team's two seat chips, the sentence, « Donnes jouées » and « Chevaux mangés », « Rejouer » focused, « Changer de couleur » to #/, Tab kept on the two buttons).
- `Game.svelte`: `begin(debug, colour)` replaces the session (the board is unmounted first so every pawn starts afresh); `createSession` takes an optional colour; « Rejouer » keeps the human's colour.

## Task Commits

1. **Task 1: info bar, felt as a card table, card exchange** - `8dddf44` (feat)
2. **Task 2: dead hand on the felt, deal banner, end screen with « Rejouer »** - `dcf767c` (feat)

**Plan metadata:** the docs commit that adds this file.

## Verification

- `pnpm typecheck` (tsc and svelte-check, 0 errors, 0 warnings), `pnpm lint` (biome, 116 files): pass.
- `pnpm exec vitest run apps/web/src`: 12 files, 190 tests, all pass.
- `pnpm --filter @toc/web exec playwright test` (whole suite, fresh debug build): 102 passed, 11 skipped (explicit-viewport cases on the phone project), 0 failed. After the last spec fix, `partie`, `tracer` and `table` were run three times each (`--repeat-each 3`): 147 passed, 9 skipped, 0 failed.
- `partie.spec.ts` has five cases on the phone and desktop projects: exchange, simple move with the two-second no-auto-play check, dead hand with the two-second no-auto-pose check, victory with « Changer de couleur », replay with the same colour.
- Acceptance greps: « Passer cette carte », « Poser mes cartes » and « Rejouer » in `i18n/fr/game.ts`, used by ActionZone / EndScreen; `svelte-check` exits 0.
- Screenshots read at 390 x 664 (start, exchange done, dead hand posed), 320 x 568 (end screen) and 1280 x 800 (mid-game felt with posed bot hands).

## Decisions Made

See `key-decisions`. In short: the défausse never repeats a card already lying in front of a seat, « Échange fait » is an action-zone line that stays until the player acts, « Plus de cartes » lives in the hand zone, and the end screen is a viewport scrim so it fits at 320 px.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] French elision before a vowel-initial bot name**
- **Found during:** Task 1 (the exchange and finished-player lines use « de {Partenaire} »; the bot Ourasi starts with a vowel)
- **Issue:** « ceux de Ourasi », « Tour de Ourasi » are wrong French; the catalogue had no elision.
- **Fix:** helper `de(name)` in `i18n/fr/game.ts` used by `botTurn`, `turnPrefix`, `exchange.done` and `finished`.
- **Files modified:** apps/web/src/i18n/fr/game.ts
- **Commit:** 8dddf44

**2. [Rule 1 - Bug] The défausse repeated the card lying in front of a seat**
- **Found during:** Task 1 (screenshot at 1280 x 800)
- **Issue:** the engine's discard includes every played card, which is also its seat's last card, so the raw top of the discard drew one card twice on the felt.
- **Fix:** `discardTop` in `Game.svelte` is the latest discarded card not already shown as a last card or posed; the outline stays when there is none.
- **Files modified:** apps/web/src/routes/Game.svelte
- **Commit:** 8dddf44

### Other differences from the plan text

- **Dead-hand fixture.** The plan says an R-14 fixture. R-14.2 leaves the other three hands empty, so the next deal starts the moment Bleu poses and the posed hand cannot be seen on the felt. The spec uses an `etat` position derived from R-14.2 with a playable Jaune hand; the engine fixture itself is unchanged.
- **Extra strings in the catalogue.** `info.turnPrefix`, `info.exchanging`, `info.over` and `info.teamAriaThem` were added (the UI-SPEC gives no copy for the info bar during the exchange and after the end, nor an aria label for the opposing pill). The existing entries are untouched.
- **Active seat ring.** The amber 4 px ring around the active seat's slot is the one `Overlay.svelte` already draws (plan 01-16); `FeltTable` does not draw a second one.
- **Mounting.** `Board.svelte` takes `render` and `discardTop` props and mounts `FeltTable` itself, as the plan says, before the `under` snippet.
- **Files beyond `files_modified`.** `SeatChip.svelte` (a `small` prop for the 20 px chip of the info bar), `session.svelte.ts` (optional colour argument of `createSession`), `i18n/fr/game.ts`. The Task 2 file list names ActionZone and HandFan, but their changes (exchange, empty state, bot lines while posed) were needed by Task 1's specs and are in that commit.
- **Info bar truncation.** At 390 px and in the 320 px landscape panel, row 2 is cut to « Donneur : Bucéphale · Donn… », which the UI-SPEC allows; the deal number is still in the deal banner.

**Total deviations:** 2 auto-fixed (1 missing functionality, 1 bug), 0 architectural.

## Issues Encountered

- A `vite preview` left on port 4173 by my own screenshot script was reused by Playwright (`reuseExistingServer`), so one run tested a stale build; it was killed by PID and the runs were repeated on fresh builds.
- One spec failed once in the full run because the finished-player line names a random bot (« d’Ourasi »); the spec now matches « de X » or « d’X ».
- On a 390 x 664 phone the three-line « Échange fait » zone pushes the hand about 16 px lower than the 260 px chrome of the UI-SPEC; the page scrolls a little at that moment, and the zone shrinks again as soon as the player picks a card.

## Known Stubs

- `COURT_FIGURES` is still empty (plan 01-20): court cards on the felt and in the hand draw a large rank letter.
- The felt is not yet a tap target: the Tapis sheet is plan 01-24 (assumption A-16), so felt cards are only readable on boards of about 780 px and wider.
- No card flight: dealt cards, the exchange cards sliding to the partner, the played card flying to the felt and the posed hand are drawn in place (plan 01-22). The winning team's knights do not hop yet on the end screen.
- The 7 and the Valet still have no UI (plans 01-21 and 01-18); a hand whose only playable card is one of them blocks the player there.

## Threat Flags

None. T-01-30 holds: `FeltTable` reads only `RenderState` public fields and the public discard; the human's own `received` card comes from his `PlayerView`; the bots' hands exist on screen as counts only. No package was added (T-01-SC).

## User Setup Required

None.

## Next Phase Readiness

- A game started from « Jouer la partie » runs from the first deal to the end screen for every card except the 7 and the Valet: exchange, number cards, exits, dead hands, a finished player continuing with the partner's knights, deal banner, victory or defeat, replay.
- Plan 01-18 adds the As/Roi chooser and the Valet on top of `HitLayer`; plan 01-23 puts the settings button in the info bar's `data-settings-slot`; plan 01-24 turns the `data-felt` group into the Tapis tap target (the group already has pointer-events off and the accessible name).
- `Game.svelte` now owns `begin()`; later plans that restart a game (abandon dialog, plan 01-23) can call it.

---
*Phase: 01-une-vraie-partie-sur-un-appareil*
*Completed: 2026-10-13*

## Self-Check: PASSED

Created files exist (InfoBar, CardBack, FeltTable, DealBanner, EndScreen, partie.spec.ts); commits `8dddf44` and `dcf767c` are in the branch history; `git rev-list --count` from `a8767c0` gives 2.
