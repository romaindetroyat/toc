// What the sound settings mean for the audio engine (UI-SPEC « Réglages », D-25). Pure: no Svelte, no
// globals, so every rule runs under Node.

import type { Mix } from "../audio/engine.ts";
import type { Settings } from "../settings/settings.ts";

/**
 * The arguments of the engine's `setMix` for the given settings. « Son » is the master switch (off
 * silences everything) and « Bruitages » silences the effects; the engine turns them into the two
 * bus gains. There is no ambience (removed by Romain on 2026-10-14).
 */
export function mixFromSettings(settings: Settings): Mix {
  return {
    sound: settings.sound,
    sfx: settings.sfx,
  };
}
