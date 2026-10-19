// The table's SQLite storage inside its Durable Object (02-RESEARCH Pattern 2): one snapshot row, the
// whole table as JSON, rewritten once per accepted change, and a server-only event log (the raw events
// with every hand: never sent to anyone, kept for replay and phase 5).
// Every function is synchronous: a commit's statements run with no await between them, so the runtime
// submits them as one atomic batch.

import { copyTable, type LogEntry, type Table } from "@toc/table";

export function createSchema(sql: SqlStorage): void {
  sql.exec(
    `CREATE TABLE IF NOT EXISTS snapshot (
       id INTEGER PRIMARY KEY CHECK (id = 1),
       seq INTEGER NOT NULL,
       table_json TEXT NOT NULL
     )`,
  );
  sql.exec(
    `CREATE TABLE IF NOT EXISTS events (
       seq INTEGER PRIMARY KEY,
       game_no INTEGER NOT NULL,
       seat TEXT,
       action TEXT,
       events TEXT NOT NULL,
       at INTEGER NOT NULL,
       bot TEXT
     )`,
  );
}

/** Whether this object holds a table: read from sqlite_master, so an unknown id writes nothing. */
export function hasTable(sql: SqlStorage): boolean {
  return (
    sql.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'snapshot'").toArray()
      .length > 0
  );
}

/**
 * The stored table, brought up to date by copyTable (a snapshot written by an older version gets the
 * fields and rule switches it lacks, plan 04-14: the G18 flag on its knights), so every frame built
 * from the cached snapshot reads the same table as the reducer.
 */
export function load(sql: SqlStorage): Table | null {
  if (!hasTable(sql)) return null;
  const row = sql.exec("SELECT table_json FROM snapshot WHERE id = 1").toArray()[0];
  return row === undefined ? null : copyTable(JSON.parse(String(row.table_json)) as Table);
}

/**
 * The new snapshot and the log lines of one reduce, in one synchronous batch. Returns the rows written
 * (Free plan: 100 000 a day; a computer's level, slices and fallback go with its log line).
 */
export function commit(
  sql: SqlStorage,
  table: Table,
  log: readonly LogEntry[],
  at: number,
): number {
  let rows = 0;
  rows += sql.exec(
    `INSERT INTO snapshot (id, seq, table_json) VALUES (1, ?, ?)
     ON CONFLICT (id) DO UPDATE SET seq = excluded.seq, table_json = excluded.table_json`,
    table.seq,
    JSON.stringify(table),
  ).rowsWritten;
  for (const entry of log) {
    rows += sql.exec(
      "INSERT OR REPLACE INTO events (seq, game_no, seat, action, events, at, bot) VALUES (?, ?, ?, ?, ?, ?, ?)",
      entry.seq,
      entry.gameNo,
      entry.seat,
      entry.action === null ? null : JSON.stringify(entry.action),
      JSON.stringify(entry.events),
      at,
      entry.bot === undefined ? null : JSON.stringify(entry.bot),
    ).rowsWritten;
  }
  return rows;
}
