// « Mes résultats » from the page (plan 05-01, HIST-02): GET /api/me/results, one page of the
// signed-in player's finished games; plan 05-09: GET /api/me/stats and GET /api/me/ranking. fetch and the online flag are passed in (net/api.ts pattern), so
// the rules run under Node with fakes. The answer is untrusted: it is read with the shared schema
// (HistoryPage, StatsAnswer, RankingAnswer of @toc/protocol, strict), and anything out of shape is an
// error, never shown.

import {
  HISTORY_CURSOR_RE,
  type HistoryPage,
  parseHistoryPage,
  parseRankingAnswer,
  parseStatsAnswer,
  type RankingAnswer,
  type StatsAnswer,
} from "@toc/protocol";
import { type ApiDeps, browserApi } from "../net/api.ts";

/** An answer; or why there is none: signed out (401), no network, or anything else. */
export type Read<T> = T | "signed-out" | "offline" | "error";

/** A page of games, or why there is none. */
export type HistoryResult = Read<HistoryPage>;

/** GET `path`, its JSON read by `parse` (null when out of shape → "error"). */
async function read<T>(
  path: string,
  parse: (data: unknown) => T | null,
  deps: ApiDeps,
): Promise<Read<T>> {
  if (!deps.online()) return "offline";
  let response: Response;
  try {
    response = await deps.fetch(path, {
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
  return parse(body) ?? "error";
}

/** GET /api/me/results, the newest page, or the one after the cursor `before` (the last `next`). */
export async function history(
  before: string | null = null,
  deps: ApiDeps = browserApi,
): Promise<HistoryResult> {
  if (before !== null && !HISTORY_CURSOR_RE.test(before)) return "error";
  const query = before === null ? "" : `?before=${encodeURIComponent(before)}`;
  return read(`/api/me/results${query}`, parseHistoryPage, deps);
}

/** GET /api/me/stats (plan 05-09): « Mes chiffres » for the three filters at once. */
export function stats(deps: ApiDeps = browserApi): Promise<Read<StatsAnswer>> {
  return read("/api/me/stats", parseStatsAnswer, deps);
}

/** GET /api/me/ranking (plan 05-09): the signed-in player and their friends. */
export function ranking(deps: ApiDeps = browserApi): Promise<Read<RankingAnswer>> {
  return read("/api/me/ranking", parseRankingAnswer, deps);
}
