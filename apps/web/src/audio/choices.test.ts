import { describe, expect, it } from "vitest";
import {
  CHOICES_KEY,
  choicesAsText,
  DEFAULT_CHOICES,
  effectiveChoices,
  loadChoices,
  loadPicks,
  parseChoices,
  type StorageLike,
  saveChoices,
} from "./choices.ts";
import { SOUND_IDS, SOUNDS, type SoundId } from "./sounds.ts";

function memory(
  initial: Record<string, string> = {},
): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (Object.hasOwn(data, key) ? (data[key] as string) : null),
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const NAMES = Object.fromEntries(SOUND_IDS.map((id) => [id, `Nom ${id}`])) as Record<
  SoundId,
  string
>;

describe("DEFAULT_CHOICES", () => {
  it("chooses « a », today's sound, for every sound of the catalogue", () => {
    expect(Object.keys(DEFAULT_CHOICES).sort()).toEqual([...SOUND_IDS].sort());
    for (const id of SOUND_IDS) {
      expect(DEFAULT_CHOICES[id]).toBe("a");
      expect(SOUNDS[id].variants[0]?.key).toBe("a");
    }
  });
});

describe("parseChoices", () => {
  it("keeps a known sound with one of its own version keys", () => {
    expect(parseChoices({ sabot: "b" })).toEqual({ sabot: "b" });
  });

  it("drops unknown ids, unknown keys, and keys the sound does not have", () => {
    expect(
      parseChoices({
        sabot: "z",
        pirate: "a",
        ambiance: "a",
        "carte-pose": "d", // the card has only « a » today
        "carte-donne": "a",
      }),
    ).toEqual({ "carte-donne": "a" });
    expect(parseChoices(JSON.parse('{"__proto__":"b","constructor":"a"}'))).toEqual({});
  });

  it("drops values of the wrong type", () => {
    expect(parseChoices({ sabot: 1, "carte-pose": null, "carte-donne": ["a"] })).toEqual({});
  });

  it("gives nothing for anything that is not a plain object", () => {
    for (const raw of [null, undefined, 3, "sabot", ["a", "b"], true]) {
      expect(parseChoices(raw), String(raw)).toEqual({});
    }
  });
});

describe("effectiveChoices", () => {
  it("overlays the picks on the defaults", () => {
    const choices = effectiveChoices({ sabot: "b" });
    expect(choices.sabot).toBe("b");
    expect(choices["carte-pose"]).toBe("a");
    expect(Object.keys(choices)).toHaveLength(SOUND_IDS.length);
  });
});

describe("storage", () => {
  it("saves the picks and reads them back", () => {
    const storage = memory();
    expect(saveChoices(storage, { sabot: "b" })).toBe(true);
    expect(JSON.parse(storage.data[CHOICES_KEY] ?? "")).toEqual({ sabot: "b" });
    expect(loadPicks(storage)).toEqual({ sabot: "b" });
    expect(loadChoices(storage).sabot).toBe("b");
  });

  it("falls back to the defaults on damaged JSON, a hostile value or a throwing storage", () => {
    expect(loadChoices(memory({ [CHOICES_KEY]: "{oops" }))).toEqual(DEFAULT_CHOICES);
    expect(loadChoices(memory({ [CHOICES_KEY]: JSON.stringify({ sabot: "<b>" }) }))).toEqual(
      DEFAULT_CHOICES,
    );
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(loadChoices(throwing)).toEqual(DEFAULT_CHOICES);
    expect(saveChoices(throwing, { sabot: "b" })).toBe(false);
    expect(loadChoices(null)).toEqual(DEFAULT_CHOICES);
    expect(saveChoices(null, { sabot: "b" })).toBe(false);
  });

  it("ignores the old ratings (toc.soundnotes.v1)", () => {
    const storage = memory({ "toc.soundnotes.v1": JSON.stringify({ "sabot-4": "bon" }) });
    expect(loadChoices(storage)).toEqual(DEFAULT_CHOICES);
  });
});

describe("choicesAsText", () => {
  it("gives one French line per sound, in the page's order, with the version letter", () => {
    const text = choicesAsText(effectiveChoices({ sabot: "b" }), NAMES);
    const lines = text.split("\n");
    expect(lines).toHaveLength(SOUND_IDS.length);
    expect(lines[0]).toBe("Nom sabot : B");
    expect(lines).toContain("Nom carte-pose : A");
    expect(lines.map((line) => line.split(" ")[0])).toEqual(SOUND_IDS.map((id) => NAMES[id]));
  });

  it("lists only the sounds it is given: the page passes the heard ones (only the hooves today)", () => {
    const text = choicesAsText(effectiveChoices({ sabot: "c" }), NAMES, ["sabot"]);
    expect(text).toBe("Nom sabot : C");
  });
});
