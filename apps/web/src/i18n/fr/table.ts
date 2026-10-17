// The online table route copy (02-UI-SPEC « Connecting, errors », « Waiting room »). The server's error
// codes are never shown: each maps to one of these lines.

export const table = {
  connecting: "Connexion à la table…",
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
  },
} as const;
