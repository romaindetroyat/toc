// The copy of « Mes amis » (plan 04-10; 04-UI-SPEC « Mes amis », « Invite sheet « Inviter un
// proche » », « Code-ami sheet », « Confirmations »): the page, the friends list, the pending links,
// the invite sheet's variant and the code-ami sheet. Phase-1 typography: U+202F before ; ! ? » and
// after «, U+00A0 before :, typographic ’. Gender-neutral (02-UI-SPEC): « proche » for someone with no
// account yet, « {Pseudo} est dans tes amis », never « ton ami » or « ton amie ».

export const amis = {
  page: {
    title: "Mes amis",
    home: "Accueil",
    invite: "Inviter un proche",
    inviting: "Création du lien…",
    addWithCode: "Ajouter avec un code",
    note: "Un lien d’invitation sert une fois, pendant 7 jours : ton proche crée son compte et entre aussitôt dans tes amis. Si ton proche a déjà un compte, échangez vos codes amis.",
  },
  list: {
    /** The list's h2, read only (the h1 already says « Mes amis »). */
    heading: "Liste de mes amis",
    since: (monthYear: string) => `Dans tes amis depuis ${monthYear}`,
    /** The row read as one sentence: « Marie, dans tes amis depuis octobre 2026 ». */
    sentence: (pseudo: string, monthYear: string) => `${pseudo}, dans tes amis depuis ${monthYear}`,
    remove: (pseudo: string) => `Retirer ${pseudo} de tes amis`,
    emptyHeading: "Pas encore d’amis sur TOC",
    emptyBody:
      "Invite un proche avec un lien : il sert une fois, pendant 7 jours. Si ton proche a déjà un compte, échangez vos codes amis.",
    loading: "Chargement de tes amis…",
    slow: "La connexion est lente.",
    error: "Impossible de charger tes amis.",
    retry: "Réessayer",
    removed: (pseudo: string) => `${pseudo} n’est plus dans tes amis.`,
    removeFailed: "Le retrait n’a pas marché. Réessaie dans un instant.",
  },
  pending: {
    heading: "Invitations en attente",
    title: (date: string) => `Lien du ${date}`,
    line: (date: string) => `Valable jusqu’au ${date} · une seule fois`,
    share: "Partager ce lien",
    disable: "Désactiver ce lien",
    empty: "Aucune invitation en attente.",
    error: "Impossible de charger tes invitations en attente.",
    disabled: "Lien désactivé.",
    disableFailed: "Le lien n’a pas pu être désactivé. Réessaie dans un instant.",
  },
  /** « Inviter un proche »: POST /api/invitations refused. */
  create: {
    limit: "Tu as déjà 10 liens en attente. Désactive-en un pour en créer un autre.",
    failed: "Le lien n’a pas pu être créé. Réessaie dans un instant.",
    offline: "Pas de connexion : l’invitation a besoin d’Internet.",
  },
  /** The invite sheet's variant « Inviter un proche » (the 02 table sheet is unchanged). */
  sheet: {
    title: "Inviter un proche",
    text: (date: string) => `Ce lien sert une fois, jusqu’au ${date}.`,
    linkLabel: "Lien d’invitation",
    qrLabel: "Code QR du lien d’invitation",
    shareTitle: "TOC",
    shareText: (pseudo: string) =>
      `${pseudo} t’invite sur TOC, le jeu de petits chevaux à cartes. Ce lien marche une fois, pendant 7 jours.`,
  },
  confirm: {
    remove: {
      title: (pseudo: string) => `Retirer ${pseudo} de tes amis ?`,
      body: (pseudo: string) =>
        `${pseudo} ne pourra plus t’inviter à une table, et toi non plus. Pour l’ajouter de nouveau, il faudra un lien ou un code.`,
      safe: "Garder dans mes amis",
      other: "Retirer de mes amis",
    },
    disable: {
      title: "Désactiver ce lien ?",
      body: "Le proche qui l’a reçu ne pourra plus s’en servir.",
      safe: "Garder le lien",
      other: "Désactiver le lien",
    },
  },
  /** « Ajouter avec un code » (04-UI-SPEC « Code-ami sheet »): two tabs, every result. */
  code: {
    title: "Ajouter avec un code",
    /** The segmented control's accessible name. */
    tabs: "Afficher",
    enter: "Entrer un code",
    give: "Donner mon code",
    label: "Le code ami de ton proche",
    placeholder: "TOC-____-____",
    add: "Ajouter",
    adding: "Ajout…",
    added: (pseudo: string) => `${pseudo} est maintenant dans tes amis.`,
    already: (pseudo: string) => `${pseudo} est déjà dans tes amis.`,
    format: "Un code ami ressemble à TOC-K7QM-2XRA.",
    unknown: "Ce code ne marche pas : il a peut-être expiré (24 heures). Demande un nouveau code.",
    own: "C’est ton propre code : donne-le à ton proche.",
    rate: "Trop d’essais. Réessaie dans une heure.",
    offline: "Pas de connexion. Vérifie le réseau, puis réessaie.",
    failed: "L’ajout n’a pas marché. Réessaie dans un instant.",
    /** The code panel's accessible name: « Code ami : T O C, K 7 Q M, 2 X R A ». */
    groupLabel: (spelled: string) => `Code ami : ${spelled}`,
    valid: "Valable 24 heures. Dis-le ou envoie-le à un proche qui a un compte TOC.",
    copy: "Copier le code",
    copied: "Code copié.",
    copyFailed: "Impossible de copier. Recopie le code.",
    renew: "Nouveau code",
    creating: "Création du code…",
    noNetwork: "Pas de connexion.",
    createFailed: "Le code n’a pas pu être créé. Réessaie dans un instant.",
  },
} as const;
