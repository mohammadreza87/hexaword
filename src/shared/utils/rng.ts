// Seed utilities and small deterministic RNG helpers

// Convert a string seed to a 32-bit unsigned integer
export function stringToSeed(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Mulberry32 PRNG: fast, decent quality for gameplay determinism
export function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type SeededRNG = {
  next: () => number;
  nextInt: (min: number, max: number) => number;
  shuffle: <T>(arr: T[]) => T[];
};

export function makeRng(seed: string): () => number {
  return mulberry32(stringToSeed(seed));
}

export function createRNG(seed: string): SeededRNG {
  const base = makeRng(seed);
  return {
    next: () => base(),
    nextInt: (min: number, max: number) => {
      if (max < min) [min, max] = [max, min];
      const r = base();
      return Math.floor(r * (max - min + 1)) + min;
    },
    shuffle: <T>(arr: T[]) => seededShuffle(arr, base),
  };
}

export function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Stable seeded tiebreaker for sorting
export function seededTiebreak(seed: string, key: string): number {
  const r = mulberry32(stringToSeed(seed + '|' + key))();
  // Map to small integer for deterministic but stable ordering
  return Math.floor(r * 1e6);
}
