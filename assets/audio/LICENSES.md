# Licences : sons, polices, icônes, plateau, cavaliers et logo

Ce registre trace la provenance de tout ce que le jeu embarque : un son, une police, un jeu d’icônes, une illustration ou un dessin fait par le code par ligne. Le jeu le lit tel quel : la feuille « Crédits et licences » et la page `#/sons` affichent ces lignes. Un test échoue si un son du catalogue (`apps/web/src/audio/sounds.ts`) n’a pas sa ligne, et si un fichier de `apps/web/src/assets` (polices, figures des cartes, cavaliers du plateau, logo de l’accueil), de `apps/web/public/audio` ou des icônes de l’application (`apps/web/public/icons`, `apps/web/public/favicon.ico`) n’est couvert par aucune ligne.

Règles pour ajouter une ligne :

- Un fichier enregistré (CC0 ou équivalent) a sa propre ligne, avec l’adresse de la page d’origine (Freesound, OpenGameArt…) et le nom de l’auteur. Une licence à vérifier fichier par fichier ne se déduit jamais d’un lot.
- Un son a plusieurs versions (« a » à « d », page `#/sons`). Sa ligne « Généré par le code » couvre toutes ses versions générées par le code. Chaque version enregistrée a sa propre ligne de type `son` : son id est l’identifiant `licence` de la version dans le catalogue, elle donne l’adresse de la page d’origine et l’auteur, et sa colonne `fichier` couvre chacun des fichiers de la version. Un test le vérifie.
- La colonne `fichier` donne le nom du fichier, son chemin depuis la racine du dépôt, ou un dossier terminé par une barre oblique (tous les fichiers du dossier sont alors couverts). Les textes de licence (`OFL-*.txt`, `LGPL-*.txt`, `LICENSE*`) n’ont pas besoin de ligne.
- Une ligne ne contient ni barre verticale ni balise : tout est affiché comme du texte.
- Types utilisés : `son`, `police`, `icônes`, `plateau`, `cavaliers`, `cartes`, `logo`.

| id | fichier | type | source | auteur | licence | url |
|----|---------|------|--------|--------|---------|-----|
| sabot | — | son | Généré par le code | Jeu TOC (synthèse Web Audio) | Aucune œuvre tierce | — |
| hennissement-sortie | — | son | Généré par le code | Jeu TOC (synthèse Web Audio) | Aucune œuvre tierce | — |
| hennissement-ruade | — | son | Généré par le code | Jeu TOC (synthèse Web Audio) | Aucune œuvre tierce | — |
| hennissement-plainte | — | son | Généré par le code | Jeu TOC (synthèse Web Audio) | Aucune œuvre tierce | — |
| hennissement-joyeux | — | son | Généré par le code | Jeu TOC (synthèse Web Audio) | Aucune œuvre tierce | — |
| hennissement-fete | — | son | Généré par le code | Jeu TOC (synthèse Web Audio) | Aucune œuvre tierce | — |
| hennissement-surpris | — | son | Généré par le code | Jeu TOC (synthèse Web Audio) | Aucune œuvre tierce | — |
| carte-donne | — | son | Généré par le code | Jeu TOC (synthèse Web Audio) | Aucune œuvre tierce | — |
| carte-pose | — | son | Généré par le code | Jeu TOC (synthèse Web Audio) | Aucune œuvre tierce | — |
| carte-echange | — | son | Généré par le code | Jeu TOC (synthèse Web Audio) | Aucune œuvre tierce | — |
| nunito | nunito-latin.woff2, nunito-latin-ext.woff2 | police | Nunito, paquet @fontsource-variable/nunito 5.3.0 | The Nunito Project Authors | OFL-1.1 (SIL Open Font License 1.1) | https://github.com/googlefonts/nunito |
| caveat | caveat-latin.woff2, caveat-latin-ext.woff2 | police | Caveat, paquet @fontsource-variable/caveat 5.3.0 | The Caveat Project Authors | OFL-1.1 (SIL Open Font License 1.1) | https://github.com/googlefonts/caveat |
| lucide | apps/web/src/ui/icons.ts | icônes | Lucide, paquet lucide-static 1.56.0 | Lucide Contributors | ISC (certaines icônes viennent de Feather : MIT) | https://lucide.dev |
| plateau | packages/board/src/scene.ts, packages/board/src/art.ts | plateau | Plateau « galet » dessiné par le code, d’après la maquette choisie par Romain le 2026-10-14 et son plateau original (les quatre quarts restent dans assets/plateau, ils ne sont plus embarqués) | Jeu TOC | Aucune œuvre tierce | — |
| plateau-cavaliers | apps/web/src/assets/plateau/ | plateau | Cavalier à l’encre du plateau original de Romain, recolorié pour chaque couleur (maquette « galet », 2026-10-14) | Romain | Utilisés avec l’accord de l’auteur | — |
| cavaliers | assets/cavaliers/cavaliers-source.webp, apps/web/public/cavaliers/{bleu,jaune,rouge,vert}.webp | cavaliers | Cavaliers dessinés par Romain | Romain | Utilisés avec l’accord de l’auteur | — |
| cartes | apps/web/src/assets/cartes/ | cartes | Figures du Valet, de la Dame et du Roi, paquet svg-cards 4.0.2, extraites en fichiers SVG séparés (fond, cadre et indices retirés, vue recadrée) par tools/import-card-art.mjs | David Bellot, Huub de Beer et contributeurs (desphilboy, Thomas Linard, rhorns) | LGPL-2.1 (GNU Lesser General Public License 2.1), texte dans LGPL-2.1.txt ; fichiers remplaçables | https://github.com/htdebeer/SVG-cards |
| logo | assets/logo/logo-source.webp, apps/web/src/assets/logo/, apps/web/public/icons/, apps/web/public/favicon.ico | logo | Logo fourni par Romain, 2026-10-17 (« Utilise cette image comme logo ») ; icônes de l’application et logo de l’accueil tirés de ce fichier par tools/build-icons.mjs | Romain | Utilisé avec l’accord de l’auteur | — |
