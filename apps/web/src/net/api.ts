// The two HTTP calls of the online table (plan 02-04): POST /api/tables (a new table) and
// GET /api/tables/:id (its public summary). The fetch and the browser's online flag are passed in, so
// the rules run under Node with a fake. Every answer is untrusted: the id is checked with isTableId and
// the summary with the shared schema (parseTableSummary).

import { isTableId, parseTableSummary, type TableSummary } from "@toc/protocol";

export type ApiDeps = {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
  /** navigator.onLine: false means the device knows it has no network. */
  online: () => boolean;
};

export type CreateResult = { ok: true; id: string } | { ok: false; reason: "offline" | "server" };

/** The page's own fetch and online flag. */
export const browserApi: ApiDeps = {
  fetch: (input, init) => fetch(input, init),
  online: () => typeof navigator === "undefined" || navigator.onLine !== false,
};

async function bodyOf(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/** POST /api/tables: the new table's id, or why there is none (offline, or the server's fault). */
export async function createTable(deps: ApiDeps = browserApi): Promise<CreateResult> {
  if (!deps.online()) return { ok: false, reason: "offline" };
  let response: Response;
  try {
    response = await deps.fetch("/api/tables", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
  } catch {
    return { ok: false, reason: "offline" };
  }
  if (response.status !== 201) return { ok: false, reason: "server" };
  const body = await bodyOf(response);
  const id = typeof body === "object" && body !== null ? (body as { id?: unknown }).id : undefined;
  return isTableId(id) ? { ok: true, id } : { ok: false, reason: "server" };
}

/**
 * GET /api/tables/:id: the public summary, "gone" when the table does not exist (the Worker's 404, or
 * an id that cannot be one), "unknown" when the answer cannot be had (offline, a server error, another
 * 404, not a summary).
 */
export async function tableSummary(
  id: string,
  deps: ApiDeps = browserApi,
): Promise<TableSummary | "gone" | "unknown"> {
  if (!isTableId(id)) return "gone";
  if (!deps.online()) return "unknown";
  let response: Response;
  try {
    response = await deps.fetch(`/api/tables/${id}`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return "unknown";
  }
  const body = await bodyOf(response);
  // Only the Worker's own 404 erases a table from the list: a 404 page from anything else on the way
  // (a captive portal, a misrouted host) leaves the state unknown.
  if (response.status === 404) {
    const error =
      typeof body === "object" && body !== null ? (body as { error?: unknown }).error : null;
    return error === "not-found" ? "gone" : "unknown";
  }
  if (response.status !== 200) return "unknown";
  return parseTableSummary(body) ?? "unknown";
}
