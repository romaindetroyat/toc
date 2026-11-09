---
phase: 05-suivi-apprentissage-et-finition
plan: 03
subsystem: tutorial
tags: [lessons, tutorial, turn-ui, engine, app-04]
status: complete

requires:
  - phase: 01-jouer-une-partie-juste-en-solo
    provides: the engine (scenarioState, apply, EXIT), the turn reducer (turnUi.ts), GameController
  - phase: 03-ordinateurs-de-force-reglable
    provides: the bot loop and runner of GameController
provides:
  - createGame's optional `script` (lessons only), where scripted seats play what is written or nothing
  - LESSONS, the eight lessons of D-07 as data (positions in RULES.md cells, Bleu's hand, steps, recaps)
  - progressOf(colour, cell)
  - lessonStep / lessonGate / lessonDone / lessonHalo, pure functions in front of reduceTurnUi
  - i18n/fr/lecons.ts, every title, guide line, wrong line and recap (drafts for Romain)
affects: [05-06 lesson screen (gate in session.send, guide band, halo, plank), 05-08 lessons page and first-launch offer]

actuals:
  tokens: 15000
  tasks: 2
  commits: 4
plan_head_before: 0001c2f3d2b1285bfb086b1b6c8271f126595224
plan_head_after: 7c757a44bae2ccc7e1a17587dd3f3434b7a94f5e

tech-stack:
  added: []
  patterns:
    - "A lesson is a scenario for the real engine plus a pure gate in front of the turn reducer; no second rules engine and no second UI"
    - "The current step is derived from the turn state, the moves played and the narration lines passed. It is never a tap counter"
    - "A wrong choice is refused before the reducer, so the view and the turn state stay the same object"

key-files:
  created:
    - apps/web/src/game/lessons.ts
    - apps/web/src/game/lessons.test.ts
    - apps/web/src/game/lessonRunner.ts
    - apps/web/src/game/lessonRunner.test.ts
    - apps/web/src/i18n/fr/lecons.ts
  modified:
    - apps/web/src/game/GameController.ts
    - apps/web/src/game/GameController.test.ts

key-decisions:
  - "A scripted seat with no action left is skipped in the exchange, so the other givers are not held up. On its own turn in play the loop just stops (nothing thinks)"
  - "The halos are derived from each step's expectation (lessonHalo) rather than stored beside it, so they cannot disagree"
  - "Lesson 6's refused split resets with cancelAll and then the 7 again, which puts the player back at the start of the split with the 7 still in hand, not back at « Touche le 7 »"
  - "Lesson 7's first line was shortened to 106 characters (the UI-SPEC draft has 115)"

patterns-established:
  - "LessonEvent = TurnUiEvent | { t: 'next' }; LessonProgress = { told, played }; the screen counts « Suivant » presses and the moves the engine accepted, and derives everything else"

requirements-completed: [APP-04]

duration: 75min
completed: 2026-11-07
---

# Phase 5 Plan 03: Le moteur des leçons Summary

**The eight lessons of D-07 are now data that runs on the real engine and turn reducer. A pure guide gate checks every tap, and createGame has a `script` option so lesson 8's three other seats pass known cards. A Node replay plays every lesson to « Bravo » and checks that every declared wrong choice is refused with its line and changes nothing.**

## Performance

- **Duration:** about 75 min
- **Completed:** 2026-11-07
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- **`GameController.ts`:** new `script?: Partial<Record<Color, Action[]>>` option, documented as lessons only and copied at creation.
  - In `run()`, a scripted seat that is due plays its next action as soon as the director is idle (no think, no pace).
  - A scripted seat with an empty list never acts. `nextBot()` skips it in the exchange, and returns null on its turn in play.
  - A scripted action the engine refuses throws inside the loop and reaches `onError`, like a failing bot step.
  - Without `script`, the game behaves exactly as before. All earlier tests pass unchanged.
- **`lessons.ts`:**
  - `progressOf(colour, cell) = (cell − EXIT[colour] + 72) % 72`.
  - A `knights(colour, ...cells)` helper.
  - `LESSONS`: the eight lessons in UI-SPEC order, each with `n`, `title`, `before`, an optional `script`, `steps` and `recap`.
  - Step kinds: `next`, `card`, `pawn`, `steps`, `button` (confirm | give), `plan` (eats) and `cross`. Each step can carry a `wrong` line and per-choice `wrongs` lines.
- **`lessonRunner.ts`:**
  - `lessonStep(lesson, ui, progress)` returns `{ index, step, ready }`, or null once the lesson is over.
  - `lessonGate(step, event, ui, ctx)` returns `{ pass: true }`, or `{ pass: false, line, reset? }`.
  - `lessonDone` says whether the lesson is over.
  - `lessonHalo(step, ui)` returns what to ring: a card, a knight, a step chip, or the « Suivant », « Jouer » or « Passer cette carte » button.
  - The module is pure: no storage, no clock, no Svelte, and no rule of its own.
- **Gate rules:**
  - The steps back (`back`, `escape`, `changeCard`, `cancel`, `cancelAll`, `undoLast`, `closeTray`) and `sync` always pass.
  - A tap during a narration line is refused with that line.
  - Another card is refused with the step's wrong line. Touching the chosen card again (putting it down) passes.
  - Another knight is refused when the game would take it, whether by `tapPawn`, `chooseTrayOption` or the knights near a `tapAt`. A knight already chosen passes, since touching it is a step back. A knight the game does nothing with passes, because it changes nothing anyway.
  - Lesson 6's split lets any knight and any chip through. Its « Jouer » passes only if the preview's captures include both opponents.
  - A `submit` at a step that does not ask for one is refused.
- **`lecons.ts`:** every UI-SPEC line, word for word except lesson 7's first line, with phase-1 typography. The typography test covers it.

## Task Commits

1. **Task 1 RED:** `9c2b43d` test(05-03): scripted computers for the lessons (RED)
2. **Task 1 GREEN:** `609bcd4` feat(05-03): scripted computers for the lessons
3. **Task 2 RED:** `d17807c` test(05-03): eight lessons replayed to « Bravo » (RED)
4. **Task 2 GREEN:** `7c757a4` feat(05-03): the eight lessons and the guide that checks each tap

## Gate

- `pnpm typecheck` OK. `pnpm lint` OK (399 files).
- `pnpm test`: 127 files, 2006 passed, 2 skipped.
- Local Playwright (`playwright.config.ts`, both projects): 473 passed, 99 skipped (7.2 min).
- Online suite (`playwright.online.config.ts`): 110 passed, 2 skipped (10.6 min).
- The suites ran one after another. Nothing was left listening on 8787 or 4173 (checked by connecting).
- Plan verify (`vitest --project node apps/web/src/game apps/web/src/i18n`): 15 files, 371 tests.

## The lessons' positions (cells → progress) and where they end

| # | Position | Bleu's hand | Right path | Final position (asserted) |
|---|----------|-------------|------------|---------------------------|
| 1 | Bleu all in stable; Jaune 30 (p 12), Vert 50 (p 68) | 1H, 8S, 3D | Suivant ×2, As (exit preview opens by itself), Jouer | one Bleu knight on its losange (p 0) |
| 2 | Bleu 2, 10 | 8C, 12H, 5S | Suivant, 8 (only bleu1 can play it: auto preview), Jouer | bleu0 at 2, bleu1 at 18 |
| 3 | Bleu 12; Jaune 20 (p 2) | 8D, 3S, 10C | 8 (auto), Jouer | bleu0 at 20, jaune0 in stable |
| 4 | Bleu 0 (just out); Vert 68 (p 14) | 4H, 9S | 4 (auto), Jouer | bleu0 at progress −4 (cell 68), vert0 in stable |
| 5 | Bleu 5; Jaune 66 (jaune0, p 48) and 40 (jaune1, p 22) | 11S, 6D | Valet, bleu0, jaune0, Jouer | bleu0 at 66, jaune0 at cell 5 (p 59), jaune1 at 40 |
| 6 | Bleu 20 (bleu0), 40 (bleu1); Jaune 22 (p 4); Vert 43 (p 61) | 7C, **2H** | Suivant, 7, bleu0 + 3, bleu1 + 4, Jouer (also 2 + 5) | jaune0 and vert0 in stable |
| 7 | Bleu 68 | 6S, 9H, 13C | Suivant, 6 (auto), Jouer | bleu0 home slot 3 (the deepest) |
| 8 | Exchange, dealer Vert; Bleu 10, Jaune 30, Vert 50, Rouge all in stable | 13S, 9C, 5H, 10D, 2S | Suivant, choose Roi, Passer cette carte, (cross), Suivant | phase play, Bleu's turn, 7H received, 13S given |

For every lesson the replay also checks four things: Bleu keeps at least one card, `dealsPlayed` does not change, no `dealt` event happens, and only Bleu plays a card. The runner stub throws if anything thinks, and it never does.

Lesson 8's script: Jaune gives 3C (from 3C 4C 6C 8C 12C), Rouge gives 7H (from 7H 4H 6H 8H 12H) and Vert gives 2D (from 2D 4D 6D 8D 12D).

## Wrong choices covered (one case per declared line)

- **Lesson 1:** the As tapped during « Bienvenue » gets the narration line. The 8 and the 3 get « Pas celle-là : aucun de tes chevaux n’est dehors… ».
- **Lessons 2, 3 and 4:** another card gets the lesson's wrong line.
- **Lesson 5:**
  - the 6 gets the Valet's wrong line;
  - Jaune 40 (jaune1) is refused with the wrong target line at the target step, and also from the swap preview.
- **Lesson 6:**
  - the 2 gets « Touche le 7. »;
  - the split 1 + 6 (which eats only Vert) is refused on « Jouer » with « Ce partage ne mange pas les deux… » and goes back to an empty split with the 7 still selected.
- **Lesson 7:** the 9 and the Roi each get their own line.
- **Lesson 8:** giving the 9 gets « Pas celle-là : sans As ni Roi… ».

After each wrong choice the tests check that the controller's view is byte-identical, the turn state is the same object and the step is the same. The right path then still plays to the end.

## Decisions Made

- **Narration counted, everything else derived.** `LessonProgress = { told, played }`. The screen counts « Suivant » presses (`told`) and the moves the engine accepted (`played`). Card, knight and split steps are read from the turn state, so Échap or « Changer de carte » brings back that step and its own line.
- **`ready` on the « cross » step.** Lesson 8's last line is current once the give is played, but it is not ready, and « Suivant » is refused, until the cards have crossed (turn state no longer `exchange` or `exchangeWaiting`). The screen (05-06) can hide « Suivant » while `ready` is false.
- **Halos derived** by `lessonHalo` from the step's expectation, including lesson 6's knight-then-chip.
- **The scripted seat is skipped in the exchange** once its list is empty, so it does not hold up the others.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Line too long] Lesson 7's first line shortened**
- **Found during:** Task 2 GREEN (the length test)
- **Issue:** The UI-SPEC draft « Pour rentrer, il faut tomber pile sur une des quatre cases de ta maison. Son entrée est le carré, juste devant toi. » has 115 characters. The limit is 110.
- **Fix:** « Pour rentrer, tombe pile sur une des quatre cases de ta maison. Son entrée est le carré, juste devant toi. » (106). The point and the « tu » are kept.
- **Files modified:** apps/web/src/i18n/fr/lecons.ts
- **Commit:** 7c757a4

**2. [Rule 1 - Test driver] The replay driver syncs on game changes, not after every tap**
- **Found during:** Task 2 GREEN
- **Issue:** The RED driver sent `sync` after every event. `sync` re-derives an own-turn state to `idle`, so every selection was dropped and no lesson could advance. The real session only syncs when the game changes (`controller.onChange`, then the director's idle).
- **Fix:** The driver subscribes to `game.onChange` for `sync`, as the session does. It also waits one macrotask before looking at a lesson, so lesson 8's scripted gives have landed. This changes only the test driver, not what is asserted.
- **Files modified:** apps/web/src/game/lessons.test.ts
- **Commit:** 7c757a4

### Position changes against the UI-SPEC

- **Lesson 6:** Bleu also holds a 2 (2H) that the lesson never asks for. This was planned (the known case): with the 7 alone the four hands would be empty after it and a new deal would start. The gate refuses the 2 with « Touche le 7. ».
- **Lesson 8:** the UI-SPEC only says that Rouge's four knights are in its stable. I added Bleu 10, Jaune 30 and Vert 50 so the board looks alive, as in lesson 1.
- No other position or hand differs from the UI-SPEC, and no rule was changed.

### Interface additions (beyond the plan's wording)

- `lessonGate`'s refusal can carry `reset: TurnUiEvent[]`. Only lesson 6 uses it: `[cancelAll, tapCard 7C]`. The plan says « back to its start (cancelAll) ». Re-tapping the 7 after `cancelAll` keeps the player at the start of the split instead of the card choice. The refusal line shows either way.
- `lessonStep` returns `{ index, step, ready }`. The third parameter is `LessonProgress = { told, played }`.

No architectural change, no new package, no wrangler change.

## Known Stubs

None. The lessons are not on screen yet, by design: 05-06 wires them into the game screen and 05-08 adds the lessons page.

## À relire par Romain (D-06/D-09, at UAT)

Every guide line, wrong line and recap in `apps/web/src/i18n/fr/lecons.ts` is a draft taken from the UI-SPEC. The one change is lesson 7's first line, shortened to fit 110 characters (see above).

## Deploy Notes

No migration, secret or config change. Nothing is on screen yet. Rebuild before deploying, as usual.

## Self-Check: PASSED

- FOUND: apps/web/src/game/lessons.ts, apps/web/src/game/lessons.test.ts, apps/web/src/game/lessonRunner.ts, apps/web/src/game/lessonRunner.test.ts, apps/web/src/i18n/fr/lecons.ts
- FOUND commits: 9c2b43d, 609bcd4, d17807c, 7c757a4
