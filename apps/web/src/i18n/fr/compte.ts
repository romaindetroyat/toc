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
    /** Plan 04-09: « Se connecter » on a used link. */
    signIn: "Se connecter",
    /** Plan 04-09: the signed-in rows (04-UI-SPEC « Opening the link »). */
    addFriend: {
      heading: (inviter: string) => `Ajouter ${inviter} à tes amis ?`,
      body: (inviter: string) =>
        `${inviter} t’a envoyé ce lien. Vous pourrez vous inviter à vos tables.`,
      accept: "Ajouter à mes amis",
      busy: "Ajout…",
      added: (inviter: string) => `${inviter} est maintenant dans tes amis.`,
      failed: "L’ajout n’a pas marché. Réessaie dans un instant.",
    },
    friend: {
      heading: (inviter: string) => `${inviter} est déjà dans tes amis`,
      body: (date: string) => `Ce lien reste valable pour un autre proche jusqu’au ${date}.`,
    },
    own: {
      heading: "C’est ton invitation",
      body: (date: string) => `Envoie ce lien à un proche : il sert une fois, jusqu’au ${date}.`,
    },
    friends: "Mes amis",
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
    /** Plan 04-09: opens the sign-in sheet. */
    haveAccount: "J’ai déjà un compte",
    /** Plan 04-09: only when this device has guest tables. */
    seats: "Tes parties en cours sur cet appareil passeront sur ton compte.",
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
    /** Plan 04-09: after a recovery or « Créer un nouveau code ». */
    newHeading: "Ton nouveau code de secours",
    afterRecovery: "L’ancien code ne marche plus, et tes autres appareils ont été déconnectés.",
    afterRegeneration: "L’ancien code ne marche plus.",
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
  /** Plan 04-09: « Retrouver mon compte » at #/secours (04-UI-SPEC « Recovery »). */
  recover: {
    heading: "Retrouver mon compte",
    context:
      "Entre ton pseudo et ton code de secours. Tu créeras ensuite une clé d’accès sur cet appareil.",
    pseudoLabel: "Ton pseudo",
    codeLabel: "Code de secours",
    verify: "Vérifier le code",
    verifying: "Vérification…",
    home: "Retour à l’accueil",
    errors: {
      empty: "Écris ton pseudo et ton code.",
      format: "Un code de secours a 20 caractères, comme K7QM-2XRA-P9DW-HT4E-NB6Z.",
      wrong: "Pseudo ou code incorrect. Vérifie, puis réessaie.",
      locked: (duration: string) => `Trop d’essais. Réessaie dans ${duration}.`,
      offline: "Pas de connexion. Vérifie le réseau, puis réessaie.",
      server: "Le compte n’a pas pu être retrouvé. Réessaie dans un instant.",
    },
    /** The lock's remaining time, rounded up to the ladder's step. */
    minutes: (n: number) => `${n} minutes`,
    hours: (n: number) => (n === 1 ? "1 heure" : `${n} heures`),
    key: {
      heading: "Code accepté",
      body: (pseudo: string) => `Crée maintenant une clé d’accès sur cet appareil pour ${pseudo}.`,
      create: "Créer ma clé d’accès",
      busy: "Suis les instructions de ton appareil…",
      cancelled: "Création annulée. Touche « Créer ma clé d’accès » pour réessayer.",
      expired: "Le délai de 5 minutes est passé. Entre de nouveau ton code.",
    },
    done: "Compte retrouvé. Retire la clé de l’appareil perdu dans « Clés d’accès ».",
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
    /** Plan 04-09: the signed-in tile 1, a link to #/amis. */
    friends: "Mes amis",
    friendsSub: "Inviter un proche",
    /** Plan 04-09: the guest's tile, which opens the sign-in sheet. */
    signIn: "Se connecter",
    signInSub: "Créer un compte",
    signInLabel: "Se connecter ou créer un compte",
  },
  /** Plan 04-09: the sign-in sheet « Se connecter » (04-UI-SPEC « Sign-in sheet »). */
  signIn: {
    title: "Se connecter",
    text: "Utilise la clé d’accès de ton compte TOC.",
    use: "Utiliser ma clé d’accès",
    busy: "Suis les instructions de ton appareil…",
    note: "Sur un ordinateur, tu peux choisir ton téléphone comme clé : ton navigateur montre alors un code QR.",
    lost: "J’ai perdu ma clé : code de secours",
    hintHeading: "Pas encore de compte ?",
    hintBody: "Il faut l’invitation d’un proche qui a déjà un compte : demande-lui le lien.",
    lines: {
      unsupported:
        "Ce navigateur ne gère pas les clés d’accès. Ouvre TOC dans Safari, Chrome ou Edge à jour.",
      cancelled:
        "Connexion annulée. Pas de clé sur cet appareil ? Choisis ton téléphone, ou utilise ton code de secours.",
      unknown:
        "Cette clé d’accès n’ouvre aucun compte TOC. Elle a peut-être été retirée. Essaie une autre clé ou ton code de secours.",
      wrongAddress: "Les clés d’accès ne marchent qu’à l’adresse toc.romaindetroyat.workers.dev.",
      offline: "Pas de connexion. Vérifie le réseau, puis réessaie.",
      server: "La connexion n’a pas marché. Réessaie dans un instant.",
    },
    hello: (pseudo: string) => `Bonjour ${pseudo} !`,
    helloLinked: (pseudo: string) =>
      `Bonjour ${pseudo} ! Tes parties sur cet appareil sont maintenant liées à ton compte.`,
  },
  /** Plan 04-09: a 401 on an account call (04-UI-SPEC « Home: states »). */
  session: {
    ended: "Ta session a pris fin : connecte-toi de nouveau.",
    signIn: "Se connecter",
  },
} as const;
