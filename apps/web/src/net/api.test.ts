import type { TableSummary } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { type ApiDeps, createTable, tableSummary } from "./api.ts";

const ID = "abcdefghijklmnopqrstuv";

const SUMMARY: TableSummary = {
  status: "lobby",
  creatorName: "Ana",
  seats: {
    bleu: { kind: "human", name: "Ana" },
    jaune: { kind: "free", name: null },
    rouge: { kind: "free", name: null },
    vert: { kind: "free", name: null },
  },
  gameNo: 0,
  updatedAt: 1_792_000_000_000,
  missing: [],
};

type Call = { url: string; init: RequestInit | undefined };

/** A fake fetch answering `respond`, recording each call. */
function deps(respond: (call: Call) => Response | Promise<Response>, online = true) {
  const calls: Call[] = [];
  const api: ApiDeps = {
    fetch: async (input, init) => {
      const call = { url: String(input), init };
      calls.push(call);
      return respond(call);
    },
    online: () => online,
  };
  return { api, calls };
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("createTable()", () => {
  it("201 with a table id: ok and the id, from one POST to /api/tables", async () => {
    const { api, calls } = deps(() => json({ id: ID }, 201));
    expect(await createTable(api)).toEqual({ ok: true, id: ID });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api/tables");
    expect(calls[0]?.init?.method).toBe("POST");
  });

  it("offline: the browser says so (no request), or fetch rejects", async () => {
    const off = deps(() => json({ id: ID }, 201), false);
    expect(await createTable(off.api)).toEqual({ ok: false, reason: "offline" });
    expect(off.calls).toHaveLength(0);
    const rejecting = deps(() => {
      throw new TypeError("Failed to fetch");
    });
    expect(await createTable(rejecting.api)).toEqual({ ok: false, reason: "offline" });
  });

  it("any other answer is a server error: 500, 403, 201 without a valid id, not JSON", async () => {
    for (const response of [
      () => json({ error: "x" }, 500),
      () => json({ error: "origin" }, 403),
      () => json({ id: "short" }, 201),
      () => json({}, 201),
      () => new Response("<html>", { status: 201 }),
      () => json({ id: ID }, 200),
    ]) {
      const { api } = deps(response);
      expect(await createTable(api)).toEqual({ ok: false, reason: "server" });
    }
  });
});

describe("tableSummary(id)", () => {
  it("200: the validated summary, from GET /api/tables/<id>", async () => {
    const { api, calls } = deps(() => json(SUMMARY, 200));
    expect(await tableSummary(ID, api)).toEqual(SUMMARY);
    expect(calls[0]?.url).toBe(`/api/tables/${ID}`);
    expect(calls[0]?.init?.method ?? "GET").toBe("GET");
  });

  it("404: gone; a malformed id is gone without a request", async () => {
    const { api } = deps(() => json({ error: "not-found" }, 404));
    expect(await tableSummary(ID, api)).toBe("gone");
    const never = deps(() => json(SUMMARY, 200));
    expect(await tableSummary("../api", never.api)).toBe("gone");
    expect(never.calls).toHaveLength(0);
  });

  it("offline, a rejected fetch, a server error, not JSON or not a summary: unknown", async () => {
    const off = deps(() => json(SUMMARY, 200), false);
    expect(await tableSummary(ID, off.api)).toBe("unknown");
    expect(off.calls).toHaveLength(0);
    for (const response of [
      () => {
        throw new TypeError("Failed to fetch");
      },
      () => json({ error: "x" }, 500),
      () => new Response("<html>", { status: 200 }),
      () => json({ ...SUMMARY, status: "nope" }, 200),
      () => json({ ...SUMMARY, who: "hash" }, 200),
      () => new Response("<html>Not found</html>", { status: 404 }),
    ]) {
      const { api } = deps(response);
      expect(await tableSummary(ID, api)).toBe("unknown");
    }
  });
});
