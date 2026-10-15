// The iPhone's ringer switch, and the silent sound that keeps the game audible through it.
//
// Romain, recette 3 du 2026-10-15 : « Les sons ne fonctionnent pas sur iphone en mode silencieux
// (pas volume au minimum, mais silencieux, pas de sonnerie) ». On iOS, Web Audio alone plays in the
// « ambient » audio category, which the ringer switch mutes. Two measures, both inside the first
// gesture (engine.ts, unlock()):
// - navigator.audioSession.type = "playback" before the AudioContext exists (Safari 16.4+ when the
//   API is there; setting it after the context was created came too late on his phone);
// - on an iPhone or iPad, a hidden <audio> element looping a silent WAV. HTML media puts the page in
//   the « playback » category, which the ringer switch does not mute, and the Web Audio sounds of
//   the game come through with it.
// The cost, like any app that sounds in silent mode: another app's music stops while the game is on
// screen. Romain accepted it the same day: « Oui, ça me va ». The element is paused when the page is
// hidden and while « Son » is off (battery, lock-screen « À l’écoute »), and only a gesture on a
// visible page starts it again. Its sound is generated here: no file, no network request.

/** A WAV file of silence (mono, 16-bit PCM, every sample 0), as a base64 data URI. */
export function silentWavDataUri(seconds = 0.5, sampleRate = 8000): string {
  const samples = Math.max(1, Math.round(seconds * sampleRate));
  const dataBytes = samples * 2;
  const bytes = new Uint8Array(44 + dataBytes); // the samples stay at 0
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, dataBytes, true);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export type NavigatorLike = { userAgent: string; platform?: string; maxTouchPoints?: number };

/**
 * An iPhone, iPad or iPod: its user agent says so, or it is an iPad on iPadOS, which reports itself
 * as a Mac (platform « MacIntel ») but has a touch screen.
 */
export function isAppleTouch(nav: NavigatorLike): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return true;
  return nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1;
}

export type KeepAlive = {
  /** Plays the silent loop; a refused play() (no gesture) is ignored. */
  start(): void;
  pause(): void;
  playing(): boolean;
};

type AudioLike = {
  src: string;
  loop: boolean;
  preload: string;
  controls: boolean;
  disableRemotePlayback: boolean;
  paused: boolean;
  setAttribute(name: string, value: string): void;
  play(): Promise<void> | undefined;
  pause(): void;
};

/** The few parts of the document the keep-alive uses (a fake one in the unit tests). */
export type KeepAliveDocument = {
  createElement(tag: "audio"): AudioLike;
  querySelector(selector: string): AudioLike | null;
  body: { append(element: AudioLike): void };
};

const SELECTOR = "audio[data-audio-keepalive]";

/** The hidden silent element of the page, created once and appended to body. */
export function createKeepAlive(doc: KeepAliveDocument): KeepAlive {
  let element = doc.querySelector(SELECTOR);
  if (!element) {
    const made = doc.createElement("audio");
    made.src = silentWavDataUri();
    made.loop = true;
    made.preload = "auto";
    made.controls = false;
    made.disableRemotePlayback = true;
    made.setAttribute("playsinline", "");
    made.setAttribute("x-webkit-airplay", "deny");
    made.setAttribute("aria-hidden", "true");
    made.setAttribute("hidden", "");
    made.setAttribute("data-audio-keepalive", "");
    doc.body.append(made);
    element = made;
  }
  const audio = element;
  return {
    start() {
      if (!audio.paused) return;
      try {
        audio.play()?.catch(() => {});
      } catch {
        // An old WebKit throws instead of rejecting: the game plays on without it.
      }
    },
    pause() {
      audio.pause();
    },
    playing: () => !audio.paused,
  };
}
