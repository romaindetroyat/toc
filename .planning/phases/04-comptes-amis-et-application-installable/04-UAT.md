---
status: testing
phase: 04-comptes-amis-et-application-installable
source: [04-CONTEXT.md, 04-UI-SPEC.md, 04-12-SUMMARY.md]
started: 2026-10-18T14:40:00Z
updated: 2026-10-18T17:38:48Z
---

## Current Test

number: 1
name: "Installer TOC sur l’iPhone"
expected: |
  Sur l’iPhone, ouvre https://toc.romaindetroyat.workers.dev dans Safari. L’accueil montre le bandeau « Installe TOC comme une application. » avec « Comment faire ». Touche « Comment faire » : la fenêtre « Installer TOC » explique les gestes. Touche Partager, puis « Sur l’écran d’accueil », puis « Ajouter ». L’icône est ton logo, avec le nom « TOC ». Ouvre TOC depuis l’icône en tenant l’iPhone en largeur : l’écran de démarrage montre le logo au centre sur le fond noyer, sans texte, puis l’accueil s’affiche en plein écran, sans la barre de Safari.
awaiting: user response

## Tests

Tous les tests se font sur https://toc.romaindetroyat.workers.dev : sur l’iPhone (dans l’application installée, sauf quand le test dit Safari), sur un téléphone Android si quelqu’un de la famille en a un, et sur l’ordinateur. Pour les tests à plusieurs, il faut deux comptes : le tien et celui d’un proche (ou un deuxième appareil). Le lien de ton premier compte t’a été donné en privé lors de la mise en ligne. Il ne marche qu’une fois, tant qu’aucun compte n’existe.

Le point d’arrêt de la phase (ce que seul un vrai téléphone peut montrer) suit ces étapes, dans cet ordre :
1. iPhone : installer TOC et voir l’écran de démarrage (test 1).
2. Dans l’application installée : créer ton compte avec Face ID, garder le code de secours (test 3).
3. Fermer complètement l’application, la rouvrir : la session est toujours ouverte (test 7).
4. « Mon compte » → « Activer les notifications » → autoriser : « Sur cet appareil » est activé (test 12).
5. Un proche dans tes amis t’invite à sa table pendant que TOC est fermé : la notification arrive, un geste ouvre la table (test 12).
6. Une partie ensemble, l’iPhone verrouillé : « C’est ton tour ! » environ 30 s après la pause ; aucune notification pendant que tu joues (tests 13 et 14).
7. Sur Android, si la famille en a un : « Installer », puis les étapes 2 à 5 (test 2).
8. Sur l’ordinateur : « Se connecter » avec le code QR et l’iPhone (test 6).
9. iPhone en mode avion : TOC s’ouvre depuis l’icône et « Jouer contre l’ordinateur » marche (test 15).

Réponds « approuvé », ou dis ce qui n’a pas marché et sur quel appareil.

### 1. Installer TOC sur l’iPhone
expected: Sur l’iPhone, ouvre https://toc.romaindetroyat.workers.dev dans Safari. L’accueil montre le bandeau « Installe TOC comme une application. » avec « Comment faire ». Touche « Comment faire » : la fenêtre « Installer TOC » explique les gestes. Touche Partager, puis « Sur l’écran d’accueil », puis « Ajouter ». L’icône est ton logo, avec le nom « TOC ». Ouvre TOC depuis l’icône en tenant l’iPhone en largeur : l’écran de démarrage montre le logo au centre sur le fond noyer, sans texte, puis l’accueil s’affiche en plein écran, sans la barre de Safari.
result: pending

### 2. Installer TOC sur Android et sur l’ordinateur
expected: Sur Android (Chrome) et sur l’ordinateur (Chrome ou Edge), l’accueil montre le bandeau « Installe TOC comme une application. » avec « Installer ». Touche « Installer » : le navigateur propose d’installer TOC. Accepte. TOC s’ouvre dans sa propre fenêtre, avec ton logo comme icône. Sur Android, l’écran de démarrage montre le logo sur le fond noyer. Une fois TOC installé, le bandeau ne s’affiche plus. Sur un autre appareil, « Plus tard » cache le bandeau pendant 30 jours. « Installer l’application » reste dans « Réglages ».
result: pending

### 3. Ton premier compte
expected: Dans l’application installée sur l’iPhone, ouvre le lien privé de ton premier compte (donné lors de la mise en ligne). Sur l’iPhone, toucher un lien ouvre toujours Safari, jamais l’application installée : copie donc le lien, ouvre TOC depuis son icône, touche la petite tuile « Se connecter », colle le lien dans « J’ai une invitation » et touche « Continuer » (test 60, en ligne après la prochaine mise en ligne). La page propose ton prénom comme pseudo. Choisis ton pseudo et touche « Créer mon compte ». L’iPhone demande Face ID ou Touch ID pour créer la clé d’accès. Ensuite s’affiche « Ton code de secours » : 20 caractères en cinq groupes. Fais une capture d’écran ou recopie-le sur papier, garde-le en lieu sûr. « J’ai gardé mon code » demande « Tu as bien gardé ton code ? ». Réponds « Oui, je l’ai gardé ». L’accueil affiche « Bienvenue, {ton pseudo} ! » et la petite tuile « Mon compte » avec ton pseudo. Le lien privé ne sert plus à rien ensuite.
result: pass — 2026-10-18, compte créé sur l’iPhone (Romain : « ok, c'est bon, c'est créé »), après le correctif 04-13 : d’abord « Il n'y a pas d'option face id » dans l’application installée, faute de pouvoir y ouvrir le lien.

### 4. Inviter un proche par un lien
expected: Touche la petite tuile « Mes amis », puis « Inviter un proche ». La fenêtre montre le lien, son code QR et « Ce lien sert une fois, jusqu’au … » (7 jours). Touche « Partager le lien » et envoie-le par WhatsApp ou par SMS. Ton proche ouvre le lien, choisit son pseudo, crée sa clé d’accès et garde son code. Son accueil affiche « Bienvenue, {son pseudo} ! {Ton pseudo} est maintenant dans tes amis. ». Chez toi, son pseudo est dans « Mes amis », et le lien n’est plus « en attente ». Rouvre le même lien sur un troisième appareil : « Cette invitation a déjà servi ».
result: pending

### 5. Le lien ouvert dans WhatsApp
expected: Ton proche touche le lien directement dans WhatsApp, sans passer par Safari ou Chrome. Deux réponses sont bonnes. Soit la page du pseudo s’ouvre et la création du compte marche. Soit la page dit « Ce navigateur ne sait pas créer de clé d’accès » avec « Copier le lien », pour le rouvrir dans Safari ou Chrome. Dis laquelle tu as vue, sur iPhone et sur Android.
result: pending

### 6. Se connecter sur l’ordinateur avec le téléphone
expected: Sur l’ordinateur, ouvre TOC. Touche la petite tuile « Se connecter », puis « Utiliser ma clé d’accès ». Le navigateur propose d’utiliser un téléphone et montre un code QR. Scanne-le avec l’appareil photo de l’iPhone et confirme avec Face ID. L’ordinateur affiche ton accueil avec « Mon compte » et ton pseudo, sans avoir tapé de pseudo. Sur un Mac ou un PC où ta clé est déjà synchronisée (trousseau iCloud, compte Google), le navigateur la propose directement.
result: pending

### 7. Pas besoin de se reconnecter
expected: Ferme complètement l’application installée (glisse-la vers le haut dans le sélecteur d’apps). Rouvre-la le lendemain : l’accueil affiche toujours « Mon compte » avec ton pseudo, sans « Se connecter ». Sur l’iPhone, l’application installée a sa propre session, à part de Safari : si tu as créé ton compte dans Safari, l’application te demande de te connecter une fois (« Utiliser ma clé d’accès »), puis plus jamais. Fais de même dans Safari et sur l’ordinateur.
result: pending

### 8. Le code ami
expected: Dans « Mes amis », touche « Ajouter avec un code », onglet « Donner mon code » : un code TOC-XXXX-XXXX s’affiche, « Valable 24 heures ». Dis-le à un proche qui a déjà un compte. Sur son appareil : « Ajouter avec un code », onglet « Entrer un code », le code tapé, puis « Ajouter ». Vous êtes chacun dans la liste de l’autre, tout de suite, sans demande à accepter. Un code faux affiche un message clair. « Nouveau code » remplace l’ancien, qui ne marche plus.
result: pending

### 9. Mes amis
expected: « Mes amis » liste tes amis, avec « Dans tes amis depuis … ». À droite, les liens d’invitation en attente, avec « Partager ce lien » sur l’appareil qui l’a créé et « Désactiver ». Touche le bouton de retrait à côté d’un ami : « Retirer {pseudo} de tes amis ? ». Confirme : son pseudo disparaît de ta liste, et le tien de la sienne.
result: pending

### 10. Une table avec tes amis
expected: Sur l’accueil, touche « Créer une table en ligne » : la salle d’attente « Table de {ton pseudo} » s’ouvre, sans demander de prénom. Touche « Inviter » : la fenêtre s’ouvre sur l’onglet « Mes amis » (« Lien et QR code » à côté). Touche « Inviter » à côté d’un ami : sa ligne affiche « Invitation envoyée ». Une fois à la table, sa ligne dit « Déjà à la table ». Place les joueurs, forme les équipes, choisis la force des places tenues par l’ordinateur (par exemple Trotteur et Pur-sang), puis touche « Lancer la partie ». Tout se passe comme en phase 2.
result: pending

### 11. L’invitation quand TOC est ouvert
expected: Ton ami a TOC ouvert sur l’accueil. Tu l’invites à ta table. En haut de son écran s’affiche une carte « {Ton pseudo} t’invite à sa table. », avec « Plus tard » et « Rejoindre ». « Rejoindre » l’amène dans ta salle d’attente, sous son pseudo, sans prénom à taper. Pendant une partie contre l’ordinateur, la carte attend la fin de la partie, et elle ne s’affiche que si ta table attend toujours.
result: pending

### 12. L’invitation quand TOC est fermé
expected: Sur l’iPhone, dans l’application installée : « Mon compte » → « Notifications » → « Activer les notifications », puis autorise. L’interrupteur « Sur cet appareil » est activé. Ferme TOC. Un ami t’invite à sa table : l’iPhone affiche une notification « Invitation à une table », « {Pseudo} t’invite à sa table de TOC. », au nom de « TOC ». Touche-la : TOC s’ouvre sur sa salle d’attente. Fais de même sur Android. Dans Safari (sans installer), « Mon compte » explique que les notifications marchent seulement dans l’application installée.
result: pending

### 13. C’est ton tour
expected: Lance une partie avec un ami. Pendant la partie, verrouille ton iPhone (ou quitte TOC). Chez les autres, la partie se met en pause. Environ 30 secondes après le début de la pause, ton iPhone affiche « C’est ton tour ! », « La table de {Pseudo} t’attend : la partie est en pause jusqu’à ton retour. ». Touche-la : tu reviens à ta place, et la pause s’arrête chez les autres. Si tu pars et reviens plusieurs fois pendant la même pause, une seule notification arrive. Dis si 30 secondes te paraît bien.
result: pending

### 14. Pas de notification pendant qu’on joue
expected: Pendant toute une partie où tu joues, TOC ouvert, aucune notification n’arrive sur ton appareil, ni « C’est ton tour ! », ni invitation. Une invitation reçue pendant une partie s’affiche dans TOC comme une carte, après la partie (test 11).
result: pending

### 15. Jouer contre l’ordinateur sans réseau
expected: Mets l’iPhone en mode avion. Ouvre TOC depuis son icône : l’application démarre, et l’accueil montre le bandeau « Pas de connexion : seul le jeu contre l’ordinateur marche. ». « Jouer contre l’ordinateur » lance une partie qui se joue entièrement. « Mon compte » et « Mes amis » affichent « Pas de connexion » avec « Réessayer » et « Jouer contre l’ordinateur ». Coupe le mode avion : la page se recharge seule.
result: pending

### 16. Une nouvelle version
expected: Après une prochaine mise en ligne, rouvre TOC : sur l’accueil, un bandeau « Nouvelle version disponible » avec « Mettre à jour ». Touche-le : TOC se recharge sur la nouvelle version. Pendant une partie ou à une table, rien ne s’affiche et rien ne se recharge : seule une ligne dans « Réglages » dit que la nouvelle version s’installera au retour à l’accueil. Ce test ne peut se faire qu’à la prochaine mise en ligne.
result: pending

### 17. Se déconnecter d’une tablette partagée
expected: Sur une tablette de la famille, connecte-toi et prends une place à une table. Puis « Mon compte » → « Se déconnecter ». La question « Se déconnecter de cet appareil ? » rappelle que les places de cet appareil ne seront plus jouables, avec le nombre de parties concernées. Confirme. Les parties de ton compte disparaissent de « Mes parties en cours » sur la tablette. Rouvre le lien de la table : « Connecte-toi pour reprendre ta place », avec « Se connecter » et « Retour à l’accueil ». « Se connecter » te rend ta place.
result: pending

### 18. Retrouver son compte avec le code de secours
expected: Sur un autre appareil, sans ta clé d’accès : « Se connecter » → « J’ai perdu ma clé : code de secours ». La page « Retrouver mon compte » demande ton pseudo et ton code de secours. Crée une nouvelle clé d’accès. Un nouveau code de secours s’affiche : garde-le, l’ancien ne marche plus. Tes autres appareils sont déconnectés et devront se reconnecter. Après 5 codes faux, il faut attendre 15 minutes.
result: pending

### 19. Sans compte, rien ne change
expected: Un proche sans compte ouvre le lien d’une table (partagé par WhatsApp ou par le code QR). Le prénom se tape comme en phase 2, et la partie se joue normalement. Sur son accueil, la seule nouveauté est la petite tuile « Se connecter » (« Créer un compte » dessous), qui explique qu’il faut le lien d’un proche pour créer un compte.
result: pending

### 20. Le budget de l’offre gratuite de Cloudflare
expected: |
  À lire, rien à faire. Les comptes, les amis et les notifications coûtent très peu. Pour une famille de 20 personnes avec 2 appareils chacune et 3 parties par jour chacune (environ 20 tables par jour), on estime par jour :

  | Ce qui compte | Par jour (estimation) | Limite gratuite par jour | Part |
  |---------------|------------------------|--------------------------|------|
  | Lignes écrites dans la base D1 | environ 250 | 100 000 | 0,25 % |
  | Lignes lues dans la base D1 | environ 3 500 | 5 000 000 | moins de 0,1 % |
  | Requêtes aux Durable Objects pour les comptes (ouverture de l’app, invitations, notifications) | environ 650 | 100 000 | 0,65 % |
  | Notifications envoyées | environ 80 (une par appareil abonné) | pas de limite chez Apple ni Google | — |

  Quelques repères mesurés : créer un compte écrit 17 lignes ; se connecter, 6 ; un appareil qui reste connecté, au plus 1 par semaine ; s’asseoir à une table avec son compte, 1 ; inviter un ami à une table, 0 (3 lignes lues) ; ajouter un ami par code, 6 ; activer les notifications, 3 ; une notification, 0. Ouvrir TOC fait 1 requête de plus vers ton « objet compte ».

  Ce qui pèse vraiment, ce sont les parties elles-mêmes (phases 2 et 3, inchangé) : une partie avec trois Galopeurs écrit environ 1 400 lignes dans la table, avec trois Champions environ 15 500. Ces lignes sont comptées à part de D1, sur les Durable Objects. 20 parties par jour avec des Galopeurs passent ; avec beaucoup de Champions, on dépasserait la limite gratuite (environ 6 parties « Champions » par jour). Si ça arrive, l’offre payante à 5 $ par mois lève la limite. Dis si ça te va.
result: pending

### 21. La mise en ligne
expected: |
  Faite par l’orchestrateur le 2026-10-18, avant la recette. Rien à faire pour toi, sauf vérifier que tout marche.
  - Version en ligne : la branche claude/phase-4-comptes au commit e50938b (jusqu’au plan 04-11), à https://toc.romaindetroyat.workers.dev. Le plan 04-12 ajoute une correction (un petit message affiché juste avant l’ouverture du plateau pouvait, sur un téléphone tenu en largeur, faire perdre un coup à l’écran : le cavalier restait en place). Elle n’est en ligne qu’après une nouvelle mise en ligne par l’orchestrateur (sans migration ni secret nouveau). Mise en ligne faite le 2026-10-18 : la version en ligne est le commit 66839e3 (correction comprise), vérifiée par smoke-online --read-only.
  - Secrets posés (les noms seulement, jamais les valeurs) : TOC_PEPPER, TOC_BOOTSTRAP, VAPID_PRIVATE_KEY.
  - Base D1 : la migration 0002 (les comptes) est appliquée sur la base en ligne.
  - Durable Objects : la migration v2 (PlayerHub, l’objet de chaque compte) est en ligne ; v1 est inchangée.
  - Contrôles faits par l’orchestrateur : le lien de ton premier compte répondait « ok » (premier compte) ; /api/push/key donne une clé ; /sw.js et /manifest.webmanifest répondent.
  - Contrôle en lecture seule refait le 2026-10-18 par le plan 04-12 (tools/smoke-online.mjs --read-only, sans créer de compte ni de table, sans le lien du premier compte) : les 9 étapes passent. Sans cookie, /api/me répond 401 ; la clé des notifications fait 87 caractères ; un code d’invitation inventé est « inconnu » ; la connexion par clé d’accès est liée à toc.romaindetroyat.workers.dev ; /sw.js est servi en no-cache ; le manifeste dit « landscape » et « fr ». Détail dans 04-12-SUMMARY.md.
  - Le lien de ton premier compte t’a été donné en privé. Il n’est écrit dans aucun fichier.
result: pending

### 22. À confirmer : l’accueil
expected: Sous les deux grandes tuiles en chêne, deux petites tuiles en bois sombre. Sans compte : « Ton prénom » (avec le prénom dessous) et « Se connecter » (avec « Créer un compte » dessous). Avec un compte : « Mes amis » (« Inviter un proche ») et « Mon compte » (avec le pseudo). « Mes parties en cours » reste à droite et montre aussi les parties du compte jouées sur un autre appareil. Ça te va ?
result: pending

### 23. À confirmer : les mots
expected: « clé d’accès » pour passkey (le nom qu’Apple et Google affichent en français), « pseudo », « code de secours », « code ami », et « proche » pour quelqu’un qui n’a pas encore de compte. Ça te va ?
result: pending

### 24. À confirmer : le pseudo
expected: 2 à 20 caractères : lettres avec accents, chiffres, espace et ' . _ - . « Élodie » et « elodie » comptent comme le même pseudo. Pas d’émoji ni d’autre alphabet. Le prénom déjà donné sur l’appareil est proposé. Ça te va ?
result: pending

### 25. À confirmer : le code de secours
expected: 20 caractères en cinq groupes (comme K7QM-2XRA-P9DW-HT4E-NB6Z), montré une seule fois avec « Copier le code » et le conseil d’une capture d’écran ou du papier. « J’ai gardé mon code » demande « Tu as bien gardé ton code ? » avant de partir. Pas de bouton pour l’imprimer ou le télécharger. Ça te va ?
result: pending

### 26. À confirmer : se connecter
expected: Une fenêtre « Se connecter » avec « Utiliser ma clé d’accès ». Sur un ordinateur, le navigateur propose le téléphone par un code QR. « J’ai perdu ma clé : code de secours » mène à « Retrouver mon compte », qui déconnecte les autres appareils et donne un nouveau code. Ça te va ?
result: pending

### 27. À confirmer : « Mon compte »
expected: À gauche, le pseudo et « Se déconnecter ». À droite, dans cet ordre : « Notifications », « Clés d’accès » (nommées « iPhone », « Mac »… d’après l’appareil, sans pouvoir les renommer), « Code de secours ». Ça te va ?
result: pending

### 28. À confirmer : se déconnecter
expected: La question « Se déconnecter de cet appareil ? » rappelle que les places de cet appareil ne seront plus jouables jusqu’à la prochaine connexion. Les parties du compte disparaissent alors de « Mes parties en cours » sur cet appareil. Ça te va ?
result: pending

### 29. À confirmer : les invitations
expected: « Inviter un proche » est sur la page « Mes amis ». Au plus 10 liens en attente à la fois. L’appareil qui a créé un lien peut le repartager ; un autre appareil peut seulement le désactiver. Un lien sert une fois, pendant 7 jours. Ça te va ?
result: pending

### 30. À confirmer : le code ami
expected: TOC-XXXX-XXXX, valable 24 heures, dans une fenêtre « Ajouter avec un code » avec deux onglets, « Entrer un code » et « Donner mon code ». Retirer quelqu’un de ses amis se fait des deux côtés, après confirmation. Ça te va ?
result: pending

### 31. À confirmer : inviter un ami à une table
expected: Dans la salle d’attente, « Inviter » s’ouvre sur l’onglet « Mes amis » (« Lien et QR code » à côté). Un geste sur « Inviter » à côté d’un ami. Tout joueur avec un compte présent à la table peut inviter ses amis, pas seulement le chef de table. Ça te va ?
result: pending

### 32. À confirmer : l’invitation reçue, application ouverte
expected: Une carte en haut de l’écran, « Marie t’invite à sa table. », avec « Plus tard » et « Rejoindre ». Pendant une partie, elle attend la fin de la partie. Depuis une autre salle d’attente, « Rejoindre » quitte celle-ci sans question. Ça te va ?
result: pending

### 33. À confirmer : les notifications
expected: « C’est ton tour ! » / « La table de Marie t’attend : la partie est en pause jusqu’à ton retour. », et « Invitation à une table » / « Marie t’invite à sa table de TOC. ». Sans émoji. Ça te va ?
result: pending

### 34. À confirmer : la nouvelle version
expected: Un bandeau « Nouvelle version disponible » avec « Mettre à jour » sur l’accueil, « Mon compte », « Mes amis » et l’écran contre l’ordinateur. Jamais à une table, pendant une partie ni pendant la création d’un compte. Pendant une partie, seulement une ligne dans « Réglages », sans pastille sur la roue dentée. Ça te va ?
result: pending

### 35. À confirmer : installer l’application
expected: Un bandeau sur l’accueil : « Installer » sur Android et sur l’ordinateur, « Comment faire » sur iPhone et iPad, avec les trois gestes de Safari. « Plus tard » le cache 30 jours. « Installer l’application » reste dans « Réglages ». Sur iPhone, le bandeau « Installe TOC comme une application. » reste sur l’accueil tant que TOC n’est pas installé ou que « Plus tard » n’a pas été touché. Ça te va ?
result: pending

### 36. À confirmer : sans réseau
expected: Un bandeau « Pas de connexion : seul le jeu contre l’ordinateur marche. » sur l’accueil. Les pages en ligne montrent « Pas de connexion » avec « Réessayer » et « Jouer contre l’ordinateur ». Ça te va ?
result: pending

### 37. À confirmer : l’écran de démarrage sur iPhone
expected: Le logo au centre sur le fond noyer, sans texte. Ça te va ?
result: pending

### 38. À confirmer : les personnes sans compte
expected: Rien ne change pour elles. La seule invitation à créer un compte est la petite tuile « Se connecter / Créer un compte » de l’accueil, qui explique qu’il faut le lien d’un proche. Rien dans la salle d’attente, la partie ou la planche de fin. Ça te va ?
result: pending

### 39. À confirmer : 30 secondes avant « C’est ton tour »
expected: TOC prévient un joueur absent qui a un compte 30 secondes après le début de la pause de sa table, et aussi quand une partie sauvegardée reprend sans lui. Aucune notification pour qui est à la table, même dans un autre onglet. Le délai peut changer (test 13). Ça te va ?
result: pending

### 40. À confirmer : la même clé dans Safari et dans l’application installée (iPhone)
expected: Une clé d’accès créée dans Safari sert aussi dans l’application installée, et inversement (trousseau iCloud). La clé d’accès marche dans l’application ouverte depuis l’écran d’accueil. C’est une supposition des recherches (A1) que seul ton iPhone peut confirmer (tests 3, 6 et 7). Ça s’est bien passé ?
result: pending

### 41. À confirmer : l’application installée a sa propre session (iPhone)
expected: Sur l’iPhone, l’application installée ne partage pas la session de Safari : il faut s’y connecter une fois, puis elle reste ouverte, même après l’avoir fermée. C’est une supposition des recherches (A2), que le test 7 vérifie. Ça te va ?
result: pending

### 42. À confirmer : le format du code et le blocage
expected: Le code de secours a 20 caractères sans lettres ambiguës (pas de I, L, O, U). Après 5 codes faux pour un pseudo, il faut attendre 15 minutes ; chaque nouvel essai faux double l’attente, jusqu’à 24 heures, jusqu’au bon code. Un proche qui se trompe 5 fois attend donc 15 minutes (A4). Ça te va ?
result: pending

### 43. À confirmer : les tailles de l’écran de démarrage
expected: L’écran de démarrage existe pour les iPhone, de l’iPhone 8 au 17 Pro Max et à l’Air, et pour les iPad, de l’iPad mini 5 à l’iPad Pro 13 pouces M4, en largeur. Sur un appareil absent de la liste, iOS montre un écran uni à la place (A8). As-tu vu le logo sur ton iPhone et sur l’iPad ?
result: pending

### 44. À confirmer : des pseudos qui se ressemblent
expected: Les pseudos sont uniques sans tenir compte des majuscules ni des accents, mais « Marie » et « Marie D » peuvent exister tous les deux. Dans les listes, seuls le disque avec l’initiale et le pseudo entier les distinguent. Pour un cercle familial, ça suffit ?
result: pending

### 45. À confirmer : pas de « en ligne » pour les amis
expected: La liste des amis (et celle de la fenêtre « Inviter ») ne dit pas qui est en ligne en ce moment, pour ne rien dévoiler de la présence de chacun. Ça te va ?
result: pending

### 46. À confirmer : retirer une clé d’accès déconnecte son appareil
expected: Dans « Mon compte », retirer une clé d’accès déconnecte l’appareil qui s’en servait. La dernière clé ne peut pas être retirée. Ajouter une clé sur un appareil fait passer cet appareil sur la nouvelle clé : retirer l’ancienne ne le déconnecte donc pas. Le retrait ne montre pas de message : la ligne disparaît. Ça te va ?
result: pending

### 47. À confirmer : une session de 400 jours
expected: Un appareil reste connecté 400 jours, et la session se prolonge à chaque usage (au plus une fois par semaine). Elle ne finit que par « Se déconnecter », par le retrait de la clé de cet appareil, ou par « Retrouver mon compte ». Ça te va ?
result: pending

### 48. À confirmer : deviner qu’un pseudo existe
expected: « Retrouver mon compte » répond pareil pour un pseudo inconnu et pour un code faux. Mais quelqu’un de très patient, qui mesure le temps de réponse de nombreuses fois, pourrait deviner qu’un pseudo existe. Les pseudos sont déjà visibles par les amis, donc on l’accepte. On peut le fermer, pour une requête de plus par essai. Ça te va comme ça ?
result: pending

### 49. À confirmer : « C’est moi » sur un appareil déconnecté
expected: Après « Se déconnecter », la tablette revient à la table comme une nouvelle personne sans place, et la place du compte reste en pause. La tablette peut encore demander « C’est moi, … » (comme en phase 2) : si le chef de table accepte, elle prend la place et le compte la perd. Faut-il plutôt qu’une place liée à un compte refuse « C’est moi » ?
result: pending

### 50. À confirmer : « … a rejoint la table » après la création d’un compte
expected: Quand quelqu’un assis sous un prénom (« Léo ») crée son compte et revient, les autres voient « Léonie … a rejoint la table. ». C’est vrai (la personne avait quitté la page pour créer son compte), mais le message ne dit pas que « Léo » est devenu « Léonie ». Ça te va ?
result: pending

### 51. À confirmer : un code ami sert à plusieurs pendant 24 heures
expected: Pendant ses 24 heures, ton code ami marche pour toute personne avec un compte à qui tu le montres, pas pour une seule. « Nouveau code » arrête l’ancien tout de suite. Ça te va ?
result: pending

### 52. À confirmer : ouvrir un lien ne le gaspille pas
expected: Ouvrir son propre lien d’invitation, ou celui d’un proche déjà dans tes amis, ne l’utilise pas : il reste valable pour un autre proche, et la page le dit. Ça te va ?
result: pending

### 53. À confirmer : une invitation à une table, avant le début seulement
expected: On ne peut inviter un ami à une table qu’avant le début de la partie. Une invitation faite pendant que l’application de l’ami est fermée est gardée 10 minutes ; l’inviter de nouveau pendant ces 10 minutes n’envoie rien de plus (sa ligne affiche « Invitation envoyée »). Une carte mise de côté pendant sa partie disparaît si la table a commencé entre-temps. Ça te va ?
result: pending

### 54. À confirmer : qui « a repris la partie »
expected: Quand une partie sauvegardée reprend sans toi, la notification et la carte nomment la personne qui l’a reprise : d’habitude le créateur (« Romain a repris la partie »), ou le chef de table si le créateur est absent. La carte dit alors « La table de {Nom} t’attend : c’est ton tour. ». Ça te va ?
result: pending

### 55. À confirmer : une seule notification par absence
expected: Si un joueur revient puis repart pendant la même pause, TOC ne le prévient pas une deuxième fois. Une nouvelle pause le prévient de nouveau. Ça te va ?
result: pending

### 56. À confirmer : retirer une partie de « Mes parties en cours »
expected: Retirer une partie de ton compte de « Mes parties en cours » la retire aussi sur tes autres appareils. « Remettre » la remet seulement sur cet appareil. Ça te va ?
result: pending

### 57. À confirmer : un prénom égal au pseudo d’un ami
expected: Si une personne sans compte est à la table sous le même prénom que le pseudo d’un de tes amis, la ligne de cet ami dans « Inviter » dit « Déjà à la table ». C’est rare dans une famille. Ça te va ?
result: pending

### 58. À confirmer : les messages d’erreur ajoutés
expected: |
  Ces phrases ne figuraient pas dans la maquette ; elles s’affichent quand le serveur ne répond pas :
  - « Le compte n’a pas pu être retrouvé. Réessaie dans un instant. »
  - « L’ajout n’a pas marché. Réessaie dans un instant. » (un ami, une clé ou un code ami)
  - « La clé n’a pas pu être retirée. Réessaie dans un instant. »
  - « Le code n’a pas pu être remplacé. Réessaie dans un instant. »
  - « Le retrait n’a pas marché. Réessaie dans un instant. » (un ami)
  - « Le lien n’a pas pu être désactivé. Réessaie dans un instant. »
  - « Impossible de charger tes invitations en attente. »
  - « Le code n’a pas pu être créé. Réessaie dans un instant. »
  - « Suis les instructions de ton appareil… » pendant l’ajout d’une clé
  - « Impossible de charger tes amis. » avec « Réessayer », dans la fenêtre « Inviter »
  - « L’invitation n’est pas partie. Vérifie le réseau, puis réessaie. » (par exemple quand la partie a déjà commencé)
  - « Inviter avec », le nom lu par le lecteur d’écran pour les onglets de la fenêtre « Inviter »
  Ça te va ?
result: pending

### 59. À confirmer : le budget de l’offre gratuite
expected: Les chiffres du test 20 te vont-ils, ou préfères-tu prévoir l’offre payante (5 $ par mois) si la famille joue beaucoup contre des Champions ?
result: pending

### 60. Créer son compte dans l’application installée en collant le lien (iPhone)
expected: |
  Ajouté par le plan 04-13, après ton essai du 2026-10-18 (« Il n’y a pas d’option face id » dans l’application installée). À faire après la prochaine mise en ligne.
  Sur l’iPhone, TOC est installé et tu n’as pas de compte dans l’application installée (ou demande à un proche qui n’a pas encore de compte). Un proche qui a un compte t’envoie un lien d’invitation par WhatsApp ou par SMS. Dans WhatsApp ou Messages, appuie longuement sur le lien (ou sur le message) et choisis « Copier ». Ouvre TOC depuis son icône. Touche la petite tuile « Se connecter » (« Créer un compte » dessous). Sous « Pas encore de compte ? », la fenêtre montre le champ « J’ai une invitation », le bouton « Continuer » et la phrase « Sur iPhone, ouvre ton lien d’invitation dans Safari, ou colle-le ici dans l’application. ». Touche le champ, puis « Coller ». Le lien complet, le message entier ou le code seul marchent. Touche « Continuer » : la fenêtre se ferme et l’étape du pseudo s’ouvre, dans l’application. Choisis ton pseudo, touche « Créer mon compte » : l’iPhone demande Face ID. Garde le code de secours, confirme. L’accueil de l’application affiche « Mon compte » avec ton pseudo. Ferme l’application et rouvre-la : tu es toujours dans ton compte.
  Essaie aussi de coller autre chose (un lien de table, un mot) : sous le champ s’affiche « Ce lien d’invitation n’est pas reconnu. Colle le lien complet reçu de ton proche. », et rien ne s’ouvre. TOC ne lit jamais ton presse-papiers tout seul : seul ton geste « Coller » remplit le champ.
result: pass — 2026-10-18, Romain a créé son compte dans l’application installée (« ok, c'est bon, c'est créé »).

### 61. À confirmer : « J’ai une invitation » dans la fenêtre « Se connecter »
expected: Le champ « J’ai une invitation » est dans la fenêtre « Se connecter », sous « Pas encore de compte ? », sur tous les appareils (pas seulement sur iPhone), avec la phrase « Sur iPhone, ouvre ton lien d’invitation dans Safari, ou colle-le ici dans l’application. » juste dessous. La fenêtre « Installer TOC » ne change pas. Sur un téléphone tenu en largeur, il faut faire défiler la fenêtre pour voir le champ (la clé d’accès reste en haut). Ça te va, ou préfères-tu ce champ ailleurs (par exemple en haut de la fenêtre, ou dans « Installer TOC ») ?
result: pending

## Summary

total: 61
passed: 0
issues: 0
pending: 61
skipped: 0
blocked: 0

## Gaps

[none yet]
