---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 22
subsystem: card-motion
tags: [waapi, svelte, director, card-flights, audio-cues, reduced-motion, fast-mode, hidden-tab, playwright, fx-04, fx-05, fx-06]
status: complete

requires:
  - phase: 01-19
    provides: "MOTION and REDUCED tables, cuesFor with the card cues, Director with one t0 per step, window.__tocDebug.audio.cues, animations.spec.ts knight cases"
  - phase: 01-17
    provides: "FeltTable (talon, last cards, posed hands), HandFan (Reçue marker), DealBanner"
  - phase: 01-21
    provides: "The 7 panel unmounts the hand while open: hand animations must tolerate a remount"
provides:
  - "board/cardFx.ts: pure per-card flight specs (dealFlights, playFlight, exchangeFlights, layFlights) from MOTION and REDUCED, shared felt geometry (posedSlots, tiltOf, seatEdge, seatSlot), runFlight and finishFlights"
  - "CardFlights.svelte: the cards in flight drawn over the board, one WAAPI animation on transform and opacity each"
  - "Director: playDeal (dealt plus its handDealt events), playCardPlayed, playExchange, playDiscard, openDeal (the first deal of a game from a talon of 52); card sounds on the same t0 through cuesFor; snapToEnd also finishes the cards"
  - "motion.ts: cardsDuration, cardPlayDuration, exchangeDuration, MAX_DEAL_CARDS; eventDuration now counts dealt, cardPlayed, cardsExchanged and handDiscarded"
  - "HandFan: hand held back while a deal is in flight, then flipped face up (40 ms stagger); the received card slides in after the crossing"
  - "animations.spec.ts: durations, order and cues of every card motion and of the win hop, in normal, fast, reduced and hidden-tab conditions, with screenshots"
affects: [01-23, 02-bots-pacing]

actuals:
  tokens: 18000
  tasks: 2
  commits: 3
plan_head_before: 3694d2c91faad61dae87d1648c253c630141ad67
plan_head_after: c7b1b6612b779fd64769e20db1401dd4a4e4e82b

tech-stack:
  added: []
  patterns:
    - "A card motion is data first: cardFx.ts turns an event into FlightSpec[] (keyframes, delay, duration), the screen only draws and runs them, so durations are unit-tested without a browser"
    - "Cards fly over the board in screen-oriented units (rotated toward the human); the flights are taken away in the same task in which the Director folds the event, so the felt never shows a gap"
    - "The view leads the Director: the hand is concealed (invisible, out of reach) while view.hand holds cards the felt has not counted yet, then revealed on that transition only, so a remounted fan never replays it"
    - "Animator motions the Director calls are optional, like the knights': an animator without them still has every event applied"

key-files:
  created:
    - apps/web/src/board/cardFx.ts
    - apps/web/src/board/cardFx.test.ts
    - apps/web/src/board/CardFlights.svelte
    - apps/web/src/board/FaceUpCard.svelte
    - apps/web/src/game/director.cards.test.ts
  modified:
    - apps/web/src/game/director.ts
    - apps/web/src/game/cues.ts
    - apps/web/src/game/cues.test.ts
    - apps/web/src/game/GameController.ts
    - apps/web/src/game/session.svelte.ts
    - apps/web/src/routes/Game.svelte
    - apps/web/src/board/Board.svelte
    - apps/web/src/board/FeltTable.svelte
    - apps/web/src/ui/HandFan.svelte
    - apps/web/src/ui/DealBanner.svelte
    - apps/web/src/ui/CardBack.svelte
    - packages/board/src/motion.ts
    - packages/board/src/motion.test.ts
    - apps/web/e2e/animations.spec.ts

key-decisions:
  - "The first deal of a new game is dealt on screen: the controller keeps the events of startGame (openingDeal), the Director rolls the render state back to a talon of 52 with empty hands (openDeal) and plays them; the bots wait for it because they wait for the Director to be idle. A scenario (etat, scenario) is not dealt, its position appears at once"
  - "A played card lands before its knight moves (sequential, the knight keeps its own 60 ms lead): the card is the cause of the move, and the Director's one-event-at-a-time order stays simple"
  - "dealt folds first (the banner opens with the flight) and the four handDealt events fold when the cards have landed, so the talon and the hands change once, after the flight"
  - "Under reduced motion every card motion is one 150 ms fade or short slide with no stagger: the deal is one card per seat, the exchange four cards that barely travel, a dead hand every card at once"
  - "Cards in flight use a plain card back (no knight, no feColorMatrix filter): up to 20 filtered backs per frame would repaint on a phone, and the knight on a back is not visible in 250 ms"
  - "A dead hand laid on the felt gets one carte-pose sound at its start (cuesFor handDiscarded): the plan names no sound for it but a silent card laid on the table would be the only mute card event"
  - "The deal banner follows the pace (1.2 s, 480 ms when fast, 150 ms fades when reduced)"

patterns-established:
  - "e2e shoot(): waits frame by frame in the page until the animations to photograph are running, then freezes them all in that frame at one step time: a screenshot of cards in flight cannot be a poll too late"
  - "The recorder in animations.spec.ts also records cards in flight (role flight-deal, flight-play, flight-exchange, flight-lay) and the hand's own cards (role hand-card), next to the knights"

requirements-completed: [FX-04, FX-05, FX-06]

coverage:
  - id: D1
    description: "Card motions are pure single-source specs: deal 250 ms with 40 ms stagger (max 20 cards), played card 300 ms, exchange 300 ms with the pair passing on either side, dead hand 350 ms with 60 ms stagger; fast x0.4; reduced 150 ms fade at once; eventDuration counts them"
    requirement: FX-04
    verification:
      - kind: unit
        ref: "apps/web/src/board/cardFx.test.ts"
        status: pass
      - kind: unit
        ref: "packages/board/src/motion.test.ts#the cards"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Director plays dealt (with its handDealt), cardPlayed, cardsExchanged and handDiscarded as card motions with carte-donne, carte-pose, carte-echange sounds on the same t0, folds the felt after the landing, and skips both motion and sound in a hidden tab, under snapToEnd and in test mode"
    requirement: FX-05
    verification:
      - kind: unit
        ref: "apps/web/src/game/director.cards.test.ts"
        status: pass
      - kind: unit
        ref: "apps/web/src/game/cues.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "In the browser at normal speed: 20 deal cards of 250 ms 40 ms apart with one riffle and the hand flipping open, the 1.2 s banner, a played card flying 300 ms before its knight, four exchange cards crossing in 300 ms with the slide sound and the received card sliding in, a dead hand laid 350 ms per card 60 ms apart, the eight winning knights hopping once in 600 ms"
    requirement: FX-05
    verification:
      - kind: e2e
        ref: "apps/web/e2e/animations.spec.ts (la donne, la bannière, une carte jouée, l'échange, main posée, la victoire)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Fast mode: a 4-cell bound 320 ms, clops at least 50 ms apart, played card 120 ms, deal 100 ms / 16 ms, dead hand 140 ms / 24 ms. Reduced motion: every card motion 150 ms, one 180 ms slide and one clop per move, no particles. Hidden tab: the running move ends at once, the bots' plays apply without motion or sound, cues resume on return"
    requirement: FX-06
    verification:
      - kind: e2e
        ref: "apps/web/e2e/animations.spec.ts (Avance rapide : le bond de 4 cases, les cartes; Réduire les animations : les cartes se fondent en 150 ms; onglet caché)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The look and feel of the card motion: the deal reads as a deal, the played card lands convincingly, the exchange crossing is legible, the dead hand lies down well, fast mode stays readable and reduced mode is calm, with sound and picture in step"
    requirement: FX-05
    verification:
      - kind: e2e
        ref: "playwright: test-results/anim-donne|cartes-echange|main-posee-{phone,desktop}.png"
        status: pass
    human_judgment: true
    rationale: "Easing, flight paths, sizes and the audio-visual synchrony are judgments (success criterion 4); the executor reviewed the exchange and dead-hand screenshots, the human check of plan 01-22 stays with Romain."

duration: "27 min"
completed: 2026-10-13
---

# Phase 1 Plan 22: Les cartes bougent aussi — donne, carte jouée, échange, main posée, victoire Summary

**The cards now move like at a real table, each with its sound: the deal flies 20 cards from the talon with the riffle and the player's hand turns face up, a played card lands on the felt before its knight leaps, the four exchange cards cross, a dead hand lies down card by card, and the whole motion system (knights and cards) is proven in the browser at normal, fast, reduced and hidden-tab conditions.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-10-13T21:13:00Z (approximate)
- **Completed:** 2026-10-13T21:40:00Z
- **Tasks:** 2
- **Files modified:** 19 (5 created, 14 modified)

## Accomplishments

- **Card motions as data (Task 1):** `cardFx.ts` turns every card event into per-card flight specs from the same `MOTION` and `REDUCED` tables the knights use: deal 250 ms with 40 ms stagger (never more than 20 cards), played card 300 ms from the edge in front of its seat to its felt slot, exchange 300 ms with the two cards of a pair passing on either side of each other, dead hand 350 ms with 60 ms stagger to the exact places the felt shows it. `CardFlights.svelte` draws them over the board, one Web Animation on transform and opacity per card.
- **Director:** `dealt` plus the `handDealt` events that follow it, `cardPlayed`, `cardsExchanged` and `handDiscarded` are played one at a time with their sounds scheduled from `cuesFor` on the same t0 (`carte-donne`, `carte-pose`, `carte-echange`); the felt and the hands are counted once the cards have landed. A hidden tab, `snapToEnd` and the test mode skip both motion and sound, and `snapToEnd` now also finishes the cards in flight.
- **First deal on screen:** a new game replays its opening deal from a talon of 52 (`openDeal`); the player's hand is concealed until the cards land, then flips face up with a 40 ms stagger (a fade when reduced). The received card slides into the hand after the crossing. Neither replays when the hand remounts after the 7 panel.
- **Pacing:** `eventDuration` now counts the card events so Phase 2 can pace bots truthfully; the deal banner follows the pace (1.2 s, 0.4 times when fast, 150 ms fades when reduced).
- **The proof (Task 2):** `animations.spec.ts` checks, on the phone and desktop projects, fast mode (4-cell bound 320 ms, clops 50 ms apart, cards 120 ms, deal 100 ms / 16 ms, dead hand 140 ms / 24 ms), reduced motion (every card 150 ms, one 180 ms slide, one clop per move, no particles) and a hidden tab (the running move ends at once, the three bots' plays and the next deal apply with no motion and no cue, cues resume on return). Screenshots of the dealt cards, the crossing exchange and the dead hand go to `test-results/anim-*.png` next to the knights'.

## Task Commits

1. **Task 1, part 1 (card motion logic):** `53bf282` feat(01-22): the Director plays the deal, the played card, the exchange and the dead hand as card motions
2. **Task 1, part 2 (screen and card cases):** `a7f3392` feat(01-22): cards fly from the talon, land on the felt, cross for the exchange and lie down with their sounds
3. **Task 2:** `c7b1b66` test(01-22): fast, reduced and hidden-tab proof for the cards and the knights, in the browser

**Plan metadata:** the docs commit that carries this file.

## Files Created/Modified

- `apps/web/src/board/cardFx.ts` (new) - flight specs, felt geometry, WAAPI runner for the cards
- `apps/web/src/board/CardFlights.svelte` (new) - the cards in flight over the board
- `apps/web/src/board/FaceUpCard.svelte` (new) - the face-up card, shared by the felt and the flights
- `apps/web/src/game/director.ts` - card motions, `openDeal`, `finishCards`
- `apps/web/src/game/cues.ts` - `handDiscarded` gives one `carte-pose`
- `apps/web/src/game/GameController.ts`, `session.svelte.ts` - opening deal events, `pace`
- `apps/web/src/routes/Game.svelte`, `board/Board.svelte`, `board/FeltTable.svelte` - the flights layer, the concealed hand, felt geometry from `cardFx`
- `apps/web/src/ui/HandFan.svelte`, `DealBanner.svelte`, `CardBack.svelte` - flip and slide, pace-aware banner, plain back for flights
- `packages/board/src/motion.ts` - card durations and `eventDuration` for card events
- Tests: `cardFx.test.ts`, `director.cards.test.ts`, `motion.test.ts`, `cues.test.ts`, `e2e/animations.spec.ts`

## Decisions Made

See `key-decisions` above. The ones worth a second look: the first deal is dealt on screen only for a new game (not for a scenario), a played card lands before its knight moves, and a dead hand gets one card-down sound.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Files outside `files_modified`**
- **Found during:** Task 1
- **Issue:** Card flights needed a place to be drawn, shared felt geometry, a way to deal the opening deal and a pace reachable from the screen; none of these live in the five listed files.
- **Fix:** new `cardFx.ts`, `CardFlights.svelte`, `FaceUpCard.svelte` (the face-up card extracted from `FeltTable`), and small edits to `Board.svelte`, `Game.svelte`, `GameController.ts`, `session.svelte.ts`, `CardBack.svelte`, `cues.ts`, `motion.ts`, plus unit tests for each pure part.
- **Verification:** typecheck, lint, vitest (603 passed) and the whole Playwright suite pass.
- **Committed in:** 53bf282, a7f3392

**2. [Rule 2 - Missing critical] `eventDuration` ignored the card events**
- **Found during:** Task 1
- **Issue:** `eventsDuration` is the hook Phase 2 uses to pace bots; with card motions on screen it would under-count every play by 300 ms and every deal by about a second.
- **Fix:** `eventDuration` counts `dealt` (with its hands), `cardPlayed`, `cardsExchanged` and `handDiscarded`, in normal, fast and reduced modes, with tests.
- **Files modified:** packages/board/src/motion.ts, packages/board/src/motion.test.ts
- **Committed in:** 53bf282

**3. [Rule 1 - Bug] The hand flip and slide would run in a hidden tab**
- **Found during:** Task 2 (hidden-tab case)
- **Issue:** while the tab is hidden the Director folds events at once, but the hand's reveal animation was still recorded for the new deal.
- **Fix:** both hand animations are skipped while `document.hidden`.
- **Files modified:** apps/web/src/ui/HandFan.svelte
- **Committed in:** c7b1b66

**4. [Rule 2 - Missing critical] A dead hand had no sound**
- **Found during:** Task 1
- **Issue:** the plan names card sounds for the deal, the played card and the exchange only; a hand laid on the felt would have been the one silent card event.
- **Fix:** `cuesFor(handDiscarded)` gives one `carte-pose` at the start; tested in `cues.test.ts`, `director.cards.test.ts` and the e2e.
- **Committed in:** 53bf282

---

**Total deviations:** 4 auto-fixed (1 blocking, 2 missing critical, 1 bug). **Impact:** all inside the card-motion slice; no change to the engine, the rules or the knights' motions.

## Issues Encountered

- First e2e run of the played-card case expected the knight to start the instant the card landed; it starts after its own 60 ms lead (the same lead the audio uses), so the assertion now says so.
- First screenshots of the exchange and the dead hand were taken after the animations had ended (a poll too late); `shoot()` now waits in the page, frame by frame, and freezes the animations in the frame they appear.
- Playwright empties `test-results/` at the start of every run, so the screenshots only exist after a run that includes `animations.spec.ts` (the last full run left all of them).

## Known Stubs

None.

## Threat Flags

None. Card motion draws public information only (backs, and cards that were played face up); T-01-32 is mitigated: at most 20 cards per deal (`MAX_DEAL_CARDS`), bounded staggers, transform and opacity only, hidden-tab `snapToEnd` finishes the cards in flight and drops the backlog.

## Verification

- `pnpm exec vitest run`: 33 files, 603 passed, 2 skipped (pre-existing).
- `pnpm typecheck` (tsc and svelte-check, 0 errors) and `pnpm lint` (biome): clean.
- `pnpm --filter @toc/web exec playwright test e2e/animations.spec.ts e2e/partie.spec.ts e2e/tracer.spec.ts`: 60 passed after Task 1; `e2e/animations.spec.ts` alone 50 passed after Task 2 (phone and desktop).
- Whole Playwright suite: 191 passed, 25 skipped (isMobile skips and the reduced-motion control, all pre-existing), 0 failed, including the 85 s seeded full game of `partie-complete.spec.ts`.

## Next Phase Readiness

- Ready for plan 01-23. The human check of plan 01-22 (feel and sound synchrony of cards and knights) can start from `apps/web/test-results/anim-*.png` after a run of `animations.spec.ts`.
- `eventsDuration(events, mode)` now covers the whole play, cards included, for Phase 2 bot pacing.
- The opening deal exists only for the local controller; the Phase 2 table will have to hand the same events to `director.openDeal` when a game starts.

## Self-Check: PASSED

- Created files exist: cardFx.ts, cardFx.test.ts, CardFlights.svelte, FaceUpCard.svelte, director.cards.test.ts.
- Commits 53bf282, a7f3392 and c7b1b66 are ancestors of HEAD; `git rev-list --count` from the recorded base gives 3.
