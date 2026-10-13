/**
 * Value of the `etat` debug parameter of the game route: a hand-made position (the `before` block of a
 * scenario) as base64url JSON. Debug builds only; the specs write it into the hash.
 */
export function etatParam(position: unknown): string {
  return btoa(JSON.stringify(position))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}
