---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 31
subsystem: board
status: complete
tags: [board, plateau-c-plus, overlay, hit-targets, debug, e2e, gap-closure]
requires:
  - "01-29 (packages/board: SCENE, KNIGHT, knightScale, stableCentre, seatCard)"
  - "01-30 (anchorOf = sceneXY, Pawn at the C+ sizes, 2:3 board, --head-room)"
provides:
  - "Overlay.svelte: every knight-relative offset and size = KNIGHT x knightScale(place of the marked knight; the destination for a ghost)"
  - "HitLayer.svelte: one target per lit knight on its C+ body, radius max(22 px, KNIGHT.w/2 x size), near max(44 px, radius), catch-all over SCENE"
  - "DebugGeometry.svelte on the C+ scene (ring indices, slots, exits, carrés, felt, seat cards, talon, défausse)"
  - "Particles.svelte burst from the chest of a home knight; DealBanner.svelte over the 2:3 board"
  - "e2e: halo, hit-target and ghost alignment checks (tracer.spec), debug-geometry alignment (board.spec)"
affects: ["01-32", "01-33", "01-34", "01-35", "01-36"]
tech-stack:
  added: []
  patterns:
    - "Overlay markers sized in sprite units x knightScale(place); screen-px sizes (x px) and path strokes never scaled"
    - "One ghostKnight snippet draws every ghost like Pawn (sprite scaled at its feet, ring at the feet)"
key-files:
  created: []
  modified:
    - apps/web/src/board/Overlay.svelte
    - apps/web/src/board/HitLayer.svelte
    - apps/web/src/board/DebugGeometry.svelte
    - apps/web/src/board/Particles.svelte
    - apps/web/src/ui/DealBanner.svelte
    - apps/web/e2e/tracer.spec.ts
    - apps/web/e2e/board.spec.ts
decisions:
  - "Hit radius and near distance are per target (each knight at its own zone size), so a stable knight and a ring knight lit by the same As keep their own radii"
  - "A ghost's ring at its feet scales its radii (70 x 26 sprite units x size) but keeps its stroke widths (8 and 4 scene units), as the path strokes do"
  - "Capture marks sit at (KNIGHT.head + 10) x size and letters at (KNIGHT.head + 22) x size above the anchor: the former +10 and +22 offsets above the 186-unit sprite, scaled with the knight"
metrics:
  duration: "15 min"
  completed: 2026-10-14
  tasks: 2
  files: 7
estimate:
  tokens: 60000
  tasks: 2
actuals:
  tokens: 7100
  tasks: 2
  commits: 2
plan_head_before: d8c98791a76cedcba144727d135ce57ae2f12971
plan_head_after: 813a0a2
---

# Phase 1 Plan 31: Halos, aperçus, lettres, marqueurs et cibles sur les cavaliers de C+ Summary

Every marker of a turn now sits on the C+ knight it belongs to, at that knight's size. This covers the halo, the selected disc, the ghost and its badge, the capture marks, the tray and key-hint letters, the swap arrows and ghosts, and the 7's ghosts. The hit targets are centred on the knights' bodies. The seat glow sits on the turn seat's stable, the party burst starts from the chest of the home knight, and the deal banner is centred on the 2:3 board. `?debug=geometry` draws the C+ scene.

## What was built

- **Overlay.svelte**. It adds `sizeOf(pawn) = knightScale(place)` and `bodyAt(pawn) = anchor − KNIGHT.body × size`. The marks are placed as follows:
  - **Halo and selected disc:** centred at `bodyAt`, with radii `(KNIGHT.w / 2 + 14) × size` (−4 and +2 / +1 as before). The strokes are unchanged.
  - **Ghosts:** the main ghost, the Valet's and the 7's all use one `ghostKnight(color, size)` snippet. A `data-ghost-feet` group sits `KNIGHT.feet × size` below the anchor and holds the ring (rx 70, ry 26 × size) and the sprite (`<use x=-55 y=-186>` with `scale(size)`), exactly like Pawn. The size is the destination place's (the last place of the preview path, of the 7 route, or `aTo`/`bTo`).
  - **Badges:** at `((KNIGHT.w / 2 + 7) × size, −KNIGHT.head × size)`, beside the ghost's head.
  - **Capture marks:** at `(KNIGHT.head + 10) × size` above the victim. For the 7 this uses the size of the capture place.
  - **Tray letters `[data-letter]` and key-hint letters `[data-key-hint-knight]`:** at `(KNIGHT.head + 22) × size` above the knight.
  - **Swap arrows:** between the two `bodyAt` points.
  - **Seat glow:** at `stableCentre(turnSeat, k)`.

  These do not change: the screen-px sizes (× px), the path strokes, dashes and chevrons, and the felt seat ring, which moves in 01-32.
- **HitLayer.svelte**. Each target sits at `anchor − KNIGHT.body × size`, with `radius = max(22 × px, KNIGHT.w / 2 × size)` and `near = max(44 × px, radius)`. The catch-all rect is `SCENE.width × SCENE.height`. The keyboard focus ring and the click mapping are unchanged.
- **DebugGeometry.svelte**. It is drawn from the scene. It shows the 72 `text[data-ring]` at the C+ ring centres, the stable (E0–E3) and home (M0–M3) slots, the exits and carrés (`data-debug-exit`, `data-debug-entry`) and the `SCENE.felt` rectangle (`data-debug-felt`). It also shows the four `seatCard` slots, turned by their angle (`data-debug-card`), and the talon and défausse at `SCENE.card` size (`data-debug-pile`). It keeps `data-debug-geometry` and the screen-px label sizes. The old 2560 imports are gone from this file.
- **Particles.svelte**. `CHEST = −KNIGHT.body × knightScale(home place)`. REACH is still 230.
- **DealBanner.svelte**. `.wrap` has `top = board-size × var(--head-room)` and `height = board-size × 1.5`. The plate is centred on the board, over the felt, and the compact container rule is kept. In the desktop debug screenshot taken during the deal, the plate sat at the board's vertical centre.

I checked screenshots on desktop and the phone project by eye. They covered the Dame halo and ghost on cell 15, the As halos in the stable, the tray, a capture, the Valet swap, the 7 with a capture and the debug view. Every mark sits on its knight.

## Task commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Tracer: halo and hit target on the knight's body | 74a5c48 | Overlay.svelte, HitLayer.svelte, tracer.spec.ts |
| 2 | Previews, ghosts, markers, letters, seat glow, party, banner, debug view on C+ | 813a0a2 | Overlay.svelte, DebugGeometry.svelte, Particles.svelte, DealBanner.svelte, tracer.spec.ts, board.spec.ts |

## Verification

- `pnpm typecheck`: 0 errors (278 files). `pnpm lint`: Biome clean (146 files).
- `pnpm test`: 38 files, 749 passed and 2 skipped.
- `node tools/rules-trace.mjs --images`: « rules-trace: OK (16 règles, 112 scénarios) ».
- Tracer gate (Task 1): `playwright test e2e/tracer.spec.ts e2e/cibles.spec.ts` gave 27 passed and 13 skipped. That includes the R-07.1 checks that the centres of `[data-halo="bleu0"]` and `[data-hit="bleu0"]` lie inside `[data-pawn="bleu0"]`, on phone and desktop.
- Full Playwright suite on both projects: **281 passed, 43 skipped, 0 failed** (5.2 min), the same counts as after 01-30.
  - Per spec: animations 26 + 26, cartes-speciales 12 + 12, tracer 7 + 7, clavier 17 desktop + 3 phone, board 7 desktop, cibles 13 desktop.
  - The phone/desktop splits for clavier, board and cibles come from the specs' existing project skips.
  - The new ghost check passes on both projects: the centre of the ghost's ground ring is within 0.5 step of the drawn cell 15.
- Acceptance greps:
  - `grep -q knightScale Overlay.svelte && grep -q SCENE HitLayer.svelte` passes.
  - `grep -c KNIGHT Overlay.svelte` = 11.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The swap arrows moved to the body centres in Task 1**
- **Found during:** Task 1.
- **Issue:** Removing the old `BODY = 92` constant broke the Valet's arrow code, which the plan schedules for Task 2.
- **Fix:** The arrows use `bodyAt()` from Task 1 on.
- **Commit:** 74a5c48

**2. [Rule 2 - Coverage] board.spec.ts checks the C+ debug view**
- **Found during:** Task 2.
- **Issue:** board.spec.ts is not in the plan's file list. The plan's truth (« ?debug=geometry draws the 72 C+ ring indices, the home and stable slots, the exits, the carrés, the felt and its card slots ») was only checked by the count of 72 labels.
- **Fix:** The existing debug test now also checks two things:
  - every `text[data-ring=i]` is within 10 scene units of the centre of the drawn `[data-cell=i]`. The centre is read on the screen because the losanges are turned shapes.
  - the counts of the stable and home slots, exits, carrés, felt, seat cards and piles.
- **Files modified:** apps/web/e2e/board.spec.ts
- **Commit:** 813a0a2

**3. [Choice] Per-target hit radius and near distance**
- HitLayer had one radius for all targets. It now has one per lit knight, because the knights of one card can stand in different zones (an As lights stable and ring knights). The 44 px rule still holds for every target, and cibles.spec passes.

Nothing was changed on STATE.md, ROADMAP.md or the requirement checkboxes, as the orchestrator instructed. No package was added.

## Known Stubs

None. As the plan says, these stay on the old 2560 layout until 01-32:
- the felt's cards (FeltTable, cardFx);
- the active seat's felt ring in Overlay (`SLOT`, `rotatePoint`).

I noticed one visual point and left it as the plan specifies. In a stable the holes are 1.12 step apart, so a lit lower-row knight's letter (head + 22) covers the body of the knight above it when the key-hint letters show (computers only). That was already true before, with a larger offset. 01-33 or 01-36 could revisit it with Romain.

## Threat Flags

None. DebugGeometry is still loaded only in debug builds (`__TOC_DEBUG__`) and draws only scene geometry (T-01-44). No package was added (T-01-SC).

## Self-Check: PASSED

- FOUND: apps/web/src/board/Overlay.svelte, HitLayer.svelte, DebugGeometry.svelte, Particles.svelte, apps/web/src/ui/DealBanner.svelte, apps/web/e2e/tracer.spec.ts, apps/web/e2e/board.spec.ts
- FOUND commits: 74a5c48, 813a0a2 (both ancestors of HEAD)
