import express, { Request, Response } from 'express';
import { redis, context } from '@devvit/web/server';

export interface LevelProgressData {
  level: number;
  foundWords: string[];
  revealedCells: string[];
  selectedCells: string[];
  scoreState: {
    levelScore: number;
    currentScore: number; // Total accumulated score across all levels
    hintsUsed: number;
    timeStarted: number;
  };
  timestamp: number;
}

const router = express.Router();

/**
 * Get level progress for a user
 */
router.get('/api/level-progress/:level', async (req: Request, res: Response) => {
  try {
    const { level } = req.params;
    const userId = context.userId || 'anonymous';
    const key = `level_progress:${userId}:${level}`;
    
    const data = await redis.get(key);
    
    if (!data) {
      return res.status(404).json({ message: 'No progress found' });
    }
    
    return res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error loading level progress:', error);
    res.status(500).json({ error: 'Failed to load progress' });
  }
});

/**
 * Save level progress
 */
router.post('/api/level-progress', async (req: Request, res: Response) => {
  try {
    const userId = context.userId || 'anonymous';
    const progressData: LevelProgressData = req.body;
    
    if (!progressData.level) {
      return res.status(400).json({ error: 'Level is required' });
    }
    
    const key = `level_progress:${userId}:${progressData.level}`;
    
    // Save with 7 day expiry (604800 seconds)
    await redis.set(key, JSON.stringify(progressData), { ex: 604800 });
    
    // Also save a list of levels with progress for this user
    const levelsKey = `user_progress_levels:${userId}`;
    const levels = await redis.get(levelsKey);
    const levelsList = levels ? JSON.parse(levels) : [];
    
    if (!levelsList.includes(progressData.level)) {
      levelsList.push(progressData.level);
      await redis.set(levelsKey, JSON.stringify(levelsList), { ex: 604800 });
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error saving level progress:', error);
    res.status(500).json({ error: 'Failed to save progress' });
  }
});

/**
 * Clear level progress
 */
router.delete('/api/level-progress/:level', async (req: Request, res: Response) => {
  try {
    const { level } = req.params;
    const userId = context.userId || 'anonymous';
    const key = `level_progress:${userId}:${level}`;
    
    await redis.del(key);
    
    // Remove from levels list
    const levelsKey = `user_progress_levels:${userId}`;
    const levels = await redis.get(levelsKey);
    if (levels) {
      const levelsList = JSON.parse(levels);
      const filtered = levelsList.filter((l: number) => l !== parseInt(level));
      await redis.set(levelsKey, JSON.stringify(filtered), { ex: 604800 });
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error clearing level progress:', error);
    res.status(500).json({ error: 'Failed to clear progress' });
  }
});

/**
 * Get all levels with saved progress
 */
router.get('/api/level-progress', async (req: Request, res: Response) => {
  try {
    const userId = context.userId || 'anonymous';
    const levelsKey = `user_progress_levels:${userId}`;
    
    const levels = await redis.get(levelsKey);
    
    if (!levels) {
      return res.json({ levels: [] });
    }
    
    return res.json({ levels: JSON.parse(levels) });
  } catch (error) {
    console.error('Error getting progress levels:', error);
    res.status(500).json({ error: 'Failed to get progress levels' });
  }
});

export default router;