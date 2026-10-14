---
status: partial
phase: 01-une-vraie-partie-sur-un-appareil
source: [01-VERIFICATION.md, 01-UI-REVIEW.md]
started: 2026-10-13T23:30:00Z
updated: 2026-10-14T22:45:00Z
---

## Current Test

number: 8
name: "Re-test 3 : lisibilité des cavaliers sur le galet en largeur (iPhone tenu en largeur et 1280 × 800)"
expected: |
  Sur l'iPhone tenu en largeur et sur l'ordinateur en 1280 × 800, les seize cavaliers se lisent bien et se distinguent dans leurs quatre couleurs (le jaune compris), on voit dans quel sens ils regardent et la lettre A à D des cavaliers allumés. Leur taille paraît juste : 0,95 case sur l'anneau, 0,82 dans une maison, 0,78 dans une écurie. Ils sont faciles à toucher.
awaiting: user response

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

### 8. Re-test 3 : lisibilité des cavaliers sur le galet en largeur (iPhone tenu en largeur et 1280 × 800)
expected: Sur l'iPhone tenu en largeur et sur l'ordinateur en 1280 × 800, les seize cavaliers se lisent bien et se distinguent dans leurs quatre couleurs (le jaune compris), on voit dans quel sens ils regardent et la lettre A à D des cavaliers allumés. Leur taille paraît juste : 0,95 case sur l'anneau, 0,82 dans une maison, 0,78 dans une écurie. Ils sont faciles à toucher. Quand deux cavaliers allumés sont à moins de 44 px l'un de l'autre (sur l'iPhone, jusqu'à deux cases d'écart), un toucher ouvre le choix « Lequel ? » au lieu de prendre directement le cheval : Romain dit si cela lui convient.
result: [pending]

### 9. Re-test 4 : le plateau galet sur l'iPhone tenu en largeur (Safari et app installée), « Tourne ton téléphone » en portrait, et sur ordinateur
expected: (1) Sur l'iPhone tenu en largeur, dans Safari puis dans l'app ajoutée à l'écran d'accueil : son camp centré en bas, celui de son partenaire centré en haut, aucun petit cadre de rappel des règles, les cases, les numéros, les losanges 18, les carrés 16 et ses cavaliers dessinés dans les coins se lisent bien ; le bois et le tapis ressemblent à la planche « Ordinateur · galet » ; la barre compacte (les infos à gauche du plateau, la main, la consigne et les boutons dessous) se manie bien avec les pouces. (2) Téléphone tourné à la verticale en pleine partie : « Tourne ton téléphone » remplace le plateau ; en le remettant en largeur, on retrouve la même partie, les joueurs de l'ordinateur ayant attendu. Une fenêtre d'ordinateur plus haute que large montre « Élargis la fenêtre ». (3) Sur l'ordinateur : le galet prend la largeur avec la barre du bas, il se lit bien, et l'on joue à l'aise à la souris comme au clavier (lettres sur les cavaliers allumés, aides des touches) ; agrandir ou réduire la fenêtre garde la partie. (4) Taille du plateau sur son propre iPhone, calculée et à vérifier : environ 585 px de large dans l'app installée (cases à environ 20 px l'une de l'autre) ; dans Safari environ 533 px (cases à environ 18 px), ou environ 493 px (cases à environ 16,5 px) si Safari compte aussi la marge du bas. Romain dit ce qu'il voit.
result: [pending]

### 10. À confirmer : le tapis, sa texture et sa forme
expected: « La texture de bruit du tapis est coupée au tapis seul » (c'est ainsi qu'a été lue la « correction des transparences du tapis » de la maquette), et « le tapis est l'ellipse verte de la planche « Ordinateur · galet » ». Romain confirme ou demande un changement.
result: [pending]

### 11. À confirmer : les places par couleur
expected: « En bas le joueur humain, à gauche le joueur suivant dans le sens horaire, en haut son partenaire, à droite le précédent. Aucune rotation : le dessin ne tourne jamais, ce sont les couleurs qui prennent leur côté. » Romain confirme ou demande un changement.
result: [pending]

### 12. À confirmer : la taille des cavaliers du galet
expected: « 0,95 pas sur l'anneau, 0,82 dans une maison, 0,78 dans une écurie. Les pieds sont 0,28 w sous le centre de la case » (w = la largeur du cavalier ; un pas = l'écart entre deux cases). Romain confirme ou demande un changement.
result: [pending]

### 13. À confirmer : les cartes du tapis et les piles
expected: « Chaque carte est tournée vers sa place (0, 90, 180 ou 270°, plus l'inclinaison fixe de ±4°). Le talon et la défausse sont de part et d'autre du centre, à l'échelle 0,95. Les cartes font 1,3 × 1,82 pas. Tout le tapis est le bouton « Sur le tapis », dans la forme du tapis. » Romain confirme ou demande un changement.
result: [pending]

### 14. À confirmer : l'écran plus haut que large, « Tourne ton téléphone » et « Élargis la fenêtre », la partie gardée
expected: « En portrait, le téléphone montre une invitation à le tourner, « Tourne ton téléphone », à la place du plateau. Le passage se fait en direct, sans recharger : les mouvements en cours sautent à leur fin, la partie est gardée telle quelle et reprend dès que l'écran est de nouveau en largeur. » Une fenêtre d'ordinateur plus haute que large montre « Élargis la fenêtre ». Sous le titre : « La partie t'attend. Elle reprend dès que l'écran est en largeur. » Le dessin de l'invitation : un téléphone debout en pointillé, le même couché, et une flèche d'un quart de tour. Romain confirme ou demande un changement (textes et dessin compris).
result: [pending]

### 15. À confirmer : les modes d'écran et leurs seuils
expected: « Le plateau est en largeur partout. « barre » : en largeur à partir de 960 × 600. « barre compacte » : les autres écrans en largeur (téléphone tenu en largeur, petite fenêtre). « tourner » : tout écran plus haut que large. » Romain confirme ou demande un changement.
result: [pending]

### 16. À confirmer : la barre du bas sur ordinateur
expected: « Le plateau prend la largeur. Dessous, une barre de 160 px » : à gauche les infos (environ 240 px : la ligne du tour, la ligne du donneur, les pastilles d'équipe et la roue des réglages), au milieu la main en cartes normales de 88 × 124, à droite la zone d'action (au moins 320 px) ; l'assistant du 7 prend la place de la main et de la zone d'action. Le plateau fait environ 1227 px de large en 1280 × 800, et non 1280 comme sur la planche « Sur les écrans », pour garder la place des têtes des cavaliers du haut et de la barre. Romain confirme ou demande un changement.
result: [pending]

### 17. À confirmer : la barre compacte du téléphone tenu en largeur
expected: Les infos dans une colonne de 96 px à gauche du plateau (la roue des réglages, la ligne du tour, la ligne du donneur et les deux pastilles d'équipe, les unes sous les autres ; « Tour de » masqué à l'écran). À partir de 640 px de large, « une seule rangée de 64 px sous le plateau » : la main à gauche (240 px), la consigne au milieu (trois lignes au plus, un texte plus long défile), les boutons à droite. Sous 640 px de large, deux rangées : 56 px (la consigne et les boutons) puis 64 px (la main). L'assistant du 7 et le choix « Lequel ? » tiennent dans la barre sans jamais la rendre plus haute. Romain confirme ou demande un changement.
result: [pending]

### 18. À confirmer : ce que la barre compacte garde du dock
expected: Les cartes compactes de 64 × 90 en une rangée plate, la carte choisie montée de 8 px ; au moins les 56 px du haut de chaque carte visibles (indices et symbole), le bas coupé au bord de la barre ; avec cinq cartes, des tranches d'au moins 44 px ; des boutons d'au moins 44 px de haut, un seul bouton principal au plus, « Avance rapide » avec son icône et son libellé ; sans changement : les textes, l'ordre du focus, les raccourcis clavier, les cibles de 44 px et la règle du choix « Lequel ? ». Romain confirme ou demande un changement.
result: [pending]

### 19. À confirmer : les objectifs de taille et les appareils réels
expected: Largeur du plateau mesurée dans l'émulation (marges d'écran à 0) : 844 × 390 → 625 px (cases à 20,9 px) ; 750 × 342 → 533 px (17,8 px) ; 667 × 375 → 559 px (18,7 px) ; 568 × 320 → 383 px (12,8 px) ; 480 × 320 → 372 px (12,4 px) ; 1024 × 640 → 920 px (30,8 px) ; 1280 × 800 → 1227 px (41 px) ; 1440 × 900 → 1408 px (47,1 px) ; en portrait, pas de plateau mais l'invitation à tourner l'écran. Sur un vrai iPhone 13 tenu en largeur (calculé, pas mesuré) : environ 585 px dans l'app installée (cases à environ 19,6 px), environ 533 px dans Safari (17,8 px), ou environ 493 px (16,5 px) si Safari compte la marge du bas. Romain dit si ces tailles lui conviennent et ce qu'il mesure sur son iPhone (voir test 9).
result: [pending]

### 20. À confirmer : les images des règles sur le galet en largeur, « avant » au-dessus d'« après »
expected: « Les 112 images de RULES.md montrent le plateau du jeu, le galet en largeur, cavaliers compris. « avant » est au-dessus de « après » : deux plateaux 2:1 empilés font une image carrée de 1200 × 1200 », la place dont c'est le tour en bas ; les numéros des cases sont écrits en Caveat, comme dans le jeu. Romain regarde deux ou trois images de RULES.md et confirme ou demande un changement.
result: [pending]

### 21. À confirmer : les ombres sans flou
expected: « Les ombres CSS de la maquette sont dessinées comme des copies décalées, sans filtre de flou ». Romain confirme ou demande un changement.
result: [pending]

### 22. À confirmer (conséquence de mise en œuvre) : pendant l'invitation à tourner l'écran, les joueurs de l'ordinateur attendent, et la partie reprend quand l'écran est de nouveau en largeur
expected: Choix fait lors de la réalisation (plan 01-38), pas une demande de Romain : tant que « Tourne ton téléphone » (ou « Élargis la fenêtre ») est affiché, les joueurs de l'ordinateur ne jouent pas ; quand l'écran repasse en largeur, la partie reprend là où elle était. Romain dit s'il veut garder ce comportement ou si les joueurs de l'ordinateur doivent continuer à jouer pendant ce temps.
result: [pending]

## Summary

total: 22
passed: 1
issues: 6
pending: 15
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
  decision: "Romain, 2026-10-14 : « On part sur le plateau C+ pour le moment » ; puis, après l'avoir vu dans le jeu : « Bon, ben ça ne marche pas ce plateau, c'est trop laid. […] Il faut une version iphone et une version ordinateur, mais avec des graphismes adaptés. Là, on ne voit rien sur ordi » ; choix : ordinateur = plateau en largeur, iPhone = nouvelles maquettes ; reproches à C+ : « trop plat, sans charme » et « la forme » ; nouvelles maquettes en bois (design/plateau-galet.dc.html) : « J'aime bien le galet » (après correction des transparences du tapis), confirmé « galet partout » (ordinateur en largeur, iPhone en hauteur) ; puis : « Pour la version iphone, oblige à jouer en format paysage, ça permettra d'utiliser le même plateau » → « Oui, paysage obligatoire » (un seul plateau, le galet en largeur ; en portrait, le téléphone invite à le tourner)"
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
