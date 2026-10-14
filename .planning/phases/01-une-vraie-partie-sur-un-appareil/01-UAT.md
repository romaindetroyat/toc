---
status: partial
phase: 01-une-vraie-partie-sur-un-appareil
source: [01-VERIFICATION.md, 01-UI-REVIEW.md]
started: 2026-10-13T23:30:00Z
updated: 2026-10-14T08:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Son sur un vrai iPhone (Safari, puis l'app ajoutée à l'écran d'accueil)
expected: Les sabots, hennissements et sons de cartes se font entendre dès le premier toucher. Après un retour d'arrière-plan, le prochain toucher relance le son. « Réessayer » fonctionne si le son ne démarre pas.
result: issue
reported: "les sons seront à traiter plus tard, mais ce n'est pas bon"
severity: major

### 2. Les sons à l'oreille (#/sons puis une partie entière)
expected: Hennissements reconnaissables et agréables, cadence des sabots qui suit la vitesse, ambiance discrète. Chaque son noté « À écouter · Bon · À changer ».
result: issue
reported: "les sons seront à traiter plus tard, mais ce n'est pas bon"
severity: major

### 3. Lisibilité des cavaliers (petit téléphone et 1280x800)
expected: Les seize cavaliers restent lisibles et distinguables en quatre couleurs (jaune sur le chêne compris), on reconnaît leur direction et la lettre A–D des cavaliers allumés.
result: pass
note: "Les chevaux sont OK, la visibilité pourrait être meilleure, mais peut-être juste une question de taille."

### 4. Plateau réduit sur téléphone de faible hauteur (320x480, 360x640)
expected: Pas de défilement de la page, plateau assez grand pour viser un cheval au doigt. (La revue visuelle juge 320x480 trop petit : environ 155 px de plateau.)
result: issue
reported: "La visibilité en version iphone n'est pas très bonne. On va changer le plateau de jeu pour avoir son propre camp centré en bas, le camp du partenaire centré en haut, les rappels de règles (petits cadres entre les camps) sont inutiles car impossibles à voir. Je vais te proposer une version de plateau mieux."
severity: major

### 5. Rythme et animations d'une partie en vitesse normale (As, Roi, 4, Valet, 7)
expected: Rythme naturel ; ruade et éjection en arc, bonds croisés du Valet, fête du 4e cheval plaisants et lisibles.
result: issue
reported: "La jouabilité : OK en version iphone, un peu trop d'aller-retours de souris sur ordinateur. Des raccourcis claviers seraient les bienvenus"
severity: minor

### 6. Entrée dans la maison sans tour complet (retour de Romain en cours de test)
expected: Un cheval qui n'a pas fait le tour complet mais qui se retrouve en position d'entrer (après un recul avec le 4, ou par le Valet) peut rentrer dans sa maison au compte exact, si la case est libre ; l'entrée reste obligatoire quand le compte tombe juste.
result: issue
reported: "quand un pion arrive à proximité de son camp, il faut qu'il puisse rentrer. S'il est sur le 16 et qu'il pose un 3, il doit pouvoir rentrer (si la place est libre)." Puis : "si le cheval n'a pas fait le tour complet et qu'il arrive en situation de pouvoir rentrer (par 4 ou par valet) doit pouvoir rentrer. Corrige pour respecter cette règle" ; entrée obligatoire quand le compte tombe juste.
severity: major

### 7. Le 7 et le partenaire (retour de Romain en cours de test)
expected: Le 7 dépasse les chevaux du partenaire sans les manger ; il ne mange le partenaire que s'il s'arrête sur lui.
result: issue
reported: "Le 7 ne doit pas manger les partenaires quand il les double, mais seulement s'il arrive sur eux (pas le choix)."
severity: major

## Summary

total: 7
passed: 1
issues: 6
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Les sons (sabots, hennissements, cartes, ambiance) sont agréables et crédibles"
  status: failed
  reason: "User reported: les sons seront à traiter plus tard, mais ce n'est pas bon"
  severity: major
  test: 2
  root_cause: "Tous les sons sont synthétisés par le code (aucun enregistrement CC0 retenu) ; qualité jugée insuffisante à l'oreille"
  artifacts: [apps/web/src/audio/synth.ts, apps/web/src/audio/sounds.ts]
  missing: ["Reporté par Romain à plus tard : à traiter dans une phase ultérieure (échantillons CC0 ou nouvelle synthèse)"]
  debug_session: ""
  deferred: true
- truth: "Sur iPhone, le plateau est bien lisible : son propre camp centré en bas, celui du partenaire centré en haut, sans les petits cadres de rappel des règles"
  status: failed
  reason: "User reported: La visibilité en version iphone n'est pas très bonne. On va changer le plateau de jeu pour avoir son propre camp centré en bas, le camp du partenaire centré en haut, les rappels de règles (petits cadres entre les camps) sont inutiles car impossibles à voir. Je vais te proposer une version de plateau mieux."
  severity: major
  test: 4
  root_cause: "Le plateau actuel (4 quarts dessinés pour le jeu physique) place les camps aux coins et porte des cadres de règles illisibles à petite taille"
  artifacts: [assets/plateau, packages/board/src/layout.json, tools/build-board.mjs, tools/calibrate-board]
  missing: ["Remplacer le plateau image par le plateau C+ choisi par Romain le 2026-10-14 (maquette : design/plateau-maquette.dc.html, variante portrait avec idees01 ; artefact https://claude.ai/artifact/5Z4nttzgv3VvxfbifroU1A) : plateau portrait 2:3 dessiné par le code, 72 cases bord à bord, son camp centré en bas et le partenaire en haut, écuries à l'intérieur, sortie marquée 18, pointillé écurie → sortie, rail de couleur du carré 16 vers la maison, flèches du sens, tapis central ; cavaliers à l'échelle des nouvelles cases (test 3)"]
  debug_session: ""
  decision: "Romain, 2026-10-14 : « On part sur le plateau C+ pour le moment » ; puis, après l'avoir vu dans le jeu : « Bon, ben ça ne marche pas ce plateau, c'est trop laid. […] Il faut une version iphone et une version ordinateur, mais avec des graphismes adaptés. Là, on ne voit rien sur ordi » ; choix : ordinateur = plateau en largeur, iPhone = nouvelles maquettes ; reproches à C+ : « trop plat, sans charme » et « la forme » ; nouvelles maquettes en bois (design/plateau-galet.dc.html) : « J'aime bien le galet » (après correction des transparences du tapis), confirmé « galet partout » (ordinateur en largeur, iPhone en hauteur)"
- truth: "Sur ordinateur, on joue sans multiplier les allers-retours de souris : des raccourcis clavier choisissent la carte, le cheval et valident"
  status: failed
  reason: "User reported: un peu trop d'aller-retours de souris sur ordinateur. Des raccourcis claviers seraient les bienvenus"
  severity: minor
  test: 5
  root_cause: "Le jeu au clavier existe (Tab, flèches, Entrée, Échap) mais il n'y a aucun raccourci direct pour les cartes, les cavaliers, Jouer, Je passe"
  artifacts: [apps/web/src/routes/Game.svelte, apps/web/src/game/turnUi.ts, apps/web/src/ui/HandFan.svelte, apps/web/src/board/HitLayer.svelte, apps/web/src/ui/ActionZone.svelte]
  missing: ["Raccourcis : chiffres 1 à 5 pour les cartes de la main, lettres A à D pour les cavaliers allumés, Entrée pour jouer, Échap pour annuler, P pour « Je passe », ? pour l'aide ; une aide visible des raccourcis sur ordinateur"]
  debug_session: ""
- truth: "Un cheval qui n'a pas fait le tour complet mais se retrouve en position d'entrer (recul avec le 4, ou Valet) entre dans sa maison au compte exact si la case est libre, et l'entrée est obligatoire quand le compte tombe juste"
  status: failed
  reason: "User reported: si le cheval n'a pas fait le tour complet et qu'il arrive en situation de pouvoir rentrer (par 4 ou par valet) doit pouvoir rentrer. Corrige pour respecter cette règle"
  severity: major
  test: 6
  root_cause: "packages/engine/src/path.ts:224 n'accepte l'entrée que pour une progression q >= 70 (tour complet, D-04/Q3) ; un cheval à progression négative (recul depuis sa sortie) passe devant le carré 16 sans entrer (scénario R-13.12, RULES.md R-02 et R-13)"
  artifacts: [packages/engine/src/path.ts, packages/engine/scenarios/prises-maison.ts, RULES.md, packages/engine/src/rules.ts, .planning/REQUIREMENTS.md]
  missing: ["Lever l'obligation du tour complet : toute arrivée sur le carré 16 en avançant (progression ≡ 70 mod 72, y compris −2) ouvre l'entrée au compte exact ; on n'entre toujours jamais en reculant ; mettre à jour RULES.md (R-02, R-08, R-09, R-13, D-04), le scénario R-13.12 et en ajouter un pour le recul avec le 4 puis l'entrée"]
  debug_session: ""
- truth: "Le 7 dépasse les chevaux du partenaire sans les manger et ne les mange que s'il s'arrête sur eux"
  status: failed
  reason: "User reported: Le 7 ne doit pas manger les partenaires quand il les double, mais seulement s'il arrive sur eux (pas le choix)."
  severity: major
  test: 7
  root_cause: "packages/engine/src/path.ts:163 mange tout cheval dépassé qui n'est pas « à soi » (capturePassed && !own) : le partenaire est mangé au passage (Q23, RULES.md R-10, scénario R-10.6)"
  artifacts: [packages/engine/src/path.ts, packages/engine/src/seven.ts, packages/engine/scenarios, RULES.md, .planning/REQUIREMENTS.md]
  missing: ["Le 7 ne mange au passage que les adversaires ; le partenaire dépassé reste en place ; s'arrêter sur lui le mange toujours ; mettre à jour RULES.md R-10 (Q23) et le scénario R-10.6, et l'aperçu/animation (cues) en conséquence"]
  debug_session: ""
