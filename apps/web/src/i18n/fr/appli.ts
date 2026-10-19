// The installable app's copy (plan 04-08; 04-UI-SPEC « Home strip », « PWA »): the home strip
// (offline, update, install) and the sheet « Installer TOC ». Phase-1 typography: U+202F before ; ! ?
// » and after «, U+00A0 before :, typographic ’.
export const appli = {
  strip: {
    offline: "Pas de connexion : seul le jeu contre l’ordinateur marche.",
    update: "Nouvelle version disponible",
    updateButton: "Mettre à jour",
    updateBusy: "Mise à jour…",
    install: "Installe TOC comme une application.",
    installButton: "Installer",
    howTo: "Comment faire",
    /** The x of the update and install strips (its accessible name). */
    later: "Plus tard",
    /** The install strip is a region with this name. */
    installRegion: "Installer TOC",
  },
  /** After the browser's prompt was accepted. */
  installed: "TOC est installé. Ouvre-le depuis ton écran d’accueil.",
  sheet: {
    title: "Installer TOC",
    intro:
      "TOC s’ouvrira comme une application, en plein écran, même sans réseau pour jouer contre l’ordinateur.",
    /** Step 1, around the « Partager » glyph. */
    share: {
      before: "Touche le bouton Partager",
      after: " : en bas de l’écran sur iPhone, en haut sur iPad.",
    },
    /** Step 2, around the « Sur l’écran d’accueil » glyph. */
    addToHome: {
      before: "Fais défiler et choisis « Sur l’écran d’accueil »",
      after: ".",
    },
    add: "Touche « Ajouter », en haut à droite.",
    /** Step 4, signed in only (04-RESEARCH Pitfall 4). */
    signIn:
      "Ouvre TOC depuis sa nouvelle icône et connecte-toi une fois : l’application ne partage pas la session de Safari.",
    close: "Fermer",
  },
  /** Plan 04-10: the offline page of the online features (04-UI-SPEC « Offline »). */
  offlinePage: {
    heading: "Pas de connexion",
    body: "Cette page a besoin d’Internet. Vérifie le réseau, puis réessaie. Sans réseau, tu peux jouer contre l’ordinateur.",
    retry: "Réessayer",
    solo: "Jouer contre l’ordinateur",
  },
} as const;
