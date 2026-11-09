import { describe, expect, it } from "vitest";
import { ME_KEY, readCachedAccount, writeCachedAccount } from "./cache.ts";

// The account the home shows at once on a cold start (04-UI-SPEC « Home: states »): the id and the
// pseudo only, for display, in localStorage as toc.me.v1. The stored value is untrusted.

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
  };
}

const ID = "u".repeat(22);

describe("the cached account", () => {
  it("writes and reads back the id and the pseudo only", () => {
    const storage = memory();
    writeCachedAccount(storage, { id: ID, pseudo: "Zoé" });
    expect(JSON.parse(storage.data.get(ME_KEY) ?? "")).toEqual({ id: ID, pseudo: "Zoé" });
    expect(readCachedAccount(storage)).toEqual({ id: ID, pseudo: "Zoé" });
    writeCachedAccount(storage, null);
    expect(storage.data.has(ME_KEY)).toBe(false);
    expect(readCachedAccount(storage)).toBeNull();
  });

  it("drops what is not an account", () => {
    for (const raw of [
      "{",
      "null",
      "[]",
      JSON.stringify({ id: "short", pseudo: "Zoé" }),
      JSON.stringify({ id: ID, pseudo: "Марія" }),
      JSON.stringify({ id: ID }),
    ]) {
      expect(readCachedAccount(memory({ [ME_KEY]: raw })), raw).toBeNull();
    }
    expect(readCachedAccount(null)).toBeNull();
  });

  it("a storage that throws is no account, and writing to it does not throw", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(readCachedAccount(broken)).toBeNull();
    expect(() => writeCachedAccount(broken, { id: ID, pseudo: "Zoé" })).not.toThrow();
    expect(() => writeCachedAccount(broken, null)).not.toThrow();
  });
});
