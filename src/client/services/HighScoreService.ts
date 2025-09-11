/**
 * HighScoreService - Manages high scores and leaderboard interaction
 */

export interface HighScoreData {
  score: number;
  level: number;
  wordsFound: number;
  timeElapsed: number;
  hintsUsed: number;
  perfect: boolean;
}

export interface LeaderboardEntry {
  username: string;
  score: number;
  level: number;
  timestamp: number;
}

export class HighScoreService {
  private static instance: HighScoreService;
  
  private constructor() {}
  
  public static getInstance(): HighScoreService {
    if (!HighScoreService.instance) {
      HighScoreService.instance = new HighScoreService();
    }
    return HighScoreService.instance;
  }
  
  /**
   * Submit a new high score
   */
  public async submitScore(data: HighScoreData): Promise<{ newHighScore: boolean; score: number }> {
    try {
      const response = await fetch('/api/highscore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit score');
      }
      
      const result = await response.json();
      return {
        newHighScore: result.newHighScore || false,
        score: result.score || data.score
      };
    } catch (error) {
      console.error('Error submitting score:', error);
      return { newHighScore: false, score: data.score };
    }
  }
  
  /**
   * Get current user's high score
   */
  public async getUserHighScore(): Promise<number> {
    try {
      const response = await fetch('/api/highscore');
      
      if (!response.ok) {
        return 0;
      }
      
      const data = await response.json();
      return data.score || 0;
    } catch (error) {
      console.error('Error fetching high score:', error);
      return 0;
    }
  }
  
  /**
   * Get global leaderboard
   */
  public async getLeaderboard(): Promise<LeaderboardEntry[]> {
    try {
      const response = await fetch('/api/leaderboard');
      
      if (!response.ok) {
        return [];
      }
      
      const data = await response.json();
      return data.leaderboard || [];
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      return [];
    }
  }
  
  /**
   * Get current user's rank
   */
  public async getUserRank(): Promise<{ rank: number | null; score: number }> {
    try {
      const response = await fetch('/api/leaderboard/rank');
      
      if (!response.ok) {
        return { rank: null, score: 0 };
      }
      
      const data = await response.json();
      return {
        rank: data.rank,
        score: data.score || 0
      };
    } catch (error) {
      console.error('Error fetching user rank:', error);
      return { rank: null, score: 0 };
    }
  }
}