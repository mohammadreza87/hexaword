import { Word } from '../entities/Word';

/**
 * Repository Interface: Word
 * Defines the contract for word/dictionary management
 */
export interface IWordRepository {
  /**
   * Gets words by theme
   */
  getWordsByTheme(theme: string, count?: number): Promise<Word[]>;

  /**
   * Gets words by difficulty level
   */
  getWordsByDifficulty(difficulty: WordDifficulty, count?: number): Promise<Word[]>;

  /**
   * Gets random words
   */
  getRandomWords(count: number, minLength?: number, maxLength?: number): Promise<Word[]>;

  /**
   * Validates if a word exists in dictionary
   */
  isValidWord(text: string): Promise<boolean>;

  /**
   * Gets word definition
   */
  getDefinition(text: string): Promise<string | null>;

  /**
   * Searches for words matching pattern
   */
  searchWords(pattern: string, limit?: number): Promise<Word[]>;

  /**
   * Gets related words (synonyms, etc.)
   */
  getRelatedWords(text: string): Promise<Word[]>;

  /**
   * Adds a custom word to user dictionary
   */
  addCustomWord(word: Word, userId: string): Promise<void>;

  /**
   * Gets user's custom words
   */
  getCustomWords(userId: string): Promise<Word[]>;
}

/**
 * Word difficulty levels
 */
export enum WordDifficulty {
  EASY = 'easy',
  MEDIUM = 'medium',
  HARD = 'hard',
  EXPERT = 'expert'
}

/**
 * Word theme categories
 */
export enum WordTheme {
  GENERAL = 'general',
  TECHNOLOGY = 'technology',
  NATURE = 'nature',
  SCIENCE = 'science',
  SPORTS = 'sports',
  FOOD = 'food',
  REDDIT = 'reddit',  // Reddit-specific words
  GAMING = 'gaming',
  MOVIES = 'movies',
  MUSIC = 'music'
}