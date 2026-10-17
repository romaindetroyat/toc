---
phase: 02-jouer-en-ligne-entre-proches
plan: 10b
type: execute
wave: 11
depends_on: ["02-10"]
autonomous: true
gap_closure: true
files_modified:
  - packages/protocol/src/frames.ts
  - packages/protocol/src/frames.test.ts
  - packages/table/src/table.ts
  - packages/table/src/bots.ts
  - packages/table/src/reduce.ts
  - packages/table/src/frames.ts
  - packages/table/src/fast.test.ts
  - apps/worker/test/pace.test.ts
  - apps/worker/test/*.test.ts (hello v 5)
  - apps/web/src/game/session.svelte.ts
  - apps/web/src/net/notices.ts
  - apps/web/src/net/notices.test.ts
  - apps/web/src/settings/settings.ts
  - apps/web/src/settings/settings.test.ts
  - apps/web/src/i18n/fr/table.ts
  - apps/web/src/i18n/fr/reglages.ts
  - apps/web/src/ui/SettingsButton.svelte
  - apps/web/src/ui/SettingsSheet.svelte
  - apps/web/src/ui/InfoBar.svelte
  - apps/web/src/routes/Game.svelte
  - apps/web/src/routes/WaitingRoom.svelte
  - apps/web/e2e-online/avance.spec.ts
  - .planning/phases/02-jouer-en-ligne-entre-proches/02-UI-SPEC.md
requirements: []
---

# Plan 02-10b: « Avance rapide » for the whole online table, set by the chef de table

<objective>
Online, the computers felt slow to Romain. The cause was a dropped-alarm bug, now fixed
(`.planning/debug/slow-online-bots.md`). But locally Romain plays with « Avance rapide », and online
it is hidden (plan 02-08): the computers play at the normal pace and the moves animate at the normal
speed. He was offered « On peut ajouter une avance rapide valable pour toute la table, que le créateur
activerait. » and answered on 2026-10-17: « Oui, ajoute l’avance rapide ».

Add a table-wide « Avance rapide »:
- Only the chef de table (the derived host of plan 02-06: the creator, or the role's holder while the
  creator is away) switches it, in the waiting room and during the game, from « Réglages ».
- The server owns it: `Table.fast`, kept in the SQLite snapshot, off by default, kept by the rematch.
  `speedOf(table)` is "fast" when it is on (unless the test pace "zero" makes it "test"): the computers
  think at the fast pace (`paceFor(…, "fast")`, at most 300 ms) and the Champion stops at
  `FAST_HARD_CAP_MS`; `waitMs` is `eventsDuration(events, "fast")`, so the server waits for the faster
  animations. A switch applies from the next decision (a Champion's cap at its next slice).
- Everyone sees it: `TablePublic.fast`. Every page animates the moves in fast mode while it is on (a
  page's « Animations réduites » still wins), a small badge on the « Réglages » gear says the table is
  in fast mode, and a toast says who changed it: « Ana a mis l’avance rapide. » / « Ana a enlevé
  l’avance rapide. »
- The local game is unchanged.
</objective>

<context>
- packages/bots/src/pace.ts: `Speed`, `paceFor`, `hardCap`, `FAST_CEILING_MS`, `FAST_HARD_CAP_MS`.
- packages/table/src/bots.ts: `speedOf`, `scheduleBot` (`waitMs`), `thinkTick` (cap, `playAt`).
- packages/table/src/reduce.ts: every client frame; `hostOf` (presence.ts) is the derived host
  (`pause`, `stop`, `resume` use it).
- packages/protocol/src/frames.ts: `PROTOCOL_VERSION` 4. 02-07 and 02-09 bumped it because an older
  page would mis-handle the change; 02-08 did not (an older page only missed the chat). Here an older
  page would strip `fast` from the table frame and animate at the normal speed while the table plays at
  the fast pace (the computers no longer wait for its animations): its moves would lag ever further
  behind, and it would show no badge. So 5, and an older page reloads (CLOSE_VERSION).
- apps/web/src/game/session.svelte.ts: online `fast()` is false today (plan 02-08).
- apps/web/src/ui/SettingsSheet.svelte: online « Réglages » already holds the chef de table's
  « Arrêter la partie »; apps/web/src/net/notices.ts: the table's toasts.
- apps/worker/test/pace.test.ts: the real pace inside workerd, alarms delivered as in production.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: protocol, the speed frame and the public flag</name>
  <files>packages/protocol/src/frames.ts, packages/protocol/src/frames.test.ts, apps/worker/test/*.test.ts</files>
  <behavior>
  - `{ t: "speed", fast: true|false }` parses; an extra key, a non-boolean, a missing `fast` are refused.
  - `TablePublic.fast: boolean`; a table or welcome frame without it is refused by parseServerFrame.
  - PROTOCOL_VERSION is 5.
  </behavior>
  <action>RED: the tests above. GREEN: the strict frame in the union, `SpeedFrame`, the public field
  in the schema, the bump with its reason; the workerd tests' hellos say v 5.</action>
  <verify><automated>pnpm vitest run packages/protocol</automated></verify>
  <done>The frame and the field are validated with zod on both sides.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: the table owns the setting, the computers follow it</name>
  <files>packages/table/src/table.ts, packages/table/src/bots.ts, packages/table/src/reduce.ts, packages/table/src/frames.ts, packages/table/src/fast.test.ts</files>
  <behavior>
  - A new table is not fast; a snapshot without the field reads as not fast.
  - The chef de table switches it in the lobby, in a game, paused, saved, finished: every person
    online gets a table frame with `fast`. Anyone else: `not-host`, nothing changes. The same value
    again: nothing sent.
  - While the creator is away in a game, the derived host may switch it and the creator may not.
  - `speedOf` is "fast" when on, "normal" when off, "test" under the zero pace whatever the flag.
  - Fast and the normal pace: a computer's `waitMs` is `eventsDuration(events, "fast")` and its play
    time is at most `dueAt + waitMs + FAST_CEILING_MS`; a Champion is stopped at `FAST_HARD_CAP_MS`.
  - The rematch keeps the setting.
  </behavior>
  <action>RED: packages/table/src/fast.test.ts. GREEN: `Table.fast` (createTable false, copyTable
  `??= false`), `speed` in reduce (hostOf, `not-host`), `speedOf` and `waitMs` in bots.ts,
  `tablePublic.fast`.</action>
  <verify><automated>pnpm vitest run packages/table</automated></verify>
  <done>The server paces its computers from the table's own flag.</done>
</task>

<task type="auto">
  <name>Task 3: the regression at the real pace in workerd</name>
  <files>apps/worker/test/pace.test.ts</files>
  <action>A case of pace.test.ts: two people and two Galopeurs at the real pace, alarms delivered as
  in production, the chef de table switches « Avance rapide » on before the start: every computer
  turn takes at most `FAST_CEILING_MS` plus about a second of alarm slack after the fast animation of
  the move that made it due (`eventsDuration(…, "fast")`). The measured times go in the SUMMARY.</action>
  <verify><automated>pnpm --filter @toc/worker exec vitest run test/pace.test.ts</automated></verify>
  <done>Fast-mode computer turns measured, within budget.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: the switch, the badge, the toast</name>
  <files>apps/web/src/game/session.svelte.ts, apps/web/src/net/notices.ts, apps/web/src/net/notices.test.ts, apps/web/src/settings/settings.ts, apps/web/src/settings/settings.test.ts, apps/web/src/i18n/fr/table.ts, apps/web/src/i18n/fr/reglages.ts, apps/web/src/ui/SettingsButton.svelte, apps/web/src/ui/SettingsSheet.svelte, apps/web/src/ui/InfoBar.svelte, apps/web/src/routes/Game.svelte, apps/web/src/routes/WaitingRoom.svelte</files>
  <behavior>
  - notices: a change of `fast` gives everyone but the chef de table « {Chef} a mis l’avance
    rapide. » or « {Chef} a enlevé l’avance rapide. », in the waiting room and in the game.
  - settings: `tableFast` (the creator's last choice on this device), false by default, kept.
  </behavior>
  <action>
  - RED: the notices and settings tests. GREEN:
  - « Réglages » at an online table (waiting room and game): a first row, the switch « Avance rapide »
    with the helper « Pour toute la table : les ordinateurs jouent presque aussitôt et les coups
    vont plus vite. ». The chef de table switches it (a `speed` frame; the device remembers the
    choice in `tableFast`); the others see it disabled, with the helper « Seul le chef de table,
    {Nom}, peut la changer. ».
  - The badge: while the table is fast, a 20 px disc (`--bois-sombre`, 2 px cream border, 12 px
    cream `fast-forward`) on the gear's top-right corner, `data-fast-badge`, not a target; the gear's
    accessible name becomes « Réglages (avance rapide pour toute la table) ». In the waiting room a
    muted line « Avance rapide pour toute la table. » (`data-fast-line`) in the right column too.
  - The session animates in fast mode online while `table.fast` (Animations réduites still wins).
  - A table this device just created starts with the creator's remembered choice (one `speed` frame
    with the invite sheet's « new table » mark).
  - Local game untouched: the action zone's « Avance rapide » keeps its own `settings.fast`.
  </action>
  <verify><automated>pnpm vitest run apps/web/src/net apps/web/src/settings && pnpm typecheck</automated></verify>
  <done>The chef de table switches it in « Réglages »; everyone sees the badge and the toast.</done>
</task>

<task type="auto">
  <name>Task 5: the online e2e and the UI-SPEC</name>
  <files>apps/web/e2e-online/avance.spec.ts, .planning/phases/02-jouer-en-ligne-entre-proches/02-UI-SPEC.md</files>
  <action>
  - avance.spec: Ana (creator) and Bea at a zero-pace table; in the waiting room Bea's switch is
    disabled; the game starts; Ana opens « Réglages » and switches « Avance rapide » on: Bea sees the
    badge and the toast « Ana a mis l’avance rapide. », Ana sees the badge and no toast; switched off,
    the badge goes on both pages. Screenshots at 1280 × 800 and 844 × 390 (TOC_SHOTS).
  - 02-UI-SPEC: dated note quoting Romain; « Chrome changes », « Réglages », toasts, component rows.
  </action>
  <verify><automated>pnpm --filter @toc/web exec playwright test -c playwright.online.config.ts</automated></verify>
  <done>Online suite 0 failed; screenshots looked at.</done>
</task>

</tasks>

<verification>
pnpm typecheck && pnpm lint && pnpm test; the full local Playwright suite; the online suite
(playwright.online.config.ts), one after another, nothing left listening on 8787.
</verification>

<output>.planning/phases/02-jouer-en-ligne-entre-proches/02-10b-SUMMARY.md</output>
