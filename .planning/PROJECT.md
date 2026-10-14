# TOC en ligne

## What This Is

Une adaptation numérique du TOC, le jeu de « petits chevaux » où l'on avance avec des cartes plutôt qu'avec des dés, joué à 4 en 2 équipes de 2. C'est une application web installable (PWA) qui permet à une famille et à un cercle d'amis de jouer ensemble depuis leurs téléphones et ordinateurs. Les places vides sont tenues par des joueurs gérés par l'ordinateur, de force réglable. Le jeu reprend le plateau illustré que Romain a dessiné pour la version physique du jeu, avec des pions en forme de cavaliers animés et sonorisés.

## Core Value

Une vraie partie de TOC, fidèle aux règles maison, jouable à distance entre proches sur n'importe quel appareil, avec l'ambiance du plateau original (chevaux animés, bruitages). Romain veut l'ensemble dès la première version jouable : règles justes, multijoueur, IA et ambiance.

## Requirements

### Validated

(None yet — ship to validate)

### Active

**Règles du jeu (variante maison)**
- [ ] 4 joueurs en 2 équipes ; les partenaires sont face à face (jaune + vert contre rouge + bleu)
- [ ] Jeu de 52 cartes sans joker ; donnes de 5, 4 puis 4 cartes, puis on rebat ; le donneur tourne
- [ ] En début de donne, chaque joueur passe une carte face cachée à son partenaire
- [ ] As : sortir un pion de l'écurie **ou** avancer de 1
- [ ] Roi : sortir un pion **ou** avancer de 13
- [ ] Dame : avancer de 12 ; Valet : échanger un de ses pions avec n'importe quel autre pion du parcours
- [ ] 10, 9, 8, 6, 5, 3, 2 : avancer du nombre indiqué (le 5 ne fait avancer que ses propres pions)
- [ ] 7 : 7 pas répartis entre ses pions ; il mange tout pion adverse qu'il dépasse, dépasse sans les manger ses pions et ceux de son partenaire, et mange le pion (adverse ou partenaire) sur lequel il s'arrête
- [ ] 4 : reculer de 4
- [ ] Prise : s'arrêter sur un pion adverse ou du partenaire le renvoie à son écurie ; on ne peut pas prendre ses propres pions
- [ ] Un pion sur sa case de sortie (losange 18) est infranchissable : personne ne peut le dépasser, le manger ni l'échanger
- [ ] Entrée dans la maison (4 cases d'arrivée) au compte exact, sans sauter un pion déjà rentré, même sans tour complet (depuis le 2026-10-14)
- [ ] Si aucune carte n'est jouable, le joueur pose toute sa main et attend la donne suivante
- [ ] Un joueur dont les 4 pions sont rentrés continue avec les pions de son partenaire
- [ ] L'équipe qui rentre ses 8 pions gagne

**Multijoueur en ligne**
- [ ] Comptes joueurs et liste d'amis ; on invite ses amis à une table
- [ ] Parties en temps réel entre plusieurs téléphones et ordinateurs ; le serveur fait autorité sur les règles (anti-triche, mains cachées)
- [ ] Si un humain se déconnecte, la partie se met en pause jusqu'à son retour (avec un délai maximum)
- [ ] Chat texte dans la partie
- [ ] Les places libres sont complétées par des joueurs gérés par l'ordinateur

**Joueurs gérés par l'ordinateur**
- [ ] Force réglable de 1 à 5, par place ; le niveau 1 joue un coup légal au hasard, le niveau 5 joue pour l'équipe, anticipe et soigne l'échange de carte
- [ ] Une partie solo est possible (1 humain contre 3 joueurs gérés par l'ordinateur)

**Suivi**
- [ ] Historique des parties et statistiques par joueur et par équipe
- [ ] Arrêter une partie et la reprendre plus tard
- [ ] Classement entre amis

**Rendu et ambiance**
- [ ] Le plateau « galet » dessiné par le code, le même sur ordinateur et sur téléphone, toujours en largeur (le téléphone tenu en largeur), lisible sur les deux
- [ ] Pions en forme de cavaliers d'échecs en « fausse 3D » (ombre portée, dégradés, reflets) aux 4 couleurs
- [ ] Animations : sortie d'écurie, déplacement case par case, prise (le pion qui mange), pion mangé (retour à l'écurie), arrivée à la maison, échange au Valet
- [ ] Bruitages : sabots dont la cadence suit la vitesse, hennissements ; la vitesse dépend de la distance à parcourir selon la carte jouée
- [ ] Application installable (PWA) sur téléphone et ordinateur

### Out of Scope

- Matchmaking public avec des inconnus — le jeu est destiné à la famille et aux amis ; cela éviterait la modération
- Discussion vocale — le chat texte suffit pour la v1
- Vraie 3D (Three.js) — le choix s'est porté sur des cavaliers d'échecs en fausse 3D, plus légers sur mobile
- Variante à 6 joueurs — le plateau dessiné est prévu pour 4
- Applications natives iOS/Android sur les stores — la PWA couvre le besoin

## Context

- **Graphismes existants** : `assets/plateau/quart-{jaune,rouge,bleu,vert}.webp`, 4 quarts de 1280×1280 px, le plateau original dessiné par Romain, gardés dans le dépôt comme son œuvre (le jeu ne les embarque plus). Assemblage d'origine : jaune en haut à gauche, rouge en haut à droite, bleu en bas à gauche, vert en bas à droite ; le carré vert central y forme le tapis où l'on pose les cartes. Depuis le 2026-10-14, le jeu dessine le plateau « galet » par le code (`packages/board`), en largeur, avec le cavalier à l'encre de Romain recolorié pour chaque couleur ; le tapis y est l'ellipse verte.
- **Parcours** : 72 cases. Le losange 18 de chaque couleur est sa case de sortie, à côté de son écurie (4 ronds alignés). Les numéros imprimés comptent la distance depuis la case de sortie précédente : depuis le 18 bleu, on avance sur 1 à 6 (quart bleu), puis 7 à 15, le carré 16, le 17 et le losange 18 (quart jaune), qui est la sortie jaune. Sens de rotation : bleu → jaune → rouge → vert → bleu, soit le sens horaire. Le carré 16 est la case d'entrée vers la maison de la couleur (4 ronds en diagonale vers le centre), deux cases avant sa propre sortie. Chaque quart porte un aide-mémoire des cartes spéciales et un cavalier dessiné à la couleur du joueur.
- **Équipes** : les partenaires sont face à face, donc jaune avec vert, et rouge avec bleu.
- **Prototype** : une première maquette de pions en SVG (dégradés, ombre, reflet) posés sur le plateau assemblé a validé l'approche « fausse 3D ».
- **Comptes disponibles** : Cloudflare, Vercel et Supabase sont déjà connectés. Cloudflare a été retenu.
- **Méthode** : le projet est développé avec GSD Core (installé en local dans `.claude/`).

## Constraints

- **Hébergement** : Cloudflare (Workers, Durable Objects pour les tables temps réel, D1/KV pour les comptes et l'historique) — choix de Romain
- **Plateforme** : PWA, aussi soignée sur téléphone que sur ordinateur
- **Graphismes** : le plateau « galet » en bois, dessiné par le code d'après la maquette choisie par Romain le 2026-10-14, le même sur ordinateur et sur téléphone, toujours en largeur (« paysage obligatoire »), avec ses cavaliers à l'encre ; les quatre quarts du plateau original restent dans `assets/plateau` comme son œuvre
- **Sons** : bruitages libres de droits (CC0 ou équivalent) ou générés par le code, pour pouvoir publier sans problème de licence
- **Langue** : interface en français

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Variante : le 5 ne joue que ses propres pions | Règle maison de Romain | — Pending |
| Variante : le 7 mange les adversaires qu'il dépasse et tout pion sur lequel il s'arrête ; il dépasse ses pions et ceux du partenaire sans les manger (changé le 2026-10-14) | Règle maison | — Pending |
| On peut manger le pion de son partenaire, jamais les siens | Règle maison | — Pending |
| Case de sortie infranchissable | Règle maison | — Pending |
| Main injouable : on pose toutes ses cartes jusqu'à la donne suivante | Règle maison | — Pending |
| Comptes + amis plutôt que lien anonyme | Suivi des stats, classement entre amis | — Pending |
| Déconnexion : la partie attend | Préférence de Romain | — Pending |
| Pions en cavaliers d'échecs « fausse 3D » plutôt que vraie 3D | Rendu léger et cohérent avec le plateau vu de dessus | — Pending |
| Hébergement Cloudflare | Adapté aux salons temps réel (Durable Objects) | — Pending |
| IA : curseur de force 1 à 5 | Réglage fin demandé | — Pending |
| Plateau galet dessiné par le code à la place des 4 quarts, le même partout, toujours en largeur (2026-10-14, recette test 4) | Romain, à propos du C+ : « trop laid », « Là, on ne voit rien sur ordi » ; puis « J'aime bien le galet », « galet partout », « Pour la version iphone, oblige à jouer en format paysage, ça permettra d'utiliser le même plateau » et « Oui, paysage obligatoire » | — Pending |
| Écran compact sur le téléphone tenu en largeur (« Compacter l'écran », 2026-10-14) | « Compacter l'écran » (Romain) ; le détail est dérivé, à confirmer par Romain (01-UI-SPEC.md, addendum « Plateau galet », points 8 à 10) | — Pending |

## Rule Decisions (validées par Romain le 2026-10-13)

- Sens de rotation horaire (bleu → jaune → rouge → vert) ; entrée dans la maison par son carré 16.
- Losange 18 infranchissable seulement quand le pion est de la couleur de cette sortie.
- Le 4 peut reculer un pion qui vient de sortir ; on n'entre jamais dans la maison en reculant. Depuis le 2026-10-14, le tour complet n'est plus obligatoire : un pion qui atteint son carré 16 en avançant entre au compte exact (RULES.md, G14).
- Le 7 peut dépasser ses propres pions sans les manger ; il doit être joué en entier, sinon il est injouable.
- Échange d'une carte avec le partenaire à chaque donne (5, 4 et 4).
- Le Valet ne peut pas échanger deux de ses propres pions.
- Déconnexion : pause ; après un délai, le créateur de la table choisit entre attendre, confier la place à l'ordinateur, ou sauvegarder.
- Les autres cas limites (listés dans `research/SUMMARY.md`, questions 5 à 34) suivent les hypothèses par défaut de la recherche ; ils seront formalisés dans RULES.md et relus par Romain avant le codage du moteur.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-14 after the UAT (plateau galet, paysage obligatoire, écran compact)*
