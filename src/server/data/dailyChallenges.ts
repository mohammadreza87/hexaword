/**
 * 60-day cycle of daily challenges
 * Each challenge is carefully crafted with themed words and appropriate difficulty
 */

export interface PredefinedChallenge {
  day: number;  // 1-60
  dayType: 'minimal' | 'themed' | 'wildcard' | 'throwback' | 'frenzy' | 'social' | 'supreme';
  words: string[];
  clue: string;
  theme?: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export const DAILY_CHALLENGES_60_DAY_CYCLE: PredefinedChallenge[] = [
  // Week 1
  { day: 1, dayType: 'minimal', words: ['CAT', 'DOG', 'RUN', 'SUN', 'FUN', 'BAT'], clue: 'Simple Start', difficulty: 'easy' },
  { day: 2, dayType: 'themed', words: ['CAT', 'DOG', 'BIRD', 'FISH', 'BEAR', 'LION'], clue: 'Animals', theme: 'animals', difficulty: 'medium' },
  { day: 3, dayType: 'wildcard', words: ['WORD', 'GAME', 'PLAY', 'TILE', 'GRID', 'HINT'], clue: 'Gaming Terms', difficulty: 'medium' },
  { day: 4, dayType: 'throwback', words: ['STAR', 'WARS', 'TREK', 'GATE', 'SHIP', 'SPACE'], clue: 'Sci-Fi Classics', difficulty: 'medium' },
  { day: 5, dayType: 'frenzy', words: ['QUICK', 'BROWN', 'FOXES', 'JUMPS', 'LAZY', 'DOGS'], clue: 'Friday Frenzy', difficulty: 'hard' },
  { day: 6, dayType: 'social', words: ['TEAM', 'HELP', 'SHARE', 'FRIEND', 'GROUP', 'UNITY'], clue: 'Better Together', difficulty: 'medium' },
  { day: 7, dayType: 'supreme', words: ['COMPLEX', 'SUPREME', 'HEXAGON', 'OVERLAP', 'VICTORY', 'MASTERS'], clue: 'Sunday Supreme', difficulty: 'hard' },
  
  // Week 2
  { day: 8, dayType: 'minimal', words: ['HAT', 'CAP', 'TOP', 'POP', 'HOP', 'MOP'], clue: 'Short & Sweet', difficulty: 'easy' },
  { day: 9, dayType: 'themed', words: ['CAKE', 'RICE', 'MEAT', 'SOUP', 'BEAN', 'CORN'], clue: 'Food & Dining', theme: 'food', difficulty: 'medium' },
  { day: 10, dayType: 'wildcard', words: ['PUZZLE', 'RIDDLE', 'ENIGMA', 'MYSTERY', 'SECRET', 'CIPHER'], clue: 'Brain Teasers', difficulty: 'hard' },
  { day: 11, dayType: 'throwback', words: ['MARIO', 'SONIC', 'ZELDA', 'TETRIS', 'PACMAN', 'DONKEY'], clue: 'Retro Gaming', difficulty: 'medium' },
  { day: 12, dayType: 'frenzy', words: ['FLASH', 'SPEED', 'RUSH', 'ZOOM', 'SWIFT', 'RAPID'], clue: 'Need for Speed', difficulty: 'hard' },
  { day: 13, dayType: 'social', words: ['CHAT', 'TALK', 'SPEAK', 'VOICE', 'WORDS', 'STORY'], clue: 'Communication', difficulty: 'medium' },
  { day: 14, dayType: 'supreme', words: ['QUANTUM', 'PHYSICS', 'NEUTRON', 'PROTON', 'ATOMIC', 'FUSION'], clue: 'Science Supreme', difficulty: 'hard' },
  
  // Week 3
  { day: 15, dayType: 'minimal', words: ['BIG', 'BAG', 'BUG', 'BOG', 'BEG', 'BAD'], clue: 'B Words', difficulty: 'easy' },
  { day: 16, dayType: 'themed', words: ['CODE', 'DATA', 'CHIP', 'BYTE', 'WIFI', 'APPS'], clue: 'Tech World', theme: 'tech', difficulty: 'medium' },
  { day: 17, dayType: 'wildcard', words: ['TOP', 'HOT', 'POT', 'TOT', 'POP', 'HOP'], clue: 'Rhyme Time', difficulty: 'easy' },
  { day: 18, dayType: 'throwback', words: ['DISCO', 'FUNK', 'GROOVE', 'BOOGIE', 'RHYTHM', 'DANCE'], clue: '70s Vibes', difficulty: 'medium' },
  { day: 19, dayType: 'frenzy', words: ['STORM', 'THUNDER', 'LIGHTNING', 'TORNADO', 'HURRICANE', 'TYPHOON'], clue: 'Weather Chaos', difficulty: 'hard' },
  { day: 20, dayType: 'social', words: ['LOVE', 'CARE', 'KIND', 'NICE', 'GOOD', 'WARM'], clue: 'Positive Vibes', difficulty: 'medium' },
  { day: 21, dayType: 'supreme', words: ['ANCIENT', 'PYRAMID', 'PHARAOH', 'SPHINX', 'DYNASTY', 'EMPIRE'], clue: 'Historical Epic', difficulty: 'hard' },
  
  // Week 4
  { day: 22, dayType: 'minimal', words: ['ONE', 'TWO', 'SIX', 'TEN', 'ADD', 'SUM'], clue: 'Numbers Game', difficulty: 'easy' },
  { day: 23, dayType: 'themed', words: ['TREE', 'LEAF', 'WIND', 'RAIN', 'SNOW', 'STAR'], clue: 'Nature\'s Beauty', theme: 'nature', difficulty: 'medium' },
  { day: 24, dayType: 'wildcard', words: ['MAGIC', 'SPELL', 'WAND', 'WITCH', 'WIZARD', 'POTION'], clue: 'Magical World', difficulty: 'medium' },
  { day: 25, dayType: 'throwback', words: ['KNIGHT', 'SWORD', 'SHIELD', 'CASTLE', 'DRAGON', 'QUEST'], clue: 'Medieval Times', difficulty: 'medium' },
  { day: 26, dayType: 'frenzy', words: ['ENERGY', 'POWER', 'FORCE', 'MIGHT', 'STRONG', 'FIERCE'], clue: 'Full Power', difficulty: 'hard' },
  { day: 27, dayType: 'social', words: ['PARTY', 'DANCE', 'MUSIC', 'LAUGH', 'SMILE', 'HAPPY'], clue: 'Celebration Time', difficulty: 'medium' },
  { day: 28, dayType: 'supreme', words: ['UNIVERSE', 'GALAXY', 'COSMOS', 'NEBULA', 'STELLAR', 'ORBITAL'], clue: 'Space Odyssey', difficulty: 'hard' },
  
  // Week 5
  { day: 29, dayType: 'minimal', words: ['RED', 'BED', 'LED', 'FED', 'WED', 'TED'], clue: 'ED Endings', difficulty: 'easy' },
  { day: 30, dayType: 'themed', words: ['BALL', 'GAME', 'TEAM', 'GOAL', 'RACE', 'JUMP'], clue: 'Sports Day', theme: 'sports', difficulty: 'medium' },
  { day: 31, dayType: 'wildcard', words: ['OCEAN', 'BEACH', 'WAVES', 'SHORE', 'COAST', 'MARINE'], clue: 'Seaside', difficulty: 'medium' },
  { day: 32, dayType: 'throwback', words: ['VINYL', 'RECORD', 'STEREO', 'CASSETTE', 'WALKMAN', 'MIXTAPE'], clue: 'Analog Era', difficulty: 'medium' },
  { day: 33, dayType: 'frenzy', words: ['BLAZING', 'BURNING', 'FLAMING', 'SCORCHING', 'SIZZLING', 'SMOKING'], clue: 'On Fire!', difficulty: 'hard' },
  { day: 34, dayType: 'social', words: ['FAMILY', 'MOTHER', 'FATHER', 'SISTER', 'BROTHER', 'COUSIN'], clue: 'Family Ties', difficulty: 'medium' },
  { day: 35, dayType: 'supreme', words: ['PHILOSOPHY', 'METAPHYSICS', 'EXISTENTIAL', 'THEORETICAL', 'CONSCIOUSNESS', 'ENLIGHTENMENT'], clue: 'Deep Thoughts', difficulty: 'hard' },
  
  // Week 6
  { day: 36, dayType: 'minimal', words: ['WIN', 'BIN', 'PIN', 'TIN', 'FIN', 'SIN'], clue: 'IN Words', difficulty: 'easy' },
  { day: 37, dayType: 'themed', words: ['BLUE', 'RED', 'GOLD', 'PINK', 'GRAY', 'CYAN'], clue: 'Color Palette', theme: 'colors', difficulty: 'medium' },
  { day: 38, dayType: 'wildcard', words: ['SWEET', 'CANDY', 'SUGAR', 'HONEY', 'TREAT', 'DESSERT'], clue: 'Sweet Tooth', difficulty: 'medium' },
  { day: 39, dayType: 'throwback', words: ['PIRATES', 'TREASURE', 'CAPTAIN', 'PARROT', 'ISLAND', 'PLUNDER'], clue: 'Pirate Adventure', difficulty: 'medium' },
  { day: 40, dayType: 'frenzy', words: ['EXTREME', 'RADICAL', 'INTENSE', 'MAXIMUM', 'ULTIMATE', 'SUPREME'], clue: 'To The Max', difficulty: 'hard' },
  { day: 41, dayType: 'social', words: ['GLOBAL', 'WORLD', 'NATION', 'COUNTRY', 'PEOPLE', 'CULTURE'], clue: 'One World', difficulty: 'medium' },
  { day: 42, dayType: 'supreme', words: ['ALGORITHM', 'COMPUTING', 'PROCESSOR', 'BINARY', 'CRYPTOGRAPHY', 'QUANTUM'], clue: 'Tech Supreme', difficulty: 'hard' },
  
  // Week 7
  { day: 43, dayType: 'minimal', words: ['GET', 'SET', 'LET', 'NET', 'BET', 'MET'], clue: 'ET Words', difficulty: 'easy' },
  { day: 44, dayType: 'themed', words: ['SONG', 'BEAT', 'TUNE', 'BAND', 'JAZZ', 'ROCK'], clue: 'Musical Notes', theme: 'music', difficulty: 'medium' },
  { day: 45, dayType: 'wildcard', words: ['WINTER', 'SPRING', 'SUMMER', 'AUTUMN', 'SEASON', 'WEATHER'], clue: 'Seasons Change', difficulty: 'medium' },
  { day: 46, dayType: 'throwback', words: ['COWBOYS', 'WESTERN', 'SALOON', 'SHERIFF', 'OUTLAW', 'FRONTIER'], clue: 'Wild West', difficulty: 'medium' },
  { day: 47, dayType: 'frenzy', words: ['VELOCITY', 'MOMENTUM', 'KINETIC', 'DYNAMIC', 'MOTION', 'THRUST'], clue: 'Physics Frenzy', difficulty: 'hard' },
  { day: 48, dayType: 'social', words: ['PEACE', 'HARMONY', 'BALANCE', 'SERENE', 'TRANQUIL', 'MINDFUL'], clue: 'Inner Peace', difficulty: 'medium' },
  { day: 49, dayType: 'supreme', words: ['MAGNIFICENT', 'EXTRAORDINARY', 'PHENOMENAL', 'SPECTACULAR', 'REMARKABLE', 'INCREDIBLE'], clue: 'Superlatives', difficulty: 'hard' },
  
  // Week 8 (Days 50-56)
  { day: 50, dayType: 'minimal', words: ['NEW', 'FEW', 'DEW', 'SEW', 'HEW', 'PEW'], clue: 'EW Words', difficulty: 'easy' },
  { day: 51, dayType: 'themed', words: ['DOCTOR', 'NURSE', 'HEALTH', 'MEDICAL', 'PATIENT', 'HOSPITAL'], clue: 'Healthcare', theme: 'medical', difficulty: 'medium' },
  { day: 52, dayType: 'wildcard', words: ['COFFEE', 'ESPRESSO', 'LATTE', 'MOCHA', 'CAPPUCCINO', 'AMERICANO'], clue: 'Café Culture', difficulty: 'medium' },
  { day: 53, dayType: 'throwback', words: ['ARCADE', 'TOKENS', 'JOYSTICK', 'PINBALL', 'QUARTER', 'HIGHSCORE'], clue: 'Arcade Days', difficulty: 'medium' },
  { day: 54, dayType: 'frenzy', words: ['ELECTRIC', 'VOLTAGE', 'CURRENT', 'CIRCUIT', 'BATTERY', 'CHARGE'], clue: 'High Voltage', difficulty: 'hard' },
  { day: 55, dayType: 'social', words: ['NETWORK', 'CONNECT', 'SOCIAL', 'ONLINE', 'DIGITAL', 'VIRTUAL'], clue: 'Connected World', difficulty: 'medium' },
  { day: 56, dayType: 'supreme', words: ['REVOLUTIONARY', 'TRANSFORMATION', 'METAMORPHOSIS', 'EVOLUTIONARY', 'PARADIGM', 'INNOVATION'], clue: 'Game Changers', difficulty: 'hard' },
  
  // Final Week (Days 57-60)
  { day: 57, dayType: 'minimal', words: ['ALL', 'BALL', 'CALL', 'FALL', 'HALL', 'WALL'], clue: 'ALL Words', difficulty: 'easy' },
  { day: 58, dayType: 'themed', words: ['KITCHEN', 'BEDROOM', 'BATHROOM', 'LIVING', 'DINING', 'GARAGE'], clue: 'Home Sweet Home', theme: 'home', difficulty: 'medium' },
  { day: 59, dayType: 'wildcard', words: ['DIAMOND', 'EMERALD', 'RUBY', 'SAPPHIRE', 'CRYSTAL', 'JEWEL'], clue: 'Precious Gems', difficulty: 'medium' },
  { day: 60, dayType: 'supreme', words: ['ACHIEVEMENT', 'ACCOMPLISHMENT', 'MILESTONE', 'TRIUMPH', 'COMPLETION', 'PERFECTION'], clue: 'Grand Finale', difficulty: 'hard' }
];

/**
 * Get challenge for a specific day in the 60-day cycle
 */
export function getChallengeForDay(dayNumber: number): PredefinedChallenge {
  // Ensure we're within the 1-60 range
  const cycleDay = ((dayNumber - 1) % 60) + 1;
  return DAILY_CHALLENGES_60_DAY_CYCLE[cycleDay - 1];
}

/**
 * Calculate which day of the 60-day cycle we're on based on a date
 */
export function calculateCycleDay(date: Date): number {
  // Use a fixed start date for the cycle (e.g., Jan 1, 2024)
  const cycleStartDate = new Date('2024-01-01');
  const daysSinceStart = Math.floor((date.getTime() - cycleStartDate.getTime()) / (1000 * 60 * 60 * 24));
  return ((daysSinceStart % 60) + 1);
}