// Seeded random numbers (mulberry32). The generator's whole state is one uint32 kept in the
// battle state, so a fight can be saved, replayed and compared.

/** Advances the generator. Returns a float in [0, 1) and the next state. */
export function nextFloat(rng: number): { value: number; rng: number } {
  const next = (rng + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, rng: next };
}

/** A whole number from `min` to `max`, both included. */
export function nextInt(rng: number, min: number, max: number): { value: number; rng: number } {
  const { value, rng: next } = nextFloat(rng);
  return { value: min + Math.floor(value * (max - min + 1)), rng: next };
}

/** Turns any seed number into a valid generator state. */
export function seedRng(seed: number): number {
  return seed >>> 0;
}
