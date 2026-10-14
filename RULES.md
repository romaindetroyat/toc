# Règles du TOC — version maison

**Statut :** Validé par Romain le 2026-10-13 (voir « Décisions de Romain » à la fin)
**Date :** 2026-10-13
**Contenu de cette version :** les seize règles R-01 à R-16 (équipes, plateau, donnes, échange, tour, As et Roi, cartes à avancer, le 4, le Valet, le 7, prise, sortie protégée, maison, main injouable, joueur qui a fini, fin de partie), suivies de « Décisions de Romain » (les points qu’il a validés, avec la valeur retenue) et de « Décidé » (ce qui l’est déjà, avec sa source). Chaque scénario est dessiné sur le plateau : à gauche avant le coup, à droite après.

Chaque règle est numérotée. Chaque règle cite des scénarios (`R-NN.k`) : ce sont de petits cas écrits comme des données, que le moteur de jeu devra reproduire à l’identique. Rien n’est décidé en silence dans le code : ce qui est écrit ici est ce que le jeu fera.

Tous les points sont maintenant tranchés : Romain a relu et validé le document le 2026-10-13, avec la valeur par défaut pour chacun des points de « Décisions de Romain ». Ce que dit ce document est ce que le moteur fait.

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
  ![R-01.1](docs/regles/R-01.1.webp)
- R-01.2 — Les partenaires restent face à face quel que soit le donneur
  ![R-01.2](docs/regles/R-01.2.webp)

### R-02 Plateau et progression

**Règle** — Le plateau a 72 cases et on le parcourt dans le sens horaire. Un cheval sort sur son losange (progression 0), avance en ajoutant des cases à sa progression et recule en en retirant. Il entre dans sa maison par le carré 16 chaque fois qu’il l’atteint ou le franchit en avançant, même s’il n’a pas fait le tour complet (G14) ; son entrée dans la maison est détaillée en R-13.

**Cas limites**
- Un cheval qui recule de 4 depuis sa sortie se retrouve à la progression −4, sur la case située quatre cases avant son losange. Cette décision est actée (D-04).
- Un cheval à la progression −2 se tient sur son propre carré 16, mais il n’a pas fait le tour : il n’entre pas dans la maison. Un cheval ne peut entrer qu’après avoir fait le tour complet (acté).
- Un cheval peut s’arrêter sur le losange d’une autre couleur ; il y est un cheval ordinaire (R-12).
- Après un échange au Valet, la progression du cheval qui change de place est précisée en R-09 (G1, validé).

**Scénarios**
- R-02.1 — La progression compte les cases parcourues depuis la sortie
  ![R-02.1](docs/regles/R-02.1.webp)
- R-02.2 — Reculer de 4 depuis la sortie donne une progression de −4
  ![R-02.2](docs/regles/R-02.2.webp)
- R-02.3 — Un pion à −2 est sur sa case d’entrée : au compte exact, il entre dans sa maison
  ![R-02.3](docs/regles/R-02.3.webp)
- R-02.4 — Un pion bleu peut s’arrêter sur la case de sortie du jaune
  ![R-02.4](docs/regles/R-02.4.webp)

### R-03 Paquet, donnes et donneur

**Règle** — On joue avec un jeu de 52 cartes sans joker, mélangé. Les cartes sont distribuées en trois donnes successives : 5 cartes à chacun, puis 4, puis 4. Quand les 52 cartes sont distribuées, on rebat et le donneur change : il passe au joueur suivant dans le sens horaire.

**Cas limites**
- Le joueur qui commence chaque donne est celui qui suit le donneur dans le sens horaire (G9, validé). Le donneur reste le même pendant les trois donnes d’un paquet et ne change qu’au moment de rebattre (G9, validé).
- Le premier donneur est choisi au début de la partie ; il n’a aucune influence sur les équipes.
- La suite complète d’un paquet (les trois donnes jouées jusqu’au bout) est vérifiée par des tests automatiques sur des parties tirées au hasard ; les scénarios ci-dessous en vérifient chaque étape.

**Scénarios**
- R-03.1 — La première donne est de 5 cartes, le joueur après le donneur commence
  ![R-03.1](docs/regles/R-03.1.webp)
- R-03.2 — La deuxième donne est de 4 cartes, avec le même donneur
  ![R-03.2](docs/regles/R-03.2.webp)
- R-03.3 — La troisième donne est de 4 cartes, avec le même donneur
  ![R-03.3](docs/regles/R-03.3.webp)
- R-03.4 — Après la troisième donne on rebat et le donneur passe au suivant
  ![R-03.4](docs/regles/R-03.4.webp)
- R-03.5 — Les 52 cartes restent toutes présentes après la donne et l’échange
  ![R-03.5](docs/regles/R-03.5.webp)

### R-04 Échange de carte

**Règle** — À chaque donne, une fois sa main vue, chaque joueur choisit une carte et la passe face cachée à son partenaire. Quand les quatre ont choisi, les quatre cartes changent de main ensemble. Le jeu commence ensuite.

**Cas limites**
- L’échange a lieu à chaque donne (5, 4 et 4), pas seulement à la première (acté, D-04).
- Un joueur voit sa main avant de choisir (Q8, acté par RULE-03).
- L’échange a lieu même si la main du joueur semble injouable : la carte reçue peut la sauver, et une main vraiment injouable est posée après l’échange (Q6, acté par RULE-03).
- La carte échangée ne compte pas dans la taille de la donne : chacun garde 5 cartes (ou 4) après l’échange (Q7, validé).
- Rien ne bouge tant que les quatre n’ont pas choisi : le jeu indique seulement qui doit encore choisir (G8, validé).
- On ne peut donner qu’une carte qu’on a en main.
- La carte reçue est marquée dans la main du joueur jusqu’à ce qu’il la joue (D-21).

**Scénarios**
- R-04.1 — Trois choix ne suffisent pas : rien ne bouge avant le quatrième
  ![R-04.1](docs/regles/R-04.1.webp)
- R-04.2 — Au quatrième choix les quatre cartes changent de main ensemble
  ![R-04.2](docs/regles/R-04.2.webp)
- R-04.3 — Une main qui semble injouable échange quand même
  ![R-04.3](docs/regles/R-04.3.webp)
- R-04.4 — La carte reçue ne compte pas dans la taille de la donne
  ![R-04.4](docs/regles/R-04.4.webp)
- R-04.5 — On ne peut donner qu’une carte de sa main
  ![R-04.5](docs/regles/R-04.5.webp)

### R-05 Tour et obligation de jouer

**Règle** — On joue chacun son tour dans le sens horaire : bleu, jaune, rouge, vert, puis de nouveau bleu. À son tour, un joueur qui a une carte jouable doit en jouer une. Il ne peut pas poser sa main tant qu’une carte est jouable.

**Cas limites**
- Le sens horaire est acté (D-04).
- Jouer une carte jouable est obligatoire : il n’y a pas de défausse volontaire (Q20, acté par RULE-04).
- Un joueur dont la main est vide est sauté jusqu’à la donne suivante (G13, validé).
- Le jeu ne joue jamais à la place d’un joueur humain, même s’il n’a qu’un seul coup possible : il le met seulement en évidence (D-19).

**Scénarios**
- R-05.1 — Le tour passe dans le sens horaire : bleu, jaune, rouge, vert
  ![R-05.1](docs/regles/R-05.1.webp)
- R-05.2 — Quand une carte est jouable, poser sa main est interdit
  ![R-05.2](docs/regles/R-05.2.webp)
- R-05.3 — Un joueur sans carte est sauté
  ![R-05.3](docs/regles/R-05.3.webp)

### R-06 As et Roi

**Règle** — L’As sort un cheval de l’écurie sur son losange, ou avance un cheval de 1. Le Roi sort un cheval de l’écurie sur son losange, ou avance un cheval de 13. Quand les deux sont possibles, le joueur choisit. Sortir un cheval sur un losange occupé par un cheval d’une autre couleur mange ce cheval ; c’est impossible si son propre cheval est déjà sur le losange.

**Cas limites**
- S’il n’y a plus de cheval à l’écurie, l’As et le Roi ne servent qu’à avancer.
- Quand plusieurs chevaux sont à l’écurie, ils sont interchangeables : c’est le premier (le plus petit numéro) qui sort.
- Un cheval adverse ou du partenaire garé sur mon losange est mangé par ma sortie, puisqu’il n’y est pas protégé : seul le cheval de la couleur du losange y est protégé (Q13 acté par RULE-14, Q14 acté par RULE-13).
- Mon propre cheval sur mon losange bloque ma deuxième sortie : il faut d’abord le faire avancer (Q15, acté par RULE-14).

**Scénarios**
- R-06.1 — L’As sort un pion ou avance de 1 : les deux sont permis
  ![R-06.1](docs/regles/R-06.1.webp)
- R-06.2 — Le Roi sort un pion ou avance de 13
  ![R-06.2](docs/regles/R-06.2.webp)
- R-06.3 — Sans pion à l’écurie, l’As ne peut qu’avancer
  ![R-06.3](docs/regles/R-06.3.webp)
- R-06.4 — Sortir sur un adversaire garé sur ma sortie le mange
  ![R-06.4](docs/regles/R-06.4.webp)
- R-06.5 — Mon pion sur ma sortie m’empêche d’en sortir un second
  ![R-06.5](docs/regles/R-06.5.webp)

### R-07 Cartes à avancer

**Règle** — La Dame avance un cheval de 12. Le 10, le 9, le 8, le 6, le 5, le 3 et le 2 avancent un cheval du nombre indiqué. Le 5 ne fait avancer que les propres chevaux du joueur. On ne peut jamais s’arrêter sur un de ses propres chevaux.

**Cas limites**
- Le 5 est une règle maison : il ne fait pas avancer les chevaux des autres joueurs, partenaire compris (acté). Aucune autre carte ne déplace un cheval qui n’est pas à soi, sauf l’échange du Valet (G10, validé).
- S’arrêter sur un cheval adverse ou du partenaire le mange (R-11) ; passer par-dessus ne mange rien, sauf pour le 7 (R-10).
- Un cheval peut passer par-dessus d’autres chevaux, les siens compris, avec les cartes ordinaires : seul un cheval protégé sur son losange est infranchissable (R-12). Cette précision n’était pas dans la recherche ; Romain l’a validée (G11).
- Les chevaux entrent dans la maison au compte exact ; le détail est en R-13.

**Scénarios**
- R-07.1 — La Dame avance de 12
  ![R-07.1](docs/regles/R-07.1.webp)
- R-07.2 — Les cartes 10, 9, 8, 6, 3 et 2 avancent du nombre indiqué
  ![R-07.2](docs/regles/R-07.2.webp)
- R-07.3 — Le 5 ne fait avancer que mes propres pions
  ![R-07.3](docs/regles/R-07.3.webp)
- R-07.4 — On ne s’arrête jamais sur un de ses propres pions
  ![R-07.4](docs/regles/R-07.4.webp)
- R-07.5 — Un cheval passe par-dessus les autres sans les manger
  ![R-07.5](docs/regles/R-07.5.webp)

### R-08 Le 4

**Règle** — Le 4 fait reculer un cheval de 4 cases, y compris un cheval qui vient de sortir et se trouve sur son losange. On n’entre jamais dans sa maison en reculant.

**Cas limites**
- Reculer depuis la sortie est acté (D-04) : le cheval passe à la progression −4.
- Ne jamais entrer dans la maison en reculant, et devoir faire le tour complet, est acté (D-04).
- Un cheval qui recule et s’arrête sur un cheval adverse ou du partenaire le mange, comme avec toute autre carte (R-11).
- Un cheval protégé sur son losange est infranchissable, y compris pour un autre cheval de sa propre couleur qui voudrait reculer à travers lui (G4, validé).
- Un cheval à l’écurie ne peut pas reculer. Si aucun cheval ne peut reculer, le 4 est injouable.

**Scénarios**
- R-08.1 — Le 4 recule un pion qui vient de sortir
  ![R-08.1](docs/regles/R-08.1.webp)
- R-08.2 — Le 4 qui recule sur un adversaire le mange
  ![R-08.2](docs/regles/R-08.2.webp)
- R-08.3 — On n’entre jamais dans la maison en reculant
  ![R-08.3](docs/regles/R-08.3.webp)
- R-08.4 — Le 4 ne dépasse pas un pion protégé sur sa sortie
  ![R-08.4](docs/regles/R-08.4.webp)
- R-08.5 — Mon pion protégé sur ma sortie bloque aussi mon autre pion
  ![R-08.5](docs/regles/R-08.5.webp)
- R-08.6 — Un pion à l’écurie ne peut pas reculer : le 4 est injouable
  ![R-08.6](docs/regles/R-08.6.webp)

### R-09 Le Valet

**Règle** — Le Valet échange l’un de tes chevaux qui est sur le parcours avec un cheval d’un autre joueur, adversaire ou partenaire, qui est lui aussi sur le parcours : chacun se retrouve sur la case de l’autre. On ne peut pas échanger deux chevaux du même joueur, ni un cheval resté à l’écurie ou déjà rentré dans la maison, ni un cheval protégé sur sa sortie. Le Valet ne mange personne.

**Cas limites**
- Le Valet n’échange jamais deux chevaux du même joueur : c’est acté (D-04, RULE-09), à la place de l’hypothèse de départ de la recherche (Q10).
- Un cheval à l’écurie ou dans la maison n’est ni échangé ni visé (Q11, acté par RULE-09).
- Un cheval protégé sur sa sortie (R-12) ne peut pas être visé (Q12, acté par RULE-13). Mon propre cheval protégé sur ma sortie ne peut pas non plus servir de cheval à échanger (G6, validé).
- Sans cible possible, le Valet est injouable : le jeu l’indique et le reste de la main se joue (R-14).
- Après l’échange, chaque cheval est sur la case de l’autre. Sa progression (voir le vocabulaire) est recalculée d’après sa nouvelle case : un cheval qui avait déjà fait un tour de plus perd ce tour, un cheval qui arrive sur son carré 16 peut entrer dans sa maison (G1, validé). L’autre choix possible, garder ses tours déjà faits, est dessiné en R-09.9.
- Le Valet est la seule carte qui déplace un cheval qui n’est pas à soi (G10, validé).

**Scénarios**
- R-09.1 — Le Valet échange un de mes pions avec celui d’un adversaire
  ![R-09.1](docs/regles/R-09.1.webp)
- R-09.2 — Le Valet échange aussi avec le pion du partenaire
  ![R-09.2](docs/regles/R-09.2.webp)
- R-09.3 — Deux pions du même joueur ne s’échangent jamais
  ![R-09.3](docs/regles/R-09.3.webp)
- R-09.4 — Un pion à l’écurie ne s’échange pas
  ![R-09.4](docs/regles/R-09.4.webp)
- R-09.5 — Un pion rentré dans la maison ne s’échange pas
  ![R-09.5](docs/regles/R-09.5.webp)
- R-09.6 — Mon pion protégé sur ma sortie ne peut pas être échangé
  ![R-09.6](docs/regles/R-09.6.webp)
- R-09.7 — Sans cible, le Valet est injouable mais le reste de la main se joue
  ![R-09.7](docs/regles/R-09.7.webp)
- R-09.8 — Après l’échange, chaque pion prend la progression de sa nouvelle case (choix par défaut)
  ![R-09.8](docs/regles/R-09.8.webp)
- R-09.9 — Autre choix possible : chaque pion garde ses tours déjà faits (alternative de G1)
  ![R-09.9](docs/regles/R-09.9.webp)

### R-10 Le 7

**Règle** — Le 7 se répartit comme le joueur veut entre ses chevaux, sur un seul ou sur plusieurs, en pas séparés dont la somme fait exactement 7. Les pas se jouent l’un après l’autre, dans l’ordre choisi. Chaque cheval adverse ou du partenaire que le 7 dépasse ou sur lequel il s’arrête est mangé, au moment où l’attaquant passe sur sa case. Le 7 dépasse ses propres chevaux sans les manger, mais ne peut pas s’arrêter sur l’un d’eux, ni traverser un cheval protégé (R-12). Le 7 se joue en entier ou pas du tout : s’il est impossible de jouer les 7 pas, le 7 est injouable, même si une partie des pas serait possible.

**Cas limites**
- Dépasser ses propres chevaux sans les manger, jouer le 7 en entier ou pas du tout : c’est acté (D-04).
- Le 7 mange aussi le cheval du partenaire (Q23, acté par RULE-11).
- Les captures se font pas à pas : un cheval mangé retourne tout de suite à son écurie et sa case est libre pour la suite du plan. L’ordre des pas compte (R-10.11).
- Un plan est accepté ou refusé en entier : s’il est invalide, rien ne bouge (R-10.12).
- Le même cheval peut revenir plus d’une fois dans un plan, à des moments différents ; deux pas de suite du même cheval n’en font qu’un (G5, validé).
- Un pas du 7 qui arrive au compte exact dans la maison y entre, comme en R-13. Quand le 7 rentre le dernier cheval d’un joueur au milieu du plan, voir G12 en R-15.
- Pendant la construction du 7, l’écran propose seulement les pas qui permettent encore de finir à 7.

**Scénarios**
- R-10.1 — Les 7 pas sur un seul pion
  ![R-10.1](docs/regles/R-10.1.webp)
- R-10.2 — Le 7 réparti en 3 + 4 sur deux pions
  ![R-10.2](docs/regles/R-10.2.webp)
- R-10.3 — Le 7 réparti en 2 + 2 + 3 sur trois pions
  ![R-10.3](docs/regles/R-10.3.webp)
- R-10.4 — Le 7 mange un adversaire qu’il dépasse en chemin
  ![R-10.4](docs/regles/R-10.4.webp)
- R-10.5 — Le 7 mange un adversaire sur sa case d’arrivée
  ![R-10.5](docs/regles/R-10.5.webp)
- R-10.6 — Le 7 mange aussi le pion du partenaire qu’il dépasse
  ![R-10.6](docs/regles/R-10.6.webp)
- R-10.7 — Un seul 7 peut manger plusieurs pions, chacun à son passage
  ![R-10.7](docs/regles/R-10.7.webp)
- R-10.8 — Le 7 dépasse ses propres pions sans les manger
  ![R-10.8](docs/regles/R-10.8.webp)
- R-10.9 — Le 7 ne peut pas finir sur un de ses propres pions
  ![R-10.9](docs/regles/R-10.9.webp)
- R-10.10 — Un 7 qu’on ne peut pas jouer en entier est injouable, même en partie possible
  ![R-10.10](docs/regles/R-10.10.webp)
- R-10.11 — L’ordre compte : déplacer d’abord le pion de devant libère la place
  ![R-10.11](docs/regles/R-10.11.webp)
- R-10.12 — Un plan invalide est refusé en entier : rien ne bouge
  ![R-10.12](docs/regles/R-10.12.webp)
- R-10.13 — Le même pion peut revenir plus tard dans le plan du 7
  ![R-10.13](docs/regles/R-10.13.webp)

### R-11 Prise

**Règle** — Un cheval qui s’arrête sur un cheval adverse ou sur celui de son partenaire le mange : le cheval mangé retourne à son écurie et perd tous ses tours. Un cheval ne peut jamais s’arrêter sur un de ses propres chevaux. Passer par-dessus un cheval ne le mange pas, sauf avec le 7 (R-10).

**Cas limites**
- Le cheval du partenaire se mange comme un cheval adverse (Q23, acté par RULE-11 et RULE-12).
- Reculer de 4 et s’arrêter sur un cheval le mange aussi (R-08.2).
- Sortir de l’écurie sur un losange occupé par un cheval d’une autre couleur le mange (R-06, R-12).
- Un cheval protégé sur sa sortie ne se mange pas (R-12).
- Un cheval mangé retourne sur sa propre place à l’écurie, celle de son numéro.
- Le Valet n’est pas une prise : il échange (R-09).

**Scénarios**
- R-11.1 — S’arrêter sur un adversaire le mange
  ![R-11.1](docs/regles/R-11.1.webp)
- R-11.2 — S’arrêter sur le pion du partenaire le mange aussi
  ![R-11.2](docs/regles/R-11.2.webp)
- R-11.3 — On ne s’arrête jamais sur un de ses propres pions, même de loin
  ![R-11.3](docs/regles/R-11.3.webp)
- R-11.4 — Un pion mangé perd tous ses tours et retourne à l’écurie
  ![R-11.4](docs/regles/R-11.4.webp)

### R-12 Case de sortie protégée

**Règle** — Un cheval arrêté sur le losange de sa propre couleur est protégé : aucun cheval ne peut le dépasser, en avant, en arrière avec le 4 ou au milieu d’un 7, ni le manger, ni l’échanger avec le Valet. Cela vaut aussi pour les autres chevaux de sa propre couleur. Un cheval d’une autre couleur sur ce losange est un cheval ordinaire. Sortir un cheval sur son losange occupé par un cheval d’une autre couleur mange ce cheval ; c’est impossible si son propre cheval y est déjà.

**Cas limites**
- La protection ne vaut que pour la couleur du losange : c’est acté (D-04, RULE-13).
- Mon cheval sur ma sortie bloque ma deuxième sortie : il faut le faire avancer d’abord (Q15, acté par RULE-14).
- Un cheval protégé reste libre de bouger : dès qu’il quitte son losange, il n’est plus protégé.
- Un cheval qui s’arrête sur sa sortie après un tour de plus y est protégé comme au premier passage (G3, validé).
- Le cheval protégé bloque aussi les autres chevaux de sa propre couleur, pour le 4, le 7 et les cartes à avancer (G4, validé).
- Le cheval qui entre dans sa maison passe par le carré 16, avant le losange : l’entrée ne croise jamais son losange.

**Scénarios**
- R-12.1 — On ne dépasse pas un pion protégé sur sa sortie
  ![R-12.1](docs/regles/R-12.1.webp)
- R-12.2 — Reculer de 4 ne dépasse pas non plus un pion protégé
  ![R-12.2](docs/regles/R-12.2.webp)
- R-12.3 — Un pas du 7 ne traverse pas un pion protégé : le plan est refusé
  ![R-12.3](docs/regles/R-12.3.webp)
- R-12.4 — Le Valet ne peut pas viser un pion protégé sur sa sortie
  ![R-12.4](docs/regles/R-12.4.webp)
- R-12.5 — On ne peut pas manger un pion protégé en s’arrêtant sur lui
  ![R-12.5](docs/regles/R-12.5.webp)
- R-12.6 — Un adversaire garé sur ma sortie est mangé quand j’y sors un pion
  ![R-12.6](docs/regles/R-12.6.webp)
- R-12.7 — Mon pion sur ma sortie m’empêche d’en sortir un second
  ![R-12.7](docs/regles/R-12.7.webp)
- R-12.8 — Sur la sortie d’une autre couleur, un pion est un pion ordinaire : on le mange
  ![R-12.8](docs/regles/R-12.8.webp)
- R-12.9 — Un pion revenu sur sa sortie après un tour de plus est protégé aussi
  ![R-12.9](docs/regles/R-12.9.webp)
- R-12.10 — Mon pion protégé bloque aussi le passage de mes autres pions
  ![R-12.10](docs/regles/R-12.10.webp)

### R-13 Entrée dans la maison

**Règle** — Pour entrer dans sa maison, un cheval doit atteindre ou franchir son carré 16 en avançant, puis tomber au compte exact sur une case vide de sa maison : depuis le carré 16, 1 pas mène à la case 0 de la maison, 2 pas à la case 1, 3 pas à la case 2 et 4 pas à la case 3. Quand le compte tombe juste, l’entrée est obligatoire. Si le compte ne tombe pas juste (plus de 4 pas au-delà du carré 16, case visée occupée, cheval déjà rentré à sauter), le cheval n’entre pas : il dépasse son entrée et repart pour un tour, ce coup est permis. S’arrêter pile sur le carré 16 n’est pas entrer. Le tour complet n’est pas exigé : un cheval qui a reculé avec le 4, ou que le Valet a placé avant son carré 16, entre de la même façon (G14). On n’entre jamais en reculant. Un cheval déjà rentré peut encore avancer dans sa maison, au compte exact et sans sauter un autre cheval ; il ne ressort jamais de la maison.

**Cas limites**
- Compte exact jusqu’à une case vide, entrée obligatoire, avancer dans la maison : c’est acté (D-01, D-02, D-03, RULE-15).
- Le tour complet est obligatoire et on n’entre jamais en reculant : c’est acté (D-04). Un cheval qui a reculé depuis sa sortie est à la progression −4 et n’a pas fait le tour ; il passe devant le carré 16 sans entrer (R-13.12).
- La case 0 de la maison est la plus proche du carré 16, la case 3 la plus éloignée.
- Si la case visée est libre mais qu’un cheval déjà rentré se trouve sur le chemin, le cheval ne le saute pas et repart pour un tour, comme si la case était occupée (G2, validé).
- Un cheval qui rate sa maison continue sur le parcours, il peut manger ou être mangé comme n’importe quel cheval, et il retrouve le carré 16 un tour plus tard (R-13.15).
- Dans un 7, un pas qui arrive au compte exact entre dans la maison, avec les mêmes règles (R-13.3).

**Scénarios**
- R-13.1 — Au compte exact, le pion entre dans la case 0 de la maison
  ![R-13.1](docs/regles/R-13.1.webp)
- R-13.2 — Au compte exact, le pion entre dans la case 1 de la maison
  ![R-13.2](docs/regles/R-13.2.webp)
- R-13.3 — Un 7 joué en entier peut entrer dans la case 2 de la maison
  ![R-13.3](docs/regles/R-13.3.webp)
- R-13.4 — Au compte exact, le pion entre dans la case 3 de la maison
  ![R-13.4](docs/regles/R-13.4.webp)
- R-13.5 — Si le compte dépasse le fond de la maison, le pion repart pour un tour
  ![R-13.5](docs/regles/R-13.5.webp)
- R-13.6 — Si la case visée de la maison est occupée, le pion repart pour un tour
  ![R-13.6](docs/regles/R-13.6.webp)
- R-13.7 — Un pion déjà rentré ne se saute pas : le pion repart pour un tour
  ![R-13.7](docs/regles/R-13.7.webp)
- R-13.8 — Quand le compte tombe juste, l’entrée est obligatoire : pas de tour de plus
  ![R-13.8](docs/regles/R-13.8.webp)
- R-13.9 — Un pion rentré avance encore dans la maison, au compte exact
  ![R-13.9](docs/regles/R-13.9.webp)
- R-13.10 — Dans la maison, un pion ne saute pas un autre pion rentré
  ![R-13.10](docs/regles/R-13.10.webp)
- R-13.11 — Au fond de la maison, un pion ne peut pas aller plus loin
  ![R-13.11](docs/regles/R-13.11.webp)
- R-13.12 — Un pion qui a reculé de 4 entre dans sa maison au compte exact, sans avoir fait le tour
  ![R-13.12](docs/regles/R-13.12.webp)
- R-13.13 — Arriver pile sur le carré 16 ne fait pas entrer dans la maison
  ![R-13.13](docs/regles/R-13.13.webp)
- R-13.14 — Depuis le carré 16, le compte suivant fait entrer dans la maison
  ![R-13.14](docs/regles/R-13.14.webp)
- R-13.15 — Après un tour de plus, le pion entre au passage suivant
  ![R-13.15](docs/regles/R-13.15.webp)

### R-14 Main injouable

**Règle** — Si aucune carte de la main n’est jouable, le joueur pose toute sa main face visible sur le tapis et attend la donne suivante. Tant qu’une carte est jouable, il ne peut pas poser : une main en partie jouable se joue. Le joueur humain pose ses cartes avec le bouton « Poser mes cartes », les joueurs gérés par l’ordinateur posent tout seuls.

**Cas limites**
- Poser sa main est un geste du joueur, pas une décision automatique du jeu : c’est acté (D-20), à la place de l’hypothèse de départ de la recherche (Q21). Les ordinateurs, eux, posent sans bouton.
- La main posée reste visible sur le tapis jusqu’à la donne suivante, et ses cartes ne reviennent pas dans le jeu.
- Un joueur qui a posé (ou qui n’a plus de carte) est sauté jusqu’à la donne suivante (G13, validé).
- Quand les quatre mains sont posées ou vides, la donne se termine et la suivante commence (R-03). La partie ne peut donc pas rester bloquée.
- La raison pour laquelle une carte n’est pas jouable est donnée au joueur : aucun cheval ne peut jouer cette carte, aucun cheval à sortir, le Valet n’a pas de cible, le 7 ne peut pas être joué en entier, ou un cheval protégé bloque le passage.

**Scénarios**
- R-14.1 — Une main en partie jouable doit se jouer : on ne peut pas la poser
  ![R-14.1](docs/regles/R-14.1.webp)
- R-14.2 — Une main entièrement injouable est posée face visible
  ![R-14.2](docs/regles/R-14.2.webp)
- R-14.3 — Si les quatre mains sont injouables, la donne se termine et la suivante commence
  ![R-14.3](docs/regles/R-14.3.webp)
- R-14.4 — Le joueur qui a posé ses cartes est sauté jusqu’à la donne suivante
  ![R-14.4](docs/regles/R-14.4.webp)

### R-15 Joueur qui a fini

**Règle** — Quand les quatre chevaux d’un joueur sont rentrés, il continue de jouer ses cartes avec les chevaux de son partenaire, qui comptent alors comme les siens pour toutes les cartes : avancer, y compris avec le 5, sortir un cheval de l’écurie avec l’As ou le Roi, reculer avec le 4, répartir le 7, manger. Avec le Valet, il échange un cheval de son partenaire avec un cheval adverse (jamais deux chevaux de l’équipe). Tant qu’il lui reste un cheval à jouer, un joueur ne joue pas ceux de son partenaire.

**Cas limites**
- Les chevaux du partenaire comptent comme les siens pour toutes les cartes : c’est acté (RULE-17). Cela règle aussi le 5 (Q16) et ce qui compte comme « à soi » pour le Valet et les prises (Q17).
- Pour le Valet, le cheval du partenaire est « à soi » : la cible est donc un cheval adverse (G7, validé).
- Un joueur qui a fini garde sa place : il reçoit sa main, échange une carte avec son partenaire (Q6), et pose sa main si elle est injouable (R-14).
- Quand le 7 rentre le dernier cheval d’un joueur au milieu du plan, les pas qui restent peuvent se jouer avec les chevaux de son partenaire (G12, validé). L’autre choix possible, jouer tout le 7 avec les seuls chevaux contrôlés au début du tour, est dessiné en R-15.9.
- Si tous les chevaux du partenaire sont aussi rentrés, l’équipe a gagné (R-16).

**Scénarios**
- R-15.1 — Un joueur qui a fini avance un pion de son partenaire avec le 2
  ![R-15.1](docs/regles/R-15.1.webp)
- R-15.2 — Le 5 fait avancer les pions du partenaire quand on a fini
  ![R-15.2](docs/regles/R-15.2.webp)
- R-15.3 — Le 7 se répartit entre les pions du partenaire
  ![R-15.3](docs/regles/R-15.3.webp)
- R-15.4 — Le Valet échange un pion du partenaire avec un adversaire
  ![R-15.4](docs/regles/R-15.4.webp)
- R-15.5 — L’As sort un pion du partenaire de son écurie
  ![R-15.5](docs/regles/R-15.5.webp)
- R-15.6 — Un pion du partenaire joué par moi mange comme un de mes pions
  ![R-15.6](docs/regles/R-15.6.webp)
- R-15.7 — Tant qu’il me reste un pion à jouer, je ne joue pas ceux de mon partenaire
  ![R-15.7](docs/regles/R-15.7.webp)
- R-15.8 — Un 7 qui rentre mon dernier pion peut finir avec les pions du partenaire (choix par défaut)
  ![R-15.8](docs/regles/R-15.8.webp)
- R-15.9 — Autre choix possible : le 7 se joue entièrement avec les pions d’avant le tour (alternative de G12)
  ![R-15.9](docs/regles/R-15.9.webp)

### R-16 Fin de partie

**Règle** — L’équipe dont les huit chevaux sont rentrés gagne la partie, tout de suite : la victoire est vérifiée après chaque coup et passe avant tout le reste, sans attendre la fin du tour ni de la donne. Le huitième cheval peut être rentré par son propre joueur ou, si celui-ci a fini, par son partenaire.

**Cas limites**
- Sept chevaux rentrés ne suffisent pas, il en faut huit (Q24, acté par RULE-18).
- Quand le huitième cheval rentre au milieu d’un 7, les pas qui restent doivent encore pouvoir se jouer, sinon le plan est refusé comme tout 7 qu’on ne peut pas jouer en entier. En pratique, c’est un 7 joué en un seul pas jusqu’à la maison (R-16.3).
- Une fois la partie gagnée, plus aucun coup n’est permis : l’écran de fin s’affiche.

**Scénarios**
- R-16.1 — Le huitième pion rentré donne la victoire à l’équipe
  ![R-16.1](docs/regles/R-16.1.webp)
- R-16.2 — Avec sept pions rentrés, la partie continue
  ![R-16.2](docs/regles/R-16.2.webp)
- R-16.3 — Un 7 qui rentre le huitième pion donne aussi la victoire
  ![R-16.3](docs/regles/R-16.3.webp)
- R-16.4 — Le huitième pion peut être rentré par le partenaire qui a déjà fini
  ![R-16.4](docs/regles/R-16.4.webp)

## Décisions de Romain

Romain a relu ce document, les points ci-dessous et les images R-09.8, R-09.9, R-13.7 et R-10.13, puis l’a validé tel quel le 2026-10-13 : chaque point prend la valeur retenue indiquée. Aucune correction. Les scénarios R-09.9 et R-15.9 dessinent l’autre choix de G1 et de G12 : ils sont conservés comme repères et ne sont pas implémentés. Chaque valeur est une constante nommée dans `packages/engine/src/rules.ts`.

- **G1 — Progression d’un cheval après un échange au Valet.** Retenu : le cheval qui change de case prend la progression de sa nouvelle case (de 0 à 71 ; un cheval qui avait fait un tour de plus perd ce tour). Touche R-02, R-09, R-13 ; scénarios R-09.1, R-09.2, R-09.8, R-15.4. Le scénario R-09.9 (garder ses tours) n’est pas retenu.
- **G2 — Entrée bloquée par un cheval déjà rentré.** Retenu : le cheval ne le saute pas et repart pour un tour, comme si la case était occupée. Touche R-13 ; scénario R-13.7.
- **G3 — Cheval qui s’arrête sur sa sortie après un tour de plus.** Retenu : il est protégé comme au premier passage, la protection tient à la case et à la couleur, pas au tour. Touche R-12 ; scénario R-12.9.
- **G4 — Un cheval protégé bloque-t-il aussi ses propres chevaux ?** Retenu : oui, personne ne le dépasse, y compris son propre camp. Touche R-08, R-12 ; scénarios R-08.4, R-08.5, R-12.10.
- **G5 — Le même cheval deux fois dans un 7.** Retenu : un plan peut reprendre un cheval déjà déplacé plus tôt dans le même 7 ; deux pas de suite du même cheval n’en font qu’un. Touche R-10 ; scénario R-10.13.
- **G6 — Le Valet avec mon propre cheval protégé sur ma sortie.** Retenu : impossible, un cheval protégé ne s’échange pas, ni comme cible ni comme cheval joué. Touche R-09 ; scénario R-09.6.
- **G7 — Joueur qui a fini : ce qui compte comme « à soi » pour le Valet et les prises.** Retenu : les chevaux du partenaire sont à lui, le Valet échange un cheval du partenaire avec un cheval adverse et un cheval joué mange comme un cheval à soi. Touche R-09, R-15 ; scénarios R-15.4, R-15.6.
- **G8 — Échange de cartes simultané.** Retenu : les quatre joueurs choisissent, puis les quatre cartes changent de main ensemble. Touche R-04 ; scénarios R-04.1, R-04.2.
- **G9 — Qui commence chaque donne et quand le donneur change.** Retenu : le joueur après le donneur commence chaque donne ; le donneur reste le même pendant les trois donnes d’un paquet et change à chaque paquet (dans le sens horaire). Touche R-03 ; scénarios R-03.1 à R-03.4.
- **G10 — Quelle carte déplace un cheval qui n’est pas à soi.** Retenu : seul le Valet. Les autres cartes, le 5 compris, ne déplacent que les chevaux du joueur. Touche R-07, R-09 ; scénario R-07.3.
- **G11 — Passer par-dessus des chevaux avec les cartes ordinaires.** Retenu : on passe par-dessus tous les chevaux sans les manger ; seul un cheval protégé est infranchissable. Seul le 7 mange ce qu’il dépasse. Touche R-07, R-10 ; scénario R-07.5.
- **G12 — Le 7 qui rentre mon dernier cheval au milieu du plan.** Retenu : les pas qui restent peuvent se jouer avec les chevaux du partenaire. Touche R-10, R-15 ; scénario R-15.8. Le scénario R-15.9 (7 joué avec les seuls chevaux d’avant le tour) n’est pas retenu.
- **G13 — Un joueur qui n’a plus de carte est sauté jusqu’à la donne suivante.** Retenu : oui, le tour passe au suivant. Touche R-05, R-14 ; scénarios R-05.3, R-14.4.
- **Q7 — La carte échangée compte-t-elle dans les 5 cartes de la donne ?** Retenu : on compte avant l’échange ; comme chacun donne une carte et en reçoit une, la taille des mains ne change pas. Touche R-04 ; scénario R-04.4.
- **Q22 — La pause en cas de déconnexion vaut-elle pendant l’échange, la pose de main et les tours des ordinateurs ?** Retenu : oui, dans toutes les phases du jeu. Cela ne concerne que le jeu en réseau (phase 2) : aucun scénario de la phase 1.

## Décidé

Ces points ne sont plus à discuter : ils sont écrits plus haut sans réserve.

**Précisions de la discussion et rappels (D-01 à D-04)**
- D-01 : pour entrer dans sa maison, il faut le compte exact jusqu’à une case vide. Si le compte ne tombe pas juste, ou si la case est occupée, le cheval dépasse son entrée et repart pour un tour (R-13).
- D-02 : quand le compte permet d’entrer pile sur une case vide, l’entrée est obligatoire (R-13).
- D-03 : un cheval déjà rentré peut encore avancer dans sa maison, au compte exact et sans sauter un autre cheval (R-13).
- D-04 : sens horaire (R-05) ; entrée par le carré 16 (R-02, R-13) ; losange infranchissable seulement pour le cheval de sa couleur (R-12, Q14) ; le 4 peut reculer depuis la sortie mais jamais pour entrer dans la maison (R-08, Q2, Q18) ; tour complet obligatoire (R-02, R-13, Q3) ; le 7 dépasse ses propres chevaux (Q1) et se joue en entier ou pas du tout (R-10, Q19) ; échange de carte à chaque donne (R-04, Q5) ; le Valet n’échange pas deux chevaux du même joueur (R-09).

**Décidé autrement que l’hypothèse de la recherche**
- Q10, le Valet ne peut pas échanger deux chevaux du même joueur (RULE-09), alors que la recherche supposait que c’était permis.
- Q21, la main injouable du joueur humain est posée avec le bouton « Poser mes cartes », les ordinateurs la posent seuls (D-20), alors que la recherche supposait une pose automatique.
- Q29, le plateau tourne pour que le joueur humain soit en bas (D-05). Cela concerne l’écran, pas les règles.

**Déjà tranché par une exigence ou une décision**
- Q6, l’échange a lieu même si la main sera injouable, et aussi pour un joueur qui a fini (RULE-03).
- Q8, on voit sa main avant de choisir la carte à passer (RULE-03).
- Q9, la suite 5, 4, 4 puis on rebat, et le donneur change à chaque paquet (RULE-02). Qui commence chaque donne est validé (G9).
- Q11, un cheval à l’écurie ou dans la maison ne s’échange pas au Valet (RULE-09).
- Q12, un cheval protégé ne s’échange pas : sans autre cible, le Valet est injouable (RULE-09, RULE-13).
- Q13, sortir sur un cheval d’une autre couleur garé sur sa sortie le mange (RULE-14).
- Q14, seul le cheval de la couleur du losange y est protégé (RULE-13).
- Q15, mon cheval sur ma sortie bloque ma deuxième sortie (RULE-14).
- Q16, le 5 fait avancer les chevaux du partenaire quand on a fini (RULE-17).
- Q17, les chevaux du partenaire comptent comme les siens pour toutes les cartes (RULE-17).
- Q18, un cheval qui vient de sortir peut jouer le 4 (RULE-08).
- Q20, jouer une carte jouable est obligatoire (RULE-04).
- Q23, le 7 et les autres cartes mangent aussi le cheval du partenaire (RULE-11, RULE-12).
- Q24, la partie est gagnée dès que huit chevaux de l’équipe sont rentrés (RULE-18).
- Q25, chacun ne connaît que sa propre main et les cartes jouées sont publiques (RULE-19, phase 2).
- Q4 et Q26 à Q34 (déconnexion, réglages de table, bot de remplacement, discussion, comptes, langue) ne sont pas des règles de la phase 1 : la déconnexion est décidée dans PROJECT.md (pause, puis choix du créateur de la table), le reste est traité aux phases suivantes.
