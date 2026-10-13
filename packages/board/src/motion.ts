// The motion table of the UI-SPEC Motion Contract: every duration of a knight on screen, in
// milliseconds, in one place. Pure: no clock, no DOM. The Director takes the timing of each
// event from here (and from hopTimeline for the hops), and the sound cues are placed on the same
// numbers, so picture and sound cannot drift apart. Phase 2 reads eventDuration() to pace bots.

import type { GameEvent } from "@toc/engine";
import { hopTimeline, type Mode } from "./hopTimeline.ts";

/** Normal-speed durations (UI-SPEC Motion Contract). Fast mode multiplies all of them by 0.4. */
export const MOTION = {
  /** One arc bound from the stable slot to the diamond (D-15). */
  exit: 600,
  /** The head turns before a backward 4 (D-10). */
  volteFace: 120,
  /** The attacker rears: up, then down (D-12); rotation in degrees, rise in board units. */
  rearUp: 220,
  rearDown: 280,
  rearAngle: -14,
  rearRise: 14,
  /** The eaten knight flies to its stable on a parabola, then bounces once (D-12). */
  eject: 700,
  /** Height of the parabola as a fraction of the distance flown. */
  ejectPeak: 0.35,
  ejectBounce: 150,
  /** Valet swap: two crossing arcs, two bounds each, at the same time (D-13). */
  swap: 900,
  swapBounds: 2,
  /** Sober home entry (D-14). */
  homeSettle: 150,
  /** The fourth knight home rears and bursts into particles (D-14). */
  partyRear: 500,
  partyBurst: 700,
  partyParticles: 8,
  dealCard: 250,
  dealStagger: 40,
  deadCard: 350,
  deadStagger: 60,
  cardPlay: 300,
  exchangeCross: 300,
  /** Each knight of the winning team hops in place once. */
  winHop: 600,
  banner: 1200,
  /** Squash of the body on landing, as a fraction of its height, and the time to recover. */
  landingSquash: 0.08,
  lastHopSettle: 80,
} as const;

/** Reduced motion (FX-06) replaces the table above: slides and fades only. */
export const REDUCED = {
  move: 180,
  captureFadeOut: 150,
  captureFadeIn: 150,
  swapFade: 150,
  cards: 150,
} as const;

const FAST = 0.4;

/** The factor applied to MOTION in a mode. Reduced motion uses REDUCED instead and does not scale. */
export function scaleFor(mode: Mode): number {
  return mode === "fast" ? FAST : 1;
}

/** Time of the rear-up of an attacker that has just eaten a knight; none when motion is reduced. */
export function rearDuration(mode: Mode): number {
  return mode === "reduced" ? 0 : (MOTION.rearUp + MOTION.rearDown) * scaleFor(mode);
}

/** Time of the ejection of an eaten knight, bounce included; two fades when motion is reduced. */
export function ejectDuration(mode: Mode): number {
  return mode === "reduced"
    ? REDUCED.captureFadeOut + REDUCED.captureFadeIn
    : (MOTION.eject + MOTION.ejectBounce) * scaleFor(mode);
}

/** Time of the party of the fourth knight home: the burst outlasts the rear. */
export function partyDuration(mode: Mode): number {
  return Math.max(MOTION.partyRear, MOTION.partyBurst) * scaleFor(mode);
}

/** A deal flies at most this many cards (5 to each of the four seats): the animation stays bounded. */
export const MAX_DEAL_CARDS = 20;

/**
 * Time of cards that leave one after the other: the last one starts `(count - 1)` staggers after the
 * first. The deal and the dead hand have their own pace; reduced motion has every card fade at once.
 */
export function cardsDuration(count: number, kind: "deal" | "dead", mode: Mode): number {
  if (count <= 0) return 0;
  if (mode === "reduced") return REDUCED.cards;
  const flight = kind === "deal" ? MOTION.dealCard : MOTION.deadCard;
  const stagger = kind === "deal" ? MOTION.dealStagger : MOTION.deadStagger;
  return (flight + (Math.min(count, MAX_DEAL_CARDS) - 1) * stagger) * scaleFor(mode);
}

/** Time of a played card flying to its felt slot; a fade or slide when motion is reduced. */
export function cardPlayDuration(mode: Mode): number {
  return mode === "reduced" ? REDUCED.cards : MOTION.cardPlay * scaleFor(mode);
}

/** Time of the four cards of the exchange crossing the felt; a fade or slide when motion is reduced. */
export function exchangeDuration(mode: Mode): number {
  return mode === "reduced" ? REDUCED.cards : MOTION.exchangeCross * scaleFor(mode);
}

/** Time of the volte-face before a backward 4; none when motion is reduced. */
export function volteFaceDuration(mode: Mode): number {
  return mode === "reduced" ? 0 : MOTION.volteFace * scaleFor(mode);
}

/** The moment, from the start of the hops, when the attacker lands on the cell it passes (the 7's captures). */
export function captureBeat(n: number, atStep: number, mode: Mode = "normal"): number {
  const { landings } = hopTimeline(n, mode);
  return landings[Math.min(atStep, landings.length - 1)] as number;
}

/**
 * What an event adds to the time a play takes on screen, in milliseconds. A capture needs the length
 * of the path of the move it belongs to: on the final cell it is the rear then the ejection, in the
 * middle of a 7 it only adds what outlasts the move. Without `pathLength` it is taken as a final-cell one.
 * Events that show no knight (a turn, the knight sent home, which belongs to its capture) take no time.
 */
export function eventDuration(
  event: GameEvent,
  mode: Mode = "normal",
  context: { pathLength?: number } = {},
): number {
  const scale = scaleFor(mode);
  const reduced = mode === "reduced";
  switch (event.t) {
    case "pawnExited":
      return reduced ? REDUCED.move : MOTION.exit * scale;
    case "pawnMoved":
      return (
        (event.dir === -1 ? volteFaceDuration(mode) : 0) +
        hopTimeline(event.path.length, mode).total
      );
    case "pawnEnteredHome": {
      const total = hopTimeline(event.path.length, mode).total;
      if (reduced) return total;
      return total + (event.homeCount === 4 ? partyDuration(mode) : MOTION.homeSettle * scale);
    }
    case "pawnCaptured": {
      const n = context.pathLength;
      if (n === undefined || event.atStep >= n - 1 || reduced) {
        return rearDuration(mode) + ejectDuration(mode);
      }
      const { total } = hopTimeline(n, mode);
      return Math.max(0, captureBeat(n, event.atStep, mode) + ejectDuration(mode) - total);
    }
    case "pawnsSwapped":
      return reduced ? REDUCED.swapFade : MOTION.swap * scale;
    case "gameWon":
      return reduced ? 0 : MOTION.winHop * scale;
    // The cards: a deal is its `dealt` event (the hands that follow it fly with it).
    case "dealt":
      return cardsDuration(event.size * 4, "deal", mode);
    case "cardPlayed":
      return cardPlayDuration(mode);
    case "cardsExchanged":
      return exchangeDuration(mode);
    case "handDiscarded":
      return cardsDuration(event.cards.length, "dead", mode);
    default:
      return 0;
  }
}

/** The on-screen duration of a whole play: the sum of its events, each capture knowing its move. */
export function eventsDuration(events: readonly GameEvent[], mode: Mode = "normal"): number {
  let pathLength: number | undefined;
  let total = 0;
  for (const event of events) {
    if (event.t === "pawnMoved" || event.t === "pawnEnteredHome") pathLength = event.path.length;
    else if (event.t === "pawnExited") pathLength = 1;
    total += eventDuration(event, mode, pathLength === undefined ? {} : { pathLength });
  }
  return total;
}
