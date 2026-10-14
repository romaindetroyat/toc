// Scenarios R-11 (prise), R-12 (case de sortie protégée) and R-13 (entrée dans la maison).
// Declarative data only (no engine call): they feed RULES.md, the engine acceptance tests
// and the debug scenario loader. Conventions are documented on the Scenario type.
// Cell arithmetic: cell = (EXIT[color] + progress) mod 72, with EXIT bleu 0, jaune 18, rouge 36, vert 54.
// Home entry (D-01 to D-03, G14): the entry square is the cell EXIT - 2 (the carré 16), reached at
// progress 70 on the first lap or at -2 after a backward 4 (G14: the full lap is not required); `r`
// steps beyond it (1 to 4) land in home slot r - 1, if that slot and every slot before it are empty.

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
    title: "Un pion revenu sur sa sortie après un tour de plus est protégé aussi",
    before: {
      pawns: { bleu: [{ p: 72 }, "S", "S", "S"], rouge: [{ p: 34 }, "S", "S", "S"] },
      hands: { rouge: ["3S"] },
      turn: "rouge",
    },
    action: { t: "move", card: "3S", pawn: "rouge0" },
    expect: {
      legal: false,
      reason: "blocked-protected",
      playable: { "3S": false },
    },
    flags: ["G3"],
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
    title: "Un pion déjà rentré ne se saute pas : le pion repart pour un tour",
    before: {
      pawns: { bleu: [{ p: 66 }, { h: 0 }, "S", "S"] },
      hands: { bleu: ["8S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "8S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 74 }, { h: 0 }, "S", "S"] } },
      events: ["cardPlayed", "pawnMoved", "turn"],
    },
    flags: ["G2"],
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
    title: "Dans la maison, un pion ne saute pas un autre pion rentré",
    before: {
      pawns: { bleu: [{ h: 0 }, { h: 1 }, "S", "S"] },
      hands: { bleu: ["2S"] },
      turn: "bleu",
    },
    expect: {
      legalInclude: [{ t: "move", card: "2S", pawn: "bleu1" }],
      legalExclude: [{ t: "move", card: "2S", pawn: "bleu0" }],
    },
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
];
