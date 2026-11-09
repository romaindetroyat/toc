# Phase 5: Suivi, apprentissage et finition - Research

**Researched:** 2026-11-07
**Domain:** Results recording on Cloudflare D1 (online seats linked to accounts, client-claimed solo reports), history/stats/ranking API, a scripted lesson layer over the existing engine and game UI, a rules sheet with rule figures, an accessibility audit with axe in Playwright
**Confidence:** HIGH on the codebase findings (read this session), MEDIUM on platform limits (not re-readable here: developers.cloudflare.com is not reachable from this session)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### What counts
- **D-01: History and stats cover online tables AND solo games**, when the player is signed in. A solo game is reported to the server when it ends. Romain: « En ligne et solo (Recommandé) ». The server must treat a solo report as client-claimed (no server authority over a local game): it may count in personal stats, never in the friends ranking (see D-02).
- **D-02: The friends ranking counts only games with at least two humans with an account** (as partners or opponents). Solo games count in personal stats, not in the ranking. Romain: « Avec au moins 2 humains (Recommandé) ».
- **D-03: Guests and computers appear in other players' history by their name**: « Mamie (invitée) », « Pur-sang ». They have no stats of their own. Romain: « Oui, par son prénom (Recommandé) ».
- **D-04: History starts fresh with phase 5.** The existing anonymous `games` rows are not linked to accounts. Romain: « On repart de zéro (Recommandé) ». Recording which account sat in which seat is new (a new migration; never change the DO migration tag v1).

#### In-game help (PLAY-06)
- **D-05: A « Règles » sheet only**, reachable at any time in a game (and from the home). No line explaining the touched card under the hand. Romain: « Feuille seulement », confirmed « Pas de ligne ».
- **D-06: The sheet's text is a short, simple rewrite of RULES.md** (goal, each card's effect, safe squares, home entry, the 7, the Valet, the exchange, G14/G15/G18 house rules), illustrated with the existing rule figures. Romain reviews the text. Romain: « Tiré de RULES.md (Recommandé) ».

#### Tutorial (APP-04)
- **D-07: Prepared lessons**: a sequence of short set-up situations with cards and knights already placed — exit with As/Roi, move, capture, the 4 backwards, the Valet swap, the split 7, entering home, the exchange card. About one minute each, each ending with « Bravo », about 10 minutes in all. Romain: « Leçons préparées (Recommandé) ».
- **D-08: Offered both at first launch and on the home**: the first time, « Première fois ? Apprendre en 10 minutes », skippable; afterwards a permanent entry on the home and in the « Règles » sheet. Romain: « les deux : la première fois et sur l'accueil ».
- **D-09: A guide that talks**: short bubbles, using « tu », with a halo on the card and the knight to touch. A wrong choice is explained and the step is retried; no failure state. Romain: « Un guide qui parle (Recommandé) ».

#### Addendum (Romain, 2026-11-07, after the UI spec)
- **D-10:** `@axe-core/playwright` approved as a test-only dev dependency for the APP-05 audit. « Oui (Recommandé) »
- **D-11:** Shape marks on the knights' bases (round, square, triangle, diamond), shown by default, with a switch in « Réglages » to hide them. « Oui, désactivable »
- **D-12:** Guests appear as « Prénom (sans compte) », gender-neutral. Supersedes the « (invitée) » example in D-03.
- **D-13:** Friends ranking: all online games with at least two account holders; you enter after 5 such games; order by win rate, then wins, then games; a « Comment ça marche ? » sheet. « Oui (Recommandé) »
- The remaining « À confirmer » items in 05-UI-SPEC.md stand as proposed until Romain says otherwise at UAT.

### Claude's Discretion
- The ranking method (Romain did not select it): planner's call, kept simple and explainable to a family (e.g. wins and win rate with a minimum number of games, per player; maybe per partner pair), shown among friends only. *(Since fixed by D-13.)*
- Which stats are shown (games, wins, win rate, knights captured and lost, by partner, by computer level), the history screen layout and paging, where history/stats/ranking live (« Mon compte », a new screen), empty states.
- APP-05 accessibility: seats recognisable other than by colour (letters or shapes already exist on knights — check and extend to banners, hands, history), 44 px touch targets audit, French everywhere, screen-reader labels, contrast; an audit then fixes.
- Lesson engine design (scripted states fed to the existing engine and UI, reusing GameController/director), lesson progress memory (localStorage, try/catch), wording.
- D1 schema for account-seat links and solo reports, the free-plan budget, protocol version bump if needed.

### Deferred Ideas (OUT OF SCOPE)
- A line explaining the touched card under the hand: rejected (D-05).
- Linking pre-phase-5 games to accounts: rejected (D-04).
- Move-by-move replays of past games.
- (Phase boundary) chat, spectators, replays of a game move by move, e-mail, new languages.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| HIST-02 | Un joueur consulte l'historique de ses parties (date, équipes, résultat). | Pattern 1 (account per seat in the online record), Pattern 2 (solo report), Pattern 3 (schema `0003_results.sql`), Pattern 4 (`GET /api/me/results`, keyset paging) |
| HIST-03 | Un joueur consulte ses statistiques et celles de ses équipes (parties, victoires, pions mangés…). | Pattern 1 (per-seat tally folded from engine events), Pattern 4 (`GET /api/me/stats`, pure aggregation with filters, partners, levels) |
| HIST-04 | Un classement entre amis est affiché. | Pattern 4 (`GET /api/me/ranking`: circle = self + friendships, ranked = online and ≥ 2 accounts, threshold 5, exact-ratio ordering) |
| PLAY-06 | Une aide en français rappelle les règles et l'effet de chaque carte à tout moment. | Pattern 6 (RulesSheet, large Sheet, figures drawn live or as webp, hold of the solo computers while it is open, « R ») |
| APP-04 | Un tutoriel interactif fait jouer une partie guidée pour apprendre les règles. | Pattern 5 (lesson scripts as engine scenarios, a pure gate over `reduceTurnUi`, scripted gives, Node replay tests) |
| APP-05 | L'interface est en français et accessible (repères des places pas uniquement par la couleur, zones tactiles assez grandes). | Pattern 7 (knight mark symbol, stable marks, knight names) and Pattern 8 (axe + the existing 44 px spec extended, contrast unit test, French deny-list) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Hosting is Cloudflare: Workers, Durable Objects for live tables, D1 for accounts and history. Live game state is never in D1; history rows are written once, at game end.
- No `setTimeout`/`setInterval` in a Durable Object; deadlines are alarms. Every client frame and API body is validated with Zod (`packages/protocol`). The server sends each seat only its own view.
- PWA, as polished on phone as on computer; landscape only for the game (« paysage obligatoire »), the galet board drawn by the code.
- Sounds CC0 or generated (no new sound expected in this phase).
- Interface in French. Gender-neutral copy (02/04 UI-SPEC rule), typography checked by `apps/web/src/i18n/typography.test.ts`.
- Animations: `transform`/`opacity` only, never an animated filter; reduced motion honoured.
- Vitest pinned to `^4.1`; Biome for lint; `svelte-check` for `.svelte`; Playwright for e2e.
- Secrets only through `wrangler secret`. GSD workflow: changes go through plans; the executor never runs remote wrangler commands (the migration is applied by the orchestrator/Romain).
- Repo facts that override the CLAUDE.md stack text: TypeScript is pinned at `6.0.3`, wrangler at `4.151.1`, the worker tests use `@cloudflare/vitest-plugin` `1.4.4` (not vitest-pool-workers), there is no better-auth (hand-written passkeys and sessions, phase 4) [VERIFIED: package.json, apps/worker/package.json read this session].

## Summary

Almost everything this phase needs already exists and has one choke point. On the server, every accepted play goes through `commitPlay` in `packages/table/src/reduce.ts`, which already builds the finished game's `GameRecord` once per game number and hands it to the Durable Object, which writes D1 idempotently with retries (`apps/worker/src/record.ts`, `d1Retry`). The account behind each seat is already known server-side (`Person.account`, plan 04-04). So HIST-02/03 on the online side is: add the account id, a per-seat tally (captured, lost, home) and the table creator's name to the record, and make `writeGame` write two new tables in the same `db.batch`. No frame changes shape, so **PROTOCOL_VERSION stays 6**, and the Durable Object migrations are untouched (no new class).

On the client, solo games run in `GameController.ts` (`play()` is the only place a state changes), so the same pure tally function folds the same events there; at the end a signed-in device posts a client-claimed report to a new endpoint, idempotent by a client UUID scoped to the account, rate-limited through the existing `PlayerHub.allow`, never ranked. History, stats and ranking are three small GET routes over a `game_seats` table keyed `(user_id, ended_at, game_id)` (keyset paging without an extra index), with aggregation in pure TypeScript.

The tutorial needs no second UI. `createGame` already accepts a `scenario` position, the engine passes the turn back to the only seat holding cards, and `session.send` is the single entry of every tap into the pure `reduceTurnUi` reducer. A lesson is therefore a scenario plus a pure "gate" in front of `reduceTurnUi` (wrong card or knight → guide line, swallowed; right one → passes), and every lesson can be replayed end to end in a Node test. The rules sheet reuses `Sheet`, the board drawing and the 15 rule positions; the biggest risk there is bytes: the 15 figures as webp cost about 700-890 KB, and the deployed Worker embeds every file of the web build.

**Primary recommendation:** extend the existing record path (table → Durable Object → D1 batch) rather than adding a new writer; add `0003_results.sql` with `played` + `game_seats`; build lessons as scenario + gate over `reduceTurnUi`; draw the rule figures live in SVG from the scenario data (zero precache bytes) unless Romain insists on the pictures, in which case 640 px webp behind a measured bundle-size gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Which account sat where, per-seat tally of an online game | Durable Object (pure `@toc/table` reducer) | D1 (persistence) | The table already owns persons, seats and the authoritative event stream; the record is built there and written after the commit |
| Solo result | Browser (GameController) | API (validation, rate limit, D1) | The game is local (no server authority, D-01); the server only checks shape and plausibility and never ranks it |
| History, stats, ranking | API / Worker routes | D1 | Cross-table queries; one session lookup per call |
| Ranking order, thresholds, shared ranks | API (pure TS) | — | Exact rational comparison, tested in isolation |
| Lessons (script, gate, progress) | Browser | — | Pure client logic over the client engine; progress in `localStorage` |
| Rules sheet and figures | Browser (Svelte, `packages/board` drawing) | CDN/precache (only if webp) | Static content; works offline in solo |
| Knight and stable marks | Browser (`KnightDefs`, `packages/board` art) | — | Drawn by the code like the « D » disc and the « 1er » token |
| Accessibility audit | Test tier (Playwright + axe, Vitest) | — | Dev-only, nothing shipped (D-10) |

## Standard Stack

### Core (no new runtime dependency)

| Library | Version (repo) | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Cloudflare D1 + raw SQL through `Meter` | binding `DB` | `played`, `game_seats`, queries | The repo's pattern since 02-09/04-01: prepared statements, `meter.batch`, rows measured per request in test mode [VERIFIED: apps/worker/src/db.ts:1-52] |
| Zod (`zod/mini` style strict objects) | 4.6.7 | Solo report body, API answers parsed on the client | Every API body is a strict schema in `packages/protocol` read by `readJson` (8192 bytes max) [VERIFIED: packages/protocol/src/account.ts:137 `export const MAX_API_BODY = 8192;`] |
| Svelte 5 | 5.57.2 | New pages and sheets | Existing UI |
| `@toc/engine` | workspace | Lesson positions (`scenarioState`), tally from `GameEvent`s | Single source of rules |

### Supporting (dev only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@axe-core/playwright` | **4.14.0** (pin exact) | axe in the e2e suites | APP-05 audit (D-10) |
| `axe-core` | `~4.14.0` (its dependency) | rule engine | pulled by the above |
| `@playwright/test` | 1.64.0 (already) | e2e | existing |

`@axe-core/playwright@4.14.0` declares `peerDependencies = { 'playwright-core': '>= 1.0.0' }` and `dependencies = { 'axe-core': '~4.14.0' }`, licence MPL-2.0, no install/postinstall script [VERIFIED: npm view, this session]. The repo has `playwright-core@1.64.0` in its store (`node_modules/.pnpm/playwright-core@1.64.0`) [VERIFIED: ls], and pnpm 10 installs peers automatically, so the peer resolves to the same 1.64.0. If the "too-new" verdict (published 2026-10-15) bothers the gate, `4.13.0` (2026-08-11, same peer range, `axe-core ~4.13.0`) is the conservative pin.

**Installation (dev, web package only; behind the checkpoint below):**
```bash
pnpm --filter @toc/web add -D -E @axe-core/playwright@4.14.0
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `played` + `game_seats` tables | `ALTER TABLE games ADD COLUMN …` | `games` holds no person id by an asserted rule (record.test.ts, T-02-36) and has no place for solo games; leave it untouched |
| Tally kept in the table snapshot (folded in `commitPlay`) | Fold the DO SQLite `events` log (`game_no` column) at record time | The log is exact even for a game in progress at deploy, but moves logic into the impure DO shell; the snapshot tally is pure, testable in Node and shared with the solo controller |
| Live SVG rule figures | 15 webp at 640-720 px | Webp = exact pictures of `docs/regles` but 700-890 KB in the precache and in the embedded Worker; live SVG = 0 bytes, knight marks and French tags included |
| Stats aggregated in TS | SQLite `json_each` over `played.seats` | TS is testable and readable; family-scale row counts make the read cost negligible |

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@axe-core/playwright` | npm | 4.14.0 published 2026-10-15 (line since 2021, 4.10.0 in 2024-08) | unknown (seam could not read) | github.com/dequelabs/axe-core-npm | [SUS] (reasons: `too-new`, `unknown-downloads`) | Approved by Romain (D-10); planner keeps a `checkpoint:human-verify` before the install |
| `axe-core` | npm | 4.14.0 published 2026-10-05 | unknown | github.com/dequelabs/axe-core | [SUS] (reason: `unknown-downloads`) | Transitive of the above; same checkpoint |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `@axe-core/playwright`, `axe-core` — both are Deque's long-standing packages; the SUS verdict comes from the recency of the latest patch and from download counts the seam could not fetch. `npm view … scripts.postinstall` is empty for both [VERIFIED: npm view this session]. Planner inserts `checkpoint:human-verify` before the install.

## Architecture Patterns

### System Architecture Diagram

```
 ONLINE GAME                                              SOLO GAME (browser only)
 client act ──ws──> GameRoom.run(command)                 tap ──> session.send ──> reduceTurnUi ──> controller.submit
                        │                                                                        │
                        ▼                                                                        ▼
            reduce() ─> commitPlay(played.events)                                   GameController.play(events)
                        │  tally ⟵ foldTally(events)  ◄── same pure fn (@toc/engine) ──►  tally ⟵ foldTally(events)
                        │  won? keepRecord(table) {seats+account+tally,                    │ won + signed in + real deal
                        │                          home, creatorName}                       ▼
                        ▼                                                        SoloReport {id: uuid, times, human,
            SQLite commit (snapshot, event log)                                   levels, winner, deals, per-seat tally}
                        │ result.records                                                    │ online? ──no──> toc.pending.v1 (≤ 50,
                        ▼                                                                   │                  tagged with account id)
            writeGame(DB, tableId, record) ──── db.batch ────┐                              ▼
              games (legacy, unchanged)                      │                 POST /api/me/results/solo
              played  ON CONFLICT DO NOTHING                 │                  Origin + JSON + session
              game_seats per account seat (only if user      │                  zod strict, plausibility
                exists)  ON CONFLICT DO NOTHING              │                  PlayerHub.allow("solo")
                        │ failed → d1Retry alarm (1 min,10 min,1 h)              db.batch played + 1 game_seats row
                        ▼                                                                   │
                       D1 ◄─────────────────────────────────────────────────────────────────┘
                        │
   GET /api/me/results?cursor  ──> game_seats(user_id, ended_at DESC) ⋈ played ──> rows + seat names (no other ids)
   GET /api/me/stats           ──> all rows of the user ──> pure aggregate (Toutes / En ligne / Contre l'ordinateur)
   GET /api/me/ranking         ──> circle = self ∪ friendships ⋈ users ⟕ game_seats(ranked=1) ──> pure rank (≥ 5 games)

 LESSON (browser only)
 #/apprendre/n ──> Game.svelte(lesson) ──> createSession(lesson) ──> createGame({scenario, script gives})
                                   tap ──> lessonGate(step, event, ui, ctx) ──wrong──> guide line (swallowed)
                                                    └──right──> reduceTurnUi ──> … ──> events ──> step done ──> plank « Bravo ! »
```

### Recommended Project Structure (new files)

```
apps/worker/migrations/0003_results.sql     # played + game_seats (never edit 0001/0002)
apps/worker/src/results.ts                  # routes: history, stats, ranking, solo report
apps/worker/src/results/aggregate.ts        # pure: stats and ranking from rows
packages/engine/src/tally.ts                # pure: foldTally(tally, events) per seat
packages/protocol/src/results.ts            # zod: SoloReport, HistoryPage, Stats, Ranking
packages/table/src/record.ts                # + account, tally, home, creatorName (server-only)
apps/web/src/results/                       # api client, pending queue, soloReport builder
apps/web/src/game/lessons.ts                # the 8 scripts (positions in cells → PawnSpec)
apps/web/src/game/lessonRunner.ts           # pure gate + step progression
apps/web/src/game/ruleFigures.ts            # the 15 figure positions (checked against scenarios by a test)
apps/web/src/routes/{Results,Lessons}.svelte
apps/web/src/ui/{RulesSheet,RuleFigure,CardRule,GuideBand,LessonPlank,…}.svelte
apps/web/e2e/{accessibilite,lecons,regles}.spec.ts; apps/web/e2e-online/resultats.spec.ts
```

### Pattern 1: The account and tally in the online record

**What:** `gameRecordOf(table)` already loops over the four seats and reads `personOf(table, seat.who)` for a human seat [VERIFIED: packages/table/src/record.ts:46-78]. The person carries the account: `account: string | null;` — "Server-only: never put in a frame" [VERIFIED: packages/table/src/table.ts:20-31]. Records are server-only too (`records: GameRecord[]` "Server-only … Never put in a frame") [VERIFIED: packages/table/src/table.ts, `records` field doc]. Today's record type is:

```ts
// [VERIFIED: packages/table/src/record.ts:17-36]
export type RecordSeat = { colour: Color; kind: "human" | "bot"; name: string; level: BotLevel | null; handedOver: boolean; };
export type GameRecord = { gameNo: number; startedAt: number; endedAt: number; winner: Team; seats: RecordSeat[]; deals: number; captures: Record<Team, number>; };
```

Add to `RecordSeat`: `account: string | null`, `captured: number`, `lost: number`, `home: number`; to `GameRecord`: `creatorName: string | null`. All optional-on-read (a record pending in a snapshot from before the deploy lacks them: treat as `account: null`, tally 0 — those games are pre-phase-5 anyway, D-04).

**Tally:** a pure `foldTally(tally, events)` in `@toc/engine` over `GameEvent`s. The event shapes it reads:

```ts
// [VERIFIED: packages/engine/src/events.ts:25-50]
| { t: "cardPlayed"; seat: Color; card: CardId }
| { t: "pawnCaptured"; by: PawnId; victim: PawnId; at: Place; atStep: number }
| { t: "pawnEnteredHome"; pawn: PawnId; path: Place[]; slot: 0 | 1 | 2 | 3; homeCount: number }
| { t: "playerFinished"; seat: Color; partner: Color }
```

Rules: `lost[pawnColor(victim)] += 1`; `captured[actor] += 1` where `actor` is the seat of the last `cardPlayed` in the same batch (a finished player moves his partner's knights, G7, so `pawnColor(by)` would credit the wrong seat); `home` per colour is read from the final pawns at record time (`zone === "home"`), not from events. Fold in `commitPlay` (`played.events`), store `table.tally` (reset where a game starts: `startGame` and the rematch), default it in `copyTable` (`??=`), as every earlier field was added [VERIFIED: packages/table/src/table.ts copyTable `??=` chain].

**Write:** `writeGame` becomes one `db.batch([...])`: the legacy `games` insert unchanged, then — only when at least one seat has an account — `played` and one `game_seats` row per account seat, all `ON CONFLICT DO NOTHING`. Re-writes after a lost answer or an alarm retry stay idempotent (the existing contract: "inserted with ON CONFLICT DO NOTHING, so writing it again … never makes a second row") [VERIFIED: apps/worker/src/record.ts:1-9]. A failed batch writes nothing [VERIFIED: apps/worker/src/db.ts:5 "A failed batch writes nothing and adds nothing."] and the record stays pending for `d1Retry` [VERIFIED: packages/table/src/record.ts `D1_RETRY_MS = [60_000, 600_000, 3_600_000]`].

**`ranked`** = online and the number of distinct accounts seated ≥ 2 (D-02, D-13); a seat handed to the computer still belongs to its account (UI-SPEC « What counts », à confirmer stands).

### Pattern 2: The client-claimed solo report

**What:** `GameController.play()` is the only state change of a local game: `const result = apply(state, seat, action); state = result.state; if (result.events.length > 0) director.enqueue(result.events);` [VERIFIED: apps/web/src/game/GameController.ts:201-206]. Fold the tally there (or in the session's `watched.enqueue`, which sees every batch) and record `startedAt = Date.now()` at creation.

**Report only when:** the game started from a real deal (`scenario === undefined`: never a debug `etat`/`scenario`, never a lesson), ended with `phase === "won"`, and the device is signed in at the end (D-01). Build `SoloReport`:

```ts
// packages/protocol/src/results.ts (shape proposed; every field validated)
{ id: string /* crypto.randomUUID() made at game start */, startedAt: number, endedAt: number,
  human: Color, winner: Team, deals: number,
  levels: Partial<Record<Color, 1|2|3|4|5>> /* the three computers */,
  seats: Record<Color, { captured: number; lost: number; home: number }> }
```

**Server checks (`POST /api/me/results/solo`):** `writeAllowed` (our Origin) + `readJson` (JSON, size) + session (401) [VERIFIED: apps/worker/src/http.ts:23-50]; strict schema; plausibility (exactly three levels for the three other colours; winning team's two colours `home === 4`; losing team `home ≤ 4` each and not both 4; `0 ≤ captured, lost ≤ 64`; `startedAt < endedAt ≤ now + 5 min`; `endedAt ≥ now − 60 days`; `endedAt − startedAt ≥ 60 s`; `deals ≤ 300`); rate `PLAYER_HUB.getByName(user.id).allow({ kind: "solo", max: 30, windowMs: 86_400_000, now })` → 429 (the existing primitive: "true and counted for the first `max` calls inside `windowMs`") [VERIFIED: apps/worker/src/PlayerHub.ts:12-14, 235-251]. Id `solo:${userId}:${uuid}` → `played` + one `game_seats` row with `ranked = 0`, `ON CONFLICT DO NOTHING`; answer 201 (added) or 200 (already there). The server never trusts names: the player's name is the session's pseudo, computers are stored by level only (horse names change every game, UI-SPEC).

**Pending queue (`toc.pending.v1`, ≤ 50, try/catch):** each entry tagged with the account id that played; sent at the next start only when the signed-in account is the same; 201/200 → remove; 400 → drop (never retry a refused body forever); 401/429/5xx/offline → keep.

### Pattern 3: Schema `0003_results.sql`

`0002_accounts.sql` says of itself "a later need goes into 0003, this file is never edited" [VERIFIED: apps/worker/migrations/0002_accounts.sql:2]. Proposed:

```sql
-- One row per finished game that had at least one account at the table (online, written by the
-- GameRoom with the legacy games row) or that a signed-in browser reported (solo, client-claimed).
CREATE TABLE played (
  id TEXT PRIMARY KEY,               -- online: games.game_id ('<table_hash>:<game_no>'); solo: 'solo:<user_id>:<uuid>'
  kind TEXT NOT NULL CHECK (kind IN ('online', 'solo')),
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  winner TEXT NOT NULL CHECK (winner IN ('bleu-rouge', 'jaune-vert')),
  seats TEXT NOT NULL,               -- JSON, order bleu, jaune, rouge, vert: { colour, kind: 'account'|'guest'|'bot',
                                     --   account (server-only), name, level, handedOver, captured, lost, home }
  deals INTEGER NOT NULL,
  creator TEXT,                      -- online: the table creator's shown name
  accounts INTEGER NOT NULL          -- distinct accounts seated
);

-- One row per account seat of a played game: the history, the stats and the ranking read only this
-- (and played for the details). The key orders a player's history: keyset paging, no extra index.
CREATE TABLE game_seats (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ended_at INTEGER NOT NULL,
  game_id TEXT NOT NULL REFERENCES played(id) ON DELETE CASCADE,
  colour TEXT NOT NULL,
  won INTEGER NOT NULL,              -- 0 / 1
  ranked INTEGER NOT NULL,           -- 0 / 1: online and accounts >= 2 (D-02, D-13)
  solo INTEGER NOT NULL,             -- 0 / 1
  captured INTEGER NOT NULL,
  lost INTEGER NOT NULL,
  home INTEGER NOT NULL,
  PRIMARY KEY (user_id, ended_at, game_id)
) WITHOUT ROWID;
```

- Idempotency: `ended_at` is fixed in the record (server time) and in the solo report (the client resends the same value), so a retry hits the same key.
- **Foreign keys are enforced** (the repo relies on `ON DELETE CASCADE` for sessions and push rows [VERIFIED: apps/worker/test/recover.test.ts:253, test/subscriptions.test.ts:5]). Insert seat rows with `INSERT … SELECT ?, ?, … WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)` so a vanished account never fails the whole batch (which would retry hourly forever).
- Row budget: index entries count as rows written [VERIFIED: 04-12-SUMMARY measured "index entries count as rows written"; a finished game today costs "3 (the row, its key, the table_hash index)"]. New cost per online game: `played` 2 (row + PK index) + per account seat 1 (WITHOUT ROWID, no secondary index) ≈ 2 + n ≤ 6, on top of the legacy 3. Per solo report ≈ 3. The 04-12 estimate for 20 people is about 250 D1 rows written a day out of 100 000 [VERIFIED: 04-12-SUMMARY table]; this phase adds about 60 games × ~5 + solo reports ≈ 400 rows/day, still < 1 %.

### Pattern 4: The three reads and their API

All under the session (`sessionUser`, 401 otherwise), `GET` only, `json(…)` with `cache-control: no-store` [VERIFIED: apps/worker/src/http.ts:12-16]; registered in `accountRoute` next to `meTablesRoute` [VERIFIED: apps/worker/src/index.ts accountRoute]. Never return another account's id: seats come back as `{ colour, kind: 'me'|'account'|'guest'|'bot', name, level, handedOver, captured, lost, home }`.

- **`GET /api/me/results?before=<ended_at>:<game_id>`** — 20 rows + `next` cursor:
  ```sql
  SELECT p.id, p.kind, p.started_at, p.ended_at, p.winner, p.seats, p.deals, p.creator, p.accounts, gs.colour
    FROM game_seats gs JOIN played p ON p.id = gs.game_id
   WHERE gs.user_id = ?1 AND (gs.ended_at < ?2 OR (gs.ended_at = ?2 AND gs.game_id < ?3))
   ORDER BY gs.ended_at DESC, gs.game_id DESC LIMIT 21
  ```
  (21 to know whether there is more; the explicit `OR` form avoids relying on row-value comparison.) The detail sheet needs no other request: the row carries every seat.
- **`GET /api/me/stats`** — read every row of the user (`game_seats ⋈ played`), aggregate in pure TS for the three filters at once (the filter is client-side, « not saved »): games, wins, rate; captured/lost/home sums; partners (account by pseudo, all guests together as « Joueurs sans compte », computers by level « (ordinateur) »); levels (only games whose two opponents are computers, under the stronger level).
- **`GET /api/me/ranking`** —
  ```sql
  WITH circle(id) AS (SELECT ?1 UNION SELECT friend_id FROM friendships WHERE user_id = ?1)
  SELECT u.id, u.pseudo, COUNT(gs.game_id) AS games, COALESCE(SUM(gs.won), 0) AS wins
    FROM circle c JOIN users u ON u.id = c.id
    LEFT JOIN game_seats gs ON gs.user_id = c.id AND gs.ranked = 1
   GROUP BY u.id
  ```
  then pure TS: ranked when `games ≥ 5`; order by `wins/games` compared as `a.wins * b.games` vs `b.wins * a.games` (exact, no float), then wins, then games, then pseudo; competition ranks shared only when rate, wins and games are all equal ("1, 2, 2, 4"); unranked list by games then pseudo; `me: true` on one's own row. `friendships` has two rows per friendship [VERIFIED: 0002_accounts.sql:16 "two rows per friendship, one per direction"].

### Pattern 5: Lessons as scenario + gate (no second UI)

**What exists:**
- `createGame({ scenario })` builds the state with `scenarioState(scenario, seed)` [VERIFIED: apps/web/src/game/GameController.ts:150-152]; `createSession` passes `scenario` from the debug params (`const scenario = debug.etat ?? debug.scenario?.before;`) [VERIFIED: apps/web/src/game/session.svelte.ts:138].
- `Scenario["before"]` = `{ pawns?: Partial<Record<Color, [PawnSpec×4]>>; hands?: Partial<Record<Color, CardId[]>>; turn; phase?; dealer?; dealIndex? }`, a missing hand is empty [VERIFIED: packages/engine/src/types.ts:202-209 and the scenario conventions doc].
- After a play the turn goes to the next seat **with cards** (apply.ts line 137 `if (hands[candidate].length > 0) return candidate;`), and the deal ends only when the four hands are empty [VERIFIED: packages/engine/src/state.ts:165-168 `isDealOver`]. So when only the player holds cards, the turn comes straight back and `nextBot()` returns null (`return state.turn === human ? null : state.turn;`) [VERIFIED: GameController.ts:190-199]: **lessons 1-7 need no computer move at all**, provided the player keeps at least one card after the lesson's move (every UI-SPEC hand has 2-3 cards).
- Every tap enters through `session.send(event)` → `reduceTurnUi(ui, event, ctx())`, and only `confirm`, `give` and `pose` produce a `submit` [VERIFIED: session.svelte.ts:292-304, turnUi.ts:1-18, 166-172].

**Design:**
- `lessons.ts`: eight scripts; positions written in RULES.md cells (0-71 from Bleu's losange) and converted to each colour's progress: `p = (cell − EXIT[colour] + 72) % 72` with `EXIT = { bleu: 0, jaune: 18, rouge: 36, vert: 54 }` [VERIFIED: packages/engine/src/topology.ts:13-16]. Examples for the UI-SPEC lessons: Jaune 20 → `{p: 2}`, Jaune 66 → `{p: 48}`, Jaune 40 → `{p: 22}`, Jaune 22 → `{p: 4}`, Vert 68 → `{p: 14}`, Vert 43 → `{p: 61}`, Vert 50 → `{p: 68}`, Jaune 30 → `{p: 12}`. Card ids are `${Rank}${Suit}` (`"1H"` As de cœur, `"11S"` Valet de pique) [VERIFIED: types.ts:29-36].
- `lessonRunner.ts` (pure): `gate(step, event, ui, ctx) → { pass: true } | { pass: false; line }` placed in `session.send` before `reduceTurnUi` (a `lesson?: LessonGate` option of `createSession`). Expectations per step: a card (`tapCard`/`selectGive`), a knight (`tapPawn`/`tapAt` first candidate), a step count (`pickSteps`), a button (`confirm`/`give`/`chooseExit`), or a goal judged on `confirm` (lesson 6: the `sevenBuilding.preview.captures` victims must include both opponents — any plan that eats both passes; otherwise `cancelAll` back to the step start and the wrong line). Events the engine itself refuses keep the existing reason hint. Step completion: when `ui` reaches the expected kind (e.g. `preview` with `auto`), or when the controller's change shows the expected move and the Director is idle → plank.
- Lesson 8 (exchange): the three others must give a known card. Add a `script?: Partial<Record<Color, Action[]>>` option to `createGame`: a seat with a scripted action plays it instead of thinking (deterministic, no seed fragility). Dealer = vert so Bleu plays first after the cross.
- Lessons never report a result, never write `toc.tables.v1`, and hide the deal banner, « D », « 1er », team pills, « Avance rapide » and Messages (UI-SPEC).
- **Test:** `lessons.test.ts` replays each lesson in Node: the scripted right path through `reduceTurnUi` + `apply` reaches the plank condition, and each declared wrong choice is gated with its line and leaves the state unchanged. This is the strongest guard against a script that the engine does not allow (protection, own-knight landing, the forced home entry).

### Pattern 6: The « Règles » sheet

- Opening tab by place, the large `Sheet`, ten tabs, cards list, « R » (UI-SPEC). Text lives in `i18n/fr/regles.ts`; the typography test globs `./fr/**/*.ts`, so it covers new catalogue files without change [VERIFIED: apps/web/src/i18n/typography.test.ts:6-10].
- **Solo computers do not wait today for a sheet.** The UI-SPEC says the computers wait « as during Réglages », but the only hold is the rotate prompt: `function hold(): Promise<void> { if (!prompting || !alive) return Promise.resolve(); … }` [VERIFIED: apps/web/src/routes/Game.svelte:253-256]. Extend the predicate to `prompting || rulesOpen` (solo only; online goes on), and release on close.
- **Figures.** The 15 figures named by the UI-SPEC exist as `docs/regles/<id>.webp`, 1200 × 1200, about 120 KB each, drawn by `tools/render-scenarios.mjs` with **discs lettered A-D, not knights**, and a baked lowercase pill « avant » / « après » or « le coup » [VERIFIED: tools/render-scenarios.mjs:1-25, 125-150, 230-256; `file` on R-01.1.webp]. Five of the fifteen have no `after` (R-01.1, R-04.2, R-14.2, R-06.1, R-12.1), so their lower half is « le coup » with halos, not « Après »; R-08.1 is drawn from Jaune's seat (`turn: jaune`) [VERIFIED: node over packages/engine/scenarios this session]. The generator needs the container's Chromium (`/opt/pw-browsers/chromium-1194`, present) [VERIFIED: ls].
- Size, re-encoded from the 1200 px files this session (approximation of a fresh render): 720 q70 ≈ 889 KB, 720 q60 ≈ 813 KB, 640 q60 ≈ 696 KB, 480 q60 ≈ 491 KB for the fifteen [VERIFIED: sharp, scratch script]. `globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2,ico,webmanifest}"]` precaches anything under `public/regles` automatically [VERIFIED: apps/web/vite.config.ts:22]. The production Worker embeds every file of `apps/web/dist` (`tools/build-embedded-worker.mjs` walks it, webp as Data modules) [VERIFIED: tools/build-embedded-worker.mjs:1-28, wrangler.embarque.jsonc rules]; a release build is 3.06 MB raw, **2.03 MB gzipped** today [VERIFIED: vite build to scratch this session].
- **Recommendation: draw the figures live** (`RuleFigure.svelte`): two stacked `BoardArt` (`k` prop exists [VERIFIED: apps/web/src/board/BoardArt.svelte:18]) with knights `<use href="#knight-{colour}">` at `sceneXY(place, k)`, from a small `ruleFigures.ts` holding only the 15 `before`/`after` positions and halos (a test asserts them equal to `@toc/engine/scenarios`, which is exported as `"./scenarios"` but must not be imported by release code: 73 KB of source) [VERIFIED: packages/engine/package.json exports]. Zero bytes, crisp on every screen, the knight and stable marks for free, French « Avant » / « Après » / « Le coup » as HTML tags, always from Bleu's seat. `BoardArt`'s defs use fixed ids (« toc- ») [VERIFIED: BoardArt.svelte:53-80]: render the defs once (or prefix them per figure) so two boards on one page do not duplicate ids. If Romain wants the pictures, generate 640 px q60 into `apps/web/public/regles/` with a bundle-size gate (Pitfall 2).

### Pattern 7: Marks and names (APP-05)

- Seat glyphs today: `bleu: { … glyph: "●", glyphName: "cercle" }`, `jaune: "▲" "triangle"`, `rouge: "■" "carré"`, `vert: "★" "étoile"` [VERIFIED: apps/web/src/i18n/fr/seats.ts:4-9]. **D-11 says « round, square, triangle, diamond »** — see Open Question 1.
- Knights are `<symbol id="knight-{colour}">` with one `<image>` [VERIFIED: apps/web/src/board/KnightDefs.svelte:17-21], used by `Pawn.svelte` inside a `scale(-1 1)` facing mirror [VERIFIED: Pawn.svelte:72-76] and **also** by `ColorTile`, `SeatTile`, `PawnTray`, `Overlay` and `CardBack` (the card back draws `#knight-bleu`) [VERIFIED: grep this session]. So do not draw the mark inside `knight-{colour}` (it would appear on every card back): add `<symbol id="knight-mark-{colour}">` and a `<use>` in `Pawn.svelte` (and `PawnTray`) when `settings.knightMarks`. The four shapes are symmetric about the vertical axis, so the facing mirror leaves them unchanged.
- New setting `knightMarks: boolean`, default `true`, parsed field by field like the others (`toc.settings.v1`) [VERIFIED: apps/web/src/settings/settings.ts:34-44 and parseSettings].
- Stable marks in `packages/board` art, clearances tested as `starterToken.test.ts` does.
- Knight accessible names: `Pawn.svelte` labels with `t.pawn[color]` only [VERIFIED: Pawn.svelte:104, 119]; extend with letter (`knightLetter`), owner and place (UI-SPEC wording).

### Pattern 8: The audit

```ts
// Source: @axe-core/playwright README (API stable since 4.x) [ASSUMED from training; check on install]
import AxeBuilder from "@axe-core/playwright";
const results = await new AxeBuilder({ page })
  .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
  .exclude("[data-board] svg") // the drawing's numbers are decorative (UI-SPEC exemption)
  .analyze();
expect(results.violations).toEqual([]);
```

- Run with `page.emulateMedia({ reducedMotion: "reduce" })` so contrast is not computed mid-fade.
- The 44 px rule stays the project's own check: extend `e2e/cibles.spec.ts`'s `expectTargets` (0.2 px tolerance, viewports 480 × 320 … 844 × 390) [VERIFIED: apps/web/e2e/cibles.spec.ts:9-45] to every route and sheet. axe's `target-size` is WCAG 2.2 (24 px) and weaker.
- No contrast unit test exists yet (`find … contrast*` empty) [VERIFIED: find this session]: add `contrast.test.ts` over the token pairs of `app.css` (Wave 0).
- `<html lang="fr">` is there [VERIFIED: apps/web/index.html:2].

### Anti-Patterns to Avoid

- **A second game screen for lessons:** use `Game.svelte` in lesson mode (UI-SPEC), the gate, and scripted state.
- **Trusting a solo report for anything shared:** it never sets `ranked`, never carries another account, never carries names.
- **Returning account ids of others in history/ranking:** names and `me` only.
- **A new writer for online results outside the record path:** you lose idempotency and the `d1Retry` alarm.
- **Changing `games` (0001) or editing 0002:** new file 0003; `record.test.ts` asserts the `games` row holds no person id.
- **Float win rates for ordering and ties:** compare cross-products.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting solo reports | A D1 counter table | `PlayerHub.allow({ kind: "solo", … })` | Already per account, strongly consistent, no D1 writes |
| Idempotent writes and retries | A queue or a new alarm | `GameRecord` pending list + `d1Retry` + `ON CONFLICT DO NOTHING` | Exists and is tested (record.test.ts) |
| Body validation | Manual checks | `readJson(request, Schema)` + zod strict | 415/413/400 already right |
| Accessibility rules | Hand-written ARIA checks | axe (D-10) + the existing 44 px spec | Hundreds of rules, maintained |
| Lesson board/turn logic | Lesson-specific legality | engine `scenarioState`, `reduceTurnUi`, `resolveMove`/`previewPlan` | One source of rules; the preview is the engine's own code |
| Rule figure drawing | A new renderer | `BoardArt` + `sceneXY` (live) or `tools/render-scenarios.mjs` (webp) | Same galet as the game |
| French dates/percentages | String concatenation | `Intl.DateTimeFormat("fr")`, `Intl.NumberFormat("fr", {style:"percent"})` | UI-SPEC formats |

**Key insight:** every hard part (authority, idempotency, rules, drawing) already has one owner in this codebase; the phase is mostly threading new data through existing choke points.

## Runtime State Inventory

(The phase adds a D1 migration and changes a server-only snapshot type, so this is answered.)

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | DO snapshots may hold **pending `GameRecord`s** (games won while D1 failed) without `account`/tally; tables mid-game at deploy have no `tally` | Code: read new record fields as optional; `copyTable` `tally ??=` (partial tally accepted, D-04). No data migration of `games` (D-04) |
| Live service config | Remote D1 « toc » must get `0003_results.sql` (`wrangler d1 migrations apply toc --remote`) **before** the new Worker is deployed; otherwise every online record batch fails and waits for the hourly retry, and solo posts answer 500 | Orchestrator/Romain step, not the executor (no remote wrangler). The e2e-online config already applies migrations `--local` [VERIFIED: playwright.online.config.ts webServer]; the workerd tests apply `./migrations` automatically [VERIFIED: apps/worker/vitest.config.ts readD1Migrations] |
| OS-registered state | None — verified: no scheduled tasks or OS registrations in this project | None |
| Secrets/env vars | None new (no new secret; `TOC_TEST_MODE` unchanged) | None |
| Build artifacts | `worker-embedded/manifest.js` (gitignored) is regenerated from `apps/web/dist` at deploy [VERIFIED: .gitignore:8]; the service worker precache list changes with new assets | Rebuild before deploy; size gate if webp figures |

## Common Pitfalls

### Pitfall 1: The shape glyph of Vert
**What goes wrong:** D-11 lists a diamond; `seats.ts` and every UI-SPEC since phase 1 use a star for Vert. A diamond also collides with the board's « losange » (the exit square). **How to avoid:** ask Romain once (Open Question 1); keep the glyph a single constant so the choice is one line. **Warning signs:** a mark that reads like the exit diamond on the board.

### Pitfall 2: Bytes in the embedded Worker
**What goes wrong:** 15 webp add ~700-890 KB to a precache and to a Worker bundle that is already ~2.03 MB gzipped for the web part alone. The Workers script size limit is 3 MB compressed on the Free plan and 10 MB on Paid [ASSUMED: training knowledge; developers.cloudflare.com unreachable this session]. **How to avoid:** live SVG figures (Pattern 6); if webp, 640 px q60 and a local `wrangler deploy --dry-run --outdir <dir> -c wrangler.embarque.jsonc` + gzip measure in the plan (local, no remote). **Warning signs:** deploy refused for size.

### Pitfall 3: A lesson that the engine does not allow
**What goes wrong:** a script expects a move the engine refuses (protected knight, landing on one's own knight, forced home entry), or a hand that ends the deal (the engine then deals a new one). **How to avoid:** the Node replay test per lesson; the player keeps ≥ 1 card after the lesson's move. **Warning signs:** a lesson where the halo target is not lit.

### Pitfall 4: Solo reports from lessons, debug positions or another account
**What goes wrong:** a lesson or `#/partie?etat=…` reports a "win"; a queued report is sent after another family member signs in on the same device. **How to avoid:** report only real deals; tag queue entries with the account id and drop mismatches.

### Pitfall 5: Foreign keys failing a whole batch
**What goes wrong:** a seat's account no longer exists; the batch fails and the record retries every hour forever. **How to avoid:** `INSERT … SELECT … WHERE EXISTS (SELECT 1 FROM users WHERE id = ?)`.

### Pitfall 6: Migration applied after the Worker
**What goes wrong:** see Runtime State Inventory. **How to avoid:** deploy note in the last plan: apply 0003 remotely first.

### Pitfall 7: Mark on every `#knight-*` use
**What goes wrong:** the card back and tiles show the mark. **How to avoid:** separate `knight-mark-{colour}` symbol used only where a knight is a seat's piece.

### Pitfall 8: Computers playing behind the rules sheet
**What goes wrong:** in solo the bots keep playing while the sheet is open (today's hold is only the rotate prompt). **How to avoid:** extend `hold()`.

### Pitfall 9: Ranking ties and float rates
**What goes wrong:** 2/3 and 4/6 compare unequal in floats or ranks differ by order of rows. **How to avoid:** cross-multiplication; shared rank only when rate, wins and games are equal; tests with ties.

### Pitfall 10: Duplicate SVG ids with two boards on a page
**What goes wrong:** `BoardArt`'s fixed « toc- » ids repeat; axe may flag duplicate ids and a removed first instance breaks the others' `url(#…)`. **How to avoid:** one shared defs block or per-instance prefixes.

### Pitfall 11: axe on moving or decorative graphics
**What goes wrong:** flaky contrast results mid-animation; violations on the board's decorative numbers. **How to avoid:** reduced motion in the audit, `exclude` the board drawing, `aria-hidden` on decoration.

## Code Examples

### Tally fold (engine, pure)
```ts
// packages/engine/src/tally.ts — proposed; event fields as in events.ts:25-50
export type SeatTally = { captured: number; lost: number };
export type Tally = Record<Color, SeatTally>;
export function foldTally(tally: Tally, events: readonly GameEvent[]): Tally {
  const next = structuredClone(tally);
  let actor: Color | null = null;
  for (const event of events) {
    if (event.t === "cardPlayed") actor = event.seat;
    else if (event.t === "pawnCaptured") {
      next[pawnColor(event.victim)].lost += 1;
      next[actor ?? pawnColor(event.by)].captured += 1;
    }
  }
  return next;
}
```

### Seat rows only for existing accounts (D1)
```sql
INSERT INTO game_seats (user_id, ended_at, game_id, colour, won, ranked, solo, captured, lost, home)
SELECT ?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, ?8, ?9
 WHERE EXISTS (SELECT 1 FROM users WHERE id = ?1)
ON CONFLICT DO NOTHING;
```

### Lesson gate (web, pure)
```ts
// apps/web/src/game/lessonRunner.ts — proposed
export function gate(step: LessonStep, event: TurnUiEvent): { pass: true } | { pass: false; line: string } {
  const want = step.expect;
  if (want.t === "card" && (event.t === "tapCard" || event.t === "selectGive") && event.card !== want.card)
    return { pass: false, line: step.wrong ?? step.line };
  if (want.t === "pawn" && event.t === "tapPawn" && event.pawn !== want.pawn)
    return { pass: false, line: step.wrong ?? step.line };
  return { pass: true };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@cloudflare/vitest-pool-workers` | `@cloudflare/vitest-plugin` 1.4.4 in this repo | before phase 5 (worker vitest config) | Tests use `cloudflareTest(...)`, `readD1Migrations` [VERIFIED: apps/worker/vitest.config.ts] |
| axe `duplicate-id*` rules | Deprecated in recent axe-core 4.x (WCAG 2.2 dropped 4.1.1 Parsing) | axe-core 4.7+ [ASSUMED] | Duplicate ids may not be reported; Pitfall 10 still matters for `url(#…)` |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Workers script size limit: 3 MB compressed (Free), 10 MB (Paid) | Pitfall 2 | Webp figures could be fine (Paid) or block the deploy (Free); live SVG avoids the question |
| A2 | `@axe-core/playwright` API: default export `AxeBuilder`, `withTags`, `exclude`, `analyze` | Pattern 8 | Minor rewrite of the spec helper |
| A3 | D1 batch is one transaction (repo comment says "A failed batch writes nothing") | Pattern 1 | Partial rows on failure; idempotent inserts make a retry safe anyway |
| A4 | "Rentrés par toi" = own-colour knights home at the end; "Mangés par toi" credited to the seat that played the card | Pattern 1 | A stat reads differently than Romain expects for finished players (G7); wording at UAT |
| A5 | Plausibility thresholds for solo (≥ 60 s, ≤ 300 deals, 30/day) | Pattern 2 | A genuine game refused, or a forged one accepted (personal stats only) |
| A6 | axe duplicate-id rules deprecated | State of the Art | None for the plan |

## Open Questions

1. **Vert's shape: star (★, today) or diamond (D-11)?**
   - What we know: D-11 says « round, square, triangle, diamond »; `seats.ts` and all UI-SPECs use ★ for Vert; the board's exit squares are « losanges ».
   - Recommendation: keep ★ (one glyph set across chips, tiles and knights; no clash with the losange) and confirm at the first checkpoint; make it one constant.
2. **Figures: live SVG or webp?** Recommendation: live SVG (Pattern 6); webp only if Romain wants the exact pictures, then 640 px with a size gate. Either way the lower halves of R-01.1, R-04.2, R-14.2, R-06.1, R-12.1 read « Le coup », not « Après » (UI-SPEC tags to adjust).
3. **Paid or Free plan?** Unknown here; only matters for the webp route (A1).
4. **Lesson board shrink (5-9 %)** — stands as proposed (UI-SPEC à confirmer), re-checked at UAT.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | build, tests | ✓ | 22.22.0 | — |
| pnpm | workspace | ✓ | 10.34.7 | — |
| Chromium (container) | Playwright e2e, `render-scenarios.mjs` | ✓ | `/opt/pw-browsers/chromium-1194` | — |
| wrangler (local) | `wrangler dev` e2e-online, local migrations | ✓ | 4.151.1 | — |
| sharp | webp route only | ✓ | 0.35.5 | live SVG |
| developers.cloudflare.com | re-reading limits | ✗ (network) | — | measure the bundle locally |
| Remote D1 | applying 0003 | not for the executor | — | orchestrator/Romain |

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (reuse) | existing session cookie, `sessionUser` |
| V3 Session Management | yes (reuse) | `__Host-` cookie, SameSite=Lax |
| V4 Access Control | yes | the user id always comes from the session, never a parameter; ranking limited to `friendships` |
| V5 Input Validation | yes | zod strict `SoloReport`, cursor parsed by regex, `readJson` limits |
| V6 Cryptography | no new | `crypto.randomUUID()` for report ids |
| V8 Data Protection | yes | no other account id, no device token, no card in any answer or row |
| V11 Business Logic | yes | solo never ranked, plausibility, rate limit, idempotent id |
| V13 API | yes | `writeAllowed` Origin + JSON on POST; GET has no side effect |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged solo wins | Tampering | never ranked (D-01/D-02), plausibility, 30/day via PlayerHub |
| Replay / double submit | Tampering | `solo:<user>:<uuid>` key, `ON CONFLICT DO NOTHING` |
| Reading another player's history | Information disclosure | session-scoped queries only |
| Friend enumeration through ranking | Information disclosure | circle = self ∪ own friendships |
| CSRF on the report | Spoofing | Origin + JSON content type |
| XSS through names | Tampering | Svelte text binding; `no-raw-html.test.ts` exists |
| Flooding D1 | Denial of service | rate limit + 8 KB body cap |
| Account farming the ranking (two accounts of one person) | Tampering | accepted at family scale |

## Proposed Plan Breakdown (waves)

Coarse granularity; each plan ends with its tests green.

**Wave 1 (parallel, no shared files)**
- **05-01 Résultats côté serveur : la donnée.** `foldTally` in `@toc/engine` (+ tests); `RecordSeat`/`GameRecord` extended, `table.tally` folded in `commitPlay`, reset at start/rematch, `copyTable` defaults; `0003_results.sql`; `writeGame` batch (legacy + `played` + `game_seats`, EXISTS guard); workerd tests: two accounts + guest + computer, idempotent rewrite, missing user, retry, rows measured with `x-toc-d1`/meta.
- **05-02 Les marques des places.** `knight-mark-{colour}` symbols, `Pawn`/`PawnTray` use, `knightMarks` setting and « Formes sur les chevaux » switch, stable marks in `packages/board` art with clearance tests, knight accessible names. Includes the Open Question 1 checkpoint.
- **05-03 Le moteur des leçons.** `lessons.ts` (8 scripts, cells → progress), `lessonRunner.ts` gate and steps, `createGame` `script` option, Node replay tests for every lesson and every wrong line.
- **05-04 La feuille « Règles ».** `Sheet size="large"`, `RulesSheet`, `CardRule`, `RuleFigure` (live SVG + `ruleFigures.ts` checked against scenarios), `regles.ts`, entry points (home tile wiring can wait for 05-08), game strip/info buttons, « R », hold of solo computers, « C'est à toi de jouer » line online.

**Wave 2**
- **05-05 L'API des résultats** (after 05-01). `packages/protocol/src/results.ts` schemas; routes history/stats/ranking/solo; pure `aggregate.ts` (filters, partners, levels, ranking with ties); PlayerHub rate kind; workerd tests incl. 401/403/415/413/400/429, idempotency, no foreign ids in answers.
- **05-06 L'écran des leçons** (after 03, 04). `Game.svelte` lesson mode, `GuideBand`, guide halo in `Overlay`, `LessonPlank`, `LessonsSheet`, `#/apprendre` and `#/apprendre/<n>`, `toc.tutorial.v1`, Réglages « Quitter les leçons »; `e2e/lecons.spec.ts` (each lesson with one wrong choice) and the band-text fit test.

**Wave 3**
- **05-07 Le rapport des parties solo** (after 05-01, 05-05). Tally + `startedAt` in the local controller, report builder (real deals only), pending queue with account tag, EndScreen line; unit tests.
- **05-08 « Mes résultats » et l'accueil** (after 05-05, 05-06, 05-04). `Results.svelte` + nav + three panels + `GameSheet` + « Le classement » sheet; home links row; « Première fois ? »; waiting-room hint; `e2e-online/resultats.spec.ts` (two accounts + guest + solo: both histories, ranking counts only the two-account game, solo in stats only).

**Wave 4**
- **05-09 L'audit APP-05** (after all). `checkpoint:human-verify` then install `@axe-core/playwright@4.14.0`; `e2e/accessibilite.spec.ts` over every route/sheet at 844 × 390, 750 × 342, 480 × 320, 1280 × 800 (axe + 44 px + names + French deny-list); `contrast.test.ts`; catalogue deny-list unit test; the fixes the audit finds (e.g. 44 px rows in « Crédits et licences »); `clavier.spec.ts` extended; deploy note (apply 0003 remotely before the Worker).

## Sources

### Primary (HIGH confidence)
- Repository files read this session: `apps/worker/src/{GameRoom,record,index,db,http,me,PlayerHub,storage}.ts`, `apps/worker/migrations/0001_games.sql`, `0002_accounts.sql`, `apps/worker/vitest.config.ts`, `packages/table/src/{record,table,accounts,reduce,summary}.ts`, `packages/engine/src/{types,events,topology,state,scenario}.ts`, `packages/protocol/src/{frames,account,index}.ts`, `apps/web/src/game/{GameController,session.svelte,turnUi}.ts`, `apps/web/src/routes/Game.svelte`, `apps/web/src/board/{KnightDefs,Pawn,BoardArt}.svelte`, `apps/web/src/i18n/fr/seats.ts`, `apps/web/src/settings/settings.ts`, `apps/web/vite.config.ts`, `apps/web/playwright*.config.ts`, `apps/web/e2e/cibles.spec.ts`, `tools/render-scenarios.mjs`, `tools/build-embedded-worker.mjs`, `wrangler.embarque.jsonc`, `RULES.md`, 04-RESEARCH.md, 04-12-SUMMARY.md, 05-CONTEXT.md, 05-UI-SPEC.md.
- Measurements this session: release build size (vite build to scratch), webp re-encode sizes (sharp), scenario `after` presence (node).
- npm registry (`npm view`): `@axe-core/playwright` 4.14.0 / 4.13.0 peers, deps, licence, scripts; `axe-core` 4.14.0.

### Secondary (MEDIUM confidence)
- 04-RESEARCH Pattern 9 citing Cloudflare's d1-pricing (100 000 rows written/day, index rows counted), confirmed by the 04-12 measurements.

### Tertiary (LOW confidence)
- Workers script size limits (A1), axe API details (A2), axe rule deprecations (A6): training knowledge; developers.cloudflare.com was not reachable from this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new runtime dependency; dev dependency checked on the registry.
- Architecture: HIGH — every choke point read in code.
- Pitfalls: HIGH for the codebase ones, MEDIUM for the platform size limit.

**Research date:** 2026-11-07
**Valid until:** 2026-12-07
