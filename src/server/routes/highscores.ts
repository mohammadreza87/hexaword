import express from 'express';
import { context, reddit, redis } from '@devvit/web/server';

const router = express.Router();

type HighScore = {
  username: string;
  score: number;
  level: number;
  wordsFound: number;
  timeElapsed: number;
  hintsUsed: number;
  perfect: boolean;
  timestamp: number;
};

type LeaderboardEntry = {
  username: string;
  score: number;
  level: number;
  timestamp: number;
};

const LEADERBOARD_KEY = 'hw:leaderboard:global';
const USER_HIGH_SCORE_PREFIX = 'hw:highscore:';
const MAX_LEADERBOARD_SIZE = 100;

// Get current user's high score
router.get('/api/highscore', async (_req, res) => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      return res.status(401).json({ status: 'error', message: 'unauthorized' });
    }
    
    const key = `${USER_HIGH_SCORE_PREFIX}${username}`;
    const raw = await redis.get(key);
    
    if (!raw) {
      return res.json({ highScore: 0 });
    }
    
    const highScore: HighScore = JSON.parse(raw);
    return res.json(highScore);
  } catch (e) {
    console.error('Error fetching high score:', e);
    return res.status(500).json({ status: 'error', message: 'failed to load high score' });
  }
});

// Save/update high score
router.post('/api/highscore', async (req, res) => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      return res.status(401).json({ status: 'error', message: 'unauthorized' });
    }
    
    const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    
    const newScore: HighScore = {
      username,
      score: Number(body?.score) || 0,
      level: Number(body?.level) || 1,
      wordsFound: Number(body?.wordsFound) || 0,
      timeElapsed: Number(body?.timeElapsed) || 0,
      hintsUsed: Number(body?.hintsUsed) || 0,
      perfect: Boolean(body?.perfect),
      timestamp: Date.now()
    };
    
    // Get current high score
    const userKey = `${USER_HIGH_SCORE_PREFIX}${username}`;
    const currentRaw = await redis.get(userKey);
    let shouldUpdate = true;
    
    if (currentRaw) {
      const current: HighScore = JSON.parse(currentRaw);
      // Only update if new score is higher
      shouldUpdate = newScore.score > current.score;
    }
    
    if (shouldUpdate) {
      // Update user's high score
      await redis.set(userKey, JSON.stringify(newScore));
      
      // Update global leaderboard (sorted set)
      await redis.zAdd(LEADERBOARD_KEY, {
        member: username,
        score: newScore.score
      });
      
      // Trim leaderboard to max size
      await redis.zRemRangeByRank(LEADERBOARD_KEY, 0, -MAX_LEADERBOARD_SIZE - 1);
      
      return res.json({ 
        status: 'success', 
        newHighScore: true,
        score: newScore.score 
      });
    } else {
      return res.json({ 
        status: 'success', 
        newHighScore: false 
      });
    }
  } catch (e) {
    console.error('Error saving high score:', e);
    return res.status(500).json({ status: 'error', message: 'failed to save high score' });
  }
});

// Get global leaderboard
router.get('/api/leaderboard', async (_req, res) => {
  try {
    // Get top scores from sorted set
    const topScores = await redis.zRange(LEADERBOARD_KEY, 0, 19, { 
      reverse: true,
      by: 'score' 
    });
    
    if (!topScores || topScores.length === 0) {
      return res.json({ leaderboard: [] });
    }
    
    // Build leaderboard entries
    const leaderboard: LeaderboardEntry[] = [];
    
    for (const entry of topScores) {
      const userKey = `${USER_HIGH_SCORE_PREFIX}${entry.member}`;
      const userDataRaw = await redis.get(userKey);
      
      if (userDataRaw) {
        const userData: HighScore = JSON.parse(userDataRaw);
        leaderboard.push({
          username: entry.member,
          score: entry.score,
          level: userData.level,
          timestamp: userData.timestamp
        });
      }
    }
    
    return res.json({ leaderboard });
  } catch (e) {
    console.error('Error fetching leaderboard:', e);
    return res.status(500).json({ status: 'error', message: 'failed to load leaderboard' });
  }
});

// Get user's rank
router.get('/api/leaderboard/rank', async (_req, res) => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      return res.status(401).json({ status: 'error', message: 'unauthorized' });
    }
    
    const rank = await redis.zRank(LEADERBOARD_KEY, username, { reverse: true });
    const score = await redis.zScore(LEADERBOARD_KEY, username);
    
    return res.json({ 
      rank: rank !== undefined ? rank + 1 : null, // Convert 0-indexed to 1-indexed
      score: score || 0,
      username 
    });
  } catch (e) {
    console.error('Error fetching user rank:', e);
    return res.status(500).json({ status: 'error', message: 'failed to get rank' });
  }
});

export default router;