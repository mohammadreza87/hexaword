import express, { Request, Response } from 'express';
import { reddit, redis } from '@devvit/web/server';
import crypto from 'crypto';
import { DAILY_CHALLENGES_60_DAY_CYCLE, calculateCycleDay, getChallengeForDay } from '../data/dailyChallenges';

const router = express.Router();

interface DailyChallenge {
  id: number;
  date: string;
  words: string[];
  seed: string;
  theme?: string;
  clue: string;
  difficulty: 'easy' | 'medium' | 'hard';
  dayType: 'minimal' | 'themed' | 'wildcard' | 'throwback' | 'frenzy' | 'social' | 'supreme';
}

interface DailyChallengeCompletion {
  username: string;
  date: string;
  completionTime: number; // in seconds
  hintsUsed: number;
  completed: boolean;
  timestamp: string;
}

interface UserStreak {
  username: string;
  currentStreak: number;
  longestStreak: number;
  lastPlayedDate: string;
  totalDaysPlayed: number;
}

// Predefined word sets for different themes
const THEMED_WORDS = {
  animals: ['CAT', 'DOG', 'BIRD', 'FISH', 'BEAR', 'LION'],
  food: ['CAKE', 'RICE', 'MEAT', 'SOUP', 'BEAN', 'CORN'],
  tech: ['CODE', 'DATA', 'CHIP', 'BYTE', 'WIFI', 'APPS'],
  nature: ['TREE', 'LEAF', 'WIND', 'RAIN', 'SNOW', 'STAR'],
  sports: ['BALL', 'GAME', 'TEAM', 'GOAL', 'RACE', 'JUMP'],
  colors: ['BLUE', 'RED', 'GOLD', 'PINK', 'GRAY', 'CYAN'],
  music: ['SONG', 'BEAT', 'TUNE', 'BAND', 'JAZZ', 'ROCK']
};

// Get day type based on day of week
function getDayType(date: Date): DailyChallenge['dayType'] {
  const day = date.getUTCDay();
  switch (day) {
    case 1: return 'minimal';    // Monday
    case 2: return 'themed';     // Tuesday
    case 3: return 'wildcard';   // Wednesday
    case 4: return 'throwback';  // Thursday
    case 5: return 'frenzy';     // Friday
    case 6: return 'social';     // Saturday
    case 0: return 'supreme';    // Sunday
    default: return 'wildcard';
  }
}

// Generate deterministic challenge for a given date using 60-day cycle
function generateDailyChallenge(dateStr: string): DailyChallenge {
  const date = new Date(dateStr);
  const daysSinceEpoch = Math.floor(date.getTime() / (1000 * 60 * 60 * 24));
  const id = daysSinceEpoch - 19000; // Start counting from a recent epoch
  
  // Get the challenge from our 60-day cycle
  const cycleDay = calculateCycleDay(date);
  const predefinedChallenge = getChallengeForDay(cycleDay);
  
  // Create deterministic seed from date
  const seed = crypto.createHash('md5').update(dateStr).digest('hex');
  
  return {
    id,
    date: dateStr,
    words: predefinedChallenge.words,
    seed: `daily:${dateStr}:${seed}`,
    theme: predefinedChallenge.theme,
    clue: predefinedChallenge.clue,
    difficulty: predefinedChallenge.difficulty,
    dayType: predefinedChallenge.dayType
  };
}

// Get today's challenge
router.get('/api/daily-challenge', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const challenge = generateDailyChallenge(today);
    
    // Get current user's completion status
    const username = await reddit.getCurrentUsername();
    let userCompletion = null;
    let userStreak = null;
    
    if (username) {
      // Check if user completed today's challenge
      const completionKey = `hw:daily:completion:${today}:${username}`;
      const completionData = await redis.get(completionKey);
      if (completionData) {
        userCompletion = JSON.parse(completionData);
      }
      
      // Get user's streak
      const streakKey = `hw:daily:streak:${username}`;
      const streakData = await redis.get(streakKey);
      if (streakData) {
        userStreak = JSON.parse(streakData);
      }
    }
    
    // Get global stats for today's challenge
    const statsKey = `hw:daily:stats:${today}`;
    let stats = {
      totalPlayers: 0,
      averageTime: 0,
      averageHints: 0,
      completionRate: 0,
      fastestTime: null as number | null,
      fastestPlayer: null as string | null
    };
    
    const statsData = await redis.get(statsKey);
    if (statsData) {
      stats = JSON.parse(statsData);
    }
    
    return res.json({
      challenge,
      userCompletion,
      userStreak,
      stats
    });
  } catch (error) {
    console.error('Failed to get daily challenge:', error);
    return res.status(500).json({ error: 'Failed to get daily challenge' });
  }
});

// Submit daily challenge completion
router.post('/api/daily-challenge/complete', async (req: Request, res: Response) => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { completionTime, hintsUsed } = req.body;
    const today = new Date().toISOString().split('T')[0];
    
    // Check if already completed today
    const completionKey = `hw:daily:completion:${today}:${username}`;
    const existingCompletion = await redis.get(completionKey);
    if (existingCompletion) {
      return res.status(400).json({ error: 'Already completed today\'s challenge' });
    }
    
    // Save completion
    const completion: DailyChallengeCompletion = {
      username,
      date: today,
      completionTime,
      hintsUsed,
      completed: true,
      timestamp: new Date().toISOString()
    };
    
    await redis.set(completionKey, JSON.stringify(completion));
    // Expire after 2 days
    await redis.expire(completionKey, 2 * 24 * 60 * 60);
    
    // Update user's streak
    const streakKey = `hw:daily:streak:${username}`;
    let streak: UserStreak;
    const streakData = await redis.get(streakKey);
    
    if (streakData) {
      streak = JSON.parse(streakData);
      const lastPlayed = new Date(streak.lastPlayedDate);
      const todayDate = new Date(today);
      const daysDiff = Math.floor((todayDate.getTime() - lastPlayed.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        // Consecutive day - increase streak
        streak.currentStreak++;
        streak.longestStreak = Math.max(streak.longestStreak, streak.currentStreak);
      } else if (daysDiff > 1) {
        // Streak broken - reset to 1
        streak.currentStreak = 1;
      }
      // If daysDiff === 0, already played today (shouldn't happen due to check above)
      
      streak.lastPlayedDate = today;
      streak.totalDaysPlayed++;
    } else {
      // First time playing
      streak = {
        username,
        currentStreak: 1,
        longestStreak: 1,
        lastPlayedDate: today,
        totalDaysPlayed: 1
      };
    }
    
    await redis.set(streakKey, JSON.stringify(streak));
    
    // Update global stats
    const statsKey = `hw:daily:stats:${today}`;
    let stats = {
      totalPlayers: 0,
      totalTime: 0,
      totalHints: 0,
      completions: 0,
      fastestTime: null as number | null,
      fastestPlayer: null as string | null
    };
    
    const statsData = await redis.get(statsKey);
    if (statsData) {
      const existingStats = JSON.parse(statsData);
      stats = existingStats;
    }
    
    stats.totalPlayers++;
    stats.totalTime = (stats.totalTime || 0) + completionTime;
    stats.totalHints = (stats.totalHints || 0) + hintsUsed;
    stats.completions++;
    
    if (stats.fastestTime === null || completionTime < stats.fastestTime) {
      stats.fastestTime = completionTime;
      stats.fastestPlayer = username;
    }
    
    // Calculate averages
    const finalStats = {
      totalPlayers: stats.totalPlayers,
      averageTime: Math.round(stats.totalTime / stats.completions),
      averageHints: Math.round(stats.totalHints / stats.completions * 10) / 10,
      completionRate: 100, // Everyone who submits has completed
      fastestTime: stats.fastestTime,
      fastestPlayer: stats.fastestPlayer
    };
    
    await redis.set(statsKey, JSON.stringify(finalStats));
    await redis.expire(statsKey, 7 * 24 * 60 * 60); // Keep stats for a week
    
    // Update daily leaderboard
    const leaderboardKey = `hw:daily:leaderboard:${today}`;
    await redis.zAdd(leaderboardKey, { 
      score: completionTime, // Lower time = better rank
      member: username 
    });
    await redis.expire(leaderboardKey, 7 * 24 * 60 * 60);
    
    // Calculate rewards
    let coins = 100; // Base reward
    
    // Hint penalties
    if (hintsUsed === 1) coins = 75;
    else if (hintsUsed >= 2) coins = 50;
    
    // Speed bonuses
    if (completionTime < 60) coins += 100;      // Under 1 minute
    else if (completionTime < 120) coins += 50; // Under 2 minutes
    else if (completionTime < 300) coins += 25; // Under 5 minutes
    
    // Streak bonuses
    let streakBonus = 0;
    if (streak.currentStreak === 7) streakBonus = 200;
    else if (streak.currentStreak === 30) streakBonus = 1000;
    else if (streak.currentStreak === 100) streakBonus = 5000;
    
    const totalCoins = coins + streakBonus;
    
    return res.json({
      success: true,
      completion,
      streak,
      coins: totalCoins,
      streakBonus,
      stats: finalStats
    });
    
  } catch (error) {
    console.error('Failed to complete daily challenge:', error);
    return res.status(500).json({ error: 'Failed to complete daily challenge' });
  }
});

// Get daily leaderboard
router.get('/api/daily-challenge/leaderboard', async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const leaderboardKey = `hw:daily:leaderboard:${today}`;
    
    // Get top 50 players
    const topPlayers = await redis.zRange(leaderboardKey, 0, 49);
    
    const leaderboard = [];
    for (let i = 0; i < topPlayers.length; i++) {
      const entry = topPlayers[i];
      leaderboard.push({
        rank: i + 1,
        username: entry.member,
        time: entry.score,
        displayTime: formatTime(entry.score)
      });
    }
    
    // Get current user's rank
    const username = await reddit.getCurrentUsername();
    let userRank = null;
    if (username) {
      const rank = await redis.zRank(leaderboardKey, username);
      if (rank !== null && rank !== undefined) {
        userRank = rank + 1;
      }
    }
    
    return res.json({
      date: today,
      leaderboard,
      userRank
    });
    
  } catch (error) {
    console.error('Failed to get daily leaderboard:', error);
    return res.status(500).json({ error: 'Failed to get daily leaderboard' });
  }
});

// Helper function to format time
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Get challenge preview for next N days (admin/debug endpoint)
router.get('/api/daily-challenge/preview', async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = req.query.date ? new Date(req.query.date as string) : new Date();
    
    const previews = [];
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const challenge = generateDailyChallenge(dateStr);
      const cycleDay = calculateCycleDay(date);
      
      previews.push({
        date: dateStr,
        cycleDay,
        dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
        ...challenge
      });
    }
    
    return res.json({ previews });
  } catch (error) {
    console.error('Failed to get challenge preview:', error);
    return res.status(500).json({ error: 'Failed to get challenge preview' });
  }
});

// Get current cycle information
router.get('/api/daily-challenge/cycle-info', async (req: Request, res: Response) => {
  try {
    const today = new Date();
    const cycleDay = calculateCycleDay(today);
    const totalDays = DAILY_CHALLENGES_60_DAY_CYCLE.length;
    const daysRemaining = totalDays - cycleDay + 1;
    
    return res.json({
      currentDay: cycleDay,
      totalDays,
      daysRemaining,
      cycleProgress: Math.round((cycleDay / totalDays) * 100),
      nextCycleStarts: new Date(Date.now() + (daysRemaining * 24 * 60 * 60 * 1000)).toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Failed to get cycle info:', error);
    return res.status(500).json({ error: 'Failed to get cycle info' });
  }
});

export default router;