import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Settings } from "../settings/settings.ts";
import * as audioSettings from "./audioSettings.ts";
import { mixFromSettings } from "./audioSettings.ts";

const settings = (patch: Partial<Settings> = {}): Settings => ({ ...DEFAULT_SETTINGS, ...patch });

describe("mixFromSettings", () => {
  it("the defaults: sound and effects on", () => {
    expect(mixFromSettings(settings())).toEqual({ sound: true, sfx: true });
  });

  it("« Son » off silences everything: the master switch goes off, the effects switch is kept", () => {
    expect(mixFromSettings(settings({ sound: false }))).toEqual({ sound: false, sfx: true });
  });

  it("« Bruitages » off touches the effects only", () => {
    const mix = mixFromSettings(settings({ sfx: false }));
    expect(mix.sfx).toBe(false);
    expect(mix.sound).toBe(true);
  });

  it("covers every combination of the two switches", () => {
    for (const sound of [true, false]) {
      for (const sfx of [true, false]) {
        expect(mixFromSettings(settings({ sound, sfx }))).toEqual({ sound, sfx });
      }
    }
  });

  it("the other settings (motion, fast, colour) do not reach the mix, and there is no ambience in it", () => {
    const mix = mixFromSettings(settings({ reduceMotion: true, fast: true, lastColor: "vert" }));
    expect(Object.keys(mix).sort()).toEqual(["sfx", "sound"]);
  });
});

describe("no ambience (removed on 2026-10-14)", () => {
  it("has no rule that would start an ambience loop", () => {
    expect(Object.keys(audioSettings)).toEqual(["mixFromSettings"]);
  });
});
