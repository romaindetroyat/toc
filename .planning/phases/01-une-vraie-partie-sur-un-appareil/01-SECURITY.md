---
phase: "01"
slug: "une-vraie-partie-sur-un-appareil"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-13"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| npm registry → repo | Third-party packages installed or fetched at build time (pnpm, svg-cards via npm pack) | Code, assets (supply chain) |
| Engine state → player view | Full GameState (all hands, talon order) vs what a seat may see | Hidden cards (confidential to their seat) |
| Engine → bots | Bots decide from a PlayerView only | Hidden cards |
| Browser storage / URL hash → app | localStorage settings and sound notes, debug hash parameters | Untrusted user-controlled input |
| Debug build → production build | Debug hooks, routes and overlays compiled out by `__TOC_DEBUG__` | Internal state |

Phase 1 is a single-device, offline game: no server, no account, no network traffic beyond the static app. The multi-device trust boundary (client → server) arrives in Phase 2; `viewFor` and `eventsFor` (added by WR-A03) are its ready-made projections.

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-SC | Tampering (supply chain) | npm installs (all plans) | high | mitigate | Blocking-human legitimacy gate in 01-01 and 01-07; exact pins; lockfile committed; pnpm 10 skips install scripts; later plans add no package | closed |
| T-01-SC (svg-cards) | Tampering (supply chain) | svg-cards@4.0.2 via npm pack | high | mitigate | Verified by Romain (01-07); fetched with npm pack outside the repo, only 12 SVG + licence copied; sha512 digest pinned per version, unknown versions refused (WR-A01, 485bba8) | closed |
| T-01-01 | Tampering | apps/web/src/settings/settings.ts | medium | mitigate | parseSettings validates/clamps/allow-lists; storage and JSON.parse in try/catch; settings.test.ts | closed |
| T-01-02 | Information disclosure | apps/web/src/debug.ts, window.__tocDebug | low | mitigate | Compile-time `__TOC_DEBUG__`; production dist grepped: no `__tocDebug`, no geometry overlay, no `#/panne` | closed |
| T-01-03 | Tampering (XSS) | apps/web/src (all) | medium | mitigate | No `{@html}`/innerHTML/outerHTML; enforced by no-raw-html.test.ts | closed |
| T-01-04 | Repudiation | RULES.md vs engine | low | mitigate | rules-trace gate: 16 règles, 103 scénarios OK | closed |
| T-01-05 | Information disclosure | fonts/icons delivery | low | mitigate | Self-hosted woff2, inline icons, no CDN URL | closed |
| T-01-06 | Tampering | apps/web/src/audio/soundNotes.ts | low | mitigate | parseNotes allow-lists keys/ratings; try/catch; soundNotes.test.ts | closed |
| T-01-07 | Tampering (XSS) | « Copier mes notes » | low | mitigate | writeText plain text; fallback via Svelte value binding | closed |
| T-01-08 | Denial of service | audio voice pool | low | mitigate | MAX_VOICES with stealing, queue cap, MIN_CLOP_GAP_MS, fire-and-forget cues | closed |
| T-01-09 | Tampering | packages/engine/src/apply.ts | medium | mitigate | apply accepts only actions in legalActions, throws IllegalActionError; action shape validated first (WR-A02, 094b27f) | closed |
| T-01-10 | Information disclosure | packages/engine/src/view.ts | medium | mitigate | viewFor exposes own cards + counts; deal.test.ts scans for foreign ids; event stream projection eventsFor with leak property test (WR-A03, df84cae) | closed |
| T-01-11 | Tampering (predictable deals) | packages/engine/src/rng.ts | low | mitigate | Seeded sfc32 only; purity.test.ts | closed |
| T-01-12 | Information disclosure | packages/bots/src/randomLegal.ts | medium | mitigate | Parameter typed PlayerView; type-level test | closed |
| T-01-13 | Denial of service | packages/engine/src/seven.ts | low | mitigate | Memoised existence DFS, 5 ms bound tested; bots call with sevenPlans:'none' | closed |
| T-01-14 | Denial of service | apps/web/src/game/director.ts | low | mitigate | Hidden-tab snapToEnd, bounded fast/reduced durations | closed |
| T-01-15 | Tampering (XSS) | apps/web/src/ui/Card.svelte | medium | mitigate | Court figures via `<img src>`, never inlined | closed |
| T-01-16 | Repudiation (licence) | assets/audio/LICENSES.md | medium | mitigate | licences.test.ts fails on a bundled asset without a licence row | closed |
| T-01-17 | Repudiation | RULES.md decisions | low | mitigate | Romain's answers quoted; constants cite G-numbers and validation date | closed |
| T-01-18 | Tampering | apply.ts (seven) | medium | mitigate | applyPlan + isComplete atomically; seven.test.ts and invariants | closed |
| T-01-19 | Information disclosure / Tampering | apps/web/src/game/debugParams.ts | medium | mitigate | DEBUG only; allow-listed, size-capped, shape-checked; debugParams.test.ts | closed |
| T-01-20 | Tampering | GameController.ts submit | medium | mitigate | Routed through apply() | closed |
| T-01-21 | Tampering (predictable deals) | GameController.ts seeds | low | mitigate | crypto.getRandomValues outside debug; GameController.test.ts | closed |
| T-01-22 | Information disclosure | GameController.ts bots | medium | mitigate | Bots called with viewFor(state, bot); test asserts it | closed |
| T-01-23 | Tampering | turnUi.ts (modes, Valet, tray) | medium | mitigate | Options only from legalActions; apply re-validates | closed |
| T-01-24 | Information disclosure | audio engine debug hooks | low | mitigate | Debug builds only | closed |
| T-01-25 | Information disclosure | DebugGeometry.svelte | low | mitigate | Dynamic import behind DEBUG, allow-listed hash; dist grep empty | closed |
| T-01-26 | Tampering | tools/render-scenarios.mjs | low | mitigate | Background only via composeBoard; writes only docs/regles | closed |
| T-01-27 | Denial of service | Board/Pawn rendering | low | mitigate | Shared symbols, no SVG filters, WAAPI on inner groups | closed |
| T-01-28 | Tampering (XSS) | CreditsSheet.svelte | low | mitigate | Text bindings, URLs as plain text | closed |
| T-01-29 | Information disclosure | Game.svelte, HandFan, Overlay | medium | mitigate | Components read only session.view and renderState | closed |
| T-01-30 | Information disclosure | FeltTable, HandFan (exchange) | low | mitigate | Felt draws public RenderState only; bots' hands as counts | closed |
| T-01-31 | Tampering | turnUi.ts (sevenBuilding) | medium | mitigate | Chips from nextSteps; apply re-validates | closed |
| T-01-32 | Denial of service | director.ts card queue | low | mitigate | ≤20 cards per deal, bounded staggers, transform/opacity only | closed |
| T-01-33 | Information disclosure | App.svelte svelte:boundary | low | mitigate | Only the French message + reload, no error text/stack; bot-loop and start-up failures routed there (WR-B-01, WR-C-01) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

No accepted risks.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-13 | 34 | 34 | 0 | gsd secure-phase (L1, register from plans; summaries' Threat Flags all "None"; spot-checks: no-raw-html test, production dist grep, seed source, card-art digest pin) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-13
