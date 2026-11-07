// The tutorial's progress on this device, toc.tutorial.v1 (05-UI-SPEC « Progress »; T-05-18):
// { offered, done } where `done` lists the lessons whose « Bravo ! » plank has shown. The stored value
// is untrusted (the user or another script on the origin can edit it): it is read field by field,
// `done` keeps only the lesson numbers 1 to 8, once each and sorted, and anything else reads as empty
// progress. Every read and write is in a try/catch: without a usable storage the progress lives in
// memory for this page, and nothing here ever throws. Pure: the storage is passed in, so it runs under
// Node. Plan 05-08 adds the first-launch rule (firstTimeDue) that writes the key on the home.

import { normalizeName } from "@toc/protocol";
import { ME_KEY } from "../account/cache.ts";
import { DEVICE_KEY } from "../net/device.ts";
import { TABLES_KEY } from "../net/tables.ts";

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

/** The first lesson not done, or null once all eight are (« Continuer : leçon {n} », « Leçon {n} sur 8 »). */
export function nextLesson(done: readonly number[]): number | null {
  for (let n = 1; n <= LESSON_COUNT; n++) if (!done.includes(n)) return n;
  return null;
}

/**
 * Whether the device's stored first name, account or tables say it has played. The home always writes
 * a device token, so the device counts only with a first name. A value that cannot be read counts as
 * played (T-05-23: any doubt means the sheet does not show).
 */
function hasPlayed(storage: StorageLike): boolean {
  const device = storage.getItem(DEVICE_KEY);
  if (device) {
    let value: unknown;
    try {
      value = JSON.parse(device);
    } catch {
      return true;
    }
    if (typeof value !== "object" || value === null || Array.isArray(value)) return true;
    const source = value as Record<string, unknown>;
    if (Object.hasOwn(source, "name") && normalizeName(source.name) !== null) return true;
  }
  return Boolean(storage.getItem(ME_KEY)) || Boolean(storage.getItem(TABLES_KEY));
}

/**
 * The first-launch rule of « Première fois ? » (plan 05-08, D-08; 05-UI-SPEC « First-launch sheet »):
 * true on a brand-new device only, and the key is written at once ({ offered: true, done: [] }), so the
 * sheet shows once whatever the answer. A device that has played gets the key silently (offered
 * false) and never sees it. Once the key is there, whatever it holds, never again. A storage that
 * throws, on reading or on writing, never shows it: no nagging on each start. The caller asks only
 * when the sheet can show (the home, no other sheet up), since the answer is final.
 */
export function firstTimeDue(storage: StorageLike | null): boolean {
  if (storage === null) return false;
  try {
    if (storage.getItem(TUTORIAL_KEY) !== null) return false;
    const due = !hasPlayed(storage);
    storage.setItem(TUTORIAL_KEY, JSON.stringify({ offered: due, done: [] }));
    return due;
  } catch {
    return false;
  }
}
