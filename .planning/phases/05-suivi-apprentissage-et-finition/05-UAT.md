---
status: testing
phase: 05-suivi-apprentissage-et-finition
source: [05-CONTEXT.md, 05-UI-SPEC.md, 05-04-SUMMARY.md]
started: 2026-11-07T08:42:05Z
updated: 2026-11-07T08:42:05Z
---

## Current Test

number: 1
name: "Relire le texte de la feuille « Règles »"
expected: |
  Lis le texte de la feuille « Règles du TOC », copié en entier dans le test 1 ci-dessous, et dis ce qu’il faut changer.
awaiting: user response

## Tests

Tous les tests se font sur https://toc.romaindetroyat.workers.dev après la mise en ligne de la phase 5, sur l’iPhone tenu en largeur et sur l’ordinateur. Les plans suivants de la phase ajoutent leurs tests ici.

Réponds « approuvé », ou dis ce qui n’a pas marché et sur quel appareil.

### 1. Relire le texte de la feuille « Règles »
expected: |
  Ajouté par le plan 05-04. Le texte de la feuille « Règles du TOC » est une réécriture courte de RULES.md (D-06) : c’est un brouillon, à toi de le relire avant qu’il soit livré. Voici tout ce que la feuille affiche, onglet par onglet, avec la légende de chaque image.

  **Onglet 1 : « Le but »**
  - On joue à quatre, en deux équipes de deux. Ton partenaire est en face de toi : Bleu avec Rouge, Jaune avec Vert.
  - Chacun a quatre chevaux. Le but : rentrer les huit chevaux de ton équipe dans leurs maisons, avant l’autre équipe. Dès que le huitième cheval rentre, l’équipe gagne.
  - On avance avec des cartes, pas avec des dés. Le parcours se fait dans le sens des aiguilles d’une montre.
  - Image R-01.1 : Bleu joue avec Rouge, Jaune avec Vert : les partenaires sont face à face.

  **Onglet 2 : « Les cartes »**
  - Chaque carte a son effet. Les couleurs des cartes ne comptent pas.
  La liste des cartes :
  - As : Sort un cheval de l’écurie, ou avance de 1.
  - Roi : Sort un cheval de l’écurie, ou avance de 13.
  - Dame : Avance de 12.
  - Valet : Échange un de tes chevaux avec celui d’un autre joueur. Voir « Le Valet ».
  - 10, 9, 8, 6, 5, 3 et 2 : Avance d’autant de cases.
  - 7 : Se partage entre tes chevaux, 7 pas en tout, et mange les adversaires dépassés. Voir « Le 7 ».
  - 4 : Recule de 4, même un cheval qui vient de sortir.
  - Image R-07.1 : La Dame avance de 12.
  - Image R-08.1 : Le 4 fait reculer un cheval qui vient de sortir.

  **Onglet 3 : « Une donne »**
  - Les 52 cartes sont distribuées en trois donnes : 5 cartes chacun, puis 4, puis 4. Ensuite on rebat, et le donneur passe au joueur suivant. Le joueur après le donneur commence.
  - Au début de chaque donne, chacun choisit une carte et la passe à son partenaire, sans la montrer. Les quatre cartes changent de main en même temps. La carte reçue a le bord de la couleur de ton partenaire.
  - À ton tour, tu joues une carte. Si une carte peut jouer, tu dois la jouer. Si aucune ne peut, tu poses ta main et tu attends la donne suivante.
  - Image R-04.2 : Quand les quatre ont choisi, les cartes changent de main ensemble.
  - Image R-14.2 : Aucune carte jouable : la main est posée face visible.

  **Onglet 4 : « Sortir un cheval »**
  - Tes chevaux commencent dans l’écurie. L’As ou le Roi en sort un sur son losange, la case de sortie à côté de l’écurie. Avec ces cartes, tu peux aussi avancer : de 1 avec l’As, de 13 avec le Roi.
  - Un cheval qui vient de sortir est protégé sur son losange tant qu’il ne bouge pas : personne ne peut le manger, l’échanger ni le dépasser, pas même tes autres chevaux.
  - Un cheval qui revient plus tard sur son losange n’y est plus protégé. Tant que ton cheval est sur ton losange, tu ne peux pas en sortir un autre. Sortir sur un cheval d’une autre couleur le mange.
  - Image R-06.1 : L’As sort un cheval, ou avance de 1.
  - Image R-12.1 : Personne ne dépasse un cheval qui vient de sortir sur son losange.

  **Onglet 5 : « Le 7 »**
  - Le 7 se partage entre tes chevaux : 7 pas en tout, sur un seul cheval ou sur plusieurs, par exemple 3 + 4.
  - Chaque adversaire que tu dépasses avec le 7 est mangé, au moment où tu passes. Le 7 dépasse tes chevaux et ceux de ton partenaire sans les manger. S’il s’arrête sur un cheval, adversaire ou partenaire, il le mange.
  - Le 7 se joue en entier ou pas du tout. Le jeu te propose seulement les pas qui permettent de finir à 7.
  - Image R-10.2 : Le 7 partagé en 3 + 4 sur deux chevaux.
  - Image R-10.4 : Le 7 mange l’adversaire qu’il dépasse.

  **Onglet 6 : « Le Valet »**
  - Le Valet échange un de tes chevaux avec celui d’un autre joueur, adversaire ou partenaire : chacun prend la place de l’autre. Personne n’est mangé.
  - On ne peut pas échanger deux chevaux du même joueur, ni un cheval à l’écurie, ni un cheval rentré, ni un cheval protégé sur son losange. Sans échange possible, le Valet ne se joue pas.
  - Image R-09.1 : Le Valet échange un de tes chevaux avec celui d’un adversaire.

  **Onglet 7 : « Manger »**
  - Un cheval qui s’arrête sur un autre cheval le mange, même celui de ton partenaire. Le cheval mangé retourne à son écurie.
  - Tu ne peux jamais t’arrêter sur un de tes chevaux. Passer par-dessus un cheval ne le mange pas, sauf un adversaire dépassé par le 7.
  - Image R-11.1 : S’arrêter sur un adversaire le mange.

  **Onglet 8 : « Rentrer à la maison »**
  - Ta maison a quatre cases. On y entre par le carré, deux cases avant ton losange : 1 pas après le carré mène à la première case, 4 pas à la dernière.
  - Il faut le compte exact, sur une case vide. Les chevaux déjà rentrés se sautent. Si le compte dépasse ou si la case est prise, le cheval continue et refait un tour.
  - Quand le compte tombe juste, il faut entrer. On n’entre jamais en reculant. Un cheval rentré peut encore avancer dans sa maison, au compte exact.
  - Image R-13.1 : Au compte exact, le cheval entre dans sa maison.
  - Image R-13.5 : Si le compte dépasse le fond de la maison, le cheval refait un tour.

  **Onglet 9 : « Quand tu as fini »**
  - Quand tes quatre chevaux sont rentrés, tu continues avec ceux de ton partenaire : toutes tes cartes les font jouer comme les tiens. Tant qu’il te reste un cheval à jouer, tu ne joues pas les siens.
  - Image R-15.1 : Quand tes quatre chevaux sont rentrés, tu joues ceux de ton partenaire.

  **Onglet 10 : « Règles de la maison »**
  _Ce qui change par rapport au TOC qu’on trouve ailleurs._
  - Pas besoin de faire le tour complet : un cheval qui atteint son carré en avançant, après un 4 ou un Valet, peut rentrer.
  - Le 7 ne mange pas le cheval du partenaire qu’il dépasse, seulement celui sur lequel il s’arrête.
  - Seul le cheval qui vient de sortir est protégé sur son losange.
  - Les chevaux déjà rentrés se sautent pour entrer dans la maison.
  - La carte qui peut faire rentrer un cheval pile le fait rentrer ; une autre carte peut lui faire refaire un tour.
  - Le 4 recule même un cheval qui vient de sortir.
  - Seul le Valet déplace un cheval qui n’est pas à toi ; le 5 n’avance que tes chevaux.
  - Image R-13.12 : Après avoir reculé de 4, le cheval entre sans refaire le tour.

  Pour chaque onglet, dis ce qu’il faut changer : un mot ou une tournure qui ne te plaît pas, une règle mal dite (ou dite autrement que vous la jouez), un cas qui manque. Réponds « approuvé » si tout te va.
result: pending

### 2. Les règles pendant une partie
expected: |
  Ajouté par le plan 05-04. À faire après la prochaine mise en ligne, sur l’iPhone tenu en largeur et sur l’ordinateur.
  1. Dans une partie contre l’ordinateur, touche le livre (sur l’iPhone : à droite, sous la roue des Réglages ; sur l’ordinateur : en bas à gauche, sous « Nous » et « Eux »), ou appuie sur R sur l’ordinateur. La fenêtre « Règles du TOC » s’ouvre sur « Les cartes ».
  2. Choisis d’abord une carte de ta main (le Valet par exemple), puis ouvre les règles : la ligne de cette carte est entourée de crème. Rien ne s’affiche sous ta main.
  3. Touche « Voir « Le Valet » » : l’onglet « Le Valet » s’ouvre, avec son image dessinée sur le plateau. Parcours les dix onglets ; sur l’ordinateur, les flèches, Début et Fin passent d’un onglet à l’autre.
  4. Contre l’ordinateur, pendant que la fenêtre est ouverte, personne ne joue ; les ordinateurs reprennent quand tu la fermes (la croix, Échap ou R).
  5. En ligne, ouvre les règles pendant que les autres jouent : la partie continue derrière. Quand ton tour arrive, la fenêtre affiche « C’est à toi de jouer. » avec « Revenir à la partie », sans se fermer toute seule.
  6. Les images sont-elles lisibles sur l’iPhone ? Les chevaux et leurs formes se reconnaissent-ils assez ?
  Réponds « approuvé », ou dis ce qui ne va pas et sur quel appareil.
result: pending

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

[none yet]
