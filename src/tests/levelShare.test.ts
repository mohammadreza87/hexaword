import { describe, expect, it } from 'vitest';
import {
  buildSplashConfig,
  buildSplashDescription,
  computeUniqueLetters,
  createGradientBackground,
  createSharedLevelRecord
} from '../server/utils/levelShare';

describe('level share utilities', () => {
  it('deduplicates and sorts letters', () => {
    const result = computeUniqueLetters(['apple', 'grape', 'delta']);
    expect(result).toEqual(['A', 'D', 'E', 'G', 'L', 'P', 'R', 'T']);
  });

  it('builds descriptive splash content with author and letters', () => {
    const description = buildSplashDescription('Test clue', ['A', 'B', 'C'], 'creator');
    expect(description).toContain('Test clue');
    expect(description).toContain('creator');
    expect(description).toContain('A • B • C');
  });

  it('creates splash configuration with gradient background', () => {
    const splash = buildSplashConfig({ clue: 'Ocean breeze', words: ['wave', 'coral', 'tide'], author: 'u/tester' });
    expect(splash.backgroundUri.startsWith('data:image/svg+xml;base64,')).toBe(true);
    expect(splash.heading).toBe('Community Challenge');
    expect(splash.letters.length).toBeGreaterThan(0);
  });

  it('generates gradient backgrounds for palette colors', () => {
    const uri = createGradientBackground('#000000', '#ffffff', '#123456', ['A', 'B']);
    expect(uri.startsWith('data:image/svg+xml;base64,')).toBe(true);
  });

  it('creates shared level records using provided letters', () => {
    const letters = ['A', 'B', 'C'];
    const record = createSharedLevelRecord({
      id: 'ul_test',
      clue: 'Test',
      words: ['test'],
      seed: 'seed',
      author: 'u/tester'
    }, 'aurora', letters);

    expect(record.levelId).toBe('ul_test');
    expect(record.letters).toEqual(letters);
    expect(record.palette).toBe('aurora');
    expect(typeof record.sharedAt).toBe('string');
  });
});
