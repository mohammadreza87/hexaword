import { WordObject, HexCell, PuzzleConfig } from '../../shared/types/hexaword';
import { WordPlacementService } from '../../shared/algorithms/WordPlacementService';
import { createRNG, SeededRNG, seededTiebreak } from '../../shared/utils/rng';

export class CrosswordGenerator {
  private placementService: WordPlacementService;
  private config: PuzzleConfig;
  private rng: SeededRNG;
  
  constructor(config?: Partial<PuzzleConfig>) {
    this.config = {
      gridRadius: 10,
      words: [],
      seed: Date.now().toString(),
      ...config
    };
    
    // Initialize RNG with seed
    this.rng = createRNG(this.config.seed || 'default');
    
    // Pass RNG to placement service
    this.placementService = new WordPlacementService(this.config.gridRadius, this.rng);
  }

  /**
   * Generates a complete crossword puzzle
   */
  async generate(words?: string[]): Promise<{
    board: Map<string, HexCell>;
    placedWords: WordObject[];
    success: boolean;
  }> {
    const wordList = words || this.config.words;
    
    if (wordList.length === 0) {
      throw new Error('No words provided for crossword generation');
    }
    
    // Prepare word objects
    const wordObjs = this.prepareWords(wordList);
    
    // Generate puzzle
    const success = this.placementService.placeWords(wordObjs);
    
    return {
      board: this.placementService.getBoard(),
      placedWords: this.placementService.getPlacedWords(),
      success
    };
  }

  /**
   * Prepares word objects with match calculations
   */
  private prepareWords(words: string[]): WordObject[] {
    const wordObjs: WordObject[] = words.map(word => ({
      word: word.toUpperCase(),
      chars: word.toUpperCase().split(''),
      totalMatches: 0,
      effectiveMatches: 0,
      successfulMatches: []
    }));

    // Calculate total matches for each word
    for (let i = 0; i < wordObjs.length; i++) {
      const wordA = wordObjs[i];
      for (let j = 0; j < wordA.chars.length; j++) {
        const charA = wordA.chars[j];
        for (let k = 0; k < wordObjs.length; k++) {
          if (k === i) continue;
          const wordB = wordObjs[k];
          for (let l = 0; l < wordB.chars.length; l++) {
            if (charA === wordB.chars[l]) {
              wordA.totalMatches++;
            }
          }
        }
      }
    }
    
    // Deterministic with seed influence: match count, then length, then seeded tiebreak
    wordObjs.sort((a, b) => {
      const scoreDiff = b.totalMatches - a.totalMatches;
      if (scoreDiff !== 0) return scoreDiff;

      const lengthDiff = b.word.length - a.word.length;
      if (lengthDiff !== 0) return lengthDiff;

      return seededTiebreak(this.config.seed || 'default', a.word)
        - seededTiebreak(this.config.seed || 'default', b.word);
    });
    
    if (process.env.NODE_ENV === 'development') {
      console.log('Word match scores:', wordObjs.map(w => ({
        word: w.word,
        matches: w.totalMatches
      })));
    }
    
    return wordObjs;
  }

  /**
   * Updates the configuration
   */
  updateConfig(config: Partial<PuzzleConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.seed !== undefined) {
      this.rng = createRNG(this.config.seed || 'default');
    }
    if (config.gridRadius !== undefined || config.seed !== undefined) {
      this.placementService = new WordPlacementService(this.config.gridRadius, this.rng);
    }
  }

  /**
   * Gets the current configuration
   */
  getConfig(): PuzzleConfig {
    return this.config;
  }

  /**
   * Validates a word list for crossword generation
   */
  static validateWords(words: string[]): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (words.length < 3) {
      errors.push('At least 3 words are required');
    }
    
    const uniqueWords = new Set(words.map(w => w.toUpperCase()));
    if (uniqueWords.size !== words.length) {
      errors.push('Duplicate words found');
    }
    
    words.forEach((word, index) => {
      if (word.length < 2) {
        errors.push(`Word at index ${index} is too short (minimum 2 characters)`);
      }
      if (!/^[A-Za-z]+$/.test(word)) {
        errors.push(`Word at index ${index} contains invalid characters`);
      }
    });
    
    // Check if words share enough letters for intersection
    if (errors.length === 0) {
      const letterFreq = new Map<string, number>();
      words.forEach(word => {
        [...new Set(word.toUpperCase().split(''))].forEach(letter => {
          letterFreq.set(letter, (letterFreq.get(letter) || 0) + 1);
        });
      });
      
      const sharedLetters = Array.from(letterFreq.values()).filter(count => count > 1);
      if (sharedLetters.length === 0) {
        errors.push('Words do not share any common letters for intersection');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
