// Identifiers and names that cross the network: the table id (the link's capability), the device token
// (a bearer secret that travels only in the hello frame) and the first name a person types.
// Pure, no I/O. Shared by the Worker, the Durable Object and the browser.

/** A table id: 16 random bytes in base64url, 22 characters, no padding (D-02, T-02-04). */
export const TABLE_ID_RE = /^[A-Za-z0-9_-]{22}$/;

/** A device token: 32 random bytes in base64url, 43 characters, no padding (D-01, T-02-06). */
export const DEVICE_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

/** The longest first name, in code points. */
export const NAME_MAX = 20;

export function isTableId(value: unknown): value is string {
  return typeof value === "string" && TABLE_ID_RE.test(value);
}

export function isDeviceToken(value: unknown): value is string {
  return typeof value === "string" && DEVICE_TOKEN_RE.test(value);
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/** Bytes as base64url without padding (ids, tokens, token hashes). Same output on every runtime. */
export function toBase64Url(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] as number;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    out += ALPHABET[(n >> 18) & 63];
    out += ALPHABET[(n >> 12) & 63];
    if (b !== undefined) out += ALPHABET[(n >> 6) & 63];
    if (c !== undefined) out += ALPHABET[n & 63];
  }
  return out;
}

// Control characters and the bidirectional overrides that could reorder what the others read.
const HIDDEN = /[\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu;

/**
 * A first name as the others will read it: NFC, every run of white space made one space, control
 * characters removed, trimmed; 1 to 20 code points, else null. Nothing else is refused.
 */
export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 200) return null;
  const name = raw.normalize("NFC").replace(/\s+/g, " ").replace(HIDDEN, "").trim();
  const length = [...name].length;
  return length >= 1 && length <= NAME_MAX ? name : null;
}
