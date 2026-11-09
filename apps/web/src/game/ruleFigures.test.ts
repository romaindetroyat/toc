import {
  type Action,
  ALL_PAWNS,
  COLORS,
  type Color,
  type PawnId,
  type PawnSpec,
  ringIndex,
  type Scenario,
} from "@toc/engine";
import { scenarios } from "@toc/engine/scenarios";
import { describe, expect, it } from "vitest";
import { type FigureId, RULES_TABS, regles } from "../i18n/fr/regles.ts";
import { figurePlaces, RULE_FIGURES } from "./ruleFigures.ts";

// The fifteen rule figures of « Règles du TOC » (plan 05-04, D-15): drawn live from positions kept in
// ruleFigures.ts, so the release code never imports the scenario set. This test, and only this one,
// reads the scenarios of RULES.md and checks that every position is the scenario's own.

const IDS: FigureId[] = [
  "R-01.1",
  "R-07.1",
  "R-08.1",
  "R-04.2",
  "R-14.2",
  "R-06.1",
  "R-12.1",
  "R-10.2",
  "R-10.4",
  "R-09.1",
  "R-11.1",
  "R-13.1",
  "R-13.5",
  "R-15.1",
  "R-13.12",
];
const WITHOUT_AFTER: FigureId[] = ["R-01.1", "R-04.2", "R-14.2", "R-06.1", "R-12.1"];

type Position = Partial<Record<Color, readonly PawnSpec[]>>;

function scenarioOf(id: FigureId): Scenario {
  const found = scenarios.find((scenario) => scenario.id === id);
  if (found === undefined) throw new Error(`no scenario ${id}`);
  return found;
}

/** Every colour's four knights, missing ones in their stable (a position as the board draws it). */
function full(position: Position | undefined): Record<Color, PawnSpec[]> {
  const out = {} as Record<Color, PawnSpec[]>;
  for (const color of COLORS) {
    const specs = position?.[color];
    out[color] = [0, 1, 2, 3].map((i) => specs?.[i] ?? "S");
  }
  return out;
}

/** The position after the move: `after` over `before`, the captured knights back in their stable. */
function afterOf(scenario: Scenario): Record<Color, PawnSpec[]> {
  const merged = full({ ...scenario.before.pawns, ...scenario.expect.after?.pawns });
  for (const pawn of scenario.expect.captured ?? []) {
    const color = COLORS.find((each) => pawn.startsWith(each)) as Color;
    merged[color][Number(pawn.slice(color.length))] = "S";
  }
  return merged;
}

/** The knights an action names (the mover, the Valet's target, the 7's knights). */
function pawnsOf(actions: readonly Action[]): PawnId[] {
  const out = new Set<PawnId>();
  for (const action of actions) {
    if ("pawn" in action) out.add(action.pawn);
    if ("target" in action) out.add(action.target);
    if ("plan" in action) for (const step of action.plan) out.add(step.pawn);
  }
  return [...out];
}

/** The knights the docs figure rings below (tools/render-scenarios.mjs): the action, script, lists. */
function concernedOf(scenario: Scenario): PawnId[] {
  const actions: Action[] = [
    ...(scenario.action ? [scenario.action] : []),
    ...(scenario.script ?? []).map((step) => step.action),
    ...(scenario.expect.legalInclude ?? []),
    ...(scenario.expect.legalExclude ?? []),
  ];
  return pawnsOf(actions).sort();
}

describe("RULE_FIGURES: the fifteen figures of « Règles du TOC »", () => {
  it("are the fifteen of the UI-SPEC, once each, in the order of their tabs", () => {
    expect(RULE_FIGURES.map((figure) => figure.id).sort()).toEqual([...IDS].sort());
    const byTab = RULES_TABS.flatMap((tab) => regles.tabs[tab].figures);
    expect(RULE_FIGURES.map((figure) => figure.id)).toEqual(byTab);
    for (const figure of RULE_FIGURES) {
      expect(regles.tabs[figure.tab].figures, figure.id).toContain(figure.id);
    }
  });

  for (const id of IDS) {
    it(`${id}: the position before the move is the scenario's`, () => {
      const figure = RULE_FIGURES.find((each) => each.id === id);
      expect(figure).toBeDefined();
      expect(full(figure?.before)).toEqual(full(scenarioOf(id).before.pawns));
    });

    it(`${id}: the lower half is the scenario's (after the move, or the knights it concerns)`, () => {
      const figure = RULE_FIGURES.find((each) => each.id === id);
      const scenario = scenarioOf(id);
      if (WITHOUT_AFTER.includes(id)) {
        expect(scenario.expect.after).toBeUndefined();
        expect(figure?.after).toBeUndefined();
        expect([...(figure?.concerned ?? [])].sort()).toEqual(concernedOf(scenario));
      } else {
        expect(scenario.expect.after).toBeDefined();
        expect(figure?.concerned).toBeUndefined();
        expect(full(figure?.after)).toEqual(afterOf(scenario));
      }
    });
  }

  it("has a French caption for each, with « cheval », never « pion »", () => {
    for (const id of IDS) {
      const caption = regles.figure.captions[id];
      expect(caption.length, id).toBeGreaterThan(10);
      expect(caption, id).not.toMatch(/\bpions?\b/i);
    }
  });

  it("writes the alt text of both kinds", () => {
    expect(regles.figure.altAfter("La Dame avance de 12.")).toBe(
      "La Dame avance de 12. En haut, avant le coup ; en bas, après.",
    );
    expect(regles.figure.altMove("L’As sort un cheval, ou avance de 1.")).toBe(
      "L’As sort un cheval, ou avance de 1. En haut, la position ; en bas, le coup.",
    );
  });
});

describe("figurePlaces: a figure's position as board places", () => {
  it("places the sixteen knights, the missing ones in their stable", () => {
    const places = figurePlaces({ bleu: [{ p: 10 }, "S", { h: 2 }, "S"] });
    expect(Object.keys(places).sort()).toEqual([...ALL_PAWNS].sort());
    expect(places.bleu0).toEqual({ z: "ring", cell: ringIndex("bleu", 10) });
    expect(places.bleu1).toEqual({ z: "stable", color: "bleu", slot: 1 });
    expect(places.bleu2).toEqual({ z: "home", color: "bleu", slot: 2 });
    expect(places.rouge3).toEqual({ z: "stable", color: "rouge", slot: 3 });
  });

  it("follows the ring of each colour, backwards and past a lap", () => {
    const places = figurePlaces({
      jaune: [{ p: -4 }, "S", "S", "S"],
      bleu: [{ p: 75 }, "S", "S", "S"],
    });
    expect(places.jaune0).toEqual({ z: "ring", cell: ringIndex("jaune", -4) });
    expect(places.bleu0).toEqual({ z: "ring", cell: ringIndex("bleu", 75) });
  });
});

describe("the release code never imports the scenario set (D-15, 05-RESEARCH Pattern 6)", () => {
  const sources = import.meta.glob<string>(
    [
      "./ruleFigures.ts",
      "../ui/RuleFigure.svelte",
      "../ui/RulesSheet.svelte",
      "../ui/CardRule.svelte",
      "../i18n/fr/regles.ts",
    ],
    { query: "?raw", import: "default", eager: true },
  );

  it("reads the five files of the sheet", () => {
    expect(Object.keys(sources)).toHaveLength(5);
  });

  for (const [file, text] of Object.entries(sources)) {
    it(`${file} has no import of @toc/engine/scenarios`, () => {
      // An import of it, static or dynamic (a comment may name it).
      expect(text).not.toMatch(/(?:from|import\()\s*["']@toc\/engine\/scenarios["']/);
    });
  }
});
