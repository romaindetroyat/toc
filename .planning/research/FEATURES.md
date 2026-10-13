# Feature Research

**Domain:** Online adaptation of a card-driven "petits chevaux" team game (TOC; cousin of Tock, Dog / Brändi Dog, Jackaroo, Sorry!), private play for family and friends, PWA, bots of adjustable strength
**Researched:** 2026-10-13
**Confidence:** MEDIUM. Based on knowledge of Brändi Dog online, Jackaroo and Tock apps, Board Game Arena (BGA), Ludo King and Colonist.io. No live web verification was done in this pass, so competitor details are directionally right but not checked against current app versions. The TOC-specific analysis (house rules from PROJECT.md) is HIGH confidence because it comes from the project file.

## Framing

TOC is a 4-player, 2-team, hidden-hand, simultaneous-then-sequential game with a heavy "which of my legal moves?" decision (a card can have several targets, the 7 can be split, the Valet swaps any two pawns). The product is private (family and friends), so the stakes for each feature differ from public platforms: no matchmaking, no ranking ladder, no anti-abuse tooling, but a high bar for clarity, patience with slow or distracted relatives, and graceful handling of phones going to sleep.

Three facts from PROJECT.md shape everything below:
1. The server is authoritative and hands out only each player's own hand. Any "undo", "replay" or "spectate" feature has to respect hidden information.
2. A disconnect pauses the game. This replaces the turn-timer-with-auto-play behavior common on public sites.
3. Bots fill empty seats at levels 1 to 5, and level 5 must handle the partner card exchange. Bots are therefore a core engine feature, not an add-on.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing these = the product feels broken or unfair to people used to Dog / Tock apps.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Server-authoritative rules engine (pure, deterministic, shared client/server) | Players will argue about rules; every online board game must reject illegal moves | HIGH | Encodes all house rules (5 own pawns only, 7 eats what it passes, uninjurable exit square, exact-count home entry, dead hand discard). One engine reused for legal-move generation, UI preview, bots and replays. Heaviest single piece of work. |
| Legal-move computation exposed to the client | Every serious Dog/Jackaroo app highlights playable cards and valid destinations; without it new players are lost | MEDIUM | Server sends the list of legal moves with the hand; client never re-implements rules. Gray out unplayable cards. |
| Tap card then tap destination, with highlighted target squares | Standard interaction in Brändi Dog online and Jackaroo | MEDIUM | Pawns that can move glow; valid landing squares pulse; ambiguity (Ace/King: leave stable or advance) resolved by a small choice popup. Must work with a thumb on a portrait phone. |
| Move preview before commit (ghost pawn / path line, captures marked) | Rules are intricate (jumping, capture-by-passing with the 7, blocked exit square); players want to see consequences | MEDIUM | Show the path and which pawns would be eaten. Particularly important for the 7 and the Valet. |
| Confirm-before-submit on committing actions (not blanket undo) | Misclicks on phones are the top complaint in mobile board games; but undo is incompatible with hidden hands and simultaneous bots | LOW to MEDIUM | Two-step: select, then confirm button (or tap target twice). Skippable setting for experienced players. Do NOT offer post-submit undo (see Anti-Features). |
| Card-split UI for the 7 | The 7 is split across pawns in Dog/Tock; a bad UI makes it unplayable on phones | HIGH | Stepper-style: pick pawn, choose steps 1 to 7 (remaining counter), pick next pawn, auto-fill the remainder when only one option; show cumulative path and every pawn eaten along the way; confirm once at the end; cancel resets the whole 7. Must validate each partial step against the engine (passing over own pawns allowed per open question). |
| Partner card exchange UX | A defining Dog/TOC moment each deal; confusion here stalls the table | MEDIUM | Prompt at deal start: choose one card, confirm, then "waiting for N players" with per-seat done status. Cards stay face down; partner receives at reveal. Partner-guidance hint text ("give your partner a Roi or an As"). Bots at level 5 choose deliberately; lower levels choose crudely. |
| Visible game state: whose turn, cards remaining, deal number, dealer | Players need to know what the table is waiting on | LOW | Turn indicator, deal counter, hand sizes per seat, a "last move" banner. |
| Hand display that works in portrait phone and desktop | The audience plays on phones | MEDIUM | Fanned cards at bottom, pinch-to-zoom board, auto-fit. Layout is a design problem as much as a feature (the board is four 1280 px quarters). |
| Move log / "what just happened" strip | After an opponent's move, players want to know what card was played and what was eaten | LOW | Last-N-moves list or toast; also feeds replays. |
| Accounts and sign-in that families can handle | Needed for stats, friends and resuming | MEDIUM | PROJECT.md demands accounts. Keep friction minimal: magic link or email/password plus optional OAuth, usable from a shared link. No guest-only mode is required, but an invite link that lands on a "join as guest or sign in" step lowers friction for grandparents. |
| Friends list and invite to a table | Core to a private-circle product | MEDIUM | Add friend by code or link; invite by link (the fastest path for family) plus in-app invite to online friends. A table has a short code and a shareable URL. |
| Lobby / private table with seat assignment and team layout | Players must choose seat and partner (partners face to face) | MEDIUM | Host picks seat colors, fills empty seats with bots, sets bot level per seat, starts when ready. Make the partner pairing (jaune + vert, rouge + bleu) obvious. |
| Bots with per-seat strength 1 to 5 | Already a project decision; also expected so a game can start with fewer than four humans | HIGH | Level 1: random legal move. Mid levels: heuristic scoring (prioritize capture, safe entry, avoid giving the opponent a capture). Level 5: lookahead / Monte Carlo with determinization over hidden cards, partner-aware, deliberate exchange. See bots section below. |
| Solo game vs 3 bots | Already in scope; also the default way to learn the game | LOW (given bots) | Same table flow with 3 bot seats. |
| Pause on disconnect and automatic reconnect | Phones sleep, wifi flaps; required by project decision | HIGH | Durable Object keeps authoritative state; client reconnects to same table silently and re-fetches its hand and state; the table shows "waiting for X" with a countdown to the maximum delay; defined fallback when the timer runs out (see open questions). |
| Resume saved games | Required in PROJECT.md; families play across evenings | MEDIUM | Persist the full state to D1/Durable Object storage; "Resume" list on home screen; any absent human seat waits or is temporarily taken by a bot (decision to make). |
| Text chat in game | Required in PROJECT.md | LOW | Per-table chat; unread badge; separate team-only channel is optional. Messages are private to the table; no public moderation is needed because tables are private. |
| Quick reactions / emotes | Almost every card-game app has them; lets people tease without typing on a phone | LOW | 6 to 10 preset emoji/phrases ("Bravo", "Aïe", "Merci partenaire", "Dépêche-toi"). Rate-limit. Stay clear of anything that could reveal a hand. |
| Win condition screen and rematch | Games end in a clear result and people want another round | LOW | Winning team banner, final stats, "Rejouer avec les mêmes joueurs" one-tap button. |
| Rules / help screen in French | The house rules differ from Tock and Dog, and not every relative knows them | MEDIUM | Card cheat sheet (also printed on the board quarters), illustrated rules, per-card tooltip while hovering or long-pressing a card ("Valet: échange un de tes pions avec n'importe quel autre"). Content, not engineering. |
| Sound and animation controls | Many users play in public, on trains, or hate motion | LOW | Master mute, sound-effect volume, "reduce motion" / animation speed (normal, fast, off). Tied to the PWA; respect `prefers-reduced-motion`. |
| Basic accessibility | Colorblind, low-vision and older users are in the family audience | MEDIUM | Do not rely on pawn color alone (add shape/number/marker per seat); large touch targets (44 px+); high-contrast option; screen-reader labels for the hand and actions where practical; text size follows OS. |
| Installable PWA with offline shell | Project requirement | MEDIUM | Manifest, service worker for assets; real play requires network. Fall back gracefully offline (solo vs bots can in theory work offline if the engine runs client-side; see differentiators). |
| Game history list | Required in PROJECT.md | LOW to MEDIUM | List of finished games: date, players, result. |
| Per-player and per-team stats | Required in PROJECT.md | MEDIUM | Games played/won, pawns eaten/lost, partner pairs win rate. Compute from the event log. |

### Differentiators (Competitive Advantage)

Aligned with the Core Value in PROJECT.md: faithful house rules plus the atmosphere of the original board.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Original hand-drawn board with animated knight pawns and hoof/neigh sound that scales with distance | Nothing in the market looks or sounds like this; this is the emotional reason the family will use it over Brändi Dog sites | HIGH | Already a project requirement. Animation system (exit, step-by-step move, capture, eaten, home arrival, Valet swap) driven by engine event stream. Sound cadence mapped to steps/second, procedural audio or CC0 samples. |
| Faithful house-rule engine (the TOC variant) | Existing apps implement Dog, Jackaroo or Tock rules, not Romain's variant; family can finally play the real rules | HIGH | The same engine as table stakes, but this is where value lies. Document each house rule in the rules help. |
| Configurable house-rule toggles per table | Different families house-rule differently; Tock apps and Jackaroo variants often offer toggles | MEDIUM | Offer a small set of host-set toggles resolving the project's open questions (7 passing own pawns, 4-backwards into home, full lap required, dead-hand discard). Keep defaults equal to Romain's rules. Do not build a general rules DSL. |
| Smart-partner level 5 bot that handles the card exchange and plays for the team | Most bots in Dog apps play selfishly; a partner-aware bot makes mixed human/bot teams enjoyable | HIGH | Requires an evaluation function that values partner pawns, cooperative exchange, and lookahead. Needs a bot-vs-bot arena to tune the 1 to 5 scale. |
| Bot takeover of an absent seat (mid-game, reversible) | Lets a game continue when a relative leaves; the person can retake the seat on return | MEDIUM | Complements the pause-on-disconnect default. Host chooses "wait" or "bot plays meanwhile" after the timeout. Resolves a project open question. |
| Replay of finished games with step controls | Players love re-living a big capture; it also enables a debugging and tuning tool for bots | MEDIUM | Possible cheaply if state is stored as an event log (initial seed + actions). After the game ends, hands can be revealed in replay. Share link to a specific moment. |
| Post-game "highlights" (biggest capture, 7 double-eat, Valet swap that decided the game) | Fun social payoff in a family setting | LOW to MEDIUM | Derived from event log. |
| Spectating (read-only watcher, hands hidden) | Relatives waiting for a seat, kids watching, someone joining mid-game | MEDIUM | Same state broadcast with all hands redacted. Spectator chat is optional. Low priority for private play, but easy once event streaming exists. |
| Hint button ("suggest a move") | Helps beginners and kids; uses the bot engine for free | LOW to MEDIUM | Reuses the level 5 bot. Per-table setting, off by default; can be turned off so competitive tables are clean. |
| Interactive tutorial / guided solo first game | New players learn faster than from reading rules; cousin games with unusual rules benefit most | MEDIUM to HIGH | Scripted solo scenarios ("play an As to leave the stable", "the 7 split") with a fixed deck. Content-heavy; can ship after launch. |
| Push notifications for "your turn" and "table invites" | Asynchronous/slow family games thrive on nudges | MEDIUM | Web Push on Android and desktop is reliable; iOS requires the PWA to be installed to the home screen and works from iOS 16.4+. Use sparingly (turn alert after a delay, invite, game resumed). Cloudflare can send Web Push from a Worker with VAPID. |
| Friends-only leaderboard | Light competitive layer; project requirement | MEDIUM | Compute from stats over a season or all-time among friends only. Avoid global ladders. |
| Team stats (partner pairs) | Fits the 2v2 identity ("best duo in the family") | LOW | Derive from history. |
| Offline solo vs bots (engine runs in the client) | PWA on a train; no server | MEDIUM | Possible because the engine is pure and shared. Treat as a bonus; the server stays authoritative for multiplayer. |
| Card-peek-free visual design: fan, deal and exchange animation on the central green carpet | Matches the board's identity, makes the exchange tangible | MEDIUM | Visual layer on top of the game-state events. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Post-submit "undo last move" | Misclicks happen, especially on phones; Ludo King style apps and some hobby tables allow take-backs | Breaks hidden information and fairness (an opponent may have already seen the card, a bot may have already responded); requires distributed consensus; opens quarrels | Preview plus explicit confirm step before submit; optional "confirm every move" setting; clear move preview for the 7 and Valet |
| Strict turn timers with auto-play | Public sites use them to stop stalling | Contradicts the project decision (pause on disconnect); a family game with a grandparent or a child will be punished; auto-play of a bad move feels hostile | Soft nudge only: a gentle "N is thinking" indicator and an optional host-set reminder after X minutes; a visible disconnect countdown with host override |
| Public matchmaking / open lobbies with strangers | Larger player pool | Already out of scope; adds moderation, abuse reports, ranking, anti-cheat | Friend and invite-link tables only |
| Voice chat | Feels natural for team play | Out of scope in PROJECT.md; heavy WebRTC cost; people already use their own call apps | Text chat and quick reactions; family can run a separate call |
| Global rated ladder (Elo) | Competitive motivation | Pointless for a private circle; creates tension in families; needs rating-system work | Friends-only leaderboard and personal stats |
| Real 3D board | Looks impressive | Out of scope; heavier on mobile, clashes with the hand-drawn board | The "fake 3D" knight pawns with shadow and highlights |
| Native iOS/Android store apps | Reach and push notifications | Out of scope; store fees/review; the PWA covers it | Installable PWA with Web Push |
| Free-text open chat with strangers, profile pictures, public profiles | Social features | No strangers means no need; adds moderation and privacy risk | Table-scoped chat; display name and avatar choice from a fixed set |
| Cosmetics store, coins, ads, loot | Common in Ludo King-style apps | Wrong tone for a family project; adds payment and legal weight | None; unlock pawn skins or themes for free later if wanted |
| Six-player variant | Tock supports more players | Out of scope; the board has four quarters | Document it as a possible future board |
| Arbitrary rule editor | "Let me tweak anything" | Combinatorial explosion in engine, bots and tests; breaks stats comparability | A small, curated set of host toggles for the known open questions |
| Showing opponents' hands to the client "for animation" | Simple to implement | Leaks hidden information to anyone with browser dev tools | Server sends only the viewer's own hand; reveal events only at game end |
| Client-side move validation as the source of truth | Fast to build | Cheating and desync | Client uses server-provided legal moves; server validates every action |

## Feature Dependencies

```
Rules engine (pure, shared)
    ├──requires──> House-rule decisions (open questions resolved)
    ├──enables──> Legal-move highlighting and previews
    │                  └──requires──> Per-player hidden-state projection (server sends own hand only)
    ├──enables──> Card-split UI for the 7
    ├──enables──> Bots (levels 1 to 5)
    │                  ├──enables──> Solo mode, empty-seat fill, hints, bot takeover
    │                  └──requires──> Exchange logic (partner card pass) in the engine
    └──enables──> Event log (seed + actions)
                       ├──enables──> Game history and stats
                       │                  └──enables──> Leaderboard, team stats
                       ├──enables──> Replays and highlights
                       └──enables──> Resume saved games (also needs persistence)

Realtime table (Durable Object, authoritative)
    ├──requires──> Accounts / identity
    │                  └──enables──> Friends, invites, lobby
    ├──enables──> Chat and quick reactions
    ├──enables──> Pause-on-disconnect + reconnect
    │                  └──enhances──> Bot takeover of absent seat
    ├──enables──> Spectating (redacted broadcast)
    └──enables──> Push notifications (needs accounts + subscriptions)

Animation + sound layer ──requires──> Engine event stream (move, capture, swap, home)
    └──requires──> Sound / motion settings

Tutorial ──requires──> Engine + scripted decks + rules content
Accessibility ──cross-cuts──> Board, hand, controls (decide before UI is built)

Post-submit undo ──conflicts──> Hidden hands, bots, event-log replay integrity
Strict turn timer ──conflicts──> Pause-on-disconnect decision
```

### Dependency Notes

- **Rules engine is the root of the graph:** legal-move highlighting, the 7 splitter, bots, history, replays and resume all consume it. Build and test it first, with the house-rule open questions resolved or exposed as toggles.
- **Hidden-state projection must exist before any client UI:** otherwise spectating, replays and previews leak hands. Decide the server message shape up front (own hand plus public state).
- **Event log is a cheap multiplier:** if every game is stored as seed plus ordered actions, then history, stats, replays, highlights and resume come almost for free. Not storing it forces costly retrofits.
- **Bots depend on the engine plus an exchange policy:** the level scale needs an evaluation harness (bot vs bot) to avoid a fake difference between levels.
- **Pause-on-disconnect depends on Durable Object state and on a defined timeout policy:** the open question (what happens after the maximum delay) must be answered before building. Recommended: host decides between continuing with a temporary bot or waiting.
- **Push notifications depend on accounts and a stored subscription;** iOS support requires an installed PWA, so put the "install" prompt in the onboarding flow.
- **Animations depend on a clean engine event stream:** emit typed events (leave stable, step, capture, swap, enter home) rather than diffing board states.
- **Sound and motion settings must ship with the animation layer,** not later, to avoid retrofit.

## MVP Definition

Romain wants the whole set "dès la première version jouable". The ordering below is a build order inside that goal, not a scope cut. Items marked (could slip) are those least harmful to defer if the schedule slips.

### Launch With (v1)

- [ ] Rules engine with all house rules, plus legal-move generation, tested with scripted scenarios per card (essential: everything else depends on it)
- [ ] Authoritative realtime table on Durable Objects; hidden hands; reconnect and pause-on-disconnect with a maximum delay
- [ ] Accounts, friends, invite by link and by friend, lobby with seat and team assignment, per-seat bot level 1 to 5
- [ ] Playable UI: hand, highlights, move preview, confirm step, 7 splitter, Valet swap, partner exchange flow
- [ ] Bots at levels 1 to 5 including exchange policy; solo mode
- [ ] Board rendering, knight pawns, core animations and sounds with mute and reduce-motion settings
- [ ] Chat and quick reactions
- [ ] Resume saved games; game history; basic per-player and team stats; friends leaderboard
- [ ] Rules help in French (card cheat sheet, tooltips)
- [ ] Baseline accessibility (non-color seat markers, touch targets, contrast, reduced motion)
- [ ] Installable PWA

### Add After Validation (v1.x)

- [ ] Replays and highlights (could slip: cheap if the event log exists, so build the log in v1)
- [ ] Push notifications (could slip: needs install flow and VAPID work; valuable for slow games)
- [ ] Interactive tutorial (could slip: content-heavy)
- [ ] Hint button (low effort given bot engine)
- [ ] Spectating
- [ ] Host house-rule toggles beyond defaults
- [ ] Bot takeover of an absent seat

### Future Consideration (v2+)

- [ ] Offline solo play with the client-side engine
- [ ] Pawn and board themes (free cosmetic options)
- [ ] Tournament or season views among friends
- [ ] Additional board variants (e.g. 6 players) only if a new board is drawn

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Rules engine and legal moves | HIGH | HIGH | P1 |
| Authoritative realtime tables | HIGH | HIGH | P1 |
| Bots 1 to 5 (+ exchange) | HIGH | HIGH | P1 |
| Move highlight, preview, confirm | HIGH | MEDIUM | P1 |
| 7 splitter UI | HIGH | HIGH | P1 |
| Partner exchange flow | HIGH | MEDIUM | P1 |
| Lobby, invites, friends, accounts | HIGH | MEDIUM | P1 |
| Reconnect and pause | HIGH | HIGH | P1 |
| Board, pawns, animation, sound | HIGH | HIGH | P1 |
| Chat and quick reactions | MEDIUM | LOW | P1 |
| Resume saved games | HIGH | MEDIUM | P1 |
| History, stats, leaderboard | MEDIUM | MEDIUM | P1 |
| Rules help (French) | HIGH | MEDIUM | P1 |
| Sound and motion settings | MEDIUM | LOW | P1 |
| Accessibility baseline | MEDIUM | MEDIUM | P1 |
| PWA install | MEDIUM | LOW | P1 |
| Replays and highlights | MEDIUM | MEDIUM | P2 |
| Push notifications | MEDIUM | MEDIUM | P2 |
| Hint button | MEDIUM | LOW | P2 |
| Spectating | LOW | MEDIUM | P2 |
| Interactive tutorial | MEDIUM | HIGH | P2 |
| Host house-rule toggles | MEDIUM | MEDIUM | P2 |
| Bot takeover of absent seat | MEDIUM | MEDIUM | P2 |
| Offline solo | LOW | MEDIUM | P3 |
| Cosmetic themes | LOW | LOW | P3 |

**Priority key:** P1 = in the first playable version (Romain's stated intent); P2 = early follow-up; P3 = later.

## Bots and Difficulty (detail)

- **Scale design:** levels must differ in measurable win rate against each other, tuned with a bot-vs-bot arena (thousands of simulated games). Proposed shape: 1 random legal; 2 greedy (capture or progress); 3 heuristic scoring with safety (avoid being eaten, protect exit square approach); 4 adds partner awareness and exchange heuristics; 5 adds lookahead (determinized Monte Carlo over hidden cards, which is the standard approach for hidden-information card games).
- **Human feel:** add a thinking delay of 0.6 to 1.5 s and animate the move; instant bot moves feel jarring and are hard to follow on a small screen.
- **Fairness:** bots must be given only information a human at that seat could know (own hand plus public history). Level 5 may use card counting, which is human-possible.
- **Exchange:** low levels pass a random or highest card; high levels pass a card useful to the partner (Roi/As to exit, or a card that fits their board position).
- **Mixed tables:** a bot in a seat should be clearly labeled, with the level displayed.

## Reconnection, Pause and Timers (detail)

- Pause freezes the table for everyone with a visible "waiting for X, N min left" banner.
- Policy at timeout is an open question; recommended: host chooses between "keep waiting", "bot plays for X until they return", or "save and stop". Saved games feed the resume feature.
- Idle nudges (not forced moves): after a configurable delay, a gentle ping to the player (and a push notification if enabled).
- A player who simply leaves the browser without closing is treated as a disconnect once the socket drops; use heartbeat.

## Competitor Feature Analysis

| Feature | Brändi Dog online / Dog apps | Jackaroo / Tock apps | Board Game Arena / Ludo King / Colonist | Our Approach |
|---------|------------------------------|----------------------|-----------------------------------------|--------------|
| Matchmaking | Public tables and ranking | Public lobbies, some private | BGA: public + friends; Ludo King: random plus private room code; Colonist: ranked lobbies | Private only; friends and links |
| Legal-move help | Card/pawn highlight, some preview | Highlights on playable cards | BGA highlights valid actions; Ludo King auto-highlights | Highlight plus path preview plus capture marks |
| Splitting the 7 | Step-by-step UI; confusing on small screens | Similar | n/a | Guided stepper with live remainder and one final confirm |
| Undo | Generally not allowed | Mostly not allowed | BGA allows undo in some turn-based games before opponents see info; Ludo King none | Confirm step, no post-submit undo |
| Partner exchange | Explicit pick-and-confirm | Same | n/a | Pick, confirm, show waiting state per seat; bot partner exchange tuned |
| Bots | Often weak or single level | Often single level | BGA has few bots; Ludo King has easy bots; Colonist has bots | 5 levels, partner-aware top level |
| Timers | Strict clocks with auto-play | Strict clocks | BGA: clocks with time banks; Colonist: timers | Pause on disconnect; soft nudges; no auto-play |
| Chat and reactions | Text and emotes | Text and emotes | All have text and quick reactions | Text plus a small preset set |
| Spectating | Often yes | Rare | BGA yes; Colonist yes | Later, redacted broadcast |
| Replays | Rare | Rare | BGA full replay; Colonist replay | Via event log, after launch |
| Stats and ranking | Elo ladders | Basic | BGA Elo; Colonist ranked | Friends-only stats and leaderboard |
| Push notifications | Email or app push | App push | BGA email and push | Web Push through the PWA |
| Accessibility | Limited | Limited | BGA has some colorblind options | Non-color markers and reduced motion built in |
| Atmosphere | Generic board and pawns | Generic | Generic or cartoon | Hand-drawn board, knight pawns, hoof sounds (main differentiator) |

## Sources

- Product knowledge of Brändi Dog (online implementations and apps), Jackaroo apps, Tock apps, Sorry!, Board Game Arena, Ludo King and Colonist.io (from training data; not re-verified live in this pass, so MEDIUM confidence on competitor specifics).
- Standard practice for hidden-information card-game bots (determinized Monte Carlo / information-set search): general game-AI literature; MEDIUM confidence.
- Web Push on iOS requires an installed home-screen web app from iOS 16.4: Apple platform documentation as known at training time; verify current behavior at implementation time.
- /home/user/toc/.planning/PROJECT.md (project-specific house rules, constraints, open questions): HIGH confidence.

## Gaps to Verify Later

- Exact feature sets of current Brändi Dog / Jackaroo / Tock apps (a short competitor pass with live screenshots would raise confidence).
- Web Push behavior on iOS PWAs in the target OS versions.
- Bot strength tuning is empirical; plan time for an arena harness.
- Resolve the four PROJECT.md open questions before the engine is frozen: 7 passing own pawns, 4-backwards into home, full lap required, disconnect timeout fallback.

---
*Feature research for: online TOC card-driven petits-chevaux game*
*Researched: 2026-10-13*
