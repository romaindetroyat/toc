# Roadmap: TOC en ligne

## Overview

Le parcours part du cœur du jeu. On écrit d'abord les règles maison, que Romain valide. On construit ensuite un moteur de règles pur. La première phase se termine par une partie complète, jouable sur un seul appareil, sur le plateau original, avec des cavaliers animés et sonorisés. Cette même partie passe ensuite en ligne, sur une table dont le serveur fait autorité : mains cachées, pause en cas de déconnexion, chat et reprise. Viennent ensuite les joueurs gérés par l'ordinateur, de force 1 à 5, puis les comptes, les amis, les tables et l'application installable. La dernière phase apporte le suivi (historique, statistiques, classement), l'aide, le tutoriel et l'accessibilité. Chaque phase livre une capacité jouable de bout en bout.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Une vraie partie sur un appareil** *(close le 2026-10-15 à la demande de Romain, « Close, essais restants notés » ; essais restants dans 01-UAT.md)* - Règles validées, moteur, plateau galet, cavaliers animés et bruitages, partie complète contre l'ordinateur
- [ ] **Phase 2: Jouer en ligne entre proches** - Table en temps réel sur plusieurs appareils, serveur qui fait autorité, pause, chat, revanche et reprise
- [ ] **Phase 3: L'ordinateur à la force choisie** *(faite avant la phase 2, choix de Romain le 2026-10-15 : « OK, on passe à la phase 3 »)* - Joueurs gérés par l'ordinateur de niveau 1 à 5, sans triche et à un rythme naturel
- [ ] **Phase 4: Comptes, amis et application installable** - Passkeys, amis, tables, partie solo, PWA, mises à jour et notifications
- [ ] **Phase 5: Suivi, apprentissage et finition** - Historique, statistiques, classement entre amis, aide, tutoriel et accessibilité

## Phase Details

### Phase 1: Une vraie partie sur un appareil

**Goal**: Un joueur fait une partie complète de TOC, fidèle aux règles maison validées par Romain, contre trois joueurs gérés par l'ordinateur, sur le plateau original, avec des cavaliers animés et sonorisés.
**Mode:** mvp
**Depends on**: Rien (première phase)
**Requirements**: RULE-01, RULE-02, RULE-03, RULE-04, RULE-05, RULE-06, RULE-07, RULE-08, RULE-09, RULE-10, RULE-11, RULE-12, RULE-13, RULE-14, RULE-15, RULE-16, RULE-17, RULE-18, RULE-20, PLAY-01, PLAY-02, PLAY-03, PLAY-04, PLAY-05, FX-01, FX-02, FX-03, FX-04, FX-05, FX-06
**Success Criteria** (what must be TRUE):
  1. Romain a relu et validé RULES.md. Chaque règle y est numérotée et illustrée par un scénario, et tous les scénarios passent en test automatique contre le moteur, y compris les cas limites : sortie protégée, 7 qui mange, 4 en arrière, Valet, entrée exacte dans la maison.
  2. Sur un téléphone tenu en largeur comme sur un grand écran, un joueur fait une partie complète sur le plateau galet contre trois joueurs gérés par l'ordinateur, qui jouent un coup légal au hasard. La partie enchaîne les donnes de 5, 4 puis 4 cartes, avec un donneur qui change. Une main injouable est posée. Un joueur dont les 4 pions sont rentrés continue avec les pions de son partenaire. La partie se termine par la victoire de l'équipe qui rentre ses 8 pions.
  3. Quand c'est son tour, le joueur voit ses cartes jouables et les pions concernés mis en évidence, et seuls les coups permis par RULES.md lui sont proposés. Il passe une carte à son partenaire en début de donne et voit qui doit encore choisir. Avec l'As ou le Roi, il choisit entre sortir et avancer. Il répartit le 7 avec l'assistant pas à pas. Avant de confirmer un coup, il voit l'aperçu du trajet et des pions qui seraient mangés.
  4. Les cavaliers en fausse 3D, aux 4 couleurs, s'animent à chaque action : sortie de l'écurie, déplacement case par case, prise, retour à l'écurie, entrée dans la maison, échange au Valet. La durée du déplacement suit la distance, et les bruits de sabots suivent la même cadence.
  5. Des hennissements et des sons de cartes accompagnent les actions, y compris sur iPhone. La licence de chaque fichier est tracée. Le joueur peut couper le son et réduire les animations, et la partie reste entièrement jouable sans son.

**Plans:** 53/55 plans executed (01-42 to 01-54: gap closure after Romain's re-test of 2026-10-15: rule G16 for the 7, riders turned to their camp, one-knight auto-select, slower deal, full-height board on the phone, silent-mode sound, end plank, sound test page with choices; 01-25 to 01-28: gap closure after Romain's UAT of 2026-10-14; 01-29 to 01-31: board C+, rejected by Romain; 01-32 to 01-41: board galet, then « paysage obligatoire »: the landscape galet only, « Compacter l'écran » on the phone held sideways, « Tourne ton téléphone », UAT tests 3 and 4)

Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Squelette jouable : validation des paquets, traceur « Jouer la partie » → plateau → cavalier qui bondit au son des sabots

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-02-PLAN.md — Plateau net et juste sur tous les écrans : srcset, chargement, erreur, overlay de géométrie, garde-fous en tests
- [x] 01-03-PLAN.md — Contrat du moteur (types, événements) et règles R-01 à R-08 avec leurs scénarios
- [x] 01-04-PLAN.md — Moteur audio complet : sabots sur l’horloge audio, hennissements, cartes, ambiance

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 01-05-PLAN.md — Règles R-09 à R-16, points à valider et images des scénarios
- [x] 01-06-PLAN.md — Choix de la couleur mémorisé, polices, icônes et jetons de style

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 01-07-PLAN.md — Romain valide RULES.md et choisit la source des figures des cartes ; constantes de règles nommées
- [x] 01-08-PLAN.md — Plateau tourné vers le joueur et seize cavaliers Staunton
- [x] 01-09-PLAN.md — Page « Test des sons » pour Romain

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 01-10-PLAN.md — Moteur : paquet, donnes 5/4/4, échange, vue par place
- [x] 01-11-PLAN.md — Licences tracées et feuille « Crédits et licences »

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 01-12-PLAN.md — Moteur : un seul chemin pour les déplacements, tour de jeu, scénarios en tests

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 01-13-PLAN.md — Moteur : le 7 réparti et l’état de rendu

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 01-14-PLAN.md — Ordinateur de niveau 1, propriétés du moteur, parties en auto-jeu

**Wave 9** *(blocked on Wave 8 completion)*
- [x] 01-15-PLAN.md — Contrôleur de partie, metteur en scène et interaction du tour

**Wave 10** *(blocked on Wave 9 completion)*
- [x] 01-16-PLAN.md — Écran de jeu : main en éventail, carte → cheval → aperçu → « Jouer »

**Wave 11** *(blocked on Wave 10 completion)*
- [x] 01-17-PLAN.md — La table : bandeau, tapis, échange de carte, main posée, fin de partie

**Wave 12** *(blocked on Wave 11 completion)*
- [x] 01-18-PLAN.md — As/Roi « Sortir ou avancer », Valet en deux touches, chevaux serrés
- [x] 01-19-PLAN.md — Les cavaliers s’animent et hennissent
- [x] 01-20-PLAN.md — Figures traditionnelles des cartes, licences vérifiées

**Wave 13** *(blocked on Wave 12 completion)*
- [x] 01-21-PLAN.md — Le 7 réparti pas à pas, partie complète au doigt, cibles de 44 px
- [x] 01-22-PLAN.md — Les cartes bougent aussi ; avance rapide, animations réduites, onglet caché

**Wave 14** *(blocked on Wave 13 completion)*
- [x] 01-23-PLAN.md — « Réglages » : couper le son, régler l’ambiance, réduire les animations

**Wave 15** *(blocked on Wave 14 completion)*
- [x] 01-24-PLAN.md — Abandonner, pannes de son, tapis en grand, finition et vérifications

**Wave 16** *(gap closure, UAT test 6)*
- [x] 01-25-PLAN.md — Règles : entrer dans la maison sans avoir fait le tour complet (G14)

**Wave 17** *(gap closure, UAT test 7; blocked on Wave 16 completion)*
- [x] 01-26-PLAN.md — Règles : le 7 dépasse le partenaire sans le manger (G15)

**Wave 18** *(gap closure, UAT test 5; blocked on Wave 17 completion)*
- [x] 01-27-PLAN.md — Jouer au clavier sur ordinateur : chiffres, lettres, Entrée, Échap, aide « ? »

**Wave 19** *(gap closure, UAT test 5; blocked on Wave 18 completion)*
- [x] 01-28-PLAN.md — Les raccourcis se voient sur ordinateur, jamais sur téléphone

**Wave 20** *(gap closure, UAT test 4, plateau C+; blocked on Wave 19 completion)*
- [x] 01-29-PLAN.md — La géométrie du plateau C+ et les images des règles ; le contrat d’interface et ce que Romain a décidé

**Wave 21** *(gap closure, UAT tests 3 and 4; blocked on Wave 20 completion)*
- [x] 01-30-PLAN.md — Le plateau C+ dans la partie : un plateau 2:3 dessiné, chaque cavalier à sa place

**Wave 22** *(gap closure, UAT test 4; blocked on Wave 21 completion)*
- [x] 01-31-PLAN.md — Halos, aperçus, lettres, marqueurs et cibles sur les cavaliers de C+

*(01-29 to 01-31 built board C+; Romain rejected it once he saw it in the game, 2026-10-14, and chose the wooden « galet » board: in landscape on the computer, in portrait on the iPhone. The C+ plans 01-32 to 01-36 were dropped; the numbers are reused below.)*

**Wave 23** *(gap closure, UAT tests 3 and 4, plateau galet; blocked on Wave 22 completion)*
- [x] 01-32-PLAN.md — Les deux plateaux galet dans packages/board ; traceur : le galet en largeur dans la vraie partie à 1280 × 800, un cavalier bondit jusqu’à sa case

**Wave 24** *(gap closure, UAT test 4; blocked on Wave 23 completion)*
- [x] 01-33-PLAN.md — Les cavaliers de Romain sur les plateaux, les images des règles sur le galet, la licence, le contrat d’interface « Plateau galet » et le journal des décisions

*(Then, the same day, Romain: « Pour la version iphone, oblige à jouer en format paysage, ça permettra d’utiliser le même plateau », « Oui, paysage obligatoire ». One board, the landscape galet, on the computer and on the phone held sideways; 01-34 to 01-41 were replanned for it.)*

**Wave 25** *(gap closure, UAT tests 3 and 4; blocked on Wave 24 completion)*
- [x] 01-34-PLAN.md — Le galet en largeur devient le seul plateau du jeu : les cavaliers, leurs halos, aperçus, marques et cibles dessus

**Wave 26** *(gap closure, UAT test 4; blocked on Wave 25 completion)*
- [x] 01-35-PLAN.md — Le tapis et ses cartes sur le galet en largeur

**Wave 27** *(gap closure, UAT tests 4 and 5; blocked on Wave 26 completion)*
- [x] 01-36-PLAN.md — Sur ordinateur, le galet en largeur et la barre du bas ; les trois modes d’écran

**Wave 28** *(gap closure, UAT tests 3 and 4, « Compacter l'écran »; blocked on Wave 27 completion)*
- [x] 01-37-PLAN.md — Sur le téléphone tenu en largeur, la barre compacte

**Wave 29** *(gap closure, UAT test 4, « paysage obligatoire »; blocked on Wave 28 completion)*
- [x] 01-38-PLAN.md — « Tourne ton téléphone », et les tests du téléphone tenu en largeur

**Wave 30** *(gap closure, UAT test 4; blocked on Wave 29 completion)*
- [x] 01-39-PLAN.md — Le plateau image et ses outils quittent le jeu ; la licence du plateau et les documents du projet

**Wave 31** *(gap closure, UAT tests 3 and 4; blocked on Wave 30 completion)*
- [x] 01-40-PLAN.md — Un seul plateau dans le code, le galet en largeur, et les numéros des images des règles en Caveat

**Wave 32** *(gap closure, UAT tests 3 and 4; blocked on Wave 31 completion)*
- [x] 01-41-PLAN.md — L’ancienne géométrie quitte packages/board, toutes les vérifications, puis le re-test de Romain

**Wave 33** *(gap closure, Romain's re-test of 2026-10-15; blocked on Wave 32 completion)*
- [x] 01-42-PLAN.md — Règle G16, la carte qui peut faire rentrer un cheval le fait rentrer (moteur)

**Wave 34** *(gap closure, Romain's re-test of 2026-10-15; blocked on Wave 33 completion)*
- [x] 01-43-PLAN.md — Règle G16 dans RULES.md, ses scénarios et leurs images

**Wave 35** *(gap closure, Romain's re-test of 2026-10-15; blocked on Wave 34 completion)*
- [x] 01-44-PLAN.md — Les cavaliers à l'encre du galet, sabots vers leur camp

**Wave 36** *(gap closure, Romain's re-test of 2026-10-15; blocked on Wave 35 completion)*
- [x] 01-45-PLAN.md — Un seul cheval pour la carte : directement l'aperçu et « Jouer »

**Wave 37** *(gap closure, Romain's re-test of 2026-10-15; blocked on Wave 36 completion)*
- [x] 01-46-PLAN.md — La donne un peu moins rapide

**Wave 38** *(gap closure, Romain's re-test of 2026-10-15; blocked on Wave 37 completion)*
- [x] 01-47-PLAN.md — Le plateau sur toute la hauteur du téléphone (1/2) : le cadre et chaque état du tour

**Wave 39** *(gap closure, Romain's re-test of 2026-10-15; blocked on Wave 38 completion)*
- [x] 01-48-PLAN.md — Le plateau sur toute la hauteur du téléphone (2/2) : chaque état prouvé, toute la suite, le contrat

**Wave 40** *(gap closure, Romain's re-test of 2026-10-15; blocked on Wave 39 completion)*
- [x] 01-49-PLAN.md — Le son de l'iPhone en mode silencieux

**Wave 41** *(gap closure, Romain's re-test of 2026-10-15; blocked on Wave 40 completion)*
- [x] 01-50-PLAN.md — La planche de fin de partie, dans le bois du galet

**Wave 42** *(gap closure, Romain's re-test of 2026-10-15; blocked on Wave 41 completion)*
- [x] 01-51-PLAN.md — La page d'essai des sons à choix, et les sabots en quatre versions

**Wave 43** *(gap closure, Romain's re-test of 2026-10-15; blocked on Wave 42 completion)*
- [ ] 01-52-PLAN.md — Les hennissements en trois ou quatre versions *(reporté le 2026-10-15, Romain : « laisse les sons de côté sauf les sabots des chevaux »)*

**Wave 44** *(gap closure, Romain's re-test of 2026-10-15; blocked on Wave 43 completion)*
- [ ] 01-53-PLAN.md — Les sons de cartes en trois ou quatre versions, et les sons de fin de partie *(reporté le 2026-10-15, Romain : « laisse les sons de côté sauf les sabots des chevaux »)*

**Wave 45** *(gap closure, Romain's re-test of 2026-10-15; blocked on Wave 44 completion)*
- [x] 01-54-PLAN.md — Toutes les vérifications après la recette 3, puis la recette 4 de Romain

**Wave 46** *(gap closure, Romain's report of 2026-10-15 on entering the home; blocked on Wave 45 completion)*
- [x] 01-55-PLAN.md — Règle G17 : un cheval saute les chevaux déjà rentrés dans sa maison

**UI hint**: yes

### Phase 2: Jouer en ligne entre proches

**Goal**: Quatre proches, chacun sur son appareil, jouent la même partie en temps réel sur une table dont le serveur fait autorité. La partie résiste aux coupures et peut être reprise plus tard.
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: RULE-19, NET-01, NET-02, NET-03, NET-04, NET-05, PLAY-07, HIST-01
**Success Criteria** (what must be TRUE):
  1. Quatre joueurs, chacun sur son téléphone ou son ordinateur, rejoignent la même table par son lien et jouent une partie complète en temps réel. Les places libres sont tenues par l'ordinateur. Le serveur mélange et distribue les cartes, et il refuse tout coup non conforme aux règles.
  2. Aucun joueur ne peut connaître la main d'un autre, même en examinant les messages reçus par son appareil, y compris après une reconnexion. Les cartes jouées restent visibles de tous.
  3. Un joueur qui recharge la page ou perd le réseau retrouve la partie dans son état exact. Pendant son absence, la partie est en pause, et tous les joueurs le voient. Passé le délai, le créateur de la table choisit entre trois options : attendre encore, confier la place à l'ordinateur (le joueur la récupère à son retour) ou sauvegarder la partie.
  4. Le créateur de la table peut arrêter une partie à tout moment. Les joueurs la reprennent plus tard, même plusieurs jours après, dans l'état exact où elle était : mains, donne en cours, position des pions, joueur dont c'est le tour.
  5. Les joueurs d'une table échangent des messages rapides (phrases et émojis, sans clavier) pendant la partie. À la fin, l'équipe gagnante est annoncée à tous, et la table peut enchaîner une revanche avec les mêmes joueurs.

**Plans:** 11/13 plans executed (the plans run one after the other on the main tree; each runs only the Playwright specs it touches; 02-01 starts with Romain's approval of the five new packages; 02-10 runs everything, plays a game between four browsers, creates the D1 database if the token allows it, deploys to https://toc.romaindetroyat.workers.dev and writes 02-UAT.md)

Plans:
- [x] 02-06c-PLAN.md
- [x] 02-06b-PLAN.md
- [x] 02-04b-PLAN.md

**Wave 1**
- [x] 02-01-PLAN.md — Traceur : deux navigateurs à la même table par son lien, chaque coup validé par le serveur, chacun ne voyant que sa main

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 02-02-PLAN.md — Aucune main ne fuit, même après une reconnexion, et la construction du déploiement vérifiée

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 02-03-PLAN.md — Les ordinateurs de la table en ligne : rythme naturel et Champion en tranches (offre gratuite)

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 02-04-PLAN.md — L'accueil : jouer contre l'ordinateur ou créer une table, le prénom, « Mes parties en cours »

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 02-05-PLAN.md — La salle d'attente et l'invitation (lien, code QR)

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 02-06-PLAN.md — Un joueur s'absente : la pause pour tous, puis le choix du chef de table

**Wave 7** *(blocked on Wave 6 completion)*
- [x] 02-07-PLAN.md — Recharger, perdre le réseau, arrêter et reprendre des jours après, « C'est moi »

**Wave 8** *(blocked on Wave 7 completion)*
- [x] 02-08-PLAN.md — Les messages rapides

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 02-09-PLAN.md — La fin de partie pour tous, la revanche, et la trace de chaque partie (D1)

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 02-10-PLAN.md — Vérification finale, une partie à quatre navigateurs, la mise en ligne et la recette de Romain

**UI hint**: yes

### Phase 3: L'ordinateur à la force choisie

**Goal**: Chaque place tenue par l'ordinateur joue à la force choisie, du niveau 1 (un coup légal au hasard) au niveau 5 (un vrai jeu d'équipe). L'ordinateur ne triche jamais et joue à un rythme naturel.
**Mode:** mvp
**Depends on**: Phase 1 (avancée avant la phase 2 le 2026-10-15 ; la table en ligne de la phase 2 reprendra le choix de force)
**Requirements**: BOT-01, BOT-02, BOT-03, BOT-04, BOT-05
**Success Criteria** (what must be TRUE):
  1. Le créateur de la table choisit une force de 1 à 5 pour chaque place tenue par l'ordinateur, et chaque place joue à sa force.
  2. Sur un grand nombre de parties simulées, chaque niveau gagne nettement plus souvent que le niveau précédent. Le niveau 1 joue un coup légal au hasard.
  3. Face au niveau 5, on observe un vrai jeu d'équipe : il protège ses pions, aide son partenaire à avancer et choisit avec soin la carte qu'il lui passe.
  4. Les décisions de l'ordinateur ne dépendent que de ce qu'un humain saurait à sa place : sa main, les cartes jouées et la position des pions. Changer les mains cachées des autres joueurs ne change pas son coup.
  5. Avant chaque coup, l'ordinateur marque un temps de réflexion naturel, et il ne dépasse jamais quelques secondes, quel que soit son niveau.

**Plans:** 11/11 plans executed (the plans run one after the other on the main tree; the only 400-game 5-vs-4 ladder run, about 12 minutes, is in 03-04; 03-07 runs the full suite and writes 03-UAT.md)

Plans:
**Wave 1**
- [x] 03-01-PLAN.md — Traceur : la force choisie au lancement, retenue, et jouée dans la partie ; le 7 en quelques plateaux (sevenOutcomes), le paquet des ordinateurs pur

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 03-02-PLAN.md — Les niveaux 2 à 4 : le jeu d'équipe, des erreurs de moins en moins, la carte d'échange, et l'échelle (tools/ladder.mjs) qui le prouve
- [x] 03-03-PLAN.md — Le lancement sur tous les écrans : les trois lignes de force, deux colonnes, la bande du bouton

**Wave 3** *(blocked on Wave 2 completion)*
- [x] 03-04-PLAN.md — Le Champion : recherche sur les donnes qu'il peut imaginer, jamais de triche (propriété), banc fixe et la seule échelle 5 contre 4

**Wave 4** *(blocked on Wave 3 completion)*
- [x] 03-05-PLAN.md — Le rythme naturel : réfléchir selon le coup, calcul compris, avance rapide, plafond, recherche en tranches

**Wave 5** *(blocked on Wave 4 completion)*
- [x] 03-06-PLAN.md — Le signe « réfléchit » et le banc d'essai #/banc pour l'iPhone

**Wave 6** *(blocked on Wave 5 completion)*
- [x] 03-07-PLAN.md — Vérification finale : suite complète, échelle des niveaux, recette de Romain (03-UAT.md) et ce qu'il doit confirmer

**Wave 7** *(gap closure, Romain 2026-10-15 : « Oui, que les sabots »; blocked on Wave 6 completion)*
- [x] 03-08-PLAN.md — Dans la partie, on n'entend que les sabots

**Wave 8** *(gap closure, Romain 2026-10-17 : « Pas assez visible »)*
- [x] 03-09-PLAN.md — Un signe « réfléchit » bien visible

**Wave 9** *(gap closure, Romain 2026-10-17 : la visibilité des cartes)*
- [x] 03-10-PLAN.md — Des cartes plus grandes et la carte reçue bordée de la couleur du partenaire

**Wave 10** *(gap closure, Romain 2026-10-17 : « Il faut aussi savoir quel joueur va jouer le premier la donne actuelle »)*
- [x] 03-11-PLAN.md — Qui commence la donne : la ligne de la bannière, le jeton « 1er », « Commence : … »

### Phase 4: Comptes, amis et application installable

**Goal**: Chaque proche a son compte et retrouve ses amis. Il monte une table ou une partie solo depuis l'application installée, et il est prévenu quand c'est son tour.
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: ACCT-01, ACCT-02, ACCT-03, ACCT-04, ACCT-05, APP-01, APP-02, APP-03
**Success Criteria** (what must be TRUE):
  1. Un joueur crée un compte avec son pseudo grâce à un code reçu par e-mail, puis se connecte par passkey. En cas de besoin, il récupère son compte par e-mail. Il reste connecté entre les visites, y compris dans l'application installée ouverte à froid.
  2. Un joueur ajoute un ami avec un code ou un lien d'invitation, et il voit sa liste d'amis.
  3. Un joueur crée une table, invite des amis, répartit les places et les équipes, et règle la force de l'ordinateur pour chaque place libre. Il peut aussi lancer directement une partie solo contre trois joueurs gérés par l'ordinateur.
  4. Le jeu s'installe comme application sur téléphone et sur ordinateur, avec une icône et un écran de démarrage. Une nouvelle version ne recharge jamais une partie en cours : le joueur est invité à mettre à jour.
  5. Le joueur reçoit une notification quand c'est son tour ou qu'on l'invite à une table, y compris sur iPhone quand l'application est installée.

**Plans**: TBD
**UI hint**: yes

### Phase 5: Suivi, apprentissage et finition

**Goal**: Les joueurs suivent leurs parties et se mesurent entre amis. Les nouveaux venus apprennent les règles en jouant. Le jeu est accessible à toute la famille.
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: HIST-02, HIST-03, HIST-04, PLAY-06, APP-04, APP-05
**Success Criteria** (what must be TRUE):
  1. Un joueur consulte l'historique de ses parties : date, équipes, résultat.
  2. Un joueur consulte ses statistiques et celles de ses équipes (parties jouées, victoires, pions mangés…), et il voit un classement entre amis.
  3. À tout moment de la partie, une aide en français rappelle les règles et l'effet de chaque carte.
  4. Un nouveau joueur apprend les règles en faisant une partie guidée par un tutoriel interactif.
  5. Toute l'interface est en français. Chaque place se reconnaît autrement que par sa couleur, et les zones tactiles sont assez grandes pour jouer au doigt sur téléphone.

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Une vraie partie sur un appareil | 53/55 (01-52, 01-53 reportés) | Closed, UAT pending | 2026-10-15 |
| 2. Jouer en ligne entre proches | 11/13 | In Progress | - |
| 3. L'ordinateur à la force choisie | 11/11 | In Progress | - |
| 4. Comptes, amis et application installable | 0/TBD | Not started | - |
| 5. Suivi, apprentissage et finition | 0/TBD | Not started | - |
