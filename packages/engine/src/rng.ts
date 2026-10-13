// Seeded random numbers: sfc32 with a serialisable state, and the Fisher-Yates shuffle built on it.
// This is the only source of randomness in the engine; the seed comes from the shell
// (crypto.getRandomValues, plan 01-15) and the state lives in GameState.rng so deals are reproducible.
// Pure, no I/O, erasable syntax only.

/** sfc32 state: four 32-bit integers. */
export type Rng = [number, number, number, number];

/** sfc32: returns a number in [0, 1) and the new state. The input state is not modified. */
export function next(s: Rng): [number, Rng] {
  let [a, b, c, d] = s;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  return [(t >>> 0) / 4294967296, [a, b, c, d]];
}

/** Fisher-Yates shuffle: a new array and the new rng state. The input array is not modified. */
export function shuffle<T>(xs: readonly T[], s: Rng): [T[], Rng] {
  const out = xs.slice();
  let r = s;
  for (let i = out.length - 1; i > 0; i--) {
    let u: number;
    [u, r] = next(r);
    const j = Math.floor(u * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return [out, r];
}
