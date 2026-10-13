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
**Plans:** 11 plans

Plans:
- [ ] 01-01-PLAN.md — Squelette jouable : validation des paquets, traceur « Jouer la partie » → plateau → cavalier qui bondit au son des sabots, plateau net sur tous les écrans
- [ ] 01-02-PLAN.md — RULES.md rédigé (R-01 à R-16), scénarios en données, images sur le plateau, contrat du moteur et des événements
- [ ] 01-03-PLAN.md — Romain valide RULES.md et choisit la source des figures des cartes ; constantes de règles nommées
- [ ] 01-04-PLAN.md — Choix de la couleur mémorisé, plateau tourné vers le joueur, seize cavaliers Staunton
- [ ] 01-05-PLAN.md — Moteur audio complet, page « Test des sons » pour Romain, licences et crédits
- [ ] 01-06-PLAN.md — Moteur : donnes, échange, déplacements, maison, prises, scénarios en tests
- [ ] 01-07-PLAN.md — Moteur : le 7, propriétés, ordinateur de niveau 1, parties en auto-jeu
- [ ] 01-08-PLAN.md — Partie jouable : échange, coup avec aperçu, main posée, tapis, fin de partie
- [ ] 01-09-PLAN.md — As/Roi, 7 réparti, Valet, plateau qui départage, partie complète au doigt
- [ ] 01-10-PLAN.md — Animations des cavaliers et des cartes, synchronisées avec les sons
- [ ] 01-11-PLAN.md — Réglages, tapis en grand, figures des cartes, finition et vérifications
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
| 1. Une vraie partie sur un appareil | 0/TBD | Not started | - |
| 2. Jouer en ligne entre proches | 0/TBD | Not started | - |
| 3. L'ordinateur à la force choisie | 0/TBD | Not started | - |
| 4. Comptes, amis et application installable | 0/TBD | Not started | - |
| 5. Suivi, apprentissage et finition | 0/TBD | Not started | - |
