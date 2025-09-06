import { defineHex, Grid, rectangle } from 'honeycomb-grid';

console.log('HexaWord Crossword Generator v3.1');

interface WordObj {
  word: string;
  chars: string[];
  totalMatches: number;
  effectiveMatches: number;
  successfulMatches: Array<{q: number, r: number, dir: number}>;
  placed?: boolean;
  q?: number;
  r?: number;
  dir?: number;
}

interface HexCell {
  q: number;
  r: number;
  letter: string | null;
  wordIds: number[];
}

class HexaWordCrossword {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private words: string[] = ['RUT', 'FUR', 'HUT', 'TURF', 'THRU', 'HURT', 'HURL', 'HURTFUL'];
  private wordObjs: WordObj[] = [];
  private board: Map<string, HexCell> = new Map();
  private wordsActive: WordObj[] = [];
  private bounds = { minQ: 0, maxQ: 0, minR: 0, maxR: 0 };
  
  // Fixed grid radius
  private readonly GRID_RADIUS = 10;
  
  // Hexagonal directions for readable words
  // In pointy-top hex: proper readable directions
  private directions = [
    {q: 1, r: 0},    // 0: Left to right (horizontal along Q axis)
    {q: 0, r: 1},    // 1: Up to down (vertical along R axis)
    {q: 1, r: -1},   // 2: NW to SE diagonal (Southeast direction)
  ];
  
  // Keep all 6 directions for neighbor checking
  private allDirections = [
    {q: 1, r: 0},   // East
    {q: -1, r: 1},  // Southwest 
    {q: 0, r: -1},  // Northeast
    {q: -1, r: 0},  // West
    {q: 1, r: -1},  // Southeast
    {q: 0, r: 1}    // South
  ];
  private directionOrder = [0, 1, 2]; // Q, R, S rotation
  private currentDirectionIndex = 0;
  
  // Track occupied cells and their adjacent cells for spacing
  private occupiedCells: Set<string> = new Set();
  private adjacentCells: Set<string> = new Set();
  private forbiddenCells: Set<string> = new Set(); // Cells that cannot be used for word placement

  constructor() {
    console.log('HexaWord Crossword starting...');
    
    // Get container
    const container = document.getElementById('hex-grid-container');
    if (!container) {
      console.error('Container not found!');
      return;
    }
    this.container = container;
    
    // Setup canvas
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);
    
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      console.error('No 2D context');
      return;
    }
    this.ctx = ctx;
    
    console.log('Canvas created, generating crossword...');
    this.generateCrossword();
    
    // Handle resize
    window.addEventListener('resize', () => this.render());
  }

  private generateCrossword(): void {
    console.log('Generating crossword with words:', this.words);
    
    // Initialize word objects
    this.prepareWords();
    
    // Clear board
    this.resetBoard();
    
    // Use the new systematic placement algorithm
    const success = this.placeAllWords();
    
    if (!success) {
      console.error('Failed to place all words');
    }
    
    console.log(`Final: Placed ${this.wordsActive.length} out of ${this.words.length} words`);
    this.render();
  }
  
  private findBestCenterWords(): {words: [WordObj, WordObj, WordObj], letter: string, indices: [number, number, number]} | null {
    const sortedWords = [...this.wordObjs].sort((a, b) => b.word.length - a.word.length);
    
    // Try to find 3 words with a shared middle letter
    let bestMatch: {words: [WordObj, WordObj, WordObj], letter: string, indices: [number, number, number], score: number} | null = null;
    
    // Check all combinations of 3 words
    for (let i = 0; i < sortedWords.length - 2; i++) {
      for (let j = i + 1; j < sortedWords.length - 1; j++) {
        for (let k = j + 1; k < sortedWords.length; k++) {
          const result = this.findSharedMiddleLetter(sortedWords[i], sortedWords[j], sortedWords[k]);
          if (result && result.idx3 !== -1) {
            // Calculate score based on word lengths and middle position
            const avgLength = (sortedWords[i].word.length + sortedWords[j].word.length + sortedWords[k].word.length) / 3;
            const midDistance = Math.abs(result.idx1 - sortedWords[i].word.length/2) + 
                               Math.abs(result.idx2 - sortedWords[j].word.length/2) + 
                               Math.abs(result.idx3 - sortedWords[k].word.length/2);
            const score = avgLength * 10 - midDistance;
            
            if (!bestMatch || score > bestMatch.score) {
              bestMatch = {
                words: [sortedWords[i], sortedWords[j], sortedWords[k]],
                letter: result.letter,
                indices: [result.idx1, result.idx2, result.idx3],
                score
              };
            }
          }
        }
      }
    }
    
    if (bestMatch) {
      return {
        words: bestMatch.words,
        letter: bestMatch.letter,
        indices: bestMatch.indices
      };
    }
    
    // Fallback: use first 3 longest words even if no perfect middle match
    if (sortedWords.length >= 3) {
      const word1 = sortedWords[0];
      const word2 = sortedWords[1]; 
      const word3 = sortedWords[2];
      
      // Try to find any shared letter (not just middle)
      for (const letter of word1.chars) {
        const idx1 = word1.chars.indexOf(letter);
        const idx2 = word2.chars.indexOf(letter);
        const idx3 = word3.chars.indexOf(letter);
        
        if (idx1 !== -1 && idx2 !== -1 && idx3 !== -1) {
          return {
            words: [word1, word2, word3],
            letter,
            indices: [idx1, idx2, idx3]
          };
        }
      }
    }
    
    return null;
  }
  
  private placeCenterWords(word1: WordObj, word2: WordObj, word3: WordObj, indices: [number, number, number]): void {
    // Place first word along Q axis (horizontal)
    const startQ1 = -indices[0];
    this.placeWordAt(word1, startQ1, 0, 0);
    console.log(`Placed "${word1.word}" horizontally with shared letter at origin`);
    
    // Place second word along R axis (vertical)
    const startR2 = -indices[1];
    this.placeWordAt(word2, 0, startR2, 1);
    console.log(`Placed "${word2.word}" vertically with shared letter at origin`);
    
    // Place third word along S axis (diagonal NW to SE)
    const startQ3 = -indices[2];
    const startR3 = indices[2];
    this.placeWordAt(word3, startQ3, startR3, 2);
    console.log(`Placed "${word3.word}" diagonally with shared letter at origin`);
  }
  
  private placeRemainingWords(remainingWords: WordObj[]): void {
    const unplacedWords: WordObj[] = [...remainingWords];
    let placedInThisRound = true;
    
    // Keep trying to place words until no more can be placed
    while (unplacedWords.length > 0 && placedInThisRound) {
      placedInThisRound = false;
      
      for (let i = unplacedWords.length - 1; i >= 0; i--) {
        const word = unplacedWords[i];
        let placed = false;
        
        // Try to connect to ANY letter of ALL placed words (not just first/last)
        for (const placedWord of this.wordsActive) {
          if (placed) break;
          
          // Check all positions for better connectivity
          for (let posIdx = 0; posIdx < placedWord.chars.length; posIdx++) {
            if (placed) break;
            const placedChar = placedWord.chars[posIdx];
            
            // Check if this word has this letter
            for (let j = 0; j < word.chars.length; j++) {
              if (word.chars[j] === placedChar) {
                const placedPos = this.getCharPosition(placedWord, posIdx);
                
                // Try the 2 directions that are NOT the same as the placed word
                for (let dir = 0; dir < this.directions.length; dir++) {
                  if (dir === placedWord.dir) {
                    // Skip the same direction as the existing word - no parallel placement
                    continue;
                  }
                  
                  const wordStart = this.getWordStartPosition(placedPos, j, dir);
                  
                  if (this.canPlaceSimple(word, wordStart.q, wordStart.r, dir)) {
                    const dirNames = ['horizontal(Q)', 'vertical(R)', 'diagonal(S)'];
                    this.placeWordAt(word, wordStart.q, wordStart.r, dir);
                    console.log(`Placed "${word.word}" ${dirNames[dir]} intersecting with "${placedWord.word}" ${dirNames[placedWord.dir]} at letter '${placedChar}'`);
                    placed = true;
                    placedInThisRound = true;
                    unplacedWords.splice(i, 1);
                    break;
                  }
                }
                if (placed) break;
              }
            }
          }
        }
      }
    }
    
    // If there are still unplaced words, place them at closest empty position to center
    for (const word of unplacedWords) {
      let placed = false;
      
      // Try placing at increasing distances from center
      for (let radius = 1; radius <= this.GRID_RADIUS && !placed; radius++) {
        // Collect all empty cells at this radius
        const cellsAtRadius: {q: number, r: number}[] = [];
        
        for (let q = -radius; q <= radius; q++) {
          for (let r = -radius; r <= radius; r++) {
            const s = -q - r;
            if (Math.abs(s) > radius) continue;
            
            // Check if this position is empty
            const key = `${q},${r}`;
            if (!this.board.has(key)) {
              cellsAtRadius.push({q, r});
            }
          }
        }
        
        // Try to place word at each empty cell at this radius
        for (const cell of cellsAtRadius) {
          if (placed) break;
          
          // Try each direction
          for (let dir = 0; dir < this.directions.length; dir++) {
            // Check if we can place the word here without collision
            let canPlace = true;
            for (let i = 0; i < word.chars.length; i++) {
              const cellPos = {
                q: cell.q + i * this.directions[dir].q,
                r: cell.r + i * this.directions[dir].r
              };
              
              // Check if this cell would be within grid bounds
              const s = -cellPos.q - cellPos.r;
              if (Math.abs(cellPos.q) > this.GRID_RADIUS || 
                  Math.abs(cellPos.r) > this.GRID_RADIUS || 
                  Math.abs(s) > this.GRID_RADIUS) {
                canPlace = false;
                break;
              }
              
              // Check if cell is occupied
              const cellKey = `${cellPos.q},${cellPos.r}`;
              if (this.board.has(cellKey)) {
                canPlace = false;
                break;
              }
              
              // Check that we have at least 1 space gap from other words
              let tooClose = false;
              for (const dirCheck of this.allDirections) {
                const neighborKey = `${cellPos.q + dirCheck.q},${cellPos.r + dirCheck.r}`;
                if (this.board.has(neighborKey)) {
                  // Check if this neighbor is part of our own word
                  let isOwnWord = false;
                  for (let j = 0; j < word.chars.length; j++) {
                    const ownPos = {
                      q: cell.q + j * this.directions[dir].q,
                      r: cell.r + j * this.directions[dir].r
                    };
                    if (`${ownPos.q},${ownPos.r}` === neighborKey) {
                      isOwnWord = true;
                      break;
                    }
                  }
                  
                  if (!isOwnWord) {
                    tooClose = true;
                    break;
                  }
                }
              }
              
              if (tooClose) {
                canPlace = false;
                break;
              }
            }
            
            if (canPlace) {
              const dirNames = ['horizontal(Q)', 'vertical(R)', 'diagonal(S)'];
              this.placeWordAt(word, cell.q, cell.r, dir);
              console.log(`Placed "${word.word}" ${dirNames[dir]} at position (${cell.q},${cell.r}) with spacing`);
              placed = true;
              break;
            }
          }
        }
      }
      
      if (!placed) {
        console.log(`Could not place "${word.word}" - no valid position found with proper spacing`);
      }
    }
  }
  
  private findSharedMiddleLetter(word1: WordObj, word2: WordObj, word3: WordObj): {letter: string, idx1: number, idx2: number, idx3: number} | null {
    // Find a letter that appears in the MIDDLE (not first or last) of all 3 words
    
    // Helper function to get middle indices, prioritizing actual middle
    const getMiddleIndices = (word: WordObj): number[] => {
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
    
    // Check each position in word1, starting from actual middle
    for (const i of indices1) {
      const letter = word1.chars[i];
      
      // Check if this letter exists in middle of word2, prioritizing middle
      let idx2 = -1;
      for (const j of indices2) {
        if (word2.chars[j] === letter) {
          idx2 = j;
          break;
        }
      }
      if (idx2 === -1) continue;
      
      // Check if this letter exists in middle of word3, prioritizing middle
      let idx3 = -1;
      for (const k of indices3) {
        if (word3.chars[k] === letter) {
          idx3 = k;
          break;
        }
      }
      if (idx3 === -1) continue;
      
      // Found a shared MIDDLE letter!
      console.log(`Middle letter '${letter}' found in all 3 words at positions: ${word1.word}[${i}], ${word2.word}[${idx2}], ${word3.word}[${idx3}]`);
      return { letter, idx1: i, idx2, idx3 };
    }
    
    // If no perfect middle letter match, relax constraints
    console.log('No shared middle letter in all 3 words, relaxing constraints...');
    
    // Try to find a letter shared by all 3, even if not all are middle positions
    for (let i = 0; i < word1.chars.length; i++) {
      const letter = word1.chars[i];
      const idx2 = word2.chars.indexOf(letter);
      const idx3 = word3.chars.indexOf(letter);
      
      if (idx2 !== -1 && idx3 !== -1) {
        // Prefer positions closer to middle
        const score1 = Math.abs(i - word1.chars.length / 2);
        const score2 = Math.abs(idx2 - word2.chars.length / 2);
        const score3 = Math.abs(idx3 - word3.chars.length / 2);
        const totalScore = score1 + score2 + score3;
        
        // Accept if at least one is in middle and total score is reasonable
        const isMiddle1 = i > 0 && i < word1.chars.length - 1;
        const isMiddle2 = idx2 > 0 && idx2 < word2.chars.length - 1;
        const isMiddle3 = idx3 > 0 && idx3 < word3.chars.length - 1;
        
        if ((isMiddle1 || isMiddle2 || isMiddle3) && totalScore < 4) {
          return { letter, idx1: i, idx2, idx3 };
        }
      }
    }
    
    return null;
  }
  
  private canPlaceSimple(word: WordObj, startQ: number, startR: number, dir: number): boolean {
    const direction = this.directions[dir];
    let hasValidIntersection = false;
    
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      const s = -q - r;
      
      // Check grid bounds
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > this.GRID_RADIUS) {
        return false;
      }
      
      const key = `${q},${r}`;
      const existing = this.board.get(key);
      
      if (existing) {
        // Must match letter at intersection
        if (existing.letter !== word.chars[i]) {
          return false;
        }
        hasValidIntersection = true;
      }
    }
    
    // Must have at least one intersection
    if (!hasValidIntersection && this.wordsActive.length > 0) {
      return false;
    }
    
    // Check for unwanted adjacencies
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      const key = `${q},${r}`;
      
      // Skip if this is an intersection
      if (this.board.has(key)) continue;
      
      // Check all 6 neighbors
      for (const neighbor of this.allDirections) {
        const nq = q + neighbor.q;
        const nr = r + neighbor.r;
        const nkey = `${nq},${nr}`;
        
        // Skip if neighbor is part of same word
        let isPartOfWord = false;
        for (let j = 0; j < word.chars.length; j++) {
          const wq = startQ + direction.q * j;
          const wr = startR + direction.r * j;
          if (wq === nq && wr === nr) {
            isPartOfWord = true;
            break;
          }
        }
        
        if (!isPartOfWord && this.board.has(nkey)) {
          return false; // Adjacent to another word
        }
      }
    }
    
    return true;
  }
  
  private scoreSimplePlacement(word: WordObj, startQ: number, startR: number, dir: number): number {
    let score = 0;
    const direction = this.directions[dir];
    
    // Count and score intersections
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      const key = `${q},${r}`;
      
      if (this.board.has(key)) {
        // Prefer middle intersections
        const distFromMiddle = Math.abs(i - word.chars.length / 2);
        score += 20 - distFromMiddle * 2;
      }
    }
    
    // Prefer placements closer to center
    const centerDist = Math.abs(startQ) + Math.abs(startR);
    score -= centerDist;
    
    return score;
  }

  private prepareWords(): void {
    this.wordObjs = this.words.map(word => ({
      word: word,
      chars: word.split(''),
      totalMatches: 0,
      effectiveMatches: 0,
      successfulMatches: []
    }));

    // Calculate total matches for each word
    for (let i = 0; i < this.wordObjs.length; i++) {
      const wordA = this.wordObjs[i];
      for (let j = 0; j < wordA.chars.length; j++) {
        const charA = wordA.chars[j];
        for (let k = 0; k < this.wordObjs.length; k++) {
          if (k === i) continue;
          const wordB = this.wordObjs[k];
          for (let l = 0; l < wordB.chars.length; l++) {
            if (charA === wordB.chars[l]) {
              wordA.totalMatches++;
            }
          }
        }
      }
    }
    
    console.log('Word match scores:', this.wordObjs.map(w => ({ word: w.word, matches: w.totalMatches })));
  }

  private resetBoard(): void {
    this.board.clear();
    this.wordsActive = [];
    this.bounds = { minQ: -this.GRID_RADIUS, maxQ: this.GRID_RADIUS, minR: -this.GRID_RADIUS, maxR: this.GRID_RADIUS };
    this.occupiedCells.clear();
    this.adjacentCells.clear();
    this.forbiddenCells.clear();
  }

  private placeAllWords(): boolean {
    const wordBank = [...this.wordObjs];
    
    // Sort by length for better placement (longer words first)
    wordBank.sort((a, b) => b.word.length - a.word.length);
    
    // Step 1: Place first 3 words crossing at center with shared middle letter
    const layer1 = this.placeFirstThreeWords(wordBank);
    if (!layer1.success) {
      console.log('Failed to place first 3 words');
      return false;
    }
    
    // Step 2: Place remaining words using connection points
    this.placeRemainingWordsSystematically(wordBank);
    
    console.log(`Placed ${this.wordsActive.length} out of ${this.words.length} words.`);
    return this.wordsActive.length === this.words.length;
  }
  
  private placeFirstThreeWords(wordBank: WordObj[]): {success: boolean} {
    // Find 3 longest words that share a middle letter
    const sharedLetterInfo = this.findSharedMiddleLetter(wordBank[0], wordBank[1], wordBank[2]);
    if (!sharedLetterInfo) {
      console.log('No shared middle letter found in first 3 words');
      return {success: false};
    }
    
    const {letter, idx1, idx2, idx3} = sharedLetterInfo;
    console.log(`Placing first 3 words with shared middle letter '${letter}'`);
    
    // Place word 1 on Q axis (horizontal) - shared letter at center (0,0)
    this.placeWordAt(wordBank[0], -idx1, 0, 0);
    
    // Place word 2 on R axis (vertical) - shared letter at center (0,0)
    this.placeWordAt(wordBank[1], 0, -idx2, 1);
    
    // Place word 3 on S axis (diagonal) - shared letter at center (0,0)
    // For diagonal: to pass through (0,0), we need to start at (-idx3, idx3)
    this.placeWordAt(wordBank[2], -idx3, idx3, 2);
    
    // Remove placed words from wordBank
    wordBank.splice(0, 3);
    
    return {success: true};
  }
  
  private placeRemainingWordsSystematically(wordBank: WordObj[]): void {
    const waitlist: WordObj[] = [];
    
    // Step 4: Get initial 6 connection points from endpoints of first 3 words
    let connectionPoints = this.getConnectionPoints();
    console.log(`Initial 6 connection points from first 3 words:`, connectionPoints);
    
    // Step 5-6: Check each remaining word against connection points systematically
    while (wordBank.length > 0 || waitlist.length > 0) {
      let placedAny = false;
      
      // Check wordBank words against current connection points
      if (wordBank.length > 0) {
        console.log(`\nChecking ${wordBank.length} words against ${connectionPoints.length} connection points`);
        
        // For each connection point
        for (const point of connectionPoints) {
          // Skip if this point already has words in both available directions
          if (this.isConnectionPointFull(point)) {
            console.log(`Connection point (${point.q},${point.r}) is full`);
            continue;
          }
          
          // Try each word in wordBank
          for (let i = wordBank.length - 1; i >= 0; i--) {
            const word = wordBank[i];
            const placement = this.tryPlaceWordAtPoint(word, point);
            
            if (placement) {
              this.placeWordAt(word, placement.q, placement.r, placement.dir);
              console.log(`Placed "${word.word}" at connection point (${point.q},${point.r})`);
              wordBank.splice(i, 1);
              placedAny = true;
              
              // Step 8: Add new connection points from newly placed word
              const newPoints = this.getWordEndpoints(word);
              connectionPoints.push(...newPoints);
              break; // Move to next connection point
            }
          }
        }
        
        // Move remaining wordBank words to waitlist
        while (wordBank.length > 0) {
          const word = wordBank.pop()!;
          waitlist.push(word);
          console.log(`Moving "${word.word}" to waitlist`);
        }
      }
      
      // Step 9: Try waitlist words with all connection points (including new ones)
      if (waitlist.length > 0 && connectionPoints.length > 0) {
        console.log(`Checking ${waitlist.length} waitlist words against ${connectionPoints.length} connection points`);
        
        for (const point of connectionPoints) {
          if (this.isConnectionPointFull(point)) continue;
          
          for (let i = waitlist.length - 1; i >= 0; i--) {
            const word = waitlist[i];
            const placement = this.tryPlaceWordAtPoint(word, point);
            
            if (placement) {
              this.placeWordAt(word, placement.q, placement.r, placement.dir);
              console.log(`Placed "${word.word}" from waitlist at connection point (${point.q},${point.r})`);
              waitlist.splice(i, 1);
              placedAny = true;
              
              // Add new connection points
              const newPoints = this.getWordEndpoints(word);
              connectionPoints.push(...newPoints);
              break;
            }
          }
        }
      }
      
      // Step 10: If no placements found and waitlist has words, place separately
      if (!placedAny && waitlist.length > 0) {
        console.log(`\nPlacing remaining ${waitlist.length} words separately`);
        while (waitlist.length > 0) {
          const word = waitlist.shift()!;
          const placement = this.findClosestEmptyPlacement(word);
          
          if (placement) {
            this.placeWordAt(word, placement.q, placement.r, placement.dir);
            console.log(`Placed "${word.word}" separately at (${placement.q},${placement.r})`);
          } else {
            console.log(`Could not place "${word.word}" anywhere`);
          }
        }
        break;
      }
      
      // Exit if nothing left
      if (wordBank.length === 0 && waitlist.length === 0) break;
      if (!placedAny) break;
    }
  }
  
  private isConnectionPointFull(point: {q: number, r: number, parentDir: number}): boolean {
    // Check if both available directions at this point already have words
    let filledDirections = 0;
    
    for (let dir = 0; dir < 3; dir++) {
      if (dir === point.parentDir) continue; // Skip parent direction
      
      // Check if there's already a word in this direction from this point
      if (this.hasWordInDirection(point.q, point.r, dir)) {
        filledDirections++;
      }
    }
    
    return filledDirections >= 2; // Both available directions are filled
  }
  
  private hasWordInDirection(q: number, r: number, dir: number): boolean {
    const direction = this.directions[dir];
    // Check the next cell in this direction
    const nextQ = q + direction.q;
    const nextR = r + direction.r;
    const nextKey = `${nextQ},${nextR}`;
    
    // If there's a cell in this direction and it's not just an intersection, there's a word
    if (this.board.has(nextKey)) {
      // Check if this is part of a word going in this direction
      for (const word of this.wordsActive) {
        if (word.dir === dir) {
          // Check if this word passes through or starts from this point
          for (let i = 0; i < word.chars.length; i++) {
            const wq = word.q! + this.directions[word.dir!].q * i;
            const wr = word.r! + this.directions[word.dir!].r * i;
            if (wq === q && wr === r) {
              return true; // This word goes through this point in this direction
            }
          }
        }
      }
    }
    
    return false;
  }
  
  private tryPlaceWordAtPoint(word: WordObj, point: {q: number, r: number, parentDir: number}): {q: number, r: number, dir: number} | null {
    const existingCell = this.board.get(`${point.q},${point.r}`);
    if (!existingCell) return null;
    
    // Check each letter of the word
    for (let i = 0; i < word.chars.length; i++) {
      if (word.chars[i] === existingCell.letter) {
        // Try each direction except parent direction
        for (let dir = 0; dir < 3; dir++) {
          if (dir === point.parentDir) continue;
          
          // Calculate start position
          const startPos = this.getWordStartPosition({q: point.q, r: point.r}, i, dir);
          
          // Check if placement is valid
          if (this.canPlaceWordSimple(word, startPos.q, startPos.r, dir)) {
            return {q: startPos.q, r: startPos.r, dir: dir};
          }
        }
      }
    }
    
    return null;
  }
  
  private getConnectionPoints(): Array<{q: number, r: number, parentDir: number}> {
    const points: Array<{q: number, r: number, parentDir: number}> = [];
    
    // Get endpoints of first 3 placed words
    for (let i = 0; i < Math.min(3, this.wordsActive.length); i++) {
      const word = this.wordsActive[i];
      const endpoints = this.getWordEndpoints(word);
      points.push(...endpoints);
    }
    
    return points;
  }
  
  private getWordEndpoints(word: WordObj): Array<{q: number, r: number, parentDir: number}> {
    const points: Array<{q: number, r: number, parentDir: number}> = [];
    const dir = this.directions[word.dir!];
    
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
  
  private findPlacementAtConnectionPoints(word: WordObj, connectionPoints: Array<{q: number, r: number, parentDir: number}>): {q: number, r: number, dir: number} | null {
    for (const point of connectionPoints) {
      // Check if any letter of the word matches the letter at this connection point
      const existingCell = this.board.get(`${point.q},${point.r}`);
      if (!existingCell) {
        console.log(`No cell at connection point (${point.q},${point.r})`);
        continue;
      }
      
      for (let i = 0; i < word.chars.length; i++) {
        if (word.chars[i] === existingCell.letter) {
          console.log(`"${word.word}"[${i}]='${word.chars[i]}' matches connection point (${point.q},${point.r}) with letter '${existingCell.letter}'`);
          
          // Try placing in different directions (not same as parent)
          for (let dir = 0; dir < this.directions.length; dir++) {
            if (dir === point.parentDir) continue; // Skip parent direction
            
            const startPos = this.getWordStartPosition({q: point.q, r: point.r}, i, dir);
            
            const canPlace = this.canPlaceWordAt(word, startPos.q, startPos.r, dir);
            if (!canPlace) {
              console.log(`Cannot place "${word.word}" at (${startPos.q},${startPos.r}) dir=${dir}`);
            } else {
              console.log(`Can place "${word.word}" at (${startPos.q},${startPos.r}) dir=${dir}`);
              return {q: startPos.q, r: startPos.r, dir: dir};
            }
          }
        }
      }
    }
    
    return null;
  }
  
  private findClosestEmptyPlacement(word: WordObj): {q: number, r: number, dir: number} | null {
    // Search in expanding rings from center for empty space
    for (let radius = 1; radius <= this.GRID_RADIUS - word.chars.length; radius++) {
      const positions = this.getPositionsAtRadius(radius);
      
      for (const pos of positions) {
        // Try each direction
        for (let dir = 0; dir < 3; dir++) {
          const direction = this.directions[dir];
          let canPlace = true;
          
          // Check if all cells for the word are empty or within bounds
          for (let i = 0; i < word.chars.length; i++) {
            const q = pos.q + direction.q * i;
            const r = pos.r + direction.r * i;
            const s = -q - r;
            
            // Check bounds
            if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > this.GRID_RADIUS) {
              canPlace = false;
              break;
            }
            
            // Check if cell is occupied
            const key = `${q},${r}`;
            if (this.board.has(key)) {
              canPlace = false;
              break;
            }
            
            // Check for adjacent cells (maintain spacing)
            let hasAdjacentWord = false;
            for (const neighbor of this.allDirections) {
              const nq = q + neighbor.q;
              const nr = r + neighbor.r;
              const nkey = `${nq},${nr}`;
              
              // Skip if neighbor would be part of same word
              let isPartOfSameWord = false;
              for (let j = 0; j < word.chars.length; j++) {
                const wq = pos.q + direction.q * j;
                const wr = pos.r + direction.r * j;
                if (wq === nq && wr === nr) {
                  isPartOfSameWord = true;
                  break;
                }
              }
              
              if (!isPartOfSameWord && this.board.has(nkey)) {
                hasAdjacentWord = true;
                break;
              }
            }
            
            if (hasAdjacentWord) {
              canPlace = false;
              break;
            }
          }
          
          if (canPlace) {
            return {q: pos.q, r: pos.r, dir: dir};
          }
        }
      }
    }
    
    return null;
  }
  
  private getPositionsAtRadius(radius: number): Array<{q: number, r: number}> {
    const positions: Array<{q: number, r: number}> = [];
    
    if (radius === 0) {
      positions.push({q: 0, r: 0});
      return positions;
    }
    
    // Generate all positions at given radius
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
  
  private hasNeighbors(q: number, r: number): boolean {
    for (const dir of this.allDirections) {
      const key = `${q + dir.q},${r + dir.r}`;
      if (this.board.has(key)) {
        return true;
      }
    }
    return false;
  }
  
  private placeSecondLayer(wordBank: WordObj[]): {success: boolean} {
    console.log('Layer 2: Attempting to place next 3 words');
    let placedCount = 0;
    const targetCount = Math.min(3, wordBank.length);
    
    // Try to place up to 3 words that intersect with layer 1
    for (let attempt = 0; attempt < targetCount && wordBank.length > 0; attempt++) {
      let bestWord: WordObj | null = null;
      let bestPlacement: {q: number, r: number, dir: number} | null = null;
      let bestWordIndex = -1;
      let bestScore = -Infinity;
      
      // Find best word and placement
      for (let i = 0; i < wordBank.length; i++) {
        const word = wordBank[i];
        const placements = this.findValidPlacements(word);
        
        for (const placement of placements) {
          // Prefer placements that spread out from center
          const distance = Math.abs(placement.q) + Math.abs(placement.r);
          const intersections = this.countIntersections(word, placement);
          const score = intersections * 10 - distance * 0.5;
          
          if (score > bestScore) {
            bestWord = word;
            bestPlacement = placement;
            bestWordIndex = i;
            bestScore = score;
          }
        }
      }
      
      if (bestWord && bestPlacement && bestWordIndex >= 0) {
        this.placeWordAt(bestWord, bestPlacement.q, bestPlacement.r, bestPlacement.dir);
        wordBank.splice(bestWordIndex, 1);
        placedCount++;
        console.log(`Layer 2: Placed "${bestWord.word}"`);
      } else {
        break;
      }
    }
    
    return {success: placedCount === targetCount};
  }
  
  private placeThirdLayer(wordBank: WordObj[]): {success: boolean} {
    console.log(`Layer 3: Attempting to place remaining ${wordBank.length} words`);
    let placedCount = 0;
    
    while (wordBank.length > 0) {
      let bestWord: WordObj | null = null;
      let bestPlacement: {q: number, r: number, dir: number} | null = null;
      let bestWordIndex = -1;
      let bestScore = -Infinity;
      
      // Find best placement for remaining words
      for (let i = 0; i < wordBank.length; i++) {
        const word = wordBank[i];
        const placements = this.findValidPlacements(word);
        
        for (const placement of placements) {
          const score = this.scorePlacement(word, placement);
          if (score > bestScore) {
            bestWord = word;
            bestPlacement = placement;
            bestWordIndex = i;
            bestScore = score;
          }
        }
      }
      
      if (bestWord && bestPlacement && bestWordIndex >= 0) {
        this.placeWordAt(bestWord, bestPlacement.q, bestPlacement.r, bestPlacement.dir);
        wordBank.splice(bestWordIndex, 1);
        placedCount++;
        console.log(`Layer 3: Placed "${bestWord.word}"`);
      } else {
        // Try forced placement for remaining words
        if (wordBank.length > 0) {
          console.log(`Layer 3: ${wordBank.length} words remaining, trying forced placement`);
          for (const word of [...wordBank]) {
            const forced = this.findForcedPlacement(word);
            if (forced) {
              this.placeWordAt(word, forced.q, forced.r, forced.dir);
              const idx = wordBank.indexOf(word);
              if (idx > -1) wordBank.splice(idx, 1);
              placedCount++;
              console.log(`Layer 3: Force placed "${word.word}"`);
            }
          }
        }
        break;
      }
    }
    
    return {success: wordBank.length === 0};
  }
  
  private findThreeWordsWithSharedLetter(words: WordObj[]): {words: WordObj[], letter: string} | null {
    // Find the best 3 words that share a common letter
    const letterGroups: Map<string, WordObj[]> = new Map();
    
    for (const word of words) {
      const uniqueLetters = new Set(word.chars);
      for (const letter of uniqueLetters) {
        if (!letterGroups.has(letter)) {
          letterGroups.set(letter, []);
        }
        letterGroups.get(letter)!.push(word);
      }
    }
    
    // Find letter that appears in at least 3 words
    for (const [letter, wordList] of letterGroups) {
      if (wordList.length >= 3) {
        // Take the 3 longest words with this letter
        const sorted = wordList.sort((a, b) => b.word.length - a.word.length);
        return {
          words: sorted.slice(0, 3),
          letter: letter
        };
      }
    }
    
    // Fallback: just use first 3 words if no common letter
    if (words.length >= 3) {
      const firstWord = words[0];
      const letter = firstWord.chars[Math.floor(firstWord.chars.length / 2)];
      return {
        words: words.slice(0, 3),
        letter: letter
      };
    }
    
    return null;
  }
  
  private countIntersections(word: WordObj, placement: {q: number, r: number, dir: number}): number {
    let count = 0;
    const direction = this.directions[placement.dir];
    
    for (let i = 0; i < word.chars.length; i++) {
      const q = placement.q + direction.q * i;
      const r = placement.r + direction.r * i;
      const key = `${q},${r}`;
      
      if (this.board.has(key)) {
        const cell = this.board.get(key);
        if (cell && cell.letter === word.chars[i]) {
          count++;
        }
      }
    }
    
    return count;
  }
  
  
  private findForcedPlacement(word: WordObj): {q: number, r: number, dir: number} | null {
    // Try to find ANY valid placement with slightly relaxed rules
    for (const activeWord of this.wordsActive) {
      for (let i = 0; i < activeWord.chars.length; i++) {
        for (let j = 0; j < word.chars.length; j++) {
          if (activeWord.chars[i] === word.chars[j]) {
            const activePos = this.getCharPosition(activeWord, i);
            
            // Try all directions
            for (let dir = 0; dir < this.directions.length; dir++) {
              if (dir === activeWord.dir) continue;
              
              const startPos = this.getWordStartPosition(activePos, j, dir);
              if (this.wordFitsInGrid(word, startPos.q, startPos.r, dir)) {
                // Use the standard validation but allow force placement if it's the only option
                if (this.canPlaceWordAt(word, startPos.q, startPos.r, dir)) {
                  return { q: startPos.q, r: startPos.r, dir: dir };
                }
              }
            }
          }
        }
      }
    }
    
    // If no valid placement found with strict rules, try with minimal validation
    // This is a last resort to ensure we can place words
    for (const activeWord of this.wordsActive) {
      for (let i = 0; i < activeWord.chars.length; i++) {
        for (let j = 0; j < word.chars.length; j++) {
          if (activeWord.chars[i] === word.chars[j]) {
            const activePos = this.getCharPosition(activeWord, i);
            
            for (let dir = 0; dir < this.directions.length; dir++) {
              if (dir === activeWord.dir) continue;
              
              const startPos = this.getWordStartPosition(activePos, j, dir);
              if (this.wordFitsInGrid(word, startPos.q, startPos.r, dir)) {
                // Minimal check: only verify letter matches at intersections
                let valid = true;
                const direction = this.directions[dir];
                
                for (let k = 0; k < word.chars.length; k++) {
                  const q = startPos.q + direction.q * k;
                  const r = startPos.r + direction.r * k;
                  const key = `${q},${r}`;
                  const existing = this.board.get(key);
                  
                  if (existing && existing.letter && existing.letter !== word.chars[k]) {
                    valid = false;
                    break;
                  }
                }
                
                if (valid) {
                  console.log(`Warning: Force placing "${word.word}" with relaxed rules`);
                  return { q: startPos.q, r: startPos.r, dir: dir };
                }
              }
            }
          }
        }
      }
    }
    
    return null;
  }
  
  
  private wordFitsInGrid(word: WordObj, startQ: number, startR: number, dir: number): boolean {
    const direction = this.directions[dir];
    
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      const s = -q - r;
      
      const distance = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
      if (distance > this.GRID_RADIUS) {
        return false;
      }
    }
    
    return true;
  }
  
  private placeRemainingWordsWithBacktracking(wordBank: WordObj[]): boolean {
    if (wordBank.length === 0) {
      return true; // All words placed
    }
    
    // Try to place each remaining word
    for (let i = 0; i < wordBank.length; i++) {
      const word = wordBank[i];
      const placements = this.findValidPlacements(word);
      
      // Sort placements by score
      placements.sort((a, b) => this.scorePlacement(word, b) - this.scorePlacement(word, a));
      
      for (const placement of placements) {
        // Try placing the word
        const savedBoard = new Map(this.board);
        const savedActive = [...this.wordsActive];
        const savedForbidden = new Set(this.forbiddenCells);
        
        this.placeWordAt(word, placement.q, placement.r, placement.dir);
        
        // Remove from wordBank and recurse
        const remainingWords = [...wordBank.slice(0, i), ...wordBank.slice(i + 1)];
        
        if (this.placeRemainingWordsWithBacktracking(remainingWords)) {
          return true; // Success!
        }
        
        // Backtrack
        this.board = savedBoard;
        this.wordsActive = savedActive;
        this.forbiddenCells = savedForbidden;
      }
    }
    
    return false; // Couldn't place any word
  }
  
  
  private scorePlacement(word: WordObj, placement: {q: number, r: number, dir: number}): number {
    let score = 0;
    const direction = this.directions[placement.dir];
    
    // Count and score intersections
    for (let i = 0; i < word.chars.length; i++) {
      const q = placement.q + direction.q * i;
      const r = placement.r + direction.r * i;
      const key = `${q},${r}`;
      
      if (this.board.has(key)) {
        // Higher score for middle intersections
        const distanceFromWordCenter = Math.abs(i - Math.floor(word.chars.length / 2));
        const intersectionScore = 20 - (distanceFromWordCenter * 5);
        score += Math.max(intersectionScore, 5);
      }
    }
    
    // Prefer placements closer to center
    const distance = Math.abs(placement.q) + Math.abs(placement.r);
    score -= distance * 0.5;
    
    return score;
  }

  private findValidPlacements(word: WordObj, preferredDirection?: number): Array<{q: number, r: number, dir: number}> {
    const placements: Array<{q: number, r: number, dir: number}> = [];
    
    // For each active word on the board
    for (const activeWord of this.wordsActive) {
      // Check all characters for potential intersections
      for (let activeCharIndex = 0; activeCharIndex < activeWord.chars.length; activeCharIndex++) {
        const activeChar = activeWord.chars[activeCharIndex];
        const activeCharPos = this.getCharPosition(activeWord, activeCharIndex);
        
        // Check all characters in the word we're trying to place
        for (let wordCharIndex = 0; wordCharIndex < word.chars.length; wordCharIndex++) {
          const wordChar = word.chars[wordCharIndex];
          
          // If characters match, try placing word in readable directions only
          if (activeChar === wordChar) {
            for (let dir = 0; dir < this.directions.length; dir++) {
              // Skip if same direction as active word (would overlap)
              if (dir === activeWord.dir) continue;
              
              const startPos = this.getWordStartPosition(activeCharPos, wordCharIndex, dir);
              
              // Check if this placement is valid
              const canPlace = this.canPlaceWordAt(word, startPos.q, startPos.r, dir);
              if (canPlace) {
                // Avoid duplicate placements
                const exists = placements.some(p => 
                  p.q === startPos.q && p.r === startPos.r && p.dir === dir
                );
                if (!exists) {
                  placements.push({ q: startPos.q, r: startPos.r, dir });
                }
              }
            }
          }
        }
      }
    }
    
    return placements;
  }

  private getCharPosition(word: WordObj, charIndex: number): {q: number, r: number} {
    const dir = this.directions[word.dir!];
    return {
      q: word.q! + dir.q * charIndex,
      r: word.r! + dir.r * charIndex
    };
  }

  private getWordStartPosition(intersectionPos: {q: number, r: number}, charIndex: number, dir: number): {q: number, r: number} {
    const direction = this.directions[dir];
    return {
      q: intersectionPos.q - direction.q * charIndex,
      r: intersectionPos.r - direction.r * charIndex
    };
  }

  private canPlaceWordSimple(word: WordObj, startQ: number, startR: number, dir: number): boolean {
    const direction = this.directions[dir];
    const intersectionPoints: Array<{q: number, r: number}> = [];
    
    // First pass: Check bounds and find intersections
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      const s = -q - r;
      
      // Check grid bounds
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) > this.GRID_RADIUS) {
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
    
    // Must have intersection (except for separate placement)
    if (this.wordsActive.length > 0 && intersectionPoints.length === 0) {
      return false;
    }
    
    // CRITICAL: Check that EXCEPT for intersection points, no cell has neighbors
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      
      // Skip if this is an intersection point
      const isIntersection = intersectionPoints.some(p => p.q === q && p.r === r);
      if (isIntersection) continue;
      
      // Check all 6 neighbors
      for (const neighbor of this.allDirections) {
        const nq = q + neighbor.q;
        const nr = r + neighbor.r;
        
        // Skip if neighbor would be part of the same word
        let isPartOfSameWord = false;
        for (let j = 0; j < word.chars.length; j++) {
          const wq = startQ + direction.q * j;
          const wr = startR + direction.r * j;
          if (wq === nq && wr === nr) {
            isPartOfSameWord = true;
            break;
          }
        }
        
        if (isPartOfSameWord) continue;
        
        // If neighbor exists, placement is invalid
        const nkey = `${nq},${nr}`;
        if (this.board.has(nkey)) {
          // This non-intersection cell has a neighbor - NOT ALLOWED
          return false;
        }
      }
    }
    
    return true;
  }
  
  private canPlaceWordAt(word: WordObj, startQ: number, startR: number, dir: number): boolean {
    const direction = this.directions[dir];
    const intersectionPoints: Array<{q: number, r: number, index: number}> = [];
    
    // Check if word fits within grid radius
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      const s = -q - r;
      
      // Check if within hexagonal radius (using cube coordinate distance)
      const distance = Math.max(Math.abs(q), Math.abs(r), Math.abs(s));
      if (distance > this.GRID_RADIUS) {
        console.log(`  FAIL: "${word.word}" outside grid at position ${i}`);
        return false; // Word goes outside grid boundary
      }
    }
    
    // First pass: check if letters match at intersections
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      const key = `${q},${r}`;
      const existing = this.board.get(key);
      
      if (existing) {
        // Must match existing letter (intersection)
        if (existing.letter !== word.chars[i]) {
          return false;
        }
        intersectionPoints.push({q, r, index: i});
      }
    }
    
    // Must have at least one intersection (except for initial words)
    if (this.wordsActive.length >= 1) {
      if (intersectionPoints.length === 0) {
        console.log(`  FAIL: "${word.word}" has no intersections`);
        return false; // Must connect to existing words
      }
    }
    
    // Skip parallel spacing check - it's too restrictive
    // We already check for proper intersections and adjacency
    
    // Second pass: check strict spacing rules for non-intersection cells
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      const key = `${q},${r}`;
      
      // Skip if this is an intersection point
      const isIntersection = intersectionPoints.some(p => p.q === q && p.r === r);
      if (isIntersection) continue;
      
      // Non-intersection cells should NOT have any adjacent cells from other words
      for (let d = 0; d < this.allDirections.length; d++) {
        const neighbor = this.allDirections[d];
        const nq = q + neighbor.q;
        const nr = r + neighbor.r;
        const nkey = `${nq},${nr}`;
        
        // Check if this neighbor is part of the same word (allowed)
        let isPartOfSameWord = false;
        for (let j = 0; j < word.chars.length; j++) {
          const wq = startQ + direction.q * j;
          const wr = startR + direction.r * j;
          if (wq === nq && wr === nr) {
            isPartOfSameWord = true;
            break;
          }
        }
        
        // If neighbor exists and is not part of same word, check if it's an intersection
        if (!isPartOfSameWord && this.board.has(nkey)) {
          const neighborCell = this.board.get(nkey);
          if (neighborCell && neighborCell.letter) {
            // Check if the neighbor is an intersection point of the current placement
            const isNeighborIntersection = intersectionPoints.some(p => p.q === nq && p.r === nr);
            if (!isNeighborIntersection) {
              // Allow adjacency but track it for debugging
              // We'll rely on proper intersection validation instead
              // console.log(`  Note: "${word.word}" adjacent to another word at (${nq},${nr})`);
            }
          }
        }
      }
    }
    
    return true;
  }
  
  private checkParallelWordSpacing(word: WordObj, startQ: number, startR: number, dir: number): boolean {
    const direction = this.directions[dir];
    
    // Check if any existing word runs parallel and adjacent
    for (const existingWord of this.wordsActive) {
      // Skip if directions are different (can't be parallel)
      if (existingWord.dir !== dir) continue;
      
      // Check each position of the new word
      for (let i = 0; i < word.chars.length; i++) {
        const q = startQ + direction.q * i;
        const r = startR + direction.r * i;
        
        // Check each position of the existing word
        const existingDir = this.directions[existingWord.dir!];
        for (let j = 0; j < existingWord.chars.length; j++) {
          const eq = existingWord.q! + existingDir.q * j;
          const er = existingWord.r! + existingDir.r * j;
          
          // Calculate distance
          const dq = Math.abs(q - eq);
          const dr = Math.abs(r - er);
          const ds = Math.abs((-q - r) - (-eq - er));
          
          // If they're exactly 1 hex apart and parallel, reject
          if ((dq === 1 && dr === 0 && ds === 1) ||
              (dq === 0 && dr === 1 && ds === 1) ||
              (dq === 1 && dr === 1 && ds === 0)) {
            // Check if this is an intersection point (allowed)
            const isIntersection = (q === eq && r === er && 
                                   word.chars[i] === existingWord.chars[j]);
            if (!isIntersection) {
              return false; // Parallel and adjacent - not allowed
            }
          }
        }
      }
    }
    
    return true;
  }
  
  private checkCellSpacing(q: number, r: number, excludeDir: number): boolean {
    // Get all 6 neighboring positions
    for (let d = 0; d < this.allDirections.length; d++) {
      const neighbor = this.allDirections[d];
      const nq = q + neighbor.q;
      const nr = r + neighbor.r;
      const nkey = `${nq},${nr}`;
      
      // Check if neighbor has a letter (from another word)
      if (this.board.has(nkey)) {
        // Allow if it's in the same direction (part of same word)
        if (d === excludeDir || d === (excludeDir + 3) % 6) continue;
        
        // Violation: adjacent to another word
        return false;
      }
    }
    
    return true;
  }

  private checkWordSpacing(word: WordObj, startQ: number, startR: number, dir: number): boolean {
    const direction = this.directions[dir];
    
    // Check positions one step away from each character in perpendicular directions
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      
      // Get perpendicular directions for spacing check
      const perpDirections = this.getPerpendicularDirections(dir);
      
      for (const perpDir of perpDirections) {
        const checkQ = q + perpDir.q;
        const checkR = r + perpDir.r;
        const checkKey = `${checkQ},${checkR}`;
        const checkCell = this.board.get(checkKey);
        
        if (checkCell && checkCell.letter) {
          // Found a letter in perpendicular direction - check if it's an intersection
          let isValidIntersection = false;
          
          // Allow if this position is meant to be an intersection
          if (checkQ === q && checkR === r) {
            isValidIntersection = true;
          }
          
          if (!isValidIntersection) {
            return false; // Too close to another word
          }
        }
      }
    }
    
    return true;
  }

  private getPerpendicularDirections(dir: number): Array<{q: number, r: number}> {
    // For each direction, return the two perpendicular directions
    const perpMap: { [key: number]: Array<{q: number, r: number}> } = {
      0: [{q: 0, r: -1}, {q: 0, r: 1}],   // Q axis: perp is R axis
      1: [{q: 1, r: 0}, {q: -1, r: 0}],   // R axis: perp is Q axis  
      2: [{q: 1, r: -1}, {q: -1, r: 1}],  // S axis: perp is Q-R axis
      3: [{q: 0, r: -1}, {q: 0, r: 1}],   // -Q axis: perp is R axis
      4: [{q: 1, r: 0}, {q: -1, r: 0}],   // -R axis: perp is Q axis
      5: [{q: 1, r: -1}, {q: -1, r: 1}]   // -S axis: perp is Q-R axis
    };
    
    return perpMap[dir] || [];
  }

  private isValidIntersection(q1: number, r1: number, q2: number, r2: number): boolean {
    // Check if these positions are part of valid word intersections
    // For now, simplified - just allow intersections
    return true;
  }

  private getNeighbors(q: number, r: number): Array<{q: number, r: number}> {
    return this.allDirections.map(dir => ({
      q: q + dir.q,
      r: r + dir.r
    }));
  }

  private placeWordAt(word: WordObj, startQ: number, startR: number, dir: number): void {
    word.q = startQ;
    word.r = startR;
    word.dir = dir;
    word.placed = true;
    
    const direction = this.directions[dir];
    
    // Place each character
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      const key = `${q},${r}`;
      
      let cell = this.board.get(key);
      if (!cell) {
        cell = { q, r, letter: word.chars[i], wordIds: [] };
        this.board.set(key, cell);
        this.occupiedCells.add(key);
      } else {
        // Cell already exists - verify it has the same letter
        if (cell.letter !== word.chars[i]) {
          console.error(`Letter mismatch at (${q},${r}): existing '${cell.letter}' vs new '${word.chars[i]}' from word '${word.word}'`);
        }
      }
      
      cell.wordIds.push(this.wordsActive.length);
    }
    
    this.wordsActive.push(word);
    console.log(`Placed word "${word.word}" at (${startQ}, ${startR}) direction ${dir}`);
  }

  private render(): void {
    console.log('Rendering crossword...');
    
    // Get container size
    const rect = this.container.getBoundingClientRect();
    
    // Set canvas size with device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    
    // Clear canvas with background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, rect.width, rect.height);
    
    if (this.board.size === 0) {
      // No crossword generated yet
      this.ctx.fillStyle = '#666';
      this.ctx.font = '20px Arial';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('Generating crossword...', rect.width / 2, rect.height / 2);
      return;
    }
    
    // Calculate actual bounds of placed words (not grid bounds)
    let actualMinQ = Infinity, actualMaxQ = -Infinity;
    let actualMinR = Infinity, actualMaxR = -Infinity;
    
    this.board.forEach(cell => {
      if (cell.letter) {
        actualMinQ = Math.min(actualMinQ, cell.q);
        actualMaxQ = Math.max(actualMaxQ, cell.q);
        actualMinR = Math.min(actualMinR, cell.r);
        actualMaxR = Math.max(actualMaxR, cell.r);
      }
    });
    
    // Calculate dynamic hex size based on actual word placement
    const wordGridWidth = actualMaxQ - actualMinQ + 1;
    const wordGridHeight = actualMaxR - actualMinR + 1;
    
    // Add padding percentage
    const paddingPercent = 0.15; // 15% padding around the content
    const padding = Math.min(rect.width, rect.height) * paddingPercent;
    
    const availableWidth = rect.width - (padding * 2);
    const availableHeight = rect.height - (padding * 2);
    
    // Calculate hex size to fit the actual word placement
    // Hexagon width = 2 * size, height = sqrt(3) * size
    // For pointy orientation: width between centers = 1.5 * size, height = sqrt(3) * size
    const maxHexByWidth = availableWidth / (wordGridWidth * 1.5);
    const maxHexByHeight = availableHeight / (wordGridHeight * 1.732);
    
    // Dynamic sizing - can grow or shrink based on content
    const hexSize = Math.min(maxHexByWidth, maxHexByHeight, 50); // Cap at 50px max for readability
    
    // Create hex with dynamic size
    const Hex = defineHex({
      dimensions: hexSize,
      orientation: 'pointy'
    });
    
    // Calculate actual pixel bounds for centering
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    this.board.forEach(cell => {
      if (cell.letter) {
        const hex = new Hex([cell.q, cell.r]);
        const corners = hex.corners;
        corners.forEach(corner => {
          minX = Math.min(minX, corner.x);
          maxX = Math.max(maxX, corner.x);
          minY = Math.min(minY, corner.y);
          maxY = Math.max(maxY, corner.y);
        });
      }
    });
    
    // Center the actual word content in the container
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    const centerX = rect.width / 2 - (minX + maxX) / 2;
    const centerY = rect.height / 2 - (minY + maxY) / 2;
    
    // Only render cells with letters (no grid boundary)
    this.board.forEach(cell => {
      if (!cell.letter) return; // Skip empty cells
      
      const hex = new Hex([cell.q, cell.r]);
      const x = hex.x + centerX;
      const y = hex.y + centerY;
      
      // Draw hex
      this.ctx.beginPath();
      const corners = hex.corners;
      this.ctx.moveTo(corners[0].x + centerX, corners[0].y + centerY);
      for (let i = 1; i < corners.length; i++) {
        this.ctx.lineTo(corners[i].x + centerX, corners[i].y + centerY);
      }
      this.ctx.closePath();
      
      // Fill - use different colors for intersection cells
      if (cell.wordIds.length > 1) {
        // Intersection cell - use special color
        this.ctx.fillStyle = '#FF9800'; // Orange for intersections
      } else {
        // Regular cell - use color based on word ID
        const colors = ['#4CAF50', '#2196F3', '#9C27B0', '#F44336', '#00BCD4', '#FFC107', '#795548', '#607D8B'];
        this.ctx.fillStyle = colors[cell.wordIds[0] % colors.length];
      }
      this.ctx.fill();
      
      // Stroke
      this.ctx.strokeStyle = '#2c3e50';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      // Add letter
      this.ctx.fillStyle = 'white';
      this.ctx.font = `bold ${Math.floor(hexSize * 0.5)}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(cell.letter, x, y);
    });
    
    // Debug info
    console.log(`Rendered ${this.board.size} cells with hex size: ${hexSize.toFixed(1)}px`);
    console.log(`Content bounds: ${wordGridWidth}x${wordGridHeight} hexes`);
  }
}

// Initialize when ready
console.log('Setting up initialization...');
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, creating hexaword crossword');
    new HexaWordCrossword();
  });
} else {
  console.log('DOM ready, creating hexaword crossword immediately');
  new HexaWordCrossword();
}