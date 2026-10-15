---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 38
subsystem: ui
status: complete
tags: [plateau-galet, paysage-obligatoire, rotate, tourne-ton-telephone, bots-wait, e2e, gap-closure]
requires:
  - "01-36 (the screen store: bar, compact-bar, rotate)"
  - "01-37 (the phone held sideways has its compact bar)"
provides:
  - "apps/web/src/ui/RotatePrompt.svelte: the full-screen invitation (data-rotate-prompt, h1 data-rotate-title tabindex -1, phone title / computer-window title by the key hints' query, the body line, a static pictogram)"
  - "game.ts `rotate` copy: « Tourne ton téléphone », « Élargis la fenêtre », « La partie t’attend. Elle reprend dès que l’écran est en largeur. »"
  - "Game.svelte rotate mode: the game kept mounted in a wrapper (data-game-play) that is inert and display: none; a VisibilitySource (document.hidden || prompting) passed to the Director; a hold for the computer players; focus to the heading and back; keys swallowed behind the invitation"
  - "SessionEnv.document and SessionEnv.hold; watched.idle = director.idle() then hold"
  - "GameController.run(): a second director.idle() after the think delay"
  - "playwright.config.ts: the phone project is devices[\"iPhone 13 landscape\"] (750 x 342, touch, mobile)"
  - "e2e/tourne.spec.ts; table.spec « cavaliers à trois tailles » at 844 x 390, 1440 x 900, 3200 x 1900"
  - "DirectorDeps without `layout`; no portrait layout rule in Game.svelte"
affects: ["01-39", "01-40", "01-41"]
tech-stack:
  added: []
  patterns:
    - "A visibility source composed from document.hidden and an app state, handed to the Director through its existing `document` dependency, so the Director's own code is untouched"
    - "A hold promise awaited by the controller's idle: pending holds resolve when the state clears and on destroy"
    - "$effect.pre reads the focused element before the DOM hides it"
key-files:
  created:
    - apps/web/src/ui/RotatePrompt.svelte
    - apps/web/e2e/tourne.spec.ts
  modified:
    - apps/web/src/i18n/fr/game.ts
    - apps/web/src/routes/Game.svelte
    - apps/web/src/game/session.svelte.ts
    - apps/web/src/game/GameController.ts
    - apps/web/src/game/GameController.test.ts
    - apps/web/src/game/director.ts
    - apps/web/playwright.config.ts
    - apps/web/e2e/table.spec.ts
    - apps/web/e2e/finition.spec.ts
decisions:
  - "The invitation's pictogram: a dashed upright phone, a solid sideways phone and a quarter-turn arrow, static, cream on #4A2F1A (à confirmer par Romain)"
  - "When the invitation goes and nothing in the game had the focus (a phone, a game opened upright), the focus goes to the gear, as the plan's fallback says"
  - "The invitation sits at z-index 70, above sheets (60); the game behind is display: none anyway"
metrics:
  duration: "29 min"
  completed: 2026-10-14
  tasks: 3
  files: 11
estimate:
  tokens: 100000
  tasks: 3
actuals:
  tokens: 15000
  tasks: 3
  commits: 4
plan_head_before: 14e774e505a5d9bce667c607f21135daac3f2d24
plan_head_after: ab3ec81e28d6f67ce8eebed3e8064c4b661dea7c
---

# Phase 1 Plan 38: « Tourne ton téléphone », et les tests du téléphone tenu en largeur Summary

A screen taller than wide now shows only a full-screen invitation:
- « Tourne ton téléphone » on a phone;
- « Élargis la fenêtre » on a computer window (`(hover: hover) and (pointer: fine)`);
- under the title, « La partie t’attend. Elle reprend dès que l’écran est en largeur. ».

The heading takes the focus. The game stays mounted behind it, not displayed and inert. The moment the invitation shows, the Director is told the game is hidden: a running motion jumps to its end and later events apply without motion. The computer players wait until the screen is back in landscape. The phone e2e project is now Playwright's iPhone 13 held sideways (750 x 342, touch), and Game.svelte has no portrait layout rule left.

Screenshot of the invitation at 390 x 844 (mobile, touch, scale 3): `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/01-38-tourne-390x844.png`. The computer window at 800 x 1000: `…/shots/01-38-elargis-800x1000.png`.

## What was built

- **Task 1 (tracer), 08fbf9f.**
  - **game.ts:** the `rotate` group (phone, window, body), with typographic apostrophes. The catalogue's typography test passes.
  - **RotatePrompt.svelte:**
    - a fixed full-screen section on `--bois-sombre` (#4A2F1A) with cream text and safe-area padding;
    - a static inline SVG pictogram, aria-hidden;
    - an h1 (Heading token, tabindex -1, bindable `heading`) holding both titles; the one for the other device is `display: none`, so a screen reader reads one;
    - the body line (Body 16).
  - **session.svelte.ts:** SessionEnv picks `document`, and createDirector receives it.
  - **Game.svelte:**
    - `prompting = screen.chrome === "rotate"`;
    - a VisibilitySource whose `hidden` is `document.hidden || prompting`. It dispatches to its listeners on the document's visibilitychange (registered on mount, removed on destroy) and on every change of `prompting`;
    - `{#if prompting}<RotatePrompt/>`; everything else (layout, tapis and shortcuts sheets, end screen) is in `<div class="play" data-game-play inert={prompting}>`, `display: contents`, or `display: none` while prompting. `.layout` keeps `inert={ended}`;
    - the heading is focused when the invitation appears (preventScroll).
  - **playwright.config.ts:** the phone project is `{ ...devices["iPhone 13 landscape"], defaultBrowserType: "chromium" }`, with Romain's « paysage obligatoire » in the comment.
  - **tourne.spec.ts:**
    - phone: on R-07.1 at the configured window (`test.info().project.use.viewport`), the board shows and there is no invitation. The Dame moves bleu0 to ring:15.
    - At 390 x 664: the heading and the line are visible, the heading is focused, the board, the hand and the action zone are hidden, and the wrapper is inert.
    - Back to the configured window: bleu0 is still at ring:15, on its drawn cell (offCell ≤ 0.5).
    - desktop: 800 x 1000 shows « Élargis la fenêtre », and 1280 x 800 shows the game again (data-chrome bar).
  - Tracer gate: the verify was re-run end to end and passed (tourne, tracer and compact specs on both projects: 33 passed, 19 skipped), then the plan continued.
- **Task 2 (TDD).**
  - **RED, 25db86d:** three GameController.test.ts cases, failing against the old loop:
    - a fake director's idle() held after jaune's think delay has started: no play, no enqueue and an unchanged view for 10 s; once released, jaune plays once, at once, and rouge does not play yet;
    - the exchange: idle() is held while vert thinks, and the human gives meanwhile. On release, vert's give completes the exchange (cardsExchanged, phase play);
    - a game disposed while held plays nothing once released.
  - **GREEN, 51dc285:**
    - GameController.run() awaits `director.idle()` again after the think delay (2 occurrences now);
    - `SessionEnv.hold`; `watched.idle` awaits `director.idle()`, then `env.hold?.()`. syncWhenIdle still awaits the Director alone.
    - **Game.svelte:**
      - `hold()` resolves at once unless prompting; pending holds resolve when prompting ends and on destroy, after the session's dispose;
      - `$effect.pre` remembers the game's focused element before it is hidden. When the invitation goes, after `tick()`, the focus returns to that element if it is connected, displayed, not inert and enabled; otherwise it goes to the gear (`[data-settings-slot] button`);
      - while prompting, the capture-phase shortcut handler calls `stopImmediatePropagation()` and returns, with no preventDefault: no shortcut runs and the hidden sheet's Escape never fires;
      - an open sheet stays mounted behind the invitation.
    - **tourne.spec.ts**, the cases added:
      - the kept game: hand and card states, the selected card, the halos, 16 places, the felt and the zone state are identical behind the invitation and back, and every ring knight sits on its cell;
      - the snapped motion, at normal speed;
      - the waiting computer players;
      - a game opened upright;
      - on desktop: focus and keys, and an open sheet.
- **Task 3, ab3ec81.**
  - **table.spec:** « cavaliers à trois tailles » runs at 844 x 390 (≈ 625 px, compact bar) and 1440 x 900 (1408 px, bar), each polled within 2 px of its formula, and at 3200 x 1900 with `--board-size: 3200px` forced past the 1600 px cap. The shots are knights-625.png, knights-1408.png and knights-3200.png. The comment gives a ring knight about 20, 45 and 102 px wide.
  - **Game.svelte:** removed the portrait `--action`, `--hand` and `--chrome`, the portrait board formula with its 880 / 1.5 cap, the below-360 px rule, the 600 x 600 hand rule, the portrait grid (56 px info row, max-width 880, centred), and the base `.seven` and hand padding. Kept are only the base rules both landscape modes rely on (`.layout` grid, the zones' grid areas, the stage's flex, the action zone's scroll). The header comment now describes the bar, the compact bar and the invitation.
  - **director.ts:** `layout` has left DirectorDeps, with its `Layout` import; `anchors()` calls `anchorOf(place, k)` with the landscape default. session.svelte.ts and Game.svelte no longer provide it. Board's prop and the anchor's parameter stay for 01-40.

## Verification

- `pnpm typecheck && pnpm lint && pnpm test`: green, **787 passed, 2 skipped**. That is 784 plus the three second-wait cases. Final run after the last commit.
- Task 1 verify (tourne, tracer, compact): 33 passed, 19 skipped.
- Task 2 verify (tourne, clavier, partie): 42 passed, 20 skipped.
- Checks that the new e2e cases catch a missing hold: with `hold()` temporarily forced to resolve, « les joueurs de l’ordinateur attendent » failed (« no knight moves behind the invitation ») and « ouverte en portrait » failed on both projects. The code was restored before the commit.
- Task 3 greps: no `880px` or `359.98px` in Game.svelte; no portrait viewport in the board, finition, cartes-speciales or table specs; animateNow is in animator.ts, cardFx.ts and Particles.svelte; no `.animate(` in apps/web/src/board outside frameClock.ts; `! grep -nw Layout` in director.ts and session.svelte.ts. Exit 0.
- animations.spec.ts, with table, board, finition and cartes-speciales, on both projects: everything passed after the finition fix below. That includes :782 (« une carte jouée se fond en 150 ms… ») and :807 (« une image chargée au départ du cheval… »); in the first run the only failure was the finition tapis case.
- **Full Playwright suite, phone (iPhone 13 held sideways) and desktop projects: 333 passed, 83 skipped, 0 failed** (5.9 min, 416 tests).
  - Against the 321 / 79 baseline, the difference is tourne.spec's 16 tests: 12 passed (phone tracer, desktop window, the 4 « derrière l’invitation » cases on both projects, 2 focus/keys cases on desktop) and 4 skipped.
  - Every spec that ran on the phone project at 390 x 664 now runs at 750 x 342 in the compact bar and passes.
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 112 scénarios) ».
- Acceptance greps: `iPhone 13 landscape` is in playwright.config.ts, `Tourne ton téléphone` is in game.ts and tourne.spec.ts, `data-rotate-prompt` is in RotatePrompt.svelte, `hold` is in session.svelte.ts, and `director.idle()` appears twice in GameController.ts.
- Screenshots: the 390 x 844 capture reads « Tourne ton téléphone » with the heading focused, the 800 x 1000 capture reads « Élargis la fenêtre », and there were no page errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] finition.spec measured the tapis card while the sheet was still sliding in**
- **Found during:** Task 3 (finition.spec « tapis: toucher le tapis ouvre… », phone project only).
- **Issue:** At 750 x 342 the sheet is the centred dialog, and its 250 ms fly translates the card by fractions of a pixel. At scale factor 3, boundingBox() read 99.99999 px for a CSS 100 px card. A probe showed 100.00000763, then exactly 100 once the slide had ended. The old portrait phone happened to read 100.
- **Fix:** the spec waits until `[data-sheet-layer]` has no running animation, then measures. The assertions (≥ 72 x 100) are unchanged. Passed 18 of 18 with `--repeat-each=3`.
- **Files modified:** apps/web/e2e/finition.spec.ts (outside the plan's list)
- **Commit:** ab3ec81

**2. [Rule 1 - Spec precision] « un mouvement en cours saute à sa fin »: no running animation inside the board within 200 ms, then none at all by 400 ms**
- **Issue:** The plan asks that `document.getAnimations()` have no running animation within 200 ms. R-07.1's Dame is the deal's last card, so the next deal is folded at once behind the invitation. The UI's own Svelte fades then start in the hidden DOM: the deal banner (200 ms) and the action zone (150 ms), both measured. They are not Director-led motions and they are not visible.
- **Fix:** Within 200 ms, bleu0 must read ring:15 and no animation may run whose target is inside `[data-board]` (knights, card flights, particles). 400 ms later the spec asserts that `document.getAnimations()` runs nothing at all and that no `[data-flight]` exists. Measured: well under 200 ms on both projects.
- **Commit:** 51dc285

**3. [Rule 1 - Spec signal] « ouverte en portrait » proves the computer players waited by timing, not by the givers' marks**
- **Issue:** In the « exchange » state the zone shows no givers. When the human's give completes an exchange the bots had already finished, the UI briefly shows exchangeWaiting with the next deal's view, where every mark is false. So a check on `data-done` could not tell the difference: it passed with the hold disabled.
- **Fix:** The human gives at once after the turn; 1.2 s later the exchange must still be waiting, because each bot now thinks 700 to 1300 ms. Without the hold the exchange completed within 600 ms and the check failed, as recorded above.
- **Commit:** 51dc285

### Choices within the plan's latitude

- The pictogram, the z-index and the focus fallback are listed under decisions.
- tourne.spec's « gardée », « saute », « attendent » and « ouverte en portrait » cases run on both projects. On desktop, 390 x 664 shows « Élargis la fenêtre ».
- The invitation renders even before the session exists, so a game opened upright never shows the board.
- No spec outside the plan's files needed a locator adapted for the portrait layout: none located it any more.

## Known limitation (for Romain's re-test, not a stub)

- **Sound of a move cut by the turn.** The hoof clops of the move already running are scheduled on the audio clock when the move starts. The Director's snap finishes the picture but does not cancel them, and the prohibition says « no change to the Director's own code ». So up to the rest of that move's clops (at most about 1.9 s for 12 cells) can still be heard after the invitation appears. Every later event applies without motion or sound. The same happens today when the tab is hidden mid-move. Sounds are deferred by Romain to a later phase; to look at then.

## Derived, « à confirmer par Romain » (UAT in 01-41)

- The invitation's copy and its pictogram.
- The computer players waiting behind the invitation (« Conséquence de mise en œuvre, à confirmer par Romain »), including a game opened upright, which is dealt without motion and starts once turned.
- On his iPhone, in Safari and installed: turning upright mid-game, then back (backstop, 01-41).

## Known Stubs

None. The portrait galet geometry and Board's `layout` prop stay, as planned, for 01-40.

## Threat Flags

None. The two threats are mitigated:
- T-01-60: the wrapper is inert and `display: none`, the capture handler stops every key, and the hidden sheet's Escape never fires. tourne.spec presses 1, Enter and Escape behind the invitation and checks that nothing changed and that the sheet stays open.
- T-01-61: the hold is released when the invitation goes and on destroy. Unit tests prove that a held idle only delays the bot, and that a disposed game plays nothing. tourne.spec checks that a bot plays within 10 s of the turn back, and that a game opened upright starts.

No package was added (T-01-SC).

## Commits

The measured range `14e774e..ab3ec81` holds 4 commits:
- 08fbf9f (Task 1)
- 25db86d (Task 2 RED)
- 51dc285 (Task 2 GREEN)
- ab3ec81 (Task 3)

This SUMMARY is committed separately. STATE.md, ROADMAP.md and the requirement checkboxes were not touched, as instructed.

## Housekeeping

- A preview server from 01-37 (PID 25655, port 4175) was still running; the screenshots were served by it from the freshly rebuilt dist. It was stopped by its PIDs (25678, 25667, 25655). The preview this plan tried to start (PID 13876) had exited on the busy port. No server is left running.

## Self-Check: PASSED

- FOUND: apps/web/src/ui/RotatePrompt.svelte (contains "data-rotate-prompt"), apps/web/e2e/tourne.spec.ts (contains "Tourne ton téléphone"), apps/web/playwright.config.ts (contains "iPhone 13 landscape")
- FOUND: the screenshots 01-38-tourne-390x844.png and 01-38-elargis-800x1000.png in the scratchpad's shots/
- FOUND: 08fbf9f, 25db86d, 51dc285, ab3ec81 (ancestors of HEAD)
