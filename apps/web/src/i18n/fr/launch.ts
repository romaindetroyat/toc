export const launch = {
  title: "TOC",
  tagline: "Le jeu de petits chevaux à cartes",
  play: "Jouer la partie",
  /** The text button at the left of the button row: back to « Accueil » (#/, plan 02-04). */
  home: "Accueil",
  chooseColor: "Choisis ta couleur",
  partner: "Partenaire",
  yourTeamLabel: "Ton équipe :",
  opponentsLabel: "Adversaires :",
  /** Full sentence for screen readers: "Ton équipe: Bleu + Rouge". */
  yourTeam: (color: string, partner: string) => `Ton équipe : ${color} + ${partner}`,
  /** Full sentence for screen readers: "Adversaires: Jaune + Vert". */
  opponents: (names: readonly string[]) => `Adversaires : ${names.join(" + ")}`,
  note: "Tu joues avec un partenaire et contre deux adversaires, tous gérés par l’ordinateur.",
} as const;
