import { Coordinate, Direction } from '../value-objects/Coordinate';

/**
 * Base Domain Event
 */
export abstract class DomainEvent {
  public readonly occurredAt: Date;
  
  constructor() {
    this.occurredAt = new Date();
  }
  
  abstract get eventName(): string;
}

/**
 * Event: Puzzle Created
 */
export class PuzzleCreatedEvent extends DomainEvent {
  constructor(
    public readonly puzzleId: string,
    public readonly gridRadius: number
  ) {
    super();
  }
  
  get eventName(): string {
    return 'PuzzleCreated';
  }
}

/**
 * Event: Word Added to Puzzle
 */
export class WordAddedEvent extends DomainEvent {
  constructor(
    public readonly puzzleId: string,
    public readonly wordId: string,
    public readonly wordText: string
  ) {
    super();
  }
  
  get eventName(): string {
    return 'WordAdded';
  }
}

/**
 * Event: Word Placed on Grid
 */
export class WordPlacedEvent extends DomainEvent {
  constructor(
    public readonly puzzleId: string,
    public readonly wordId: string,
    public readonly startCoordinate: Coordinate,
    public readonly direction: Direction
  ) {
    super();
  }
  
  get eventName(): string {
    return 'WordPlaced';
  }
}

/**
 * Event: Word Removed from Grid
 */
export class WordRemovedEvent extends DomainEvent {
  constructor(
    public readonly puzzleId: string,
    public readonly wordId: string
  ) {
    super();
  }
  
  get eventName(): string {
    return 'WordRemoved';
  }
}

/**
 * Event: Puzzle Completed
 */
export class PuzzleCompletedEvent extends DomainEvent {
  constructor(
    public readonly puzzleId: string,
    public readonly statistics: {
      placedWords: number;
      totalWords: number;
      intersections: number;
    }
  ) {
    super();
  }
  
  get eventName(): string {
    return 'PuzzleCompleted';
  }
}

/**
 * Event: Puzzle Generation Started
 */
export class PuzzleGenerationStartedEvent extends DomainEvent {
  constructor(
    public readonly puzzleId: string,
    public readonly wordCount: number,
    public readonly algorithm: string
  ) {
    super();
  }
  
  get eventName(): string {
    return 'PuzzleGenerationStarted';
  }
}

/**
 * Event: Puzzle Generation Completed
 */
export class PuzzleGenerationCompletedEvent extends DomainEvent {
  constructor(
    public readonly puzzleId: string,
    public readonly success: boolean,
    public readonly placedWords: number,
    public readonly totalWords: number,
    public readonly duration: number
  ) {
    super();
  }
  
  get eventName(): string {
    return 'PuzzleGenerationCompleted';
  }
}