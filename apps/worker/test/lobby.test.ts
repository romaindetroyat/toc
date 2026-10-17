// The waiting room in workerd (plan 02-05): real sockets, real SQLite, an eviction before each step.
// The host moves a person and sets a computer's strength, a third person stays without a seat, the host
// starts; the unseated person never receives a view, and a newcomer after the start gets no seat.

import { env, evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { connect, createTable, token } from "./helpers.ts";

const stubOf = (id: string) => env.GAME_ROOM.getByName(id);

describe("the waiting room", () => {
  it("lets only the host arrange the table, and keeps the unseated and late arrivals out", async () => {
    const id = await createTable({ pace: "zero" });
    const stub = stubOf(id);

    const ana = await connect(id);
    ana.send({ t: "hello", v: 5, token: token("a"), name: "Ana" });
    expect(await ana.next("welcome")).toMatchObject({ you: { seat: null, host: true } });
    const ben = await connect(id);
    ben.send({ t: "hello", v: 5, token: token("b"), name: "Ben" });
    await ben.next("welcome");
    const clo = await connect(id);
    clo.send({ t: "hello", v: 5, token: token("c"), name: "Clo" });
    await clo.next("welcome");
    expect(
      (await ana.next("table", (frame) => frame.table.unseated.includes("Clo"))).table.unseated,
    ).toEqual(["Ana", "Ben", "Clo"]);
    await evictDurableObject(stub);

    ana.send({ t: "sit", seat: "bleu" });
    expect(await ana.next("welcome")).toMatchObject({ you: { seat: "bleu", host: true } });
    ben.send({ t: "sit", seat: "jaune" });
    expect(await ben.next("welcome")).toMatchObject({ you: { seat: "jaune" } });
    await evictDurableObject(stub);

    // Ben may not move people or set levels.
    ben.send({ t: "move", who: "bleu", to: "rouge" });
    expect(await ben.next("error")).toEqual({ t: "error", code: "not-host" });
    ben.send({ t: "level", seat: "rouge", level: 1 });
    expect(await ben.next("error")).toEqual({ t: "error", code: "not-host" });

    // The host moves Ben to vert and sets rouge to Champion.
    ana.send({ t: "move", who: "jaune", to: "vert" });
    expect(await ben.next("welcome")).toMatchObject({ you: { seat: "vert", host: false } });
    await evictDurableObject(stub);
    ana.send({ t: "level", seat: "rouge", level: 5 });
    const seen = await clo.next("table", (frame) => frame.table.seats.rouge.level === 5);
    expect(seen.table.seats.vert).toMatchObject({ kind: "human", name: "Ben" });
    expect(seen.table.unseated).toEqual(["Clo"]);
    await evictDurableObject(stub);

    // Clo stays unseated; the host starts anyway.
    ana.send({ t: "start" });
    await ana.next("events");
    await ben.next("events");
    const cloPlaying = await clo.next("table", (frame) => frame.table.status === "playing");
    expect(cloPlaying.table.seats.rouge).toMatchObject({ kind: "bot", level: 5 });
    await evictDurableObject(stub);

    // Too late to sit.
    clo.send({ t: "sit", seat: "jaune" });
    expect(await clo.next("error")).toEqual({ t: "error", code: "started" });

    // A fourth device after the start: no seat, no view.
    const dan = await connect(id);
    dan.send({ t: "hello", v: 5, token: token("d"), name: "Dan" });
    expect(await dan.next("welcome")).toMatchObject({
      you: { seat: null, host: false },
      view: null,
      table: { status: "playing" },
    });

    for (const frame of [...clo.frames, ...dan.frames]) {
      expect(frame.t).not.toBe("events");
      if (frame.t === "welcome") expect(frame.view).toBeNull();
    }
    for (const text of [...clo.raw, ...dan.raw]) expect(text).not.toContain('"kind":"view"');
  });
});
