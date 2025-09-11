/**
 * CoinStorageService - Manages coin persistence and sync with server
 */

export interface CoinData {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastUpdated: number;
}

export class CoinStorageService {
  private static instance: CoinStorageService;
  private cachedData: CoinData | null = null;
  
  private constructor() {}
  
  public static getInstance(): CoinStorageService {
    if (!CoinStorageService.instance) {
      CoinStorageService.instance = new CoinStorageService();
    }
    return CoinStorageService.instance;
  }
  
  /**
   * Clear cached data to force reload from server
   */
  public clearCache(): void {
    this.cachedData = null;
  }
  
  /**
   * Load coin balance from server
   */
  public async loadCoins(): Promise<CoinData> {
    try {
      const response = await fetch('/api/coins');
      
      if (!response.ok) {
        // Return default for new users
        return {
          balance: 200,
          totalEarned: 200,
          totalSpent: 0,
          lastUpdated: Date.now()
        };
      }
      
      const data = await response.json();
      this.cachedData = data;
      return data;
    } catch (error) {
      console.error('Error loading coins:', error);
      // Return cached or default
      return this.cachedData || {
        balance: 200,
        totalEarned: 200,
        totalSpent: 0,
        lastUpdated: Date.now()
      };
    }
  }
  
  /**
   * Add coins (from rewards)
   */
  public async addCoins(amount: number): Promise<CoinData> {
    try {
      const response = await fetch('/api/coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add', amount })
      });
      
      if (!response.ok) {
        throw new Error('Failed to add coins');
      }
      
      const data = await response.json();
      this.cachedData = data;
      return data;
    } catch (error) {
      console.error('Error adding coins:', error);
      // Update cache optimistically
      if (this.cachedData) {
        this.cachedData.balance += amount;
        this.cachedData.totalEarned += amount;
      }
      return this.cachedData || {
        balance: amount,
        totalEarned: amount,
        totalSpent: 0,
        lastUpdated: Date.now()
      };
    }
  }
  
  /**
   * Spend coins (on hints)
   */
  public async spendCoins(amount: number): Promise<{ success: boolean; balance: number }> {
    try {
      const response = await fetch('/api/coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'spend', amount })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        return { 
          success: false, 
          balance: data.balance || this.cachedData?.balance || 0 
        };
      }
      
      this.cachedData = data;
      return { success: true, balance: data.balance };
    } catch (error) {
      console.error('Error spending coins:', error);
      return { 
        success: false, 
        balance: this.cachedData?.balance || 0 
      };
    }
  }
  
  /**
   * Check if user can afford something
   */
  public async canAfford(cost: number): Promise<boolean> {
    try {
      const response = await fetch('/api/coins/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cost })
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      return data.canAfford;
    } catch (error) {
      console.error('Error checking affordability:', error);
      return this.cachedData ? this.cachedData.balance >= cost : false;
    }
  }
  
  /**
   * Sync local state with server
   */
  public async syncCoins(localData: {
    balance: number;
    totalEarned: number;
    totalSpent: number;
  }): Promise<CoinData> {
    try {
      const response = await fetch('/api/coins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'set',
          ...localData
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to sync coins');
      }
      
      const data = await response.json();
      this.cachedData = data;
      return data;
    } catch (error) {
      console.error('Error syncing coins:', error);
      return this.cachedData || {
        ...localData,
        lastUpdated: Date.now()
      };
    }
  }
  
  /**
   * Get cached balance (for quick display)
   */
  public getCachedBalance(): number {
    return this.cachedData?.balance || 0;
  }
}