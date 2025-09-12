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
  public async loadHints(forceRefresh: boolean = false): Promise<HintInventory> {
    try {
      // Clear cache if force refresh is requested
      if (forceRefresh) {
        this.cachedInventory = null;
      }
      
      const response = await fetch('/api/hints', {
        cache: forceRefresh ? 'no-cache' : 'default'
      });
      
      if (!response.ok) {
        // Return default for new users (matches server defaults)
        return {
          revealHints: 2,
          targetHints: 2,
          freeReveals: 0,
          freeTargets: 0,
          lastUpdated: Date.now()
        };
      }
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();
      this.cachedInventory = data;
      return data;
    } catch (error) {
      console.error('Error loading hints:', error);
      // Only return cached if not force refresh
      if (!forceRefresh && this.cachedInventory) {
        return this.cachedInventory;
      }
      // Return default (matches server defaults)
      return {
        revealHints: 2,
        targetHints: 2,
        freeReveals: 0,
        freeTargets: 0,
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
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();
      this.cachedInventory = data;
      return data;
    } catch (error) {
      console.error('Error using hint:', error);
      // DO NOT update cache on error - the server rejected the request
      // Just re-throw the error so the caller knows it failed
      throw error;
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
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
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
        revealHints: 5,
        targetHints: 3,
        freeReveals: 5,
        freeTargets: 3,
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
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
      }
      
      const data = await response.json();
      this.cachedInventory = data;
      return data;
    } catch (error) {
      console.error('Error syncing hints:', error);
      return this.cachedInventory || {
        ...inventory,
        freeReveals: 5,
        freeTargets: 3,
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
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response');
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