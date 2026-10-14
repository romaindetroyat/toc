// Scenarios R-09 (le Valet) and R-10 (le 7).
// Declarative data only (no engine call): they feed RULES.md, the engine acceptance tests
// and the debug scenario loader. Conventions are documented on the Scenario type.
// Cell arithmetic: cell = (EXIT[color] + progress) mod 72, with EXIT bleu 0, jaune 18, rouge 36, vert 54.
// Progress after a swap (G1, default): (cell - EXIT[color]) mod 72, so the lap count is lost.
// The 7 eats the opponent pawns it passes; it passes the pawns of its own team, own and partner's,
// without eating them (G15), and eats any pawn a step stops on.

import type { Scenario } from "../src/types.ts";

export const r09: Scenario[] = [
  {
    id: "R-09.1",
    rule: "R-09",
    title: "Le Valet échange un de mes pions avec celui d’un adversaire",
    before: {
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"], jaune: [{ p: 20 }, "S", "S", "S"] },
      hands: { bleu: ["11S"] },
      turn: "bleu",
    },
    action: { t: "swap", card: "11S", pawn: "bleu0", target: "jaune0" },
    expect: {
      legal: true,
      after: {
        pawns: { bleu: [{ p: 38 }, "S", "S", "S"], jaune: [{ p: 64 }, "S", "S", "S"] },
      },
      events: ["cardPlayed", "pawnsSwapped", "turn"],
    },
    flags: ["G1"],
  },
  {
    id: "R-09.2",
    rule: "R-09",
    title: "Le Valet échange aussi avec le pion du partenaire",
    before: {
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"], rouge: [{ p: 12 }, "S", "S", "S"] },
      hands: { bleu: ["11S"] },
      turn: "bleu",
    },
    action: { t: "swap", card: "11S", pawn: "bleu0", target: "rouge0" },
    expect: {
      legal: true,
      after: {
        pawns: { bleu: [{ p: 48 }, "S", "S", "S"], rouge: [{ p: 46 }, "S", "S", "S"] },
      },
      events: ["cardPlayed", "pawnsSwapped", "turn"],
    },
    flags: ["G1"],
  },
  {
    id: "R-09.3",
    rule: "R-09",
    title: "Deux pions du même joueur ne s’échangent jamais",
    before: {
      pawns: { bleu: [{ p: 10 }, { p: 20 }, "S", "S"] },
      hands: { bleu: ["11S"] },
      turn: "bleu",
    },
    action: { t: "swap", card: "11S", pawn: "bleu0", target: "bleu1" },
    expect: {
      legal: false,
      reason: "jack-no-target",
      playable: { "11S": false },
    },
  },
  {
    id: "R-09.4",
    rule: "R-09",
    title: "Un pion à l’écurie ne s’échange pas",
    before: {
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
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
    id: "R-09.5",
    rule: "R-09",
    title: "Un pion rentré dans la maison ne s’échange pas",
    before: {
      pawns: {
        bleu: [{ p: 10 }, { h: 0 }, "S", "S"],
        jaune: [{ h: 0 }, "S", "S", "S"],
        rouge: [{ p: 20 }, "S", "S", "S"],
      },
      hands: { bleu: ["11S"] },
      turn: "bleu",
    },
    expect: {
      legalInclude: [{ t: "swap", card: "11S", pawn: "bleu0", target: "rouge0" }],
      legalExclude: [
        { t: "swap", card: "11S", pawn: "bleu0", target: "jaune0" },
        { t: "swap", card: "11S", pawn: "bleu1", target: "rouge0" },
      ],
    },
  },
  {
    id: "R-09.6",
    rule: "R-09",
    title: "Mon pion protégé sur ma sortie ne peut pas être échangé",
    before: {
      pawns: { bleu: [{ p: 0 }, "S", "S", "S"], jaune: [{ p: 20 }, "S", "S", "S"] },
      hands: { bleu: ["11S"] },
      turn: "bleu",
    },
    action: { t: "swap", card: "11S", pawn: "bleu0", target: "jaune0" },
    expect: {
      legal: false,
      reason: "jack-no-target",
      playable: { "11S": false },
    },
    flags: ["G6"],
  },
  {
    id: "R-09.7",
    rule: "R-09",
    title: "Sans cible, le Valet est injouable mais le reste de la main se joue",
    before: {
      pawns: { bleu: [{ p: 10 }, "S", "S", "S"] },
      hands: { bleu: ["11S", "2S"] },
      turn: "bleu",
    },
    expect: {
      playable: { "11S": false, "2S": true },
      reason: "jack-no-target",
    },
  },
  {
    id: "R-09.8",
    rule: "R-09",
    title:
      "Après l’échange, chaque pion prend la progression de sa nouvelle case (choix par défaut)",
    before: {
      pawns: { bleu: [{ p: 80 }, "S", "S", "S"], jaune: [{ p: 20 }, "S", "S", "S"] },
      hands: { bleu: ["11S"] },
      turn: "bleu",
    },
    action: { t: "swap", card: "11S", pawn: "bleu0", target: "jaune0" },
    expect: {
      legal: true,
      after: {
        pawns: { bleu: [{ p: 38 }, "S", "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
      },
    },
    flags: ["G1"],
  },
  {
    id: "R-09.9",
    rule: "R-09",
    title: "Autre choix possible : chaque pion garde ses tours déjà faits (alternative de G1)",
    before: {
      pawns: { bleu: [{ p: 80 }, "S", "S", "S"], jaune: [{ p: 20 }, "S", "S", "S"] },
      hands: { bleu: ["11S"] },
      turn: "bleu",
    },
    action: { t: "swap", card: "11S", pawn: "bleu0", target: "jaune0" },
    expect: {
      legal: true,
      after: {
        pawns: { bleu: [{ p: 110 }, "S", "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
      },
    },
    flags: ["G1", "alt"],
  },
];

export const r10: Scenario[] = [
  {
    id: "R-10.1",
    rule: "R-10",
    title: "Les 7 pas sur un seul pion",
    before: {
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: { t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 12 }, "S", "S", "S"] } },
      events: ["cardPlayed", "pawnMoved", "turn"],
    },
  },
  {
    id: "R-10.2",
    rule: "R-10",
    title: "Le 7 réparti en 3 + 4 sur deux pions",
    before: {
      pawns: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: {
      t: "seven",
      card: "7S",
      plan: [
        { pawn: "bleu0", steps: 3 },
        { pawn: "bleu1", steps: 4 },
      ],
    },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 8 }, { p: 24 }, "S", "S"] } },
      events: ["cardPlayed", "pawnMoved", "pawnMoved", "turn"],
    },
  },
  {
    id: "R-10.3",
    rule: "R-10",
    title: "Le 7 réparti en 2 + 2 + 3 sur trois pions",
    before: {
      pawns: { bleu: [{ p: 5 }, { p: 20 }, { p: 30 }, "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: {
      t: "seven",
      card: "7S",
      plan: [
        { pawn: "bleu0", steps: 2 },
        { pawn: "bleu1", steps: 2 },
        { pawn: "bleu2", steps: 3 },
      ],
    },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 7 }, { p: 22 }, { p: 33 }, "S"] } },
      events: ["cardPlayed", "pawnMoved", "pawnMoved", "pawnMoved", "turn"],
    },
  },
  {
    id: "R-10.4",
    rule: "R-10",
    title: "Le 7 mange un adversaire qu’il dépasse en chemin",
    before: {
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: { t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] },
    expect: {
      legal: true,
      captured: ["jaune0"],
      capturedAtStep: { jaune0: 2 },
      after: {
        pawns: { bleu: [{ p: 12 }, "S", "S", "S"], jaune: ["S", "S", "S", "S"] },
      },
      events: ["cardPlayed", "pawnMoved", "pawnCaptured", "pawnSentHome", "turn"],
    },
  },
  {
    id: "R-10.5",
    rule: "R-10",
    title: "Le 7 mange un adversaire sur sa case d’arrivée",
    before: {
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"], jaune: [{ p: 66 }, "S", "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: { t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] },
    expect: {
      legal: true,
      captured: ["jaune0"],
      capturedAtStep: { jaune0: 6 },
      after: {
        pawns: { bleu: [{ p: 12 }, "S", "S", "S"], jaune: ["S", "S", "S", "S"] },
      },
      events: ["cardPlayed", "pawnMoved", "pawnCaptured", "pawnSentHome", "turn"],
    },
  },
  {
    id: "R-10.6",
    rule: "R-10",
    title: "Le 7 dépasse le pion du partenaire sans le manger",
    before: {
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"], rouge: [{ p: 45 }, "S", "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: { t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] },
    expect: {
      legal: true,
      captured: [],
      after: {
        pawns: { bleu: [{ p: 12 }, "S", "S", "S"], rouge: [{ p: 45 }, "S", "S", "S"] },
      },
      events: ["cardPlayed", "pawnMoved", "turn"],
    },
    flags: ["G15"],
  },
  {
    id: "R-10.7",
    rule: "R-10",
    title: "Un seul 7 peut manger plusieurs pions, chacun à son passage",
    before: {
      pawns: {
        bleu: [{ p: 5 }, "S", "S", "S"],
        jaune: [{ p: 62 }, "S", "S", "S"],
        vert: [{ p: 29 }, "S", "S", "S"],
      },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: { t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] },
    expect: {
      legal: true,
      captured: ["jaune0", "vert0"],
      capturedAtStep: { jaune0: 2, vert0: 5 },
      after: {
        pawns: {
          bleu: [{ p: 12 }, "S", "S", "S"],
          jaune: ["S", "S", "S", "S"],
          vert: ["S", "S", "S", "S"],
        },
      },
      events: [
        "cardPlayed",
        "pawnMoved",
        "pawnCaptured",
        "pawnSentHome",
        "pawnCaptured",
        "pawnSentHome",
        "turn",
      ],
    },
  },
  {
    id: "R-10.8",
    rule: "R-10",
    title: "Le 7 dépasse ses propres pions sans les manger",
    before: {
      pawns: { bleu: [{ p: 5 }, { p: 8 }, "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: { t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] },
    expect: {
      legal: true,
      captured: [],
      after: { pawns: { bleu: [{ p: 12 }, { p: 8 }, "S", "S"] } },
    },
  },
  {
    id: "R-10.9",
    rule: "R-10",
    title: "Le 7 ne peut pas finir sur un de ses propres pions",
    before: {
      pawns: { bleu: [{ p: 5 }, { p: 12 }, "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: { t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] },
    expect: {
      legal: false,
      legalInclude: [
        {
          t: "seven",
          card: "7S",
          plan: [
            { pawn: "bleu0", steps: 3 },
            { pawn: "bleu1", steps: 4 },
          ],
        },
      ],
      legalExclude: [{ t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] }],
    },
  },
  {
    id: "R-10.10",
    rule: "R-10",
    title: "Un 7 qu’on ne peut pas jouer en entier est injouable, même en partie possible",
    before: {
      pawns: { bleu: [{ h: 0 }, { h: 2 }, { h: 3 }, "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    expect: {
      playable: { "7S": false },
      reason: "seven-incomplete",
    },
    flags: ["Q19"],
  },
  {
    id: "R-10.11",
    rule: "R-10",
    title: "L’ordre compte : déplacer d’abord le pion de devant libère la place",
    before: {
      pawns: { bleu: [{ p: 5 }, { p: 8 }, "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: {
      t: "seven",
      card: "7S",
      plan: [
        { pawn: "bleu1", steps: 4 },
        { pawn: "bleu0", steps: 3 },
      ],
    },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 8 }, { p: 12 }, "S", "S"] } },
      legalExclude: [
        {
          t: "seven",
          card: "7S",
          plan: [
            { pawn: "bleu0", steps: 3 },
            { pawn: "bleu1", steps: 4 },
          ],
        },
      ],
    },
  },
  {
    id: "R-10.12",
    rule: "R-10",
    title: "Un plan invalide est refusé en entier : rien ne bouge",
    before: {
      pawns: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: {
      t: "seven",
      card: "7S",
      plan: [
        { pawn: "bleu0", steps: 3 },
        { pawn: "bleu1", steps: 3 },
      ],
    },
    expect: {
      legal: false,
      after: { pawns: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"] } },
      events: [],
    },
  },
  {
    id: "R-10.13",
    rule: "R-10",
    title: "Le même pion peut revenir plus tard dans le plan du 7",
    before: {
      pawns: { bleu: [{ p: 5 }, { p: 10 }, "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: {
      t: "seven",
      card: "7S",
      plan: [
        { pawn: "bleu0", steps: 2 },
        { pawn: "bleu1", steps: 3 },
        { pawn: "bleu0", steps: 2 },
      ],
    },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ p: 9 }, { p: 13 }, "S", "S"] } },
      events: ["cardPlayed", "pawnMoved", "pawnMoved", "pawnMoved", "turn"],
    },
    flags: ["G5"],
  },
  {
    id: "R-10.14",
    rule: "R-10",
    title: "Le 7 qui s’arrête sur le pion du partenaire le mange",
    before: {
      pawns: { bleu: [{ p: 5 }, "S", "S", "S"], rouge: [{ p: 48 }, "S", "S", "S"] },
      hands: { bleu: ["7S"] },
      turn: "bleu",
    },
    action: { t: "seven", card: "7S", plan: [{ pawn: "bleu0", steps: 7 }] },
    expect: {
      legal: true,
      captured: ["rouge0"],
      capturedAtStep: { rouge0: 6 },
      after: {
        pawns: { bleu: [{ p: 12 }, "S", "S", "S"], rouge: ["S", "S", "S", "S"] },
      },
      events: ["cardPlayed", "pawnMoved", "pawnCaptured", "pawnSentHome", "turn"],
    },
    flags: ["G15"],
  },
];
