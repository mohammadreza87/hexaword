/**
 * Seeded Random Number Generator
 * Uses Mulberry32 - a fast, high-quality 32-bit PRNG
 * Ensures deterministic generation across all clients
 */

export interface SeededRNG {
  /** Get next random number between 0 and 1 */
  next(): number;
  /** Get random integer between min and max (inclusive) */
  nextInt(min: number, max: number): number;
  /** Pick random element from array */
  pick<T>(array: T[]): T | undefined;
  /** Shuffle array in place (returns same array) */
  shuffle<T>(array: T[]): T[];
  /** Get random boolean with optional probability */
  nextBool(probability?: number): boolean;
}

/**
 * Creates a seeded RNG using Mulberry32 algorithm
 * @param seed - String seed for deterministic generation
 * @returns SeededRNG instance
 */
export function createRNG(seed: string): SeededRNG {
  // Convert string seed to numeric seed
  let numericSeed = hashString(seed);
  
  // Mulberry32 PRNG
  const mulberry32 = (): number => {
    numericSeed = (numericSeed + 0x6D2B79F5) | 0;
    let t = numericSeed;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  
  return {
    next(): number {
      return mulberry32();
    },
    
    nextInt(min: number, max: number): number {
      if (min > max) {
        throw new Error(`Invalid range: min (${min}) > max (${max})`);
      }
      return Math.floor(mulberry32() * (max - min + 1)) + min;
    },
    
    pick<T>(array: T[]): T | undefined {
      if (array.length === 0) return undefined;
      const index = Math.floor(mulberry32() * array.length);
      return array[index];
    },
    
    shuffle<T>(array: T[]): T[] {
      // Fisher-Yates shuffle with seeded RNG
      for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(mulberry32() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }
      return array;
    },
    
    nextBool(probability: number = 0.5): boolean {
      return mulberry32() < probability;
    }
  };
}

/**
 * Simple string hash function for seed conversion
 * Produces consistent 32-bit integer from string
 */
function hashString(str: string): number {
  let hash = 0;
  if (str.length === 0) return hash;
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return Math.abs(hash);
}

/**
 * Global RNG instance for shared use
 * Must be initialized with setSeed before use
 */
let globalRNG: SeededRNG | null = null;

/**
 * Sets the global RNG seed
 * @param seed - String seed for deterministic generation
 */
export function setSeed(seed: string): void {
  globalRNG = createRNG(seed);
}

/**
 * Gets the global RNG instance
 * @throws Error if seed not set
 */
export function getRNG(): SeededRNG {
  if (!globalRNG) {
    throw new Error('RNG not initialized. Call setSeed() first.');
  }
  return globalRNG;
}

/**
 * Utility to generate deterministic UUID from seed
 * @param seed - Base seed
 * @param counter - Optional counter for uniqueness
 */
export function seededUUID(seed: string, counter: number = 0): string {
  const rng = createRNG(`${seed}_${counter}`);
  const hex = (n: number) => Math.floor(n * 16).toString(16);
  
  let uuid = '';
  for (let i = 0; i < 32; i++) {
    if (i === 8 || i === 12 || i === 16 || i === 20) {
      uuid += '-';
    }
    uuid += hex(rng.next());
  }
  
  return uuid;
}