import { describe, expect, it } from "vitest";
import { atLeast, iosVersion, isAppleMobile, isStandalone } from "./platform.ts";

// The platform facts the notifications and the install guidance need (plan 04-07, 04-RESEARCH Pattern
// 7 « iOS 16.4+ requirements », 04-UI-SPEC « Install guidance »): an iPhone or iPad (iPadOS reports
// itself as a Mac with a touch screen), its iOS version, and whether the app runs installed.

const IPHONE_17_4 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const IPHONE_16_3 =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1";
const IPAD_OLD =
  "Mozilla/5.0 (iPad; CPU OS 15_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.6 Mobile/15E148 Safari/604.1";
const IPADOS_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15";
const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

describe("isAppleMobile", () => {
  it("an iPhone, an iPad, and iPadOS reporting as a Mac with touch", () => {
    expect(isAppleMobile(IPHONE_17_4, 5)).toBe(true);
    expect(isAppleMobile(IPHONE_CHROME, 5)).toBe(true);
    expect(isAppleMobile(IPAD_OLD, 5)).toBe(true);
    expect(isAppleMobile(IPADOS_AS_MAC, 5)).toBe(true);
  });

  it("a Mac without touch, Android, Windows", () => {
    expect(isAppleMobile(IPADOS_AS_MAC, 0)).toBe(false);
    expect(isAppleMobile(ANDROID, 5)).toBe(false);
    expect(isAppleMobile(WINDOWS, 0)).toBe(false);
    expect(isAppleMobile("", 0)).toBe(false);
  });
});

describe("iosVersion", () => {
  it("reads the OS version of an iPhone or iPad, and the Safari version of iPadOS as a Mac", () => {
    expect(iosVersion(IPHONE_17_4)).toEqual({ major: 17, minor: 4 });
    expect(iosVersion(IPHONE_16_3)).toEqual({ major: 16, minor: 3 });
    expect(iosVersion(IPHONE_CHROME)).toEqual({ major: 16, minor: 4 });
    expect(iosVersion(IPAD_OLD)).toEqual({ major: 15, minor: 7 });
    expect(iosVersion(IPADOS_AS_MAC)).toEqual({ major: 17, minor: 2 });
  });

  it("null elsewhere", () => {
    expect(iosVersion(ANDROID)).toBeNull();
    expect(iosVersion(WINDOWS)).toBeNull();
    expect(iosVersion("")).toBeNull();
  });

  it("atLeast compares major then minor", () => {
    expect(atLeast({ major: 16, minor: 4 }, 16, 4)).toBe(true);
    expect(atLeast({ major: 16, minor: 10 }, 16, 4)).toBe(true);
    expect(atLeast({ major: 17, minor: 0 }, 16, 4)).toBe(true);
    expect(atLeast({ major: 16, minor: 3 }, 16, 4)).toBe(false);
    expect(atLeast({ major: 15, minor: 9 }, 16, 4)).toBe(false);
    expect(atLeast(null, 16, 4)).toBe(false);
  });
});

describe("isStandalone", () => {
  it("installed when the display mode is standalone, or navigator.standalone on iOS", () => {
    expect(isStandalone(true, undefined)).toBe(true);
    expect(isStandalone(false, true)).toBe(true);
    expect(isStandalone(true, false)).toBe(true);
    expect(isStandalone(false, false)).toBe(false);
    expect(isStandalone(false, undefined)).toBe(false);
  });
});
