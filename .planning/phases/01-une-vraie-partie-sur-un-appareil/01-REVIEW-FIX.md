---
phase: 01-une-vraie-partie-sur-un-appareil
fixed_at: 2026-10-13T23:15:00Z
review_path: .planning/phases/01-une-vraie-partie-sur-un-appareil/01-REVIEW.md
iteration: 1
findings_in_scope: 13
fixed: 13
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-10-13T23:15:00Z
**Source review:** .planning/phases/01-une-vraie-partie-sur-un-appareil/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 13 (1 critical, 12 warnings; the 17 info findings are out of scope)
- Fixed: 13
- Skipped: 0

Every finding was checked against the source before it was fixed. All 13 hold up. For two of them the suggested fix was changed to fit the code (WR-A03, WR-C-02); the reasons are given below.

## Fixed Issues

### CR-C-01: Page scroll lock stays on after « Abandonner la partie »

**Files modified:** `apps/web/src/ui/Sheet.svelte`, `apps/web/e2e/reglages.spec.ts`
**Commit:** 93df06c
**Applied fix:** All sheets now share one reference-counted lock in the `<script module>` block. The first sheet to open saves `body.style.overflow` and the last one to close puts it back, whatever order the sheets close in. Each release can only run once. The e2e test « abandon: confirmer ramène à l’écran de lancement » now checks that `document.body.style.overflow` is `""` after abandoning.

### WR-A01: Card-art import verifies the tarball digest only for one hard-coded version

**Files modified:** `tools/import-card-art.mjs`
**Commit:** 485bba8
**Applied fix:** `SVG_CARDS_INTEGRITY` is now a map from version to digest. A version with no pinned digest is refused before `npm pack` runs. The digest check runs for every version, and the header comment describes the new behaviour.

### WR-A02: `apply` throws a raw `TypeError` on malformed actions

**Files modified:** `packages/engine/src/apply.ts`, `packages/engine/test/turn.test.ts`
**Commit:** 094b27f
**Applied fix:** `apply` first checks that the action is an object with a string `t`, and throws `IllegalActionError("bad-action")` if not. The 7 branch checks `typeof action.card === "string"` before calling `rankOf`. A new test sends 15 malformed frames (null, undefined, primitives, `{t:"seven"}`, non-string cards, bad plans and more): each one throws `IllegalActionError` and the frozen state is unchanged. Without the fix, this test fails with the `TypeError`.

### WR-A03: Engine events carry every seat's hidden cards

**Files modified:** `packages/engine/src/view.ts`, `packages/engine/src/events.ts`, `packages/engine/src/state.ts`, `packages/engine/src/render.ts`, `apps/web/src/game/director.ts`, `packages/engine/test/deal.test.ts`, `packages/engine/test/props/render.test.ts`, `packages/board/src/motion.test.ts`, `apps/web/src/game/director.cards.test.ts`
**Commit:** df84cae
**Applied fix:** Added `eventsFor(events, seat)` next to `viewFor`. It is exported through the barrel. It sets other seats' `handDealt.cards` to null and keeps only the viewing seat's entry in `cardsExchanged.received`. It copies events and never changes its input. The suggested `cards: []` redaction would have broken `renderReduce` and the Director, which read the hand size from `cards.length`. So `handDealt` now has a public `size`, `cards` is `CardId[] | null`, and both consumers read `size`. Tests:
- Unit tests check the deal, the exchange and that the input is not changed.
- A 60-game property test checks two things. First, folding each seat's projected stream gives the same render state as the full stream. Second, no projected event carries a card the seat may not know. The leak check fails when the redaction is turned off.

### WR-A04: Four `RuleSet` switches are inert

**Files modified:** `packages/engine/src/rules.ts`, `packages/engine/test/deal.test.ts`
**Commit:** 5feed2f
**Applied fix:** I documented the four switches rather than wiring them in, because no alternative is implemented for any of them. The header of `rules.ts` now names two kinds of switch:
- Switches the engine honours.
- Descriptive switches: `EXCHANGE_SIMULTANEOUS`, `EMPTY_HAND_SKIPPED`, `EXCHANGE_KEEPS_HAND_SIZE` and `PAUSE_IN_ALL_PHASES`. No engine code reads them. The header says where the behaviour is built in, and that the alternative must be implemented before one of them can become a table setting.

`EMPTY_HAND_SKIPPED`, `EXCHANGE_KEEPS_HAND_SIZE` and `PAUSE_IN_ALL_PHASES` are now typed as `true`, as `EXCHANGE_SIMULTANEOUS` already was. An override asking for an alternative therefore no longer compiles. The new test uses `@ts-expect-error`, and `tsconfig.test.json` checks it. Engine behaviour is unchanged.

### WR-B-01: A bot-turn exception ends the bot loop for good, silently

**Files modified:** `apps/web/src/game/GameController.ts`, `apps/web/src/game/GameController.test.ts`, `apps/web/src/game/session.svelte.ts`, `apps/web/src/routes/Game.svelte`
**Commit:** 5d95e68
**Applied fix:** `GameController` has a new `onError(listener)` channel. When a bot step throws:
- The error is still logged to the console, and it is also kept and passed to the listeners once.
- `run()` will not start again.
- A listener added after the failure is called at once.

The session exposes `failure`. `Game.svelte` throws it from the template, inside the app's `<svelte:boundary>`, so the « Oups » screen appears with its reload button. Two unit tests cover a failing bot (listener called, no further play) and a normal run (nothing reported). A temporary local check confirmed the result in a browser: with a forced bot failure, the error screen appeared, and it did not appear when the raise was removed. That check was not committed.

### WR-C-01: Errors in the game start-up path skip the « Oups » error screen

**Files modified:** `apps/web/src/routes/Game.svelte`
**Commit:** 97b9cca
**Applied fix:** The async start in `onMount` and the `replay()` path now go through `guarded(...)`. It catches the rejection, logs it, and stores it in `startFailure`, which the template raises into the boundary the same way as WR-B-01. A temporary local check confirmed it: a forced `session.start()` failure showed the error screen. That check was not committed.

### WR-B-02: « Réessayer » shows the failure toast again even when the retry succeeds

**Files modified:** `apps/web/src/audio/engine.ts`, `apps/web/src/audio/engine.test.ts`, `apps/web/src/routes/Game.svelte`
**Commit:** 7477558
**Applied fix:** The engine's `unlock()` now returns a promise that settles when the resume does, and never rejects. The shell has a new `retryUnlock()`, which unlocks synchronously inside the tap and resolves with the status once the resume has settled. `retryAudio()` waits for that result and shows the toast only if the status is still `"failed"`. That covers a browser that refuses again, which does not change the status. A recovery reaches the screen through `onStatus`. A unit test shows the old value (still `"failed"` read right after `unlock()`) and the settled one (`"ready"`). The e2e test « son: … Réessayer » still passes.

### WR-B-03: Opening or reloading `#/partie` directly never creates the AudioContext

**Files modified:** `apps/web/src/audio/engine.ts`, `apps/web/src/routes/Game.svelte`, `apps/web/e2e/audio.spec.ts`
**Commit:** 4ff86c1
**Applied fix:** New `unlockOnFirstGesture()` in the audio shell. It adds capture-phase listeners, outside `unlock()`, on the activation events (`pointerup`, `touchend`, `click`, `keydown`). They call `unlock()` once and then remove themselves. If the engine already exists it does nothing. The game screen calls it in `onMount` and removes the listeners on cleanup. New e2e test: open `#/partie` directly, and `body[data-audio]` stays absent until the first tap, then becomes `running`.

### WR-B-04: The resume listener uses `pointerdown`, which is not a user-activation event for touch

**Files modified:** `apps/web/src/audio/engine.ts`
**Commit:** d7dc1b4
**Applied fix:** The listener that resumes on any later tap now listens on the same `ACTIVATION_EVENTS` list (`pointerup`, `touchend`, `click`, `keydown`), passive. `retryResume()` already does nothing while the context is running, so the extra events cost little. This still needs the real-iPhone check that CLAUDE.md lists.

### WR-C-02: « Tester les sons » in the in-game Réglages silently destroys the running game

**Files modified:** `apps/web/src/ui/SettingsSheet.svelte`, `apps/web/src/ui/InfoBar.svelte`, `apps/web/src/routes/Game.svelte`, `apps/web/e2e/reglages.spec.ts`
**Commit:** ff9d16c
**Applied fix:** I did not hide the link in game. UI-SPEC lists « Tester les sons » among the Réglages links in both contexts, and marks only « Abandonner la partie » as in-game only (01-UI-SPEC.md, Copywriting table and the Réglages sheet section). So, in a game, the link now opens the same `ConfirmDialog` as abandon, using the existing copy: « La partie en cours sera perdue. » with « Continuer à jouer » / « Abandonner la partie ». Confirming abandons the game and opens `#/sons`. `onabandon(to?)` carries the destination, and focus returns to whichever control opened the dialog. On the launch screen the link is unchanged. New e2e test: cancelling keeps the game and returns focus to the link; confirming leads to « Test des sons ».

### WR-C-03: End-of-game dialog does not trap focus or make the board behind it inert

**Files modified:** `apps/web/src/routes/Game.svelte`, `apps/web/src/ui/EndScreen.svelte`, `apps/web/e2e/partie.spec.ts`
**Commit:** 75fc4ca
**Applied fix:** `.layout` gets `inert` while the end screen is up (new `ended` derived). `EndScreen` adds a window `focusin` guard: focus that lands outside the panel, such as on the toast, goes back to « Rejouer ». Focus on open stays on « Rejouer », inside the panel, because UI-SPEC says « Focus lands on « Rejouer » ». The panel itself is not focused, which the brief had suggested. The e2e test now checks three things: `[data-layout]` is inert, a control behind cannot take focus, and Tab after a tap on the scrim stays in the panel.

### WR-C-04: Candidate knights are indistinguishable for keyboard and screen-reader users

**Files modified:** `apps/web/src/i18n/fr/game.ts`, `apps/web/src/board/HitLayer.svelte`, `apps/web/e2e/finition.spec.ts`
**Commit:** bbd2d72
**Applied fix:** Lit knights are now labelled `Cheval {couleur} {lettre}, {place}, jouable`. The letter comes from `knightLetter`. The place is « à l’écurie », « à la maison », « sur sa case de sortie » or « à N cases de sa sortie », counted from the knight's own exit. The « …, jouable » ending is kept. The keyboard e2e tests were updated to the new label. A new test checks that two lit blue knights read « Cheval bleu A, à 5 cases… » and « Cheval bleu B, à 20 cases… ». Two related points were left alone: the `Pawn` `role="img"` labels and the Tab order that follows `candidates`.

## Verification

**Where it ran:** the main checkout (`/home/user/toc`, branch `claude/beautiful-rubin-wwwk87`), as the caller asked. No worktree was used, so these results can be reproduced from this tree.

**Per fix:** each fix was checked before its commit:
- Re-read of the changed code.
- `svelte-check` / `tsc` for the touched package, and `biome check`.
- The related unit or e2e tests.

**Final gates, after all fixes:**
- `pnpm typecheck`: 0 errors, 0 warnings.
- `pnpm lint` (biome): clean.
- `pnpm test` (vitest): 34 files, 626 passed, 2 skipped.
- Playwright, full suite (`apps/web`, phone and desktop projects): 260 passed, 28 skipped, 0 failed, in 4.6 min. This covers every touched spec (`reglages`, `audio`, `partie`, `finition`) and `e2e/partie-complete.spec.ts`. The skips are the specs' own `test.skip` conditions, for example `partie-complete` runs on desktop only.

Playwright started and stopped its own build and preview server on port 4173. No server was started by hand.

---

_Fixed: 2026-10-13T23:15:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
