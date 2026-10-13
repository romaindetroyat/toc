---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 09
subsystem: audio-ui
tags: [svelte5, sound-test, localstorage, radiogroup, toast, clipboard, playwright, vitest]

requires:
  - phase: 01-04
    provides: "audio engine: unlock, now, cue with prefer, scheduleClops, startAmbience, setMix, loadRecordings, recordings, status/onStatus; SOUNDS catalogue"
  - phase: 01-06
    provides: "Icon, app.css tokens and button classes, settings store (ambienceVolume)"
provides:
  - "#/sons listening page: Sabots (1, 4, 7, 13 cases + 1-13 slider), Hennissements (6), Cartes (3), Ambiance (play/stop + volume), each row with a 44x44 play button, source tag and rating"
  - "soundNotes.ts: NOTES_KEY toc.soundnotes.v1, Rating, NoteKey, NOTE_KEYS, parseNotes, loadNotes, saveNotes, notesAsText"
  - "Segmented (radiogroup) component"
  - "Toast + showToast(message, action?) store: one toast, replaced not stacked, 4 s, mounted once in App.svelte"
  - "Engine additions: availability(id) and stopAmbience()"
  - "i18n/fr/sons.ts with all page copy in French typography"
affects: [01-11, 01-23, 01-24]

actuals:
  tokens: 30000
  tasks: 2
  commits: 4
plan_head_before: eb1c24186131afb426e7dbfa61c49b0c105ea87d
plan_head_after: 42758b6338af56e44109272a384e0e213d0b13f6

tech-stack:
  added: []
  patterns:
    - "Notes are parsed key by key against an allow-list from untrusted storage; every storage access in try/catch"
    - "First tap on the page unlocks the audio (window click) and a play request made by that tap is queued until the sounds are rendered"
    - "Toast live region stays in the DOM while empty so screen readers announce each new message"

key-files:
  created:
    - apps/web/src/routes/SoundTest.svelte
    - apps/web/src/ui/Segmented.svelte
    - apps/web/src/ui/Toast.svelte
    - apps/web/src/ui/toast.svelte.ts
    - apps/web/src/audio/soundNotes.ts
    - apps/web/src/audio/soundNotes.test.ts
    - apps/web/src/i18n/fr/sons.ts
    - apps/web/e2e/sons.spec.ts
  modified:
    - apps/web/src/App.svelte
    - apps/web/src/audio/engine.ts
    - apps/web/src/audio/engine.test.ts

key-decisions:
  - "The hoof sound is rated per listed distance (sabot-1, sabot-4, sabot-7, sabot-13), so the rating keys are the SoundIds with sabot split in four: a walk and a gallop are two listening decisions"
  - "The distance slider row has no rating of its own: it is a tool to explore the cadence curve, not one of the fixed rows"
  - "Mapping of neighs to rows: hennissement-joyeux is « Entrée dans la maison », hennissement-fete is « 4e cheval rentré (joyeux) » (D-14, D-23)"
  - "While the page is open the mix is forced to sound, bruitages and ambience on at the saved ambience volume; the real settings mix is restored when the page closes"

requirements-completed: [FX-05]

coverage:
  - id: D1
    description: "#/sons lists the four sections with a 44x44 play button, a source tag and a three-way rating on every rated row; hoof rows schedule hopTimeline(n).clops (4 for 4 cases, more than 13 at the gallop, 1 at the slider's 1 case)"
    requirement: FX-05
    verification:
      - kind: e2e
        ref: "apps/web/e2e/sons.spec.ts#sons: la page liste les quatre sections, chaque ligne a un bouton d’au moins 44 x 44"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/sons.spec.ts#sons: toucher la page débloque le son, 4 cases planifient 4 sabots"
        status: pass
    human_judgment: false
  - id: D2
    description: "Ratings persist in toc.soundnotes.v1 across reload; tampered or malformed storage gives defaults without error"
    verification:
      - kind: unit
        ref: "apps/web/src/audio/soundNotes.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/sons.spec.ts#sons: une note choisie est gardée après rechargement"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/sons.spec.ts#sons: un stockage abîmé ou piraté donne des notes par défaut, sans erreur"
        status: pass
    human_judgment: false
  - id: D3
    description: "« Copier mes notes » copies « nom : note » plain text and toasts « Notes copiées. »; on refusal the toast says « Impossible de copier. Sélectionne le texte ci-dessous. » and a read-only textarea shows the text"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/sons.spec.ts#copier mes notes (3 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Only one toast at a time, a new one replaces the current one, each disappears after 4 s"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/sons.spec.ts#sons: un seul message à la fois, le nouveau remplace l’ancien, il disparaît après 4 s"
        status: pass
    human_judgment: false
  - id: D5
    description: "Decoding state (play disabled) and « Son indisponible » with « Fichier » / « Généré » A/B buttons"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/sons.spec.ts (all rows « Généré par le code », none « Son indisponible » once ready)"
        status: pass
    human_judgment: true
    rationale: "No recorded file exists yet (every SOUNDS[*].files is empty), so the A/B and failed-decode branches cannot be reached in a real build; they are implemented from the engine's availability() and recordings() and need a first recording to be exercised"
  - id: D6
    description: "Romain validates every sound by ear on a phone and a computer and records a rating for each (D-22); neighs recognisable as horses, hooves walk at 1 case and gallop at 13, ambience discreet and gapless, iPhone ringer switch both ways"
    requirement: FX-05
    verification: []
    human_judgment: true
    rationale: "Whether a synthesized sound is a horse is Romain's listening decision; iOS audio cannot be automated here"

duration: 8min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 09: La page « Test des sons » pour Romain Summary

**`#/sons` lists every Phase 1 sound (hooves by distance with a 1-13 cadence slider, six neighs, three card sounds, the ambience loop), each with a play button, a source tag and a three-way rating saved in `toc.soundnotes.v1`, plus « Copier mes notes » as plain French text and a shared one-at-a-time Toast.**

## Performance

- **Duration:** about 8 min
- **Started:** 2026-10-13T15:59:37Z
- **Completed:** 2026-10-13T16:07Z
- **Tasks:** 2 (Task 1 as TDD: RED commit then GREEN)
- **Files:** 8 created, 3 modified

## Accomplishments

- The page unlocks the audio on the first tap anywhere; a play request made by that very tap is queued and runs once the sounds are rendered, so Romain never has to tap twice. The state line reads « Son prêt » or « Son en attente : touche l’écran » (and a retry line when the context failed).
- Rows have the decoding (play disabled), unavailable and playing states; rows that declare recordings show « Fichier » / « Généré » A/B buttons. Today every sound is generated, so all 14 rated rows read « Généré par le code ».
- `soundNotes.ts` keeps only known keys with known ratings, tolerates malformed JSON and a throwing storage, and exports `notesAsText` (one « nom : note » line per row with U+00A0 before the colon, never-rated rows read « À écouter »).
- `Segmented` is a roving-tabindex radiogroup (arrows move and select, 44 px options); `Toast` keeps its live region mounted while empty and replaces rather than stacks.
- Screenshots of the page on an iPhone 13 viewport were reviewed by the executor (layout, spacing, 44 px targets look right).

## Task Commits

1. **Task 1 RED:** `dd40faa` test(01-09): sound notes parsing, storage failure and plain-text export
2. **Task 1 GREEN:** `1c66e3d` feat(01-09): listen to every sound and rate it on #/sons
3. **Task 1 formatting:** `e0df25c` style(01-09): format sound notes test, no-break space as an escape
4. **Task 2:** `42758b6` feat(01-09): copy my notes as plain text, one toast at a time

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Rating key per hoof distance instead of one `sabot` key**
- **Found during:** Task 1
- **Issue:** The plan keeps "only known SoundId keys" but also asks for a rating on each of the four hoof rows; all four rows share the SoundId `sabot`, so they could not be rated independently, and a walk and a gallop are separate listening verdicts.
- **Fix:** `NoteKey` = SoundId with `sabot` replaced by `sabot-1`, `sabot-4`, `sabot-7`, `sabot-13` (14 keys, page order). The bare key `sabot` is rejected by `parseNotes`. The distance-slider row has no rating.
- **Files modified:** `apps/web/src/audio/soundNotes.ts`, tests, `sons.ts`
- **Commit:** `1c66e3d`

**2. [Rule 2 - Missing Critical] `availability(id)` and `stopAmbience()` added to the engine**
- **Found during:** Task 1
- **Issue:** The engine did not say whether a sound has a synthesized or recorded buffer (needed for « Son indisponible » and the A/B buttons), and `pauseAmbience()` leaves the ambience « wanted », so after « stop » a tab switch (`visibilitychange` resume) would restart it.
- **Fix:** `availability()` and `stopAmbience()` on the engine and the shell, with unit tests (engine tests 31 to 35).
- **Files modified:** `apps/web/src/audio/engine.ts`, `engine.test.ts` (not in the plan's `files_modified`)
- **Commit:** `1c66e3d`

**3. [Rule 2 - Missing Critical] « Retour » link and a failed-audio state line**
- **Found during:** Task 1
- **Issue:** A full-screen hash route with no way back, and no message when the audio context fails to start.
- **Fix:** a « Retour » link to `#/` and the line « Le son n’a pas pu démarrer. Touche l’écran pour réessayer. » (the shell already retries the resume on any tap).
- **Commit:** `1c66e3d`

**4. [Rule 3 - Blocking] Formatting commit for the RED test file**
- Biome reformatted `soundNotes.test.ts` after the RED commit; committed separately as `e0df25c`.

**Total deviations:** 3 auto-fixed (all missing critical), 1 housekeeping commit. **Impact:** a small extension of the engine API (backwards compatible) and a note-key scheme that refines the plan's wording; no must-have truth changed.

## Issues Encountered

- `ss` is not installed in the container, so the "port 4173 free" check printed a misleading message; a manually started `vite preview` for screenshots was killed by PID afterwards.

## Known Stubs

None. The A/B (« Fichier » / « Généré ») and failed-recording branches are implemented but dormant until a recording is added to `SOUNDS[*].files` (see coverage D5).

## Threat Flags

None. T-01-SC mitigated (no package added). T-01-06 mitigated (key allow-list, `Object.hasOwn`, try/catch, 11 unit tests plus a tampered-storage e2e). T-01-07 mitigated (clipboard gets plain text via `writeText` only; the fallback textarea uses a `value` binding; `no-raw-html.test.ts` passes).

## Verification Results

- `pnpm exec vitest run apps/web/src`: 6 files, 81 tests passed (audio + i18n subset: 53 passed).
- `pnpm typecheck` (tsc x2 + svelte-check, 187 files): 0 errors, 0 warnings; `pnpm lint` (Biome): clean.
- `pnpm --filter @toc/web exec playwright test e2e/sons.spec.ts e2e/tracer.spec.ts`: 26 passed (desktop and phone); full Playwright suite: 71 passed, 11 skipped (pre-existing mobile skips).
- Acceptance: `#/sons` in App.svelte, `Copier mes notes` in sons.ts, `export function showToast` in toast.svelte.ts all found.

## Next Phase Readiness

- Romain's listening session (D-22) can start now: open `#/sons` on a phone and a computer, tap, play and rate every row, « Copier mes notes », paste into the UAT. If neighs do not sound like horses, only the `NEIGHS` table in `synth.ts` needs tuning (plan 01-04).
- Plan 01-11 adds the licence lines and the « Crédits et licences » sheet to this page; plan 01-23 should add the « Tester les sons » link in Réglages and apply `setMix` from the settings store (this page restores the settings mix on close).
- Real iPhone behaviour (ringer switch both ways, background resume) stays in plan 01-24.

## Self-Check: PASSED

- Files exist: SoundTest.svelte, Segmented.svelte, Toast.svelte, toast.svelte.ts, soundNotes.ts, soundNotes.test.ts, sons.ts, sons.spec.ts.
- Commits `dd40faa`, `1c66e3d`, `e0df25c`, `42758b6` are ancestors of HEAD; `commits: 4` measured from the on-disk ledger.
