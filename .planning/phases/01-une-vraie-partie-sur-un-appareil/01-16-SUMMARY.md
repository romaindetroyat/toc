---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 16
subsystem: game-screen
tags: [svelte5, hand-fan, action-zone, overlay, hit-layer, i18n, playwright, d-07, d-16, d-19]

requires:
  - phase: 01-15
    provides: "createSession / reduceTurnUi / createDirector / loadDebugParams: the game loop as tested logic"
  - phase: 01-13
    provides: "playability, renderOf, RenderState"
  - phase: 01-08
    provides: "Board, Pawn, animator, geometry (anchorOf, facing)"
  - phase: 01-06
    provides: "settings store, Icon, SeatChip, design tokens and button classes"
provides:
  - "i18n/fr/game.ts: the complete French game catalogue of the UI-SPEC, describeAction and botLine"
  - "i18n/fr/cards.ts: cardName and cardWithArticle"
  - "cards/faces.ts (cardFace, COURT_FIGURES) and cards/fan.ts (fan geometry, tested)"
  - "Card and HandFan: playable, unplayable, selected, waiting, dead and exchange states"
  - "ActionZone: prompts, preview with « Jouer » / « Jouer quand même », bot lines, « Avance rapide », exchange and dead-hand prompts"
  - "Overlay and HitLayer: halos, selected knight, dashed path, ghost, +n / -4 badge, x capture markers, nearest-knight hit areas"
  - "Game.svelte: the D-07 layout with the real session; the tracer tap-to-hop is gone"
affects: [01-17, 01-18, 01-19, 01-20, 01-21, 01-22]

actuals:
  tokens: 22000
  tasks: 2
  commits: 2
plan_head_before: ecb23ed4c30bd051bc750568b0d5644bc9c58824
plan_head_after: ac43e06f1a64d5ae61f35c9af8c3dcd093b3fb1a

tech-stack:
  added: []
  patterns:
    - "Board takes three snippets (under, over, hits) that receive the board units per screen pixel, so badges, hit radii and strokes are sized in screen px"
    - "Hit layer: one click handler on the layer picks the nearest lit knight within max(22 screen px, footprint/2); every candidate is also a focusable role=button for the keyboard"
    - "The pawns are drawn from session.render.pawns; the animator reorders the moving pawn on top and flushSync before animating, commit keeps the facing, flushSync and clears the animation"
    - "The bot result line is derived from the events of the bot's play (session.lastPlay), worded by describeAction in i18n"
    - "e2e positions come from the etat debug parameter, encoded by e2e/position.ts (btoa, no Node types)"

key-files:
  created:
    - apps/web/src/i18n/fr/game.ts
    - apps/web/src/i18n/fr/cards.ts
    - apps/web/src/cards/faces.ts
    - apps/web/src/cards/fan.ts
    - apps/web/src/cards/cards.test.ts
    - apps/web/src/ui/Card.svelte
    - apps/web/src/ui/HandFan.svelte
    - apps/web/src/ui/ActionZone.svelte
    - apps/web/src/board/Overlay.svelte
    - apps/web/src/board/HitLayer.svelte
    - apps/web/e2e/position.ts
  modified:
    - apps/web/src/routes/Game.svelte
    - apps/web/src/board/Board.svelte
    - apps/web/src/board/Pawn.svelte
    - apps/web/src/game/session.svelte.ts
    - apps/web/e2e/tracer.spec.ts
    - apps/web/e2e/table.spec.ts

key-decisions:
  - "Stable knights: every stable knight of the colour is lit for an As or Roi and any of them can be tapped (A-11); the preview path starts at the tapped one"
  - "The action zone also shows the exchange (« Passer cette carte »), exchange-waiting, dead-hand (« Poser mes cartes »), posed, empty and finished-player prompts, because the reducer already drives them; plan 01-17 can restyle them"
  - "The empty state (« Plus de cartes ») wins over the bot lines once the human has laid his last card, as the UI-SPEC empty state says; bot lines show while he still holds cards"
  - "Grid rows are auto with min 72 / max 160 on the action zone (a minmax(72px, 160px) track grows to 160 in an auto-height grid)"
  - "The board side is divided by 1.04 so the 4 % free band above the board fits the 260 px chrome: an iPhone 13 viewport (390 x 664) shows board, action zone and the whole hand without scrolling"

patterns-established:
  - "Debug-only dynamic import stays inside an `if (__TOC_DEBUG__)` branch (loadDebugParams, DebugGeometry)"

requirements-completed: [PLAY-01, PLAY-02]

coverage:
  - id: D1
    description: "The player's playable cards are raised with an amber outline, the others dimmed; tapping a dimmed card gives its reason line; tapping a playable card lights the knights"
    requirement: PLAY-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e/tracer.spec.ts#une carte grisée dit pourquoi, un As montre la sortie de l’écurie"
        status: pass
      - kind: unit
        ref: "apps/web/src/cards/cards.test.ts#hand fan"
        status: pass
    human_judgment: false
  - id: D2
    description: "Preview before confirming: dashed path, ghost with +n or -4, x badge on every knight eaten, description line, « Jouer » / « Annuler ce coup » / « Changer de carte »; partner capture asks « Jouer quand même »"
    requirement: PLAY-02
    verification:
      - kind: e2e
        ref: "apps/web/e2e/tracer.spec.ts#tracer: carte -> cheval -> aperçu -> « Jouer »"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/tracer.spec.ts#manger un adversaire est annoncé, manger son partenaire demande « Jouer quand même »"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/tracer.spec.ts#« Annuler ce coup » et « Changer de carte » reviennent en arrière"
        status: pass
    human_judgment: false
  - id: D3
    description: "The game never plays a move for the player, even with a single legal move (hint only); input is locked while a move animates"
    requirement: RULE-16
    verification:
      - kind: e2e
        ref: "apps/web/e2e/tracer.spec.ts#tracer: carte -> cheval -> aperçu -> « Jouer » (two-second no-auto-play check, one animation of 400 + 133 x (n - 1) ms, hopTimeline clops)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Bots: « {Nom} réfléchit… » then « {Nom} a joué {Carte} : {description}. », « Avance rapide » toggle persisted in settings"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/tracer.spec.ts#les joueurs de l’ordinateur réfléchissent puis disent ce qu’ils ont joué"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/tracer.spec.ts#« Avance rapide » est une bascule, retenue sur l’appareil"
        status: pass
    human_judgment: false
  - id: D5
    description: "Layout D-07: square board across the full width with the action zone and the hand fan below on a phone, two columns in landscape; hand of 1 to 5 cards, each visible slice at least 44 px on a 320 px screen"
    verification:
      - kind: unit
        ref: "apps/web/src/cards/cards.test.ts#keeps every visible slice at least 44 px wide on a 320 px screen"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/board.spec.ts (board square and uncropped at 320x480 to 1280x800)"
        status: pass
    human_judgment: true
    rationale: "Phone, landscape, 320 px and desktop screenshots were looked at during execution and read well; Romain's eye on the real device remains the final word (UI-SPEC backstop)."
  - id: D6
    description: "French copy catalogue complete and typographically correct"
    verification:
      - kind: unit
        ref: "apps/web/src/i18n/typography.test.ts (fr/game.ts, fr/cards.ts)"
        status: pass
      - kind: unit
        ref: "apps/web/src/cards/cards.test.ts#bot result line, #card names"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 16: L'écran de jeu, la main en éventail, la carte, le cheval, l'aperçu du trajet et « Jouer » Summary

**The game loop of plan 01-15 is on screen: a real game against three horse-named bots where the player taps a card, then a lit knight, sees the dashed path, the ghost, the +n badge and the x over every knight he would eat, and confirms with « Jouer » (« Jouer quand même » for a partner capture); nothing is ever played for him, and the tracer's tap-to-hop is gone.**

## Performance

- **Duration:** about 70 min
- **Tasks:** 2 (two task commits)
- **Files:** 11 created, 6 modified (apps/web only)

## Accomplishments

- `i18n/fr/game.ts` holds the whole UI-SPEC game copy in one typed catalogue (info bar, deal banner, exchange, previews, buttons, bot lines, reasons, 7 splitter block, dead hand, empty, tapis, end screen, failures, error, abandon dialog) with French typography checked by the existing typography test. `describeAction(events)` and `botLine(name, events)` word a bot's play from its engine events (« Jappeloup a joué la Dame de cœur : avance de 12 cases. »). `cards.ts` has `cardName` and `cardWithArticle`.
- `Card` and `HandFan`: one to five cards sorted As to Roi (ties pique, cœur, carreau, trèfle), the fan formula of the UI-SPEC (offset, 4 degree rotation, drop, origin 50 % 160 %), 72 x 100 or 88 x 124 cards, states playable (raised 8, amber outline and bar), unplayable (50 %), selected (raised 16, scale 1.06), waiting (neutral, not a button), dead and exchange, « Reçue » tag, 200 ms re-settle, roving arrow keys. Accessible names « Dame de cœur, jouable » / « …, pas jouable ».
- `ActionZone`: aria-live polite region with a 150 ms cross-fade (none under reduced motion); prompts wrap and the zone grows from 72 to 160 px; « Changer de carte », « Annuler ce coup », « Jouer » / « Jouer quand même », bot thinking and result lines, « Avance rapide » toggle with `aria-pressed` persisted through the settings store.
- `Overlay` (under and over the knights) and `HitLayer`: double-ring halos with a 1.2 s pulse (static under reduced motion), selected knight disc and ring lifted by 12 units, dashed path with chevrons every three cells, 55 % ghost with ring, `+n` / `−4` badge on a walnut disc, 24 screen-px brick disc with a white x over every knight that would be eaten, active-seat glow and amber ring on the felt slot. Hit circles of max(22 screen px, footprint/2), nearest knight wins, a miss says « Choisis un des chevaux éclairés. ».
- `Game.svelte`: D-07 layout (compact and wide portrait stack, landscape two columns with a 320 to 400 px panel, 56 px slot reserved for plan 01-17's info bar), session created on mount from the debug parameters, pawns drawn from the Director's render state, Échap deselects, input locked until the Director is idle.

## Task Commits

1. **Task 1: copy catalogue, card faces, hand fan** - `ff9134a` (feat)
2. **Task 2: action zone, overlays, hit layer, game screen, e2e** - `ac43e06` (feat)

**Plan metadata:** the docs commit that adds this file.

## Verification

- `pnpm exec vitest run apps/web/src`: 12 files, 190 tests, all pass (the new `cards/cards.test.ts` and the typography test over `fr/game.ts` and `fr/cards.ts`).
- `pnpm typecheck` (tsc and svelte-check, 0 errors, 0 warnings), `pnpm lint` (biome, 114 files) and `pnpm --filter @toc/web build`: pass.
- `pnpm --filter @toc/web exec playwright test` (whole suite, fresh debug build): 93 passed, 11 skipped (the explicit-viewport cases skip on the phone project), 0 failed. The plan's three specs (`tracer`, `table`, `board`) pass on the phone and desktop projects, including the 2-second no-auto-play check, the 1863 ms animation of the 12-cell Dame and its 24 gallop clops, and the four-colour scenario-driven move.
- Acceptance greps: `Jouer quand même` and `Retirer le dernier pas` in `i18n/fr/game.ts`, `COURT_FIGURES` in `faces.ts`, `Jouer` in `ActionZone.svelte`.
- Screenshots (iPhone 13, 320 x 568, 844 x 390, 1280 x 800) were read: the board, the path, the badge, the action zone and the whole hand fit; the iPhone 13 viewport shows everything without scrolling.

## Decisions Made

See `key-decisions`. In short: any stable knight stands for the exit, the action zone already carries the exchange and dead-hand prompts, the empty state wins over bot lines after the human's last card, and the board side leaves room for the 4 % band above the art.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The board unlocked while a bot's move was still animating**
- **Found during:** Task 2 (bot result line never appeared)
- **Issue:** `syncWhenIdle` in `session.svelte.ts` (plan 01-15) awaited `director.idle()`. The controller notifies once before and once after a bot's play; the first request found the Director idle just before the play was enqueued and, resuming with the new view, set the turn state to « À toi de jouer » while the knight was still hopping. The human could have tapped during the animation and the bot's result line was replaced at once.
- **Fix:** each request takes a ticket and only the latest one applies; the latest one is made after the enqueue, so it waits for the real queue.
- **Files modified:** apps/web/src/game/session.svelte.ts
- **Commit:** ac43e06

**2. [Rule 1 - Bug] Svelte warning `state_referenced_locally` in `createSession`**
- `director.reset(view)` read the `$state` before its first closure use; it now reads `controller.view()`.

### Other differences from the plan text

- **Extra states in the action zone.** Exchange (« Passer cette carte »), exchange-waiting, dead hand (« Poser mes cartes »), posed, empty and the finished-player prompt are already shown, since the reducer drives them and the strings are in the catalogue. Plan 01-17 still owns their polish (info bar, felt, card flight, end screen).
- **New files beyond `files_modified`:** `cards/fan.ts` (pure fan geometry, so the 44 px promise is unit-tested), `cards/cards.test.ts`, `e2e/position.ts` (encodes the `etat` debug parameter without Node types), and a small `lift` prop in `Pawn.svelte` for the selected knight (12 units, shadow stays on the ground). `session.svelte.ts` gained `lastPlay`.
- **Task 1 / Task 2 split.** `Game.svelte` is in the Task 2 commit only, because it imports every Task 2 component; Task 1 compiles and passes on its own with the old screen.
- **Board snippets.** `Board.svelte` receives `under`, `over` and `hits` snippets from `Game.svelte` instead of mounting `Overlay` and `HitLayer` itself, so the screen keeps the pawn bindings the Director needs.
- **e2e scenario.** The tracer uses R-07.1 as the plan says; the other cases use `etat` positions, because a debug scenario cannot give a bot a hand and a given colour the move.

**Total deviations:** 2 auto-fixed (both bugs), 0 architectural.

## Issues Encountered

- A hit circle of a stable knight overlaps its neighbours (22 screen px radius on a 17 px knight); Playwright's actionability check refuses a plain click on the first one, so the specs use `click({ force: true })` for the exit. The hit layer itself resolves by nearest knight, as the UI-SPEC says.
- A kill loop that matched `vite preview` by pattern in my own command line ended the shell once; stale preview servers were afterwards killed by PID.

## Known Stubs

- A card selected with no candidate knight (the 7 and the Valet, until plans 01-18 and 01-21) shows « Choisis un cheval. » with nothing lit and only « Changer de carte » to leave (plan flagged assumption A-15). A human whose only playable cards are a 7 or a Valet cannot act through the UI until then.
- `COURT_FIGURES` is empty on purpose: court cards render a large rank letter between suit pips until plan 01-20 fills it.
- The active seat ring is drawn on an empty felt slot; the cards on the felt and the info bar come with plan 01-17.
- A knight leaving the stable (As, Roi) and a captured knight returning to its stable change place without a hop or an arc: the Director only animates moves along the ring; the exit arc, the capture ejection and the Valet swap belong to the animation plans.

## Threat Flags

None. T-01-29 holds: the components read only `session.view` (a PlayerView) and the public render state; other seats' hands exist on screen only as counts; the preview is `resolveMove` on the view through the reducer. No package was added (T-01-SC).

## User Setup Required

None.

## Next Phase Readiness

- A game started from « Jouer la partie » can now be played from the UI against three bots: exchange, number cards, As, Roi (exit and advance), the 4 backwards, partner and opponent captures, dead hand, bot pacing with « Avance rapide ». It cannot be played to the end by a human who holds a 7 or a Valet he must play: those wait for plans 01-18 and 01-21. A bots-and-human run with the test speed reached the human's second turn and then stopped on a 7, as expected.
- Plan 01-17 reads the catalogue unchanged: info bar strings (`game.info`), deal banner, tapis sheet, end screen and the abandon dialog are ready in `i18n/fr/game.ts`; the 56 px `.info` slot of the layout is empty and waiting.
- Plan 01-18 adds the disambiguation tray and the 7 panel on top of `HitLayer` (candidate targets, `data-hit`) and replaces the action zone and the hand fan for the 7 as the UI-SPEC says.
- Plan 01-20 fills `COURT_FIGURES`; `Card.svelte` already draws an image when the map has one.
- `session.lastPlay` gives the events of the last bot play; `botLine(name, events)` words it.

---
*Phase: 01-une-vraie-partie-sur-un-appareil*
*Completed: 2026-10-13*

## Self-Check: PASSED

Created files exist (game.ts, cards.ts, faces.ts, fan.ts, cards.test.ts, Card, HandFan, ActionZone, Overlay, HitLayer, position.ts); commits `ff9134a` and `ac43e06` are in the branch history; `git rev-list --count` from `ecb23ed` gives 2.
