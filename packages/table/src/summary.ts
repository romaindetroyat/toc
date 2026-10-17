// The public summary of a table (GET /api/tables/:id, plan 02-04, D-02, D-06): what the first-name
// prompt and « Mes parties en cours » show before or without joining. Built from public data only
// (T-02-15): first names and horse names, seat kinds, the status, the game number, the last activity.

import type { TableSummary } from "@toc/protocol";
import type { Table } from "./table.ts";

export function summary(_table: Table): TableSummary {
  throw new Error("summary: not yet");
}
