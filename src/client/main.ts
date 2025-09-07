import { HexaWordGame } from '../web-view/HexaWordGame';

console.log('HexaWord Crossword Generator v4.0 - Modular Architecture');

/**
 * Main entry point for the HexaWord game
 */
class App {
  private game: HexaWordGame | null = null;
  
  constructor() {
    this.initialize();
  }
  
  private async initialize(): Promise<void> {
    try {
      // Initialize the game when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => this.startGame());
      } else {
        await this.startGame();
      }
    } catch (error) {
      console.error('Failed to initialize app:', error);
    }
  }
  
  private async startGame(): Promise<void> {
    console.log('Starting HexaWord game...');
    
    // Default configuration
    const defaultWords = [
      'FOE', 'REF', 'GIG', 'RIG', 'FIG', 
      'FIRE', 'FROG', 'RIFE', 'FORE', 'OGRE', 
      'GORE', 'FORGE', 'GORGE', 'GRIEF', 'FOGGIER'
    ];
    const defaultSeed = `client_${Date.now()}`;
    
    // Try to fetch from server
    let words = defaultWords;
    let seed = defaultSeed;
    
    const serverData = await this.fetchGameInitData();
    if (serverData) {
      words = serverData.words || defaultWords;
      seed = serverData.seed || defaultSeed;
      console.log(`Using server seed: ${seed}`);
    } else {
      console.log(`Using default seed: ${seed}`);
    }
    
    // Create game instance with seed
    this.game = new HexaWordGame({
      containerId: 'hex-grid-container',
      words: words,
      seed: seed,  // Pass seed for deterministic generation
      gridRadius: 10,
      onReady: () => {
        console.log('Game ready with seed:', seed);
        this.setupUI();
      },
      onError: (error) => {
        console.error('Game error:', error);
        this.showError(error.message);
      }
    });
  }
  
  /**
   * Fetches game initialization data from server
   */
  private async fetchGameInitData(): Promise<{words: string[], seed: string} | null> {
    try {
      const response = await fetch('/api/game/init');
      if (!response.ok) {
        throw new Error('Failed to fetch game data from server');
      }
      
      const data = await response.json();
      
      // Validate response has expected fields
      if (!data.seed || !Array.isArray(data.words)) {
        console.warn('Invalid server response, missing seed or words');
        return null;
      }
      
      console.log('Fetched game data from server:', {
        seed: data.seed,
        wordCount: data.words.length
      });
      
      return {
        words: data.words,
        seed: data.seed
      };
    } catch (error) {
      console.error('Failed to fetch game data, using defaults:', error);
      return null;
    }
  }
  
  /**
   * Sets up UI controls
   */
  private setupUI(): void {
    // Add debug controls if in development
    if (this.isDevelopment()) {
      this.addDebugControls();
    }
    
    // Add keyboard shortcuts
    this.setupKeyboardShortcuts();
  }
  
  /**
   * Adds debug controls
   */
  private addDebugControls(): void {
    const debugPanel = document.createElement('div');
    debugPanel.id = 'debug-panel';
    debugPanel.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 10px;
      border-radius: 5px;
      font-family: monospace;
      font-size: 12px;
      z-index: 1000;
    `;
    
    debugPanel.innerHTML = `
      <div style="margin-bottom: 10px;">Debug Controls</div>
      <button id="btn-regenerate" style="margin-right: 5px;">Regenerate</button>
      <button id="btn-toggle-debug">Toggle Debug</button>
      <div id="debug-info" style="margin-top: 10px;"></div>
    `;
    
    document.body.appendChild(debugPanel);
    
    // Add event listeners
    document.getElementById('btn-regenerate')?.addEventListener('click', () => {
      this.game?.reset();
    });
    
    document.getElementById('btn-toggle-debug')?.addEventListener('click', () => {
      const currentDebug = localStorage.getItem('hexaword_debug') === 'true';
      localStorage.setItem('hexaword_debug', (!currentDebug).toString());
      window.location.reload();
    });
    
    // Update debug info
    this.updateDebugInfo();
  }
  
  /**
   * Updates debug information
   */
  private updateDebugInfo(): void {
    const debugInfo = document.getElementById('debug-info');
    if (!debugInfo || !this.game) return;
    
    const words = this.game.getPlacedWords();
    const board = this.game.getBoard();
    
    debugInfo.innerHTML = `
      Words: ${words.length}<br>
      Cells: ${board.size}<br>
      FPS: ${this.calculateFPS()}
    `;
    
    // Update every second
    setTimeout(() => this.updateDebugInfo(), 1000);
  }
  
  /**
   * Calculates current FPS
   */
  private calculateFPS(): number {
    // Simplified FPS calculation
    return 60; // Placeholder
  }
  
  /**
   * Sets up keyboard shortcuts
   */
  private setupKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + R: Regenerate
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        this.game?.reset();
      }
      
      // Ctrl/Cmd + D: Toggle debug
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const currentDebug = localStorage.getItem('hexaword_debug') === 'true';
        localStorage.setItem('hexaword_debug', (!currentDebug).toString());
        window.location.reload();
      }
    });
  }
  
  /**
   * Shows an error message
   */
  private showError(message: string): void {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #ff4444;
      color: white;
      padding: 20px;
      border-radius: 10px;
      font-family: Arial, sans-serif;
      z-index: 10000;
    `;
    errorDiv.textContent = `Error: ${message}`;
    document.body.appendChild(errorDiv);
    
    // Remove after 5 seconds
    setTimeout(() => errorDiv.remove(), 5000);
  }
  
  /**
   * Checks if running in development mode
   */
  private isDevelopment(): boolean {
    return window.location.hostname === 'localhost' || 
           window.location.hostname === '127.0.0.1';
  }
}

// Initialize the app
new App();

// Export for potential use in other modules
export { App };