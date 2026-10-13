# Phase 1: Une vraie partie sur un appareil - Pattern Map

**Mapped:** 2026-10-13
**Files analyzed:** 41 (new files; no existing file is modified except assets/audio/LICENSES.md which is new)
**Analogs found:** 0 in-repo / 41. The repo is greenfield: `git ls-files` shows only `.planning/`, `.claude/` and `assets/plateau/quart-*.webp`. No application code exists, so no in-repo analog can be named.

Reference patterns therefore come from `01-RESEARCH.md` (cited as `RESEARCH:<lines>`), its Appendices A-D, `01-UI-SPEC.md` and `.planning/research/ARCHITECTURE.md`. All paths below are git-tracked planning documents; no gitignored mirror paths are used.

Rule for the planner: the first file written in each package (marked FIRST) becomes the in-repo analog for the rest of that package. Later plans should then cite that file instead of RESEARCH.

## File Classification

| New File | Role | Data Flow | Reference Pattern (no in-repo analog) | Match |
|----------|------|-----------|----------------------------------------|-------|
| `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json` | config | n/a | RESEARCH Standard Stack + Installation (RESEARCH:175-219), Pitfalls 1, 2, 5 | reference-only |
| `packages/engine/src/types.ts`, `topology.ts` | model | transform | RESEARCH Pattern 1 (RESEARCH:297-314) | reference-only |
| `packages/engine/src/rng.ts`, `deck.ts` | utility | transform | RESEARCH sfc32 example (RESEARCH:482-497) | reference-only (code given) |
| `packages/engine/src/path.ts`, `moves/*.ts`, `legal.ts` | service (pure) | transform | Pattern 1 and 1b | reference-only |
| `packages/engine/src/seven.ts` | service (pure) | transform | Pattern 2 (RESEARCH:316-320) | reference-only |
| `packages/engine/src/reducer.ts`, `events.ts`, `view.ts`, `replay.ts` | service / model | event-driven | Patterns 3, 5, 6 (RESEARCH:322-345) | reference-only |
| `packages/engine/test/scenarios/*.ts` | test | request-response | Pattern 8 (RESEARCH:350-361) | reference-only |
| `packages/engine/test/props/*.test.ts` | test | transform | Property tests list (RESEARCH:433-434) | reference-only |
| `packages/engine/test/purity.test.ts` | test | file-I/O (greps src) | RESEARCH:295 | reference-only |
| `packages/board/layout.json` | config (generated data) | batch | Appendix A output + Appendix B values (RESEARCH:680-773) | exact (data given) |
| `packages/board/rotate.ts` | utility | transform | Pattern 7 formula `(x,y)->(2560-y,x)` (RESEARCH:348) | reference-only |
| `packages/board/hopTimeline.ts` | utility | transform | Hop timeline code (RESEARCH:500-517) | exact (code given) |
| `packages/bots/src/randomLegal.ts` | service | transform | RESEARCH architecture diagram (RESEARCH:261-263), `legalActions` from engine | reference-only |
| `tools/calibrate-board/calibrate.mjs` | utility (script) | batch / file-I/O | Appendix A (RESEARCH:680-759) | exact (code given) |
| `tools/build-board.mjs` | utility (script) | batch / file-I/O | sharp composite, offsets from RESEARCH:393 and sizes RESEARCH:348 | partial (Appendix A shows the sharp usage) |
| `tools/rules-trace.mjs` | utility (script) | batch | RESEARCH:361 | reference-only |
| `RULES.md` | docs | n/a | Structure RESEARCH:427-428, G1-G10 table RESEARCH:413-425 | reference-only |
| `assets/audio/LICENSES.md` | docs | n/a | RESEARCH:789, Pitfall 10 | reference-only |
| `apps/web/src/game/GameController.ts` | controller | event-driven | Diagram RESEARCH:251-273 | reference-only |
| `apps/web/src/game/turnUi.ts` | store (pure reducer) | event-driven | Pattern 6 | reference-only |
| `apps/web/src/game/director.ts`, `renderReduce.ts` | service | event-driven | Patterns 4, 5 | reference-only |
| `apps/web/src/board/Board.svelte` and sub-components | component | request-response | Pattern 7 (RESEARCH:347-348) | reference-only |
| `apps/web/src/board/Knight.svelte` + symbol defs | component | transform | Appendix C (RESEARCH:776-784) | partial (silhouette path given) |
| `apps/web/src/board/animator.ts` | service | event-driven | WAAPI snippet (RESEARCH:519-525) and structure RESEARCH:339 | exact (code given) |
| `apps/web/src/audio/engine.ts` (unlock, schedule) | service | event-driven | Audio unlock snippet (RESEARCH:527-537) | exact (code given) |
| `apps/web/src/audio/synth.ts` | utility | transform | Appendix D (RESEARCH:786-792) | recipe-only |
| `apps/web/src/audio/AudioBackend.ts` (interface + fake) | service | event-driven | RESEARCH:622 | reference-only |
| `apps/web/src/i18n/fr.ts` | config | transform | Pitfall 12 (RESEARCH:475-476), Pitfall 4 | reference-only |
| `apps/web/src/settings/settings.ts` | store | CRUD (localStorage) | Security table RESEARCH:637 | reference-only |
| `apps/web/src/routes/*.svelte` (`#/`, `#/partie`, `#/sons`, dev `#/scenario/:id`) | route / component | request-response | Hash router note RESEARCH:383 | reference-only |
| `apps/web/e2e/*.spec.ts`, `playwright.config.ts` | test | request-response | Playwright config (RESEARCH:539-553) | exact (code given) |
| `apps/web/vite.config.ts`, `svelte.config.js` | config | n/a | RESEARCH:139, Standard Stack | reference-only |

## Pattern Assignments

### Workspace config (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `biome.json`)

**Reference:** RESEARCH:211-217 (installation commands), RESEARCH:441-446, 454-455 (pitfalls).
- Root `package.json`: `"packageManager": "pnpm@10.34.7"`; devDependencies `typescript@6.0.3` (NOT 7.0.2, svelte-check crashes), `vitest@^4.1.11` (NOT 5.x), `fast-check@4.10.2`, `@biomejs/biome@2.5.15`, `@playwright/test@1.64.0`, `sharp@0.35.5`, `@types/node@22`. Export `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`.
- Biome: lint/format `.ts` only; exclude `.svelte` from the linter (false "unused variable"). Gate Svelte with `svelte-check@4.7.6`.
- Engine package is "just-in-time": `"exports": {".": "./src/index.ts"}`, no build step. Its tsconfig: `lib: ["ES2022"]`, `types: []` so `window`/`document` are type errors (RESEARCH:295).
- Include the single scaffold `checkpoint:human-verify` about the lockfile (RESEARCH:244).

---

### `packages/engine/src/types.ts` + `topology.ts` (model, transform) - FIRST in engine

**Reference:** Pattern 1, RESEARCH:297-299.
```ts
// Pawn: { zone:'stable' } | { zone:'ring', progress:number } | { zone:'home', slot:0|1|2|3 }
// ringIndex = (EXIT[color] + progress) mod 72
// progress is signed (negative after a backward 4 from the exit) and NOT capped at 70 (D-01 overshoot).
// entry cell = ring index EXIT-2, enterable only when progress >= 70 and progress % 72 == 70.
// Occupancy is derived from the pawn list; no second board array.
```
Constants confirmed by measurement (RESEARCH:395): diamonds/exits at ring index 0 (bleu) / 18 (jaune) / 36 (rouge) / 54 (vert); entry squares at 70 / 16 / 34 / 52. Seats and teams: bleu-rouge and jaune-vert are partners (face to face, D-05). Home slot 0 is nearest the entry square.

Rule defaults still "à valider" (G1-G10, RESEARCH:413-425) must be named exported constants/flags (Pitfall 10, RESEARCH:469-470), never inline literals.

### `packages/engine/src/rng.ts`, `deck.ts` (utility, transform)

**Analog code (copy verbatim, RESEARCH:482-497):**
```ts
export type Rng = [number, number, number, number];
export function next(s: Rng): [number, Rng] { /* sfc32 */ }
export function shuffle<T>(xs: readonly T[], s: Rng): [T[], Rng] { /* Fisher-Yates */ }
```
Constraint: no `Math.random`, `Date.now`, `crypto`, timers in `packages/engine/src` (purity test). The seed comes from the shell: `crypto.getRandomValues(new Uint32Array(4))` in `GameController`.

### `packages/engine/src/path.ts`, `moves/`, `legal.ts` (service, transform)

**Reference:** Pattern 1 and 1b, RESEARCH:301-314.
```
walk q = p+1 ... p+n (check blocksPath at each ring cell)
when q % 72 == 70 and q >= 70 and r = (p+n) - q >= 1:
    if 1 <= r <= 4 and home slots 0..r-1 empty: end in home slot r-1   # MANDATORY (D-02)
    else: continue on ring, progress = p+n                              # D-01, G2
home pawn at slot s moving k: legal iff s+k <= 3 and slots s+1..s+k empty (D-03)
```
One `path(pawn, steps, dir)` is used by legality, previews, the 7, captures, highlighting and animation. Centralise `isProtected` / `blocksPath` predicates (protected pawn = owner's pawn on its own exit; G3, G4, G6). Split `resolveMove(board, seat, action)` (works on a `PlayerView`) from deal/exchange transitions (Pattern 6, RESEARCH:345). `playability(view, seat)` returns per card `{playable:true}` or `{playable:false, reason}` with reasons `no-pawn-can-move | no-pawn-to-exit | jack-no-target | seven-incomplete | blocked-protected` (RESEARCH:436-437).

### `packages/engine/src/seven.ts` (service, transform)

**Reference:** Pattern 2, RESEARCH:316-320. Ordered plan `[{pawn, steps}]` summing to 7, applied in sequence on a cloned board. API: `nextSteps(partialPlan) -> Map<pawn, number[]>` and `isComplete`, using an existence DFS memoised on `(state hash, remaining)` (1.2 ms measured). Full enumeration only in tests. Emit one `pawnMoved` per micro-move and `pawnCaptured{atStep}` per mid-path capture (D-12). Plan is atomic.

### `packages/engine/src/reducer.ts`, `events.ts`, `view.ts` (service, event-driven)

**Reference:** Patterns 3 and 5, RESEARCH:322-342.
- State machine: `DEAL (5|4|4) -> EXCHANGE -> PLAY(turnSeat) -> DEAL_END`; swaps applied together when the 4th choice arrives, one `cardsExchanged` event.
- Event union (RESEARCH:342): `dealt, handDealt(private), cardsExchanged, cardPlayed, pawnExited, pawnMoved{path,dir}, pawnCaptured{by,victim,at,atStep}, pawnSentHome{to}, pawnsSwapped, pawnEnteredHome{path,slot,homeCount}, handDiscarded, playerFinished, reshuffled, turn, gameWon`.
- `viewFor(state, seat)` must never contain another seat's cards (tested; mandatory in Phase 2).
- Events are self-contained so `renderReduce(renderState, event)` is a pure fold equal to the view projection (property test).

### `packages/engine/test/scenarios/*.ts` (test)

**Analog code (Pattern 8, RESEARCH:351-360):**
```ts
export const s: Scenario = {
  id: 'R-10.2', rule: 'R-10', title: 'Le 7 mange ce qu\'il dépasse',
  before: { pawns: { bleu: [{ring: 10}, 'stable', 'stable', 'stable'], rouge: [{ring: 14}, ...] },
            hands: { bleu: ['7♥'] }, turn: 'bleu', phase: 'play' },
  action: { t: 'play7', card: '7♥', plan: [{ pawn: 'bleu0', steps: 7 }] },
  expect: { legal: true, captured: ['rouge0'], after: { /* declarative pawns */ } },
};
```
Scenario inventory to cover: RESEARCH:430-431. Scenarios are declarative data so the same files feed RULES.md pictures, engine tests and the dev route `#/scenario/R-xx.y`. Each scenario id begins with a RULES.md rule id (checked by `tools/rules-trace.mjs`).

### `packages/engine/test/props/*.test.ts` and `purity.test.ts` (test)

**Reference:** RESEARCH:433-434 (properties: 52-card conservation, no two pawns per cell, legal actions apply, 7 sums to 7, same seed -> identical JSON, deals terminate, random-legal games reach `gameWon`, `renderReduce` equals view, no hidden-card leak). Use `fc.assert(..., {seed})` with fixed seeds. Purity test greps `packages/engine/src` for `Math.random|Date.now|new Date|performance|crypto|setTimeout|setInterval|localStorage|fetch|node:` and fails (RESEARCH:295). Include the 10 000-game self-play harness (Open Question 4) reporting mean/max deals.

---

### `packages/board/hopTimeline.ts` (utility, transform)

**Analog code (copy, RESEARCH:500-517):**
```ts
export type Mode = 'normal' | 'fast' | 'reduced';
const SCALE = { normal: 1, fast: 0.4, reduced: 1 } as const;
export const MIN_CLOP_GAP_MS = 50;
export function hopTimeline(n: number, mode: Mode = 'normal') {
  if (mode === 'reduced') return { total: 180, hop: 180, landings: [180], clops: [180] };
  const total = (400 + 133 * (n - 1)) * SCALE[mode];
  const hop = total / n;
  /* landings, gallop (n >= 8) two clops per hop, drop clops closer than MIN_CLOP_GAP_MS */
}
```
Unit-test invariants (RESEARCH:517): monotone, within `[0,total]`, gap >= `MIN_CLOP_GAP_MS`, `hop` decreases with `n`. Keep the cadence table a single config object (sound-test page tunes it).

### `packages/board/layout.json` and `tools/calibrate-board/calibrate.mjs` (config / script, batch)

**Analog:** Appendix A script (RESEARCH:680-759), copy as-is. Offsets: jaune (0,0), rouge (1280,0), bleu (0,1280), vert (1280,1280). Output normalised by /2560 into `packages/board/layout.json`. Expected values in Appendix B (RESEARCH:761-773). Run as a test asserting 72 cells, `exitsAndEntriesOk`, pitch in 122.7-144.8, rotation drift <= 12 px (RESEARCH:397, 619). `console.log` of checks must remain; the script throws if not 72 cells.

### `packages/board/rotate.ts` (utility, transform)

**Reference:** RESEARCH:348. Rotate anchor coordinates only: one clockwise quarter turn is `(x,y) -> (2560 - y, x)`. Rotation per colour: Bleu 0, Jaune -90, Rouge 180, Vert +90 (UI-SPEC table). The `<img>` carries `transform: rotate(k*90deg)`; pawns, cards, badges are not rotated.

### `tools/build-board.mjs` (script, file-I/O)

**Reference:** RESEARCH:348 and 377. `sharp` composite of the four quarters into `plateau-{640,1280,2560}.webp` (q80; measured 64 KB / 238 KB / 880 KB) into `apps/web/public/`. Source quarters stay untouched in `assets/plateau/`. Use the `sharp` read pattern at RESEARCH:712 (`sharp(path).removeAlpha().raw().toBuffer(...)`) as import style (ESM `.mjs`, `import sharp from 'sharp'`).

---

### `apps/web/src/board/animator.ts` (service, event-driven)

**Analog code (RESEARCH:519-525, structure RESEARCH:339):**
```ts
const a1 = mover.animate(keyframesAlongPath(path), { duration: total, fill: 'forwards', easing: 'linear' });
const a2 = arc.animate([{ transform: 'translateY(0)' },
                        { transform: `translateY(${-0.18 * pitch}px)`, offset: 0.5 },
                        { transform: 'translateY(0)' }],
                       { duration: hop, iterations: n });
await Promise.all([a1.finished, a2.finished]);
```
Rules: outer `<g transform=...>` static anchor (attribute) set by Svelte; animate only inner `<g>` via CSS transform (never both on one element); feet at local (0,0) so `rotate()` pivots at the hooves; `px` equals SVG user units in the `0 0 2560 2560` viewBox; no `filter` animation; no `cx/cy`. Both animation and audio start from one `t0 = now + ~60 ms` (Pitfall 8). On `visibilitychange` hidden, pause; on return snap `renderState` (Pitfall 11).

### `apps/web/src/board/Knight.svelte` (component)

**Reference:** Appendix C (RESEARCH:776-784). One `<symbol viewBox="0 0 110 190">` per colour, feet at bottom centre, body `linearGradient` light->body->dark (light = mix(body,#FFF,.35), dark = mix(body,#2B1D12,.40)), 35 % white radial highlight, 3-4 static grain strokes, 3-unit outline `#2B1D12`, no filters, one shared pre-baked shadow ellipse `rx=60 ry=14 fill="#2B1D12" fill-opacity=".28"`, `<use>` instances, mirror via `scale(-1 1)` on the outer group (D-10). Silhouette path is given verbatim in Appendix C. Acceptance sizes 17, 39, 90 px. Known weaknesses: mane ticks escape the silhouette; plain base.

### `apps/web/src/board/Board.svelte` (component)

**Reference:** Pattern 7 (RESEARCH:347-348). Square wrapper `B = min(100vw, 100dvh - chrome, 880px)`; HTML `<img srcset="plateau-1280.webp 1280w, plateau-2560.webp 2560w" sizes="Bpx">` under a single `<svg viewBox="0 0 2560 2560">` holding overlays, pawns, felt cards and the hit layer. Use `$state.raw` for engine views and reassign whole views (RESEARCH:367). No `{@html}`/`innerHTML` (RESEARCH:639). Hit targets overlap (pitch ~19.6 px at 390 px): build the disambiguation tray as a first-class path (Pitfall 7).

### `apps/web/src/audio/engine.ts` (service, event-driven)

**Analog code (RESEARCH:527-537):**
```ts
export function unlock(): AudioContext {
  const ctx = (ctxSingleton ??= new AudioContext());
  (navigator as any).audioSession && ((navigator as any).audioSession.type = 'playback');
  void ctx.resume();            // synchronously inside the click handler
  return ctx;
}
// retry on every later pointerdown while ctx.state !== 'running'; never await audio in the game loop
```
Schedule clops with `AudioBufferSourceNode.start(t)` on the `AudioContext` clock using `hopTimeline(...).clops`; `MIN_CLOP_GAP_MS`, voice pool (steal oldest); +-4 % `playbackRate`, +-1.5 dB gain jitter (RESEARCH:788). Loader tries `[m4a, mp3]` with try/catch decode (Pitfall 3). All behind an `AudioBackend` interface with a fake recording `start(t)` calls for tests.

### `apps/web/src/audio/synth.ts` (utility, transform)

**Reference:** Appendix D (RESEARCH:786-792). Hoof: noise burst -> bandpass 1400 Hz (+120 Hz per variant, Q 1.2) with 2 ms attack and exponential decay by 70 ms, plus sine 170->60 Hz over 90 ms; 3 variants. Neigh: sawtooth 420->900 (0.25 s) ->700 (0.5 s) ->330 Hz, 22 Hz vibrato +-18 Hz, three bandpass formants (650/1300/2700 Hz), 12 % breath noise; variants joyful, plainte, surpris, ruade by changing duration/pitch/formants. Render once at unlock with `OfflineAudioContext`. Each synthesised sound gets a `LICENSES.md` row "Généré par le code".

### `apps/web/src/game/turnUi.ts` (store, event-driven)

**Reference:** Pattern 6 (RESEARCH:344-345). States: `idle | cardSelected | modeChoice | pawnPreview | jackTarget | sevenBuilding(plan) | exchangeChoosing | deadHand | waiting`. `reduce(uiState, uiEvent, view)` plain TS, Vitest-tested; Svelte only renders. Preview is `resolveMove` on a copy. Never auto-play a forced move or auto-pose a human dead hand (D-19, D-20).

### `apps/web/src/game/GameController.ts` (controller, event-driven)

**Reference:** diagram RESEARCH:251-273. Seed from `crypto.getRandomValues(4xu32)`; bot turn: 700-1300 ms think delay then `randomLegal(view)`; produce `events[]` into the Director queue; input locked until Director idle. Replaced by the Durable Object in Phase 2, so keep it a thin shell around `engine`.

### `apps/web/src/i18n/fr.ts` (config)

**Reference:** Pitfalls 4 and 12 (RESEARCH:451-452, 475-476). Typed keys; unit test scanning strings for plain-space before `? ! ; :` and straight apostrophes; strings must use U+202F/U+00A0 and `’`. Do not assert the font contains U+202F.

### `apps/web/src/settings/settings.ts` (store, CRUD)

**Reference:** Security table RESEARCH:637. Keys `toc.settings.v1`, `toc.soundnotes.v1`, last colour; `JSON.parse` in try/catch, validate shape, clamp ranges, fall back to defaults (hand-written `parseSettings`, no zod). Settings cover mute, ambience volume, reduced animations, fast mode (FX-06, D-25).

### `apps/web/e2e/*.spec.ts`, `playwright.config.ts` (test)

**Analog code (copy, RESEARCH:541-551):**
```ts
export default defineConfig({
  testDir: 'e2e',
  webServer: { command: 'pnpm --filter @toc/web build && pnpm --filter @toc/web preview --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:4173', launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--no-sandbox'] } },
  projects: [
    { name: 'phone', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    { name: 'desktop', use: { viewport: { width: 1280, height: 800 } } },
  ],
});
```
Run with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Add explicit viewports 320x480, 375x667, 390x844, 480x320; `page.emulateMedia({reducedMotion:'reduce'})`; hit areas via `boundingBox` >= 44 px; compare `document.getAnimations()` durations to `hopTimeline`. Do not test animation in jsdom (no `Element.animate`).

### `RULES.md`, `assets/audio/LICENSES.md`, `tools/rules-trace.mjs`

**Reference:** RULES.md structure `R-01..R-16`, each block **Règle** / **Cas limites** (cite G-numbers) / **Scénarios** (ids `R-10.1`...), every unconfirmed default marked « à valider » (RESEARCH:427-428). `rules-trace.mjs` fails if a `### R-xx` heading has no scenario or a scenario cites an unknown rule (RESEARCH:361). `LICENSES.md`: one row per audio file, synthesised sound, font, icon and card art (RESEARCH:119-120 manifest, 789).

## Shared Patterns

### Engine purity
**Source:** RESEARCH:295, Architectural map RESEARCH:161-173
**Apply to:** everything in `packages/engine`, `packages/bots`, `packages/board/hopTimeline.ts`, `rotate.ts`
No I/O, no clock, no `Math.random`; deterministic from `(state, action)`; reusable unchanged by the Durable Object (Phase 2) and bots (Phase 3).

### One source of truth for movement
**Source:** Pattern 1 (RESEARCH:314)
**Apply to:** legality, preview, 7 plans, captures, highlights, animation paths
Single `path()` plus `isProtected`/`blocksPath`; never a position-based second code path for 4, 7 or Jack.

### Events as the animation/audio contract
**Source:** Patterns 4 and 5 (RESEARCH:326-342)
**Apply to:** Director, animator, audio engine, fast-forward, Phase 2 network
Animate only from events; `renderReduce` fold equals view; `hopTimeline` is the only timing source for both WAAPI and audio.

### Named constants for unvalidated rules
**Source:** Pitfall 10 (RESEARCH:469-470), G1-G10
**Apply to:** all engine rule code. `TODO ask Romain` in code is a blocker.

### Input validation of untrusted browser data
**Source:** Security table (RESEARCH:637-639)
**Apply to:** settings store, router, debug routes
try/catch `JSON.parse`, allow-listed URL params, debug routes gated by `import.meta.env.DEV`, no `{@html}`, self-hosted fonts and icons.

### Svelte state
**Source:** RESEARCH:367
**Apply to:** all `.svelte` files holding engine data: `$state.raw`, replace the whole view, never mutate.

## No Analog Found

Everything: the repo has no application code. The planner should treat the "FIRST" file of each package as the analog for later plans, and use RESEARCH sections cited above for the first file. Items with exact reusable code in RESEARCH: `rng.ts`/`shuffle` (RESEARCH:482-497), `hopTimeline.ts` (RESEARCH:500-517), `animator.ts` snippet (RESEARCH:519-525), audio `unlock` (RESEARCH:527-537), `playwright.config.ts` (RESEARCH:541-551), `calibrate.mjs` (RESEARCH:680-759), `layout` numbers (RESEARCH:761-773), knight silhouette path (RESEARCH:780-783). Items with only prose/recipe guidance: engine movement and seven planner, `turnUi`, `GameController`, Svelte components, `synth.ts` (Appendix D), `fr.ts`, card art (Open Question 2: plain pip cards behind a face manifest until Romain decides), `build-board.mjs`.

## Metadata

**Analog search scope:** whole repo via `git ls-files` (only .planning, .claude, assets/plateau tracked); CONTEXT.md, RESEARCH.md (all 792 lines) read.
**Files scanned:** 18 tracked non-.claude files listed; 0 source files.
**Pattern extraction date:** 2026-10-13
