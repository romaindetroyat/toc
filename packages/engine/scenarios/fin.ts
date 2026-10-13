// Scenarios R-14 (main injouable), R-15 (joueur qui a fini) and R-16 (fin de partie).
// Declarative data only (no engine call): they feed RULES.md, the engine acceptance tests
// and the debug scenario loader. Conventions are documented on the Scenario type.
// Cell arithmetic: cell = (EXIT[color] + progress) mod 72, with EXIT bleu 0, jaune 18, rouge 36, vert 54.
// Progress after a swap (G1, default): (cell - EXIT[color]) mod 72, so the lap count is lost.

import type { Scenario } from "../src/types.ts";

export const r14: Scenario[] = [
  {
    id: "R-14.1",
    rule: "R-14",
    title: "Une main en partie jouable doit se jouer : on ne peut pas la poser",
    before: {
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"] },
      hands: { bleu: ["4S", "11S"] },
      turn: "bleu",
    },
    expect: {
      playable: { "4S": true, "11S": false },
      reason: "jack-no-target",
      legalInclude: [{ t: "move", card: "4S", pawn: "bleu0" }],
      legalExclude: [{ t: "discard" }],
    },
  },
  {
    id: "R-14.2",
    rule: "R-14",
    title: "Une main entièrement injouable est posée face visible",
    before: {
      hands: { bleu: ["2S", "4S", "11S"] },
      turn: "bleu",
    },
    action: { t: "discard" },
    expect: {
      legal: true,
      playable: { "2S": false, "4S": false, "11S": false },
      handSizes: { bleu: 0 },
      events: ["handDiscarded", "turn"],
    },
  },
  {
    id: "R-14.3",
    rule: "R-14",
    title: "Si les quatre mains sont injouables, la donne se termine et la suivante commence",
    before: {
      hands: { bleu: ["2S"], jaune: ["3S"], rouge: ["4S"], vert: ["5S"] },
      turn: "bleu",
      dealer: "vert",
      dealIndex: 0,
    },
    script: [
      { seat: "bleu", action: { t: "discard" } },
      { seat: "jaune", action: { t: "discard" } },
      { seat: "rouge", action: { t: "discard" } },
      { seat: "vert", action: { t: "discard" } },
    ],
    expect: {
      deal: { sizes: [4, 4, 4, 4], dealer: "vert", first: "bleu" },
    },
  },
  {
    id: "R-14.4",
    rule: "R-14",
    title: "Le joueur qui a posé ses cartes est sauté jusqu’à la donne suivante",
    before: {
      pawns: {
        jaune: [{ p: 5 }, "S", "S", "S"],
        rouge: [{ p: 5 }, "S", "S", "S"],
        vert: [{ p: 5 }, "S", "S", "S"],
      },
      hands: { bleu: ["2S"], jaune: ["2H", "3H"], rouge: ["2D", "3D"], vert: ["2C", "3C"] },
      turn: "bleu",
    },
    script: [
      { seat: "bleu", action: { t: "discard" } },
      { seat: "jaune", action: { t: "move", card: "2H", pawn: "jaune0" } },
      { seat: "rouge", action: { t: "move", card: "2D", pawn: "rouge0" } },
      { seat: "vert", action: { t: "move", card: "2C", pawn: "vert0" } },
    ],
    expect: {
      turn: "jaune",
      handSizes: { bleu: 0, jaune: 1, rouge: 1, vert: 1 },
      after: {
        pawns: {
          jaune: [{ p: 7 }, "S", "S", "S"],
          rouge: [{ p: 7 }, "S", "S", "S"],
          vert: [{ p: 7 }, "S", "S", "S"],
        },
      },
    },
  },
];

export const r15: Scenario[] = [
  {
    id: "R-15.1",
    rule: "R-15",
    title: "Un joueur qui a fini avance un pion de son partenaire avec le 2",
    before: {
      pawns: {
        bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
        rouge: [{ p: 10 }, { p: 20 }, "S", "S"],
      },
      hands: { bleu: ["2S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "2S", pawn: "rouge0" },
    expect: {
      legal: true,
      after: { pawns: { rouge: [{ p: 12 }, { p: 20 }, "S", "S"] } },
    },
  },
  {
    id: "R-15.2",
    rule: "R-15",
    title: "Le 5 fait avancer les pions du partenaire quand on a fini",
    before: {
      pawns: {
        bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
        rouge: [{ p: 10 }, { p: 20 }, "S", "S"],
      },
      hands: { bleu: ["5S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "5S", pawn: "rouge0" },
    expect: {
      legal: true,
      after: { pawns: { rouge: [{ p: 15 }, { p: 20 }, "S", "S"] } },
    },
    flags: ["Q16"],
  },
  {
    id: "R-15.3",
    rule: "R-15",
    title: "Le 7 se répartit entre les pions du partenaire",
    before: {
      pawns: {
        bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
        rouge: [{ p: 10 }, { p: 20 }, "S", "S"],
      },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: {
      t: "seven",
      card: "7S",
      plan: [
        { pawn: "rouge0", steps: 3 },
        { pawn: "rouge1", steps: 4 },
      ],
    },
    expect: {
      legal: true,
      after: { pawns: { rouge: [{ p: 13 }, { p: 24 }, "S", "S"] } },
    },
  },
  {
    id: "R-15.4",
    rule: "R-15",
    title: "Le Valet échange un pion du partenaire avec un adversaire",
    before: {
      pawns: {
        bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
        rouge: [{ p: 10 }, "S", "S", "S"],
        jaune: [{ p: 20 }, "S", "S", "S"],
      },
      hands: { bleu: ["11S"] },
      turn: "bleu",
    },
    action: { t: "swap", card: "11S", pawn: "rouge0", target: "jaune0" },
    expect: {
      legal: true,
      after: {
        pawns: { rouge: [{ p: 2 }, "S", "S", "S"], jaune: [{ p: 28 }, "S", "S", "S"] },
      },
    },
    flags: ["G7", "G1"],
  },
  {
    id: "R-15.5",
    rule: "R-15",
    title: "L’As sort un pion du partenaire de son écurie",
    before: {
      pawns: {
        bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
        rouge: [{ p: 10 }, { p: 20 }, "S", "S"],
      },
      hands: { bleu: ["1S"] },
      turn: "bleu",
    },
    action: { t: "exit", card: "1S", pawn: "rouge2" },
    expect: {
      legal: true,
      after: { pawns: { rouge: [{ p: 10 }, { p: 20 }, { p: 0 }, "S"] } },
      legalInclude: [{ t: "exit", card: "1S", pawn: "rouge2" }],
    },
  },
  {
    id: "R-15.6",
    rule: "R-15",
    title: "Un pion du partenaire joué par moi mange comme un de mes pions",
    before: {
      pawns: {
        bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
        rouge: [{ p: 10 }, "S", "S", "S"],
        jaune: [{ p: 30 }, "S", "S", "S"],
      },
      hands: { bleu: ["2S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "2S", pawn: "rouge0" },
    expect: {
      legal: true,
      captured: ["jaune0"],
      after: {
        pawns: { rouge: [{ p: 12 }, "S", "S", "S"], jaune: ["S", "S", "S", "S"] },
      },
    },
    flags: ["G7"],
  },
  {
    id: "R-15.7",
    rule: "R-15",
    title: "Tant qu’il me reste un pion à jouer, je ne joue pas ceux de mon partenaire",
    before: {
      pawns: {
        bleu: [{ p: 10 }, { h: 0 }, { h: 1 }, { h: 2 }],
        rouge: [{ p: 20 }, "S", "S", "S"],
      },
      hands: { bleu: ["2S"] },
      turn: "bleu",
    },
    expect: {
      legalInclude: [{ t: "move", card: "2S", pawn: "bleu0" }],
      legalExclude: [{ t: "move", card: "2S", pawn: "rouge0" }],
    },
  },
  {
    id: "R-15.8",
    rule: "R-15",
    title:
      "Un 7 qui rentre mon dernier pion peut finir avec les pions du partenaire (choix par défaut)",
    before: {
      pawns: {
        bleu: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 69 }],
        rouge: [{ p: 10 }, "S", "S", "S"],
      },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: {
      t: "seven",
      card: "7S",
      plan: [
        { pawn: "bleu3", steps: 2 },
        { pawn: "rouge0", steps: 5 },
      ],
    },
    expect: {
      legal: true,
      after: {
        pawns: {
          bleu: [{ h: 1 }, { h: 2 }, { h: 3 }, { h: 0 }],
          rouge: [{ p: 15 }, "S", "S", "S"],
        },
      },
      events: ["cardPlayed", "pawnEnteredHome", "playerFinished", "pawnMoved", "turn"],
    },
    flags: ["G12"],
  },
  {
    id: "R-15.9",
    rule: "R-15",
    title:
      "Autre choix possible : le 7 se joue entièrement avec les pions d’avant le tour (alternative de G12)",
    before: {
      pawns: {
        bleu: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 69 }],
        rouge: [{ p: 10 }, "S", "S", "S"],
      },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: {
      t: "seven",
      card: "7S",
      plan: [
        { pawn: "bleu3", steps: 2 },
        { pawn: "rouge0", steps: 5 },
      ],
    },
    expect: {
      legal: false,
      legalInclude: [{ t: "seven", card: "7S", plan: [{ pawn: "bleu3", steps: 7 }] }],
    },
    flags: ["G12", "alt"],
  },
];

export const r16: Scenario[] = [
  {
    id: "R-16.1",
    rule: "R-16",
    title: "Le huitième pion rentré donne la victoire à l’équipe",
    before: {
      pawns: {
        bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
        rouge: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 66 }],
      },
      hands: { rouge: ["5S"] },
      turn: "rouge",
    },
    action: { t: "move", card: "5S", pawn: "rouge3" },
    expect: {
      legal: true,
      after: {
        pawns: {
          bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
          rouge: [{ h: 1 }, { h: 2 }, { h: 3 }, { h: 0 }],
        },
      },
      phase: "won",
      events: ["cardPlayed", "pawnEnteredHome", "gameWon"],
    },
  },
  {
    id: "R-16.2",
    rule: "R-16",
    title: "Avec sept pions rentrés, la partie continue",
    before: {
      pawns: {
        bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
        rouge: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 10 }],
      },
      hands: { rouge: ["2S"] },
      turn: "rouge",
    },
    action: { t: "move", card: "2S", pawn: "rouge3" },
    expect: {
      legal: true,
      after: {
        pawns: {
          bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
          rouge: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 12 }],
        },
      },
      phase: "play",
      events: ["cardPlayed", "pawnMoved", "turn"],
    },
  },
  {
    id: "R-16.3",
    rule: "R-16",
    title: "Un 7 qui rentre le huitième pion donne aussi la victoire",
    before: {
      pawns: {
        bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
        rouge: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 64 }],
      },
      hands: { rouge: ["7S"] },
      turn: "rouge",
    },
    action: { t: "seven", card: "7S", plan: [{ pawn: "rouge3", steps: 7 }] },
    expect: {
      legal: true,
      after: {
        pawns: {
          bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
          rouge: [{ h: 1 }, { h: 2 }, { h: 3 }, { h: 0 }],
        },
      },
      phase: "won",
      events: ["cardPlayed", "pawnEnteredHome", "gameWon"],
    },
  },
  {
    id: "R-16.4",
    rule: "R-16",
    title: "Le huitième pion peut être rentré par le partenaire qui a déjà fini",
    before: {
      pawns: {
        bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
        rouge: [{ h: 1 }, { h: 2 }, { h: 3 }, { p: 66 }],
      },
      hands: { bleu: ["5S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "5S", pawn: "rouge3" },
    expect: {
      legal: true,
      after: {
        pawns: {
          bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
          rouge: [{ h: 1 }, { h: 2 }, { h: 3 }, { h: 0 }],
        },
      },
      phase: "won",
      events: ["cardPlayed", "pawnEnteredHome", "gameWon"],
    },
  },
];
