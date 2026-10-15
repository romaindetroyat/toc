import { MIN_CLOP_GAP_MS } from "@toc/board";
import { DEBUG } from "../debug.ts";
import {
  type AudioBackend,
  type AudioBufferLike,
  type VoiceHandle,
  WebAudioBackend,
} from "./backend.ts";
import { type Choices, DEFAULT_CHOICES, loadChoices } from "./choices.ts";
import {
  createKeepAlive,
  isAppleTouch,
  type KeepAlive,
  type KeepAliveDocument,
} from "./keepAlive.ts";
import {
  ENABLED_SOUNDS,
  SOUND_IDS,
  SOUNDS,
  type SoundDef,
  type SoundId,
  type SynthRecipe,
  type VariantKey,
  type VariantSource,
  variantOf,
} from "./sounds.ts";
import {
  renderCard,
  renderHoof,
  renderHoofBois,
  renderHoofPaves,
  renderHoofTerre,
  renderNeigh,
} from "./synth.ts";

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

export type Mix = {
  /** Master switch: off silences everything. */
  sound: boolean;
  /** Bruitages: off silences the effects only. */
  sfx: boolean;
};

/** The two bus gains a mix asks for: master and effects are on or off. */
export function busGainsFor(mix: Mix): { master: number; sfx: number } {
  return {
    master: mix.sound ? 1 : 0,
    sfx: mix.sfx ? 1 : 0,
  };
}

export const DEFAULT_MIX: Mix = {
  sound: true,
  sfx: true,
};

export type EngineStatus = "pending" | "ready" | "failed";

export type CueOptions = {
  /** Extra gain in dB added to the jittered gain. */
  gainDb?: number;
  /** Extra rate multiplier applied on top of the jitter. */
  rate?: number;
};

/**
 * Where one version of a sound stands: not asked for yet, being rendered or decoded, ready to play
 * (a silence is ready with nothing to play), or failed (its render or every decode failed).
 */
export type VariantState = "absent" | "pending" | "ready" | "failed";

/** One buffer the engine started: which sound, which version, which take, when (audio clock). */
export type PlayedSound = { id: SoundId; variant: VariantKey; take: number; at: number };

export type RenderSound = (
  recipe: SynthRecipe,
  take: number,
  sampleRate: number,
) => Promise<AudioBufferLike | undefined>;

export type Decoder = (url: string) => Promise<AudioBufferLike>;

export type EngineOptions = {
  backend: AudioBackend;
  /** Renders one take of a recipe; undefined (or a rejection) leaves that take out. */
  render: RenderSound;
  /** Fetches and decodes a recorded file; default: fetch, then the backend's decoder. */
  decode?: Decoder;
  /** Random source in [0, 1) for the jitter; injectable for tests. */
  random?: () => number;
  catalogue?: Record<SoundId, SoundDef>;
  /** The version of each sound the game plays (choices.ts); default: DEFAULT_CHOICES. */
  choices?: Choices;
  /** Told of every buffer started (debug builds publish it to the e2e specs). */
  onPlay?: (played: PlayedSound) => void;
  /**
   * The sounds that may be heard (default: ENABLED_SOUNDS, only the hooves since 2026-10-15). A sound
   * outside it is never rendered, prepared or played; its choice is still kept.
   */
  enabled?: ReadonlySet<SoundId>;
};

export interface AudioEngine {
  /** Resolves once the resume it asked for has settled (never rejects): status() is then current. */
  unlock(): Promise<void>;
  now(): number;
  /** Plays the chosen version of a sound (its takes round-robin). Fire-and-forget. */
  cue(id: SoundId, at?: number, opts?: CueOptions): void;
  /** One hoof clop per offset; `variant` plays that version instead of the chosen one (the page). */
  scheduleClops(offsetsMs: number[], t0: number, variant?: VariantKey): void;
  /** Plays one version once, rendering it first when needed; the choice does not change (the page). */
  play(id: SoundId, variant: VariantKey, at?: number): void;
  /** New choices: the newly chosen versions are prepared, the previous ones play until they are ready. */
  setChoices(next: Choices): void;
  choices(): Choices;
  /** The version cue() plays right now (undefined while none is ready). */
  activeVariant(id: SoundId): VariantKey | undefined;
  setMix(mix: Mix): void;
  availability(id: SoundId, variant: VariantKey): VariantState;
  retryResume(): void;
  status(): EngineStatus;
  onStatus(listener: (status: EngineStatus) => void): () => void;
  /** Resolves once the chosen version of every sound has been prepared (never rejects). */
  whenReady(): Promise<void>;
}

type Voice = { handle: VoiceHandle; at: number; end: number };
type Take = { buffer: AudioBufferLike; take: number };

const EXTENSION_ORDER = [".m4a", ".mp3"];
/** A version asked for by the page while it was not ready yet starts this far ahead of now. */
const LATE_LEAD_S = 0.03;

function extensionRank(file: string): number {
  const rank = EXTENSION_ORDER.findIndex((ext) => file.toLowerCase().endsWith(ext));
  return rank < 0 ? EXTENSION_ORDER.length : rank;
}

export function createAudioEngine(options: EngineOptions): AudioEngine {
  const { backend, render } = options;
  const random = options.random ?? Math.random;
  const catalogue = options.catalogue ?? SOUNDS;
  const enabled = options.enabled ?? ENABLED_SOUNDS;
  const decode: Decoder =
    options.decode ??
    (async (url) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return backend.decode(await response.arrayBuffer());
    });

  let unlocked = false;
  let rendered = false;
  let resumeFailed = false;
  let lastStatus: EngineStatus = "pending";
  const statusListeners = new Set<(status: EngineStatus) => void>();

  /** The version each sound should play (what was chosen), and the one it plays now (ready). */
  const chosen: Choices = { ...DEFAULT_CHOICES, ...options.choices };
  const active = new Map<SoundId, VariantKey>();

  const slot = (id: SoundId, variant: VariantKey) => `${id}:${variant}`;
  const takes = new Map<string, Take[]>();
  const states = new Map<string, VariantState>();
  const loading = new Map<string, Promise<void>>();
  const rounds = new Map<string, number>();

  let voices: Voice[] = [];
  let mix: Mix = { ...DEFAULT_MIX };

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
  }

  function stateOf(id: SoundId, variant: VariantKey): VariantState {
    return states.get(slot(id, variant)) ?? "absent";
  }

  /** Renders the takes of a generated version, or decodes the first file that works (.m4a, .mp3). */
  async function load(source: VariantSource): Promise<Take[]> {
    if (source.kind === "silence") return [];
    if (source.kind === "synth") {
      const rendered = await Promise.all(
        Array.from({ length: source.takes }, (_, take) =>
          render(source.recipe, take, backend.sampleRate).then(
            (buffer) => (buffer ? { buffer, take } : undefined),
            () => undefined,
          ),
        ),
      );
      return rendered.filter((take): take is Take => take !== undefined);
    }
    const candidates = [...source.files].sort((a, b) => extensionRank(a) - extensionRank(b));
    for (const url of candidates) {
      try {
        return [{ buffer: await decode(url), take: 0 }];
      } catch {
        // This format cannot be decoded here (Chromium has no AAC): try the next candidate.
      }
    }
    return [];
  }

  /** Prepares one version once (later calls share the same promise); never rejects. */
  function prepare(id: SoundId, variant: VariantKey): Promise<void> {
    const key = slot(id, variant);
    const running = loading.get(key);
    if (running) return running;
    const def = variantOf(id, variant, catalogue);
    states.set(key, "pending");
    const done = (def ? load(def.source) : Promise.resolve<Take[]>([])).then(
      (list) => {
        const ok = def !== undefined && (def.source.kind === "silence" || list.length > 0);
        takes.set(key, list);
        states.set(key, ok ? "ready" : "failed");
      },
      () => {
        states.set(key, "failed");
      },
    );
    loading.set(key, done);
    return done;
  }

  /** Makes the chosen version of `id` the one cue() plays, once it is ready; a failed one falls back to « a ». */
  async function activate(id: SoundId, variant: VariantKey): Promise<void> {
    await prepare(id, variant);
    if (chosen[id] !== variant) return; // chosen again meanwhile: that call decides
    if (stateOf(id, variant) === "ready") {
      active.set(id, variant);
      return;
    }
    if (variant !== "a" && !active.has(id)) {
      await prepare(id, "a");
      if (chosen[id] === variant && stateOf(id, "a") === "ready" && !active.has(id)) {
        active.set(id, "a");
      }
    }
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

  /** Starts the next take of one prepared version. */
  function playVariant(id: SoundId, variant: VariantKey, at?: number, opts: CueOptions = {}): void {
    // A suspended or interrupted context would queue the sound and burst it out on resume.
    if (!unlocked || backend.state() !== "running" || !enabled.has(id)) return;
    const list = takes.get(slot(id, variant));
    if (!list || list.length === 0) return;
    const round = rounds.get(slot(id, variant)) ?? 0;
    rounds.set(slot(id, variant), round + 1);
    const chosenTake = list[round % list.length] as Take;
    const now = backend.now();
    const start = Math.max(at ?? now, now);
    const rate = (1 + (random() * 2 - 1) * RATE_JITTER) * (opts.rate ?? 1);
    const gainDb = (random() * 2 - 1) * GAIN_JITTER_DB + (opts.gainDb ?? 0);
    const handle = backend.play(chosenTake.buffer, start, {
      rate,
      gainDb,
      bus: catalogue[id].bus,
    });
    admit({ handle, at: start, end: start + chosenTake.buffer.duration / rate });
    options.onPlay?.({ id, variant, take: chosenTake.take, at: start });
  }

  function cue(id: SoundId, at?: number, opts: CueOptions = {}): void {
    if (!enabled.has(id)) return; // silenced (ENABLED_SOUNDS)
    const variant = active.get(id);
    if (variant !== undefined) playVariant(id, variant, at, opts);
  }

  /** The offsets kept after MIN_CLOP_GAP_MS: hopTimeline() already spaces them, this is the guarantee. */
  function spaced(offsetsMs: number[]): number[] {
    const kept: number[] = [];
    let last = Number.NEGATIVE_INFINITY;
    for (const offset of [...offsetsMs].sort((a, b) => a - b)) {
      if (offset - last < MIN_CLOP_GAP_MS - 1e-9) continue;
      last = offset;
      kept.push(offset);
    }
    return kept;
  }

  function scheduleClops(offsetsMs: number[], t0: number, variant?: VariantKey): void {
    const offsets = spaced(offsetsMs);
    if (variant === undefined) {
      for (const offset of offsets) cue("sabot", t0 + offset / 1000);
      return;
    }
    if (!unlocked || !enabled.has("sabot")) return;
    const run = (start: number) => {
      for (const offset of offsets) playVariant("sabot", variant, start + offset / 1000);
    };
    if (stateOf("sabot", variant) === "ready") run(t0);
    else void prepare("sabot", variant).then(() => run(Math.max(t0, backend.now() + LATE_LEAD_S)));
  }

  function play(id: SoundId, variant: VariantKey, at?: number): void {
    if (!unlocked || !enabled.has(id)) return;
    if (stateOf(id, variant) === "ready") playVariant(id, variant, at);
    else
      void prepare(id, variant).then(() =>
        playVariant(id, variant, Math.max(at ?? 0, backend.now() + LATE_LEAD_S)),
      );
  }

  async function renderAll(): Promise<void> {
    // Only the sounds that may be heard are rendered: a silenced one costs nothing.
    await Promise.all(
      SOUND_IDS.filter((id) => enabled.has(id)).map((id) => activate(id, chosen[id])),
    );
    rendered = true;
    updateStatus();
    resolveReady();
  }

  function setChoices(next: Choices): void {
    for (const id of SOUND_IDS) {
      const variant = next[id];
      if (variant === undefined || !variantOf(id, variant, catalogue)) continue;
      if (chosen[id] === variant) continue;
      chosen[id] = variant;
      if (!unlocked) continue; // the first gesture prepares the chosen versions
      if (!enabled.has(id)) continue; // silenced: the choice is kept, nothing is prepared
      if (stateOf(id, variant) === "ready") active.set(id, variant);
      else void activate(id, variant);
    }
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
    play,
    setChoices,
    choices: () => ({ ...chosen }),
    activeVariant: (id) => active.get(id),
    setMix(next) {
      mix = { ...next };
      if (unlocked) applyMix(MIX_RAMP_S);
    },
    availability: stateOf,
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

function renderSynth(recipe: SynthRecipe, take: number, sampleRate: number): Promise<AudioBuffer> {
  switch (recipe) {
    case "hoof":
      return renderHoof(take, sampleRate);
    case "hoof-terre":
      return renderHoofTerre(take, sampleRate);
    case "hoof-paves":
      return renderHoofPaves(take, sampleRate);
    case "hoof-bois":
      return renderHoofBois(take, sampleRate);
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
  }
}

/** Renders one take of a recipe; debug builds also report its duration and peak to the e2e specs. */
async function renderRecipe(
  recipe: SynthRecipe,
  take: number,
  sampleRate: number,
): Promise<AudioBufferLike | undefined> {
  const buffer = await renderSynth(recipe, take, sampleRate);
  if (DEBUG && window.__tocDebug) {
    const data = buffer.getChannelData(0);
    let peak = 0;
    let energy = 0;
    let slope = 0;
    for (let i = 0; i < data.length; i++) {
      const sample = data[i] as number;
      peak = Math.max(peak, Math.abs(sample));
      energy += sample * sample;
      if (i > 0) slope += (sample - (data[i - 1] as number)) ** 2;
    }
    // A brightness estimate in Hz (the spectral centroid of a simple tone): the specs tell the
    // versions of a sound apart by it.
    const brightness = energy > 0 ? (sampleRate / (2 * Math.PI)) * Math.sqrt(slope / energy) : 0;
    const sounds = window.__tocDebug.audio.sounds ?? {};
    sounds[`${recipe}#${take}`] = { duration: buffer.duration, peak, brightness };
    window.__tocDebug.audio.sounds = sounds;
  }
  return buffer;
}

let engine: AudioEngine | undefined;
/**
 * Input events that grant user activation, so a resume() called from them is allowed: the HTML list
 * (pointerup and touchend for touch, keydown) plus click, which WebKit uses to unlock audio. A touch
 * pointerdown does not grant it.
 */
const ACTIVATION_EVENTS = ["pointerup", "touchend", "click", "keydown"] as const;

let backend: WebAudioBackend | undefined;
let createFailed = false;
let pendingMix: Mix | undefined;
/** Choices set before the first gesture (the page): the engine starts with them. */
let pendingChoices: Choices | undefined;

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Debug builds: every buffer started, with its version and take, for the e2e specs. */
function publishPlayed(played: PlayedSound): void {
  if (!window.__tocDebug) return;
  const log = window.__tocDebug.audio.played ?? [];
  log.push(played);
  window.__tocDebug.audio.played = log;
}
/** The resume the last unlock() asked for; settled (never rejects). */
let resuming: Promise<void> = Promise.resolve();
const shellListeners = new Set<(status: EngineStatus) => void>();

function emit(status: EngineStatus): void {
  for (const listener of [...shellListeners]) listener(status);
}

function mirrorState(): void {
  document.body.dataset.audio = backend ? backend.state() : "none";
}

type AudioSession = { type: string };

function audioSession(): AudioSession | undefined {
  return (navigator as Navigator & { audioSession?: AudioSession }).audioSession;
}

/**
 * iPhone and iPad only: the silent looping element that keeps the page in the « playback » audio
 * category, so the ringer switch does not mute the game (keepAlive.ts). Created in the first gesture.
 */
let keepAlive: KeepAlive | undefined;

function soundOn(): boolean {
  return (pendingMix ?? DEFAULT_MIX).sound;
}

/** Debug builds: the e2e specs read the session type and the silent element's state. */
function publishKeepAlive(): void {
  if (!DEBUG || !window.__tocDebug) return;
  window.__tocDebug.audio.keepAlive = {
    exists: keepAlive !== undefined,
    playing: keepAlive?.playing() ?? false,
  };
  const session = audioSession();
  if (session) window.__tocDebug.audio.audioSessionType = session.type;
}

/** Starts the silent element when the game may sound: the page is visible and « Son » is on. */
function startKeepAlive(): void {
  if (!keepAlive || document.hidden || !soundOn()) return;
  keepAlive.start();
  publishKeepAlive();
}

function pauseKeepAlive(): void {
  if (!keepAlive) return;
  keepAlive.pause();
  publishKeepAlive();
}

/** Called inside the first gesture once the engine exists: creates the element on Apple touch WebKit. */
function armKeepAlive(): void {
  if (!keepAlive && isAppleTouch(navigator)) {
    try {
      keepAlive = createKeepAlive(document as unknown as KeepAliveDocument);
      const element = document.querySelector("audio[data-audio-keepalive]");
      element?.addEventListener("playing", publishKeepAlive);
      element?.addEventListener("pause", publishKeepAlive);
      // Hidden (the app in the background, the phone locked): quiet, and no « À l'écoute » entry.
      // Back on screen it waits for the next gesture (the retry listeners below).
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) pauseKeepAlive();
      });
    } catch {
      keepAlive = undefined; // no <audio>: the game plays on, as before
    }
  }
  startKeepAlive();
}

/**
 * Create the AudioContext on first call and resume it. Call this synchronously inside a user
 * gesture handler (the « Jouer la partie » tap): browsers refuse to start audio otherwise.
 * Returns the context, or undefined when the browser cannot create one (the game stays playable).
 */
export function unlock(): AudioContext | undefined {
  // A browser that could not create the context is asked again on each tap (« Réessayer » in the
  // game): the failure is reported again if it persists.
  // iOS: ask for the « playback » session (the ringer switch does not mute it) before the
  // AudioContext exists, so the context starts in it (feature-detected; Safari 16.4+).
  const session = audioSession();
  if (session) session.type = "playback";
  if (!engine) {
    try {
      const created = new WebAudioBackend();
      const made = createAudioEngine({
        backend: created,
        render: renderRecipe,
        choices: pendingChoices ?? loadChoices(browserStorage()),
        onPlay: DEBUG ? publishPlayed : undefined,
      });
      backend = created;
      engine = made;
      createFailed = false;
      made.onStatus(emit);
      created.onStateChange(mirrorState);
      // Any later tap or key retries the resume (iOS interrupts the context when the app goes to the
      // background). Only events that grant user activation may resume it: a touch pointerdown does not.
      // The same taps start the silent element again once the page is visible and « Son » is on.
      const retry = () => {
        made.retryResume();
        startKeepAlive();
      };
      for (const type of ACTIVATION_EVENTS) {
        document.addEventListener(type, retry, { passive: true });
      }
      if (pendingMix) made.setMix(pendingMix);
    } catch {
      createFailed = true;
      emit("failed");
    }
  }
  resuming = engine ? engine.unlock() : Promise.resolve();
  if (engine) armKeepAlive();
  publishKeepAlive();
  mirrorState();
  return backend?.context;
}

/**
 * A screen reached without the launch screen's tap (a reload or a PWA relaunch on #/partie, a
 * bookmark) has no AudioContext yet: its first gesture becomes the unlock. The listeners live here,
 * outside unlock(), since nothing has called unlock() on that path. They listen on the capture phase,
 * so the unlock runs inside the gesture before the screen handles it, and are removed after the first
 * one. Returns the function that removes them (the screen's cleanup); a no-op once the engine exists.
 */
export function unlockOnFirstGesture(): () => void {
  if (engine) return () => {};
  const disarm = () => {
    for (const type of ACTIVATION_EVENTS) document.removeEventListener(type, arm, true);
  };
  const arm = () => {
    disarm();
    unlock();
  };
  for (const type of ACTIVATION_EVENTS) {
    document.addEventListener(type, arm, { capture: true, passive: true });
  }
  return disarm;
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
 * Schedule one hoof clop per offset (milliseconds after `t0`, a time on the AudioContext clock), in
 * the chosen version, or in `variant` (the sound test page). Scheduling on the audio clock keeps the
 * cadence tight while the main thread is animating.
 */
export function scheduleClops(offsetsMs: number[], t0: number, variant?: VariantKey): void {
  if (DEBUG && window.__tocDebug) {
    const recorded = [...offsetsMs];
    window.__tocDebug.audio.scheduled = recorded;
    window.__tocDebug.audio.history.push(recorded);
  }
  engine?.scheduleClops(offsetsMs, t0, variant);
}

/** Play the chosen version of one sound now (or at audio-clock time `at`), with jitter. Fire-and-forget. */
export function cue(id: SoundId, at?: number, opts?: CueOptions): void {
  // A silenced sound (ENABLED_SOUNDS) is neither asked for nor played: nothing reaches the log either.
  if (!ENABLED_SOUNDS.has(id)) return;
  if (DEBUG && window.__tocDebug) {
    // Debug builds: the e2e specs read which sounds were asked for, in which version, and when.
    const log = window.__tocDebug.audio.cues ?? [];
    log.push({ id, at: at ?? now(), requestedAt: now(), variant: engine?.activeVariant(id) });
    window.__tocDebug.audio.cues = log;
  }
  engine?.cue(id, at, opts);
}

/** The sound test page: plays one version once (rendered on demand), without changing the choice. */
export function play(id: SoundId, variant: VariantKey, at?: number): void {
  engine?.play(id, variant, at);
}

/** New choices (a pick on #/sons): heard at once in the game on this device. Safe before unlock. */
export function setChoices(next: Choices): void {
  pendingChoices = { ...next };
  engine?.setChoices(next);
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
  // « Son » off: the silent element stops too. Back on (a tap on the switch): it plays again; WebKit
  // lets an element a gesture has already started play again.
  if (mix.sound) startKeepAlive();
  else pauseKeepAlive();
}

/** Where one version of a sound stands; « absent » before the first gesture. */
export function availability(id: SoundId, variant: VariantKey): VariantState {
  return engine ? engine.availability(id, variant) : "absent";
}

export function status(): EngineStatus {
  if (engine) return engine.status();
  return createFailed ? "failed" : "pending";
}

export function onStatus(listener: (status: EngineStatus) => void): () => void {
  shellListeners.add(listener);
  return () => shellListeners.delete(listener);
}
