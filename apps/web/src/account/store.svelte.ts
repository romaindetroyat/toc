// The signed-in account of this page (plan 04-01, ACCT-02; 04-UI-SPEC « Home: states »): null for a
// guest, else { id, pseudo }. At start the cached copy (toc.me.v1, display only) shows at once, then
// GET /api/me confirms it: an account replaces it, a 401 clears it, and no network keeps it. With no
// Worker behind the page (the local preview: a 404 or HTML), the guest state stays, without a strip
// or an error. The session itself is the HttpOnly cookie, out of this code's reach. Plan 04-02:
// signedIn(me) after a login, signedOut() after « Se déconnecter » (pass it as logOut's `forget`).

import { type ApiDeps, browserApi } from "../net/api.ts";
import { me } from "./api.ts";
import {
  type AccountStorage,
  type CachedAccount,
  readCachedAccount,
  writeCachedAccount,
} from "./cache.ts";

export const account = $state<{
  current: CachedAccount | null;
  /**
   * Plan 04-08: false when the last GET /api/me failed on the network (no answer at all), the home's
   * offline strip; a 404 or a non-JSON answer (the local preview, no Worker) is an answer.
   */
  reachable: boolean;
}>({ current: null, reachable: true });

/** browserApi, noting whether the request got no answer at all. */
function watched(): { deps: ApiDeps; threw: () => boolean } {
  let threw = false;
  return {
    deps: {
      online: browserApi.online,
      fetch: async (input, init) => {
        try {
          return await browserApi.fetch(input, init);
        } catch (error) {
          threw = true;
          throw error;
        }
      },
    },
    threw: () => threw,
  };
}

function storage(): AccountStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

let started = false;

/** Once per page, from App.svelte: the cached account now, the server's answer next. */
export function startAccount(): void {
  if (started) return;
  started = true;
  account.current = readCachedAccount(storage());
  void refreshAccount();
  // Back online (plan 04-08, 04-UI-SPEC « Offline »): the account is asked again, the strip goes.
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => void refreshAccount());
  }
}

/** GET /api/me again (after a sign-up, a return online). */
export async function refreshAccount(): Promise<void> {
  const call = watched();
  const answer = await me(call.deps);
  account.reachable = !call.threw();
  if (answer === "offline") return;
  if (answer === null) {
    account.current = null;
    writeCachedAccount(storage(), null);
    return;
  }
  setAccount(answer);
}

/** The account a sign-up just made, or GET /api/me's. */
export function setAccount(next: { id: string; pseudo: string }): void {
  account.current = { id: next.id, pseudo: next.pseudo };
  writeCachedAccount(storage(), account.current);
}

/** Signed in on this device (plan 04-02: a login, a new key). */
export function signedIn(me: { id: string; pseudo: string }): void {
  setAccount(me);
}

/** Signed out on this device (plan 04-02, D-12): the account and its cached copy toc.me.v1 go. */
export function signedOut(): void {
  account.current = null;
  writeCachedAccount(storage(), null);
}
