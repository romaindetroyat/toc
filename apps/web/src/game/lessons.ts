// The eight lessons of « Apprendre à jouer » (APP-04, D-07; 05-UI-SPEC « The eight lessons »).
//
// A lesson is a position for the real engine, Bleu's hand, the gives of the others (lesson 8 only) and
// the guide's steps. Positions are written in RULES.md cell numbers (Bleu's losange is cell 0, its carré
// cell 70) and converted to each colour's progress with the engine's EXIT, so they read like the rules.
// Nothing here decides what is legal: the engine and the turn reducer do (lessonRunner.ts only checks
// that the player does what the step asks). Pure data, no storage, no network, no Svelte.
//
// The others hold no card in lessons 1 to 7: after Bleu's move the turn comes straight back to him (the
// only seat with cards), no computer plays and no new deal starts, as long as Bleu keeps a card after
// the lesson's move (05-RESEARCH Pattern 5, Pitfall 3). Every hand has a card left over for that.

import {
  type Action,
  type CardId,
  type Color,
  EXIT,
  type PawnId,
  type PawnSpec,
  RING,
  type Scenario,
} from "@toc/engine";
import { lecons } from "../i18n/fr/lecons.ts";

/** What a step waits for. */
export type LessonExpect =
  /** A narration line: the player presses « Suivant ». */
  | { t: "next" }
  /** A card to touch (or to choose to give, in the exchange). */
  | { t: "card"; card: CardId }
  /** A knight to touch (the Valet's own knight, then the one to swap with). */
  | { t: "pawn"; pawn: PawnId }
  /**
   * Part of the 7's split: the halo suggests `pawn` then the chip `steps`, but any knight and any chip
   * pass; the step is over once the steps spread reach this step's share and the ones before it.
   */
  | { t: "steps"; pawn: PawnId; steps: number }
  /** « Jouer » or « Passer cette carte ». */
  | { t: "button"; button: "confirm" | "give" }
  /** The whole 7 judged on « Jouer » by its effect: every knight of `eats` must be eaten. */
  | { t: "plan"; eats: PawnId[] }
  /** A narration line shown once the exchanged cards have crossed. */
  | { t: "cross" };

export type LessonStep = {
  expect: LessonExpect;
  /** The guide's line (at most 110 characters). */
  line: string;
  /** The line for any other card or knight the game would take. Default: `line`. */
  wrong?: string;
  /** The line for one particular card or knight, before `wrong`. */
  wrongs?: Partial<Record<CardId | PawnId, string>>;
};

export type Lesson = {
  /** 1 to 8, the lesson's number in the list and in `#/apprendre/<n>`. */
  n: number;
  title: string;
  /** The position, for createGame({ scenario }). */
  before: Scenario["before"];
  /** The others' gives (lesson 8), for createGame({ script }). */
  script?: Partial<Record<Color, Action[]>>;
  steps: LessonStep[];
  /** The « Bravo » plank's recap (at most 160 characters). */
  recap: string;
};

/** A RULES.md cell (0 to 71, from Bleu's losange) as the progress of a knight of `color`. */
export function progressOf(color: Color, cell: number): number {
  return (((cell - EXIT[color]) % RING) + RING) % RING;
}

/** A colour's four knights: on the given cells first, the others in the stable. */
function knights(color: Color, ...cells: number[]): [PawnSpec, PawnSpec, PawnSpec, PawnSpec] {
  const specs: PawnSpec[] = cells.map((cell) => ({ p: progressOf(color, cell) }));
  while (specs.length < 4) specs.push("S");
  return specs as [PawnSpec, PawnSpec, PawnSpec, PawnSpec];
}

const next = (line: string): LessonStep => ({ expect: { t: "next" }, line });
const confirm = (line: string): LessonStep => ({
  expect: { t: "button", button: "confirm" },
  line,
});

const { sortir, avancer, manger, recule, valet, sept, maison, echange } = lecons;

export const LESSONS: readonly Lesson[] = [
  {
    n: 1,
    title: sortir.title,
    // Every knight in its stable but Jaune 30 and Vert 50, so the board looks alive. Hand: As, 8, 3.
    before: {
      pawns: { jaune: knights("jaune", 30), vert: knights("vert", 50) },
      hands: { bleu: ["1H", "8S", "3D"] },
      turn: "bleu",
    },
    steps: [
      next(sortir.bienvenue),
      next(sortir.but),
      { expect: { t: "card", card: "1H" }, line: sortir.carte, wrong: sortir.wrong.carte },
      // The As has a single move: its preview opens by itself (recette 3, test 27).
      confirm(sortir.jouer),
    ],
    recap: sortir.recap,
  },
  {
    n: 2,
    title: avancer.title,
    // Bleu 2 and 10. Hand: 8, Dame, 5. Only the knight on 10 can play the 8.
    before: {
      pawns: { bleu: knights("bleu", 2, 10) },
      hands: { bleu: ["8C", "12H", "5S"] },
      turn: "bleu",
    },
    steps: [
      next(avancer.intro),
      { expect: { t: "card", card: "8C" }, line: avancer.carte, wrong: avancer.wrong.carte },
      confirm(avancer.jouer),
    ],
    recap: avancer.recap,
  },
  {
    n: 3,
    title: manger.title,
    // Bleu 12, Jaune 20. Hand: 8, 3, 10.
    before: {
      pawns: { bleu: knights("bleu", 12), jaune: knights("jaune", 20) },
      hands: { bleu: ["8D", "3S", "10C"] },
      turn: "bleu",
    },
    steps: [
      { expect: { t: "card", card: "8D" }, line: manger.carte, wrong: manger.wrong.carte },
      confirm(manger.jouer),
    ],
    recap: manger.recap,
  },
  {
    n: 4,
    title: recule.title,
    // Bleu 0, just out of its stable; Vert 68. Hand: 4, 9.
    before: {
      pawns: { bleu: knights("bleu", 0), vert: knights("vert", 68) },
      hands: { bleu: ["4H", "9S"] },
      turn: "bleu",
    },
    steps: [
      { expect: { t: "card", card: "4H" }, line: recule.carte, wrong: recule.wrong.carte },
      confirm(recule.jouer),
    ],
    recap: recule.recap,
  },
  {
    n: 5,
    title: valet.title,
    // Bleu 5; Jaune 66 (jaune0, near Bleu's home) and 40 (jaune1). Hand: Valet, 6.
    before: {
      pawns: { bleu: knights("bleu", 5), jaune: knights("jaune", 66, 40) },
      hands: { bleu: ["11S", "6D"] },
      turn: "bleu",
    },
    steps: [
      { expect: { t: "card", card: "11S" }, line: valet.carte, wrong: valet.wrong.carte },
      { expect: { t: "pawn", pawn: "bleu0" }, line: valet.cheval },
      {
        expect: { t: "pawn", pawn: "jaune0" },
        line: valet.cible,
        wrongs: { jaune1: valet.wrong.cible },
      },
      { ...confirm(valet.jouer), wrongs: { jaune1: valet.wrong.cible } },
    ],
    recap: valet.recap,
  },
  {
    n: 6,
    title: sept.title,
    // Bleu 20 (bleu0) and 40 (bleu1), Jaune 22, Vert 43. Hand: 7, and a 2 that the lesson never asks
    // for: with the 7 alone the four hands would be empty after it and a new deal would start.
    before: {
      pawns: {
        bleu: knights("bleu", 20, 40),
        jaune: knights("jaune", 22),
        vert: knights("vert", 43),
      },
      hands: { bleu: ["7C", "2H"] },
      turn: "bleu",
    },
    steps: [
      next(sept.intro),
      { expect: { t: "card", card: "7C" }, line: sept.carte },
      { expect: { t: "steps", pawn: "bleu0", steps: 3 }, line: sept.premier },
      { expect: { t: "steps", pawn: "bleu1", steps: 4 }, line: sept.second },
      {
        expect: { t: "plan", eats: ["jaune0", "vert0"] },
        line: sept.jouer,
        wrong: sept.wrong.plan,
      },
    ],
    recap: sept.recap,
  },
  {
    n: 7,
    title: maison.title,
    // Bleu 68, the three others in the stable. Hand: 6, 9, Roi.
    before: {
      pawns: { bleu: knights("bleu", 68) },
      hands: { bleu: ["6S", "9H", "13C"] },
      turn: "bleu",
    },
    steps: [
      next(maison.intro),
      {
        expect: { t: "card", card: "6S" },
        line: maison.carte,
        wrongs: { "9H": maison.wrong.neuf, "13C": maison.wrong.roi },
      },
      confirm(maison.jouer),
    ],
    recap: maison.recap,
  },
  {
    n: 8,
    title: echange.title,
    // The start of a deal, in the exchange, dealt by Vert so that Bleu plays first after the cross.
    // Rouge's four knights in its stable; Bleu 10, Jaune 30, Vert 50. Hand: Roi, 9, 5, 10, 2. The three
    // others give known cards, Rouge a 7.
    before: {
      pawns: { bleu: knights("bleu", 10), jaune: knights("jaune", 30), vert: knights("vert", 50) },
      hands: {
        bleu: ["13S", "9C", "5H", "10D", "2S"],
        jaune: ["3C", "4C", "6C", "8C", "12C"],
        rouge: ["7H", "4H", "6H", "8H", "12H"],
        vert: ["2D", "4D", "6D", "8D", "12D"],
      },
      turn: "bleu",
      phase: "exchange",
      dealer: "vert",
    },
    script: {
      jaune: [{ t: "give", card: "3C" }],
      rouge: [{ t: "give", card: "7H" }],
      vert: [{ t: "give", card: "2D" }],
    },
    steps: [
      next(echange.intro),
      { expect: { t: "card", card: "13S" }, line: echange.carte, wrong: echange.wrong.carte },
      { expect: { t: "button", button: "give" }, line: echange.passer },
      { expect: { t: "cross" }, line: echange.recu },
    ],
    recap: echange.recap,
  },
];
