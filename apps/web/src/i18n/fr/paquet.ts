// « Les cartes jouées » (quick task 261109-80e, after 261109-6an): the sheet that shows, rank by rank,
// how many cards of each value were already played in this pack (the discard pile and the dead hands
// laid down, since the last shuffle), its buttons, its deal line and the défausse target on the felt.
// French typography: U+00A0 before a colon, U+202F inside «  », typographic apostrophe.

/** « 1 carte jouée », « 23 cartes jouées », « aucune carte jouée ». */
const played = (n: number): string =>
  n === 0 ? "aucune carte jouée" : n === 1 ? "1 carte jouée" : `${n} cartes jouées`;

export const paquet = {
  title: "Les cartes jouées",
  /**
   * The accessible name and title of the icon button, the text of the button in « Sur le tapis » and
   * the name of the défausse target on the felt.
   */
  button: "Cartes jouées",
  close: "Fermer",
  /** « Donne 2 sur 3 de ce paquet · 23 cartes jouées ». */
  deal: (deal: number, playedTotal: number): string =>
    `Donne ${deal} sur 3 de ce paquet · ${played(playedTotal)}`,
  /** The second, quieter count: « 18 cartes au talon ». */
  talon: (talon: number): string =>
    talon === 0 ? "Talon vide." : talon === 1 ? "1 carte au talon." : `${talon} cartes au talon.`,
  /** The screen-reader line of one rank, starting with its visible words: « As : 2 jouées sur 4 ». */
  rank: (name: string, n: number): string =>
    n === 0
      ? `${name} : aucune jouée`
      : n === 1
        ? `${name} : 1 jouée sur 4`
        : `${name} : ${n} jouées sur 4`,
  intro:
    "Les cartes déjà jouées dans ce paquet depuis le dernier mélange, mains posées comprises. Ta main et la carte passée à ton partenaire n’y sont pas. Tout repart à zéro quand le paquet est remélangé.",
} as const;
