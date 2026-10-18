// GET /api/me (plans 04-01 and 04-02, ACCT-02; 04-RESEARCH Patterns 1 and 4): the signed-in account
// of the request's session cookie. 200 { id, pseudo, createdAt, passkeys, hasBackupCode, backupAt },
// or 401 { error: "signed-out" } (and, when a dead cookie came, a Set-Cookie that expires it). Never a
// token, a code or a MAC. Two D1 reads; a write only for the sliding refresh, at most once a week per
// device (auth/session.ts refresh). It changes nothing else: a GET has no other side effect (T-04-01).

import type { MeAccount } from "@toc/protocol";
import { clearCookie, hasCookie, refresh, sessionUser } from "./auth/session.ts";
import type { Meter } from "./db.ts";
import { json } from "./http.ts";

type PasskeyRow = {
  id: string;
  label: string | null;
  created_at: number;
  last_used_at: number | null;
  backed_up: number | null;
};

/** What an account answer needs of its user row. */
export type AccountUser = {
  id: string;
  pseudo: string;
  createdAt: number;
  hasBackupCode: boolean;
  backupAt: number | null;
};

/** The account as the page sees it, with its passkeys; `current` is the session's own passkey. */
export async function accountOf(
  meter: Meter,
  user: AccountUser,
  currentPasskey: string | null,
): Promise<MeAccount> {
  const passkeys = await meter.all<PasskeyRow>(
    meter
      .prepare(
        `SELECT id, label, created_at, last_used_at, backed_up FROM passkeys
          WHERE user_id = ? ORDER BY created_at, id`,
      )
      .bind(user.id),
  );
  return {
    id: user.id,
    pseudo: user.pseudo,
    createdAt: user.createdAt,
    passkeys: passkeys.results.map((row) => ({
      id: row.id,
      label: row.label ?? "Appareil",
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      backedUp: row.backed_up === 1,
      current: row.id === currentPasskey,
    })),
    hasBackupCode: user.hasBackupCode,
    backupAt: user.backupAt,
  };
}

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
  const renewed = await refresh(meter, request, url, env, user, now);
  const me = await accountOf(meter, user, user.passkeyId);
  return json(me, 200, renewed === null ? undefined : { "set-cookie": renewed });
}
