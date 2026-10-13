---
phase: 01-une-vraie-partie-sur-un-appareil
reviewed: 2026-10-13T22:40:00Z
depth: standard
files_reviewed: 103
files_reviewed_list:
  - packages/board/src/hopTimeline.ts
  - packages/board/src/index.ts
  - packages/board/src/layout.ts
  - packages/board/src/motion.ts
  - packages/board/src/rotate.ts
  - packages/bots/src/index.ts
  - packages/bots/src/randomLegal.ts
  - packages/engine/src/apply.ts
  - packages/engine/src/deck.ts
  - packages/engine/src/events.ts
  - packages/engine/src/index.ts
  - packages/engine/src/legal.ts
  - packages/engine/src/moves.ts
  - packages/engine/src/path.ts
  - packages/engine/src/render.ts
  - packages/engine/src/rng.ts
  - packages/engine/src/rules.ts
  - packages/engine/src/scenario.ts
  - packages/engine/src/seven.ts
  - packages/engine/src/state.ts
  - packages/engine/src/topology.ts
  - packages/engine/src/types.ts
  - packages/engine/src/view.ts
  - tools/build-board.mjs
  - tools/build-knights.mjs
  - tools/calibrate-board/calibrate.mjs
  - tools/import-card-art.mjs
  - tools/render-scenarios.mjs
  - tools/rules-trace.mjs
  - tools/selfplay.mjs
  - vitest.config.ts
  - apps/web/playwright.config.ts
  - apps/web/src/audio/backend.ts
  - apps/web/src/audio/engine.ts
  - apps/web/src/audio/soundNotes.ts
  - apps/web/src/audio/sounds.ts
  - apps/web/src/audio/synth.ts
  - apps/web/src/board/animator.ts
  - apps/web/src/board/cardFx.ts
  - apps/web/src/board/geometry.ts
  - apps/web/src/cards/faces.ts
  - apps/web/src/cards/fan.ts
  - apps/web/src/debug.ts
  - apps/web/src/game/GameController.ts
  - apps/web/src/game/audioSettings.ts
  - apps/web/src/game/botNames.ts
  - apps/web/src/game/cues.ts
  - apps/web/src/game/debugParams.ts
  - apps/web/src/game/director.ts
  - apps/web/src/game/session.svelte.ts
  - apps/web/src/game/turnUi.ts
  - apps/web/src/i18n/fr/board.ts
  - apps/web/src/i18n/fr/cards.ts
  - apps/web/src/i18n/fr/credits.ts
  - apps/web/src/i18n/fr/game.ts
  - apps/web/src/i18n/fr/launch.ts
  - apps/web/src/i18n/fr/reglages.ts
  - apps/web/src/i18n/fr/seats.ts
  - apps/web/src/i18n/fr/sons.ts
  - apps/web/src/licences/licences.ts
  - apps/web/src/main.ts
  - apps/web/src/settings/settings.ts
  - apps/web/src/settings/store.svelte.ts
  - apps/web/src/ui/icons.ts
  - apps/web/src/ui/toast.svelte.ts
  - apps/web/svelte.config.js
  - apps/web/vite.config.ts
  - apps/web/src/App.svelte
  - apps/web/src/board/Board.svelte
  - apps/web/src/board/CardFlights.svelte
  - apps/web/src/board/DebugGeometry.svelte
  - apps/web/src/board/FaceUpCard.svelte
  - apps/web/src/board/FeltTable.svelte
  - apps/web/src/board/HitLayer.svelte
  - apps/web/src/board/KnightDefs.svelte
  - apps/web/src/board/Overlay.svelte
  - apps/web/src/board/Particles.svelte
  - apps/web/src/board/Pawn.svelte
  - apps/web/src/routes/Game.svelte
  - apps/web/src/routes/Launch.svelte
  - apps/web/src/routes/SoundTest.svelte
  - apps/web/src/ui/ActionZone.svelte
  - apps/web/src/ui/Card.svelte
  - apps/web/src/ui/CardBack.svelte
  - apps/web/src/ui/ColorTile.svelte
  - apps/web/src/ui/ConfirmDialog.svelte
  - apps/web/src/ui/CreditsSheet.svelte
  - apps/web/src/ui/DealBanner.svelte
  - apps/web/src/ui/EndScreen.svelte
  - apps/web/src/ui/HandFan.svelte
  - apps/web/src/ui/Icon.svelte
  - apps/web/src/ui/InfoBar.svelte
  - apps/web/src/ui/PawnTray.svelte
  - apps/web/src/ui/SeatChip.svelte
  - apps/web/src/ui/Segmented.svelte
  - apps/web/src/ui/SettingsSheet.svelte
  - apps/web/src/ui/SevenPanel.svelte
  - apps/web/src/ui/Sheet.svelte
  - apps/web/src/ui/Slider.svelte
  - apps/web/src/ui/StepChip.svelte
  - apps/web/src/ui/Switch.svelte
  - apps/web/src/ui/TapisSheet.svelte
  - apps/web/src/ui/Toast.svelte
findings:
  critical: 1
  warning: 12
  info: 17
  total: 30
status: issues_found
---

# Phase 01 : revue de code

Revue en trois lots, en parallèle : A (moteur, plateau, robots, outils), B (logique de l'appli web), C (composants Svelte). Les identifiants portent la lettre du lot.


<!-- lot A.md -->

## Phase 01 (lot A): Code Review Report

**Reviewed:** 2026-10-13
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

### Summary

Lot A covers the rules engine, board geometry/timing, the level-1 bot, the build/calibration tools and the root vitest config. I read every file in full and traced the engine against RULES.md R-01 to R-16 and the G/Q decisions.

No rules divergence was found. The following were checked line by line against the source and are correct:

- Captures by the 7: `ringStretch` captures every non-own pawn on a crossed cell when `capturePassed` is set. It does so step by step (`microMove` clears the victim before the next step), refuses the whole plan on the first failing step, and refuses to stop on an own pawn.
- Home entry by exact count (`walk`, path.ts:218-244): entry only from progress >= 70 (mod 72), r in 1..4, target slot empty, no home pawn on the way (G2 "continue"). A pawn stopping on the carré 16 does not enter, and progress -2 does not enter.
- Protected exit square (G3/G4): `isProtected` and `protectorOf` block forward, backward and 7 steps, for the pawn's own colour too. `exitWalk` eats an off-colour pawn on the exit and refuses an own pawn.
- Jack: only ring pawns, never two pawns of the same colour, never a protected pawn on either side (G6), progress recomputed from the new cell (G1).
- Deal and exchange: 5/4/4, dealer constant over a cycle and rotating at reshuffle (G9), simultaneous exchange (G8), hand sizes unchanged (Q7).
- Card conservation across `endDeal` and `discard`.

I also ran dynamic checks. They are scratch scripts in the session scratchpad, not committed.

- 190 self-played games with `randomLegal` (150 + 40) produced no two pawns on one ring cell, no duplicate home slot, and always exactly 52 cards across talon, discard, hands and felt.
- On 40 further games, `legalActions(view)` equalled `legalActions(state)`, and `playability` agreed with the legal set.
- The discard was offered exactly when no card was playable.
- 73,204 enumerated legal actions applied without throwing.
- The 300 existing vitest tests pass.

The findings below are therefore robustness, supply-chain and maintainability issues, plus one phase-2 information-hiding hazard. There are no blockers.

## Warnings

### WR-A01: Card-art import verifies the tarball digest only for one hard-coded version

**File:** `tools/import-card-art.mjs:226-231`
**Issue:** The header says the tarball "is checked against the pinned digest", but the check is wrapped in `if (version === "4.0.2")`. If `assets/cartes/CHOIX.md` is ever edited to another `svg-cards` version, an unverified tarball from the npm registry is extracted and its SVG parts are copied into the shipped app (`apps/web/src/assets/cartes`), with no error and no warning. The `--ignore-scripts` and no-install hardening is good, but the integrity gate silently turns off. It also only pins a digest string without checking the signature/provenance.
**Fix:** Fail closed instead of skipping.
```js
const PINNED = { "4.0.2": SVG_CARDS_INTEGRITY };
const expected = PINNED[version];
if (!expected) throw new Error(`no pinned digest for svg-cards@${version}; add one to PINNED`);
if (integrityOfFile(tarball) !== expected) {
  throw new Error(`svg-cards-${version}.tgz has an unexpected digest`);
}
```

### WR-A02: `apply` throws a raw `TypeError` (not `IllegalActionError`) on malformed `seven` / null actions

**File:** `packages/engine/src/apply.ts:159-165` (via `packages/engine/src/types.ts:38-40`)
**Issue:** The comment on `wellFormed` (seven.ts:69) and `apply` both claim the input is untrusted (T-01-18). `apply` reads `rankOf(action.card)` before it has checked that `action.card` is a string. I ran `apply(state, "bleu", { t: "seven" })`: it throws `TypeError: Cannot read properties of undefined (reading 'slice')`. `apply(state, "bleu", null)` throws `TypeError` on `action.t`. Every other malformed shape I tried gives an `IllegalActionError`. A phase-2 server that catches `IllegalActionError` to reject a bad client frame would let this one escape as an unhandled exception inside the Durable Object. Locally it can crash the controller instead of showing "coup refusé".
**Fix:** Guard shape first, in `apply`:
```ts
if (typeof action !== "object" || action === null || typeof (action as { t?: unknown }).t !== "string") {
  throw new IllegalActionError("bad-action", "malformed action");
}
// in the seven branch:
const mayPlay =
  typeof action.card === "string" && /* existing conditions */ ...;
```
`rankOf` could also return `NaN`-safe results for non-strings, or the server could validate with Zod before calling.

### WR-A03: Engine events carry every seat's hidden cards; the "private" markers are comments only

**File:** `packages/engine/src/events.ts:12-15`, `packages/engine/src/state.ts:150-153`
**Issue:** `handDealt` (all four hands) and `cardsExchanged.received: Record<Color, CardId | null>` (all four received cards) are emitted in the single event list returned by `apply`/`newGame`. The header of events.ts says events are "later [the input] of the network protocol (phase 2) and of replay", yet the comments say the cards are "private to seat" and there is no projection function (`eventsFor(seat)` / redaction) anywhere. A phase-2 server that forwards `events` to all sockets, as the doc suggests, leaks every hand and the partner-swap card, the exact cheating surface CLAUDE.md calls out ("Sending the full game state to every socket leaks other hands and the partner swap card"). `viewFor` solves this for state but not for events.
**Fix:** Add and test a pure projection next to `viewFor`.
```ts
export function eventsFor(events: GameEvent[], seat: Color): GameEvent[] {
  return events.map((e) =>
    e.t === "handDealt" && e.seat !== seat ? { ...e, cards: [] } :
    e.t === "cardsExchanged" ? { ...e, received: { ...blank, [seat]: e.received[seat] } } : e);
}
```
Also make `handDealt.cards` redactable (e.g. `cards: CardId[] | null`) in the type.

### WR-A04: Four `RuleSet` switches are inert, although the module advertises "switching is a one-line change"

**File:** `packages/engine/src/rules.ts:93-109, 112-129`
**Issue:** `EMPTY_HAND_SKIPPED`, `EXCHANGE_KEEPS_HAND_SIZE`, `PAUSE_IN_ALL_PHASES` and `EXCHANGE_SIMULTANEOUS` are copied into `state.rules` and shown to every client in `PlayerView.rules`, but no engine code reads them (grep for `.EMPTY_HAND_SKIPPED` and the others finds nothing outside tests/rules.ts). Setting `EMPTY_HAND_SKIPPED: false` through `startGame(cfg, seed, rules)` changes nothing (`nextHolder` in apply.ts:124-131 always skips empty hands). The header and `Partial<RuleSet>` override in `startGame` promise that every rule decision "reads this, never the constants", which is false for these four. This is a trap for the later "table settings" work.
**Fix:** Either remove the inert keys from `RuleSet`/`DEFAULT_RULES` (keep them as documentation constants), or make the engine honour them (e.g. gate `nextHolder`'s empty-hand skip on `rules.EMPTY_HAND_SKIPPED`) and add a test per switch.

## Info

### IN-A01: Unreachable branch in `exitWalk`

**File:** `packages/engine/src/path.ts:271-273`
**Issue:** `exitWalk` examines pawns on the cell `EXIT[color]`. A pawn of another colour on that cell cannot be protected: `isProtected` requires `ringIndex(otherColor, progress) === EXIT[otherColor]`, and `EXIT[otherColor] !== EXIT[color]`. A pawn of the same colour has already returned `own-pawn` on line 268. The `blocked-protected` return (and the `ignoreProtection` option read there) is dead code, which suggests a misunderstanding of the rule R-12 ("un cheval d'une autre couleur sur ce losange est un cheval ordinaire").
**Fix:** Delete the branch, or add a comment and a test showing the case is impossible by construction.

### IN-A02: Stale `turn` event emitted before the next deal overrides it

**File:** `packages/engine/src/apply.ts:216-218`
**Issue:** When every hand is empty, `apply` pushes `{ t: "turn", seat: nextColor(seat) }`, then `endDeal` produces a state whose `turn` is the seat after the new dealer, so the event does not describe the resulting state. `renderReduce` papers over this because `dealt` re-sets `turn`, but any other consumer of the event stream (replay, audio, network clients) sees a turn announcement for a seat that never plays. After a reshuffle the dealer changes, so the two seats typically differ.
**Fix:** Emit that `turn` event only when no deal follows (it never happens here, so simply drop it), or emit `turn` after the `dealt`/exchange events.

### IN-A03: Exported but unused `blocksPath`

**File:** `packages/engine/src/path.ts:124-126`
**Issue:** `blocksPath` has no caller outside its own definition (grep over `packages` and `apps`), yet it is part of the public barrel via `export * from "./path.ts"`. It also duplicates `protectorOf` plus an `occupantsAt` scan.
**Fix:** Remove it, or use it in `ringStretch`.

### IN-A04: `legalActions` defaults to enumerating every plan of the 7

**File:** `packages/engine/src/legal.ts:48-50`
**Issue:** The default `sevenPlans: "all"` enumerates all plans of the 7 (about 16,000 plans, around 140 ms on an open board with four ring pawns, measured; more with captures/home options). All current callers (turnUi, randomLegal, `apply`) pass `"none"`, but the safe-looking default is the expensive and lossy-to-forget path. In "none" mode a hand whose only playable card is a 7 returns `[]`, which can look like "no legal action" to a caller that forgets the option.
**Fix:** Make `"none"` the default (opt in to `"all"` for tests), or make the option mandatory. Document the `[]` result when a playable 7 is the only card.

### IN-A05: Unguarded `n <= 0` in `hopTimeline` and `captureBeat`

**File:** `packages/board/src/hopTimeline.ts:18-22`, `packages/board/src/motion.ts:112-115`
**Issue:** `hopTimeline(0)` yields `hop = Infinity` and empty `landings`; `captureBeat(0, ...)` then returns `undefined as number`. The engine never produces an empty `path`, so this is latent, but `eventDuration` feeds `event.path.length` straight in, and `NaN` or `Infinity` durations would stall an animation queue awaiting them.
**Fix:** `if (n < 1) return { total: 0, hop: 0, landings: [], clops: [] };` and clamp in `captureBeat`.

### IN-A06: Board art is re-encoded lossy at full size, and the up-to-date check ignores the script

**File:** `tools/build-board.mjs:17-28, 32-38`
**Issue:** `composeBoard(2560)` re-encodes the stitched quarters as webp quality 80, so the full-size board is a second lossy generation of Romain's art, against the constraint "reprendre fidèlement le plateau existant". `main()` skips regeneration when the target is newer than the quarters, so a change to `OFFSETS`, quality or sizes in this script never refreshes existing outputs.
**Fix:** Use `webp({ lossless: true })` (or `quality: 100, nearLossless`) for the 2560 variant, and include this script's mtime in `newestQuarter`.

### IN-A07: Hard-coded geometry constants and mixed-language names in the board package and calibration

**File:** `tools/calibrate-board/calibrate.mjs:115`, `packages/board/src/layout.ts:65-77`
**Issue:** The ring ordering is seeded with a magic point `[207, 1280 + 618]` ("blue 1") found by eye; if the art or the cropping changes, the nearest-neighbour chain can pick the wrong first step; the `exitsAndEntriesOk` check would catch a reversed ring (jaune must land on index 18) but the failure then is an opaque topology error rather than a clear message about the seed point. `FELT_SQUARE`, `LAST_CARD_SLOT`, `TALON`, `DEFAUSSE` (French name among English ones) and `CARD_SIZE` are hand-typed board units not derived from `layout.json`.
**Fix:** Derive the first-step seed from the blue diamond's neighbour that lies clockwise, name the constants, and keep one language for identifiers.

---

_Reviewed: 2026-10-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

<!-- lot B.md -->

## Phase 01 (lot B): Code Review Report

**Reviewed:** 2026-10-13
**Depth:** standard
**Files Reviewed:** 36
**Status:** issues_found

### Summary

Lot B is the non-Svelte TypeScript of `apps/web`: the bot loop (`GameController`), the animation queue (`director`, `animator`, `cardFx`), the Web Audio engine and its backend, the turn reducer, the settings and the debug parsing. To trace the call chains I also read `routes/Game.svelte`, `App.svelte`, `board/CardFlights.svelte`, `board/Particles.svelte`, `ui/HandFan.svelte` and `packages/bots/src/randomLegal.ts`. I did not edit them and I do not report on them beyond the traced findings.

What holds up under tracing:

- The Director queue. `idle()` / `drain()` / `draining` have no gap in which an enqueued event could be lost. A `generation` counter drops stale folds after `reset()` or `dispose()`. Every animation promise is awaited through `allSettled`, and `snapToEnd` finishes pawn and card animations.
- The bot loop never acts on a stale state. After the think delay it re-derives `nextBot()` and builds the bot's view from the current `state`.
- The exchange-phase race (the human gives while a bot is sleeping) is handled.
- `unlock()`, `setMix`, `startAmbience` and the visibility handlers are all safe to call before the engine exists.
- `localStorage` access is guarded everywhere in this lot (`browserStorage`, `loadSettings`, `saveSettings`, `loadNotes`, `saveNotes`). `SoundTest.svelte:46` is outside this lot.
- Card flights and particles cannot leave the Director hanging: `cancelFlight` rejects `animation.finished`, which `runFlight` turns into a resolution, so `onDone` always fires.

No blocker. There are four warnings (the audio unlock and retry paths, and a bot loop that can die silently) and six info items.

## Warnings

### WR-B-01: A bot-turn exception ends the bot loop for good, with no recovery and no signal to the player

**File:** `apps/web/src/game/GameController.ts:198-227`
**Issue:** `run()` wraps the whole `while` loop in one `try/catch`. Any throw ends the loop, and the catch only calls `console.error`.

- `randomLegal` can throw: "has no action to play", "has no playable card", "the 7 cannot be completed" (`packages/bots/src/randomLegal.ts`).
- `apply` can throw an `IllegalActionError`.
- After the catch, `running` is false, `thinking` is null, and it is a bot's turn. Nothing restarts the loop. `submit()` is the only other place that calls `run()`, and the human cannot act on a bot's turn.
- The game freezes silently: the board is locked, no message appears, and "Abandonner" is the only way out.
- The project requirement is that the bot turn loop never stalls.

**Fix:**
- Expose a failure channel. For example, add `onError(listener)` to `GameController`, or a `failed` flag read by the session, and rethrow into the app's `svelte:boundary` so the friendly error screen shows. A tight recovery path is also possible: on a bot error, fall back to the first of `legalActions(viewFor(state, bot), bot, { sevenPlans: "none" })`.
```ts
} catch (error) {
  console.error(error);
  failureListener?.(error); // the session turns it into the "Oups" screen instead of a frozen board
}
```

### WR-B-02: "Réessayer" on the audio-failed toast immediately shows the failure toast again, even when the retry succeeds

**File:** `apps/web/src/audio/engine.ts:163-182` (trigger: `apps/web/src/routes/Game.svelte:477-481`)
**Issue:** The engine only clears `resumeFailed` inside the `.then` of `backend.resume()`.

- `retryAudio()` calls `unlock()`, then reads `audioStatus = status()` synchronously.
- At that point `resumeFailed` is still true, so `status()` returns `"failed"`.
- `if (audioStatus === "failed") warnAudioFailed()` fires at once and shows "Le son n'a pas pu démarrer" again.
- When the resume succeeds a moment later, `emit("ready")` updates `audioStatus`. The toast stays up until its 4 s timeout, and nothing dismisses it.
- The player taps "Réessayer", sees the same error, and concludes the retry failed when sound has actually come back.

**Fix:** Make the retry asynchronous and report only the final outcome, with no synchronous status read in `retryAudio`.
```ts
// engine.ts, resumeNow(): do not report a stale failure while a retry is in flight
function resumeNow(): void {
  let pending: Promise<void>;
  try { pending = backend.resume(); } catch { resumeFailed = true; updateStatus(); return; }
  pending.then(() => { resumeFailed = false; updateStatus(); },
               () => { resumeFailed = true;  updateStatus(); });
}
// Game.svelte: drop the synchronous check in retryAudio(); the existing onStatus -> audioStatus
// -> $effect path already shows the toast when (and only when) the retry really fails.
function retryAudio() { dismissToast(); unlock(); }
```
The `$effect` on `audioStatus === "failed"` only re-runs on a change. If the status stays "failed" after a failed retry, show the toast from the `.then` rejection path, or reset the status to "pending" while the retry is in flight.

### WR-B-03: Opening or reloading `#/partie` directly never creates the AudioContext: no sound, no ambience, no toast, no recovery

**File:** `apps/web/src/audio/engine.ts:449-481` (callers: `apps/web/src/routes/Launch.svelte:51`, `Game.svelte:478`, `SoundTest.svelte:92`)
**Issue:** The `AudioContext` and the engine are created only inside `unlock()`. The only callers are the "Jouer la partie" tap on Launch, the toast retry, and the sound test page.

- `App.svelte` routes straight to `<Game />` when `location.hash === "#/partie"`. That is what happens on a page reload, a PWA relaunch, or a bookmark.
- In that case `engine` stays `undefined` and `status()` returns `"pending"` forever.
- The ambience `$effect` requires `audioStatus === "ready"`, so it never starts.
- `cue()` and `scheduleClops()` are no-ops.
- The "failed" toast never fires, because status is "pending" and not "failed".
- The document-level `pointerdown` retry listener is registered inside `unlock()`, so it does not exist either.
- The player gets a silent game for the rest of the session, with no feedback and no way to enable sound short of going back to the launch screen.
- CLAUDE.md lists "iOS Safari PWA audio unlock" among the product's open risks, and a PWA relaunch is the normal case.

**Fix:** Make the first tap on the game screen an unlock gesture. Use `{ once: true }` and a `pointerup` or `click` listener (see WR-B-04).
```ts
// Game.svelte onMount
const arm = () => unlock();
document.addEventListener("click", arm, { once: true, capture: true });
return () => document.removeEventListener("click", arm, { capture: true });
```
Alternatively, expose `status() === "pending"` as a visible "touche l'écran pour activer le son" hint, as `SoundTest` already does.

### WR-B-04: The "any later tap resumes the context" listener uses `pointerdown`, which is not a user-activation event for touch

**File:** `apps/web/src/audio/engine.ts:462`
**Issue:** The listener is `document.addEventListener("pointerdown", () => made.retryResume(), { passive: true })`.

- The comment says iOS interrupts the context when the app goes to the background, and that any later tap resumes it. Backgrounding is the normal case for a phone PWA.
- Per the HTML spec's list of activation-triggering input events, a touch `pointerdown` does not grant user activation. For touch, `pointerup` and `touchend` do. WebKit's unlock gestures are `touchend` and `click`.
- So on a phone, `context.resume()` called from this handler is likely to stay pending (or be refused) after an interruption. The game then stays silent until the player happens to hit the failure toast, which never appears because no promise is rejected (see WR-B-03).
- I could not run this on a real device. CLAUDE.md already flags it as needing a real-iPhone test.

**Fix:** Listen on events that carry activation, and keep it passive and cheap.
```ts
const retry = () => made.retryResume();
for (const type of ["pointerup", "touchend", "click", "keydown"] as const) {
  document.addEventListener(type, retry, { passive: true });
}
```

## Info

### IN-B-01: Block-scoped `started` shadows the outer `started` flag in `createGame`

**File:** `apps/web/src/game/GameController.ts:140` (shadowed declaration at `:156`)
**Issue:** Line 140 declares `const started = startGame(...)` inside the `else` block. Line 156 later declares `let started = false` in the enclosing function, and `start()` / `submit()` read it.

- It is not a bug today: the inner `const` is block-scoped.
- A later edit that moves or reads `started` in that area would silently bind to the wrong variable.

**Fix:** Rename the inner one, for example `const opened = startGame(...)`.

### IN-B-02: The instant path (hidden tab, `snapToEnd`, `test` mode) commits no facing for eaten knights or Valet swaps

**File:** `apps/web/src/game/director.ts:401-405` and `:443-446`
**Issue:** `deps.commit(...)` for the victims runs only `if (canAnimate)`, and for swapped pawns only `if (animated && legs !== null)`.

- When a play is applied without motion, the mover is committed but the victim's and the swapped knights' facing is not.
- Their position is right (it comes from the render state), but their head can point the wrong way after a catch-up from a background tab.
- The effect is cosmetic.

**Fix:** Commit the victims and the swap legs in the instant path as well, with the facing computed the same way.

### IN-B-03: Licence manifest splits brace-expanded file lists on commas

**File:** `apps/web/src/licences/licences.ts:86`
**Issue:** `row.fichier.split(",")` breaks the existing `cavaliers` row: `apps/web/public/cavaliers/{bleu,jaune,rouge,vert}.webp` becomes `…/{bleu`, `jaune`, `rouge`, `vert}.webp`.

- `covers()` can then never match `apps/web/public/cavaliers/bleu.webp`.
- It is harmless today, because the coverage test only scans `src/assets` and `public/audio`. It becomes a false "uncovered" report as soon as the scan widens.

**Fix:** Either list the four files explicitly, or give `uncoveredAssets` a brace-aware split. The rules in `LICENSES.md` state that a row holds no braces or other markup, so listing the files is the consistent choice.

### IN-B-04: `fanLayout` and `visibleSlice` can return a negative offset

**File:** `apps/web/src/cards/fan.ts:25` and `:34`
**Issue:** `Math.min(56, Math.floor((width - cardW) / (n - 1)))` has no lower bound.

- `HandFan` starts with `width = 0` (`let width = $state(0)`), updated from `bind:clientWidth` after mount.
- For a first frame the offset is negative and the fan renders mirrored. `fanSpread` can also go negative.
- This is a flicker at most.

**Fix:** `Math.max(0, Math.min(56, Math.floor(...)))`, or skip the layout while `width === 0`.

### IN-B-05: Playwright always reuses whatever server is on port 4173

**File:** `apps/web/playwright.config.ts:16`
**Issue:** `reuseExistingServer: true` has no CI guard.

- If a non-debug (production) preview is already listening on 4173, the e2e specs run against it without `__TOC_DEBUG__`.
- The failures are then confusing (`window.__tocDebug` undefined, debug hash parameters ignored) rather than an obvious server error.

**Fix:** `reuseExistingServer: !process.env.CI`.

### IN-B-06: Ambience pause and resume is wired in three places

**File:** `apps/web/src/audio/engine.ts:464-467`, `apps/web/src/game/director.ts:585-595`, `apps/web/src/routes/Game.svelte:490-494`
**Issue:** On every `visibilitychange` the engine shell, the Director and the Game screen's `$effect` each pause or resume the ambience.

- It is idempotent today (`tryStartAmbience` guards on `ambienceVoices.length`, and `resumeAmbience` on `ambienceWanted`).
- Three owners of the same state make a future change to the pause rules easy to get wrong in one place.

**Fix:** Keep one owner, preferably the engine shell. Drop the Director's `pauseAmbience` and `resumeAmbience` hooks; the Director only needs `hidden` for the instant path.

---

_Reviewed: 2026-10-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

<!-- lot C.md -->

## Phase 01 (lot C): Code Review Report

**Reviewed:** 2026-10-13
**Depth:** standard
**Files Reviewed:** 36 (apps/web Svelte 5 components)
**Status:** issues_found

### Summary

The 36 Svelte components are in good shape. `svelte-check` reports 0 errors and 0 warnings across 267 files. There is no `{@html}` anywhere in `apps/web/src`, and `no-raw-html.test.ts` guards that. Runes usage is mostly sound. I traced the `$effect` blocks in `Board`, `Particles`, `HandFan`, `DealBanner`, `ActionZone` and `Game` and found no update loops. Effects that write state (`Game` audio toast, `ActionZone` `exchanged`) do not read what they write. Listeners (`App` hashchange, `Sheet` window handlers, `DealBanner` timer, `Particles` and `CardFlights` animations) all have cleanup.

The "illegal or duplicate action" surface is well defended. Every `send()` goes through the pure reducer in `turnUi.ts`:
- `confirm` leaves `preview` for `waiting` in the same call, so a double-tap on "Jouer" cannot submit twice.
- `give` and `pose` are gated on the current state and the legal actions.
- `pickSteps` re-validates against `state.steps`.
- `confirmSeven` re-checks `isComplete`.
- `StepChip` uses `aria-disabled` while the reducer refuses the step, so a disabled chip cannot push an illegal 7.

I checked the one geometry risk. The invisible felt button (`.tapis`) sits above the SVG hit layer, but no ring or home knight body overlaps the felt (nearest is about 149 board units away). It does not steal knight taps at normal sizes.

What I found:
- 1 real state-leak bug (scroll lock stuck after abandoning a game).
- 4 robustness and accessibility warnings.
- 4 minor items.

Every finding below is traced to the cited lines. I could not run a browser in this environment, so CR-C-01 is established by source trace, including Svelte 5.57.2's effect-destroy order, and not by a run.

## Critical Issues

### CR-C-01: Page scroll lock stays on after "Abandonner la partie" (nested sheets restore the wrong `overflow`)

**File:** `apps/web/src/ui/Sheet.svelte:89-95` (triggered through `apps/web/src/ui/SettingsSheet.svelte:104-114`, `apps/web/src/routes/Game.svelte:268-273`)
**Issue:** Each `Sheet` saves `document.body.style.overflow` in its own `$effect`, sets `"hidden"`, and restores the saved value in cleanup. This only works if sheets are destroyed in LIFO order.

The abandon flow stacks two sheets: Réglages (sheet 1, saved `""`) and the ConfirmDialog's sheet (sheet 2, saved `"hidden"`). Sheet 2's effect runs after sheet 1's, so its saved value is `"hidden"`.

When the player confirms, `abandon()` sets `location.hash = "#/"`. `App` then drops the whole `<Game>` branch. Svelte's `destroy_effect_children` (`svelte/src/internal/client/reactivity/effects.js:471-495`) tears effects down first to last, so sheet 1's cleanup runs first (`""`) and sheet 2's second (`"hidden"`). The final value is `"hidden"`.

The player lands on the launch screen with `body { overflow: hidden }`. Nothing else resets it: `grep body.style` finds only these three lines, and `app.css` sets no overflow on `html`/`body`. The launch column is about 700 px or more tall (48 px padding top and bottom, 2x2 tiles of at least 128 px, team summary, two buttons). It cannot scroll on a 667 px phone or in a landscape phone, so "Jouer la partie" and "Réglages" can be unreachable until a reload.

`e2e/reglages.spec.ts:369-379` covers this flow but never asserts on `body.style.overflow`.
**Fix:** Make the lock a shared, reference-counted resource instead of per-instance save and restore:
```svelte
<script module lang="ts">
  let locks = 0;
  let saved = "";
  function lockScroll(): () => void {
    if (locks++ === 0) {
      saved = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    return () => {
      if (--locks === 0) document.body.style.overflow = saved;
    };
  }
</script>
...
$effect(() => lockScroll());
```
Add an e2e assertion after "abandon: confirmer ramène à l'écran de lancement": `expect(await page.evaluate(() => document.body.style.overflow)).toBe("")`.

## Warnings

### WR-C-01: Errors in the game start-up path skip the "Oups" error screen and leave a blank game

**File:** `apps/web/src/routes/Game.svelte:224-252`
**Issue:** `onMount` runs `(async () => { opened = await loadDebugParams(...); if (alive) await begin(opened); })()` with no `.catch`. `begin()` is async and calls `createSession(...)`, which builds the controller, the Director and the first `reduceTurnUi`.

`<svelte:boundary>` in `App.svelte:37` only catches synchronous render and effect errors. If `createSession` or `created.start()` throws, the rejection is unhandled and `session` stays `undefined`. The template renders an empty `<main class="game">` forever: no board, no message, no way out. That breaks the T-01-33 / UI-SPEC "Oups, le jeu a rencontré un problème" contract.

The Director and controller loops catch and `console.error` their own errors (`director.ts:388`, `director.ts:557`, `GameController.ts:221`). So this async start-up path is the one place where the boundary is bypassed.
**Fix:** Catch in the async path and re-raise inside the component tree so the boundary sees it:
```ts
let failure = $state.raw<unknown>();
...
(async () => { try { ... } catch (e) { failure = e; } })();
$effect.pre(() => { if (failure !== undefined) throw failure; });
```
Alternatively, render the error block directly when `failure` is set.

### WR-C-02: "Tester les sons" in the in-game Réglages silently destroys the running game

**File:** `apps/web/src/ui/SettingsSheet.svelte:78-79` (consequence in `apps/web/src/routes/Game.svelte:243-252`)
**Issue:** The sheet always renders `<a class="btn btn-text" href="#/sons">`, including when it was opened from the game (`onabandon` is set). One tap changes the hash, `App` swaps `<Game>` for `<SoundTest>`, and `Game`'s `onMount` cleanup disposes the session. The 15 to 40 minute game is lost with no confirmation.

"Abandonner la partie" is guarded by a dedicated destructive dialog because losing the game is a big deal (UI-SPEC "Destructive confirmation"). This link has the same effect with one stray tap, directly above the abandon button.

"Retour" on the sound page goes to `#/` (the launch screen), so there is no way back into the game.
**Fix:** Hide the link when `onabandon` is set (the sound test is a launch-screen tool), or route it through the same `ConfirmDialog`. Optionally also add a `beforeunload` / hash guard for browser Back during a game.

### WR-C-03: End-of-game dialog does not actually trap focus or inert the board behind it

**File:** `apps/web/src/ui/EndScreen.svelte:33-49`
**Issue:** The trap is a `keydown` handler on the panel that swaps focus between the two buttons. It only runs when focus is already inside the panel.

If the player clicks or taps the scrim outside the panel, focus moves to `<body>`. The next Tab goes to the first tabbable element in the document, behind the scrim: the Réglages gear, then the felt "Sur le tapis" button, and so on. `aria-modal="true"` is declared, but nothing marks the rest of the page `inert`.

`Sheet.svelte` handles this with a `focusin` guard (`Sheet.svelte:132-135`). `EndScreen` has no equivalent.
**Fix:** Reuse the `Sheet` mechanism. Either render the end screen through `Sheet`, or add `<svelte:window onfocusin>` that refocuses the panel when `event.target` is outside it. Better, set `inert` on the `.layout` container while `render.phase === "won"` and drop the hand-rolled Tab handler.

### WR-C-04: Candidate knights are indistinguishable for keyboard and screen-reader users

**File:** `apps/web/src/board/HitLayer.svelte:73-80`
**Issue:** The keyboard route to playing a move is the lit knights in `HitLayer`, rendered as `role="button" tabindex="0"`. Every one is labelled `game.hand.pawn(pawnColor(target.pawn))`, i.e. just the colour ("Cheval bleu").

With a card selected, a player's two or more lit knights of one colour announce identically, and nothing tells them apart (position, letter, cell). The A to D letters exist (`knightLetter` / `trayLetters`) but are only shown for the visual tray and the 7 panel.

Tab order also follows `candidates` order, not board position. A keyboard-only player cannot know which knight they are about to move before the preview appears. The same applies to the 16 `Pawn` `role="img"` nodes, which all read as "Cheval {couleur}".
**Fix:** Include the knight's letter and, for the 7, ideally its zone in the label, for example `Cheval bleu A, sur la case 12` or `…, à l'écurie`. Reuse `knightLetter(target.pawn)` and a localized place string.

## Info

### IN-C-01: `Pawn.svelte` interactive branch is dead code

**File:** `apps/web/src/board/Pawn.svelte:18, 39-44, 70-73, 81-96`
**Issue:** `onselect`, its `onkeydown`, the invisible 72-unit hit `<circle>` and the whole `role="button"` branch are never used. `Game.svelte:525-534` mounts `Pawn` without `onselect`; all input goes through `HitLayer`. `grep onselect` shows no caller (the other `onselect` hits are `ColorTile` / `Launch`). About 30 lines and a second, divergent hit model are shipped for nothing.
**Fix:** Remove the `onselect` prop and the interactive branch, and keep `Pawn` purely presentational.

### IN-C-02: Geometry constants are copied between components instead of shared

**File:** `apps/web/src/board/HitLayer.svelte:26-27`, `apps/web/src/board/Overlay.svelte:34-35, 39-44`
**Issue:** `BODY = 92` and `FOOTPRINT = 110` are redeclared in both files (the halo and the hit circle must agree to the unit). `Overlay`'s `SLOT` repeats `LAST_CARD_SLOT` from `@toc/board` (`layout.ts:68-73`), which `FeltTable` already imports; the values are currently identical. If one copy is retuned, the halo, hit area and seat ring silently drift apart.
**Fix:** Export `KNIGHT_BODY` / `KNIGHT_FOOTPRINT` from `@toc/board` (or `board/geometry.ts`) and import `LAST_CARD_SLOT` in `Overlay`.

### IN-C-03: Keyboard focus is dropped after every play, and cards swap `button` and `div`

**File:** `apps/web/src/ui/Card.svelte:74-93`, `apps/web/src/ui/HandFan.svelte:55`, `apps/web/src/ui/ActionZone.svelte:169`
**Issue:** The action zone re-creates its content on every state change (`{#key key}`), and each `Card` swaps between `<button>` and `<div role="img">` when `interactive` flips (`mode === "waiting"`). A keyboard user who selects a card and tabs to "Jouer" loses focus to `<body>` when the move is confirmed. After the bots' turns they must tab from the top of the page again.

UI-SPEC's baseline keyboard path (Réglages, pawns, action buttons, hand) is therefore a single pass. It is not a problem for pointer or touch.
**Fix:** After the Director goes idle on the human's turn, move focus to the roving hand card (`buttons[cards[roving]]`), or to the first action button. At minimum keep the `<button>` element and set `inert` / `aria-disabled` instead of swapping tags.

### IN-C-04: Sound-test page gives no feedback before the first tap, or when the engine failed

**File:** `apps/web/src/routes/SoundTest.svelte:96-101, 244-269`
**Issue:**
- The A/B "Fichier" / "Généré" buttons are `disabled` until the engine is ready (`!known?.file` while `catalogue` is `{}`). A disabled button swallows the click, so a first tap on it neither unlocks the audio nor says anything. Only a tap elsewhere (`<svelte:window onclick={begin}>`) starts the decode. The "Son en attente : touche l'écran" line helps but is easy to miss.
- `whenReady()` stores a single `queued` callback. If `engineStatus` is `"failed"`, nothing runs and nothing is shown beyond the state line. If a later retry succeeds, a stale, long-forgotten sound plays unprompted.

**Fix:** Don't `disable` the A/B buttons before the first unlock (let the tap call `begin()`), and clear `queued` when the status becomes `"failed"`. Optionally show a toast on failure.

---

_Reviewed: 2026-10-13_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
