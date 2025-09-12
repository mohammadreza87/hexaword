import { CrosswordGenerator } from './services/CrosswordGenerator';
import { HexRenderer } from './engine/HexRenderer';
import { InputHexGrid } from './components/InputHexGrid';
import { HexCell, WordObject } from '../shared/types/hexaword';
import { createRNG } from '../shared/utils/rng';
import { AnimationService } from './services/AnimationService';
import { ColorPaletteService } from './services/ColorPaletteService';
import { getPaletteForLevel } from './config/ColorPalettes';
import { BoosterService, BoosterType } from '../shared/game/application/services/BoosterService';
import { ScoreService, ScoreState } from '../shared/game/domain/services/ScoreService';
import { CoinService } from '../shared/game/domain/services/CoinService';
import { CoinStorageService } from '../client/services/CoinStorageService';
import { HintService } from '../shared/game/domain/services/HintService';
import { HintStorageService } from '../client/services/HintStorageService';
import { HintPurchaseUI } from '../client/services/HintPurchaseUI';
import { LevelProgressService } from '../client/services/LevelProgressService';
import { UserLevelCompletion } from './components/UserLevelCompletion';

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
  onWordFound?: (word: string) => void;
  onLevelComplete?: (level: number) => void;
  // User level specific
  isUserLevel?: boolean;
  levelName?: string;
  levelId?: string;
  levelAuthor?: string;
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
  private scoreService: ScoreService;
  private coinService: CoinService;
  private coinStorageService: CoinStorageService;
  private hintService: HintService;
  private hintStorageService: HintStorageService;
  private hintPurchaseUI: HintPurchaseUI;
  private levelProgressService: LevelProgressService;
  private currentLevel: number = 1;
  private wordStartTime: number = Date.now();
  
  private board: Map<string, HexCell> = new Map();
  private placedWords: WordObject[] = [];
  private isInitialized: boolean = false;
  private typedWord: string = '';  // Track typed word
  private solvedCells: Set<string> = new Set();  // Track solved cells
  private foundWords: Set<string> = new Set();  // Track found words
  private levelCompleted: boolean = false;  // Ensure completion fires once per level
  private currentClue: string = '';  // Current level clue
  private introActive: boolean = false; // Hide gameplay clue while intro anim runs
  private isTargetHintMode: boolean = false;  // Track target hint mode
  private targetHintOverlay: HTMLElement | null = null;  // Blur overlay element
  private targetHintInstruction: HTMLElement | null = null;  // Instruction text element
  
  // User level specific
  private isUserLevel: boolean = false;
  private userLevelName?: string;
  private userLevelId?: string;
  private userLevelAuthor?: string;
  
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
      this.scoreService = new ScoreService();
      this.coinService = new CoinService();
      this.coinStorageService = CoinStorageService.getInstance();
      this.hintService = new HintService();
      this.hintStorageService = HintStorageService.getInstance();
      this.hintPurchaseUI = new HintPurchaseUI();
      this.levelProgressService = LevelProgressService.getInstance();
      
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
      
      // Load and initialize coins
      const coinData = await this.coinStorageService.loadCoins();
      this.coinService.initialize(coinData.balance);
      this.coinService.startLevel();
      
      // Load and initialize hints
      const hintInventory = await this.hintStorageService.loadHints();
      this.hintService.loadInventory({
        revealHints: hintInventory.revealHints,
        targetHints: hintInventory.targetHints,
        freeReveals: hintInventory.freeReveals,
        freeTargets: hintInventory.freeTargets
      });
      this.updateHintDisplay();
      
      // Load saved progress for this level
      await this.loadSavedProgress();
      
      // Initial render and display updates
      this.render();
      this.updateCoinDisplay();
      // Play level intro (only if no saved progress)
      const hasProgress = this.foundWords.size > 0 || this.solvedCells.size > 0;
      if (!hasProgress) {
        await this.playLevelIntro();
      }
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
    
    // Render main grid always
    this.renderer.renderGrid(
      this.board,
      layout.gridCenterX,
      layout.gridCenterY,
      this.solvedCells
    );
    
    // Only render clue, input grid and typed word if NOT in target hint mode
    if (!this.isTargetHintMode) {
      this.renderClue(layout.gridCenterX, layout.gridCenterY, layout);
      
      const inputGridTop = this.inputGrid.render(
        layout.inputCenterX,
        layout.inputCenterY,
        layout.inputHexSize,
        this.typedWord
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
        
        this.renderTypedWord(rect.width, typedBaseline);
      }
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
    
    // Handle target hint mode clicks
    if (this.isTargetHintMode) {
      this.handleTargetHintClick(x, y);
      return;
    }
    
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
    
    // Handle target hint mode touches
    if (this.isTargetHintMode) {
      this.handleTargetHintClick(x, y);
      return;
    }
    
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
    
    // Save progress
    this.saveProgress();
    
    // Calculate score
    const timeToFind = Date.now() - this.wordStartTime;
    const hasIntersections = word.cells.some(cell => {
      const key = `${cell.q},${cell.r}`;
      const hexCell = this.board.get(key);
      return hexCell && hexCell.wordIds && hexCell.wordIds.length > 1;
    });
    
    const points = this.scoreService.scoreWord(
      word.word,
      hasIntersections,
      timeToFind
    );
    
    // No coin rewards during gameplay - only at level completion
    
    // Update displays
    this.updateScoreDisplay();
    
    // Reset timer for next word
    this.wordStartTime = Date.now();
    
    // Call the onWordFound callback if provided
    if (this.config.onWordFound) {
      this.config.onWordFound(word.word);
    }
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
  private async checkLevelCompletion(): Promise<void> {
    if (this.levelCompleted) return;
    if (this.placedWords.length === 0) return;
    const allFound = this.foundWords.size >= this.placedWords.length;
    if (!allFound) return;
    this.levelCompleted = true;
    
    // Clear saved progress for this level since it's complete
    this.levelProgressService.clearProgress(this.currentLevel);
    
    // Calculate and apply level completion bonus
    const timeElapsed = Date.now() - this.scoreService.getState().timeStarted;
    const bonus = this.scoreService.completeLevelBonus(
      this.placedWords.length,
      timeElapsed
    );
    
    // Calculate coin rewards but DON'T add them yet - let the complete panel handle it
    const hintsUsed = this.scoreService.getState().hintsUsed;
    const coinReward = this.coinService.calculateLevelReward(
      this.currentLevel,
      this.placedWords.length,
      timeElapsed,
      hintsUsed
    );
    
    // Don't add coins here - the complete panel will show them and add them when user continues
    // this.coinStorageService.addCoins(coinReward).catch(console.error);
    
    // Update score display only
    this.updateScoreDisplay();
    
    // No more ugly popup notifications - scores are shown in the complete panel
    
    // High score functionality has been removed
    
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
    // Clear saved progress for this level
    await this.levelProgressService.clearProgress(this.currentLevel);
    
    // Clear state
    this.foundWords.clear();
    this.solvedCells.clear();
    this.typedWord = '';
    this.levelCompleted = false;
    
    // Reset score for new level
    this.scoreService.resetLevel();
    this.coinService.startLevel();
    this.wordStartTime = Date.now();
    this.updateScoreDisplay();
    this.updateCoinDisplay();

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
   * Gets the letters from the input grid
   */
  public getInputLetters(): string[] {
    return this.inputGrid.getLetters();
  }
  
  /**
   * Shuffles the input grid letters (free, unlimited use)
   */
  public shuffleInputGrid(): void {
    this.inputGrid.shuffleLetters();
    this.render();
  }
  
  /**
   * Updates the score display in the UI
   */
  private updateScoreDisplay(): void {
    // Score is now only shown in the level complete panel
    // This method is kept for compatibility but doesn't update UI anymore
  }
  
  /**
   * Updates the coin display in the UI
   */
  private updateCoinDisplay(): void {
    // Use the server-synced balance from CoinStorageService
    const balance = this.coinStorageService.getCachedBalance();
    
    // Also update the local CoinService to keep it in sync
    this.coinService.initialize(balance);
    
    // Update the UI using GameUI component
    if ((window as any).gameUI) {
      const ui = (window as any).gameUI;
      ui.updateCoins(balance);
    }
  }
  
  /**
   * Updates the hint badge display in the UI
   */
  private updateHintDisplay(): void {
    const inventory = this.hintService.getInventory();
    
    // Update the UI using GameUI component
    if ((window as any).gameUI) {
      const ui = (window as any).gameUI;
      ui.updateHintBadges(inventory.revealHints, inventory.targetHints);
    }
  }

  /**
   * Public: Reload hint inventory from server storage and refresh UI badges.
   * Useful after rewards (spinner) so in-game logic matches displayed counts.
   */
  public async syncHintInventory(): Promise<void> {
    try {
      const inv = await this.hintStorageService.loadHints();
      this.hintService.loadInventory({
        revealHints: inv.revealHints,
        targetHints: inv.targetHints,
        freeReveals: inv.freeReveals,
        freeTargets: inv.freeTargets,
      });
      this.updateHintDisplay();
    } catch (e) {
      console.warn('syncHintInventory failed:', e);
    }
  }

  /**
   * Public method to immediately persist progress to the server.
   * Ensures current in-memory state is captured before leaving the game.
   */
  public async saveProgressNow(): Promise<boolean> {
    try {
      // Capture the latest state into LevelProgressService
      this.saveProgress();
      // Flush debounce and persist
      return await this.levelProgressService.forceSave();
    } catch (e) {
      console.warn('saveProgressNow failed:', e);
      return false;
    }
  }
  
  /**
   * Shows a temporary bonus notification (deprecated - now shown in complete panel)
   */
  private showBonusNotification(bonus: number): void {
    const notification = document.createElement('div');
    notification.className = 'bonus-notification';
    notification.textContent = `+${bonus.toLocaleString()} Bonus!`;
    notification.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%);
      color: white;
      padding: 16px 32px;
      border-radius: 12px;
      font-size: 24px;
      font-weight: bold;
      z-index: 10000;
      animation: bonusPop 1.5s ease-out forwards;
      pointer-events: none;
    `;
    
    // Add animation keyframes if not already present
    if (!document.getElementById('bonus-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'bonus-animation-styles';
      style.textContent = `
        @keyframes bonusPop {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -60%) scale(1);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Remove after animation
    setTimeout(() => {
      notification.remove();
    }, 1500);
  }
  
  /**
   * Shows level complete notification (deprecated - now shown in complete panel)
   */
  private showLevelCompleteNotification(score: number, coins: number): void {
    const notification = document.createElement('div');
    notification.className = 'level-complete-notification';
    notification.innerHTML = `
      <div style="font-size: 24px; margin-bottom: 12px; font-weight: bold;">⭐ Level Complete! ⭐</div>
      <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
        <div style="font-size: 18px;">
          Score: <span style="font-weight: bold; color: #8B5CF6;">${score.toLocaleString()}</span>
        </div>
        <div style="font-size: 20px; font-weight: bold;">
          <span style="font-size: 18px;">🪙</span> +${coins}
        </div>
      </div>
    `;
    notification.style.cssText = `
      position: fixed;
      top: 45%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: linear-gradient(135deg, #1a1f2b 0%, #2a3142 100%);
      color: white;
      padding: 24px 48px;
      border-radius: 16px;
      text-align: center;
      z-index: 10000;
      animation: levelCompletePop 2.5s ease-out forwards;
      pointer-events: none;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      border: 2px solid rgba(139, 92, 246, 0.3);
    `;
    
    // Add animation keyframes if not already present
    if (!document.getElementById('level-complete-animation-styles')) {
      const style = document.createElement('style');
      style.id = 'level-complete-animation-styles';
      style.textContent = `
        @keyframes levelCompletePop {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
          }
          40% {
            transform: translate(-50%, -50%) scale(1.1);
            opacity: 1;
          }
          60% {
            transform: translate(-50%, -50%) scale(0.95);
          }
          80% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Remove after animation
    setTimeout(() => {
      notification.remove();
    }, 2500);
  }
  
  /**
   * Shows insufficient funds notification
   */
  private showInsufficientFundsNotification(hintType: string, cost: number): void {
    const notification = document.createElement('div');
    notification.className = 'insufficient-funds-notification';
    notification.innerHTML = `
      <div style="font-size: 18px; margin-bottom: 4px;">Not enough coins!</div>
      <div style="font-size: 14px;">Need ${cost} coins for ${hintType}</div>
    `;
    notification.style.cssText = `
      position: fixed;
      bottom: 100px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(220, 38, 38, 0.9);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      text-align: center;
      z-index: 10000;
      animation: slideInUp 0.3s ease-out;
      pointer-events: none;
    `;
    
    // Add animation keyframes if not already present
    if (!document.getElementById('insufficient-funds-styles')) {
      const style = document.createElement('style');
      style.id = 'insufficient-funds-styles';
      style.textContent = `
        @keyframes slideInUp {
          from {
            transform: translateX(-50%) translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
          }
        }
      `;
      document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Remove after 2 seconds
    setTimeout(() => {
      notification.remove();
    }, 2000);
  }
  
  
  /**
   * Reveals a random letter from an unfound word
   */
  public async revealRandomLetter(): Promise<boolean> {
    // Check if user has hints
    const inventory = this.hintService.getInventory();
    const coinBalance = this.coinStorageService.getCachedBalance();
    
    // If no hints, show purchase UI
    if (inventory.revealHints === 0) {
      this.hintPurchaseUI.show({
        type: 'reveal',
        icon: '💡',
        name: 'Reveal Letter Hint',
        description: 'Reveals a random letter from an unfound word, helping you progress when stuck.',
        cost: 50,
        currentBalance: coinBalance,
        onPurchase: async (quantity) => {
          const totalCost = quantity * 50;
          
          // Reload balance from server to ensure it's current
          await this.coinStorageService.loadCoins();
          const currentBalance = this.coinStorageService.getCachedBalance();
          
          console.log(`Purchase attempt: ${quantity} hints for ${totalCost} coins. Balance: ${currentBalance}`);
          
          if (currentBalance < totalCost) {
            console.log(`Insufficient funds: ${currentBalance} < ${totalCost}`);
            return false;
          }
          
          // Deduct coins on server and add hints
          const spendRes = await this.coinStorageService.spendCoins(totalCost);
          if (!spendRes.success) {
            console.log(`Server rejected purchase. New balance: ${spendRes.balance}`);
            // Update cached balance with server's response
            this.coinStorageService.clearCache();
            await this.coinStorageService.loadCoins();
            this.updateCoinDisplay();
            return false;
          }
          
          this.hintService.addHints(quantity, 0);
          await this.hintStorageService.addHints('reveal', quantity);
          
          // Update displays
          this.updateCoinDisplay();
          this.updateHintDisplay();
          
          return true;
        }
      });
      return false;
    }
    
    // First, load the latest inventory from server to ensure sync (force refresh)
    const serverInventory = await this.hintStorageService.loadHints(true);
    this.hintService.loadInventory(serverInventory);
    
    const beforeCoins = this.coinStorageService.getCachedBalance();
    
    console.log('Before using hint:', {
      revealHints: serverInventory.revealHints,
      targetHints: serverInventory.targetHints,
      coins: beforeCoins
    });
    
    // Can only use hints from inventory, not directly with coins
    if (serverInventory.revealHints <= 0) {
      console.log('No reveal hints available on server');
      return false;
    }
    
    // Find all unsolved cells from unfound words FIRST
    // (before using the hint, to ensure we can actually reveal something)
    const unsolvedCells: Array<{cell: HexCell, word: WordObject}> = [];
    
    this.placedWords.forEach(word => {
      // Skip if word is already found
      if (this.foundWords.has(word.word)) {
        return;
      }
      
      // Check each cell in the word
      word.cells.forEach(cell => {
        const key = `${cell.q},${cell.r}`;
        if (!this.solvedCells.has(key)) {
          unsolvedCells.push({ cell, word });
        }
      });
    });
    
    // No cells to reveal
    if (unsolvedCells.length === 0) {
      return false;
    }
    
    // Pick a random unsolved cell
    const randomIndex = Math.floor(Math.random() * unsolvedCells.length);
    const { cell, word } = unsolvedCells[randomIndex];
    const key = `${cell.q},${cell.r}`;
    
    // Now try to use the hint on the server
    try {
      await this.hintStorageService.useHint('reveal');
      // Update local inventory to match server
      const updatedInventory = await this.hintStorageService.loadHints();
      this.hintService.loadInventory(updatedInventory);
      
      console.log('Reveal hint used successfully. New inventory:', {
        revealHints: updatedInventory.revealHints,
        targetHints: updatedInventory.targetHints
      });
      
      // Only reveal the cell if hint was successfully used
      this.solvedCells.add(key);
      
      // Apply hint penalty to score
      this.scoreService.useHint('letter');
      this.updateScoreDisplay();
      
      // Trigger reveal animation
      this.animationService.triggerRevealAnimation(key);
      
      // Update hint display
      this.updateHintDisplay();
      
      // Re-render to show the revealed letter
      this.render();
      
      // Check if this completes any word
      this.checkForCompletedWords();
      
      // Save progress
      this.saveProgress();
      
      return true;
    } catch (error) {
      console.error('Failed to use reveal hint - not enough hints:', error);
      // Reload inventory from server to ensure we're in sync
      const latestInventory = await this.hintStorageService.loadHints();
      this.hintService.loadInventory(latestInventory);
      this.updateHintDisplay();
      // Log that no hints are available
      console.log('No reveal hints available!');
      return false;
    }
  }
  
  /**
   * Checks if any words are now complete after revealing a letter
   */
  /**
   * Starts target hint mode - player selects a cell to reveal
   */
  public async startTargetHint(): Promise<void> {
    // Toggle target hint mode
    if (this.isTargetHintMode) {
      // Exit target hint mode
      this.isTargetHintMode = false;
      this.removeTargetHintOverlay();
      this.render();
    } else {
      // First, sync with server to get latest inventory (force refresh)
      const serverInventory = await this.hintStorageService.loadHints(true);
      this.hintService.loadInventory(serverInventory);
      this.updateHintDisplay();
      
      const coinBalance = this.coinStorageService.getCachedBalance();
      
      console.log('Starting target hint mode. Server inventory:', {
        targetHints: serverInventory.targetHints,
        revealHints: serverInventory.revealHints
      });
      
      // If no hints, show purchase UI
      if (serverInventory.targetHints === 0) {
        this.hintPurchaseUI.show({
          type: 'target',
          icon: '🎯',
          name: 'Target Hint',
          description: 'Tap any cell to reveal its letter. Perfect for uncovering specific letters you need.',
          cost: 100,
          currentBalance: coinBalance,
          onPurchase: async (quantity) => {
            const totalCost = quantity * 100;
            
            // Reload balance from server to ensure it's current
            await this.coinStorageService.loadCoins();
            const currentBalance = this.coinStorageService.getCachedBalance();
            
            console.log(`Purchase attempt: ${quantity} target hints for ${totalCost} coins. Balance: ${currentBalance}`);
            
            if (currentBalance < totalCost) {
              console.log(`Insufficient funds: ${currentBalance} < ${totalCost}`);
              return false;
            }
            
            // Deduct coins on server and add hints
            const spendRes = await this.coinStorageService.spendCoins(totalCost);
            if (!spendRes.success) {
              console.log(`Server rejected purchase. New balance: ${spendRes.balance}`);
              // Update cached balance with server's response
              this.coinStorageService.clearCache();
              await this.coinStorageService.loadCoins();
              this.updateCoinDisplay();
              return false;
            }
            
            this.hintService.addHints(0, quantity);
            await this.hintStorageService.addHints('target', quantity);
            
            // Update displays
            this.updateCoinDisplay();
            this.updateHintDisplay();
            
            return true;
          }
        });
        return;
      }
      
      // Check if user can use target hint
      const hintCheck = this.hintService.canUseTargetHint(coinBalance);
      
      if (!hintCheck.canUse) {
        // Not enough coins (shouldn't happen since we have hints)
        return;
      }
      
      // Enter target hint mode
      this.isTargetHintMode = true;
      this.createTargetHintOverlay();
      this.render();
    }
  }
  
  /**
   * Creates the blur overlay for target hint mode
   */
  private createTargetHintOverlay(): void {
    // Remove any existing overlay
    this.removeTargetHintOverlay();
    
    // Create full-screen dark overlay
    const overlay = document.createElement('div');
    overlay.id = 'target-hint-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      z-index: 1000;
      transition: opacity 0.3s ease;
      pointer-events: none;
    `;
    
    // Create instruction text
    const instruction = document.createElement('div');
    instruction.id = 'target-hint-instruction';
    instruction.style.cssText = `
      position: fixed;
      bottom: 10%;
      left: 50%;
      transform: translateX(-50%);
      color: white;
      font-size: 18px;
      font-weight: 600;
      text-align: center;
      z-index: 1002;
      padding: 10px 20px;
      background: rgba(42, 52, 70, 0.9);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      pointer-events: none;
    `;
    instruction.textContent = 'Tap an empty cell to reveal letter';
    
    // Hide all UI elements except the target button
    const gameUI = document.getElementById('game-ui-overlay');
    if (gameUI) {
      Array.from(gameUI.children).forEach(child => {
        const el = child as HTMLElement;
        if (child.id !== 'hw-target-btn') {
          (el as any).__originalVisibility = el.style.visibility;
          el.style.visibility = 'hidden';
        }
      });
    }
    
    // Ensure canvas container is above overlay
    const canvasContainer = this.canvas?.parentElement;
    if (canvasContainer) {
      (canvasContainer as any).__originalZIndex = canvasContainer.style.zIndex;
      (canvasContainer as any).__originalPosition = canvasContainer.style.position;
      canvasContainer.style.position = 'relative';
      canvasContainer.style.zIndex = '1001';
    }
    
    // Move target button to body to ensure it's above everything
    const targetBtn = document.getElementById('hw-target-btn');
    if (targetBtn && targetBtn.parentElement) {
      // Store original parent
      (targetBtn as any).__originalParent = targetBtn.parentElement;
      (targetBtn as any).__originalZIndex = targetBtn.style.zIndex;
      (targetBtn as any).__originalPointerEvents = targetBtn.style.pointerEvents;
      
      // Move to body with high z-index
      document.body.appendChild(targetBtn);
      targetBtn.style.zIndex = '10000';
      targetBtn.style.visibility = 'visible';
      targetBtn.style.pointerEvents = 'auto';
    }
    
    // Append elements
    document.body.appendChild(overlay);
    document.body.appendChild(instruction);
    
    // Store references
    this.targetHintOverlay = overlay;
    this.targetHintInstruction = instruction;
  }
  
  /**
   * Removes the target hint overlay
   */
  private removeTargetHintOverlay(): void {
    // Restore UI elements
    const gameUI = document.getElementById('game-ui-overlay');
    if (gameUI) {
      // Show all children again
      Array.from(gameUI.children).forEach(child => {
        const el = child as HTMLElement;
        const originalVisibility = (el as any).__originalVisibility;
        el.style.visibility = originalVisibility || '';
        delete (el as any).__originalVisibility;
      });
    }
    
    // Reset canvas container z-index
    const canvasContainer = this.canvas?.parentElement;
    if (canvasContainer) {
      const originalZIndex = (canvasContainer as any).__originalZIndex;
      const originalPosition = (canvasContainer as any).__originalPosition;
      canvasContainer.style.zIndex = originalZIndex || '';
      canvasContainer.style.position = originalPosition || '';
      delete (canvasContainer as any).__originalZIndex;
      delete (canvasContainer as any).__originalPosition;
    }
    
    // Restore target button to original parent
    const targetBtn = document.getElementById('hw-target-btn');
    if (targetBtn) {
      const originalParent = (targetBtn as any).__originalParent;
      const originalZIndex = (targetBtn as any).__originalZIndex;
      const originalPointerEvents = (targetBtn as any).__originalPointerEvents;
      
      // Move back to original parent if it was moved
      if (originalParent && targetBtn.parentElement === document.body) {
        originalParent.appendChild(targetBtn);
      }
      
      targetBtn.style.zIndex = originalZIndex || '';
      targetBtn.style.pointerEvents = originalPointerEvents || '';
      targetBtn.style.visibility = '';
      
      delete (targetBtn as any).__originalParent;
      delete (targetBtn as any).__originalZIndex;
      delete (targetBtn as any).__originalPointerEvents;
    }
    
    // Remove overlay with fade
    if (this.targetHintOverlay) {
      this.targetHintOverlay.style.opacity = '0';
      setTimeout(() => {
        this.targetHintOverlay?.remove();
        this.targetHintOverlay = null;
      }, 300);
    }
    
    // Remove instruction with fade
    if (this.targetHintInstruction) {
      this.targetHintInstruction.style.opacity = '0';
      setTimeout(() => {
        this.targetHintInstruction?.remove();
        this.targetHintInstruction = null;
      }, 300);
    }
  }
  
  private isProcessingHint: boolean = false;  // Guard flag to prevent double-processing
  
  /**
   * Handles cell click in target hint mode
   */
  private async handleTargetHintClick(x: number, y: number): Promise<void> {
    if (!this.isTargetHintMode) return;
    
    // Prevent double-processing
    if (this.isProcessingHint) {
      console.log('Already processing a hint, ignoring click');
      return;
    }
    this.isProcessingHint = true;
    
    try {
      // First, load the latest inventory from server to ensure sync (force refresh)
      const serverInventory = await this.hintStorageService.loadHints(true);
      this.hintService.loadInventory(serverInventory);
      
      console.log('Target hint click - server inventory:', {
        revealHints: serverInventory.revealHints,
        targetHints: serverInventory.targetHints
      });
      
      // Check if we have target hints
      if (serverInventory.targetHints <= 0) {
        console.log('No target hints available on server');
        this.isTargetHintMode = false;
        this.removeTargetHintOverlay();
        this.render();
        this.isProcessingHint = false;  // Reset flag
        return;
      }
    } finally {
      // Ensure flag is reset even if there's an error above
      if (!this.isTargetHintMode) {
        this.isProcessingHint = false;
      }
    }
    
    // Get canvas dimensions
    const rect = this.canvas.getBoundingClientRect();
    
    // Get layout for grid position
    const layout = this.calculateLayout(rect.width, rect.height);
    
    // Calculate the offset used by the renderer (same as in renderGrid)
    const bounds = this.renderer.calculateBounds(this.board);
    const offset = this.renderer.calculateCenterOffset(bounds);
    
    // Find clicked cell
    let clickedCell: HexCell | null = null;
    let minDistance = Infinity;
    
    this.board.forEach(cell => {
      if (!cell.letter) return;
      
      // Get hex position relative to origin
      const pos = this.renderer.getHexPosition(cell.q, cell.r);
      
      // Calculate actual screen position matching renderHexCell
      // renderHexCell uses: hex.x + (centerX + offset.x)
      const hexCenterX = pos.x + layout.gridCenterX + offset.x;
      const hexCenterY = pos.y + layout.gridCenterY + offset.y;
      
      // Calculate distance from click to hex center
      const distance = Math.sqrt(Math.pow(x - hexCenterX, 2) + Math.pow(y - hexCenterY, 2));
      
      // Check if click is within hex bounds
      if (distance < layout.hexSize) {
        if (distance < minDistance) {
          minDistance = distance;
          clickedCell = cell;
        }
      }
    });
    
    if (clickedCell) {
      const key = `${clickedCell.q},${clickedCell.r}`;
      
      // Check if cell is already solved
      if (this.solvedCells.has(key)) {
        // Cell already revealed, just exit target hint mode
        this.isTargetHintMode = false;
        this.removeTargetHintOverlay();
        this.render();
        return;
      }
      
      // First, try to use hint from inventory on the server
      try {
        await this.hintStorageService.useHint('target');
        // Update local inventory to match server
        const updatedInventory = await this.hintStorageService.loadHints();
        this.hintService.loadInventory(updatedInventory);
        console.log('Target hint used successfully. New inventory:', updatedInventory);
        
        // Only reveal the cell if hint was successfully used
        this.solvedCells.add(key);
        
        // Apply hint penalty for target hint
        this.scoreService.useHint('position');
        this.updateScoreDisplay();
        
        // Trigger reveal animation
        this.animationService.triggerRevealAnimation(key);
      } catch (error) {
        console.error('Failed to use target hint - not enough hints:', error);
        // Reload inventory from server to ensure we're in sync (force refresh)
        try {
          const latestInventory = await this.hintStorageService.loadHints(true);
          this.hintService.loadInventory(latestInventory);
          this.updateHintDisplay();
        } catch (e) {
          console.error('Failed to reload inventory:', e);
        }
        // Exit target hint mode
        this.isTargetHintMode = false;
        this.removeTargetHintOverlay();
        this.render();
        // Log that no hints are available
        console.log('No target hints available!');
        // Reset processing flag
        this.isProcessingHint = false;
        return;
      }
      
      // Update hint display
      this.updateHintDisplay();
      
      // Exit target hint mode
      this.isTargetHintMode = false;
      this.removeTargetHintOverlay();
      
      // Re-render
      this.render();
      
      // Check if this completes any word
      this.checkForCompletedWords();
      
      // Save progress
      this.saveProgress();
      
      // Reset processing flag
      this.isProcessingHint = false;
    }
  }
  
  private checkForCompletedWords(): void {
    this.placedWords.forEach(word => {
      if (this.foundWords.has(word.word)) {
        return; // Already found
      }
      
      // Check if all cells in this word are solved
      const isComplete = word.cells.every(cell => {
        const key = `${cell.q},${cell.r}`;
        return this.solvedCells.has(key);
      });
      
      if (isComplete) {
        this.foundWords.add(word.word);
        
        // Remove letters from input grid that are no longer needed
        const rect = this.canvas.getBoundingClientRect();
        const layout = this.calculateLayout(rect.width, rect.height);
        
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
        
        // Calculate score (no time bonus since it was found through hints)
        const hasIntersections = word.cells.some(cell => {
          const key = `${cell.q},${cell.r}`;
          const hexCell = this.board.get(key);
          return hexCell && hexCell.wordIds && hexCell.wordIds.length > 1;
        });
        
        // Score the word with a large time penalty (as if it took a long time)
        const points = this.scoreService.scoreWord(
          word.word,
          hasIntersections,
          60000 // 60 seconds - no time bonus for hint-revealed words
        );
        
        // No coin rewards during gameplay - only at level completion
        
        // Update displays
        this.updateScoreDisplay();
        
        // Save progress
        this.saveProgress();
        
        // Call the onWordFound callback if provided
        if (this.config.onWordFound) {
          this.config.onWordFound(word.word);
        }
        
        this.checkWinCondition();
      }
    });
  }

  /**
   * Check if the player has won and trigger level completion
   */
  private checkWinCondition(): void {
    this.checkLevelCompletion();
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
    // Attempt to restore saved progress for this level
    await this.loadSavedProgress();
    this.render();
    // Only play intro if there is no saved progress to restore
    const hasProgress = this.foundWords.size > 0 || this.solvedCells.size > 0;
    if (!hasProgress) {
      await this.playLevelIntro();
    }
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
  
  /**
   * Loads saved progress for the current level
   */
  private async loadSavedProgress(): Promise<void> {
    try {
      const progress = await this.levelProgressService.loadProgress(this.currentLevel);
      
      if (!progress) {
        return; // No saved progress
      }
      
      // Restore found words
      progress.foundWords.forEach(word => {
        this.foundWords.add(word);
        // Mark all cells of this word as solved
        const wordObj = this.placedWords.find(w => w.word === word);
        if (wordObj) {
          wordObj.cells.forEach(cell => {
            const key = `${cell.q},${cell.r}`;
            this.solvedCells.add(key);
          });
        }
      });
      
      // Restore revealed cells
      progress.revealedCells.forEach(cellKey => {
        this.solvedCells.add(cellKey);
      });
      
      // Restore selected cells
      this.selectedCells = [];
      progress.selectedCells.forEach(cellKey => {
        const [q, r] = cellKey.split(',').map(Number);
        const cell = this.board.get(cellKey);
        if (cell) {
          this.selectedCells.push(cell);
        }
      });
      
      // Restore score state
      if (progress.scoreState) {
        this.scoreService.loadState({
          levelScore: progress.scoreState.levelScore,
          currentScore: progress.scoreState.currentScore || this.scoreService.getState().currentScore,
          hintsUsed: progress.scoreState.hintsUsed,
          firstWordFound: progress.foundWords.length > 0,
          timeStarted: progress.scoreState.timeStarted
        });
      }
      
      console.log(`Loaded progress: ${progress.foundWords.length} words, ${progress.revealedCells.length} revealed cells`);
    } catch (error) {
      console.error('Failed to load saved progress:', error);
    }
  }
  
  /**
   * Saves current progress
   */
  private saveProgress(): void {
    // Ensure selectedCells is initialized
    if (!this.selectedCells) {
      this.selectedCells = [];
    }
    
    // Get revealed cells that are not part of found words
    const revealedCells: string[] = [];
    this.solvedCells.forEach(cellKey => {
      // Check if this cell is part of a found word
      let isPartOfFoundWord = false;
      this.foundWords.forEach(word => {
        const wordObj = this.placedWords.find(w => w.word === word);
        if (wordObj) {
          const cellInWord = wordObj.cells.some(cell => `${cell.q},${cell.r}` === cellKey);
          if (cellInWord) {
            isPartOfFoundWord = true;
          }
        }
      });
      
      if (!isPartOfFoundWord) {
        revealedCells.push(cellKey);
      }
    });
    
    const scoreState = this.scoreService.getState();
    
    this.levelProgressService.updateProgress({
      level: this.currentLevel,
      foundWords: Array.from(this.foundWords),
      revealedCells,
      selectedCells: this.selectedCells.map(cell => `${cell.q},${cell.r}`),
      scoreState: {
        levelScore: scoreState.levelScore,
        currentScore: scoreState.currentScore,
        hintsUsed: scoreState.hintsUsed,
        timeStarted: scoreState.timeStarted || Date.now()
      }
    });
  }
}
