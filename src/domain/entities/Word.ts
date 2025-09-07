import { Coordinate } from '../value-objects/Coordinate';
import { Direction } from '../value-objects/Coordinate';

/**
 * Domain Entity: Word
 * Represents a word that can be placed on the puzzle grid
 */
export class Word {
  private readonly _id: string;
  private readonly _text: string;
  private readonly _characters: string[];
  private _placement?: WordPlacement;

  constructor(text: string, id?: string) {
    if (!text || text.length < 2) {
      throw new Error('Word must have at least 2 characters');
    }
    
    if (!/^[A-Z]+$/.test(text.toUpperCase())) {
      throw new Error('Word must contain only letters');
    }

    this._id = id || this.generateId();
    this._text = text.toUpperCase();
    this._characters = this._text.split('');
  }

  /**
   * Gets the word ID
   */
  get id(): string {
    return this._id;
  }

  /**
   * Gets the word text
   */
  get text(): string {
    return this._text;
  }

  /**
   * Gets the word length
   */
  get length(): number {
    return this._characters.length;
  }

  /**
   * Gets characters array
   */
  get characters(): ReadonlyArray<string> {
    return this._characters;
  }

  /**
   * Gets character at position
   */
  charAt(index: number): string | undefined {
    return this._characters[index];
  }

  /**
   * Checks if word contains a character
   */
  contains(character: string): boolean {
    return this._characters.includes(character.toUpperCase());
  }

  /**
   * Gets all positions of a character in the word
   */
  findCharacterPositions(character: string): number[] {
    const positions: number[] = [];
    const char = character.toUpperCase();
    
    this._characters.forEach((c, index) => {
      if (c === char) {
        positions.push(index);
      }
    });
    
    return positions;
  }

  /**
   * Checks if word is placed on grid
   */
  get isPlaced(): boolean {
    return this._placement !== undefined;
  }

  /**
   * Gets word placement
   */
  get placement(): WordPlacement | undefined {
    return this._placement;
  }

  /**
   * Places the word on the grid
   */
  place(startCoordinate: Coordinate, direction: Direction): void {
    if (this.isPlaced) {
      throw new Error('Word is already placed');
    }
    
    this._placement = new WordPlacement(startCoordinate, direction, this.length);
  }

  /**
   * Removes the word from the grid
   */
  remove(): void {
    this._placement = undefined;
  }

  /**
   * Gets coordinates occupied by this word
   */
  getOccupiedCoordinates(): Coordinate[] {
    if (!this._placement) {
      return [];
    }
    
    return this._placement.getCoordinates();
  }

  /**
   * Checks if word intersects with a coordinate
   */
  intersectsAt(coordinate: Coordinate): { intersects: boolean; character?: string; index?: number } {
    if (!this._placement) {
      return { intersects: false };
    }
    
    const coordinates = this._placement.getCoordinates();
    
    for (let i = 0; i < coordinates.length; i++) {
      if (coordinates[i].equals(coordinate)) {
        return {
          intersects: true,
          character: this._characters[i],
          index: i
        };
      }
    }
    
    return { intersects: false };
  }

  /**
   * Calculates match score with another word
   */
  calculateMatchScore(other: Word): number {
    let score = 0;
    const otherChars = new Set(other.characters);
    
    for (const char of this._characters) {
      if (otherChars.has(char)) {
        score++;
      }
    }
    
    return score;
  }

  /**
   * Creates a copy of the word
   */
  clone(): Word {
    const cloned = new Word(this._text, this._id);
    if (this._placement) {
      cloned._placement = this._placement.clone();
    }
    return cloned;
  }

  /**
   * Generates unique ID for word
   */
  private generateId(): string {
    return `word_${this._text}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Converts to string representation
   */
  toString(): string {
    return this._text;
  }
}

/**
 * Value Object: WordPlacement
 * Represents where and how a word is placed on the grid
 */
export class WordPlacement {
  constructor(
    public readonly startCoordinate: Coordinate,
    public readonly direction: Direction,
    public readonly length: number
  ) {
    Object.freeze(this);
  }

  /**
   * Gets all coordinates occupied by this placement
   */
  getCoordinates(): Coordinate[] {
    const coordinates: Coordinate[] = [];
    let current = this.startCoordinate;
    
    for (let i = 0; i < this.length; i++) {
      coordinates.push(current);
      if (i < this.length - 1) {
        current = current.add(this.direction.toCoordinate());
      }
    }
    
    return coordinates;
  }

  /**
   * Gets the end coordinate
   */
  getEndCoordinate(): Coordinate {
    return this.startCoordinate.add(
      this.direction.toCoordinate().multiply(this.length - 1)
    );
  }

  /**
   * Checks if placement contains a coordinate
   */
  containsCoordinate(coordinate: Coordinate): boolean {
    return this.getCoordinates().some(c => c.equals(coordinate));
  }

  /**
   * Creates a copy
   */
  clone(): WordPlacement {
    return new WordPlacement(this.startCoordinate, this.direction, this.length);
  }
}