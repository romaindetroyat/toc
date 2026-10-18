// The browser's side of Web Push for the workerd tests (plan 04-07, 04-RESEARCH Testing Strategy
// « Push encryption »): a subscription's key pair and auth secret, the RFC 8291 decryption of an
// aes128gcm body (RFC 8188 header, one record), and the VAPID JWT of the authorization header
// (RFC 8292), checked with its own key. WebCrypto only; nothing here is used by the Worker.

import { toBase64Url } from "@toc/protocol";

const encoder = new TextEncoder();

export function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

/** A browser's push subscription keys: its ECDH P-256 pair and its 16-byte auth secret. */
export type TestSubscriber = {
  privateKey: CryptoKey;
  /** The 65-byte uncompressed public key, base64url (PushSubscription keys.p256dh). */
  p256dh: string;
  /** keys.auth, base64url. */
  auth: string;
};

export async function testSubscriber(): Promise<TestSubscriber> {
  const pair = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ])) as CryptoKeyPair;
  const raw = new Uint8Array((await crypto.subtle.exportKey("raw", pair.publicKey)) as ArrayBuffer);
  return {
    privateKey: pair.privateKey,
    p256dh: toBase64Url(raw),
    auth: toBase64Url(crypto.getRandomValues(new Uint8Array(16))),
  };
}

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const imported = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, data));
}

const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, part) => n + part.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

/** HKDF with one output block (RFC 5869), enough for 32 bytes and less. */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const prk = await hmac(salt, ikm);
  return (await hmac(prk, concat(info, new Uint8Array([1])))).slice(0, length);
}

/** The plaintext of an aes128gcm push body for this subscriber (RFC 8291 §3.4, RFC 8188 §2). */
export async function decryptPush(subscriber: TestSubscriber, body: Uint8Array): Promise<string> {
  const salt = body.slice(0, 16);
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const recordSize = view.getUint32(16);
  const idLength = body[20] as number;
  const serverPublic = body.slice(21, 21 + idLength);
  const ciphertext = body.slice(21 + idLength);
  if (recordSize !== 4096 || idLength !== 65) throw new Error(`header ${recordSize} ${idLength}`);
  const serverKey = await crypto.subtle.importKey(
    "raw",
    serverPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: serverKey } as EcdhKeyDeriveParams,
      subscriber.privateKey,
      256,
    ),
  );
  const clientPublic = fromBase64Url(subscriber.p256dh);
  const keyInfo = concat(encoder.encode("WebPush: info\0"), clientPublic, serverPublic);
  const ikm = await hkdf(fromBase64Url(subscriber.auth), shared, keyInfo, 32);
  const cek = await hkdf(salt, ikm, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, encoder.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["decrypt"]);
  const padded = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext),
  );
  // The last record: the text, the delimiter 0x02, then zeroes.
  let end = padded.length - 1;
  while (end >= 0 && padded[end] === 0) end--;
  if (padded[end] !== 2) throw new Error("no last-record delimiter");
  return new TextDecoder().decode(padded.slice(0, end));
}

export type VapidJwt = { aud: string; exp: number; sub: string; iat?: number };

/**
 * The VAPID header `vapid t=<jwt>, k=<public key>`: the JWT's claims once its ES256 signature is
 * checked with k (throws otherwise), and k.
 */
export async function readVapid(authorization: string): Promise<{ claims: VapidJwt; k: string }> {
  const match = /^vapid t=([^,]+), k=([A-Za-z0-9_-]+)$/.exec(authorization);
  if (match === null) throw new Error(`not a VAPID header: ${authorization}`);
  const jwt = match[1] as string;
  const k = match[2] as string;
  const [header, payload, signature] = jwt.split(".") as [string, string, string];
  const key = await crypto.subtle.importKey(
    "raw",
    fromBase64Url(k),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    fromBase64Url(signature),
    encoder.encode(`${header}.${payload}`),
  );
  if (!valid) throw new Error("bad VAPID signature");
  const head = JSON.parse(new TextDecoder().decode(fromBase64Url(header))) as { alg: string };
  if (head.alg !== "ES256") throw new Error(`alg ${head.alg}`);
  return { claims: JSON.parse(new TextDecoder().decode(fromBase64Url(payload))) as VapidJwt, k };
}
