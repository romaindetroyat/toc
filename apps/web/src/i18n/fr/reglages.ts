// « Réglages » sheet (UI-SPEC « Réglages, sound test, credits »). French typography is written out:
// U+202F before ? ! ; and », typographic apostrophe.
export const reglages = {
  title: "Réglages",
  /** The text button that opens the sheet, on the launch screen. */
  open: "Réglages",
  /** The gear in the info bar of the game. */
  openLabel: "Réglages",
  close: "Fermer",

  sound: "Son",
  soundHelper:
    "Le son joue aussi quand l’iPhone est en mode silencieux. Pas de son ? Monte le volume avec les boutons sur le côté.",
  sfx: "Bruitages",
  reduceMotion: "Réduire les animations",
  reduceMotionHelper: "Les déplacements sont instantanés, sans bonds, ruades ni effets.",

  testSounds: "Tester les sons",
  credits: "Crédits et licences",
  /** At an online table (plan 02-05): leave it, after a confirmation. */
  leaveTable: "Quitter la table",
  /** The chef de table's « Arrêter la partie » in an online game (plan 02-07). */
  stopGame: "Arrêter la partie",
  /**
   * The table-wide « Avance rapide » (plan 02-10b): the chef de table switches it, the others see it
   * disabled with the chef de table's name.
   */
  tableFast: "Avance rapide",
  tableFastHelper:
    "Pour toute la table : les ordinateurs jouent presque aussitôt et les coups vont plus vite.",
  tableFastOthers: (host: string) => `Seul le chef de table, ${host}, peut la changer.`,
  /** Plan 04-08: while installing TOC is possible (the browser's prompt, or « Installer TOC »). */
  install: "Installer l’application",
  /** Plan 04-08: in a game or at a table, when a new version waits (APP-02). */
  updateReady:
    "Une nouvelle version est prête : elle s’installera quand tu reviendras à l’accueil.",
  /** The gear's accessible name while the table is fast. */
  openLabelFast: "Réglages (avance rapide pour toute la table)",
} as const;
