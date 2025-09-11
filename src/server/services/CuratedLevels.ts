import { makeRng } from '../../shared/utils/rng';

export type CuratedLevel = {
  clue: string;
  words: string[];
};

// Base curated set provided by product/design (20 entries)
const BASE_CURATED: CuratedLevel[] = [
  { clue: 'WHY WE LOVE CATS', words: ['PURR', 'FUR', 'PAW'] },
  { clue: 'WHY WE LOVE DOGS', words: ['WALK', 'BALL', 'BARK'] },
  { clue: 'WHY WE LOVE PIZZA', words: ['SLICE', 'CHEESE', 'HOT'] },
  { clue: 'WHY WE LOVE COFFEE', words: ['LATTE', 'AROMA', 'BUZZ'] },
  { clue: 'WHY WE LOVE RAIN', words: ['COZY', 'TEA', 'DROPS'] },
  { clue: 'WHY WE LOVE SUMMER', words: ['SUN', 'ICE', 'POOL'] },
  { clue: 'WHY WE LOVE VIDEO GAMES', words: ['PLAY', 'LEVEL', 'LOOT', 'QUEST'] },
  { clue: 'WHY WE LOVE MUSIC', words: ['BEAT', 'SONG', 'DANCE', 'MELODY'] },
  { clue: 'WHY WE LOVE THE BEACH', words: ['SAND', 'WAVE', 'SURF', 'SHELL'] },
  { clue: 'WHY WE LOVE BREAKFAST', words: ['EGGS', 'TOAST', 'JUICE', 'BACON'] },
  { clue: 'WHY WE LOVE TRAVEL', words: ['MAP', 'PLANE', 'BAG', 'HOTEL'] },
  { clue: 'WHY WE LOVE BOOKS', words: ['STORY', 'PAGE', 'TITLE', 'AUTHOR'] },
  { clue: 'WHY WE LOVE FRIENDS', words: ['CHAT', 'LAUGH', 'HUG', 'TRUST'] },
  { clue: 'WHY WE LOVE BIRTHDAYS', words: ['CAKE', 'GIFT', 'WISH', 'PARTY'] },
  { clue: 'WHY WE LOVE CHOCOLATE', words: ['SWEET', 'COCOA', 'BAR', 'TRUFFLE'] },
  { clue: 'WHY WE LOVE SNOW', words: ['FLAKE', 'COLD', 'SLED', 'SKI'] },
  { clue: 'WHY WE LOVE SUNSETS', words: ['GOLD', 'SKY', 'GLOW', 'PEACE'] },
  { clue: 'WHY WE LOVE CAMPING', words: ['TENT', 'FIRE', 'STARS', 'SMORE'] },
  { clue: 'WHY WE LOVE MOVIES', words: ['POPCORN', 'SCENE', 'SCREEN', 'ACTOR'] },
  { clue: 'WHY WE LOVE SPACE', words: ['MOON', 'STAR', 'ROCKET', 'PLANET'] },
];

// Deterministic shuffle of indices to spread curated content across progression.
const SHUFFLE_SEED = 'curated_v1';
function buildShuffledOrder(n: number): number[] {
  const rng = makeRng(SHUFFLE_SEED);
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const ORDER = buildShuffledOrder(BASE_CURATED.length);

/**
 * Returns the curated level (clue + words) mapped to any progression level number.
 * The mapping repeats every BASE_CURATED.length but in a deterministic shuffled order.
 */
export function getCuratedForLevel(level: number): CuratedLevel {
  if (level < 1) level = 1;
  const idx = (level - 1) % BASE_CURATED.length;
  const mapped = ORDER[idx];
  return BASE_CURATED[mapped];
}

