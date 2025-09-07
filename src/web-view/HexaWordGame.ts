import { CrosswordGenerator } from './services/CrosswordGenerator';
import { HexRenderer } from './engine/HexRenderer';
import { InputHexGrid } from './components/InputHexGrid';
import { HexCell, WordObject } from '../shared/types/hexaword';
import { createRNG } from '../shared/utils/rng';
import { AnimationService } from './services/AnimationService';
import { ColorPaletteService } from './services/ColorPaletteService';

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
  private currentLevel: number = 1;
  
  private board: Map<string, HexCell> = new Map();
  private placedWords: WordObject[] = [];
  private isInitialized: boolean = false;
  private typedWord: string = '';  // Track typed word
  private solvedCells: Set<string> = new Set();  // Track solved cells
  private foundWords: Set<string> = new Set();  // Track found words
  private levelCompleted: boolean = false;  // Ensure completion fires once per level
  private currentClue: string = '';  // Current level clue
  
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
      
      // Initial render with animation
      this.animationService.animateGameStart(() => {
        // Notify ready after animation
        if (this.config.onReady) {
          this.config.onReady();
        }
      });
      this.render();
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
    // Set canvas background explicitly and with priority
    this.canvas.style.setProperty('background-color', '#141514', 'important');
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
    
    // Shuffle for gameplay
    if (this.config.seed) {
      const rng = createRNG(this.config.seed + '_input');
      letters = rng.shuffle(letters);
    } else {
      // Random shuffle if no seed
      for (let i = letters.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [letters[i], letters[j]] = [letters[j], letters[i]];
      }
    }
    
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
    // Reassert background each render (host may mutate styles)
    this.canvas.style.setProperty('background-color', '#141514', 'important');
    
    // Fill background first
    this.ctx.fillStyle = '#141514';
    this.ctx.fillRect(0, 0, rect.width, rect.height);
    
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
    
    // Render typed word just above input grid
    if (this.typedWord) {
      this.renderTypedWord(rect.width, inputGridTop - 25);  // 25px above input grid
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
  } {
    const paddingTop = 60; // Space for title
    const inputGridHeight = 100; // Reserve space for input grid at bottom
    const paddingSide = 20;
    
    // Calculate space for main grid (leave room for input grid at bottom)
    const gridWidth = canvasWidth - (paddingSide * 2);
    const gridHeight = canvasHeight - paddingTop - inputGridHeight - 20;
    
    // Calculate dynamic hex size for main grid
    const hexSize = this.renderer.calculateDynamicHexSize(
      this.board,
      gridWidth,
      gridHeight * 0.7, // Use 70% of available height for main grid
      5,
      20
    );
    
    // Input grid settings - position at very bottom of canvas
    const inputHexSize = 20; // Larger for better visibility
    // The input grid render method now handles positioning relative to its bottom edge
    // We pass the Y coordinate where we want the bottom of the grid to be
    const inputGridY = canvasHeight - 10; // Bottom edge 10px from screen bottom
    
    return {
      hexSize,
      gridCenterX: canvasWidth / 2,
      gridCenterY: paddingTop + (gridHeight * 0.4), // Position main grid higher
      inputHexSize,
      inputCenterX: canvasWidth / 2, // Always center horizontally
      inputCenterY: inputGridY
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
    const touch = event.touches[0];
    const rect = this.canvas.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    // TODO: Implement touch handling
    console.log(`Touch at (${x}, ${y})`);
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
    
    // Animate letters jumping to PUZZLE GRID cells
    const letters = this.typedWord.split('');
    const sourcePos = { 
      x: rect.width / 2, 
      y: layout.inputCenterY - layout.inputHexSize * 4 // Position of typed text
    };
    
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
    
    // Clear typed word and selected positions immediately for animation
    this.typedWord = '';
    this.inputGrid.clearTypedWord(); // This also clears selected positions
    
    // Start the two-phase animation to puzzle grid
    this.animationService.animateCorrectWord(
      letters,
      sourcePos,
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
   * Renders the clue above the puzzle grid
   */
  private renderClue(centerX: number, centerY: number, layout: any): void {
    if (!this.currentClue) return;
    
    // Calculate the top of the puzzle grid
    const bounds = this.renderer.calculateBounds(this.board);
    const offset = this.renderer.calculateCenterOffset(bounds);
    
    // Position clue above the topmost hex with proper spacing
    const clueY = centerY + offset.y + bounds.minY - 40; // 40px above top of grid
    
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
      this.ctx.font = `${fontSize}px 'Lilita One', Arial`;
      textWidth = this.ctx.measureText(clueText).width;
      if (textWidth > maxWidth) {
        fontSize -= 1;
      }
    } while (textWidth > maxWidth && fontSize > 12);
    
    // Add subtle animation or glow effect
    this.ctx.shadowColor = '#00d9ff';
    this.ctx.shadowBlur = 2;
    
    // Draw clue text with calculated font size
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `${fontSize}px 'Lilita One', Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'bottom';
    this.ctx.fillText(clueText, centerX, clueY);
    
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
    
    this.ctx.fillStyle = '#00d9ff';
    this.ctx.font = "30px 'Lilita One', Arial";
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(this.typedWord.toUpperCase(), canvasWidth / 2, y);
    
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
      this.ctx.font = "25px 'Lilita One', Arial"; // Normal size
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
    await this.generateCrossword();
    this.inputGrid.clearLetters();
    this.render();
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
  }
}
