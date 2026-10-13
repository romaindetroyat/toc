// Scenarios R-06 to R-08: As and Roi, cards that advance, the 4.
// Declarative data only (no engine call): they feed RULES.md, the engine acceptance tests
// and the debug scenario loader. Conventions are documented on the Scenario type.
// Cell arithmetic: cell = (EXIT[color] + progress) mod 72, with EXIT bleu 0, jaune 18, rouge 36, vert 54.

import type { Scenario } from "../src/types.ts";

export const r06: Scenario[] = [
  {
    id: "R-06.1",
    rule: "R-06",
    title: "L’As sort un pion ou avance de 1 : les deux sont permis",
    before: {
      pawns: { bleu: ["S", { p: 5 }, "S", "S"] },
      hands: { bleu: ["1S"] },
      turn: "bleu",
    },
    expect: {
      legalInclude: [
        { t: "exit", card: "1S", pawn: "bleu0" },
        { t: "move", card: "1S", pawn: "bleu1" },
      ],
    },
  },
  {
    id: "R-06.2",
    rule: "R-06",
    title: "Le Roi sort un pion ou avance de 13",
    before: {
      pawns: { bleu: ["S", { p: 5 }, "S", "S"] },
      hands: { bleu: ["13H"] },
      turn: "bleu",
    },
    action: { t: "move", card: "13H", pawn: "bleu1" },
    expect: {
      legal: true,
      after: { pawns: { bleu: ["S", { p: 18 }, "S", "S"] } },
      legalInclude: [{ t: "exit", card: "13H", pawn: "bleu0" }],
    },
  },
  {
    id: "R-06.3",
    rule: "R-06",
    title: "Sans pion à l’écurie, l’As ne peut qu’avancer",
    before: {
      pawns: { bleu: [{ p: 5 }, { p: 10 }, { p: 20 }, { h: 0 }] },
      hands: { bleu: ["1S"] },
      turn: "bleu",
    },
    expect: {
      legalInclude: [{ t: "move", card: "1S", pawn: "bleu0" }],
      legalExclude: [
        { t: "exit", card: "1S", pawn: "bleu0" },
        { t: "exit", card: "1S", pawn: "bleu1" },
        { t: "exit", card: "1S", pawn: "bleu2" },
        { t: "exit", card: "1S", pawn: "bleu3" },
      ],
    },
  },
  {
    id: "R-06.4",
    rule: "R-06",
    title: "Sortir sur un adversaire garé sur ma sortie le mange",
    before: {
      pawns: { jaune: [{ p: 54 }, "S", "S", "S"] },
      hands: { bleu: ["1S"] },
      turn: "bleu",
    },
    action: { t: "exit", card: "1S", pawn: "bleu0" },
    expect: {
      legal: true,
      captured: ["jaune0"],
      after: {
        pawns: {
          bleu: [{ p: 0 }, "S", "S", "S"],
          jaune: ["S", "S", "S", "S"],
        },
      },
    },
    flags: ["Q13", "Q14"],
  },
  {
    id: "R-06.5",
    rule: "R-06",
    title: "Mon pion sur ma sortie m’empêche d’en sortir un second",
    before: {
      pawns: { bleu: [{ p: 0 }, "S", "S", "S"] },
      hands: { bleu: ["1S"] },
      turn: "bleu",
    },
    action: { t: "exit", card: "1S", pawn: "bleu1" },
    expect: {
      legal: false,
      legalInclude: [{ t: "move", card: "1S", pawn: "bleu0" }],
      legalExclude: [
        { t: "exit", card: "1S", pawn: "bleu1" },
        { t: "exit", card: "1S", pawn: "bleu2" },
        { t: "exit", card: "1S", pawn: "bleu3" },
      ],
    },
    flags: ["Q15"],
  },
];

export const r07: Scenario[] = [
  {
    id: "R-07.1",
    rule: "R-07",
    title: "La Dame avance de 12",
    before: {
      pawns: { bleu: [{ p: 3 }, "S", "S", "S"] },
      hands: { bleu: ["12H"] },
      turn: "bleu",
    },
    action: { t: "move", card: "12H", pawn: "bleu0" },
    expect: { legal: true, after: { pawns: { bleu: [{ p: 15 }, "S", "S", "S"] } } },
  },
  {
    id: "R-07.2",
    rule: "R-07",
    title: "Les cartes 10, 9, 8, 6, 3 et 2 avancent du nombre indiqué",
    before: {
      pawns: { bleu: [{ p: 20 }, "S", "S", "S"] },
      hands: { bleu: ["10S", "9S", "8S", "6S", "3S", "2S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "10S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 30 }, "S", "S", "S"] } },
      playable: { "10S": true, "9S": true, "8S": true, "6S": true, "3S": true, "2S": true },
    },
  },
  {
    id: "R-07.3",
    rule: "R-07",
    title: "Le 5 ne fait avancer que mes propres pions",
    before: {
      pawns: {
        bleu: [{ p: 5 }, "S", "S", "S"],
        rouge: [{ p: 10 }, "S", "S", "S"],
        jaune: [{ p: 7 }, "S", "S", "S"],
      },
      hands: { bleu: ["5S"] },
      turn: "bleu",
    },
    expect: {
      legalInclude: [{ t: "move", card: "5S", pawn: "bleu0" }],
      legalExclude: [
        { t: "move", card: "5S", pawn: "rouge0" },
        { t: "move", card: "5S", pawn: "jaune0" },
      ],
    },
    flags: ["G10"],
  },
  {
    id: "R-07.4",
    rule: "R-07",
    title: "On ne s’arrête jamais sur un de ses propres pions",
    before: {
      pawns: { bleu: [{ p: 5 }, { p: 8 }, "S", "S"] },
      hands: { bleu: ["3S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "3S", pawn: "bleu0" },
    expect: {
      legal: false,
      legalInclude: [{ t: "move", card: "3S", pawn: "bleu1" }],
    },
  },
  {
    id: "R-07.5",
    rule: "R-07",
    title: "Un cheval passe par-dessus les autres sans les manger",
    before: {
      pawns: {
        bleu: [{ p: 5 }, "S", "S", "S"],
        rouge: [{ p: 44 }, "S", "S", "S"],
      },
      hands: { bleu: ["6S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "6S", pawn: "bleu0" },
    expect: {
      legal: true,
      captured: [],
      after: {
        pawns: {
          bleu: [{ p: 11 }, "S", "S", "S"],
          rouge: [{ p: 44 }, "S", "S", "S"],
        },
      },
    },
    flags: ["G11"],
  },
];

export const r08: Scenario[] = [
  {
    id: "R-08.1",
    rule: "R-08",
    title: "Le 4 recule un pion qui vient de sortir",
    before: {
      pawns: { jaune: [{ p: 0 }, "S", "S", "S"] },
      hands: { jaune: ["4S"] },
      turn: "jaune",
    },
    action: { t: "move", card: "4S", pawn: "jaune0" },
    expect: { legal: true, after: { pawns: { jaune: [{ p: -4 }, "S", "S", "S"] } } },
    flags: ["Q18"],
  },
  {
    id: "R-08.2",
    rule: "R-08",
    title: "Le 4 qui recule sur un adversaire le mange",
    before: {
      pawns: {
        bleu: [{ p: 10 }, "S", "S", "S"],
        rouge: [{ p: 42 }, "S", "S", "S"],
      },
      hands: { bleu: ["4S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "4S", pawn: "bleu0" },
    expect: {
      legal: true,
      captured: ["rouge0"],
      after: {
        pawns: {
          bleu: [{ p: 6 }, "S", "S", "S"],
          rouge: ["S", "S", "S", "S"],
        },
      },
    },
  },
  {
    id: "R-08.3",
    rule: "R-08",
    title: "On n’entre jamais dans la maison en reculant",
    before: {
      pawns: { bleu: [{ p: 73 }, "S", "S", "S"] },
      hands: { bleu: ["4S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "4S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 69 }, "S", "S", "S"] } },
    },
    flags: ["Q2"],
  },
  {
    id: "R-08.4",
    rule: "R-08",
    title: "Le 4 ne dépasse pas un pion protégé sur sa sortie",
    before: {
      pawns: {
        bleu: [{ p: 38 }, "S", "S", "S"],
        rouge: [{ p: 0 }, "S", "S", "S"],
      },
      hands: { bleu: ["4S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "4S", pawn: "bleu0" },
    expect: {
      legal: false,
      reason: "blocked-protected",
      playable: { "4S": false },
    },
    flags: ["G4"],
  },
  {
    id: "R-08.5",
    rule: "R-08",
    title: "Mon pion protégé sur ma sortie bloque aussi mon autre pion",
    before: {
      pawns: { bleu: [{ p: 0 }, { p: 2 }, "S", "S"] },
      hands: { bleu: ["4S"] },
      turn: "bleu",
    },
    expect: {
      legalInclude: [{ t: "move", card: "4S", pawn: "bleu0" }],
      legalExclude: [{ t: "move", card: "4S", pawn: "bleu1" }],
    },
    flags: ["G4"],
  },
  {
    id: "R-08.6",
    rule: "R-08",
    title: "Un pion à l’écurie ne peut pas reculer : le 4 est injouable",
    before: {
      hands: { bleu: ["4S"] },
      turn: "bleu",
    },
    expect: {
      playable: { "4S": false },
      reason: "no-pawn-can-move",
      legalExclude: [{ t: "move", card: "4S", pawn: "bleu0" }],
    },
  },
];
