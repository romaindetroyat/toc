import { hopTimeline, MIN_CLOP_GAP_MS } from "@toc/board";
import { describe, expect, it } from "vitest";
import { type AudioBufferLike, FakeBackend } from "./backend.ts";
import { createAudioEngine, MAX_VOICES } from "./engine.ts";
import { SOUND_IDS, SOUNDS, type SoundDef, type SoundId } from "./sounds.ts";
import { normalize } from "./synth.ts";

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tagOf(buffer: AudioBufferLike | undefined): string | undefined {
  return (buffer as { tag?: string } | undefined)?.tag;
}

/** Every recipe renders a 0.12 s buffer, tagged so the tests can tell which one was used. */
async function fakeRender(recipe: string, variant: number): Promise<AudioBufferLike> {
  return Object.assign({ duration: 0.12 }, { tag: `${recipe}#${variant}` });
}

async function setup(
  options: { random?: () => number; catalogue?: Record<SoundId, SoundDef> } = {},
) {
  const backend = new FakeBackend();
  const engine = createAudioEngine({
    backend,
    render: fakeRender,
    random: options.random ?? mulberry32(7),
    catalogue: options.catalogue,
  });
  engine.unlock();
  await engine.whenReady();
  return { backend, engine };
}

describe("catalogue", () => {
  it("holds the ten Phase 1 sounds, all effects: no ambience (removed on 2026-10-14)", () => {
    expect([...SOUND_IDS].sort()).toEqual(
      [
        "carte-donne",
        "carte-echange",
        "carte-pose",
        "hennissement-fete",
        "hennissement-joyeux",
        "hennissement-plainte",
        "hennissement-ruade",
        "hennissement-sortie",
        "hennissement-surpris",
        "sabot",
      ].sort(),
    );
    for (const id of SOUND_IDS) expect(SOUNDS[id].bus).toBe("sfx");
    expect(Object.values(SOUNDS).map((def) => def.synth)).not.toContain("ambience");
  });
});

describe("clops on the audio clock", () => {
  it("schedules hopTimeline(4) clops at t0 plus the offsets", async () => {
    const { backend, engine } = await setup();
    const t0 = 10;
    engine.scheduleClops(hopTimeline(4).clops, t0);
    const times = backend.plays.map((p) => p.at);
    expect(times).toHaveLength(4);
    for (const [i, expected] of [0.19975, 0.3995, 0.59925, 0.799].entries()) {
      expect(times[i]).toBeCloseTo(t0 + expected, 6);
    }
    expect(backend.plays.every((p) => p.bus === "sfx")).toBe(true);
  });

  it("never plays two clops closer than 50 ms, including 13 cells in fast mode", async () => {
    const { backend, engine } = await setup();
    engine.scheduleClops(hopTimeline(13, "fast").clops, 0);
    const times = backend.plays.map((p) => p.at).sort((a, b) => a - b);
    expect(times.length).toBeGreaterThan(5);
    for (let i = 1; i < times.length; i++) {
      expect((times[i] as number) - (times[i - 1] as number)).toBeGreaterThanOrEqual(0.05 - 1e-9);
    }
  });

  it("re-applies MIN_CLOP_GAP_MS even to offsets that are too close", async () => {
    const { backend, engine } = await setup();
    expect(MIN_CLOP_GAP_MS).toBe(50);
    engine.scheduleClops([0, 10, 20, 49, 50, 99, 100, 120], 0);
    expect(backend.plays.map((p) => Math.round(p.at * 1000))).toEqual([0, 50, 100]);
  });

  it("does not steal clops that have not started yet (a 13-cell move queues about 26)", async () => {
    const { backend, engine } = await setup();
    const clops = hopTimeline(13, "normal").clops;
    expect(clops.length).toBeGreaterThan(MAX_VOICES);
    engine.scheduleClops(clops, 0.06);
    expect(backend.plays).toHaveLength(clops.length);
    expect(backend.notStopped()).toHaveLength(clops.length);
  });

  it("rotates through the three synthesized hoof variants", async () => {
    const { backend, engine } = await setup();
    engine.scheduleClops([0, 100, 200, 300], 0);
    const tags = backend.plays.map((p) => tagOf(p.buffer));
    expect(tags).toEqual(["hoof#0", "hoof#1", "hoof#2", "hoof#0"]);
  });

  it("keeps the tracer signature: nothing happens before unlock", () => {
    const backend = new FakeBackend();
    const engine = createAudioEngine({ backend, render: fakeRender, random: () => 0.5 });
    engine.scheduleClops([100, 200], 0);
    engine.cue("carte-pose");
    expect(backend.plays).toHaveLength(0);
  });
});

describe("voice pool", () => {
  it("leaves at most MAX_VOICES voices alive, stopping the oldest first", async () => {
    const { backend, engine } = await setup();
    expect(MAX_VOICES).toBe(16);
    for (let i = 0; i < 40; i++) engine.cue("sabot", 0);
    expect(backend.plays).toHaveLength(40);
    const alive = backend.notStopped();
    expect(alive.length).toBeLessThanOrEqual(MAX_VOICES);
    const stopped = backend.plays.filter((p) => p.stoppedAt !== undefined);
    expect(stopped).toHaveLength(40 - alive.length);
    // The survivors are the newest ones.
    expect(alive[0]).toBe(backend.plays[40 - alive.length]);
  });

  it("frees voices whose sound has finished on the audio clock", async () => {
    const { backend, engine } = await setup();
    for (let i = 0; i < 16; i++) engine.cue("sabot", 0);
    backend.time = 1; // the 0.12 s clops are long over
    for (let i = 0; i < 16; i++) engine.cue("sabot", 1);
    expect(backend.plays.filter((p) => p.stoppedAt !== undefined)).toHaveLength(0);
  });

  it("does nothing for a sound that is not rendered", async () => {
    const backend = new FakeBackend();
    const engine = createAudioEngine({
      backend,
      render: async (recipe, variant) =>
        recipe === "hoof" ? fakeRender(recipe, variant) : undefined,
      random: () => 0.5,
    });
    engine.unlock();
    await engine.whenReady();
    engine.cue("carte-pose");
    expect(backend.plays).toHaveLength(0);
    engine.cue("sabot");
    expect(backend.plays).toHaveLength(1);
  });
});

describe("jitter", () => {
  it("keeps every rate within 4 % and every gain within 1.5 dB over 1000 cues", async () => {
    const { backend, engine } = await setup({ random: mulberry32(2024) });
    for (let i = 0; i < 1000; i++) engine.cue("sabot", i * 0.01);
    expect(backend.plays).toHaveLength(1000);
    let minRate = 2;
    let maxRate = 0;
    for (const play of backend.plays) {
      expect(play.rate).toBeGreaterThanOrEqual(0.96);
      expect(play.rate).toBeLessThanOrEqual(1.04);
      expect(play.gainDb).toBeGreaterThanOrEqual(-1.5);
      expect(play.gainDb).toBeLessThanOrEqual(1.5);
      minRate = Math.min(minRate, play.rate);
      maxRate = Math.max(maxRate, play.rate);
    }
    // The jitter is really used, not constant.
    expect(maxRate - minRate).toBeGreaterThan(0.05);
  });

  it("reaches but never passes the bounds at the extremes of the random source", async () => {
    for (const [value, rate, db] of [
      [0, 0.96, -1.5],
      [0.9999999, 1.04, 1.5],
    ] as const) {
      const { backend, engine } = await setup({ random: () => value });
      engine.cue("carte-pose");
      const play = backend.plays[0];
      expect(play?.rate).toBeCloseTo(rate, 4);
      expect(play?.gainDb).toBeCloseTo(db, 4);
    }
  });

  it("starts a cue now when no time is given, and honours explicit options", async () => {
    const { backend, engine } = await setup({ random: () => 0.5 });
    backend.time = 3;
    engine.cue("hennissement-sortie");
    engine.cue("hennissement-sortie", 5, { gainDb: -6, rate: 0.5 });
    expect(backend.plays[0]?.at).toBe(3);
    expect(backend.plays[1]?.at).toBe(5);
    expect(backend.plays[1]?.rate).toBeCloseTo(0.5, 6);
    expect(backend.plays[1]?.gainDb).toBeCloseTo(-6, 6);
  });
});

describe("mix", () => {
  it("sound off silences the master bus", async () => {
    const { backend, engine } = await setup();
    engine.setMix({ sound: false, sfx: true });
    expect(backend.gains.master).toBe(0);
    engine.setMix({ sound: true, sfx: true });
    expect(backend.gains.master).toBe(1);
  });

  it("Bruitages off silences effects only", async () => {
    const { backend, engine } = await setup();
    engine.setMix({ sound: true, sfx: false });
    expect(backend.gains.sfx).toBe(0);
    expect(backend.gains.master).toBe(1);
  });

  it("defaults to everything on, with only the master and effect buses", async () => {
    const { backend } = await setup();
    expect(backend.gains).toEqual({ master: 1, sfx: 1 });
    expect(new Set(backend.gainCalls.map((call) => call.bus))).toEqual(new Set(["master", "sfx"]));
  });
});

describe("recordings", () => {
  const withFiles = (files: string[]): Record<SoundId, SoundDef> => ({
    ...SOUNDS,
    "carte-pose": { ...SOUNDS["carte-pose"], files },
  });

  it("selects the mp3 when the m4a cannot be decoded", async () => {
    const { backend, engine } = await setup({
      catalogue: withFiles(["/audio/carte-pose.mp3", "/audio/carte-pose.m4a"]),
    });
    const tried: string[] = [];
    await engine.loadRecordings(async (url) => {
      tried.push(url);
      if (url.endsWith(".m4a")) throw new Error("EncodingError");
      return Object.assign({ duration: 0.3 }, { tag: url });
    });
    expect(tried).toEqual(["/audio/carte-pose.m4a", "/audio/carte-pose.mp3"]);
    expect(engine.recordings()["carte-pose"]).toEqual({
      source: "file",
      recordingUnavailable: false,
    });
    engine.cue("carte-pose");
    expect(tagOf(backend.plays[0]?.buffer)).toBe("/audio/carte-pose.mp3");
  });

  it("keeps the synthesized buffer and flags the sound when both decodes fail", async () => {
    const { backend, engine } = await setup({
      catalogue: withFiles(["/audio/carte-pose.m4a", "/audio/carte-pose.mp3"]),
    });
    await engine.loadRecordings(async () => {
      throw new Error("EncodingError");
    });
    expect(engine.recordings()["carte-pose"]).toEqual({
      source: "synth",
      recordingUnavailable: true,
    });
    engine.cue("carte-pose");
    expect(tagOf(backend.plays[0]?.buffer)).toBe("card-pose#0");
  });

  it("does not try the m4a when the first candidate already works", async () => {
    const { engine } = await setup({ catalogue: withFiles(["/audio/carte-pose.m4a"]) });
    const tried: string[] = [];
    await engine.loadRecordings(async (url) => {
      tried.push(url);
      return { duration: 0.3 };
    });
    expect(tried).toEqual(["/audio/carte-pose.m4a"]);
  });

  it("marks sounds without any recorded file as synthesized", async () => {
    const { engine } = await setup();
    await engine.loadRecordings(async () => {
      throw new Error("never called");
    });
    expect(engine.recordings().sabot).toEqual({ source: "synth", recordingUnavailable: true });
  });
});

describe("status and resume", () => {
  it("goes from pending to ready once every sound is rendered", async () => {
    const backend = new FakeBackend();
    const engine = createAudioEngine({ backend, render: fakeRender, random: () => 0.5 });
    const seen: string[] = [];
    engine.onStatus((s) => seen.push(s));
    expect(engine.status()).toBe("pending");
    engine.unlock();
    expect(engine.status()).toBe("pending");
    await engine.whenReady();
    expect(engine.status()).toBe("ready");
    expect(seen).toEqual(["ready"]);
    expect(backend.state()).toBe("running");
  });

  it("is failed when resume rejects, and the engine stays harmless", async () => {
    const backend = new FakeBackend();
    backend.resumeError = new Error("NotAllowedError");
    const engine = createAudioEngine({ backend, render: fakeRender, random: () => 0.5 });
    const seen: string[] = [];
    engine.onStatus((s) => seen.push(s));
    engine.unlock();
    await engine.whenReady();
    expect(engine.status()).toBe("failed");
    expect(() => engine.cue("sabot")).not.toThrow();
    engine.scheduleClops([100], 0);
    // A later tap retries the resume and recovers.
    backend.resumeError = undefined;
    engine.retryResume();
    await Promise.resolve();
    await Promise.resolve();
    expect(backend.resumeCalls).toBe(2);
    expect(engine.status()).toBe("ready");
    expect(seen).toEqual(["failed", "ready"]);
  });

  it("unlock resolves once its resume has settled, so a retry reports its own outcome", async () => {
    const backend = new FakeBackend();
    backend.resumeError = new Error("NotAllowedError");
    const engine = createAudioEngine({ backend, render: fakeRender, random: () => 0.5 });
    await engine.unlock();
    await engine.whenReady();
    expect(engine.status()).toBe("failed");
    // « Réessayer », and the browser accepts this time: once unlock has resolved the failure is gone.
    backend.resumeError = undefined;
    const retry = engine.unlock();
    expect(engine.status()).toBe("failed"); // the stale value a synchronous read would report
    await retry;
    expect(engine.status()).toBe("ready");
    // The browser refuses again: still failed once settled, and unlock never rejects.
    backend.resumeError = new Error("NotAllowedError");
    await expect(engine.unlock()).resolves.toBeUndefined();
    expect(engine.status()).toBe("failed");
  });

  it("retries the resume only while the context is not running", async () => {
    const { backend, engine } = await setup();
    expect(backend.resumeCalls).toBe(1);
    engine.retryResume();
    expect(backend.resumeCalls).toBe(1);
    backend.setState("suspended");
    engine.retryResume();
    expect(backend.resumeCalls).toBe(2);
  });
});

describe("no ambience (removed on 2026-10-14)", () => {
  it("has no ambience controls on the engine", async () => {
    const { engine } = await setup();
    for (const name of ["startAmbience", "pauseAmbience", "resumeAmbience", "stopAmbience"]) {
      expect(name in engine, name).toBe(false);
    }
  });

  it("never starts a voice by itself: unlock, render and recordings play nothing", async () => {
    const { backend, engine } = await setup();
    await engine.loadRecordings(async () => ({ duration: 8 }));
    backend.setState("suspended");
    engine.retryResume();
    await Promise.resolve();
    expect(backend.plays).toHaveLength(0);
  });

  it("plays every cued sound once, on the effect bus, never looped", async () => {
    const { backend, engine } = await setup();
    for (const id of SOUND_IDS) engine.cue(id);
    expect(backend.plays).toHaveLength(SOUND_IDS.length);
    expect(backend.plays.every((play) => play.bus === "sfx")).toBe(true);
    expect(backend.plays.every((play) => !("loop" in play))).toBe(true);
  });
});

describe("availability", () => {
  it("tells which buffers exist: none before unlock, the synthesis once rendered, a failed recipe stays absent", async () => {
    const backend = new FakeBackend();
    const engine = createAudioEngine({
      backend,
      render: async (recipe, variant) => {
        if (recipe === "neigh-ruade") throw new Error("render failed");
        return fakeRender(recipe, variant);
      },
      random: () => 0.5,
    });
    expect(engine.availability("sabot")).toEqual({ synth: false, file: false });
    engine.unlock();
    await engine.whenReady();
    expect(engine.availability("sabot")).toEqual({ synth: true, file: false });
    expect(engine.availability("hennissement-ruade")).toEqual({ synth: false, file: false });
  });

  it("reports a decoded recording as a file buffer next to the synthesis", async () => {
    const { engine } = await setup({
      catalogue: {
        ...SOUNDS,
        "carte-pose": { ...SOUNDS["carte-pose"], files: ["/audio/pose.m4a"] },
      },
    });
    await engine.loadRecordings(async () => ({ duration: 0.2 }));
    expect(engine.availability("carte-pose")).toEqual({ synth: true, file: true });
    expect(engine.availability("carte-donne")).toEqual({ synth: true, file: false });
  });
});

describe("synthesis helpers", () => {
  it("normalize scales to the requested peak and leaves silence alone", () => {
    const data = new Float32Array([0.1, -0.25, 0.05]);
    normalize(data, 0.5);
    expect(Math.max(...data.map(Math.abs))).toBeCloseTo(0.5, 6);
    expect(data[0]).toBeCloseTo(0.2, 6);
    const silence = new Float32Array(4);
    normalize(silence, 0.5);
    expect([...silence]).toEqual([0, 0, 0, 0]);
  });
});
