import { Puzzle } from '../entities/Puzzle';

/**
 * Repository Interface: Puzzle
 * Defines the contract for puzzle persistence
 * No implementation details - pure domain interface
 */
export interface IPuzzleRepository {
  /**
   * Saves a puzzle
   */
  save(puzzle: Puzzle): Promise<void>;

  /**
   * Finds a puzzle by ID
   */
  findById(id: string): Promise<Puzzle | null>;

  /**
   * Finds daily puzzle for a specific date
   */
  findDailyPuzzle(date: Date): Promise<Puzzle | null>;

  /**
   * Finds puzzles by criteria
   */
  findByCriteria(criteria: PuzzleSearchCriteria): Promise<Puzzle[]>;

  /**
   * Deletes a puzzle
   */
  delete(id: string): Promise<void>;

  /**
   * Checks if a puzzle exists
   */
  exists(id: string): Promise<boolean>;

  /**
   * Gets the next available puzzle ID
   */
  nextId(): Promise<string>;
}

/**
 * Search criteria for puzzles
 */
export interface PuzzleSearchCriteria {
  createdAfter?: Date;
  createdBefore?: Date;
  isComplete?: boolean;
  minWords?: number;
  maxWords?: number;
  limit?: number;
  offset?: number;
}