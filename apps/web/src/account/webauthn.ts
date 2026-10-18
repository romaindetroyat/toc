// The browser's passkey ceremony (plan 04-01; 04-RESEARCH Pattern 1). @simplewebauthn/browser turns
// the server's JSON options into navigator.credentials.create() and its answer back into JSON; the
// system dialog is the platform's own. It sits behind a seam (Ceremonies) so the rules below run in
// Node with fakes. What the platform throws becomes what the page says (04-UI-SPEC « Step 1 » errors):
//   NotAllowedError, AbortError   cancelled: the dialog was closed or timed out
//   SecurityError                 wrong-address: not the RP ID's own address (a preview URL)
//   no PublicKeyCredential        unsupported: an in-app browser, an old one
//   anything else                 server: « Le compte n’a pas pu être créé. Réessaie… »

import {
  browserSupportsWebAuthn,
  type PublicKeyCredentialCreationOptionsJSON,
  type RegistrationResponseJSON,
  startRegistration,
} from "@simplewebauthn/browser";

export type PasskeyFailure = "cancelled" | "wrong-address" | "unsupported" | "server";

export type Ceremonies = {
  /** The browser can make a passkey at all. */
  supported: () => boolean;
  register: (options: {
    optionsJSON: PublicKeyCredentialCreationOptionsJSON;
  }) => Promise<RegistrationResponseJSON>;
};

export const browserCeremonies: Ceremonies = {
  supported: () => browserSupportsWebAuthn(),
  register: (options) => startRegistration(options),
};

/** What a failed ceremony means for the page. */
export function passkeyFailure(error: unknown): PasskeyFailure {
  const name =
    typeof error === "object" && error !== null ? (error as { name?: unknown }).name : undefined;
  if (name === "NotAllowedError" || name === "AbortError") return "cancelled";
  if (name === "SecurityError") return "wrong-address";
  return "server";
}

export type PasskeyResult =
  | { ok: true; response: RegistrationResponseJSON }
  | { ok: false; reason: PasskeyFailure };

/** Creates a passkey with the server's options; never throws. */
export async function createPasskey(
  optionsJSON: PublicKeyCredentialCreationOptionsJSON,
  ceremonies: Ceremonies = browserCeremonies,
): Promise<PasskeyResult> {
  if (!ceremonies.supported()) return { ok: false, reason: "unsupported" };
  try {
    return { ok: true, response: await ceremonies.register({ optionsJSON }) };
  } catch (error) {
    return { ok: false, reason: passkeyFailure(error) };
  }
}
