// A software passkey for the workerd tests (04-RESEARCH « Code Examples »): an ES256 key pair, a
// resident credential, and the two ceremonies' JSON answers exactly as a browser would send them
// (attestation "none"). With it, verifyRegistrationResponse and verifyAuthenticationResponse run on
// real signatures, without a browser.

import { isoBase64URL, isoCBOR } from "@simplewebauthn/server/helpers";

const enc = (text: string) => new TextEncoder().encode(text);
const u8 = (...bytes: number[]) => new Uint8Array(bytes);
const b64 = (bytes: Uint8Array) => isoBase64URL.fromBuffer(bytes as Uint8Array<ArrayBuffer>);

function cat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", data as Uint8Array<ArrayBuffer>));
}

/** One DER INTEGER of an ECDSA signature half: leading zeros dropped, a 0x00 when the high bit is set. */
function derInteger(half: Uint8Array): Uint8Array {
  let start = 0;
  while (start < half.length - 1 && half[start] === 0) start++;
  const body = half.slice(start);
  const padded = (body[0] as number) & 0x80 ? cat(u8(0), body) : body;
  return cat(u8(0x02, padded.length), padded);
}

/** WebCrypto signs ECDSA as r || s; WebAuthn sends DER: 0x30 len (0x02 len r) (0x02 len s). */
function rawToDer(raw: Uint8Array): Uint8Array {
  const r = derInteger(raw.slice(0, 32));
  const s = derInteger(raw.slice(32));
  return cat(u8(0x30, r.length + s.length), r, s);
}

export type SoftAuthenticator = {
  /** The credential id, base64url. */
  id: string;
  /** navigator.credentials.create(): a RegistrationResponseJSON for this challenge. */
  create(challenge: string, options?: { origin?: string }): Promise<Record<string, unknown>>;
  /** navigator.credentials.get(): an AuthenticationResponseJSON for this challenge. */
  get(challenge: string, userHandle: string): Promise<Record<string, unknown>>;
};

/** A new passkey for `rpID`, answering as the page at `origin`. */
export async function softAuthenticator(rpID: string, origin: string): Promise<SoftAuthenticator> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as JsonWebKey;
  const credentialId = crypto.getRandomValues(new Uint8Array(16));
  const cose = new Map<number, unknown>([
    [1, 2],
    [3, -7],
    [-1, 1],
    [-2, isoBase64URL.toBuffer(jwk.x as string)],
    [-3, isoBase64URL.toBuffer(jwk.y as string)],
  ]);
  const rpIdHash = await sha256(enc(rpID));
  let counter = 0;
  const id = b64(credentialId);
  return {
    id,
    async create(challenge, options = {}) {
      const clientDataJSON = enc(
        JSON.stringify({
          type: "webauthn.create",
          challenge,
          origin: options.origin ?? origin,
          crossOrigin: false,
        }),
      );
      // Flags 0x45: user present, user verified, attested credential data.
      const authData = cat(
        rpIdHash,
        u8(0x45, 0, 0, 0, 0),
        new Uint8Array(16),
        u8(0, credentialId.length),
        credentialId,
        isoCBOR.encode(cose as never),
      );
      const attestationObject = isoCBOR.encode(
        new Map<string, unknown>([
          ["fmt", "none"],
          ["attStmt", new Map()],
          ["authData", authData],
        ]) as never,
      );
      return {
        id,
        rawId: id,
        type: "public-key",
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64(clientDataJSON),
          attestationObject: b64(attestationObject),
          transports: ["internal"],
        },
      };
    },
    async get(challenge, userHandle) {
      counter++;
      const clientDataJSON = enc(
        JSON.stringify({ type: "webauthn.get", challenge, origin, crossOrigin: false }),
      );
      // Flags 0x05: user present, user verified.
      const authData = cat(rpIdHash, u8(0x05, 0, 0, 0, counter));
      const signed = cat(authData, await sha256(clientDataJSON));
      const raw = new Uint8Array(
        await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, signed),
      );
      return {
        id,
        rawId: id,
        type: "public-key",
        clientExtensionResults: {},
        response: {
          clientDataJSON: b64(clientDataJSON),
          authenticatorData: b64(authData),
          signature: b64(rawToDer(raw)),
          userHandle,
        },
      };
    },
  };
}
