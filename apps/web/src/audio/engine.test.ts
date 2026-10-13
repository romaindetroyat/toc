import { hopTimeline, MIN_CLOP_GAP_MS } from "@toc/board";
import { describe, expect, it } from "vitest";
import { type AudioBufferLike, FakeBackend } from "./backend.ts";
import { createAudioEngine, MAX_VOICES } from "./engine.ts";
import { SOUND_IDS, SOUNDS, type SoundDef, type SoundId } from "./sounds.ts";

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
  it("holds the eleven Phase 1 sounds, ambience on its own bus", () => {
    expect([...SOUND_IDS].sort()).toEqual(
      [
        "ambiance",
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
    expect(SOUNDS.ambiance.bus).toBe("ambience");
    for (const id of SOUND_IDS) if (id !== "ambiance") expect(SOUNDS[id].bus).toBe("sfx");
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
    engine.setMix({ sound: false, sfx: true, ambience: true, ambienceVolume: 30 });
    expect(backend.gains.master).toBe(0);
    engine.setMix({ sound: true, sfx: true, ambience: true, ambienceVolume: 30 });
    expect(backend.gains.master).toBe(1);
  });

  it("Bruitages off silences effects only", async () => {
    const { backend, engine } = await setup();
    engine.setMix({ sound: true, sfx: true, ambience: true, ambienceVolume: 30 });
    const ambienceBefore = backend.gains.ambience;
    engine.setMix({ sound: true, sfx: false, ambience: true, ambienceVolume: 30 });
    expect(backend.gains.sfx).toBe(0);
    expect(backend.gains.master).toBe(1);
    expect(backend.gains.ambience).toBe(ambienceBefore);
    expect(backend.gains.ambience).toBeCloseTo(0.3, 9);
  });

  it("Ambiance off or its volume drives the ambience bus only", async () => {
    const { backend, engine } = await setup();
    engine.setMix({ sound: true, sfx: true, ambience: true, ambienceVolume: 70 });
    expect(backend.gains.ambience).toBeCloseTo(0.7, 9);
    expect(backend.gains.sfx).toBe(1);
    engine.setMix({ sound: true, sfx: true, ambience: false, ambienceVolume: 70 });
    expect(backend.gains.ambience).toBe(0);
    expect(backend.gains.sfx).toBe(1);
    engine.setMix({ sound: true, sfx: true, ambience: true, ambienceVolume: 250 });
    expect(backend.gains.ambience).toBe(1);
    engine.setMix({ sound: true, sfx: true, ambience: true, ambienceVolume: Number.NaN });
    expect(backend.gains.ambience).toBeCloseTo(0.3, 9);
  });

  it("defaults to everything on with the ambience at 30 %", async () => {
    const { backend } = await setup();
    expect(backend.gains.master).toBe(1);
    expect(backend.gains.sfx).toBe(1);
    expect(backend.gains.ambience).toBeCloseTo(0.3, 9);
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

describe("ambience", () => {
  it("waits for the render, then plays two offset looped sources on the ambience bus", async () => {
    const backend = new FakeBackend();
    const engine = createAudioEngine({
      backend,
      render: async (recipe, variant) => ({
        ...(await fakeRender(recipe, variant)),
        duration: recipe === "ambience" ? 8 : 0.12,
      }),
      random: () => 0.5,
    });
    engine.startAmbience(); // before unlock: remembered
    engine.unlock();
    expect(backend.plays).toHaveLength(0);
    await engine.whenReady();
    expect(backend.plays).toHaveLength(2);
    const [a, b] = backend.plays;
    expect(a?.bus).toBe("ambience");
    expect(a?.loop && b?.loop).toBe(true);
    expect(a?.fadeInS).toBeCloseTo(1.5, 9);
    expect(a?.offsetS).toBe(0);
    expect(b?.offsetS).toBeCloseTo(4, 9);
  });

  it("pauses with a fade-out and resumes once, never twice", async () => {
    const { backend, engine } = await setup();
    engine.startAmbience();
    engine.startAmbience(); // idempotent
    expect(backend.plays).toHaveLength(2);
    engine.pauseAmbience();
    expect(backend.plays.every((p) => p.stoppedAt !== undefined && (p.fadeOutS ?? 0) > 0)).toBe(
      true,
    );
    engine.resumeAmbience();
    engine.resumeAmbience();
    expect(backend.plays).toHaveLength(4);
    expect(backend.notStopped()).toHaveLength(2);
  });

  it("does not come back after a pause it did not start, and ignores resume without start", async () => {
    const { backend, engine } = await setup();
    engine.resumeAmbience();
    expect(backend.plays).toHaveLength(0);
  });

  it("is not counted in the sound-effect voice pool", async () => {
    const { backend, engine } = await setup();
    engine.startAmbience();
    for (let i = 0; i < MAX_VOICES; i++) engine.cue("sabot", 0);
    expect(
      backend.plays.filter((p) => p.bus === "ambience" && p.stoppedAt !== undefined),
    ).toHaveLength(0);
  });
});
