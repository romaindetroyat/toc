// « Mes résultats » from the page (plan 05-01, HIST-02): GET /api/me/results, one page of the
// signed-in player's finished games. fetch and the online flag are passed in (net/api.ts pattern), so
// the rules run under Node with fakes. The answer is untrusted: it is read with the shared schema
// (HistoryPage of @toc/protocol, strict), and anything out of shape is an error, never shown.

import { HISTORY_CURSOR_RE, type HistoryPage, parseHistoryPage } from "@toc/protocol";
import { type ApiDeps, browserApi } from "../net/api.ts";

/** A page of games; or why there is none: signed out (401), no network, or anything else. */
export type HistoryResult = HistoryPage | "signed-out" | "offline" | "error";

/** GET /api/me/results, the newest page, or the one after the cursor `before` (the last `next`). */
export async function history(
  before: string | null = null,
  deps: ApiDeps = browserApi,
): Promise<HistoryResult> {
  if (before !== null && !HISTORY_CURSOR_RE.test(before)) return "error";
  if (!deps.online()) return "offline";
  const query = before === null ? "" : `?before=${encodeURIComponent(before)}`;
  let response: Response;
  try {
    response = await deps.fetch(`/api/me/results${query}`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return "offline";
  }
  if (response.status === 401) return "signed-out";
  if (response.status !== 200) return "error";
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return "error";
  }
  return parseHistoryPage(body) ?? "error";
}
