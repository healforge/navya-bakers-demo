/** Deterministic PRNG (mulberry32) + helpers. */
export type Rng = () => number

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Integer in [min, max] inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)] as T
}

/** Roughly normal (mean 0, sd ~1) via sum of 3 uniforms. */
export function normalish(rng: Rng): number {
  return ((rng() + rng() + rng() - 1.5) / 0.5)
}

/** Multiplicative noise around 1: 1 + normalish * sd, clamped to >= 0.2. */
export function noise(rng: Rng, sd: number): number {
  return Math.max(0.2, 1 + normalish(rng) * sd)
}
