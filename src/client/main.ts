import { HexaWordGame } from '../web-view/HexaWordGame';
import { fetchGameDataWithFallback } from './services/api';

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
    // Force dark background at runtime to override host styles
    try {
      document.documentElement.style.setProperty('background-color', '#141514', 'important');
      document.body.style.setProperty('background-color', '#141514', 'important');
      document.body.style.setProperty('background', '#141514', 'important');
      const container = document.getElementById('hex-grid-container');
      if (container) {
        (container as HTMLElement).style.setProperty('background-color', '#141514', 'important');
        (container as HTMLElement).style.setProperty('background', '#141514', 'important');
      }
    } catch {}
    
    // Fetch game data with automatic fallback
    const gameData = await fetchGameDataWithFallback();
    
    // Force uncommon occupations theme words
    const occupationWords = [
      'GOLFER', 'ATHLETE', 'CAPTAIN', 'PAINTER', 'DESIGNER',
      'DIRECTOR', 'MAGICIAN', 'MUSICIAN', 'BALLERINA', 'PLAYWRIGHT'
    ];
    
    console.log(`Starting game with seed: ${gameData.seed}, words: ${occupationWords.length}`);
    
    // Create game instance with occupations theme
    this.game = new HexaWordGame({
      containerId: 'hex-grid-container',
      words: occupationWords,  // Use occupation words instead of API words
      clue: 'UNCOMMON OCCUPATIONS',  // Clue for occupations theme
      seed: gameData.seed,
      gridRadius: 10,
      level: 1,  // Start at level 1
      theme: 'dark',  // Default to dark theme
      onReady: () => {
        console.log('Game ready with seed:', gameData.seed);
        this.setupUI();
        
        // Show non-blocking toast if using fallback
        if (gameData.postId === 'local') {
          this.showToast('Playing in offline mode', 'info');
        }
      },
      onError: (error) => {
        console.error('Game error:', error);
        this.showError(error.message);
      }
    });
  }
  
  /**
   * Shows a non-blocking toast notification
   */
  private showToast(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: ${type === 'error' ? '#ff4444' : type === 'warning' ? '#ff8800' : '#4444ff'};
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      z-index: 9999;
      animation: slideUp 0.3s ease-out;
    `;
    toast.textContent = message;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUp {
        from { transform: translateX(-50%) translateY(100%); opacity: 0; }
        to { transform: translateX(-50%) translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(toast);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideUp 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
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
      <div style="margin-top: 10px;">
        <label>Level: </label>
        <select id="level-select" style="margin-right: 10px;">
          <option value="1">Level 1 - Blue</option>
          <option value="2">Level 2 - Purple</option>
          <option value="3">Level 3 - Teal</option>
          <option value="4">Level 4 - Green</option>
          <option value="5">Level 5 - Red</option>
        </select>
        <button id="btn-toggle-theme">Toggle Theme</button>
      </div>
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
    
    // Level selection
    document.getElementById('level-select')?.addEventListener('change', async (e) => {
      const level = parseInt((e.target as HTMLSelectElement).value);
      await this.game?.setLevel(level);
    });
    
    // Theme toggle
    document.getElementById('btn-toggle-theme')?.addEventListener('click', async () => {
      await this.game?.toggleTheme();
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
