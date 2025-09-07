import { CrosswordGenerator } from './services/CrosswordGenerator';
import { HexRenderer } from './engine/HexRenderer';
import { InputHexGrid } from './components/InputHexGrid';
import { HexCell, WordObject } from '../shared/types/hexaword';
import { createRNG } from '../shared/utils/rng';

export interface GameConfig {
  containerId: string;
  words?: string[];
  seed?: string;
  gridRadius?: number;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export class HexaWordGame {
  private container: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private generator: CrosswordGenerator;
  private renderer: HexRenderer;
  private inputGrid: InputHexGrid;
  
  private board: Map<string, HexCell> = new Map();
  private placedWords: WordObject[] = [];
  private isInitialized: boolean = false;
  
  // Default word list (will be replaced by server data)
  private defaultWords = [
    'FOE', 'REF', 'GIG', 'RIG', 'FIG', 
    'FIRE', 'FROG', 'RIFE', 'FORE', 'OGRE', 
    'GORE', 'FORGE', 'GORGE', 'GRIEF', 'FOGGIER'
  ];
  
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
      
      // Generate initial crossword
      await this.generateCrossword();
      
      // Setup event handlers
      this.setupEventHandlers();
      
      // Mark as initialized
      this.isInitialized = true;
      
      // Initial render
      this.render();
      
      // Notify ready
      if (this.config.onReady) {
        this.config.onReady();
      }
    } catch (error) {
      console.error('Failed to initialize game:', error);
      if (this.config.onError) {
        this.config.onError(error as Error);
      }
    }
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
    // Build a set of unique letters present in the placed crossword
    const uniqueLetters = new Set<string>();
    
    // Collect all unique letters from the puzzle
    this.board.forEach(cell => {
      if (cell.letter) {
        uniqueLetters.add(cell.letter.toUpperCase());
      }
    });

    // Convert to array and sort alphabetically for consistency
    let letters = Array.from(uniqueLetters).sort();

    // Optionally shuffle for gameplay (but keep all unique letters)
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

    // Set the exact letters needed - no more, no less
    const gridLetters = letters.join('');
    this.inputGrid.setLetters(gridLetters);
    
    console.log(`Input grid populated with ${letters.length} unique letters: ${gridLetters}`);
    console.log(`Letters needed for puzzle: ${Array.from(uniqueLetters).sort().join(', ')}`);
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
    
    // Render main grid
    this.renderer.renderGrid(
      this.board,
      layout.gridCenterX,
      layout.gridCenterY
    );
    
    // Render input grid
    this.inputGrid.render(
      layout.inputCenterX,
      layout.inputCenterY,
      layout.inputHexSize
    );
    
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
      inputCenterX: canvasWidth / 2,
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
    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // TODO: Implement hex selection logic
    console.log(`Click at (${x}, ${y})`);
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
}
