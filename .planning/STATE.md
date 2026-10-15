---
gsd_state_version: "1.0"
current_phase: 1
current_phase_name: Une vraie partie sur un appareil
status: executing
stopped_at: Phase 3 context gathered
last_updated: "2026-10-15T09:01:04.122Z"
last_activity: 2026-10-13
last_activity_desc: Phase 1 execution started
state_head: c32ffdc90952ec7a0259a0761869605f997efe22
progress:
  total_phases: 5
  completed_phases: 0
  total_plans: 53
  completed_plans: 53
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-10-13)

**Core value:** Une vraie partie de TOC, fidèle aux règles maison, jouable à distance entre proches sur n'importe quel appareil, avec l'ambiance du plateau original (chevaux animés, bruitages).
**Current focus:** Phase 1 — Une vraie partie sur un appareil

## Current Position

Phase: 1 (Une vraie partie sur un appareil) — EXECUTING
Plan: 1 of 24
Status: Executing Phase 1
Last activity: 2026-10-13 — Phase 1 execution started

Progress: [░░░░░░░░░░] 0%

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**
- Last 5 plans: -
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: 5 phases verticales (granularité coarse, mode MVP) : partie complète sur un appareil, puis en ligne, puis ordinateur de niveau 1 à 5, puis comptes, amis et PWA, puis suivi, apprentissage et finition.
- [Roadmap]: RULES.md (RULE-20) est rédigé puis validé par Romain au début de la phase 1, avant le codage du moteur. Les questions 5 à 34 de research/SUMMARY.md suivent les hypothèses par défaut.
- [Roadmap]: En phase 1, les adversaires sont des joueurs ordinateur de niveau 1 (coup légal au hasard). Les niveaux 2 à 5 arrivent en phase 3.
- [Roadmap]: En phase 2, on rejoint une table par son lien, avec un pseudo provisoire. Les comptes et les amis arrivent en phase 4.
- [Roadmap]: L'accessibilité (APP-05) est vérifiée en phase 5, mais les repères de place non colorés et les zones tactiles de 44 px s'appliquent dès l'interface de la phase 1.

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 1]: RULES.md doit être validé par Romain avant le moteur. La géométrie du plateau (calibration de layout.json) est à confiance faible. Aucun hennissement CC0 n'est confirmé : prévoir un spike, avec la synthèse en repli. Le son iOS est à tester sur un appareil.
- [Phase 2]: Revérifier les limites et la facturation des Durable Objects, ainsi que la sémantique des alarmes. Romain doit fixer la durée maximale de la pause.
- [Phase 3]: Budget CPU des niveaux 4 et 5 dans le Durable Object à profiler (de 20 ms à 800 ms selon les sources).
- [Phase 4]: Choisir le domaine personnalisé (RP ID des passkeys) et le fournisseur d'e-mail avant de commencer. Tester la connexion depuis la PWA installée sur iOS.
- [Phase 4]: APP-03 (notifications) est en v1, alors que la recherche proposait de reporter Web Push en v1.x. Sur iOS, Web Push ne fonctionne que dans l'application installée.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| *(none)* | | | | |

## Session Continuity

Last session: 2026-10-15T09:01:03.906Z
Stopped at: Phase 3 context gathered
Resume file: .planning/phases/03-l-ordinateur-la-force-choisie/03-CONTEXT.md
