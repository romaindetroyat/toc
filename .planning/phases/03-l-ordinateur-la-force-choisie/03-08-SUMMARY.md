---
phase: 03-l-ordinateur-la-force-choisie
plan: 08
subsystem: audio
tags: [audio, sons, gap-closure, romain]
status: complete
gap_closure: true
requires: ["03-07"]
provides: ["ENABLED_SOUNDS: one switch of what is heard; only the hoof clops sound"]
affects: [apps/web/src/audio, apps/web/src/game/director.ts, apps/web/src/routes/SoundTest.svelte]
tech-stack:
  added: []
  patterns: ["one allow-list of heard sounds, enforced where buffers start (engine) and where game events become sounds (Director)"]
key-files:
  created: []
  modified:
    - apps/web/src/audio/sounds.ts
    - apps/web/src/audio/engine.ts
    - apps/web/src/audio/choices.ts
    - apps/web/src/game/director.ts
    - apps/web/src/routes/SoundTest.svelte
    - apps/web/src/i18n/fr/sons.ts
    - apps/web/src/audio/engine.test.ts
    - apps/web/src/audio/choices.test.ts
    - apps/web/src/game/director.motion.test.ts
    - apps/web/src/game/director.cards.test.ts
    - apps/web/e2e/audio.spec.ts
    - apps/web/e2e/sons.spec.ts
    - apps/web/e2e/animations.spec.ts
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/deferred-items.md
    - .planning/phases/03-l-ordinateur-la-force-choisie/03-CONTEXT.md
decisions:
  - "Only the hoof clops sound (Romain, 2026-10-15: « Oui, que les sabots »): ENABLED_SOUNDS = {sabot} in audio/sounds.ts"
  - "The switch is enforced in the audio engine (no render, prepare or play of a silenced sound) and in the Director (it does not ask for one); cuesFor keeps the full cue plan"
  - "#/sons hides the sections with no heard sound and shows one « coupés pour l’instant » line; « Copier mes choix » lists the shown sounds only"
metrics:
  duration: "about 30 min"
  completed: 2026-10-15
actuals:
  tokens: 30000
  tasks: 3
  commits: 4
plan_head_before: 563693b3346c178f8aed36519dcd0536c527ce72
plan_head_after: 4a8c72c1f4046664720e07534ecfda882495f369
---

# Phase 3 Plan 08: Que les sabots Summary

Every sound but the hoof clops is now silent. One allow-list, `ENABLED_SOUNDS = {"sabot"}` in `apps/web/src/audio/sounds.ts`, controls this. The audio engine never renders, prepares or plays a sound outside the list. The Director no longer asks for the neighs or the card sounds. `#/sons` shows the hooves only.

## What was silenced

- The six neighs: sortie, ruade, plainte, joyeux, fête (4th knight home), surpris (Valet).
- The three card sounds: donne, pose (played card and dead hand), échange.
- There was no end-of-game, victory/defeat or UI-click sound to silence (none was ever added; 01-53 was deferred). The ambience had already been removed on 2026-10-14.
- Kept as before:
  - the hooves, in the version chosen on `#/sons` (01-51);
  - the « Son » and « Bruitages » switches (the hooves are on the effect bus);
  - the iPhone silent-mode keepalive of 01-49.
- Nothing was deleted:
  - `synth.ts` recipes, the catalogue entries and `DEFAULT_CHOICES` are all still there;
  - the cue plan `game/cues.ts` keeps its timings, and its tests are unchanged.
- To bring a sound back, add its id to `ENABLED_SOUNDS`. Its `#/sons` section comes back by itself.

## Tasks

| Task | Commit | What |
| ---- | ------ | ---- |
| plan | 0cd09e5 | 03-08-PLAN.md |
| 1 | a7dc1f3 | `ENABLED_SOUNDS` and `isSoundEnabled`. The engine has an `enabled` option, default `ENABLED_SOUNDS`: `renderAll` prepares enabled sounds only; `cue`, `play` and `scheduleClops` do nothing for a silenced sound; `setChoices` keeps a silenced sound's choice without preparing it. The shell `cue()` returns before its debug log. The Director skips silenced cues. Unit tests updated. |
| 2 | 75dacce | `#/sons`: the rows are the enabled sounds only, and empty sections are hidden. Under the intro, one line reads « Les hennissements et les sons des cartes sont coupés pour l’instant : dans la partie, on n’entend que les sabots. ». `choicesAsText(choices, names, ids = SOUND_IDS)` gets an optional ids list, and the page passes the shown ids. |
| 3 | 4a8c72c | e2e specs (audio, sons, animations) updated. Dated notes quoting Romain added to the phase 1 deferred-items.md and to 03-CONTEXT.md. |

## Test changes (no assertion dropped without a record)

**Unit (vitest):**
- `director.motion.test.ts`:
  - these tests used to expect neigh cues with their audio-clock times: sortie, ruade+plainte, plainte (reduced), plainte at the 7's beat, surpris, joyeux, fête, fête (reduced);
  - they now expect `h.cues` to be `[]`, and their titles say the neigh is silenced;
  - new test: `cuesFor` still plans « hennissement-sortie », the Director sends nothing, and the clops still go out.
- `director.cards.test.ts`:
  - carte-donne, carte-pose (×1, ×3, dead hand) and carte-echange now expect `[]`;
  - the hidden-tab test used to show « no sound while hidden, sound again after » with card cues. It now checks that no card cue happens, plus the card motions. The hooves' hidden-tab silence and their return are still covered by `director.test.ts` « makes no sound at all while the tab is hidden ». The unused `T0` constant is removed.
- `engine.test.ts`:
  - the unlock render count goes from 12 to 3 (the hoof takes only);
  - the jitter tests now cue « sabot » (they used carte-pose and hennissement-sortie);
  - tests of machinery that is kept for later now run with `enabled: EVERY_SOUND`: file versions m4a/mp3, the file fallback to « a », the silence version, a sound with no render, « every cued sound once », the failed neigh-ruade render;
  - new block « only the hooves » with 4 tests: the switch's content; only hoof takes are rendered; no cue or play of a silenced sound, while the clops still play; a silenced sound's choice is kept but not prepared.
- `choices.test.ts`: new test for the `ids` parameter of `choicesAsText`.
- Unchanged: `cues.test.ts`. It still checks the full plan and timings of every neigh and card sound.

**e2e (Playwright):**
- `audio.spec.ts`:
  - the first test now checks that the only renders are `hoof#0..2`: audible, under 0.3 s, and nothing else even 500 ms later;
  - **record:** it used to check the durations of the neigh and card recipes (sortie ≈ 1.15 s, surpris < 0.5 s, ruade < 0.4 s, fête > joyeux, donne > pose). Those checks are listed in its comment and come back with the ids.
- `sons.spec.ts`:
  - layout: 1 section instead of 3, plus the muted line; rows 12 → 3; `data-sound` 10 → 1; radiogroups 10 → 1; version buttons 13 → 4; play buttons 18 → 9; sources 13 → 4; licence lines 10 → 1;
  - the « Poser une carte » choice row is now asserted absent (twice);
  - the copied list is `Sabots : B` only (it was 10 lines); the fallback textarea holds `Sabots : C` only;
  - new test: no neigh or card row or button; nothing but hoof renders; a hoof version plays and nothing else does.
- `animations.spec.ts`:
  - new helper `expectOnlyHooves`: the clops are scheduled (when the move has any); no non-hoof cue is in `audio.cues`; no non-hoof buffer is in `audio.played`;
  - every neigh or card check now asserts « not cued / not played »: sortie, ruade/plainte, the 7, Valet, maison, 4th knight, reduced capture and 4th, donne, carte jouée, échange, main posée, fast donne/échange, hidden-tab return;
  - the timing `near(...)` checks of those cues were removed. Those timings are still covered in `cues.test.ts`;
  - titles that promised a sound now say « sans … ». All animation timings are unchanged.
- `reglages.spec.ts`: unchanged (it reads `hoof#0`, which is still rendered).

## Verification

- `pnpm typecheck`: 0 errors. `pnpm lint`: clean.
- `pnpm test`: **939 passed, 2 skipped** (baseline 933 + 6 new).
- Playwright run of the audio, sons, animations and reglages specs on both projects: **138 passed, 2 skipped, 0 failed**.
- Full Playwright suite on both projects: **410 passed, 96 skipped, 0 failed** (baseline 408/96/0 plus the new sons test on each project). This includes partie, partie-complete, tracer and every other spec that reads the audio debug state.
- One test title in animations.spec was reworded after the full run (comment and title only).

## Deviations from Plan

None in behaviour. Two choices made while executing:
- The Director also skips silenced cues, besides the engine gate. This keeps the debug `cues` log and the Director tests showing that nothing is asked for.
- I did not change the credits sheet. It still credits the neigh and card syntheses because the code stays in the repo.

## Known Stubs

None.

## Self-Check: PASSED

- Files exist: sounds.ts (ENABLED_SOUNDS), 03-08-PLAN.md, the e2e specs.
- Commits 0cd09e5, a7dc1f3, 75dacce and 4a8c72c are in the history of HEAD.
