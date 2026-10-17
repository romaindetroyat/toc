// The computer's strength (03-UI-SPEC « Strength picker »): the five levels are horse names (D-02),
// the numbers 1 to 5 stay internal (BOT-01).

export const bots = {
  /** Level names, internal value 1 to 5, in this order. */
  levels: {
    1: "Poulain",
    2: "Trotteur",
    3: "Galopeur",
    4: "Pur-sang",
    5: "Champion",
  },
  heading: "Force de l’ordinateur",
  role: {
    partner: "Partenaire",
    opponent: "Adversaire",
    /** The waiting room's rows (plan 02-05): a free seat of the online table. */
    seat: "Ordinateur",
  },
  /** Accessible name of the partner's group: « Force de Rouge, ton partenaire ». */
  groupPartner: (color: string) => `Force de ${color}, ton partenaire`,
  /** Accessible name of an opponent's group: « Force de Jaune, adversaire ». */
  groupOpponent: (color: string) => `Force de ${color}, adversaire`,
  /** Accessible name of a free seat's group in the waiting room: « Force de Rouge, ordinateur ». */
  groupSeat: (color: string) => `Force de ${color}, ordinateur`,
  /** Option title (hover, fine pointer): « Force 3 sur 5 ». */
  optionTitle: (level: number) => `Force ${level} sur 5`,
} as const;
