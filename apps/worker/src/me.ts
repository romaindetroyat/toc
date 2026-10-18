// GET /api/me (plan 04-01, ACCT-02; 04-RESEARCH Pattern 1): the signed-in account of the request's
// session cookie. 200 { id, pseudo, createdAt, passkeys, hasBackupCode, backupAt }, or 401
// { error: "signed-out" } (and, when a dead cookie came, a Set-Cookie that expires it). Never a token,
// a code or a MAC. Two D1 reads; nothing written (the sliding refresh comes with plan 04-02).

import type { MeAccount } from "@toc/protocol";
import { clearCookie, hasCookie, sessionUser } from "./auth/session.ts";
import type { Meter } from "./db.ts";
import { json } from "./http.ts";

type PasskeyRow = {
  id: string;
  label: string | null;
  created_at: number;
  last_used_at: number | null;
  backed_up: number | null;
};

export async function meRoute(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
): Promise<Response> {
  const user = await sessionUser(request, url, env, meter, now);
  if (user === null) {
    const headers = hasCookie(request, url, env)
      ? { "set-cookie": clearCookie(url, env) }
      : undefined;
    return json({ error: "signed-out" }, 401, headers);
  }
  const passkeys = await meter.all<PasskeyRow>(
    meter
      .prepare(
        `SELECT id, label, created_at, last_used_at, backed_up FROM passkeys
          WHERE user_id = ? ORDER BY created_at, id`,
      )
      .bind(user.id),
  );
  const me: MeAccount = {
    id: user.id,
    pseudo: user.pseudo,
    createdAt: user.createdAt,
    passkeys: passkeys.results.map((row) => ({
      id: row.id,
      label: row.label ?? "Appareil",
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      backedUp: row.backed_up === 1,
      current: row.id === user.passkeyId,
    })),
    hasBackupCode: user.hasBackupCode,
    backupAt: user.backupAt,
  };
  return json(me, 200);
}
