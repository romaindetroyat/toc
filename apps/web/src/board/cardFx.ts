import {
  CARD_SIZE,
  LAST_CARD_SLOT,
  MAX_DEAL_CARDS,
  MOTION,
  type Mode,
  type Point,
  REDUCED,
  rotatePoint,
  scaleFor,
  TALON,
} from "@toc/board";
import { type CardId, COLORS, type Color, PARTNER } from "@toc/engine";
import { animateNow } from "./frameClock.ts";

// The cards that move over the board: the deal, a played card, the exchange and a dead hand laid on
// the felt. Each motion is a list of FlightSpec, one per card: where it goes (in screen-oriented board
// units, after the rotation toward the human), when it starts and how long it takes. The specs are
// pure data: CardFlights.svelte draws a card per spec and runs it with the Web Animations API, on
// transform and opacity only. Durations and staggers come from MOTION and REDUCED (motion.ts).

/** One card on its way: `card` is null for a face-down card. */
export type FlightSpec = {
  kind: "deal" | "play" | "exchange" | "lay";
  card: CardId | null;
  keyframes: Keyframe[];
  delayMs: number;
  durationMs: number;
  easing: string;
};

const MIDDLE = 1280;
/** How far from the centre of the board a seat's cards leave or arrive, a little past the board's edge. */
const EDGE_REACH = 1400;
/** The slide of a card when motion is reduced, in board units. */
const SLIDE = 70;
const { w: CW, h: CH } = CARD_SIZE;

const UNROTATED_EDGE: Record<Color, Point> = {
  bleu: [MIDDLE, MIDDLE + EDGE_REACH],
  jaune: [MIDDLE - EDGE_REACH, MIDDLE],
  rouge: [MIDDLE, MIDDLE - EDGE_REACH],
  vert: [MIDDLE + EDGE_REACH, MIDDLE],
};

/** A tilt between -4 and +4 degrees, the same every time for one card (the felt lays it so). */
export function tiltOf(card: CardId): number {
  let hash = 0;
  for (const char of card) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 9) - 4;
}

/** The edge of the board in front of a seat, where its hand is: below the board for the human. */
export const seatEdge = (seat: Color, k: number): Point => rotatePoint(UNROTATED_EDGE[seat], k);

/** The felt slot of a seat's last card. */
export const seatSlot = (seat: Color, k: number): Point => rotatePoint(LAST_CARD_SLOT[seat], k);

/** The talon. */
export const talonAt = (k: number): Point => rotatePoint(TALON, k);

/**
 * Where the `count` cards of a dead hand lie in front of their seat: a row for the seats at the top
 * and the bottom of the screen, a column for the seats at the sides, 50 % overlap.
 */
export function posedSlots(seat: Color, count: number, k: number): Point[] {
  const [cx, cy] = seatSlot(seat, k);
  const horizontal = Math.abs(cy - MIDDLE) > Math.abs(cx - MIDDLE);
  const step = horizontal ? CW / 2 : CH / 2;
  return Array.from({ length: count }, (_, i): Point => {
    const shift = (i - (count - 1) / 2) * step;
    return horizontal ? [cx + shift, cy] : [cx, cy + shift];
  });
}

const pose = (point: Point, tilt = 0, scale = 1): string =>
  `translate(${point[0]}px, ${point[1]}px) rotate(${tilt}deg) scale(${scale})`;

const towards = (from: Point, to: Point, fraction: number): Point => [
  from[0] + (to[0] - from[0]) * fraction,
  from[1] + (to[1] - from[1]) * fraction,
];

/** The point `distance` board units from `from` on the way to `toward`. */
function offsetToward(from: Point, toward: Point, distance: number): Point {
  const length = Math.hypot(toward[0] - from[0], toward[1] - from[1]) || 1;
  return towards(from, toward, distance / length);
}

/** The deal: `seats` in dealing order, each with the number of cards it gets, dealt round by round. */
export function dealFlights(
  seats: readonly { seat: Color; count: number }[],
  k: number,
  mode: Mode,
): FlightSpec[] {
  const talon = talonAt(k);
  if (mode === "reduced") {
    // One card per seat slides out of the talon and fades: calm, and still a deal.
    return seats
      .filter(({ count }) => count > 0)
      .map(({ seat }) => {
        const edge = seatEdge(seat, k);
        return {
          kind: "deal",
          card: null,
          keyframes: [
            { transform: pose(talon), opacity: 0 },
            { transform: pose(towards(talon, edge, 0.15)), opacity: 1, offset: 0.4 },
            { transform: pose(towards(talon, edge, 0.3)), opacity: 0 },
          ],
          delayMs: 0,
          durationMs: REDUCED.cards,
          easing: "ease-out",
        };
      });
  }

  const scale = scaleFor(mode);
  const flights: FlightSpec[] = [];
  const rounds = Math.max(0, ...seats.map(({ count }) => count));
  for (let round = 0; round < rounds; round++) {
    for (const { seat, count } of seats) {
      if (round >= count || flights.length >= MAX_DEAL_CARDS) continue;
      const n = flights.length;
      const edge = seatEdge(seat, k);
      const spin = (n % 2 === 0 ? 1 : -1) * (8 + ((n * 7) % 14));
      flights.push({
        kind: "deal",
        card: null,
        keyframes: [
          { transform: pose(talon, 0, 1), opacity: 1 },
          { transform: pose(towards(talon, edge, 0.75), spin * 0.8, 0.9), opacity: 1, offset: 0.7 },
          { transform: pose(edge, spin, 0.7), opacity: 0 },
        ],
        delayMs: n * MOTION.dealStagger * scale,
        durationMs: MOTION.dealCard * scale,
        easing: "ease-out",
      });
    }
  }
  return flights;
}

/** A card played: it flies from the edge in front of its seat to its felt slot, and lands tilted. */
export function playFlight(seat: Color, card: CardId, k: number, mode: Mode): FlightSpec {
  const edge = seatEdge(seat, k);
  const slot = seatSlot(seat, k);
  const tilt = tiltOf(card);
  if (mode === "reduced") {
    return {
      kind: "play",
      card,
      keyframes: [
        { transform: pose(offsetToward(slot, edge, SLIDE), tilt), opacity: 0 },
        { transform: pose(slot, tilt), opacity: 1 },
      ],
      delayMs: 0,
      durationMs: REDUCED.cards,
      easing: "ease-out",
    };
  }
  return {
    kind: "play",
    card,
    keyframes: [
      { transform: pose(edge, 0, 0.9), opacity: 0 },
      { transform: pose(towards(edge, slot, 0.2), tilt * 0.5, 0.95), opacity: 1, offset: 0.2 },
      { transform: pose(slot, tilt, 1), opacity: 1 },
    ],
    delayMs: 0,
    durationMs: MOTION.cardPlay * scaleFor(mode),
    easing: "ease-out",
  };
}

/**
 * The exchange: the card each seat hands over crosses the felt, face down, to its partner. The two
 * cards of a pair bow to their own left, so they pass on either side of each other.
 */
export function exchangeFlights(k: number, mode: Mode): FlightSpec[] {
  return COLORS.map((seat): FlightSpec => {
    const from = seatSlot(seat, k);
    const to = seatSlot(PARTNER[seat], k);
    if (mode === "reduced") {
      return {
        kind: "exchange",
        card: null,
        keyframes: [
          { transform: pose(from), opacity: 0 },
          { transform: pose(towards(from, to, 0.12)), opacity: 1, offset: 0.4 },
          { transform: pose(towards(from, to, 0.25)), opacity: 0 },
        ],
        delayMs: 0,
        durationMs: REDUCED.cards,
        easing: "ease-in-out",
      };
    }
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const distance = Math.hypot(dx, dy) || 1;
    const bow = 110;
    const middle: Point = [
      (from[0] + to[0]) / 2 + (-dy / distance) * bow,
      (from[1] + to[1]) / 2 + (dx / distance) * bow,
    ];
    return {
      kind: "exchange",
      card: null,
      keyframes: [
        { transform: pose(from, 0, 0.85), opacity: 0 },
        { transform: pose(towards(from, middle, 0.3), 0, 0.95), opacity: 1, offset: 0.15 },
        { transform: pose(middle, 0, 1), opacity: 1, offset: 0.5 },
        { transform: pose(towards(middle, to, 0.7), 0, 0.95), opacity: 1, offset: 0.85 },
        { transform: pose(to, 0, 0.85), opacity: 0 },
      ],
      delayMs: 0,
      durationMs: MOTION.exchangeCross * scaleFor(mode),
      easing: "ease-in-out",
    };
  });
}

/** A dead hand laid face up in front of its seat, card by card (350 ms each, 60 ms apart). */
export function layFlights(
  seat: Color,
  cards: readonly CardId[],
  k: number,
  mode: Mode,
): FlightSpec[] {
  const edge = seatEdge(seat, k);
  const slots = posedSlots(seat, cards.length, k);
  const scale = scaleFor(mode);
  return cards.map((card, i): FlightSpec => {
    const to = slots[i] as Point;
    const tilt = tiltOf(card);
    if (mode === "reduced") {
      return {
        kind: "lay",
        card,
        keyframes: [
          { transform: pose(offsetToward(to, edge, SLIDE), tilt), opacity: 0 },
          { transform: pose(to, tilt), opacity: 1 },
        ],
        delayMs: 0,
        durationMs: REDUCED.cards,
        easing: "ease-out",
      };
    }
    return {
      kind: "lay",
      card,
      keyframes: [
        { transform: pose(edge, 0, 0.9), opacity: 0 },
        { transform: pose(towards(edge, to, 0.25), tilt * 0.5, 0.95), opacity: 1, offset: 0.2 },
        { transform: pose(to, tilt, 1), opacity: 1 },
      ],
      delayMs: i * MOTION.deadStagger * scale,
      durationMs: MOTION.deadCard * scale,
      easing: "ease-out",
    };
  });
}

/** The animations in flight, so that a hidden tab can jump them all to their end. */
const running = new Set<Animation>();

/**
 * Starts a spec on the node that draws its card (a `<g>` placed at the origin of the board's SVG), on
 * the frame clock like the knights (animateNow). The card holds its last pose until the caller takes
 * it away (fill both). Resolves when it ends.
 */
export function runFlight(node: Element, spec: FlightSpec): Promise<void> {
  const animation = animateNow(node, spec.keyframes, {
    duration: spec.durationMs,
    delay: spec.delayMs,
    easing: spec.easing,
    fill: "both",
  });
  running.add(animation);
  const forget = () => {
    running.delete(animation);
  };
  return animation.finished.then(forget, forget);
}

/** Jumps every card in flight to its end, so the promises of the Director settle at once. */
export function finishFlights(): void {
  for (const animation of [...running]) {
    try {
      animation.finish();
    } catch {
      // An animation that was cancelled meanwhile has nothing left to finish.
    }
  }
}

/** Takes a card out of the flights: used when its node leaves the page before it ended. */
export function cancelFlight(node: Element): void {
  for (const animation of node.getAnimations()) {
    running.delete(animation);
    animation.cancel();
  }
}
