// The end plank's line about a solo game (plan 05-07; 05-UI-SPEC « What counts »): a signed-in player's
// real game, once won, goes to « Mes résultats » through the queue (pending.ts: queued first, so a page
// closed mid-request keeps it, then sent). The plank says « Partie ajoutée à tes résultats. » when the
// server has it and « Pas de connexion : … au retour du réseau. » without network; anything else says
// nothing (the queue retries in silence at the next start). Each game is reported once per page: a
// remount of the plank never sends it twice.

import type { SoloResult } from "../game/GameController.ts";
import { reportNow } from "./pending.ts";
import { soloReportOf } from "./solo.ts";

export type ReportStatus = "idle" | "added" | "offline";

/** The status of the last game reported, by its id. */
export const soloReport = $state<{ id: string | null; status: ReportStatus }>({
  id: null,
  status: "idle",
});

const reported = new Set<string>();

/** The status the plank shows for this game: idle until its own report has an answer. */
export function reportStatusOf(result: SoloResult | null): ReportStatus {
  return result !== null && soloReport.id === result.id ? soloReport.status : "idle";
}

/** Reports a finished real solo game for `account`, once per game id; never throws. */
export async function reportSolo(result: SoloResult | null, account: string): Promise<void> {
  if (result === null || reported.has(result.id)) return;
  reported.add(result.id);
  const report = soloReportOf(result);
  if (report === null) return;
  soloReport.id = result.id;
  soloReport.status = "idle";
  try {
    const sent = await reportNow({ account, report });
    if (soloReport.id !== result.id) return;
    soloReport.status =
      sent === "added" || sent === "already" ? "added" : sent === "offline" ? "offline" : "idle";
  } catch {
    // A failure says nothing: the game waits in the queue for the next start.
  }
}
