// Home and first-name prompt copy (02-UI-SPEC « Copywriting Contract », « Home », « First-name prompt »).

export const accueil = {
  home: {
    title: "TOC",
    tagline: "Le jeu de petits chevaux à cartes",
    solo: {
      label: "Jouer contre l’ordinateur",
      sub: "Sur cet appareil, même sans réseau",
    },
    online: {
      label: "Créer une table en ligne",
      sub: "Invite tes proches avec un lien",
      /** Plan 04-09: the same tile's sub line when signed in. */
      subSignedIn: "Invite tes amis ou partage un lien",
    },
    /** The name line, before the stored first name. */
    nameLabel: "Ton prénom :",
    change: "Changer",
    changeLabel: "Changer de prénom",
    /** Plan 04-09: the small tile that took the name line's place (04-UI-SPEC « Small tiles »). */
    nameTile: "Ton prénom",
    /**
     * The tile's accessible name: its two visible lines in order (plan 05-10, WCAG 2.5.3 « Label in
     * Name »), « Ton prénom : Marie ».
     */
    nameTileLabel: (name: string) => `Ton prénom : ${name}`,
    listHeading: "Mes parties en cours",
    emptyHeading: "Aucune partie en cours",
    emptyBody: "Crée une table en ligne, ou ouvre le lien qu’un proche t’a envoyé.",
    /**
     * Plan 05-08 (05-UI-SPEC « The links row »): the small tiles at the bottom of the right column,
     * « Mes résultats » signed in only. Line 2 of « Apprendre » follows the lessons' progress.
     */
    links: {
      // Plan 05-10 (WCAG 2.5.3 « Label in Name »): each tile's accessible name is its two visible
      // lines in order, « Règles : cartes, 7, maison ».
      rules: {
        label: "Règles",
        sub: "Cartes, 7, maison",
        name: "Règles : cartes, 7, maison",
      },
      learn: {
        label: "Apprendre",
        sub: "En 10 minutes",
        started: (n: number) => `Leçon ${n} sur 8`,
        done: "Leçons faites",
        name: (sub: string) => `Apprendre : ${sub.charAt(0).toLowerCase()}${sub.slice(1)}`,
      },
      results: {
        label: "Mes résultats",
        sub: "Parties et classement",
        name: "Mes résultats : parties et classement",
      },
    },
    /** Toast: « Créer une table en ligne » without a network. */
    offline: "Pas de connexion : la table en ligne a besoin d’Internet.",
  },
  name: {
    heading: "Ton prénom",
    /** Context line when the table's creator is known. */
    invitedBy: (creator: string) => `${creator} t’invite à une partie de TOC.`,
    invited: "Tu as reçu une invitation à une partie de TOC.",
    /** Context line before creating a table. */
    creating: "Les autres joueurs le verront à la table.",
    helper: "Cet appareil s’en souviendra.",
    submit: "Continuer",
    busy: "Création de la table…",
    empty: "Écris ton prénom pour continuer.",
    back: "Retour",
    serverError: "La table n’a pas pu être créée. Réessaie dans un instant.",
    offlineError: "Pas de connexion. Vérifie le réseau, puis réessaie.",
    changeTitle: "Changer de prénom",
    save: "Enregistrer",
  },
} as const;
