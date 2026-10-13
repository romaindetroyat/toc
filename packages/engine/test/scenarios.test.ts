// The RULES.md scenarios as executable acceptance tests (success criterion 1).
// Every fixture of packages/engine/scenarios is built with scenarioState() and checked against the engine.
// Scenarios that need the 7 are `todo` until plan 01-13; the « alt » scenarios (R-09.9, R-15.9) describe
// the alternative of an open point and are skipped; R-13.15 is a known fixture contradiction (below).

import { describe, expect, it } from "vitest";
import { scenarios } from "../scenarios/index.ts";
import {
  type Action,
  apply,
  type CardId,
  COLORS,
  type Color,
  endDeal,
  FULL_DECK,
  type GameEvent,
  type GameState,
  IllegalActionError,
  isDealOver,
  legalActions,
  nextColor,
  type Pawn,
  type PawnId,
  type PawnSpec,
  playability,
  type Scenario,
  sameAction,
  scenarioState,
  startGame,
  viewFor,
} from "../src/index.ts";

type Seed = [number, number, number, number];
const FIXED_SEED: Seed = [101, 202, 303, 404];

/** The fixture R-13.15 plays a 4 and expects a forward move into the home; the 4 goes back (R-08). */
const CONTRADICTIONS: Record<string, string> = {
  "R-13.13":
    "the fixture plays 4S (backward 4, R-08) from progress 66 and expects progress 70, which a forward 4 would give: RULES.md contradicts itself, see the SUMMARY of plan 01-12",
  "R-13.15":
    "the fixture plays 4S (backward 4, R-08) from progress 140 and expects home slot 1, which a forward 4 would give: RULES.md contradicts itself, see the SUMMARY of plan 01-12",
};

function mentionsSeven(value: unknown): boolean {
  return /"t":"seven"|"seven-incomplete"/.test(JSON.stringify(value));
}

/** True when the scenario depends on whether a 7 can be played (plan 01-13). */
function sevenDependent(sc: Scenario): boolean {
  if (sc.rule === "R-10" || sc.flags?.includes("seven")) return true;
  if (mentionsSeven([sc.action, sc.script, sc.expect])) return true;
  const sevens = Object.keys(sc.expect.playable ?? {}).some((card) => card.startsWith("7"));
  return sevens;
}

function specOf(pawn: Pawn): PawnSpec {
  if (pawn.zone === "stable") return "S";
  if (pawn.zone === "ring") return { p: pawn.progress };
  return { h: pawn.slot };
}

function pawnSpecs(state: GameState, color: Color): PawnSpec[] {
  return ([0, 1, 2, 3] as const).map((i) => specOf(state.pawns[`${color}${i}` as PawnId]));
}

function allCards(state: GameState): CardId[] {
  return [
    ...state.talon,
    ...state.discard,
    ...COLORS.flatMap((c) => state.hands[c]),
    ...COLORS.flatMap((c) => state.posed[c]),
  ];
}

/** Events listed by a fixture are compared without the deal machinery unless the fixture lists it. */
const DEAL_EVENTS = new Set<GameEvent["t"]>(["dealt", "handDealt", "reshuffled"]);

function expectEvents(expected: GameEvent["t"][], emitted: GameEvent[]): void {
  const kinds = emitted.map((e) => e.t);
  const listsDeal = expected.some((t) => DEAL_EVENTS.has(t));
  expect(listsDeal ? kinds : kinds.filter((t) => !DEAL_EVENTS.has(t))).toEqual(expected);
}

function run(sc: Scenario): void {
  const { before, expect: want } = sc;
  const seat = sc.seat ?? before.turn;
  let events: GameEvent[] = [];
  let state: GameState;

  if (before.phase === "exchange" && before.hands === undefined) {
    // R-03.1: the first deal of the game, dealt by the engine from the seed.
    const started = startGame({ firstDealer: before.dealer ?? "vert" }, FIXED_SEED);
    state = started.state;
    events = started.events;
  } else {
    state = scenarioState(before, FIXED_SEED);
  }
  const initial = state;

  // Legal lists are read on the position before the move.
  const legalBefore = legalActions(initial, seat);
  const has = (list: Action[], action: Action) => list.some((a) => sameAction(a, action));
  for (const action of want.legalInclude ?? []) {
    expect(has(legalBefore, action), `legal list lacks ${JSON.stringify(action)}`).toBe(true);
  }
  for (const action of want.legalExclude ?? []) {
    expect(has(legalBefore, action), `legal list holds ${JSON.stringify(action)}`).toBe(false);
  }

  let playState = initial;
  if (sc.script !== undefined && sc.script.length > 0) {
    for (const step of sc.script) {
      const out = apply(state, step.seat, step.action);
      state = out.state;
      events = events.concat(out.events);
    }
    playState = state;
  } else if (sc.action !== undefined) {
    // A fixture that gives a hand to the acting seat only means « the other seats still hold cards »
    // (R-14.2, R-16.2): when this move empties the last hand, give the next seat a card from the talon
    // so the deal does not end inside the move.
    const lastCard = state.hands[seat].length === 1 || sc.action.t === "discard";
    if (lastCard && COLORS.every((c) => c === seat || state.hands[c].length === 0)) {
      const bystander = nextColor(seat);
      state = {
        ...state,
        hands: { ...state.hands, [bystander]: [state.talon[0] as CardId] },
        talon: state.talon.slice(1),
      };
    }
    const isLegal = has(legalBefore, sc.action);
    if (want.legal !== undefined) expect(isLegal).toBe(want.legal);
    if (isLegal) {
      const out = apply(state, seat, sc.action);
      state = out.state;
      events = events.concat(out.events);
    } else {
      expect(() => apply(state, seat, sc.action as Action)).toThrow(IllegalActionError);
    }
  } else if (isDealOver(state)) {
    const out = endDeal(state);
    state = out.state;
    events = events.concat(out.events);
  }

  if (want.playable !== undefined || want.reason !== undefined) {
    const viewSeat = sc.script ? playState.turn : seat;
    const table = playability(viewFor(playState, viewSeat), viewSeat);
    for (const [card, playable] of Object.entries(want.playable ?? {}) as [CardId, boolean][]) {
      expect(table[card]?.playable, `playable ${card}`).toBe(playable);
    }
    if (want.reason !== undefined) {
      const unplayable = Object.values(table).filter((p) => !p.playable);
      expect(unplayable.length).toBeGreaterThan(0);
      for (const p of unplayable) expect(p.playable === false && p.reason).toBe(want.reason);
    }
  }

  if (want.captured !== undefined) {
    const victims = events.flatMap((e) => (e.t === "pawnCaptured" ? [e.victim] : []));
    expect([...victims].sort()).toEqual([...want.captured].sort());
  }
  if (want.after !== undefined) {
    for (const color of COLORS) {
      const specs = want.after.pawns[color];
      if (specs !== undefined) expect(pawnSpecs(state, color)).toEqual(specs);
    }
  }
  if (want.events !== undefined) expectEvents(want.events, events);
  if (want.turn !== undefined) expect(state.turn).toBe(want.turn);
  if (want.phase !== undefined) expect(state.phase).toBe(want.phase);
  if (want.received !== undefined) {
    for (const [color, card] of Object.entries(want.received) as [Color, CardId][]) {
      expect(state.received[color]).toBe(card);
    }
  }
  if (want.handSizes !== undefined) {
    for (const [color, size] of Object.entries(want.handSizes) as [Color, number][]) {
      expect(state.hands[color]).toHaveLength(size);
    }
  }
  if (want.conserved === true) {
    expect([...allCards(state)].sort()).toEqual([...FULL_DECK].sort());
  }
  if (want.deal !== undefined) {
    if (want.deal.sizes !== undefined) {
      expect(COLORS.map((c) => state.hands[c].length)).toEqual(want.deal.sizes);
    }
    if (want.deal.dealer !== undefined) expect(state.dealer).toBe(want.deal.dealer);
    if (want.deal.first !== undefined) expect(state.turn).toBe(want.deal.first);
  }
}

const RULE_IDS = [...new Set(scenarios.map((sc) => sc.rule))];

for (const rule of RULE_IDS) {
  describe(rule, () => {
    for (const sc of scenarios.filter((s) => s.rule === rule)) {
      const name = `${sc.id} ${sc.title}`;
      if (sc.flags?.includes("alt")) {
        it.skip(`${name} (alternative of an open point, not implemented)`, () => {});
      } else if (CONTRADICTIONS[sc.id] !== undefined) {
        it.skip(`${name} (${CONTRADICTIONS[sc.id]})`, () => {});
      } else if (sevenDependent(sc)) {
        // The 7 is added by plan 01-13 (RULE-10, RULE-11).
        it.todo(name);
      } else {
        it(name, () => run(sc));
      }
    }
  });
}

describe("fixtures that contradict R-08 (the 4 goes back)", () => {
  const cases: [string, number, number][] = [
    ["R-13.13", 66, 62],
    ["R-13.15", 140, 136],
  ];
  for (const [id, start, end] of cases) {
    it(`${id}: the engine plays the 4 backward from ${start} to ${end}, it does not enter the home`, () => {
      const sc = scenarios.find((s) => s.id === id) as Scenario;
      const state = scenarioState(sc.before, FIXED_SEED);
      expect(state.pawns.bleu0).toEqual({ zone: "ring", progress: start });
      const out = apply(state, "bleu", sc.action as Action);
      expect(out.state.pawns.bleu0).toEqual({ zone: "ring", progress: end });
    });
  }
});
