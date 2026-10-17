// The two HTTP calls of the online table (plan 02-04): POST /api/tables (a new table) and
// GET /api/tables/:id (its public summary). The fetch and the browser's online flag are passed in, so
// the rules run under Node with a fake.

import type { TableSummary } from "@toc/protocol";

export type ApiDeps = {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  /** navigator.onLine: false means the device knows it has no network. */
  online: () => boolean;
};

export type CreateResult = { ok: true; id: string } | { ok: false; reason: "offline" | "server" };

export async function createTable(_deps?: ApiDeps): Promise<CreateResult> {
  throw new Error("createTable: not yet");
}

export async function tableSummary(
  _id: string,
  _deps?: ApiDeps,
): Promise<TableSummary | "gone" | "unknown"> {
  throw new Error("tableSummary: not yet");
}
