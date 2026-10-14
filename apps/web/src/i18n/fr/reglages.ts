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
    "Pas de son sur iPhone ? Vérifie que l’interrupteur de sonnerie, sur le côté, n’est pas en mode silencieux.",
  sfx: "Bruitages",
  reduceMotion: "Réduire les animations",
  reduceMotionHelper: "Les déplacements sont instantanés, sans bonds, ruades ni effets.",

  testSounds: "Tester les sons",
  credits: "Crédits et licences",
} as const;
