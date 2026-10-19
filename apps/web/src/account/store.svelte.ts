// The signed-in account of this page (plan 04-01, ACCT-02; 04-UI-SPEC « Home: states »): null for a
// guest, else { id, pseudo }. At start the cached copy (toc.me.v1, display only) shows at once, then
// GET /api/me confirms it: an account replaces it, a 401 clears it, and no network keeps it. With no
// Worker behind the page (the local preview: a 404 or HTML), the guest state stays, without a strip
// or an error. The session itself is the HttpOnly cookie, out of this code's reach. Plan 04-02:
// signedIn(me) after a login, signedOut() after « Se déconnecter » (pass it as logOut's `forget`).
// Plan 04-09: the sign-in sheet's place (one sheet for the whole app, opened from the home's tile,
// « J’ai déjà un compte », an used invitation, the session-ended toast), and the end of a session: a
// 401 on an account call while this page believed it signed in clears the account and says once
// « Ta session a pris fin : connecte-toi de nouveau. » with « Se connecter ».

import { compte } from "../i18n/fr/compte.ts";
import { type ApiDeps, browserApi } from "../net/api.ts";
import { showToast } from "../ui/toast.svelte.ts";
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

/** browserApi, noting whether the request got no answer at all, and the status of the one it got. */
function watched(): { deps: ApiDeps; threw: () => boolean; status: () => number | null } {
  let threw = false;
  let status: number | null = null;
  return {
    deps: {
      online: browserApi.online,
      fetch: async (input, init) => {
        try {
          const response = await browserApi.fetch(input, init);
          status = response.status;
          return response;
        } catch (error) {
          threw = true;
          throw error;
        }
      },
    },
    threw: () => threw,
    status: () => status,
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

/** The session-ended toast was shown since the last sign-in (plan 04-09: it is said once). */
let endedSaid = false;

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
    // A 401 where this page believed it signed in: the session ended (another device recovered the
    // account, or the session expired). A 404 or HTML (no Worker behind the page) only clears.
    if (call.status() === 401) sessionEnded();
    else signedOut();
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
  endedSaid = false;
  setAccount(me);
}

/** Signed out on this device (plan 04-02, D-12): the account and its cached copy toc.me.v1 go. */
export function signedOut(): void {
  account.current = null;
  writeCachedAccount(storage(), null);
}

// --- Plan 04-09: the end of a session, the sign-in sheet ---

/**
 * A 401 on an account call (04-UI-SPEC « Home: states »): signed out on this device; when the page
 * believed it signed in, the toast « Ta session a pris fin : connecte-toi de nouveau. » once, with
 * « Se connecter », which opens the sign-in sheet.
 */
export function sessionEnded(): void {
  const was = account.current !== null;
  signedOut();
  if (!was || endedSaid) return;
  endedSaid = true;
  showToast(compte.session.ended, { label: compte.session.signIn, run: () => openSignIn() });
}

/** The sign-in sheet « Se connecter », mounted once by App.svelte. */
export const signInSheet = $state<{
  open: boolean;
  /** The control that opened it: the focus goes back there when it closes without a sign-in. */
  opener: HTMLElement | null;
  /** Runs after a sign-in (the invitation page loads its signed-in case). */
  after: (() => void) | null;
}>({ open: false, opener: null, after: null });

export function openSignIn(opener: HTMLElement | null = null, after: (() => void) | null = null) {
  signInSheet.opener = opener;
  signInSheet.after = after;
  signInSheet.open = true;
}

export function closeSignIn(): void {
  signInSheet.open = false;
  signInSheet.after = null;
}

/**
 * A page for signed-in players met no session (plan 04-10: « Mon compte », « Mes amis »; 04-UI-SPEC
 * « States »): the account goes, the home opens with the sign-in sheet, and the toast « Ta session a
 * pris fin : connecte-toi de nouveau. » with « Se connecter ».
 */
export function requireSignIn(): void {
  signedOut();
  location.hash = "#/";
  openSignIn();
  showToast(compte.session.ended, { label: compte.session.signIn, run: () => openSignIn() });
}
