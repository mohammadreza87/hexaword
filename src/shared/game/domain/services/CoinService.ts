/**
 * CoinService - Manages the coin economy for HexaWord
 * 
 * Design Philosophy:
 * - Simple and transparent earning system
 * - Balanced rewards that scale with difficulty
 * - No pay-to-win mechanics
 * - Encourage exploration and skill improvement
 */

export interface CoinRewardConfig {
  // Base rewards
  baseCompletion: number;        // Base coins for completing a level
  perWordFound: number;          // Coins per word found
  letterBonus: number;           // Bonus per letter in longer words (6+ letters)
  
  // Skill bonuses
  perfectBonus: number;          // Bonus for no hints used
  speedBonus: number;            // Max bonus for fast completion
  firstTryBonus: number;         // Bonus for finding word on first attempt
  
  // Level scaling
  levelMultiplier: number;       // Multiplier per 10 levels (e.g., 0.1 = 10% more per 10 levels)
  maxMultiplier: number;         // Cap on level multiplier
  
  // Time thresholds
  speedBonusTime: number;        // Time in seconds to get max speed bonus
  
  // Hint costs
  shuffleCost: number;           // Cost to shuffle letters (free in our game)
  revealLetterCost: number;      // Cost to reveal a letter
  targetHintCost: number;        // Cost for target hint
}

export interface CoinState {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  levelEarnings: number;  // Coins earned in current level
}

export class CoinService {
  private static readonly DEFAULT_CONFIG: CoinRewardConfig = {
    // Base rewards
    baseCompletion: 50,        // 50 coins for completing any level
    perWordFound: 10,          // 10 coins per word
    letterBonus: 5,            // 5 coins per letter in 6+ letter words
    
    // Skill bonuses
    perfectBonus: 100,         // 100 coins for no hints
    speedBonus: 50,            // Up to 50 coins for speed
    firstTryBonus: 20,         // 20 coins for words found without errors
    
    // Level scaling
    levelMultiplier: 0.1,      // 10% more coins per 10 levels
    maxMultiplier: 3.0,        // Max 3x multiplier at level 200+
    
    // Time thresholds
    speedBonusTime: 60,        // 60 seconds for max speed bonus
    
    // Hint costs (for spending)
    shuffleCost: 0,            // Shuffle is free
    revealLetterCost: 30,      // 30 coins to reveal a letter
    targetHintCost: 20         // 20 coins for target hint
  };

  private config: CoinRewardConfig;
  private state: CoinState;

  constructor(config?: Partial<CoinRewardConfig>) {
    this.config = { ...CoinService.DEFAULT_CONFIG, ...config };
    this.state = {
      balance: 0,
      totalEarned: 0,
      totalSpent: 0,
      levelEarnings: 0
    };
  }

  /**
   * Initialize with saved balance
   */
  public initialize(savedBalance: number = 0): void {
    this.state.balance = savedBalance;
    this.state.totalEarned = savedBalance;
    this.state.totalSpent = 0;
    this.state.levelEarnings = 0;
  }

  /**
   * Start tracking a new level
   */
  public startLevel(): void {
    this.state.levelEarnings = 0;
  }

  /**
   * Calculate coins earned for finding a word
   */
  public calculateWordReward(
    word: string,
    foundQuickly: boolean = false
  ): number {
    let reward = this.config.perWordFound;
    
    // Bonus for longer words (6+ letters)
    if (word.length >= 6) {
      reward += (word.length - 5) * this.config.letterBonus;
    }
    
    // Bonus for finding quickly (within first attempt)
    if (foundQuickly) {
      reward += this.config.firstTryBonus;
    }
    
    this.state.levelEarnings += reward;
    return reward;
  }

  /**
   * Calculate level completion reward
   */
  public calculateLevelReward(
    level: number,
    wordsFound: number,
    timeElapsed: number,
    hintsUsed: number
  ): number {
    let reward = this.config.baseCompletion;
    
    // Add per-word rewards (already tracked in levelEarnings)
    reward += this.state.levelEarnings;
    
    // Perfect bonus (no hints)
    if (hintsUsed === 0) {
      reward += this.config.perfectBonus;
    }
    
    // Speed bonus (linear decrease from max to 0)
    const seconds = timeElapsed / 1000;
    if (seconds < this.config.speedBonusTime) {
      const speedMultiplier = 1 - (seconds / this.config.speedBonusTime);
      reward += Math.floor(this.config.speedBonus * speedMultiplier);
    }
    
    // Level scaling (more coins at higher levels)
    const levelTier = Math.floor(level / 10);
    const multiplier = Math.min(
      1 + (levelTier * this.config.levelMultiplier),
      this.config.maxMultiplier
    );
    reward = Math.floor(reward * multiplier);
    
    // Update state
    this.state.balance += reward;
    this.state.totalEarned += reward;
    
    return reward;
  }

  /**
   * Spend coins on a hint
   */
  public spendOnHint(hintType: 'shuffle' | 'reveal' | 'target'): boolean {
    const costs = {
      shuffle: this.config.shuffleCost,
      reveal: this.config.revealLetterCost,
      target: this.config.targetHintCost
    };
    
    const cost = costs[hintType];
    
    if (cost === 0) {
      return true; // Free hints always succeed
    }
    
    if (this.state.balance >= cost) {
      this.state.balance -= cost;
      this.state.totalSpent += cost;
      return true;
    }
    
    return false; // Not enough coins
  }

  /**
   * Add coins (for purchases or rewards)
   */
  public addCoins(amount: number): void {
    this.state.balance += amount;
    this.state.totalEarned += amount;
  }

  /**
   * Get current balance
   */
  public getBalance(): number {
    return this.state.balance;
  }

  /**
   * Get full state
   */
  public getState(): CoinState {
    return { ...this.state };
  }

  /**
   * Get hint cost
   */
  public getHintCost(hintType: 'shuffle' | 'reveal' | 'target'): number {
    const costs = {
      shuffle: this.config.shuffleCost,
      reveal: this.config.revealLetterCost,
      target: this.config.targetHintCost
    };
    return costs[hintType];
  }

  /**
   * Format coin display
   */
  public static formatCoins(amount: number): string {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`;
    }
    return amount.toLocaleString();
  }
}

// Coin Economy Balance:
//
// Average earnings per level:
// - Base: 50 coins
// - 6 words × 10 coins = 60 coins
// - Speed bonus: ~25 coins
// - Total: ~135 coins per level
//
// With perfect play (no hints):
// - Base + words: 110 coins
// - Perfect bonus: 100 coins
// - Speed bonus: 50 coins
// - Total: ~260 coins per level
//
// Hint costs:
// - Reveal letter: 30 coins (~22% of avg earnings)
// - Target hint: 20 coins (~15% of avg earnings)
// - Shuffle: Free (encourages exploration)
//
// This creates a balanced economy where:
// - Players can afford 4-6 hints per level with average play
// - Perfect play is highly rewarded
// - Higher levels give more coins (up to 3x at level 200+)
// - Players always make progress (can't go negative)