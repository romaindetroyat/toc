---
status: diagnosed
phase: 03-l-ordinateur-la-force-choisie
source: [03-CONTEXT.md, 03-UI-SPEC.md, 03-07-SUMMARY.md]
started: 2026-10-15T12:49:17Z
updated: 2026-10-17T08:00:00Z
---

## Current Test

number: 1
name: "La force de chaque ordinateur au lancement (iPhone tenu en largeur, puis ordinateur)"
expected: |
  Sous « Force de l’ordinateur », il y a une ligne par place tenue par l’ordinateur : ton partenaire (marqué « Partenaire »), l’adversaire de gauche et celui de droite (marqués « Adversaire »). Chaque ligne propose Poulain, Trotteur, Galopeur, Pur-sang et Champion. La première fois, tout est sur Galopeur. Après un rechargement de la page, puis après un changement de couleur, tes choix sont toujours là. Tenu en largeur sur l’iPhone comme sur l’ordinateur, l’écran tient sans défiler, et « Jouer la partie » est toujours à portée de doigt.
awaiting: user response

## Tests

### 1. La force de chaque ordinateur au lancement (iPhone tenu en largeur, puis ordinateur)
expected: Sous « Force de l’ordinateur », il y a une ligne par place tenue par l’ordinateur : ton partenaire (marqué « Partenaire »), l’adversaire de gauche et celui de droite (marqués « Adversaire »). Chaque ligne propose Poulain, Trotteur, Galopeur, Pur-sang et Champion. La première fois, tout est sur Galopeur. Après un rechargement de la page, puis après un changement de couleur, tes choix sont toujours là. Tenu en largeur sur l’iPhone comme sur l’ordinateur, l’écran tient sans défiler, et « Jouer la partie » est toujours à portée de doigt.
result: pass
reported: Romain, 2026-10-17 : « Oui, tout est bon »

### 2. Chaque place joue à sa force
expected: Lance une partie avec deux adversaires Poulain et un partenaire Champion. Les Poulains jouent n’importe quel coup permis, le Champion joue juste. Puis fais l’inverse : deux adversaires Champion et un partenaire Poulain. La différence se voit. En fin de partie, « Rejouer » garde les mêmes forces. « Changer de couleur » te ramène au lancement, et les forces choisies y sont.
result: pending
reported: Romain, 2026-10-17 : « Pas vérifié »

### 3. Contre deux Champions : un vrai jeu d’équipe
expected: Joue une partie entière contre deux Champions. Ils mettent à l’abri leurs cavaliers menacés, mangent tes cavaliers au bon moment, s’aident l’un l’autre (l’un mange ce qui menace son partenaire, l’un ouvre le chemin à l’autre) et rentrent leurs cavaliers. Ils sont durs à battre. Dis si tu les trouves assez forts : tu avais demandé « le plus fort possible ».
result: pass
reported: Romain, 2026-10-17 : « Assez forts »

### 4. Le Champion comme partenaire, et la carte qu’il te passe
expected: Joue avec un partenaire Champion. Au moment de l’échange, quand tes cavaliers attendent à l’écurie, il te passe de préférence un As ou un Roi pour en sortir. Quand l’un vient de sortir, il préfère un 4 pour reculer vers ta maison. Il ne connaît pas tes cartes : il décide seulement d’après le plateau et ses propres cartes, comme le ferait un humain à sa place.
result: pass
reported: Romain, 2026-10-17 : « Oui, utile »

### 5. Le temps de réflexion
expected: En vitesse normale, quand l’ordinateur n’a qu’un coup possible, il joue vite (moins d’une demi-seconde). Pour un coup délicat, il prend jusqu’à 2 secondes environ, jamais plus de quelques secondes, même un Champion sur l’iPhone. Avec « Avance rapide », il joue presque tout de suite. Dis si le rythme te paraît naturel.
result: pass
reported: Romain, 2026-10-17 : « Naturel »

### 6. Le signe « réfléchit »
expected: Pendant qu’un ordinateur réfléchit, sa pastille ou son nom « respire » doucement : la petite pastille de couleur grossit un peu, le nom pâlit, puis tout revient. On le voit dans la barre en bas de l’ordinateur, dans la pastille du haut sur l’iPhone, et dans la liste des joueurs pendant l’échange. Rien ne bouge quand c’est ton tour. Avec « Réduire les animations » (dans « Réglages »), plus rien ne respire : un « … » fixe suit le nom à la place.
result: issue
reported: Romain, 2026-10-17 : « Pas assez visible »

### 7. Le banc d’essai sur l’iPhone
expected: Dans Safari, ouvre l’adresse du jeu suivie de #/banc. La page « Banc d’essai de l’ordinateur » s’ouvre. Laisse « Champion », touche « Lancer la mesure » et garde l’écran allumé jusqu’à la fin (environ 6 s sur l’ordinateur de test, sans doute plus sur l’iPhone). Lis le verdict : « Assez rapide sur cet appareil. » ou « Trop lent sur cet appareil. Envoie ces résultats. ». Touche « Copier les résultats » et envoie-les. Recommence dans l’app ajoutée à l’écran d’accueil. Pour comparer, sur l’ordinateur de test (Chromium), le Champion donne 95 % des coups en moins de 171 à 182 ms, le plus long 309 à 363 ms, et la plus longue image figée 32 à 43 ms.
result: pass
reported: Romain, 2026-10-17 : « Oui : assez rapide » (verdict sur son iPhone)

### 8. L’échelle des niveaux (lecture)
expected: |
  Chaque niveau gagne nettement plus souvent que celui d’en dessous, sur 400 parties simulées par marche (200 paires de parties où les deux équipes échangent leurs donnes) :

  | Marche | Parties | Victoires du plus fort | Part | Intervalle à 95 % | Verdict |
  |--------|---------|------------------------|------|-------------------|---------|
  | Trotteur contre Poulain | 400 | 370 | 92,5 % | 89,5 % à 94,7 % | réussi |
  | Galopeur contre Trotteur | 400 | 393 | 98,3 % | 96,4 % à 99,1 % | réussi |
  | Pur-sang contre Galopeur | 400 | 265 | 66,3 % | 61,5 % à 70,7 % | réussi |
  | Champion contre Pur-sang (5 contre 4) | 400 | 327 | 81,8 % | 77,7 % à 85,2 % | réussi |

  - Le Trotteur a gagné 370 parties sur 400 contre le Poulain.
  - Le Galopeur a gagné 393 parties sur 400 contre le Trotteur.
  - Le Pur-sang a gagné 265 parties sur 400 contre le Galopeur.
  - Le Champion a gagné 327 parties sur 400 contre le Pur-sang.

  Les trois premières marches ont été rejouées sur le code final. La marche 5 contre 4 vient de la mesure de 03-04 (03-04-ladder-5-4.txt) : le code de l’ordinateur n’a pas changé depuis. Dis si ce tableau te convient.
result: pass
reported: Romain, 2026-10-17 : « Oui » à « au moins 60 % sur 400 parties » ; écarts : « Laisser ainsi (Recommandé) »

### 9. À confirmer : pas de chiffre à côté du nom de la force
expected: Les forces s’affichent seulement par leur nom : « Poulain », « Trotteur », « Galopeur », « Pur-sang », « Champion ». Aucun chiffre à côté. L’ordre de gauche à droite dit la progression. Sur l’ordinateur, la souris posée sur un nom affiche « Force 3 sur 5 » (pour le Galopeur). Préfères-tu voir aussi le chiffre ?
result: pass
reported: Romain, 2026-10-17 : « Oui, sans chiffre »

### 10. À confirmer : les mots de l’écran de lancement
expected: Le titre est « Force de l’ordinateur ». Sous la pastille de chaque place, il est écrit « Partenaire » ou « Adversaire ». Les cinq forces s’appellent Poulain, Trotteur, Galopeur, Pur-sang et Champion. Ces mots te conviennent-ils ?
result: pass
reported: Romain, 2026-10-17 : « Oui, sans chiffre » (mots inchangés)

### 11. À confirmer : la mémoire par rôle plutôt que par couleur
expected: Le jeu se souvient de la force de ton partenaire, de celle de l’adversaire de gauche et de celle de l’adversaire de droite. Si tu changes de couleur, « mon partenaire est Champion » reste vrai, quelle que soit sa couleur. L’autre choix aurait été de retenir une force par couleur. Est-ce bien ce que tu voulais dire par « on se souvient » ?
result: pass
reported: Romain, 2026-10-17 : « Les deux me vont »

### 12. À confirmer : la respiration du signe « réfléchit »
expected: La pastille grossit de 12 % (× 1,12) et le nom pâlit jusqu’à 70 %, sur un cycle de 1,6 s qui recommence tant que l’ordinateur réfléchit. Avec « Réduire les animations », un « … » fixe remplace le mouvement. Est-ce assez discret, et assez visible ?
result: issue
reported: Romain, 2026-10-17 : « Pas assez visible »

### 13. À confirmer : la disposition de l’écran de lancement
expected: Sur l’ordinateur et sur le téléphone tenu en largeur, l’écran est en deux colonnes : les couleurs à gauche, les forces à droite. Sur le téléphone, les tuiles de couleur sont plus petites (96 × 88) et n’ont plus l’étiquette « Partenaire » (le pointillé autour de la tuile du partenaire reste). Sur un très petit téléphone, la page défile, et « Jouer la partie » reste collé en bas de l’écran. Cette disposition te convient-elle ?
result: pass
reported: Romain, 2026-10-17 : « Les deux me vont »

### 14. À confirmer : le résumé des équipes remplacé par les lignes de force
expected: Les phrases « Ton équipe : … » et « Adversaires : … » ne s’affichent plus (elles restent lues par le lecteur d’écran) : les lignes de force les remplacent, avec « Partenaire » et « Adversaire ». Le lien « Réglages » est à gauche du bouton « Jouer la partie ». Ça te va ?
result: pass
reported: Romain, 2026-10-17 : « Les deux me vont »

### 15. À confirmer : le banc d’essai caché à l’adresse #/banc
expected: Le banc d’essai existe dans toutes les versions du jeu, à l’adresse #/banc, mais aucun lien n’y mène (ni le lancement, ni « Réglages », ni l’aide). Tu peux l’ouvrir sur ton téléphone sans version spéciale. Préfères-tu qu’il soit visible quelque part, ou réservé à une version de test ?
result: pass
reported: Romain, 2026-10-17 : « OK, cachée »

### 16. À confirmer : les seuils du verdict du banc
expected: Le banc dit « Assez rapide sur cet appareil. » quand 95 % des coups prennent moins d’une seconde, qu’aucun coup ne dépasse 2 s, et qu’aucune image ne reste figée plus de 100 ms. Sinon, il dit « Trop lent sur cet appareil. Envoie ces résultats. ». Ces seuils te conviennent-ils ?
result: pass
reported: Romain, 2026-10-17 : « OK, cachée » (seuils acceptés avec la question)

### 17. À confirmer : ce que veut dire « nettement plus fort »
expected: Un niveau bat « nettement » celui d’en dessous s’il gagne au moins 60 % de 400 parties jouées par paires, et si la limite basse de l’intervalle de confiance à 95 % (Wilson) dépasse 55 %. C’est la barre du tableau du test 8. Est-ce assez « nettement » pour toi ?
result: pass
reported: Romain, 2026-10-17 : « Oui »

### 18. À confirmer : les temps de réflexion
expected: Un coup forcé (un seul choix) prend de 0,3 à 0,45 s. Un vrai choix prend de 0,45 s à 2 s selon sa difficulté. Si le calcul est trop long, l’ordinateur s’arrête à 2,5 s et joue le meilleur coup trouvé. En « Avance rapide », c’est le quart de ces temps, au plus 0,3 s (arrêt à 0,5 s). Ces réglages te paraissent-ils naturels, ou veux-tu plus vite ou plus lent ?
result: pass
reported: Romain, 2026-10-17 : « Naturel »

### 19. À confirmer : la force non affichée pendant la partie
expected: Pendant la partie, rien ne montre la force de chaque ordinateur. Elle se choisit seulement au lancement. Voudrais-tu la voir plus tard, par exemple dans « Infos de la partie », à côté du nom de chaque cheval ?
result: pass
reported: Romain, 2026-10-17 : « Pas besoin »

### 20. À confirmer : la force du Champion bornée par le temps
expected: Tu as demandé un Champion « le plus fort possible ». Pour chaque coup, il imagine 10 donnes possibles des cartes qu’il ne voit pas, essaie ses meilleurs coups sur chacune et regarde 4 coups plus loin. C’est le plus que l’ordinateur de test calcule en restant rapide (95 % des coups en moins d’un quart de seconde). Il bat le Pur-sang dans 82 % des parties. Un Champion plus fort réfléchirait plus longtemps, surtout sur l’iPhone. Le résultat du test 7 dira s’il reste de la marge. Ce compromis te va-t-il ?
result: pass
reported: Romain, 2026-10-17 : « On garde (Recommandé) »

### 21. À confirmer : l’écart entre les niveaux
expected: Les niveaux 2 à 4 jouent avec la même idée du jeu, en se trompant de moins en moins. Résultat (test 8) : le Galopeur écrase le Trotteur (98 %), alors que le Pur-sang ne fait que dépasser le Galopeur (66 %). Le Galopeur est la force par défaut. Les écarts te paraissent-ils bien répartis quand tu joues contre chacun, ou faut-il rapprocher le Trotteur du Galopeur ?
result: pass
reported: Romain, 2026-10-17 : « Laisser ainsi (Recommandé) »

## Summary

total: 21
passed: 18
issues: 2
pending: 1
skipped: 0
blocked: 0

## Gaps

- truth: "Pendant qu'un ordinateur réfléchit, le signe est assez visible (tests 6 et 12)."
  status: failed
  reason: "Romain, 2026-10-17 : « Pas assez visible »."
  severity: minor
  test: 6
  missing:
    - "Un signe « réfléchit » plus visible (amplitude, contraste ou indicateur supplémentaire), toujours discret et compatible avec « Réduire les animations »."

