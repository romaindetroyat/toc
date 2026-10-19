// The end of a game and the rematch in workerd (plan 02-09, D-08, PLAY-07): real sockets, real
// SQLite, an eviction between the steps. Ana (bleu) and Ben (jaune) with two computers start from a
// near-end position; Ana plays the winning 5; both sockets get the finished table. Both agree: each
// gets a new hand of their own, gameNo 2, the same seats. Every frame passes the leak oracle.

import { env, evictDurableObject, runInDurableObject } from "cloudflare:test";
import type { Color } from "@toc/engine";
import type { ServerFrame } from "@toc/protocol";
import type { Table } from "@toc/table";
import { structuralProblems } from "@toc/table/oracle";
import { describe, expect, it } from "vitest";
import { load } from "../src/storage.ts";
import { connect, createTable, NEAR_END, token } from "./helpers.ts";

const stubOf = (id: string) => env.GAME_ROOM.getByName(id);

async function readTable(id: string): Promise<Table> {
  const table = await runInDurableObject(stubOf(id), (_room, state) => load(state.storage.sql));
  if (table === null) throw new Error("no table");
  return table;
}

describe("the end of a game and the rematch", () => {
  it("announces the winner to both sockets and restarts at the same seats once both agree", async () => {
    const id = await createTable({ pace: "zero", before: NEAR_END });
    const stub = stubOf(id);

    const ana = await connect(id);
    ana.send({ t: "hello", v: 6, token: token("a"), name: "Ana" });
    await ana.next("welcome");
    ana.send({ t: "sit", seat: "bleu" });
    await ana.next("welcome", (frame) => frame.you.seat === "bleu");
    const ben = await connect(id);
    ben.send({ t: "hello", v: 6, token: token("b"), name: "Ben" });
    await ben.next("welcome");
    ben.send({ t: "sit", seat: "jaune" });
    await ben.next("welcome", (frame) => frame.you.seat === "jaune");
    ana.send({ t: "start" });
    const opening = await ana.next("events");
    expect(opening.view.hand).toEqual(["5S"]);
    expect(opening.events).toEqual([]);
    await evictDurableObject(stub);

    // The human whose turn it is plays the winning move.
    ana.send({
      t: "act",
      base: ana.seq(),
      action: { t: "move", card: "5S", pawn: "bleu3" },
    });
    for (const client of [ana, ben]) {
      const won = await client.next("events", (frame) =>
        frame.events.some((event) => event.t === "gameWon"),
      );
      expect(won.view.phase).toBe("won");
      const finished = await client.next("table", (frame) => frame.table.status === "finished");
      expect(finished.table.winner).toBe("bleu-rouge");
      expect(finished.table.rematch).toEqual({
        bleu: "no",
        jaune: "no",
        rouge: "bot",
        vert: "bot",
      });
    }
    const end = await readTable(id);
    expect(end.status).toBe("finished");
    expect(end.deadlines.bot).toBeUndefined();
    await evictDurableObject(stub);

    ana.send({ t: "rematch", agree: true });
    const agreed = await ben.next("table", (frame) => frame.table.rematch?.bleu === "yes");
    expect(agreed.table.status).toBe("finished");
    await evictDurableObject(stub);
    ben.send({ t: "rematch", agree: true });

    const hands = new Map<Color, string[]>();
    for (const [client, seat] of [
      [ana, "bleu"],
      [ben, "jaune"],
    ] as const) {
      const restarted = await client.next("table", (frame) => frame.table.gameNo === 2);
      expect(restarted.table.status).toBe("playing");
      expect(restarted.table.seats.bleu.name).toBe("Ana");
      expect(restarted.table.seats.jaune.name).toBe("Ben");
      expect(restarted.table.seats.rouge.kind).toBe("bot");
      expect(restarted.table.seats.vert.kind).toBe("bot");
      const deal = await client.next("events", (frame) =>
        frame.events.some((event) => event.t === "handDealt"),
      );
      expect(deal.view.seat).toBe(seat);
      for (const event of deal.events) {
        if (event.t === "handDealt" && event.seat !== seat) expect(event.cards).toBeNull();
      }
      hands.set(seat, [...deal.view.hand]);
    }
    const again = await readTable(id);
    expect(again.gameNo).toBe(2);
    expect(again.game?.dealer).toBe("bleu");
    expect(again.seats.bleu).toEqual(end.seats.bleu);
    expect(again.seats.jaune).toEqual(end.seats.jaune);
    expect(again.seats.rouge).toEqual(end.seats.rouge);
    expect(again.seats.vert).toEqual(end.seats.vert);
    expect(again.levels).toEqual(end.levels);
    expect(hands.get("bleu")).toEqual(again.game?.hands.bleu);
    expect(hands.get("jaune")).toEqual(again.game?.hands.jaune);

    // No frame names another seat's cards, a person id or a token.
    const forbidden = [...end.people.map((person) => person.who), token("a"), token("b")];
    let checked = 0;
    for (const client of [ana, ben]) {
      // The reader's seat is the one of the latest welcome (none before the person sat down).
      let reader: Color | null = null;
      for (const [index, text] of client.raw.entries()) {
        const frame = JSON.parse(text) as ServerFrame;
        if (frame.t === "welcome") reader = frame.you.seat;
        expect(structuralProblems(frame, reader, forbidden), `frame ${index}`).toEqual([]);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(10);
    ana.ws.close(1000, "bye");
    ben.ws.close(1000, "bye");
  }, 60_000);
});
