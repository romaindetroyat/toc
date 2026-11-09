// The fifteen rule figures of « Règles du TOC » (plan 05-04, D-15, 05-UI-SPEC « Figures »): the
// positions of RULES.md's scenarios, copied here in their own PawnSpec form so that the release code
// never imports the scenario set (@toc/engine/scenarios is for the tests and the debug builds:
// 05-RESEARCH Pattern 6). ruleFigures.test.ts checks every one against the scenario of the same id.
// Each figure is drawn live on the galet from Bleu's seat: the position before the move above, the
// position after it below, or, for the five scenarios without an after, the same position with the
// knights the move concerns ringed (« Le coup »), as the docs figures do (tools/render-scenarios.mjs).

import {
  ALL_PAWNS,
  type Color,
  type PawnId,
  type PawnSpec,
  type Place,
  placeOf,
  scenarioState,
} from "@toc/engine";
import type { FigureId, RulesTabId } from "../i18n/fr/regles.ts";

/** A figure's knights by colour, as a scenario writes them; a missing colour is in its stable. */
export type FigurePosition = Partial<Record<Color, [PawnSpec, PawnSpec, PawnSpec, PawnSpec]>>;

export type RuleFigureSpec = {
  id: FigureId;
  tab: RulesTabId;
  before: FigurePosition;
  /** The position after the move; absent for the five figures that show « Le coup ». */
  after?: FigurePosition;
  /** « Le coup »: the knights the move concerns, ringed in the lower half. */
  concerned?: readonly PawnId[];
};

/** Every figure, in the order of the tabs (« Les cartes »: after its cards list). */
export const RULE_FIGURES: readonly RuleFigureSpec[] = [
  // Le but
  { id: "R-01.1", tab: "but", before: {}, concerned: [] },
  // Les cartes
  {
    id: "R-07.1",
    tab: "cartes",
    before: { bleu: [{ p: 3 }, "S", "S", "S"] },
    after: { bleu: [{ p: 15 }, "S", "S", "S"] },
  },
  {
    id: "R-08.1",
    tab: "cartes",
    before: { jaune: [{ p: 0 }, "S", "S", "S"] },
    after: { jaune: [{ p: -4 }, "S", "S", "S"] },
  },
  // Une donne
  { id: "R-04.2", tab: "donne", before: {}, concerned: [] },
  { id: "R-14.2", tab: "donne", before: {}, concerned: [] },
  // Sortir un cheval
  {
    id: "R-06.1",
    tab: "sortir",
    before: { bleu: ["S", { p: 5 }, "S", "S"] },
    concerned: ["bleu0", "bleu1"],
  },
  {
    id: "R-12.1",
    tab: "sortir",
    before: { bleu: [{ p: 30 }, "S", "S", "S"], rouge: [{ p: 0 }, "S", "S", "S"] },
    concerned: ["bleu0"],
  },
  // Le 7
  {
    id: "R-10.2",
    tab: "sept",
    before: { bleu: [{ p: 5 }, { p: 20 }, "S", "S"] },
    after: { bleu: [{ p: 8 }, { p: 24 }, "S", "S"] },
  },
  {
    id: "R-10.4",
    tab: "sept",
    before: { bleu: [{ p: 5 }, "S", "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
    after: { bleu: [{ p: 12 }, "S", "S", "S"], jaune: ["S", "S", "S", "S"] },
  },
  // Le Valet
  {
    id: "R-09.1",
    tab: "valet",
    before: { bleu: [{ p: 10 }, "S", "S", "S"], jaune: [{ p: 20 }, "S", "S", "S"] },
    after: { bleu: [{ p: 38 }, "S", "S", "S"], jaune: [{ p: 64 }, "S", "S", "S"] },
  },
  // Manger
  {
    id: "R-11.1",
    tab: "manger",
    before: { bleu: [{ p: 5 }, "S", "S", "S"], jaune: [{ p: 62 }, "S", "S", "S"] },
    after: { bleu: [{ p: 8 }, "S", "S", "S"], jaune: ["S", "S", "S", "S"] },
  },
  // Rentrer à la maison
  {
    id: "R-13.1",
    tab: "maison",
    before: { bleu: [{ p: 66 }, "S", "S", "S"] },
    after: { bleu: [{ h: 0 }, "S", "S", "S"] },
  },
  {
    id: "R-13.5",
    tab: "maison",
    before: { bleu: [{ p: 66 }, "S", "S", "S"] },
    after: { bleu: [{ p: 75 }, "S", "S", "S"] },
  },
  // Quand tu as fini
  {
    id: "R-15.1",
    tab: "fini",
    before: {
      bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
      rouge: [{ p: 10 }, { p: 20 }, "S", "S"],
    },
    after: {
      bleu: [{ h: 0 }, { h: 1 }, { h: 2 }, { h: 3 }],
      rouge: [{ p: 12 }, { p: 20 }, "S", "S"],
    },
  },
  // Règles de la maison
  {
    id: "R-13.12",
    tab: "regles-maison",
    before: { bleu: [{ p: -4 }, "S", "S", "S"] },
    after: { bleu: [{ h: 2 }, "S", "S", "S"] },
  },
];

/** The figures of one tab, in order. */
export function figuresOf(tab: RulesTabId): RuleFigureSpec[] {
  return RULE_FIGURES.filter((figure) => figure.tab === tab);
}

/** Any seed: the talon of the position is never drawn. */
const SEED: [number, number, number, number] = [1, 2, 3, 4];

/**
 * Where each of the sixteen knights stands, as board places: the position is turned into engine
 * pawns by the engine's own scenario helper (scenarioState, as the debug positions are), then into
 * places (placeOf), so a figure stands exactly where the game would draw it.
 */
export function figurePlaces(position: FigurePosition): Record<PawnId, Place> {
  const state = scenarioState({ pawns: position, turn: "bleu" }, SEED);
  return Object.fromEntries(ALL_PAWNS.map((id) => [id, placeOf(id, state.pawns[id])])) as Record<
    PawnId,
    Place
  >;
}
