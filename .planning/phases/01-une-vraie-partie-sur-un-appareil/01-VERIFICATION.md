---
phase: 01-une-vraie-partie-sur-un-appareil
verified: 2026-10-13T23:45:00Z
status: human_needed
score: 9/9 must-haves verified
covered_files: [".planning/phases/01-une-vraie-partie-sur-un-appareil/01-01-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-01-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-02-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-02-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-03-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-03-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-04-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-04-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-05-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-05-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-06-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-06-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-07-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-07-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-08-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-08-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-09-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-09-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-10-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-10-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-11-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-11-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-12-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-12-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-13-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-13-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-14-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-14-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-15-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-15-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-16-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-16-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-17-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-17-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-18-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-18-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-19-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-19-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-20-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-20-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-21-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-21-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-22-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-22-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-23-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-23-SUMMARY.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-24-PLAN.md",".planning/phases/01-une-vraie-partie-sur-un-appareil/01-24-SUMMARY.md","RULES.md","apps/web/src/game/GameController.ts","apps/web/src/game/cues.ts","apps/web/src/routes/Game.svelte","assets/audio/LICENSES.md","packages/board/src/hopTimeline.ts","packages/engine/src/apply.ts","packages/engine/src/legal.ts","packages/engine/src/moves.ts","packages/engine/src/path.ts","packages/engine/src/state.ts"]
covered_digest: "v3:sha256:f03df1567a06405c48f04fc8b16a1c86348d4cab26debee746bc8c3e29430fa4"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Sur un vrai iPhone (Safari, puis l'app ajoutée à l'écran d'accueil), ouvrir #/partie, toucher une carte, puis jouer un coup. Mettre l'app en arrière-plan, revenir, toucher à nouveau."
    expected: "Les sabots, hennissements et sons de cartes se font entendre dès le premier toucher. Après un retour d'arrière-plan, le prochain toucher relance le son. Le bouton « Réessayer » du toast fonctionne si le son ne démarre pas."
    why_human: "Le déblocage de l'AudioContext sur iOS dépend de WebKit réel (événements d'activation utilisateur, interruption en arrière-plan). Chromium sous Playwright ne le reproduit pas. Les correctifs WR-B-03 et WR-B-04 ne sont validés que par des tests simulés."
  - test: "Écouter à l'oreille la page #/sons, puis une partie entière : sabots (1, 4, 13 cases), les six hennissements, les trois sons de cartes, l'ambiance."
    expected: "Les hennissements synthétiques sont reconnaissables comme des chevaux et agréables, la cadence des sabots suit la vitesse du cheval, l'ambiance reste discrète. Romain note chaque son (« À écouter · Bon · À changer »)."
    why_human: "Tous les sons sont générés par le code (aucun enregistrement CC0 retenu). La qualité perçue ne se mesure pas par un test ; D-22 prévoit que Romain valide à l'oreille."
  - test: "Regarder une partie sur un petit téléphone (320x480 et 375x667) et sur un écran de 1280x800 : les seize cavaliers, les quatre couleurs, la lettre A–D sur les cavaliers allumés."
    expected: "Les cavaliers (dessin de Romain, ombre portée) restent lisibles et distinguables en quatre couleurs (jaune sur le chêne compris) à environ 17 px de large, et on reconnaît leur direction."
    why_human: "Lisibilité visuelle à petite taille : jugement humain. Le dessin des cavaliers a été remplacé en cours de phase par l'image de Romain (commit fd790c2)."
  - test: "Sur un téléphone en portrait de faible hauteur (par exemple 320x480, 360x640), jouer quelques coups."
    expected: "Le plateau devient plus petit pour laisser la place à la main et à la zone d'action, sans défilement de la page, et reste assez grand pour viser un cheval avec le doigt."
    why_human: "Le critère « tient sans défilement » est testé automatiquement (cinq tailles d'écran). Savoir si le plateau réduit reste agréable à jouer est un jugement humain."
  - test: "Jouer à la main une partie complète en vitesse normale (réflexion des ordinateurs d'environ 1 s, animations réelles), avec un As, un Roi, un 4, un Valet et un 7."
    expected: "Le rythme est naturel, les animations (ruade et éjection en arc, bonds croisés du Valet, fête du 4e cheval) sont plaisantes et ne gênent pas la lecture."
    why_human: "Le ressenti des animations et du rythme est subjectif. Les durées sont vérifiées par les tests (799 ms pour 4 cases, 320 ms en avance rapide), pas leur effet."
---

# Phase 1 : Une vraie partie sur un appareil, rapport de vérification

**Objectif de la phase :** Un joueur fait une partie complète de TOC, fidèle aux règles maison validées par Romain, contre trois joueurs gérés par l'ordinateur, sur le plateau original, avec des cavaliers animés et sonorisés.
**Vérifié le :** 2026-10-13
**Statut :** human_needed (aucun écart, cinq points à juger par un humain)
**Re-vérification :** Non, vérification initiale

## Réalisation de l'objectif

Hypothèse de départ : tâches finies, objectif manqué. Elle n'a pas tenu. Le code, les tests et une partie jouée au doigt dans un navigateur prouvent chaque critère. Les seuls points restants sont ceux qu'un humain seul peut juger.

### Vérités observables

| # | Vérité | Statut | Preuve |
|---|--------|--------|--------|
| 1 | SC1 : RULES.md validé par Romain, règles numérotées et illustrées, tous les scénarios passent contre le moteur (sortie protégée, 7 qui mange, 4 en arrière, Valet, entrée exacte) | VERIFIED | `RULES.md` en-tête « Validé par Romain le 2026-10-13 », aucun « à valider » restant. 16 règles R-01 à R-16, 103 scénarios. `node tools/rules-trace.mjs --images` : `OK (16 règles, 103 scénarios)`. `packages/engine/test/scenarios.test.ts` exécute chaque fixture (légalité, captures, état final, événements) : passe. Les deux tests ignorés sont les scénarios « alt » (R-09.9, R-15.9), alternatives de points tranchés, voulues. Les cas limites sont couverts par des scénarios nommés : sortie protégée (R-12), 7 qui mange (R-10/R-11), 4 depuis la sortie et jamais vers la maison (R-08), Valet (R-09), entrée au compte exact (R-13). Réponse de Romain citée mot pour mot dans 01-07-SUMMARY. |
| 2 | SC2 : partie complète sur plateau original contre 3 ordinateurs au coup légal aléatoire ; donnes 5/4/4, donneur qui change, main injouable posée, joueur fini qui joue le partenaire, victoire à 8 pions | VERIFIED | Moteur : `state.ts` (`DEAL_SIZES = [5,4,4]`, `endDeal` rebat et change le donneur après la 3e donne), `legal.ts` (poser n'est permis que si rien n'est jouable), `moves.ts` (`controlledPawns` : pions du partenaire une fois les 4 rentrés), `apply.ts`/`finishMove` (`gameWon` quand l'équipe a 8 pions). `node tools/selfplay.mjs --games 300` : 300 parties terminées (jaune-vert 153, bleu-rouge 147, 23 à 100 donnes). Test de propriété sur 200 parties (cartes conservées, une pièce par case, 7 cohérent, toute donne se termine). Playwright `partie-complete.spec.ts` : une partie entière jouée au doigt jusqu'à « Victoire ! / Défaite », tailles de donnes 5/4/4/5…, donneur variable, au moins une main posée. |
| 3 | SC3 : cartes jouables et chevaux mis en évidence, seuls les coups permis proposés ; échange de carte avec l'état « en attente » ; choix sortir/avancer ; assistant du 7 pas à pas ; aperçu du trajet et des prises avant « Jouer » | VERIFIED | `turnUi.ts` (620 lignes, options issues de `legalActions`, `apply` revalide), `ActionZone.svelte`, `SevenPanel.svelte`, `HandFan.svelte`, `HitLayer.svelte`, `Overlay.svelte`, `PawnTray.svelte`. 1269 lignes de `turnUi.test.ts` passent. Playwright `cartes-speciales.spec.ts` (As/Roi, Valet deux touches avec flèches croisées, chevaux serrés, 7 réparti sur deux chevaux avec prise en chemin et un seul « Jouer ») : passe. `partie.spec.ts` : passe. Le jeu ne joue jamais à la place du joueur (`GameController.nextBot()` ne retourne jamais l'humain). |
| 4 | SC4 : cavaliers en fausse 3D aux 4 couleurs animés pour sortie, case par case, prise, retour écurie, entrée maison, échange au Valet ; durée suit la distance ; sabots à la même cadence | VERIFIED | `packages/board/src/hopTimeline.ts` est l'unique source de temps pour l'animation et les sabots (`total = 400 + 133·(n−1)` ms, galop à partir de 8 cases, `MIN_CLOP_GAP_MS = 50`). `cues.ts` dérive les sons des mêmes offsets. `director.ts` (635 lignes), `animator.ts` (sortie en arc, ruade, éjection, arcs croisés du Valet, `homeSettle`, `party`, `winHop`). Playwright `animations.spec.ts` (45 tests lancés avec d'autres specs, tous verts) mesure : bond de 4 cases, 7 qui mange au passage, Valet 900 ms avec arcs croisés, avance rapide 320 ms, réduction des animations 180 ms avec un seul sabot, onglet caché. Voir la note sur les cavaliers ci-dessous. |
| 5 | SC5 : hennissements et sons de cartes (y compris iPhone), licence tracée, son coupable, animations réductibles, jeu entièrement jouable sans son | VERIFIED (iPhone réel à confirmer, voir vérification humaine) | `assets/audio/LICENSES.md` : une ligne par son (les 11 sont « Généré par le code »), police, icônes, plateau, cavaliers, cartes (svg-cards LGPL-2.1) ; `licences.test.ts` échoue si un son du catalogue n'a pas sa ligne. `audio/engine.ts` : sabots planifiés sur l'horloge `AudioContext`, pool de voix, déblocage au premier geste (`unlockOnFirstGesture`), repli en cas d'échec avec toast « Réessayer ». `settings.ts` + `SettingsSheet.svelte` : Son, Bruitages, Ambiance, volume, « Réduire les animations ». `partie-complete.spec.ts` et `audio.spec.ts` : partie entière sans son, échec du son, déblocage au premier geste. Le comportement réel sur iPhone ne peut être prouvé ici. |
| 6 | Le plateau original (4 quarts) est assemblé, net et lisible, sans coupure, sur téléphone portrait comme grand écran | VERIFIED | `plateau-640/1280/2560.webp` générés depuis `assets/plateau/quart-*.webp` par `tools/build-board.mjs`. `board.spec.ts` (cinq tailles : 320x480, 375x667, 390x844, 480x320, 1280x800, carré entièrement dans l'écran, srcset) et `finition.spec.ts`/`cibles.spec.ts` (cibles tactiles d'au moins 44x44, pas de défilement de page) passent sur les projets phone et desktop (157 réussis, 27 ignorés par conception). |
| 7 | Une vraie partie démarre depuis « Jouer la partie » (plus de traceur), l'humain choisit sa couleur, le plateau tourne vers lui, chaque mouvement vient d'un événement du moteur | VERIFIED | `Launch.svelte` + `ColorTile.svelte` (radiogroup 2x2, couleur mémorisée), `Game.svelte` → `createSession` → `GameController` → `Director` → animator. Aucune référence au traceur dans `apps/web/src` hors un test. `rotate.ts` (quarts de tour) testé. `table.spec.ts` : rotation par couleur, cavaliers droits, tête dans le sens de la marche : passe. |
| 8 | Les ordinateurs jouent uniquement avec `viewFor`, avec un rythme naturel (700 à 1300 ms, 200 à 300 ms en avance rapide) et la graine vient de `crypto.getRandomValues` | VERIFIED | `GameController.ts` : `randomLegal(viewFor(state, bot), bot, botRng)`, `thinkDelay`, `randomSeed()` sur `crypto.getRandomValues`. `randomLegal` ne reçoit qu'un `PlayerView` (type). `GameController.test.ts` passe. |
| 9 | Contrôles de qualité du dépôt | VERIFIED | `pnpm typecheck` : 0 erreur, 0 avertissement (engine, board, bots, svelte-check sur 267 fichiers). `pnpm lint` (biome) : propre sur 136 fichiers. `pnpm test` : 34 fichiers, 626 réussis, 2 ignorés (les « alt »). Playwright relancé : 45/45 (`partie-complete`, `animations`, `audio`, `launch`, `cartes-speciales`, projet desktop) puis 157 réussis et 27 ignorés (`finition`, `cibles`, `board`, `partie`, `reglages`, `sons`, `table`, projets phone et desktop). Aucun serveur laissé actif (port 4173 libre). |

**Score :** 9/9 vérités vérifiées (0 présentes mais sans preuve de comportement)

### Note sur les cavaliers (écart assumé, pas un écart de phase)

Le plan 01-08 prévoyait des cavaliers Staunton dessinés en SVG (dégradés, veinage). Romain les a jugés trop laids et a fourni sa propre image de quatre cavaliers. Le commit `fd790c2` la découpe en un sprite par couleur (`tools/build-knights.mjs`, `apps/web/public/cavaliers/*.webp`), montrée par un `<symbol>` par couleur dans `KnightDefs.svelte`, avec une ombre portée précalculée. J'ai ouvert `bleu.webp` : c'est un cavalier d'échecs ombré, avec reflets, bien en « fausse 3D ». L'exigence FX-02 est donc satisfaite, avec un dessin décidé par le propriétaire du projet. La ligne `cavaliers` de `LICENSES.md` trace la provenance. Aucun remplacement de must-have n'est nécessaire ; la lisibilité à petite taille est dans la vérification humaine.

### Éléments reportés

Aucun écart n'est reporté. RULE-19 (le serveur n'envoie jamais la main d'un autre joueur) est assigné à la phase 2. Le moteur y prépare déjà la projection (`viewFor`, `eventsFor`, avec un test de fuite sur 60 parties).

### Artefacts requis

| Artefact | Attendu | Statut | Détails |
|----------|---------|--------|---------|
| `RULES.md` | Règles R-01 à R-16 validées | VERIFIED | 16 règles, scénarios, « Décisions de Romain », pas de marqueur en attente |
| `packages/engine/src/{path,moves,legal,apply,state,seven,view,render}.ts` | Moteur pur, un seul chemin de déplacement | VERIFIED | Lu : `walk()` est utilisé par la légalité, l'aperçu, les prises et le 7 |
| `packages/engine/scenarios/*.ts` | 103 fixtures | VERIFIED | Liées à RULES.md par `rules-trace` |
| `packages/bots/src/randomLegal.ts` | Niveau 1 | VERIFIED | Reçoit un `PlayerView` seulement |
| `packages/board/src/{hopTimeline,motion,rotate,layout}.ts` | Temps unique, rotation, géométrie | VERIFIED | Testés |
| `apps/web/src/game/{GameController,session.svelte,director,turnUi,cues}.ts` | Session locale, metteur en scène, interaction | VERIFIED | Câblés dans `Game.svelte` |
| `apps/web/src/board/*`, `apps/web/src/ui/*` | Plateau, cavaliers, main, 7, As/Roi, fin de partie | VERIFIED | Aucun substitut ; `COURT_FIGURES` rempli (12 SVG) |
| `apps/web/src/audio/{engine,synth,sounds,backend,soundNotes}.ts` | Audio synthétisé sur l'horloge audio | VERIFIED | 11 sons, tous tracés |
| `apps/web/src/routes/{Launch,Game,SoundTest}.svelte` | Écrans | VERIFIED | |
| `assets/audio/LICENSES.md` | Traçabilité | VERIFIED | Test automatique |

### Vérification des liens clés

| De | Vers | Via | Statut | Détails |
|----|------|-----|--------|---------|
| `Launch.svelte` | `Game.svelte` | `#/partie`, couleur mémorisée | WIRED | `table.spec.ts`, `launch.spec.ts` |
| `Game.svelte` | `GameController` | `createSession(env, debug, colour)` | WIRED | `session.start()` après le montage des pions |
| `GameController` | moteur | `apply`, `viewFor`, `startGame` | WIRED | Toute action humaine passe par `apply`, refusée en cas d'illégalité |
| `GameController` | `Director` | `director.enqueue(events)` | WIRED | Chaque événement du moteur, plus de traceur |
| `Director` | animator + audio | `hopTimeline`, `cuesFor` | WIRED | Même chronologie pour le mouvement et les sabots |
| `Game.svelte` | écran d'erreur | `session.failure`, `startFailure` dans `<svelte:boundary>` | WIRED | WR-B-01 et WR-C-01 corrigés |

### Trace du flux de données (niveau 4)

| Artefact | Variable | Source | Données réelles | Statut |
|----------|----------|--------|-----------------|--------|
| `Game.svelte` (pions) | `render.pawns` | `session.render` ← `renderReduce` des événements du moteur | Oui | FLOWING |
| `HandFan.svelte` | `view.hand` | `viewFor(state, human)` | Oui | FLOWING |
| `Card.svelte` (figures) | `COURT_FIGURES` | 12 SVG importés de svg-cards 4.0.2 | Oui | FLOWING |
| `InfoBar.svelte` | donneur, donne, prises | `session.view`, `stats()` | Oui | FLOWING |

### Vérifications de comportement

| Comportement | Commande | Résultat | Statut |
|--------------|----------|----------|--------|
| Parties complètes en auto-jeu | `node tools/selfplay.mjs --games 300` | 300 parties terminées, 35,2 prises par partie en moyenne | PASS |
| Scénarios de RULES.md | `node tools/rules-trace.mjs --images` | OK (16 règles, 103 scénarios) | PASS |
| Moteur, UI logique, audio | `pnpm test` | 626 réussis, 2 ignorés | PASS |
| Parcours complet dans un navigateur | `playwright test partie-complete animations audio launch cartes-speciales --project=desktop` | 45 réussis | PASS |
| Écrans et accessibilité tactile | `playwright test finition cibles board partie reglages sons table` | 157 réussis, 27 ignorés par conception | PASS |

### Exécution de sondes

Aucune sonde `probe-*.sh` n'est déclarée par la phase (phase d'application web). Étape ignorée.

### Couverture des exigences

| Exigence | Plan(s) | Description | Statut | Preuve |
|----------|---------|-------------|--------|--------|
| RULE-01 | 01-06, 01-10 | 4 places, 2 équipes, partenaires face à face | SATISFIED | `topology.ts`, R-01, `table.spec.ts` |
| RULE-02 | 01-10, 01-14 | 52 cartes, donnes 5/4/4, rebattre, donneur change | SATISFIED | `state.ts`, `deal.test.ts`, 300 parties. Le mélange est fait sur l'appareil avec `crypto.getRandomValues` ; la part « côté serveur » vient en phase 2. |
| RULE-03 | 01-10, 01-17 | Échange d'une carte face cachée avec le partenaire | SATISFIED | `giveCard`, scénarios R-04, UI d'échange |
| RULE-04 | 01-12, 01-15 | Tour dans le sens horaire, jouer est obligatoire | SATISFIED | `legalActions`, R-04 |
| RULE-05 | 01-12 | As : sortir ou avancer de 1 | SATISFIED | `movesForCard`, R-05 |
| RULE-06 | 01-12 | Roi : sortir ou avancer de 13 | SATISFIED | idem |
| RULE-07 | 01-12 | Dame 12, autres cartes, 5 propres pions | SATISFIED | idem, R-06/R-07 |
| RULE-08 | 01-12 | 4 recule, depuis la sortie, jamais vers la maison | SATISFIED | `walk` dir −1, R-08 |
| RULE-09 | 01-12, 01-18 | Valet : échange, interdits | SATISFIED | `swapEnds`, R-09 |
| RULE-10 | 01-13, 01-21 | 7 réparti, somme exacte, injouable sinon | SATISFIED | `seven.ts`, R-10 |
| RULE-11 | 01-13 | Le 7 mange ce qu'il dépasse | SATISFIED | `capturePassed`, R-10 |
| RULE-12 | 01-12 | Arrêt sur un pion = prise, jamais sur le sien | SATISFIED | `ringStretch`, R-11 |
| RULE-13 | 01-12 | Pion protégé sur sa sortie | SATISFIED | `isProtected`, `protectorOf`, R-12 |
| RULE-14 | 01-12 | Sortie sur une sortie occupée | SATISFIED | `exitWalk`, R-05 |
| RULE-15 | 01-12 | Maison : tour complet, compte exact, entrée obligatoire | SATISFIED | `walk` (D-01 à D-03), R-13 |
| RULE-16 | 01-12, 01-13, 01-14, 01-15, 01-17 | Main injouable posée | SATISFIED | `legalActions` discard, `handDiscarded`, R-14 |
| RULE-17 | 01-12, 01-17, 01-21 | Joueur fini joue le partenaire | SATISFIED | `controlledPawns`, R-15 |
| RULE-18 | 01-12, 01-14, 01-17 | 8 pions rentrés : victoire | SATISFIED | `finishMove`, R-16, écran de fin |
| RULE-20 | 01-03, 01-05, 01-07 | RULES.md validé, scénarios en test | SATISFIED | voir vérité 1 |
| PLAY-01 | 01-15, 01-16 | Cartes jouables et pions en évidence | SATISFIED | `HandFan`, `HitLayer`, `partie.spec.ts` |
| PLAY-02 | 01-15, 01-16, 01-18 | Carte, pion, aperçu, « Jouer » | SATISFIED | `Overlay`, `ActionZone` |
| PLAY-03 | 01-21 | Assistant du 7 | SATISFIED | `SevenPanel`, `cartes-speciales.spec.ts` |
| PLAY-04 | 01-18 | As/Roi : sortir ou avancer | SATISFIED | `ActionZone`, `cartes-speciales.spec.ts` |
| PLAY-05 | 01-17 | Échange avec indication « en attente » | SATISFIED | `HandFan`, `FeltTable` |
| FX-01 | 01-01, 01-02, 01-08, 01-24 | Plateau net sur tous les écrans | SATISFIED | `board.spec.ts` |
| FX-02 | 01-08 | Cavaliers en fausse 3D, 4 couleurs | SATISFIED (code) / lisibilité à juger | Voir la note sur les cavaliers. La case FX-02 de REQUIREMENTS.md est restée « Pending » : mise à jour de suivi à faire. |
| FX-03 | 01-19 | Animations de sortie, déplacement, prise, retour, maison, échange | SATISFIED | `animations.spec.ts` |
| FX-04 | 01-01, 01-04, 01-19, 01-22 | Durée selon la distance, sabots à la même cadence | SATISFIED | `hopTimeline.ts`, `cues.ts` |
| FX-05 | 01-04, 01-09, 01-11, 01-19, 01-20, 01-22 | Bruitages, licence tracée | SATISFIED | `LICENSES.md`, `licences.test.ts` |
| FX-06 | 01-19, 01-22, 01-23, 01-24 | Couper le son, réduire les animations, jouable sans son | SATISFIED | `settings.ts`, `reglages.spec.ts`, `partie-complete.spec.ts` |

Les 30 identifiants demandés par la phase sont tous déclarés dans les PLAN (frontmatter `requirements`) et tous présents dans REQUIREMENTS.md. Aucune exigence orpheline : RULE-19, PLAY-06, PLAY-07, NET-*, ACCT-*, BOT-*, HIST-*, APP-* sont assignées aux phases 2 à 5.

### Anti-modèles trouvés

| Fichier | Ligne | Motif | Gravité | Impact |
|---------|-------|-------|---------|--------|
| (aucun) | | `TBD`, `FIXME`, `XXX`, `TODO`, `HACK`, `PLACEHOLDER`, « not yet implemented » dans `apps/web/src`, `packages`, `tools` | | Aucun marqueur de dette |

Les « Known Stubs » des SUMMARY 01-01 à 01-18 (traceur, `COURT_FIGURES` vide, tapis non cliquable, Valet et 7 sans UI, pas d'animation de sortie/prise/Valet, rotation de 120 ms avant le 4) ont tous été vérifiés comme résolus par les plans suivants (01-19 à 01-24) : traceur supprimé, 12 figures présentes, `TapisSheet.svelte` existe, Valet et 7 jouables dans les tests Playwright, `MOTION.volteFace = 120`.

Constats d'ordre administratif, sans effet sur le but :

- `.planning/REQUIREMENTS.md` : FX-02 est encore `[ ]` et « Pending » alors que la phase la livre. À corriger au moment de clore la phase.
- `.planning/ROADMAP.md` : la case « Phase 1 » reste `[ ]` dans la liste des phases. L'orchestrateur la met à jour.
- 01-REVIEW.md (13 constats critiques et avertissements) : tous corrigés d'après 01-REVIEW-FIX.md, et les correctifs ont été relus dans le code (`apply.ts` refuse les actions mal formées, `eventsFor` existe, `onError` du contrôleur, `unlockOnFirstGesture`, verrou de défilement compté, `inert` derrière l'écran de fin) avec leurs tests. Les 17 constats « info » ne bloquent pas. 01-SECURITY.md : 34 menaces fermées, 0 ouverte.

### Vérification humaine requise

#### 1. Déblocage du son sur un vrai iPhone

**Test :** Sur iPhone (Safari, puis app ajoutée à l'écran d'accueil), ouvrir `#/partie`, toucher une carte, jouer un coup, mettre l'app en arrière-plan, revenir, retoucher.
**Attendu :** Sons dès le premier toucher, relance du son après le retour d'arrière-plan, « Réessayer » fonctionnel.
**Pourquoi un humain :** WebKit réel et ses règles d'activation utilisateur ne sont pas reproduits par Chromium.

#### 2. Écoute des sons

**Test :** Page `#/sons` puis une partie entière.
**Attendu :** Hennissements reconnaissables, cadence des sabots qui suit la vitesse, ambiance discrète ; Romain note chaque son.
**Pourquoi un humain :** Tous les sons sont synthétisés ; la qualité à l'oreille ne se teste pas.

#### 3. Lisibilité des cavaliers sur petit téléphone

**Test :** Voir la partie sur 320x480 et 375x667, puis sur 1280x800.
**Attendu :** Quatre couleurs distinguables (jaune sur chêne compris), lettres A–D lisibles.
**Pourquoi un humain :** Jugement visuel à environ 17 px de large.

#### 4. Plateau réduit sur téléphone de faible hauteur

**Test :** Jouer sur 320x480 et 360x640 en portrait.
**Attendu :** Plateau plus petit mais jouable au doigt, sans défilement.
**Pourquoi un humain :** Le test vérifie l'absence de défilement, pas le confort.

#### 5. Ressenti du rythme et des animations

**Test :** Une partie complète en vitesse normale avec As, Roi, 4, Valet et 7.
**Attendu :** Rythme naturel, animations plaisantes et lisibles.
**Pourquoi un humain :** Les durées sont mesurées, l'effet est subjectif.

### Résumé des écarts

Aucun écart. Toutes les vérités de la feuille de route sont prouvées par le code lu, par des tests unitaires et de propriété (626), par 300 parties de simulation et par des parcours Playwright joués dans un vrai navigateur. Le statut est `human_needed` uniquement à cause des cinq points de jugement humain ci-dessus, annoncés d'avance comme tels.

---

_Vérifié le : 2026-10-13_
_Vérificateur : Claude (gsd-verifier)_
