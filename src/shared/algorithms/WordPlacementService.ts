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
      if (process.env.NODE_ENV === 'development') {
        console.log('Failed to place first 3 words');
      }
      return false;
    }
    
    // Step 2: Place remaining words systematically
    this.placeRemainingWords(wordBank);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`Placed ${this.wordsActive.length} out of ${words.length} words.`);
      if (this.wordsActive.length < words.length) {
        console.log('Failed to place:', words.filter(w => !this.wordsActive.includes(w)).map(w => w.word));
      }
    }
    return this.wordsActive.length === words.length;
  }

  /**
   * Places the first three words by selecting any three that share a common letter.
   * Prefer indices near the middle for nicer layouts.
   */
  private placeFirstThreeWords(wordBank: WordObject[]): boolean {
    if (wordBank.length < 3) return false;

    const triplet = this.findSharedLetterTriplet(wordBank);
    if (!triplet) {
      if (process.env.NODE_ENV === 'development') {
        console.log('No shared letter triplet found among candidate words');
      }
      // Fallback 1: try to place any best pair that shares a letter
      const pair = this.findSharedLetterPair(wordBank);
      if (pair) {
        const { aIndex, bIndex, idx1, idx2, letter } = pair;
        const w1 = wordBank[aIndex];
        const w2 = wordBank[bIndex];
        if (process.env.NODE_ENV === 'development') {
          console.log(`Placing pair sharing '${letter}' at indices`, { idx1, idx2 });
        }
        // Place word 1 horizontally crossing origin
        this.placeWordAt(w1, -idx1, 0, 0);
        // Place word 2 vertically crossing origin
        this.placeWordAt(w2, 0, -idx2, 1);
        // Remove from bank (remove higher index first)
        const toRemove = [aIndex, bIndex].sort((x, y) => y - x);
        for (const i of toRemove) wordBank.splice(i, 1);
        return true;
      }
      // Fallback 2: place a single anchor word at center (longest near top)
      const anchorIndex = 0;
      const anchor = wordBank[anchorIndex];
      const midIdx = Math.floor(anchor.chars.length / 2);
      this.placeWordAt(anchor, -midIdx, 0, 0);
      wordBank.splice(anchorIndex, 1);
      if (process.env.NODE_ENV === 'development') {
        console.log(`Placed single anchor word '${anchor.word}' at center`);
      }
      return true;
    }

    const { aIndex, bIndex, cIndex, idx1, idx2, idx3, letter } = triplet;
    const w1 = wordBank[aIndex];
    const w2 = wordBank[bIndex];
    const w3 = wordBank[cIndex];

    if (process.env.NODE_ENV === 'development') {
      console.log(`Placing first 3 words sharing '${letter}' at indices`, { idx1, idx2, idx3 });
    }

    // Place word 1 on Q axis (horizontal)
    this.placeWordAt(w1, -idx1, 0, 0);
    // Place word 2 on R axis (vertical)
    this.placeWordAt(w2, 0, -idx2, 1);
    // Place word 3 on S axis (diagonal)
    this.placeWordAt(w3, -idx3, idx3, 2);

    // Remove these three words from the bank (remove highest index first)
    const toRemove = [aIndex, bIndex, cIndex].sort((x, y) => y - x);
    for (const i of toRemove) {
      wordBank.splice(i, 1);
    }
    return true;
  }

  /**
   * Finds three words in the bank that share at least one common letter.
   * Returns their indices in the bank and the letter positions for alignment.
   */
  private findSharedLetterTriplet(wordBank: WordObject[]): {
    aIndex: number; bIndex: number; cIndex: number;
    letter: string; idx1: number; idx2: number; idx3: number;
  } | null {
    const limit = Math.min(wordBank.length, 10); // search top 10 to limit cost

    const sortedIndicesByCenter = (w: WordObject): number[] => {
      const len = w.chars.length;
      if (len === 0) return [];
      const mid = (len - 1) / 2;
      return Array.from({ length: len }, (_, i) => i).sort((i, j) => Math.abs(i - mid) - Math.abs(j - mid));
    };

    for (let i = 0; i < limit; i++) {
      const w1 = wordBank[i];
      const idxs1 = sortedIndicesByCenter(w1);
      for (let j = i + 1; j < limit; j++) {
        const w2 = wordBank[j];
        const idxs2 = sortedIndicesByCenter(w2);
        // Precompute letter positions for w2
        const map2 = new Map<string, number[]>();
        for (const jIdx of idxs2) {
          const ch = w2.chars[jIdx];
          if (!map2.has(ch)) map2.set(ch, []);
          map2.get(ch)!.push(jIdx);
        }
        for (let k = j + 1; k < limit; k++) {
          const w3 = wordBank[k];
          const idxs3 = sortedIndicesByCenter(w3);
          const map3 = new Map<string, number[]>();
          for (const kIdx of idxs3) {
            const ch = w3.chars[kIdx];
            if (!map3.has(ch)) map3.set(ch, []);
            map3.get(ch)!.push(kIdx);
          }

          // Try letters in w1 in center-first order
          for (const iIdx of idxs1) {
            const ch = w1.chars[iIdx];
            const cands2 = map2.get(ch);
            const cands3 = map3.get(ch);
            if (!cands2 || !cands3) continue;
            // pick first indices (center-preferred ordering already applied)
            return {
              aIndex: i,
              bIndex: j,
              cIndex: k,
              letter: ch,
              idx1: iIdx,
              idx2: cands2[0],
              idx3: cands3[0]
            };
          }
        }
      }
    }
    return null;
  }

  /**
   * Finds two words that share at least one common letter, preferring center indices.
   */
  private findSharedLetterPair(wordBank: WordObject[]): {
    aIndex: number; bIndex: number; letter: string; idx1: number; idx2: number;
  } | null {
    const limit = Math.min(wordBank.length, 12);
    const centerOrder = (w: WordObject): number[] => {
      const len = w.chars.length;
      if (len === 0) return [];
      const mid = (len - 1) / 2;
      return Array.from({ length: len }, (_, i) => i).sort((i, j) => Math.abs(i - mid) - Math.abs(j - mid));
    };
    for (let i = 0; i < limit; i++) {
      const w1 = wordBank[i];
      const idxs1 = centerOrder(w1);
      for (let j = i + 1; j < limit; j++) {
        const w2 = wordBank[j];
        const idxs2 = centerOrder(w2);
        const map2 = new Map<string, number[]>();
        for (const jIdx of idxs2) {
          const ch = w2.chars[jIdx];
          if (!map2.has(ch)) map2.set(ch, []);
          map2.get(ch)!.push(jIdx);
        }
        for (const iIdx of idxs1) {
          const ch = w1.chars[iIdx];
          const cands2 = map2.get(ch);
          if (cands2 && cands2.length > 0) {
            return { aIndex: i, bIndex: j, letter: ch, idx1: iIdx, idx2: cands2[0] };
          }
        }
      }
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
      
      // If no placements found, place one word separately to spawn new connection points
      if (!placedAny && waitlist.length > 0) {
        const word = waitlist.shift()!;
        const placement = this.findClosestEmptyPlacement(word);
        if (placement) {
          this.placeWordAt(word, placement.q, placement.r, placement.dir);
          // Seed new connection points from this standalone word
          const newPoints = this.getWordEndpoints(word);
          connectionPoints.push(...newPoints);
          placedAny = true;
          // Continue loop to try crossing other waitlisted words with this new anchor
          continue;
        }
        // If we couldn't place even in empty space, stop to prevent infinite loop
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
    
    // Initialize cells array if not already present
    word.cells = [];
    
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
      
      // Add cell to word's cells array
      word.cells.push({ q, r, letter: word.chars[i], wordIds: cell.wordIds });
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
    // Use endpoints of all placed words so later words can cross any cluster
    for (let i = 0; i < this.wordsActive.length; i++) {
      const word = this.wordsActive[i];
      points.push(...this.getWordEndpoints(word));
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
    // First try close placements
    for (let radius = 1; radius <= Math.min(5, this.gridRadius - word.chars.length); radius++) {
      const positions = this.getPositionsAtRadius(radius);
      // Optional RNG-driven rotation for deterministic variety
      const startIndex = this.rng ? this.rng.nextInt(0, Math.max(positions.length - 1, 0)) : 0;
      for (let step = 0; step < positions.length; step++) {
        const pos = positions[(startIndex + step) % positions.length];
        for (let dir = 0; dir < 3; dir++) {
          if (this.canPlaceWordEmpty(word, pos.q, pos.r, dir)) {
            return {q: pos.q, r: pos.r, dir};
          }
        }
      }
    }
    
    // If nothing found close by, try anywhere on the grid with more relaxed constraints
    for (let radius = 6; radius <= this.gridRadius; radius++) {
      const positions = this.getPositionsAtRadius(radius);
      const startIndex = this.rng ? this.rng.nextInt(0, Math.max(positions.length - 1, 0)) : 0;
      for (let step = 0; step < positions.length; step++) {
        const pos = positions[(startIndex + step) % positions.length];
        for (let dir = 0; dir < 3; dir++) {
          // Allow placement even if it goes slightly outside grid boundary
          if (this.canPlaceWordRelaxed(word, pos.q, pos.r, dir)) {
            return {q: pos.q, r: pos.r, dir};
          }
        }
      }
    }
    
    return null;
  }

  /**
   * Checks if a word can be placed with relaxed constraints
   */
  private canPlaceWordRelaxed(
    word: WordObject, 
    startQ: number, 
    startR: number, 
    dir: number
  ): boolean {
    const direction = HEX_DIRECTIONS[dir];
    
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      
      // Allow slightly outside grid for better placement
      if (Math.abs(q) > this.gridRadius + 2 || Math.abs(r) > this.gridRadius + 2) {
        return false;
      }
      
      const key = `${q},${r}`;
      if (this.board.has(key)) {
        return false; // Cell already occupied
      }
    }
    
    return true;
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
