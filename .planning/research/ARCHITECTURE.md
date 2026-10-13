# Architecture Research

**Domain:** Real-time multiplayer card-driven board game (TOC, "petits chevaux" with cards, 2v2), PWA on Cloudflare
**Researched:** 2026-10-13
**Confidence:** HIGH on the Durable Object / WebSocket / alarm structure (verified against current Cloudflare docs) and on the engine/event-log pattern. MEDIUM on bot search budgets (need profiling) and on auth library choice. LOW on pixel geometry (needs measuring on the artwork) and on four rule ambiguities (see "Rules questions that change the data model").

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT (PWA, browser)                         │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌───────────────────┐  │
│  │ UI shell │  │ Net store │  │ Animation  │  │ Board renderer    │  │
│  │ lobby,   │  │ WS + sync │  │ queue +    │  │ artwork + SVG     │  │
│  │ hand,chat│  │ (serverView)│ │ audio cues │  │ pawns (renderState)│ │
│  └────┬─────┘  └─────┬─────┘  └─────┬──────┘  └─────────┬─────────┘  │
│       │   engine (shared, read-only use: legal moves for preview)     │
└───────┼──────────────┼──────────────┼───────────────────┼────────────┘
        │ HTTPS (REST) │ WSS (one per table)
┌───────┴──────────────┴─────────────────────────────────────────────────┐
│                  EDGE WORKER (Hono) — stateless                         │
│   static assets (PWA)  |  /api/auth,/api/friends,/api/tables,/api/stats │
│   WS upgrade gate: validate session cookie → authorize seat → forward   │
└───────┬───────────────────────────────┬────────────────────────────────┘
        │ stub.fetch (trusted headers)  │ D1 binding
┌───────┴────────────────────────┐   ┌──┴─────────────────────────────────┐
│ TableDO (one per table/game)   │   │ D1 (global relational)             │
│  ┌──────────────────────────┐  │   │  users, sessions, friendships,     │
│  │ engine (pure reducer)    │  │   │  invitations, tables directory,    │
│  │ + bots (same package)    │  │   │  games, game_players, stats,       │
│  └──────────────────────────┘  │   │  game_logs (compressed event log)  │
│  Hibernating WebSockets        │   └────────────────────────────────────┘
│  Timer table + single alarm()  │
│  SQLite: snapshot, events,chat │ ── on game end / pause: summary → D1
└────────────────────────────────┘
```

Dependency rule: `engine` depends on nothing. `bots` depends on `engine`. `protocol` depends on `engine` types. `worker` and `web` depend on all three. The engine never imports Cloudflare, DOM or any randomness source other than its own seeded PRNG.

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| `engine` (shared pure TS) | Game state types, `newGame`, `legalActions(state, seat)`, `apply(state, action) -> {state, events}`, `viewFor(state, seat)`, `redactEvents`. Deterministic: PRNG state lives inside the game state. | Zero-dependency TS package, Vitest + property tests + golden replay fixtures |
| `bots` | `chooseAction(view, seat, level, budgetMs, rng)`; heuristics L1-3, determinized search L4-5 | Pure TS on top of `engine`; runs inside TableDO, also usable in tests and in a Node self-play harness |
| `protocol` | Wire message types (client→server `ActionMsg`, `Hello`, `Chat`; server→client `Sync`, `Events`, `Presence`, `Error`), versioning, validation | TS types + Zod (or Valibot) schemas shared by both sides |
| `board` (geometry) | Logical topology (ring, homes, stables, exits) and the pixel layout JSON for the artwork | Pure data + helpers, consumed by engine (topology only) and by client (pixels) |
| `TableDO` | Sole authority for one table: seats, game state, validation, event log, chat, pause/resume, bot scheduling, persistence | `DurableObject` subclass, SQLite-backed, Hibernation WebSocket API, alarm-driven timers |
| Edge Worker | Static assets, REST API, auth, creating tables, routing/authorizing WS upgrades to the DO | Hono on Workers; Workers Static Assets for the PWA bundle |
| D1 | Cross-table relational data: accounts, friends, invitations, game history, stats, leaderboards | D1 + Drizzle (or Kysely), migrations in repo |
| Client net store | Holds `serverView`, `lastSeq`, reconnect logic, optimistic nothing (server-confirmed only) | Small store (Zustand/Svelte store/signals) + reconnecting WebSocket wrapper |
| Animation director | Consumes server events in order, produces timed animations + audio cues, advances `renderState` | Promise/timeline-based queue, one step per event |
| Board renderer | Draws artwork + pawns + highlights from `renderState` and `board` pixel layout | Image + inline SVG overlay (fake-3D knights), single `viewBox` equal to artwork space |
| Audio engine | Hoof cadence, whinnies, UI sounds, scheduled on the Web Audio clock | Web Audio API; CC0 samples and/or synthesized clops |

## Recommended Project Structure

```
toc/
├── packages/
│   ├── engine/                 # pure rules, no deps
│   │   ├── src/
│   │   │   ├── types.ts        # GameState, PublicState, Action, GameEvent, Card, PawnId
│   │   │   ├── topology.ts     # ring 72, exits, entries, home paths, stables (no pixels)
│   │   │   ├── rng.ts          # seeded PRNG (sfc32/mulberry32), state serializable
│   │   │   ├── deck.ts         # 52 cards, shuffle, deal 5/4/4 rotation, dealer rotation
│   │   │   ├── moves/          # one file per card family: exit, advance, back, seven, jack(swap)
│   │   │   ├── legal.ts        # legalActions(state|view, seat)
│   │   │   ├── reducer.ts      # apply(state, action) -> { state, events }
│   │   │   ├── view.ts         # viewFor(state, seat), redactEvents(events, seat)
│   │   │   └── replay.ts       # replay(initial, actions) for tests and history
│   │   └── test/               # golden games, property tests, rule table tests
│   ├── bots/                   # levels 1-5
│   ├── protocol/               # message schemas, version constant
│   └── board/
│       ├── topology.ts         # re-export of engine topology (single source of truth)
│       └── layout.json         # pixel coords in 2560x2560 artwork space (generated + committed)
├── apps/
│   ├── worker/                 # Hono app, TableDO, D1 schema/migrations, wrangler config
│   │   ├── src/index.ts        # routes + WS gate
│   │   ├── src/table-do.ts     # Durable Object
│   │   ├── src/timers.ts       # timer table + alarm multiplexer
│   │   ├── src/auth/           # sessions, password/passkey, middleware
│   │   └── migrations/         # D1 SQL
│   └── web/                    # PWA client
│       ├── src/net/            # ws client, sync, reconnection
│       ├── src/game/           # renderState, animation director, event→animation mappers
│       ├── src/board/          # renderer, pawn sprites, hit-testing
│       ├── src/audio/          # cues, hoof sequencer
│       └── src/ui/             # lobby, friends, hand, chat, history/stats
└── tools/
    ├── calibrate-board/        # dev page: click squares on artwork to emit layout.json
    └── selfplay/               # Node harness: bot vs bot win rates per level
```

### Structure Rationale

- **Monorepo with workspace packages (pnpm):** the engine MUST be imported identically by Worker, browser and Node tests. Packages enforce the "no platform imports" rule by construction (tsconfig `lib` without DOM/workers types for `engine`).
- **`board` split into topology vs pixels:** rules need only the graph; the client needs coordinates. Keeping pixels out of the engine means re-measuring the artwork never touches rule code or its tests.
- **`tools/calibrate-board`:** the geometry is hand-drawn artwork; a calibration overlay is cheaper and more reliable than guessing coordinates.
- **`tools/selfplay`:** bot levels need measurable strength ordering (L5 beats L4 beats ... in team matches) before shipping the slider.

## Architectural Patterns

### Pattern 1: One Durable Object per table, authoritative event-sourced reducer

**What:** `TableDO` owns the full `GameState`. Every client message is an *intent* (`play card X with move Y`). The DO validates against `legalActions`, runs `apply`, appends resulting `GameEvent[]` to a sequence-numbered log, persists, then broadcasts per-seat redacted events. Clients never send state, only intents.
**When to use:** always, here. A table has 4 seats, so there is no scaling pressure; the DO's single-threaded, input-gated execution gives free serialization of moves.
**Trade-offs:** all game CPU (including bots) is on the table's DO thread. A long bot search blocks that table's message handling, so bot compute is time-boxed (see bots).

```typescript
// engine contract (sketch)
export interface Engine {
  newGame(cfg: GameConfig, seed: number): GameState;
  legalActions(s: GameState | PlayerView, seat: Seat): Action[];
  apply(s: GameState, a: Action): { state: GameState; events: GameEvent[] };
  viewFor(s: GameState, seat: Seat): PlayerView;          // hides other hands & deck
  redact(events: GameEvent[], seat: Seat): GameEvent[];   // strips private payloads
}

// TableDO message handler
async webSocketMessage(ws: WebSocket, raw: string) {
  const { seat } = ws.deserializeAttachment() as { seat: Seat; userId: string };
  const msg = parse(raw);                                   // protocol schema
  if (msg.t === 'act') {
    if (!this.isLegal(seat, msg.action)) return this.send(ws, { t: 'err', code: 'illegal', ref: msg.id });
    const { state, events } = apply(this.state, msg.action);
    this.commit(state, events);                              // sqlite txn: snapshot + events
    this.broadcast(events);                                  // per-seat redaction
    this.scheduleNext();                                     // bot turn / turn timeout via timer table
  }
}
```

### Pattern 2: Hibernation-safe DO — SQLite is the source of truth, memory is a cache

**What:** Use `ctx.acceptWebSocket(ws, [tags])` (Hibernation API) so idle tables cost nothing while sockets stay connected. In-memory fields are reset on hibernation and the constructor re-runs, so the DO rebuilds `this.state` from SQLite inside `blockConcurrencyWhile` in the constructor. Per-socket identity (`userId`, `seat`) goes in `ws.serializeAttachment()` (limit 16 KB, lost when the socket closes); everything else is in SQLite. Never use `setTimeout`/`setInterval` for bot delays or pause deadlines: they keep the DO in memory (defeating hibernation, incurring duration charges) and vanish on eviction. Use alarms.
**When to use:** always.
**Trade-offs:** every event handler must be written as "load → act → store", never relying on instance fields surviving between messages.

```typescript
export class TableDO extends DurableObject<Env> {
  state!: GameState; seq = 0;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => this.hydrate());   // reads snapshot + last seq from ctx.storage.sql
  }
}
```

SQLite schema inside the DO (one DB per table):

```sql
CREATE TABLE meta     (k TEXT PRIMARY KEY, v TEXT);                 -- status, seed, config, dealer, pausedAt
CREATE TABLE snapshot (id INTEGER PRIMARY KEY CHECK (id=1), seq INTEGER, state TEXT); -- full server state JSON
CREATE TABLE events   (seq INTEGER PRIMARY KEY, actor INTEGER, action TEXT, events TEXT, ts INTEGER);
CREATE TABLE seats    (seat INTEGER PRIMARY KEY, kind TEXT, user_id TEXT, bot_level INTEGER, last_seen INTEGER);
CREATE TABLE timers   (id TEXT PRIMARY KEY, at INTEGER, kind TEXT, payload TEXT);
CREATE TABLE chat     (id INTEGER PRIMARY KEY AUTOINCREMENT, seat INTEGER, text TEXT, ts INTEGER);
```

Snapshot after every action (state is a few KB; SQLite writes in a DO are synchronous and cheap) and also append the action to `events`. Snapshot gives O(1) resume; the log gives replay, debugging, and the history artifact.

### Pattern 3: Timer table multiplexed onto the single alarm

**What:** A DO has exactly one alarm at a time, but TOC needs several time-based behaviours: bot "thinking" delay, human turn timeout (optional), disconnect-pause deadline, idle expiry/purge. Keep a `timers` table; after any change set `setAlarm(min(at))`; in `alarm()` run all due timers, delete them, reschedule the next. Handlers must be idempotent (alarms are at-least-once and retried on exception): each timer carries the `seq` it was created for and is a no-op if `state.seq` has moved on.
**When to use:** always for anything time-driven in the DO.
**Trade-offs:** small amount of custom scheduler code; pays for itself immediately.

```typescript
async alarm() {
  const now = Date.now();
  for (const t of this.sql.exec(`SELECT * FROM timers WHERE at <= ? ORDER BY at`, now)) {
    this.sql.exec(`DELETE FROM timers WHERE id = ?`, t.id);
    await this.runTimer(t);          // 'bot_turn' | 'pause_deadline' | 'turn_timeout' | 'purge'
  }
  this.rearmAlarm();
}
```

Bot turn flow: after any commit, if the next actor is a bot and the game is running, insert a `bot_turn` timer at `now + humanLikeDelay(level)` (0.6–1.8 s, and longer than the previous move's animation duration so clients are done animating; see Animation section). `runTimer('bot_turn')` calls `chooseAction`, `apply`, commit, broadcast, schedule next. The same path handles a bot that must also "discard a whole unplayable hand" and the card-exchange phase.

### Pattern 4: Disconnect → pause → deadline

**What:** On `webSocketClose`/`webSocketError`, record `last_seen` for the seat; if the game is `running` and a human seat now has zero sockets (`ctx.getWebSockets('seat:N').length === 0`), set `status='paused'`, broadcast `Paused{seat, deadline}`, add `pause_deadline` timer. On reconnect with a valid seat: clear the timer, `status='running'`, broadcast `Resumed`, re-arm any bot timer that was cancelled by the pause. At deadline (value is an open question; suggest 5 min configurable): either the abandoning seat is handed to a bot of a chosen level (recommended default, keeps the game going) or the table is archived as "suspended" (resume later). Both must be a config of the table.
**When to use:** matches PROJECT.md "pause until return, with a maximum delay".
**Trade-offs:** while paused with zero sockets total the DO hibernates/evicts with the alarm still armed; the alarm will wake it at the deadline. This is exactly the right cost profile.

### Pattern 5: Hidden information by construction (server state ≠ client view)

**What:** `GameState` (server only) contains deck order, all four hands, the PRNG state, and the cards each player has passed. `PlayerView` (what a seat may know) contains: public board, own hand, hand *sizes* of others, discard pile / all cards played so far (public in physical play), own pending/received exchange card, whose turn, phase. The DO never serializes `GameState` to a socket; it sends `viewFor(state, seat)` for sync and `redact(events, seat)` for deltas.
- Card exchange: each player picks a card to pass face-down. Events: `CardPassed{from,to}` is public (without the card); the *recipient* gets the private variant `CardReceived{card}` only once both of the pair have chosen (apply the swap atomically for the pair; avoids a player seeing the incoming card before choosing). A passer must remember what they passed: the view keeps `passedCard` for that seat only.
- Unplayable hand: "pose toute sa main" reveals those cards publicly (`HandDiscarded{seat, cards}`), this is real information every client (and the bots) may use.
- Played cards are public via `CardPlayed{seat, card}`; clients can show a played-cards history, bots can count cards.
**When to use:** always. Never send other hands "hidden by CSS".
**Trade-offs:** engine API must be written from the start around `PlayerView` so `legalActions` works on a *view* (public board + own hand + phase), which is also what the client needs for move highlighting. Do this early, retrofitting is painful.

### Pattern 6: Events as the animation contract (and as the log)

**What:** `apply` returns a short ordered list of semantic events. The same events are (a) appended to the log, (b) broadcast, (c) consumed by the client animation director. Events describe *what happened with enough geometry to animate*, not UI timings.

```typescript
type GameEvent =
  | { t: 'dealt'; round: number; dealer: Seat; counts: number[] }           // hand contents private: 'handDealt'
  | { t: 'handDealt'; seat: Seat; cards: Card[] }                           // private to seat
  | { t: 'cardPassed'; from: Seat; to: Seat }                               // public, no card
  | { t: 'cardReceived'; seat: Seat; card: Card }                           // private
  | { t: 'cardPlayed'; seat: Seat; card: Card }
  | { t: 'pawnExited'; pawn: PawnId; to: SquareRef }                        // stable slot → exit square
  | { t: 'pawnMoved'; pawn: PawnId; path: SquareRef[]; card: Card; dir: 1 | -1 }  // path includes every square traversed
  | { t: 'pawnCaptured'; by: PawnId; victim: PawnId; at: SquareRef }        // the eater's arrival
  | { t: 'pawnSentHome'; pawn: PawnId; to: SquareRef /* stable slot */ }   // the victim's trip back
  | { t: 'pawnsSwapped'; a: PawnId; b: PawnId; aTo: SquareRef; bTo: SquareRef }
  | { t: 'pawnEnteredHome'; pawn: PawnId; path: SquareRef[]; slot: 0|1|2|3 }
  | { t: 'handDiscarded'; seat: Seat; cards: Card[] }
  | { t: 'turn'; seat: Seat } | { t: 'roundEnded' } | { t: 'teamCompleted'; team: 0|1 }
  | { t: 'paused'; seat: Seat; deadline: number } | { t: 'resumed' } | { t: 'seatTaken'; seat: Seat; by: 'bot'|'human' }
  | { t: 'gameWon'; team: 0 | 1 };
```

Ordering rules (documented in the engine and covered by tests): for one action, `cardPlayed` first; then for each pawn movement in order `pawnExited|pawnMoved|pawnsSwapped`; capture events immediately after the movement that caused them (for a 7, a capture mid-path is emitted between the `pawnMoved` segments, with the path split at the capture square so the director can fire the capture beat at the right moment); `turn` last. Every event carries the log `seq` of its action plus its index so the client can dedupe after reconnect.
**When to use:** always. This is what makes "save/resume", "replay a past game", and "sequenced animation with sound timing" the same mechanism.
**Trade-offs:** events must be designed with the animation needs in mind from the start (path arrays, split 7 segments); cheap now, expensive to add later.

### Pattern 7: Client = authoritative `serverView` + lagging `renderState` + animation queue

**What:** The client keeps two states. `serverView` is updated immediately when a message arrives and is what the UI uses for logic (is it my turn, which cards are playable, legal destinations). `renderState` is what is drawn (pawn positions, hand contents, counters) and is advanced *only* by the animation director, event by event, each step returning a Promise that resolves when its animation ends. Input is disabled while `renderState.seq < serverView.seq` (queue not drained) to avoid clicking against an outdated board. On reconnect, the client sends `{t:'hello', lastSeq}`; the server replies with the missed (redacted) events if still in its log window, else a full `sync` view; for a full sync the director fast-forwards (snaps `renderState = serverView`, no animation) so a returning player is not forced to watch 40 events.

```typescript
class Director {
  queue: GameEvent[] = []; running = false;
  push(evs: GameEvent[]) { this.queue.push(...evs); if (!this.running) void this.drain(); }
  async drain() {
    this.running = true;
    while (this.queue.length) {
      const ev = this.queue.shift()!;
      await this.play(ev);              // animate + schedule audio; then render.apply(ev)
    }
    this.running = false;
  }
}
```

Mapping events → animation → sound (duration derived from distance, matches PROJECT.md "vitesse dépend de la distance"):

| Event | Animation | Audio |
|-------|-----------|-------|
| `cardPlayed` | card flies from hand/seat to the central green mat, held ~400 ms so everyone reads it | card slap |
| `pawnExited` | pawn hops stable slot → exit square | single hoof + short whinny |
| `pawnMoved` (N squares) | tween square-to-square along `path`; per-square ease; total time `clamp(120ms * N^0.8, 350, 1800)` | one clop on landing of each square, scheduled on the Web Audio clock from the same per-square timestamps so cadence follows speed; gallop pattern when N ≥ 7 |
| `pawnCaptured` | eater arrives with a bump + dust puff, victim flashes | whinny (eater), impact |
| `pawnSentHome` | victim arcs back to its stable slot | descending whinny |
| `pawnsSwapped` | both pawns lift, cross along arcs, land | swoosh + two clops |
| `pawnEnteredHome` | pawn runs along home diagonal, settles with glow | triumphant whinny |
| `handDiscarded` | fan of cards flips face up onto mat | soft card flips |
| `paused/resumed` | overlay with seat name + countdown | none |

Per-square clops (rather than a looped sample) are the simplest way to make the cadence follow speed and stay locked to the visual: the tween's per-square callbacks and the audio schedule both derive from the same `stepTimes[]` array. Unlock the AudioContext on first user gesture (iOS requirement). Bots' move delay on the server must exceed the longest animation of the previous event batch, or clients that are slower will accumulate a queue; the server can compute an estimated animation duration from events with the same function the client uses (put `estimateDuration(events)` in `protocol` or `board`). Respect `prefers-reduced-motion` and a mute toggle.

### Pattern 8: Board geometry as a graph + a separate pixel layout

**What:** Logical model (engine, no pixels):
- Ring positions `r ∈ [0,72)`; direction of play is increasing `r`: blue → yellow → red → green, which is clockwise on the assembled board (yellow top-left, red top-right, green bottom-right, blue bottom-left).
- Let each color's **exit square** (the numbered "18" diamond) sit at ring index `exit[c]`. Following PROJECT.md: blue exit = 0, yellow = 18, red = 36, green = 54 (any consistent origin works). The printed numbers 1–18 of a quarter are `r - exit[previous color]`.
- **Entry square** for color `c` is the printed "16" of its own quarter: `entry[c] = exit[c] - 2` (mod 72). A pawn leaving the exit travels 70 squares to reach its entry, then turns into the home path (4 squares) instead of continuing to 17/18.
- Pawn location type: `{ zone: 'stable', slot: 0..3 } | { zone: 'ring', r } | { zone: 'home', slot: 0..3 }`, plus a per-pawn `progress` (squares traveled since leaving the exit, 0..70 on the ring, 71..74 in home) that answers "has this pawn gone around?" and "how many squares until home?" without modular arithmetic bugs. `progress` is derivable but should be stored; it makes entry-with-exact-count and "cannot jump over a pawn already home" trivial.
- Pixel layout (`layout.json`, in artwork space 2560 × 2560 = 2 × 1280 quarters): `ring[72] -> {x,y}`, `home[color][4]`, `stable[color][4]`, plus `pawnAnchor` offset (foot point of the knight sprite relative to the square center) and optional `cardMat` rect. The SVG overlay uses `viewBox="0 0 2560 2560"` so all pixel data is resolution-independent and scales to phone/desktop with CSS only.
- Generating the layout: the four quarters are presumably the same drawing rotated by 90° steps. Measure ONE quarter with `tools/calibrate-board` (click each of 18 ring squares, 4 home, 4 stable), then derive the other three by rotating about (1280, 1280) and *overlay-verify* on the real images (hand-drawn art may deviate by a few pixels; the tool lets you nudge and writes the final JSON). Add tests: 72 distinct points, consecutive ring points roughly uniform distance, rotation consistency within tolerance. Also verify that the quarters really are laid out as rotated copies (aide-mémoire text orientation suggests each quarter may be drawn upright rather than rotated).
- Paths for animation = polyline through consecutive square centers (corner squares already encode the bends); stable→exit and entry→home are straight segments between layout points.
- Z-order: pawns sorted by y so lower pawns overlap higher ones (fake 3D). Drop shadow is a separate ellipse at the foot anchor.
- Orientation: keep the board fixed like the physical game in v1 (aide-mémoire text on the art stays legible). Rotating the board so the local seat is always at the bottom is a possible later toggle; it requires rotating only the art+pawns group and counter-rotating labels, and the art's text will end up upside-down for 3 of 4 players.

**When to use:** from the first rendering milestone; the topology part is needed by the engine on day one.

## Data Flow

### Request Flow (a move)

```
Player taps card, pawn, destination (client previews with engine.legalActions(view))
    ↓ {t:'act', id, baseSeq, action}
Browser WS ──► Edge Worker (only at connect time; messages go straight to the DO socket)
    ↓
TableDO.webSocketMessage: check seat == actor, status == running, baseSeq == seq (or turn match)
    ↓ legalActions contains action?  no → {t:'err'}
apply(state, action) → events;  SQLite txn: snapshot + events row
    ↓
broadcast: for each seat socket → { t:'ev', seq, events: redact(events, seat) }
    ↓                                   ↓
Client net store: serverView = applyView(view, evs)    Director.push(evs) → animation + audio
    ↓
scheduleNext(): if next actor is a bot → timers.insert(bot_turn, now+delay); setAlarm(...)
```

### State Management (client)

```
WS message ──► serverView (immediate)  ──► UI logic (turn, playable cards, highlights)
        └───► Director queue ──► renderState (advanced per animation) ──► board/hand drawing
User input ──► {t:'act'} only when renderState.seq == serverView.seq and it is my turn
```

### Key Data Flows

1. **Connect / reconnect:** Client calls `GET /api/tables/:id/ws` (same-origin, session cookie). The Worker verifies the session (cookie → D1/KV lookup, cached), checks the user has a seat or invitation for this table (D1 `tables`/seats mirror or ask the DO), then forwards the upgrade request to `env.TABLE.get(env.TABLE.idFromName(tableId))` with internal headers (`x-user-id`, `x-seat`) — headers set by the Worker are trusted because only the Worker can reach the DO. The DO accepts with `ctx.acceptWebSocket(server, ['seat:N','user:ID'])`, attaches `{userId, seat}`, replies with `sync` (view + `seq`) or the missed events since `hello.lastSeq`, and, if the game was paused for this seat, resumes. Browsers cannot set custom headers on `WebSocket`, so identity travels in the cookie (preferred) or a short-lived signed ticket in the query string obtained from `POST /api/tables/:id/ticket`.
2. **Table lifecycle:** `POST /api/tables` (Worker): creates a D1 `tables` row with a short code (e.g. 6 chars), calls `stub.init({config, creator})`. Friends are invited via D1 `invitations`; joining claims a seat (DO is authoritative for seat assignment; D1 mirror updated by the DO or by the Worker after the DO call). Empty seats are configured as bots with a level 1–5 at creation or later in the lobby; solo = 1 human + 3 bots.
3. **Start / deal / exchange:** Host starts: DO builds `GameState` with `seed = crypto.getRandomValues`, deals 5/4/4 with dealer rotation, enters `phase:'exchange'`. Each player (human or bot) submits `passCard`; once both partners have, the swap is applied atomically; then play begins with the player after the dealer. The shuffle uses the engine PRNG so the whole game is reproducible from `seed` + action log (store the seed server-side only; never send it to clients, it would reveal the deck).
4. **Round loop:** each turn the actor plays one card (or, with no legal move, the engine produces a forced `discardHand`, which for humans can be an explicit "I can't play" confirmation or automatic; recommend automatic after a short visible beat). When all hands are empty, the next deal (4 cards) happens, re-shuffling after the cycle. Note 5+4+4 = 13 cards per player, i.e. 52 cards for 4 players: exactly one deck per cycle, so the engine must model "deal number within the cycle" explicitly (5, then 4, then 4, then reshuffle; dealer rotates per PROJECT.md). Verify with Romain whether the 5-card deal counts the exchanged card.
5. **Game end:** on `gameWon`, the DO writes a summary row (+ player rows + compressed event log) to D1 in one `batch()`, marks the table `finished`, and schedules a `purge` timer (e.g. 24 h to allow rematch/replay viewing) after which the DO calls `deleteAll()` (deletes the alarm too under the current compat flag). D1 write failure must not lose the result: keep `meta.pending_d1_sync=1` and retry from the alarm until it succeeds.
6. **Save / resume:** "Arrêter une partie" = status `suspended` (no sockets required). State is already durable in the DO's SQLite and the table row remains in D1 (`status='suspended'`, players, last activity). "Reprendre": any seated human opens the table; the Worker routes to the same DO name; the DO rehydrates, waits until all humans are connected (or bot-fills per config), then resumes. No export/import machinery is needed as long as DO storage is the source of truth until the game ends (and suspended games get a long purge TTL, e.g. 60 days, refreshed on activity).
7. **History and stats:** D1 only. `games(id, table_id, started_at, ended_at, winner_team, rounds, seed_public_hash)`, `game_players(game_id, seat, user_id|null, bot_level|null, team, pawns_home, captures_made, captures_suffered, ...)`, `game_logs(game_id, blob)` (gzip JSON of actions + seed revealed *after* the game, which makes full replay possible). Stats are computed by SQL aggregates or incrementally in `stats` tables on game end; friends leaderboard = query joined with `friendships`.
8. **Chat:** messages go through the DO (last N in its SQLite, broadcast to all sockets, also delivered to spectators later if added); rate-limited per seat; not persisted to D1 (privacy, simplicity).

## Persistence split

| Data | Store | Why |
|------|-------|-----|
| Live game state, event log, timers, chat, seats | DO SQLite (per table) | Strongly consistent, transactional with the logic that mutates it, zero-latency reads; 10 GB limit per object is vastly oversized; SQLite-backed DOs are the only kind on the free plan |
| Accounts, sessions, friendships, invitations, table directory | D1 | Cross-table queries, listings ("my tables", "my friends"), the Worker can read without waking DOs |
| Finished games, per-player stats, leaderboards, compressed logs | D1 (logs in a blob column; move to R2 only if rows get large — a game is roughly several hundred events, tens of KB compressed) | Relational aggregates |
| Session cache, rate-limit counters | KV (optional) or just D1 | Do not add KV until D1 session lookup is measured to be a problem |
| Web Push subscriptions (optional "your turn" / invitation) | D1 | Later phase |

Avoid: querying D1 inside the hot move path (keep the move loop DO-local); storing live game state in D1 (consistency + latency); using KV for anything that must be read-after-write.

## Auth and session flow

- Accounts in D1. Recommended: a mature auth library that supports Workers + D1 (Better Auth is the current leading choice; Lucia is deprecated) or a small hand-rolled implementation: username/email + password hashed with PBKDF2 (WebCrypto, available in Workers) or an Argon2/scrypt WASM lib, opaque session token in an `HttpOnly; Secure; SameSite=Lax` cookie, session rows in D1. Optional later: passkeys and magic links. For a family/friends product, add an invite code or email allow-list at signup to avoid public signups (matches "no strangers" scope). (MEDIUM confidence on library choice; STACK.md should decide.)
- Worker middleware `requireUser` runs on `/api/*` and on the WS gate. The DO never talks to the user database; it trusts only the headers the Worker adds, and re-checks the seat→user mapping stored in its own `seats` table (a user who is not seated and not invited gets 403 at the gate).
- Friends: `friendships(user_a, user_b, status)` with request/accept; invitation to a table = row in `invitations(table_id, to_user, from_user, seat?)`. Notify via in-app list refreshed on focus; Web Push later. A per-user "presence/inbox" Durable Object is the standard upgrade if live friend presence or instant invitations are wanted; defer it, it is not on the v1 critical path.
- Bots are seats without sockets or users; never give a bot a session.

## Bot AI design (runs inside TableDO)

All bots act on a **PlayerView only** (their own hand + public info) to guarantee fairness; they never read `GameState` hands of others. Determinization (sampling plausible hidden hands) is the only way they "see" the unknown.

| Level | Method | Notes |
|-------|--------|-------|
| 1 | Uniform random among `legalActions` | Required by PROJECT.md; also the baseline for self-play |
| 2 | One-ply greedy with fixed priorities: capture opponent > enter home > leave stable > advance the most advanced pawn that is safe; never capture own; avoid stopping directly ahead of an opponent pawn in reach | Cheap, human-recognizable |
| 3 | One-ply weighted evaluation `eval(state)` (progress sum for team, pawns in home, opponent progress, exposure to opponent reach, blocked exit, partner pawns that could be eaten/saved) with random tie-breaks and a little noise; plays the Jack (swap) and 7 (split) by evaluation; passes the exchange card by simple rules (give strong cards like K/A/7 to partner when partner needs exit) | Team-aware but myopic |
| 4 | Determinized expectimax/PIMC: sample K=20–50 consistent hidden-hand assignments (unseen cards = full deck − played − own hand − known passed card; deal the remainder among the other 3 seats with correct sizes), for each candidate action evaluate with a depth-2 expectimax (my move, then opponents' best replies under the sample) using the L3 evaluation; pick the action with the best average. Uses partner knowledge: the card it passed and received. | Classic perfect-information-Monte-Carlo; known weakness "strategy fusion" is acceptable here |
| 5 | Information-set MCTS (or PIMC with random/epsilon-greedy rollouts guided by L2/L3 policies) with time budget; models partner cooperation (maximize team value, not own pawn count), includes exchange-phase reasoning (which card to pass given own hand and what partner likely needs), cards counting (public played cards), and end-game logic when a player has finished and plays the partner's pawns | Budget-bound; see below |

Operational constraints:
- **Compute budget:** the DO is single-threaded; a bot search blocks only its own table, but exceeding the CPU limit kills the request. Default per-request CPU is 30 s on the paid plan (configurable), and much lower on the free plan, so budget by wall-clock with an explicit `deadline` checked every N iterations (L4 ~150 ms, L5 ~400–800 ms) and always keep a fallback (the best-so-far or L3 choice). Consider that a "thinking" delay is a UX feature too: the bot timer fires at `now + max(minDelay, 0)`, search takes ≤ budget, so total feels like 1–2 s.
- **Branching:** the 7 is the combinatorial hazard (partitions of 7 across up to 4, or 8 with partner's, pawns, with path-dependent captures). Generate legal 7-moves as ordered sequences of `{pawn, steps}` parts with pruning (max 3 parts), cap candidates for the search at the top-N by L3 heuristic, but keep the full set for L1/L2 and for legality validation.
- **Determinism and testability:** bots take an injected seeded RNG; self-play harness (`tools/selfplay`) runs thousands of games per level pair in Node; acceptance criterion = monotonic strength (L(n+1) as a team beats L(n) clearly), plus a "no illegal move ever" property test on random states.
- **If compute ever becomes an issue,** offload L5 to a separate stateless Worker called via a service binding with the `PlayerView` (not the state): it keeps the table's DO responsive and scales horizontally. Not needed for v1; keep `chooseAction` pure and view-based so this is a one-day change.
- **Seat takeover:** a human seat converted to a bot (deadline passed) uses the same `chooseAction` with the level chosen for that table.

## Rules questions that change the data model

These are the PROJECT.md open questions; the engine should expose them as config flags so tests cover both outcomes and Romain can decide late:

| Question | Engine representation |
|----------|----------------------|
| 7 passes over own pawns without eating | `sevenPassesOwn: true` default (hypothesis in PROJECT.md) |
| 4 backward from exit square | stored `progress` is clamped/handled via `backwardWraps`; with the hypothesis, a pawn moved back from its exit has `progress = 68` semantics (it must go around again to reach entry; it cannot enter home backwards). Decide whether progress is allowed to be negative or is modulo 72 |
| Must complete a lap to enter home | default true: entry only possible when `progress` reaches 70 by moving forward |
| Pause maximum + what happens after | `pauseDeadlineMs`, `onPauseExpiry: 'bot'|'suspend'` |
| Pawn on exit square is impassable | blocker check in the step-by-step path walker, applied to every movement kind (forward, backward, 7 parts, swap targets, capture targets); the blocking pawn itself may leave the square |
| Card 5 moves only own pawns, but a finished player controls the partner's pawns | per-seat controlled-pawn set; ask Romain whether, for a finished player, the 5 applies to the partner's pawns (the only ones left) |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| Family + friends (tens of users, a few concurrent tables) | This design as is; the free Workers plan with SQLite-backed DOs likely suffices at first, paid plan ($5) once WebSocket message volume or daily request limits matter (verify free-tier daily limits when budgeting; incoming WebSocket messages are billed at a ratio) |
| Hundreds of concurrent tables | Still trivially fine: DOs are independent; batching/coalescing server events per action (already one message per action) keeps request counts low; hibernation makes idle tables free |
| Thousands+ (not a target; public matchmaking is out of scope) | D1 write rate for stats is the first thing to look at (batch writes at game end only, already the design); presence DO per user; R2 for logs |

### Scaling Priorities

1. **First bottleneck:** bot CPU inside the DO at L4/L5 → time-boxed search, then service-binding offload.
2. **Second bottleneck:** D1 reads on every WS connect (session validation) → short-lived signed ticket or KV session cache.

## Anti-Patterns

### Anti-Pattern 1: Sending full state or all hands to clients

**What people do:** broadcast `GameState` and hide other hands in the UI.
**Why it's wrong:** trivial cheating from devtools; defeats the server-authority requirement; partner exchange leaks.
**Do this instead:** `viewFor`/`redact` per seat, enforced in one place (the DO broadcast function) and covered by a test that asserts no foreign card appears in any message to a seat.

### Anti-Pattern 2: `setTimeout` for bot moves and pause deadlines

**What people do:** `setTimeout(() => botMove(), 1000)`.
**Why it's wrong:** blocks hibernation (continuous duration billing), is lost on eviction/deploy, so a bot's turn can be silently dropped and the game freezes.
**Do this instead:** timers table + `setAlarm`, idempotent handlers keyed by `seq`.

### Anti-Pattern 3: Treating DO memory as the game state

**What people do:** keep `this.game` as the only copy and persist "occasionally".
**Why it's wrong:** hibernation, eviction, deploys and crashes reset memory; a half-written move loses the game.
**Do this instead:** commit snapshot + event log in the same SQLite transaction as every move; constructor rehydrates.

### Anti-Pattern 4: Animating from state diffs on the client

**What people do:** diff old and new positions and guess what happened.
**Why it's wrong:** cannot distinguish a capture from a swap, cannot give a 7 with two parts and a mid-path capture the right choreography, breaks on reconnect.
**Do this instead:** animate from server events; use the diff only for fast-forward after a full sync.

### Anti-Pattern 5: Rules duplicated in client and server

**What people do:** reimplement move legality in the UI for highlighting.
**Why it's wrong:** drift = highlighted moves the server rejects (or vice versa), especially around exit-square blocking and 7 splits.
**Do this instead:** one `engine` package; the client calls `legalActions(view, mySeat)` and the server re-validates.

### Anti-Pattern 6: Pixel coordinates inside rule data

**What people do:** hard-code x,y in the board model used by the rules.
**Why it's wrong:** any art tweak forces rules changes and retesting.
**Do this instead:** topology in the engine, pixels in `layout.json` generated by the calibration tool.

### Anti-Pattern 7: Non-deterministic engine

**What people do:** `Math.random()` inside the reducer or bots.
**Why it's wrong:** replay, golden tests, self-play reproducibility and "resume exactly" all break.
**Do this instead:** PRNG state inside `GameState`; bots receive their own seeded RNG; `Date.now()` only in the DO shell, never in the engine.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Cloudflare Workers Static Assets | PWA bundle served by the same Worker (SPA fallback) | One deployment, same origin → cookies and WS need no CORS |
| D1 | Binding in Worker (and in DO only for the end-of-game summary write) | Keep migrations in repo; use `batch()` for the end-of-game write |
| Durable Objects | `new_sqlite_classes` migration for `TableDO` | SQLite backend is mandatory on the free plan and recommended elsewhere |
| Email (magic link, password reset, optional) | Transactional provider via Worker fetch | Only if email auth chosen; not needed for username+password |
| Web Push (optional) | VAPID from Worker; subscriptions in D1 | Installed PWA on iOS 16.4+ supports it; defer |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| web ↔ worker REST | JSON over HTTPS, cookie auth | Friends, tables, stats, history |
| web ↔ TableDO | WebSocket JSON messages, `protocol` types, `seq`-numbered; batch bot/chat bursts if needed | One socket per table per client; `hello{lastSeq}` handshake; protocol version in `hello` so an old cached PWA can be told to reload |
| Worker ↔ TableDO | `stub.fetch` for upgrade (+ RPC methods `init`, `claimSeat`, `status`) | RPC is available on DO stubs; keep the surface tiny |
| TableDO ↔ D1 | Summary write on end / suspend, retried via alarm | Never on the move path |
| engine ↔ everything | Plain function calls on plain JSON-serializable data | State must be `structuredClone`-able and JSON-safe (no Maps/Sets/classes) |
| bots ↔ engine | `PlayerView` in, `Action` out | Never `GameState` |

## Suggested Build Order (roadmap implications)

Dependencies drive the order; each step is testable without the next.

1. **Foundations: monorepo, topology and `board` layout.** Ring/home/stable/exit/entry topology in engine; `calibrate-board` tool and `layout.json`; static board render with the four quarter images and debug markers on all 72+16+16 squares. Rationale: geometry is a hard prerequisite for rules, rendering and animations, and the calibration is manual and risky (flag: LOW confidence until measured).
2. **Rules engine (pure).** Cards, deck/deal/dealer rotation, exchange phase, legal move generation for every card (A, K, Q, J swap, 7 split with captures, 4 back, 5 own pawns), exit-square blocking, exact-count home entry, hand discard, partner-pawn control after finishing, win detection, events, `viewFor/redact`, replay. Heavy test investment (table-driven per card, property tests, golden games). Resolve the PROJECT.md rule questions as config flags here. This is the highest-value, lowest-risk-to-defer-nothing phase: everything else depends on it.
3. **Local playable prototype (no network).** Client renders `renderState` from engine state with a hot-seat/L1 random bots; implement the Director with events → animations → Web Audio hoof cadence. Validates the animation contract (event shapes, 7 segments) *before* the network layer fixes them. Pawn sprites (fake 3D) and sound design happen here.
4. **TableDO + protocol + Worker gate (single table, anonymous dev auth).** Hibernating WebSockets, SQLite persistence (snapshot + log), hello/sync/reconnect, timers table + alarm, pause/resume, bot seats using L1. Multi-browser playtest works end-to-end.
5. **Accounts, friends, table lobby, invitations (D1 + auth).** Real auth, seat claiming, invite flow, table codes, solo/with-bots creation; PWA install, manifest, service worker for shell caching (never cache WS; version-gate with protocol version).
6. **Bots L2–L5 + self-play harness.** Independent of the network after step 2; can be parallelized with 4–5. L4/L5 need the profiling pass inside a real DO.
7. **History, stats, leaderboard, suspend/resume UX, replay viewer.** End-of-game D1 writes, game log blobs, replay reusing the Director with the stored events.
8. **Polish and hardening:** chat moderation/rate limits, reduced motion, accessibility, push notifications, orientation options, load/fault tests (kill DO mid-game, reconnect storms, clock skew), bandwidth batching if needed.

Research flags: Phase 1 (geometry measurement) and Phase 6 (bot strength/performance in DO) need hands-on validation; phases 2, 4, 5 follow well-known patterns; Phase 3's animation timing is a design iteration, not a research problem.

## Sources

- Cloudflare Durable Objects documentation (WebSocket Hibernation API, `acceptWebSocket`/tags/limits incl. 32,768 sockets per DO, `serializeAttachment` max 16,384 bytes, `setTimeout`/alarms prevent hibernation, hibernated state resets and constructor re-runs), https://developers.cloudflare.com/durable-objects/best-practices/websockets/ and https://developers.cloudflare.com/durable-objects/api/state/ — HIGH
- Durable Objects alarms: one alarm per object, at-least-once with retries; `ctx.abort({retryAlarm:false})`; alarm wall time 15 min; `deleteAll()` now also deletes alarms (compat flag default since 2026-02-24) — https://developers.cloudflare.com/changelog/product-group/storage/ , https://developers.cloudflare.com/workers/configuration/compatibility-flags/ — HIGH
- SQLite-backed Durable Objects: GA, 10 GB per object, only backend on the Workers Free plan, SQLite storage billing from Jan 2026 for paid plans — https://developers.cloudflare.com/durable-objects/platform/pricing/ and the SQLite GA changelog — HIGH
- Workers limits (alarm handler wall time, CPU-time limits) — https://developers.cloudflare.com/workers/platform/limits/ — HIGH (verify the exact CPU limits for the chosen plan before sizing bot budgets)
- General patterns (event sourcing/deterministic reducers for turn-based games; perfect-information Monte Carlo and Information-Set MCTS for imperfect-information card games: Cowling, Powley, Whitehouse 2012 "Information Set Monte Carlo Tree Search"; Long et al. 2010 on PIMC) — MEDIUM (from training knowledge, not re-fetched in this session)
- Project context: /home/user/toc/.planning/PROJECT.md (board layout, house rules, constraints)

---
*Architecture research for: real-time multiplayer card-driven board game (TOC) on Cloudflare*
*Researched: 2026-10-13*
