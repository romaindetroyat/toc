import { describe, expect, it } from "vitest";
import type { StorageLike } from "../net/device.ts";
import {
  codeFor,
  forgetInvite,
  INVITES_KEY,
  keepPending,
  loadInvites,
  MAX_INVITES,
  rememberInvite,
  type StoredInvite,
} from "./invites.ts";

// The links this device created (plan 04-05, 04-UI-SPEC « Mes amis »): the server keeps only their
// hashes, so « Partager ce lien » works from the device that made the link only. toc.invites.v1 is
// untrusted storage, read entry by entry; expired links leave the list.

const NOW = 1_792_000_000_000;
const DAY = 24 * 3600 * 1000;

function memory(initial?: string): StorageLike & { value: string | null } {
  const store = {
    value: initial ?? null,
    getItem: (key: string) => (key === INVITES_KEY ? store.value : null),
    setItem: (key: string, value: string) => {
      if (key === INVITES_KEY) store.value = value;
    },
  };
  return store;
}

const id = (n: number) => `id${String(n).padStart(20, "0")}`;
const code = (n: number) => `cd${String(n).padStart(20, "0")}`;
const invite = (n: number, expiresAt = NOW + 7 * DAY - n): StoredInvite => ({
  id: id(n),
  code: code(n),
  expiresAt,
});

describe("rememberInvite and loadInvites", () => {
  it("keeps the new link first, at most MAX_INVITES", () => {
    const storage = memory();
    for (let n = 1; n <= 12; n++) rememberInvite(storage, invite(n, NOW + n), NOW);
    const list = loadInvites(storage, NOW);
    expect(MAX_INVITES).toBe(10);
    expect(list).toHaveLength(10);
    expect(list[0]).toEqual(invite(12, NOW + 12));
    expect(list.map((entry) => entry.id)).toEqual(Array.from({ length: 10 }, (_, i) => id(12 - i)));
    expect(JSON.parse(storage.value ?? "[]")).toEqual(list);
  });

  it("drops the expired links, the malformed entries and the duplicates", () => {
    const storage = memory(
      JSON.stringify([
        invite(1),
        invite(1),
        { ...invite(2), code: code(1) },
        invite(3, NOW),
        invite(4, NOW - 1),
        { ...invite(5), id: "../x" },
        { ...invite(6), code: "short" },
        { ...invite(7), expiresAt: "demain" },
        { ...invite(8), expiresAt: Number.NaN },
        { id: id(9), code: code(9) },
        null,
        "text",
        [invite(10)],
        { ...invite(11), extra: "<script>" },
      ]),
    );
    // Newest first (the later expiry); the extra key of the eleventh is not kept.
    expect(loadInvites(storage, NOW)).toEqual([invite(1), invite(11)]);
  });

  it("a hostile or broken storage gives an empty list and never throws", () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(loadInvites(throwing, NOW)).toEqual([]);
    expect(rememberInvite(throwing, invite(1), NOW)).toEqual([invite(1)]);
    expect(loadInvites(null, NOW)).toEqual([]);
    for (const raw of ["{", "{}", '"x"', "42", "null", '{"0":{}}']) {
      expect(loadInvites(memory(raw), NOW), raw).toEqual([]);
    }
    const proto = memory(
      `[{"__proto__":{"id":"${id(1)}","code":"${code(1)}","expiresAt":${NOW + DAY}}}]`,
    );
    expect(loadInvites(proto, NOW)).toEqual([]);
  });

  it("refuses to remember a malformed or expired link", () => {
    const storage = memory();
    expect(rememberInvite(storage, { ...invite(1), code: "x" }, NOW)).toEqual([]);
    expect(rememberInvite(storage, invite(2, NOW - 5), NOW)).toEqual([]);
    expect(storage.value).toBeNull();
  });
});

describe("forgetInvite and codeFor", () => {
  it("the code of a link this device made, or null; forgetting removes it", () => {
    const storage = memory();
    rememberInvite(storage, invite(1), NOW);
    rememberInvite(storage, invite(2), NOW);
    expect(codeFor(storage, id(1), NOW)).toBe(code(1));
    expect(codeFor(storage, id(3), NOW)).toBeNull();
    expect(codeFor(storage, id(1), invite(1).expiresAt)).toBeNull();
    expect(forgetInvite(storage, id(1), NOW)).toEqual([invite(2)]);
    expect(codeFor(storage, id(1), NOW)).toBeNull();
    expect(loadInvites(storage, NOW)).toEqual([invite(2)]);
  });
});

describe("keepPending (plan 04-10)", () => {
  it("forgets the links the server no longer lists (used or disabled), keeps the others", () => {
    const storage = memory();
    rememberInvite(storage, invite(1), NOW);
    rememberInvite(storage, invite(2), NOW);
    rememberInvite(storage, invite(3), NOW);
    const kept = keepPending(storage, [id(1), id(3), id(9)], NOW);
    expect(kept.map((entry) => entry.id).sort()).toEqual([id(1), id(3)]);
    expect(
      loadInvites(storage, NOW)
        .map((entry) => entry.id)
        .sort(),
    ).toEqual([id(1), id(3)]);
    expect(codeFor(storage, id(2), NOW)).toBeNull();
    expect(codeFor(storage, id(3), NOW)).toBe(code(3));
  });

  it("an empty pending list forgets every link; a broken storage gives none", () => {
    const storage = memory();
    rememberInvite(storage, invite(1), NOW);
    expect(keepPending(storage, [], NOW)).toEqual([]);
    expect(loadInvites(storage, NOW)).toEqual([]);
    expect(keepPending(memory("{not json"), [id(1)], NOW)).toEqual([]);
  });
});
