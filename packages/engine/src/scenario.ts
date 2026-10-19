// scenarioState: builds a GameState from the `before` block of a Scenario (RULES.md fixtures).
// Used by the acceptance tests and by the debug scenario loader. Pure, no I/O, erasable syntax only.
// Conventions are documented on the Scenario type (types.ts).

import { FULL_DECK } from "./deck.ts";
import { defaultJustOut } from "./path.ts";
import { type Rng, shuffle } from "./rng.ts";
import { DEFAULT_RULES } from "./rules.ts";
import { startGame } from "./state.ts";
import { COLORS, type Color, type PawnId } from "./topology.ts";
import type { CardId, GameState, Pawn, PawnSpec, Scenario } from "./types.ts";

function perColor<T>(make: (color: Color) => T): Record<Color, T> {
  return { bleu: make("bleu"), jaune: make("jaune"), rouge: make("rouge"), vert: make("vert") };
}

function pawnOf(spec: PawnSpec): Pawn {
  if (spec === "S") return { zone: "stable" };
  // G18: a fixture's knight at progress 0 is the knight just out of its stable (the default of a saved
  // pawn); any other ring position, an extra lap included, is ordinary.
  if ("p" in spec) return { zone: "ring", progress: spec.p, justOut: defaultJustOut(spec.p) };
  return { zone: "home", slot: spec.h };
}

/** The seat that plays just before `seat`. */
function previousColor(seat: Color): Color {
  return COLORS[(COLORS.indexOf(seat) + COLORS.length - 1) % COLORS.length] as Color;
}

/**
 * A GameState (kind 'state') for a fixture: unspecified pawns in their stable, hands as given and the
 * other hands empty, the remaining cards shuffled into the talon with `seed`. Defaults: phase 'play',
 * dealer = the seat before `turn`, dealIndex 0, rules = DEFAULT_RULES.
 * `phase: "exchange"` with no hand at all is « the first deal of the game »: the engine deals it.
 */
export function scenarioState(before: Scenario["before"], seed: Rng): GameState {
  const dealer = before.dealer ?? previousColor(before.turn);
  if (before.phase === "exchange" && before.hands === undefined) {
    return startGame({ firstDealer: dealer }, seed).state;
  }

  const pawns = {} as Record<PawnId, Pawn>;
  for (const color of COLORS) {
    const specs = before.pawns?.[color];
    for (const index of [0, 1, 2, 3] as const) {
      const spec = specs?.[index];
      pawns[`${color}${index}`] = spec === undefined ? { zone: "stable" } : pawnOf(spec);
    }
  }

  const hands = perColor((color): CardId[] => (before.hands?.[color] ?? []).slice());
  const held = new Set<CardId>(COLORS.flatMap((color) => hands[color]));
  const [talon, rng] = shuffle(
    FULL_DECK.filter((card) => !held.has(card)),
    [seed[0], seed[1], seed[2], seed[3]],
  );

  return {
    kind: "state",
    pawns,
    hands,
    talon,
    discard: [],
    lastPlayed: perColor((): CardId | null => null),
    posed: perColor((): CardId[] => []),
    dealer,
    dealIndex: before.dealIndex ?? 0,
    dealsPlayed: 0,
    turn: before.turn,
    phase: before.phase ?? "play",
    given: perColor((): CardId | null => null),
    received: perColor((): CardId | null => null),
    captures: { "bleu-rouge": 0, "jaune-vert": 0 },
    winner: null,
    rng,
    rules: { ...DEFAULT_RULES },
  };
}
