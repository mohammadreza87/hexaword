/**
 * LevelProgressService - Manages saving and loading level progress
 */

export interface LevelProgress {
  level: number;
  foundWords: string[];
  revealedCells: string[]; // Format: "q,r"
  selectedCells: string[]; // Current selection
  scoreState: {
    levelScore: number;
    hintsUsed: number;
    timeStarted: number;
  };
  timestamp: number;
}

export class LevelProgressService {
  private static instance: LevelProgressService;
  private currentProgress: LevelProgress | null = null;
  private autoSaveTimer: NodeJS.Timeout | null = null;
  private savingDisabledUntil: number = 0;
  
  private constructor() {}
  
  public static getInstance(): LevelProgressService {
    if (!LevelProgressService.instance) {
      LevelProgressService.instance = new LevelProgressService();
    }
    return LevelProgressService.instance;
  }
  
  /**
   * Loads progress for a specific level
   */
  public async loadProgress(level: number): Promise<LevelProgress | null> {
    try {
      const response = await fetch(`/api/level-progress/${level}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          // No saved progress - this is normal for new levels
          // Reset any stale in-memory progress to avoid saving old state accidentally
          this.currentProgress = null;
          return null;
        }
        throw new Error(`Failed to load progress: ${response.status}`);
      }
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();
      this.currentProgress = data;
      return data;
    } catch (error) {
      // Only log actual errors, not 404s
      if (error instanceof Error && !error.message.includes('404')) {
        console.error('Error loading level progress:', error);
      }
      // On any fetch error, clear in-memory progress to prevent stale saves
      this.currentProgress = null;
      return null;
    }
  }
  
  /**
   * Saves progress for the current level
   */
  public async saveProgress(progress: LevelProgress): Promise<boolean> {
    try {
      const response = await fetch('/api/level-progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(progress)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save progress');
      }
      
      this.currentProgress = progress;
      return true;
    } catch (error) {
      console.error('Error saving level progress:', error);
      return false;
    }
  }
  
  /**
   * Updates and saves progress (debounced)
   */
  public updateProgress(progress: Partial<LevelProgress>): void {
    // If saving has been temporarily disabled (e.g., after level completion), skip
    if (Date.now() < this.savingDisabledUntil) return;

    if (!this.currentProgress) {
      this.currentProgress = {
        level: 1,
        foundWords: [],
        revealedCells: [],
        selectedCells: [],
        scoreState: {
          levelScore: 0,
          hintsUsed: 0,
          timeStarted: Date.now()
        },
        timestamp: Date.now()
      };
    }
    
    // Update current progress
    this.currentProgress = {
      ...this.currentProgress,
      ...progress,
      timestamp: Date.now()
    };
    
    // Debounce auto-save
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setTimeout(() => {
      this.saveProgress(this.currentProgress!);
    }, 1000); // Save after 1 second of inactivity
  }
  
  /**
   * Clears progress for a level
   */
  public async clearProgress(level: number): Promise<boolean> {
    try {
      // Cancel any pending autosave to avoid race conditions re-saving stale state
      if (this.autoSaveTimer) {
        clearTimeout(this.autoSaveTimer);
        this.autoSaveTimer = null;
      }
      // Temporarily disable any new saves for a short window
      this.savingDisabledUntil = Date.now() + 5000;

      const response = await fetch(`/api/level-progress/${level}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) {
        throw new Error('Failed to clear progress');
      }
      
      if (this.currentProgress?.level === level) {
        this.currentProgress = null;
      }
      
      return true;
    } catch (error) {
      console.error('Error clearing level progress:', error);
      return false;
    }
  }
  
  /**
   * Gets current progress without fetching
   */
  public getCurrentProgress(): LevelProgress | null {
    return this.currentProgress;
  }
  
  /**
   * Force save immediately
   */
  public async forceSave(): Promise<boolean> {
    // Respect temporary disabling of saves
    if (Date.now() < this.savingDisabledUntil) {
      return true;
    }
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
    
    if (this.currentProgress) {
      return await this.saveProgress(this.currentProgress);
    }
    
    return false;
  }
}
