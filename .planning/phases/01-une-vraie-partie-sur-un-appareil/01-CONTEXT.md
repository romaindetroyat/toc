# Phase 1: Une vraie partie sur un appareil - Context

**Gathered:** 2026-10-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Un joueur fait une partie complète de TOC sur un seul appareil (téléphone ou ordinateur), contre trois joueurs gérés par l'ordinateur qui jouent un coup légal au hasard (niveau 1). La partie se joue sur le plateau original assemblé, avec des cavaliers animés et sonorisés. Cette phase comprend :

- RULES.md, validé par Romain ;
- le moteur de règles pur et testé ;
- le repérage précis des cases sur l'illustration ;
- l'interface de jeu ;
- les animations et l'audio.

Hors de cette phase :

- le réseau et le serveur (phase 2) ;
- les niveaux 2 à 5 de l'ordinateur (phase 3) ;
- les comptes et la PWA installable (phase 4) ;
- l'aide sur les règles et le tutoriel (phase 5).

Requirements : RULE-01 à RULE-18, RULE-20, PLAY-01 à PLAY-05, FX-01 à FX-06.

</domain>

<decisions>
## Implementation Decisions

### Règles : précision apportée pendant la discussion (remplace la formulation de RULE-15)
- **D-01 :** Pour entrer dans sa maison, il faut le **compte exact jusqu'à une case vide** de la maison. Atteindre le carré 16 ne suffit pas.
  - Si le compte ne tombe pas juste, ou si la case visée est occupée, le cheval n'entre pas.
  - Le cheval dépasse alors sa case d'entrée, continue sur le parcours et repart pour un tour supplémentaire. Ce mouvement est légal.
  - **Reversibility:** costly — modèle de progression des pions et générateur de coups.
- **D-02 :** Quand le compte permet d'entrer pile sur une case vide, l'entrée est **obligatoire**. Le cheval ne peut pas choisir de refaire un tour.
- **D-03 :** Un cheval déjà rentré **peut encore avancer dans sa maison**, au compte exact et sans sauter un autre cheval. Une carte peut donc servir à avancer un pion à l'intérieur de la maison.
- **D-04 :** Rappel des décisions déjà validées (PROJECT.md, « Rule Decisions ») :
  - sens horaire ;
  - entrée par le carré 16 ;
  - losange 18 infranchissable seulement pour le pion de sa couleur ;
  - le 4 peut reculer depuis la sortie, mais jamais pour entrer dans la maison ;
  - tour complet obligatoire ;
  - le 7 dépasse ses propres pions et se joue en entier ou pas du tout ;
  - échange de carte à chaque donne ;
  - le Valet n'échange pas deux pions du même joueur.
  - **Révisé par Romain le 2026-10-14 (recette, test 6) :** « tour complet obligatoire » est levé ; un cheval qui atteint son carré 16 en avançant entre au compte exact, même sans tour complet (RULES.md, G14).
  - **Révisé par Romain le 2026-10-14 (recette, test 7) :** le 7 dépasse les chevaux du partenaire sans les manger ; il ne les mange que s’il s’arrête sur eux (RULES.md, G15).

  Les autres cas limites (SUMMARY.md, questions 5 à 34) prennent la valeur par défaut de la recherche, à faire valider par Romain dans RULES.md.

### Écran et plateau
- **D-05 :** Le plateau **tourne pour que la couleur du joueur humain soit en bas**, face à lui. On tourne l'ensemble par quarts de tour, l'illustration n'est pas modifiée.
  - Dans l'illustration d'origine, chaque aide-mémoire est écrit pour un joueur assis de son côté : bleu en bas, jaune à gauche, rouge en haut, vert à droite.
  - Les partenaires sont donc face à face : bleu et rouge, jaune et vert.
  - **Reversibility:** reversible.
  - **Révisé par Romain le 2026-10-14 (recette, test 4 ; plateau C+) :** le plateau est le C+ (planche « C+ · Portrait avec les idées du 01 », maquette `design/plateau-maquette.dc.html`), dessiné par le code, en portrait. Son propre camp est centré en bas, celui de son partenaire centré en haut. Les petits cadres de rappel des règles disparaissent, « inutiles car impossibles à voir ».
  - **Conséquence de mise en œuvre (planificateur), à confirmer par Romain :** un plateau 2:3 ne peut pas tourner d’un quart de tour. Au lieu de tourner le dessin, chaque couleur reçoit son côté : la couleur du joueur en bas, son partenaire en haut, le joueur suivant dans le sens horaire à gauche, le précédent à droite. Le dessin ne tourne jamais. Point repris dans la recette de fin de phase (plan 01-36).
  - **Révisé par Romain le 2026-10-14 (recette, test 4 ; plateau galet) :** le C+ est abandonné après l’avoir vu dans le jeu : « Bon, ben ça ne marche pas ce plateau, c’est trop laid », « trop plat, sans charme », « la forme ». Le plateau est le galet en bois de `design/plateau-galet.dc.html` : d’abord « galet partout » (l’ordinateur en largeur, l’iPhone en hauteur), puis, le même jour, « Pour la version iphone, oblige à jouer en format paysage, ça permettra d’utiliser le même plateau » et « Oui, paysage obligatoire ». Il n’y a donc qu’un plateau, le galet en largeur, sur l’ordinateur comme sur le téléphone. Son propre camp reste centré en bas, celui de son partenaire en haut.
  - **Conséquence de mise en œuvre (maquette ou planificateur), à confirmer par Romain :** les places par couleur (en bas le joueur, à gauche le suivant dans le sens horaire, en haut le partenaire, à droite le précédent ; le dessin ne tourne jamais) ; la taille des cavaliers du galet (0,95 pas sur l’anneau, 0,82 dans une maison, 0,78 dans une écurie) ; l’écran plus haut que large, puisque Safari ne bloque pas l’orientation : l’invitation « Tourne ton téléphone » à la place du plateau (et « Élargis la fenêtre » dans une fenêtre d’ordinateur plus haute que large, plan 01-38), le passage en direct quand on tourne l’écran, la partie gardée telle quelle et les joueurs de l’ordinateur qui attendent. Point repris dans la recette de fin de phase (plan 01-41).
  - **Révisé par Romain le 2026-10-14 (fichier d’instructions du projet) :** à la question « Le fichier d’instructions du projet (.claude/CLAUDE.md) dit « reprendre fidèlement le plateau existant ; ne pas le redessiner ». Je le mets à jour avec ta décision (plateau C+, ton dessin d’origine conservé dans le projet) ? », Romain a répondu « Oui, mets-le à jour ». La ligne mise à jour décrit le plateau décidé ensuite le même jour, le galet en largeur (« galet partout », puis « Oui, paysage obligatoire »), les quatre quarts restant dans `assets/plateau` comme son œuvre.
- **D-06 :** En solo, le joueur **choisit sa couleur avant la partie**, ce qui fixe aussi son partenaire. Il faut donc un petit écran de lancement : choix de la couleur, puis « Jouer ».
- **D-07 :** Sur téléphone en portrait :
  - le plateau carré occupe toute la largeur en haut de l'écran ;
  - la main du joueur est affichée en éventail dessous ;
  - un bandeau fin indique à qui c'est le tour, le donneur et les équipes.

  Sur grand écran, même logique avec plus d'espace.
  - **Révisé par Romain le 2026-10-14 (recette, test 4 ; plateau C+) :** le plateau n’est plus carré : c’est le C+ en portrait (2:3), en haut de l’écran.
  - **Révisé par Romain le 2026-10-14 (« Compacter l’écran ») :** sur téléphone en portrait, le bandeau d’infos est plus fin, les boutons d’action passent sur la rangée de la main (plus de bandeau séparé pour la zone d’action), la main est un peu plus basse et moins haute. Le plateau grandit d’autant : au moins 300 px de large sur un iPhone 13 dans Safari, l’objectif donné à Romain avec la question.
  - **Conséquence de mise en œuvre (planificateur), à confirmer par Romain :** le « dock » décrit dans l’addendum « Plateau C+ » de 01-UI-SPEC.md (rangée de la consigne au-dessus de la rangée de la main, boutons en colonne à sa droite, cartes de 64 × 90 dont le bas passe sous le bord de l’écran) et les objectifs de taille de sa section « Écran compact (téléphone en portrait) ». Points repris dans la recette de fin de phase (plan 01-36).
  - **Révisé par Romain le 2026-10-14 (recette, test 4 ; plateau galet) :** l’ordinateur montre le plateau en largeur (« Là, on ne voit rien sur ordi »). Le téléphone aussi, tenu en largeur : « oblige à jouer en format paysage », « Oui, paysage obligatoire ». « Compacter l’écran » reste valable sur le téléphone.
  - **Conséquence de mise en œuvre (maquette ou planificateur), à confirmer par Romain :** la barre du bas de 160 px sur ordinateur (les infos à gauche, la main au milieu, la zone d’action à droite) ; la barre compacte en largeur, qui applique « Compacter l’écran » au téléphone tenu en largeur (révisée dans le plan 01-37 : les infos dans une colonne de 96 px à gauche du plateau ; dessous, à partir de 640 px de large, une seule rangée de 64 px pour la main, la consigne et les boutons, et sous 640 px deux rangées de 56 et 64 px) ; les seuils (la barre à partir de 960 × 600, la barre compacte sur les autres écrans en largeur, l’invitation à tourner l’écran en portrait) ; les objectifs de taille de l’addendum « Plateau galet » de 01-UI-SPEC.md. Point repris dans la recette de fin de phase (plan 01-41).
- **D-08 :** Le carré vert central sert de **tapis de jeu**.
  - La dernière carte jouée par chacun y est posée devant sa place, comme à une vraie table.
  - Le talon et la défausse y sont aussi.
  - Une main injouable y est posée face visible.
  - **Révisé par Romain le 2026-10-14 (recette, test 4 ; plateau C+) :** le tapis est le rectangle vert vertical au milieu du C+.
  - **Conséquence de mise en œuvre (maquette), à confirmer par Romain :** la dernière carte de chaque place est posée devant elle, tournée vers elle, avec sa petite inclinaison ; le talon est au-dessus du centre et la défausse en dessous, comme sur la planche approuvée. Point repris dans la recette de fin de phase (plan 01-36).
  - **Révisé par Romain le 2026-10-14 (recette, test 4 ; plateau galet) :** « J’aime bien le galet », dit après la « correction des transparences du tapis », puis « galet partout ».
  - **Conséquence de mise en œuvre (maquette), à confirmer par Romain :** le tapis est l’ellipse verte de la planche « Ordinateur · galet », le seul plateau du jeu depuis le paysage obligatoire (le rectangle arrondi de la planche « iPhone · galet » ne sert plus au jeu) ; sa texture de bruit est coupée au tapis seul ; les cartes sont tournées vers leur place, avec leur inclinaison ; le talon et la défausse sont de part et d’autre du centre. Point repris dans la recette de fin de phase (plan 01-41).

### Cavaliers et animations
- **D-09 :** Les pions sont des **cavaliers d'échecs de style Staunton en bois peint**.
  - Ils sont teintés à la couleur du joueur, avec un aspect mat et un léger veinage, pour s'accorder au plateau en bois.
  - Ils restent en « fausse 3D » : ombre portée, dégradés, reflet discret.
- **D-10 :** La tête du cheval **regarde dans le sens de la marche** et suit la direction locale du parcours. Elle fait volte-face quand le pion recule de 4.
- **D-11 :** Le cavalier avance par **petits bonds case par case**, avec un « clop » de sabot par bond.
  - Plus la distance est longue, plus le rythme accélère, jusqu'au galop.
  - Repère : 1 case ≈ 0,4 s et 13 cases (le Roi) ≈ 2 s au maximum. La courbe d'accélération est laissée au planner.
- **D-12 :** Pour une prise, l'attaquant **se cabre (ruade)**, puis le cheval mangé est **éjecté en arc jusqu'à son écurie**, avec un hennissement.
  - Avec le 7, chaque prise a lieu au moment où l'attaquant passe sur la case.
- **D-13 :** Pour l'échange au Valet, les deux cavaliers font **deux bonds en arc croisés** et atterrissent chacun à la place de l'autre.
- **D-14 :** Pour l'entrée dans la maison, l'animation reste sobre pour les 3 premiers chevaux d'un joueur. Pour le **4e, petite fête** : le cheval se cabre, un hennissement joyeux retentit, avec un effet visuel léger.
- **D-15 :** La sortie de l'écurie est un bond de l'écurie vers le losange 18, accompagné d'un hennissement.

### Jouer un coup et rythme
- **D-16 :** Pour jouer, le joueur **touche une carte**, ce qui allume les chevaux jouables, puis **touche un cheval**.
  - L'aperçu du trajet et des chevaux qui seraient mangés s'affiche, puis un bouton **« Jouer »** confirme.
  - On ne joue pas en glissant la carte.
  - Avec l'As et le Roi, un choix « Sortir » ou « Avancer » est proposé quand les deux sont possibles.
- **D-17 :** Pour répartir le 7, le joueur procède **cheval par cheval** :
  - il touche un cheval et choisit un nombre de pas, entre 1 et le reste à jouer ;
  - l'aperçu se met à jour, avec les prises en chemin ;
  - il recommence jusqu'à ce que le reste soit 0, puis confirme une seule fois.

  Il faut pouvoir annuler une étape avant la confirmation.
- **D-18 :** Les ordinateurs jouent à un **rythme naturel**, avec environ 1 s de réflexion puis l'animation. Un bouton **« avance rapide »** raccourcit les temps de réflexion et les animations.
- **D-19 :** Le jeu ne joue **jamais un coup à la place du joueur**, même quand un seul coup est possible : ce coup est seulement mis en évidence.
- **D-20 :** Quand aucune carte n'est jouable :
  - un message explique qu'aucune carte n'est jouable ;
  - un bouton **« Poser mes cartes »** pose la main face visible sur le tapis ;
  - le joueur attend ensuite la donne suivante.
- **D-21 :** Pendant l'échange de carte avec le partenaire :
  - le joueur choisit la carte à passer et voit qui doit encore choisir ;
  - la **carte reçue est marquée** (entourée) dans sa main jusqu'à ce qu'il la joue.

### Sons et cartes
- **D-22 :** Les bruitages viennent d'**enregistrements libres de droits (CC0)** quand on en trouve de bons, par exemple sur Freesound. Sinon, ils sont **générés par le code** (Web Audio).
  - La licence de chaque fichier est tracée dans un fichier dédié.
  - Romain valide l'ensemble à l'oreille : prévoir une page ou un écran de test des sons.
- **D-23 :** Le hennissement accompagne 4 moments : la **sortie d'écurie**, la **prise** (ruade de l'attaquant, plainte du mangé), l'**entrée dans la maison** (joyeux, fête au 4e) et l'**échange au Valet** (petit hennissement surpris).
  - Les sabots accompagnent chaque bond, au même rythme que l'animation.
  - Des sons de cartes accompagnent la donne, le jeu d'une carte et l'échange.
- **D-24 :** Les cartes reprennent un **jeu classique français** : figures traditionnelles comme sur l'aide-mémoire du plateau.
  - Il faut un visuel libre de droits, du domaine public ou sous licence CC0/CC-BY compatible, à faire valider.
  - Le dos des cartes est assorti au plateau.
- **D-25 :** ~~Une **ambiance sonore légère** est jouée en fond (campagne ou écurie, discrète), avec son propre réglage de volume.~~
  - ~~Elle se coupe séparément des bruitages.~~ Le réglage global « couper le son », le réglage « Bruitages » et le réglage « réduire les animations » (FX-06) restent disponibles.
  - **Révisé par Romain le 2026-10-14 : « Arrête le son d'ambiance, c'est pourri ».** Il n'y a plus d'ambiance sonore : aucune boucle ne joue en fond, le son « ambiance » est retiré du catalogue, de la page `#/sons` et des crédits, et les réglages « Ambiance » et « Volume de l'ambiance » disparaissent. Les anciens réglages enregistrés qui contiennent `ambience` ou `ambienceVolume` sont toujours lus (ces clés sont ignorées). Le jeu garde les bruitages : sabots, hennissements, sons de cartes (D-23).

### Claude's Discretion
- La courbe exacte d'accélération des bonds et la durée des prises et des fêtes, dans les repères D-11.
- Les détails graphiques du bandeau d'infos, de l'écran de lancement solo et de l'écran de fin de partie.
- La technique de dessin des cavaliers (SVG fait main, ou rendu à partir d'un modèle) et du veinage du bois.
- La manière d'annuler une étape du 7.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Projet et règles
- `.planning/PROJECT.md` — vision, décisions de règles validées (section « Rule Decisions »), contraintes
- `.planning/REQUIREMENTS.md` — exigences RULE/PLAY/FX de la phase 1 (RULE-15 est précisé par D-01 à D-03 ci-dessus)
- `.planning/ROADMAP.md` — objectif et critères de succès de la phase 1

### Recherche
- `.planning/research/SUMMARY.md` — synthèse, questions de règles 5 à 34 avec leurs hypothèses par défaut
- `.planning/research/ARCHITECTURE.md` — API du moteur, événements comme contrat d'animation, modèle de géométrie du plateau
- `.planning/research/PITFALLS.md` — pièges 1 à 10 (modèle par progression, 7, sortie protégée, audio iOS, perf SVG)
- `.planning/research/STACK.md` — stack recommandée (Svelte 5, Vite 8, WAAPI, Web Audio, Vitest 4.1 + fast-check)

### Illustrations
- `assets/plateau/quart-bleu.webp` — quart bas-gauche (1280×1280)
- `assets/plateau/quart-jaune.webp` — quart haut-gauche
- `assets/plateau/quart-rouge.webp` — quart haut-droite
- `assets/plateau/quart-vert.webp` — quart bas-droite

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Le dépôt ne contient pas encore de code applicatif : c'est un projet greenfield.
- Les 4 quarts du plateau en webp sont prêts à l'emploi.
- Un prototype jetable de pion SVG en « fausse 3D » a été fait en début de projet, hors dépôt. Il a validé les ingrédients : dégradés linéaire et radial calculés depuis la couleur du joueur, ombre portée floue, reflet blanc. Il devra être réécrit en cavalier, avec l'ombre pré-calculée pour les performances.

### Established Patterns
- Aucun pour l'instant. La stack recommandée est dans STACK.md.

### Integration Points
- Le moteur doit rester pur (sans I/O) pour être réutilisé tel quel par le Durable Object en phase 2 et par les ordinateurs en phase 3.
- Les événements émis par le moteur (pion déplacé avec son trajet, pion mangé, pion renvoyé à l'écurie, échange, entrée dans la maison, main posée) forment le contrat de l'animation et de l'audio, et plus tard du réseau.

</code_context>

<specifics>
## Specific Ideas

- On doit retrouver la sensation d'être assis à la vraie table : sa couleur devant soi, les cartes posées sur le tapis vert devant chaque place.
- Le côté ludique est voulu : ruade et éjection en arc lors d'une prise, sauts croisés au Valet, fête au 4e cheval rentré.
- La cadence des sabots, liée à la vitesse et donc à la distance de la carte, est un élément d'ambiance central.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-une-vraie-partie-sur-un-appareil*
