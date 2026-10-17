// GET /api/tables/:id (plan 02-04): the public summary of a table, in workerd with real SQLite. An
// unknown id answers 404 and leaves nothing behind; a malformed id never reaches getByName (T-02-16);
// the JSON carries no person id, token hash, table id or card (T-02-15).

import { env, runInDurableObject, SELF } from "cloudflare:test";
import { parseTableSummary, type TableSummary } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { handleRequest } from "../src/index.ts";
import { connect, createTable, ORIGIN, token } from "./helpers.ts";

const stubOf = (id: string) => env.GAME_ROOM.getByName(id);

async function get(id: string): Promise<Response> {
  return SELF.fetch(`${ORIGIN}/api/tables/${id}`);
}

/** Every user table of the object (the runtime's own _cf_ tables aside). */
async function schemaOf(id: string): Promise<unknown[]> {
  return runInDurableObject(stubOf(id), (_room, state) =>
    state.storage.sql
      .exec("SELECT name FROM sqlite_master WHERE name NOT LIKE '\\_cf\\_%' ESCAPE '\\'")
      .toArray(),
  );
}

const CARD = /\b(1[0-3]|[1-9])[SHDC]\b/;

describe("GET /api/tables/:id", () => {
  it("a new table: 200, no-store, the summary of an empty waiting room", async () => {
    const id = await createTable();
    const response = await get(id);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as TableSummary;
    expect(parseTableSummary(body)).toEqual(body);
    expect(body).toMatchObject({
      status: "lobby",
      creatorName: null,
      seats: {
        bleu: { kind: "free", name: null },
        jaune: { kind: "free", name: null },
        rouge: { kind: "free", name: null },
        vert: { kind: "free", name: null },
      },
      gameNo: 0,
    });
    expect(typeof body.updatedAt).toBe("number");
  });

  it("changes after a sit, and never shows an id, a token, a hash or a card", async () => {
    const id = await createTable({ pace: "zero" });
    const ana = await connect(id);
    const anaToken = token("a");
    ana.send({ t: "hello", v: 1, token: anaToken, name: "Ana" });
    await ana.next("welcome");
    ana.send({ t: "sit", seat: "vert" });
    await ana.next("welcome", (frame) => frame.you.seat === "vert");

    const seated = (await (await get(id)).json()) as TableSummary;
    expect(seated.creatorName).toBe("Ana");
    expect(seated.seats.vert).toEqual({ kind: "human", name: "Ana" });

    ana.send({ t: "start" });
    await ana.next("events");
    const response = await get(id);
    const text = await response.text();
    const started = JSON.parse(text) as TableSummary;
    expect(started.status).toBe("playing");
    expect(started.seats.bleu.kind).toBe("bot");
    expect(text).not.toContain(id);
    expect(text).not.toContain(anaToken);
    expect(text).not.toMatch(CARD);
    expect(text).not.toMatch(/who|token|hash|tableId|hand|talon|rng/);
    // The person id is the base64url SHA-256 of "<id>:<token>": 43 characters.
    expect(text).not.toMatch(/[A-Za-z0-9_-]{40,}/);
    ana.ws.close();
  });

  it("a well-formed unknown id: 404 and no table schema left behind", async () => {
    const id = "Zz_unknown-summary-00a";
    const response = await get(id);
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await schemaOf(id)).toEqual([]);
  });

  it("a malformed id: 404 without reaching any Durable Object", async () => {
    let reached = 0;
    const fake = {
      GAME_ROOM: {
        getByName() {
          reached++;
          throw new Error("getByName must not be called");
        },
      },
    } as unknown as Env;
    for (const bad of [
      "short",
      "a".repeat(23),
      "abcdefghijklmnopqrst%2",
      "abcdefghijklmnopqrstu!",
    ]) {
      const response = await handleRequest(new Request(`${ORIGIN}/api/tables/${bad}`), fake);
      expect(response?.status, bad).toBe(404);
    }
    expect(reached).toBe(0);
    expect((await get("short")).status).toBe(404);
  });

  it("only GET reads a summary", async () => {
    const id = await createTable();
    const response = await SELF.fetch(`${ORIGIN}/api/tables/${id}`, { method: "POST" });
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("GET");
  });
});
