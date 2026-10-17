---
status: testing
phase: 02-jouer-en-ligne-entre-proches
source: [02-CONTEXT.md, 02-UI-SPEC.md, 02-10-SUMMARY.md]
started: 2026-10-17T16:45:00Z
updated: 2026-10-17T16:45:00Z
---

## Current Test

number: 1
name: "L’accueil (iPhone tenu en largeur puis en hauteur, Android, ordinateur)"
expected: |
  Ouvre https://toc.romaindetroyat.workers.dev. L’accueil montre le logo, « TOC » et deux grandes tuiles en chêne : « Jouer contre l’ordinateur » (« Sur cet appareil, même sans réseau ») et « Créer une table en ligne » (« Invite tes proches avec un lien »). À côté ou dessous, « Mes parties en cours » (« Aucune partie en cours » la première fois). Tout tient sans défiler, téléphone tenu en largeur comme en hauteur. Touche « Jouer contre l’ordinateur » : l’écran de choix de couleur s’ouvre (adresse #/ordinateur), avec un bouton « Accueil ». Puis mets l’iPhone en mode avion, rouvre l’app depuis l’écran d’accueil et lance une partie contre l’ordinateur : elle marche sans réseau.
awaiting: user response

## Tests

Tous les tests se font sur https://toc.romaindetroyat.workers.dev, sur l’iPhone tenu en largeur, sur un téléphone Android si quelqu’un de la famille en a un, et sur l’ordinateur. Pour les tests à plusieurs, il faut deux à quatre appareils (ou un appareil et des fenêtres privées sur l’ordinateur).

### 1. L’accueil (iPhone tenu en largeur puis en hauteur, Android, ordinateur)
expected: Ouvre https://toc.romaindetroyat.workers.dev. L’accueil montre le logo, « TOC » et deux grandes tuiles en chêne : « Jouer contre l’ordinateur » (« Sur cet appareil, même sans réseau ») et « Créer une table en ligne » (« Invite tes proches avec un lien »). À côté ou dessous, « Mes parties en cours » (« Aucune partie en cours » la première fois). Tout tient sans défiler, téléphone tenu en largeur comme en hauteur. Touche « Jouer contre l’ordinateur » : l’écran de choix de couleur s’ouvre (adresse #/ordinateur), avec un bouton « Accueil ». Puis mets l’iPhone en mode avion, rouvre l’app depuis l’écran d’accueil et lance une partie contre l’ordinateur : elle marche sans réseau.
result: pending

### 2. Ton prénom et la création d’une table
expected: Touche « Créer une table en ligne ». La fenêtre « Ton prénom » s’ouvre (« Les autres joueurs le verront à la table. », « Cet appareil s’en souviendra. »). « Continuer » sans rien écrire affiche « Écris ton prénom pour continuer. ». Écris ton prénom (20 caractères au plus) et touche « Continuer » : « Création de la table… », puis la salle d’attente « Table de Romain ». De retour à l’accueil, « Ton prénom : Romain » s’affiche avec « Changer », et la table est dans « Mes parties en cours ». Le prénom n’est plus demandé à la table suivante.
result: pending

### 3. Inviter par WhatsApp ou SMS, et par le code QR
expected: Juste après la création, la fenêtre « Inviter à la table » s’ouvre toute seule : le code QR à gauche, « Partager le lien » et « Copier le lien » à droite. « Partager le lien » ouvre le partage du téléphone ; envoie le lien par WhatsApp ou par SMS à un proche : le message dit « Romain t’invite à une partie de TOC ! ». « Copier le lien » affiche « Lien copié. ». Avec l’appareil photo d’un autre téléphone, scanne le code QR : la table s’ouvre. La personne invitée voit « Romain t’invite à une partie de TOC. » au-dessus de son prénom. Dans la salle d’attente, « Inviter » rouvre la fenêtre pour tout le monde.
result: pending

### 4. La salle d’attente
expected: Chaque personne touche une place libre et la prend (Bleu joue avec Rouge, Jaune avec Vert). Ta place dit « toi », les autres « en ligne » ; une place vide dit « Ordinateur » et sa force. Le chef de table (toi, avec une petite couronne) touche la place de quelqu’un : « Déplacer Paul » propose « Vers Jaune (place libre) » ou « Échanger avec Léa (Vert) ». Celui qui est déplacé lit « Romain a changé ta place : tu es maintenant Jaune. ». À droite, le chef de table règle la force de chaque ordinateur (Galopeur au départ) ; les autres lisent « Romain choisit la force de l’ordinateur et lance la partie. ». Si quelqu’un est là sans place, « Lancer la partie » demande d’abord « Lancer sans Léa ? ». À quatre, il est écrit « Quatre joueurs à la table : pas d’ordinateur. ».
result: pending

### 5. Une partie à quatre, chacun sur son appareil
expected: Quatre personnes, chacune sur son appareil, prennent les quatre couleurs. Le chef de table lance. Chacun reçoit ses cinq cartes, passe une carte à son partenaire, puis la partie se joue jusqu’au bout, chacun à son tour. C’est le serveur qui distribue et qui vérifie chaque coup : un coup interdit ne peut pas être joué, même en touchant très vite. À la fin, les quatre écrans montrent la planche de fin, « Victoire ! » pour une équipe et « Défaite » pour l’autre. Les tests automatiques ont joué une partie entière entre quatre navigateurs, sans ordinateur : 423 coups en moins de 3 minutes sur l’ordinateur de test. Dis si le rythme et l’enchaînement te paraissent bons à quatre.
result: pending

### 6. Une partie avec des places tenues par l’ordinateur
expected: Lance une table avec une ou deux personnes et des ordinateurs, dont au moins un Champion. Pendant qu’un ordinateur réfléchit, son signe « réfléchit » respire, comme contre l’ordinateur. Il joue à un rythme naturel : vite quand il n’a qu’un coup, jusqu’à 2 secondes environ pour un coup délicat. Le jeu est sur l’offre gratuite de Cloudflare, qui limite le calcul à chaque réveil du serveur : le Champion découpe donc sa réflexion en petits morceaux. Il ne doit jamais rester bloqué : si un ordinateur « réfléchit » plus de 10 secondes, ou si la table s’arrête sans raison, note l’heure et dis-le. Attention : le 17 octobre, sur la version alors en ligne, chaque coup d’un ordinateur (Galopeur comme Champion) attendait une minute entière ; en local, c’est 3 secondes au plus. La correction est faite et sera en ligne avec cette version : vérifie que les ordinateurs ont retrouvé ce rythme naturel. Budget : une partie avec trois Champions écrit environ 15 500 lignes, soit environ 6 parties par jour dans l’offre gratuite (100 000 lignes par jour) ; avec trois Galopeurs, environ 1 375 lignes, soit environ 70 parties par jour.
result: pending

### 7. Personne ne voit la main d’un autre
expected: Pendant une partie à plusieurs, rien à l’écran ne montre les cartes d’un autre joueur, ni la carte que ton partenaire t’a passée avant l’échange, même après avoir rechargé la page. Les tests automatiques ont vérifié chaque message reçu par chaque appareil : pendant toute une partie à quatre navigateurs, chaque appareil n’a reçu que ses propres cartes ; le serveur a aussi été vérifié coup par coup, à chaque force de l’ordinateur. Ici, regarde simplement que rien ne te paraît « en trop ».
result: pending

### 8. Recharger la page, couper le Wi-Fi
expected: En pleine partie, recharge la page : tu retrouves exactement la même partie (tes cartes, le plateau, le tour). Puis coupe le Wi-Fi et les données : pendant 2 secondes rien ne change, puis « Connexion perdue. Reconnexion… » remplace la consigne, et après 10 secondes une plaque « Connexion perdue » s’affiche avec « Réessayer maintenant » et « Retour à l’accueil ». Remets le réseau : « De retour à la table. », et la partie reprend là où elle en était.
result: pending

### 9. Téléphone verrouillé ou autre appli
expected: Sur l’iPhone, puis sur Android : en pleine partie, verrouille le téléphone, ou passe dans une autre appli. Les autres voient la partie se mettre en pause (« En attente de Romain… ») au plus tard en un peu moins de 2 minutes, souvent tout de suite. Le réglage choisi : ton téléphone fait signe toutes les 20 secondes ; sans signe pendant 75 secondes, le serveur te compte absent ; il vérifie toutes les 30 secondes. Quand tu reviens, la partie reprend toute seule. Note combien de temps les autres ont attendu avant de voir la pause.
result: pending

### 10. Après une minute : attendre, confier à l’ordinateur, sauvegarder
expected: Quand quelqu’un manque, une plaque au milieu du plateau dit « En attente de Marie… » avec un compte à rebours « Dans 0:42, Romain pourra choisir la suite. ». Après la minute, le chef de table choisit entre « Attendre encore une minute », « Confier sa place à l’ordinateur » (puis la force, Galopeur au départ) et « Sauvegarder et arrêter ». Si l’ordinateur joue pour Marie, son nom devient « Marie (ordinateur) ». Quand Marie revient, elle lit « Tu reprends ta place. L’ordinateur a joué pour toi pendant ton absence. » et rejoue elle-même.
result: pending

### 11. Le chef de table s’absente
expected: En pleine partie, le chef de table verrouille son téléphone. Le joueur suivant lit « Tu es chef de table jusqu’au retour de Romain. » et c’est lui qui choisit la suite après la minute. Quand Romain revient, tout le monde lit « Romain est de retour et redevient chef de table. ».
result: pending

### 12. Arrêter la partie et la reprendre un autre jour
expected: En pleine partie, le chef de table ouvre « Réglages » et touche « Arrêter la partie » (confirmé par « Arrêter la partie ? »). Tout le monde voit « Partie sauvegardée ». Le lendemain, chacun rouvre le même lien, ou touche la partie dans « Mes parties en cours » sur son appareil (« Sauvegardée · hier »). Le chef de table touche « Reprendre la partie » : la partie repart avec exactement les mêmes mains, le même plateau et le même tour. Une partie sans activité pendant 30 jours est effacée.
result: pending

### 13. Le lien ouvert dans WhatsApp puis dans Safari : « C’est moi »
expected: Une personne ouvre le lien dans WhatsApp (le navigateur intégré), prend sa place, la partie commence. Puis elle ferme WhatsApp et ouvre le même lien dans Safari : ce n’est pas le même appareil pour le jeu. Elle voit « La partie a déjà commencé » puis « C’est ta place ? » et touche « C’est moi, Marie ». Le chef de table voit « Rendre sa place à Marie ? » et touche « Rendre sa place » : Marie reprend sa partie dans Safari. Avec « Refuser », elle lit « Demande refusée ».
result: pending

### 14. Arriver après le début
expected: Une fois la partie lancée, quelqu’un d’autre ouvre le lien. Il voit « La partie a déjà commencé » et « Seuls les joueurs de cette partie peuvent la rejoindre. ». Il ne peut pas prendre une place tenue par l’ordinateur.
result: pending

### 15. Les messages rapides
expected: En partie, touche « Messages » (touche « M » sur l’ordinateur). La fenêtre « Messages rapides » propose « Bien joué ! », « Aïe ! », « Merci partenaire », « À toi ! », « Pardon… », « On y est presque », « Bravo ! », puis 😂 👏 😮 🐴 ❤️, et les cinq derniers messages. Un message envoyé apparaît 4 secondes chez tout le monde, dans une bulle crème bordée de ta couleur, à côté de ton cavalier, avec ton prénom. On peut toucher le plateau à travers. Plus de trois messages en 5 secondes : « Doucement : attends un peu avant le prochain message. ».
result: pending

### 16. La fin de partie et la revanche
expected: À la fin, chaque écran montre la planche de fin de son côté : « Victoire ! » pour l’équipe gagnante, « Défaite » pour l’autre. « Revanche » et « Quitter la table » remplacent les boutons habituels. Quatre pastilles montrent qui est d’accord (les ordinateurs le sont toujours). Quand tout le monde est d’accord : « Tout le monde est d’accord : nouvelle partie ! », puis une nouvelle donne aux mêmes places, avec les mêmes équipes et les mêmes forces.
result: pending

### 17. Le son après une reconnexion
expected: Sur l’iPhone, en pleine partie en ligne, verrouille l’écran une minute puis reviens. Après la reconnexion, les sabots et les autres bruitages jouent toujours (si le son est coupé sur l’iPhone, touche une fois l’écran). Dis si un son manque.
result: pending

### 18. L’historique des parties (D1)
expected: Chaque partie finie doit laisser une ligne anonyme dans la base D1 (prénoms, forces, équipe gagnante, durée), pour l’historique de la phase 5. La base est créée au moment de la mise en ligne si le jeton de déploiement a le droit « D1 Edit » : le compte rendu de la mise en ligne dit si c’est fait. Si elle n’existe pas encore, le jeu marche quand même, mais les parties finies d’ici là ne seront jamais enregistrées. Dans ce cas, donne le droit « D1 Edit » au jeton et demande que l’étape de création de la base soit relancée. Termine une partie, puis dis-le : on vérifie qu’une ligne a bien été écrite.
result: pending

### 19. Un 7 partagé en cinq morceaux ou plus
expected: À une table en ligne, joue un 7 en revenant sur un cavalier, par exemple 1 case pour le cavalier A, 1 pour B, 1 pour A, 1 pour B, puis 3 pour A. Le coup se joue normalement. Avant la correction du 2026-10-17, l’écran affichait « La table ne répond pas » et la partie restait bloquée. Depuis, si le serveur refuse un coup, l’écran dit « Ce coup n’est pas permis. Choisis-en un autre. » et c’est toujours ton tour.
result: pending

### 20. À confirmer : l’accueil
expected: Deux grandes tuiles en chêne, « Jouer contre l’ordinateur » (« Sur cet appareil, même sans réseau ») et « Créer une table en ligne » (« Invite tes proches avec un lien »), sans bouton ambre ; dessous ou à côté, « Mes parties en cours ». L’écran de choix de couleur contre l’ordinateur est à l’adresse #/ordinateur, avec un bouton « Accueil ». Ça te va ?
result: pending

### 21. À confirmer : « chef de table »
expected: Le créateur de la table s’appelle « chef de table » et porte une petite couronne. Le rôle passe au joueur suivant quand il s’absente, et lui revient à son retour. Le mot te convient-il ?
result: pending

### 22. À confirmer : le prénom
expected: Le prénom est demandé une fois, jusqu’à 20 caractères. « Changer » sur l’accueil permet de le modifier. L’invitation dit « Romain t’invite à une partie de TOC. ». Ça te va ?
result: pending

### 23. À confirmer : l’invitation
expected: Une fenêtre avec le code QR à gauche, « Partager le lien » et « Copier le lien » à droite. Elle s’ouvre toute seule pour le créateur juste après la création, et tout joueur de la salle d’attente peut la rouvrir avec « Inviter ». Ça te va ?
result: pending

### 24. À confirmer : la salle d’attente
expected: La même mise en page que l’écran contre l’ordinateur. Les places en 2 × 2 : Bleu et Rouge dans une colonne, Jaune et Vert dans l’autre. À droite, pour le chef de table, la force de chaque ordinateur (Galopeur au départ) et « Lancer la partie ». Pour déplacer quelqu’un, le chef de table touche sa place et choisit « Vers Jaune » ou « Échanger avec Paul ». Avec quelqu’un sans place, « Lancer sans Léa ? » est demandé. Les forces choisies contre l’ordinateur sur cet appareil ne servent pas en ligne. Ça te va ?
result: pending

### 25. À confirmer : l’écran tenu en hauteur
expected: L’accueil, le prénom et les messages d’erreur marchent dans les deux sens. La salle d’attente et la partie demandent « Tourne ton téléphone », comme aujourd’hui. Ça te va ?
result: pending

### 26. À confirmer : l’état des joueurs
expected: Un petit rond sur le cavalier dessiné de chaque place : un Wi-Fi barré quand le joueur est hors ligne, un robot quand l’ordinateur joue pour lui. La liste « À la table » est dans la fiche « Infos de la partie » sur le téléphone, et derrière un bouton « À la table » sur l’ordinateur. Ça te va ?
result: pending

### 27. À confirmer : la pause
expected: Une plaque au milieu du plateau, « En attente de Marie… », avec un compte à rebours « Dans 0:42, Paul pourra choisir la suite. ». Après la minute, le chef de table choisit entre « Attendre encore une minute », « Confier sa place à l’ordinateur » (puis la force, Galopeur au départ) et « Sauvegarder et arrêter ». Le plateau reste visible sous un léger voile ; « Messages », « Réglages » et la pastille restent utilisables. Ça te va ?
result: pending

### 28. À confirmer : ma connexion perdue
expected: Rien pendant 2 secondes, puis « Connexion perdue. Reconnexion… » à la place de la consigne, puis après 10 secondes une plaque avec « Réessayer maintenant » et « Retour à l’accueil ». Ces délais te conviennent-ils ?
result: pending

### 29. À confirmer : le nom d’une place confiée à l’ordinateur
expected: Quand l’ordinateur joue pour Marie : « Tour de Marie (ordinateur) », « Marie (ordinateur) réfléchit… ». Ça te va ?
result: pending

### 30. À confirmer : « Avance rapide » caché en ligne
expected: En ligne, « Avance rapide » n’apparaît pas, et le réglage choisi contre l’ordinateur ne s’applique pas : c’est le serveur qui règle le rythme des ordinateurs pour tout le monde. Sur le téléphone, sa place est prise par « Messages ». Ça te va ?
result: pending

### 31. À confirmer : les messages rapides
expected: Une fenêtre avec les sept phrases, puis la rangée 😂 👏 😮 🐴 ❤️ (tu avais mis 😂 parmi les phrases : il est rangé avec les émojis), et les cinq derniers messages ; touche « M » sur l’ordinateur. Un message reçu apparaît 4 secondes dans une bulle crème bordée de la couleur de l’expéditeur, à côté de son cavalier, avec son prénom ; on peut toucher le plateau à travers. Pas de son, et pas de messages sur la planche de fin. Ça te va ?
result: pending

### 32. À confirmer : la revanche
expected: « Revanche » remplace « Rejouer », et « Quitter la table » remplace « Changer de couleur ». Quatre pastilles montrent qui est d’accord (les ordinateurs le sont toujours). Un joueur hors ligne au moment de la revanche est remplacé par l’ordinateur (Galopeur) jusqu’à son retour. Ça te va ?
result: pending

### 33. À confirmer : rendre sa place
expected: Quelqu’un qui ouvre le lien sur un autre appareil (ou hors de WhatsApp) touche « C’est moi, Marie » ; le chef de table confirme par « Rendre sa place » ou « Refuser ». Ça te va ?
result: pending

### 34. À confirmer : « Arrêter la partie » et « Quitter la table »
expected: Dans les Réglages d’une partie en ligne, « Arrêter la partie » (chef de table seulement) et « Quitter la table » (tout le monde) remplacent « Abandonner la partie ». « Tester les sons » y est caché, parce que quitter la page couperait la connexion. Ça te va ?
result: pending

### 35. À confirmer : « Mes parties en cours »
expected: Retirer une partie de la liste ne l’efface que de cet appareil ; le message « Partie retirée de la liste. » propose « Remettre ». Une partie effacée après 30 jours sans jouer disparaît de la liste avec un message. Ça te va ?
result: pending

### 36. À confirmer : les délais de présence (20 s, 75 s, 30 s)
expected: Chaque appareil fait signe au serveur toutes les 20 secondes. Un appareil silencieux pendant 75 secondes (téléphone verrouillé, appli en arrière-plan) est compté absent, et la partie se met en pause. Le serveur vérifie toutes les 30 secondes. Une page fermée ou rechargée est vue tout de suite. Les autres attendent donc entre 75 secondes et un peu moins de 2 minutes avant de voir la pause d’un téléphone verrouillé (test 9). Faut-il plus court, ou plus long ?
result: pending

### 37. À confirmer : qui donne à la revanche
expected: À la revanche, le premier donneur est la place qui suit celle du premier donneur de la partie d’avant (dans l’ordre du jeu). Ça te va ?
result: pending

### 38. À confirmer : deux joueurs avec le même prénom
expected: Si deux joueurs ont le même prénom, rien n’est ajouté à leur nom : seule la couleur de leur place les distingue. Préfères-tu « Marie 2 » ?
result: pending

### 39. À confirmer : « Table en ligne » dans « Mes parties en cours »
expected: Pendant que le jeu vérifie une partie de la liste (ou sans réseau), sa première ligne dit « Table en ligne », parce que l’appareil ne garde pas les prénoms des autres. Dès que le serveur répond, elle dit « Avec Paul, Léa et Marie ». Ça te va ?
result: pending

### 40. À confirmer : une place libérée garde la force choisie
expected: Dans la salle d’attente, une place qu’une personne libère garde la force que le chef de table avait choisie pour cette couleur (Galopeur s’il n’avait rien choisi), au lieu de revenir toujours à Galopeur. Ça te va ?
result: pending

### 41. À confirmer : quitter la salle d’attente
expected: Quitter la salle d’attente avec « Quitter la table » retire aussi la table de « Mes parties en cours » sur cet appareil. En pleine partie, « Quitter la table » la garde dans la liste. Ça te va ?
result: pending

### 42. À confirmer : « Pas encore là » sur la partie sauvegardée
expected: Sur la plaque « Partie sauvegardée », la ligne « Pas encore là » ne cite pas un joueur dont l’ordinateur tenait déjà la place : à la reprise, l’ordinateur continue de jouer pour lui jusqu’à son retour. Ça te va ?
result: pending

### 43. À confirmer : pas de pause une fois la partie gagnée
expected: Quand la partie est gagnée, un joueur qui s’en va ne met plus la partie en pause : la planche de fin reste, et la revanche se décide sans lui (test 46). Ça te va ?
result: pending

### 44. À confirmer : une vraie coupure de réseau
expected: Quand un téléphone perd le réseau sans fermer la page, le serveur ne s’en rend compte qu’au bout des 75 secondes de silence, ou au retour du téléphone. Pendant ce temps, les autres ne voient pas encore la pause et attendent son coup. Ça te va, ou faut-il raccourcir les délais du test 36 ?
result: pending

### 45. À confirmer : reprendre une place que l’ordinateur tient
expected: Une place que l’ordinateur tient parce que son joueur est parti (place confiée) peut aussi être reprise avec « C’est moi, Marie » depuis un autre appareil, si le chef de table confirme. Le nouvel appareil reprend alors la place à l’ordinateur. Ça te va ?
result: pending

### 46. À confirmer : quitter la planche de fin lance la revanche des autres
expected: Un joueur qui quitte la planche de fin, ou dont le téléphone se tait 75 secondes, ne compte plus pour la revanche. Si tous les autres étaient d’accord, la nouvelle partie commence aussitôt sans lui, et l’ordinateur (Galopeur) tient sa place jusqu’à son retour. Ça te va ?
result: pending

### 47. À confirmer : une partie finie avant la création de la base
expected: Une partie terminée avant que la base D1 existe n’est jamais enregistrée plus tard (test 18). Ça te va ?
result: pending

### 48. À confirmer : quatre bulles sur un très petit téléphone
expected: Sur un très petit téléphone (480 × 320), les bulles des messages ne couvrent jamais une carte ni un bouton, mais elles peuvent se chevaucher entre elles si quatre joueurs écrivent en même temps. Ça te va ?
result: pending

### 49. À confirmer : pas de « Messages » sans place
expected: Dans la salle d’attente, une personne qui n’a pas encore pris de place ne voit pas le bouton « Messages » : le serveur n’accepte de messages que des joueurs assis. Ça te va ?
result: pending

## Summary

total: 49
passed: 0
issues: 0
pending: 49
skipped: 0
blocked: 0

## Gaps

[none yet]
