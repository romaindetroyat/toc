// « Mes parties en cours » (D-06): the tables this device has joined, kept in toc.tables.v1.

import type { Color } from "@toc/engine";
import type { TableStatus, TableSummary } from "@toc/protocol";
import type { StorageLike } from "./device.ts";

export const TABLES_KEY = "toc.tables.v1";
export const MAX_TABLES = 20;

export type TableEntry = { id: string; seat: Color | null; joinedAt: number };

const later = (name: string): never => {
  throw new Error(`${name}: not yet`);
};

export function loadTables(_storage: StorageLike | null): TableEntry[] {
  return later("loadTables");
}

export function rememberTable(
  _storage: StorageLike | null,
  _id: string,
  _seat: Color | null,
  _now: number,
): TableEntry[] {
  return later("rememberTable");
}

export function forgetTable(
  _storage: StorageLike | null,
  _id: string,
): { entry: TableEntry; index: number } | null {
  return later("forgetTable");
}

export function restoreTable(
  _storage: StorageLike | null,
  _entry: TableEntry,
  _index: number,
): TableEntry[] {
  return later("restoreTable");
}

export function rowText(_summary: TableSummary, _seat: Color | null): string {
  return later("rowText");
}

export function statusText(_status: TableStatus, _missingIsMe = false): string {
  return later("statusText");
}

export function timeAgo(_then: number, _now: number): string {
  return later("timeAgo");
}
