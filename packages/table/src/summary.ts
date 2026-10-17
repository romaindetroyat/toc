// The public summary of a table (GET /api/tables/:id, plan 02-04, D-02, D-06): what the first-name
// prompt and « Mes parties en cours » show before or without joining. Built from public data only
// (T-02-15): first names and horse names, seat kinds, the status, the game number, the last activity.
// No `who`, no token hash, no table id, no card: the id in the URL is the capability.

import { COLORS, type Color } from "@toc/engine";
import type { SummarySeat, TableStatus, TableSummary } from "@toc/protocol";
import { personOf } from "./frames.ts";
import type { Table } from "./table.ts";

function statusOf(table: Table): TableStatus {
  if (table.status === "playing" && table.game?.phase === "won") return "finished";
  return table.status;
}

export function summary(table: Table): TableSummary {
  const seats = {} as Record<Color, SummarySeat>;
  for (const color of COLORS) {
    const seat = table.seats[color];
    if (seat.kind === "human") {
      seats[color] = { kind: "human", name: personOf(table, seat.who)?.name ?? null };
    } else if (seat.kind === "bot") {
      seats[color] = { kind: "bot", name: seat.name };
    } else {
      seats[color] = { kind: "free", name: null };
    }
  }
  const creator = table.creator === null ? undefined : personOf(table, table.creator);
  return {
    status: statusOf(table),
    creatorName: creator?.name ?? null,
    seats,
    gameNo: table.gameNo,
    updatedAt: table.lastActivity,
    // The seats a paused game waits for (« En pause : on t’attend », plan 02-07).
    missing: table.status === "paused" && table.pause !== null ? [...table.pause.missing] : [],
  };
}
