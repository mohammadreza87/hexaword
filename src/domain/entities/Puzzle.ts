import { Word } from './Word';
import { Cell } from './Cell';
import { Coordinate, Direction } from '../value-objects/Coordinate';
import { PuzzleCreatedEvent, WordPlacedEvent, WordRemovedEvent } from '../events/PuzzleEvents';

/**
 * Domain Entity: Puzzle
 * Aggregate root for the crossword puzzle
 */
export class Puzzle {
  private readonly _id: string;
  private readonly _gridRadius: number;
  private readonly _cells: Map<string, Cell> = new Map();
  private readonly _words: Map<string, Word> = new Map();
  private readonly _events: Array<object> = [];
  private _isComplete: boolean = false;
  private _createdAt: Date;
  private _updatedAt: Date;

  constructor(id: string, gridRadius: number = 10) {
    this._id = id;
    this._gridRadius = gridRadius;
    this._createdAt = new Date();
    this._updatedAt = new Date();
    
    this.addEvent(new PuzzleCreatedEvent(id, gridRadius));
  }

  /**
   * Gets puzzle ID
   */
  get id(): string {
    return this._id;
  }

  /**
   * Gets grid radius
   */
  get gridRadius(): number {
    return this._gridRadius;
  }

  /**
   * Gets all cells
   */
  get cells(): ReadonlyMap<string, Cell> {
    return new Map(this._cells);
  }

  /**
   * Gets all words
   */
  get words(): ReadonlyMap<string, Word> {
    return new Map(this._words);
  }

  /**
   * Gets placed words only
   */
  get placedWords(): Word[] {
    return Array.from(this._words.values()).filter(w => w.isPlaced);
  }

  /**
   * Gets domain events
   */
  get events(): ReadonlyArray<object> {
    return [...this._events];
  }

  /**
   * Clears domain events
   */
  clearEvents(): void {
    this._events.length = 0;
  }

  /**
   * Adds a word to the puzzle (not placed yet)
   */
  addWord(word: Word): void {
    if (this._words.has(word.id)) {
      throw new Error(`Word ${word.id} already exists in puzzle`);
    }
    
    this._words.set(word.id, word);
    this._updatedAt = new Date();
  }

  /**
   * Places a word on the grid
   */
  placeWord(wordId: string, startCoordinate: Coordinate, direction: Direction): void {
    const word = this._words.get(wordId);
    if (!word) {
      throw new Error(`Word ${wordId} not found in puzzle`);
    }
    
    if (word.isPlaced) {
      throw new Error(`Word ${wordId} is already placed`);
    }
    
    // Validate placement
    this.validateWordPlacement(word, startCoordinate, direction);
    
    // Place the word
    word.place(startCoordinate, direction);
    
    // Update cells
    const coordinates = word.getOccupiedCoordinates();
    coordinates.forEach((coord, index) => {
      const key = coord.toString();
      let cell = this._cells.get(key);
      
      if (!cell) {
        cell = new Cell(coord);
        this._cells.set(key, cell);
      }
      
      const letter = word.charAt(index);
      if (letter) {
        if (cell.hasLetter && cell.letter !== letter) {
          throw new Error(`Letter conflict at ${key}: ${cell.letter} vs ${letter}`);
        }
        cell.setLetter(letter);
      }
      
      cell.addWord(word.id);
    });
    
    this._updatedAt = new Date();
    this.addEvent(new WordPlacedEvent(this._id, wordId, startCoordinate, direction));
  }

  /**
   * Removes a word from the grid
   */
  removeWord(wordId: string): void {
    const word = this._words.get(wordId);
    if (!word) {
      throw new Error(`Word ${wordId} not found`);
    }
    
    if (!word.isPlaced) {
      return;
    }
    
    // Remove from cells
    const coordinates = word.getOccupiedCoordinates();
    coordinates.forEach(coord => {
      const key = coord.toString();
      const cell = this._cells.get(key);
      
      if (cell) {
        cell.removeWord(word.id);
        
        // Remove cell if empty
        if (cell.wordCount === 0) {
          this._cells.delete(key);
        }
      }
    });
    
    // Remove word placement
    word.remove();
    
    this._updatedAt = new Date();
    this.addEvent(new WordRemovedEvent(this._id, wordId));
  }

  /**
   * Validates word placement
   */
  private validateWordPlacement(word: Word, start: Coordinate, direction: Direction): void {
    const coordinates = this.getPlacementCoordinates(start, direction, word.length);
    
    // Check grid bounds
    for (const coord of coordinates) {
      if (!this.isWithinBounds(coord)) {
        throw new Error(`Word placement exceeds grid bounds at ${coord.toString()}`);
      }
    }
    
    // Check for conflicts and ensure valid intersections
    let hasIntersection = false;
    
    coordinates.forEach((coord, index) => {
      const key = coord.toString();
      const existingCell = this._cells.get(key);
      
      if (existingCell && existingCell.hasLetter) {
        const wordLetter = word.charAt(index);
        
        if (existingCell.letter !== wordLetter) {
          throw new Error(
            `Letter conflict at ${key}: existing '${existingCell.letter}' vs new '${wordLetter}'`
          );
        }
        
        hasIntersection = true;
      }
    });
    
    // First word doesn't need intersection
    if (this.placedWords.length > 0 && !hasIntersection) {
      throw new Error('Word must intersect with at least one existing word');
    }
    
    // Check for invalid adjacencies (words touching but not intersecting)
    this.validateAdjacencies(coordinates, word);
  }

  /**
   * Validates that word doesn't create invalid adjacencies
   */
  private validateAdjacencies(wordCoordinates: Coordinate[], word: Word): void {
    const wordCoordSet = new Set(wordCoordinates.map(c => c.toString()));
    
    for (const coord of wordCoordinates) {
      // Check all 6 neighbors
      for (const dir of Direction.ALL) {
        const neighbor = coord.neighbor(dir);
        const neighborKey = neighbor.toString();
        
        // Skip if neighbor is part of the same word
        if (wordCoordSet.has(neighborKey)) {
          continue;
        }
        
        // Check if neighbor has a letter from another word
        const neighborCell = this._cells.get(neighborKey);
        if (neighborCell && neighborCell.hasLetter) {
          // This is only valid if the current position is an intersection
          const currentCell = this._cells.get(coord.toString());
          if (!currentCell || !currentCell.hasLetter) {
            throw new Error(
              `Invalid adjacency: word would touch another word at ${coord.toString()} without intersecting`
            );
          }
        }
      }
    }
  }

  /**
   * Gets coordinates for a potential word placement
   */
  private getPlacementCoordinates(start: Coordinate, direction: Direction, length: number): Coordinate[] {
    const coordinates: Coordinate[] = [];
    let current = start;
    
    for (let i = 0; i < length; i++) {
      coordinates.push(current);
      if (i < length - 1) {
        current = current.add(direction.toCoordinate());
      }
    }
    
    return coordinates;
  }

  /**
   * Checks if coordinate is within grid bounds
   */
  isWithinBounds(coordinate: Coordinate): boolean {
    const distance = Math.max(
      Math.abs(coordinate.q),
      Math.abs(coordinate.r),
      Math.abs(coordinate.s)
    );
    
    return distance <= this._gridRadius;
  }

  /**
   * Gets a cell at coordinate
   */
  getCellAt(coordinate: Coordinate): Cell | undefined {
    return this._cells.get(coordinate.toString());
  }

  /**
   * Finds all valid placements for a word
   */
  findValidPlacements(word: Word): Array<{start: Coordinate, direction: Direction}> {
    const placements: Array<{start: Coordinate, direction: Direction}> = [];
    
    // If no words placed yet, place at center
    if (this.placedWords.length === 0) {
      const center = new Coordinate(0, 0);
      for (const dir of Direction.READABLE) {
        try {
          // Try centering the word
          const offset = Math.floor(word.length / 2);
          const start = center.subtract(dir.toCoordinate().multiply(offset));
          
          this.validateWordPlacement(word, start, dir);
          placements.push({ start, direction: dir });
        } catch {
          // Invalid placement, skip
        }
      }
      
      return placements;
    }
    
    // Find intersections with existing words
    for (const placedWord of this.placedWords) {
      for (let i = 0; i < word.length; i++) {
        const char = word.charAt(i);
        if (!char) continue;
        
        const positions = placedWord.findCharacterPositions(char);
        
        for (const pos of positions) {
          const intersectionCoord = placedWord.getOccupiedCoordinates()[pos];
          
          // Try each readable direction except the same as placed word
          for (const dir of Direction.READABLE) {
            if (placedWord.placement?.direction === dir) continue;
            
            const start = intersectionCoord.subtract(dir.toCoordinate().multiply(i));
            
            try {
              this.validateWordPlacement(word, start, dir);
              placements.push({ start, direction: dir });
            } catch {
              // Invalid placement, skip
            }
          }
        }
      }
    }
    
    return placements;
  }

  /**
   * Marks puzzle as complete
   */
  markComplete(): void {
    this._isComplete = true;
    this._updatedAt = new Date();
  }

  /**
   * Checks if puzzle is complete
   */
  get isComplete(): boolean {
    return this._isComplete;
  }

  /**
   * Gets puzzle statistics
   */
  getStatistics(): PuzzleStatistics {
    const placedWordCount = this.placedWords.length;
    const totalWordCount = this._words.size;
    const cellCount = this._cells.size;
    const intersectionCount = Array.from(this._cells.values())
      .filter(cell => cell.isIntersection).length;
    
    return {
      placedWords: placedWordCount,
      totalWords: totalWordCount,
      placementRatio: totalWordCount > 0 ? placedWordCount / totalWordCount : 0,
      cells: cellCount,
      intersections: intersectionCount,
      density: cellCount / (Math.PI * this._gridRadius * this._gridRadius)
    };
  }

  /**
   * Adds domain event
   */
  private addEvent(event: object): void {
    this._events.push(event);
  }

  /**
   * Creates a copy of the puzzle
   */
  clone(): Puzzle {
    const cloned = new Puzzle(this._id, this._gridRadius);
    
    // Clone words
    this._words.forEach(word => {
      cloned._words.set(word.id, word.clone());
    });
    
    // Clone cells
    this._cells.forEach((cell, key) => {
      cloned._cells.set(key, cell.clone());
    });
    
    cloned._isComplete = this._isComplete;
    cloned._createdAt = new Date(this._createdAt);
    cloned._updatedAt = new Date(this._updatedAt);
    
    return cloned;
  }
}

/**
 * Value Object: Puzzle Statistics
 */
export interface PuzzleStatistics {
  placedWords: number;
  totalWords: number;
  placementRatio: number;
  cells: number;
  intersections: number;
  density: number;
}