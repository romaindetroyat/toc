// The backup code's storage (plan 04-01, D-02; 04-RESEARCH Pattern 3). The code itself (100 random
// bits) is shown once and never stored: users.backup_mac is base64url HMAC-SHA-256 keyed by the
// TOC_PEPPER secret of `userId + ":" + code`. With 100 bits a slow password hash adds nothing, and it
// would not fit the Free plan's 10 ms of CPU (Pattern 3), so there is none. Comparisons use
// crypto.subtle.timingSafeEqual, the Workers' constant-time compare.

import { normalizeBackupCode, toBase64Url } from "@toc/protocol";

const encoder = new TextEncoder();

/** base64url HMAC-SHA-256(pepper, userId + ":" + the code in its canonical form). */
export async function macOf(pepper: string, userId: string, code: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const canonical = normalizeBackupCode(code) ?? code;
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(`${userId}:${canonical}`));
  return toBase64Url(new Uint8Array(mac));
}

/** Two MACs (or digests) compared in constant time; different lengths are different. */
export function sameMac(a: string, b: string): boolean {
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  if (left.byteLength !== right.byteLength) return false;
  return crypto.subtle.timingSafeEqual(left, right);
}

/** A secret compared with what was typed: both hashed to SHA-256 first, so the lengths match (T-04-11). */
export async function sameSecret(typed: string, secret: string): Promise<boolean> {
  const [a, b] = await Promise.all(
    [typed, secret].map((text) => crypto.subtle.digest("SHA-256", encoder.encode(text))),
  );
  return crypto.subtle.timingSafeEqual(a as ArrayBuffer, b as ArrayBuffer);
}
