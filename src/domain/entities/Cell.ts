import { Coordinate } from '../value-objects/Coordinate';

/**
 * Domain Entity: Cell
 * Represents a single hexagonal cell in the puzzle grid
 */
export class Cell {
  private _letter: string | null = null;
  private readonly _wordIds: Set<string> = new Set();
  private _isLocked: boolean = false;

  constructor(
    private readonly _coordinate: Coordinate,
    letter?: string
  ) {
    if (letter) {
      this.setLetter(letter);
    }
  }

  /**
   * Gets the cell's coordinate
   */
  get coordinate(): Coordinate {
    return this._coordinate;
  }

  /**
   * Gets the cell's letter
   */
  get letter(): string | null {
    return this._letter;
  }

  /**
   * Sets the cell's letter
   */
  setLetter(letter: string): void {
    if (this._isLocked) {
      throw new Error('Cannot modify locked cell');
    }
    
    if (letter.length !== 1 || !/^[A-Z]$/i.test(letter)) {
      throw new Error('Letter must be a single alphabetic character');
    }
    
    this._letter = letter.toUpperCase();
  }

  /**
   * Clears the cell's letter
   */
  clearLetter(): void {
    if (this._isLocked) {
      throw new Error('Cannot modify locked cell');
    }
    
    this._letter = null;
    this._wordIds.clear();
  }

  /**
   * Checks if cell has a letter
   */
  get hasLetter(): boolean {
    return this._letter !== null;
  }

  /**
   * Checks if cell is empty
   */
  get isEmpty(): boolean {
    return this._letter === null;
  }

  /**
   * Adds a word ID to this cell
   */
  addWord(wordId: string): void {
    this._wordIds.add(wordId);
  }

  /**
   * Removes a word ID from this cell
   */
  removeWord(wordId: string): void {
    this._wordIds.delete(wordId);
    
    // Clear letter if no words reference this cell
    if (this._wordIds.size === 0) {
      this._letter = null;
    }
  }

  /**
   * Gets all word IDs at this cell
   */
  get wordIds(): ReadonlySet<string> {
    return new Set(this._wordIds);
  }

  /**
   * Checks if cell is an intersection (multiple words)
   */
  get isIntersection(): boolean {
    return this._wordIds.size > 1;
  }

  /**
   * Gets the number of words at this cell
   */
  get wordCount(): number {
    return this._wordIds.size;
  }

  /**
   * Checks if cell contains a specific word
   */
  containsWord(wordId: string): boolean {
    return this._wordIds.has(wordId);
  }

  /**
   * Locks the cell (prevents modifications)
   */
  lock(): void {
    this._isLocked = true;
  }

  /**
   * Unlocks the cell
   */
  unlock(): void {
    this._isLocked = false;
  }

  /**
   * Checks if cell is locked
   */
  get isLocked(): boolean {
    return this._isLocked;
  }

  /**
   * Validates that a letter can be placed here
   */
  canPlaceLetter(letter: string): boolean {
    if (this._isLocked) {
      return false;
    }
    
    // If cell is empty, any letter can be placed
    if (this.isEmpty) {
      return true;
    }
    
    // If cell has a letter, it must match
    return this._letter === letter.toUpperCase();
  }

  /**
   * Creates a copy of the cell
   */
  clone(): Cell {
    const cloned = new Cell(this._coordinate, this._letter || undefined);
    
    // Copy word IDs
    this._wordIds.forEach(id => cloned.addWord(id));
    
    if (this._isLocked) {
      cloned.lock();
    }
    
    return cloned;
  }

  /**
   * Converts to plain object for serialization
   */
  toJSON(): object {
    return {
      coordinate: {
        q: this._coordinate.q,
        r: this._coordinate.r
      },
      letter: this._letter,
      wordIds: Array.from(this._wordIds),
      isLocked: this._isLocked
    };
  }

  /**
   * Creates from plain object
   */
  static fromJSON(data: any): Cell {
    const coordinate = new Coordinate(data.coordinate.q, data.coordinate.r);
    const cell = new Cell(coordinate, data.letter);
    
    data.wordIds.forEach((id: string) => cell.addWord(id));
    
    if (data.isLocked) {
      cell.lock();
    }
    
    return cell;
  }
}