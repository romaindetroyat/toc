# Requirements: TOC en ligne

**Defined:** 2026-10-13
**Core Value:** Une vraie partie de TOC, fidèle aux règles maison, jouable à distance entre proches sur n'importe quel appareil, avec l'ambiance du plateau original (chevaux animés, bruitages).

## v1 Requirements

### Règles (RULE) — moteur de jeu

Plateau : 72 cases en anneau, sens horaire bleu → jaune → rouge → vert. Chaque couleur a une écurie (4 places), une case de sortie (losange 18), une case d'entrée (carré 16, deux cases avant sa sortie) et une maison de 4 cases. Équipes : jaune + vert contre rouge + bleu.

- [x] **RULE-01** : Une partie se joue à 4 places en 2 équipes ; les partenaires sont face à face (jaune + vert, rouge + bleu).
- [x] **RULE-02** : Un jeu de 52 cartes sans joker est mélangé côté serveur (aléa cryptographique) puis distribué en donnes de 5, 4 et 4 cartes ; on rebat ensuite et le donneur change à chaque paquet.
- [x] **RULE-03** : À chaque donne, chaque joueur voit sa main puis passe une carte face cachée à son partenaire ; l'échange a lieu même si la main deviendra injouable.
- [x] **RULE-04** : Les joueurs jouent à tour de rôle dans le sens horaire ; jouer une carte jouable est obligatoire.
- [x] **RULE-05** : L'As sort un pion de l'écurie sur sa case de sortie, ou avance un pion de 1.
- [x] **RULE-06** : Le Roi sort un pion, ou avance un pion de 13.
- [x] **RULE-07** : La Dame avance de 12 ; 10, 9, 8, 6, 5, 3 et 2 avancent du nombre indiqué ; le 5 ne fait avancer que ses propres pions.
- [x] **RULE-08** : Le 4 fait reculer un pion de 4 cases, y compris un pion qui vient de sortir et se trouve sur sa case de sortie ; on n'entre jamais dans sa maison en reculant.
- [x] **RULE-09** : Le Valet échange un de ses pions du parcours avec le pion d'un autre joueur (adversaire ou partenaire) sur le parcours ; on ne peut pas échanger deux de ses propres pions, ni un pion de l'écurie ou de la maison, ni un pion protégé sur sa sortie.
- [x] **RULE-10** : Le 7 se répartit entre ses pions en sous-déplacements dont la somme fait exactement 7 ; s'il est impossible de jouer les 7 pas en entier, le 7 est injouable.
- [x] **RULE-11** : Le 7 mange tout pion adverse ou partenaire qu'il dépasse ou sur lequel il s'arrête ; il peut dépasser ses propres pions sans les manger.
- [x] **RULE-12** : S'arrêter sur un pion adverse ou partenaire le mange (retour à son écurie) ; on ne peut jamais s'arrêter sur un de ses propres pions.
- [x] **RULE-13** : Un pion arrêté sur la case de sortie de sa propre couleur est protégé et infranchissable : aucun pion ne peut le dépasser, le manger ni l'échanger ; un pion d'une autre couleur sur cette case est un pion normal.
- [x] **RULE-14** : Sortir un pion sur sa case de sortie occupée par un pion d'une autre couleur mange ce pion ; c'est impossible si son propre pion y est déjà.
- [x] **RULE-15** : Un pion doit avoir fait le tour complet pour entrer dans sa maison par sa case d'entrée, au compte exact jusqu'à une case vide, sans sauter un pion déjà rentré ; si le compte ne tombe pas juste (ou si la case visée est occupée), il dépasse son entrée et repart pour un tour ; si le compte tombe juste, l'entrée est obligatoire ; un pion rentré peut encore avancer dans la maison au compte exact.
- [x] **RULE-16** : Si aucune carte de la main n'est jouable, le joueur pose toute sa main face visible et attend la donne suivante.
- [x] **RULE-17** : Un joueur dont les 4 pions sont rentrés joue ensuite avec les pions de son partenaire, qui comptent alors comme les siens pour toutes les cartes.
- [x] **RULE-18** : L'équipe qui rentre ses 8 pions gagne la partie.
- [ ] **RULE-19** : Chaque joueur ne connaît que sa propre main ; les cartes jouées sont publiques ; le serveur n'envoie jamais à un client la main d'un autre joueur.
- [x] **RULE-20** : Les règles sont rédigées et numérotées dans un document RULES.md validé par Romain, chaque règle illustrée par un scénario de test.

### Jouer un tour (PLAY)

- [ ] **PLAY-01** : Le joueur voit sa main et, quand c'est son tour, les cartes jouables et les pions concernés sont mis en évidence.
- [ ] **PLAY-02** : Le joueur choisit une carte puis un pion (ou une cible), voit un aperçu du trajet et des pions qui seraient mangés, puis confirme son coup.
- [ ] **PLAY-03** : Avec le 7, le joueur répartit les pas entre ses pions à l'aide d'un assistant pas à pas qui affiche le reste à jouer, puis confirme en une fois.
- [ ] **PLAY-04** : Avec l'As ou le Roi, le joueur choisit entre sortir un pion et avancer.
- [ ] **PLAY-05** : En début de donne, le joueur choisit la carte à passer à son partenaire et voit qui doit encore choisir.
- [ ] **PLAY-06** : Une aide en français rappelle les règles et l'effet de chaque carte à tout moment.
- [ ] **PLAY-07** : À la fin de la partie, l'équipe gagnante est annoncée et les joueurs peuvent relancer une revanche à la même table.

### Multijoueur en ligne (NET)

- [ ] **NET-01** : Quatre joueurs sur des téléphones ou ordinateurs différents jouent la même partie en temps réel ; le serveur valide chaque coup.
- [ ] **NET-02** : Un joueur qui recharge la page ou perd le réseau retrouve la partie dans son état exact en se reconnectant.
- [ ] **NET-03** : Quand un humain se déconnecte, la partie se met en pause et tous les joueurs le voient.
- [ ] **NET-04** : Après un délai, le créateur de la table choisit : attendre encore, confier la place à l'ordinateur (le joueur la récupère à son retour), ou sauvegarder la partie pour plus tard.
- [ ] **NET-05** : Les joueurs d'une table échangent par chat texte pendant la partie.

### Comptes et amis (ACCT)

- [ ] **ACCT-01** : Un joueur crée un compte (pseudo) et se connecte par passkey, avec un code reçu par e-mail pour l'inscription et la récupération.
- [ ] **ACCT-02** : La session reste ouverte entre les visites, y compris dans l'application installée.
- [ ] **ACCT-03** : Un joueur ajoute un ami avec un code ou un lien d'invitation, et voit sa liste d'amis.
- [ ] **ACCT-04** : Un joueur crée une table, invite des amis, répartit les places et les équipes, et règle le niveau de l'ordinateur pour chaque place libre.
- [ ] **ACCT-05** : Un joueur lance une partie solo contre trois joueurs gérés par l'ordinateur.

### Joueurs gérés par l'ordinateur (BOT)

- [ ] **BOT-01** : Chaque place gérée par l'ordinateur a une force réglable de 1 à 5.
- [ ] **BOT-02** : Le niveau 1 joue un coup légal au hasard ; chaque niveau supérieur gagne nettement plus souvent que le précédent dans des parties simulées.
- [ ] **BOT-03** : Le niveau 5 joue pour son équipe (protéger, aider le partenaire, choisir la carte d'échange).
- [ ] **BOT-04** : L'ordinateur ne joue qu'avec les informations qu'un humain aurait à sa place (pas de triche sur les mains cachées).
- [ ] **BOT-05** : L'ordinateur marque un temps de réflexion naturel avant de jouer et ne dépasse jamais quelques secondes.

### Suivi (HIST)

- [ ] **HIST-01** : Une partie peut être interrompue puis reprise plus tard dans l'état exact où elle était.
- [ ] **HIST-02** : Un joueur consulte l'historique de ses parties (date, équipes, résultat).
- [ ] **HIST-03** : Un joueur consulte ses statistiques et celles de ses équipes (parties, victoires, pions mangés…).
- [ ] **HIST-04** : Un classement entre amis est affiché.

### Rendu et ambiance (FX)

- [x] **FX-01** : Le plateau original (4 quarts) est affiché assemblé, net et lisible sur téléphone en portrait comme sur grand écran.
- [ ] **FX-02** : Les pions sont des cavaliers d'échecs en « fausse 3D » (ombre, dégradés, reflets) aux 4 couleurs.
- [ ] **FX-03** : Les pions s'animent quand ils sortent de l'écurie, avancent case par case, mangent, sont mangés (retour à l'écurie), entrent dans la maison et sont échangés au Valet.
- [x] **FX-04** : La durée d'un déplacement dépend de la distance parcourue, et les bruits de sabots suivent la même cadence.
- [x] **FX-05** : Des bruitages accompagnent les actions (hennissements à la sortie et lors des prises, sons de cartes) ; ils sont libres de droits ou générés, avec la licence de chaque fichier tracée.
- [ ] **FX-06** : Le joueur peut couper le son et réduire les animations ; le jeu reste entièrement jouable sans son.

### Application (APP)

- [ ] **APP-01** : Le jeu s'installe comme application (PWA) sur téléphone et ordinateur, avec une icône et un écran de démarrage.
- [ ] **APP-02** : Une mise à jour du jeu ne recharge jamais une partie en cours ; le joueur est invité à mettre à jour.
- [ ] **APP-03** : Le joueur reçoit une notification quand c'est son tour ou qu'on l'invite à une table (sur iOS : application installée).
- [ ] **APP-04** : Un tutoriel interactif fait jouer une partie guidée pour apprendre les règles.
- [ ] **APP-05** : L'interface est en français et accessible (repères des places pas uniquement par la couleur, zones tactiles assez grandes).

## v2 Requirements

- **V2-01** : Revoir une partie terminée (replay) et ses temps forts.
- **V2-02** : Bouton conseil (l'ordinateur suggère un coup).
- **V2-03** : Spectateurs à une table (sans voir les mains).
- **V2-04** : Options de règles réglables par le créateur de la table.
- **V2-05** : Partie solo hors ligne.
- **V2-06** : Thèmes de pions ou de plateau.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Matchmaking public avec des inconnus | Jeu familial et entre amis ; évite la modération |
| Discussion vocale | Le chat texte suffit |
| Classement mondial / Elo | Pas de public ouvert |
| Annuler un coup après validation | Incompatible avec les mains cachées et l'IA ; remplacé par aperçu + confirmation |
| Minuteur strict qui joue à la place | Contredit la pause en cas de déconnexion |
| Vraie 3D (Three.js) | Choix de cavaliers en fausse 3D, plus légers sur mobile |
| Variante à 6 joueurs | Le plateau est prévu pour 4 |
| Applications natives sur les stores | La PWA couvre le besoin |
| Autres langues | Interface en français uniquement |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RULE-01 | Phase 1 | Complete |
| RULE-02 | Phase 1 | Complete |
| RULE-03 | Phase 1 | Complete |
| RULE-04 | Phase 1 | Complete |
| RULE-05 | Phase 1 | Complete |
| RULE-06 | Phase 1 | Complete |
| RULE-07 | Phase 1 | Complete |
| RULE-08 | Phase 1 | Complete |
| RULE-09 | Phase 1 | Complete |
| RULE-10 | Phase 1 | Complete |
| RULE-11 | Phase 1 | Complete |
| RULE-12 | Phase 1 | Complete |
| RULE-13 | Phase 1 | Complete |
| RULE-14 | Phase 1 | Complete |
| RULE-15 | Phase 1 | Complete |
| RULE-16 | Phase 1 | Complete |
| RULE-17 | Phase 1 | Complete |
| RULE-18 | Phase 1 | Complete |
| RULE-19 | Phase 2 | Pending |
| RULE-20 | Phase 1 | Complete |
| PLAY-01 | Phase 1 | Pending |
| PLAY-02 | Phase 1 | Pending |
| PLAY-03 | Phase 1 | Pending |
| PLAY-04 | Phase 1 | Pending |
| PLAY-05 | Phase 1 | Pending |
| PLAY-06 | Phase 5 | Pending |
| PLAY-07 | Phase 2 | Pending |
| NET-01 | Phase 2 | Pending |
| NET-02 | Phase 2 | Pending |
| NET-03 | Phase 2 | Pending |
| NET-04 | Phase 2 | Pending |
| NET-05 | Phase 2 | Pending |
| ACCT-01 | Phase 4 | Pending |
| ACCT-02 | Phase 4 | Pending |
| ACCT-03 | Phase 4 | Pending |
| ACCT-04 | Phase 4 | Pending |
| ACCT-05 | Phase 4 | Pending |
| BOT-01 | Phase 3 | Pending |
| BOT-02 | Phase 3 | Pending |
| BOT-03 | Phase 3 | Pending |
| BOT-04 | Phase 3 | Pending |
| BOT-05 | Phase 3 | Pending |
| HIST-01 | Phase 2 | Pending |
| HIST-02 | Phase 5 | Pending |
| HIST-03 | Phase 5 | Pending |
| HIST-04 | Phase 5 | Pending |
| FX-01 | Phase 1 | Complete |
| FX-02 | Phase 1 | Pending |
| FX-03 | Phase 1 | Pending |
| FX-04 | Phase 1 | Complete |
| FX-05 | Phase 1 | Complete |
| FX-06 | Phase 1 | Pending |
| APP-01 | Phase 4 | Pending |
| APP-02 | Phase 4 | Pending |
| APP-03 | Phase 4 | Pending |
| APP-04 | Phase 5 | Pending |
| APP-05 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 57 total
- Mapped to phases: 57
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-13*
*Last updated: 2026-10-13 after roadmap creation*
