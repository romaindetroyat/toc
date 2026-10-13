// Romain's ratings on the sound test page (D-22). Pure: no Svelte, no globals; the storage is
// passed in, so everything here runs under Node.
//
// The stored value is untrusted (T-01-06): only known keys with known ratings come out of
// parseNotes, JSON.parse and every storage access are in try/catch.

import { SOUND_IDS, type SoundId } from "./sounds.ts";

export const NOTES_KEY = "toc.soundnotes.v1";

export type Rating = "a-ecouter" | "bon" | "a-changer";

export const RATINGS: readonly Rating[] = ["a-ecouter", "bon", "a-changer"];

/** The distances (in cells) the sound test page lists for the hooves. */
export const SABOT_CASES = [1, 4, 7, 13] as const;

/**
 * What a rating is attached to: one per sound, except the hoof sound, which is rated for each
 * listed distance (a walk and a gallop are two listening decisions).
 */
export type NoteKey = Exclude<SoundId, "sabot"> | `sabot-${(typeof SABOT_CASES)[number]}`;

/** Every rated row of the page, in page order. */
export const NOTE_KEYS: readonly NoteKey[] = SOUND_IDS.flatMap((id): NoteKey[] =>
  id === "sabot" ? SABOT_CASES.map((cells) => `sabot-${cells}` as const) : [id],
);

export type Notes = Partial<Record<NoteKey, Rating>>;

/** The subset of the Web Storage API used here, so tests can pass a fake. */
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

function isRating(value: unknown): value is Rating {
  return RATINGS.some((rating) => rating === value);
}

/** Notes from an untrusted value: known keys with known ratings, everything else dropped. */
export function parseNotes(raw: unknown): Notes {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  const source = raw as Record<string, unknown>;
  const notes: Notes = {};
  for (const key of NOTE_KEYS) {
    if (!Object.hasOwn(source, key)) continue;
    const value = source[key];
    if (isRating(value)) notes[key] = value;
  }
  return notes;
}

/** Notes read from storage; empty when it is missing, throws or holds malformed JSON. */
export function loadNotes(storage: StorageLike | null): Notes {
  try {
    const text = storage?.getItem(NOTES_KEY);
    return parseNotes(text ? JSON.parse(text) : undefined);
  } catch {
    return {};
  }
}

/** Writes the notes; false (never an exception) when storage is missing or refuses. */
export function saveNotes(storage: StorageLike | null, notes: Notes): boolean {
  if (!storage) return false;
  try {
    storage.setItem(NOTES_KEY, JSON.stringify(notes));
    return true;
  } catch {
    return false;
  }
}

/**
 * The notes as French plain text, one line « nom : note » per rated row, in page order, with a
 * no-break space before the colon. A sound never rated reads as the default, « À écouter ».
 */
export function notesAsText(
  notes: Notes,
  names: Record<NoteKey, string>,
  ratings: Record<Rating, string>,
): string {
  return NOTE_KEYS.map((key) => `${names[key]}\u00a0: ${ratings[notes[key] ?? "a-ecouter"]}`).join(
    "\n",
  );
}
