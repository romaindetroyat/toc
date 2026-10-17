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
} as const;
