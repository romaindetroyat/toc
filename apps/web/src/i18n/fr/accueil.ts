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
    },
    /** The name line, before the stored first name. */
    nameLabel: "Ton prénom :",
    change: "Changer",
    changeLabel: "Changer de prénom",
    listHeading: "Mes parties en cours",
    emptyHeading: "Aucune partie en cours",
    emptyBody: "Crée une table en ligne, ou ouvre le lien qu’un proche t’a envoyé.",
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
