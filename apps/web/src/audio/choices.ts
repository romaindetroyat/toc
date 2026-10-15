// Which version of each sound the game plays (recette 3 de Romain, 2026-10-15, « Page d'essai à
// choix »). Pure: no Svelte, no globals; the storage is passed in, so everything here runs under Node.
//
// A pick made on #/sons is kept on this device under CHOICES_KEY and heard at once in the game on
// this device. The stored value is untrusted (T-01-79): only known sound ids with a version key that
// exists for that sound come out of parseChoices; JSON.parse and every storage access are in
// try/catch. The ratings of 01-09 (« toc.soundnotes.v1 ») are gone: that key is never read.

import { SOUND_IDS, SOUNDS, type SoundDef, type SoundId, type VariantKey } from "./sounds.ts";

export const CHOICES_KEY = "toc.soundchoices.v1";

export type Choices = Record<SoundId, VariantKey>;
/** What this device picked: only the sounds Romain chose on the page. */
export type Picks = Partial<Choices>;

/**
 * The version everyone hears when nothing was picked on the device: today's sounds (« a ») until
 * Romain sends his choices with « Copier mes choix ». His list is copied here, sound by sound, to
 * become everyone's choice.
 */
export const DEFAULT_CHOICES: Readonly<Choices> = Object.freeze({
  sabot: "a",
  "hennissement-sortie": "a",
  "hennissement-ruade": "a",
  "hennissement-plainte": "a",
  "hennissement-joyeux": "a",
  "hennissement-fete": "a",
  "hennissement-surpris": "a",
  "carte-donne": "a",
  "carte-pose": "a",
  "carte-echange": "a",
});

/** The subset of the Web Storage API used here, so tests can pass a fake. */
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Picks from an untrusted value: known sounds with one of their own version keys, nothing else. */
export function parseChoices(raw: unknown, catalogue: Record<SoundId, SoundDef> = SOUNDS): Picks {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const picks: Picks = {};
  for (const id of SOUND_IDS) {
    if (!Object.hasOwn(source, id)) continue;
    const value = source[id];
    const known = catalogue[id].variants.find((variant) => variant.key === value);
    if (known) picks[id] = known.key;
  }
  return picks;
}

/** The defaults, overlaid with the picks: one version for every sound. */
export function effectiveChoices(
  picks: Picks,
  defaults: Readonly<Choices> = DEFAULT_CHOICES,
): Choices {
  return { ...defaults, ...picks };
}

/** The picks read from storage; empty when it is missing, throws or holds malformed JSON. */
export function loadPicks(storage: StorageLike | null): Picks {
  try {
    const text = storage?.getItem(CHOICES_KEY);
    return parseChoices(text ? JSON.parse(text) : undefined);
  } catch {
    return {};
  }
}

/** The versions this device plays: DEFAULT_CHOICES overlaid with the stored picks. */
export function loadChoices(storage: StorageLike | null): Choices {
  return effectiveChoices(loadPicks(storage));
}

/** Writes the picks; false (never an exception) when storage is missing or refuses. */
export function saveChoices(storage: StorageLike | null, picks: Picks): boolean {
  if (!storage) return false;
  try {
    storage.setItem(CHOICES_KEY, JSON.stringify(parseChoices(picks)));
    return true;
  } catch {
    return false;
  }
}

/**
 * The choices as French plain text, one line « Sabots : B » per sound in the page's order, with a
 * no-break space before the colon: what Romain sends to make his choices everyone's.
 */
export function choicesAsText(choices: Choices, names: Record<SoundId, string>): string {
  return SOUND_IDS.map((id) => `${names[id]} : ${choices[id].toUpperCase()}`).join("\n");
}
