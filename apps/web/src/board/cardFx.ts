import {
  MAX_DEAL_CARDS,
  MOTION,
  type Mode,
  type Point,
  REDUCED,
  SCENE,
  type ScreenSide,
  scaleFor,
  sceneSideOf,
  seatCard,
} from "@toc/board";
import { type CardId, COLORS, type Color, PARTNER } from "@toc/engine";
import { animateNow } from "./frameClock.ts";

// The cards that move over the board: the deal, a played card, the exchange and a dead hand laid on
// the felt. Each motion is a list of FlightSpec, one per card: where it goes (in the scene units of
// the landscape galet, the game's only board, whose drawing never turns: the human's seat is at the
// bottom), how it is turned, when it starts and how long it takes. The felt is the galet's green
// ellipse: each seat's card lies on it in front of its seat and faces it, the talon and the défausse
// lie on either side of its centre (« à confirmer par Romain », item 4 of the « Plateau galet »
// addendum). The specs are pure data: CardFlights.svelte draws a card per spec and runs it with the
// Web Animations API through animateNow() (frameClock.ts), on transform and opacity only. Durations
// and staggers come from MOTION and REDUCED (motion.ts).

/** One card on its way: `card` is null for a face-down card. */
export type FlightSpec = {
  kind: "deal" | "play" | "exchange" | "lay";
  card: CardId | null;
  keyframes: Keyframe[];
  delayMs: number;
  durationMs: number;
  easing: string;
};

/** The centre of the scene. */
const [MID_X, MID_Y] = [SCENE.width / 2, SCENE.height / 2];
/** How far past the board's edge a seat's cards leave or arrive. */
const EDGE_PAST = 120;
/** The slide of a card when motion is reduced, in scene units. */
const SLIDE = 70;
const { w: CW, h: CH } = SCENE.card;

/** The point past the board's edge on each screen side, on the axis through the centre. */
const EDGE: Record<ScreenSide, Point> = {
  bottom: [MID_X, SCENE.height + EDGE_PAST],
  top: [MID_X, -EDGE_PAST],
  left: [-EDGE_PAST, MID_Y],
  right: [SCENE.width + EDGE_PAST, MID_Y],
};

/** A tilt between -4 and +4 degrees, the same every time for one card (the felt lays it so). */
export function tiltOf(card: CardId): number {
  let hash = 0;
  for (const char of card) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return (hash % 9) - 4;
}

/** The edge of the board in front of a seat, where its hand is: below the board for the human. */
export const seatEdge = (seat: Color, k: number): Point => EDGE[sceneSideOf(seat, k)];

/** The felt place of a seat's last card: in front of its seat, inside the galet's ellipse. */
export const seatSlot = (seat: Color, k: number): Point => seatCard(seat, k).at;

/**
 * How a card lying in front of a seat is turned: it faces its seat (0 at the bottom, 90 on the left,
 * 180 at the top, 270 on the right), as on the galet mock-up (« à confirmer par Romain »).
 */
export const seatAngle = (seat: Color, k: number): number => seatCard(seat, k).angle;

/**
 * The talon: left of the felt's centre on every seat's screen (the drawing never turns, so `k` only
 * keeps the signature of the other places).
 */
export const talonAt = (_k: number): Point => SCENE.talon;

/** Every tilt tiltOf can give: a posed card must fit the felt whichever it gets. */
const TILTS = [-4, -3, -2, -1, 0, 1, 2, 3, 4] as const;

/** Whether a card centred on `at`, turned by `degrees`, lies inside the felt with all four corners. */
function cardInsideFelt(at: Point, degrees: number): boolean {
  const shape = SCENE.feltShape;
  if (shape.kind !== "ellipse") return true;
  const t = (degrees * Math.PI) / 180;
  const [cos, sin] = [Math.cos(t), Math.sin(t)];
  for (const [x, y] of [
    [-CW / 2, -CH / 2],
    [CW / 2, -CH / 2],
    [CW / 2, CH / 2],
    [-CW / 2, CH / 2],
  ] as const) {
    const px = at[0] + x * cos - y * sin;
    const py = at[1] + x * sin + y * cos;
    if (((px - shape.cx) / shape.rx) ** 2 + ((py - shape.cy) / shape.ry) ** 2 > 1) return false;
  }
  return true;
}

/** The slots of a fan of `count` cards centred on `centre`, `step` apart along x (row) or y. */
const fanOf = (centre: Point, count: number, step: number, row: boolean): Point[] =>
  Array.from({ length: count }, (_, i): Point => {
    const shift = (i - (count - 1) / 2) * step;
    return row ? [centre[0] + shift, centre[1]] : [centre[0], centre[1] + shift];
  });

const fanSteps = new Map<string, number>();

/**
 * The step of a dead hand's fan: half a card at most (50 % overlap), less where the ellipse is too
 * narrow, so that every card of the fan lies inside it whatever its tilt (the side seats, where the
 * ellipse is lowest, get a tighter fan). Whole scene units, found by bisection.
 */
function fanStep(centre: Point, count: number, angle: number, row: boolean): number {
  const key = `${centre[0]},${centre[1]},${count},${angle}`;
  const known = fanSteps.get(key);
  if (known !== undefined) return known;
  const fits = (step: number) =>
    fanOf(centre, count, step, row).every((at) =>
      TILTS.every((tilt) => cardInsideFelt(at, angle + tilt)),
    );
  let step = CW / 2;
  if (count > 1 && !fits(step)) {
    let [low, high] = [0, step];
    for (let i = 0; i < 40; i++) {
      const mid = (low + high) / 2;
      if (fits(mid)) low = mid;
      else high = mid;
    }
    step = Math.floor(low);
  }
  fanSteps.set(key, step);
  return step;
}

/**
 * Where the `count` cards of a dead hand lie in front of their seat, facing it like its last card:
 * along the seat's side (a row for the seats at the bottom and the top of the screen, a column for
 * the side seats), centred on the seat's place, at most half a card apart and inside the ellipse.
 */
export function posedSlots(seat: Color, count: number, k: number): Point[] {
  const { at, angle } = seatCard(seat, k);
  const row = angle % 180 === 0;
  return fanOf(at, count, fanStep(at, count, angle, row), row);
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

/**
 * The deal: `seats` in dealing order, each with the number of cards it gets, dealt round by round,
 * face down from the talon (drawn at SCENE.pile of a card) to the edge of each seat.
 */
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
          { transform: pose(talon, 0, SCENE.pile), opacity: 1 },
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

/**
 * A card played: it flies from the edge in front of its seat to its felt slot and lands there facing
 * its seat, with its fixed tilt.
 */
export function playFlight(seat: Color, card: CardId, k: number, mode: Mode): FlightSpec {
  const edge = seatEdge(seat, k);
  const slot = seatSlot(seat, k);
  const angle = seatAngle(seat, k);
  const tilt = tiltOf(card);
  if (mode === "reduced") {
    return {
      kind: "play",
      card,
      keyframes: [
        { transform: pose(offsetToward(slot, edge, SLIDE), angle + tilt), opacity: 0 },
        { transform: pose(slot, angle + tilt), opacity: 1 },
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
      { transform: pose(edge, angle, 0.9), opacity: 0 },
      {
        transform: pose(towards(edge, slot, 0.2), angle + tilt * 0.5, 0.95),
        opacity: 1,
        offset: 0.2,
      },
      { transform: pose(slot, angle + tilt, 1), opacity: 1 },
    ],
    delayMs: 0,
    durationMs: MOTION.cardPlay * scaleFor(mode),
    easing: "ease-out",
  };
}

/**
 * The exchange: the card each seat hands over crosses the felt, face down, from its place to its
 * partner's. The two cards of a pair bow to their own left, so they pass on either side of each other.
 */
export function exchangeFlights(k: number, mode: Mode): FlightSpec[] {
  return COLORS.map((seat): FlightSpec => {
    const from = seatSlot(seat, k);
    const to = seatSlot(PARTNER[seat], k);
    // Turned like its seat's card the whole way: the partner's place is the same box (0 and 180,
    // 90 and 270), and a back reads the same either way up.
    const angle = seatAngle(seat, k);
    if (mode === "reduced") {
      return {
        kind: "exchange",
        card: null,
        keyframes: [
          { transform: pose(from, angle), opacity: 0 },
          { transform: pose(towards(from, to, 0.12), angle), opacity: 1, offset: 0.4 },
          { transform: pose(towards(from, to, 0.25), angle), opacity: 0 },
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
    // The left of the way on the screen (y grows downwards): the direction turned a quarter
    // anticlockwise, (dy, -dx).
    const middle: Point = [
      (from[0] + to[0]) / 2 + (dy / distance) * bow,
      (from[1] + to[1]) / 2 + (-dx / distance) * bow,
    ];
    return {
      kind: "exchange",
      card: null,
      keyframes: [
        { transform: pose(from, angle, 0.85), opacity: 0 },
        { transform: pose(towards(from, middle, 0.3), angle, 0.95), opacity: 1, offset: 0.15 },
        { transform: pose(middle, angle, 1), opacity: 1, offset: 0.5 },
        { transform: pose(towards(middle, to, 0.7), angle, 0.95), opacity: 1, offset: 0.85 },
        { transform: pose(to, angle, 0.85), opacity: 0 },
      ],
      delayMs: 0,
      durationMs: MOTION.exchangeCross * scaleFor(mode),
      easing: "ease-in-out",
    };
  });
}

/**
 * A dead hand laid face up in front of its seat, card by card (350 ms each, 60 ms apart): each card
 * leaves the seat's edge facing its seat and lands on its posed place with its tilt.
 */
export function layFlights(
  seat: Color,
  cards: readonly CardId[],
  k: number,
  mode: Mode,
): FlightSpec[] {
  const edge = seatEdge(seat, k);
  const slots = posedSlots(seat, cards.length, k);
  const angle = seatAngle(seat, k);
  const scale = scaleFor(mode);
  return cards.map((card, i): FlightSpec => {
    const to = slots[i] as Point;
    const tilt = tiltOf(card);
    if (mode === "reduced") {
      return {
        kind: "lay",
        card,
        keyframes: [
          { transform: pose(offsetToward(to, edge, SLIDE), angle + tilt), opacity: 0 },
          { transform: pose(to, angle + tilt), opacity: 1 },
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
        { transform: pose(edge, angle, 0.9), opacity: 0 },
        {
          transform: pose(towards(edge, to, 0.25), angle + tilt * 0.5, 0.95),
          opacity: 1,
          offset: 0.2,
        },
        { transform: pose(to, angle + tilt, 1), opacity: 1 },
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
