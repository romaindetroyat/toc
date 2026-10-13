// Debug parameters of the game route, read from the hash query (#/partie?scenario=R-08.2&graine=...).
// They let the end-to-end tests and Romain's review start from any board position. Anyone can type
// them in the address bar, so every value goes through an allow-list and a shape check, and each
// parameter is judged on its own: a bad one is dropped, the others still count (T-01-19).
//
// Release builds parse nothing: `debug` defaults to the compile-time switch. This module imports the
// whole scenario set, so it must only be loaded by a dynamic import inside a `__TOC_DEBUG__` branch
// (see loadDebugParams in session.svelte.ts), never by a static import.

import {
  type CardId,
  COLORS,
  type PawnSpec,
  type Rng,
  ringIndex,
  type Scenario,
} from "@toc/engine";
import { scenarios } from "@toc/engine/scenarios";
import { DEBUG } from "../debug.ts";

export type DebugParams = {
  /** A fixture of the Romain-validated scenario set. */
  scenario?: Scenario;
  /** A position composed by hand, in the shape of a scenario's `before` block. */
  etat?: Scenario["before"];
  /** Seed of the deck and of the bots. */
  graine?: Rng;
  /** No think delay, no animation. */
  vitesse?: "test";
};

/** Longest accepted `etat` value, in characters of the encoded text. */
export const MAX_ETAT_LENGTH = 4096;

const SCENARIO_ID = /^R-\d{2}\.\d{1,2}$/;
const SEED_TEXT = /^[0-9a-fA-F]{32}$/;
const BASE64URL = /^[A-Za-z0-9_-]*$/;
const CARD = /^(1[0-3]|[1-9])[SHDC]$/;
/** Progress of a ring knight in a hand-made position: far beyond any real game, still an integer. */
const MAX_PROGRESS = 1000;

const known = new Map(scenarios.map((s) => [s.id as string, s]));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Own keys of a parsed object, or null when one of them is not in `allowed`. */
function keysWithin(record: Record<string, unknown>, allowed: readonly string[]): string[] | null {
  const keys = Object.keys(record);
  return keys.every((key) => allowed.includes(key)) ? keys : null;
}

function colourOf(value: unknown): (typeof COLORS)[number] | null {
  return COLORS.find((color) => color === value) ?? null;
}

function pawnSpec(value: unknown): PawnSpec | null {
  if (value === "S") return "S";
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (keys.length !== 1) return null;
  if (keys[0] === "p") {
    const p = value.p;
    return typeof p === "number" && Number.isInteger(p) && Math.abs(p) <= MAX_PROGRESS
      ? { p }
      : null;
  }
  if (keys[0] === "h") {
    const h = value.h;
    return h === 0 || h === 1 || h === 2 || h === 3 ? { h } : null;
  }
  return null;
}

function parsePawns(value: unknown): Scenario["before"]["pawns"] | null {
  if (!isRecord(value)) return null;
  if (keysWithin(value, COLORS) === null) return null;
  const pawns: NonNullable<Scenario["before"]["pawns"]> = {};
  const rings = new Set<number>();
  for (const color of COLORS) {
    if (!Object.hasOwn(value, color)) continue;
    const specs = value[color];
    if (!Array.isArray(specs) || specs.length !== 4) return null;
    const parsed = specs.map(pawnSpec);
    const homes = new Set<number>();
    for (const spec of parsed) {
      if (spec === null) return null;
      if (spec !== "S" && "p" in spec) {
        const cell = ringIndex(color, spec.p);
        if (rings.has(cell)) return null; // two knights on one cell
        rings.add(cell);
      } else if (spec !== "S") {
        if (homes.has(spec.h)) return null; // two knights in one home slot
        homes.add(spec.h);
      }
    }
    pawns[color] = parsed as [PawnSpec, PawnSpec, PawnSpec, PawnSpec];
  }
  return pawns;
}

function parseHands(value: unknown): Scenario["before"]["hands"] | null {
  if (!isRecord(value)) return null;
  if (keysWithin(value, COLORS) === null) return null;
  const hands: NonNullable<Scenario["before"]["hands"]> = {};
  const seen = new Set<string>();
  for (const color of COLORS) {
    if (!Object.hasOwn(value, color)) continue;
    const cards = value[color];
    if (!Array.isArray(cards) || cards.length > 5) return null;
    for (const card of cards) {
      if (typeof card !== "string" || !CARD.test(card) || seen.has(card)) return null;
      seen.add(card);
    }
    hands[color] = cards.slice() as CardId[];
  }
  return hands;
}

const BEFORE_KEYS = ["pawns", "hands", "turn", "phase", "dealer", "dealIndex"] as const;

/** A scenario `before` block from untrusted JSON, or null. Builds a new object from known keys only. */
function parseBefore(value: unknown): Scenario["before"] | null {
  if (!isRecord(value) || keysWithin(value, BEFORE_KEYS) === null) return null;
  const turn = colourOf(value.turn);
  if (turn === null) return null;
  const before: Scenario["before"] = { turn };

  if (Object.hasOwn(value, "pawns")) {
    const pawns = parsePawns(value.pawns);
    if (pawns === null) return null;
    before.pawns = pawns;
  }
  if (Object.hasOwn(value, "hands")) {
    const hands = parseHands(value.hands);
    if (hands === null) return null;
    before.hands = hands;
  }
  if (Object.hasOwn(value, "phase")) {
    if (value.phase !== "exchange" && value.phase !== "play" && value.phase !== "won") return null;
    before.phase = value.phase;
  }
  if (Object.hasOwn(value, "dealer")) {
    const dealer = colourOf(value.dealer);
    if (dealer === null) return null;
    before.dealer = dealer;
  }
  if (Object.hasOwn(value, "dealIndex")) {
    const index = value.dealIndex;
    if (index !== 0 && index !== 1 && index !== 2) return null;
    before.dealIndex = index;
  }
  return before;
}

function parseEtat(text: string): Scenario["before"] | null {
  if (text.length === 0 || text.length > MAX_ETAT_LENGTH || !BASE64URL.test(text)) return null;
  try {
    const base64 = text.replaceAll("-", "+").replaceAll("_", "/");
    const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return parseBefore(JSON.parse(json));
  } catch {
    return null;
  }
}

function parseSeed(text: string): Rng | null {
  if (!SEED_TEXT.test(text)) return null;
  const word = (i: number): number => Number.parseInt(text.slice(i * 8, i * 8 + 8), 16);
  return [word(0), word(1), word(2), word(3)];
}

/**
 * The debug parameters of a hash (`#/partie?...`), a query (`?...`) or a bare list. Only accepted
 * values appear in the result. With `debug` off (every release build) the result is empty.
 */
export function parseDebugParams(hash: string, options: { debug?: boolean } = {}): DebugParams {
  if (!(options.debug ?? DEBUG)) return {};
  const query = hash.includes("?") ? hash.slice(hash.indexOf("?") + 1) : hash.replace(/^#/, "");
  const params = new URLSearchParams(query);
  const out: DebugParams = {};

  const id = params.get("scenario");
  if (id !== null && SCENARIO_ID.test(id)) {
    const scenario = known.get(id);
    if (scenario !== undefined) out.scenario = scenario;
  }
  const etat = params.get("etat");
  if (etat !== null) {
    const before = parseEtat(etat);
    if (before !== null) out.etat = before;
  }
  const graine = params.get("graine");
  if (graine !== null) {
    const seed = parseSeed(graine);
    if (seed !== null) out.graine = seed;
  }
  if (params.get("vitesse") === "test") out.vitesse = "test";
  return out;
}
