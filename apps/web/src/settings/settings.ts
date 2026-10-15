// Persisted player settings (UI-SPEC « Réglages »). Pure: no Svelte, no globals. The storage and
// the system reduced-motion preference are passed in, so everything here runs under Node.
//
// The stored value is untrusted (the user, or another script on the origin, can edit it): every
// field is validated on its own and anything unexpected falls back to its default (T-01-01).

import { type BotLevel, DEFAULT_BOT_LEVEL, parseBotLevel } from "@toc/bots";
import { COLORS, type Color } from "@toc/engine";

/**
 * The computer's strength per role, not per colour (03-UI-SPEC « Persistence »): « mon partenaire est
 * Champion » survives a change of colour. left is the next seat clockwise, right the previous one.
 */
export type BotLevels = { partner: BotLevel; left: BotLevel; right: BotLevel };

export type Settings = {
  /** Master sound switch. */
  sound: boolean;
  /** Sound effects (hooves, neighs, cards). */
  sfx: boolean;
  reduceMotion: boolean;
  /** Fast-forward the bots. */
  fast: boolean;
  lastColor: Color;
  /** The strength of each computer seat, remembered per role (D-03). */
  botLevels: BotLevels;
};

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  sound: true,
  sfx: true,
  reduceMotion: false,
  fast: false,
  lastColor: "bleu",
  botLevels: { partner: DEFAULT_BOT_LEVEL, left: DEFAULT_BOT_LEVEL, right: DEFAULT_BOT_LEVEL },
};

export const STORAGE_KEY = "toc.settings.v1";

/** The subset of the Web Storage API used here, so tests can pass a fake. */
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function colour(value: unknown, fallback: Color): Color {
  return COLORS.find((color) => color === value) ?? fallback;
}

/** An own property of an untrusted value, if it is a plain object (not an array). */
function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/** Each role on its own: a missing, mistyped or out-of-range level is Galopeur (3), silently. */
function levels(value: unknown): BotLevels {
  const source = record(value);
  const level = (role: keyof BotLevels): BotLevel =>
    (Object.hasOwn(source, role) ? parseBotLevel(source[role]) : null) ?? DEFAULT_BOT_LEVEL;
  return { partner: level("partner"), left: level("left"), right: level("right") };
}

/**
 * Settings from an untrusted value. A missing (or mistyped) `reduceMotion` takes the system
 * preference, so the preference initialises it and an explicit user choice then wins. Keys that are
 * no longer settings (`ambience` and `ambienceVolume`, from before the ambience was removed on
 * 2026-10-14) are ignored, and the next save drops them.
 */
export function parseSettings(raw: unknown, prefersReducedMotion: boolean): Settings {
  const source = record(raw);
  const own = (key: keyof Settings): unknown =>
    Object.hasOwn(source, key) ? source[key] : undefined;

  return {
    sound: bool(own("sound"), DEFAULT_SETTINGS.sound),
    sfx: bool(own("sfx"), DEFAULT_SETTINGS.sfx),
    reduceMotion: bool(own("reduceMotion"), prefersReducedMotion),
    fast: bool(own("fast"), DEFAULT_SETTINGS.fast),
    lastColor: colour(own("lastColor"), DEFAULT_SETTINGS.lastColor),
    botLevels: levels(own("botLevels")),
  };
}

/** Settings read from storage; defaults when it is missing, throws or holds malformed JSON. */
export function loadSettings(storage: StorageLike | null, prefersReducedMotion: boolean): Settings {
  let raw: unknown;
  try {
    const text = storage?.getItem(STORAGE_KEY);
    raw = text ? JSON.parse(text) : undefined;
  } catch {
    raw = undefined;
  }
  return parseSettings(raw, prefersReducedMotion);
}

/** Writes the settings; false (never an exception) when storage is missing or refuses. */
export function saveSettings(storage: StorageLike | null, settings: Settings): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
