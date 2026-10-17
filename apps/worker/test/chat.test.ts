// The quick messages in workerd (plan 02-08): real sockets, real SQLite, an eviction between steps.
// Five messages in a row from one person: three reach both people, the fourth and fifth get rate; a
// message outside the twelve ids or from someone without a seat goes nowhere; a reconnect's welcome
// carries the kept messages.

import { env, evictDurableObject } from "cloudflare:test";
import type { ServerFrame } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { connect, createTable, token } from "./helpers.ts";

const stubOf = (id: string) => env.GAME_ROOM.getByName(id);

const chats = (frames: ServerFrame[]) =>
  frames.filter((frame): frame is Extract<ServerFrame, { t: "chat" }> => frame.t === "chat");

describe("the quick messages", () => {
  it("lets three of five through, refuses the rest, and keeps them for a reconnect", async () => {
    const id = await createTable({ pace: "zero" });
    const stub = stubOf(id);

    const ana = await connect(id);
    ana.send({ t: "hello", v: 3, token: token("a"), name: "Ana" });
    await ana.next("welcome");
    ana.send({ t: "sit", seat: "bleu" });
    await ana.next("welcome", (frame) => frame.you.seat === "bleu");
    const ben = await connect(id);
    ben.send({ t: "hello", v: 3, token: token("b"), name: "Ben" });
    await ben.next("welcome");
    await evictDurableObject(stub);

    // Ben has no seat yet: refused, nobody hears it.
    ben.send({ t: "chat", msg: "aie" });
    expect(await ben.next("error")).toEqual({ t: "error", code: "refused" });
    // Not one of the twelve ids: the frame is refused before the table sees it.
    ana.send({ t: "chat", msg: "coucou" });
    expect(await ana.next("error")).toEqual({ t: "error", code: "bad-frame" });

    ben.send({ t: "sit", seat: "jaune" });
    await ben.next("welcome", (frame) => frame.you.seat === "jaune");

    for (const msg of ["bien-joue", "aie", "coeur", "bravo", "rire"]) {
      ana.send({ t: "chat", msg });
    }
    expect(await ana.next("error")).toEqual({ t: "error", code: "rate" });
    expect(await ana.next("error")).toEqual({ t: "error", code: "rate" });
    await ben.next("chat", (frame) => frame.msg === "coeur");
    for (const client of [ana, ben]) {
      expect(chats(client.frames).map((frame) => [frame.from, frame.msg])).toEqual([
        ["bleu", "bien-joue"],
        ["bleu", "aie"],
        ["bleu", "coeur"],
      ]);
    }
    expect(ben.frames.some((frame) => frame.t === "error" && frame.code === "rate")).toBe(false);
    for (const text of [...ana.raw, ...ben.raw]) {
      expect(text).not.toContain(token("a"));
      expect(text).not.toContain(token("b"));
    }
    await evictDurableObject(stub);

    // Ben reconnects: his welcome carries the three kept messages, oldest first.
    ben.ws.close(1000);
    await ben.closed;
    const again = await connect(id);
    again.send({ t: "hello", v: 3, token: token("b"), name: "Ben" });
    const welcome = await again.next("welcome");
    expect(welcome.chat.map((entry) => [entry.from, entry.msg])).toEqual([
      ["bleu", "bien-joue"],
      ["bleu", "aie"],
      ["bleu", "coeur"],
    ]);
    ana.ws.close(1000);
    again.ws.close(1000);
  });
});
