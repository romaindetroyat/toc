// Account copy of plan 04-01 (04-UI-SPEC « Invitation », « Backup-code screen », « Small tiles »,
// « Copywriting Contract »): the invitation link, the pseudo step, the backup code, the « Mon compte »
// tile. Phase-1 typography: U+202F before ; ! ? » and after «, U+00A0 before :, typographic ’.
// Gender-neutral (02-UI-SPEC): no participle agrees with the player.

export const compte = {
  invitation: {
    loading: "Ouverture de l’invitation…",
    slow: "La connexion est lente. Vérifie le réseau.",
    home: "Retour à l’accueil",
    /** Who sent the link, when the invitation does not name a player (a test invitation). */
    someone: "la personne qui te l’a envoyé",
    unknown: {
      heading: "Cette invitation n’existe pas",
      body: "Le lien est peut-être incomplet. Demande un nouveau lien à la personne qui te l’a envoyé.",
    },
    used: {
      heading: "Cette invitation a déjà servi",
      body: (inviter: string) =>
        `Chaque lien d’invitation ne sert qu’une fois. Si c’était toi, connecte-toi. Sinon, demande un nouveau lien à ${inviter}.`,
    },
    expired: {
      heading: "Cette invitation a expiré",
      body: (inviter: string) =>
        `Un lien d’invitation marche 7 jours. Demande un nouveau lien à ${inviter}.`,
    },
    unsupported: {
      heading: "Ce navigateur ne sait pas créer de clé d’accès",
      body: "Ouvre ce lien dans Safari, Chrome ou Edge à jour. Sans compte, tu peux quand même rejoindre une table avec son lien.",
      copy: "Copier le lien",
      copied: "Lien copié.",
      copyFailed: "Impossible de copier. Sélectionne le lien.",
    },
    offline: {
      heading: "Pas de connexion",
      body: "L’invitation a besoin d’Internet. Vérifie le réseau, puis réessaie.",
      retry: "Réessayer",
    },
  },
  pseudo: {
    step: "Étape 1 sur 2",
    heading: "Choisis ton pseudo",
    /** The heading's accessible name in the compact layouts, where the step line is hidden. */
    headingWithStep: "Étape 1 sur 2 : Choisis ton pseudo",
    invitedBy: (inviter: string) => `${inviter} t’invite sur TOC.`,
    invited: "Tu as reçu une invitation sur TOC.",
    bootstrap: "Premier compte de TOC : le tien.",
    helper: "2 à 20 caractères. Les autres joueurs le verront.",
    device: "Suis les instructions de ton appareil…",
    submit: "Créer mon compte",
    busy: "Création du compte…",
    explanation:
      "Pas de mot de passe ni d’e-mail : ton appareil crée une clé d’accès (passkey), que tu ouvres avec ton visage, ton doigt ou le code de l’appareil. Ensuite, tu recevras un code de secours à garder.",
    errors: {
      empty: "Écris un pseudo pour continuer.",
      short: "Ton pseudo doit avoir au moins 2 caractères.",
      long: "Ton pseudo doit avoir 20 caractères au plus.",
      chars:
        "Utilise des lettres (accents compris), des chiffres, des espaces et ' . _ - seulement.",
      taken: "Ce pseudo est déjà pris. Essaie une variante, par exemple avec ton initiale.",
      takenMeanwhile: "Ce pseudo vient d’être pris. Choisis-en un autre.",
      cancelled: "Création annulée. Touche « Créer mon compte » pour réessayer.",
      wrongAddress: "Les clés d’accès ne marchent qu’à l’adresse toc.romaindetroyat.workers.dev.",
      offline: "Pas de connexion. Vérifie le réseau, puis réessaie.",
      server: "Le compte n’a pas pu être créé. Réessaie dans un instant.",
    },
  },
  backup: {
    step: "Étape 2 sur 2",
    heading: "Ton code de secours",
    body: "Si tu perds ton téléphone, ce code te permet de retrouver ton compte sur un autre appareil.",
    /** The code panel's accessible name: the code spelled one symbol at a time, groups by commas. */
    groupLabel: (spelled: string) => `Code de secours : ${spelled}`,
    warning:
      "Il ne s’affichera plus jamais. Fais une capture d’écran ou recopie-le sur papier, et range-le en lieu sûr. Ne le donne à personne : il ouvre ton compte.",
    copy: "Copier le code",
    copied: "Code copié. Colle-le dans un endroit sûr.",
    copyFailed: "Impossible de copier. Recopie le code à la main.",
    kept: "J’ai gardé mon code",
    confirm: {
      title: "Tu as bien gardé ton code ?",
      body: "Il ne s’affichera plus. Sans lui, si tu perds tous tes appareils, ton compte est perdu : il faudra une nouvelle invitation.",
      safe: "Revoir mon code",
      other: "Oui, je l’ai gardé",
    },
  },
  welcome: {
    alone: (pseudo: string) => `Bienvenue, ${pseudo} !`,
    withFriend: (pseudo: string, inviter: string) =>
      `Bienvenue, ${pseudo} ! ${inviter} est maintenant dans tes amis.`,
  },
  tile: {
    account: "Mon compte",
    /** Accessible name of the tile: « Mon compte (Marie) ». */
    accountLabel: (pseudo: string) => `Mon compte (${pseudo})`,
  },
} as const;
