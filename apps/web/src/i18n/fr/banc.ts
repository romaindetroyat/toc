// The bench page « Banc d’essai de l’ordinateur » (#/banc, 03-UI-SPEC « Bench page »): Romain opens it
// on his phone to time the computer there and send the numbers. French typography is written out in
// the strings: U+202F before ; ! ? » and after «, and between a number and its unit or as the
// thousands separator; U+00A0 before « : »; typographic apostrophe.

/** A whole number of milliseconds, French style: « 1 240 ms ». */
export function ms(value: number): string {
  const digits = String(Math.round(value)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${digits} ms`;
}

export const banc = {
  back: "Retour",
  title: "Banc d’essai de l’ordinateur",
  intro:
    "Mesure le temps que met l’ordinateur pour choisir ses coups sur cet appareil. Garde l’écran allumé et reste sur cette page pendant la mesure.",
  levelLabel: "Force mesurée",
  start: "Lancer la mesure",
  stop: "Arrêter la mesure",
  /** « Coup 3 sur 40 ». */
  progress: (i: number, n: number) => `Coup ${i} sur ${n}`,
  progressName: "Avancement de la mesure",
  emptyHeading: "Aucune mesure pour l’instant",
  emptyBody: "Touche « Lancer la mesure » pour commencer. Garde l’écran allumé pendant la mesure.",
  resultsHeading: "Résultats",
  rows: {
    count: "Coups mesurés",
    p50: "Temps médian",
    p95: "95 % des coups en moins de",
    max: "Le plus long",
    frozen: "Plus longue image figée",
  },
  /** « Mesure arrêtée après 12 coups. » (« coup » for 0 or 1). */
  stopped: (i: number) => `Mesure arrêtée après ${i} ${i > 1 ? "coups" : "coup"}.`,
  interrupted:
    "Mesure interrompue : l’app est passée en arrière-plan. Relance la mesure, écran allumé.",
  fast: "Assez rapide sur cet appareil.",
  slow: "Trop lent sur cet appareil. Envoie ces résultats.",
  copy: "Copier les résultats",
  copied: "Résultats copiés.",
  copyFailed: "Impossible de copier. Sélectionne le texte ci-dessous.",
  resultsBox: "Mes résultats",
  error: {
    heading: "La mesure s’est arrêtée sur une erreur.",
    body: "Recharge la page, puis relance la mesure.",
    reload: "Recharger la page",
  },
} as const;

export type BenchResults = {
  count: number;
  p50: number;
  p95: number;
  max: number;
  frozen: number;
};

/** The copied text (03-UI-SPEC « Copied text »): plain, one item per line. */
export function resultsText(
  level: string,
  results: BenchResults,
  userAgent: string,
  date: string,
): string {
  return [
    `Banc d’essai TOC · ${level}`,
    `${banc.rows.count} : ${results.count}`,
    `${banc.rows.p50} : ${ms(results.p50)}`,
    `${banc.rows.p95} : ${ms(results.p95)}`,
    `${banc.rows.max} : ${ms(results.max)}`,
    `${banc.rows.frozen} : ${ms(results.frozen)}`,
    `Navigateur : ${userAgent}`,
    `Date : ${date}`,
  ].join("\n");
}
