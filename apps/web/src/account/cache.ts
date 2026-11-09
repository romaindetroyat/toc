// The account the home shows at once on a cold start (plan 04-01; 04-UI-SPEC « Home: states »):
// toc.me.v1 holds the id and the pseudo only, for display; GET /api/me confirms it, and a 401 clears
// it. It proves nothing (the session is the HttpOnly cookie) and is untrusted when read back: a value
// that is not an account is dropped. Storage may throw (private browsing, a full disk): never fatal.

import { normalizePseudo, TABLE_ID_RE } from "@toc/protocol";

export const ME_KEY = "toc.me.v1";

export type CachedAccount = { id: string; pseudo: string };

export type AccountStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readCachedAccount(storage: AccountStorage | null): CachedAccount | null {
  let raw: unknown;
  try {
    const text = storage?.getItem(ME_KEY);
    raw = text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const { id, pseudo } = raw as Record<string, unknown>;
  // Account ids are 16 random bytes in base64url, the shape of a table id.
  if (typeof id !== "string" || !TABLE_ID_RE.test(id)) return null;
  const checked = normalizePseudo(pseudo);
  if (!checked.ok || checked.pseudo !== pseudo) return null;
  return { id, pseudo: checked.pseudo };
}

export function writeCachedAccount(
  storage: AccountStorage | null,
  account: CachedAccount | null,
): void {
  try {
    if (account === null) storage?.removeItem(ME_KEY);
    else storage?.setItem(ME_KEY, JSON.stringify({ id: account.id, pseudo: account.pseudo }));
  } catch {
    // The account is still shown for this page; the next start asks the server.
  }
}
