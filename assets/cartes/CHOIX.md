# Figures des cartes : choix de la source (D-24)

**Date de la décision :** 2026-10-13
**Décidé par :** Romain
**Option retenue :** `svg-cards`

## Réponse de Romain

Romain a choisi « svg-cards (Recommandé) » parmi trois options (`svg-cards`, `jeu-de-romain`, `autre-source`).

## Source

| Élément | Valeur |
|---|---|
| Paquet npm | `svg-cards`, version 4.0.2 |
| Adresse npm | https://www.npmjs.com/package/svg-cards |
| Dépôt | https://github.com/htdebeer/SVG-cards (`git+https://github.com/htdebeer/SVG-cards.git`) |
| Auteurs / mainteneurs npm | htdebeer et desphilboy ; cartes SVG d’après David Bellot |
| Création du paquet | 2018-03-08 |
| Licence | LGPL-2.1 |

Vérifié sur le registre npm par l’orchestrateur avant l’intégration : aucun script `install` ni `postinstall` (seulement un script `test` factice), dépôt et mainteneurs conformes à ci-dessus (menace T-01-SC du plan 01-07).

## Licence et obligations

LGPL-2.1 n’est ni CC0 ni CC-BY : Romain l’accepte comme compatible avec la publication du jeu, à ces conditions, à respecter à l’intégration (plan 01-20) :

- **Crédit :** nommer les auteurs et le paquet dans l’écran « À propos » / les crédits du jeu.
- **Texte de licence :** joindre le texte complet de la LGPL-2.1 avec les figures (fichier `LICENSE` ou page de crédits).
- **Fichier remplaçable :** garder les figures dans des fichiers SVG séparés, chargés tels quels et non fondus dans le code, pour qu’on puisse les remplacer par d’autres figures (par exemple celles du jeu de Romain) sans recompiler le jeu.

## Où sont les fichiers

Rien n’est installé dans ce plan. Le paquet `svg-cards@4.0.2` sera récupéré au plan 01-20, qui n’en extrait que les 12 figures (Valet, Dame, Roi × pique, cœur, carreau, trèfle) et les copie dans les ressources du jeu, avec le crédit et le texte de licence. Les as et les cartes à points sont dessinés par le code dans tous les cas.

Si Romain préfère plus tard les figures de son propre jeu, il dépose les 12 fichiers dans `assets/cartes/source/` avec leur provenance et leur licence, et ce document est mis à jour.
