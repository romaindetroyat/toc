// Scenarios R-11 (prise), R-12 (case de sortie protégée) and R-13 (entrée dans la maison).
// Declarative data only (no engine call): they feed RULES.md, the engine acceptance tests
// and the debug scenario loader. Conventions are documented on the Scenario type.
// Cell arithmetic: cell = (EXIT[color] + progress) mod 72, with EXIT bleu 0, jaune 18, rouge 36, vert 54.
// Home entry (D-01 to D-03, G14): the entry square is the cell EXIT - 2 (the carré 16), reached at
// progress 70 on the first lap or at -2 after a backward 4 (G14: the full lap is not required); `r`
// steps beyond it (1 to 4) land in home slot r - 1 if that slot is empty, jumping the knights already
// home on the slots before it (G17, 2026-10-15; before it, G2 asked every slot before it to be empty).

import type { Scenario } from "../src/types.ts";

export const r11: Scenario[] = [
  {
    id: "R-11.1",
    rule: "R-11",
    title: "S’arrêter sur un adversaire le mange",
    before: {
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
      hands: { bleu: ["3S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "3S", pawn: "bleu0" },
    expect: {
      legal: true,
      captured: ["jaune0"],
      after: {
        pawns: { bleu: [{ p: 8 }, "S", "S", "S"], jaune: ["S", "S", "S", "S"] },
      },
      events: ["cardPlayed", "pawnMoved", "pawnCaptured", "pawnSentHome", "turn"],
    },
  },
  {
    id: "R-11.2",
    rule: "R-11",
    title: "S’arrêter sur le pion du partenaire le mange aussi",
    before: {
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"], rouge: [{ p: 44 }, "S", "S", "S"] },
      hands: { bleu: ["3S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "3S", pawn: "bleu0" },
    expect: {
      legal: true,
      captured: ["rouge0"],
      after: {
        pawns: { bleu: [{ p: 8 }, "S", "S", "S"], rouge: ["S", "S", "S", "S"] },
      },
      events: ["cardPlayed", "pawnMoved", "pawnCaptured", "pawnSentHome", "turn"],
    },
    flags: ["Q23"],
  },
  {
    id: "R-11.3",
    rule: "R-11",
    title: "On ne s’arrête jamais sur un de ses propres pions, même de loin",
    before: {
      pawns: { bleu: [{ p: 10 }, { p: 22 }, "S", "S"] },
      hands: { bleu: ["12H"] },
      turn: "bleu",
    },
    action: { t: "move", card: "12H", pawn: "bleu0" },
    expect: {
      legal: false,
      legalInclude: [{ t: "move", card: "12H", pawn: "bleu1" }],
      legalExclude: [{ t: "move", card: "12H", pawn: "bleu0" }],
    },
  },
  {
    id: "R-11.4",
    rule: "R-11",
    title: "Un pion mangé perd tous ses tours et retourne à l’écurie",
    before: {
      pawns: { bleu: [{ p: 43 }, "S", "S", "S"], jaune: [{ p: 100 }, "S", "S", "S"] },
      hands: { bleu: ["3S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "3S", pawn: "bleu0" },
    expect: {
      legal: true,
      captured: ["jaune0"],
      after: {
        pawns: { bleu: [{ p: 46 }, "S", "S", "S"], jaune: ["S", "S", "S", "S"] },
      },
    },
  },
];

export const r12: Scenario[] = [
  {
    id: "R-12.1",
    rule: "R-12",
    title: "On ne dépasse pas un pion protégé sur sa sortie",
    before: {
      pawns: { bleu: [{ p: 30 }, "S", "S", "S"], rouge: [{ p: 0 }, "S", "S", "S"] },
      hands: { bleu: ["10S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "10S", pawn: "bleu0" },
    expect: {
      legal: false,
      reason: "blocked-protected",
      playable: { "10S": false },
    },
  },
  {
    id: "R-12.2",
    rule: "R-12",
    title: "Reculer de 4 ne dépasse pas non plus un pion protégé",
    before: {
      pawns: { rouge: [{ p: 21 }, "S", "S", "S"], vert: [{ p: 0 }, "S", "S", "S"] },
      hands: { rouge: ["4S"] },
      turn: "rouge",
    },
    action: { t: "move", card: "4S", pawn: "rouge0" },
    expect: {
      legal: false,
      reason: "blocked-protected",
      playable: { "4S": false },
    },
  },
  {
    id: "R-12.3",
    rule: "R-12",
    title: "Un pas du 7 ne traverse pas un pion protégé : le plan est refusé",
    before: {
      pawns: {
        bleu: [{ p: 33 }, { p: 10 }, "S", "S"],
        rouge: [{ p: 0 }, "S", "S", "S"],
      },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: {
      t: "seven",
      card: "7S",
      plan: [
        { pawn: "bleu0", steps: 5 },
        { pawn: "bleu1", steps: 2 },
      ],
    },
    expect: {
      legal: false,
      playable: { "7S": true },
      legalInclude: [
        {
          t: "seven",
          card: "7S",
          plan: [
            { pawn: "bleu0", steps: 2 },
            { pawn: "bleu1", steps: 5 },
          ],
        },
      ],
      legalExclude: [{ t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] }],
    },
  },
  {
    id: "R-12.4",
    rule: "R-12",
    title: "Le Valet ne peut pas viser un pion protégé sur sa sortie",
    before: {
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"], jaune: [{ p: 0 }, "S", "S", "S"] },
      hands: { bleu: ["11S"] },
      turn: "bleu",
    },
    action: { t: "swap", card: "11S", pawn: "bleu0", target: "jaune0" },
    expect: {
      legal: false,
      reason: "jack-no-target",
      playable: { "11S": false },
    },
  },
  {
    id: "R-12.5",
    rule: "R-12",
    title: "On ne peut pas manger un pion protégé en s’arrêtant sur lui",
    before: {
      pawns: { bleu: [{ p: 15 }, "S", "S", "S"], jaune: [{ p: 0 }, "S", "S", "S"] },
      hands: { bleu: ["3S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "3S", pawn: "bleu0" },
    expect: {
      legal: false,
      reason: "blocked-protected",
      playable: { "3S": false },
    },
  },
  {
    id: "R-12.6",
    rule: "R-12",
    title: "Un adversaire garé sur ma sortie est mangé quand j’y sors un pion",
    before: {
      pawns: { vert: [{ p: 54 }, "S", "S", "S"] },
      hands: { rouge: ["13H"] },
      turn: "rouge",
    },
    action: { t: "exit", card: "13H", pawn: "rouge0" },
    expect: {
      legal: true,
      captured: ["vert0"],
      after: {
        pawns: { rouge: [{ p: 0 }, "S", "S", "S"], vert: ["S", "S", "S", "S"] },
      },
      events: ["cardPlayed", "pawnExited", "pawnCaptured", "pawnSentHome", "turn"],
    },
  },
  {
    id: "R-12.7",
    rule: "R-12",
    title: "Mon pion sur ma sortie m’empêche d’en sortir un second",
    before: {
      pawns: { jaune: [{ p: 0 }, "S", "S", "S"] },
      hands: { jaune: ["13S"] },
      turn: "jaune",
    },
    expect: {
      legalInclude: [{ t: "move", card: "13S", pawn: "jaune0" }],
      legalExclude: [
        { t: "exit", card: "13S", pawn: "jaune1" },
        { t: "exit", card: "13S", pawn: "jaune2" },
        { t: "exit", card: "13S", pawn: "jaune3" },
      ],
    },
    flags: ["Q15"],
  },
  {
    id: "R-12.8",
    rule: "R-12",
    title: "Sur la sortie d’une autre couleur, un pion est un pion ordinaire : on le mange",
    before: {
      pawns: { rouge: [{ p: 34 }, "S", "S", "S"], jaune: [{ p: 54 }, "S", "S", "S"] },
      hands: { rouge: ["2S"] },
      turn: "rouge",
    },
    action: { t: "move", card: "2S", pawn: "rouge0" },
    expect: {
      legal: true,
      captured: ["jaune0"],
      after: {
        pawns: { rouge: [{ p: 36 }, "S", "S", "S"], jaune: ["S", "S", "S", "S"] },
      },
    },
  },
  {
    id: "R-12.9",
    rule: "R-12",
    title:
      "Un pion revenu sur sa sortie après un tour de plus est un pion ordinaire : on le dépasse, on le mange, on l’échange",
    before: {
      pawns: { bleu: [{ p: 16 }, "S", "S", "S"], jaune: [{ p: 72 }, "S", "S", "S"] },
      hands: { bleu: ["2S", "3S", "11S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "2S", pawn: "bleu0" },
    expect: {
      legal: true,
      captured: ["jaune0"],
      legalInclude: [
        { t: "move", card: "3S", pawn: "bleu0" },
        { t: "swap", card: "11S", pawn: "bleu0", target: "jaune0" },
      ],
      after: {
        pawns: { bleu: [{ p: 18 }, "S", "S", "S"], jaune: ["S", "S", "S", "S"] },
      },
    },
    flags: ["G18"],
  },
  {
    id: "R-12.10",
    rule: "R-12",
    title: "Mon pion protégé bloque aussi le passage de mes autres pions",
    before: {
      pawns: { bleu: [{ p: 0 }, { p: 69 }, "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    expect: {
      playable: { "7S": true },
      legalInclude: [{ t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] }],
      legalExclude: [{ t: "seven", card: "7S", plan: [{ pawn: "bleu1", steps: 7 }] }],
    },
    flags: ["G4"],
  },
  {
    id: "R-12.11",
    rule: "R-12",
    title: "Un pion placé sur sa sortie par le Valet est un pion ordinaire : on le mange",
    before: {
      pawns: {
        bleu: [{ p: 18 }, "S", "S", "S"],
        jaune: [{ p: 30 }, { p: 40 }, "S", "S"],
        rouge: [{ p: 51 }, "S", "S", "S"],
      },
      hands: { bleu: ["11S"], jaune: ["2H"], rouge: ["3D"], vert: ["2C"] },
      turn: "bleu",
    },
    script: [
      { seat: "bleu", action: { t: "swap", card: "11S", pawn: "bleu0", target: "jaune0" } },
      { seat: "jaune", action: { t: "move", card: "2H", pawn: "jaune1" } },
      { seat: "rouge", action: { t: "move", card: "3D", pawn: "rouge0" } },
    ],
    expect: {
      captured: ["jaune0"],
      after: {
        pawns: {
          bleu: [{ p: 48 }, "S", "S", "S"],
          jaune: ["S", { p: 42 }, "S", "S"],
          rouge: [{ p: 54 }, "S", "S", "S"],
        },
      },
      turn: "vert",
    },
    flags: ["G18"],
  },
  {
    id: "R-12.12",
    rule: "R-12",
    title: "Un pion revenu sur sa sortie en reculant de 4 est un pion ordinaire : on le dépasse",
    before: {
      pawns: { vert: [{ p: 4 }, "S", "S", "S"], bleu: [{ p: 50 }, "S", "S", "S"] },
      hands: { vert: ["4C"], bleu: ["6S"], jaune: ["2H"], rouge: ["2D"] },
      turn: "vert",
    },
    script: [
      { seat: "vert", action: { t: "move", card: "4C", pawn: "vert0" } },
      { seat: "bleu", action: { t: "move", card: "6S", pawn: "bleu0" } },
    ],
    expect: {
      captured: [],
      after: {
        pawns: { vert: [{ p: 0 }, "S", "S", "S"], bleu: [{ p: 56 }, "S", "S", "S"] },
      },
      turn: "jaune",
    },
    flags: ["G18"],
  },
  {
    id: "R-12.13",
    rule: "R-12",
    title: "Mon pion ordinaire revenu sur ma sortie m’empêche aussi d’en sortir un second",
    before: {
      pawns: { jaune: [{ p: 72 }, "S", "S", "S"] },
      hands: { jaune: ["13S"] },
      turn: "jaune",
    },
    expect: {
      legalInclude: [{ t: "move", card: "13S", pawn: "jaune0" }],
      legalExclude: [
        { t: "exit", card: "13S", pawn: "jaune1" },
        { t: "exit", card: "13S", pawn: "jaune2" },
        { t: "exit", card: "13S", pawn: "jaune3" },
      ],
    },
    flags: ["G18", "Q15"],
  },
];

export const r13: Scenario[] = [
  {
    id: "R-13.1",
    rule: "R-13",
    title: "Au compte exact, le pion entre dans la case 0 de la maison",
    before: {
      pawns: { bleu: [{ p: 66 }, "S", "S", "S"] },
      hands: { bleu: ["5S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "5S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 0 }, "S", "S", "S"] } },
      events: ["cardPlayed", "pawnEnteredHome", "turn"],
    },
  },
  {
    id: "R-13.2",
    rule: "R-13",
    title: "Au compte exact, le pion entre dans la case 1 de la maison",
    before: {
      pawns: { bleu: [{ p: 66 }, "S", "S", "S"] },
      hands: { bleu: ["6S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "6S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 1 }, "S", "S", "S"] } },
      events: ["cardPlayed", "pawnEnteredHome", "turn"],
    },
  },
  {
    id: "R-13.3",
    rule: "R-13",
    title: "Un 7 joué en entier peut entrer dans la case 2 de la maison",
    before: {
      pawns: { bleu: [{ p: 66 }, "S", "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: { t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 2 }, "S", "S", "S"] } },
      events: ["cardPlayed", "pawnEnteredHome", "turn"],
    },
  },
  {
    id: "R-13.4",
    rule: "R-13",
    title: "Au compte exact, le pion entre dans la case 3 de la maison",
    before: {
      pawns: { bleu: [{ p: 66 }, "S", "S", "S"] },
      hands: { bleu: ["8S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "8S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 3 }, "S", "S", "S"] } },
      events: ["cardPlayed", "pawnEnteredHome", "turn"],
    },
  },
  {
    id: "R-13.5",
    rule: "R-13",
    title: "Si le compte dépasse le fond de la maison, le pion repart pour un tour",
    before: {
      pawns: { bleu: [{ p: 66 }, "S", "S", "S"] },
      hands: { bleu: ["9S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "9S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 75 }, "S", "S", "S"] } },
      events: ["cardPlayed", "pawnMoved", "turn"],
    },
  },
  {
    id: "R-13.6",
    rule: "R-13",
    title: "Si la case visée de la maison est occupée, le pion repart pour un tour",
    before: {
      pawns: { bleu: [{ p: 66 }, { h: 0 }, "S", "S"] },
      hands: { bleu: ["5S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "5S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 71 }, { h: 0 }, "S", "S"] } },
      events: ["cardPlayed", "pawnMoved", "turn"],
    },
  },
  {
    id: "R-13.7",
    rule: "R-13",
    title: "Le cheval saute un cheval déjà rentré et entre au compte exact sur une case vide",
    before: {
      pawns: { bleu: [{ p: 66 }, { h: 0 }, "S", "S"] },
      hands: { bleu: ["8S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "8S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 3 }, { h: 0 }, "S", "S"] } },
      events: ["cardPlayed", "pawnEnteredHome", "turn"],
    },
    flags: ["G17"],
  },
  {
    id: "R-13.8",
    rule: "R-13",
    title: "Quand le compte tombe juste, l’entrée est obligatoire : pas de tour de plus",
    before: {
      pawns: { bleu: [{ p: 68 }, "S", "S", "S"] },
      hands: { bleu: ["5S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "5S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 2 }, "S", "S", "S"] } },
      events: ["cardPlayed", "pawnEnteredHome", "turn"],
    },
  },
  {
    id: "R-13.9",
    rule: "R-13",
    title: "Un pion rentré avance encore dans la maison, au compte exact",
    before: {
      pawns: { bleu: [{ h: 0 }, "S", "S", "S"] },
      hands: { bleu: ["2S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "2S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 2 }, "S", "S", "S"] } },
      events: ["cardPlayed", "pawnMoved", "turn"],
    },
  },
  {
    id: "R-13.10",
    rule: "R-13",
    title:
      "Dans la maison, un cheval saute un autre cheval rentré, au compte exact sur une case vide",
    before: {
      pawns: { bleu: [{ h: 0 }, { h: 1 }, "S", "S"] },
      hands: { bleu: ["2S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "2S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 2 }, { h: 1 }, "S", "S"] } },
      events: ["cardPlayed", "pawnMoved", "turn"],
    },
    flags: ["G17"],
  },
  {
    id: "R-13.11",
    rule: "R-13",
    title: "Au fond de la maison, un pion ne peut pas aller plus loin",
    before: {
      pawns: { bleu: [{ h: 2 }, { p: 20 }, "S", "S"] },
      hands: { bleu: ["2S"] },
      turn: "bleu",
    },
    expect: {
      legalInclude: [{ t: "move", card: "2S", pawn: "bleu1" }],
      legalExclude: [{ t: "move", card: "2S", pawn: "bleu0" }],
    },
  },
  {
    id: "R-13.12",
    rule: "R-13",
    title:
      "Un pion qui a reculé de 4 entre dans sa maison au compte exact, sans avoir fait le tour",
    before: {
      pawns: { bleu: [{ p: -4 }, "S", "S", "S"] },
      hands: { bleu: ["5S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "5S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 2 }, "S", "S", "S"] } },
      events: ["cardPlayed", "pawnEnteredHome", "turn"],
    },
    flags: ["G14"],
  },
  {
    id: "R-13.13",
    rule: "R-13",
    title: "Arriver pile sur le carré 16 ne fait pas entrer dans la maison",
    before: {
      pawns: { bleu: [{ p: 67 }, "S", "S", "S"] },
      hands: { bleu: ["3S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "3S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 70 }, "S", "S", "S"] } },
      events: ["cardPlayed", "pawnMoved", "turn"],
    },
  },
  {
    id: "R-13.14",
    rule: "R-13",
    title: "Depuis le carré 16, le compte suivant fait entrer dans la maison",
    before: {
      pawns: { bleu: [{ p: 70 }, "S", "S", "S"] },
      hands: { bleu: ["2S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "2S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 1 }, "S", "S", "S"] } },
      events: ["cardPlayed", "pawnEnteredHome", "turn"],
    },
  },
  {
    id: "R-13.15",
    rule: "R-13",
    title: "Après un tour de plus, le pion entre au passage suivant",
    before: {
      pawns: { bleu: [{ p: 141 }, "S", "S", "S"] },
      hands: { bleu: ["3S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "3S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 1 }, "S", "S", "S"] } },
      events: ["cardPlayed", "pawnEnteredHome", "turn"],
    },
  },
  {
    id: "R-13.16",
    rule: "R-13",
    title: "Reculer de 4 depuis la sortie, puis entrer au compte exact",
    before: {
      pawns: {
        bleu: [{ p: 0 }, "S", "S", "S"],
        jaune: [{ p: 0 }, "S", "S", "S"],
        rouge: [{ p: 0 }, "S", "S", "S"],
        vert: [{ p: 0 }, "S", "S", "S"],
      },
      hands: { bleu: ["4S", "3S"], jaune: ["2H"], rouge: ["2D", "9D"], vert: ["2C"] },
      turn: "bleu",
    },
    script: [
      { seat: "bleu", action: { t: "move", card: "4S", pawn: "bleu0" } },
      { seat: "jaune", action: { t: "move", card: "2H", pawn: "jaune0" } },
      { seat: "rouge", action: { t: "move", card: "2D", pawn: "rouge0" } },
      { seat: "vert", action: { t: "move", card: "2C", pawn: "vert0" } },
      { seat: "bleu", action: { t: "move", card: "3S", pawn: "bleu0" } },
    ],
    expect: {
      after: {
        pawns: {
          bleu: [{ h: 0 }, "S", "S", "S"],
          jaune: [{ p: 2 }, "S", "S", "S"],
          rouge: [{ p: 2 }, "S", "S", "S"],
          vert: [{ p: 2 }, "S", "S", "S"],
        },
      },
    },
    flags: ["G14"],
  },
  {
    id: "R-13.17",
    rule: "R-13",
    title: "Un pion qui a reculé et s’arrête pile sur son carré 16 n’entre pas",
    before: {
      pawns: { bleu: [{ p: -4 }, "S", "S", "S"] },
      hands: { bleu: ["2S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "2S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: -2 }, "S", "S", "S"] } },
      events: ["cardPlayed", "pawnMoved", "turn"],
    },
    flags: ["G14"],
  },
  {
    id: "R-13.18",
    rule: "R-13",
    title: "Après un recul, un compte qui dépasse le fond de la maison fait repartir le pion",
    before: {
      pawns: { bleu: [{ p: -4 }, "S", "S", "S"] },
      hands: { bleu: ["10S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "10S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 6 }, "S", "S", "S"] } },
    },
    flags: ["G14"],
  },
  {
    id: "R-13.19",
    rule: "R-13",
    title: "Après un recul, le cheval saute un cheval déjà rentré et entre au compte exact",
    before: {
      pawns: { bleu: [{ p: -4 }, { h: 0 }, "S", "S"] },
      hands: { bleu: ["5S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "5S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 2 }, { h: 0 }, "S", "S"] } },
      events: ["cardPlayed", "pawnEnteredHome", "turn"],
    },
    flags: ["G14", "G17"],
  },
  {
    id: "R-13.20",
    rule: "R-13",
    title: "Après un recul, un pas du 7 entre dans la maison",
    before: {
      pawns: { bleu: [{ p: -4 }, { p: 20 }, "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: {
      t: "seven",
      card: "7S",
      plan: [
        { pawn: "bleu0", steps: 4 },
        { pawn: "bleu1", steps: 3 },
      ],
    },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 1 }, { p: 23 }, "S", "S"] } },
      events: ["cardPlayed", "pawnEnteredHome", "pawnMoved", "turn"],
    },
    flags: ["G14"],
  },
  {
    id: "R-13.21",
    rule: "R-13",
    title: "Placé par le Valet devant son carré 16, le pion entre au compte exact",
    before: {
      pawns: {
        bleu: [{ p: 10 }, "S", "S", "S"],
        jaune: [{ p: 51 }, "S", "S", "S"],
        rouge: [{ p: 0 }, "S", "S", "S"],
        vert: [{ p: 0 }, "S", "S", "S"],
      },
      hands: { bleu: ["11S", "3S"], jaune: ["2H"], rouge: ["2D", "9D"], vert: ["2C"] },
      turn: "bleu",
    },
    script: [
      { seat: "bleu", action: { t: "swap", card: "11S", pawn: "bleu0", target: "jaune0" } },
      { seat: "jaune", action: { t: "move", card: "2H", pawn: "jaune0" } },
      { seat: "rouge", action: { t: "move", card: "2D", pawn: "rouge0" } },
      { seat: "vert", action: { t: "move", card: "2C", pawn: "vert0" } },
      { seat: "bleu", action: { t: "move", card: "3S", pawn: "bleu0" } },
    ],
    expect: {
      after: {
        pawns: {
          bleu: [{ h: 1 }, "S", "S", "S"],
          jaune: [{ p: 66 }, "S", "S", "S"],
          rouge: [{ p: 2 }, "S", "S", "S"],
          vert: [{ p: 2 }, "S", "S", "S"],
        },
      },
    },
    flags: ["G1", "G14"],
  },
  {
    id: "R-13.22",
    rule: "R-13",
    title: "Avec une autre carte que celle qui le fait rentrer, le cheval peut dépasser sa maison",
    before: {
      pawns: { bleu: [{ p: 70 }, "S", "S", "S"] },
      hands: { bleu: ["2S", "9S"] },
      turn: "bleu",
    },
    expect: {
      legalInclude: [
        { t: "move", card: "2S", pawn: "bleu0" },
        { t: "move", card: "9S", pawn: "bleu0" },
      ],
    },
    flags: ["G16"],
  },
  {
    id: "R-13.23",
    rule: "R-13",
    title: "Le 7 qui peut faire rentrer un cheval le fait rentrer ou ne le bouge pas",
    before: {
      pawns: { bleu: [{ p: 68 }, { p: 10 }, "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    expect: {
      legalInclude: [
        {
          t: "seven",
          card: "7S",
          plan: [
            { pawn: "bleu0", steps: 3 },
            { pawn: "bleu1", steps: 4 },
          ],
        },
        { t: "seven", card: "7S", plan: [{ pawn: "bleu1", steps: 7 }] },
      ],
      legalExclude: [
        { t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] },
        {
          t: "seven",
          card: "7S",
          plan: [
            { pawn: "bleu0", steps: 2 },
            { pawn: "bleu1", steps: 5 },
          ],
        },
      ],
    },
    flags: ["G16", "seven"],
  },
  {
    id: "R-13.24",
    rule: "R-13",
    title: "Avec le 7, le cheval peut s’arrêter sur son carré 16 puis entrer au pas suivant",
    before: {
      pawns: { bleu: [{ p: 68 }, { p: 10 }, "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: {
      t: "seven",
      card: "7S",
      plan: [
        { pawn: "bleu0", steps: 2 },
        { pawn: "bleu1", steps: 1 },
        { pawn: "bleu0", steps: 4 },
      ],
    },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 3 }, { p: 11 }, "S", "S"] } },
    },
    flags: ["G16", "seven", "G5"],
  },
  {
    id: "R-13.25",
    rule: "R-13",
    title: "Le 4 peut encore reculer un cheval que le 2 ferait rentrer",
    before: {
      pawns: { bleu: [{ p: 70 }, "S", "S", "S"] },
      hands: { bleu: ["2S", "4S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "4S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 66 }, "S", "S", "S"] } },
    },
    flags: ["G16"],
  },
  {
    id: "R-13.26",
    rule: "R-13",
    title: "Seul sur le parcours, le cheval que le 7 ne peut pas faire rentrer dépasse sa maison",
    before: {
      pawns: { bleu: [{ p: 70 }, "S", "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: { t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 77 }, "S", "S", "S"] } },
    },
    flags: ["G16", "seven"],
  },
  {
    id: "R-13.27",
    rule: "R-13",
    title: "Case visée occupée : le cheval ne peut pas rentrer, il dépasse sa maison",
    before: {
      pawns: { bleu: [{ p: 70 }, { h: 1 }, "S", "S"] },
      hands: { bleu: ["2S", "5S"] },
      turn: "bleu",
    },
    expect: {
      legalInclude: [
        { t: "move", card: "2S", pawn: "bleu0" },
        { t: "move", card: "5S", pawn: "bleu0" },
      ],
    },
    flags: ["G16"],
  },
  {
    id: "R-13.28",
    rule: "R-13",
    title: "Le dernier cheval saute les trois chevaux rentrés et se range au fond",
    before: {
      pawns: { bleu: [{ p: 69 }, { h: 0 }, { h: 1 }, { h: 2 }] },
      hands: { bleu: ["5S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "5S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 3 }, { h: 0 }, { h: 1 }, { h: 2 }] } },
    },
    flags: ["G17"],
  },
  {
    id: "R-13.29",
    rule: "R-13",
    title: "Avec le 7, un cheval rentré saute celui de devant, puis un autre cheval finit le 7",
    before: {
      pawns: { bleu: [{ h: 0 }, { h: 1 }, { p: 20 }, "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: {
      t: "seven",
      card: "7S",
      plan: [
        { pawn: "bleu0", steps: 2 },
        { pawn: "bleu2", steps: 5 },
      ],
    },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 2 }, { h: 1 }, { p: 25 }, "S"] } },
      events: ["cardPlayed", "pawnMoved", "pawnMoved", "turn"],
    },
    flags: ["G17", "seven"],
  },
  {
    id: "R-13.30",
    rule: "R-13",
    title: "Sauter ne suffit pas : si la case visée est occupée, le cheval repart pour un tour",
    before: {
      pawns: { bleu: [{ p: 67 }, { h: 0 }, { h: 2 }, "S"] },
      hands: { bleu: ["6S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "6S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 73 }, { h: 0 }, { h: 2 }, "S"] } },
      events: ["cardPlayed", "pawnMoved", "turn"],
    },
    flags: ["G17"],
  },
  {
    id: "R-13.31",
    rule: "R-13",
    title: "Le 7 qui peut faire rentrer un cheval en sautant un cheval rentré le fait rentrer",
    before: {
      pawns: { bleu: [{ p: 68 }, { h: 0 }, { p: 10 }, "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    expect: {
      legalInclude: [
        {
          t: "seven",
          card: "7S",
          plan: [
            { pawn: "bleu0", steps: 4 },
            { pawn: "bleu2", steps: 3 },
          ],
        },
        { t: "seven", card: "7S", plan: [{ pawn: "bleu2", steps: 7 }] },
      ],
      legalExclude: [
        { t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] },
        {
          t: "seven",
          card: "7S",
          plan: [
            { pawn: "bleu0", steps: 3 },
            { pawn: "bleu2", steps: 4 },
          ],
        },
      ],
    },
    flags: ["G16", "G17", "seven"],
  },
];
