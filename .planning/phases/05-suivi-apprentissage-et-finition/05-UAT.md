---
status: testing
phase: 05-suivi-apprentissage-et-finition
source: [05-CONTEXT.md, 05-UI-SPEC.md, 05-RESEARCH.md, 05-01-SUMMARY.md, 05-02-SUMMARY.md, 05-03-SUMMARY.md, 05-04-SUMMARY.md, 05-05-SUMMARY.md, 05-06-SUMMARY.md, 05-07-SUMMARY.md, 05-08-SUMMARY.md, 05-09-SUMMARY.md, 05-10-SUMMARY.md, 05-11-SUMMARY.md]
started: 2026-11-07T08:42:05Z
updated: 2026-11-07T16:58:57Z
---

## Current Test

number: 1
name: "Tes parties dans « Mes résultats »"
expected: |
  Juste après la mise en ligne : joue une partie en ligne avec un proche qui a un compte, une personne sans compte et un ordinateur, puis ouvrez « Mes résultats » sur vos deux appareils (test 1 ci-dessous).
awaiting: user response

## Tests

Tous les tests se font sur https://toc.romaindetroyat.workers.dev après la mise en ligne de la phase 5 (test 14), sur l’iPhone tenu en largeur (dans l’application installée) et sur l’ordinateur. Pour les tests à plusieurs, il faut ton compte et celui d’un proche qui est dans tes amis.

Le point d’arrêt de la phase (ce que seuls tes appareils et ton œil peuvent montrer) suit ces étapes, dans cet ordre :
1. Une partie en ligne avec un proche qui a un compte et une personne sans compte, puis « Mes résultats » chez vous deux (tests 1 à 3).
2. Une partie contre l’ordinateur en mode avion, la ligne de la planche, le retour du réseau, l’historique (test 4).
3. Dans une partie, les « Règles » avec le livre : « Les cartes » et « Le 7 », les ordinateurs qui attendent (test 5).
4. Les huit leçons depuis « Apprendre », avec une erreur exprès dans chacune (test 6), et « Première fois ? » sur un téléphone neuf de la famille (test 7).
5. Les formes sur les chevaux et les marques des écuries, à bout de bras, éteintes puis rallumées (test 8).
6. VoiceOver : l’accueil, les règles, une leçon, les noms des chevaux éclairés (test 9), et TalkBack si la famille a un Android (test 10).
7. La relecture des textes : la feuille « Règles » et les phrases du guide (tests 11 et 12).

Ensuite, les questions « À confirmer » (tests 15 à 46) : des choix faits pour toi, qui restent tels quels si tu ne dis rien.

Réponds « approuvé », ou dis ce qui n’a pas marché et sur quel appareil.

### 1. Tes parties dans « Mes résultats »
expected: |
  Ajouté par le plan 05-11. Sur l’iPhone, avec ton compte.
  1. Crée une table en ligne. Un proche qui a un compte (et qui est dans tes amis) s’assoit avec le sien, une personne sans compte s’assoit avec son prénom seulement (par exemple « Mamie »), et la dernière place est un ordinateur (par exemple Pur-sang). Jouez la partie jusqu’au bout.
  2. Sur l’accueil, touche la petite tuile « Mes résultats » (« Parties et classement »). La page s’ouvre sur « Historique ». La partie est en haut, avec « Victoire » ou « Défaite », le score de chevaux rentrés de ton équipe d’abord (par exemple « Victoire · 8 – 5 »), puis « Avec … · contre … » : ton proche par son pseudo, la personne sans compte écrite « Mamie (sans compte) », l’ordinateur par sa force (« Pur-sang »), jamais par son nom de cheval. Dessous, la date, l’heure et « en ligne ».
  3. Touche la ligne : la fiche « Partie du … » s’ouvre. Elle dit « En ligne, à la table de … », « Victoire de ton équipe » ou « Défaite de ton équipe », les deux équipes avec « toi », « Mamie » suivi de « (sans compte) » et « Pur-sang (ordinateur) », l’heure de début et de fin avec la durée, les donnes jouées, les chevaux rentrés et mangés de chaque équipe, et « Cette partie compte pour le classement entre amis. » (deux joueurs avec un compte). « Fermer » ou Échap la ferme.
  4. Ton proche ouvre « Mes résultats » sur son appareil : la même partie est là, vue de son côté (son équipe d’abord, avec son résultat).
  5. Sous la liste, la ligne « Les parties comptent depuis novembre 2026. » rappelle que les parties d’avant la phase 5 ne sont pas reprises. Avec plus de 20 parties, « Voir les parties plus anciennes » charge la suite.
  6. Sur l’ordinateur, la même page : la liste à droite, la navigation à gauche. Rien ne déborde, rien ne défile de côté.
  Réponds « approuvé », ou dis ce qui ne va pas et sur quel appareil.
result: pending

### 2. Tes chiffres
expected: |
  Ajouté par le plan 05-11. Après quelques parties, en ligne et contre l’ordinateur.
  1. Dans « Mes résultats », touche « Mes chiffres ». Trois nombres en grand : « Parties », « Victoires » et « Réussite » (en pourcentage).
  2. Le filtre « Toutes », « En ligne », « Contre l’ordinateur » change les chiffres : « En ligne » ne compte que les tables en ligne, « Contre l’ordinateur » que les parties solo. Une partie solo jouée avec ton compte y est.
  3. « Chevaux » : « Mangés par toi », « Mangés à toi » et « Rentrés par toi ».
  4. « Avec mes partenaires » : tes résultats avec chaque partenaire, huit au plus, puis « Voir tous mes partenaires ». Toutes les personnes sans compte sont regroupées sous « Joueurs sans compte » ; un ordinateur partenaire s’écrit « Pur-sang (ordinateur) ».
  5. « Contre l’ordinateur, par force » : tes résultats selon la force de l’adversaire le plus fort.
  Les chiffres te semblent-ils justes, d’après ce que tu as joué ? Réponds « approuvé », ou dis ce qui ne va pas.
result: pending

### 3. Le classement entre amis
expected: |
  Ajouté par le plan 05-11.
  1. Dans « Mes résultats », touche « Classement ». En haut : « Entre toi et tes amis, sur les parties en ligne jouées avec au moins un autre joueur qui a un compte. »
  2. Avant 5 parties classées, tu es sous « Pas encore au classement », avec « 1 partie sur 5 », « 2 parties sur 5 »… Après la cinquième, tu entres au classement : ton rang (« 1er », « 2e »…), ton pseudo avec « toi », « {n} parties · {v} victoires » et ton pourcentage. Ta ligne est entourée de crème.
  3. Les parties contre l’ordinateur seul n’y comptent pas : une partie solo de plus ne change pas ton classement (elle compte dans « Mes chiffres »). Une partie en ligne avec un seul compte non plus.
  4. Touche « Comment ça marche ? » : la fenêtre « Le classement » explique les trois règles en trois paragraphes. « Fermer » la ferme.
  5. Sans ami sur TOC, le panneau dit « Pas encore d’amis sur TOC » avec « Mes amis ».
  Réponds « approuvé », ou dis ce qui ne va pas.
result: pending

### 4. Une partie contre l’ordinateur sans réseau
expected: |
  Ajouté par le plan 05-11. Sur l’iPhone, dans l’application installée, avec ton compte.
  1. Mets l’iPhone en mode avion. Ouvre TOC depuis son icône et lance « Jouer contre l’ordinateur ». Joue la partie jusqu’au bout (au moins une minute).
  2. Sur la planche de fin, sous les chiffres, la ligne dit « Pas de connexion : la partie sera ajoutée à tes résultats au retour du réseau. »
  3. Quitte le mode avion et reviens à l’accueil (ou rouvre TOC). Sans rien toucher d’autre, la partie est envoyée.
  4. Ouvre « Mes résultats » : la partie est dans « Historique » avec « contre l’ordinateur ». Sa fiche dit « Partie contre l’ordinateur : elle compte dans tes chiffres, pas au classement. » Elle est comptée dans « Mes chiffres » (filtre « Contre l’ordinateur »), et le « Classement » n’a pas bougé.
  5. Une autre partie solo jouée avec le réseau : la planche dit tout de suite « Partie ajoutée à tes résultats. » Sans compte, la planche n’a pas de ligne.
  Réponds « approuvé », ou dis ce qui ne va pas.
result: pending

### 5. Les règles pendant une partie
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

### 6. Faire les huit leçons
expected: |
  Ajouté par le plan 05-06, mis à jour par le plan 05-11 (la page « Apprendre à jouer » existe depuis le plan 05-08). Sur l’iPhone tenu en largeur et sur l’ordinateur.
  1. Sur l’accueil, touche la petite tuile « Apprendre » : la page « Apprendre à jouer » liste les huit leçons. Touche « Commencer ». La leçon s’ouvre sur l’écran de jeu, avec tes chevaux bleus en bas. Au-dessus du plateau, le guide (le logo de TOC dans un rond) parle dans une bulle crème ; le plateau est un peu plus petit qu’en partie pour lui laisser la place.
  2. « Suivant » passe les phrases d’explication (Entrée sur l’ordinateur). Ensuite, ce qu’il faut toucher est entouré d’un anneau crème qui pulse : une carte, un cheval, « Jouer », « Passer cette carte » ou une pastille du 7.
  3. Dans chaque leçon, fais exprès une erreur une fois : touche une autre carte (leçon 5 : l’autre cheval jaune ; leçon 6 : partage le 7 en 1 + 6 ; leçon 7 : le 9, puis le Roi). Rien ne se joue, le guide explique, l’anneau reste, et sa phrase revient au bout de 4 secondes.
  4. Chaque leçon finit par une petite planche « Bravo ! » avec un hennissement joyeux, « Revoir la leçon » et « Leçon suivante ». La dernière propose « Revoir les leçons » et « Jouer contre l’ordinateur ».
  5. « Leçon 3 sur 8 » (en haut à gauche sur l’iPhone, en bas à gauche sur l’ordinateur) ouvre « Les leçons » : les leçons faites sont cochées, une leçon s’y choisit, « Recommencer cette leçon » repart du début. Dans « Réglages », « Quitter les leçons » remplace « Abandonner la partie » et ramène, sans question, à la page « Apprendre à jouer », où les leçons faites restent cochées ; le livre (ou R) ouvre les règles.
  6. Sur la page « Apprendre à jouer », le bouton suit tes progrès : « Commencer », puis « Continuer : leçon {n} », puis, toutes faites, « Jouer contre l’ordinateur » avec « Revoir depuis le début ».
  7. Ce qu’on regarde : la bulle se lit-elle bien (deux lignes au plus sur l’iPhone) ? L’anneau crème se distingue-t-il de l’anneau orange des coups possibles ? La planche « Bravo ! » est-elle à son aise sur l’iPhone ? Le plateau plus petit pendant les leçons te va-t-il ?
  Réponds « approuvé », ou dis ce qui ne va pas, dans quelle leçon et sur quel appareil.
result: pending

### 7. La première fois
expected: |
  Ajouté par le plan 05-11. Sur un téléphone de la famille où TOC n’a jamais été ouvert (ou sur l’ordinateur, dans une fenêtre de navigation privée).
  1. Ouvre https://toc.romaindetroyat.workers.dev : la fenêtre « Première fois ? » s’ouvre sur l’accueil : « Apprends à jouer en jouant : huit petites leçons, avec un guide qui te montre quoi toucher. », avec « Apprendre en 10 minutes » et « Plus tard ».
  2. « Apprendre en 10 minutes » ouvre la leçon 1. « Plus tard » (ou Échap) la ferme : elle ne revient plus jamais sur cet appareil, et les leçons restent dans la tuile « Apprendre » de l’accueil.
  3. Sur ton iPhone, où tu as déjà un prénom, un compte et des parties, elle ne s’ouvre pas.
  4. Depuis ce téléphone neuf, ouvre le lien d’une de tes tables et prends une place : la salle d’attente affiche « Première fois ? Lis les règles en attendant. » avec « Règles du jeu », qui ouvre les règles sur « Le but ».
  Réponds « approuvé », ou dis ce qui ne va pas et sur quel appareil.
result: pending

### 8. Les formes sur les chevaux
expected: |
  Ajouté par le plan 05-11. Sur l’iPhone tenu en largeur, à bout de bras, puis sur l’ordinateur.
  1. Dans une partie contre l’ordinateur, regarde les chevaux : chacun porte sur son socle un petit rond crème avec la forme de sa couleur : un rond pour Bleu, un triangle pour Jaune, un carré pour Rouge, une étoile pour Vert. Chaque écurie a la même marque à côté d’elle.
  2. À bout de bras, reconnais-tu la couleur de chaque cheval par sa forme seule ? Regarde surtout le triangle jaune, et les chevaux qui se croisent sur une même zone.
  3. Dans « Réglages », éteins « Formes sur les chevaux » : les formes disparaissent des chevaux, les marques des écuries restent. Rallume-les : elles reviennent. Le réglage est gardé quand tu rouvres TOC.
  4. Les formes se voient aussi dans les images de la feuille « Règles » et dans les leçons.
  Réponds « approuvé », ou dis ce qui ne va pas et sur quel appareil.
result: pending

### 9. VoiceOver sur l’iPhone
expected: |
  Ajouté par le plan 05-11. Sur l’iPhone : Réglages de l’iPhone → Accessibilité → VoiceOver, allumé (un triple clic sur le bouton latéral peut servir de raccourci si tu l’as réglé). Un geste du doigt vers la droite passe à l’élément suivant, un double tap l’active.
  1. L’accueil : VoiceOver lit tout en français, dans l’ordre de l’écran. Les petites tuiles se lisent avec leurs mots affichés, par exemple « Règles : les cartes, le 7, la maison », « Mes résultats : parties et classement ».
  2. Les règles : ouvre la feuille « Règles du TOC ». Le titre, les onglets et le texte se lisent ; les images se lisent par leur légende.
  3. Une leçon : la bulle du guide est lue quand elle change ; la carte ou le cheval à toucher porte son nom.
  4. Les chevaux éclairés : dans une partie, choisis une carte ; chaque cheval qui peut jouer se lit en entier, par exemple « Cheval rouge C, à ton partenaire Marie, à l’écurie ».
  5. Une ligne de l’historique se lit dans l’ordre de l’écran, par exemple « Victoire · 8 – 5, Avec Marie · contre Paul, 6 nov., 21 h 14, en ligne ».
  Pense à éteindre VoiceOver après. Réponds « approuvé », ou dis ce qui est mal lu, ou pas lu du tout, et où.
result: pending

### 10. TalkBack sur Android
expected: |
  Ajouté par le plan 05-11. Seulement si la famille a un téléphone Android : Paramètres → Accessibilité → TalkBack, allumé. Les mêmes étapes que le test 9 (l’accueil, les règles, une leçon, les chevaux éclairés, une ligne de l’historique). Sans Android dans la famille, réponds « passé ».
  Réponds « approuvé », « passé », ou dis ce qui est mal lu et où.
result: pending

### 11. Relire le texte de la feuille « Règles »
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

### 12. Relire les phrases du guide
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

### 13. Le budget de l’offre gratuite de Cloudflare
expected: |
  Ajouté par le plan 05-11. À lire, rien à faire tout de suite. Les résultats de la phase 5 écrivent très peu de lignes dans la base D1 ; ce qui grandit avec le temps, ce sont les lignes lues par « Mes chiffres » et surtout par le classement. Les repères mesurés (plans 05-01 et 05-05) :
  - une partie en ligne terminée écrit 5 lignes, plus 1 par joueur qui a un compte (7 avec deux comptes, 9 avec quatre ; 3 de ces lignes étaient déjà écrites avant la phase 5) ; la même partie écrite une deuxième fois (une nouvelle tentative) : 0 ;
  - une partie contre l’ordinateur envoyée par ton compte : 3 lignes écrites, 5 lues ; renvoyée : 0 écrite ;
  - une page de l’historique (20 parties) : 44 lignes lues ;
  - « Mes chiffres » : environ 2 lignes lues par partie que tu as jouée (102 pour 50 parties) ;
  - le classement : environ 2 lignes lues par partie jouée par chaque joueur du cercle, toi et tes amis (214 pour un cercle de 11 avec 90 places jouées).

  L’estimation : une famille de 20 personnes, 2 appareils chacune, et par personne et par jour 3 parties en ligne (deux comptes par table, le cas qui écrit le plus), 2 parties contre l’ordinateur et 10 ouvertures de « Mes résultats ». Chacun a les 19 autres dans ses amis, donc chaque classement relit les parties des 20.

  | Ce qui compte | Par jour (estimation) | Limite gratuite par jour | Part |
  |---------------|------------------------|--------------------------|------|
  | Lignes écrites (phase 4 comprise) | environ 580 | 100 000 | 0,6 % |
  | Lignes lues le premier jour, chaque ouverture allant dans les trois onglets | environ 63 000 | 5 000 000 | 1,3 % |
  | Lignes lues après un mois, de même | environ 1,3 million | 5 000 000 | 26 % |
  | Lignes lues après un an, de même | environ 15 millions | 5 000 000 | 300 % (limite atteinte vers le quatrième mois) |
  | Lignes lues après un an, si chacun n’ouvre « Mes chiffres » et le classement qu’une fois par jour | environ 1,6 million | 5 000 000 | 31 % (limite atteinte vers la troisième année) |

  Les lignes écrites ne poseront jamais de problème. Les lignes lues peuvent en poser un, parce que le classement relit toutes les parties du cercle à chaque ouverture. Au-delà de la limite, les pages de résultats ne se chargeraient plus jusqu’au lendemain. Si ça arrive, deux solutions : l’offre payante à 5 $ par mois (bien plus de lignes lues, des milliards par mois ; à revérifier sur la page des prix de Cloudflare), ou une petite amélioration à planifier quand tu veux : garder pour chaque joueur son nombre de parties et de victoires, pour que le classement ne relise plus tout. Pour une famille qui regarde le classement quelques fois par jour, cela tient des années. Dis si ça te va.
result: pending

### 14. La mise en ligne
expected: |
  À remplir par l’orchestrateur après la mise en ligne. Rien à faire pour toi, sauf vérifier que tout marche.
  - Version en ligne : (le commit et l’identifiant de version de Cloudflare, à remplir).
  - Base D1 : la migration 0003 (les résultats : les tables played et game_seats) appliquée sur la base en ligne avant la mise en ligne du nouveau Worker (la sortie de la commande, à remplir). 0001 et 0002 l’étaient déjà.
  - Durable Objects : aucune migration nouvelle ; v1 (les tables) et v2 (l’objet de chaque compte) sont inchangées. Aucun secret nouveau.
  - Contrôle après la mise en ligne (tools/smoke-online.mjs) : (la sortie, à remplir). Il vérifie aussi que, sans cookie, « Mes résultats », « Mes chiffres » et le classement répondent 401, et qu’un rapport de partie solo venu d’un autre site est refusé (403).
  - Retour en arrière possible : le Worker de la phase 4 ignore les deux tables nouvelles.
result: pending

### 15. À confirmer : les formes sur les chevaux
expected: |
  Choix fait (05-UI-SPEC « À confirmer » 1 ; déjà décidé par toi : D-11 et D-14) : chaque cheval porte sur son socle un petit rond crème avec la forme de sa place (rond bleu, triangle jaune, carré rouge, étoile verte), et chaque écurie a la même marque à côté d’elle. Les formes sont allumées par défaut ; l’interrupteur « Formes sur les chevaux » de « Réglages » les retire, les marques des écuries restent toujours. Tu as déjà dit oui aux formes désactivables (D-11) et choisi l’étoile plutôt qu’un losange pour Vert (D-14) ; la question reste ici pour que tu juges le résultat à bout de bras (test 8). Ça te va ?
result: pending

### 16. À confirmer : l’accueil
expected: |
  Choix fait (05-UI-SPEC « À confirmer » 2) : en bas de la colonne de droite, sous « Mes parties en cours », trois petites tuiles : « Règles », « Apprendre » et, avec un compte, « Mes résultats ». Sur l’ordinateur, elles viennent juste après les tuiles du compte. Sur l’iPhone, quand le bandeau « Installe TOC » est affiché, la liste « Mes parties en cours » n’a plus que la place d’une ligne et demie (elle défile). Ça te va ?
result: pending

### 17. À confirmer : la première fois
expected: |
  Choix fait (05-UI-SPEC « À confirmer » 3) : sur un appareil neuf, la fenêtre « Première fois ? » propose « Apprendre en 10 minutes » ou « Plus tard », une seule fois. Elle ne s’ouvre pas pour quelqu’un qui a déjà un prénom, un compte ou une partie sur l’appareil (dans le doute, elle ne s’ouvre pas). Dans la salle d’attente, un appareil qui a pris une place sans avoir fait de leçon affiche « Première fois ? Lis les règles en attendant. » avec « Règles du jeu » ; les leçons n’y sont pas proposées, pour ne pas faire attendre la table. Ça te va ?
result: pending

### 18. À confirmer : les personnes sans compte et les ordinateurs dans l’historique
expected: |
  Choix fait (05-UI-SPEC « À confirmer » 4 ; déjà décidé par toi : D-12) : « Mamie (sans compte) » au lieu de « Mamie (invitée) », pour ne pas accorder au féminin ou au masculin un prénom qu’on ne connaît pas. Dans la fiche d’une partie, c’est « Mamie » suivi de l’étiquette « (sans compte) ». Les ordinateurs apparaissent par leur force (« Pur-sang », et « Pur-sang (ordinateur) » dans la fiche), jamais par leur nom de cheval, qui change à chaque partie ; deux adversaires ordinateurs de même force s’écrivent « contre deux ordinateurs Galopeur ». Tu as déjà choisi « (sans compte) » (D-12) ; la question reste ici pour l’écriture des ordinateurs, que tu n’as pas encore vue. Ça te va ?
result: pending

### 19. À confirmer : ce qui compte
expected: |
  Choix fait (05-UI-SPEC « À confirmer » 5) : une place confiée à l’ordinateur en cours de partie compte quand même pour le compte qui l’avait, victoire ou défaite ; la fiche le dit par « l’ordinateur a fini à sa place ». Une partie solo jouée sans réseau est ajoutée à tes résultats au retour du réseau. Seules les parties terminées comptent (une partie arrêtée ou abandonnée ne compte pas). Chaque fiche dit à quoi la partie compte : « Cette partie compte pour le classement entre amis. », « Elle ne compte pas pour le classement : il faut au moins deux joueurs avec un compte. » ou « Partie contre l’ordinateur : elle compte dans tes chiffres, pas au classement. ». Ça te va ?
result: pending

### 20. À confirmer : « Mes chiffres »
expected: |
  Choix fait (05-UI-SPEC « À confirmer » 6) : parties, victoires et réussite en pourcentage ; les chevaux mangés par toi, mangés à toi et rentrés ; tes résultats avec chaque partenaire (huit, puis « Voir tous mes partenaires » ; toutes les personnes sans compte regroupées sous « Joueurs sans compte ») ; tes résultats contre l’ordinateur par force (la force de l’adversaire le plus fort) ; avec un filtre « Toutes », « En ligne », « Contre l’ordinateur ». Ça te va ?
result: pending

### 21. À confirmer : le classement entre amis
expected: |
  Choix fait (05-UI-SPEC « À confirmer » 7 ; déjà décidé par toi : D-13) : toi et tes amis ; chacun compte toutes ses parties en ligne terminées jouées avec au moins un autre joueur qui a un compte (pas seulement celles jouées avec toi) ; on y entre après 5 parties ; on classe au pourcentage de victoires, puis au nombre de victoires, puis au nombre de parties, puis par ordre alphabétique ; les ex æquo partagent leur rang (« 1er, 2e, 2e, 4e ») ; depuis le début, sans saison ; « Comment ça marche ? » l’explique. Tu as déjà dit oui à cette méthode (D-13) ; la question reste ici pour que tu la voies avec de vraies parties (test 3). Ça te va ?
result: pending

### 22. À confirmer : la feuille « Règles »
expected: |
  Choix fait (05-UI-SPEC « À confirmer » 8 ; déjà décidé par toi : D-15 pour les images) : une grande fenêtre avec dix onglets (« Le but », « Les cartes », « Une donne », « Sortir un cheval », « Le 7 », « Le Valet », « Manger », « Rentrer à la maison », « Quand tu as fini », « Règles de la maison »), quinze images des règles, et le texte du test 11. En partie, elle s’ouvre sur « Les cartes » par le bouton livre (ou la touche R sur l’ordinateur) ; si une carte est choisie, sa ligne est entourée de crème. Les images sont dessinées en direct avec le plateau du jeu, pas livrées en photos (D-15), pour que le site reste léger ; la question reste ici pour la place du livre et l’entourage de la carte. Ça te va ?
result: pending

### 23. À confirmer : pendant la lecture des règles
expected: |
  Choix fait (05-UI-SPEC « À confirmer » 9) : contre l’ordinateur, les ordinateurs attendent que tu fermes les règles ; en ligne, la partie continue et la feuille te dit « C’est à toi de jouer. » avec « Revenir à la partie » quand vient ton tour, sans se fermer toute seule. Ça te va ?
result: pending

### 24. À confirmer : le tutoriel
expected: |
  Choix fait (05-UI-SPEC « À confirmer » 10) : huit leçons (sortir, avancer, manger, le 4, le Valet, le 7, rentrer, l’échange), toujours avec les chevaux bleus ; un guide (le logo de TOC dans un rond) parle dans une bande au-dessus du plateau, ce qui rend le plateau un peu plus petit pendant les leçons (de 5 à 9 %) ; ce qu’il faut toucher est entouré d’un anneau crème qui pulse ; une erreur est expliquée et on réessaie, sans échec ; chaque leçon finit par une petite planche « Bravo ! ». Les phrases du guide sont à relire au test 12. Ça te va ?
result: pending

### 25. À confirmer : quitter les leçons
expected: |
  Choix fait (05-UI-SPEC « À confirmer » 11) : « Quitter les leçons » dans « Réglages » d’une leçon, sans question, ramène à la page « Apprendre à jouer », où les leçons faites restent cochées. Ça te va ?
result: pending

### 26. À confirmer : l’outil d’audit
expected: |
  Choix fait (05-UI-SPEC « À confirmer » 12 ; déjà décidé par toi : D-10) : `@axe-core/playwright` a été ajouté, utilisé seulement par les tests (rien n’est livré dans l’application), pour vérifier l’accessibilité de chaque écran. Tu as déjà dit oui (D-10) ; la question reste listée parce qu’elle est dans la liste de l’UI-SPEC. Rien à faire : réponds « approuvé ».
result: pending

### 27. À confirmer : la taille du site chez Cloudflare (hypothèse A1)
expected: |
  Hypothèse de la recherche (A1) : un Worker de l’offre gratuite peut peser au plus 3 Mo compressé (10 Mo avec l’offre payante). C’est pour cela que les images des règles sont dessinées en direct (D-15) et non livrées en photos. Le Worker de la phase 5, tout compris (le site, les sons, le plateau), pèse 2 206 Kio (environ 2,2 Mo) compressé (mesure du plan 05-11). À lire : rien à décider, sauf si tu sais que la limite a changé. Ça te va ?
result: pending

### 28. À confirmer : l’outil d’audit, sa façon de s’utiliser (hypothèse A2)
expected: |
  Hypothèse de la recherche (A2) : l’outil d’audit s’utilise comme prévu (`AxeBuilder`, `withTags`, `exclude`, `analyze`). C’est confirmé par le plan 05-10, qui s’en sert pour vérifier chaque écran. À lire : rien à décider. Ça te va ?
result: pending

### 29. À confirmer : une partie enregistrée d’un seul coup (hypothèse A3)
expected: |
  Hypothèse de la recherche (A3) : quand une partie en ligne se termine, toutes ses lignes (la partie et une ligne par compte) sont écrites d’un seul coup dans la base ; si l’écriture échoue, rien n’est écrit et elle est retentée toutes les heures. Même si ce n’était pas le cas, une nouvelle tentative n’écrit jamais une partie deux fois. À lire : rien à décider. Ça te va ?
result: pending

### 30. À confirmer : « Mangés par toi » et « Rentrés par toi » (hypothèse A4)
expected: |
  Hypothèse de la recherche (A4), choisie : « Mangés par toi » compte les chevaux mangés par les cartes que tu as jouées, même quand, tes quatre chevaux rentrés, tu joues ceux de ton partenaire. « Rentrés par toi » compte les chevaux de ta couleur rentrés à la fin de la partie : un cheval de ton partenaire que tu as rentré pour lui compte pour lui, pas pour toi. Est-ce bien comme ça que tu comptes ? Ça te va ?
result: pending

### 31. À confirmer : les parties solo acceptées (hypothèse A5)
expected: |
  Hypothèse de la recherche (A5), avec le seuil choisi par le plan 05-05 : une partie solo envoyée par le navigateur n’est pas vérifiée par le serveur (elle se joue sur ton appareil), elle ne compte donc que dans tes chiffres, jamais au classement. Pour écarter une partie fausse, elle doit durer au moins 30 secondes (la recherche proposait 60 s ; 30 s a été choisi pour ne jamais refuser une vraie partie rapide), avoir de 1 à 300 donnes, au plus 64 chevaux mangés ou perdus par place, finir au plus 5 minutes dans le futur et au plus 60 jours dans le passé ; et un compte envoie au plus 30 parties solo par jour. La partie d’essai des tests automatiques dure environ 45 s : si les machines de test deviennent beaucoup plus rapides, il faudra la ralentir (ou revoir ce seuil). Ça te va ?
result: pending

### 32. À confirmer : les règles d’audit retirées (hypothèse A6)
expected: |
  Hypothèse de la recherche (A6) : les règles de l’outil d’audit sur les identifiants en double sont retirées par ses auteurs ; elles ne sont donc pas vérifiées. Sans effet pour toi. À lire : rien à décider. Ça te va ?
result: pending

### 33. À confirmer : le plateau plus petit pendant les leçons
expected: |
  Question encore ouverte de la recherche : pendant les leçons, le plateau est de 5 à 9 % plus petit qu’en partie, pour laisser la place à la bande du guide au-dessus. Hors des leçons, rien ne change. Tu le vois au test 6. Ça te va ?
result: pending

### 34. À confirmer : deux amis aux pseudos proches
expected: |
  Point non résolu de l’UI-SPEC : dans le classement, deux amis aux pseudos proches (« Marie » et « Marie-Jo ») ne se distinguent que par le rond à leur initiale et leur pseudo complet, comme dans « Mes amis ». On suppose que cela suffit en famille. Ça te va ?
result: pending

### 35. À confirmer : pas de classement par équipe de deux
expected: |
  Point non résolu de l’UI-SPEC : il n’y a pas de classement par équipe de deux. « Avec mes partenaires », dans « Mes chiffres », donne les résultats de chacun avec chaque partenaire. Un classement par paires pourra venir si la famille le demande. Ça te va ?
result: pending

### 36. À confirmer : « Les parties comptent depuis novembre 2026 »
expected: |
  Choix fait (plans 05-01 et 05-09 ; déjà décidé par toi : D-04, on repart de zéro) : sous la navigation de « Mes résultats », la ligne « Les parties comptent depuis novembre 2026. » ; au bout de l’historique, après avoir chargé une deuxième page, « C’est tout : les parties comptent depuis novembre 2026. ». Une table en cours au moment de la mise en ligne ne compte ses chevaux mangés qu’à partir de la mise en ligne. Ça te va ?
result: pending

### 37. À confirmer : où sont les marques des écuries
expected: |
  Choix fait (plan 05-02) : en haut et en bas du plateau, la marque d’une écurie est à côté d’elle, du côté opposé au tapis vert ; à gauche et à droite, elle est du côté extérieur de l’écurie, vers la ligne du milieu du plateau. Le trait d’encre de la marque est fin. Regarde-les au test 8. Ça te va ?
result: pending

### 38. À confirmer : les images de « Le but » et « Une donne »
expected: |
  Choix fait (plan 05-04) : les images R-01.1 (« Le but »), R-04.2 et R-14.2 (« Une donne ») montrent seulement les écuries, sans rien d’entouré, comme les images de RULES.md. Tu préférerais peut-être d’autres images pour ces deux onglets. Les images sont petites à 480 px de large (des chevaux d’environ 15 px de haut) : sont-elles lisibles sur l’iPhone (test 5) ? Ça te va ?
result: pending

### 39. À confirmer : « Contre l’ordinateur, par force »
expected: |
  Choix fait (plan 05-05) : dans « Mes chiffres », « Contre l’ordinateur, par force » ne compte une partie que si les deux adversaires étaient des ordinateurs dès le début. La place d’une personne confiée à l’ordinateur en cours de partie compte toujours comme une place humaine. Ça te va ?
result: pending

### 40. À confirmer : la dernière planche des leçons sur l’ordinateur
expected: |
  Choix fait (plan 05-06) : sur l’ordinateur, dans la planche « Bravo ! » de la dernière leçon, « Jouer contre l’ordinateur » passe sur deux lignes dans la planche de 400 px. Ça te va, ou faut-il un mot plus court ?
result: pending

### 41. À confirmer : « Leçon 3 sur 8 » sur le téléphone
expected: |
  Choix fait (plan 05-06) : sur un téléphone, la pastille des leçons s’écrit « Leçon 3 » au-dessus de « sur 8 », pour tenir dans la bande. Ça te va ?
result: pending

### 42. À confirmer : la ligne de la planche de fin en solo
expected: |
  Choix fait (plan 05-07) : à la fin d’une partie contre l’ordinateur, avec ton compte, une ligne sous les chiffres de la planche dit « Partie ajoutée à tes résultats. » ou, sans réseau, « Pas de connexion : la partie sera ajoutée à tes résultats au retour du réseau. ». Elle s’affiche après une défaite comme après une victoire. Sans compte, pas de ligne. Ça te va ?
result: pending

### 43. À confirmer : une partie solo refusée ou gardée pour plus tard
expected: |
  Choix fait (plan 05-07) : une partie solo refusée par le serveur (par exemple plus courte que 30 secondes) est oubliée sans rien dire. Si le compte a été déconnecté entre-temps, la partie est gardée sur l’appareil et envoyée quand ce même compte se reconnecte ; l’appareil garde au plus 50 parties en attente. Ça te va ?
result: pending

### 44. À confirmer : la tuile « Règles » de l’accueil
expected: |
  Choix fait (plan 05-08) : la deuxième ligne de la tuile « Règles », « Les cartes, le 7, la maison », est coupée en « Les cartes, le 7, la … » dans la petite tuile de 152 px. Faut-il une ligne plus courte, par exemple « Cartes, 7, maison » ?
result: pending

### 45. À confirmer : les noms courts et longs des boutons
expected: |
  Choix fait (plan 05-10, pour que le lecteur d’écran lise les mots affichés) : le nom court d’un bouton (sur le téléphone) et son nom long (sur l’ordinateur) commencent maintenant par les mêmes mots : « Autre carte » / « Choisir une autre carte » (avant : « Changer de carte »), « Retirer » / « Retirer le dernier pas » (avant : « Retour »), « Effacer » / « Tout effacer » (avant : « Tout annuler »). Ça te va ?
result: pending

### 46. À confirmer : ce que lit le lecteur d’écran
expected: |
  Choix fait (plan 05-10) : sur les petites tuiles, les leçons, la pastille d’infos, les lignes de l’historique et les places de la salle d’attente, le lecteur d’écran lit d’abord les mots affichés, dans l’ordre, puis le reste (« Règles : les cartes, le 7, la maison », « Victoire · 8 – 5, Avec Marie · contre Paul, 6 nov., 21 h 14, en ligne »). Les chevaux sont lus en entier : « Cheval rouge C, à ton partenaire Marie, à l’écurie ». Tu l’écoutes au test 9. Ça te va ?
result: pending

## Summary

total: 46
passed: 0
issues: 0
pending: 46
skipped: 0
blocked: 0

## Gaps

[none yet]
