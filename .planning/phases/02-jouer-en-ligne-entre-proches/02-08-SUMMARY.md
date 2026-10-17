---
phase: 02-jouer-en-ligne-entre-proches
plan: 08
status: complete
subsystem: online-table
tags: [quick-messages, chat, rate-limit, durable-objects, svelte5, playwright, workerd, a11y]

requires:
  - phase: 02-jouer-en-ligne-entre-proches
    provides: "02-07 protocol v3, the table reducer and frames, the connection (onFrame, welcome resync); 02-06 the bar's fourth row, TablePlate, SeatBadges; 02-05 the waiting room's action row and seat tiles; 02-02 the leak oracle and property"
provides:
  - "@toc/protocol messages.ts: QUICK_MESSAGES (the twelve ids in palette order), QUICK_PHRASES, QUICK_EMOJIS, CHAT_KEEP 30; client frame chat { msg }; server frame chat { from, msg, at }; error code rate; WelcomeFrame.chat (the last 30, oldest first)"
  - "@toc/table chat.ts: canChat (a seat, any status), CHAT_RATE 3 per CHAT_WINDOW_MS 5000 per person on ctx.now, keepMessage; Table.chat and the server-only Table.chatTimes"
  - "Client: connection.chat; net/chat.ts (senderName, historyRows, announcement); i18n/fr/messages.ts; MessagesButton, MessagesSheet; « M » in shortcuts.ts; board/bubbles.ts (riderRect, placeBubble, placeAbove, intersects); board/ChatBubbles.svelte"
  - "e2e-online/messages.spec.ts (phone, desktop)"
affects: [02-09, 02-10]

tech-stack:
  added: []
  patterns:
    - "Only ids travel; each device looks the words up in its French catalogue and draws them as text nodes (no free text exists anywhere)"
    - "A bubble's spot is a pure function of screen rects (board, rider, controls); the screen gathers the rects with getBoundingClientRect and one selector list"
    - "Hard and soft obstacles: controls are never covered; other bubbles are avoided only where the board leaves room"

key-files:
  created:
    - packages/protocol/src/messages.ts
    - packages/table/src/chat.ts
    - packages/table/src/chat.test.ts
    - apps/worker/test/chat.test.ts
    - apps/web/src/i18n/fr/messages.ts
    - apps/web/src/net/chat.ts
    - apps/web/src/net/chat.test.ts
    - apps/web/src/ui/MessagesButton.svelte
    - apps/web/src/ui/MessagesSheet.svelte
    - apps/web/src/board/bubbles.ts
    - apps/web/src/board/bubbles.test.ts
    - apps/web/src/board/ChatBubbles.svelte
    - apps/web/e2e-online/messages.spec.ts
  modified:
    - packages/protocol/src/frames.ts
    - packages/protocol/src/frames.test.ts
    - packages/protocol/src/index.ts
    - packages/table/src/table.ts
    - packages/table/src/reduce.ts
    - packages/table/src/frames.ts
    - packages/table/src/index.ts
    - packages/table/src/oracle.ts
    - packages/table/test/leak.test.ts
    - apps/web/src/net/connection.svelte.ts
    - apps/web/src/net/remoteGame.test.ts
    - apps/web/src/game/shortcuts.ts
    - apps/web/src/game/shortcuts.test.ts
    - apps/web/src/game/session.svelte.ts
    - apps/web/src/i18n/fr/clavier.ts
    - apps/web/src/ui/ShortcutsSheet.svelte
    - apps/web/src/ui/SettingsSheet.svelte
    - apps/web/src/ui/InfoBar.svelte
    - apps/web/src/ui/ActionZone.svelte
    - apps/web/src/routes/Game.svelte
    - apps/web/src/routes/WaitingRoom.svelte
    - apps/web/src/routes/Table.svelte
    - .planning/REQUIREMENTS.md

key-decisions:
  - "PROTOCOL_VERSION stays 3: chat is additive. An older page never sends chat, drops the chat frame (unknown type) and the welcome's chat key (zod object), and never receives rate. The DO migration tag v1 is unchanged; old snapshots get chat [] through copyTable."
  - "An unseated person's chat answers error refused (the existing code); the fourth within 5 s answers rate to the sender only. Only accepted messages count toward the pace, so a flood of refused frames writes nothing."
  - "A chat frame goes to every person online at the table, the sender included (their own bubble, without the name line). A message is activity for the 30-day clock (a client frame that changed the table)."
  - "« Messages » in the waiting room shows only once seated (the server takes nothing from someone without a seat)."
  - "Online, « Avance rapide » is hidden in both chromes (phone strip and computer bar) and its setting is no longer applied (session: fast only for the local controller), so a player who left it on locally does not get faster animations online without a way to turn them off."
  - "« M »: the typed letter (input.key m or M), so AZERTY works; « ? » on AZERTY's KeyM stays the help. It passes under a plate (with « ? »), never on the end plank (blocked), in a field, with modifiers or on repeat. The help row « M — Ouvrir les messages rapides. » shows at an online table only."
  - "« M » gives the focus back to what had it (as « ? »); a tap gives it back to « Messages »."
  - "Bubbles are drawn under the hand (z 2) and the plates (39, 40). When no spot along the edge is clear (a tall plate over a small board), the bubble keeps its spot by the rider and the plate stays on top: it never covers a plate."
  - "The name in a bubble and in the history is the seat's current name (the chat entry keeps the seat, as the plan specifies, not the name)."

requirements-completed: [NET-05]

coverage:
  - id: D1
    description: "Only the twelve ids, only from a seated person, 3 per 5 s per person, in lobby, playing, paused and saved; the last 30 kept and given in every welcome"
    requirement: NET-05
    verification:
      - kind: unit
        ref: "packages/protocol/src/frames.test.ts; packages/table/src/chat.test.ts"
        status: pass
      - kind: property
        ref: "packages/table/test/leak.test.ts (bursts of four messages; the oracle checks chat frames' exact keys)"
        status: pass
      - kind: integration
        ref: "apps/worker/test/chat.test.ts (five in a row: three reach both, two rate; bad-frame for an unknown id; the reconnect's welcome)"
        status: pass
  - id: D2
    description: "« Messages » (waiting room, phone strip in place of « Avance rapide », bar's fourth row, « M ») opens « Messages rapides »; one tap sends and closes; « Derniers messages »; the rate toast"
    requirement: NET-05
    verification:
      - kind: unit
        ref: "apps/web/src/game/shortcuts.test.ts; apps/web/src/net/chat.test.ts; apps/web/src/i18n/typography.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e-online/messages.spec.ts"
        status: pass
  - id: D3
    description: "The bubble beside the sender's rider (above the tile in the room) for about 4 s, the name for the others, taps pass through, the live region « Ana : cœur »; four at once clear of every control at 844 × 390, 750 × 342, 480 × 320, 1280 × 800"
    requirement: NET-05
    verification:
      - kind: unit
        ref: "apps/web/src/board/bubbles.test.ts"
        status: pass
      - kind: e2e
        ref: "apps/web/e2e-online/messages.spec.ts"
        status: pass

estimate:
  tokens: 130000
actuals:
  tokens: 21200    # chars/4 of the added lines of the plan's seven commits (84 935 characters)
  tasks: 3
  commits: 7       # git rev-list --count plan_head_before..HEAD before this SUMMARY
plan_head_before: d28fd85dda4ea5e6c3349e496c856a311dc6e1f6
plan_head_after: 7f1e288e8cfd29234cd084802dc11bf6b87398ef

duration: 45min
completed: 2026-10-17
---

# Phase 2 Plan 08: Les messages rapides Summary

**Romain's twelve quick messages (seven phrases, five emojis) are the only thing players can send each other. The server accepts them only as protocol ids from seated players, three per five seconds per person, and keeps the last 30 for every welcome. « Messages » (or « M » on a computer) opens « Messages rapides »; one tap sends. Everyone sees a cream bubble bordered in the sender's colour for about 4 s: beside the sender's rider on the board, above their tile in the waiting room. Taps go through the bubble, and a screen reader hears « Ana : cœur ». NET-05 now says quick messages, Romain's choice of 2026-10-17 (D-07).**

## What was built

- **Server (Task 1).**
  - `QUICK_MESSAGES` lists the UI-SPEC's twelve ids in palette order. The client frame `chat { msg }` is a strict object with an enum, so free text, numbers, extra keys and a sender field are all refused as bad-frame.
  - `chat.ts` refuses an unseated sender and answers the fourth message within 5 s with `rate`, to the sender only, keeping nothing. An accepted message goes to everyone online at the table as `chat { from, msg, at }`; `from` comes from the person record. The table keeps the newest 30, and every welcome carries them.
  - The per-person times live in the snapshot (`chatTimes`, server-only, pruned to the window).
  - The leak property now sends bursts of four messages in its noise step, and counts both chats and rate refusals, so it cannot pass vacuously. The oracle requires a chat frame to be exactly `{ t, from, msg, at }`.
- **Sending (Task 2).**
  - `i18n/fr/messages.ts`: the phrases, the emoji glyphs and their spoken names (« rire », « applaudissements », « surprise », « cheval », « cœur »), « Envoyer : … », « Derniers messages », « Toi », the empty line and the rate toast, in the phase-1 typography.
  - `MessagesSheet`: 44 px pill chips with a 2 px cream outline that wrap in two rows, a row of five 44 × 44 emoji chips, then the newest five history rows. Emoji rows show the glyph and say its name.
  - `MessagesButton` (`message-circle`, « Messages », `aria-keyshortcuts="M"` and a KeyHint in the game) sits in three places: in the waiting room after « Réglages », in the phone's right strip in the slot « Avance rapide » had, and on the bar's fourth row next to « À la table ». « Avance rapide » is hidden online, and the session no longer applies its setting online.
  - The connection keeps `chat`: the welcome's list, then each chat frame. `Table.svelte` shows the rate toast.
  - REQUIREMENTS.md: NET-05 is reworded, and the Out of Scope row « Discussion vocale » now reads « Les messages rapides suffisent ».
- **Bubbles (Task 3).**
  - `bubbles.ts` places a bubble from the rider's box on screen (`riderRect` = `riderBox` scaled, turned on the side seats). It sits on the side facing the middle, 4 px plus the 8 px tail from the rider, centred, inside the board. It slides 2 px at a time along the edge to the nearest spot clear of every control; another bubble is avoided only where the board leaves room.
  - `ChatBubbles` handles the life of each bubble: 4 s, replaced per seat, several seats at once, the name line for the others. It follows the UI-SPEC look: cream, walnut text, the seat colour's border, radius 12, a sharp 2 px shadow, at most 160 px wide. Motion is 150 ms in (fade and a scale from the tail) and a 150 ms fade out, with fades only under reduced motion.
  - Bubbles use `pointer-events: none` and `aria-hidden`. One polite live region reads the messages. Nothing is shown for a message that arrives while the tab is hidden.
  - In the waiting room the same component centres the bubble above the sender's tile, tail down.

## Screenshots (looked at)

Taken by `messages.spec.ts` with `TOC_SHOTS`, against `wrangler dev`:

- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-08-bulle-1280x800.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-08-bulle-844x390.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-08-feuille-1280x800.png
- /tmp/claude-0/-home-user-toc/56a8819d-10ff-53d6-a8b8-1a5b329104a5/scratchpad/shots/02-08-feuille-844x390.png

What they show:
- **The bubble (Bruno's screen):** « Ana / Aïe ! » stands just left of Ana's blue rider, with a blue border and the tail pointing at the rider. On the phone it covers one yellow home dot, which the UI-SPEC allows.
- **The sheet (Ana's screen):** the seven phrases on two rows, then the five emojis. On the computer « Derniers messages » shows the five rows with « Toi » in bold; at 844 × 390 the history scrolls inside the sheet, as the UI-SPEC foresaw. The « M » key hint sits on the bar's « Messages » button.

One thing was changed after looking. The first 844 × 390 sheet shot had the rate toast over the emoji row: toasts stand above sheets since 02-05, and the toast was still within its 4 s. The spec now waits for the toast to go before it takes the sheet shot; the app itself is unchanged.

## Commits

| Commit | Type | What |
|--------|------|------|
| ec2f531 | test | RED: protocol chat, table chat.test.ts, leak property bursts and oracle keys, workerd chat.test.ts |
| 6319925 | feat | QUICK_MESSAGES, chat frames, rate, welcome.chat; chat.ts in the core; oracle |
| 52d6f94 | test | RED: « M » in shortcuts.test.ts |
| e4eac97 | feat | catalogue, MessagesSheet, MessagesButton, « M », the connection's chat, rate toast, « Avance rapide » hidden online, REQUIREMENTS.md NET-05 |
| 2ef9991 | test | RED: bubbles.test.ts |
| bfa540b | feat | bubbles.ts, ChatBubbles, wired in Game and WaitingRoom |
| 7f1e288 | test | messages.spec.ts |

## Verification (exact counts)

The suites ran one after another, never at the same time.

- `pnpm typecheck && pnpm lint && pnpm test`: exit 0. svelte-check: 487 files, 0 errors, 0 warnings. Biome: 267 files. Vitest: **79 files, 1 265 passed, 2 skipped**, against 1 214 + 2 at the end of 02-07. The first gate run had one failure; see Deferred Issues.
- `pnpm exec vitest run --project worker`: 8 files, 25 passed.
- Full local Playwright (phone + desktop): **455 passed, 99 skipped, 0 failed**, the same as 02-07. This includes clavier.spec.ts and compact.spec.ts unchanged.
- Online Playwright (`playwright.online.config.ts`, all specs): **38 passed, 0 failed**: 34 before plus messages.spec.ts 4 (2 tests × phone, desktop). messages.spec.ts also passed alone three times, twice with screenshots.
- Nothing listens on port 8787 afterwards (checked in /proc/net/tcp), and no wrangler process is left.

## Deviations from Plan

### Auto-fixed Issues

**1. [Instruction] ROADMAP.md not edited**
- **Issue:** Task 2 asks to reword phase 2 success criterion 5 in ROADMAP.md, and its verify greps ROADMAP.md.
- **Fix:** the orchestrator's instructions forbid touching ROADMAP.md, so only REQUIREMENTS.md was changed. The ROADMAP wording (« Les joueurs d'une table échangent des messages rapides (phrases et émojis, sans clavier) pendant la partie. » plus the rest of the sentence) is left for the orchestrator. That part of the verify was not run.

**2. [Rule 2 - Missing] Leak instruments drive the chat**
- **Issue:** the plan names the leak property among its fails_when, but nothing in it would send chat frames.
- **Fix:** `oracle.ts` knows the chat frame and its exact keys, and `leak.test.ts` sends bursts of four messages and counts both chats and rate refusals.
- **Commit:** ec2f531, 6319925

**3. [Rule 2 - Missing] « Avance rapide »'s setting is not applied online**
- **Issue:** hiding the toggle alone would leave a player who left it on locally with fast animations online and no way to turn them off.
- **Fix:** the session applies `settings.fast` to the local controller only.
- **Files:** `session.svelte.ts`, `ActionZone.svelte` (`fastToggle`).
- **Commit:** e4eac97

**4. [Scope] Bubble against bubble at 480 × 320**
- **Issue:** at 480 × 320 the board is 351 × 175 px, and only 129 px separate the left riders from the right ones. Four 160 × 48 bubbles that each face the middle cannot all avoid each other there.
- **Fix:** controls are hard obstacles and other bubbles soft ones. The unit test and the e2e test check that every bubble stays clear of every control at all four sizes, and clear of the other bubbles at 844 × 390, 750 × 342 and 1280 × 800.
- **Commit:** bfa540b (the RED test was adjusted in it)

**5. [Scope] Bubbles under the plates**
- **Issue:** a tall plate over a small board leaves no clear spot for a bubble.
- **Fix:** bubbles are drawn under the hand and the plates, so they never cover a plate. When there is no clear spot the bubble stays by the rider, under the plate.

**6. [Rule 2 - Missing] Files outside the plan's list**
- `net/chat.ts` and `net/chat.test.ts`: the history rows and the live-region sentence, tested in Node.
- `ui/MessagesButton.svelte`: one button for its three places.
- `connection.svelte.ts`: keeps the messages.
- `Table.svelte`: the rate toast.
- `SettingsSheet.svelte`: passes `online` to the help sheet.
- `ActionZone.svelte` and `session.svelte.ts`: see item 3.
- `remoteGame.test.ts`: the welcome fixture gains `chat: []`.
- `net/remoteGame.ts`, listed in the plan, needed no change: the chat state belongs to the connection, which the waiting room uses too.

**7. [Scope] The help row « M »**
- It shows at an online table only, because the local game has no messages.

### Deferred Issues

- One failure in the first `pnpm test` gate run: `apps/worker/test/leak.test.ts` « timed out waiting for jaune's events after its act ». It is a wall-clock bound that this plan does not touch. The worker project passed alone (25/25) and the full gate rerun was green. It matches 02-07's unidentified first-run failure.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model:
- **T-02-33:** only the twelve ids are accepted (zod enum); the text comes from the catalogue as Svelte text nodes, and `no-raw-html.test.ts` passes.
- **T-02-34:** 3 per 5 s per person on the server clock, only seated senders, the 4096-character frame cap unchanged.
- **T-02-35:** `from` is the sender's seat from the person record; the frame carries none (a `from` key is refused).
- **T-02-SC:** no package added.

## À confirmer par Romain

- **😂 with the emojis:** D-13 lists 😂 among the phrases; it sits first in the emoji row (UI-SPEC).
- **No sound** for a received message, and no messages on the end plank.
- **« Avance rapide » online:** hidden, and the setting does not apply online (the server sets the pace).
- **Four bubbles on a very small phone** (480 × 320): they never cover a card or a button, but they may overlap each other.
- **Unseated people in the waiting room** see no « Messages » button until they take a seat.

## Self-Check: PASSED
