// The device's identity at online tables (D-01): a private token and the first name typed once.
// Pure: the storage and the random source are passed in, so everything here runs under Node.
//
// The token is 32 random bytes in base64url: a bearer secret that travels only in the hello frame,
// never in a URL (T-02-06). The stored value is untrusted (the user or another script on the origin
// can edit it): each field is validated on its own, and a bad token is replaced (settings.ts pattern).

import { isDeviceToken, normalizeName, toBase64Url } from "@toc/protocol";

export const DEVICE_KEY = "toc.device.v1";

export type Device = { token: string; name: string | null };

/** The subset of the Web Storage API used here, so tests can pass a fake. */
export type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Fills the bytes from the secure random source. */
export type RandomSource = (bytes: Uint8Array<ArrayBuffer>) => void;

const secureRandom: RandomSource = (bytes) => {
  crypto.getRandomValues(bytes);
};

function read(storage: StorageLike | null): unknown {
  try {
    const raw = storage?.getItem(DEVICE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(storage: StorageLike | null, device: Device): void {
  try {
    storage?.setItem(DEVICE_KEY, JSON.stringify(device));
  } catch {
    // Private browsing or a full storage: the device keeps its identity for this page only.
  }
}

/** The stored identity, or a new token (stored at once) when there is none or it is not valid. */
export function loadDevice(
  storage: StorageLike | null,
  random: RandomSource = secureRandom,
): Device {
  const raw = read(storage);
  const source =
    typeof raw === "object" && raw !== null && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const token = Object.hasOwn(source, "token") ? source.token : undefined;
  const name = Object.hasOwn(source, "name") ? normalizeName(source.name) : null;
  if (isDeviceToken(token)) return { token, name };
  const bytes = new Uint8Array(32);
  random(bytes);
  const device: Device = { token: toBase64Url(bytes), name };
  write(storage, device);
  return device;
}

/** Stores the first name with the device token; null (nothing stored) when the name is empty. */
export function saveName(
  storage: StorageLike | null,
  name: string,
  random: RandomSource = secureRandom,
): Device | null {
  const normalized = normalizeName(name);
  if (normalized === null) return null;
  const device: Device = { token: loadDevice(storage, random).token, name: normalized };
  write(storage, device);
  return device;
}

/** The page's storage, or null where reading it throws. */
export function pageStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
