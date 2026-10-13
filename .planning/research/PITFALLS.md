# Pitfalls Research

**Domain:** Real-time multiplayer card-driven board game (TOC / Tock / Dog variant) as a PWA on Cloudflare (Workers + Durable Objects + D1), with animated SVG pawns, Web Audio effects and computer players
**Researched:** 2026-10-13
**Confidence:** MEDIUM. Rules-engine, hidden-information, animation and bot findings are HIGH (they follow from the project's own rules). Platform findings (Durable Objects, iOS/Safari, Workers auth) come from established platform behaviour and training knowledge, not live-verified in this session. Every item tagged `[VERIFY]` must be re-checked against current Cloudflare/WebKit docs during that phase's own research.

**Phase naming used below** (provisional, the roadmap may rename or split them):
- P1 Rules engine and board geometry (pure TypeScript, no I/O)
- P2 Table server (Durable Object, protocol, persistence, reconnect)
- P3 Client rendering and animation (SVG board, pawns, event queue)
- P4 Audio
- P5 Computer players
- P6 Accounts, friends, stats, history
- P7 PWA hardening and release (service worker, iOS, wake lock, licences)

---

## Critical Pitfalls

### Pitfall 1: Modelling pawns by board position instead of by progress

**What goes wrong:**
The engine stores each pawn as "square 0..71 + in-home flag". The backward 4, the exact-count home entry, the "must have completed a lap" rule, the 7 split and the Jack swap then each need their own special cases, and they contradict each other. Examples: a pawn that has just left its start square and plays a 4 lands on square 68, two squares before its own start. Square 70 (the "16" square, home entry, two squares before the pawn's own start) is then ambiguous: is the pawn "at the entry" or "at the beginning"? Does the next forward move turn into the home, or does it stay on the ring?

**Why it happens:**
The board is drawn as a ring, so the ring index feels like the natural state. The home column is then bolted on.

**How to avoid:**
Store a signed progress counter per pawn (stable = null, ring = -k..+70, home = 71..74 or equivalent). Derive the board square from `(startIndex[color] + progress) mod 72`. Entering the home is only possible by crossing from progress 70 to 71+ going forward. Backward moves just subtract. This makes "full lap required", "exact count", "backward 4 from start never enters the home" and "do not jump over a pawn already home" structural rather than special-cased. Keep a single function `path(pawn, steps, direction)` that returns the ordered list of squares/progress values crossed, and use it for all of: blocking, capture along the path, 7 splits, highlighting and animation. Animation consumes the same path, so the pawn walks exactly the squares the rules engine considered.

**Warning signs:**
Separate code paths for "normal move", "7 move" and "4 move". Bugs that appear only near squares 16, 17, 18. A pawn that skips the home entry after a backward 4.

**Phase to address:** P1.

---

### Pitfall 2: The 7 split implemented as greedy or sequential-per-pawn instead of exhaustive and atomic

**What goes wrong:**
Typical failures:
- Only offers "all 7 on one pawn" or "first pawn then second pawn" and misses legal splits across 3 or 4 pawns.
- Validates each partial move independently, so a split that is illegal as a whole (the second part is blocked by the first part's new position, or the last part cannot be completed) is accepted halfway, leaving the player with fewer than 7 steps played.
- Captures along the path are applied immediately on the first partial move and are then not rolled back when the split turns out to be impossible.
- Forgets that the order of the parts matters: moving pawn A 3 then pawn B 4 differs from B first, because A may capture or block B's route.
- Forgets that a pawn on its own start square (the "infranchissable" square) blocks the route of both opponent and own pawns mid-split, and that the pawn that just left a start square un-blocks it for the next part.
- Home entry: in the home column a pawn cannot pass another pawn already home, and the remaining steps must be spent exactly. A split that only works by "overshooting" is illegal.
- A split where the player cannot spend all 7 steps must be illegal as a whole, which can make the whole 7 card unplayable. Many implementations accidentally allow partial play.

**Why it happens:**
The 7 is the one card that makes a move a sequence rather than a single transition. Rule text says "mange tout pion qu'il dépasse", which is path-dependent.

**How to avoid:**
Model a 7 turn as an ordered list of `(pawn, steps)` micro-moves that sum to exactly 7, applied to a cloned state in sequence, each micro-move validated with `path()`; the whole list is valid only if every micro-move is valid and the sum is 7. Generate legal splits by DFS over (remaining steps, state) with memoisation on the state hash. Branching is small (at most 4 pawns, 7 steps) so exhaustive enumeration is cheap (a few thousand nodes). The client sends the complete plan in one message, the server validates it atomically, then emits one event per micro-move so the animation can show each. For the UI, build the split interactively (pick pawn, pick steps, repeat) but validate "can this partial plan still be completed to exactly 7" at every step, and show a live remaining-steps counter. Add an undo for unsent partial plans. Write property tests: for random states, every plan produced by the generator is accepted by the validator and vice versa, and the total step count is always 7.

**Warning signs:**
A test list of 7 scenarios that all use a single pawn. "Stuck" players who have a legal split the UI never offers. A captured pawn that reappears after an aborted split.

**Phase to address:** P1 (engine and tests), P3 (interactive split UI), P5 (bots must enumerate the same plans).

---

### Pitfall 3: Start-square protection rules applied inconsistently across all card types

**What goes wrong:**
The house rule says a pawn on its start square (diamond 18) cannot be passed, captured or swapped. Typical misses: protection forgotten for the Jack, for the backward 4 (moving back through a start square occupied by its owner), for the 7 mid-split, for the exit from the stable (an Ace/King exit onto your own start square when an opponent's pawn is parked there, which is allowed to capture it only if that pawn is not on *its own* start square; and a pawn of your own on your start square blocks exiting a second pawn). The protection must also apply to the partner's pawn on the partner's start square. And protection applies only to the owner's own start square, not to whichever start square a pawn happens to stand on: an opponent pawn standing on your start square is not protected and is captured by your exiting pawn.

**Why it happens:**
The protection is checked in one place (forward move) and not in the shared `path()` or in the Jack target filter.

**How to avoid:**
Put all protection logic into two shared predicates, `isProtected(square, state)` and `blocksPath(square, mover, state)`, and use them from every card handler, the bot, the highlighter and the animation planner. Decide and write down in the rules spec each open interpretation (see Pitfall 4). Build a table-driven test matrix: rows = cards (A, K, 4, 5, 7, Jack, other numbers), columns = situation (own pawn on start, opponent on its start, partner on its start, opponent parked on your start, pawn that just exited this turn), with an expected result for each cell. Review the matrix with Romain.

**Warning signs:**
Rule checks duplicated per card. A bug report of the form "I jumped over a pawn that was on its start square".

**Phase to address:** P1.

---

### Pitfall 4: Unresolved rule ambiguities silently baked in as code

**What goes wrong:**
PROJECT.md already lists open questions. Several more are implicit and will be decided by whoever writes the code first, invisibly. Candidates beyond the four already listed:
1. Card exchange: once per deal (every 5/4/4 hand) or once per full 52-card cycle? Is it also done when a hand is about to be discarded? Does a player whose pawns are all home still exchange? Does the exchanged card come before or after the dealt hand is looked at?
2. Jack: can a player swap two of their own pawns (legal but useless, and pointless for bots to pick)? Can a pawn in the home column or in the stable be swapped (assume not)? What if the only legal swap target would be the player's own pawn and an opponent's protected pawn?
3. Ace and King exit: an exit onto a start square occupied by an opponent pawn that stands there (not protected) captures it; confirm.
4. 5 for a finished player: "only own pawns" now means the partner's pawns being controlled. And when a finished player plays a Jack, which pawns count as "their own"?
5. Can a pawn that has not left the start square (progress 0) play the 4 backward? (The engine will say yes; confirm with Romain.)
6. Is a 7 whose full amount cannot be spent unplayable, or can it be partially spent? Assume unplayable.
7. Obligation to play: when any legal card exists, must the player play one? (Standard Tock: yes.) Can the player elect to discard anyway? Assume no.
8. Does the pause for a disconnected player apply to the partner exchange, the discard-everything case, and bots' turns?
9. The 52-card deck deals 20 + 16 + 16 = exactly 52 cards over three deals before a reshuffle. Confirm the sequence is 5/4/4, reshuffle, and the dealer rotates after each hand or each cycle.

**Why it happens:**
House rules were explained to the developer in prose, edge cases never arise until a test or a playtest hits one.

**How to avoid:**
Before P1 coding, produce a `RULES.md` (French-readable) with a numbered rule for each item above and a test scenario per rule. Romain signs off. Encode each decision as a named constant or a `rulesVersion`-gated branch so changing an interpretation later is a one-line change plus a migration decision for stored games (see Pitfall 11). Treat any `TODO: ask Romain` found in code review as a blocker.

**Warning signs:**
Tests that assert behaviour nobody can point to a rule for. Different answers from the bot, the highlighter and the validator for the same position.

**Phase to address:** P1 (before any code), revisit at P5 when bots expose odd cases.

---

### Pitfall 5: "Finished player plays partner's pawns" breaks ownership assumptions everywhere

**What goes wrong:**
Once a player's four pawns are home, they play the partner's pawns. If code identifies "my pawns" by seat/colour, then the 5 ("own pawns only"), the Jack ("one of your pawns"), the capture rule ("never your own pawns, but partner's yes") and the highlighter all misbehave. Specific failures:
- The 5 lets the finished player advance an *opponent* pawn, or refuses to advance the partner's pawns.
- The controlling player captures the partner's pawn from the pawn they are controlling (own-team capture) when they should not, or vice versa.
- The seat order and "whose turn" logic assume the player owns pawns; a finished player with a dead hand is processed as a dead hand every time.
- Win detection checks only the 8 pawns at home; an off-by-one marks the team as winner only when all 8 are in, but the game continues to prompt the finished partner.
- Reverse case: the partner finishes while the first player still has pawns; the first player's partner now has nothing to control.

**How to avoid:**
Introduce one concept: `controlledPawns(playerSeat, state)`: own pawns if any are not home, else the partner's. Use it for the 5, the Jack, the 7, move generation, bot input and UI selection. Capture rule is by *team* membership relative to the *mover's own colour*: define it explicitly: "mover cannot capture a pawn of the colour that is currently being moved by themselves, but captures the partner's other-colour pawns and all opponents' pawns", and verify with Romain whether a finished player moving the partner's pawn may capture the partner's other pawns (most natural reading: the partner's pawns are "own" for that player, so no). Add scenario tests for finished-player turns for every card.

**Warning signs:**
Late-game bugs only reproduced in long simulated games. Seat-based `pawn.owner === player.seat` comparisons spread across the codebase.

**Phase to address:** P1; simulate 10,000 bot games in CI to flush these out (P5).

---

### Pitfall 6: "No legal move" computed wrongly, or the discard step broken

**What goes wrong:**
- The hand is declared dead when only the simple cases were checked (forgetting the 7 split, the Jack swap, the 4 backward, an exit with Ace/King), so a player is forced to throw away a playable hand. The opposite also happens: the engine allows a card that is only "legal" because of a bug and the game never reaches the discard rule.
- The discard exposes the hand. In the physical game, discarded cards are laid face up, which is information that must be broadcast; but only at that moment, and cards still held must remain hidden.
- Partner-card exchange interacts with discarding: the player discards, then the turn rotates, and the exchange in the next deal gives them a fresh card. The state machine forgets who is still holding cards, so the turn order loops forever or skips someone.
- All four players dead simultaneously: the engine waits for a next deal that never comes because the deck logic assumes at least one card played per round.
- The deal ends when all hands are empty; a dead player who "waits for the next deal" must be skipped without blocking the table.

**How to avoid:**
Derive `legalMoves(state, seat)` once from the same generator used by the validator (never a separate "can the player move?" heuristic). Dead hand = `legalMoves` empty *for every card in hand*. Model the deal as a state machine: `DEALING -> EXCHANGE -> PLAYING(turnSeat) -> DEAL_END`, with explicit transitions `PASS_DEAD_HAND` that emit a `HandDiscarded(seat, cards)` event, and test that a table with all four hands dead advances. Add a watchdog invariant check: a deal always terminates within N turns.

**Warning signs:**
A stuck table in simulation. A player who sees "no move" with a Jack in hand.

**Phase to address:** P1 (state machine and generator), P2 (discard event wiring).

---

### Pitfall 7: Hidden-information leaks to clients

**What goes wrong:**
Hands are hidden from other players, yet the whole game state is broadcast to every WebSocket, or the full deck order, or other players' legal-move highlights, is sent so the client can "just render". A player opens the browser dev tools, or the leak is accidental: the snapshot sent on reconnect contains all hands; chat or debug logging includes state; the server sends `legalMoves` for the seat currently on turn to everybody; the partner-exchange card is visible in the event stream (the receiving player's event contains the sender's card before the exchange is revealed); bots decide with perfect knowledge of hidden hands, which looks like cheating to attentive players.

Subtler leaks:
- Counting cards: sending the draw pile as an ordered array, rather than as a count.
- Timing: bots instantly responding when they have a trivial hand vs. long delays when they have a complex hand reveals information to the team partner who is human.
- The exchanged card: the sender must not learn what they receive until the exchange is complete; the receiver must not see the card before sending their own, otherwise a player can adapt.
- Discarded hands are public, but cards the player kept are not.

**How to avoid:**
Make the authoritative state server-only and compute a per-seat projection `viewFor(seat, state)` that is the *only* thing ever serialised to a socket. Events likewise: emit per-recipient variants (`CardPlayed` is public once played; `CardDealt` only to the recipient, with counts for the others). Never ship the deck, the seed, or other seats' hands, even "encrypted". Shuffle server-side with `crypto.getRandomValues` and a Fisher-Yates (never `sort(() => Math.random() - 0.5)`). Spectators receive the public projection. Bots run on the server with the same projection plus determinisation (Pitfall 15). Add a test that serialises each projection and asserts no forbidden card ids appear anywhere in the JSON (a "leak scanner" over the payload, run in CI against every message type). Use random delays for bot thinking, independent of hand complexity.

**Warning signs:**
The client has a `state.hands` field. Network tab shows 4 hands. Messages are broadcast with `ws.send(JSON.stringify(state))` in a loop over sockets.

**Phase to address:** P2 (projection architecture, must exist before any client is written), P5 (bot information set).

---

### Pitfall 8: Durable Object hibernation loses in-memory state

**What goes wrong:**
With the WebSocket Hibernation API, a Durable Object is evicted from memory after a short idle period (on the order of seconds) even while sockets stay connected, and constructed anew when the next message arrives. Anything held only in instance fields (the game state, the current turn timer, a `setTimeout`, a Map of socket to seat) is gone. Symptoms: a table that works in local dev (`wrangler dev` does not hibernate the same way) and goes wrong in production after 10-30 seconds of idle: the next move is rejected because state is empty; a pause timer never fires; the bot's scheduled move disappears.

**Why it happens:**
Developers write the class like a long-running server. `setTimeout` also *prevents* hibernation, which makes the problem appear intermittent and the bill higher.

**How to avoid:**
Treat the DO as a stateless handler over durable storage: load state from SQLite-backed storage in the constructor (`blockConcurrencyWhile`) or lazily per message, write through after each accepted action (small state, so cheap and synchronous with SQLite storage). Per-socket metadata (seat, user id) goes in `ws.serializeAttachment()` (small, structured-clone limit about 2 KB `[VERIFY]`) and is read back with `ws.deserializeAttachment()` after wake-up; use `this.ctx.getWebSockets()` to enumerate connections. All timers (turn timeout, disconnect grace period, bot think delay) use `ctx.storage.setAlarm()`, not `setTimeout`. Test hibernation explicitly: a test that forces eviction (or simply reconstructs the class between messages) must pass. Use `setWebSocketAutoResponse` for ping/pong so keep-alives do not wake the object. Prefer the SQLite-backed Durable Object class `[VERIFY: current default and pricing]`.

**Warning signs:**
Instance fields named `this.state`, `this.sockets`, `this.timer`. Tests only run in a single process. "Works for the first minute, breaks if we pause to think".

**Phase to address:** P2.

---

### Pitfall 9: Alarm misuse (single alarm per object, at-least-once delivery, retries)

**What goes wrong:**
A Durable Object has exactly one alarm slot; scheduling a second `setAlarm` overwrites the first. A table needs several deadlines: bot think delay, turn timer, disconnect grace period, "table idle, clean up" timeout. Implementations schedule them independently and lose all but the last. Alarms are also delivered at least once and are retried with backoff if the handler throws, so a handler that applies a bot move and then throws on a later step will apply the bot move twice.

**How to avoid:**
Keep a persisted list of pending deadlines `[{at, kind, payload, id}]` in storage and a single alarm set to `min(at)`. The alarm handler pops all due deadlines, applies each idempotently (check "is this still the expected turn/sequence number?" before acting), persists, then re-arms. Every state-changing action carries an expected `seq`/turn id so a duplicate delivery is a no-op. Handle the case where the alarm fires after a human has already played (stale deadline).

**Warning signs:**
Direct calls to `setAlarm` in more than one place. Bots occasionally playing twice, or a paused game that never resumes or never times out.

**Phase to address:** P2 (deadline scheduler), P5 (bot turn scheduling).

---

### Pitfall 10: WebSocket reconnect, duplicate delivery and out-of-order actions

**What goes wrong:**
Mobile connections drop constantly (tunnel, screen lock, Wi-Fi to 4G handover). The client reconnects and either misses events (so its animation queue and state diverge) or receives the whole history again. Double tap or retry sends the same move twice and the second is applied to a different state. Two tabs of the same user both play. The user is seated twice after reconnect because the old socket has not yet timed out. Deployments (`wrangler deploy`) restart Durable Objects and drop every socket at once, so the clients all reconnect simultaneously.

**How to avoid:**
- Every server event carries a monotonic `seq`. The client keeps `lastSeq`; on reconnect it sends it, and the server replies with either missed events (small tail, kept in storage) or a full projected snapshot plus `seq`. The client replaces its state with the snapshot and *skips animations* for anything older than the snapshot (Pitfall 12).
- Every client action carries `(actionId, expectedSeq or turnId)`. The server rejects stale or duplicate actions with a typed error and re-sends the current projection.
- One live socket per (table, user): a new connection from the same user closes the older one with a close code the client understands ("replaced by another device").
- Client reconnect uses exponential backoff with jitter, resets on success, and reconnects immediately on `visibilitychange` to visible and on `online`.
- App-level heartbeat so the client detects half-dead sockets (mobile browsers often do not fire `close`).
- Gracefully handle deploys: persist before acknowledging; no in-flight state held only in memory.

**Warning signs:**
Reconnect works "most of the time". No `seq` field in the protocol. Server stores a Map of connections in memory.

**Phase to address:** P2 (protocol), P3 (client resync), P7 (mobile verification).

---

### Pitfall 11: Persisted games and rule changes: "pause and resume later" meets a changing engine

**What goes wrong:**
A saved game is stored as a state blob. A later release changes the engine (an interpretation fixed, a new field) and old games load into an inconsistent state, or an in-progress game on the server changes behaviour mid-game after a deploy. Storing only derived state (positions) without the event log also makes the history, replays and the stats impossible to rebuild.

**How to avoid:**
Store an append-only event log per game (seed-less, with the dealt cards recorded as server-private events) plus periodic snapshots. Tag each game with `rulesVersion` and `schemaVersion`; keep old rule branches until old games are finished or migrated; write a migration step for snapshots. Statistics and history in D1 are derived from game-end summaries, not from live state. Archive finished game logs (compressed) and prune; apply a retention policy so storage stays bounded.

**Warning signs:**
Snapshots without version fields. Stats computed by replaying with the current engine.

**Phase to address:** P2 (storage format), P6 (history/stats).

---

### Pitfall 12: Desynchronisation between server state and the client animation queue

**What goes wrong:**
The client mutates its displayed state as animations run, and the server pushes new state faster than animations play (bots move instantly; several events arrive at once; reconnect delivers a snapshot). Results: pawns visibly teleport, a captured pawn flashes at the destination and then returns to the stable, a Jack swap animates the wrong pawns, sounds play for events that were skipped, or the client's idea of "whose turn" lags and the player is refused a move that the server considers legal. In a hidden tab `requestAnimationFrame` stops, so the queue stalls and on return it plays minutes of backlog.

**Why it happens:**
Rendering is driven from the same object that holds truth. Animation durations (distance-dependent) are unknown to the server, so the server cannot pace itself.

**How to avoid:**
Strict separation of three layers:
1. *Authoritative state* (latest projection from the server, always applied immediately; input logic uses this).
2. *Event queue* (ordered, typed events: `PawnExited`, `PawnMoved(path)`, `PawnCaptured`, `Swap`, `EnteredHome`, `HandDiscarded`) consumed by an animator.
3. *Display state* (what the SVG currently shows), advanced by the animator; at the end of each event it must equal the state implied by that event.
The animator can fast-forward: if the queue length is above a threshold, or the tab was hidden, or a snapshot arrived, apply the end-state of queued events instantly (and play no sound). On snapshot, clear the queue and set display state = projection. Make events self-contained (carry the path and the pawns involved), never "diff the state to guess what happened". Server does not wait for animation acks (avoids a slow client stalling the table); instead the *turn input* is gated on the client side until the animation reaches an idle point, and the server enforces a minimal pacing delay for bot moves (e.g. 600-1500 ms plus an estimate of the animation). Animation duration is a pure function of the path length and card so audio and visuals agree. Use `document.visibilityState` to pause the animator and fast-forward on return. Provide a "reduced motion" setting honouring `prefers-reduced-motion`.

**Warning signs:**
Animation code that reads `state` fields to decide what to animate. A bot move sequence that looks like a glitch. "Works on desktop, janky on phone".

**Phase to address:** P3 (architecture), validated in P5 (bots stress it).

---

### Pitfall 13: iOS audio unlock, mute switch and interruptions

**What goes wrong:**
Web Audio on iOS Safari (including home-screen PWAs) starts in a suspended state and only unlocks from a user gesture (`touchend`/`click`, not `touchstart` on some versions). Common failures:
- The first sounds are silent because the context was never resumed; the first tap is consumed by a game action and no unlock is attempted.
- Sound effects work in Safari but are muted when the hardware ring/silent switch is on (Web Audio is routed as "ambient" and respects the switch; `<audio>` elements do not in the same way). Players think the app is broken `[VERIFY]`.
- After a phone call, Siri, a lock or a tab switch, the `AudioContext` goes to `suspended` or the non-standard `interrupted` state and never recovers unless resumed again on the next gesture.
- Formats: Ogg Vorbis/Opus support is inconsistent across Safari versions; shipping only `.ogg` yields silence on iPhones. Use AAC/M4A or MP3 (or WAV for tiny samples), decoded once into `AudioBuffer`s; check with the promise-based `decodeAudioData`.
- Latency and scheduling: using `setTimeout` for hoof cadence drifts and clumps when the main thread is busy. Schedule with `audioContext.currentTime`.
- Polyphony: many simultaneous `AudioBufferSourceNode`s (four hoofbeats per step on several pawns) on low-end phones cause crackling.
- Autoplay policies on desktop Chrome/Safari similarly require a gesture; the user may join a game by deep link and never click before the first event.

**How to avoid:**
Create a single `AudioContext` lazily; add a one-time "tap to enable sound" affordance (or reuse the "join table" button) that calls `resume()` inside the gesture, plays a silent buffer, and re-attempts on `visibilitychange`, `focus` and any later gesture while `state !== 'running'`. Show a visible sound on/off and a "silent switch is on" hint. Ship M4A/MP3 and decode on first unlock (not at page load); cap polyphony with a voice pool and steal oldest. Drive hoof cadence by scheduling a short series of buffers on the audio clock when a move event starts; its tempo comes from path length and card as in Pitfall 12. Make audio non-essential: the game must be fully playable muted, never `await` an audio promise in the game loop. Test on a real iPhone (installed PWA and Safari tab), with the silent switch on and off, after a lock/unlock.

**Warning signs:**
Audio only tested in desktop Chrome. Audio init at module load. No handling of `AudioContext.state`.

**Phase to address:** P4 (and P7 for physical device verification).

---

### Pitfall 14: iOS PWA limitations treated as bugs discovered late

**What goes wrong:**
- No `beforeinstallprompt` on iOS: "Install" must be explained by instructions (Share, Add to Home Screen), shown only when appropriate.
- A PWA installed to the home screen has storage and cookie jars separate from Safari. A login done in Safari (for example following an emailed magic link) does not log in the installed app. Opening an emailed link opens Safari, not the PWA.
- Web Push works only for installed home-screen apps on iOS 16.4+ and must be requested from a user gesture. Do not make "your turn" notifications a hard dependency. `[VERIFY]`
- Standalone mode drops the browser chrome: no back button, no reload gesture; the app must provide its own navigation and recover from a stuck state.
- Safe-area insets (notch, home indicator), `100vh` problems with dynamic toolbars, overscroll bounce and pull-to-refresh interfering with board gestures; double-tap zoom; text selection on long press over SVG.
- Backgrounding suspends the page and kills WebSockets within seconds to minutes; the app returns to a dead socket (Pitfall 10).
- Wake lock: the Screen Wake Lock API is released whenever the page is hidden and must be re-requested on `visibilitychange`; it can reject (low battery, policy). Historically it was unreliable in iOS standalone PWAs before about iOS 18.4, and unsupported before iOS 16.4 `[VERIFY]`. It is not worth blocking on; a game that needs the screen on for 30 seconds of waiting is better served by a "your turn" push/vibration and a quick resync.
- Storage can be evicted under pressure; do not treat IndexedDB/localStorage as the source of truth.
- Large precache sets can hit per-origin quota on iOS.

**How to avoid:**
Plan an iOS device test matrix up front (one recent iPhone installed as PWA, one in Safari, an older iOS if the family has one). Make authentication independent of link-in-email flows (see Pitfall 20). Request wake lock only while a game screen is open, re-acquire on `visibilitychange`, feature-detect and swallow failures. Treat push as an enhancement. Use `viewport-fit=cover`, `env(safe-area-inset-*)`, `touch-action`, `overscroll-behavior: none` and `user-select: none` on the board. Build an in-app "connection lost, reconnecting" state and a manual "resync" button.

**Warning signs:**
"Works in Chrome DevTools device mode." Login flow that sends the user out of the app.

**Phase to address:** P7 (with login design decided in P6).

---

### Pitfall 15: Bot AI that is too slow, too dumb, too uniform, or that cheats

**What goes wrong:**
- Too slow: exhaustive search over all plays including 7 splits and all four hands runs on the Durable Object's single thread and blocks that table's socket handling (and costs CPU time). Level 5 implemented as deep minimax or heavy Monte Carlo is unusable on a 128 MB object under a per-request CPU budget `[VERIFY]`.
- Too dumb: level 5 plays greedily (largest advance) and ignores team play, the exchange card, protecting a pawn on the start square, saving the Ace/King for exits, avoiding capturing the partner, using the Jack to rescue a pawn, or unlocking the partner's pawns. Level 1 vs 5 feel the same because "difficulty" is only randomness injected into one heuristic.
- Cheating: a bot that reads the real hands (the server has them) is detectable and unfair; a partner bot that "knows" what its human partner holds feels uncanny.
- Predictable: no variation in think time, so bots feel robotic; instant moves also desync animation (Pitfall 12).
- Bot ignores the exchange: sends a random card to the partner, which makes bots poor partners. The exchange is the most team-skill-heavy decision in the game.
- Bot unaware of the "controlled pawns" concept (Pitfall 5) and the discard rule.

**How to avoid:**
Define bot levels by explicit capability rather than raw randomness: L1 random legal move; L2 greedy (capture, progress); L3 adds safety (avoid leaving pawns capturable, protect start square use); L4 adds team play (do not capture partner, prefer helping partner's pawns, plan exits, card-saving) and a sensible exchange; L5 adds shallow lookahead with determinisation (sample plausible opponent hands from the unseen cards, evaluate a few candidate moves with a node budget, e.g. under 20-50 ms) and exchange optimisation. Bots receive the same projection as a human (own hand, public information) and never the hidden state. Enforce a hard time/node budget per decision; if exceeded, fall back to the best move found. Build an offline harness that plays thousands of simulated games between levels (L5 team vs L3 team must win clearly more than 50%, L1 vs L1 must be symmetric) and reports mean decision time; run it in CI to detect regressions. Add randomised think delay (for example 700-2000 ms) scaled for realism, scheduled via the alarm mechanism (Pitfall 9). Share the move generator with the engine; the bot must never call a separate legality implementation.

**Warning signs:**
No bot-vs-bot benchmark. Bot code that imports the full game state type. Level selector that only changes `Math.random() < p`.

**Phase to address:** P5, using the P1 engine and P2 timers.

---

### Pitfall 16: Authentication on Cloudflare (Workers) done the way it is done on a Node server

**What goes wrong:**
- Password hashing: bcrypt/argon2/scrypt libraries are heavy for Workers' CPU limits (very small on the free plan), and WebCrypto only offers PBKDF2 (with an iteration cap `[VERIFY]`) and no native Argon2. Either the hash is too weak or login requests exceed the CPU limit and fail intermittently.
- WebSocket handshake cannot carry a custom `Authorization` header from a browser; people put the JWT in the query string, where it leaks into logs and history. Cookies work, but then cross-site WebSocket hijacking becomes possible unless `Origin` is checked.
- Cookie flags: missing `Secure`, `HttpOnly`, `SameSite`; cookie domain mismatch between the Worker route and the PWA scope; installed iOS PWA uses a separate cookie jar (Pitfall 14).
- Magic-link or OAuth redirect flows break in the iOS standalone PWA, which opens an external browser for the redirect and never returns the session.
- Seat identity: the table trusts a `userId` sent by the client in the message instead of the identity bound to the socket at upgrade time; any player can impersonate another or play in another seat.
- Secrets in source; JWT signing keys not rotated; sessions never revoked.
- D1 specifics: write latency and read-replica consistency (use the Sessions API/bookmarks where read-after-write matters `[VERIFY]`); using D1 on the hot path of every move rather than only for accounts, friends and finished-game summaries.
- Friends and invitations: user enumeration by search, invitation spam, no rate limit on login or invite endpoints. Open table links that anyone can join.

**How to avoid:**
Prefer passwordless or delegated sign-in: passkeys (WebAuthn) and/or OAuth with a provider, plus a code-entry fallback (type a 6-digit code, no link) so it works inside the iOS PWA. If passwords are required, use PBKDF2 via WebCrypto with a strong iteration count within the limits and a paid plan's CPU allowance, or offload hashing to an auth library designed for Workers `[VERIFY]`. Mint a short-lived, single-use "socket ticket" over an authenticated HTTP request, pass it in the `Sec-WebSocket-Protocol` or the query string for one use, verify `Origin`, and bind the (user, seat) into the socket attachment so message content never decides identity. Rate-limit auth and invites (Workers rate-limiting binding or a Durable Object counter). Use secrets via `wrangler secret`. Keep D1 off the move path.

**Warning signs:**
`userId` field in client messages. JWT in the WebSocket URL. Login that "works on desktop, never returns on iPhone".

**Phase to address:** P6 (design must be decided before P2's socket handshake is finalised; so sketch the ticket mechanism in P2).

---

### Pitfall 17: Service worker caching and version skew between client and server

**What goes wrong:**
A cache-first service worker keeps serving an old JavaScript bundle after a release. The old client speaks protocol v3 to a server on v4, producing blank boards, rejected moves or, worse, subtly divergent rule logic (the client's legal-move highlighting uses an older rules module than the server). The user cannot fix it because an installed iOS PWA has no obvious reload. Other traps: caching WebSocket upgrade or API responses; precaching the four 1280 px board images (several MB) blocks first install and may hit iOS quotas; `skipWaiting` + `clients.claim` swaps code under a running game; a service-worker script cached by the HTTP cache so updates take a day to detect.

**How to avoid:**
Serve the service worker file with `Cache-Control: no-cache`. Version the build; the server (on socket open) sends `minClientVersion`/`protocolVersion` and the client, if outdated, shows a non-blocking "update available, tap to reload" banner (and forces it when the protocol is incompatible) rather than silently swapping mid-game. Use a precache manifest generated by the build tool (Workbox or the framework equivalent) with content-hashed filenames; runtime-cache only static images with a size cap; never cache `/ws` or API calls. Compress and size board images appropriately (Pitfall 19). Prefer shipping the rules engine to the client only for UI highlighting of the player's own hand and make the server the sole authority, so skew cannot corrupt state; include the engine version in action messages and reject mismatches.

**Warning signs:**
A "hard refresh fixes it" support call. No version field in the hello message.

**Phase to address:** P7, with the protocol version field defined in P2.

---

### Pitfall 18: Tab backgrounding and mobile network behaviour killing play

**What goes wrong:**
Mobile browsers suspend background tabs: timers throttle to 1 per second or less, `requestAnimationFrame` stops, WebSockets are closed after a short while on iOS, and on return the user sees a frozen board while the server has moved on. The pause-on-disconnect rule then triggers constantly just because someone checked a message, stalling three other players. A turn-timer (if any) runs while the player is away.

**How to avoid:**
Distinguish "socket closed" from "player gone": pause the game only after a grace period measured server-side (alarm, Pitfall 9), and show the other players who is missing and a countdown. On `visibilitychange`/`pageshow`/`online`, reconnect and resync immediately (Pitfall 10). The pause must not be silent: if the max delay is reached the product decision (open question in PROJECT.md: bot takes over? abandon? vote?) should default to "a bot takes the seat for that deal" with the human able to reclaim at the next deal. Keep per-turn limits generous or absent for friends play. Offer optional push/vibration "your turn". Never rely on client timers for game logic.

**Warning signs:**
Frequent spurious pauses in testing on phones. Games that never recover after a phone call.

**Phase to address:** P2 (server pause logic), P7 (device verification). Decide the open question before P2 begins.

---

### Pitfall 19: SVG and image performance on low-end phones

**What goes wrong:**
- The assembled board is four 1280x1280 WebP quarters (a 2560x2560 canvas). Decoded, that is roughly 26 MB of bitmap memory (more at 2x scaling and with intermediate layers), enough to cause jank, tile flicker or tab reloads on old iPhones and budget Android devices.
- Pawns use SVG gradients, drop shadows and blur filters (`feGaussianBlur`, `filter: drop-shadow`) applied per pawn; animating them forces repaint of filtered regions on every frame. With 16 pawn-sized elements plus effects this drops below 30 fps on low-end phones.
- Animating via SVG attributes (`x`, `y`, `cx`) or via re-rendering a UI framework component on every frame triggers layout/React reconciliation.
- Large, deeply nested SVG DOMs, `<use>` with filters, and CSS `box-shadow` on top of the board image.
- Hit testing on tiny squares: touch targets under 40 px on a portrait phone make mis-taps frequent; pinch/double-tap zoom intercepts.
- Re-measuring layout each frame (`getBoundingClientRect`) to place pawns.

**How to avoid:**
Draw pawns once as `<symbol>`/`<defs>` with precomputed gradients and a *pre-baked* shadow (a static ellipse with opacity, no blur filter at runtime, or a raster sprite), then `<use>` them. Position and animate with `transform: translate()` through CSS or the Web Animations API (compositor friendly), set `will-change: transform` only on moving pawns, and animate with rAF at one place. Avoid animating filters or opacity of filtered elements. Serve the board as a single optimised image sized for the device (responsive `srcset`; 1280 px wide is enough for most phones; keep the full 2560 for large screens), and consider converting the board to a scaled single layer at build time to avoid compositing four. Keep geometry in a coordinate table (72 centres + stables + homes + carpet), computed once at build and verified by an overlay debug view. Provide a "performance mode" (fewer effects, no shadows) chosen automatically from frame-time measurements. Large hit areas independent of the visual size; `touch-action: manipulation`. Profile on a throttled mid-range Android and an older iPhone from P3 onward, not at the end. Budget: sustained 60 fps while two pawns animate, under 150 MB total memory use `[VERIFY thresholds on device]`.

**Warning signs:**
`filter` attributes inside the pawn symbol. React state updated per animation frame. First paint over 3 s on 4G.

**Phase to address:** P3.

---

### Pitfall 20: Mis-mapped board geometry

**What goes wrong:**
The printed numbers on the board are local to each quarter and restart (1-18 per quarter, counted from the previous start square), so "square 7" is ambiguous. The 72-square ring, the start diamond (18), the home entry square (16, two before the pawn's own start) and the stable/home positions are measured by hand on four images and one wrong coordinate puts a pawn between squares, or one off-by-one in the index scheme shifts every colour's start. Different quarters have different rotation, so a table-driven mapping copied for one colour is wrong for another. The seat/colour/partner mapping (yellow + green against red + blue, rotation blue to yellow to red to green) is reversed somewhere.

**How to avoid:**
Define one canonical global index 0..71 with `startIndex[color]` and generate the home entries and stables from named constants, with a unit test that checks invariants (distance between consecutive start squares is 18, entry = start - 2 on the ring, clockwise order). Store pixel coordinates in one data file generated by a small calibration tool (click each square on the assembled board) rather than typed by hand; render a debug overlay (index labels) and review it visually per quarter on the assembled image. A change of board image resolution must not require re-measuring: store coordinates normalised to 0..1.

**Warning signs:**
Hard-coded pixel numbers in components. A rotation done by copy-paste.

**Phase to address:** P1 (indices and invariants), P3 (pixel mapping and overlay).

---

### Pitfall 21: Sound licensing and provenance

**What goes wrong:**
Horse hooves and neighs found on "free sound" sites carry mixed licences: CC0, CC-BY (attribution required), CC-BY-NC (non-commercial; a problem if the app is ever shared publicly or monetised), "royalty-free" but no redistribution of the raw files (a PWA ships the raw files to every browser), or unclear user uploads. Files extracted from videos or games are not licensed at all. AI-generated or sample-pack audio may carry terms that forbid redistribution as raw assets. Without records, a licence problem months later is impossible to resolve. Board art and fonts have the same issue (fonts: check the web-embedding licence).

**How to avoid:**
The project constraint is "CC0 or equivalent, or generated by code". Prefer synthesising hoof and neigh effects with Web Audio (noise bursts, filtered clicks, formant sweeps) for the first version and record a short manifest `ASSETS-LICENSES.md` for anything else: file, source URL, author, licence, date retrieved, whether attribution is required, and a stored copy of the licence text or page. Only CC0 or explicit permissive licences; reject NC/ND/unknown. If a CC-BY asset is used, show the credit in an About screen. Keep originals in the repository so assets can be replaced.

**Warning signs:**
Audio files in the repo without a source recorded. "Found it on a site, said free".

**Phase to address:** P4 (decision synthesised vs. sampled before assets are collected), P7 (audit before any public release).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Rules engine duplicated in client and server with separate code | Fast client-side highlighting | Divergent behaviour, impossible-to-debug "illegal move" rejections | Never; share one pure TypeScript package, server authoritative |
| Whole-state broadcast, client filters hidden info | Simple protocol | Hands leak (Pitfall 7) | Never |
| Game state kept in DO instance fields | Quick prototype | Lost on hibernation (Pitfall 8) | Only in a throwaway spike, with a test that proves it is replaced before P2 ends |
| `setTimeout` for bot delay or pause timers | Easy | Breaks hibernation, lost on eviction | Never in the DO; fine on the client for UI-only delays |
| Position-based pawn model | Matches the drawing | Special cases everywhere (Pitfall 1) | Never |
| Hard-coded pixel coordinates in components | Quick board | Unmaintainable, wrong on resize | Only in a P3 spike before the calibration tool exists |
| One global "lobby" Durable Object for all presence/friends | Easy | Single-thread bottleneck, hibernation, hot object | Acceptable for a family-scale app (tens of users); shard per user or use D1 when growing |
| Bot difficulty = random mistakes | One-line | Levels feel identical | Only for L1 |
| Skip event log, store only latest state | Smaller storage | No replay, no stats, hard migrations | Never |
| Cache-first service worker with no version handshake | Offline-feeling | Version skew (Pitfall 17) | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Durable Object WebSocket | Classic `accept()` instead of the Hibernation API; broadcasting from an in-memory list | `ctx.acceptWebSocket()`, `getWebSockets()`, `serializeAttachment()`, handlers `webSocketMessage/Close/Error` |
| Durable Object storage | Many small non-awaited writes and assuming ordering across objects | Use the SQLite-backed storage API, write-through after each accepted action, keep state compact; rely on input gates only for storage, not for external `fetch` calls (awaiting external I/O opens the gate and allows interleaving) |
| Durable Object alarms | Multiple `setAlarm` callers; non-idempotent handler | Single deadline queue and idempotent handlers (Pitfall 9) |
| D1 | Using it for live game state; assuming read-after-write on replicas | Accounts, friends, game summaries only; use sessions/bookmarks if reading just-written rows `[VERIFY]` |
| Workers static assets / routes | PWA scope, service worker path and WebSocket route on different paths/domains | Same origin for app, API and `/ws`; service worker served from root with correct `Service-Worker-Allowed` |
| Web Audio | Creating a context per sound; decoding on every play | One context, decode once, voice pool |
| Wake Lock | Requesting once at start | Re-request on `visibilitychange`; handle rejections |
| Web Push | Asking permission at load | Ask after a user gesture, only in installed PWA on iOS, offer a fallback |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| SVG filters animated per frame | Stutter, hot phone | Pre-baked shadows, transform-only animation | Any low-end phone with 2+ moving pawns |
| 2560 px board decoded at full size | Tab reload, memory warnings on iOS | Responsive images, single optimised layer | Older iPhones and 2 GB Android |
| UI-framework re-render per animation frame | Dropped frames | Imperative animator outside the reactive tree | Immediately on mobile |
| Bot deep search on the DO thread | Laggy sockets, long tail latency | Node/time budget, cheap heuristics, determinised sampling | Level 5 with 7 splits |
| Broadcasting full snapshots on every move | Wasted bandwidth and WebSocket message billing (incoming messages billed at a ratio, outgoing counted per message) | Send event deltas plus periodic snapshot | Many spectators or chatty chat; negligible for 4 players |
| Heartbeat pings waking the hibernated object | Needless duration and request billing | `setWebSocketAutoResponse` for ping/pong | Always-on tables |
| Unbounded event log in one DO | Storage growth, slow cold start | Snapshot + truncate, archive finished games to D1 | Long-lived saved games |
| Chat messages stored forever | Storage growth, moderation | Cap history length, prune at game end | Months of use |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting client-sent seat or user id | Impersonation, playing others' hands | Bind identity at upgrade; ignore identity in message bodies |
| Missing `Origin` check on WebSocket upgrade | Cross-site WebSocket hijacking via cookie auth | Check `Origin` and use a short-lived ticket |
| Leaking hands via snapshots, debug logs or error messages | Cheating | Per-seat projection and payload leak scanner (Pitfall 7) |
| Predictable shuffle (`Math.random` seeded or sort-shuffle) | Biased deals, exploitable | `crypto.getRandomValues` with Fisher-Yates, never send the seed |
| Unauthenticated table join link | Strangers join | Signed, expiring invite tokens tied to friend list |
| Chat injection (HTML/URLs) | XSS | Render as text only, length limits, rate limits |
| No rate limit on login/invite/chat | Abuse, cost | Rate-limit binding or DO counters |
| Secrets committed; no rotation | Account takeover | `wrangler secret`, rotation plan |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Player cannot tell why a card is unplayable | Frustration; bug reports that are really rules questions | Greyed-out cards with a one-line reason ("pion protégé sur sa case de sortie") |
| Forced "discard whole hand" with no explanation | Looks like a bug | Explicit animated message, cards shown to all |
| 7 split UI unclear | Misplays | Live remaining counter, undo of the unsent plan, preview of captures along the path |
| Capturing own partner by accident | Team anger | Confirmation highlight when a move captures the partner's pawn |
| Silent pause when someone disconnects | Players think the game froze | Visible "waiting for X, 2:30 left" banner and what happens at timeout |
| Sound on unexpectedly or never | Annoyance / confusion | Explicit sound toggle, first-tap unlock, remembered preference |
| Tiny tap targets on a portrait board | Mis-taps | Large invisible hit areas, tap-to-select then tap-destination with zoom assist |
| Landscape/portrait rotation relayouts mid-animation | Broken positions | Normalised coordinates and a single resize handler |
| French-only text hard-coded in components | Hard to fix wording, inconsistent | One message catalogue |
| Bots instantly play, so the human cannot follow | Confusion | Think delay plus animation pacing and a move log |

## "Looks Done But Isn't" Checklist

- [ ] **7 split:** Often missing splits across 3-4 pawns, ordering effects, and atomic rollback; verify with the property test of Pitfall 2
- [ ] **Start-square protection:** Often missing for Jack, backward 4 and mid-7; verify with the matrix of Pitfall 3
- [ ] **Home entry:** Often missing the "do not pass a pawn already in" and "exact count" cases, plus the full-lap requirement; verify with progress-model tests including a 4 played from the start square
- [ ] **Finished player:** Often missing 5/Jack/7 on the partner's pawns and the win check; verify with scenario tests per card
- [ ] **Dead hand:** Often missing 7/Jack/4/exit in the "no legal move" test and the all-four-dead case; verify by simulation that every deal terminates
- [ ] **Hidden information:** Often missing reconnect snapshots, exchange events and spectator view; verify the leak scanner on every message type
- [ ] **Hibernation:** Works in dev, fails in prod; verify by reconstructing the object between every message in tests, and with an idle 60 s manual test on deployed code
- [ ] **Alarms:** Several deadlines overwrite each other; verify bots, pause timeout and cleanup all fire in one scenario
- [ ] **Reconnect:** Often missing seq-based resync and duplicate-action protection; verify with airplane-mode toggling and double-tap
- [ ] **Animation queue:** Often missing fast-forward after hidden tab/snapshot; verify by backgrounding the tab mid-game for 60 s
- [ ] **Audio on iOS:** Often missing unlock, silent-switch handling, format support; verify on a real iPhone, installed PWA and Safari, ringer on/off
- [ ] **Service worker update:** Often missing version handshake; verify by deploying a protocol change and opening an old installed PWA
- [ ] **Auth in iOS PWA:** Often fails on redirect flows; verify login from a cold installed PWA
- [ ] **Resume saved game:** Often missing version fields; verify by loading a snapshot saved by the previous build
- [ ] **Licences:** Often missing records; verify every audio/font/image has a row in `ASSETS-LICENSES.md`
- [ ] **Low-end performance:** Often only checked on a flagship; verify frame rate on a throttled mid-range Android and an older iPhone
- [ ] **Bot levels:** Often indistinguishable; verify with the self-play benchmark and a decision-time report

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Position-based pawn model (1) | HIGH | Rewrite pawn representation and `path()`; regenerate all tests; rework animation inputs |
| 7 split wrong (2) | MEDIUM | Replace generator/validator with the DFS plan model; keep the client UI, fix the message to carry a full plan |
| Rule ambiguity decided wrongly (4) | LOW-MEDIUM | Change constant or branch, bump `rulesVersion`, decide migration for in-flight games |
| Hand leak shipped (7) | HIGH (trust) | Introduce projection layer, invalidate in-flight games, rotate any shared secrets, add the leak scanner |
| Hibernation state loss (8) | MEDIUM | Move state to storage, re-key sockets via attachments, convert timers to alarms |
| Alarm collisions (9) | LOW | Introduce the deadline queue, make handlers idempotent |
| Reconnect desync (10, 12) | MEDIUM | Add `seq` and snapshots to the protocol; client version gating handles old clients |
| Stale PWA clients (17) | MEDIUM | Server-driven forced-update message, bump SW with `no-cache`, ship an unregister path |
| iOS audio silent (13) | LOW | Add unlock flow, convert asset formats |
| Poor SVG performance (19) | MEDIUM | Replace filters with pre-baked sprites, switch to transform animation, resize images |
| Auth unsuitable for iOS PWA (16) | MEDIUM-HIGH | Add code-entry or passkey login; migrate sessions |
| Licence problem (21) | LOW if records exist; HIGH otherwise | Replace assets with synthesised or CC0 ones using the manifest to find all uses |
| Bots too weak/slow (15) | MEDIUM | Tune evaluation, add budget, rerun the self-play benchmark |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1. Position vs progress model | P1 | Invariant tests on board constants; backward-4-from-start scenarios |
| 2. 7 split | P1, P3, P5 | Generator/validator property test; UI flow test |
| 3. Start-square protection | P1 | Card x situation matrix test |
| 4. Rule ambiguities | P1 (pre-coding spec) | Signed-off RULES.md, test per rule |
| 5. Finished player controls partner | P1, P5 | Scenario tests per card; 10,000-game simulation without stuck states |
| 6. Dead hand / discard | P1, P2 | Terminating-deal simulation incl. all-dead table |
| 7. Hidden information | P2 (before first client), P5 | Payload leak scanner in CI for every message type |
| 8. Hibernation | P2 | Reconstruct-between-messages test; idle test on deployed Worker |
| 9. Alarms | P2, P5 | Multi-deadline scenario test, duplicate-delivery test |
| 10. Reconnect / duplicates | P2, P3, P7 | Airplane-mode and double-submit tests; seq resync |
| 11. Persistence vs engine changes | P2, P6 | Load previous-version snapshot test |
| 12. Animation/state desync | P3, P5 | Hidden-tab fast-forward test; burst of bot events replayed |
| 13. iOS audio | P4, P7 | Real-device checklist (ringer on/off, lock/unlock, installed PWA) |
| 14. iOS PWA limits | P7 (login decided in P6) | Device matrix pass; login from cold PWA |
| 15. Bot quality/speed | P5 | Self-play benchmark and decision-time budget in CI |
| 16. Auth on Cloudflare | P2 (ticket design), P6 | Origin check test; login on iPhone PWA; rate-limit test |
| 17. Service worker / version skew | P2 (protocol version), P7 | Old-client-vs-new-server test |
| 18. Background tabs / pauses | P2, P7 | Phone-lock test; grace period behaviour |
| 19. SVG performance | P3 (continuous) | Frame-time on low-end devices, memory budget |
| 20. Board geometry | P1, P3 | Invariant tests and visual overlay review |
| 21. Sound licensing | P4, P7 | `ASSETS-LICENSES.md` audit |

## Research flags for the roadmap

- **P2 needs deeper phase research:** current Durable Object limits and billing (SQLite storage, hibernation timing, attachment size, alarm semantics, WebSocket message billing), `[VERIFY]` items above.
- **P6 needs deeper phase research:** the auth approach (passkeys vs OAuth vs code login) on Workers and inside an iOS standalone PWA, D1 consistency options.
- **P4/P7 need on-device validation:** iOS audio behaviour, wake lock in standalone, push availability.
- **P5 needs an experiment:** bot determinisation approach and budget, evaluated by self-play.
- **Pre-P1 decision session with Romain:** the rule ambiguities of Pitfall 4 plus the four open questions already in PROJECT.md (disconnect delay and its aftermath included).

## Sources

- Project context: `/home/user/toc/.planning/PROJECT.md` (house rules, board layout, open questions)
- Cloudflare Durable Objects documentation (WebSocket Hibernation API, alarms, storage limits and billing); training knowledge, not live-verified in this session: re-check before P2
- Cloudflare Workers documentation (CPU limits, WebCrypto algorithm support, D1 consistency); not live-verified
- WebKit / Apple documentation and developer reports on Web Audio unlock, `interrupted` AudioContext state, silent switch behaviour, home-screen web app storage/cookie separation, Web Push in installed web apps, Screen Wake Lock in standalone mode; not live-verified
- MDN: Web Audio API best practices (autoplay policy), Service Worker lifecycle, `visibilitychange`, Screen Wake Lock API
- General knowledge of Tock / Dog / "Dog" board-game rule variants (split 7, exchange with partner, Jack swap, protected start square, play for the partner when finished)
- Common multiplayer-game engineering practice: authoritative server, per-player projections, sequence-numbered event streams, determinised search for imperfect-information bots

---
*Pitfalls research for: real-time multiplayer card-driven board game PWA (TOC) on Cloudflare*
*Researched: 2026-10-13*
