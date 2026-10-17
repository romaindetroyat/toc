---
phase: 03-l-ordinateur-la-force-choisie
plan: 03
subsystem: web-launch
tags: [launch, layout, svelte, container-query, sticky, playwright, responsive]

requires:
  - phase: 03-l-ordinateur-la-force-choisie
    provides: "03-01: StrengthPicker (stacked), bots.ts catalogue (optionTitle), the « Force de l’ordinateur » section, force.spec.ts"
  - phase: 01-une-vraie-partie-sur-un-appareil
    provides: "screen.svelte.ts (chrome bar / compact / rotate), Segmented, ColorTile, SeatChip, app.css tokens"
provides:
  - "Segmented: optional --segmented-pad, per-option title, wrap (6-column, 2-2-2 / 3-3) and disabled (additive; SoundTest unchanged)"
  - "StrengthPicker: inline / stacked / narrow forms by container query, data-form, option titles « Force n sur 5 », disabled pass-through"
  - "Launch: data-layout computer | two | one | portrait, from screen.chrome and a 640 px width threshold; button row [Réglages] [Jouer la partie]; sticky band in one-column and portrait"
  - "ColorTile: compact size (88 high, cell-wide), partner tag visually hidden but still aria-describedby"
  - "force.spec.ts: one fit case per size of the UI-SPEC table (nine sizes), tab order, arrows, title, cream checked option, hostile levels at 750 × 342"
affects: [03-06 bench page (Segmented disabled, StrengthPicker forms), 03-07 recette (à confirmer 5 and 6), phase-2 online table picker]

actuals:
  tokens: 9014
  tasks: 2
  commits: 2
plan_head_before: b2d35e53a2ada57c21b8615d5e8ed3d99c8d2171
plan_head_after: d5b6f499c7164668d5cb0e7e588aa0deeb910c8d

tech-stack:
  added: []
  patterns:
    - "A component's container-query form is exposed to tests by a custom property (--strength-form) read on ResizeObserver, so data-form can never disagree with the CSS"
    - "Launch layout = screen.chrome + one width threshold, as data-layout on <main>; CSS keyed on [data-layout]"
    - "Sticky bottom band: the column wrappers become display: contents so the band's containing block is the whole page column"

key-files:
  created: []
  modified:
    - apps/web/src/ui/Segmented.svelte
    - apps/web/src/ui/StrengthPicker.svelte
    - apps/web/src/routes/Launch.svelte
    - apps/web/src/ui/ColorTile.svelte
    - apps/web/e2e/force.spec.ts
    - apps/web/e2e/launch.spec.ts

key-decisions:
  - "data-form comes from the container query itself (a --strength-form custom property read on resize), not from a second width computation"
  - "Compact tile padding is 5 px inside the 3 px border, i.e. 8 px from the outer edge, so 40 + 4 + 28 fits the 88 px tile exactly"
  - "Headings are start-aligned in the column layouts (computer, phone two columns, one column); portrait keeps the phase-1 centred column"
  - "The fit cases set the viewport on the page, so they run in both Playwright projects"

patterns-established:
  - "Launch fit checks: scrollHeight ≤ innerHeight and scrollWidth ≤ innerWidth per target size; « Jouer la partie » wholly in the viewport at scroll 0 and at the bottom where the page scrolls"

requirements-completed: [BOT-01]

coverage:
  - id: D1
    description: "Computer layout: two columns, three inline rows 48 high, button row, no scroll at 1280 × 800 and 1024 × 640"
    requirement: BOT-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e/force.spec.ts#force: sur l’ordinateur (1280 × 800 / 1024 × 640), deux colonnes sans défilement"
        status: pass
    human_judgment: false
  - id: D2
    description: "Phone held sideways: two columns without scroll at 844 × 390, 750 × 342 (inline), 667 × 375, 640 × 360 (stacked); 568 × 320 and 480 × 320 one scrolling column with the sticky button"
    requirement: BOT-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e/force.spec.ts#force: le téléphone en largeur / le petit téléphone"
        status: pass
    human_judgment: false
  - id: D3
    description: "Portrait 390 × 844: narrow rows wrapped on two lines, tiles ≥ 128, button always on screen"
    requirement: BOT-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e/force.spec.ts#force: tenu debout (390 × 844); apps/web/e2e/launch.spec.ts#lancement: Bleu préselectionné"
        status: pass
    human_judgment: false
  - id: D4
    description: "Tab order tiles → partner → left → right → Réglages → Jouer; arrows wrap; title « Force 5 sur 5 »; checked option cream / walnut 700"
    requirement: BOT-01
    verification:
      - kind: e2e
        ref: "apps/web/e2e/force.spec.ts#force: l’ordre de tabulation…; force: le titre « Force 5 sur 5 »…"
        status: pass
    human_judgment: false
  - id: D5
    description: "SoundTest Segmented unchanged"
    verification:
      - kind: e2e
        ref: "apps/web/e2e/sons.spec.ts (both projects)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Look on Romain's iPhone (two columns, 96 × 88 tiles without the tag, Réglages left of the button) — UI-SPEC « à confirmer » 5 and 6"
    verification: []
    human_judgment: true
    rationale: "Researcher choices listed for Romain in 03-07; real-device fit with Safari's insets is a backstop"

duration: 9min
completed: 2026-10-15
status: complete
---

# Phase 3 Plan 03: Le lancement sur tous les écrans — les trois lignes de force, deux colonnes, la bande du bouton Summary

**The launch screen now has four layouts keyed on screen.chrome and a 640 px threshold — two columns on the computer and on the phone held sideways (no scroll at any UI-SPEC size), a scrolling column with « Jouer la partie » in a sticky walnut band on the smallest phones and upright — with strength rows that switch inline / stacked / narrow by container query.**

## Performance

- **Duration:** about 9 min
- **Started:** 2026-10-15T11:06:52Z
- **Completed:** 2026-10-15T11:15Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `Segmented` gains `--segmented-pad`, an option `title`, `wrap` (one bordered 6-column block, 2-2-2 then 3-3) and `disabled` (the group at 40 %, buttons out of the tab order). With no new prop the sound-test picker is byte-for-byte the same markup and style.
- `StrengthPicker` is its own container (`container-type: inline-size`): inline from 488 (96-wide chip over role word, 8, picker, 48 high), stacked from 384 (72 high), narrow below (wrapped picker). `data-form` mirrors the container query through `--strength-form`. Options carry « Force n sur 5 » and 4 px padding.
- `Launch.svelte`: `data-layout` = computer (BAR_QUERY), two (compact ≥ 640), one (compact < 640), portrait. Header centred over 272 + ≤ 520 columns on the computer; TOC in the 200 px left column on the phone; one row of four 88-high tiles under 640; the phase-1 column upright. Button row `[Réglages] 16 [Jouer la partie]`, DOM order = visual order. Tagline and note hidden on the phone.
- `ColorTile` compact: 88 high, cell-wide (96 in the 2 × 2, a quarter of the column in one row), 40 px knight, 4 gap, 28 chip, check disc 24; the « Partenaire » tag is clipped out of sight but remains the tile's description; the dashed outline stays.

## Measured at the target sizes (Chromium, insets 0)

| Viewport | Layout | Row forms | Page height / viewport |
|----------|--------|-----------|------------------------|
| 1280 × 800 | computer | inline × 3 | 800 / 800 (no scroll) |
| 1024 × 640 | computer | inline × 3 | 640 / 640 |
| 844 × 390 | two | inline × 3 | 390 / 390 |
| 750 × 342 | two | inline × 3 | 342 / 342 |
| 667 × 375 | two | stacked × 3 | 375 / 375 |
| 640 × 360 | two | stacked × 3 | 360 / 360 |
| 568 × 320 | one | inline × 3 | 463 (scrolls, band sticky) |
| 480 × 320 | one | stacked × 3 | 535 (scrolls, band sticky) |
| 390 × 844 | portrait | narrow × 3 | 1107 (scrolls, band sticky) |

No size scrolls horizontally (scrollWidth = innerWidth everywhere).

Screenshots: `/tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/03-03-{1280x800,1024x640,844x390,750x342,667x375,640x360,568x320,480x320,390x844}.png`.

## Task Commits

1. **Task 1: Traceur — sur l'ordinateur, deux colonnes** - `9930ba5` (feat). Tracer gate: verify re-run end to end (force, launch, sons: 66 passed) before expanding.
2. **Task 2: Le téléphone tenu en largeur, le très petit téléphone et le portrait** - `d5b6f49` (feat)

## Verification (end gate)

- `pnpm typecheck` OK (svelte-check 292 files, 0 errors), `pnpm lint` OK, `pnpm test`: 43 files, **875 passed, 2 skipped** (baseline unchanged).
- `node tools/rules-trace.mjs`: OK (16 règles, 122 scénarios).
- Playwright `force.spec.ts launch.spec.ts sons.spec.ts tourne.spec.ts`, both projects: **94 passed, 4 skipped, 0 failed** (the 4 skips are tourne.spec's own per-project skips). force.spec.ts has 17 cases per project (5 before this plan).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Compact tile padding**
- **Found during:** Task 2
- **Issue:** 8 px padding plus the existing 3 px selection border cannot hold 40 + 4 + 28 inside 88 px (94 needed).
- **Fix:** 5 px padding inside the 3 px border, so the content sits 8 px from the outer edge and the tile is exactly 88.
- **Files modified:** apps/web/src/ui/ColorTile.svelte
- **Commit:** d5b6f49

**2. [Rule 3 - Blocking] Sticky band's containing block**
- **Found during:** Task 2
- **Issue:** a sticky element cannot leave its parent; inside the right column it would stop sticking once that column scrolled past.
- **Fix:** in the one-column and portrait layouts the `.columns` and `.right` wrappers are `display: contents` (plain divs, no semantics lost), so the band is a child of the page column. The band also carries the 1 px top rule, so it is 65 px high rather than 64.
- **Files modified:** apps/web/src/routes/Launch.svelte
- **Commit:** d5b6f49

### Other notes

- Between the two commits, non-computer screens used the phase-1 column with the new button row (Task 1 only built the computer layout); Task 2 replaced it.
- The fit, tab-order and title cases run in both Playwright projects (the viewport is set on the page) rather than only in the desktop project.
- launch.spec.ts's first case also checks, after turning the window upright, tiles ≥ 128 and the visible tag.
- `StrengthPicker` passes an optional `disabled` through to `Segmented` for the bench page of a later plan; unused on the launch screen.

## Known Stubs

None.

## Threat Flags

None: no new network, auth or storage surface. T-03-08 mitigated (rows read validated settings only; hostile case repeated at 750 × 342). T-03-SC: no package added.

## Self-Check: PASSED

- All six modified files exist; commits 9930ba5 and d5b6f49 are ancestors of HEAD.
