---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 06
subsystem: ui
tags: [svelte5, settings, localstorage, radiogroup, fonts, lucide, design-tokens, playwright]

requires:
  - phase: 01-01
    provides: "Launch.svelte with the audio unlock, app.css base, approved font and icon packages"
  - phase: 01-02
    provides: "typography and raw-HTML guard tests over apps/web/src"
provides:
  - "settings.ts: Settings, DEFAULT_SETTINGS, STORAGE_KEY, parseSettings, loadSettings, saveSettings (validated, silent on storage failure)"
  - "store.svelte.ts: reactive settings and updateSettings (re-validated, persisted)"
  - "Launch screen: 2x2 colour radiogroup, partner tag, RULE-01 team summary, lastColor remembered"
  - "ColorTile, SeatChip, Icon components; icons.ts with 12 Lucide icons as data"
  - "Self-hosted Nunito and Caveat woff2 (latin, latin-ext) with OFL texts"
  - "app.css design tokens (colours, spacing, type roles, radii, buttons, focus ring, touch targets, disabled, tabular-nums)"
  - "tools/copy-vendor-assets.mjs (fonts copy and icons.ts generation)"
affects: [01-08, 01-09, 01-16, later UI plans]

actuals:
  tokens: 15000
  tasks: 2
  commits: 3
plan_head_before: 51776e546af88f4a0965212994ed5ea5f9cafe44
plan_head_after: ff161573c0f080cf22635edc2de20fd39bc08cf2

tech-stack:
  added: []
  patterns:
    - "Settings are parsed field by field from untrusted storage; every storage access in try/catch"
    - "Icons are data (element list) rendered with svelte:element, never markup"
    - "Seat identity = glyph shape + name + colour (SVG glyphs, not font glyphs)"
    - "Generated assets (fonts, icons.ts) come from tools/copy-vendor-assets.mjs and are committed"

key-files:
  created:
    - apps/web/src/settings/settings.ts
    - apps/web/src/settings/settings.test.ts
    - apps/web/src/settings/store.svelte.ts
    - apps/web/src/i18n/fr/seats.ts
    - apps/web/src/ui/SeatChip.svelte
    - apps/web/src/ui/ColorTile.svelte
    - apps/web/src/ui/Icon.svelte
    - apps/web/src/ui/icons.ts
    - apps/web/src/assets/fonts/ (nunito-latin.woff2, nunito-latin-ext.woff2, caveat-latin.woff2, caveat-latin-ext.woff2, OFL-Nunito.txt, OFL-Caveat.txt)
    - tools/copy-vendor-assets.mjs
    - apps/web/e2e/launch.spec.ts
  modified:
    - apps/web/src/routes/Launch.svelte
    - apps/web/src/i18n/fr/launch.ts
    - apps/web/src/app.css

key-decisions:
  - "Title « TOC » uses the UI-SPEC Display role (Caveat 28 px) instead of the 64 px of the skeleton, because the spec allows exactly four type sizes"
  - "Seat glyphs are drawn as 16 px SVG shapes (circle, triangle, square, star); the characters stay in seats.ts as data because Nunito has no glyph for them"
  - "Arrow keys on the 2x2 grid: left/right walk reading order, up/down jump a row, with wrap-around; each move selects and focuses"
  - "updateSettings re-parses the merged object, so no caller can store an out-of-range volume or unknown colour"
  - "Fontsource file names map as <stem>-<subset>-wght-normal.woff2 -> <stem>-<subset>.woff2 (flagged assumption A-06 confirmed, only the upright variable files are used)"

requirements-completed: [RULE-01]

coverage:
  - id: D1
    description: "On #/ the player picks Bleu, Jaune, Rouge or Vert in a 2x2 radiogroup (tiles at least 128x128, arrows move the selection); the partner tile is tagged « Partenaire » and the summary reads the RULE-01 pairs"
    requirement: RULE-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e/launch.spec.ts#lancement: Bleu préselectionné, partenaire et adversaires affichés"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/launch.spec.ts#lancement: le choix est retenu, les flèches déplacent la sélection"
        status: pass
    human_judgment: true
    rationale: "Automation proves roles, sizes, pairs and keyboard; whether the oak tiles look right is a visual judgment (screenshots reviewed by the executor, phone and desktop)"
  - id: D2
    description: "lastColor is saved in toc.settings.v1 and preselected next visit; Bleu with no stored value"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/launch.spec.ts#lancement: le choix est retenu, les flèches déplacent la sélection"
        status: pass
    human_judgment: false
  - id: D3
    description: "Missing storage, malformed JSON or out-of-range values fall back to defaults silently"
    verification:
      - kind: unit
        ref: "apps/web/src/settings/settings.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e/launch.spec.ts#lancement: JSON abîmé, valeurs hors limites ou stockage qui lève, aucune erreur visible"
        status: pass
    human_judgment: false
  - id: D4
    description: "Fonts and icons are served from the bundle; the launch screen requests nothing from a third-party host"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/launch.spec.ts#lancement: aucune requête vers un hôte tiers"
        status: pass
    human_judgment: false
  - id: D5
    description: "« Jouer la partie » still unlocks audio synchronously inside the tap and opens #/partie"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/tracer.spec.ts and apps/web/e2e/launch.spec.ts#« Jouer la partie » ouvre la partie avec le son débloqué"
        status: pass
    human_judgment: false

duration: 7min
completed: 2026-10-13
status: complete
---

# Phase 1 Plan 06: Choisir sa couleur — écran de lancement, réglages mémorisés, polices et icônes Summary

**Launch screen with a keyboard-navigable 2x2 colour radiogroup remembered in a tamper-proof `toc.settings.v1`, RULE-01 team summary as seat chips, plus self-hosted Nunito/Caveat fonts, 12 Lucide icons as data and the full UI-SPEC token set.**

## Performance

- **Duration:** about 7 min
- **Completed:** 2026-10-13T15:45:10Z
- **Tasks:** 2 (Task 1 as TDD: RED then GREEN commit)
- **Files:** 11 created, 3 modified (plus 6 generated font and licence files)

## Accomplishments

- `settings.ts` validates each stored field on its own (volume rounded and clamped, colour allow-listed with `Object.hasOwn`, reduce-motion defaults to the system preference then the explicit value wins); 15 unit tests cover malformed JSON, null storage, throwing `getItem` and `setItem`, hostile keys.
- Launch screen: oak tiles (CSS grain, A-07 confirmed), roving tabindex, arrows, check icon on the selected tile, dashed outline and « Partenaire » tag on the partner, team and adversary pairs for any chosen colour.
- Fonts and icons ship in the bundle (Playwright asserts every request goes to the app origin); icons.ts keeps the full lucide-static licence text (ISC plus the MIT notice that applies to the Feather-derived `check`, `chevron-down`, `x`).
- app.css carries every UI-SPEC token as a custom property, the four type roles, button classes (`btn-primary`, `btn-secondary`, `btn-destructive`, `btn-text`), 44 px touch targets, 40 % disabled, `tabular` and `sr-only` utilities.

## Task Commits

1. **Task 1 RED:** `0449cbb` test(01-06): settings parsing, clamping and storage failure cases
2. **Task 1 GREEN:** `b849767` feat(01-06): choose a colour on the launch screen, remembered on this device
3. **Task 2:** `ff16157` feat(01-06): self-hosted Nunito, Caveat and Lucide icons with the UI-SPEC design tokens

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Re-validation inside updateSettings**
- **Found during:** Task 1 (store)
- **Issue:** The plan's `updateSettings(patch)` applied the patch as is, so a caller could persist an out-of-range volume or unknown colour that `parseSettings` would reject on the next load.
- **Fix:** the merged object goes through `parseSettings` before being applied and saved.
- **Files modified:** `apps/web/src/settings/store.svelte.ts`
- **Commit:** `b849767`

**2. [Rule 3 - Blocking] Arrow-key handler moved from the radiogroup to the tiles**
- **Found during:** Task 1 (svelte-check)
- **Issue:** `a11y_interactive_supports_focus` warning: a `role="radiogroup"` carrying `onkeydown` must be focusable.
- **Fix:** `ColorTile` takes an `onkeydown` prop; the focusable radios handle the arrows (events still reach the same handler).
- **Files modified:** `ColorTile.svelte`, `Launch.svelte`
- **Commit:** `b849767`

**3. [Rule 2 - Missing Critical] End-to-end spec for the launch screen**
- **Found during:** Task 1
- **Issue:** The plan's verify only re-runs the tracer spec, which proves nothing about the radiogroup, persistence, tampered storage or third-party requests listed in the must-haves.
- **Fix:** added `apps/web/e2e/launch.spec.ts` (5 tests on phone and desktop).
- **Commit:** `b849767`

**4. [Rule 1 - Spec conformance] « TOC » title at Display size**
- **Found during:** Task 2
- **Issue:** The skeleton set the title at 64 px, outside the four allowed type sizes.
- **Fix:** the title uses the Display role (Caveat 28 px) as in the UI-SPEC typography table. Easy to enlarge if Romain finds it small.
- **Commit:** `ff16157`

**5. [Plan scope note] « Réglages » secondary button not added**
- UI-SPEC lists it on the launch screen, but the settings sheet it opens belongs to a later plan, and this plan lists no such component. A dead button would break the "no inert control" rule, so it is left for the plan that builds the sheet.

**Total deviations:** 3 auto-fixed (2 missing critical, 1 blocking), 1 spec conformance fix, 1 scope note.
**Impact:** none on the must-haves.

## Issues Encountered

- A stale `vite preview` started for screenshots had to be killed by PID (three nested processes) before the Playwright run; no repo impact.
- Playwright reports 8 skipped tests: pre-existing `test.skip(isMobile)` in `board.spec.ts`.

## User Setup Required

None.

## Known Stubs

- `ColorTile.svelte` draws the knight slot as a disc in the pawn body colour. This is intentional per the plan; plan 01-08 puts the KnightDefs knight symbol in the same 64 px slot.

## Threat Flags

None. T-01-SC mitigated (no new package, assets copied from the approved ones with licence texts), T-01-01 mitigated (field validation, try/catch, unit and e2e tests), T-01-05 mitigated (self-hosted fonts, inline icon data, no CDN URL; request-origin test).

## Verification Results

- `pnpm exec vitest run apps/web/src/settings apps/web/src/i18n`: 22 passed; full `pnpm exec vitest run`: 82 passed.
- `pnpm typecheck` and `pnpm --filter @toc/web exec svelte-check --tsconfig ./tsconfig.json`: 0 errors, 0 warnings; `pnpm lint`: clean.
- `pnpm --filter @toc/web exec playwright test e2e/tracer.spec.ts e2e/board.spec.ts e2e/launch.spec.ts`: 20 passed, 8 skipped (pre-existing mobile skips).
- Acceptance: radiogroup grep, font files, `fast-forward` and `ISC` in icons.ts all pass.

## Next Phase Readiness

Plan 01-08 can read `settings.lastColor` to turn the board and fill the ColorTile slot with the knight symbol; `Icon`, `SeatChip`, button classes and tokens are ready for the info bar, sheets and settings.

## Self-Check: PASSED

- All created files exist on disk; commits `0449cbb`, `b849767`, `ff16157` are ancestors of HEAD; `commits: 3` measured from the on-disk ledger.
