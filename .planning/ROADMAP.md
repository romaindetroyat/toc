# Roadmap: TOC en ligne

## Overview

Le parcours part du cœur du jeu. On écrit d'abord les règles maison, que Romain valide. On construit ensuite un moteur de règles pur. La première phase se termine par une partie complète, jouable sur un seul appareil, sur le plateau original, avec des cavaliers animés et sonorisés. Cette même partie passe ensuite en ligne, sur une table dont le serveur fait autorité : mains cachées, pause en cas de déconnexion, chat et reprise. Viennent ensuite les joueurs gérés par l'ordinateur, de force 1 à 5, puis les comptes, les amis, les tables et l'application installable. La dernière phase apporte le suivi (historique, statistiques, classement), l'aide, le tutoriel et l'accessibilité. Chaque phase livre une capacité jouable de bout en bout.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Une vraie partie sur un appareil** - Règles validées, moteur, plateau original, cavaliers animés et bruitages, partie complète contre l'ordinateur
- [ ] **Phase 2: Jouer en ligne entre proches** - Table en temps réel sur plusieurs appareils, serveur qui fait autorité, pause, chat, revanche et reprise
- [ ] **Phase 3: L'ordinateur à la force choisie** - Joueurs gérés par l'ordinateur de niveau 1 à 5, sans triche et à un rythme naturel
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
  2. Sur un téléphone en portrait comme sur un grand écran, un joueur fait une partie complète sur le plateau original assemblé contre trois joueurs gérés par l'ordinateur, qui jouent un coup légal au hasard. La partie enchaîne les donnes de 5, 4 puis 4 cartes, avec un donneur qui change. Une main injouable est posée. Un joueur dont les 4 pions sont rentrés continue avec les pions de son partenaire. La partie se termine par la victoire de l'équipe qui rentre ses 8 pions.
  3. Quand c'est son tour, le joueur voit ses cartes jouables et les pions concernés mis en évidence, et seuls les coups permis par RULES.md lui sont proposés. Il passe une carte à son partenaire en début de donne et voit qui doit encore choisir. Avec l'As ou le Roi, il choisit entre sortir et avancer. Il répartit le 7 avec l'assistant pas à pas. Avant de confirmer un coup, il voit l'aperçu du trajet et des pions qui seraient mangés.
  4. Les cavaliers en fausse 3D, aux 4 couleurs, s'animent à chaque action : sortie de l'écurie, déplacement case par case, prise, retour à l'écurie, entrée dans la maison, échange au Valet. La durée du déplacement suit la distance, et les bruits de sabots suivent la même cadence.
  5. Des hennissements et des sons de cartes accompagnent les actions, y compris sur iPhone. La licence de chaque fichier est tracée. Le joueur peut couper le son et réduire les animations, et la partie reste entièrement jouable sans son.

**Plans:** 12/24 plans executed

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
- [ ] 01-13-PLAN.md — Moteur : le 7 réparti et l’état de rendu

**Wave 8** *(blocked on Wave 7 completion)*
- [ ] 01-14-PLAN.md — Ordinateur de niveau 1, propriétés du moteur, parties en auto-jeu

**Wave 9** *(blocked on Wave 8 completion)*
- [ ] 01-15-PLAN.md — Contrôleur de partie, metteur en scène et interaction du tour

**Wave 10** *(blocked on Wave 9 completion)*
- [ ] 01-16-PLAN.md — Écran de jeu : main en éventail, carte → cheval → aperçu → « Jouer »

**Wave 11** *(blocked on Wave 10 completion)*
- [ ] 01-17-PLAN.md — La table : bandeau, tapis, échange de carte, main posée, fin de partie

**Wave 12** *(blocked on Wave 11 completion)*
- [ ] 01-18-PLAN.md — As/Roi « Sortir ou avancer », Valet en deux touches, chevaux serrés
- [ ] 01-19-PLAN.md — Les cavaliers s’animent et hennissent
- [ ] 01-20-PLAN.md — Figures traditionnelles des cartes, licences vérifiées

**Wave 13** *(blocked on Wave 12 completion)*
- [ ] 01-21-PLAN.md — Le 7 réparti pas à pas, partie complète au doigt, cibles de 44 px
- [ ] 01-22-PLAN.md — Les cartes bougent aussi ; avance rapide, animations réduites, onglet caché

**Wave 14** *(blocked on Wave 13 completion)*
- [ ] 01-23-PLAN.md — « Réglages » : couper le son, régler l’ambiance, réduire les animations

**Wave 15** *(blocked on Wave 14 completion)*
- [ ] 01-24-PLAN.md — Abandonner, pannes de son, tapis en grand, finition et vérifications

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
  5. Les joueurs d'une table discutent par chat texte pendant la partie. À la fin, l'équipe gagnante est annoncée à tous, et la table peut enchaîner une revanche avec les mêmes joueurs.

**Plans**: TBD
**UI hint**: yes

### Phase 3: L'ordinateur à la force choisie

**Goal**: Chaque place tenue par l'ordinateur joue à la force choisie, du niveau 1 (un coup légal au hasard) au niveau 5 (un vrai jeu d'équipe). L'ordinateur ne triche jamais et joue à un rythme naturel.
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: BOT-01, BOT-02, BOT-03, BOT-04, BOT-05
**Success Criteria** (what must be TRUE):
  1. Le créateur de la table choisit une force de 1 à 5 pour chaque place tenue par l'ordinateur, et chaque place joue à sa force.
  2. Sur un grand nombre de parties simulées, chaque niveau gagne nettement plus souvent que le niveau précédent. Le niveau 1 joue un coup légal au hasard.
  3. Face au niveau 5, on observe un vrai jeu d'équipe : il protège ses pions, aide son partenaire à avancer et choisit avec soin la carte qu'il lui passe.
  4. Les décisions de l'ordinateur ne dépendent que de ce qu'un humain saurait à sa place : sa main, les cartes jouées et la position des pions. Changer les mains cachées des autres joueurs ne change pas son coup.
  5. Avant chaque coup, l'ordinateur marque un temps de réflexion naturel, et il ne dépasse jamais quelques secondes, quel que soit son niveau.

**Plans**: TBD

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
| 1. Une vraie partie sur un appareil | 12/24 | In Progress | - |
| 2. Jouer en ligne entre proches | 0/TBD | Not started | - |
| 3. L'ordinateur à la force choisie | 0/TBD | Not started | - |
| 4. Comptes, amis et application installable | 0/TBD | Not started | - |
| 5. Suivi, apprentissage et finition | 0/TBD | Not started | - |
