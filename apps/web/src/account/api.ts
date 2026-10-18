// The account calls of the page (plan 04-01, ACCT-01, ACCT-02): the state of an invitation link, the
// sign-up (options, the passkey, verify) and GET /api/me. fetch, the online flag and the passkey
// ceremony are passed in, so the rules run under Node with fakes (net/api.ts pattern). Every answer
// is untrusted and read with the shared schemas of @toc/protocol. The session is an HttpOnly cookie
// the browser keeps and sends by itself: no token ever reaches this code.

import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/browser";
import {
  type InvitationState,
  isInvitationCode,
  type MeAccount,
  parseCreationOptions,
  parseInvitationState,
  parseMeAccount,
  parseSignupAnswer,
} from "@toc/protocol";
import { type ApiDeps, browserApi } from "../net/api.ts";
import {
  browserCeremonies,
  type Ceremonies,
  createPasskey,
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
