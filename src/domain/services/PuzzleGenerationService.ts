import { Puzzle } from '../entities/Puzzle';
import { Word } from '../entities/Word';
import { Coordinate, Direction } from '../value-objects/Coordinate';

/**
 * Domain Service: Puzzle Generation
 * Contains the core business logic for generating crossword puzzles
 * This is pure domain logic with no infrastructure dependencies
 */
export class PuzzleGenerationService {
  /**
   * Generates a puzzle from a list of words
   */
  generatePuzzle(
    puzzleId: string,
    words: Word[],
    gridRadius: number = 10,
    strategy?: IPlacementStrategy
  ): Puzzle {
    if (words.length < 3) {
      throw new Error('At least 3 words are required to generate a puzzle');
    }

    const puzzle = new Puzzle(puzzleId, gridRadius);
    
    // Add all words to puzzle
    words.forEach(word => puzzle.addWord(word));
    
    // Use strategy to place words
    const placementStrategy = strategy || new DefaultPlacementStrategy();
    placementStrategy.placeWords(puzzle, words);
    
    // Mark complete if successful
    const stats = puzzle.getStatistics();
    if (stats.placementRatio >= 0.8) {
      puzzle.markComplete();
    }
    
    return puzzle;
  }

  /**
   * Validates if a puzzle meets quality criteria
   */
  validatePuzzleQuality(puzzle: Puzzle): PuzzleQualityResult {
    const stats = puzzle.getStatistics();
    const issues: string[] = [];
    
    // Check placement ratio
    if (stats.placementRatio < 0.5) {
      issues.push('Less than 50% of words are placed');
    }
    
    // Check intersection count
    if (stats.intersections < 2) {
      issues.push('Too few word intersections');
    }
    
    // Check density
    if (stats.density < 0.1) {
      issues.push('Puzzle is too sparse');
    }
    
    // Check connectivity
    if (!this.isFullyConnected(puzzle)) {
      issues.push('Not all words are connected');
    }
    
    return {
      isValid: issues.length === 0,
      score: this.calculateQualityScore(stats),
      issues
    };
  }

  /**
   * Checks if all placed words form a connected graph
   */
  private isFullyConnected(puzzle: Puzzle): boolean {
    const placedWords = puzzle.placedWords;
    if (placedWords.length <= 1) return true;
    
    // Build adjacency graph
    const graph = new Map<string, Set<string>>();
    
    // Initialize graph nodes
    placedWords.forEach(word => {
      graph.set(word.id, new Set());
    });
    
    // Find intersections to build edges
    for (let i = 0; i < placedWords.length; i++) {
      for (let j = i + 1; j < placedWords.length; j++) {
        const word1 = placedWords[i];
        const word2 = placedWords[j];
        
        if (this.wordsIntersect(word1, word2)) {
          graph.get(word1.id)?.add(word2.id);
          graph.get(word2.id)?.add(word1.id);
        }
      }
    }
    
    // Check connectivity using DFS
    const visited = new Set<string>();
    const startWord = placedWords[0];
    
    this.dfs(startWord.id, graph, visited);
    
    return visited.size === placedWords.length;
  }

  /**
   * Depth-first search for connectivity check
   */
  private dfs(nodeId: string, graph: Map<string, Set<string>>, visited: Set<string>): void {
    visited.add(nodeId);
    
    const neighbors = graph.get(nodeId);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          this.dfs(neighbor, graph, visited);
        }
      }
    }
  }

  /**
   * Checks if two words intersect
   */
  private wordsIntersect(word1: Word, word2: Word): boolean {
    const coords1 = word1.getOccupiedCoordinates();
    const coords2 = word2.getOccupiedCoordinates();
    
    for (const coord1 of coords1) {
      for (const coord2 of coords2) {
        if (coord1.equals(coord2)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Calculates quality score (0-100)
   */
  private calculateQualityScore(stats: any): number {
    let score = 0;
    
    // Placement ratio (40 points max)
    score += stats.placementRatio * 40;
    
    // Intersection density (30 points max)
    const intersectionRatio = stats.cells > 0 ? stats.intersections / stats.cells : 0;
    score += Math.min(intersectionRatio * 100, 30);
    
    // Grid density (30 points max)
    score += Math.min(stats.density * 100, 30);
    
    return Math.round(score);
  }
}

/**
 * Interface for word placement strategies
 */
export interface IPlacementStrategy {
  placeWords(puzzle: Puzzle, words: Word[]): void;
}

/**
 * Default placement strategy
 */
export class DefaultPlacementStrategy implements IPlacementStrategy {
  placeWords(puzzle: Puzzle, words: Word[]): void {
    // Sort words by length and match potential
    const sortedWords = this.sortWords(words);
    
    // Place first three words intersecting at center
    if (sortedWords.length >= 3) {
      this.placeInitialWords(puzzle, sortedWords.slice(0, 3));
    }
    
    // Place remaining words
    for (let i = 3; i < sortedWords.length; i++) {
      this.placeWord(puzzle, sortedWords[i]);
    }
  }

  private sortWords(words: Word[]): Word[] {
    return [...words].sort((a, b) => {
      // Prioritize longer words
      const lengthDiff = b.length - a.length;
      if (lengthDiff !== 0) return lengthDiff;
      
      // Then by letter diversity
      const diversityA = new Set(a.characters).size;
      const diversityB = new Set(b.characters).size;
      return diversityB - diversityA;
    });
  }

  private placeInitialWords(puzzle: Puzzle, words: Word[]): void {
    const [word1, word2, word3] = words;
    
    // Find shared letter
    const sharedLetter = this.findSharedLetter(word1, word2, word3);
    if (!sharedLetter) {
      throw new Error('Initial words must share at least one letter');
    }
    
    // Place first word horizontally through center
    const idx1 = word1.characters.indexOf(sharedLetter);
    const start1 = new Coordinate(-idx1, 0);
    puzzle.placeWord(word1.id, start1, Direction.HORIZONTAL);
    
    // Place second word vertically through center
    const idx2 = word2.characters.indexOf(sharedLetter);
    const start2 = new Coordinate(0, -idx2);
    puzzle.placeWord(word2.id, start2, Direction.VERTICAL);
    
    // Place third word diagonally through center
    const idx3 = word3.characters.indexOf(sharedLetter);
    const start3 = new Coordinate(-idx3, idx3);
    puzzle.placeWord(word3.id, start3, Direction.DIAGONAL);
  }

  private findSharedLetter(word1: Word, word2: Word, word3: Word): string | null {
    for (const letter of word1.characters) {
      if (word2.contains(letter) && word3.contains(letter)) {
        return letter;
      }
    }
    return null;
  }

  private placeWord(puzzle: Puzzle, word: Word): void {
    const placements = puzzle.findValidPlacements(word);
    
    if (placements.length === 0) {
      console.warn(`Could not place word: ${word.text}`);
      return;
    }
    
    // Choose best placement (prefer more intersections)
    const bestPlacement = this.chooseBestPlacement(puzzle, word, placements);
    puzzle.placeWord(word.id, bestPlacement.start, bestPlacement.direction);
  }

  private chooseBestPlacement(
    puzzle: Puzzle,
    word: Word,
    placements: Array<{start: Coordinate, direction: Direction}>
  ): {start: Coordinate, direction: Direction} {
    // For now, return first valid placement
    // Could be enhanced with scoring logic
    return placements[0];
  }
}

/**
 * Result of puzzle quality validation
 */
export interface PuzzleQualityResult {
  isValid: boolean;
  score: number;
  issues: string[];
}