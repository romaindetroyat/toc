import type { TableSummary } from "@toc/protocol";
import { describe, expect, it } from "vitest";
import { table as copy } from "../i18n/fr/table.ts";
import {
  forgetTable,
  loadTables,
  MAX_TABLES,
  rememberTable,
  restoreTable,
  rowStatus,
  rowText,
  statusText,
  TABLES_KEY,
  type TableEntry,
  timeAgo,
} from "./tables.ts";

/** An in-memory storage, optionally throwing like private browsing. */
function memory(initial?: unknown, throws = false) {
  const data = new Map<string, string>();
  if (initial !== undefined) {
    data.set(TABLES_KEY, typeof initial === "string" ? initial : JSON.stringify(initial));
  }
  return {
    data,
    getItem(key: string) {
      if (throws) throw new Error("SecurityError");
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      if (throws) throw new Error("QuotaExceededError");
      data.set(key, value);
    },
  };
}

/** A table id: 22 base64url characters, made distinct by `n`. */
const id = (n: number) => `table${String(n).padStart(17, "0")}`;

const stored = (storage: ReturnType<typeof memory>) =>
  JSON.parse(storage.data.get(TABLES_KEY) ?? "null") as unknown;

describe("toc.tables.v1", () => {
  it("is empty without storage, on bad JSON, on a non-array, on a throwing storage", () => {
    expect(TABLES_KEY).toBe("toc.tables.v1");
    expect(loadTables(null)).toEqual([]);
    expect(loadTables(memory())).toEqual([]);
    expect(loadTables(memory("{pas du json"))).toEqual([]);
    expect(loadTables(memory({ id: id(1), seat: "bleu", joinedAt: 1 }))).toEqual([]);
    expect(loadTables(memory("42"))).toEqual([]);
    expect(loadTables(memory([], true))).toEqual([]);
  });

  it("keeps only valid entries: a table id, a colour or null, a time", () => {
    const good: TableEntry = { id: id(1), seat: "vert", joinedAt: 5 };
    const unseated: TableEntry = { id: id(2), seat: null, joinedAt: 4 };
    const entries = loadTables(
      memory([
        good,
        unseated,
        { id: "../api/x", seat: "bleu", joinedAt: 3 },
        { id: id(3), seat: "pourpre", joinedAt: 3 },
        { id: id(4), seat: "bleu", joinedAt: "hier" },
        { id: id(5), seat: "bleu", joinedAt: -1 },
        { id: id(6), seat: "bleu" },
        { id: 7, seat: "bleu", joinedAt: 3 },
        null,
        "x",
        [id(8)],
        { id: id(9), seat: "jaune", joinedAt: Number.NaN },
      ]),
    );
    expect(entries).toEqual([good, unseated]);
  });

  it("drops duplicates (the newest kept) and keeps the 20 newest of 25", () => {
    const many = Array.from({ length: 25 }, (_, n) => ({ id: id(n), seat: "bleu", joinedAt: n }));
    many.push({ id: id(24), seat: "rouge", joinedAt: 1 });
    many.push({ id: id(3), seat: "jaune", joinedAt: 100 });
    const entries = loadTables(memory(many));
    expect(MAX_TABLES).toBe(20);
    expect(entries).toHaveLength(20);
    expect(entries[0]).toEqual({ id: id(3), seat: "jaune", joinedAt: 100 });
    expect(entries.filter((e) => e.id === id(24))).toEqual([
      { id: id(24), seat: "bleu", joinedAt: 24 },
    ]);
    expect(entries.map((e) => e.id)).not.toContain(id(4));
    expect(new Set(entries.map((e) => e.id)).size).toBe(20);
  });

  it("rememberTable adds a table at the front, or updates its seat in place", () => {
    const storage = memory();
    rememberTable(storage, id(1), null, 10);
    rememberTable(storage, id(2), "bleu", 20);
    expect(loadTables(storage).map((e) => e.id)).toEqual([id(2), id(1)]);
    // The first welcome had no seat; the device then sat on Jaune.
    const after = rememberTable(storage, id(1), "jaune", 30);
    expect(after).toEqual([
      { id: id(2), seat: "bleu", joinedAt: 20 },
      { id: id(1), seat: "jaune", joinedAt: 10 },
    ]);
    expect(stored(storage)).toEqual(after);
    // A bad id is never stored.
    expect(rememberTable(storage, "nope", "bleu", 40)).toEqual(after);
  });

  it("rememberTable keeps 20 tables at most: the oldest leaves", () => {
    const storage = memory();
    for (let n = 0; n < 21; n++) rememberTable(storage, id(n), "rouge", n);
    const entries = loadTables(storage);
    expect(entries).toHaveLength(20);
    expect(entries[0]?.id).toBe(id(20));
    expect(entries.map((e) => e.id)).not.toContain(id(0));
  });

  it("forgetTable removes one entry and gives it back with its place; restoreTable puts it there", () => {
    const storage = memory();
    for (let n = 1; n <= 3; n++) rememberTable(storage, id(n), "bleu", n);
    expect(loadTables(storage).map((e) => e.id)).toEqual([id(3), id(2), id(1)]);
    const removed = forgetTable(storage, id(2));
    expect(removed).toEqual({ entry: { id: id(2), seat: "bleu", joinedAt: 2 }, index: 1 });
    expect(loadTables(storage).map((e) => e.id)).toEqual([id(3), id(1)]);
    expect(forgetTable(storage, id(9))).toBeNull();
    if (removed === null) throw new Error("not removed");
    expect(restoreTable(storage, removed.entry, removed.index).map((e) => e.id)).toEqual([
      id(3),
      id(2),
      id(1),
    ]);
    // Restoring twice does not duplicate it.
    expect(restoreTable(storage, removed.entry, removed.index)).toHaveLength(3);
  });

  it("a throwing storage never breaks the calls", () => {
    const storage = memory(undefined, true);
    expect(rememberTable(storage, id(1), "bleu", 1)).toEqual([
      { id: id(1), seat: "bleu", joinedAt: 1 },
    ]);
    expect(forgetTable(storage, id(1))).toBeNull();
  });
});

function summaryWith(
  seats: Partial<TableSummary["seats"]>,
  status: TableSummary["status"] = "lobby",
): TableSummary {
  const free = { kind: "free" as const, name: null };
  return {
    status,
    creatorName: "Ana",
    seats: { bleu: free, jaune: free, rouge: free, vert: free, ...seats },
    gameNo: 0,
    updatedAt: 0,
    missing: [],
  };
}

describe("rowStatus(summary, seat) (plan 02-07)", () => {
  it("reads « En pause : on t’attend » when this device's seat is missing", () => {
    const me = { kind: "human" as const, name: "Ana" };
    const paused = { ...summaryWith({ bleu: me }, "paused"), missing: ["bleu" as const] };
    expect(rowStatus(paused, "bleu")).toBe(copy.list.status.pausedForYou);
    expect(rowStatus(paused, "jaune")).toBe(copy.list.status.paused);
    expect(rowStatus(paused, null)).toBe(copy.list.status.paused);
    expect(rowStatus(summaryWith({ bleu: me }, "saved"), "bleu")).toBe(copy.list.status.saved);
  });
});

describe("rowText(summary, seat)", () => {
  it("nobody else, one, two, three", () => {
    const me = { kind: "human" as const, name: "Ana" };
    expect(rowText(summaryWith({ bleu: me }), "bleu")).toBe("Personne d’autre pour l’instant");
    expect(
      rowText(summaryWith({ bleu: me, jaune: { kind: "human", name: "Bruno" } }), "bleu"),
    ).toBe("Avec Bruno");
    expect(
      rowText(
        summaryWith({
          bleu: me,
          jaune: { kind: "human", name: "Bruno" },
          vert: { kind: "human", name: "Céline" },
        }),
        "bleu",
      ),
    ).toBe("Avec Bruno et Céline");
    expect(
      rowText(
        summaryWith(
          {
            bleu: me,
            jaune: { kind: "human", name: "Bruno" },
            rouge: { kind: "bot", name: "Tornado" },
            vert: { kind: "human", name: "Céline" },
          },
          "playing",
        ),
        "bleu",
      ),
    ).toBe("Avec Bruno, Tornado et Céline");
  });

  it("an unseated device lists every person seated; free seats are never listed", () => {
    expect(rowText(summaryWith({ rouge: { kind: "human", name: "Ana" } }), null)).toBe("Avec Ana");
    expect(rowText(summaryWith({}), null)).toBe("Personne d’autre pour l’instant");
  });
});

describe("statusText(status)", () => {
  it("one word per status", () => {
    expect(statusText("lobby")).toBe("Salle d’attente");
    expect(statusText("playing")).toBe("En cours");
    expect(statusText("paused")).toBe("En pause");
    expect(statusText("paused", true)).toBe("En pause\u00a0: on t’attend");
    expect(statusText("saved")).toBe("Sauvegardée");
    expect(statusText("finished")).toBe("Terminée");
  });
});

describe("timeAgo(then, now)", () => {
  const now = Date.UTC(2026, 9, 17, 12);
  it("reads like French, from Intl.RelativeTimeFormat", () => {
    expect(timeAgo(now - 10_000, now)).toBe("maintenant");
    expect(timeAgo(now - 5 * 60_000, now)).toBe("il y a 5 minutes");
    expect(timeAgo(now - 3 * 3_600_000, now)).toBe("il y a 3 heures");
    expect(timeAgo(now - 24 * 3_600_000, now)).toBe("hier");
    expect(timeAgo(now - 3 * 24 * 3_600_000, now)).toBe("il y a 3 jours");
    // A clock a little ahead of the server's never reads « dans … ».
    expect(timeAgo(now + 30_000, now)).toBe("maintenant");
  });
});
