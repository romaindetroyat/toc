// The seam between the audio engine (jitter, voice pool, buses, scheduling decisions) and the
// browser. WebAudioBackend wraps one AudioContext; FakeBackend records every call so the engine's
// timing rules are testable in plain Node.

export type Bus = "master" | "sfx" | "ambience";
export type VoiceBus = "sfx" | "ambience";
export type BackendState = "running" | "suspended" | "closed" | "none";

/** What the engine needs to know about a decoded or rendered sound. An AudioBuffer satisfies it. */
export type AudioBufferLike = { readonly duration: number };

export type PlayOptions = {
  /** Playback rate (1 = recorded pitch). */
  rate: number;
  /** Gain offset in dB applied to this voice. */
  gainDb: number;
  bus: VoiceBus;
  loop?: boolean;
  /** Start position inside the buffer, in seconds. */
  offsetS?: number;
  /** Linear fade-in from silence, in seconds. */
  fadeInS?: number;
};

export type VoiceHandle = { readonly id: number };

export interface AudioBackend {
  readonly sampleRate: number;
  /** Current time on the audio clock, in seconds. */
  now(): number;
  state(): BackendState;
  resume(): Promise<void>;
  onStateChange(listener: () => void): void;
  decode(data: ArrayBuffer): Promise<AudioBufferLike>;
  /** Start a voice at audio-clock time `at`. Never blocks and never throws on a bad time. */
  play(buffer: AudioBufferLike, at: number, opts: PlayOptions): VoiceHandle;
  /** Stop a voice at audio-clock time `at`, optionally fading out first. */
  stop(voice: VoiceHandle, at: number, fadeOutS?: number): void;
  setBusGain(bus: Bus, gain: number, at?: number, rampSeconds?: number): void;
}

type WebVoice = VoiceHandle & { source: AudioBufferSourceNode; gain: GainNode };

/** The real thing. The constructor throws when the browser cannot create an AudioContext. */
export class WebAudioBackend implements AudioBackend {
  readonly context: AudioContext;
  readonly sampleRate: number;
  private readonly buses: Record<Bus, GainNode>;
  private nextId = 1;

  constructor() {
    const context = new AudioContext();
    this.context = context;
    this.sampleRate = context.sampleRate;
    const master = context.createGain();
    master.connect(context.destination);
    const sfx = context.createGain();
    sfx.connect(master);
    const ambience = context.createGain();
    ambience.connect(master);
    this.buses = { master, sfx, ambience };
  }

  now(): number {
    return this.context.currentTime;
  }

  state(): BackendState {
    // Safari also reports "interrupted" (phone call, backgrounding): treat it as suspended.
    const state: string = this.context.state;
    if (state === "running") return "running";
    if (state === "closed") return "closed";
    return "suspended";
  }

  resume(): Promise<void> {
    return this.context.resume();
  }

  onStateChange(listener: () => void): void {
    this.context.addEventListener("statechange", listener);
  }

  decode(data: ArrayBuffer): Promise<AudioBufferLike> {
    return this.context.decodeAudioData(data);
  }

  play(buffer: AudioBufferLike, at: number, opts: PlayOptions): VoiceHandle {
    const context = this.context;
    const source = context.createBufferSource();
    source.buffer = buffer as AudioBuffer;
    source.playbackRate.value = opts.rate;
    source.loop = opts.loop === true;
    const gain = context.createGain();
    const level = 10 ** (opts.gainDb / 20);
    if (opts.fadeInS && opts.fadeInS > 0) {
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(level, at + opts.fadeInS);
    } else {
      gain.gain.value = level;
    }
    source.connect(gain).connect(this.buses[opts.bus]);
    source.addEventListener("ended", () => {
      source.disconnect();
      gain.disconnect();
    });
    source.start(at, opts.offsetS ?? 0);
    const voice: WebVoice = { id: this.nextId++, source, gain };
    return voice;
  }

  stop(voice: VoiceHandle, at: number, fadeOutS = 0): void {
    const { source, gain } = voice as WebVoice;
    try {
      if (fadeOutS > 0) {
        gain.gain.setValueAtTime(gain.gain.value, at);
        gain.gain.linearRampToValueAtTime(0, at + fadeOutS);
        source.stop(at + fadeOutS);
      } else {
        source.stop(at);
      }
    } catch {
      // Already stopped or never started: nothing left to silence.
    }
  }

  setBusGain(bus: Bus, gain: number, at?: number, rampSeconds = 0): void {
    const param = this.buses[bus].gain;
    const t = at ?? this.context.currentTime;
    param.cancelScheduledValues(t);
    param.setValueAtTime(param.value, t);
    if (rampSeconds > 0) param.linearRampToValueAtTime(gain, t + rampSeconds);
    else param.setValueAtTime(gain, t);
  }
}

export type FakePlay = {
  voice: VoiceHandle;
  buffer: AudioBufferLike;
  at: number;
  rate: number;
  gainDb: number;
  bus: VoiceBus;
  loop: boolean;
  offsetS: number;
  fadeInS: number;
  /** Audio-clock time at which stop() was requested, if any. */
  stoppedAt?: number;
  fadeOutS?: number;
};

/** Test double: records every call and lets the test drive the clock and the context state. */
export class FakeBackend implements AudioBackend {
  sampleRate = 44100;
  time = 0;
  plays: FakePlay[] = [];
  gains: Record<Bus, number> = { master: 1, sfx: 1, ambience: 1 };
  gainCalls: { bus: Bus; gain: number; at?: number; rampSeconds?: number }[] = [];
  resumeCalls = 0;
  /** When set, resume() rejects with this error (a context the browser refuses to start). */
  resumeError: Error | undefined;
  private current: BackendState = "suspended";
  private listeners: (() => void)[] = [];
  private nextId = 1;

  now(): number {
    return this.time;
  }

  state(): BackendState {
    return this.current;
  }

  setState(state: BackendState): void {
    this.current = state;
    for (const listener of this.listeners) listener();
  }

  async resume(): Promise<void> {
    this.resumeCalls++;
    if (this.resumeError) throw this.resumeError;
    this.setState("running");
  }

  onStateChange(listener: () => void): void {
    this.listeners.push(listener);
  }

  async decode(): Promise<AudioBufferLike> {
    return { duration: 0.1 };
  }

  play(buffer: AudioBufferLike, at: number, opts: PlayOptions): VoiceHandle {
    const voice = { id: this.nextId++ };
    this.plays.push({
      voice,
      buffer,
      at,
      rate: opts.rate,
      gainDb: opts.gainDb,
      bus: opts.bus,
      loop: opts.loop === true,
      offsetS: opts.offsetS ?? 0,
      fadeInS: opts.fadeInS ?? 0,
    });
    return voice;
  }

  stop(voice: VoiceHandle, at: number, fadeOutS = 0): void {
    const play = this.plays.find((p) => p.voice === voice);
    if (play && play.stoppedAt === undefined) {
      play.stoppedAt = at;
      play.fadeOutS = fadeOutS;
    }
  }

  setBusGain(bus: Bus, gain: number, at?: number, rampSeconds?: number): void {
    this.gains[bus] = gain;
    this.gainCalls.push({ bus, gain, at, rampSeconds });
  }

  /** Plays that were not stopped. */
  notStopped(): FakePlay[] {
    return this.plays.filter((p) => p.stoppedAt === undefined);
  }
}
