# Règles du TOC — version maison

**Statut :** brouillon à valider par Romain
**Date :** 2026-10-13
**Contenu de cette version :** règles R-01 à R-08 (équipes, plateau, donnes, échange, tour, As et Roi, cartes à avancer, le 4). Les règles R-09 à R-16 (Valet, 7, prise, sortie protégée, maison, main injouable, joueur qui a fini, fin de partie) s’ajoutent à la suite.

Chaque règle est numérotée. Chaque règle cite des scénarios (`R-NN.k`) : ce sont de petits cas écrits comme des données, que le moteur de jeu devra reproduire à l’identique. Rien n’est décidé en silence dans le code : ce qui est écrit ici est ce que le jeu fera.

Les points déjà tranchés avec Romain sont écrits sans réserve. Tout le reste est une hypothèse de travail et porte la mention « à valider » : Romain les relit une par une avant que le moteur ne soit figé.

## Vocabulaire

- **Plateau :** un parcours de 72 cases partagé par les quatre couleurs, parcouru dans le sens horaire : bleu → jaune → rouge → vert → bleu.
- **Numérotation des cases :** dans les scénarios, les cases sont numérotées de 0 à 71 dans le sens horaire en partant du losange bleu. Le losange de sortie est la case 0 pour le bleu, 18 pour le jaune, 36 pour le rouge, 54 pour le vert.
- **Losange (case de sortie) :** la case où un cheval arrive quand il sort de l’écurie, à côté de son écurie. C’est le losange 18 du quart de la couleur sur le plateau imprimé.
- **Carré 16 (case d’entrée) :** la case située deux cases avant la sortie de sa couleur. C’est par elle qu’un cheval entre dans sa maison.
- **Écurie :** quatre places où attendent les chevaux qui ne sont pas encore sortis, ou qui ont été mangés.
- **Maison :** quatre cases d’arrivée, en diagonale vers le centre, où les chevaux rentrent. Un cheval rentré a terminé son parcours.
- **Équipes :** les partenaires sont face à face, jaune avec vert contre rouge avec bleu.
- **Progression :** le nombre de cases parcourues par un cheval depuis sa sortie. Un cheval qui vient de sortir est à la progression 0. Avancer l’augmente, reculer la diminue (elle peut devenir négative) et elle n’est pas plafonnée : un cheval qui rate sa maison fait un tour de plus.

### R-01 Équipes et places

**Règle** — Une partie se joue à quatre places, en deux équipes de deux. Les partenaires sont face à face : jaune avec vert, rouge avec bleu. Chaque joueur n’a que ses quatre chevaux, et son partenaire n’en joue pas pour lui tant qu’il lui en reste (voir R-15).

**Cas limites**
- Les équipes ne dépendent pas du donneur : la carte échangée à chaque donne va toujours au partenaire (Q5, R-04).
- Une place est tenue par un humain ou par un joueur géré par l’ordinateur ; les règles sont les mêmes pour tous.

**Scénarios**
- R-01.1 — Bleu et rouge sont partenaires, jaune et vert aussi
- R-01.2 — Les partenaires restent face à face quel que soit le donneur

### R-02 Plateau et progression

**Règle** — Le plateau a 72 cases et on le parcourt dans le sens horaire. Un cheval sort sur son losange (progression 0), avance en ajoutant des cases à sa progression et recule en en retirant. Il doit avoir fait le tour complet (progression d’au moins 70) pour pouvoir entrer dans sa maison par le carré 16 ; son entrée dans la maison est détaillée en R-13.

**Cas limites**
- Un cheval qui recule de 4 depuis sa sortie se retrouve à la progression −4, sur la case située quatre cases avant son losange. Cette décision est actée (D-04).
- Un cheval à la progression −2 se tient sur son propre carré 16, mais il n’a pas fait le tour : il n’entre pas dans la maison. Un cheval ne peut entrer qu’après avoir fait le tour complet (acté).
- Un cheval peut s’arrêter sur le losange d’une autre couleur ; il y est un cheval ordinaire (R-12).
- Après un échange au Valet, la progression du cheval qui change de place est à préciser en R-09 (G1, à valider).

**Scénarios**
- R-02.1 — La progression compte les cases parcourues depuis la sortie
- R-02.2 — Reculer de 4 depuis la sortie donne une progression de −4
- R-02.3 — Un pion à −2 est sur sa case d’entrée sans avoir fait le tour
- R-02.4 — Un pion bleu peut s’arrêter sur la case de sortie du jaune

### R-03 Paquet, donnes et donneur

**Règle** — On joue avec un jeu de 52 cartes sans joker, mélangé. Les cartes sont distribuées en trois donnes successives : 5 cartes à chacun, puis 4, puis 4. Quand les 52 cartes sont distribuées, on rebat et le donneur change : il passe au joueur suivant dans le sens horaire.

**Cas limites**
- Le joueur qui commence chaque donne est celui qui suit le donneur dans le sens horaire (G9, à valider). Le donneur reste le même pendant les trois donnes d’un paquet et ne change qu’au moment de rebattre (G9, à valider).
- Le premier donneur est choisi au début de la partie ; il n’a aucune influence sur les équipes.
- La suite complète d’un paquet (les trois donnes jouées jusqu’au bout) est vérifiée par des tests automatiques sur des parties tirées au hasard ; les scénarios ci-dessous en vérifient chaque étape.

**Scénarios**
- R-03.1 — La première donne est de 5 cartes, le joueur après le donneur commence
- R-03.2 — La deuxième donne est de 4 cartes, avec le même donneur
- R-03.3 — La troisième donne est de 4 cartes, avec le même donneur
- R-03.4 — Après la troisième donne on rebat et le donneur passe au suivant
- R-03.5 — Les 52 cartes restent toutes présentes après la donne et l’échange

### R-04 Échange de carte

**Règle** — À chaque donne, une fois sa main vue, chaque joueur choisit une carte et la passe face cachée à son partenaire. Quand les quatre ont choisi, les quatre cartes changent de main ensemble. Le jeu commence ensuite.

**Cas limites**
- L’échange a lieu à chaque donne (5, 4 et 4), pas seulement à la première (acté, D-04).
- Un joueur voit sa main avant de choisir (Q8, à valider).
- L’échange a lieu même si la main du joueur semble injouable : la carte reçue peut la sauver, et une main vraiment injouable est posée après l’échange (Q6, à valider).
- La carte échangée ne compte pas dans la taille de la donne : chacun garde 5 cartes (ou 4) après l’échange (Q7, à valider).
- Rien ne bouge tant que les quatre n’ont pas choisi : le jeu indique seulement qui doit encore choisir (G8, à valider).
- On ne peut donner qu’une carte qu’on a en main.
- La carte reçue est marquée dans la main du joueur jusqu’à ce qu’il la joue (D-21).

**Scénarios**
- R-04.1 — Trois choix ne suffisent pas : rien ne bouge avant le quatrième
- R-04.2 — Au quatrième choix les quatre cartes changent de main ensemble
- R-04.3 — Une main qui semble injouable échange quand même
- R-04.4 — La carte reçue ne compte pas dans la taille de la donne
- R-04.5 — On ne peut donner qu’une carte de sa main

### R-05 Tour et obligation de jouer

**Règle** — On joue chacun son tour dans le sens horaire : bleu, jaune, rouge, vert, puis de nouveau bleu. À son tour, un joueur qui a une carte jouable doit en jouer une. Il ne peut pas poser sa main tant qu’une carte est jouable.

**Cas limites**
- Le sens horaire est acté (D-04).
- Jouer une carte jouable est obligatoire : il n’y a pas de défausse volontaire (Q20, à valider).
- Un joueur dont la main est vide est sauté jusqu’à la donne suivante (à valider).
- Le jeu ne joue jamais à la place d’un joueur humain, même s’il n’a qu’un seul coup possible : il le met seulement en évidence (D-19).

**Scénarios**
- R-05.1 — Le tour passe dans le sens horaire : bleu, jaune, rouge, vert
- R-05.2 — Quand une carte est jouable, poser sa main est interdit
- R-05.3 — Un joueur sans carte est sauté

### R-06 As et Roi

**Règle** — L’As sort un cheval de l’écurie sur son losange, ou avance un cheval de 1. Le Roi sort un cheval de l’écurie sur son losange, ou avance un cheval de 13. Quand les deux sont possibles, le joueur choisit. Sortir un cheval sur un losange occupé par un cheval d’une autre couleur mange ce cheval ; c’est impossible si son propre cheval est déjà sur le losange.

**Cas limites**
- S’il n’y a plus de cheval à l’écurie, l’As et le Roi ne servent qu’à avancer.
- Quand plusieurs chevaux sont à l’écurie, ils sont interchangeables : c’est le premier (le plus petit numéro) qui sort.
- Un cheval adverse ou du partenaire garé sur mon losange est mangé par ma sortie, puisqu’il n’y est pas protégé : seul le cheval de la couleur du losange y est protégé (Q13 à valider ; Q14 acté).
- Mon propre cheval sur mon losange bloque ma deuxième sortie : il faut d’abord le faire avancer (Q15, à valider).

**Scénarios**
- R-06.1 — L’As sort un pion ou avance de 1 : les deux sont permis
- R-06.2 — Le Roi sort un pion ou avance de 13
- R-06.3 — Sans pion à l’écurie, l’As ne peut qu’avancer
- R-06.4 — Sortir sur un adversaire garé sur ma sortie le mange
- R-06.5 — Mon pion sur ma sortie m’empêche d’en sortir un second

### R-07 Cartes à avancer

**Règle** — La Dame avance un cheval de 12. Le 10, le 9, le 8, le 6, le 5, le 3 et le 2 avancent un cheval du nombre indiqué. Le 5 ne fait avancer que les propres chevaux du joueur. On ne peut jamais s’arrêter sur un de ses propres chevaux.

**Cas limites**
- Le 5 est une règle maison : il ne fait pas avancer les chevaux des autres joueurs, partenaire compris (acté). Aucune autre carte ne déplace un cheval qui n’est pas à soi, sauf l’échange du Valet (G10, à valider pour la formulation générale).
- S’arrêter sur un cheval adverse ou du partenaire le mange (R-11) ; passer par-dessus ne mange rien, sauf pour le 7 (R-10).
- Un cheval peut passer par-dessus d’autres chevaux, les siens compris, avec les cartes ordinaires : seul un cheval protégé sur son losange est infranchissable (R-12). Cette hypothèse n’est pas listée dans la recherche (G11, à valider).
- Les chevaux entrent dans la maison au compte exact ; le détail est en R-13.

**Scénarios**
- R-07.1 — La Dame avance de 12
- R-07.2 — Les cartes 10, 9, 8, 6, 3 et 2 avancent du nombre indiqué
- R-07.3 — Le 5 ne fait avancer que mes propres pions
- R-07.4 — On ne s’arrête jamais sur un de ses propres pions
- R-07.5 — Un cheval passe par-dessus les autres sans les manger

### R-08 Le 4

**Règle** — Le 4 fait reculer un cheval de 4 cases, y compris un cheval qui vient de sortir et se trouve sur son losange. On n’entre jamais dans sa maison en reculant.

**Cas limites**
- Reculer depuis la sortie est acté (D-04) : le cheval passe à la progression −4.
- Ne jamais entrer dans la maison en reculant, et devoir faire le tour complet, est acté (D-04).
- Un cheval qui recule et s’arrête sur un cheval adverse ou du partenaire le mange, comme avec toute autre carte (R-11).
- Un cheval protégé sur son losange est infranchissable, y compris pour un autre cheval de sa propre couleur qui voudrait reculer à travers lui (G4, à valider).
- Un cheval à l’écurie ne peut pas reculer. Si aucun cheval ne peut reculer, le 4 est injouable.

**Scénarios**
- R-08.1 — Le 4 recule un pion qui vient de sortir
- R-08.2 — Le 4 qui recule sur un adversaire le mange
- R-08.3 — On n’entre jamais dans la maison en reculant
- R-08.4 — Le 4 ne dépasse pas un pion protégé sur sa sortie
- R-08.5 — Mon pion protégé sur ma sortie bloque aussi mon autre pion
- R-08.6 — Un pion à l’écurie ne peut pas reculer : le 4 est injouable

## Points proposés par défaut, à valider par Romain

Cette liste sera consolidée en fin de rédaction avec R-09 à R-16. Pour R-01 à R-08, ce sont : G8 (l’échange est simultané), G9 (qui commence, quand change le donneur), G10 et G11 (aucune carte ordinaire ne déplace un cheval d’autrui ; on passe par-dessus les chevaux sans les manger), G4 (un cheval protégé bloque même son propre camp), Q6, Q7, Q8 (échange), Q13 et Q15 (sortie), Q20 (jouer est obligatoire).
