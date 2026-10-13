import { DEBUG } from "../debug.ts";
import { renderHoof } from "./synth.ts";

// Module singleton: one AudioContext for the whole app.
// Never await audio in the game loop; everything here is fire-and-forget.

const VARIANTS = 3;
const MAX_VOICES = 24;

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let hoofs: AudioBuffer[] = [];
let round = 0;
const voices: AudioBufferSourceNode[] = [];

function mirrorState(context: AudioContext): void {
  document.body.dataset.audio = context.state;
}

/**
 * Create the AudioContext on first call and resume it. Call this synchronously inside a user
 * gesture handler (the « Jouer la partie » tap): browsers refuse to start audio otherwise.
 */
export function unlock(): AudioContext {
  if (!ctx) {
    const created = new AudioContext();
    ctx = created;
    master = created.createGain();
    master.connect(created.destination);
    created.addEventListener("statechange", () => mirrorState(created));
    // Any later tap retries the resume (iOS interrupts the context when the app goes to background).
    document.addEventListener(
      "pointerdown",
      () => {
        if (created.state !== "running") void created.resume();
      },
      { passive: true },
    );
    void Promise.all(
      Array.from({ length: VARIANTS }, (_, v) => renderHoof(v, created.sampleRate)),
    ).then((buffers) => {
      hoofs = buffers;
    });
  }
  // iOS: play through the media channel so the ringer switch does not mute the game (feature-detected).
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "playback";
  void ctx.resume();
  mirrorState(ctx);
  return ctx;
}

/** Current time on the AudioContext clock, in seconds (0 before unlock). */
export function now(): number {
  return ctx ? ctx.currentTime : 0;
}

/**
 * Schedule one hoof clop per offset (milliseconds after `t0`, a time on the AudioContext clock).
 * Scheduling on the audio clock keeps the cadence tight while the main thread is animating.
 */
export function scheduleClops(offsetsMs: number[], t0: number): void {
  if (DEBUG && window.__tocDebug) {
    const recorded = [...offsetsMs];
    window.__tocDebug.audio.scheduled = recorded;
    window.__tocDebug.audio.history.push(recorded);
  }
  const context = ctx;
  if (!context || !master || hoofs.length === 0) return;
  for (const offset of offsetsMs) {
    const source = context.createBufferSource();
    source.buffer = hoofs[round++ % hoofs.length] ?? null;
    source.playbackRate.value = 1 + (Math.random() * 2 - 1) * 0.04; // +-4 %
    const gain = context.createGain();
    gain.gain.value = 10 ** (((Math.random() * 2 - 1) * 1.5) / 20); // +-1.5 dB
    source.connect(gain).connect(master);
    voices.push(source);
    source.addEventListener("ended", () => {
      const i = voices.indexOf(source);
      if (i >= 0) voices.splice(i, 1);
    });
    if (voices.length > MAX_VOICES) voices.shift()?.stop();
    source.start(t0 + offset / 1000);
  }
}
