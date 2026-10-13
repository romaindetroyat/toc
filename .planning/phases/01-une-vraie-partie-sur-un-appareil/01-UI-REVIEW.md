# Phase 01 — UI Review

**Audited:** 2026-10-13
**Baseline:** 01-UI-SPEC.md (approved 2026-10-13)
**Screenshots:** captured (static build via `vite preview` on port 4199; 4 viewports: 1440×900, 375×812, 320×480, 667×375; launch and game screens). Stored outside the repo in the scratchpad `ui-audit/`.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false). Interaction findings below are code-derived.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Copy matches the contract almost verbatim, but the info bar shows « Échange des cartes » (not in the contract) and the phone donor line truncates « Donne k sur 3 ». |
| 2. Visuals | 2/4 | At 320×480 the board is about 155 px wide, so a pawn is about 7 px: the knights are not distinguishable (contract backstop, not met). |
| 3. Color | 3/4 | Walnut / oak / amber palette follows the contract, but 43 hard-coded hex literals across 11 files bypass the token layer. |
| 4. Typography | 3/4 | Four sizes and two weights in the tokens, but raw px sizes sit outside the scale: 18 px (7 panel title) and `max(13px, …)` (board labels, below the 14 px minimum). |
| 5. Spacing | 3/4 | Token scale is in place. The 5-card fan at 320 px runs to the viewport edge (left card touches x = 0), breaking the 16 px gutter. |
| 6. Experience Design | 3/4 | Strong state coverage (error boundary, dead hand, reduced motion, visibility pause, audio toast, Tapis, abandon dialog, 254 Playwright tests). Gaps: the exchange primary button looks dimmed with no stated reason, and the turn indicator is absent in the exchange state. |

**Overall: 17/24**

---

## Top 3 Priority Fixes

1. **Pawns are illegible on short phones (320×480, 375×667)** — the board shrinks to about 155 px because the stacked chrome (info bar 56 + action zone up to 160 + hand 132) consumes the height. A pawn at that size is about 7 px, so the player cannot tell whose knight is where, and the halo and capture badge cannot be read. Fix: below about 560 px of height, cap the action zone at its 72 px minimum and let the hand fan overlap it, or switch to a shorter hand (72×100 card, reduced fan height) so the board gets at least 220 px. Then re-run the 320×480 check listed in the contract backstop.

2. **Hand fan leaves the 16 px gutter at 320 px** — in the 320×480 screenshot the left-most card starts at x ≈ 0 and the right card reaches the edge. The offset formula is computed against `viewport − 32`, but the rotated card corners extend beyond that box. Fix: clamp the fan's container to `W = viewport − 32` including rotation, or reduce the 4° per-card rotation to 3° below 360 px wide and re-measure with `getBoundingClientRect`.

3. **Token discipline: off-scale sizes and hard-coded colours** — the 7 panel title is 18 px (`SevenPanel.svelte`, not in the scale; should be the 20 px Heading), the board labels use `max(13px, 4.4cqw)` (`Board.svelte`, below the 14 px minimum), and `ColorTile.svelte`, `SeatChip.svelte`, `CardBack.svelte` and `cards/faces.ts` repeat `#2B1D12`, `#D8C6B0`, `#A46F2A` and `#FFF8E1` instead of reading the CSS custom properties. Fix: move those literals to `:root` tokens, change the 18 px to `var(--heading-size)`, and clamp the board label to `max(14px, …)`.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

Verified present in `apps/web/src/i18n/fr/*.ts`: « Jouer la partie », « Choisis ta couleur », « Réglages », « Passer cette carte », « Poser mes cartes », « Annuler ce coup », « Changer de carte », « Choisir un autre cheval », « Jouer quand même », « Avance rapide », « Plus de cartes », « Oups, le jeu a rencontré un problème. », « Recharger la page », « Continuer à jouer », « Réessayer » (×3), « Rejouer », « Changer de couleur », « Tout est réparti », « Son prêt ». No bare « Annuler » in the UI (grep). French typography is enforced by `typography.test.ts`.

- **Deviation:** the info bar title during exchange reads « Échange des cartes » (`i18n/fr/game.ts:25`, `exchanging`). The contract's info bar lists only « À toi de jouer », « Tour de {Nom} », and « Donneur : {Nom} · Donne {k} sur 3 ». Either add the string to the contract or use « Donneur : … » in row 1.
- **Truncation:** at 375 px the second row reads « Donneur : Marengo · Don… », hiding « Donne {k} sur 3 ». The contract allows row 2 to ellipsise, but the deal counter is the only place the player sees the deal number on phones. Prefer dropping the dealer name first.

### Pillar 2: Visuals (2/4)

- Strong focal point on the game screen: the board is the largest, most saturated element on a walnut ground (desktop and 375 px screenshots). Launch screen: four colour tiles are the anchor, with amber « Jouer la partie » directly below, matching the contract.
- **Notable gap:** 320×480 game screen (`small-game.png`) — the board renders at about 155 px. The contract's pawn footprint of 110 board units gives about 7 px on screen, far below the ≈17 px target at 390 px. Halos, capture badges and the disambiguation tray cannot be judged. The contract backstop (« pawns distinguishable at 320 × 480 ») is not met by the built layout.
- Icon-only controls carry labels: 37 `aria-label` occurrences across the components; the gear is 44×44 per the contract.

### Pillar 3: Color (3/4)

- Dominant walnut `#2B1D12` background, oak and felt on the board, amber used on the primary button and selected tile. The launch screen matches the 60/30/10 intent.
- **Hard-coded literals bypass tokens** (`grep` over `apps/web/src`, excluding tests): 43 matches in 11 files. Non-board examples: `ui/ColorTile.svelte:86-133` (`#dfcfba`, `#d8c6b0`, `#cfbba3`, `#2b1d12`), `ui/SeatChip.svelte:47-60` (`#fff8e1`, `#2b1d12`), `ui/CardBack.svelte:19-21` (`WALNUT`, `OAK`, `BORDER` as constants), `cards/faces.ts:17-18` (`#C0201A`, `#1A1A1A`). Board art colours are acceptable (they are artwork); the UI chrome literals are not.
- Amber discipline: the 2-stage halo, selected card outline and turn marker all match the reserved list. No amber body text observed.
- Exchange primary button (« Passer cette carte »): in the 375 and 1440 game screenshots it is rendered brown with dim text, not the amber primary fill specified. If it is disabled until a card is selected, that is correct, but the contract does not say so and nothing tells the player why. Confirm and document the disabled rule.

### Pillar 4: Typography (3/4)

- Token scale present in `app.css` (`--body-size`, `--label-size`, `--heading-size`, `--display-size`), with Nunito and Caveat. Font weights used: 400 and 700 only (plus the variable-font range declaration).
- **Off-scale sizes:**
  - `ui/SevenPanel.svelte:264` — `.title { font-size: 18px }` (between Label 14 and Heading 20).
  - `board/Board.svelte:228` — `font-size: max(13px, 4.4cqw)`, below the 14 px minimum on-screen text rule.
  - `ui/Card.svelte:164,170` — 44 px card letter and figure (decorative card face, acceptable only if the card face is excluded from the typography rule; the contract does not exclude it).
  - `ui/SevenPanel.svelte:168,176` — 16 px (in scale, fine); `:191` 20 px (in scale).
- Numbers that change use `tabular-nums` (`.tabular` class on StepChip, Slider, SoundTest; InfoBar sets it directly).

### Pillar 5: Spacing (3/4)

- Spacing tokens (`--space-sm`, `--space-md`, …) in use in the panels; the 56 px info bar, 44 px targets and 72/100 and 88/124 card sizes match the contract exceptions.
- **Gutter breach:** at 320×480 the hand fan extends to the viewport edges (the left card starts at x ≈ 0), against the 16 px gutter the contract declares (fan container `W = viewport − 32`). Rotation and vertical drop push corners outside the container.
- Safe-area insets are applied (`env(safe-area-inset-*)`, `viewport-fit=cover`), and no horizontal page scroll was detected at any tested viewport (`scrollWidth === clientWidth`).

### Pillar 6: Experience Design (3/4)

Covered and verified in code and the phase's Playwright suite (254 passed, 28 skipped per 01-24-SUMMARY):
- Error boundary → « Oups… » screen in `routes/Game.svelte`; board image error → « Le plateau n’a pas pu se charger. » with « Réessayer ».
- Empty hand « Plus de cartes »; dead hand with « Poser mes cartes »; exchange waiting and done states.
- Reduced motion from `prefers-reduced-motion` with an in-app override; `visibilitychange` pauses the animator and fast-forwards on return.
- Audio failure toast with « Réessayer »; Réglages persisted in try/catch with in-memory fallback.
- Destructive confirmation « Abandonner la partie » with the default focus on « Continuer à jouer ».
- Focus ring: `:focus-visible` defined in `app.css`.

Gaps:
- The exchange state shows no turn indicator in the info bar (the dot is `aria-hidden` and visually absent in the screenshot). The contract wants the turn dot on every info-bar state.
- The primary action during exchange appears inactive with no explanation (see Pillar 3).
- The 320-wide layout is the only place where the board is too small to play comfortably, and no state-specific copy explains it. This is the same root cause as Priority Fix 1.

**Registry audit:** not applicable (no `components.json`; contract « Registry Safety: none »).

---

## Files Audited

- `.planning/phases/01-une-vraie-partie-sur-un-appareil/01-UI-SPEC.md`
- `.planning/phases/01-une-vraie-partie-sur-un-appareil/01-15-SUMMARY.md` … `01-24-SUMMARY.md` (deviation and stub sections)
- `apps/web/src/app.css`
- `apps/web/src/i18n/fr/game.ts`, `board.ts`, `launch.ts`, `reglages.ts`, `sons.ts`, `credits.ts`, `seats.ts`, `cards.ts`
- `apps/web/src/ui/InfoBar.svelte`, `ActionZone.svelte`, `HandFan.svelte`, `Card.svelte`, `SevenPanel.svelte`, `ColorTile.svelte`, `SeatChip.svelte`, `CardBack.svelte`, `TapisSheet.svelte`, `Toast.svelte`, `SettingsSheet.svelte`
- `apps/web/src/board/Board.svelte`, `FeltTable.svelte`, `FaceUpCard.svelte`, `Overlay.svelte`
- `apps/web/src/routes/Launch.svelte`, `Game.svelte`, `SoundTest.svelte`
- `apps/web/src/cards/faces.ts`
- Screenshots (scratchpad `ui-audit/`): `desktop-launch.png`, `desktop-game.png`, `phone-launch.png`, `phone-game.png`, `small-launch.png`, `small-game.png`, `landscape-launch.png`, `landscape-game.png`
