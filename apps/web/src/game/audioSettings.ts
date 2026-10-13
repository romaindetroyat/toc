// What the sound settings mean for the audio engine (UI-SPEC « Réglages », D-25). Pure: no Svelte, no
// globals, so every rule runs under Node.

import type { Mix } from "../audio/engine.ts";
import type { Settings } from "../settings/settings.ts";

/**
 * The arguments of the engine's `setMix` for the given settings. « Son » is the master switch (off
 * silences everything), « Bruitages » silences the effects only, « Ambiance » and its volume
 * concern the ambience only; the engine turns them into the three bus gains.
 */
export function mixFromSettings(settings: Settings): Mix {
  return {
    sound: settings.sound,
    sfx: settings.sfx,
    ambience: settings.ambience,
    ambienceVolume: settings.ambienceVolume,
  };
}

/**
 * Whether the ambience loop should be running: « Son » and « Ambiance » on, the page visible (it
 * pauses with the tab, D-25) and the audio ready. A volume of 0 is a quiet ambience, not an off one.
 */
export function shouldPlayAmbience(
  settings: Settings,
  pageVisible: boolean,
  audioReady: boolean,
): boolean {
  return settings.sound && settings.ambience && pageVisible && audioReady;
}
