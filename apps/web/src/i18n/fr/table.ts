// The online table route copy (02-UI-SPEC « Connecting, errors », « Waiting room »). The server's error
// codes are never shown: each maps to one of these lines.

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
    leaveRoom: {
      title: "Quitter la table ?",
      body: "Ta place sera libérée. Tu pourras revenir avec le même lien avant le départ.",
      safe: "Rester à la table",
      other: "Quitter la table",
    },
  },
} as const;
