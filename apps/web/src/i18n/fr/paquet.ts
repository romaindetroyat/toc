// « Les cartes du paquet » (quick task 261109-6an): the sheet that shows, rank by rank, how many cards
// of the pack the player has not seen yet (exactly what a computer player knows), its buttons and its
// deal line. French typography: U+00A0 before a colon, U+202F inside « », typographic apostrophe.

export const paquet = {
  title: "Les cartes du paquet",
  /** The accessible name and title of the icon buttons, and the text of the button in « Sur le tapis ». */
  button: "Les cartes du paquet",
  close: "Fermer",
  /** « Donne 2 sur 3 de ce paquet · 18 cartes au talon ». */
  deal: (deal: number, talon: number): string => {
    const rest =
      talon === 0 ? "talon vide" : talon === 1 ? "1 carte au talon" : `${talon} cartes au talon`;
    return `Donne ${deal} sur 3 de ce paquet · ${rest}`;
  },
  /** The screen-reader line of one rank: « Valet : 3 cachées sur 4 ». */
  rank: (name: string, n: number): string =>
    n === 0
      ? `${name} : aucune cachée`
      : n === 1
        ? `${name} : 1 cachée sur 4`
        : `${name} : ${n} cachées sur 4`,
  intro:
    "Les cartes de chaque valeur que tu n’as pas encore vues : elles sont dans les autres mains ou au talon. Ta main, les cartes jouées, les mains posées et la carte passée à ton partenaire sont déjà comptées.",
} as const;
