// The account calls of the page (plans 04-01 to 04-03, ACCT-01, ACCT-02, D-02, D-12): the state of
// an invitation link, the sign-up (options, the passkey, verify), GET /api/me; since 04-02 the login
// (usernameless), the logout, adding and removing a passkey and a new backup code (step-up); since
// 04-03 the recovery with the backup code (« Retrouver mon compte »); since 04-04 the account's tables;
// since 04-05 the invitation links, the friend codes and the friends list. fetch, the online flag and the
// passkey ceremony are passed in, so the rules run under Node with fakes (net/api.ts pattern). Every
// answer is untrusted and read with the shared schemas of @toc/protocol. The session is an HttpOnly
// cookie the browser keeps and sends by itself: no token ever reaches this code.

import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import {
  type AccountTable,
  type CreatedInvitation,
  type CreationOptions,
  type FriendEntry,
  type InvitationState,
  isInvitationCode,
  isTableId,
  type MeAccount,
  normalizeBackupCode,
  normalizeFriendCode,
  type PasskeyInfo,
  type PendingInvitation,
  parseAccountTables,
  parseAddPasskeyAnswer,
  parseBackupCodeAnswer,
  parseCreatedInvitation,
  parseCreationOptions,
  parseFriendAnswer,
  parseFriendCodeAnswer,
  parseFriends,
  parseInvitationState,
  parseLoginAnswer,
  parseMeAccount,
  parsePendingInvitations,
  parseRecoverAnswer,
  parseRecoverRefusal,
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

// --- Plan 04-03: « Retrouver mon compte » with the backup code (D-02) ---

/** Why the pseudo and the code did not open the account (04-UI-SPEC « Recovery », step 1). */
export type RecoverFailure = "format" | "wrong" | "offline" | "server";

export type RecoverResult =
  | { ok: true; optionsJSON: CreationOptions }
  | { ok: false; reason: "locked"; until: number }
  | { ok: false; reason: RecoverFailure };

/**
 * Step 1: POST /api/auth/recover { pseudo, code }. The code is read back first (upper case, no dashes
 * or spaces, O for 0, I and L for 1); one that cannot be a code is « format » without a request.
 * The creation options of the account's new passkey (step 2: recoverVerify), or why not: wrong (no
 * such pseudo, or not its code: the server never says which), locked until a time, offline, server.
 */
export async function recover(
  pseudo: string,
  code: string,
  api: ApiDeps = browserApi,
): Promise<RecoverResult> {
  const canonical = normalizeBackupCode(code);
  if (canonical === null) return { ok: false, reason: "format" };
  if (!api.online()) return { ok: false, reason: "offline" };
  const answer = await postJson(api, "/api/auth/recover", { pseudo, code: canonical });
  if (answer === null) return { ok: false, reason: "offline" };
  if (answer.status === 200) {
    const options = parseCreationOptions(answer.body);
    return options === null ? { ok: false, reason: "server" } : { ok: true, optionsJSON: options };
  }
  const refusal = answer.status < 500 ? parseRecoverRefusal(answer.body) : null;
  if (refusal === null) return { ok: false, reason: "server" };
  if (refusal.error === "locked") {
    return answer.status === 429
      ? { ok: false, reason: "locked", until: refusal.until }
      : { ok: false, reason: "server" };
  }
  return answer.status === 400
    ? { ok: false, reason: refusal.error }
    : { ok: false, reason: "server" };
}

/** Why the new passkey did not finish the recovery (step 2): expired is « Le délai de 5 minutes est passé ». */
export type RecoverVerifyFailure = PasskeyFailure | "expired" | "offline";

export type RecoverVerifyResult =
  | { ok: true; me: MeAccount; backupCode: string }
  | { ok: false; reason: RecoverVerifyFailure };

/**
 * Step 2: the passkey's registration with the options of step 1, then POST /api/auth/recover/verify.
 * The account (now signed in on this device only: every other session ended) and its new backup code,
 * shown once (step 3), or why not. The old code stays valid until this succeeds.
 */
export async function recoverVerify(
  optionsJSON: CreationOptions,
  deps: Deps = {},
): Promise<RecoverVerifyResult> {
  const api = deps.api ?? browserApi;
  const passkeys = deps.passkeys ?? browserCeremonies;
  if (!passkeys.supported()) return { ok: false, reason: "unsupported" };
  if (!api.online()) return { ok: false, reason: "offline" };

  const created = await createPasskey(
    optionsJSON as unknown as PublicKeyCredentialCreationOptionsJSON,
    passkeys,
  );
  if (!created.ok) return { ok: false, reason: created.reason };

  const verified = await postJson(api, "/api/auth/recover/verify", { response: created.response });
  if (verified === null) return { ok: false, reason: "offline" };
  if (verified.status === 200) {
    const answer = parseRecoverAnswer(verified.body);
    return answer === null
      ? { ok: false, reason: "server" }
      : { ok: true, me: answer.me, backupCode: answer.backupCode };
  }
  const error = errorOf(verified.body);
  if (verified.status === 400 && error === "expired") return { ok: false, reason: "expired" };
  if (verified.status === 409 && error === "already-here") {
    return { ok: false, reason: "already-here" };
  }
  return { ok: false, reason: "server" };
}

// --- Plan 04-04: the account's tables (« Mes parties en cours » on every device, ACCT-02) ---

/**
 * GET /api/me/tables: the account's tables, newest first; null when signed out, offline, failing or
 * answered out of shape (the device's own list is shown alone then).
 */
export async function myTables(api: ApiDeps = browserApi): Promise<AccountTable[] | null> {
  if (!api.online()) return null;
  let response: Response;
  try {
    response = await api.fetch("/api/me/tables", {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (response.status !== 200) return null;
  return parseAccountTables(await bodyOf(response));
}

/** « Retirer de la liste » for the account: DELETE /api/me/tables/<id> (every device forgets it). */
export async function forgetMyTable(id: string, api: ApiDeps = browserApi): Promise<AccountResult> {
  if (!isTableId(id)) return { ok: false, reason: "unknown" };
  if (!api.online()) return { ok: false, reason: "offline" };
  let response: Response;
  try {
    response = await api.fetch(`/api/me/tables/${id}`, {
      method: "DELETE",
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "offline" };
  }
  if (response.status === 204) return { ok: true };
  return {
    ok: false,
    reason: refusal({ status: response.status, body: await bodyOf(response) }, {}),
  };
}

// --- Plan 04-05: invitation links, friend codes, the friends list (ACCT-03, D-06, D-11) ---

/** Why a friends call did not go through; the page has a sentence for each (04-UI-SPEC « Mes amis »). */
export type SocialFailure =
  | "limit"
  | "own"
  | "used"
  | "expired"
  | "unknown"
  | "format"
  | "rate"
  | "offline"
  | "server"
  | "signed-out";

export type SocialResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; reason: SocialFailure };

/** A refusal: 401 signed-out, then the known `error` of that status, else server. */
function socialRefusal(
  answer: Answer,
  known: Partial<Record<number, readonly SocialFailure[]>>,
): SocialFailure {
  if (answer.status === 401) return "signed-out";
  const error = errorOf(answer.body);
  const allowed = known[answer.status] ?? [];
  return typeof error === "string" && (allowed as readonly string[]).includes(error)
    ? (error as SocialFailure)
    : "server";
}

/** A GET or DELETE without a body; null when the network failed. */
async function call(api: ApiDeps, url: string, method: "GET" | "DELETE"): Promise<Answer | null> {
  try {
    const response = await api.fetch(url, {
      method,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    return {
      status: response.status,
      body: response.status === 204 ? null : await bodyOf(response),
    };
  } catch {
    return null;
  }
}

/** « Inviter un proche »: POST /api/invitations {}. The new link (its code is only here), or why not. */
export async function createInvitation(
  api: ApiDeps = browserApi,
): Promise<SocialResult<{ invitation: CreatedInvitation }>> {
  if (!api.online()) return { ok: false, reason: "offline" };
  const answer = await postJson(api, "/api/invitations", {});
  if (answer === null) return { ok: false, reason: "offline" };
  if (answer.status === 201) {
    const invitation = parseCreatedInvitation(answer.body);
    return invitation === null ? { ok: false, reason: "server" } : { ok: true, invitation };
  }
  return { ok: false, reason: socialRefusal(answer, { 409: ["limit"] }) };
}

/** « Invitations en attente »: GET /api/invitations, the account's pending links (no codes). */
export async function pendingInvitations(
  api: ApiDeps = browserApi,
): Promise<SocialResult<{ invitations: PendingInvitation[] }>> {
  if (!api.online()) return { ok: false, reason: "offline" };
  const answer = await call(api, "/api/invitations", "GET");
  if (answer === null) return { ok: false, reason: "offline" };
  if (answer.status === 200) {
    const invitations = parsePendingInvitations(answer.body);
    return invitations === null ? { ok: false, reason: "server" } : { ok: true, invitations };
  }
  return { ok: false, reason: socialRefusal(answer, {}) };
}

/** « Désactiver ce lien »: DELETE /api/invitations/<id>; unknown when it is no longer pending. */
export async function disableInvitation(
  id: string,
  api: ApiDeps = browserApi,
): Promise<SocialResult> {
  if (!isInvitationCode(id)) return { ok: false, reason: "unknown" };
  if (!api.online()) return { ok: false, reason: "offline" };
  const answer = await call(api, `/api/invitations/${id}`, "DELETE");
  if (answer === null) return { ok: false, reason: "offline" };
  if (answer.status === 204) return { ok: true };
  if (answer.status === 404) return { ok: false, reason: "unknown" };
  return { ok: false, reason: socialRefusal(answer, {}) };
}

/** A friend just added, or already there (`already`), from an accept or a redeem answer. */
function friendResult(answer: Answer): SocialResult<{ friend: FriendEntry; already: boolean }> {
  const parsed = parseFriendAnswer(answer.body);
  return parsed === null
    ? { ok: false, reason: "server" }
    : { ok: true, friend: parsed.friend, already: parsed.already === true };
}

/**
 * « Ajouter à mes amis » on someone else's link, signed in: POST /api/invitations/<code>/accept {}.
 * The friend (already: it was a friend before, the link stays valid), or why not: own (one's own
 * link, not spent), used, expired, unknown.
 */
export async function acceptInvitation(
  code: string,
  api: ApiDeps = browserApi,
): Promise<SocialResult<{ friend: FriendEntry; already: boolean }>> {
  if (!isInvitationCode(code)) return { ok: false, reason: "unknown" };
  if (!api.online()) return { ok: false, reason: "offline" };
  const answer = await postJson(api, `/api/invitations/${code}/accept`, {});
  if (answer === null) return { ok: false, reason: "offline" };
  if (answer.status === 200) return friendResult(answer);
  return {
    ok: false,
    reason: socialRefusal(answer, { 409: ["own"], 410: ["used", "expired", "unknown"] }),
  };
}

/**
 * « Donner mon code »: POST /api/friends/code {}. The account's new friend code (8 symbols: show it
 * with formatFriendCode) and its expiry, 24 hours; the older code stops working.
 */
export async function friendCode(
  api: ApiDeps = browserApi,
): Promise<SocialResult<{ code: string; expiresAt: number }>> {
  if (!api.online()) return { ok: false, reason: "offline" };
  const answer = await postJson(api, "/api/friends/code", {});
  if (answer === null) return { ok: false, reason: "offline" };
  if (answer.status === 201) {
    const parsed = parseFriendCodeAnswer(answer.body);
    return parsed === null
      ? { ok: false, reason: "server" }
      : { ok: true, code: parsed.code, expiresAt: parsed.expiresAt };
  }
  return { ok: false, reason: socialRefusal(answer, {}) };
}

/**
 * « Entrer un code »: the code is read back first (TOC- or not, dashes, spaces, lower case, O, I and
 * L); one that cannot be a code is « format » without a request. Then POST /api/friends/code/redeem.
 * The friend, or why not: unknown (or expired), own, rate (10 failures an hour).
 */
export async function redeemFriendCode(
  typed: string,
  api: ApiDeps = browserApi,
): Promise<SocialResult<{ friend: FriendEntry; already: boolean }>> {
  const code = normalizeFriendCode(typed);
  if (code === null) return { ok: false, reason: "format" };
  if (!api.online()) return { ok: false, reason: "offline" };
  const answer = await postJson(api, "/api/friends/code/redeem", { code });
  if (answer === null) return { ok: false, reason: "offline" };
  if (answer.status === 200) return friendResult(answer);
  return {
    ok: false,
    reason: socialRefusal(answer, {
      400: ["format"],
      404: ["unknown"],
      409: ["own"],
      429: ["rate"],
    }),
  };
}

/** « Mes amis »: GET /api/friends, in French alphabetical order (the server's). */
export async function friends(
  api: ApiDeps = browserApi,
): Promise<SocialResult<{ friends: FriendEntry[] }>> {
  if (!api.online()) return { ok: false, reason: "offline" };
  const answer = await call(api, "/api/friends", "GET");
  if (answer === null) return { ok: false, reason: "offline" };
  if (answer.status === 200) {
    const list = parseFriends(answer.body);
    return list === null ? { ok: false, reason: "server" } : { ok: true, friends: list };
  }
  return { ok: false, reason: socialRefusal(answer, {}) };
}

/** « Retirer de mes amis »: DELETE /api/friends/<id> (both directions); unknown when not a friend. */
export async function removeFriend(id: string, api: ApiDeps = browserApi): Promise<SocialResult> {
  if (!isInvitationCode(id)) return { ok: false, reason: "unknown" };
  if (!api.online()) return { ok: false, reason: "offline" };
  const answer = await call(api, `/api/friends/${id}`, "DELETE");
  if (answer === null) return { ok: false, reason: "offline" };
  if (answer.status === 204) return { ok: true };
  if (answer.status === 404) return { ok: false, reason: "unknown" };
  return { ok: false, reason: socialRefusal(answer, {}) };
}
