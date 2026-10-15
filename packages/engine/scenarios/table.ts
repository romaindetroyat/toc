// Scenarios R-01 to R-05: teams, board and progression, deals, exchange, turn order.
// Declarative data only (no engine call): they feed RULES.md, the engine acceptance tests
// and the debug scenario loader. Conventions are documented on the Scenario type.

import type { CardId, Scenario } from "../src/types.ts";

/** Four 5-card hands without duplicates, used by the exchange cases (dealer vert: bleu starts). */
const mainsBase: Record<"bleu" | "jaune" | "rouge" | "vert", CardId[]> = {
  bleu: ["2S", "5H", "9D", "13C", "3H"],
  jaune: ["4S", "6H", "10D", "12C", "8H"],
  rouge: ["7S", "8S", "3D", "11C", "2H"],
  vert: ["10S", "9H", "6D", "5C", "4H"],
};

export const r01: Scenario[] = [
  {
    id: "R-01.1",
    rule: "R-01",
    title: "Bleu et rouge sont partenaires, jaune et vert aussi",
    before: { hands: mainsBase, turn: "bleu", phase: "exchange", dealer: "vert", dealIndex: 0 },
    script: [
      { seat: "bleu", action: { t: "give", card: "13C" } },
      { seat: "jaune", action: { t: "give", card: "4S" } },
      { seat: "rouge", action: { t: "give", card: "3D" } },
      { seat: "vert", action: { t: "give", card: "9H" } },
    ],
    expect: {
      phase: "play",
      turn: "bleu",
      received: { bleu: "3D", rouge: "13C", jaune: "9H", vert: "4S" },
    },
  },
  {
    id: "R-01.2",
    rule: "R-01",
    title: "Les partenaires restent face à face quel que soit le donneur",
    before: { hands: mainsBase, turn: "vert", phase: "exchange", dealer: "rouge", dealIndex: 0 },
    script: [
      { seat: "bleu", action: { t: "give", card: "2S" } },
      { seat: "jaune", action: { t: "give", card: "6H" } },
      { seat: "rouge", action: { t: "give", card: "7S" } },
      { seat: "vert", action: { t: "give", card: "5C" } },
    ],
    expect: {
      phase: "play",
      turn: "vert",
      received: { bleu: "7S", rouge: "2S", jaune: "5C", vert: "6H" },
    },
  },
];

export const r02: Scenario[] = [
  {
    id: "R-02.1",
    rule: "R-02",
    title: "La progression compte les cases parcourues depuis la sortie",
    before: {
      pawns: { bleu: [{ p: 0 }, "S", "S", "S"] },
      hands: { bleu: ["3S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "3S", pawn: "bleu0" },
    expect: { legal: true, after: { pawns: { bleu: [{ p: 3 }, "S", "S", "S"] } } },
  },
  {
    id: "R-02.2",
    rule: "R-02",
    title: "Reculer de 4 depuis la sortie donne une progression de −4",
    before: {
      pawns: { bleu: [{ p: 0 }, "S", "S", "S"] },
      hands: { bleu: ["4S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "4S", pawn: "bleu0" },
    expect: { legal: true, after: { pawns: { bleu: [{ p: -4 }, "S", "S", "S"] } } },
  },
  {
    id: "R-02.3",
    rule: "R-02",
    title: "Un pion à −2 est sur sa case d’entrée : au compte exact, il entre dans sa maison",
    before: {
      pawns: { bleu: [{ p: -2 }, "S", "S", "S"] },
      hands: { bleu: ["3S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "3S", pawn: "bleu0" },
    expect: {
      legal: true,
      after: { pawns: { bleu: [{ h: 2 }, "S", "S", "S"] } },
      events: ["cardPlayed", "pawnEnteredHome", "turn"],
    },
    flags: ["G14"],
  },
  {
    id: "R-02.4",
    rule: "R-02",
    title: "Un pion bleu peut s’arrêter sur la case de sortie du jaune",
    before: {
      pawns: { bleu: [{ p: 17 }, "S", "S", "S"] },
      hands: { bleu: ["1S"] },
      turn: "bleu",
    },
    action: { t: "move", card: "1S", pawn: "bleu0" },
    expect: { legal: true, after: { pawns: { bleu: [{ p: 18 }, "S", "S", "S"] } } },
  },
];

export const r03: Scenario[] = [
  {
    id: "R-03.1",
    rule: "R-03",
    title: "La première donne est de 5 cartes, le joueur après le donneur commence",
    before: { turn: "bleu", phase: "exchange", dealer: "vert", dealIndex: 0 },
    script: [],
    expect: {
      deal: { sizes: [5, 5, 5, 5], dealer: "vert", first: "bleu" },
      events: ["dealt", "handDealt", "handDealt", "handDealt", "handDealt"],
    },
    flags: ["G9"],
  },
  {
    id: "R-03.2",
    rule: "R-03",
    title: "La deuxième donne est de 4 cartes, avec le même donneur",
    before: {
      hands: { bleu: [], jaune: [], rouge: [], vert: [] },
      turn: "bleu",
      dealer: "vert",
      dealIndex: 0,
    },
    script: [],
    expect: { deal: { sizes: [4, 4, 4, 4], dealer: "vert", first: "bleu" } },
    flags: ["G9"],
  },
  {
    id: "R-03.3",
    rule: "R-03",
    title: "La troisième donne est de 4 cartes, avec le même donneur",
    before: {
      hands: { bleu: [], jaune: [], rouge: [], vert: [] },
      turn: "bleu",
      dealer: "vert",
      dealIndex: 1,
    },
    script: [],
    expect: { deal: { sizes: [4, 4, 4, 4], dealer: "vert", first: "bleu" } },
    flags: ["G9"],
  },
  {
    id: "R-03.4",
    rule: "R-03",
    title: "Après la troisième donne on rebat et le donneur passe au suivant",
    before: {
      hands: { bleu: [], jaune: [], rouge: [], vert: [] },
      turn: "bleu",
      dealer: "vert",
      dealIndex: 2,
    },
    script: [],
    expect: {
      deal: { sizes: [5, 5, 5, 5], dealer: "bleu", first: "jaune" },
      events: ["reshuffled", "dealt", "handDealt", "handDealt", "handDealt", "handDealt"],
    },
    flags: ["G9"],
  },
  {
    id: "R-03.5",
    rule: "R-03",
    title: "Les 52 cartes restent toutes présentes après la donne et l’échange",
    before: { hands: mainsBase, turn: "bleu", phase: "exchange", dealer: "vert", dealIndex: 0 },
    script: [
      { seat: "bleu", action: { t: "give", card: "2S" } },
      { seat: "jaune", action: { t: "give", card: "4S" } },
      { seat: "rouge", action: { t: "give", card: "7S" } },
      { seat: "vert", action: { t: "give", card: "10S" } },
    ],
    expect: { conserved: true, handSizes: { bleu: 5, jaune: 5, rouge: 5, vert: 5 } },
  },
];

export const r04: Scenario[] = [
  {
    id: "R-04.1",
    rule: "R-04",
    title: "Trois choix ne suffisent pas : rien ne bouge avant le quatrième",
    before: { hands: mainsBase, turn: "bleu", phase: "exchange", dealer: "vert", dealIndex: 0 },
    script: [
      { seat: "bleu", action: { t: "give", card: "13C" } },
      { seat: "jaune", action: { t: "give", card: "4S" } },
      { seat: "rouge", action: { t: "give", card: "3D" } },
    ],
    expect: { phase: "exchange", events: [] },
    flags: ["G8"],
  },
  {
    id: "R-04.2",
    rule: "R-04",
    title: "Au quatrième choix les quatre cartes changent de main ensemble",
    before: { hands: mainsBase, turn: "bleu", phase: "exchange", dealer: "vert", dealIndex: 0 },
    script: [
      { seat: "bleu", action: { t: "give", card: "13C" } },
      { seat: "jaune", action: { t: "give", card: "4S" } },
      { seat: "rouge", action: { t: "give", card: "3D" } },
      { seat: "vert", action: { t: "give", card: "9H" } },
    ],
    expect: {
      phase: "play",
      turn: "bleu",
      events: ["cardsExchanged", "turn"],
      received: { bleu: "3D", rouge: "13C", jaune: "9H", vert: "4S" },
    },
    flags: ["G8"],
  },
  {
    id: "R-04.3",
    rule: "R-04",
    title: "Une main qui semble injouable échange quand même",
    before: {
      hands: {
        bleu: ["2S", "3S", "4S", "5S", "6S"],
        jaune: ["2H", "3H", "4H", "5H", "6H"],
        rouge: ["1S", "13S", "2D", "3D", "4D"],
        vert: ["7H", "8H", "9H", "10H", "2C"],
      },
      turn: "bleu",
      phase: "exchange",
      dealer: "vert",
      dealIndex: 0,
    },
    script: [
      { seat: "bleu", action: { t: "give", card: "2S" } },
      { seat: "jaune", action: { t: "give", card: "2H" } },
      { seat: "rouge", action: { t: "give", card: "1S" } },
      { seat: "vert", action: { t: "give", card: "7H" } },
    ],
    expect: {
      phase: "play",
      received: { bleu: "1S", rouge: "2S", jaune: "7H", vert: "2H" },
      playable: { "1S": true, "3S": false },
    },
    flags: ["Q6"],
  },
  {
    id: "R-04.4",
    rule: "R-04",
    title: "La carte reçue ne compte pas dans la taille de la donne",
    before: { hands: mainsBase, turn: "bleu", phase: "exchange", dealer: "vert", dealIndex: 0 },
    script: [
      { seat: "bleu", action: { t: "give", card: "9D" } },
      { seat: "jaune", action: { t: "give", card: "6H" } },
      { seat: "rouge", action: { t: "give", card: "8S" } },
      { seat: "vert", action: { t: "give", card: "6D" } },
    ],
    expect: { handSizes: { bleu: 5, jaune: 5, rouge: 5, vert: 5 } },
    flags: ["Q7"],
  },
  {
    id: "R-04.5",
    rule: "R-04",
    title: "On ne peut donner qu’une carte de sa main",
    before: { hands: mainsBase, turn: "bleu", phase: "exchange", dealer: "vert", dealIndex: 0 },
    seat: "bleu",
    action: { t: "give", card: "1S" },
    expect: { legal: false },
  },
];

export const r05: Scenario[] = [
  {
    id: "R-05.1",
    rule: "R-05",
    title: "Le tour passe dans le sens horaire : bleu, jaune, rouge, vert",
    before: {
      pawns: {
        bleu: [{ p: 0 }, "S", "S", "S"],
        jaune: [{ p: 0 }, "S", "S", "S"],
        rouge: [{ p: 0 }, "S", "S", "S"],
        vert: [{ p: 0 }, "S", "S", "S"],
      },
      hands: {
        bleu: ["2S", "9S"],
        jaune: ["2H", "9H"],
        rouge: ["2D", "9D"],
        vert: ["2C", "9C"],
      },
      turn: "bleu",
    },
    script: [
      { seat: "bleu", action: { t: "move", card: "2S", pawn: "bleu0" } },
      { seat: "jaune", action: { t: "move", card: "2H", pawn: "jaune0" } },
      { seat: "rouge", action: { t: "move", card: "2D", pawn: "rouge0" } },
      { seat: "vert", action: { t: "move", card: "2C", pawn: "vert0" } },
    ],
    expect: {
      turn: "bleu",
      after: {
        pawns: {
          bleu: [{ p: 2 }, "S", "S", "S"],
          jaune: [{ p: 2 }, "S", "S", "S"],
          rouge: [{ p: 2 }, "S", "S", "S"],
          vert: [{ p: 2 }, "S", "S", "S"],
        },
      },
    },
  },
  {
    id: "R-05.2",
    rule: "R-05",
    title: "Quand une carte est jouable, poser sa main est interdit",
    before: {
      pawns: { bleu: [{ p: 0 }, "S", "S", "S"] },
      hands: { bleu: ["3S"] },
      turn: "bleu",
    },
    action: { t: "discard" },
    expect: {
      legal: false,
      legalInclude: [{ t: "move", card: "3S", pawn: "bleu0" }],
      legalExclude: [{ t: "discard" }],
    },
    flags: ["Q20"],
  },
  {
    id: "R-05.3",
    rule: "R-05",
    title: "Un joueur sans carte est sauté",
    before: {
      pawns: { vert: [{ p: 0 }, "S", "S", "S"] },
      hands: { bleu: [], jaune: ["3H"], rouge: ["4D"], vert: ["2C", "5C"] },
      turn: "vert",
    },
    action: { t: "move", card: "2C", pawn: "vert0" },
    expect: {
      legal: true,
      turn: "jaune",
      after: { pawns: { vert: [{ p: 2 }, "S", "S", "S"] } },
    },
  },
];
