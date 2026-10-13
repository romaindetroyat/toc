// Pure board topology. No clock, no randomness, no DOM, no storage, no network.
// Relative imports carry the explicit .ts extension and syntax is erasable-only
// so Node 22 can import this file directly (tools/ scripts).

/** Seats in clockwise turn order. */
export const COLORS = ["bleu", "jaune", "rouge", "vert"] as const;
export type Color = (typeof COLORS)[number];

/** Number of cells on the shared ring. */
export const RING = 72;

/** Ring index of each colour's exit square (the diamond). */
export const EXIT = { bleu: 0, jaune: 18, rouge: 36, vert: 54 } as const satisfies Record<
  Color,
  number
>;

/** Ring index of each colour's entry square (two cells before its exit). */
export const ENTRY = {
  bleu: (EXIT.bleu - 2 + RING) % RING,
  jaune: (EXIT.jaune - 2 + RING) % RING,
  rouge: (EXIT.rouge - 2 + RING) % RING,
  vert: (EXIT.vert - 2 + RING) % RING,
} as const satisfies Record<Color, number>;

/** Partners sit face to face. */
export const PARTNER = {
  bleu: "rouge",
  rouge: "bleu",
  jaune: "vert",
  vert: "jaune",
} as const satisfies Record<Color, Color>;

export type Team = "bleu-rouge" | "jaune-vert";

export function teamOf(color: Color): Team {
  return color === "bleu" || color === "rouge" ? "bleu-rouge" : "jaune-vert";
}

/** The next seat in clockwise order. */
export function nextColor(color: Color): Color {
  const i = COLORS.indexOf(color);
  return COLORS[(i + 1) % COLORS.length] as Color;
}

export type PawnIndex = 0 | 1 | 2 | 3;
export type PawnId = `${Color}${PawnIndex}`;

export function pawnColor(id: PawnId): Color {
  return id.slice(0, -1) as Color;
}

export function pawnIndex(id: PawnId): PawnIndex {
  return Number(id.slice(-1)) as PawnIndex;
}

export type Place =
  | { z: "ring"; cell: number }
  | { z: "stable"; color: Color; slot: PawnIndex }
  | { z: "home"; color: Color; slot: PawnIndex };

/**
 * Ring index of a pawn of `color` that has advanced `progress` steps since leaving its exit.
 * `progress` is signed (negative after a backward 4 from the exit) and unbounded
 * (a pawn that misses its home entry keeps lapping).
 */
export function ringIndex(color: Color, progress: number): number {
  return (((EXIT[color] + progress) % RING) + RING) % RING;
}

/** The `n` ring places crossed, in order, by a pawn of `color` moving forward from `fromProgress`. */
export function forwardCells(color: Color, fromProgress: number, n: number): Place[] {
  const cells: Place[] = [];
  for (let i = 1; i <= n; i++) {
    cells.push({ z: "ring", cell: ringIndex(color, fromProgress + i) });
  }
  return cells;
}
