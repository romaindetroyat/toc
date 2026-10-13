import { MIN_CLOP_GAP_MS } from "@toc/board";
import { DEBUG } from "../debug.ts";
import {
  type AudioBackend,
  type AudioBufferLike,
  type VoiceHandle,
  WebAudioBackend,
} from "./backend.ts";
import { SOUND_IDS, SOUNDS, type SoundDef, type SoundId, type SynthRecipe } from "./sounds.ts";
import { renderAmbience, renderCard, renderHoof, renderNeigh } from "./synth.ts";

// The audio engine. Everything is fire-and-forget: no function here returns a promise the game
// loop has to await, and every start time is on the AudioContext clock (no setTimeout, no
// setInterval). The logic lives in createAudioEngine(), which takes an AudioBackend so tests run
// on a FakeBackend; the module-level functions at the bottom are the web shell the app uses.

/** Voices playing at the same time on the sound-effect bus; above it the oldest is stopped. */
export const MAX_VOICES = 16;
/** Hard bound on voices queued in the future (a 13-cell move queues about 26 clops). */
const MAX_SCHEDULED = 64;
const RATE_JITTER = 0.04; // +-4 %
const GAIN_JITTER_DB = 1.5; // +-1.5 dB
const MIX_RAMP_S = 0.03;
const AMBIENCE_FADE_IN_S = 1.5;
const AMBIENCE_FADE_OUT_S = 0.4;
const DEFAULT_AMBIENCE_VOLUME = 30;

export type Mix = {
  /** Master switch: off silences everything. */
  sound: boolean;
  /** Bruitages: off silences the effects only. */
  sfx: boolean;
  /** Ambiance: off silences the ambience only. */
  ambience: boolean;
  /** Ambience volume, 0 to 100. */
  ambienceVolume: number;
};

/** The three bus gains a mix asks for: master and effects are on or off, the ambience follows its volume. */
export function busGainsFor(mix: Mix): { master: number; sfx: number; ambience: number } {
  const volume = Number.isFinite(mix.ambienceVolume)
    ? Math.min(100, Math.max(0, mix.ambienceVolume))
    : DEFAULT_AMBIENCE_VOLUME;
  return {
    master: mix.sound ? 1 : 0,
    sfx: mix.sfx ? 1 : 0,
    ambience: mix.ambience ? volume / 100 : 0,
  };
}

export const DEFAULT_MIX: Mix = {
  sound: true,
  sfx: true,
  ambience: true,
  ambienceVolume: DEFAULT_AMBIENCE_VOLUME,
};

export type EngineStatus = "pending" | "ready" | "failed";

export type CueOptions = {
  /** Extra gain in dB added to the jittered gain. */
  gainDb?: number;
  /** Extra rate multiplier applied on top of the jitter. */
  rate?: number;
  /** Which buffer to use when both exist; default is the recording, else the synthesis. */
  prefer?: "file" | "synth";
};

export type RecordingInfo = { source: "synth" | "file"; recordingUnavailable: boolean };

/** Which buffers exist for a sound right now: the sound test page lists « Fichier » and « Généré » from this. */
export type Availability = { synth: boolean; file: boolean };

export type RenderSound = (
  recipe: SynthRecipe,
  variant: number,
  sampleRate: number,
) => Promise<AudioBufferLike | undefined>;

export type Decoder = (url: string) => Promise<AudioBufferLike>;

export type EngineOptions = {
  backend: AudioBackend;
  /** Renders one synthesized variant; undefined (or a rejection) leaves that sound silent. */
  render: RenderSound;
  /** Random source in [0, 1) for the jitter; injectable for tests. */
  random?: () => number;
  catalogue?: Record<SoundId, SoundDef>;
};

export interface AudioEngine {
  /** Resolves once the resume it asked for has settled (never rejects): status() is then current. */
  unlock(): Promise<void>;
  now(): number;
  cue(id: SoundId, at?: number, opts?: CueOptions): void;
  scheduleClops(offsetsMs: number[], t0: number): void;
  setMix(mix: Mix): void;
  startAmbience(): void;
  pauseAmbience(): void;
  resumeAmbience(): void;
  /** Stops the ambience for good: a later tab switch does not bring it back (startAmbience does). */
  stopAmbience(): void;
  loadRecordings(decode?: Decoder): Promise<void>;
  recordings(): Record<SoundId, RecordingInfo>;
  availability(id: SoundId): Availability;
  retryResume(): void;
  status(): EngineStatus;
  onStatus(listener: (status: EngineStatus) => void): () => void;
  /** Resolves once every synthesized sound has been rendered (never rejects). */
  whenReady(): Promise<void>;
}

type Voice = { handle: VoiceHandle; at: number; end: number };

const EXTENSION_ORDER = [".m4a", ".mp3"];

function extensionRank(file: string): number {
  const rank = EXTENSION_ORDER.findIndex((ext) => file.toLowerCase().endsWith(ext));
  return rank < 0 ? EXTENSION_ORDER.length : rank;
}

export function createAudioEngine(options: EngineOptions): AudioEngine {
  const { backend, render } = options;
  const random = options.random ?? Math.random;
  const catalogue = options.catalogue ?? SOUNDS;

  let unlocked = false;
  let rendered = false;
  let resumeFailed = false;
  let lastStatus: EngineStatus = "pending";
  const statusListeners = new Set<(status: EngineStatus) => void>();

  const synthBuffers = new Map<SoundId, AudioBufferLike[]>();
  const fileBuffers = new Map<SoundId, AudioBufferLike>();
  const info = Object.fromEntries(
    SOUND_IDS.map((id) => [id, { source: "synth", recordingUnavailable: false }]),
  ) as Record<SoundId, RecordingInfo>;
  const rounds = new Map<SoundId, number>();

  let voices: Voice[] = [];
  let mix: Mix = { ...DEFAULT_MIX };

  let ambienceWanted = false;
  let ambiencePaused = false;
  let ambienceVoices: VoiceHandle[] = [];

  let resolveReady: () => void = () => {};
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  function computeStatus(): EngineStatus {
    if (resumeFailed) return "failed";
    return rendered ? "ready" : "pending";
  }

  function updateStatus(): void {
    const next = computeStatus();
    if (next === lastStatus) return;
    lastStatus = next;
    for (const listener of [...statusListeners]) listener(next);
  }

  function resumeNow(): Promise<void> {
    let pending: Promise<void>;
    try {
      pending = backend.resume();
    } catch {
      resumeFailed = true;
      updateStatus();
      return Promise.resolve();
    }
    return pending.then(
      () => {
        resumeFailed = false;
        updateStatus();
      },
      () => {
        resumeFailed = true;
        updateStatus();
      },
    );
  }

  function applyMix(rampSeconds: number): void {
    const gains = busGainsFor(mix);
    backend.setBusGain("master", gains.master, undefined, rampSeconds);
    backend.setBusGain("sfx", gains.sfx, undefined, rampSeconds);
    backend.setBusGain("ambience", gains.ambience, undefined, rampSeconds);
  }

  function bufferFor(id: SoundId, prefer?: "file" | "synth"): AudioBufferLike | undefined {
    const file = fileBuffers.get(id);
    if (file && prefer !== "synth") return file;
    const variants = synthBuffers.get(id);
    if (!variants || variants.length === 0) return file;
    if (prefer === "file" && file) return file;
    const round = rounds.get(id) ?? 0;
    rounds.set(id, round + 1);
    return variants[round % variants.length];
  }

  function stopVoice(voice: Voice): void {
    backend.stop(voice.handle, backend.now());
  }

  /** Keeps the effect pool bounded: finished voices leave, then the oldest playing ones are stopped. */
  function admit(voice: Voice): void {
    const t = backend.now();
    voices = voices.filter((v) => v.end > t);
    voices.push(voice);
    while (voices.length > MAX_SCHEDULED) {
      const dropped = voices.shift();
      if (dropped) stopVoice(dropped);
    }
    const playing = voices.filter((v) => v.at <= t);
    for (let excess = playing.length - MAX_VOICES; excess > 0; excess--) {
      const oldest = playing.shift();
      if (!oldest) break;
      voices.splice(voices.indexOf(oldest), 1);
      stopVoice(oldest);
    }
  }

  function cue(id: SoundId, at?: number, opts: CueOptions = {}): void {
    // A suspended or interrupted context would queue the sound and burst it out on resume.
    if (!unlocked || backend.state() !== "running") return;
    const buffer = bufferFor(id, opts.prefer);
    if (!buffer) return;
    const now = backend.now();
    const start = Math.max(at ?? now, now);
    const rate = (1 + (random() * 2 - 1) * RATE_JITTER) * (opts.rate ?? 1);
    const gainDb = (random() * 2 - 1) * GAIN_JITTER_DB + (opts.gainDb ?? 0);
    const handle = backend.play(buffer, start, { rate, gainDb, bus: catalogue[id].bus });
    admit({ handle, at: start, end: start + buffer.duration / rate });
  }

  function scheduleClops(offsetsMs: number[], t0: number): void {
    // hopTimeline() already spaces its clops; this is the engine's own guarantee against a buzz.
    let last = Number.NEGATIVE_INFINITY;
    for (const offset of [...offsetsMs].sort((a, b) => a - b)) {
      if (offset - last < MIN_CLOP_GAP_MS - 1e-9) continue;
      last = offset;
      cue("sabot", t0 + offset / 1000);
    }
  }

  function tryStartAmbience(): void {
    if (!ambienceWanted || ambiencePaused || ambienceVoices.length > 0 || !unlocked) return;
    const buffer = bufferFor("ambiance");
    if (!buffer) return;
    // Two looped sources half a loop apart, each at equal-power level: whatever happens at one
    // source's loop point (an encoder gap in a recording) is covered by the other.
    const at = backend.now();
    const level = -3;
    for (const offsetS of [0, buffer.duration / 2]) {
      ambienceVoices.push(
        backend.play(buffer, at, {
          rate: 1,
          gainDb: level,
          bus: "ambience",
          loop: true,
          offsetS,
          fadeInS: AMBIENCE_FADE_IN_S,
        }),
      );
    }
  }

  function startAmbience(): void {
    ambienceWanted = true;
    ambiencePaused = false;
    tryStartAmbience();
  }

  function pauseAmbience(): void {
    ambiencePaused = true;
    const t = backend.now();
    for (const handle of ambienceVoices) backend.stop(handle, t, AMBIENCE_FADE_OUT_S);
    ambienceVoices = [];
  }

  function stopAmbience(): void {
    ambienceWanted = false;
    pauseAmbience();
  }

  function resumeAmbience(): void {
    if (!ambienceWanted) return;
    ambiencePaused = false;
    tryStartAmbience();
  }

  async function renderAll(): Promise<void> {
    await Promise.all(
      SOUND_IDS.map(async (id) => {
        const def = catalogue[id];
        const variants = await Promise.all(
          Array.from({ length: def.variants }, (_, variant) =>
            render(def.synth, variant, backend.sampleRate).catch(() => undefined),
          ),
        );
        const done = variants.filter((b): b is AudioBufferLike => b !== undefined);
        if (done.length > 0) synthBuffers.set(id, done);
      }),
    );
    rendered = true;
    updateStatus();
    resolveReady();
    tryStartAmbience();
  }

  async function loadRecordings(decode?: Decoder): Promise<void> {
    const decoder: Decoder =
      decode ??
      (async (url) => {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        return backend.decode(await response.arrayBuffer());
      });
    await Promise.all(
      SOUND_IDS.map(async (id) => {
        const candidates = [...catalogue[id].files].sort(
          (a, b) => extensionRank(a) - extensionRank(b),
        );
        for (const url of candidates) {
          try {
            const buffer = await decoder(url);
            fileBuffers.set(id, buffer);
            info[id] = { source: "file", recordingUnavailable: false };
            return;
          } catch {
            // This format cannot be decoded here (Chromium has no AAC): try the next candidate.
          }
        }
        info[id] = { source: "synth", recordingUnavailable: true };
      }),
    );
    tryStartAmbience();
  }

  return {
    unlock() {
      if (!unlocked) {
        unlocked = true;
        applyMix(0);
        void renderAll();
      }
      return resumeNow();
    },
    now: () => backend.now(),
    cue,
    scheduleClops,
    setMix(next) {
      mix = { ...next };
      if (unlocked) applyMix(MIX_RAMP_S);
    },
    startAmbience,
    pauseAmbience,
    resumeAmbience,
    stopAmbience,
    loadRecordings,
    recordings: () => ({ ...info }),
    availability: (id) => ({
      synth: (synthBuffers.get(id)?.length ?? 0) > 0,
      file: fileBuffers.has(id),
    }),
    retryResume() {
      if (unlocked && backend.state() !== "running") void resumeNow();
    },
    status: computeStatus,
    onStatus(listener) {
      statusListeners.add(listener);
      return () => statusListeners.delete(listener);
    },
    whenReady: () => ready,
  };
}

// --- Web shell: one engine for the whole app, created inside the first user gesture. ---

function renderSynth(
  recipe: SynthRecipe,
  variant: number,
  sampleRate: number,
): Promise<AudioBuffer> {
  switch (recipe) {
    case "hoof":
      return renderHoof(variant, sampleRate);
    case "neigh-sortie":
      return renderNeigh("sortie", sampleRate);
    case "neigh-ruade":
      return renderNeigh("ruade", sampleRate);
    case "neigh-plainte":
      return renderNeigh("plainte", sampleRate);
    case "neigh-joyeux":
      return renderNeigh("joyeux", sampleRate);
    case "neigh-fete":
      return renderNeigh("fete", sampleRate);
    case "neigh-surpris":
      return renderNeigh("surpris", sampleRate);
    case "card-donne":
      return renderCard("donne", sampleRate);
    case "card-pose":
      return renderCard("pose", sampleRate);
    case "card-echange":
      return renderCard("echange", sampleRate);
    case "ambience":
      return renderAmbience(sampleRate);
  }
}

/** Renders one synthesized sound; debug builds also report its duration and peak to the e2e specs. */
async function renderRecipe(
  recipe: SynthRecipe,
  variant: number,
  sampleRate: number,
): Promise<AudioBufferLike | undefined> {
  const buffer = await renderSynth(recipe, variant, sampleRate);
  if (DEBUG && window.__tocDebug) {
    let peak = 0;
    for (const sample of buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(sample));
    const sounds = window.__tocDebug.audio.sounds ?? {};
    sounds[`${recipe}#${variant}`] = { duration: buffer.duration, peak };
    window.__tocDebug.audio.sounds = sounds;
  }
  return buffer;
}

let engine: AudioEngine | undefined;
let backend: WebAudioBackend | undefined;
let createFailed = false;
let pendingMix: Mix | undefined;
let pendingAmbience = false;
/** The resume the last unlock() asked for; settled (never rejects). */
let resuming: Promise<void> = Promise.resolve();
const shellListeners = new Set<(status: EngineStatus) => void>();

function emit(status: EngineStatus): void {
  for (const listener of [...shellListeners]) listener(status);
}

function mirrorState(): void {
  document.body.dataset.audio = backend ? backend.state() : "none";
}

/**
 * Create the AudioContext on first call and resume it. Call this synchronously inside a user
 * gesture handler (the « Jouer la partie » tap): browsers refuse to start audio otherwise.
 * Returns the context, or undefined when the browser cannot create one (the game stays playable).
 */
export function unlock(): AudioContext | undefined {
  // A browser that could not create the context is asked again on each tap (« Réessayer » in the
  // game): the failure is reported again if it persists.
  if (!engine) {
    try {
      const created = new WebAudioBackend();
      const made = createAudioEngine({ backend: created, render: renderRecipe });
      backend = created;
      engine = made;
      createFailed = false;
      made.onStatus(emit);
      created.onStateChange(mirrorState);
      // Any later tap retries the resume (iOS interrupts the context when the app goes to background).
      document.addEventListener("pointerdown", () => made.retryResume(), { passive: true });
      // The ambience stops with the page and comes back with it.
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) made.pauseAmbience();
        else made.resumeAmbience();
      });
      if (pendingMix) made.setMix(pendingMix);
      if (pendingAmbience) made.startAmbience();
    } catch {
      createFailed = true;
      emit("failed");
    }
  }
  // iOS: play through the media channel so the ringer switch does not mute the game (feature-detected).
  const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
  if (session) session.type = "playback";
  resuming = engine ? engine.unlock() : Promise.resolve();
  mirrorState();
  return backend?.context;
}

/**
 * « Réessayer »: unlocks again (call it synchronously inside the tap, like unlock) and resolves with
 * the status once the resume has settled. Reading status() right after unlock() would still report
 * the failure the retry is about to clear.
 */
export async function retryUnlock(): Promise<EngineStatus> {
  unlock();
  await resuming;
  mirrorState();
  return status();
}

/** Current time on the AudioContext clock, in seconds (0 before unlock). */
export function now(): number {
  return engine ? engine.now() : 0;
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
  engine?.scheduleClops(offsetsMs, t0);
}

/** Play one sound now (or at audio-clock time `at`), with jitter. Fire-and-forget. */
export function cue(id: SoundId, at?: number, opts?: CueOptions): void {
  if (DEBUG && window.__tocDebug) {
    // Debug builds: the e2e specs read which neighs were asked for, and when on the audio clock.
    const log = window.__tocDebug.audio.cues ?? [];
    log.push({ id, at: at ?? now(), requestedAt: now() });
    window.__tocDebug.audio.cues = log;
  }
  engine?.cue(id, at, opts);
}

/** Apply the sound settings. Safe before unlock: the mix is applied when the engine starts. */
export function setMix(mix: Mix): void {
  if (DEBUG && window.__tocDebug) {
    // Debug builds: the e2e specs read the bus gains the settings ask for (the buses ramp to them in
    // 30 ms once the audio is unlocked, and before that the same gains wait in `pendingMix`).
    window.__tocDebug.audio.gains = busGainsFor(mix);
  }
  pendingMix = { ...mix };
  engine?.setMix(mix);
}

/**
 * Debug builds: whether the ambience is wanted (`on`), wanted but paused with the tab (`paused`) or
 * not wanted (`off`), for the e2e specs. A pause or a resume changes nothing for an ambience that is off.
 */
function noteAmbience(state: "on" | "paused" | "off"): void {
  if (!DEBUG || !window.__tocDebug) return;
  const audio = window.__tocDebug.audio;
  if (state === "paused" && audio.ambience !== "on") return;
  if (state === "on" && audio.ambience === "off") return;
  audio.ambience = state;
}

export function startAmbience(): void {
  if (DEBUG && window.__tocDebug) window.__tocDebug.audio.ambience = "on";
  pendingAmbience = true;
  engine?.startAmbience();
}

export function pauseAmbience(): void {
  noteAmbience("paused");
  engine?.pauseAmbience();
}

export function resumeAmbience(): void {
  noteAmbience("on");
  engine?.resumeAmbience();
}

/** Stops the ambience and forgets that it was wanted (the sound test page's « stop »). */
export function stopAmbience(): void {
  noteAmbience("off");
  pendingAmbience = false;
  engine?.stopAmbience();
}

/** Try the recorded files of every sound ([.m4a, .mp3]); a sound whose decode fails stays synthesized. */
export function loadRecordings(decode?: Decoder): Promise<void> {
  return engine ? engine.loadRecordings(decode) : Promise.resolve();
}

export function recordings(): Record<SoundId, RecordingInfo> | undefined {
  return engine?.recordings();
}

/** Which buffers (synthesized, recorded) exist for a sound; both false until it is rendered, or if rendering failed. */
export function availability(id: SoundId): Availability {
  return engine ? engine.availability(id) : { synth: false, file: false };
}

export function status(): EngineStatus {
  if (engine) return engine.status();
  return createFailed ? "failed" : "pending";
}

export function onStatus(listener: (status: EngineStatus) => void): () => void {
  shellListeners.add(listener);
  return () => shellListeners.delete(listener);
}
