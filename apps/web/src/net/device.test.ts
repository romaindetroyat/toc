import { describe, expect, it } from "vitest";
import { DEVICE_KEY, loadDevice, saveName } from "./device.ts";

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

/** A predictable random source: every byte is `n`. */
const fill = (n: number) => (bytes: Uint8Array) => {
  bytes.fill(n);
};

const TOKEN = /^[A-Za-z0-9_-]{43}$/;

describe("loadDevice", () => {
  it("creates and stores a 43-character token on an empty storage", () => {
    const storage = memory();
    const device = loadDevice(storage, fill(7));
    expect(device.token).toMatch(TOKEN);
    expect(device.name).toBeNull();
    expect(JSON.parse(storage.data.get(DEVICE_KEY) ?? "null")).toEqual({
      token: device.token,
      name: null,
    });
  });

  it("keeps a valid stored token and name", () => {
    const token = "b".repeat(43);
    const storage = memory({ [DEVICE_KEY]: JSON.stringify({ token, name: "Ana" }) });
    expect(loadDevice(storage, fill(1))).toEqual({ token, name: "Ana" });
  });

  it("replaces a malformed or hostile value with a new token", () => {
    for (const raw of [
      "{not json",
      "null",
      "[]",
      JSON.stringify({ token: "short", name: "Ana" }),
      JSON.stringify({ token: 42 }),
      JSON.stringify({ token: `${"c".repeat(42)}=`, name: "Ana" }),
      JSON.stringify({ __proto__: { token: "d".repeat(43) } }),
    ]) {
      const storage = memory({ [DEVICE_KEY]: raw });
      const device = loadDevice(storage, fill(9));
      expect(device.token, raw).toMatch(TOKEN);
      expect(device.token, raw).not.toBe("d".repeat(43));
      expect(storage.data.get(DEVICE_KEY), raw).toContain(device.token);
    }
  });

  it("passes the stored name through normalizeName", () => {
    const token = "e".repeat(43);
    const named = (name: unknown) =>
      loadDevice(memory({ [DEVICE_KEY]: JSON.stringify({ token, name }) }), fill(1));
    expect(named("  Ana  ").name).toBe("Ana");
    expect(named("x".repeat(21)).name).toBeNull();
    expect(named(12).name).toBeNull();
    expect(named("   ").name).toBeNull();
    expect(named("   ").token).toBe(token);
  });

  it("still gives a token when the storage throws (private browsing)", () => {
    const broken = {
      getItem(): string | null {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
    };
    expect(loadDevice(broken, fill(3)).token).toMatch(TOKEN);
    expect(loadDevice(null, fill(3)).token).toMatch(TOKEN);
  });
});

describe("saveName", () => {
  it("stores a normalized name with the device token", () => {
    const storage = memory();
    const device = saveName(storage, "  Zoé ", fill(4));
    expect(device).toEqual({ token: expect.stringMatching(TOKEN), name: "Zoé" });
    expect(loadDevice(storage, fill(5))).toEqual(device);
  });

  it("refuses an empty name and stores nothing new", () => {
    const storage = memory();
    expect(saveName(storage, "   ", fill(4))).toBeNull();
    expect(storage.data.has(DEVICE_KEY)).toBe(false);
  });
});
