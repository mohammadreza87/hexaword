/**
 * ScoreService - Handles all scoring logic for HexaWord
 * 
 * Scoring Philosophy:
 * - Reward skill and efficiency without punishing exploration
 * - Balance speed vs accuracy
 * - Make every action feel rewarding
 * - Keep it simple enough to understand, complex enough to master
 */

export interface ScoreConfig {
  // Base points
  baseWordScore: number;        // Base points per word
  letterMultiplier: number;     // Points per letter in word
  
  // Bonuses
  intersectionBonus: number;    // Bonus for words with shared letters
  speedBonus: number;           // Max bonus for quick word find
  firstWordBonus: number;       // Bonus for finding first word quickly
  noHintBonus: number;          // Bonus per word found without hints
  perfectBonus: number;         // Bonus for completing level without hints
  
  // Time factors
  speedBonusWindow: number;     // Time window for speed bonus (seconds)
  
  // Penalties (minimal to keep it relaxing)
  hintPenalty: number;          // Small penalty for using hints
  maxHintPenalty: number;       // Cap on total hint penalties
}

export interface ScoreState {
  currentScore: number;
  levelScore: number;
  wordsFound: number;
  wordsFoundWithoutHints: number;
  timeStarted: number;
  hintsUsed: number;
  perfectLevel: boolean;
}

export class ScoreService {
  private static readonly DEFAULT_CONFIG: ScoreConfig = {
    // Base scoring
    baseWordScore: 100,
    letterMultiplier: 20,
    
    // Bonuses
    intersectionBonus: 50,
    speedBonus: 300,        // Max bonus for finding word quickly
    firstWordBonus: 200,    // Bonus for finding first word fast
    noHintBonus: 100,       // Bonus per word found without using hints
    perfectBonus: 1000,     // Big bonus for perfect level
    
    // Time windows
    speedBonusWindow: 30,   // 30 seconds for max speed bonus per word
    
    // Penalties
    hintPenalty: 50,
    maxHintPenalty: 200
  };

  private config: ScoreConfig;
  private state: ScoreState;

  constructor(config?: Partial<ScoreConfig>) {
    this.config = { ...ScoreService.DEFAULT_CONFIG, ...config };
    this.state = this.createInitialState();
  }

  /**
   * Creates initial score state
   */
  private createInitialState(): ScoreState {
    return {
      currentScore: 0,
      levelScore: 0,
      wordsFound: 0,
      wordsFoundWithoutHints: 0,
      timeStarted: Date.now(),
      hintsUsed: 0,
      perfectLevel: true
    };
  }

  /**
   * Reset scoring for a new level
   */
  public resetLevel(): void {
    this.state = {
      ...this.createInitialState(),
      currentScore: this.state.currentScore // Keep total score
    };
  }

  /**
   * Calculate score for finding a word
   */
  public scoreWord(
    word: string,
    hasIntersections: boolean,
    timeToFind: number
  ): number {
    // Base score
    let score = this.config.baseWordScore;
    
    // Length bonus
    score += word.length * this.config.letterMultiplier;
    
    // Intersection bonus (rewards finding complex overlapping words)
    if (hasIntersections) {
      score += this.config.intersectionBonus;
    }
    
    // First word bonus
    if (this.state.wordsFound === 0) {
      const firstWordSpeedBonus = this.calculateSpeedBonus(timeToFind);
      score += Math.floor(this.config.firstWordBonus * firstWordSpeedBonus);
    }
    
    // Speed bonus for any word
    const speedMultiplier = this.calculateSpeedBonus(timeToFind);
    score += Math.floor(this.config.speedBonus * speedMultiplier);
    
    // No-hint bonus (reward for not using hints before finding this word)
    if (this.state.perfectLevel) {
      score += this.config.noHintBonus;
      this.state.wordsFoundWithoutHints++;
    }
    
    // Update state
    this.state.wordsFound++;
    this.state.levelScore += score;
    this.state.currentScore += score;
    
    return score;
  }

  /**
   * Apply hint penalty
   */
  public useHint(hintType: 'letter' | 'word' | 'position'): number {
    this.state.hintsUsed++;
    this.state.perfectLevel = false;
    
    // Different penalties for different hint types
    const penalties = {
      letter: this.config.hintPenalty * 0.5,      // Reveal letter: small penalty
      position: this.config.hintPenalty * 0.75,   // Target hint: medium penalty  
      word: this.config.hintPenalty              // Full word reveal: full penalty
    };
    
    const penalty = Math.min(
      penalties[hintType],
      this.config.maxHintPenalty - (this.state.hintsUsed * 10)
    );
    
    // Never let score go negative
    const actualPenalty = Math.min(penalty, this.state.levelScore);
    this.state.levelScore -= actualPenalty;
    this.state.currentScore -= actualPenalty;
    
    return actualPenalty;
  }

  /**
   * Calculate level completion bonus
   */
  public completeLevelBonus(totalWords: number, timeElapsed: number): number {
    let bonus = 0;
    
    // Perfect level bonus (no hints used)
    if (this.state.perfectLevel) {
      bonus += this.config.perfectBonus;
    }
    
    // Partial no-hint bonus (scaled by how many words found without hints)
    const noHintRatio = this.state.wordsFoundWithoutHints / totalWords;
    if (noHintRatio > 0.5 && !this.state.perfectLevel) {
      bonus += Math.floor(300 * noHintRatio); // Up to 300 points
    }
    
    // Completion speed bonus
    const avgTimePerWord = timeElapsed / totalWords;
    if (avgTimePerWord < 15000) { // Less than 15 seconds per word
      bonus += 400;
    } else if (avgTimePerWord < 25000) { // Less than 25 seconds
      bonus += 250;
    } else if (avgTimePerWord < 40000) { // Less than 40 seconds
      bonus += 100;
    }
    
    this.state.levelScore += bonus;
    this.state.currentScore += bonus;
    
    return bonus;
  }

  /**
   * Calculate speed bonus multiplier (0 to 1)
   */
  private calculateSpeedBonus(timeToFind: number): number {
    const seconds = timeToFind / 1000;
    if (seconds >= this.config.speedBonusWindow) return 0;
    
    // Linear decrease from 1 to 0 over the time window
    return Math.max(0, 1 - (seconds / this.config.speedBonusWindow));
  }

  /**
   * Get current score state
   */
  public getState(): ScoreState {
    return { ...this.state };
  }

  /**
   * Get formatted score display
   */
  public getScoreDisplay(): {
    score: number;
    levelScore: number;
    wordsWithoutHints: number;
    totalWords: number;
  } {
    return {
      score: this.state.currentScore,
      levelScore: this.state.levelScore,
      wordsWithoutHints: this.state.wordsFoundWithoutHints,
      totalWords: this.state.wordsFound
    };
  }

  /**
   * Calculate rank/grade based on score
   */
  public static calculateGrade(score: number, maxPossible: number): string {
    const percentage = (score / maxPossible) * 100;
    
    if (percentage >= 95) return 'S';  // Perfect/Near perfect
    if (percentage >= 85) return 'A';  // Excellent
    if (percentage >= 75) return 'B';  // Good
    if (percentage >= 65) return 'C';  // Average
    if (percentage >= 50) return 'D';  // Below average
    return 'E';                        // Needs improvement
  }

  /**
   * Export score for leaderboard
   */
  /**
   * Load state from saved progress
   */
  public loadState(savedState: Partial<ScoreState>): void {
    this.state = {
      ...this.state,
      ...savedState
    };
  }
  
  public exportForLeaderboard(): {
    score: number;
    wordsFound: number;
    timeElapsed: number;
    hintsUsed: number;
    perfect: boolean;
  } {
    return {
      score: this.state.currentScore,
      wordsFound: this.state.wordsFound,
      timeElapsed: Date.now() - this.state.timeStarted,
      hintsUsed: this.state.hintsUsed,
      perfect: this.state.perfectLevel
    };
  }
}

// Scoring formulas for reference:
// 
// Word Score = Base + (Length × Multiplier) + Speed Bonus + Special Bonuses
// 
// Example scoring:
// - 3-letter word: 100 + (3 × 20) = 160 points
// - 5-letter word with intersection: 100 + (5 × 20) + 50 = 250 points
// - Quick find (< 10 sec): +200 speed bonus
// - First word found quickly: +200 bonus
// - Found without hints: +100 bonus
//
// Average level (6 words): 
// - Casual play: ~2,000-3,000 points
// - Good play: ~3,500-4,500 points  
// - Expert play: ~5,000-6,500 points
// - Perfect play (no hints): ~8,000+ points