// Test helpers shared by path.test.ts and flags.test.ts: boards and states written as data.

import {
  COLORS,
  type Color,
  DEFAULT_RULES,
  defaultJustOut,
  type GameState,
  type Pawn,
  type PawnId,
  type PawnSpec,
  type RuleSet,
  scenarioState,
} from "../src/index.ts";

export type Board = { pawns: Record<PawnId, Pawn>; rules: RuleSet };

/** A board with every listed pawn placed and the others in their stables. */
export function board(
  placed: Partial<Record<PawnId, PawnSpec>>,
  rules: Partial<RuleSet> = {},
): Board {
  const pawns = {} as Record<PawnId, Pawn>;
  for (const color of COLORS) {
    for (const index of [0, 1, 2, 3] as const) {
      const id: PawnId = `${color}${index}`;
      const spec = placed[id] ?? "S";
      pawns[id] =
        spec === "S"
          ? { zone: "stable" }
          : "p" in spec
            ? { zone: "ring", progress: spec.p, justOut: defaultJustOut(spec.p) }
            : { zone: "home", slot: spec.h };
    }
  }
  return { pawns, rules: { ...DEFAULT_RULES, ...rules } };
}

/** A game state in the play phase: pawns by colour, one hand, and optional rule overrides. */
export function playState(
  pawns: Partial<Record<Color, [PawnSpec, PawnSpec, PawnSpec, PawnSpec]>>,
  hands: Partial<Record<Color, GameState["hands"][Color]>>,
  turn: Color,
  rules: Partial<RuleSet> = {},
): GameState {
  const state = scenarioState({ pawns, hands, turn }, [7, 8, 9, 10]);
  return { ...state, rules: { ...state.rules, ...rules } };
}
