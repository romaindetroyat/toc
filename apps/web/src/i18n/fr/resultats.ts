// « Mes résultats » copy (plan 05-01; 05-UI-SPEC « Mes résultats », Panel 1 « Historique »,
// « Copywriting Contract »). Phase-1 typography: U+202F before ; ! ? » and after «, U+00A0 before :,
// typographic ’. Gender-neutral (02-UI-SPEC, D-12): a guest is « {Prénom} (sans compte) », never
// « invité » or « invitée »; a computer is its level name, never its horse name (it changes every game).

export const resultats = {
  title: "Mes résultats",
  /**
   * Plan 05-07: the solo end plank's line, signed in only (« What counts »); a failure says nothing,
   * a guest has no line.
   */
  report: {
    added: "Partie ajoutée à tes résultats.",
    offline: "Pas de connexion : la partie sera ajoutée à tes résultats au retour du réseau.",
  },
  home: "Accueil",
  /** Under the navigation (D-04): history starts with phase 5. */
  since: "Les parties comptent depuis novembre 2026.",
  /** Plan 05-09: the navigation of the three panels (05-UI-SPEC « Navigation »). */
  nav: {
    label: "Mes résultats",
    history: "Historique",
    stats: "Mes chiffres",
    ranking: "Classement",
  },
  /** The sr-only h2 of each panel (the first is history.heading). */
  panels: { stats: "Mes chiffres", ranking: "Classement entre amis" },
  /** « La connexion est lente. » after 10 s of loading, in every panel. */
  slow: "La connexion est lente.",
  /** The polite live region's count: « 25 parties », « 1 partie ». */
  count: (n: number) => (n >= 2 ? `${n} parties` : `${n} partie`),
  history: {
    heading: "Historique",
    loading: "Chargement de tes parties…",
    error: "Impossible de charger tes parties.",
    retry: "Réessayer",
    /** Plan 05-09: paging by 20 (05-UI-SPEC Panel 1). */
    more: "Voir les parties plus anciennes",
    moreBusy: "Chargement…",
    moreFailed: "Impossible de charger la suite. Réessaie dans un instant.",
    end: "C’est tout : les parties comptent depuis novembre 2026.",
    empty: {
      heading: "Aucune partie pour l’instant",
      body: "Tes parties terminées s’affichent ici, en ligne et contre l’ordinateur. Lance une partie pour commencer.",
      solo: "Jouer contre l’ordinateur",
    },
  },
  /** Plan 05-09: « Mes chiffres » (05-UI-SPEC Panel 2). */
  stats: {
    loading: "Chargement de tes chiffres…",
    error: "Impossible de charger tes chiffres.",
    filter: "Parties comptées",
    all: "Toutes",
    online: "En ligne",
    solo: "Contre l’ordinateur",
    /** The live region on a change of filter: « En ligne : 7 parties ». */
    announce: (filter: string, count: string) => `${filter} : ${count}`,
    tiles: { games: "Parties", wins: "Victoires", rate: "Réussite" },
    /** The rate without a game. */
    noRate: "–",
    knights: {
      heading: "Chevaux",
      captured: "Mangés par toi",
      lost: "Mangés à toi",
      home: "Rentrés par toi",
    },
    partners: {
      heading: "Avec mes partenaires",
      guests: "Joueurs sans compte",
      /** Computers of one level: « Pur-sang (ordinateur) ». */
      bot: (level: string) => `${level} (ordinateur)`,
      more: "Voir tous mes partenaires",
      /** The live region when all partners show: « 9 partenaires ». */
      shown: (n: number) => `${n} partenaires`,
    },
    levels: {
      heading: "Contre l’ordinateur, par force",
      intro: "Classé par la force de l’adversaire le plus fort.",
    },
    /** « 3 parties · 2 victoires · 67 % », « 1 partie · 1 victoire · 100 % ». */
    line: (games: number, wins: number, rate: string) =>
      `${games} ${games >= 2 ? "parties" : "partie"} · ${wins} ${wins >= 2 ? "victoires" : "victoire"} · ${rate}`,
    empty: {
      heading: "Pas encore de chiffres",
      body: "Termine une partie, en ligne ou contre l’ordinateur, pour voir tes chiffres ici.",
      filter: "Aucune partie de ce genre pour l’instant.",
    },
  },
  /** Plan 05-09: « Classement » (05-UI-SPEC Panel 3, D-13). */
  ranking: {
    loading: "Chargement du classement…",
    error: "Impossible de charger le classement.",
    intro:
      "Entre toi et tes amis, sur les parties en ligne jouées avec au moins un autre joueur qui a un compte.",
    me: "toi",
    /** « 1er », « 2e ». */
    rank: (n: number) => (n === 1 ? "1er" : `${n}e`),
    /** « 12 parties · 8 victoires ». */
    line: (games: number, wins: number) =>
      `${games} ${games >= 2 ? "parties" : "partie"} · ${wins} ${wins >= 2 ? "victoires" : "victoire"}`,
    /** The row's accessible name: « 2e, Marie, 67 %, 12 parties, 8 victoires ». */
    label: (rank: string, name: string, rate: string, games: number, wins: number) =>
      `${rank}, ${name}, ${rate}, ${games} ${games >= 2 ? "parties" : "partie"}, ${wins} ${wins >= 2 ? "victoires" : "victoire"}`,
    unranked: {
      heading: "Pas encore au classement",
      line: "Il faut 5 parties pour entrer au classement.",
      /** « 1 partie sur 5 ». */
      count: (n: number, of: number) => `${n} ${n >= 2 ? "parties" : "partie"} sur ${of}`,
      /** « Marie, 1 partie sur 5 ». */
      label: (name: string, count: string) => `${name}, ${count}`,
    },
    noFriend: {
      heading: "Pas encore d’amis sur TOC",
      body: "Invite un proche pour vous mesurer entre amis.",
      friends: "Mes amis",
    },
    nobody: {
      heading: "Personne n’est encore au classement",
      body: "Jouez ensemble en ligne : chacun y entre après 5 parties.",
      create: "Créer une table en ligne",
      creating: "Création de la table…",
      offline: "Pas de connexion : la table en ligne a besoin d’Internet.",
      failed: "La table n’a pas pu être créée. Réessaie dans un instant.",
    },
    how: "Comment ça marche ?",
    sheet: {
      title: "Le classement",
      paragraphs: [
        "Le classement compte les parties en ligne terminées où au moins deux joueurs ont un compte, partenaires ou adversaires. Les parties contre l’ordinateur seul n’y comptent pas.",
        "Chacun compte toutes ses parties classées, pas seulement celles jouées avec toi. On entre au classement après 5 parties.",
        "On classe au pourcentage de victoires. À égalité, le plus de victoires passe devant, puis le plus de parties.",
      ],
      close: "Fermer",
    },
  },
  /** Plan 05-09: the detail sheet of a game (05-UI-SPEC « Game detail sheet »). */
  sheet: {
    /** « Partie du samedi 24 octobre ». */
    title: (day: string) => `Partie du ${day}`,
    online: (creator: string) => `En ligne, à la table de ${creator}`,
    onlineAlone: "En ligne",
    solo: "Contre l’ordinateur",
    win: "Victoire de ton équipe",
    loss: "Défaite de ton équipe",
    score: (mine: number, theirs: number) =>
      `Chevaux rentrés : ton équipe ${mine}, l’équipe adverse ${theirs}`,
    mine: "Ton équipe",
    theirs: "L’équipe adverse",
    me: "toi",
    guest: "(sans compte)",
    bot: "(ordinateur)",
    handedOver: "l’ordinateur a fini à sa place",
    /** « De 20 h 31 à 21 h 14 (43 min) ». */
    span: (from: string, to: string, length: string) => `De ${from} à ${to} (${length})`,
    /** « 43 min » (U+202F between the number and its unit). */
    minutes: (n: number) => `${n} min`,
    /** « 1 h 05 » (U+00A0 around « h », as the times). */
    hours: (hours: number, minutes: string) => `${hours} h ${minutes}`,
    deals: (n: number) => `Donnes jouées : ${n}`,
    eaten: (mine: number, theirs: number) =>
      `Chevaux mangés : ton équipe ${mine}, l’équipe adverse ${theirs}`,
    ranked: "Cette partie compte pour le classement entre amis.",
    alone: "Elle ne compte pas pour le classement : il faut au moins deux joueurs avec un compte.",
    soloCounting: "Partie contre l’ordinateur : elle compte dans tes chiffres, pas au classement.",
    close: "Fermer",
  },
  row: {
    win: "Victoire",
    loss: "Défaite",
    /** Line 1: « Victoire · 8 – 5 », own team first. */
    line1: (result: string, mine: number, theirs: number) => `${result} · ${mine} – ${theirs}`,
    /** Line 2: « Avec Marie · contre Paul et Pur-sang ». */
    line2: (partner: string, opponents: string) => `Avec ${partner} · contre ${opponents}`,
    /** Two names: « Paul et Pur-sang ». */
    both: (a: string, b: string) => `${a} et ${b}`,
    /** Two opponent computers of the same level: « deux ordinateurs Galopeur ». */
    twoComputers: (level: string) => `deux ordinateurs ${level}`,
    /** A guest: « Mamie (sans compte) » (D-12). */
    guest: (name: string) => `${name} (sans compte)`,
    /** The end time « 21 h 14 », U+00A0 around « h ». */
    time: (hour: string, minute: string) => `${hour} h ${minute}`,
    online: "en ligne",
    solo: "contre l’ordinateur",
    /**
     * The row's accessible name. Plan 05-10 (WCAG 2.5.3 « Label in Name »): the row's visible words in
     * order, then how it was played: « Victoire · 8 – 5, Avec Marie · contre Paul et Pur-sang, 25 oct.,
     * 21 h 14, en ligne ».
     */
    label: (input: { line1: string; line2: string; date: string; time: string; kind: string }) =>
      `${input.line1}, ${input.line2}, ${input.date}, ${input.time}, ${input.kind}`,
  },
} as const;
