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
  // More compact format to save bytes
  let description = `**${clue}**\n`;
  if (author && author !== 'anonymous') {
    description += `By ${author}\n`;
  }
  // Show only first 12 letters to save space
  const letterPreview = letters.slice(0, 12).join(' ');
  description += `${letterPreview}...`;

  return description.length > 150 ? `${description.slice(0, 147)}…` : description;
}

export function buildSplashHeading(levelName?: string): string {
  if (!levelName) return '🎯 HexaWord Challenge';
  return levelName.length > 40 ? `${levelName.slice(0, 37)}…` : levelName;
}

export function createHexagonIcon(): string {
  // Ultra-compact hexagon icon
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs>
<linearGradient id="h">
<stop stop-color="#667eea"/>
<stop offset="1" stop-color="#f093fb"/>
</linearGradient>
</defs>
<path d="M50,10 L90,35 L90,65 L50,90 L10,65 L10,35 Z" fill="url(#h)"/>
<text x="50" y="60" font-size="40" text-anchor="middle" fill="#fff">H</text>
</svg>`;
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

export function createGlassmorphismBackground(): string {
  // Ultra-compact gradient background
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<defs>
<linearGradient id="g">
<stop stop-color="#667eea"/>
<stop offset="1" stop-color="#f093fb"/>
</linearGradient>
</defs>
<rect width="400" height="300" fill="url(#g)"/>
<circle cx="100" cy="80" r="60" fill="#fff" opacity=".2"/>
<circle cx="300" cy="220" r="80" fill="#fff" opacity=".15"/>
</svg>`;
  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

export function buildSplashConfig(level: { name?: string; clue: string; words: string[]; author?: string }): SplashThemeConfig {
  const letters = computeUniqueLetters(level.words);
  const palette = selectPalette(letters);
  return {
    backgroundUri: createGlassmorphismBackground(),
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

