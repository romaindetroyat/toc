import { describe, expect, it } from "vitest";
import {
  loadNotes,
  NOTE_KEYS,
  NOTES_KEY,
  type NoteKey,
  notesAsText,
  parseNotes,
  saveNotes,
} from "./soundNotes.ts";

const NBSP = "\u00a0";

describe("parseNotes", () => {
  it("keeps known keys with known ratings", () => {
    expect(
      parseNotes({
        "hennissement-sortie": "bon",
        "sabot-13": "a-changer",
        "carte-echange": "a-ecouter",
      }),
    ).toEqual({
      "hennissement-sortie": "bon",
      "sabot-13": "a-changer",
      "carte-echange": "a-ecouter",
    });
  });

  it("drops unknown keys and unknown rating values", () => {
    const notes = parseNotes({
      "hennissement-sortie": "excellent",
      "carte-pose": 3,
      "carte-donne": null,
      "son-inconnu": "bon",
      ambiance: "bon", // the ambience was removed on 2026-10-14: an old rating of it is dropped
      sabot: "bon", // the hoof sound is rated per distance, never as a whole
      "carte-echange": "bon",
    });
    expect(notes).toEqual({ "carte-echange": "bon" });
  });

  it("ignores hostile keys and inherited properties", () => {
    const hostile = JSON.parse('{"__proto__": {"carte-pose": "bon"}, "constructor": "bon"}');
    expect(parseNotes(hostile)).toEqual({});
    expect(Object.getPrototypeOf(parseNotes(hostile))).toBe(Object.prototype);
  });

  it("gives empty notes for anything that is not an object", () => {
    for (const raw of [null, undefined, 42, "bon", true, [], ["bon"]]) {
      expect(parseNotes(raw)).toEqual({});
    }
  });
});

describe("loadNotes and saveNotes", () => {
  it("round-trips through a storage", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
    expect(NOTES_KEY).toBe("toc.soundnotes.v1");
    expect(saveNotes(storage, { "carte-pose": "bon" })).toBe(true);
    expect(loadNotes(storage)).toEqual({ "carte-pose": "bon" });
  });

  it("gives empty notes for malformed JSON, a missing storage and a throwing storage", () => {
    expect(loadNotes({ getItem: () => "{pas du json", setItem: () => {} })).toEqual({});
    expect(loadNotes(null)).toEqual({});
    const throwing = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadNotes(throwing)).toEqual({});
    expect(saveNotes(throwing, { "carte-pose": "bon" })).toBe(false);
    expect(saveNotes(null, { "carte-pose": "bon" })).toBe(false);
  });

  it("filters what a hand-edited storage holds", () => {
    const storage = {
      getItem: () =>
        JSON.stringify({ "carte-donne": "bon", ambiance: "bon", pirate: "bon", "carte-pose": "?" }),
      setItem: () => {},
    };
    expect(loadNotes(storage)).toEqual({ "carte-donne": "bon" });
  });
});

describe("NOTE_KEYS", () => {
  it("has one key per row: the hoof sound split by distance, every other sound once", () => {
    expect(NOTE_KEYS).toHaveLength(13);
    expect(NOTE_KEYS).toContain("sabot-1");
    expect(NOTE_KEYS).toContain("sabot-13");
    expect(NOTE_KEYS).not.toContain("sabot");
    // The ambience row went with the ambience (2026-10-14).
    expect(NOTE_KEYS as readonly string[]).not.toContain("ambiance");
    expect(new Set(NOTE_KEYS).size).toBe(NOTE_KEYS.length);
  });
});

describe("notesAsText", () => {
  const names = Object.fromEntries(NOTE_KEYS.map((key) => [key, `Nom ${key}`])) as Record<
    NoteKey,
    string
  >;
  names["hennissement-sortie"] = "Sortie de l’écurie";
  names["sabot-4"] = "Sabots, 4 cases";
  const ratings = { "a-ecouter": "À écouter", bon: "Bon", "a-changer": "À changer" } as const;

  it("writes one « nom : note » line per sound, with a no-break space before the colon", () => {
    const text = notesAsText(
      { "hennissement-sortie": "bon", "sabot-4": "a-changer" },
      names,
      ratings,
    );
    const lines = text.split("\n");
    expect(lines).toHaveLength(NOTE_KEYS.length);
    expect(lines).toContain(`Sortie de l’écurie${NBSP}: Bon`);
    expect(lines).toContain(`Sabots, 4 cases${NBSP}: À changer`);
  });

  it("rates a sound that was never touched « À écouter »", () => {
    const text = notesAsText({}, names, ratings);
    expect(text.split("\n")).toContain(`Nom carte-echange${NBSP}: À écouter`);
  });

  it("follows the order of the page and ends without a trailing newline", () => {
    const text = notesAsText({}, names, ratings);
    expect(text.split("\n").map((line) => line.split(`${NBSP}:`)[0])).toEqual(
      NOTE_KEYS.map((key) => names[key]),
    );
    expect(text.endsWith("\n")).toBe(false);
  });
});
