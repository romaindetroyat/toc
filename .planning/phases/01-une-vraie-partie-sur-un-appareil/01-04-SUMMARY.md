---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 04
subsystem: audio
tags: [web-audio, synthesis, offlineaudiocontext, voice-pool, jitter, vitest, playwright]

requires:
  - phase: 01-01
    provides: "audio/engine.ts and audio/synth.ts tracer (unlock, now, scheduleClops, renderHoof), hopTimeline and MIN_CLOP_GAP_MS, DEBUG flag, tracer e2e spec"
provides:
  - "AudioBackend seam with WebAudioBackend and a recording FakeBackend (backend.ts)"
  - "SOUNDS catalogue and SoundId union: eleven Phase 1 sounds, sfx and ambience buses (sounds.ts)"
  - "createAudioEngine(): cue with jitter, MAX_VOICES = 16 pool, clops on the audio clock, three buses, recording loader with synthesis fallback, status/onStatus, ambience start/pause/resume"
  - "Module-level web shell: unlock, now, scheduleClops, cue, setMix, startAmbience, pauseAmbience, resumeAmbience, loadRecordings, recordings, status, onStatus"
  - "Synthesized sounds: renderNeigh (6 kinds), renderCard (3 kinds), renderAmbience (loopable 8 s bed), normalize and makeLoopable helpers"
affects: [01-09, 01-11, 01-19, 01-23, 01-24]

actuals:
  tokens: 15800
  tasks: 2
  commits: 2
plan_head_before: 5cb883bc6bf7630c5ce3327a9862b9bc975c14a5
plan_head_after: d670e14f5dcbca86be309c17e5839ba6e84ba539

tech-stack:
  added: []
  patterns:
    - "Engine logic is a factory over an AudioBackend; the browser shell is a thin module around one instance, so timing rules are tested in Node on a FakeBackend"
    - "Voice pool counts only voices whose start time has passed, so a 13-cell move can queue 26 future clops without stealing any"
    - "Seamless synthesized loops: render loop + 1 s, fold the tail back with an equal-power crossfade (makeLoopable)"
    - "Debug builds report rendered sounds in window.__tocDebug.audio.sounds for e2e checks"

key-files:
  created:
    - apps/web/src/audio/backend.ts
    - apps/web/src/audio/sounds.ts
    - apps/web/src/audio/engine.test.ts
    - apps/web/e2e/audio.spec.ts
  modified:
    - apps/web/src/audio/engine.ts
    - apps/web/src/audio/synth.ts
    - apps/web/src/debug.ts
    - vitest.config.ts

key-decisions:
  - "Cues are dropped while the context is not running, instead of being queued and bursting out on resume (iOS interruption)"
  - "Voice stealing only considers voices that have started; a hard cap of 64 queued voices bounds the future queue (T-01-08)"
  - "Ambience is two looped sources half a loop apart at -3 dB each plus a seamless synthesized buffer; a recorded loop with an encoder gap would be covered by the other source"
  - "A sound with no recorded file reports recordingUnavailable: true and source: 'synth'; cue() accepts prefer: 'file' | 'synth' so plan 01-09 can offer the A/B"
  - "unlock() still returns the AudioContext but now undefined when the browser cannot create one; the game stays playable"

patterns-established:
  - "Plans that add sounds extend the SOUNDS catalogue and the renderSynth switch (exhaustive over SynthRecipe), nothing else"
  - "No setTimeout or setInterval anywhere in apps/web/src/audio: every start time is on the AudioContext clock"

requirements-completed: [FX-04, FX-05]

coverage:
  - id: D1
    description: "Clops are scheduled on the audio clock from hopTimeline().clops with a 50 ms minimum gap (4 clops at t0 + 0.19975, 0.3995, 0.59925, 0.799; 13 cells in fast mode)"
    requirement: FX-04
    verification:
      - kind: unit
        ref: "apps/web/src/audio/engine.test.ts#clops on the audio clock"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/tracer.spec.ts (desktop and phone)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Jitter within +-4 % rate and +-1.5 dB, voice pool capped at 16 with oldest stolen first, three independent buses, recording fallback to synthesis, status and resume retry"
    requirement: FX-05
    verification:
      - kind: unit
        ref: "apps/web/src/audio/engine.test.ts#jitter, voice pool, mix, recordings, status and resume, ambience"
        status: pass
    human_judgment: false
  - id: D3
    description: "All eleven catalogue sounds (13 buffers) render in Chromium to non-silent buffers of the expected duration; the ambience loop has no seam"
    requirement: FX-05
    verification:
      - kind: e2e
        ref: "apps/web/e2e/audio.spec.ts#tous les sons synthétisés sont rendus, audibles et de la bonne durée"
        status: pass
      - kind: unit
        ref: "apps/web/src/audio/engine.test.ts#synthesis helpers"
        status: pass
    human_judgment: false
  - id: D4
    description: "The synthesized neighs, card sounds and ambience sound right (horse-like, pleasant, not annoying)"
    requirement: FX-05
    verification: []
    human_judgment: true
    rationale: "Only a listener can judge the sound; Romain decides on the sound test page of plan 01-09, and real iPhone behaviour is checked in plan 01-24"

duration: 7min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 04: Le moteur audio Summary

**Web Audio engine over a testable backend seam: jittered hoof clops on the audio clock with a 16-voice pool and 50 ms gap, three independent mix buses, recording-or-synthesis loader, and all eleven Phase 1 sounds synthesized by code (six neighs, three card sounds, a seamless 8 s ambience).**

## Performance

- **Duration:** about 7 min
- **Started:** 2026-10-13T15:16:57Z
- **Completed:** 2026-10-13T15:23Z
- **Tasks:** 2
- **Files modified:** 8 (4 created, 4 modified)

## Accomplishments

- `createAudioEngine({ backend, render, random, catalogue })` holds all rules: `cue` (rate x (1 +- 0.04), gain +- 1.5 dB from an injectable random source), `scheduleClops` (re-applies `MIN_CLOP_GAP_MS`, round-robin over three hoof variants), `setMix` (master 0/1, sfx 0/1, ambience 0 or volume/100, default 30), `loadRecordings` (tries `.m4a` then `.mp3` under try/catch, falls back to synthesis and flags `recordingUnavailable`), `status`/`onStatus` (failed on context creation failure or rejected resume, recovers on a later tap), and the ambience.
- `FakeBackend` records every `play`, `stop` and bus gain call and lets a test drive the clock and the context state; 31 audio tests run in plain Node.
- `synth.ts` renders every catalogue entry once at unlock: six neighs from the Appendix D recipe (sawtooth, contour, 22 Hz vibrato, three swept formants, breath noise), riffle / card down / slide from filtered noise, and an 8 s ambience (480 Hz low-passed wind swelling at 0.125 Hz under a faint rustle at 0.25 Hz) folded back with an equal-power crossfade so it loops with no seam.
- The tracer is unchanged: `scheduleClops` and `now` keep their signatures and the debug hook, `data-audio` still reads `running`, and the tracer spec passes on desktop and phone.

## Task Commits

1. **Task 1: Bus, voix, gigue et sabots sur l'horloge audio** - `3b25eeb` (feat)
2. **Task 2: Hennissements, sons de cartes et ambiance en boucle** - `d670e14` (feat)

**Plan metadata:** committed right after this file (docs: complete plan)

## Files Created/Modified

- `apps/web/src/audio/backend.ts` - AudioBackend interface, WebAudioBackend (master -> sfx / ambience buses), FakeBackend
- `apps/web/src/audio/sounds.ts` - SoundId, SynthRecipe, SOUNDS catalogue, SOUND_IDS
- `apps/web/src/audio/engine.ts` - createAudioEngine plus the web shell (unlock, pointerdown resume retry, visibilitychange ambience pause)
- `apps/web/src/audio/synth.ts` - renderHoof (unchanged), renderNeigh, renderCard, renderAmbience, normalize, makeLoopable
- `apps/web/src/audio/engine.test.ts` - 31 tests on the fake backend and the pure helpers
- `apps/web/e2e/audio.spec.ts` - all 13 synthesized buffers are rendered, audible and of the expected duration
- `apps/web/src/debug.ts` - optional `audio.sounds` report type
- `vitest.config.ts` - defines `__TOC_DEBUG__` for Node tests

## Decisions Made

- Cues are skipped while the backend is not `running`: queuing on a suspended or interrupted context would burst out stale sounds on resume.
- The pool stops the oldest voice among those already playing (`at <= now`); future clops are exempt, because one 13-cell move queues about 26 of them. A hard cap of 64 queued voices keeps the queue bounded (T-01-08).
- Ambience uses two looped sources half a loop apart at -3 dB with a 1.5 s fade-in. The plan says "crossfaded every cycle"; looped sources cannot be re-faded each cycle without a timer, so the seam is removed in the synthesized buffer itself and the second source covers any gap in a future recorded loop.
- Ambience pauses (0.4 s fade-out) when the page is hidden and restarts when visible, per the UI-SPEC.
- All normalised peaks: neighs 0.7, cards 0.5, ambience 0.35 (hoof keeps its tracer level, about 0.86).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `__TOC_DEBUG__` undefined under Vitest**
- **Found during:** Task 1 (engine.ts imports `DEBUG` for the scheduleClops debug hook)
- **Issue:** `debug.ts` evaluates `__TOC_DEBUG__` at import; Vitest runs in Node without the Vite `define`, so the engine tests could not load the module.
- **Fix:** `define: { __TOC_DEBUG__: false }` in the root `vitest.config.ts`.
- **Files modified:** `vitest.config.ts` (not in the plan's `files_modified`)
- **Committed in:** `3b25eeb`

**2. [Rule 2 - Missing Critical] Extra backend and engine surface needed by the specified behaviour**
- **Found during:** Task 1
- **Issue:** The plan's `AudioBackend` has no `resume`, `decode`, `onStateChange` or `sampleRate`, no fade or start offset on `play`, no fade on `stop`; without them the specified failed-status, recording decode, ambience fade-in and half-loop offset cannot be built behind the seam.
- **Fix:** added those members to the interface, `WebAudioBackend` and `FakeBackend`; engine also gained `retryResume`, `whenReady`, `recordings()` and `cue(..., { prefer })`.
- **Files modified:** `apps/web/src/audio/backend.ts`, `apps/web/src/audio/engine.ts`
- **Committed in:** `3b25eeb`

**3. [Rule 2 - Missing Critical] Debug report and browser spec for the synthesized sounds**
- **Found during:** Task 2
- **Issue:** the plan's verify only re-runs the tracer spec, which proves nothing about the new recipes rendering in a real browser (OfflineAudioContext is not available in Node).
- **Fix:** debug builds record each rendered buffer's duration and peak in `window.__tocDebug.audio.sounds`; `e2e/audio.spec.ts` asserts 13 non-silent buffers of the expected durations.
- **Files modified:** `apps/web/src/debug.ts`, `apps/web/src/audio/engine.ts`, `apps/web/e2e/audio.spec.ts` (new)
- **Committed in:** `d670e14`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing critical). **Impact:** four small additions outside or beyond the plan's file list; no must-have truth changed.

## Issues Encountered

- `AudioBuffer` typing: copying a looped `Float32Array` with `copyToChannel` fails TypeScript 6 (`Float32Array<ArrayBufferLike>`); `getChannelData(0).set(...)` on a `new AudioBuffer(...)` avoids it.

## Known Stubs

None. `SOUNDS[*].files` is empty on purpose (A-08): recordings are optional upgrades, and synthesis is the shipped baseline.

## Threat Flags

None. T-01-SC mitigated (no package added; `package.json` and `pnpm-lock.yaml` untouched). T-01-08 mitigated: `MAX_VOICES` stealing, a 64-voice queue cap, `MIN_CLOP_GAP_MS`, and no awaited audio in the game loop (every cue is fire-and-forget).

## Verification Results

- `pnpm exec vitest run apps/web/src/audio`: 31 tests passed (full suite: 7 files, 66 tests passed).
- `pnpm typecheck` (tsc x2 + svelte-check, 165 files, 0 errors) and `pnpm lint` (Biome, 46 files): exit 0.
- `pnpm --filter @toc/web exec playwright test e2e/audio.spec.ts e2e/tracer.spec.ts`: 4 passed (desktop and phone); tracer still sees clops at `[199.75, 399.5, 599.25, 799]`.
- Production build: `window.__tocDebug` is absent from `apps/web/dist`.
- Rendered peaks in Chromium: neighs 0.70, cards 0.50, ambience 0.35, hoofs about 0.86; durations 0.12 s (hoof), 0.3 / 1.15 / 0.8 / 1.05 / 0.4 / 1.75 s (neighs), 0.62 / 0.18 / 0.36 s (cards), 8 s (ambience).

## Next Phase Readiness

- Plan 01-09 builds the sound test page on `SOUNDS`, `cue(id, at, { prefer })` and `recordings()`; plan 01-19 wires `cue` to engine events; plan 01-23 calls `setMix` and `startAmbience` from the settings store (both are safe before unlock).
- Whether the neighs sound like horses is a listening decision for Romain (plan 01-09). If they do not, only the `NEIGHS` table in `synth.ts` needs tuning. The formant, breath and noise balance was not auditioned here.
- Real iPhone behaviour (unlock inside the tap, ringer switch, background resume) stays in plan 01-24 (A-10).

## Self-Check: PASSED

- Files exist: backend.ts, sounds.ts, engine.ts, synth.ts, engine.test.ts, e2e/audio.spec.ts, debug.ts, vitest.config.ts.
- Commits `3b25eeb` and `d670e14` are ancestors of HEAD; `commits: 2`, `plan_head_before` and `plan_head_after` measured from the on-disk ledger.

---
*Phase: 01-une-vraie-partie-sur-un-appareil*
*Completed: 2026-10-13*
