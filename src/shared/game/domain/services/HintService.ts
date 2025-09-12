/**
 * HintService - Manages hint inventory and costs
 */

export interface HintInventory {
  revealHints: number;    // Number of reveal letter hints
  targetHints: number;    // Number of target hints
  freeReveals: number;    // Free reveals given to new users
  freeTargets: number;    // Free targets given to new users
}

export interface HintCosts {
  revealCost: number;     // Cost in coins for reveal hint
  targetCost: number;     // Cost in coins for target hint
}

export class HintService {
  private static readonly DEFAULT_COSTS: HintCosts = {
    revealCost: 50,       // 50 coins for reveal letter hint
    targetCost: 100       // 100 coins for target hint
  };

  private static readonly INITIAL_FREE_HINTS = {
    revealHints: 5,       // 5 free reveal hints for new users
    targetHints: 3        // 3 free target hints for new users
  };

  private inventory: HintInventory;
  private costs: HintCosts;

  constructor(initialInventory?: Partial<HintInventory>) {
    this.costs = HintService.DEFAULT_COSTS;
    this.inventory = {
      revealHints: initialInventory?.revealHints ?? HintService.INITIAL_FREE_HINTS.revealHints,
      targetHints: initialInventory?.targetHints ?? HintService.INITIAL_FREE_HINTS.targetHints,
      freeReveals: initialInventory?.freeReveals ?? HintService.INITIAL_FREE_HINTS.revealHints,
      freeTargets: initialInventory?.freeTargets ?? HintService.INITIAL_FREE_HINTS.targetHints
    };
  }

  /**
   * Check if user can use a reveal hint
   */
  public canUseRevealHint(coinBalance: number): { canUse: boolean; needCoins: boolean; cost: number } {
    if (this.inventory.revealHints > 0) {
      return { canUse: true, needCoins: false, cost: 0 };
    }
    
    const canAfford = coinBalance >= this.costs.revealCost;
    return { 
      canUse: canAfford, 
      needCoins: true, 
      cost: this.costs.revealCost 
    };
  }

  /**
   * Check if user can use a target hint
   */
  public canUseTargetHint(coinBalance: number): { canUse: boolean; needCoins: boolean; cost: number } {
    if (this.inventory.targetHints > 0) {
      return { canUse: true, needCoins: false, cost: 0 };
    }
    
    const canAfford = coinBalance >= this.costs.targetCost;
    return { 
      canUse: canAfford, 
      needCoins: true, 
      cost: this.costs.targetCost 
    };
  }

  /**
   * Use a reveal hint
   */
  public useRevealHint(coinBalance: number): { success: boolean; cost: number; remaining: number } {
    const check = this.canUseRevealHint(coinBalance);
    
    if (!check.canUse) {
      return { success: false, cost: 0, remaining: this.inventory.revealHints };
    }

    if (this.inventory.revealHints > 0) {
      this.inventory.revealHints--;
      return { success: true, cost: 0, remaining: this.inventory.revealHints };
    }

    // User is paying with coins
    return { success: true, cost: this.costs.revealCost, remaining: 0 };
  }

  /**
   * Use a target hint
   */
  public useTargetHint(coinBalance: number): { success: boolean; cost: number; remaining: number } {
    const check = this.canUseTargetHint(coinBalance);
    
    if (!check.canUse) {
      return { success: false, cost: 0, remaining: this.inventory.targetHints };
    }

    if (this.inventory.targetHints > 0) {
      this.inventory.targetHints--;
      return { success: true, cost: 0, remaining: this.inventory.targetHints };
    }

    // User is paying with coins
    return { success: true, cost: this.costs.targetCost, remaining: 0 };
  }

  /**
   * Add hints to inventory (from purchases or rewards)
   */
  public addHints(revealCount: number = 0, targetCount: number = 0): void {
    this.inventory.revealHints += revealCount;
    this.inventory.targetHints += targetCount;
  }

  /**
   * Get current inventory
   */
  public getInventory(): HintInventory {
    return { ...this.inventory };
  }

  /**
   * Get hint costs
   */
  public getCosts(): HintCosts {
    return { ...this.costs };
  }

  /**
   * Reset to initial state (for new users)
   */
  public reset(): void {
    this.inventory = {
      revealHints: HintService.INITIAL_FREE_HINTS.revealHints,
      targetHints: HintService.INITIAL_FREE_HINTS.targetHints,
      freeReveals: HintService.INITIAL_FREE_HINTS.revealHints,
      freeTargets: HintService.INITIAL_FREE_HINTS.targetHints
    };
  }

  /**
   * Load inventory from saved state
   */
  public loadInventory(saved: HintInventory): void {
    this.inventory = { ...saved };
  }
}