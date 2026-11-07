// « Mes résultats » copy (plan 05-01; 05-UI-SPEC « Mes résultats », Panel 1 « Historique »,
// « Copywriting Contract »). Phase-1 typography: U+202F before ; ! ? » and after «, U+00A0 before :,
// typographic ’. Gender-neutral (02-UI-SPEC, D-12): a guest is « {Prénom} (sans compte) », never
// « invité » or « invitée ».

export const resultats = {
  title: "Mes résultats",
  home: "Accueil",
  history: {
    heading: "Historique",
    loading: "Chargement de tes parties…",
    error: "Impossible de charger tes parties.",
    retry: "Réessayer",
  },
  row: {
    win: "Victoire",
    loss: "Défaite",
    /** Line 1: « Victoire · 8 – 5 », own team first. */
    line1: (result: string, mine: number, theirs: number) => `${result} · ${mine} – ${theirs}`,
  },
} as const;
