---
status: partial
phase: 01-une-vraie-partie-sur-un-appareil
source: [01-VERIFICATION.md, 01-UI-REVIEW.md]
started: 2026-10-13T23:30:00Z
updated: 2026-10-15T12:00:00Z
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
note: "Recette 3 du 2026-10-15 : Romain a trouvé le plateau « trop petit sur iphone » (test 24) et a choisi « Plateau sur toute la hauteur ». Le point (4) sera refait sur la nouvelle disposition (plans 01-47 et 01-48) ; le reste du test attend sa réponse."

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
note: "Recette 3 du 2026-10-15 : « Le plateau de jeu est trop petit sur iphone » (test 24). Les tailles du téléphone tenu en largeur changent avec « Plateau sur toute la hauteur » (plans 01-47 et 01-48) ; le plan 01-54 réécrit l'attendu de ce test avec les nouvelles tailles, et Romain les confirme alors."

### 20. À confirmer : les images des règles sur le galet en largeur, « avant » au-dessus d'« après »
expected: « Les 112 images de RULES.md montrent le plateau du jeu, le galet en largeur, cavaliers compris. « avant » est au-dessus de « après » : deux plateaux 2:1 empilés font une image carrée de 1200 × 1200 », la place dont c'est le tour en bas ; les numéros des cases sont écrits en Caveat, comme dans le jeu. Romain regarde deux ou trois images de RULES.md et confirme ou demande un changement.
result: [pending]

### 21. À confirmer : les ombres sans flou
expected: « Les ombres CSS de la maquette sont dessinées comme des copies décalées, sans filtre de flou ». Romain confirme ou demande un changement.
result: [pending]

### 22. À confirmer (conséquence de mise en œuvre) : pendant l'invitation à tourner l'écran, les joueurs de l'ordinateur attendent, et la partie reprend quand l'écran est de nouveau en largeur
expected: Choix fait lors de la réalisation (plan 01-38), pas une demande de Romain : tant que « Tourne ton téléphone » (ou « Élargis la fenêtre ») est affiché, les joueurs de l'ordinateur ne jouent pas ; quand l'écran repasse en largeur, la partie reprend là où elle était. Romain dit s'il veut garder ce comportement ou si les joueurs de l'ordinateur doivent continuer à jouer pendant ce temps.
result: [pending]

### 23. Recette 3 (2026-10-15) : le son sur l'iPhone en mode silencieux
expected: Sur l'iPhone, interrupteur de sonnerie sur silencieux (pas seulement le volume au minimum), les sabots, les hennissements et les sons de cartes se font entendre dans Safari comme dans l'app ajoutée à l'écran d'accueil.
result: issue
reported: "Les sons ne fonctionnent pas sur iphone en mode silencieux (pas volume au minimum, mais silencieux, pas de sonnerie)"
severity: major

### 24. Recette 3 (2026-10-15) : la taille du plateau sur l'iPhone tenu en largeur
expected: Sur l'iPhone tenu en largeur, le plateau est assez grand pour bien voir les cases et toucher les cavaliers.
result: issue
reported: "Le plateau de jeu est trop petit sur iphone"
severity: major
note: "Question posée ensuite, choix de Romain : « Plateau sur toute la hauteur (Recommandé) »."

### 25. Recette 3 (2026-10-15) : le sens des cavaliers dessinés sur le plateau
expected: Les cavaliers à l'encre dessinés dans les coins du galet sont tournés vers leur camp.
result: issue
reported: "Les chevaux gravés sur le plateau sont tous orientés de la même façon mais je voudrais les tourner pour que les sabots soient dirigés vers chaque camp"
severity: minor

### 26. Recette 3 (2026-10-15) : l'entrée dans la maison
expected: Un cheval qui peut atteindre une case vide de sa maison y entre.
result: issue
reported: "J'ai l'impression que l'entrée dans la zone d'arrivée ne fonctionne pas toujours : si l'on peut atteindre une case vide de la zone d'arrivée, il faut que ce soit le seul coup à jouer"
severity: major
note: "Question posée ensuite, « que doit-on interdire ? », choix de Romain : « Seulement pour ce cheval ». Puis, pour un 9 joué sur un cheval qu'un 2 ferait rentrer : « Oui, autorisé » (« Seulement la carte qui le fait rentrer pile est obligée de le faire rentrer. Avec le 9, il peut continuer son tour. ») ; et sur le compte qui dépasse ou la case occupée : « Oui, on garde »."

### 27. Recette 3 (2026-10-15) : un seul cheval pour la carte choisie
expected: Quand un seul cheval peut jouer la carte, le joueur n'a pas à le toucher.
result: issue
reported: "Quand il ne reste qu'un cheval sur le plateau, inutile de cliquer dessus pour jouer la carte, sauf valet évidemment"
severity: minor

### 28. Recette 3 (2026-10-15) : le rythme de la donne
expected: La distribution des cartes se suit à l'œil.
result: issue
reported: "La distribution de cartes est un tout petit peu trop rapide"
severity: cosmetic

### 29. Recette 3 (2026-10-15) : la qualité des sons
expected: Les sons (sabots, hennissements, cartes, prise, fin de partie) sont agréables et crédibles.
result: issue
reported: "les sons ne sont pas bons, il faut les retravailler"
severity: major
note: "Question posée ensuite, choix de Romain : « Page d'essai à choix (Recommandé) »."

### 30. Recette 3 (2026-10-15) : le panneau de fin de partie
expected: Le panneau « Victoire ! » / « Défaite » est beau et dans le style du plateau.
result: issue
reported: "Le panneau de victoire défaite est moche"
severity: minor

## Summary

total: 30
passed: 1
issues: 14
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
  deferred: false
  reopened: "Romain, recette 3 du 2026-10-15 : « les sons ne sont pas bons, il faut les retravailler » et « Les sons ne fonctionnent pas sur iphone en mode silencieux » ; les sons ne sont plus reportés et sont repris dans cette phase (gaps G-01-23 et G-01-29, plans 01-49 et 01-51 à 01-53)"
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
- gap_id: G-01-23
  truth: "Sur l'iPhone en mode silencieux (interrupteur de sonnerie), les bruitages du jeu se font entendre, dans Safari comme dans l'app installée"
  status: failed
  reason: "User reported: Les sons ne fonctionnent pas sur iphone en mode silencieux (pas volume au minimum, mais silencieux, pas de sonnerie)"
  severity: major
  test: 23
  root_cause: "apps/web/src/audio/engine.ts, unlock() : navigator.audioSession.type = 'playback' n'est posé qu'après la création de l'AudioContext (new WebAudioBackend()), et c'est la seule mesure. Sur l'iPhone de Romain, l'interrupteur de sonnerie coupe toujours le Web Audio : soit le type arrive trop tard, soit son Safari l'ignore pour le Web Audio. Aucun élément audio HTML ne fait passer la session audio de la page en lecture. Les textes d'aide (reglages.ts, sons.ts) disent encore de quitter le mode silencieux."
  artifacts: [apps/web/src/audio/engine.ts, apps/web/src/i18n/fr/reglages.ts, apps/web/src/i18n/fr/sons.ts, apps/web/e2e/audio.spec.ts]
  missing: ["Poser audioSession.type = 'playback' avant de créer l'AudioContext, dans le premier geste", "Sur iPhone et iPad, lancer dans le même geste un élément audio muet en boucle (WAV de silence généré par le code, en data URI), mis en pause quand la page est cachée ou quand « Son » est coupé, relancé au geste suivant", "Textes d'aide mis à jour", "Recette sur le vrai iPhone de Romain, interrupteur sur silencieux"]
  debug_session: ""
  decision: "Romain, 2026-10-15, sur la musique d'une autre app interrompue tant que le jeu est à l'écran : « Oui, ça me va » (aucun réglage)"
- gap_id: G-01-24
  truth: "Sur l'iPhone tenu en largeur, le plateau prend toute la hauteur de l'écran ; la main et les boutons sont sur les côtés du galet, les infos dans une petite pastille"
  status: failed
  reason: "User reported: Le plateau de jeu est trop petit sur iphone"
  severity: major
  test: 24
  root_cause: "Mode « barre compacte » (apps/web/src/routes/Game.svelte, ui/screen.svelte.ts) : la rangée de 64 px (ou 120 px) sous le plateau et la colonne d'infos de 96 px limitent sa largeur à min(100vw − 108 px − insets, (100dvh − 64 px − insets) / 0,5217) : ≈ 493 à 533 px dans Safari sur l'iPhone 13 tenu en largeur (cases à ≈ 16,5 à 17,8 px), ≈ 585 px dans l'app installée."
  artifacts: [apps/web/src/routes/Game.svelte, apps/web/src/ui/screen.svelte.ts, apps/web/src/ui/InfoBar.svelte, apps/web/src/ui/HandFan.svelte, apps/web/src/ui/ActionZone.svelte, apps/web/src/ui/SevenPanel.svelte, apps/web/src/ui/PawnTray.svelte, apps/web/src/cards/fan.ts, apps/web/e2e/compact.spec.ts]
  missing: ["Choix de Romain : « Plateau sur toute la hauteur (Recommandé) » : le plateau sous une ligne de consigne de 24 px, sur toute la hauteur ; une bande de 60 px de chaque côté du galet, la pastille d'infos et la main en colonne à gauche, la roue, « Avance rapide » et les boutons à droite ; l'assistant du 7 et le choix « Lequel ? » dans ces bandes ; l'ordinateur inchangé", "Nouvelles tailles visées et mesurées (844 × 390 ≈ 724 px, 750 × 342 ≈ 630 px), recette sur l'iPhone de Romain"]
  debug_session: ""
  decision: "Romain, 2026-10-15 : « Plateau sur toute la hauteur (Recommandé) »"
- gap_id: G-01-25
  truth: "Les quatre cavaliers à l'encre du galet ont les sabots tournés vers le camp de leur couleur"
  status: failed
  reason: "User reported: Les chevaux gravés sur le plateau sont tous orientés de la même façon mais je voudrais les tourner pour que les sabots soient dirigés vers chaque camp"
  severity: minor
  test: 25
  root_cause: "packages/board/src/scene.ts riderBox() ne donne qu'une boîte droite ; art.ts pose l'image sans transform ; apps/web/src/board/BoardArt.svelte n'applique aucun transform à l'image. Les quatre cavaliers ont donc tous les sabots vers le bas de l'écran, quel que soit le côté de leur couleur."
  artifacts: [packages/board/src/scene.ts, packages/board/src/art.ts, packages/board/src/scene.test.ts, packages/board/src/art.test.ts, apps/web/src/board/BoardArt.svelte, docs/regles]
  missing: ["Chaque cavalier tourné d'un quart de tour selon le côté de sa couleur (0° en bas, 90° à gauche, 180° en haut, 270° à droite), toujours hors des cases, des écuries, des maisons et du tapis ; images des règles redessinées (rendu déterministe)"]
  debug_session: ""
  decision: "Romain, 2026-10-15 : « Quart de tour (Recommandé) »"
- gap_id: G-01-26
  truth: "La carte qui peut faire entrer un cheval pile sur une case vide de sa maison ne le joue que pour le faire entrer (avec le 7 : il entre ou ne bouge pas) ; les autres cartes restent libres sur ce cheval, et les autres chevaux aussi"
  status: failed
  reason: "User reported: J'ai l'impression que l'entrée dans la zone d'arrivée ne fonctionne pas toujours : si l'on peut atteindre une case vide de la zone d'arrivée, il faut que ce soit le seul coup à jouer"
  severity: major
  test: 26
  root_cause: "Pas d'erreur du moteur. Diagnostic du planificateur sur 300 parties entre ordinateurs de niveau 1 (graine 7) : 4123 entrées, et 8685 fois un cheval passe devant son carré 16 sans entrer. Chaque fois que le compte de la carte jouée tombait sur une case vide sans cheval rentré à sauter, le cheval est entré (0 exception). Les passages viennent du compte qui dépasse la maison (6104, 70 %), de la case visée occupée (2402, 28 %) ou d'un cheval rentré sur le chemin (179, 2 %, G2). Mais 1415 de ces chevaux auraient pu rentrer avec une autre carte de la même main, et 285 fois un 7 a été partagé de façon à faire dépasser sa maison à un cheval qu'un autre partage faisait entrer. La règle actuelle (D-01, D-02, G14, packages/engine/src/path.ts walk()) ne rend l'entrée obligatoire que pour le compte de la carte jouée."
  artifacts: [packages/engine/src/path.ts, packages/engine/src/legal.ts, packages/engine/src/seven.ts, packages/engine/src/apply.ts, packages/engine/src/rules.ts, packages/engine/src/types.ts, packages/engine/scenarios/prises-maison.ts, RULES.md, .planning/REQUIREMENTS.md]
  missing: ["Règle G16 jugée carte par carte (constante KNIGHT_MUST_ENTER, réglable comme G14 et G15) : la carte qui peut faire entrer un cheval pile sur une case vide ne le joue que pour entrer. Pour une carte ordinaire, c'est déjà D-02 ; le 4 et le Valet ne sont pas concernés ; avec le 7, si un partage peut faire entrer ce cheval, le 7 le fait entrer ou ne le bouge pas (à confirmer : il ne s'arrête pas avant sa maison) ; la règle ne rend jamais le 7 injouable ; les autres cartes restent libres sur ce cheval", "RULES.md (R-13, Décisions de Romain G16), scénarios R-13.22 à R-13.27 et leurs images, REQUIREMENTS.md RULE-15 ; rules-trace reste vert"]
  debug_session: ""
  decision: "Romain, 2026-10-15, à la question « que doit-on interdire ? » : « Seulement pour ce cheval » ; puis, à « ton cheval est juste devant son arrivée et tu as en main un 2 (qui le fait rentrer) et un 9. Peux-tu jouer le 9 sur ce cheval pour lui faire refaire un tour ? » : « Oui, autorisé » (« Seulement la carte qui le fait rentrer pile est obligée de le faire rentrer. Avec le 9, il peut continuer son tour. ») ; sur le compte qui dépasse et la case occupée : « Oui, on garde »"
- gap_id: G-01-27
  truth: "Quand un seul cheval peut jouer la carte choisie, il est choisi tout seul et l'aperçu s'affiche avec « Jouer » (sauf le Valet, et la question « Sortir » ou « Avancer » de l'As et du Roi)"
  status: failed
  reason: "User reported: Quand il ne reste qu'un cheval sur le plateau, inutile de cliquer dessus pour jouer la carte, sauf valet évidemment"
  severity: minor
  test: 27
  root_cause: "apps/web/src/game/turnUi.ts selectCard() rend l'état cardSelected même avec un seul candidat, et ActionZone.svelte affiche « Un seul cheval peut jouer cette carte : touche-le. » ; chooseMode('advance') fait de même après « Avancer »."
  artifacts: [apps/web/src/game/turnUi.ts, apps/web/src/game/turnUi.test.ts, apps/web/src/ui/ActionZone.svelte, apps/web/src/i18n/fr/game.ts, apps/web/e2e/tracer.spec.ts, apps/web/e2e/cartes-speciales.spec.ts, apps/web/e2e/clavier.spec.ts]
  missing: ["Un seul candidat : aperçu direct avec « Jouer » (D-19 tient : rien n'est joué sans « Jouer ») ; le 7 à un seul partage est rempli tout seul ; le Valet demande toujours ; Échap depuis un aperçu automatique repose la carte ; le clavier : chiffre puis Entrée"]
  debug_session: ""
- gap_id: G-01-28
  truth: "La donne se suit à l'œil : chaque carte vole un peu plus lentement"
  status: failed
  reason: "User reported: La distribution de cartes est un tout petit peu trop rapide"
  severity: cosmetic
  test: 28
  root_cause: "packages/board/src/motion.ts MOTION.dealCard = 250 ms et MOTION.dealStagger = 40 ms : 20 cartes en ≈ 1,01 s."
  artifacts: [packages/board/src/motion.ts, packages/board/src/motion.test.ts, apps/web/src/board/cardFx.test.ts, apps/web/e2e/animations.spec.ts]
  missing: ["dealCard 300 ms, dealStagger 55 ms (≈ 1,35 s pour 20 cartes) ; avance rapide × 0,4 ; tests et 01-UI-SPEC.md mis à jour"]
  debug_session: ""
- gap_id: G-01-29
  truth: "Romain choisit, son par son, la version qu'il préfère parmi trois ou quatre sur la page des sons, et le jeu joue sa version ; chaque version est générée par le code ou CC0 (ou domaine public), licence tracée"
  status: failed
  reason: "User reported: les sons ne sont pas bons, il faut les retravailler"
  severity: major
  test: 29
  root_cause: "Tous les sons sont synthétisés par le code (apps/web/src/audio/synth.ts), une seule version chacun ; la page #/sons (routes/SoundTest.svelte) permet de les noter mais pas d'en choisir un autre ; aucun enregistrement CC0 n'a été retenu ; il n'y a pas de son de fin de partie."
  artifacts: [apps/web/src/audio/sounds.ts, apps/web/src/audio/synth.ts, apps/web/src/audio/engine.ts, apps/web/src/audio/soundNotes.ts, apps/web/src/routes/SoundTest.svelte, apps/web/src/i18n/fr/sons.ts, assets/audio/LICENSES.md, apps/web/e2e/sons.spec.ts]
  missing: ["Choix de Romain : « Page d'essai à choix (Recommandé) » : trois ou quatre versions par son (A = le son actuel, les autres générées par le code ou CC0/domaine public vérifié fichier par fichier) ; un choix par son, valable tout de suite sur l'appareil, « Copier mes choix » pour en faire le choix de tous ; le jeu garde les sons actuels tant que rien n'est choisi", "Nouveaux sons « Victoire » et « Défaite » à la fin de la partie"]
  debug_session: ""
  decision: "Romain, 2026-10-15 : « Page d'essai à choix (Recommandé) »"
- gap_id: G-01-30
  truth: "Le panneau de fin de partie est une planche dans le bois du galet : titre en Caveat, couleurs et cavaliers de l'équipe gagnante, score des chevaux rentrés, « Rejouer »"
  status: failed
  reason: "User reported: Le panneau de victoire défaite est moche"
  severity: minor
  test: 30
  root_cause: "apps/web/src/ui/EndScreen.svelte est une simple boîte de noyer foncé (#4A2F1A) de 400 px : les pastilles des places dans les couleurs du plateau d'origine (pas la palette du galet), aucun score des chevaux rentrés, aucun bois ni rappel du galet."
  artifacts: [apps/web/src/ui/EndScreen.svelte, apps/web/src/routes/Game.svelte, apps/web/src/i18n/fr/game.ts, apps/web/e2e/partie.spec.ts, apps/web/e2e/finition.spec.ts]
  missing: ["Panneau dans le bois du galet (chêne, liseré de noyer, ombre sans flou), titre Caveat, les deux couleurs et cavaliers de l'équipe gagnante, score « 8 – n », donnes jouées et chevaux mangés, « Rejouer » et « Changer de couleur » ; tient dans 750 × 342 ; addendum de 01-UI-SPEC.md"]
  debug_session: ""
