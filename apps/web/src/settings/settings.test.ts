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
      reduceMotion: true,
      fast: true,
      tableFast: true,
      lastColor: "vert",
      botLevels: { partner: 5, left: 1, right: 4 },
    };
    expect(parseSettings(JSON.parse(JSON.stringify(valid)), false)).toEqual(valid);
  });

  it("falls back to the defaults for anything that is not an object", () => {
    for (const raw of [null, undefined, 42, "x", true, [], [1, 2]]) {
      expect(parseSettings(raw, false)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it("has no ambience settings any more (removed on 2026-10-14)", () => {
    expect(Object.keys(DEFAULT_SETTINGS)).not.toContain("ambience");
    expect(Object.keys(DEFAULT_SETTINGS)).not.toContain("ambienceVolume");
  });

  it("accepts an object stored before the ambience was removed and ignores its ambience keys", () => {
    const old = {
      sound: false,
      sfx: false,
      ambience: false,
      ambienceVolume: 80,
      reduceMotion: true,
      fast: true,
      lastColor: "jaune",
    };
    const parsed = parseSettings(JSON.parse(JSON.stringify(old)), false);
    expect(parsed).toEqual({
      sound: false,
      sfx: false,
      reduceMotion: true,
      fast: true,
      lastColor: "jaune",
      botLevels: { partner: 3, left: 3, right: 3 },
    });
    expect(Object.hasOwn(parsed, "ambience")).toBe(false);
    expect(Object.hasOwn(parsed, "ambienceVolume")).toBe(false);
    // The ambience keys, whatever their value, change nothing else.
    for (const ambience of [true, false, "oui", null]) {
      for (const ambienceVolume of [0, 30, 100, -5, "50", Number.NaN]) {
        expect(parseSettings({ ambience, ambienceVolume }, false)).toEqual(DEFAULT_SETTINGS);
      }
    }
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

describe("parseSettings: the computer's strength per role (D-03)", () => {
  it("gives Galopeur (3) to every seat when nothing is stored", () => {
    expect(DEFAULT_SETTINGS.botLevels).toEqual({ partner: 3, left: 3, right: 3 });
    expect(parseSettings({}, false).botLevels).toEqual({ partner: 3, left: 3, right: 3 });
  });

  it("keeps the five levels and falls back to 3 for each bad seat on its own", () => {
    expect(
      parseSettings({ botLevels: { partner: 5, left: "2", right: 99 } }, false).botLevels,
    ).toEqual({ partner: 5, left: 3, right: 3 });
    for (const bad of [0, 6, 2.5, "3", null, true, [], {}, Number.NaN]) {
      expect(
        parseSettings({ botLevels: { partner: bad, left: 1, right: 2 } }, false).botLevels,
      ).toEqual({ partner: 3, left: 1, right: 2 });
    }
    for (const level of [1, 2, 3, 4, 5]) {
      expect(
        parseSettings({ botLevels: { partner: 1, left: 1, right: level } }, false).botLevels.right,
      ).toBe(level);
    }
  });

  it("gives 3 to every seat when botLevels is not an object", () => {
    for (const bad of ["x", [], null, 4, [5, 5, 5]]) {
      expect(parseSettings({ botLevels: bad }, false).botLevels).toEqual({
        partner: 3,
        left: 3,
        right: 3,
      });
    }
  });

  it("keeps only the three roles, and reads no inherited key", () => {
    const parsed = parseSettings(
      { botLevels: { partner: 2, left: 4, right: 5, evil: 1, __proto__: { partner: 1 } } },
      false,
    );
    expect(parsed.botLevels).toEqual({ partner: 2, left: 4, right: 5 });
    expect(Object.keys(parsed.botLevels).sort()).toEqual(["left", "partner", "right"]);
    const inherited = parseSettings({ botLevels: Object.create({ partner: 5 }) }, false);
    expect(inherited.botLevels.partner).toBe(3);
  });

  it("loads an object stored in phase 1 (no botLevels, the old ambience keys)", () => {
    const old = { sound: true, sfx: true, ambience: true, ambienceVolume: 30, lastColor: "rouge" };
    const parsed = parseSettings(JSON.parse(JSON.stringify(old)), false);
    expect(parsed.lastColor).toBe("rouge");
    expect(parsed.botLevels).toEqual({ partner: 3, left: 3, right: 3 });
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
    const chosen: Settings = {
      ...DEFAULT_SETTINGS,
      lastColor: "vert",
      sfx: false,
      botLevels: { partner: 2, left: 5, right: 1 },
    };
    saveSettings(storage, chosen);
    expect(loadSettings(storage, false)).toEqual(chosen);
  });

  it("drops the old ambience keys at the next save once an old value has been loaded", () => {
    const storage = fakeStorage({
      [STORAGE_KEY]: JSON.stringify({ sound: true, ambience: true, ambienceVolume: 30 }),
    });
    const loaded = loadSettings(storage, false);
    expect(loaded).toEqual(DEFAULT_SETTINGS);
    saveSettings(storage, loaded);
    const stored = JSON.parse(storage.data.get(STORAGE_KEY) ?? "null") as Record<string, unknown>;
    expect(Object.keys(stored).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
  });
});

describe("parseSettings: the creator's last table-wide « Avance rapide » (plan 02-10b)", () => {
  it("is off by default and on a stored object without it", () => {
    expect(DEFAULT_SETTINGS.tableFast).toBe(false);
    expect(parseSettings({ fast: true }, false).tableFast).toBe(false);
  });

  it("keeps a boolean and refuses anything else", () => {
    expect(parseSettings({ tableFast: true }, false).tableFast).toBe(true);
    for (const tableFast of ["true", 1, null, {}]) {
      expect(parseSettings({ tableFast }, false).tableFast).toBe(false);
    }
  });
});
