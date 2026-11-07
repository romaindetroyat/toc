import { describe, expect, it } from "vitest";
import { markDone, readProgress, TUTORIAL_KEY } from "./lessonProgress.ts";

// toc.tutorial.v1 (05-UI-SPEC « Progress », T-05-18): untrusted, read field by field, written once per
// lesson, and never an exception, whatever the storage does.

/** An in-memory storage that counts its writes. */
function memoryStorage(initial?: string) {
  const items = new Map<string, string>();
  if (initial !== undefined) items.set(TUTORIAL_KEY, initial);
  let writes = 0;
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes++;
      items.set(key, value);
    },
    raw: () => items.get(TUTORIAL_KEY),
    writes: () => writes,
  };
}

/** A storage that throws on every call (private browsing, a blocked origin). */
function throwingStorage() {
  return {
    getItem: (): string | null => {
      throw new Error("blocked");
    },
    setItem: (): void => {
      throw new Error("blocked");
    },
  };
}

describe("toc.tutorial.v1", () => {
  it("is the key of the tutorial's progress", () => {
    expect(TUTORIAL_KEY).toBe("toc.tutorial.v1");
  });

  it("reads a missing key as empty progress", () => {
    expect(readProgress(memoryStorage())).toEqual({ offered: false, done: [] });
  });

  it("reads broken JSON and hostile values as empty progress", () => {
    for (const raw of ["{", "null", "42", '"x"', "[]", '{"done":"x"}', '{"offered":"yes"}']) {
      expect(readProgress(memoryStorage(raw)), raw).toEqual({ offered: false, done: [] });
    }
  });

  it("keeps the valid part of done: integers 1 to 8, once each, sorted", () => {
    expect(readProgress(memoryStorage('{"offered":true,"done":[9,2]}'))).toEqual({
      offered: true,
      done: [2],
    });
    expect(
      readProgress(memoryStorage('{"done":[5,"3",1,5,0,-1,2.5,8,null,{"n":4},1e9]}')).done,
    ).toEqual([1, 5, 8]);
  });

  it("marks a lesson done once and keeps the others", () => {
    const storage = memoryStorage('{"offered":true,"done":[3]}');
    expect(markDone(storage, 1)).toEqual({ offered: true, done: [1, 3] });
    expect(JSON.parse(storage.raw() ?? "null")).toEqual({ offered: true, done: [1, 3] });
    expect(storage.writes()).toBe(1);
    // Done already: nothing is written again.
    expect(markDone(storage, 3)).toEqual({ offered: true, done: [1, 3] });
    expect(storage.writes()).toBe(1);
    expect(readProgress(storage)).toEqual({ offered: true, done: [1, 3] });
  });

  it("refuses a lesson number out of 1 to 8", () => {
    const storage = memoryStorage();
    expect(markDone(storage, 9)).toEqual({ offered: false, done: [] });
    expect(markDone(storage, 0)).toEqual({ offered: false, done: [] });
    expect(storage.writes()).toBe(0);
  });

  it("replaces a hostile value when it marks a lesson", () => {
    const storage = memoryStorage('{"done":"x","extra":"<b>"}');
    expect(markDone(storage, 2)).toEqual({ offered: false, done: [2] });
    expect(JSON.parse(storage.raw() ?? "null")).toEqual({ offered: false, done: [2] });
  });

  it("keeps the progress in memory when the storage throws, never an exception", () => {
    const storage = throwingStorage();
    expect(readProgress(storage)).toEqual({ offered: false, done: [] });
    expect(() => markDone(storage, 4)).not.toThrow();
    expect(readProgress(storage).done).toEqual([4]);
    markDone(storage, 2);
    expect(readProgress(storage).done).toEqual([2, 4]);
  });

  it("keeps the progress in memory without any storage", () => {
    markDone(null, 6);
    expect(readProgress(null).done).toEqual([6]);
  });
});
