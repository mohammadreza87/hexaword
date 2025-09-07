import { 
  WordObject, 
  HexCell, 
  PlacementResult, 
  ConnectionPoint,
  HEX_DIRECTIONS,
  ALL_HEX_DIRECTIONS,
  HexCoordinate
} from '../types/hexaword';
import { SeededRNG } from '../utils/rng';

export class WordPlacementService {
  private board: Map<string, HexCell> = new Map();
  private occupiedCells: Set<string> = new Set();
  private wordsActive: WordObject[] = [];
  private readonly gridRadius: number;
  private rng: SeededRNG | null;

  constructor(gridRadius: number = 10, rng?: SeededRNG) {
    this.gridRadius = gridRadius;
    this.rng = rng || null;
  }

  /**
   * Places all words on the grid using constraint satisfaction
   */
  placeWords(words: WordObject[]): boolean {
    this.resetBoard();
    const wordBank = [...words];
    
    // Sort by length for better placement (longer words first)
    wordBank.sort((a, b) => b.word.length - a.word.length);
    
    // Step 1: Place first 3 words crossing at center
    const layer1Success = this.placeFirstThreeWords(wordBank);
    if (!layer1Success) {
      console.log('Failed to place first 3 words');
      return false;
    }
    
    // Step 2: Place remaining words systematically
    this.placeRemainingWords(wordBank);
    
    console.log(`Placed ${this.wordsActive.length} out of ${words.length} words.`);
    return this.wordsActive.length === words.length;
  }

  /**
   * Places the first three words intersecting at the center
   */
  private placeFirstThreeWords(wordBank: WordObject[]): boolean {
    if (wordBank.length < 3) return false;
    
    const sharedLetterInfo = this.findSharedMiddleLetter(wordBank[0], wordBank[1], wordBank[2]);
    if (!sharedLetterInfo) {
      console.log('No shared middle letter found in first 3 words');
      return false;
    }
    
    const {letter, idx1, idx2, idx3} = sharedLetterInfo;
    console.log(`Placing first 3 words with shared middle letter '${letter}'`);
    
    // Place word 1 on Q axis (horizontal)
    this.placeWordAt(wordBank[0], -idx1, 0, 0);
    
    // Place word 2 on R axis (vertical)
    this.placeWordAt(wordBank[1], 0, -idx2, 1);
    
    // Place word 3 on S axis (diagonal)
    this.placeWordAt(wordBank[2], -idx3, idx3, 2);
    
    // Remove placed words from wordBank
    wordBank.splice(0, 3);
    
    return true;
  }

  /**
   * Finds a letter that appears in the middle of all 3 words
   */
  private findSharedMiddleLetter(
    word1: WordObject, 
    word2: WordObject, 
    word3: WordObject
  ): {letter: string, idx1: number, idx2: number, idx3: number} | null {
    const getMiddleIndices = (word: WordObject): number[] => {
      const indices: number[] = [];
      const len = word.chars.length;
      if (len <= 2) return [];
      
      const mid = Math.floor(len / 2);
      indices.push(mid);
      
      // Add indices working outward from middle
      for (let offset = 1; offset < Math.max(mid, len - mid - 1); offset++) {
        if (mid - offset > 0) indices.push(mid - offset);
        if (mid + offset < len - 1) indices.push(mid + offset);
      }
      
      return indices;
    };
    
    const indices1 = getMiddleIndices(word1);
    const indices2 = getMiddleIndices(word2);
    const indices3 = getMiddleIndices(word3);
    
    // Check each position in word1
    for (const i of indices1) {
      const letter = word1.chars[i];
      
      // Check if this letter exists in middle of word2
      let idx2 = -1;
      for (const j of indices2) {
        if (word2.chars[j] === letter) {
          idx2 = j;
          break;
        }
      }
      if (idx2 === -1) continue;
      
      // Check if this letter exists in middle of word3
      let idx3 = -1;
      for (const k of indices3) {
        if (word3.chars[k] === letter) {
          idx3 = k;
          break;
        }
      }
      if (idx3 === -1) continue;
      
      // Found a shared middle letter!
      return { letter, idx1: i, idx2, idx3 };
    }
    
    return null;
  }

  /**
   * Places remaining words using connection points
   */
  private placeRemainingWords(wordBank: WordObject[]): void {
    const waitlist: WordObject[] = [];
    let connectionPoints = this.getConnectionPoints();
    
    while (wordBank.length > 0 || waitlist.length > 0) {
      let placedAny = false;
      
      // Try to place words from wordBank
      if (wordBank.length > 0) {
        for (const point of connectionPoints) {
          if (this.isConnectionPointFull(point)) continue;
          
          for (let i = wordBank.length - 1; i >= 0; i--) {
            const word = wordBank[i];
            const placement = this.tryPlaceWordAtPoint(word, point);
            
            if (placement) {
              this.placeWordAt(word, placement.q, placement.r, placement.dir);
              wordBank.splice(i, 1);
              placedAny = true;
              
              // Add new connection points
              const newPoints = this.getWordEndpoints(word);
              connectionPoints.push(...newPoints);
              break;
            }
          }
        }
        
        // Move remaining to waitlist
        while (wordBank.length > 0) {
          waitlist.push(wordBank.pop()!);
        }
      }
      
      // Try waitlist words
      if (waitlist.length > 0 && connectionPoints.length > 0) {
        for (const point of connectionPoints) {
          if (this.isConnectionPointFull(point)) continue;
          
          for (let i = waitlist.length - 1; i >= 0; i--) {
            const word = waitlist[i];
            const placement = this.tryPlaceWordAtPoint(word, point);
            
            if (placement) {
              this.placeWordAt(word, placement.q, placement.r, placement.dir);
              waitlist.splice(i, 1);
              placedAny = true;
              
              const newPoints = this.getWordEndpoints(word);
              connectionPoints.push(...newPoints);
              break;
            }
          }
        }
      }
      
      // If no placements found, place separately
      if (!placedAny && waitlist.length > 0) {
        while (waitlist.length > 0) {
          const word = waitlist.shift()!;
          const placement = this.findClosestEmptyPlacement(word);
          
          if (placement) {
            this.placeWordAt(word, placement.q, placement.r, placement.dir);
          }
        }
        break;
      }
      
      if (wordBank.length === 0 && waitlist.length === 0) break;
      if (!placedAny) break;
    }
  }

  /**
   * Tries to place a word at a connection point
   */
  private tryPlaceWordAtPoint(
    word: WordObject, 
    point: ConnectionPoint
  ): PlacementResult | null {
    const existingCell = this.board.get(`${point.q},${point.r}`);
    if (!existingCell) return null;
    
    // Collect all valid placements
    const validPlacements: PlacementResult[] = [];
    
    // Check each letter of the word
    for (let i = 0; i < word.chars.length; i++) {
      if (word.chars[i] === existingCell.letter) {
        // Try each direction except parent direction
        for (let dir = 0; dir < 3; dir++) {
          if (dir === point.parentDir) continue;
          
          const startPos = this.getWordStartPosition({q: point.q, r: point.r}, i, dir);
          
          if (this.canPlaceWord(word, startPos.q, startPos.r, dir)) {
            validPlacements.push({q: startPos.q, r: startPos.r, dir});
          }
        }
      }
    }
    
    // DETERMINISTIC: Choose placement based on consistent criteria
    if (validPlacements.length === 0) return null;
    
    if (validPlacements.length === 1) return validPlacements[0];
    
    // Sort placements for deterministic selection
    validPlacements.sort((a, b) => {
      // First by q coordinate
      if (a.q !== b.q) return a.q - b.q;
      // Then by r coordinate
      if (a.r !== b.r) return a.r - b.r;
      // Finally by direction
      return a.dir - b.dir;
    });
    
    // If RNG provided, pick from sorted list, otherwise take first
    if (this.rng) {
      const index = this.rng.nextInt(0, validPlacements.length - 1);
      return validPlacements[index];
    }
    
    return validPlacements[0];
  }

  /**
   * Checks if a word can be placed at the given position
   */
  private canPlaceWord(
    word: WordObject, 
    startQ: number, 
    startR: number, 
    dir: number
  ): boolean {
    const direction = HEX_DIRECTIONS[dir];
    const intersectionPoints: HexCoordinate[] = [];
    
    // First pass: Check bounds and find intersections
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      const s = -q - r;
      
      // Check grid bounds
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > this.gridRadius) {
        return false;
      }
      
      const key = `${q},${r}`;
      const existing = this.board.get(key);
      
      if (existing) {
        // Must match at intersection
        if (existing.letter !== word.chars[i]) {
          return false;
        }
        intersectionPoints.push({q, r});
      }
    }
    
    // Must have intersection (except for initial placement)
    if (this.wordsActive.length > 0 && intersectionPoints.length === 0) {
      return false;
    }
    
    // Check for unwanted adjacencies
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      
      // Skip if this is an intersection point
      const isIntersection = intersectionPoints.some(p => p.q === q && p.r === r);
      if (isIntersection) continue;
      
      // Check all 6 neighbors
      for (const neighbor of ALL_HEX_DIRECTIONS) {
        const nq = q + neighbor.q;
        const nr = r + neighbor.r;
        
        // Skip if neighbor would be part of same word
        let isPartOfSameWord = false;
        for (let j = 0; j < word.chars.length; j++) {
          const wq = startQ + direction.q * j;
          const wr = startR + direction.r * j;
          if (wq === nq && wr === nr) {
            isPartOfSameWord = true;
            break;
          }
        }
        
        if (!isPartOfSameWord && this.board.has(`${nq},${nr}`)) {
          return false; // Adjacent to another word
        }
      }
    }
    
    return true;
  }

  /**
   * Places a word on the board
   */
  private placeWordAt(word: WordObject, startQ: number, startR: number, dir: number): void {
    word.q = startQ;
    word.r = startR;
    word.dir = dir;
    word.placed = true;
    
    const direction = HEX_DIRECTIONS[dir];
    
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      const key = `${q},${r}`;
      
      let cell = this.board.get(key);
      if (!cell) {
        cell = { q, r, letter: word.chars[i], wordIds: [] };
        this.board.set(key, cell);
        this.occupiedCells.add(key);
      }
      
      cell.wordIds.push(this.wordsActive.length);
    }
    
    this.wordsActive.push(word);
  }

  /**
   * Gets the starting position for a word given an intersection point
   */
  private getWordStartPosition(
    intersectionPos: HexCoordinate, 
    charIndex: number, 
    dir: number
  ): HexCoordinate {
    const direction = HEX_DIRECTIONS[dir];
    return {
      q: intersectionPos.q - direction.q * charIndex,
      r: intersectionPos.r - direction.r * charIndex
    };
  }

  /**
   * Gets connection points from placed words
   */
  private getConnectionPoints(): ConnectionPoint[] {
    const points: ConnectionPoint[] = [];
    
    // Get endpoints of first 3 placed words
    for (let i = 0; i < Math.min(3, this.wordsActive.length); i++) {
      const word = this.wordsActive[i];
      const endpoints = this.getWordEndpoints(word);
      points.push(...endpoints);
    }
    
    return points;
  }

  /**
   * Gets the endpoints of a word
   */
  private getWordEndpoints(word: WordObject): ConnectionPoint[] {
    const points: ConnectionPoint[] = [];
    const dir = HEX_DIRECTIONS[word.dir!];
    
    // Start point
    points.push({
      q: word.q!,
      r: word.r!,
      parentDir: word.dir!
    });
    
    // End point
    points.push({
      q: word.q! + dir.q * (word.chars.length - 1),
      r: word.r! + dir.r * (word.chars.length - 1),
      parentDir: word.dir!
    });
    
    return points;
  }

  /**
   * Checks if a connection point is full
   */
  private isConnectionPointFull(point: ConnectionPoint): boolean {
    let filledDirections = 0;
    
    for (let dir = 0; dir < 3; dir++) {
      if (dir === point.parentDir) continue;
      
      if (this.hasWordInDirection(point.q, point.r, dir)) {
        filledDirections++;
      }
    }
    
    return filledDirections >= 2;
  }

  /**
   * Checks if there's a word in a given direction from a point
   */
  private hasWordInDirection(q: number, r: number, dir: number): boolean {
    const direction = HEX_DIRECTIONS[dir];
    const nextKey = `${q + direction.q},${r + direction.r}`;
    
    if (this.board.has(nextKey)) {
      for (const word of this.wordsActive) {
        if (word.dir === dir) {
          for (let i = 0; i < word.chars.length; i++) {
            const wq = word.q! + HEX_DIRECTIONS[word.dir!].q * i;
            const wr = word.r! + HEX_DIRECTIONS[word.dir!].r * i;
            if (wq === q && wr === r) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }

  /**
   * Finds the closest empty placement for a word
   */
  private findClosestEmptyPlacement(word: WordObject): PlacementResult | null {
    for (let radius = 1; radius <= this.gridRadius - word.chars.length; radius++) {
      const positions = this.getPositionsAtRadius(radius);
      
      for (const pos of positions) {
        for (let dir = 0; dir < 3; dir++) {
          if (this.canPlaceWordEmpty(word, pos.q, pos.r, dir)) {
            return {q: pos.q, r: pos.r, dir};
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Checks if a word can be placed in empty space
   */
  private canPlaceWordEmpty(
    word: WordObject, 
    startQ: number, 
    startR: number, 
    dir: number
  ): boolean {
    const direction = HEX_DIRECTIONS[dir];
    
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      const s = -q - r;
      
      // Check bounds
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > this.gridRadius) {
        return false;
      }
      
      // Check if cell is occupied
      if (this.board.has(`${q},${r}`)) {
        return false;
      }
      
      // Check for adjacent cells (maintain spacing)
      for (const neighbor of ALL_HEX_DIRECTIONS) {
        const nq = q + neighbor.q;
        const nr = r + neighbor.r;
        
        // Skip if neighbor would be part of same word
        let isPartOfSameWord = false;
        for (let j = 0; j < word.chars.length; j++) {
          const wq = startQ + direction.q * j;
          const wr = startR + direction.r * j;
          if (wq === nq && wr === nr) {
            isPartOfSameWord = true;
            break;
          }
        }
        
        if (!isPartOfSameWord && this.board.has(`${nq},${nr}`)) {
          return false;
        }
      }
    }
    
    return true;
  }

  /**
   * Gets all positions at a given radius from center
   */
  private getPositionsAtRadius(radius: number): HexCoordinate[] {
    const positions: HexCoordinate[] = [];
    
    if (radius === 0) {
      positions.push({q: 0, r: 0});
      return positions;
    }
    
    for (let q = -radius; q <= radius; q++) {
      for (let r = -radius; r <= radius; r++) {
        const s = -q - r;
        if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) === radius) {
          positions.push({q, r});
        }
      }
    }
    
    return positions;
  }

  /**
   * Resets the board for a new puzzle
   */
  private resetBoard(): void {
    this.board.clear();
    this.wordsActive = [];
    this.occupiedCells.clear();
  }

  /**
   * Gets the current board state
   */
  getBoard(): Map<string, HexCell> {
    return this.board;
  }

  /**
   * Gets the list of successfully placed words
   */
  getPlacedWords(): WordObject[] {
    return this.wordsActive;
  }
}