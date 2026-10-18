// The account calls of the page (plans 04-01 and 04-02, ACCT-01, ACCT-02, D-02, D-12): the state of
// an invitation link, the sign-up (options, the passkey, verify), GET /api/me, and since 04-02 the
// login (usernameless), the logout, adding and removing a passkey and a new backup code (step-up). fetch, the online flag and the passkey
// ceremony are passed in, so the rules run under Node with fakes (net/api.ts pattern). Every answer
// is untrusted and read with the shared schemas of @toc/protocol. The session is an HttpOnly cookie
// the browser keeps and sends by itself: no token ever reaches this code.

import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import {
  type InvitationState,
  isInvitationCode,
  type MeAccount,
  type PasskeyInfo,
  parseAddPasskeyAnswer,
  parseBackupCodeAnswer,
  parseCreationOptions,
  parseInvitationState,
  parseLoginAnswer,
  parseMeAccount,
  parseRequestOptions,
  parseSignupAnswer,
} from "@toc/protocol";
import { type ApiDeps, browserApi } from "../net/api.ts";
import { writeCachedAccount } from "./cache.ts";
import {
  browserCeremonies,
  type Ceremonies,
  createPasskey,
  getPasskey,
  type PasskeyFailure,
} from "./webauthn.ts";

async function bodyOf(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

const errorOf = (body: unknown): unknown =>
  typeof body === "object" && body !== null ? (body as { error?: unknown }).error : undefined;

/** The invitation's state, or "offline" when it cannot be had now (no network, the server failing). */
export type InvitationView = InvitationState | { state: "offline" };

/** GET /api/invitations/<code>. */
export async function invitationState(
  code: string,
  deps: ApiDeps = browserApi,
): Promise<InvitationView> {
  if (!isInvitationCode(code)) return { state: "unknown" };
  if (!deps.online()) return { state: "offline" };
  let response: Response;
  try {
    response = await deps.fetch(`/api/invitations/${code}`, {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return { state: "offline" };
  }
  if (response.status >= 500) return { state: "offline" };
  if (response.status !== 200) return { state: "unknown" };
  return parseInvitationState(await bodyOf(response)) ?? { state: "unknown" };
}

export type SignUpFailure =
  | "pseudo"
  | "taken"
  | "taken-meanwhile"
  | "used"
  | "expired"
  | "unknown"
  | PasskeyFailure
  | "offline";

export type SignUpResult =
  | { ok: true; me: MeAccount; backupCode: string }
  | { ok: false; reason: SignUpFailure };

const post = (deps: ApiDeps, url: string, body: unknown) =>
  deps.fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

const INVITATION_ERRORS = new Set(["used", "expired", "unknown"]);

/**
 * The whole sign-up: POST /api/auth/signup/options, the passkey with { optionsJSON }, then POST
 * /api/auth/signup/verify. The account and the backup code (shown once), or why not.
 */
export async function signUp(
  code: string,
  pseudo: string,
  deps: { api?: ApiDeps; passkeys?: Ceremonies } = {},
): Promise<SignUpResult> {
  const api = deps.api ?? browserApi;
  const passkeys = deps.passkeys ?? browserCeremonies;
  if (!passkeys.supported()) return { ok: false, reason: "unsupported" };
  if (!api.online()) return { ok: false, reason: "offline" };

  let opened: Response;
  try {
    opened = await post(api, "/api/auth/signup/options", { invitation: code, pseudo });
  } catch {
    return { ok: false, reason: "offline" };
  }
  const openedBody = await bodyOf(opened);
  if (opened.status !== 200) {
    const error = errorOf(openedBody);
    if (opened.status === 400 && error === "pseudo") return { ok: false, reason: "pseudo" };
    if (opened.status === 409) return { ok: false, reason: "taken" };
    if (opened.status === 410 && typeof error === "string" && INVITATION_ERRORS.has(error)) {
      return { ok: false, reason: error as "used" | "expired" | "unknown" };
    }
    return { ok: false, reason: "server" };
  }
  const options = parseCreationOptions(openedBody);
  if (options === null) return { ok: false, reason: "server" };

  const passkey = await createPasskey(
    options as unknown as PublicKeyCredentialCreationOptionsJSON,
    passkeys,
  );
  if (!passkey.ok) return { ok: false, reason: passkey.reason };

  let verified: Response;
  try {
    verified = await post(api, "/api/auth/signup/verify", { response: passkey.response });
  } catch {
    return { ok: false, reason: "offline" };
  }
  const verifiedBody = await bodyOf(verified);
  if (verified.status === 201) {
    const answer = parseSignupAnswer(verifiedBody);
    return answer === null
      ? { ok: false, reason: "server" }
      : { ok: true, me: answer.me, backupCode: answer.backupCode };
  }
  const error = errorOf(verifiedBody);
  if (verified.status === 409) return { ok: false, reason: "taken-meanwhile" };
  if (verified.status === 410 && typeof error === "string" && INVITATION_ERRORS.has(error)) {
    return { ok: false, reason: error as "used" | "expired" | "unknown" };
  }
  return { ok: false, reason: "server" };
}

/**
 * GET /api/me: the account; null when signed out (401) or when there is no Worker behind the page
 * (a 404 or an answer that is not an account: the local preview); "offline" when it cannot be known
 * now (no network, a server error), so the cached account stays.
 */
export async function me(deps: ApiDeps = browserApi): Promise<MeAccount | null | "offline"> {
  if (!deps.online()) return "offline";
  let response: Response;
  try {
    response = await deps.fetch("/api/me", {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return "offline";
  }
  if (response.status >= 500) return "offline";
  if (response.status !== 200) return null;
  return parseMeAccount(await bodyOf(response));
}

// --- Plan 04-02: sign in, sign out, the passkeys, a new backup code ---

/** Why an account call did not go through; the page has a sentence for each (04-UI-SPEC). */
export type AccountFailure =
  | "cancelled"
  | "unknown"
  | "expired"
  | "already-here"
  | "last"
  | "wrong-address"
  | "unsupported"
  | "offline"
  | "server"
  | "signed-out";

export type AccountResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; reason: AccountFailure };

type Answer = { status: number; body: unknown };

/** A POST of JSON; null when the network failed. */
async function postJson(api: ApiDeps, url: string, body: unknown): Promise<Answer | null> {
  try {
    const response = await post(api, url, body);
    return { status: response.status, body: await bodyOf(response) };
  } catch {
    return null;
  }
}

/** The refusals every signed-in call shares: 401 signed-out, a known error code, else server. */
function refusal(answer: Answer, known: Partial<Record<string, AccountFailure>>): AccountFailure {
  if (answer.status === 401) return "signed-out";
  const error = errorOf(answer.body);
  if (answer.status < 500 && typeof error === "string") return known[error] ?? "server";
  return "server";
}

type Deps = { api?: ApiDeps; passkeys?: Ceremonies };

/**
 * Signing in on this device, without a pseudo: POST /api/auth/login/options {}, the passkey's
 * assertion with { optionsJSON } (on a computer the browser offers the phone through a QR code), then
 * POST /api/auth/login/verify. The account, or why not.
 */
export async function logIn(deps: Deps = {}): Promise<AccountResult<{ me: MeAccount }>> {
  const api = deps.api ?? browserApi;
  const passkeys = deps.passkeys ?? browserCeremonies;
  if (!passkeys.supported()) return { ok: false, reason: "unsupported" };
  if (!api.online()) return { ok: false, reason: "offline" };

  const opened = await postJson(api, "/api/auth/login/options", {});
  if (opened === null) return { ok: false, reason: "offline" };
  const options = opened.status === 200 ? parseRequestOptions(opened.body) : null;
  if (options === null) return { ok: false, reason: "server" };

  const assertion = await getPasskey(
    options as unknown as PublicKeyCredentialRequestOptionsJSON,
    passkeys,
  );
  if (!assertion.ok) return { ok: false, reason: assertion.reason };

  const verified = await postJson(api, "/api/auth/login/verify", { response: assertion.response });
  if (verified === null) return { ok: false, reason: "offline" };
  if (verified.status === 200) {
    const answer = parseLoginAnswer(verified.body);
    return answer === null ? { ok: false, reason: "server" } : { ok: true, me: answer.me };
  }
  return { ok: false, reason: refusal(verified, { unknown: "unknown", expired: "expired" }) };
}

function browserStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/**
 * « Se déconnecter » (D-12): POST /api/auth/logout {}. This device forgets the account (toc.me.v1, and
 * the page's store through `forget`) whatever the network says; the answer says whether the server
 * ended the session too.
 */
export async function logOut(
  deps: { api?: ApiDeps; forget?: () => void } = {},
): Promise<AccountResult> {
  const api = deps.api ?? browserApi;
  const forget = deps.forget ?? (() => writeCachedAccount(browserStorage(), null));
  try {
    if (!api.online()) return { ok: false, reason: "offline" };
    const answer = await postJson(api, "/api/auth/logout", {});
    if (answer === null) return { ok: false, reason: "offline" };
    return answer.status === 204 ? { ok: true } : { ok: false, reason: "server" };
  } finally {
    forget();
  }
}

/**
 * « Ajouter une clé d’accès »: POST /api/auth/passkeys/options {}, the registration with
 * { optionsJSON } (a device that already holds a key of the account: already-here), then POST
 * /api/auth/passkeys/verify. The new key, or why not.
 */
export async function addPasskey(
  deps: Deps = {},
): Promise<AccountResult<{ passkey: PasskeyInfo }>> {
  const api = deps.api ?? browserApi;
  const passkeys = deps.passkeys ?? browserCeremonies;
  if (!passkeys.supported()) return { ok: false, reason: "unsupported" };
  if (!api.online()) return { ok: false, reason: "offline" };

  const opened = await postJson(api, "/api/auth/passkeys/options", {});
  if (opened === null) return { ok: false, reason: "offline" };
  if (opened.status !== 200) return { ok: false, reason: refusal(opened, {}) };
  const options = parseCreationOptions(opened.body);
  if (options === null) return { ok: false, reason: "server" };

  const created = await createPasskey(
    options as unknown as PublicKeyCredentialCreationOptionsJSON,
    passkeys,
  );
  if (!created.ok) return { ok: false, reason: created.reason };

  const verified = await postJson(api, "/api/auth/passkeys/verify", { response: created.response });
  if (verified === null) return { ok: false, reason: "offline" };
  if (verified.status === 201) {
    const answer = parseAddPasskeyAnswer(verified.body);
    return answer === null
      ? { ok: false, reason: "server" }
      : { ok: true, passkey: answer.passkey };
  }
  return {
    ok: false,
    reason: refusal(verified, { "already-here": "already-here", expired: "expired" }),
  };
}

const CREDENTIAL_ID_RE = /^[A-Za-z0-9_-]{1,1024}$/;

/** « Retirer la clé »: DELETE /api/auth/passkeys/<id>, never the last (last). */
export async function removePasskey(id: string, api: ApiDeps = browserApi): Promise<AccountResult> {
  if (!CREDENTIAL_ID_RE.test(id)) return { ok: false, reason: "unknown" };
  if (!api.online()) return { ok: false, reason: "offline" };
  let response: Response;
  try {
    response = await api.fetch(`/api/auth/passkeys/${id}`, {
      method: "DELETE",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "offline" };
  }
  if (response.status === 204) return { ok: true };
  if (response.status === 404) return { ok: false, reason: "unknown" };
  return {
    ok: false,
    reason: refusal({ status: response.status, body: await bodyOf(response) }, { last: "last" }),
  };
}

/**
 * « Créer un nouveau code » (D-02): POST /api/auth/backup-code/options {}, a fresh assertion of one
 * of the account's passkeys (the step-up), then POST /api/auth/backup-code/verify. The new code,
 * shown once, or why not (a key of another account: unknown).
 */
export async function newBackupCode(
  deps: Deps = {},
): Promise<AccountResult<{ backupCode: string }>> {
  const api = deps.api ?? browserApi;
  const passkeys = deps.passkeys ?? browserCeremonies;
  if (!passkeys.supported()) return { ok: false, reason: "unsupported" };
  if (!api.online()) return { ok: false, reason: "offline" };

  const opened = await postJson(api, "/api/auth/backup-code/options", {});
  if (opened === null) return { ok: false, reason: "offline" };
  if (opened.status !== 200) return { ok: false, reason: refusal(opened, {}) };
  const options = parseRequestOptions(opened.body);
  if (options === null) return { ok: false, reason: "server" };

  const assertion = await getPasskey(
    options as unknown as PublicKeyCredentialRequestOptionsJSON,
    passkeys,
  );
  if (!assertion.ok) return { ok: false, reason: assertion.reason };

  const verified = await postJson(api, "/api/auth/backup-code/verify", {
    response: assertion.response,
  });
  if (verified === null) return { ok: false, reason: "offline" };
  if (verified.status === 200) {
    const answer = parseBackupCodeAnswer(verified.body);
    return answer === null
      ? { ok: false, reason: "server" }
      : { ok: true, backupCode: answer.backupCode };
  }
  return { ok: false, reason: refusal(verified, { refused: "unknown", expired: "expired" }) };
}
