// « Règles du TOC » (05-UI-SPEC « The « Règles » sheet », plan 05-04; PLAY-06, D-05, D-06): the
// large sheet opened at any moment of a game (the book button, the key R), its ten tabs, the cards
// list and the captions of the fifteen rule figures, drawn live on the galet (D-15). Every text is a
// short rewrite of RULES.md and a draft for Romain, who reviews it (05-UAT.md, test 1). Plain strings
// only, rendered as text. French typography: U+202F before ; ! ? and » and after «, U+00A0 before a
// colon, the typographic apostrophe. Words agree with « cheval », « carte », « partie », never with a
// player (the gender-neutral rule).

import type { Rank } from "@toc/engine";

/** The ten tabs, in their order. */
export const RULES_TABS = [
  "but",
  "cartes",
  "donne",
  "sortir",
  "sept",
  "valet",
  "manger",
  "maison",
  "fini",
  "regles-maison",
] as const;

export type RulesTabId = (typeof RULES_TABS)[number];

/** The rule figures of the sheet, by their RULES.md id (05-UI-SPEC « Figures »). */
export type FigureId =
  | "R-01.1"
  | "R-07.1"
  | "R-08.1"
  | "R-04.2"
  | "R-14.2"
  | "R-06.1"
  | "R-12.1"
  | "R-10.2"
  | "R-10.4"
  | "R-09.1"
  | "R-11.1"
  | "R-13.1"
  | "R-13.5"
  | "R-15.1"
  | "R-13.12";

export type RulesTab = {
  /** The tab's name, which is also its section title (h3). */
  name: string;
  /** A muted line before the text (« Règles de la maison »). */
  intro?: string;
  /** The paragraphs, in order. */
  text: string[];
  /** A list after the paragraphs, one item per rule (« Règles de la maison »). */
  list?: string[];
  /** The figures under the text (« Les cartes »: under the cards list). */
  figures: FigureId[];
};

/** A row of « Les cartes »: one or several ranks that do the same thing. */
export type CardRuleRow = {
  ranks: Rank[];
  /** The card names the row is read with: « As », « 10, 9, 8, 6, 5, 3 et 2 ». */
  names: string;
  effect: string;
  /** The text button at the end of the row that selects a tab. */
  see?: { tab: RulesTabId; label: string };
};

export const regles = {
  title: "Règles du TOC",
  close: "Fermer les règles",
  /** The book button of the game (the phone's right strip, the computer's info row). */
  button: "Règles du jeu",
  /** Plan 05-08: outside a game only, under the tabs (the last item of « Le but » in one column). */
  learn: "Apprendre en jouant",
  /** The name of the tab list. */
  nav: "Les parties des règles",

  tabs: {
    but: {
      name: "Le but",
      text: [
        "On joue à quatre, en deux équipes de deux. Ton partenaire est en face de toi : Bleu avec Rouge, Jaune avec Vert.",
        "Chacun a quatre chevaux. Le but : rentrer les huit chevaux de ton équipe dans leurs maisons, avant l’autre équipe. Dès que le huitième cheval rentre, l’équipe gagne.",
        "On avance avec des cartes, pas avec des dés. Le parcours se fait dans le sens des aiguilles d’une montre.",
      ],
      figures: ["R-01.1"],
    },
    cartes: {
      name: "Les cartes",
      text: ["Chaque carte a son effet. Les couleurs des cartes ne comptent pas."],
      figures: ["R-07.1", "R-08.1"],
    },
    donne: {
      name: "Une donne",
      text: [
        "Les 52 cartes sont distribuées en trois donnes : 5 cartes chacun, puis 4, puis 4. Ensuite on rebat, et le donneur passe au joueur suivant. Le joueur après le donneur commence.",
        "Au début de chaque donne, chacun choisit une carte et la passe à son partenaire, sans la montrer. Les quatre cartes changent de main en même temps. La carte reçue a le bord de la couleur de ton partenaire.",
        "À ton tour, tu joues une carte. Si une carte peut jouer, tu dois la jouer. Si aucune ne peut, tu poses ta main et tu attends la donne suivante.",
      ],
      figures: ["R-04.2", "R-14.2"],
    },
    sortir: {
      name: "Sortir un cheval",
      text: [
        "Tes chevaux commencent dans l’écurie. L’As ou le Roi en sort un sur son losange, la case de sortie à côté de l’écurie. Avec ces cartes, tu peux aussi avancer : de 1 avec l’As, de 13 avec le Roi.",
        "Un cheval qui vient de sortir est protégé sur son losange tant qu’il ne bouge pas : personne ne peut le manger, l’échanger ni le dépasser, pas même tes autres chevaux.",
        "Un cheval qui revient plus tard sur son losange n’y est plus protégé. Tant que ton cheval est sur ton losange, tu ne peux pas en sortir un autre. Sortir sur un cheval d’une autre couleur le mange.",
      ],
      figures: ["R-06.1", "R-12.1"],
    },
    sept: {
      name: "Le 7",
      text: [
        "Le 7 se partage entre tes chevaux : 7 pas en tout, sur un seul cheval ou sur plusieurs, par exemple 3 + 4.",
        "Chaque adversaire que tu dépasses avec le 7 est mangé, au moment où tu passes. Le 7 dépasse tes chevaux et ceux de ton partenaire sans les manger. S’il s’arrête sur un cheval, adversaire ou partenaire, il le mange.",
        "Le 7 se joue en entier ou pas du tout. Le jeu te propose seulement les pas qui permettent de finir à 7.",
      ],
      figures: ["R-10.2", "R-10.4"],
    },
    valet: {
      name: "Le Valet",
      text: [
        "Le Valet échange un de tes chevaux avec celui d’un autre joueur, adversaire ou partenaire : chacun prend la place de l’autre. Personne n’est mangé.",
        "On ne peut pas échanger deux chevaux du même joueur, ni un cheval à l’écurie, ni un cheval rentré, ni un cheval protégé sur son losange. Sans échange possible, le Valet ne se joue pas.",
      ],
      figures: ["R-09.1"],
    },
    manger: {
      name: "Manger",
      text: [
        "Un cheval qui s’arrête sur un autre cheval le mange, même celui de ton partenaire. Le cheval mangé retourne à son écurie.",
        "Tu ne peux jamais t’arrêter sur un de tes chevaux. Passer par-dessus un cheval ne le mange pas, sauf un adversaire dépassé par le 7.",
      ],
      figures: ["R-11.1"],
    },
    maison: {
      name: "Rentrer à la maison",
      text: [
        "Ta maison a quatre cases. On y entre par le carré, deux cases avant ton losange : 1 pas après le carré mène à la première case, 4 pas à la dernière.",
        "Il faut le compte exact, sur une case vide. Les chevaux déjà rentrés se sautent. Si le compte dépasse ou si la case est prise, le cheval continue et refait un tour.",
        "Quand le compte tombe juste, il faut entrer. On n’entre jamais en reculant. Un cheval rentré peut encore avancer dans sa maison, au compte exact.",
      ],
      figures: ["R-13.1", "R-13.5"],
    },
    fini: {
      name: "Quand tu as fini",
      text: [
        "Quand tes quatre chevaux sont rentrés, tu continues avec ceux de ton partenaire : toutes tes cartes les font jouer comme les tiens. Tant qu’il te reste un cheval à jouer, tu ne joues pas les siens.",
      ],
      figures: ["R-15.1"],
    },
    "regles-maison": {
      name: "Règles de la maison",
      intro: "Ce qui change par rapport au TOC qu’on trouve ailleurs.",
      text: [],
      list: [
        "Pas besoin de faire le tour complet : un cheval qui atteint son carré en avançant, après un 4 ou un Valet, peut rentrer.",
        "Le 7 ne mange pas le cheval du partenaire qu’il dépasse, seulement celui sur lequel il s’arrête.",
        "Seul le cheval qui vient de sortir est protégé sur son losange.",
        "Les chevaux déjà rentrés se sautent pour entrer dans la maison.",
        "La carte qui peut faire rentrer un cheval pile le fait rentrer ; une autre carte peut lui faire refaire un tour.",
        "Le 4 recule même un cheval qui vient de sortir.",
        "Seul le Valet déplace un cheval qui n’est pas à toi ; le 5 n’avance que tes chevaux.",
      ],
      figures: ["R-13.12"],
    },
  } satisfies Record<RulesTabId, RulesTab>,

  /** « Les cartes »: every card's effect, in this order (05-UI-SPEC « The cards list »). */
  cards: [
    { ranks: [1], names: "As", effect: "Sort un cheval de l’écurie, ou avance de 1." },
    { ranks: [13], names: "Roi", effect: "Sort un cheval de l’écurie, ou avance de 13." },
    { ranks: [12], names: "Dame", effect: "Avance de 12." },
    {
      ranks: [11],
      names: "Valet",
      effect: "Échange un de tes chevaux avec celui d’un autre joueur.",
      see: { tab: "valet", label: "Voir « Le Valet »" },
    },
    {
      ranks: [10, 9, 8, 6, 5, 3, 2],
      names: "10, 9, 8, 6, 5, 3 et 2",
      effect: "Avance d’autant de cases.",
    },
    {
      ranks: [7],
      names: "7",
      effect: "Se partage entre tes chevaux, 7 pas en tout, et mange les adversaires dépassés.",
      see: { tab: "sept", label: "Voir « Le 7 »" },
    },
    { ranks: [4], names: "4", effect: "Recule de 4, même un cheval qui vient de sortir." },
  ] satisfies CardRuleRow[],

  /**
   * The accessible name of a row: the cards, then the effect (« As : Sort un cheval… »); the row of
   * the card chosen in the game adds « , ta carte choisie ».
   */
  cardRowName(names: string, effect: string, chosen: boolean): string {
    if (!chosen) return `${names} : ${effect}`;
    return `${names} : ${effect.replace(/\.$/u, "")}, ta carte choisie.`;
  },

  /** The figures (05-UI-SPEC « Figures »): the tags of the two halves, the captions, the alt text. */
  figure: {
    before: "Avant",
    after: "Après",
    move: "Le coup",
    /** The alt text of a figure with a position after the move. */
    altAfter: (caption: string): string => `${caption} En haut, avant le coup ; en bas, après.`,
    /** The alt text of a figure without one: the knights concerned are ringed below. */
    altMove: (caption: string): string => `${caption} En haut, la position ; en bas, le coup.`,
    captions: {
      "R-01.1": "Bleu joue avec Rouge, Jaune avec Vert : les partenaires sont face à face.",
      "R-07.1": "La Dame avance de 12.",
      "R-08.1": "Le 4 fait reculer un cheval qui vient de sortir.",
      "R-04.2": "Quand les quatre ont choisi, les cartes changent de main ensemble.",
      "R-14.2": "Aucune carte jouable : la main est posée face visible.",
      "R-06.1": "L’As sort un cheval, ou avance de 1.",
      "R-12.1": "Personne ne dépasse un cheval qui vient de sortir sur son losange.",
      "R-10.2": "Le 7 partagé en 3 + 4 sur deux chevaux.",
      "R-10.4": "Le 7 mange l’adversaire qu’il dépasse.",
      "R-09.1": "Le Valet échange un de tes chevaux avec celui d’un adversaire.",
      "R-11.1": "S’arrêter sur un adversaire le mange.",
      "R-13.1": "Au compte exact, le cheval entre dans sa maison.",
      "R-13.5": "Si le compte dépasse le fond de la maison, le cheval refait un tour.",
      "R-15.1": "Quand tes quatre chevaux sont rentrés, tu joues ceux de ton partenaire.",
      "R-13.12": "Après avoir reculé de 4, le cheval entre sans refaire le tour.",
    } satisfies Record<FigureId, string>,
  },

  /** Online, when the player's turn comes while the sheet is open (it never closes by itself). */
  yourTurn: "C’est à toi de jouer.",
  backToGame: "Revenir à la partie",
} as const;
