// The online table route copy (02-UI-SPEC « Connecting, errors », « Waiting room »). The server's error
// codes are never shown: each maps to one of these lines.

/** « de Ana » → « d’Ana »: the elision before a vowel or a mute h (« jusqu’au retour d’Ana »). */
function of(name: string): string {
  return /^[aeiouhàâäéèêëîïôöùûüæœ]/i.test(name) ? `d’${name}` : `de ${name}`;
}

export const table = {
  connecting: "Connexion à la table…",
  /** Under « Connexion à la table… » after 10 s. */
  slow: "La connexion est lente. Vérifie le réseau.",
  offline: {
    heading: "Pas de connexion",
    body: "La table en ligne a besoin d’Internet. Vérifie le réseau, puis réessaie. Sans réseau, tu peux jouer contre l’ordinateur.",
    retry: "Réessayer",
  },
  notFound: {
    heading: "Cette table n’existe plus",
    body: "Le lien est peut-être incomplet, ou la partie a été effacée après 30 jours sans jouer.",
  },
  started: {
    heading: "La partie a déjà commencé",
    body: "Seuls les joueurs de cette partie peuvent la rejoindre.",
  },
  elsewhere: {
    heading: "Partie ouverte ailleurs",
    body: "Cette table est ouverte dans un autre onglet ou sur un autre appareil. Une seule fenêtre peut jouer ta place.",
    here: "Jouer ici",
  },
  /** A server error (5xx, bad-frame): « La table ne répond pas ». */
  server: {
    heading: "La table ne répond pas",
    body: "Réessaie dans un instant. La partie est gardée.",
    retry: "Réessayer",
  },
  /**
   * The reclaim of one's own seat (D-12, plan 02-07): under « La partie a déjà commencé », one
   * « C’est moi, {Nom} » per disconnected person's seat; then the request sent, or refused.
   */
  reclaim: {
    heading: "C’est ta place ?",
    body: (creator: string) =>
      `Si tu as commencé la partie sur un autre appareil ou dans une autre appli, demande ta place. ${creator} devra confirmer.`,
    itsMe: (name: string) => `C’est moi, ${name}`,
    sent: {
      heading: "Demande envoyée",
      body: (creator: string) => `${creator} doit confirmer que c’est bien toi…`,
    },
    refused: {
      heading: "Demande refusée",
      body: (creator: string) =>
        `${creator} n’a pas confirmé. Demande-lui directement, ou ouvre le lien sur l’appareil où tu as commencé.`,
    },
    /** The chef de table's dialog (ReclaimDialog). */
    dialog: {
      title: (name: string) => `Rendre sa place à ${name} ?`,
      body: (typed: string, name: string, colour: string) =>
        `Quelqu’un qui s’appelle « ${typed} » demande la place de ${name} (${colour}). Accepte seulement si c’est bien ${name}, sur un autre appareil.`,
      accept: "Rendre sa place",
      refuse: "Refuser",
    },
  },
  version: {
    heading: "Nouvelle version du jeu",
    body: "Recharge la page pour retrouver la partie.",
    reload: "Recharger la page",
  },
  home: "Retour à l’accueil",
  /** « Mes parties en cours » on the home (02-UI-SPEC « Home », rows 3 to 9). */
  list: {
    nobody: "Personne d’autre pour l’instant",
    /** « Avec Bruno », « Avec Bruno et Céline », « Avec Bruno, Tornado et Céline ». */
    with: (names: readonly string[]) =>
      names.length < 2
        ? `Avec ${names.join("")}`
        : `Avec ${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`,
    /** Line 1 before the summary has answered (checking, or offline). */
    unknownPlayers: "Table en ligne",
    status: {
      lobby: "Salle d’attente",
      playing: "En cours",
      paused: "En pause",
      pausedForYou: "En pause : on t’attend",
      saved: "Sauvegardée",
      finished: "Terminée",
    },
    checking: "Vérification…",
    offline: "État inconnu (hors ligne)",
    line2: (status: string, time: string) => `${status} · ${time}`,
    /** The row's accessible name. */
    rowLabel: (first: string, second: string, colour: string | null) =>
      colour === null
        ? `Reprendre la partie : ${first}, ${second}.`
        : `Reprendre la partie : ${first}, ${second}. Ta couleur : ${colour}.`,
    remove: "Retirer cette partie de la liste",
    removed: "Partie retirée de la liste.",
    restore: "Remettre",
    expired: (n: number) =>
      n === 1
        ? "Une partie arrêtée depuis plus de 30 jours a été effacée."
        : `${n} parties arrêtées depuis plus de 30 jours ont été effacées.`,
  },
  create: "Créer une table en ligne",
  lobby: {
    heading: (creator: string) => `Table de ${creator}`,
    /** Name line of a seat nobody holds. */
    computer: "Ordinateur",
    you: "toi",
    online: "en ligne",
    offline: "hors ligne",
    host: "chef de table",
    start: "Lancer la partie",
    chooseHeading: "Choisis ta place",
    chooseBody: "Touche une place libre. Bleu joue avec Rouge, Jaune avec Vert.",
    waitingHeading: "En attente du départ",
    waitingBody: (creator: string) =>
      `${creator} choisit la force de l’ordinateur et lance la partie.`,
    hostUnseated: "Prends une place pour lancer la partie.",
    /** Accessible name of a free seat. */
    takeSeat: (colour: string, level: string) => `Prendre la place ${colour}, ordinateur ${level}`,
    /** Accessible name of the own seat. */
    ownSeat: (colour: string) => `${colour} : toi`,
    /** Accessible name of another person's seat. */
    otherSeat: (colour: string, name: string, status: string) => `${colour} : ${name}, ${status}`,
    /** Accessible name of the own seat when this device is the chef de table. */
    ownSeatHost: (colour: string) => `${colour} : toi, chef de table`,
    /** The creator's button on another person's seat. */
    moveSeat: (name: string, colour: string) => `Déplacer ${name} (${colour})`,
    /** « Libérer ma place » under the grid. */
    stand: "Libérer ma place",
    invite: "Inviter",
    partner: "Partenaire",
    noComputer: "Quatre joueurs à la table : pas d’ordinateur.",
    /** « 1 joueur et 3 ordinateurs », « 4 joueurs et aucun ordinateur ». */
    count: (people: number, computers: number) =>
      `${people} ${people > 1 ? "joueurs" : "joueur"} et ${
        computers === 0
          ? "aucun ordinateur"
          : `${computers} ${computers > 1 ? "ordinateurs" : "ordinateur"}`
      }.`,
    /** Others' view of a computer seat: « Rouge : ordinateur, Galopeur ». */
    computerLine: (colour: string, level: string) => `${colour} : ordinateur, ${level}`,
    /** « Sans place : Céline, Paul. » */
    unseated: (names: readonly string[]) => `Sans place : ${names.join(", ")}.`,
    full: {
      heading: "La table est complète",
      body: "Les quatre places sont prises. Une place peut se libérer avant le départ.",
    },
    /** The creator's « Déplacer {Nom} » sheet. */
    move: {
      title: (name: string) => `Déplacer ${name}`,
      toFree: (colour: string) => `Vers ${colour} (place libre)`,
      swap: (name: string, colour: string) => `Échanger avec ${name} (${colour})`,
    },
    /** Toasts of the waiting room (tableNotices). */
    joined: (name: string) => `${name} a rejoint la table.`,
    left: (name: string) => `${name} a quitté la table.`,
    movedYou: (creator: string, colour: string) =>
      `${creator} a changé ta place : tu es maintenant ${colour}.`,
  },
  /** « A », « A et B », « A, B et C ». */
  names: (names: readonly string[]) =>
    names.length < 2
      ? names.join("")
      : `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`,
  of,
  /**
   * The online game (02-UI-SPEC « In the game (online only) », plan 02-06). Gender-neutral: no word
   * agrees with a player (« est de retour », « hors ligne »).
   */
  game: {
    /** The prompt row and the action zone while the game waits. */
    paused: "Partie en pause",
    /**
     * This device's own connection (plan 02-07): the banner from 2 s, the plate from 10 s, the toast
     * once the welcome is back.
     */
    connection: {
      banner: "Connexion perdue. Reconnexion…",
      title: "Connexion perdue",
      body: "Le jeu essaie de se reconnecter. Vérifie le Wi-Fi ou les données mobiles. La partie est gardée.",
      retry: "Réessayer maintenant",
      back: "De retour à la table.",
    },
    /** A seat the computer plays for its absent person, in the turn line and the prompts. */
    handedOverName: (name: string) => `${name} (ordinateur)`,
    pause: {
      /** « En attente de Bruno… », « En attente d’Ana et Paul… ». */
      title: (names: string) => `En attente ${of(names)}…`,
      body: (several: boolean) =>
        several
          ? "La partie est en pause jusqu’à leur retour."
          : "La partie est en pause jusqu’à son retour.",
      /** The countdown line, « 0:42 » counted from the server's clock. */
      countdownYou: (time: string) => `Dans ${time}, tu pourras choisir la suite.`,
      countdown: (host: string, time: string) => `Dans ${time}, ${host} pourra choisir la suite.`,
      /** Said once to screen readers when the pause begins (the countdown itself is hidden). */
      announceYou: "Tu pourras choisir la suite dans une minute.",
      announce: (host: string) => `${host} pourra choisir la suite dans une minute.`,
      /** After the minute, to everyone but the chef de table. */
      choosing: (host: string) => `${host} choisit la suite…`,
      /** After the minute, to the chef de table. */
      choose: (names: string, several: boolean) =>
        several
          ? `${names} ne sont pas de retour. Que veux-tu faire ?`
          : `${names} n’est pas de retour. Que veux-tu faire ?`,
      chooseAnnounce: "Tu peux choisir la suite.",
      wait: "Attendre encore une minute",
      handOver: (several: boolean) =>
        several ? "Confier leurs places à l’ordinateur" : "Confier sa place à l’ordinateur",
      save: "Sauvegarder et arrêter",
      levelTitle: "Quelle force pour l’ordinateur ?",
      confirmHandOver: (several: boolean) => (several ? "Confier les places" : "Confier la place"),
      back: "Retour",
    },
    saved: {
      title: "Partie sauvegardée",
      body: "Retrouve-la avec le même lien ou dans « Mes parties en cours ». Elle est gardée 30 jours sans jouer.",
      present: (names: string) => `À la table : ${names}.`,
      absent: (names: string) => `Pas encore là : ${names}.`,
      resume: "Reprendre la partie",
      hostResumes: (host: string) => `${host} peut reprendre la partie.`,
    },
    /** Toasts of the online game (gameNotices). */
    notices: {
      waits: (host: string) => `${host} attend encore une minute.`,
      handedOver: (names: string, several: boolean) =>
        several
          ? `L’ordinateur joue pour ${names} jusqu’à leur retour.`
          : `L’ordinateur joue pour ${names} jusqu’à son retour.`,
      back: (name: string) => `${name} est de retour.`,
      tookBack: (name: string) => `${name} reprend sa place.`,
      youTookBack: "Tu reprends ta place. L’ordinateur a joué pour toi pendant ton absence.",
      /** « Paul est chef de table jusqu’au retour d’Ana. » (`ofCreator`: « d’Ana », « de Romain »). */
      hostAway: (host: string, ofCreator: string) =>
        `${host} est chef de table jusqu’au retour ${ofCreator}.`,
      youHost: (ofCreator: string) => `Tu es chef de table jusqu’au retour ${ofCreator}.`,
      creatorBack: (creator: string) => `${creator} est de retour et redevient chef de table.`,
    },
    /** « À la table » (TablePlayers): the players list. */
    players: {
      title: "À la table",
      you: "toi",
      partner: "partenaire",
      opponent: "adversaire",
      host: "chef de table",
      online: "en ligne",
      offline: "hors ligne",
      handedOver: (level: string) => `hors ligne · l’ordinateur joue à sa place (${level})`,
      computer: (level: string) => `ordinateur · ${level}`,
      /** One sentence per row for screen readers: « Jaune : Bruno, partenaire, hors ligne. » */
      row: (colour: string, name: string, tags: readonly string[], status: string) =>
        `${colour} : ${[name, ...tags, status].join(", ")}.`,
    },
  },
  /**
   * The online end plank (02-UI-SPEC « End plank (online) », D-08, plan 02-09): « Revanche » in place
   * of « Rejouer », « Quitter la table » in place of « Changer de couleur », the vote discs and line.
   */
  rematch: {
    agree: "Revanche",
    leave: "Quitter la table",
    group: "Accord pour la revanche",
    nobody: "Revanche : il faut l’accord de tout le monde.",
    /** « Tu es d’accord. En attente de Bruno et Céline… » (`names` already joined). */
    mine: (names: string) => `Tu es d’accord. En attente ${of(names)}…`,
    /** « Bruno veut une revanche. », « Bruno et Céline veulent une revanche. » */
    others: (names: string, several: boolean) =>
      several ? `${names} veulent une revanche.` : `${names} veut une revanche.`,
    all: "Tout le monde est d’accord : nouvelle partie !",
    disc: {
      yes: (name: string) => `${name}, d’accord`,
      no: (name: string) => `${name}, pas encore`,
      offline: (name: string) => `${name}, hors ligne`,
      bot: (name: string) => `${name} (ordinateur), d’accord`,
    },
  },
  /** « Inviter à la table » (02-UI-SPEC « Invite sheet », D-02). */
  invite: {
    title: "Inviter à la table",
    text: "Envoie ce lien à tes proches.",
    qrLabel: "Code QR du lien de la table",
    qrCaption: "À scanner avec l’appareil photo",
    qrFailed: "Code QR indisponible : partage le lien.",
    linkLabel: "Lien de la table",
    share: "Partager le lien",
    copy: "Copier le lien",
    shareTitle: "TOC",
    shareText: (name: string) => `${name} t’invite à une partie de TOC !`,
    copied: "Lien copié.",
    copyFailed: "Impossible de copier. Sélectionne le lien ci-dessus.",
  },
  /** Confirmations of the waiting room (02-UI-SPEC « Confirmations »). */
  confirm: {
    startWithout: {
      title: (names: string) => `Lancer sans ${names} ?`,
      body: (names: string, several: boolean) =>
        several
          ? `${names} n’ont pas de place et ne pourront pas jouer cette partie.`
          : `${names} n’a pas de place et ne pourra pas jouer cette partie.`,
      safe: "Attendre",
      other: "Lancer quand même",
    },
    /** « Arrêter la partie » (the chef de table, from « Réglages », plan 02-07). */
    stop: {
      title: "Arrêter la partie ?",
      body: "La partie est sauvegardée pour tout le monde. Vous la reprendrez avec le même lien, pendant 30 jours.",
      safe: "Continuer à jouer",
      other: "Arrêter la partie",
    },
    /** « Quitter la table » during a game (plan 02-07). */
    leaveGame: {
      title: "Quitter la table ?",
      body: "La partie se met en pause pour les autres jusqu’à ton retour. Reviens avec le même lien ou par « Mes parties en cours ».",
      safe: "Rester à la table",
      other: "Quitter la table",
    },
    leaveRoom: {
      title: "Quitter la table ?",
      body: "Ta place sera libérée. Tu pourras revenir avec le même lien avant le départ.",
      safe: "Rester à la table",
      other: "Quitter la table",
    },
  },
} as const;
