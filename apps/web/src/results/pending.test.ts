import type { SoloReport } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import {
  enqueuePending,
  flushPending,
  PENDING_KEY,
  PENDING_MAX,
  type PendingStorage,
  readPending,
  removePending,
  reportNow,
} from "./pending.ts";
import type { SoloSent } from "./solo.ts";

// The queue of solo games not yet in « Mes résultats » (plan 05-07; 05-UI-SPEC « What counts »;
// 05-RESEARCH Pattern 2, Pitfall 4): toc.pending.v1, at most 50 entries, each tagged with the account
// that played. Untrusted when read back (anyone on the device, any script of the origin can edit it):
// an entry out of shape is dropped. Sent only for the account signed in, never for another.

const A = "AAAAAAAAAAAAAAAAAAAAAA";
const B = "BBBBBBBBBBBBBBBBBBBBBB";

function uuid(n: number): string {
  return `00000000-0000-4000-8000-${n.toString(16).padStart(12, "0")}`;
}

function report(n: number): SoloReport {
  return {
    id: uuid(n),
    startedAt: 1_790_000_000_000 + n,
    endedAt: 1_790_000_095_000 + n,
    human: "bleu",
    winner: "bleu-rouge",
    deals: 14,
    levels: { jaune: 3, rouge: 3, vert: 3 },
    seats: {
      bleu: { captured: 3, lost: 2, home: 4 },
      jaune: { captured: 1, lost: 4, home: 2 },
      rouge: { captured: 4, lost: 1, home: 4 },
      vert: { captured: 2, lost: 3, home: 1 },
    },
  };
}

function memory(initial?: string): PendingStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(PENDING_KEY, initial);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

const throwing: PendingStorage = {
  getItem() {
    throw new Error("SecurityError");
  },
  setItem() {
    throw new Error("QuotaExceededError");
  },
};

/** A fake send answering by report id, and the ids it was given. */
function sender(answers: Record<string, SoloSent>, fallback: SoloSent = "added") {
  const sent: string[] = [];
  return {
    sent,
    send: async (r: SoloReport): Promise<SoloSent> => {
      sent.push(r.id);
      return answers[r.id] ?? fallback;
    },
  };
}

describe("toc.pending.v1", () => {
  it("is the storage key, at most 50 entries", () => {
    expect(PENDING_KEY).toBe("toc.pending.v1");
    expect(PENDING_MAX).toBe(50);
  });

  it("keeps an entry with its account and reads it back", () => {
    const storage = memory();
    enqueuePending(storage, { account: A, report: report(1) });
    expect(readPending(storage)).toEqual([{ account: A, report: report(1) }]);
  });

  it("keeps one entry per account and game, however often it is queued", () => {
    const storage = memory();
    enqueuePending(storage, { account: A, report: report(1) });
    enqueuePending(storage, { account: A, report: report(1) });
    expect(readPending(storage)).toHaveLength(1);
  });

  it("keeps at most 50 entries, dropping the oldest", () => {
    const storage = memory();
    for (let n = 1; n <= 52; n++) enqueuePending(storage, { account: A, report: report(n) });
    const kept = readPending(storage);
    expect(kept).toHaveLength(50);
    expect(kept[0]?.report.id).toBe(uuid(3));
    expect(kept[49]?.report.id).toBe(uuid(52));
  });

  it("ignores what is not a queue, and every entry out of shape", () => {
    expect(readPending(memory("not json"))).toEqual([]);
    expect(readPending(memory('{"account":"x"}'))).toEqual([]);
    expect(readPending(memory("null"))).toEqual([]);
    const good = { account: A, report: report(1) };
    const mixed = [
      good,
      null,
      "text",
      { account: A },
      { report: report(2) },
      { account: "short", report: report(3) },
      { account: A, report: { ...report(4), id: "nope" } },
      { account: A, report: { ...report(5), name: "Mamie" } },
      { account: A, report: report(6), extra: true },
    ];
    expect(readPending(memory(JSON.stringify(mixed)))).toEqual([good]);
  });

  it("never throws when the storage does", async () => {
    expect(readPending(throwing)).toEqual([]);
    expect(() => enqueuePending(throwing, { account: A, report: report(1) })).not.toThrow();
    expect(() => removePending(throwing, A, uuid(1))).not.toThrow();
    expect(readPending(null)).toEqual([]);
    const { send } = sender({});
    await expect(flushPending(A, { storage: throwing, send })).resolves.toBeDefined();
  });

  it("removes one account's game only", () => {
    const storage = memory();
    enqueuePending(storage, { account: A, report: report(1) });
    enqueuePending(storage, { account: B, report: report(1) });
    removePending(storage, A, uuid(1));
    expect(readPending(storage)).toEqual([{ account: B, report: report(1) }]);
  });
});

describe("flushPending", () => {
  it("sends only the signed-in account's games, never another family member's", async () => {
    const storage = memory();
    enqueuePending(storage, { account: A, report: report(1) });
    enqueuePending(storage, { account: B, report: report(2) });
    enqueuePending(storage, { account: A, report: report(3) });
    const { sent, send } = sender({});
    await flushPending(A, { storage, send });
    expect(sent).toEqual([uuid(1), uuid(3)]);
    expect(readPending(storage)).toEqual([{ account: B, report: report(2) }]);
  });

  it("removes the games the server took or refused, keeps the ones to send again", async () => {
    const storage = memory();
    for (let n = 1; n <= 5; n++) enqueuePending(storage, { account: A, report: report(n) });
    const { send } = sender({
      [uuid(1)]: "added",
      [uuid(2)]: "already",
      [uuid(3)]: "refused",
      [uuid(4)]: "later",
      [uuid(5)]: "later",
    });
    await flushPending(A, { storage, send });
    expect(readPending(storage).map((e) => e.report.id)).toEqual([uuid(4), uuid(5)]);
  });

  it("stops at the first game without network or without session, and keeps them all", async () => {
    for (const stop of ["offline", "signed-out"] as const) {
      const storage = memory();
      for (let n = 1; n <= 3; n++) enqueuePending(storage, { account: A, report: report(n) });
      const { sent, send } = sender({ [uuid(2)]: stop });
      await flushPending(A, { storage, send });
      expect(sent, stop).toEqual([uuid(1), uuid(2)]);
      expect(
        readPending(storage).map((e) => e.report.id),
        stop,
      ).toEqual([uuid(2), uuid(3)]);
    }
  });

  it("never sends an entry out of shape", async () => {
    const storage = memory(
      JSON.stringify([
        { account: A, report: { ...report(1), seats: {} } },
        { account: A, report: report(2) },
      ]),
    );
    const { sent, send } = sender({});
    await flushPending(A, { storage, send });
    expect(sent).toEqual([uuid(2)]);
  });

  it("keeps a game queued meanwhile", async () => {
    const storage = memory();
    enqueuePending(storage, { account: A, report: report(1) });
    const send = async (r: SoloReport): Promise<SoloSent> => {
      enqueuePending(storage, { account: A, report: report(9) });
      return r.id === uuid(1) ? "added" : "later";
    };
    await flushPending(A, { storage, send });
    expect(readPending(storage).map((e) => e.report.id)).toEqual([uuid(9)]);
  });
});

describe("reportNow", () => {
  it("queues the game before sending it, and takes it off once the server has it", async () => {
    const storage = memory();
    let queuedWhileSending = 0;
    const send = async (): Promise<SoloSent> => {
      queuedWhileSending = readPending(storage).length;
      return "added";
    };
    expect(await reportNow({ account: A, report: report(1) }, { storage, send })).toBe("added");
    expect(queuedWhileSending).toBe(1);
    expect(readPending(storage)).toEqual([]);
  });

  it.each([
    ["already", 0],
    ["refused", 0],
    ["later", 1],
    ["signed-out", 1],
    ["offline", 1],
  ] as const)("after « %s », %i game waits", async (answer, left) => {
    const storage = memory();
    const send = async (): Promise<SoloSent> => answer;
    expect(await reportNow({ account: A, report: report(1) }, { storage, send })).toBe(answer);
    expect(readPending(storage)).toHaveLength(left);
  });
});
