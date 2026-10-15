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
  - **Révisé par Romain le 2026-10-15 (recette 3, test 26) :** « si l'on peut atteindre une case vide de la zone d'arrivée, il faut que ce soit le seul coup à jouer », puis « Seulement pour ce cheval », puis, pour un 9 joué sur un cheval qu'un 2 ferait rentrer, « Oui, autorisé » (« Seulement la carte qui le fait rentrer pile est obligée de le faire rentrer. Avec le 9, il peut continuer son tour. »). C'est la règle G16, jugée carte par carte, de la section « Recette 3 » ci-dessous ; seul son cas du 7 reste à confirmer.
- **D-03 :** Un cheval déjà rentré **peut encore avancer dans sa maison**, au compte exact et sans sauter un autre cheval. Une carte peut donc servir à avancer un pion à l'intérieur de la maison.
  - **Révisé par Romain le 2026-10-15 (recette 4, test 44) :** « J'ai essayé, et je voudrais être sûr que c'est bien intégré : quand un cheval entre dans son écurie, il peut doubler les autres chevaux et arriver sur une case vide. Tout à l'heure, ce n'était pas proposé, et le cheval a dû refaire un tour, ce qui n'est pas normal ». À la question « Un cheval déjà rentré dans son arrivée peut encore y avancer pour se ranger au fond, au compte exact. Peut-il lui aussi sauter les chevaux devant lui ? », son choix : « Oui, aussi (Recommandé) » (texte de l'option : « Même règle partout dans l'arrivée : on peut sauter les chevaux déjà rentrés, tant qu'on tombe au compte exact sur une case vide. »). C'est la règle G17 (RULES.md, plan 01-55) : en entrant comme dans la maison, un cheval saute les chevaux déjà rentrés ; le compte exact jusqu'à une case vide (D-01) et l'entrée obligatoire (D-02) ne changent pas. « sans sauter un autre cheval » ne tient plus, et G2 (« le cheval ne le saute pas et repart pour un tour ») est remplacé.
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
  - **Révisé par Romain le 2026-10-15 (recette 3, test 24) :** « Le plateau de jeu est trop petit sur iphone », puis « Plateau sur toute la hauteur (Recommandé) ». La barre compacte ci-dessous est remplacée sur le téléphone tenu en largeur (section « Recette 3 » ci-dessous) ; l'ordinateur garde sa barre du bas.
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
  - **Précisé par Romain le 2026-10-15 (recette 3, test 27) :** « Quand il ne reste qu'un cheval sur le plateau, inutile de cliquer dessus pour jouer la carte, sauf valet évidemment ». Le cheval seul est choisi tout seul, mais « Jouer » reste à toucher : D-19 tient (section « Recette 3 » ci-dessous).
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
  - **Révisé par Romain le 2026-10-15 (recette 3, tests 23 et 29) :** « les sons ne sont pas bons, il faut les retravailler », puis « Page d'essai à choix (Recommandé) » ; et « Les sons ne fonctionnent pas sur iphone en mode silencieux ». Les sons ne sont plus reportés : ils sont retravaillés dans cette phase (section « Recette 3 » ci-dessous). Puis, le même jour, après les sabots à choix (plan 01-51) : « OK, continue, laisse les sons de côté sauf les sabots des chevaux, et montre moi quand c'est prêt. » Seuls les sabots sont retravaillés dans cette phase ; les hennissements, les sons de cartes et les sons de fin de partie sont reportés (plans 01-52 et 01-53, section « Recette 3 » ci-dessous).
- **D-23 :** Le hennissement accompagne 4 moments : la **sortie d'écurie**, la **prise** (ruade de l'attaquant, plainte du mangé), l'**entrée dans la maison** (joyeux, fête au 4e) et l'**échange au Valet** (petit hennissement surpris).
  - Les sabots accompagnent chaque bond, au même rythme que l'animation.
  - Des sons de cartes accompagnent la donne, le jeu d'une carte et l'échange.
- **D-24 :** Les cartes reprennent un **jeu classique français** : figures traditionnelles comme sur l'aide-mémoire du plateau.
  - Il faut un visuel libre de droits, du domaine public ou sous licence CC0/CC-BY compatible, à faire valider.
  - Le dos des cartes est assorti au plateau.
- **D-25 :** ~~Une **ambiance sonore légère** est jouée en fond (campagne ou écurie, discrète), avec son propre réglage de volume.~~
  - ~~Elle se coupe séparément des bruitages.~~ Le réglage global « couper le son », le réglage « Bruitages » et le réglage « réduire les animations » (FX-06) restent disponibles.
  - **Révisé par Romain le 2026-10-14 : « Arrête le son d'ambiance, c'est pourri ».** Il n'y a plus d'ambiance sonore : aucune boucle ne joue en fond, le son « ambiance » est retiré du catalogue, de la page `#/sons` et des crédits, et les réglages « Ambiance » et « Volume de l'ambiance » disparaissent. Les anciens réglages enregistrés qui contiennent `ambience` ou `ambienceVolume` sont toujours lus (ces clés sont ignorées). Le jeu garde les bruitages : sabots, hennissements, sons de cartes (D-23).

### Recette 3 de Romain (2026-10-15)

Romain a refait la recette le 2026-10-15. Ses mots sont cités tels quels, et ses choix aux questions posées ensuite aussi. Ce qui suit « Conséquence de mise en œuvre (planificateur), à confirmer par Romain » est une lecture du planificateur, jamais ses mots. Plans 01-42 à 01-54 (01-52 et 01-53 reportés par Romain, voir « Les sons à retravailler ») ; recette dans 01-UAT.md, tests 23 à 30, puis re-tests et lectures à confirmer, tests 31 à 43.

- **Sons en mode silencieux (test 23, touche D-22 et D-23).** « Les sons ne fonctionnent pas sur iphone en mode silencieux (pas volume au minimum, mais silencieux, pas de sonnerie) ».
  - Conséquence de mise en œuvre (planificateur), à confirmer par Romain : le jeu passe la session audio de l'iPhone en lecture (« playback ») avant de créer le son, et, sur iPhone et iPad, joue en boucle un son muet par un élément audio de la page, lancé par le même premier toucher, arrêté quand l'app passe en arrière-plan ou quand « Son » est coupé. Le jeu se fait alors entendre même interrupteur sur silencieux, mais il interrompt la musique d'une autre app tant que la partie est à l'écran.
  - **Réponse de Romain le 2026-10-15 :** à la question de savoir si le jeu peut interrompre la musique d'une autre app pour se faire entendre en mode silencieux, « Oui, ça me va ». Aucun réglage n'est ajouté pour cela.
- **Plateau trop petit sur l'iPhone (test 24, révise D-07).** « Le plateau de jeu est trop petit sur iphone ». Son choix : « Plateau sur toute la hauteur (Recommandé) ».
  - Conséquence de mise en œuvre (planificateur), à confirmer par Romain : sur le téléphone tenu en largeur, le plateau prend toute la hauteur, sous une ligne de consigne de 24 px. La main passe dans une bande de 60 px à gauche du galet, les boutons dans une bande de 60 px à droite. Les infos deviennent une petite pastille en haut de la bande de gauche, qui ouvre une feuille « Infos de la partie ». Les boutons portent des libellés courts (« Autre carte », « Passer », « Poser »). L'ordinateur ne change pas. Calcul : sur son iPhone 13, ≈ 594 px de large dans Safari au lieu de ≈ 493, et ≈ 630 px installée au lieu de ≈ 585. Sur un petit téléphone (667 × 375, 480 × 320), le plateau perd 2 à 3 %.
- **Les cavaliers dessinés sur le plateau (test 25).** « Les chevaux gravés sur le plateau sont tous orientés de la même façon mais je voudrais les tourner pour que les sabots soient dirigés vers chaque camp ».
  - Lecture du planificateur : chaque cavalier à l'encre tourne d'un quart de tour selon le côté de sa couleur, comme les cartes du tapis : 0° en bas (inchangé), 90° à gauche, 180° en haut (vu tête en bas depuis sa place, comme les aide-mémoire du plateau d'origine), 270° à droite. Ses sabots pointent ainsi vers le bord de son camp.
  - **Décidé par Romain le 2026-10-15 :** entre le quart de tour par côté et une orientation en biais vers le centre du camp, son choix : « Quart de tour (Recommandé) ».
- **L'entrée dans la maison (test 26, précise D-01, D-02 et G14).** « J'ai l'impression que l'entrée dans la zone d'arrivée ne fonctionne pas toujours : si l'on peut atteindre une case vide de la zone d'arrivée, il faut que ce soit le seul coup à jouer ». À la question « que doit-on interdire ? », son choix : « Seulement pour ce cheval ».
  - Diagnostic du planificateur (300 parties entre ordinateurs) : le moteur n'a pas d'erreur, un cheval dont le compte tombe pile sur une case vide entre toujours. Mais deux fois sur trois, un cheval qui passe devant sa maison ne pouvait pas y entrer avec la carte jouée : le compte dépassait la maison (70 %) ou la case visée était occupée (28 %). Et 16 % des chevaux qui dépassaient leur maison auraient pu rentrer avec une autre carte de la même main, ou avec un autre partage du 7.
  - **Décidé par Romain le 2026-10-15, en réponse aux questions du planificateur :**
    - à la question « ton cheval est juste devant son arrivée et tu as en main un 2 (qui le fait rentrer) et un 9. Peux-tu jouer le 9 sur ce cheval pour lui faire refaire un tour ? », son choix : « Oui, autorisé ». Le texte de l'option était : « Seulement la carte qui le fait rentrer pile est obligée de le faire rentrer. Avec le 9, il peut continuer son tour. » La règle se juge donc carte par carte, pas sur toute la main ;
    - sur le compte qui dépasse la maison et la case visée occupée, qui font repartir le cheval pour un tour (D-01), son choix : « Oui, on garde ».
  - Règle G16 qui en découle (plans 01-42 et 01-43) : avec chaque carte, le cheval que cette carte peut faire entrer pile sur une case vide de sa maison n'est joué par elle que pour entrer. Les autres cartes restent libres sur ce cheval, et les autres chevaux restent libres.
    - Avec une carte ordinaire, c'est déjà le compte exact (D-02) : rien ne change.
    - Le 4 et le Valet ne font jamais entrer un cheval : ils ne sont pas concernés.
    - Avec le 7, c'est nouveau : si un partage du 7 peut faire entrer ce cheval, le 7 le fait entrer ou ne le bouge pas.
  - Conséquence de mise en œuvre (planificateur), à confirmer par Romain :
    - avec le 7, le cheval ne peut pas s'arrêter avant sa maison ; il peut s'arrêter sur son carré 16 et entrer à un pas suivant du même 7 ;
    - G16 ne rend jamais le 7 injouable : si aucun partage ne la respecte, le 7 se joue comme avant.
- **Un seul cheval pour la carte (test 27, touche D-16 et D-19).** « Quand il ne reste qu'un cheval sur le plateau, inutile de cliquer dessus pour jouer la carte, sauf valet évidemment ».
  - Conséquence de mise en œuvre (planificateur), à confirmer par Romain : quand un seul cheval peut jouer la carte choisie, il est choisi tout seul et l'aperçu s'affiche avec « Jouer ». Le Valet demande toujours les deux chevaux. L'As et le Roi posent toujours la question « Sortir » ou « Avancer » quand les deux sont possibles. Avec le 7, si un seul partage est possible, il est rempli tout seul. Le jeu ne joue toujours pas à la place du joueur (D-19) : il faut toujours toucher « Jouer ».
- **La donne (test 28).** « La distribution de cartes est un tout petit peu trop rapide ».
  - Conséquence de mise en œuvre (planificateur), à confirmer par Romain : chaque carte vole 300 ms au lieu de 250, et 55 ms séparent deux cartes au lieu de 40. La donne de 20 cartes dure ≈ 1,35 s au lieu de ≈ 1,01 s.
- **Les sons à retravailler (test 29, touche D-22, D-23 et le report de la recette du 2026-10-14).** « les sons ne sont pas bons, il faut les retravailler ». Son choix : « Page d'essai à choix (Recommandé) ». Les sons reviennent donc dans cette phase : ils ne sont plus reportés.
  - Conséquence de mise en œuvre (planificateur), à confirmer par Romain : la page `#/sons` fait entendre trois ou quatre versions de chaque son (sabots, chaque hennissement, chaque son de cartes, et deux nouveaux sons de fin de partie, « Victoire » et « Défaite »). Pour chaque son, Romain choisit sa version. Son choix vaut tout de suite dans le jeu sur son appareil, et « Copier mes choix » lui permet de l'envoyer pour qu'il devienne le choix de tous. Tant qu'il n'a rien choisi, le jeu garde les sons actuels. Chaque version est générée par le code ou est un enregistrement CC0 (ou domaine public) dont la licence est tracée fichier par fichier.
  - **Reporté par Romain le 2026-10-15**, une fois les sabots à choix faits (plan 01-51) : « OK, continue, laisse les sons de côté sauf les sabots des chevaux, et montre moi quand c'est prêt. »
    - Les sabots restent : quatre versions, de A (le son d'avant) à D, toutes générées par le code, à choisir sur `#/sons` ; « Copier mes choix » envoie son choix.
    - Reportés : les hennissements en plusieurs versions (plan 01-52), les sons de cartes en plusieurs versions et les deux sons de fin de partie, « Victoire » et « Défaite » (plan 01-53). Les hennissements et les sons de cartes gardent leur seule version « A » ; aucun son « Victoire » ou « Défaite » n'est ajouté.
    - Dans la recette (01-UAT.md), ces sons ne sont pas des tests en attente : les tests 31, 37, 38 et 42 le notent en citant Romain. Le gap G-01-29 reste ouvert pour eux.
- **Le panneau de fin (test 30, Claude's Discretion « écran de fin de partie »).** « Le panneau de victoire défaite est moche ».
  - Conséquence de mise en œuvre (planificateur), à confirmer par Romain : le panneau devient une planche dans le bois du galet. Il porte le titre en Caveat, les deux couleurs de l'équipe gagnante avec leurs cavaliers, le score des chevaux rentrés (« 8 – 5 »), les donnes jouées et les chevaux mangés, puis « Rejouer » et « Changer de couleur ».

### Recette 4 de Romain (2026-10-15) : sauter les chevaux rentrés

- **Le 2026-10-15, Romain a rejoué après G16 (test 44 de 01-UAT.md, touche D-01, D-02, D-03 et G2).** Ses mots : « J'ai essayé, et je voudrais être sûr que c'est bien intégré : quand un cheval entre dans son écurie, il peut doubler les autres chevaux et arriver sur une case vide. Tout à l'heure, ce n'était pas proposé, et le cheval a dû refaire un tour, ce qui n'est pas normal ». (Son « écurie » est ici la maison d'arrivée.)
  - **Décidé par Romain le 2026-10-15 :** à la question « Un cheval déjà rentré dans son arrivée peut encore y avancer pour se ranger au fond, au compte exact. Peut-il lui aussi sauter les chevaux devant lui ? », son choix : « Oui, aussi (Recommandé) ». Le texte de l'option était : « Même règle partout dans l'arrivée : on peut sauter les chevaux déjà rentrés, tant qu'on tombe au compte exact sur une case vide. »
  - Règle G17 qui en découle (plan 01-55) : dans la maison, en entrant depuis le carré 16 comme en y avançant, un cheval saute les chevaux déjà rentrés. Le compte exact jusqu'à une case vide reste exigé (D-01) et l'entrée reste obligatoire quand il tombe juste (D-02), en sautant s'il le faut. Le 4 ne fait jamais entrer. Avec le 7, G16 compte ces entrées. Elle remplace G2 et la fin de D-03 ; l'ancienne règle reste réglable dans le moteur (HOME_JUMP_ALLOWED).

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
