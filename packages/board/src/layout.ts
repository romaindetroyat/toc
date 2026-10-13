import type { Color, Place } from "@toc/engine";
import layoutJson from "../layout.json" with { type: "json" };

/** A point in board units (the 2560 x 2560 art space). */
export type Point = readonly [number, number];

type RawLayout = {
  size: number;
  ring: [number, number][];
  pieces: Record<
    Color,
    {
      stable: [number, number][];
      home: [number, number][];
      diamond: [number, number];
      square: [number, number];
    }
  >;
};

export type ColorLayout = {
  stable: Point[];
  home: Point[];
  diamond: Point;
  square: Point;
};

const raw = layoutJson as unknown as RawLayout;

/** Board side in board units. */
export const BOARD_SIZE = raw.size;

const denorm = (p: readonly number[]): Point => [
  (p[0] as number) * raw.size,
  (p[1] as number) * raw.size,
];

function colorLayout(color: Color): ColorLayout {
  const c = raw.pieces[color];
  return {
    stable: c.stable.map(denorm),
    home: c.home.map(denorm),
    diamond: denorm(c.diamond),
    square: denorm(c.square),
  };
}

/** Calibrated cell centres, denormalised to board units (x2560). */
export const LAYOUT: {
  size: number;
  ring: Point[];
  pieces: Record<Color, ColorLayout>;
} = {
  size: raw.size,
  ring: raw.ring.map(denorm),
  pieces: {
    bleu: colorLayout("bleu"),
    jaune: colorLayout("jaune"),
    rouge: colorLayout("rouge"),
    vert: colorLayout("vert"),
  },
};

/** The green felt in the middle of the board (x and y range, board units). */
export const FELT_SQUARE = { min: 853, max: 1707 } as const;

/** Where each seat's last played card lies on the felt (unrotated board). */
export const LAST_CARD_SLOT: Record<Color, Point> = {
  bleu: [1280, 1570],
  jaune: [990, 1280],
  rouge: [1280, 990],
  vert: [1570, 1280],
};

export const TALON: Point = [1180, 1280];
export const DEFAUSSE: Point = [1380, 1280];
export const CARD_SIZE = { w: 160, h: 224 } as const;

/** Unrotated anchor of a place: the cell centre where a pawn's feet stand. */
export function placeXY(place: Place): Point {
  let p: Point | undefined;
  if (place.z === "ring") p = LAYOUT.ring[place.cell];
  else if (place.z === "stable") p = LAYOUT.pieces[place.color].stable[place.slot];
  else p = LAYOUT.pieces[place.color].home[place.slot];
  if (!p) throw new Error(`no anchor for place ${JSON.stringify(place)}`);
  return p;
}
