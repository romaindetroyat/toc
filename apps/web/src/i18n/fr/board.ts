const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

export const board = {
  alt: "Le plateau du jeu de TOC",
  pawn: {
    bleu: "Cheval bleu",
    jaune: "Cheval jaune",
    rouge: "Cheval rouge",
    vert: "Cheval vert",
  },
  /**
   * Plan 05-10 (05-UI-SPEC « Knight names »): every knight's accessible name, « Cheval bleu A, à toi,
   * à 12 cases de sa sortie », built by board/knightName.ts.
   */
  knight: {
    name: (pawn: string, letter: string, owner: string, where: string) =>
      `${pawn} ${letter}, ${owner}, ${where}`,
    mine: "à toi",
    partner: (name: string) => (name === "" ? "à ton partenaire" : `à ton partenaire ${name}`),
    opponent: "adversaire",
    stable: "à l’écurie",
    home: "à la maison",
    exit: "sur sa case de sortie",
    ring: (n: number) => `à ${n} ${plural(n, "case", "cases")} de sa sortie`,
    lit: (name: string) => `${name}, jouable`,
  },
} as const;
