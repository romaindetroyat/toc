// The tutorial's progress on this device, toc.tutorial.v1 (05-UI-SPEC « Progress »; T-05-18):
// { offered, done } where `done` lists the lessons whose « Bravo ! » plank has shown. The stored value
// is untrusted (the user or another script on the origin can edit it): it is read field by field,
// `done` keeps only the lesson numbers 1 to 8, once each and sorted, and anything else reads as empty
// progress. Every read and write is in a try/catch: without a usable storage the progress lives in
// memory for this page, and nothing here ever throws. Pure: the storage is passed in, so it runs under
// Node. (Plan 05-08 adds the first-launch rule that sets `offered`.)

export const TUTORIAL_KEY = "toc.tutorial.v1";

/** How many lessons there are (#/apprendre/1 to #/apprendre/8). */
export const LESSON_COUNT = 8;

export type TutorialProgress = { offered: boolean; done: number[] };

/** The subset of the Web Storage API used here, so tests can pass a fake. */
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

const EMPTY: TutorialProgress = { offered: false, done: [] };

/** The progress kept in memory, per storage, for when the storage cannot be read or written. */
const memory = new WeakMap<object, TutorialProgress>();
const NO_STORAGE = {};

function remembered(storage: StorageLike | null): TutorialProgress | undefined {
  return memory.get(storage ?? NO_STORAGE);
}

function remember(storage: StorageLike | null, progress: TutorialProgress): void {
  memory.set(storage ?? NO_STORAGE, progress);
}

/** Whether `n` is a lesson number. */
export function isLesson(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= LESSON_COUNT;
}

/** The lessons of an untrusted value: the lesson numbers only, once each, in order. */
function lessonsOf(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isLesson))].sort((a, b) => a - b);
}

/** An untrusted value as progress: known fields only, each checked on its own. */
function parse(raw: string | null | undefined): TutorialProgress {
  if (raw === null || raw === undefined) return EMPTY;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return EMPTY;
  const source = value as Record<string, unknown>;
  return {
    offered: Object.hasOwn(source, "offered") && source.offered === true,
    done: Object.hasOwn(source, "done") ? lessonsOf(source.done) : [],
  };
}

/** Two progresses together: offered if either says so, the lessons of both. */
function merge(a: TutorialProgress, b: TutorialProgress | undefined): TutorialProgress {
  if (b === undefined) return a;
  return { offered: a.offered || b.offered, done: lessonsOf([...a.done, ...b.done]) };
}

/** The progress of this device: what the storage holds, and what this page could not store. */
export function readProgress(storage: StorageLike | null): TutorialProgress {
  let raw: string | null = null;
  try {
    raw = storage?.getItem(TUTORIAL_KEY) ?? null;
  } catch {
    raw = null;
  }
  const stored = parse(raw);
  return merge({ offered: stored.offered, done: [...stored.done] }, remembered(storage));
}

function write(storage: StorageLike | null, progress: TutorialProgress): void {
  remember(storage, progress);
  try {
    storage?.setItem(TUTORIAL_KEY, JSON.stringify(progress));
  } catch {
    // Private browsing or a full storage: the progress stays in memory for this page.
  }
}

/** Marks lesson `n` done (its « Bravo ! » plank shows): written once, the others kept. */
export function markDone(storage: StorageLike | null, n: number): TutorialProgress {
  const current = readProgress(storage);
  if (!isLesson(n) || current.done.includes(n)) return current;
  const next = { offered: current.offered, done: lessonsOf([...current.done, n]) };
  write(storage, next);
  return next;
}
