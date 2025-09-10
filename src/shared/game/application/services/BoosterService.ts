/**
 * BoosterService - Manages game boosters and their effects
 */

export enum BoosterType {
  SHUFFLE = 'shuffle',
  WORD_HINT = 'word_hint',
  LETTER_REVEAL = 'letter_reveal',
  TARGET_REVEAL = 'target_reveal',
  ASK_FRIENDS = 'ask_friends'
}

export interface BoosterInventory {
  [BoosterType.SHUFFLE]: number;
  [BoosterType.WORD_HINT]: number;
  [BoosterType.LETTER_REVEAL]: number;
  [BoosterType.TARGET_REVEAL]: number;
  [BoosterType.ASK_FRIENDS]: number;
}

export interface BoosterEffect {
  type: BoosterType;
  data?: any;
  timestamp: number;
}

export class BoosterService {
  private inventory: BoosterInventory;
  private usageHistory: BoosterEffect[] = [];
  
  constructor(initialInventory?: Partial<BoosterInventory>) {
    // Default booster counts
    this.inventory = {
      [BoosterType.SHUFFLE]: initialInventory?.shuffle ?? 3,
      [BoosterType.WORD_HINT]: initialInventory?.word_hint ?? 2,
      [BoosterType.LETTER_REVEAL]: initialInventory?.letter_reveal ?? 5,
      [BoosterType.TARGET_REVEAL]: initialInventory?.target_reveal ?? 3,
      [BoosterType.ASK_FRIENDS]: initialInventory?.ask_friends ?? 1,
    };
  }
  
  /**
   * Check if a booster is available
   */
  public hasBooster(type: BoosterType): boolean {
    return this.inventory[type] > 0;
  }
  
  /**
   * Get count of a specific booster
   */
  public getBoosterCount(type: BoosterType): number {
    return this.inventory[type];
  }
  
  /**
   * Get all booster counts
   */
  public getInventory(): BoosterInventory {
    return { ...this.inventory };
  }
  
  /**
   * Use a booster (decrements count)
   */
  public useBooster(type: BoosterType): boolean {
    if (!this.hasBooster(type)) {
      return false;
    }
    
    this.inventory[type]--;
    this.usageHistory.push({
      type,
      timestamp: Date.now()
    });
    
    return true;
  }
  
  /**
   * Add boosters to inventory
   */
  public addBooster(type: BoosterType, count: number = 1): void {
    this.inventory[type] += count;
  }
  
  /**
   * Get usage history
   */
  public getUsageHistory(): BoosterEffect[] {
    return [...this.usageHistory];
  }
  
  /**
   * Reset inventory to defaults
   */
  public reset(defaults?: Partial<BoosterInventory>): void {
    this.inventory = {
      [BoosterType.SHUFFLE]: defaults?.shuffle ?? 3,
      [BoosterType.WORD_HINT]: defaults?.word_hint ?? 2,
      [BoosterType.LETTER_REVEAL]: defaults?.letter_reveal ?? 5,
      [BoosterType.TARGET_REVEAL]: defaults?.target_reveal ?? 3,
      [BoosterType.ASK_FRIENDS]: defaults?.ask_friends ?? 1,
    };
    this.usageHistory = [];
  }
}