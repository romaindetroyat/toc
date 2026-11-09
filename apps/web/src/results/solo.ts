// A solo game into « Mes résultats » (plan 05-07, D-01; 05-RESEARCH Pattern 2): the controller's
// result of a real deal, won, in the shape the Worker checks (SoloReport of @toc/protocol, 05-05), and
// POST /api/me/results/solo. The game is client-claimed: the server checks it again, counts it for the
// player alone and never ranks it. The report holds no name: the player is the session's account, the
// computers are their levels. fetch and the online flag are passed in (net/api.ts pattern).

import { parseSoloReport, type SoloReport } from "@toc/protocol";
import type { SoloResult } from "../game/GameController.ts";
import { type ApiDeps, browserApi } from "../net/api.ts";

export const SOLO_URL = "/api/me/results/solo";

/**
 * What the server's answer means for the game waiting on the device:
 * - added (201) and already (200, sent before): it is in the results, the queue lets it go;
 * - refused (400, 413, 415): the server will never take this body, the queue drops it;
 * - signed-out (401), later (403, 429, 5xx, anything else) and offline (no answer): it waits.
 */
export type SoloSent = "added" | "already" | "refused" | "signed-out" | "later" | "offline";

/** The report of a result, checked with the Worker's own schema; null (never sent) when out of shape. */
export function soloReportOf(result: SoloResult): SoloReport | null {
  return parseSoloReport({
    id: result.id,
    startedAt: result.startedAt,
    endedAt: result.endedAt,
    human: result.human,
    winner: result.winner,
    deals: result.deals,
    levels: { ...result.levels },
    seats: {
      bleu: { ...result.seats.bleu },
      jaune: { ...result.seats.jaune },
      rouge: { ...result.seats.rouge },
      vert: { ...result.seats.vert },
    },
  });
}

/** POST /api/me/results/solo with the session cookie; our Origin is the browser's own. */
export async function sendSoloReport(
  report: SoloReport,
  deps: ApiDeps = browserApi,
): Promise<SoloSent> {
  if (!deps.online()) return "offline";
  let response: Response;
  try {
    response = await deps.fetch(SOLO_URL, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify(report),
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    return "offline";
  }
  switch (response.status) {
    case 201:
      return "added";
    case 200:
      return "already";
    case 400:
    case 413:
    case 415:
      return "refused";
    case 401:
      return "signed-out";
    default:
      return "later";
  }
}
