import levels from '../data/levels.json' assert { type: 'json' };

export interface CsvLevelRow {
  level: number;
  numLetters?: number;
  numWords: number;
  difficulty?: number;
  clue?: string;
  words: string[];
}

export class LevelRepository {
  private static instance: LevelRepository;
  private all: CsvLevelRow[];

  private constructor() {
    this.all = (levels as CsvLevelRow[]).filter(r => Array.isArray(r.words) && r.words.length > 0);
  }

  static getInstance(): LevelRepository {
    if (!LevelRepository.instance) LevelRepository.instance = new LevelRepository();
    return LevelRepository.instance;
  }

  getLevel(n: number): CsvLevelRow | undefined {
    return this.all.find(r => r.level === n);
  }
}

