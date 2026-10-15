import { describe, expect, it } from "vitest";
import {
  createKeepAlive,
  isAppleTouch,
  type KeepAliveDocument,
  silentWavDataUri,
} from "./keepAlive.ts";

const PREFIX = "data:audio/wav;base64,";

function bytesOf(uri: string): Uint8Array {
  expect(uri.startsWith(PREFIX)).toBe(true);
  return Uint8Array.from(atob(uri.slice(PREFIX.length)), (c) => c.charCodeAt(0));
}

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.slice(from, to));

describe("silentWavDataUri", () => {
  it("is a RIFF WAVE file: mono, 16-bit PCM, about half a second, every sample zero", () => {
    const bytes = bytesOf(silentWavDataUri());
    const view = new DataView(bytes.buffer);
    expect(ascii(bytes, 0, 4)).toBe("RIFF");
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
    expect(ascii(bytes, 8, 12)).toBe("WAVE");
    expect(ascii(bytes, 12, 16)).toBe("fmt ");
    expect(view.getUint32(16, true)).toBe(16);
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    const sampleRate = view.getUint32(24, true);
    expect(sampleRate).toBe(8000);
    expect(view.getUint32(28, true)).toBe(sampleRate * 2); // byte rate
    expect(view.getUint16(32, true)).toBe(2); // block align
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
    expect(ascii(bytes, 36, 40)).toBe("data");
    const dataBytes = view.getUint32(40, true);
    expect(bytes.length).toBe(44 + dataBytes);
    expect(dataBytes / 2 / sampleRate).toBeCloseTo(0.5, 3);
    expect(bytes.slice(44).every((b) => b === 0)).toBe(true);
  });

  it("follows the requested length and rate", () => {
    const bytes = bytesOf(silentWavDataUri(1, 4000));
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(24, true)).toBe(4000);
    expect(view.getUint32(40, true)).toBe(8000);
  });
});

describe("isAppleTouch", () => {
  const iphone =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const ipadAsMac =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
  const chrome =
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

  it("recognises an iPhone, an old iPad and an iPod by their user agent", () => {
    expect(isAppleTouch({ userAgent: iphone })).toBe(true);
    expect(isAppleTouch({ userAgent: "Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X)" })).toBe(true);
    expect(isAppleTouch({ userAgent: "Mozilla/5.0 (iPod touch; CPU iPhone OS 12_0)" })).toBe(true);
  });

  it("recognises an iPad on iPadOS, which reports itself as a Mac with a touch screen", () => {
    expect(isAppleTouch({ userAgent: ipadAsMac, platform: "MacIntel", maxTouchPoints: 5 })).toBe(
      true,
    );
  });

  it("leaves out a real Mac and a desktop Chrome", () => {
    expect(isAppleTouch({ userAgent: ipadAsMac, platform: "MacIntel", maxTouchPoints: 0 })).toBe(
      false,
    );
    expect(isAppleTouch({ userAgent: chrome, platform: "Linux x86_64", maxTouchPoints: 0 })).toBe(
      false,
    );
  });
});

/** A document just big enough for createKeepAlive: one body, elements that record what is set. */
function fakeDocument() {
  type FakeAudio = {
    attributes: Map<string, string>;
    paused: boolean;
    plays: number;
    rejectPlay: boolean;
    [key: string]: unknown;
  };
  const appended: FakeAudio[] = [];
  const doc = {
    createElement(tag: string) {
      expect(tag).toBe("audio");
      const element: FakeAudio = {
        attributes: new Map(),
        paused: true,
        plays: 0,
        rejectPlay: false,
        setAttribute(name: string, value: string) {
          element.attributes.set(name, value);
        },
        play() {
          element.plays += 1;
          if (element.rejectPlay) return Promise.reject(new Error("NotAllowedError"));
          element.paused = false;
          return Promise.resolve();
        },
        pause() {
          element.paused = true;
        },
      };
      return element;
    },
    querySelector: (selector: string) =>
      selector === "audio[data-audio-keepalive]" ? (appended[0] ?? null) : null,
    body: {
      append(element: FakeAudio) {
        appended.push(element);
      },
    },
  };
  return { doc: doc as unknown as KeepAliveDocument, appended };
}

describe("createKeepAlive", () => {
  it("adds one hidden, looping, silent element with no controls and no AirPlay", () => {
    const { doc, appended } = fakeDocument();
    const keep = createKeepAlive(doc);
    expect(appended).toHaveLength(1);
    const el = appended[0];
    expect(el?.src).toBe(silentWavDataUri());
    expect(el?.loop).toBe(true);
    expect(el?.preload).toBe("auto");
    expect(el?.controls).toBe(false);
    expect(el?.disableRemotePlayback).toBe(true);
    expect(el?.attributes.get("playsinline")).toBe("");
    expect(el?.attributes.get("x-webkit-airplay")).toBe("deny");
    expect(el?.attributes.get("aria-hidden")).toBe("true");
    expect(el?.attributes.has("data-audio-keepalive")).toBe(true);
    expect(el?.attributes.has("hidden")).toBe(true);
    expect(keep.playing()).toBe(false);
  });

  it("plays and pauses on demand, and a refused play() is swallowed", async () => {
    const { doc, appended } = fakeDocument();
    const keep = createKeepAlive(doc);
    keep.start();
    expect(keep.playing()).toBe(true);
    keep.pause();
    expect(keep.playing()).toBe(false);
    const el = appended[0];
    if (el) el.rejectPlay = true;
    keep.start();
    await Promise.resolve();
    expect(keep.playing()).toBe(false);
  });

  it("reuses the element already in the page", () => {
    const { doc, appended } = fakeDocument();
    createKeepAlive(doc);
    createKeepAlive(doc);
    expect(appended).toHaveLength(1);
  });
});
