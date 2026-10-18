// GET /api/me (plans 04-01 and 04-02, ACCT-02; 04-RESEARCH Patterns 1 and 4): the signed-in account
// of the request's session cookie. 200 { id, pseudo, createdAt, passkeys, hasBackupCode, backupAt },
// or 401 { error: "signed-out" } (and, when a dead cookie came, a Set-Cookie that expires it). Never a
// token, a code or a MAC. Two D1 reads; a write only for the sliding refresh, at most once a week per
// device (auth/session.ts refresh). It changes nothing else: a GET has no other side effect (T-04-01).
// Plan 04-04: GET /api/me/tables and DELETE /api/me/tables/:id, the account's tables (members.ts).

import type { MeAccount } from "@toc/protocol";
import { clearCookie, hasCookie, refresh, sessionUser } from "./auth/session.ts";
import type { Meter } from "./db.ts";
import { json, notAllowed, writeAllowed } from "./http.ts";
import { forgetMyTableRoute, myTablesRoute } from "./members.ts";

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

/**
 * The account as the page sees it, with its passkeys newest first; `current` is the session's own
 * passkey (« cet appareil »), `backedUp` a synced one (« synchronisée »).
 */
export async function accountOf(
  meter: Meter,
  user: AccountUser,
  currentPasskey: string | null,
): Promise<MeAccount> {
  const passkeys = await meter.all<PasskeyRow>(
    meter
      .prepare(
        `SELECT id, label, created_at, last_used_at, backed_up FROM passkeys
          WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
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

/**
 * The account's tables (plan 04-04, members.ts): GET /api/me/tables, DELETE /api/me/tables/:id
 * (our non-null Origin first, no body, like DELETE /api/auth/passkeys/:id); null for another path.
 */
export async function meTablesRoute(
  request: Request,
  env: Env,
  url: URL,
  meter: Meter,
  now: number,
): Promise<Response | null> {
  if (url.pathname === "/api/me/tables") {
    if (request.method !== "GET" && request.method !== "HEAD") return notAllowed("GET");
    return myTablesRoute(request, env, url, meter, now);
  }
  const one = /^\/api\/me\/tables\/([^/]+)$/.exec(url.pathname);
  if (one === null) return null;
  if (request.method !== "DELETE") return notAllowed("DELETE");
  if (!writeAllowed(request, url)) return json({ error: "origin" }, 403);
  return forgetMyTableRoute(request, env, url, meter, now, one[1] ?? "");
}
