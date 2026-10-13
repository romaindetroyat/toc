import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  parseSettings,
  type Settings,
  STORAGE_KEY,
  saveSettings,
} from "./settings.ts";

/** A minimal in-memory Storage; `fail` makes the chosen methods throw like Safari private mode. */
function fakeStorage(
  initial: Record<string, string> = {},
  fail: { get?: boolean; set?: boolean } = {},
) {
  const data = new Map(Object.entries(initial));
  return {
    getItem(key: string): string | null {
      if (fail.get) throw new Error("SecurityError");
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      if (fail.set) throw new Error("QuotaExceededError");
      data.set(key, value);
    },
    data,
  };
}

describe("parseSettings", () => {
  it("round-trips a valid object", () => {
    const valid: Settings = {
      sound: false,
      sfx: true,
      ambience: false,
      ambienceVolume: 80,
      reduceMotion: true,
      fast: true,
      lastColor: "vert",
    };
    expect(parseSettings(JSON.parse(JSON.stringify(valid)), false)).toEqual(valid);
  });

  it("falls back to the defaults for anything that is not an object", () => {
    for (const raw of [null, undefined, 42, "x", true, [], [1, 2]]) {
      expect(parseSettings(raw, false)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it("rounds and clamps the ambience volume to an integer between 0 and 100", () => {
    expect(parseSettings({ ambienceVolume: -5 }, false).ambienceVolume).toBe(0);
    expect(parseSettings({ ambienceVolume: 250 }, false).ambienceVolume).toBe(100);
    expect(parseSettings({ ambienceVolume: 42.7 }, false).ambienceVolume).toBe(43);
    expect(parseSettings({ ambienceVolume: Number.NaN }, false).ambienceVolume).toBe(
      DEFAULT_SETTINGS.ambienceVolume,
    );
    expect(parseSettings({ ambienceVolume: Number.POSITIVE_INFINITY }, false).ambienceVolume).toBe(
      DEFAULT_SETTINGS.ambienceVolume,
    );
    expect(parseSettings({ ambienceVolume: "50" }, false).ambienceVolume).toBe(
      DEFAULT_SETTINGS.ambienceVolume,
    );
  });

  it("turns an unknown colour into bleu and keeps the four real ones", () => {
    for (const bad of ["pourpre", 3, null, "", "__proto__"]) {
      expect(parseSettings({ lastColor: bad }, false).lastColor).toBe("bleu");
    }
    for (const good of ["bleu", "jaune", "rouge", "vert"] as const) {
      expect(parseSettings({ lastColor: good }, false).lastColor).toBe(good);
    }
  });

  it("validates each field on its own: one bad field does not spoil the others", () => {
    const parsed = parseSettings({ sound: "oui", sfx: false, lastColor: "rouge", fast: 1 }, false);
    expect(parsed.sound).toBe(DEFAULT_SETTINGS.sound);
    expect(parsed.sfx).toBe(false);
    expect(parsed.lastColor).toBe("rouge");
    expect(parsed.fast).toBe(DEFAULT_SETTINGS.fast);
  });

  it("takes reduceMotion from the system preference when it is missing, and lets an explicit value win", () => {
    expect(parseSettings({}, true).reduceMotion).toBe(true);
    expect(parseSettings({}, false).reduceMotion).toBe(false);
    expect(parseSettings({ reduceMotion: false }, true).reduceMotion).toBe(false);
    expect(parseSettings({ reduceMotion: true }, false).reduceMotion).toBe(true);
    // A value of the wrong type counts as missing.
    expect(parseSettings({ reduceMotion: "oui" }, true).reduceMotion).toBe(true);
  });

  it("does not let a hostile object leak extra keys into the settings", () => {
    const parsed = parseSettings(
      { lastColor: "jaune", evil: "<script>", __proto__: { x: 1 } },
      false,
    );
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
  });
});

describe("loadSettings", () => {
  it("reads the stored settings", () => {
    const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ lastColor: "jaune" }) });
    expect(loadSettings(storage, false).lastColor).toBe("jaune");
  });

  it("returns the defaults when nothing is stored or storage is null", () => {
    expect(loadSettings(fakeStorage(), false)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null, false)).toEqual(DEFAULT_SETTINGS);
  });

  it("returns the defaults on malformed JSON, without throwing", () => {
    for (const bad of ["{not json", "", "undefined", '{"lastColor":']) {
      const storage = fakeStorage({ [STORAGE_KEY]: bad });
      expect(loadSettings(storage, false)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it("returns the defaults when getItem throws (Safari private mode)", () => {
    expect(loadSettings(fakeStorage({}, { get: true }), false)).toEqual(DEFAULT_SETTINGS);
  });

  it("still applies the system reduced-motion preference when nothing is stored", () => {
    expect(loadSettings(null, true).reduceMotion).toBe(true);
  });
});

describe("saveSettings", () => {
  it("writes JSON under toc.settings.v1 and reports success", () => {
    const storage = fakeStorage();
    expect(STORAGE_KEY).toBe("toc.settings.v1");
    expect(saveSettings(storage, { ...DEFAULT_SETTINGS, lastColor: "rouge" })).toBe(true);
    expect(JSON.parse(storage.data.get(STORAGE_KEY) ?? "null")).toMatchObject({
      lastColor: "rouge",
    });
  });

  it("returns false, without throwing, when setItem throws or storage is null", () => {
    expect(saveSettings(fakeStorage({}, { set: true }), DEFAULT_SETTINGS)).toBe(false);
    expect(saveSettings(null, DEFAULT_SETTINGS)).toBe(false);
  });

  it("survives a save then a load", () => {
    const storage = fakeStorage();
    const chosen: Settings = { ...DEFAULT_SETTINGS, lastColor: "vert", ambienceVolume: 12 };
    saveSettings(storage, chosen);
    expect(loadSettings(storage, false)).toEqual(chosen);
  });
});
