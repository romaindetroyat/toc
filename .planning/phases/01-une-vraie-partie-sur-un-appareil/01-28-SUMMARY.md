---
phase: 01-une-vraie-partie-sur-un-appareil
plan: 28
subsystem: web-ui
status: complete
tags: [gap-closure, keyboard, shortcuts, key-hints, accessibility, uat-5]
requires:
  - phase: 01-27
    provides: "keyIntent / litKnights (shortcuts.ts), ShortcutsSheet, clavier.keys and clavier.link, e2e/clavier.spec.ts"
provides:
  - "KeyHint.svelte: walnut/crème key badge shown only under (hover: hover) and (pointer: fine)"
  - "Digit badges on the hand (his turn and the exchange), on a layer over the fan"
  - "Key badges, aria-label and aria-keyshortcuts on the hinted action buttons, the tray close and the 7 assistant"
  - "Letter discs over the lit knights (data-key-hint-knight)"
  - "Réglages link « Raccourcis clavier » (data-shortcuts-link), in a game and on a computer only"
affects: []
tech-stack:
  added: []
  patterns:
    - "Computer-only UI: a scoped style that is display none by default and shown under @media (hover: hover) and (pointer: fine), so on a phone it is not drawn, cannot get focus and is not in the accessibility tree"
    - "A badge that must stay above sibling stacking contexts goes on its own overlay layer that reuses the host's transform. Its box is zero-width with an explicit transform-origin, so it never widens the scrollable overflow"
key-files:
  created:
    - apps/web/src/ui/KeyHint.svelte
    - .planning/phases/01-une-vraie-partie-sur-un-appareil/deferred-items.md
  modified:
    - apps/web/src/ui/HandFan.svelte
    - apps/web/src/ui/ActionZone.svelte
    - apps/web/src/ui/SevenPanel.svelte
    - apps/web/src/ui/PawnTray.svelte
    - apps/web/src/board/Overlay.svelte
    - apps/web/src/ui/SettingsSheet.svelte
    - apps/web/e2e/clavier.spec.ts
decisions:
  - "Card digits sit on the top edge of the card's visible slice (left 26 px), not in its top-right corner: in the fan the next card covers that corner"
  - "Card digits are drawn on a separate layer at z-index 20 over the fan, so a raised or selected card never hides its neighbour's digit"
  - "The 7 panel title stays 18 px: at 20 px the header wraps on « Tout est réparti. » at 375 px and the panel grows, so cibles.spec.ts fails. The plan allows keeping 18 px in this case"
metrics:
  duration: 50min
  completed: 2026-10-14
  tasks: 3
  files: 8
estimate:
  tokens: 60000
  tasks: 3
actuals:
  tokens: 5800
  tasks: 3
  commits: 4
plan_head_before: 09fc1c3220b606c2f55d3a98fea18e6b33b446d0
plan_head_after: f20df841d976c960e2b0182a2050a3d3db50ad70
---

# Phase 1 Plan 28: Les raccourcis se voient sur ordinateur, jamais sur téléphone Summary

On a computer (hover and a fine pointer), the keys now appear where they act:
- a digit on each card of the hand;
- a letter disc over each lit knight;
- a key badge on the action buttons and on the 7's buttons;
- a « Raccourcis clavier » link in Réglages that opens the same help as « ? ».

Phones show none of them, and the link cannot be reached there either. Accessible names, Tab stops and host sizes are unchanged.

## What was built

- **KeyHint.svelte**: a `<kbd data-key-hint aria-hidden>` that ignores the pointer. It has a walnut fill, crème text, a 1 px crème border, Label 14/700, tabular digits, a 20 × 20 minimum and a 4 px radius, with no amber. It is `display: none` unless `(hover: hover) and (pointer: fine)`. There are two placements, both astride the host's top edge: `corner` (8 px from the right, for buttons) and `card` (26 px from the left, inside the visible slice).
- **HandFan**: digits 1 to n, in fan order (the order keyIntent uses), during his turn and the exchange, never while the hand is concealed.
  - The digits sit on their own zero-width slots at z-index 20. These slots follow each card's transform and pivot.
  - The received card's digit sits above its « Reçue » tag.
- **ActionZone**: badges, `aria-label` and `aria-keyshortcuts` on these buttons:

  | Button | Badge | `aria-keyshortcuts` |
  |---|---|---|
  | « Sortir un cheval » | S | `S` |
  | « Avancer de … » | A | `A` |
  | « Jouer » / « Jouer quand même » | Entrée | `Enter` |
  | « Passer cette carte » | Entrée | `Enter P` |
  | « Poser mes cartes » | P | `P Enter` |

  « Changer de carte » and « Annuler ce coup » show no key: Échap only goes back one step, while they drop the card. ActionZone has 5 `aria-keyshortcuts`.
- **PawnTray**: « Choisir un autre cheval » shows Échap (`Escape`).
- **SevenPanel**: « Jouer » shows Entrée (`Enter`) and « Retirer le dernier pas » shows ⌫ (`Backspace`). « Tout annuler » shows no key.
- **Overlay**: `<g class="key-hint-knight" data-key-hint-knight>` discs with `knightLetter`, in the tray-letter style (r 14 px, 16 px bold) at y − 208. They appear in cardSelected, jackPick, jackTarget, sevenBuilding and preview, never in the tray, and only on a fine pointer.
- **SettingsSheet**: in a game (`onabandon`), a `data-shortcuts-link` text button « Raccourcis clavier » follows « Crédits et licences ». It opens `ShortcutsSheet` nested, with the link as opener, and is `display: none` without a fine pointer.

## Verification

| Gate | Result |
|------|--------|
| `pnpm typecheck` (svelte-check 273 files) | 0 errors, 0 warnings |
| `pnpm lint` (Biome) | clean |
| `pnpm test` | 725 passed, 2 skipped (unchanged) |
| `node tools/rules-trace.mjs --images` | `rules-trace: OK (16 règles, 112 scénarios)` (unchanged) |
| Task 1 verify: clavier.spec.ts, both projects (tracer gate) | 14 passed, 12 skipped (the phone skips of « au clavier seul ») |
| Task 2 verify: clavier, finition, cibles, cartes-speciales, both projects | 87 passed, 29 skipped, 0 failed |
| clavier + finition + partie-complete, both projects (final) | 54 passed, 20 skipped, 0 failed |
| Full Playwright suite, both projects (Task 3 verify) | 279 passed, 44 skipped, 1 failed: the pre-existing flaky `animations.spec.ts:782` (see Deferred Issues). It failed in both full runs |

**matchMedia `(hover: hover) and (pointer: fine)`:** `true` on the desktop project and `false` on the phone project (iPhone 13 emulation). The new test checks this first.

New tests in `e2e/clavier.spec.ts`, describe « les touches se voient sur ordinateur »:
- digits 1-2-3 from left to right on desktop, none visible on phone;
- the button badges: « Jouer » shows Entrée, keeps its name `Jouer` (exact) and keeps the same box with the badge hidden; S/A on the As; Entrée/⌫ on the 7; nothing on « Annuler ce coup », « Changer de carte » or « Tout annuler »; none visible on phone;
- « chaque touche affichée fait ce que fait son bouton » (desktop): 9 click-versus-key pairs on fresh pages, compared once the screen has settled (data-state, 7 counter, every knight's data-place). Each pair must also change something, so two no-ops cannot pass;
- letter discs A/B over two lit knights, and none in the Valet tray (where the tray letters stay);
- Réglages → « Raccourcis clavier » → help dialog; Échap gives the focus back to the link, and a second Échap closes Réglages;
- phone sweep: idle, card selected, preview, As question, 7 assistant, exchange (with a card chosen) and dead hand show no visible hint and no letter disc, and Réglages has no « Raccourcis clavier ».

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Card digits hidden under the neighbouring cards**
- **Found during:** Task 2 (desktop screenshots)
- **Issue:** the plan put the badge inside each `.slot`, at the top-right corner. In the fan, the next card covers that corner, and the raised or selected card (z-index 10) covered its neighbour's digit.
- **Fix:** the digit sits astride the top edge of the visible slice, on a separate layer of `.hint-slot`s at z-index 20 that reuse each card's transform. The received card's digit is moved above the « Reçue » tag.
- **Files modified:** apps/web/src/ui/HandFan.svelte, apps/web/src/ui/KeyHint.svelte (placement `card`)
- **Commit:** fbf435e

**2. [Rule 1 - Bug] 1 px sideways scroll at 320 × 480 on the desktop project**
- **Found during:** Task 2 verify (finition « écran 320x480 »)
- **Issue:** the badge above the top edge of the turned outer hint slots widened their scrollable overflow by about 1.4 px.
- **Fix:** the hint slots have zero width, and `transform-origin: calc(var(--card-w) / 2) 160%` keeps the card's pivot. The badge positions were identical before and after the fix, and the page is 320 px wide again.
- **Commit:** fbf435e

### Plan option taken

- **SevenPanel title kept at 18 px.** At `var(--heading-size)` (20 px), `cibles.spec.ts` « beaucoup d'étapes : la liste défile dans le panneau, qui garde sa taille » failed: at 375 px the header wraps on « Tout est réparti. » (34 → 48 px) and the panel grows from 200 to 214 px. Its finition counterpart did not fail. The plan says to keep 18 px in this case, so the UI-review item stays open.

## Deferred Issues

- `e2e/animations.spec.ts:782` (desktop, reduced motion, « une carte jouée se fond en 150 ms… ») is flaky, and the flake predates this plan:
  - It fails on `near(mover.begins - card.ends, LEAD, 12)`, always with the same value `23.324`.
  - With the component files of 09fc1c3 (before this plan) it failed 2 of 6 runs on its own. With this plan it failed 2 of 8 runs on its own, and it failed in both full-suite runs.
  - The test was not changed. It is logged in `deferred-items.md`.

## Known Stubs

None.

## Threat Flags

None. The hints are static catalogue strings rendered as Svelte text nodes (no raw HTML, so `no-raw-html.test.ts` still passes). The link only opens the existing help sheet (T-01-39 accepted as planned). No package was added (T-01-SC).

## Human check (backstop)

Romain plays a few turns on his computer using the hints: cards, knights, buttons, « ? », and Réglages → « Raccourcis clavier ». Then he opens the game on his iPhone, where there should be no hint and no link (UAT test 5 re-run).

## Self-Check: PASSED

- FOUND: apps/web/src/ui/KeyHint.svelte, apps/web/e2e/clavier.spec.ts, deferred-items.md
- FOUND commits: 7b14bf1, fbf435e, 9b841f5, f20df841
- `grep -q "(hover: hover) and (pointer: fine)" apps/web/src/ui/KeyHint.svelte`, `grep -q data-shortcuts-link SettingsSheet.svelte`, `grep -q data-key-hint-knight Overlay.svelte`: all exit 0
