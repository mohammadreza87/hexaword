import { CrosswordGenerator } from './services/CrosswordGenerator';
import { HexRenderer } from './engine/HexRenderer';
import { InputHexGrid } from './components/InputHexGrid';
import { HexCell, WordObject } from '../shared/types/hexaword';
import { createRNG } from '../shared/utils/rng';
import { AnimationService } from './services/AnimationService';
import { ColorPaletteService } from './services/ColorPaletteService';
import { getPaletteForLevel } from './config/ColorPalettes';
import { BoosterService, BoosterType } from '../shared/game/application/services/BoosterService';

export interface GameConfig {
  containerId: string;
  words?: string[];
  clue?: string;
  seed?: string;
  gridRadius?: number;
  level?: number;
  theme?: 'dark' | 'light';
  onReady?: () => void;
  onError?: (error: Error) => void;
  onLevelComplete?: (level: number) => void;
}

export class HexaWordGame {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private generator: CrosswordGenerator;
  private renderer: HexRenderer;
  private inputGrid: InputHexGrid;
  private animationService: AnimationService;
  private colorPaletteService: ColorPaletteService;
  private boosterService: BoosterService;
  private currentLevel: number = 1;
  
  private board: Map<string, HexCell> = new Map();
  private placedWords: WordObject[] = [];
  private isInitialized: boolean = false;
  private typedWord: string = '';  // Track typed word
  private solvedCells: Set<string> = new Set();  // Track solved cells
  private foundWords: Set<string> = new Set();  // Track found words
  private levelCompleted: boolean = false;  // Ensure completion fires once per level
  private currentClue: string = '';  // Current level clue
  private introActive: boolean = false; // Hide gameplay clue while intro anim runs
  
  // Default word list - Uncommon Occupations theme
  private defaultWords = [
    'GOLFER', 'ATHLETE', 'CAPTAIN', 'PAINTER', 'DESIGNER',
    'DIRECTOR', 'MAGICIAN', 'MUSICIAN', 'BALLERINA', 'PLAYWRIGHT'
  ];
  private defaultClue = 'UNCOMMON OCCUPATIONS';
  
  constructor(private config: GameConfig) {
    this.initialize();
  }
  
  /**
   * Initializes the game
   */
  private async initialize(): Promise<void> {
    try {
      // Get container
      const container = document.getElementById(this.config.containerId);
      if (!container) {
        throw new Error(`Container with id '${this.config.containerId}' not found`);
      }
      this.container = container;
      
      // Setup canvas
      this.setupCanvas();
      
      // Initialize components with seed
      this.generator = new CrosswordGenerator({
        gridRadius: this.config.gridRadius || 10,
        words: this.config.words || this.defaultWords,
        seed: this.config.seed || `game_${Date.now()}`
      });
      
      this.renderer = new HexRenderer(this.ctx);
      this.inputGrid = new InputHexGrid(this.ctx);
      this.animationService = AnimationService.getInstance();
      this.colorPaletteService = ColorPaletteService.getInstance();
      this.boosterService = new BoosterService();
      
      // Initialize color palette with level and theme
      this.currentLevel = this.config.level || 1;
      await this.initializeColorPalette();
      
      // Set the clue
      this.currentClue = this.config.clue || this.defaultClue;
      
      // Set up render callback for animations
      (window as any).__requestRender = () => this.render();
      
      // Generate initial crossword
      await this.generateCrossword();
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Mark as initialized
      this.isInitialized = true;
      this.levelCompleted = false;
      
      // Initial render
      this.render();
      // Play level intro
      await this.playLevelIntro();
      this.config.onReady?.();
    } catch (error) {
      console.error('Failed to initialize game:', error);
      if (this.config.onError) {
        this.config.onError(error as Error);
      }
    }
  }
  
  /**
   * Initializes color palette
   */
  private async initializeColorPalette(): Promise<void> {
    // Set theme if provided
    if (this.config.theme) {
      await this.colorPaletteService.setThemeMode(this.config.theme);
    }
    
    // Set level
    await this.colorPaletteService.setLevel(this.currentLevel);
    
    // Update renderer and input grid with new colors
    await this.renderer.setLevel(this.currentLevel);
    await this.inputGrid.setLevel(this.currentLevel);
    
    // Update canvas background
    const colors = await this.colorPaletteService.getCurrentScheme();
    this.canvas.style.setProperty('background-color', colors.background, 'important');
    document.body.style.backgroundColor = colors.background;
  }
  
  /**
   * Changes the game level
   */
  async setLevel(level: number): Promise<void> {
    this.currentLevel = level;
    await this.initializeColorPalette();
    
    // Generate new puzzle for new level
    await this.generateCrossword();
    this.levelCompleted = false;
    this.render();
    await this.playLevelIntro();
  }
  
  /**
   * Toggles between dark and light theme
   */
  async toggleTheme(): Promise<void> {
    await this.colorPaletteService.toggleTheme();
    await this.renderer.toggleTheme();
    await this.inputGrid.toggleTheme();
    
    // Update canvas background
    const colors = await this.colorPaletteService.getCurrentScheme();
    this.canvas.style.setProperty('background-color', colors.background, 'important');
    document.body.style.backgroundColor = colors.background;
    
    this.render();
  }
  
  /**
   * Sets up the canvas
   */
  private setupCanvas(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.container.appendChild(this.canvas);
    
    const ctx = this.canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }
    this.ctx = ctx;
  }
  
  /**
   * Sets up event handlers
   */
  private setupEventHandlers(): void {
    // Handle resize
    window.addEventListener('resize', () => this.handleResize());
    
    // Handle canvas clicks (for future interaction)
    this.canvas.addEventListener('click', (e) => this.handleClick(e));
    
    // Handle touch events for mobile
    this.canvas.addEventListener('touchstart', (e) => this.handleTouch(e));
    
    // Handle keyboard input (only on desktop/laptop)
    if (!this.isMobileDevice()) {
      this.setupKeyboardHandling();
    }
  }
  
  /**
   * Check if device is mobile
   */
  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           ('ontouchstart' in window) ||
           (navigator.maxTouchPoints > 0);
  }
  
  /**
   * Setup keyboard handling for desktop
   */
  private setupKeyboardHandling(): void {
    document.addEventListener('keydown', (e) => {
      // Prevent keyboard shortcuts from interfering
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      
      const key = e.key.toUpperCase();
      
      // Handle letter keys A-Z
      if (key.length === 1 && key >= 'A' && key <= 'Z') {
        e.preventDefault();
        this.handleKeyboardLetter(key);
      }
      // Handle backspace/delete
      else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        this.handleKeyboardBackspace();
      }
      // Handle Enter to submit word
      else if (e.key === 'Enter') {
        e.preventDefault();
        this.handleKeyboardEnter();
      }
      // Handle Escape to clear
      else if (e.key === 'Escape') {
        e.preventDefault();
        this.handleKeyboardClear();
      }
    });
  }
  
  /**
   * Handle keyboard letter input
   */
  private handleKeyboardLetter(letter: string): void {
    // Find the hex cell with this letter in the input grid
    const letterCell = this.inputGrid.findCellByLetter(letter);
    
    if (letterCell && !this.inputGrid.isLetterUsed(letterCell.q, letterCell.r)) {
      // Simulate clicking on that hex
      this.inputGrid.handleHexClick(letterCell.q, letterCell.r);
      
      // Update the game's typed word to match
      this.typedWord = this.inputGrid.getTypedWord();
      
      // Trigger animations
      this.animationService.animateInputHexClick(letterCell.q, letterCell.r, true);
      this.animationService.animateTypedWord(this.typedWord);
      
      // Check if word matches any placed word
      this.checkWord();
      
      console.log('Typed word:', this.typedWord);
      
      // Re-render
      this.render();
    }
  }
  
  /**
   * Handle keyboard backspace
   */
  private handleKeyboardBackspace(): void {
    if (this.typedWord.length > 0) {
      // Get the last position before removing
      const positions = this.inputGrid.getSelectedPositions();
      const lastPosition = positions[positions.length - 1];
      
      if (lastPosition) {
        // Mark letter as not used
        this.inputGrid.markLetterUnused(lastPosition.q, lastPosition.r);
      }
      
      // Update typed word
      this.typedWord = this.typedWord.slice(0, -1);
      this.inputGrid.setTypedWord(this.typedWord);
      
      // Update selected positions
      positions.pop();
      this.inputGrid.setSelectedPositions(positions);
      
      console.log('Typed word after backspace:', this.typedWord);
      
      // Re-render
      this.render();
    }
  }
  
  /**
   * Handle keyboard enter (submit word)
   */
  private handleKeyboardEnter(): void {
    if (this.typedWord.length >= 3) {
      // Check if word is valid
      const foundWord = this.placedWords.find(w => w.word === this.typedWord);
      
      if (foundWord && !this.foundWords.has(foundWord.word)) {
        // Word is correct!
        this.handleCorrectWord(foundWord);
      } else if (this.foundWords.has(this.typedWord)) {
        // Already found
        this.animationService.animateError();
      } else {
        // Wrong word
        this.animationService.animateError();
      }
    }
  }
  
  /**
   * Handle keyboard clear (Escape)
   */
  private handleKeyboardClear(): void {
    // Clear everything
    this.typedWord = '';
    this.inputGrid.clearTypedWord();
    
    // Trigger clear animation
    this.animationService.animateClearButton();
    
    console.log('Cleared typed word');
    
    this.render();
  }
  
  /**
   * Generates a new crossword
   */
  async generateCrossword(words?: string[]): Promise<void> {
    console.log('Generating crossword...');
    
    const wordList = words || this.config.words || this.defaultWords;
    
    // Validate words
    const validation = CrosswordGenerator.validateWords(wordList);
    if (!validation.valid) {
      throw new Error(`Invalid word list: ${validation.errors.join(', ')}`);
    }
    
    // Generate puzzle
    const result = await this.generator.generate(wordList);
    
    this.board = result.board;
    this.placedWords = result.placedWords;
    
    if (!result.success) {
      console.warn('Not all words could be placed');
    }
    
    console.log(`Generated crossword with ${this.placedWords.length}/${wordList.length} words`);
    
    // Populate input grid with letters from the puzzle
    this.populateInputGrid();
  }
  
  /**
   * Populates the input grid with letters from the crossword
   */
  private populateInputGrid(): void {
    // Count the maximum frequency of each letter across all placed words
    const letterFrequency = new Map<string, number>();
    
    // For each placed word, count letter occurrences
    this.placedWords.forEach(wordObj => {
      const word = wordObj.word;
      const wordLetterCount = new Map<string, number>();
      
      // Count letters in this word
      for (const letter of word) {
        const upperLetter = letter.toUpperCase();
        wordLetterCount.set(upperLetter, (wordLetterCount.get(upperLetter) || 0) + 1);
      }
      
      // Update global max frequency for each letter
      wordLetterCount.forEach((count, letter) => {
        letterFrequency.set(letter, Math.max(letterFrequency.get(letter) || 0, count));
      });
    });
    
    // Build array with correct number of each letter
    let letters: string[] = [];
    letterFrequency.forEach((count, letter) => {
      for (let i = 0; i < count; i++) {
        letters.push(letter);
      }
    });
    
    // Shuffle for gameplay - always use seeded RNG for determinism
    const shuffleSeed = this.config.seed || `game_${Date.now()}`;
    const rng = createRNG(shuffleSeed + '_input');
    letters = rng.shuffle(letters);
    
    // Set the letters including duplicates
    const gridLetters = letters.join('');
    this.inputGrid.setLetters(gridLetters);
    
    console.log(`Input grid populated with ${letters.length} letters (including duplicates): ${gridLetters}`);
    console.log(`Letter frequencies:`, Array.from(letterFrequency.entries()).map(([l, c]) => `${l}:${c}`).join(', '));
  }
  
  /**
   * Renders the game
   */
  private render(): void {
    if (!this.isInitialized) return;
    
    // Get container size
    const rect = this.container.getBoundingClientRect();
    
    // Set canvas size with device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.ctx.scale(dpr, dpr);
    
    // Clear canvas
    this.renderer.clear(rect.width, rect.height);
    
    if (this.board.size === 0) {
      // No crossword generated yet
      this.renderLoadingState(rect.width, rect.height);
      return;
    }
    
    // Calculate layout
    const layout = this.calculateLayout(rect.width, rect.height);
    
    // Update renderer with dynamic hex size
    this.renderer.updateConfig({ hexSize: layout.hexSize });
    
    // Update UI overlay
    this.updateGameUI();
    
    // Render clue above the puzzle grid
    this.renderClue(layout.gridCenterX, layout.gridCenterY, layout);
    
    // Render main grid with solved cells
    this.renderer.renderGrid(
      this.board,
      layout.gridCenterX,
      layout.gridCenterY,
      this.solvedCells
    );
    
    // Render input grid and get its top position
    const inputGridTop = this.inputGrid.render(
      layout.inputCenterX,
      layout.inputCenterY,
      layout.inputHexSize,
      this.typedWord  // Pass typed word for clear button visibility
    );
    
    // Render typed word dynamically positioned above the topmost input grid cells
    if (this.typedWord) {
      // Get the actual bounds of the input grid to position text above it
      const inputBounds = this.inputGrid.getBounds(
        layout.inputCenterX, 
        layout.inputCenterY, 
        layout.inputHexSize
      );
      // Position typed word just above the topmost cell center
      const typedBaseline = inputBounds.topmostCellY + 50; // 50px below the topmost cell center
      
      // Debug logging
      console.log('DEBUG: Typed word positioning:', {
        topmostCellY: inputBounds.topmostCellY,
        inputHexSize: layout.inputHexSize,
        typedBaseline: typedBaseline,
        topY: inputBounds.topY,
        bottomY: inputBounds.bottomY
      });
      
      this.renderTypedWord(rect.width, typedBaseline);
    }
    
    // Render jumping letters animation
    this.renderJumpingLetters();
    
    // Render debug info (if enabled)
    if (this.isDebugMode()) {
      this.renderer.renderDebugInfo(this.board, 10, 10);
    }
  }
  
  /**
   * Renders loading state
   */
  private renderLoadingState(width: number, height: number): void {
    this.ctx.fillStyle = '#666';
    this.ctx.font = '20px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('Generating crossword...', width / 2, height / 2);
  }
  
  /**
   * Calculates layout dimensions
   */
  private calculateLayout(canvasWidth: number, canvasHeight: number): {
    hexSize: number;
    gridCenterX: number;
    gridCenterY: number;
    inputHexSize: number;
    inputCenterX: number;
    inputCenterY: number;
    inputTypedBand: number;
  } {
    // Spacing guided by 8pt grid (inspired by Apple HIG)
    const unit = 8;
    const paddingTop = unit * 10;   // 80px top spacing for UI elements and clue
    const paddingSide = unit * 2;   // 16px safe side margins
    const bottomSafe = unit * 2;    // 16px bottom safe area
    // Reserve input area proportionally with sensible bounds
    const inputGridHeight = Math.max(112, Math.min(168, Math.floor(canvasHeight * 0.2)));
    // Additional reserved band above input grid for typed text and breathing room
    const inputTypedBand = Math.max(48, Math.floor(canvasHeight * 0.06));

    // Calculate space for main grid (leave room for input grid at bottom)
    const gridWidth = canvasWidth - (paddingSide * 2);
    const gridAvailHeight = canvasHeight - paddingTop - inputGridHeight - inputTypedBand - bottomSafe;
    
    // Calculate dynamic hex size for main grid
    const hexSize = this.renderer.calculateDynamicHexSize(
      this.board,
      gridWidth,
      gridAvailHeight * 0.9, // Use 90% of available height for main grid
      5,
      20
    );
    
    // Input grid settings - position at very bottom of canvas
    const inputHexSize = 20; // Input tiles size; independent from main grid spacing
    // The input grid render method now handles positioning relative to its bottom edge
    // We pass the Y coordinate where we want the bottom of the grid to be
    const inputGridY = canvasHeight - bottomSafe; // Bottom edge aligned to safe area
    
    return {
      hexSize,
      gridCenterX: canvasWidth / 2,
      gridCenterY: paddingTop + (gridAvailHeight * 0.5), // Balanced center within available band
      inputHexSize,
      inputCenterX: canvasWidth / 2, // Always center horizontally
      inputCenterY: inputGridY,
      inputTypedBand
    };
  }
  
  /**
   * Handles window resize
   */
  private handleResize(): void {
    this.render();
  }
  
  /**
   * Handles canvas click events
   */
  private handleClick(event: MouseEvent): void {
    // Don't handle clicks until game is initialized
    if (!this.isInitialized) {
      console.warn('Game not yet initialized');
      return;
    }
    
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // Get layout for input grid position
    const layout = this.calculateLayout(rect.width, rect.height);
    
    // Check if click was on input grid
    const clickedLetter = this.inputGrid.handleClick(
      x, 
      y, 
      layout.inputCenterX, 
      layout.inputCenterY, 
      layout.inputHexSize
    );
    
    if (clickedLetter) {
      if (clickedLetter === 'CLEAR') {
        this.animationService.animateClearButton();
        this.typedWord = '';
      } else if (clickedLetter === 'BACKSPACE') {
        // Mirror keyboard backspace behavior when last selected letter is clicked again
        this.typedWord = this.inputGrid.getTypedWord();
        // Optional: small typed word animation feedback
        this.animationService.animateTypedWord(this.typedWord);
      } else {
        // Animate the clicked hex
        const clickedHex = this.inputGrid.getLastClickedHex();
        if (clickedHex) {
          this.animationService.animateInputHexClick(clickedHex.q, clickedHex.r);
        }
        
        this.typedWord += clickedLetter;
        this.animationService.animateTypedWord(this.typedWord);
        
        // Check if typed word matches any placed word
        this.checkWord();
      }
      console.log('Typed word:', this.typedWord);
      this.render();  // Re-render to show typed word
    }
  }
  
  /**
   * Handles touch events
   */
  private handleTouch(event: TouchEvent): void {
    event.preventDefault();
    
    // Don't handle touches until game is initialized
    if (!this.isInitialized) {
      console.warn('Game not yet initialized');
      return;
    }
    
    const touch = event.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    // Get layout for input grid position
    const layout = this.calculateLayout(rect.width, rect.height);
    
    // Check if touch was on input grid
    const clickedLetter = this.inputGrid.handleClick(
      x, 
      y, 
      layout.inputCenterX, 
      layout.inputCenterY, 
      layout.inputHexSize
    );
    
    if (clickedLetter) {
      if (clickedLetter === 'CLEAR') {
        this.animationService.animateClearButton();
        this.typedWord = '';
      } else if (clickedLetter === 'BACKSPACE') {
        // Mirror keyboard backspace behavior when last selected letter is touched again
        this.typedWord = this.inputGrid.getTypedWord();
        // Optional: small typed word animation feedback
        this.animationService.animateTypedWord(this.typedWord);
      } else {
        // Animate the touched hex
        const clickedHex = this.inputGrid.getLastClickedHex();
        if (clickedHex) {
          this.animationService.animateInputHexClick(clickedHex.q, clickedHex.r);
        }
        
        this.typedWord += clickedLetter;
        this.animationService.animateTypedWord(this.typedWord);
        
        // Check if typed word matches any placed word
        this.checkWord();
      }
      console.log('Typed word:', this.typedWord);
      this.render();  // Re-render to show typed word
    }
  }
  
  /**
   * Checks if typed word matches any placed word
   */
  private checkWord(): void {
    // Ensure we have placed words to check against
    if (!this.placedWords || this.placedWords.length === 0) {
      console.warn('No placed words to check against');
      return;
    }
    
    const typed = this.typedWord.toUpperCase();
    
    // Check each placed word
    for (const word of this.placedWords) {
      if (word.word === typed && !this.foundWords.has(word.word)) {
        this.handleCorrectWord(word);
        return;
      }
    }
  }
  
  /**
   * Handle when a correct word is found
   */
  private handleCorrectWord(word: WordObject): void {
    // Found a new word!
    this.foundWords.add(word.word);
    
    // Get layout for animation positions
    const rect = this.canvas.getBoundingClientRect();
    const layout = this.calculateLayout(rect.width, rect.height);
    
    // Get target positions from the actual word cells in the puzzle
    const targetPositions: Array<{x: number, y: number, q: number, r: number}> = [];
    if (word.cells && Array.isArray(word.cells)) {
      // Calculate center offset for the puzzle grid
      const bounds = this.renderer.calculateBounds(this.board);
      const offset = this.renderer.calculateCenterOffset(bounds);
      
      word.cells.forEach(cell => {
        // Use the renderer's hex factory to get exact positions
        const hexPos = this.renderer.getHexPosition(cell.q, cell.r);
        targetPositions.push({
          x: hexPos.x + layout.gridCenterX + offset.x,
          y: hexPos.y + layout.gridCenterY + offset.y,
          q: cell.q,
          r: cell.r
        });
      });
    }
    
    // Get input hex positions for green blink animation - they're already in order
    const inputHexPositions = this.inputGrid.getSelectedPositions();
    console.log('Input hex positions in order:', inputHexPositions);

    // Animate letters jumping to PUZZLE GRID cells
    const lettersAll = this.typedWord.split('');
    const lettersUpper = lettersAll.map(l => l.toUpperCase());
    // Prefer exact glyph positions captured during renderTypedWord. Fallback to a single line above input grid.
    let sourcePositionsAll: Array<{ x: number; y: number }> | undefined = (window as any).__typedGlyphPositions;
    if (!sourcePositionsAll || sourcePositionsAll.length !== lettersUpper.length) {
      const inputBounds = this.inputGrid.getBounds(layout.inputCenterX, layout.inputCenterY, layout.inputHexSize);
      const startY = inputBounds.topmostCellY + 50; // Use same positioning as renderTypedWord
      this.ctx.save();
      this.ctx.font = "900 16px 'Inter', Arial"; // Match font size from renderTypedWord
      const widths = lettersUpper.map(ch => this.ctx.measureText(ch).width);
      const gap = 6; // add extra spacing between letters in fallback
      const totalWidth = widths.reduce((a, w) => a + w, 0) + gap * Math.max(lettersUpper.length - 1, 0);
      let cursorX = layout.inputCenterX - totalWidth / 2;
      const fallback: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < lettersUpper.length; i++) {
        const w = widths[i];
        const cx = cursorX + w / 2;
        fallback.push({ x: cx, y: startY });
        cursorX += w + gap;
      }
      this.ctx.restore();
      sourcePositionsAll = fallback;
    }
    // Expand horizontal spacing for the animation start without moving the visual typed word
    // Scale x distances from the center so letters have more room when they go up
    if (sourcePositionsAll && sourcePositionsAll.length) {
      const centerXForSpread = sourcePositionsAll.reduce((acc, p) => acc + p.x, 0) / sourcePositionsAll.length;
      const spreadFactor = 1.25; // 25% more spacing
      sourcePositionsAll = sourcePositionsAll.map(p => ({ x: centerXForSpread + (p.x - centerXForSpread) * spreadFactor, y: p.y }));
    }
    // Match lengths among letters, targets, and input selection
    const count = Math.min(lettersUpper.length, targetPositions.length, inputHexPositions.length, sourcePositionsAll.length);
    const letters = lettersUpper.slice(0, count);
    const sourcePositions = sourcePositionsAll.slice(0, count);
    
    
    // Clear typed word and selected positions immediately for animation
    this.typedWord = '';
    this.inputGrid.clearTypedWord(); // This also clears selected positions
    
    // Start the two-phase animation to puzzle grid
    this.animationService.animateCorrectWord(
      letters,
      sourcePositions,
      targetPositions,
      inputHexPositions,
      () => {
        // Animation complete callback
        // NOW mark puzzle cells as solved after animation completes
        if (word.cells && Array.isArray(word.cells) && word.cells.length > 0) {
          word.cells.forEach(cell => {
            const key = `${cell.q},${cell.r}`;
            this.solvedCells.add(key);
          });
          // Clean up temporary green cells since they're now in solvedCells
          delete (window as any).__greenCells;
        }
        this.render();
        // After animation completes, remove from input grid any letters no longer needed
        try {
          const remainingWords = this.placedWords
            .filter(w => !this.foundWords.has(w.word))
            .map(w => w.word);
          const remainingLetters = new Set<string>();
          remainingWords.forEach(w => w.split('').forEach(ch => remainingLetters.add(ch.toUpperCase())));
          const retireSet = new Set<string>();
          word.word.split('').forEach(ch => {
            const up = ch.toUpperCase();
            if (!remainingLetters.has(up)) retireSet.add(up);
          });
          if (retireSet.size > 0) {
            this.inputGrid.removeLettersBySet(
              retireSet,
              { centerX: layout.inputCenterX, centerY: layout.inputCenterY, size: layout.inputHexSize },
              () => {
                (window as any).__requestRender?.();
              }
            );
          }
        } catch (e) {
          console.warn('Failed to remove retired letters:', e);
        }
        // Only check for level completion after the final animation finishes
        this.checkLevelCompletion();
      }
    );
    
    console.log(`Found word: ${word.word}`);
  }

  /**
   * Checks if all words are found and triggers completion callback
   */
  private checkLevelCompletion(): void {
    if (this.levelCompleted) return;
    if (this.placedWords.length === 0) return;
    const allFound = this.foundWords.size >= this.placedWords.length;
    if (!allFound) return;
    this.levelCompleted = true;
    if (this.config.onLevelComplete) {
      try {
        this.config.onLevelComplete(this.currentLevel);
      } catch (e) {
        console.warn('onLevelComplete callback error', e);
      }
    }
  }
  
  /**
   * Renders the HUD with progress indicators
   */
  private updateGameUI(): void {
    // Notify the UI layer about state changes
    if ((window as any).gameUI) {
      const ui = (window as any).gameUI;
      ui.updateLevel(this.currentLevel);
      ui.updateWordCount(this.foundWords.size, this.placedWords.length);
    }
  }
  
  /**
   * Helper to draw rounded rectangle
   */
  private drawRoundedRect(x: number, y: number, width: number, height: number, radius: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x + radius, y);
    this.ctx.lineTo(x + width - radius, y);
    this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    this.ctx.lineTo(x + width, y + height - radius);
    this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    this.ctx.lineTo(x + radius, y + height);
    this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    this.ctx.lineTo(x, y + radius);
    this.ctx.quadraticCurveTo(x, y, x + radius, y);
    this.ctx.closePath();
  }
  
  /**
   * Renders the clue above the puzzle grid with themed gradient and soft glow
   */
  private renderClue(centerX: number, centerY: number, layout: any): void {
    if (!this.currentClue || this.introActive) return;
    
    // Calculate the top of the puzzle grid
    const bounds = this.renderer.calculateBounds(this.board);
    const offset = this.renderer.calculateCenterOffset(bounds);
    
    // Position clue below the top UI elements (level, word count, settings)
    // Top UI takes about 30px, so start clue at 40px from top
    const unit = 8;
    const topUIHeight = 40; // Space taken by top UI elements
    const clueY = topUIHeight + unit; // Add 8px padding below UI
    
    // Get the clue text without "Clue:" prefix
    const clueText = this.currentClue.toUpperCase();
    
    // Calculate maximum width available (90% of canvas width to leave some margin)
    const maxWidth = this.canvas.width / (window.devicePixelRatio || 1) * 0.9;
    
    // Start with a large font size and reduce until it fits
    let fontSize = 32;
    let textWidth = 0;
    
    this.ctx.save();
    
    // Find the right font size
    do {
      this.ctx.font = `900 ${fontSize}px 'Inter', Arial`;
      textWidth = this.ctx.measureText(clueText).width;
      if (textWidth > maxWidth) {
        fontSize -= 1;
      }
    } while (textWidth > maxWidth && fontSize > 12);

    // Reduce final font size by 10px for main gameplay view (5px more than before)
    fontSize = Math.max(12, fontSize - 10);
    
    // Get theme colors based on level
    const palette = getPaletteForLevel(this.currentLevel);
    const accentColor = palette.colors[0];  // Primary accent color
    const secondaryColor = palette.colors[1];  // Secondary color for gradient
    
    // Create gradient for text
    const gradient = this.ctx.createLinearGradient(
      centerX - textWidth / 2, clueY,
      centerX + textWidth / 2, clueY
    );
    
    // Add gradient stops with soft color transition
    gradient.addColorStop(0, accentColor);
    gradient.addColorStop(0.5, secondaryColor);
    gradient.addColorStop(1, accentColor);
    
    // Apply multiple layers for soft glow effect
    this.ctx.font = `900 ${fontSize}px 'Inter', Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    
    // Dynamic shadow/glow based on font size
    // Smaller text needs less blur to remain readable
    const glowScale = Math.max(0.3, fontSize / 32); // Scale relative to base size of 32px
    
    // Layer 1: Outer glow (most diffuse)
    this.ctx.globalAlpha = 0.3;
    this.ctx.shadowColor = accentColor;
    this.ctx.shadowBlur = 20 * glowScale;
    this.ctx.shadowOffsetY = 0;
    this.ctx.fillStyle = gradient;
    this.ctx.fillText(clueText, centerX, clueY);
    
    // Layer 2: Middle glow
    this.ctx.globalAlpha = 0.5;
    this.ctx.shadowBlur = 10 * glowScale;
    this.ctx.fillText(clueText, centerX, clueY);
    
    // Layer 3: Inner glow (only if text is large enough)
    if (fontSize > 20) {
      this.ctx.globalAlpha = 0.7;
      this.ctx.shadowBlur = 5 * glowScale;
      this.ctx.fillText(clueText, centerX, clueY);
    }
    
    // Layer 4: Main text with gradient
    this.ctx.globalAlpha = 1;
    this.ctx.shadowColor = 'rgba(0,0,0,0.6)';
    this.ctx.shadowBlur = Math.max(1, 2 * glowScale);
    this.ctx.shadowOffsetY = Math.max(0.5, glowScale);
    this.ctx.fillStyle = gradient;
    this.ctx.fillText(clueText, centerX, clueY);
    
    // Optional: Add subtle white highlight for extra pop (only for larger text)
    if (fontSize > 24) {
      this.ctx.globalAlpha = 0.9;
      this.ctx.shadowColor = 'transparent';
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.font = `900 ${fontSize - 1}px 'Inter', Arial`;
      this.ctx.fillText(clueText, centerX, clueY - 1);
    }
    
    this.ctx.restore();
  }
  
  /**
   * Renders the typed word above the main grid
   */
  private renderTypedWord(canvasWidth: number, y: number): void {
    // Apply typed word animation if active
    const typedWordAnim = (window as any).__typedWordAnimation;
    if (typedWordAnim) {
      this.ctx.save();
      this.ctx.globalAlpha = typedWordAnim.opacity || 1;
      
      // Apply scale
      const centerX = canvasWidth / 2;
      this.ctx.translate(centerX, y);
      this.ctx.scale(typedWordAnim.scale || 1, typedWordAnim.scale || 1);
      this.ctx.translate(-centerX, -y);
    }
    
    // Use pure white with strong shadow
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0,0,0,0.8)';
    this.ctx.shadowBlur = 3;
    this.ctx.shadowOffsetY = 1;
    
    // Pure white for typed word
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = "900 16px 'Inter', Arial";  // Reduced from 20px
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(this.typedWord.toUpperCase(), canvasWidth / 2, y);
    this.ctx.restore();

    // Capture exact per-letter screen positions for later animations
    try {
      const text = this.typedWord.toUpperCase();
      const centerX = canvasWidth / 2;
      const scale = (typedWordAnim?.scale ?? 1) as number;
      // Build unscaled centered positions, then apply scale around (centerX, y)
      const widths = Array.from(text).map(ch => this.ctx.measureText(ch).width);
      const gap = 0; // no extra gap when rendering as a single string
      const totalWidth = widths.reduce((a, w) => a + w, 0) + gap * Math.max(widths.length - 1, 0);
      let cursorX = centerX - totalWidth / 2;
      const positions: Array<{ x: number; y: number }> = [];
      for (let i = 0; i < text.length; i++) {
        const w = widths[i];
        const px = cursorX + w / 2;
        // Apply scale around pivot (centerX, y)
        const sx = centerX + (px - centerX) * scale;
        const sy = y; // vertical scale keeps the baseline when scaling around pivot
        positions.push({ x: sx, y: sy });
        cursorX += w + gap;
      }
      (window as any).__typedGlyphPositions = positions;
    } catch {}
    
    if (typedWordAnim) {
      this.ctx.restore();
    }
  }
  
  /**
   * Renders jumping letters animation
   */
  private renderJumpingLetters(): void {
    const jumpingLetters = (window as any).__jumpingLetters;
    if (!jumpingLetters || !Array.isArray(jumpingLetters)) return;
    
    jumpingLetters.forEach(letterObj => {
      if (!letterObj || letterObj.opacity <= 0) return;
      
      this.ctx.save();
      this.ctx.globalAlpha = letterObj.opacity || 1;
      
      // Apply transforms
      this.ctx.translate(letterObj.x, letterObj.y);
      this.ctx.rotate((letterObj.rotation || 0) * Math.PI / 180);
      this.ctx.scale(letterObj.scale || 1, letterObj.scale || 1);
      
      // Add subtle glow effect for jumping letters
      this.ctx.shadowColor = letterObj.color || '#00d9ff';
      this.ctx.shadowBlur = 10 * (letterObj.scale || 1);
      
      // Draw the letter with normal font size
      this.ctx.fillStyle = letterObj.color || '#00d9ff';
      this.ctx.font = "900 25px 'Inter', Arial"; // Normal size
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(letterObj.letter.toUpperCase(), 0, 0);
      
      this.ctx.restore();
    });
  }
  
  /**
   * Checks if debug mode is enabled
   */
  private isDebugMode(): boolean {
    return localStorage.getItem('hexaword_debug') === 'true';
  }
  
  /**
   * Public API: Updates word list
   */
  public async updateWords(words: string[]): Promise<void> {
    await this.generateCrossword(words);
    this.render();
  }
  
  /**
   * Public API: Resets the game
   */
  public async reset(): Promise<void> {
    // Clear state
    this.foundWords.clear();
    this.solvedCells.clear();
    this.typedWord = '';
    this.levelCompleted = false;

    // Reset input selections (but don't wipe letters — they will be repopulated)
    this.inputGrid.clearTypedWord();

    // Kill any lingering animations
    try { this.animationService.cleanup(); } catch {}

    // Regenerate puzzle with current config/seed/words
    await this.generateCrossword();
    this.render();

    // Replay the level intro so all elements are restored consistently
    await this.playLevelIntro();
  }
  
  /**
   * Public API: Gets placed words
   */
  public getPlacedWords(): WordObject[] {
    return this.placedWords;
  }
  
  /**
   * Public API: Gets board state
   */
  public getBoard(): Map<string, HexCell> {
    return this.board;
  }

  /**
   * Public API: number of found words
   */
  public getFoundCount(): number {
    return this.foundWords.size;
  }

  /**
   * Public API: total words placed
   */
  public getTotalWords(): number {
    return this.placedWords.length;
  }

  /**
   * Public API: get current clue text
   */
  public getClue(): string {
    return this.currentClue;
  }
  
  /**
   * Shuffles the input grid letters (free, unlimited use)
   */
  public shuffleInputGrid(): void {
    this.inputGrid.shuffleLetters();
    this.render();
  }
  
  /**
   * Gets the booster service
   */
  public getBoosterService(): BoosterService {
    return this.boosterService;
  }

  /**
   * Public API: load a new level with fresh words/seed/clue
   */
  public async loadLevel(data: { words: string[]; seed: string; clue?: string; level?: number }): Promise<void> {
    // Reset state
    this.foundWords.clear();
    this.solvedCells.clear();
    this.typedWord = '';
    this.levelCompleted = false;

    // Update config/state
    this.config.words = data.words;
    this.config.seed = data.seed;
    this.currentClue = data.clue || this.defaultClue;
    if (data.level) {
      this.currentLevel = data.level;
      await this.initializeColorPalette();
    }

    // Reinitialize generator with new seed/words
    this.generator.updateConfig({ seed: this.config.seed, words: data.words });
    await this.generateCrossword(data.words);
    this.render();
    await this.playLevelIntro();
  }

  /**
   * Plays the level-intro sequence: wave-pop cells, blur with centered clue, then settle.
   */
  private async playLevelIntro(): Promise<void> {
    try {
      this.introActive = true;
      // 1) Wave-pop puzzle grid
      const cellKeys: string[] = [];
      this.board.forEach((cell) => {
        if (cell.letter) cellKeys.push(`${cell.q},${cell.r}`);
      });
      cellKeys.sort((a, b) => {
        const [aq, ar] = a.split(',').map(Number);
        const [bq, br] = b.split(',').map(Number);
        return ar !== br ? ar - br : aq - bq;
      });
      await new Promise<void>(res => this.animationService.animateLevelWave(cellKeys, { delayStep: 0, duration: 0.25 }, res));

      // 2) Wave-pop input grid
      const rect = this.canvas.getBoundingClientRect();
      const layout = this.calculateLayout(rect.width, rect.height);
      const inputKeys = this.inputGrid.getAllInputKeys();
      await new Promise<void>(res => this.animationService.animateInputGridWave(inputKeys, { delayStep: 0, duration: 0.22 }, res));

      // 3) Blur overlay + centered clue → settle to top of puzzle
      const bounds = this.renderer.calculateBounds(this.board);
      const offset = this.renderer.calculateCenterOffset(bounds);
      const unit = 8;
      const clueY = layout.gridCenterY + offset.y + bounds.minY - unit * 3;
      const targetScreen = { x: rect.left + layout.gridCenterX, y: rect.top + clueY };
      // Compute gameplay clue font size to match overlay
      const maxWidth = rect.width * 0.9;
      let size = 32;
      let width = 0;
      this.ctx.save();
      do {
        this.ctx.font = `900 ${size}px 'Inter', Arial`;
        width = this.ctx.measureText(this.currentClue.toUpperCase()).width;
        if (width > maxWidth) size -= 1;
      } while (width > maxWidth && size > 12);
      // Apply -5px adjustment like gameplay view
      size = Math.max(12, size - 5);
      this.ctx.restore();

      // Blur overlay + center clue → move to final position
      await this.animationService.animateClueOverlay(
        this.currentClue,
        targetScreen,
        { fontSizePx: size, overlayWidthPx: maxWidth, holdMs: 1000, level: this.currentLevel },
        () => {
          // After overlay completes, reveal gameplay clue and redraw
          this.introActive = false;
          (window as any).__requestRender?.();
        }
      );
    } catch (e) {
      console.warn('Level intro animation failed:', e);
      this.introActive = false;
    }
  }
}
