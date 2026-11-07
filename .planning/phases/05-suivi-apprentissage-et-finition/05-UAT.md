---
status: testing
phase: 05-suivi-apprentissage-et-finition
source: [05-CONTEXT.md, 05-UI-SPEC.md, 05-04-SUMMARY.md]
started: 2026-11-07T08:42:05Z
updated: 2026-11-07T10:40:00Z
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

### 3. Faire les huit leçons
expected: |
  Ajouté par le plan 05-06. À faire après la prochaine mise en ligne, sur l’iPhone tenu en largeur et sur l’ordinateur. Tant que la page « Apprendre à jouer » n’existe pas (plan 05-08), ouvre la première leçon par son adresse : https://toc.romaindetroyat.workers.dev/#/apprendre/1
  1. La leçon s’ouvre sur l’écran de jeu, avec tes chevaux bleus en bas. Au-dessus du plateau, le guide (le logo de TOC dans un rond) parle dans une bulle crème ; le plateau est un peu plus petit qu’en partie pour lui laisser la place.
  2. « Suivant » passe les phrases d’explication (Entrée sur l’ordinateur). Ensuite, ce qu’il faut toucher est entouré d’un anneau crème qui pulse : une carte, un cheval, « Jouer », « Passer cette carte » ou une pastille du 7.
  3. Dans chaque leçon, fais exprès une erreur une fois : touche une autre carte (leçon 5 : l’autre cheval jaune ; leçon 6 : partage le 7 en 1 + 6 ; leçon 7 : le 9, puis le Roi). Rien ne se joue, le guide explique, l’anneau reste, et sa phrase revient au bout de 4 secondes.
  4. Chaque leçon finit par une petite planche « Bravo ! » avec un hennissement joyeux, « Revoir la leçon » et « Leçon suivante ». La dernière propose « Revoir les leçons » et « Jouer contre l’ordinateur ».
  5. « Leçon 3 sur 8 » (en haut à gauche sur l’iPhone, en bas à gauche sur l’ordinateur) ouvre « Les leçons » : les leçons faites sont cochées, une leçon s’y choisit, « Recommencer cette leçon » repart du début. Dans « Réglages », « Quitter les leçons » remplace « Abandonner la partie » ; le livre (ou R) ouvre les règles.
  6. Ce qu’on regarde : la bulle se lit-elle bien (deux lignes au plus sur l’iPhone) ? L’anneau crème se distingue-t-il de l’anneau orange des coups possibles ? La planche « Bravo ! » est-elle à son aise sur l’iPhone ? Le plateau plus petit pendant les leçons te va-t-il ?
  Réponds « approuvé », ou dis ce qui ne va pas, dans quelle leçon et sur quel appareil.
result: pending

### 4. Relire les phrases du guide
expected: |
  Ajouté par le plan 05-06. Les phrases du guide sont des brouillons (D-09), à toi de les relire avant qu’elles soient livrées. Le guide dit « tu ». Voici tout ce qu’il dit, leçon par leçon : ses phrases dans l’ordre, ce qu’il répond à une erreur, et le texte de la planche « Bravo ! ». Une seule phrase a été raccourcie par rapport à la maquette, la première de la leçon 7, pour tenir en deux lignes.

  **Leçon 1 : « Sortir un cheval »**
  - Phrase 1 (avec « Suivant ») : « Bienvenue ! Tu joues les chevaux bleus, en bas. Ton partenaire est en face : les rouges. »
  - Phrase 2 (avec « Suivant ») : « Le but : rentrer vos huit chevaux dans vos maisons avant l’autre équipe. »
  - Phrase 3 (l’As entouré) : « Tes chevaux attendent dans l’écurie. Pour en sortir un, il faut un As ou un Roi : touche l’As. »
  - Phrase 4 (« Jouer » entouré) : « Le trajet s’affiche. Touche « Jouer » pour sortir ton cheval. »
  - Si tu touches le 8 ou le 3 : « Pas celle-là : aucun de tes chevaux n’est dehors pour avancer. Touche l’As. »
  - « Bravo ! » : « Ton cheval est sur son losange. Tant qu’il ne bouge pas, personne ne peut le manger ni le dépasser. »

  **Leçon 2 : « Avancer »**
  - Phrase 1 (avec « Suivant ») : « Les cartes de 2 à 10 font avancer d’autant de cases, sauf le 4 et le 7. La Dame avance de 12. »
  - Phrase 2 (le 8 entouré) : « Touche le 8. »
  - Phrase 3 (« Jouer » entouré) : « Un seul cheval peut jouer le 8 : l’autre tomberait sur ton cheval, c’est interdit. Touche « Jouer ». »
  - Si tu touches la Dame ou le 5 : « Pas celle-là : ici, on essaie le 8. »
  - « Bravo ! » : « Tu passes par-dessus tous les chevaux, mais tu ne t’arrêtes jamais sur un des tiens. »

  **Leçon 3 : « Manger »**
  - Phrase 1 (le 8 entouré) : « Un cheval jaune est 8 cases devant toi. Touche le 8 pour t’arrêter pile sur lui. »
  - Phrase 2 (« Jouer » entouré) : « La croix montre le cheval qui sera mangé. Touche « Jouer ». »
  - Si tu touches le 3 ou le 10 : « Pas celle-là : il faut tomber pile sur le cheval jaune, 8 cases devant. Touche le 8. »
  - « Bravo ! » : « Mangé ! Il retourne à son écurie. Attention : le cheval de ton partenaire se mange aussi. »

  **Leçon 4 : « Le 4 recule »**
  - Phrase 1 (le 4 entouré) : « Le 4 fait reculer de 4 cases, même un cheval qui vient de sortir. Touche le 4. »
  - Phrase 2 (« Jouer » entouré) : « En reculant, ton cheval s’arrête sur le cheval vert et le mange. Touche « Jouer ». »
  - Si tu touches le 9 : « Pas celle-là : le cheval vert est derrière toi. Touche le 4. »
  - « Bravo ! » : « Bien joué ! Ton cheval est maintenant juste avant l’entrée de ta maison : il pourra rentrer sans refaire le tour. »

  **Leçon 5 : « Le Valet échange »**
  - Phrase 1 (le Valet entouré) : « Le Valet échange un de tes chevaux avec celui d’un autre joueur. Touche le Valet. »
  - Phrase 2 (ton cheval entouré) : « Touche d’abord ton cheval. »
  - Phrase 3 (le cheval jaune près de ta maison entouré) : « Puis le cheval à échanger : le jaune, tout près de ta maison. »
  - Phrase 4 (« Jouer » entouré) : « Les deux chevaux vont changer de place. Touche « Jouer ». »
  - Si tu touches le 6 : « Pas celle-là : touche le Valet. »
  - Si tu prends l’autre cheval jaune : « Pas celui-là : prends le jaune près de ta maison, ton cheval prendra sa place. »
  - « Bravo ! » : « Personne n’est mangé avec le Valet. On n’échange ni un cheval à l’écurie, ni un cheval rentré, ni celui qui vient de sortir. »

  **Leçon 6 : « Le 7 se partage »**
  - Phrase 1 (avec « Suivant ») : « Le 7 se partage entre tes chevaux : 7 pas en tout. Chaque adversaire dépassé avec le 7 est mangé ! »
  - Phrase 2 (le 7 entouré ; c’est aussi la réponse si tu touches le 2) : « Touche le 7. »
  - Phrase 3 (ton premier cheval, puis la pastille 3, entourés) : « Touche ton cheval juste derrière le jaune, puis 3 : il le dépassera. »
  - Phrase 4 (ton autre cheval, puis la pastille 4, entourés) : « Il reste 4 pas : touche ton autre cheval, puis 4. »
  - Phrase 5 (« Jouer » entouré) : « Les deux adversaires dépassés seront mangés. Touche « Jouer ». »
  - Si ton partage ne mange pas les deux adversaires, quand tu touches « Jouer » : « Ce partage ne mange pas les deux. Essaie 3 sur un cheval et 4 sur l’autre. »
  - « Bravo ! » : « Deux d’un coup ! Le 7 ne mange pas le cheval de ton partenaire qu’il dépasse, seulement s’il s’arrête dessus. »

  **Leçon 7 : « Rentrer à la maison »**
  - Phrase 1 (avec « Suivant ») : « Pour rentrer, tombe pile sur une des quatre cases de ta maison. Son entrée est le carré, juste devant toi. »
  - Phrase 2 (le 6 entouré) : « Avec le 6, ton cheval va tout au fond de sa maison. Touche le 6. »
  - Phrase 3 (« Jouer » entouré) : « Touche « Jouer ». »
  - Si tu touches le 9 : « Avec le 9, tu dépasserais ta maison et tu referais un tour. Touche le 6. »
  - Si tu touches le Roi : « Le Roi avancerait de 13, bien trop loin. Touche le 6. »
  - « Bravo ! » : « Il est rentré ! Les chevaux déjà rentrés se sautent : seule la case où tu tombes doit être vide. »

  **Leçon 8 : « L’échange de carte »**
  - Phrase 1 (avec « Suivant ») : « Au début de chaque donne, chacun passe une carte à son partenaire, sans la montrer. »
  - Phrase 2 (le Roi entouré) : « Ton partenaire n’a aucun cheval dehors : donne-lui ton Roi pour qu’il puisse sortir. »
  - Phrase 3 (« Passer cette carte » entouré) : « Touche « Passer cette carte ». »
  - Phrase 4, une fois les cartes passées (avec « Suivant ») : « Ton partenaire t’a passé un 7 : la carte reçue a le bord de sa couleur. »
  - Si tu choisis une autre carte : « Pas celle-là : sans As ni Roi, ton partenaire ne peut pas sortir. Donne-lui le Roi. »
  - « Bravo ! » : « Tu connais l’essentiel ! Le reste est dans « Règles », à tout moment de la partie. »

  Pour chaque leçon, dis ce qu’il faut changer : un mot, une tournure, une explication fausse ou peu claire, une erreur qu’il faudrait aussi expliquer. Chaque phrase doit rester courte (110 signes au plus, 160 pour la planche). Réponds « approuvé » si tout te va.
result: pending

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

[none yet]
