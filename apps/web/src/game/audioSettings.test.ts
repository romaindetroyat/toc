import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "../settings/settings.ts";
import { mixFromSettings, shouldPlayAmbience } from "./audioSettings.ts";

const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch });

describe("mixFromSettings", () => {
  it("the defaults: everything on, ambience at 30", () => {
    expect(mixFromSettings(settings())).toEqual({
      sound: true,
      sfx: true,
      ambience: true,
      ambienceVolume: 30,
    });
  });

  it("« Son » off silences everything: the master switch goes off, the others are kept", () => {
    expect(mixFromSettings(settings({ sound: false }))).toEqual({
      sound: false,
      sfx: true,
      ambience: true,
      ambienceVolume: 30,
    });
  });

  it("« Bruitages » off touches the effects only", () => {
    const mix = mixFromSettings(settings({ sfx: false }));
    expect(mix.sfx).toBe(false);
    expect(mix.sound).toBe(true);
    expect(mix.ambience).toBe(true);
  });

  it("« Ambiance » off or its volume touch the ambience only", () => {
    const off = mixFromSettings(settings({ ambience: false }));
    expect(off.ambience).toBe(false);
    expect(off.sound).toBe(true);
    expect(off.sfx).toBe(true);
    const loud = mixFromSettings(settings({ ambienceVolume: 80 }));
    expect(loud.ambienceVolume).toBe(80);
    expect(loud.sound && loud.sfx && loud.ambience).toBe(true);
  });

  it("covers every combination of the three switches", () => {
    for (const sound of [true, false]) {
      for (const sfx of [true, false]) {
        for (const ambience of [true, false]) {
          for (const ambienceVolume of [0, 30, 100]) {
            expect(mixFromSettings(settings({ sound, sfx, ambience, ambienceVolume }))).toEqual({
              sound,
              sfx,
              ambience,
              ambienceVolume,
            });
          }
        }
      }
    }
  });

  it("the other settings (motion, fast, colour) do not reach the mix", () => {
    const mix = mixFromSettings(settings({ reduceMotion: true, fast: true, lastColor: "vert" }));
    expect(Object.keys(mix).sort()).toEqual(["ambience", "ambienceVolume", "sfx", "sound"]);
  });
});

describe("shouldPlayAmbience", () => {
  it("is true only when sound and ambience are on, the page is visible and audio is ready", () => {
    expect(shouldPlayAmbience(settings(), true, true)).toBe(true);
  });

  it("is false when « Son » is off", () => {
    expect(shouldPlayAmbience(settings({ sound: false }), true, true)).toBe(false);
  });

  it("is false when « Ambiance » is off", () => {
    expect(shouldPlayAmbience(settings({ ambience: false }), true, true)).toBe(false);
  });

  it("is false while the page is hidden", () => {
    expect(shouldPlayAmbience(settings(), false, true)).toBe(false);
  });

  it("is false while audio is not ready", () => {
    expect(shouldPlayAmbience(settings(), true, false)).toBe(false);
  });

  it("« Bruitages » and the volume do not decide it (volume 0 is a quiet ambience, not an off one)", () => {
    expect(shouldPlayAmbience(settings({ sfx: false }), true, true)).toBe(true);
    expect(shouldPlayAmbience(settings({ ambienceVolume: 0 }), true, true)).toBe(true);
  });
});
