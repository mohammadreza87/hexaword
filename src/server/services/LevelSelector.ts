import { createRNG } from '../../shared/utils/rng';
import { WordRepository, WordEntry } from './WordRepository';

export type LevelSelection = {
  seed: string;
  words: string[];
  clue: string;
};

export class LevelSelector {
  constructor(private repo = WordRepository.getInstance()) {}

  pickWords(seed: string, count: number, exclude: Set<string> = new Set()): LevelSelection {
    const rng = createRNG(seed);
    const pool = this.repo.getAll().filter(w => !exclude.has(w.word));

    // Deterministically shuffle and pick first N
    const shuffled = rng.shuffle(pool);
    const chosen: WordEntry[] = [];
    for (const entry of shuffled) {
      if (chosen.length >= count) break;
      // Basic constraints: length 2..10
      if (entry.word.length < 2 || entry.word.length > 12) continue;
      chosen.push(entry);
    }

    // Derive a simple clue: use the most common clue among chosen or fallback
    const clueCounts = new Map<string, number>();
    for (const c of chosen.map(c => c.clue).filter(Boolean) as string[]) {
      clueCounts.set(c, (clueCounts.get(c) || 0) + 1);
    }
    const derivedClue = [...clueCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || 'RANDOM MIX';

    return { seed, words: chosen.slice(0, count).map(w => w.word), clue: derivedClue };
  }
}

