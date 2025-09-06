import { defineHex, Grid, rectangle } from 'honeycomb-grid';

console.log('HexaWord Crossword Generator v3');

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
  private words: string[] = ['LOG', 'EGO', 'GEL', 'OLD', 'LEG', 'GOD', 'DOG', 'LODE', 'GOLD', 'LODGE'];
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
    
    // Step 1: Sort words by length (longest first)
    const sortedWords = [...this.wordObjs].sort((a, b) => b.word.length - a.word.length);
    console.log('Sorted words by length:', sortedWords.map(w => `${w.word}(${w.word.length})`).join(', '));
    
    // Step 2: Place the longest word horizontally at center (left to right)
    const firstWord = sortedWords[0];  // LODGE
    const word2 = sortedWords[1];       // LODE
    const word3 = sortedWords[2];       // GOLD
    
    console.log(`First 3 longest words: ${firstWord.word}, ${word2.word}, ${word3.word}`);
    
    // Find shared letter among middle positions of these 3 words
    const sharedLetter = this.findSharedMiddleLetter(firstWord, word2, word3);
    if (!sharedLetter) {
      console.log('No shared middle letter found, using fallback');
      // Fallback: just place first word
      const startQ = -Math.floor(firstWord.chars.length / 2);
      this.placeWordAt(firstWord, startQ, 0, 0);
      this.render();
      return;
    }
    
    console.log(`Found shared middle letter '${sharedLetter.letter}' at positions: ${firstWord.word}[${sharedLetter.idx1}], ${word2.word}[${sharedLetter.idx2}], ${word3.word}[${sharedLetter.idx3}]`);
    
    // Place first word along Q axis (horizontal, left to right) with shared letter at origin (0,0)
    const startQ1 = -sharedLetter.idx1;  // Position so shared letter is at origin
    const startR1 = 0;
    this.placeWordAt(firstWord, startQ1, startR1, 0); // Direction 0: Q axis
    console.log(`Placed "${firstWord.word}" on Q axis (horizontal) with '${sharedLetter.letter}' at origin`);
    
    // Place second word along R axis (vertical, up to down) with shared letter at origin
    const startQ2 = 0;
    const startR2 = -sharedLetter.idx2;  // Position so shared letter is at origin
    this.placeWordAt(word2, startQ2, startR2, 1); // Direction 1: R axis
    console.log(`Placed "${word2.word}" on R axis (vertical) with '${sharedLetter.letter}' at origin`);
    
    // Place third word diagonally (NW to SE) with shared letter at origin
    // For diagonal direction (1, -1), to have letter at index i at origin:
    // We need to start at (-i, i) so it reaches (0, 0) at position i
    const startQ3 = -sharedLetter.idx3;
    const startR3 = sharedLetter.idx3;
    this.placeWordAt(word3, startQ3, startR3, 2); // Direction 2: NW to SE diagonal
    console.log(`Placed "${word3.word}" diagonally (NW to SE) with '${sharedLetter.letter}' at origin`);
    
    console.log('Step complete: Placed first 3 words crossing at shared letter');
    this.render();
  }
  
  private findSharedMiddleLetter(word1: WordObj, word2: WordObj, word3: WordObj): {letter: string, idx1: number, idx2: number, idx3: number} | null {
    // Find a letter that appears in the MIDDLE (not first or last) of all 3 words
    
    // Check each possible middle position in word1
    for (let i = 1; i < word1.chars.length - 1; i++) {  // Skip first and last
      const letter = word1.chars[i];
      
      // Check if this letter exists in middle of word2
      let idx2 = -1;
      for (let j = 1; j < word2.chars.length - 1; j++) {  // Skip first and last
        if (word2.chars[j] === letter) {
          idx2 = j;
          break;
        }
      }
      if (idx2 === -1) continue;
      
      // Check if this letter exists in middle of word3
      let idx3 = -1;
      for (let k = 1; k < word3.chars.length - 1; k++) {  // Skip first and last
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
    
    // If no middle letter shared by all 3, try to find one shared by 2
    // For LODGE(5), LODE(4), GOLD(4):
    // LODGE: L-O-D-G-E (middle: O, D, G)
    // LODE: L-O-D-E (middle: O, D)
    // GOLD: G-O-L-D (middle: O, L)
    // Common middle letter: O or D
    
    console.log('No shared middle letter in all 3 words, looking for best match...');
    
    // Try 'O' which is in middle of LODGE[1], LODE[1], GOLD[1]
    if (word1.word === 'LODGE' && word2.word === 'LODE' && word3.word === 'GOLD') {
      return { letter: 'O', idx1: 1, idx2: 1, idx3: 1 };
    }
    
    // Try 'D' which is in middle of LODGE[2], LODE[2]
    if (word1.chars[2] === 'D' && word2.chars[2] === 'D') {
      // For GOLD, find D position
      const idx3 = word3.chars.indexOf('D');
      if (idx3 !== -1) {
        return { letter: 'D', idx1: 2, idx2: 2, idx3 };
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
    
    // Layer 1: Place first 3 words crossing at center
    const layer1 = this.placeFirstLayer(wordBank);
    if (!layer1.success) {
      console.log('Failed to place first layer');
      return false;
    }
    
    // Layer 2: Place next 3 words intersecting with layer 1
    const layer2 = this.placeSecondLayer(wordBank);
    if (!layer2.success) {
      console.log('Failed to place second layer completely');
    }
    
    // Layer 3: Place remaining words
    const layer3 = this.placeThirdLayer(wordBank);
    if (!layer3.success) {
      console.log('Failed to place third layer completely');
    }
    
    console.log(`Placed ${this.wordsActive.length} out of ${this.words.length} words.`);
    return this.wordsActive.length === this.words.length;
  }
  
  private placeFirstLayer(wordBank: WordObj[]): {success: boolean} {
    // Find 3 words that share a common letter
    const centerConfig = this.findThreeWordsWithSharedLetter(wordBank);
    if (!centerConfig) {
      return {success: false};
    }
    
    const {words, letter} = centerConfig;
    console.log(`Layer 1: Placing ${words[0].word}, ${words[1].word}, ${words[2].word} with shared letter '${letter}'`);
    
    // Place first word horizontally through center
    const word1 = words[0];
    const idx1 = word1.chars.indexOf(letter);
    this.placeWordAt(word1, -idx1, 0, 0); // Horizontal (East)
    
    // Place second word diagonally up-right through the shared letter
    const word2 = words[1];
    const idx2 = word2.chars.indexOf(letter);
    this.placeWordAt(word2, 0, idx2, 1); // Northeast
    
    // Place third word diagonally up-left through the shared letter
    const word3 = words[2];
    const idx3 = word3.chars.indexOf(letter);
    this.placeWordAt(word3, idx3, idx3, 2); // Northwest
    
    // Remove from wordBank
    for (const word of words) {
      const index = wordBank.indexOf(word);
      if (index > -1) wordBank.splice(index, 1);
    }
    
    return {success: true};
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
        return false; // Must connect to existing words
      }
    }
    
    // Check for parallel adjacent words (very strict)
    if (!this.checkParallelWordSpacing(word, startQ, startR, dir)) {
      return false;
    }
    
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
              // This is an adjacent cell from another word - not allowed!
              return false;
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