import { defineHex, Grid, rectangle } from 'honeycomb-grid';

console.log('HexaWord Crossword Generator v1');

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
  private words: string[] = ['SON', 'SANE', 'EONS', 'ONES', 'SONS', 'NOSES', 'OASES', 'SEASON'];
  private wordObjs: WordObj[] = [];
  private board: Map<string, HexCell> = new Map();
  private wordsActive: WordObj[] = [];
  private bounds = { minQ: 0, maxQ: 0, minR: 0, maxR: 0 };
  
  // 3 main hex directions: Q, R, S (and their opposites)
  private directions = [
    {q: 1, r: 0},   // Q+ (East)
    {q: -1, r: 1},  // R+ (Southwest) 
    {q: 0, r: -1},  // S+ (Northeast)
    {q: -1, r: 0},  // Q- (West)
    {q: 1, r: -1},  // R- (Northeast)
    {q: 0, r: 1}    // S- (Southwest)
  ];
  private directionOrder = [0, 1, 2]; // Q, R, S rotation
  private currentDirectionIndex = 0;

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
    
    // Try to generate crossword (up to 10 attempts)
    let success = false;
    for (let attempt = 0; attempt < 10 && !success; attempt++) {
      console.log(`Attempt ${attempt + 1}...`);
      this.resetBoard();
      success = this.placeAllWords();
    }
    
    if (success) {
      console.log('Crossword generated successfully!');
      this.render();
    } else {
      console.log('Failed to generate crossword after 10 attempts');
      // Render empty grid as fallback
      this.render();
    }
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
    this.bounds = { minQ: 0, maxQ: 0, minR: 0, maxR: 0 };
  }

  private placeAllWords(): boolean {
    const wordBank = [...this.wordObjs];
    
    // Place first word (word with fewest matches)
    wordBank.sort((a, b) => a.totalMatches - b.totalMatches);
    const firstWord = wordBank.shift()!;
    this.placeWordAt(firstWord, 0, 0, 0); // At origin, direction 0 (East)
    
    // Try to place remaining words
    while (wordBank.length > 0) {
      let bestWord = -1;
      let bestScore = -1;
      
      // Find best word to place next
      for (let i = 0; i < wordBank.length; i++) {
        const word = wordBank[i];
        const placements = this.findValidPlacements(word);
        if (placements.length > 0) {
          const score = word.totalMatches - placements.length;
          if (bestWord === -1 || score > bestScore) {
            bestWord = i;
            bestScore = score;
            word.successfulMatches = placements;
          }
        }
      }
      
      if (bestWord === -1) {
        console.log(`Cannot place remaining words. Placed ${this.wordsActive.length} out of ${this.words.length} words.`);
        return this.wordsActive.length > 1; // Return true if we placed at least 2 words
      }
      
      // Place the word
      const wordToPlace = wordBank.splice(bestWord, 1)[0];
      const placement = wordToPlace.successfulMatches[Math.floor(Math.random() * wordToPlace.successfulMatches.length)];
      this.placeWordAt(wordToPlace, placement.q, placement.r, placement.dir);
    }
    
    return true;
  }

  private findValidPlacements(word: WordObj, preferredDirection?: number): Array<{q: number, r: number, dir: number}> {
    const placements: Array<{q: number, r: number, dir: number}> = [];
    
    // For each active word on the board
    for (const activeWord of this.wordsActive) {
      // For each character in the active word
      for (let activeCharIndex = 0; activeCharIndex < activeWord.chars.length; activeCharIndex++) {
        const activeChar = activeWord.chars[activeCharIndex];
        const activeCharPos = this.getCharPosition(activeWord, activeCharIndex);
        
        // For each character in the word we're trying to place
        for (let wordCharIndex = 0; wordCharIndex < word.chars.length; wordCharIndex++) {
          const wordChar = word.chars[wordCharIndex];
          
          // If characters match, try placing word in all directions
          if (activeChar === wordChar) {
            for (let dir = 0; dir < 6; dir++) {
              // Skip if same direction as active word (would overlap completely)
              if (dir === activeWord.dir || dir === activeWord.dir! + 3 || dir === activeWord.dir! - 3) continue;
              
              const startPos = this.getWordStartPosition(activeCharPos, wordCharIndex, dir);
              
              const canPlace = this.canPlaceWordAt(word, startPos.q, startPos.r, dir);
              if (canPlace) {
                placements.push({ q: startPos.q, r: startPos.r, dir });
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
    
    // Check each character position - only validate intersections
    for (let i = 0; i < word.chars.length; i++) {
      const q = startQ + direction.q * i;
      const r = startR + direction.r * i;
      const key = `${q},${r}`;
      const existing = this.board.get(key);
      
      if (existing) {
        // Must match existing letter (intersection allowed)
        if (existing.letter !== word.chars[i]) {
          return false;
        }
      }
    }
    
    return true; // No spacing restrictions for now
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
    return this.directions.map(dir => ({
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
      }
      
      cell.wordIds.push(this.wordsActive.length);
      
      // Update bounds
      this.bounds.minQ = Math.min(this.bounds.minQ, q);
      this.bounds.maxQ = Math.max(this.bounds.maxQ, q);
      this.bounds.minR = Math.min(this.bounds.minR, r);
      this.bounds.maxR = Math.max(this.bounds.maxR, r);
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
    
    // Clear canvas
    this.ctx.fillStyle = '#f0f0f0';
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
    
    // Calculate hex size dynamically
    const gridWidth = this.bounds.maxQ - this.bounds.minQ + 1;
    const gridHeight = this.bounds.maxR - this.bounds.minR + 1;
    const padding = Math.min(rect.width, rect.height) * 0.1;
    
    const availableWidth = rect.width - (padding * 2);
    const availableHeight = rect.height - (padding * 2);
    
    const maxHexByWidth = availableWidth / (gridWidth * 0.75 * 2);
    const maxHexByHeight = availableHeight / (gridHeight * 0.866 * 2);
    
    const hexSize = Math.min(maxHexByWidth, maxHexByHeight) * 0.8;
    
    // Create hex
    const Hex = defineHex({
      dimensions: hexSize,
      orientation: 'pointy'
    });
    
    // Calculate grid bounds for centering
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    
    this.board.forEach(cell => {
      const hex = new Hex([cell.q, cell.r]);
      const corners = hex.corners;
      corners.forEach(corner => {
        minX = Math.min(minX, corner.x);
        maxX = Math.max(maxX, corner.x);
        minY = Math.min(minY, corner.y);
        maxY = Math.max(maxY, corner.y);
      });
    });
    
    // Center the grid in the container
    const centerX = rect.width / 2 - (minX + maxX) / 2;
    const centerY = rect.height / 2 - (minY + maxY) / 2;
    
    // Render each hex cell
    this.board.forEach(cell => {
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
      
      // Fill
      this.ctx.fillStyle = cell.letter ? '#4CAF50' : '#f0f0f0';
      this.ctx.fill();
      
      // Stroke
      this.ctx.strokeStyle = '#2E7D32';
      this.ctx.lineWidth = 2;
      this.ctx.stroke();
      
      // Add letter
      if (cell.letter) {
        this.ctx.fillStyle = 'white';
        this.ctx.font = `bold ${Math.floor(hexSize * 0.4)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(cell.letter, x, y);
      }
    });
    
    console.log('Rendered crossword with', this.board.size, 'cells');
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