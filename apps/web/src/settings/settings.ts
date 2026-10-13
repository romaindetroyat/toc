// Persisted player settings (UI-SPEC « Réglages »). Pure: no Svelte, no globals. The storage and
// the system reduced-motion preference are passed in, so everything here runs under Node.
//
// The stored value is untrusted (the user, or another script on the origin, can edit it): every
// field is validated on its own and anything unexpected falls back to its default (T-01-01).

import { COLORS, type Color } from "@toc/engine";

export type Settings = {
  /** Master sound switch. */
  sound: boolean;
  /** Sound effects (hooves, neighs, cards). */
  sfx: boolean;
  /** Looping ambience. */
  ambience: boolean;
  /** Ambience volume, an integer from 0 to 100. */
  ambienceVolume: number;
  reduceMotion: boolean;
  /** Fast-forward the bots. */
  fast: boolean;
  lastColor: Color;
};

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  sound: true,
  sfx: true,
  ambience: true,
  ambienceVolume: 30,
  reduceMotion: false,
  fast: false,
  lastColor: "bleu",
};

export const STORAGE_KEY = "toc.settings.v1";

/** The subset of the Web Storage API used here, so tests can pass a fake. */
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function volume(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function colour(value: unknown, fallback: Color): Color {
  return COLORS.find((color) => color === value) ?? fallback;
}

/**
 * Settings from an untrusted value. A missing (or mistyped) `reduceMotion` takes the system
 * preference, so the preference initialises it and an explicit user choice then wins.
 */
export function parseSettings(raw: unknown, prefersReducedMotion: boolean): Settings {
  const source: Record<string, unknown> =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const own = (key: keyof Settings): unknown =>
    Object.hasOwn(source, key) ? source[key] : undefined;

  return {
    sound: bool(own("sound"), DEFAULT_SETTINGS.sound),
    sfx: bool(own("sfx"), DEFAULT_SETTINGS.sfx),
    ambience: bool(own("ambience"), DEFAULT_SETTINGS.ambience),
    ambienceVolume: volume(own("ambienceVolume"), DEFAULT_SETTINGS.ambienceVolume),
    reduceMotion: bool(own("reduceMotion"), prefersReducedMotion),
    fast: bool(own("fast"), DEFAULT_SETTINGS.fast),
    lastColor: colour(own("lastColor"), DEFAULT_SETTINGS.lastColor),
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
