/**
 * Predefined levels for HexaWord game
 */

export interface PredefinedLevel {
  level: number;
  clue: string;
  words: string[];
}

export const PREDEFINED_LEVELS: PredefinedLevel[] = [
  { level: 1, clue: "BEACH DAY", words: ["SUN", "SAND", "WAVE"] },
  { level: 2, clue: "SOFA CHILL", words: ["RUG", "LAMP", "PILLOW"] },
  { level: 3, clue: "BREAKFAST QUICK", words: ["TEA", "TOAST", "JAM"] },
  { level: 4, clue: "DOG WALK", words: ["LEASH", "TREAT", "BARK"] },
  { level: 5, clue: "RAINY KIT", words: ["COAT", "BOOT", "MUD"] },
  { level: 6, clue: "GAME NIGHT", words: ["DICE", "CARD", "TURN"] },
  { level: 7, clue: "COFFEE RUN", words: ["MUG", "LATTE", "FOAM", "BEANS"] },
  { level: 8, clue: "CITY HOP", words: ["MAP", "METRO", "TAXI", "NOISE"] },
  { level: 9, clue: "SCHOOL STUFF", words: ["BOOK", "PENCIL", "NOTES", "LUNCH"] },
  { level: 10, clue: "HOME GARDEN", words: ["SEED", "SOIL", "WATER", "FLOWER"] },
  { level: 11, clue: "WINTER WARDROBE", words: ["HAT", "SCARF", "GLOVE", "SLED"] },
  { level: 12, clue: "MUSIC VIBES", words: ["BEAT", "MELODY", "DRUM", "STAGE"] },
  { level: 13, clue: "PARK DAY", words: ["PATH", "TREES", "LAKE", "BENCH"] },
  { level: 14, clue: "MOVIE NIGHT", words: ["POPCORN", "SCREEN", "SCENE", "TICKET"] },
  { level: 15, clue: "SPACE GEEK", words: ["MOON", "STAR", "ROCKET", "PLANET"] },
  { level: 16, clue: "MINI TRIP", words: ["PLANE", "HOTEL", "BAG", "MAP"] },
  { level: 17, clue: "SPORTS HYPE", words: ["GOAL", "SCORE", "COACH", "WHISTLE"] },
  { level: 18, clue: "BAKERY RUN", words: ["OVEN", "DOUGH", "CRUST", "PIE"] },
  { level: 19, clue: "DESK SETUP", words: ["MOUSE", "CABLE", "SCREEN", "FILES"] },
  { level: 20, clue: "CAMP VIBES", words: ["TENT", "FIRE", "SMORE", "GUITAR"] }
];

/**
 * Get a predefined level by number
 */
export function getPredefinedLevel(level: number): PredefinedLevel | undefined {
  return PREDEFINED_LEVELS.find(l => l.level === level);
}

/**
 * Check if a level has predefined data
 */
export function hasPredefinedLevel(level: number): boolean {
  return level >= 1 && level <= PREDEFINED_LEVELS.length;
}