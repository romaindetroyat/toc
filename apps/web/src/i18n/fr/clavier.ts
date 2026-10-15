// « Raccourcis clavier » (UI-SPEC « Addendum 2026-10-14 — Raccourcis clavier (ordinateur) »): the help
// sheet opened with « ? », and the short key labels the key hints show on a computer (plan 01-28).
// French typography: U+00A0 before a colon, typographic apostrophe.

export type ShortcutRow = {
  /** The keys, each drawn as a key cap; several keys mean « either of them » (« S » / « A »). */
  keys: string[];
  action: string;
};

export const clavier = {
  title: "Raccourcis clavier",
  intro: "Sur ordinateur, tu peux jouer sans la souris.",
  close: "Fermer",
  /** The link of the Réglages sheet that opens this help (plan 01-28). */
  link: "Raccourcis clavier",
  /** Read between two key caps of one row (« S » ou « A »). */
  or: "ou",

  rows: [
    {
      keys: ["1 à 5"],
      action:
        "Choisir une carte de ta main, de gauche à droite. Pendant l’échange : la carte à passer.",
    },
    { keys: ["A à D"], action: "Choisir le cheval éclairé qui porte cette lettre." },
    { keys: ["Entrée"], action: "Jouer le coup, passer la carte choisie ou poser tes cartes." },
    { keys: ["Échap"], action: "Revenir d’un pas en arrière." },
    { keys: ["S", "A"], action: "As ou Roi : sortir un cheval ou avancer." },
    { keys: ["1 à 7"], action: "Le 7 : donner ce nombre de pas au cheval choisi." },
    { keys: ["Retour arrière"], action: "Le 7 : retirer le dernier pas." },
    {
      keys: ["P"],
      action: "Passer la carte choisie, ou poser tes cartes quand aucune n’est jouable.",
    },
    { keys: ["?"], action: "Afficher cette aide." },
  ] satisfies ShortcutRow[],

  /** The short labels of the key hints (plan 01-28). */
  keys: {
    enter: "Entrée",
    escape: "Échap",
    backspace: "⌫",
    exit: "S",
    advance: "A",
    pass: "P",
    help: "?",
  },
} as const;
