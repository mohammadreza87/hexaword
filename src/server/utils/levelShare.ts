export const SHARED_LEVEL_REDIS_KEY_PREFIX = 'hw:share:post:';

const SPLASH_PALETTES = [
  { name: 'aurora', primary: '#6366F1', secondary: '#EC4899', accent: '#0F172A' },
  { name: 'sunset', primary: '#F97316', secondary: '#EF4444', accent: '#111827' },
  { name: 'tidal', primary: '#0EA5E9', secondary: '#22C55E', accent: '#082F49' },
  { name: 'nebula', primary: '#A855F7', secondary: '#3B82F6', accent: '#0B1120' }
];

export type SharedLevelPostRecord = {
  levelId: string;
  name?: string;
  clue: string;
  words: string[];
  seed: string;
  author?: string;
  letters: string[];
  palette: string;
  sharedAt: string;
};

export interface SplashThemeConfig {
  backgroundUri: string;
  heading: string;
  description: string;
  buttonLabel: string;
  paletteName: string;
  letters: string[];
}

export function computeUniqueLetters(words: string[]): string[] {
  const letters = new Set<string>();
  for (const word of words) {
    for (const ch of word.toUpperCase()) {
      if (/^[A-Z]$/.test(ch)) {
        letters.add(ch);
      }
    }
  }
  return Array.from(letters).sort();
}

export function selectPalette(letters: string[]) {
  const score = letters.reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return SPLASH_PALETTES[score % SPLASH_PALETTES.length];
}

export function buildSplashDescription(clue: string, letters: string[], author?: string): string {
  const letterPreview = letters.slice(0, 14).join(' • ');
  let description = `Clue: ${clue}`;
  if (author) {
    description += ` • Created by ${author}`;
  }
  if (letterPreview) {
    description += ` • Letters: ${letterPreview}`;
  }
  return description.length > 180 ? `${description.slice(0, 177)}…` : description;
}

export function buildSplashHeading(levelName?: string): string {
  if (!levelName) return 'Community Challenge';
  return levelName.length > 40 ? `${levelName.slice(0, 37)}…` : levelName;
}

export function createGradientBackground(primary: string, secondary: string, accent: string, letters: string[]): string {
  const emphasized = letters.slice(0, 9).join(' ');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${primary}"/>
      <stop offset="100%" stop-color="${secondary}"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bg)"/>
  <circle cx="650" cy="100" r="120" fill="${accent}" opacity="0.35"/>
  <circle cx="140" cy="660" r="160" fill="${accent}" opacity="0.22"/>
  <text x="50" y="420" fill="rgba(255,255,255,0.8)" font-family="'Inter', 'Arial', sans-serif" font-size="54" font-weight="700" letter-spacing="12">${emphasized}</text>
</svg>`;
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

export function buildSplashConfig(level: { name?: string; clue: string; words: string[]; author?: string }): SplashThemeConfig {
  const letters = computeUniqueLetters(level.words);
  const palette = selectPalette(letters);
  return {
    backgroundUri: createGradientBackground(palette.primary, palette.secondary, palette.accent, letters),
    heading: buildSplashHeading(level.name),
    description: buildSplashDescription(level.clue, letters, level.author),
    buttonLabel: 'Play Level',
    paletteName: palette.name,
    letters
  };
}

export function createSharedLevelRecord(level: { id: string; name?: string; clue: string; words: string[]; seed: string; author?: string }, paletteName: string, letters: string[]): SharedLevelPostRecord {
  return {
    levelId: level.id,
    name: level.name,
    clue: level.clue,
    words: level.words,
    seed: level.seed,
    author: level.author,
    letters,
    palette: paletteName,
    sharedAt: new Date().toISOString()
  };
}

export function defaultShareTitle(level: { name?: string; clue: string }): string {
  if (level.name) {
    return `Play "${level.name}" - HexaWord Community Level`;
  }
  return `HexaWord Community Level: ${level.clue}`;
}

