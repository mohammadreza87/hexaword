import words from '../data/words.json' assert { type: 'json' };

export interface WordEntry {
  word: string;
  clue?: string;
  level?: number;
  difficulty?: number;
}

export class WordRepository {
  private static instance: WordRepository;
  private all: WordEntry[];

  private constructor() {
    this.all = (words as WordEntry[]).filter(w => typeof w.word === 'string' && /^[A-Z]+$/.test(w.word));
  }

  static getInstance(): WordRepository {
    if (!WordRepository.instance) {
      WordRepository.instance = new WordRepository();
    }
    return WordRepository.instance;
  }

  getAll(): WordEntry[] {
    return this.all;
  }
}

