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
  history: {
    heading: "Historique",
    loading: "Chargement de tes parties…",
    error: "Impossible de charger tes parties.",
    retry: "Réessayer",
    empty: {
      heading: "Aucune partie pour l’instant",
      body: "Tes parties terminées s’affichent ici, en ligne et contre l’ordinateur. Lance une partie pour commencer.",
      solo: "Jouer contre l’ordinateur",
    },
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
     * The row's accessible name: « Victoire, 8 à 5, le 25 octobre à 21 h 14, en ligne, avec Marie,
     * contre Paul et Pur-sang ».
     */
    label: (input: {
      result: string;
      mine: number;
      theirs: number;
      day: string;
      time: string;
      kind: string;
      partner: string;
      opponents: string;
    }) =>
      `${input.result}, ${input.mine} à ${input.theirs}, le ${input.day} à ${input.time}, ${input.kind}, avec ${input.partner}, contre ${input.opponents}`,
  },
} as const;
