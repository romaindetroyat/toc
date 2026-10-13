# Project Research Summary: TOC en ligne

**Researched:** 2026-10-13
**Confidence:** MEDIUM overall. HIGH on the project's own rules and on Durable Object patterns. LOW on board geometry until it is measured. LOW-MEDIUM on audio sourcing and iOS behaviour until device-tested.

## Executive Summary

TOC en ligne is a private family-and-friends adaptation of a French 4-player, 2-team card game. All four research files agree on the shape:

- Build it server-authoritative.
- One pure deterministic rules engine is shared by the server, the client preview and the bots.
- One Durable Object per table, with hibernating WebSockets.
- Each seat receives its own projection, so hidden hands never leave the server.
- An ordered event stream drives history, the client animation queue and sound.

Recommended stack:

- **Repo:** TypeScript pnpm monorepo, with a pure `packages/engine`.
- **Client:** Svelte 5 + Vite 8 SPA (no SvelteKit), with a hand-drawn SVG board.
- **Server:** a Worker on Hono that serves the app and routes `/api` and `/ws`, plus a raw SQLite-backed Durable Object per table.
- **Data and auth:** D1 + Drizzle for accounts, friends and finished-game summaries. better-auth with passkeys plus email OTP.
- **Animation and sound:** the Web Animations API. A ~150-line Web Audio module keeps hoof cadence on the audio clock.
- **PWA:** vite-plugin-pwa in `injectManifest` mode with prompt-to-update.
- **Rejected:** PartyKit and PartyServer.

The main risks are in the rules engine and in unresolved house-rule interpretations, not in infrastructure. Mitigations:

- a signed-off, numbered RULES spec before coding;
- a per-pawn progress model;
- property tests;
- a payload leak scanner.

The infrastructure risks (hibernation, alarms, reconnect desync, iOS audio, iOS PWA login) have known fixes. They must be designed in from the start and tested on real devices.

## Key Findings

### Stack

- **TypeScript:** STACK lists 7.0.2 as latest but recommends ~5.9 for tooling compatibility. Decide at scaffold. Node 22 LTS, pnpm 10.x workspaces.
- **Client:** Svelte 5.57 + Vite 8.3 + @sveltejs/vite-plugin-svelte 7.3, chosen over React and Solid for bundle size and SVG fit.
- **Hosting:** Cloudflare Workers + Static Assets, Wrangler 4.149, @cloudflare/vite-plugin 1.63.
- **Durable Objects:** SQLite-backed, with the WebSocket Hibernation API. Alarms for all timers, never `setTimeout`.
- **Data:** Hono 4.13, D1, Drizzle 0.45.x (not the 1.0 beta).
- **Auth:** better-auth 1.7.7 + @better-auth/passkey + email OTP. Fallback: hand-rolled sessions + SimpleWebAuthn.
- **Protocol:** Zod 4, shared in `packages/protocol`.
- **Audio:** hand-rolled Web Audio. No Howler, Tone.js or GSAP. Motion is optional.
- **Testing:**
  - Vitest pinned to 4.1, because 5.x breaks @cloudflare/vitest-pool-workers 0.23.
  - pool-workers 0.23 and fast-check.
  - Playwright 1.64, with four browser contexts as four players.
  - Biome and svelte-check.
- **Client socket:** partysocket 1.3, client side only.
- **Domain:** passkeys are bound to the production domain (RP ID). Choose the custom domain before Phase 4.

### Features

**Table stakes (v1):**
- Rules and play:
  - a server-authoritative engine;
  - legal-move highlighting computed by the server;
  - tap a card, then a target, with a move preview and a confirm step (no undo after submit);
  - a guided stepper for the 7;
  - the partner card-exchange flow;
  - hidden hands.
- Connection: pause on disconnect, with reconnect and a maximum delay.
- People and tables:
  - accounts, friends, and an invite link or code;
  - a lobby with seats and teams;
  - bots at levels 1 to 5, and solo play (1 human + 3 bots).
- Look and feel:
  - board, pawns, animation and sound, with mute and reduced-motion settings;
  - text chat and quick reactions.
- Tracking: resume suspended games, history, per-player and team stats, and a friends leaderboard.
- Help and access: French rules help, and baseline accessibility (seat markers that do not rely on colour, 44 px tap targets).
- App: an installable PWA with an offline shell.

**Differentiators (v1.x or late v1):**
- replays and highlights (build the event log in v1);
- a hint button using the L5 bot;
- bot takeover of an absent seat;
- house-rule toggles for the host;
- redacted spectating;
- Web Push (iOS 16.4+, installed PWA only);
- an interactive tutorial.

**Defer (v2+):** offline solo with the client-side engine, cosmetic themes, season views.

**Anti-features:**
- post-submit undo;
- strict timers with auto-play;
- public matchmaking;
- voice chat;
- a global Elo ladder;
- an arbitrary rule editor;
- client-side validation as source of truth;
- sending other players' hands to clients.

### Architecture

**Dependency rule:** the engine depends on nothing. Bots depend on the engine, the protocol depends on engine types, and the worker and web app depend on all of them.

**Engine API:** `newGame`, `legalActions(view, seat)`, `apply(state, action) -> {state, events}`, `viewFor(state, seat)`, `redact(events, seat)`, `replay`. The PRNG state lives inside the game state. `Date.now` and `Math.random` are only used in the Durable Object shell and in the client.

**TableDO:**
- Hydrates from SQLite in its constructor.
- Validates each action against `legalActions`.
- Writes the snapshot and the event row in one SQLite transaction.
- Broadcasts per-seat redacted events, numbered with `seq`.
- Keeps timers as a persisted deadline table on a single alarm, with idempotent handlers keyed by `seq`.
- Runs bots inside the Durable Object, on a `PlayerView`, with a time budget.
- Writes a D1 summary at game end, retried from the alarm.

**Client:**
- Keeps a `serverView` (immediate, used for logic) and a `renderState` (advanced only by the animation Director).
- Input is blocked until the animation queue drains.
- Reconnects with `lastSeq`. A full sync fast-forwards without animation.

**Board:** the topology lives in the engine (72 ring squares, exits, entries, homes, stables). Pixel positions live in `layout.json`, in 2560×2560 space, produced with a calibration tool.

**Persistence:**
- **DO SQLite:** live state, event log, timers, chat.
- **D1:** accounts, sessions, friends, invitations, table directory; plus finished games, stats and compressed logs as a blob.
- **KV:** not used, because KV does not guarantee read-after-write.

**Build order (from ARCHITECTURE):**
1. Topology and layout.
2. Pure engine.
3. Local playable prototype with animation and sound.
4. TableDO, protocol and Worker gate with dev auth.
5. Accounts, friends, lobby, PWA shell.
6. Bots L2 to L5 and self-play (in parallel from step 4).
7. History, stats, resume, replay.
8. Hardening.

### Pitfalls (top ones, with prevention)

1. **Position-based pawn model.** Use a signed progress value per pawn and derive squares from it. One `path()` function serves blocking, captures, the 7, highlights and animation.
2. **The 7 split.** Do not evaluate it greedily or pawn by pawn.
   - Model it as an ordered (pawn, steps) plan that sums to exactly 7, enumerated by DFS and validated atomically.
   - Property-test that the move generator equals the validator.
3. **Start-square protection applied inconsistently across cards.** Centralise `isProtected` and `blocksPath`. Build a card-by-situation test matrix and review it with Romain.
4. **Ambiguities baked in silently.** Write a numbered RULES spec before the engine and use config flags. A "TODO ask Romain" is a blocker.
5. **Hidden-information leaks.**
   - Only `viewFor` and `redact` output reaches sockets. Shuffle with `crypto.getRandomValues` and Fisher-Yates.
   - Run a leak scanner in CI over every message type, including reconnect snapshots.
6. **Hibernation and alarm misuse.**
   - No state in instance fields and no `setTimeout`.
   - A single alarm on a persisted deadline queue, with handlers idempotent by `seq`.
   - Test by rebuilding the object between messages.
7. **Reconnect desync and duplicates.**
   - `seq` on events; action id plus expected `seq`; one socket per user per table.
   - Backoff with jitter, and `setWebSocketAutoResponse` for ping.
   - Resync on `visibilitychange` and `online`.
8. **iOS audio and PWA limits.**
   - Unlock a single AudioContext inside a gesture, and resume it on visibility change.
   - Ship AAC/M4A with an MP3 fallback, never Ogg alone. Schedule on the audio clock.
   - The game must be fully playable muted.
   - Auth must not rely on a link that opens Safari instead of the installed PWA.
   - Test on a device matrix.
9. **Bot quality and cost.**
   - Define levels by capability, and check that strength rises with each level in a self-play harness.
   - Bots use the same move generator as the validator.
   - Hard time budget with a fallback move.
10. **Board geometry.** Use a canonical 0..71 index. Test invariants (starts are 18 apart, entry = start − 2). Calibrate once and store normalised coordinates.

Also:
- **SVG performance:** pre-baked shadows, transform-only animation, responsive images.
- **Sound licensing:** keep a provenance manifest.
- **Service-worker version skew:** send a protocol version in the hello message, prompt to update, and never cache `/ws` or `/api`.

## Implications for Roadmap (provisional phases)

**Phase 0: Rule decisions and board geometry.**
- A signed-off RULES.md, numbered, with one scenario per rule.
- A calibration tool, and a `layout.json` verified on the four quarters.
- Avoids pitfalls 3, 4 and 10.
- Needs a decision session with Romain. Geometry is LOW confidence.

**Phase 1: Pure rules engine.**
- Progress model.
- Deck and deal (5/4/4, reshuffle, dealer rotation) and the card exchange.
- Legal moves for every card, including 7 plans, the Jack and the backward 4.
- Exit blocking, exact-count home entry, and the dead-hand state machine.
- Controlled pawns for a finished player, the win condition, events, `viewFor`/`redact`, and replay.
- fast-check invariants:
  - all 52 cards are conserved;
  - no two pawns share a square;
  - a 7 always sums to 7;
  - every deal terminates.
- Avoids pitfalls 1, 2, 3, 5 and 6. Standard pattern.

**Phase 2: Local playable prototype with animation and sound.**
- SVG board and pawns, with the animation Director.
- Hot-seat play with local L1 bots.
- Web Audio hoof cadence, with synthesised fallback sounds.
- Mute and reduced-motion settings, and fast-forward when the tab is hidden.
- Validates the event contract before the network exists.
- Avoids pitfalls 12, 13, 19 and 20. Needs a spike on CC0 hoof and neigh sounds, with synthesis as the fallback.

**Phase 3: Authoritative table server (single table, dev auth).**
- TableDO with hibernation, a snapshot-plus-log transaction and the deadline queue.
- hello/sync with `lastSeq`, and seat binding at WebSocket upgrade.
- Pause on disconnect, and L1 bot seats.
- Zod protocol and the leak scanner.
- Worker gate with an Origin check and a socket ticket.
- Avoids pitfalls 6, 7, 8, 9, 10, 16 and 18.
- Research first: current Durable Object limits and billing, the WebSocket billing ratio, alarm semantics.

**Phase 4: Accounts, friends, lobby, PWA shell.**
- better-auth with passkey plus email OTP, on Drizzle and D1.
- Friends by code or link.
- Lobby with seats and teams, a bot level per seat, and solo creation.
- Manifest and icons.
- An `injectManifest` service worker that never caches the API and prompts to update.
- Login tested from a cold-started installed PWA.
- Avoids pitfalls 14, 16 and 17.
- Research first: the better-auth passkey import path and D1 setup, the email provider, the domain.

**Phase 5: Bots L2 to L5 and self-play harness.** Can run in parallel with phases 3 and 4.
- L2 and L3 are heuristic.
- L4 is partner-aware, including the card exchange.
- L5 is determinised, with a time budget and a fallback move.
- `tools/selfplay` measures win rates and decision times.
- A human-like thinking delay runs through alarms.
- Avoids pitfalls 15 and 5. Needs profiling of the L4/L5 budget inside the Durable Object.

**Phase 6: History, stats, resume, replay.**
- Suspend and resume.
- An idempotent end-of-game summary written to D1.
- History, stats and a friends leaderboard.
- Replay and highlights, reusing the animation Director.
- Every game records `rulesVersion` and `schemaVersion` (pitfall 11). Standard patterns.

**Phase 7: Hardening, accessibility, release.**
- Device matrix: installed PWA, Safari, ringer on and off, lock and unlock, airplane mode.
- Performance on a throttled mid-range Android phone and an older iPhone.
- Chat rate limits.
- Tests that kill the Durable Object and simulate reconnect storms.
- Accessibility audit and an ASSETS-LICENSES.md audit.
- Optional: Web Push and spectating.
- Avoids pitfalls 13, 14, 17, 18, 19 and 21. Needs device validation.

**Ordering rationale:**
- The engine comes first: it is the root of the dependency graph, and rule changes are cheap only before networking and UI depend on them.
- The local prototype comes before the server, to validate the event contract.
- The server comes before accounts, to prove projection and hibernation first.
- Bots run in parallel.
- History comes once the event log exists.
- Device checks come last, but are planned from Phase 2.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Versions checked on npm. Auth packaging and TypeScript 7 tooling to confirm |
| Features | MEDIUM | Rules HIGH. Competitor claims come from training knowledge |
| Architecture | HIGH / MEDIUM / LOW | HIGH on Durable Object and event patterns, MEDIUM on bots, LOW on geometry |
| Pitfalls | MEDIUM | Rules and hidden-information items HIGH. Platform items are tagged [VERIFY] in PITFALLS.md |

### Gaps to Address

- **Disconnect policy after the maximum delay.** The sources differ:
  - ARCHITECTURE: a configurable 5 minutes, then a bot takes over.
  - FEATURES: the host chooses between waiting, a bot, or saving.
  - PITFALLS: a bot for the rest of the deal.

  Working default: a bot takes the seat for the rest of the deal and the human reclaims it at the next deal. Romain sets the duration.
- **Bot CPU budget:** STACK proposes ~150 ms for L4 and 400–800 ms for L5. PITFALLS proposes 20–50 ms. Profile in Phase 5.
- **Bot level ladder:** it differs slightly between files. Adopt ARCHITECTURE's ladder and validate it with self-play.
- **Sign-in:** passkeys plus email OTP. No PBKDF2 passwords, which are CPU-constrained on Workers.
- **Email provider:** Resend, or Cloudflare Email Service if it is available.
- **Audio:** no CC0 neigh is confirmed yet. Run a spike, fall back to synthesis, and log every file in ASSETS-LICENSES.md.
- **Cloudflare free-plan numbers:** they come from secondary sources. Re-read the official limits before any Phase 3 capacity claim.
- **Device tests needed:** iOS audio, background WebSocket, Web Push, wake lock.

## Open Questions

Deduplicated. Resolve them with Romain before the engine is frozen. The working assumption is in brackets. Each becomes a config flag with tests for both outcomes.

**From PROJECT.md:**
1. With the 7, can a pawn pass its own pawns without eating them? [yes]
2. Can the backward 4 enter the home column from the exit square? [no; entry only forward]
3. Must a pawn complete a full lap before entering home? [yes]
4. What is the maximum disconnect pause, and what happens after it (does a bot take over)? [bot for the rest of the deal, reclaimable at next deal; duration TBD]

**Raised in research:**
5. Is the card exchange done once per deal (5/4/4), or once per 52-card cycle? [per deal]
6. Does the exchange still happen when a hand is about to be discarded, or for a player with all pawns home? [exchange still happens; a dead hand is discarded after]
7. Does the exchanged card count toward the 5-card deal? [deal size counted before exchange]
8. Is the exchange made before or after looking at the dealt hand? [hand shown first]
9. Is the deal sequence 5, 4, 4 then reshuffle, and does the dealer rotate per hand or per cycle? [5/4/4 per cycle; dealer rotates per cycle]
10. Can the Jack swap two of the player's own pawns? [allowed by the rules, bots never choose it]
11. Can the Jack swap a pawn in the stable or in the home column? [no]
12. If the only possible Jack target is an opponent on its protected start square, is there no legal target? [yes, no target]
13. Does an Ace or King exit onto an opponent pawn parked on your start square capture it? [yes, if not protected]
14. Is the exit square protected for any pawn, or only for the owner's pawn on its own start square? [owner's only; ARCHITECTURE implies any: decide]
15. Does a player's own pawn on its start square block that player's second exit? [yes]
16. For a finished player, does the 5 apply to the partner's pawns? [yes]
17. For a finished player moving the partner's pawns, which pawns count as "own" for the Jack and for captures? [controlled pawns count as own for that turn]
18. Can a pawn at progress 0 (still on its start square) play the backward 4? [yes]
19. If the 7 cannot be spent in full, is it unplayable or can it be partly spent? [unplayable as a whole]
20. Is playing a legal card mandatory, or can the player discard voluntarily? [mandatory; no voluntary discard]
21. Is the dead-hand discard automatic after a visible pause, or does it need confirmation? [automatic, cards shown face up]
22. Does the disconnect pause also apply during the exchange, the dead-hand discard and bot turns? [yes, all phases]
23. Can a 7 capture the partner's pawns like opponents' pawns? [yes]
24. Does the team win at 8 pawns home, after which the game stops prompting the finished partner? [yes]
25. Are played cards public and held cards private (for bot card counting and hand-size display)? [yes]

**Product and infrastructure:**
26. Any house-rule toggles for the host in v1, beyond the open questions? [none]
27. Can a bot takeover be reversed, and when: at the next deal, or immediately? [reclaim at next deal]
28. Reshuffle every cycle, with the seed kept server-side only? [yes]
29. Is the board fixed, or rotated toward the local player, in v1? [fixed]
30. How long is chat kept after a game ends, and when is it purged? [until table purge, about 24 h after finish; 60 days when suspended]
31. Which custom domain for passkeys and email? Decide before Phase 4.
32. Which email provider for OTP and magic links? [Resend unless Cloudflare Email Service is available]
33. Web Push in v1, or deferred? [deferred to v1.x]
34. Is a second language planned? [no; French only]

## Sources

- `/home/user/toc/.planning/PROJECT.md` (HIGH)
- npm registry checks of package versions on 2026-10-13, as cited in STACK.md (HIGH)
- Cloudflare Durable Objects docs (hibernation, alarms, SQLite storage), as cited in ARCHITECTURE.md (HIGH on patterns; limits and billing to re-verify)
- Cloudflare pricing and changelog through secondary snippets (MEDIUM)
- better-auth third-party summaries (MEDIUM; verify on better-auth.com)
- Apple and WebKit behaviour from training knowledge (MEDIUM; verify on device)
- Game-AI literature: Cowling, Powley and Whitehouse 2012 (ISMCTS); Long et al. 2010 (PIMC) (MEDIUM)
- Competitor product knowledge (MEDIUM; not re-checked)
- Audio sources: Freesound, OpenGameArt, Kenney, Mixkit, Sonniss (LOW; check licences file by file; no CC0 neigh confirmed)

---
*Research completed: 2026-10-13*
*Ready for roadmap: once Open Questions 1–25 are answered or defaulted*
