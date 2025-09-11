/**
 * HintStorageService - Manages hint persistence and sync with server
 */

export interface HintInventory {
  revealHints: number;
  targetHints: number;
  freeReveals: number;
  freeTargets: number;
  lastUpdated: number;
}

export class HintStorageService {
  private static instance: HintStorageService;
  private cachedInventory: HintInventory | null = null;
  
  private constructor() {}
  
  public static getInstance(): HintStorageService {
    if (!HintStorageService.instance) {
      HintStorageService.instance = new HintStorageService();
    }
    return HintStorageService.instance;
  }
  
  /**
   * Clear cached data to force reload from server
   */
  public clearCache(): void {
    this.cachedInventory = null;
  }
  
  /**
   * Load hint inventory from server
   */
  public async loadHints(): Promise<HintInventory> {
    try {
      const response = await fetch('/api/hints');
      
      if (!response.ok) {
        // Return default for new users
        return {
          revealHints: 4,
          targetHints: 4,
          freeReveals: 4,
          freeTargets: 4,
          lastUpdated: Date.now()
        };
      }
      
      const data = await response.json();
      this.cachedInventory = data;
      return data;
    } catch (error) {
      console.error('Error loading hints:', error);
      // Return cached or default
      return this.cachedInventory || {
        revealHints: 4,
        targetHints: 4,
        freeReveals: 4,
        freeTargets: 4,
        lastUpdated: Date.now()
      };
    }
  }
  
  /**
   * Use a hint
   */
  public async useHint(type: 'reveal' | 'target'): Promise<HintInventory> {
    try {
      const response = await fetch('/api/hints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'use', hintType: type })
      });
      
      if (!response.ok) {
        throw new Error('Failed to use hint');
      }
      
      const data = await response.json();
      this.cachedInventory = data;
      return data;
    } catch (error) {
      console.error('Error using hint:', error);
      // Update cache optimistically
      if (this.cachedInventory) {
        if (type === 'reveal' && this.cachedInventory.revealHints > 0) {
          this.cachedInventory.revealHints--;
        } else if (type === 'target' && this.cachedInventory.targetHints > 0) {
          this.cachedInventory.targetHints--;
        }
      }
      return this.cachedInventory || {
        revealHints: 4,
        targetHints: 4,
        freeReveals: 4,
        freeTargets: 4,
        lastUpdated: Date.now()
      };
    }
  }
  
  /**
   * Add hints (from purchases)
   */
  public async addHints(type: 'reveal' | 'target', count: number): Promise<HintInventory> {
    try {
      const response = await fetch('/api/hints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', hintType: type, count })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add hints');
      }
      
      const data = await response.json();
      this.cachedInventory = data;
      return data;
    } catch (error) {
      console.error('Error adding hints:', error);
      // Update cache optimistically
      if (this.cachedInventory) {
        if (type === 'reveal') {
          this.cachedInventory.revealHints += count;
        } else if (type === 'target') {
          this.cachedInventory.targetHints += count;
        }
      }
      return this.cachedInventory || {
        revealHints: 4,
        targetHints: 4,
        freeReveals: 4,
        freeTargets: 4,
        lastUpdated: Date.now()
      };
    }
  }
  
  /**
   * Sync local state with server
   */
  public async syncInventory(inventory: {
    revealHints: number;
    targetHints: number;
  }): Promise<HintInventory> {
    try {
      const response = await fetch('/api/hints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'set',
          ...inventory
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to sync hints');
      }
      
      const data = await response.json();
      this.cachedInventory = data;
      return data;
    } catch (error) {
      console.error('Error syncing hints:', error);
      return this.cachedInventory || {
        ...inventory,
        freeReveals: 4,
        freeTargets: 4,
        lastUpdated: Date.now()
      };
    }
  }
  
  /**
   * Reset hints (for new game)
   */
  public async resetHints(): Promise<HintInventory> {
    try {
      const response = await fetch('/api/hints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' })
      });
      
      if (!response.ok) {
        throw new Error('Failed to reset hints');
      }
      
      const data = await response.json();
      this.cachedInventory = data;
      return data;
    } catch (error) {
      console.error('Error resetting hints:', error);
      return {
        revealHints: 4,
        targetHints: 4,
        freeReveals: 4,
        freeTargets: 4,
        lastUpdated: Date.now()
      };
    }
  }
  
  /**
   * Get cached inventory (for quick display)
   */
  public getCachedInventory(): HintInventory | null {
    return this.cachedInventory;
  }
}