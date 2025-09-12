import express, { Request, Response } from 'express';
import { reddit, redis } from '@devvit/web/server';
import { updateCreatorStats } from '../utils/updateCreatorStats';

const router = express.Router();

// Simple migration that counts existing levels for the current user
router.post('/api/migrate-my-levels', async (req: Request, res: Response) => {
  try {
    const username = await reddit.getCurrentUsername();
    
    if (!username) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    console.log(`Migrating levels for user: ${username}`);
    
    // Get user's level list
    const userKey = `hw:ulevels:user:${username}`;
    const levelIdsJson = await redis.get(userKey);
    
    if (!levelIdsJson) {
      return res.json({ 
        success: true, 
        message: 'No levels found',
        username,
        levelCount: 0
      });
    }
    
    const levelIds = JSON.parse(levelIdsJson);
    let totalPlays = 0;
    let totalUpvotes = 0;
    let totalDownvotes = 0;
    let totalShares = 0;
    let levelCount = 0;
    
    // Process each level
    for (const levelId of levelIds) {
      const levelKey = `hw:ulevel:${levelId}`;
      const levelData = await redis.get(levelKey);
      
      if (!levelData) continue;
      
      try {
        const level = JSON.parse(levelData);
        levelCount++;
        
        // Accumulate stats
        totalPlays += level.playCount || 0;
        totalUpvotes += level.upvotes || 0;
        totalDownvotes += level.downvotes || 0;
        totalShares += level.shares || 0;
        
        console.log(`Level ${levelId}: plays=${level.playCount || 0}, up=${level.upvotes || 0}, down=${level.downvotes || 0}`);
      } catch (err) {
        console.error(`Failed to parse level ${levelId}:`, err);
      }
    }
    
    // Now update creator stats directly
    const creatorKey = 'hw:leaderboard:creators';
    const dataKey = `${creatorKey}:data:${username}`;
    
    const stats = {
      username,
      totalPlays,
      totalUpvotes,
      totalDownvotes,
      totalShares,
      levelCount,
      lastUpdated: new Date().toISOString()
    };
    
    // Calculate creator score
    const creatorScore = 
      (totalPlays * 10) +
      (totalUpvotes * 50) -
      (totalDownvotes * 20) +
      (totalShares * 30) +
      (levelCount * 100);
    
    // Update Redis
    await redis.zAdd(creatorKey, { score: creatorScore, member: username });
    await redis.set(dataKey, JSON.stringify(stats));
    
    console.log(`Migration complete for ${username}: ${levelCount} levels, score: ${creatorScore}`);
    
    return res.json({ 
      success: true,
      username,
      levelCount,
      totalPlays,
      totalUpvotes,
      totalDownvotes,
      totalShares,
      score: creatorScore
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    return res.status(500).json({ 
      error: 'Migration failed',
      details: error?.message || 'Unknown error'
    });
  }
});

export default router;