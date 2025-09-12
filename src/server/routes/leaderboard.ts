import express, { Request, Response } from 'express';
import { reddit, redis } from '@devvit/web/server';

const router = express.Router();

interface LeaderboardEntry {
  username: string;
  score: number;
  level: number;
  coins: number;
  streak?: number;
  lastUpdated: string;
}

interface CreatorStats {
  username: string;
  totalPlays: number;
  totalUpvotes: number;
  totalDownvotes: number;
  totalShares: number;
  levelCount: number;
  lastUpdated: string;
}

// Helper to get time-based keys
function getLeaderboardKey(type: 'global' | 'weekly' | 'daily'): string {
  const now = new Date();
  const base = 'hw:leaderboard';
  
  switch (type) {
    case 'global':
      return `${base}:global`;
    case 'weekly':
      // Week number of the year
      const weekNum = Math.ceil((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
      return `${base}:weekly:${now.getFullYear()}-w${weekNum}`;
    case 'daily':
      return `${base}:daily:${now.toISOString().split('T')[0]}`;
  }
}

// Update user score in leaderboard
router.post('/api/leaderboard/update', async (req: Request, res: Response) => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    const { score, level, coins, streak } = req.body;
    
    if (typeof score !== 'number' || score < 0) {
      return res.status(400).json({ error: 'Invalid score' });
    }
    
    // Update all leaderboards (global, weekly, daily)
    const types: ('global' | 'weekly' | 'daily')[] = ['global', 'weekly', 'daily'];
    
    for (const type of types) {
      const key = getLeaderboardKey(type);
      
      // Use Redis sorted set to maintain leaderboard
      // Score is used for ranking, member data stored separately
      await redis.zAdd(key, { score, member: username });
      
      // Store additional user data
      const dataKey = `${key}:data:${username}`;
      const userData: LeaderboardEntry = {
        username,
        score,
        level: level || 1,
        coins: coins || 0,
        streak,
        lastUpdated: new Date().toISOString()
      };
      
      await redis.set(dataKey, JSON.stringify(userData));
      
      // Set expiry for non-global leaderboards
      if (type === 'weekly') {
        // Expire after 2 weeks
        await redis.expire(key, 14 * 24 * 60 * 60);
        await redis.expire(dataKey, 14 * 24 * 60 * 60);
      } else if (type === 'daily') {
        // Expire after 7 days
        await redis.expire(key, 7 * 24 * 60 * 60);
        await redis.expire(dataKey, 7 * 24 * 60 * 60);
      }
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Failed to update leaderboard:', error);
    return res.status(500).json({ error: 'Failed to update leaderboard' });
  }
});

// Get leaderboard data
router.get('/api/leaderboard', async (req: Request, res: Response) => {
  try {
    const currentUsername = await reddit.getCurrentUsername();
    const limit = 50; // Top 50 players
    
    const result: any = {
      global: [],
      weekly: [],
      daily: [],
      creators: [],
      creatorsByPlays: [],
      creatorsByUpvotes: [],
      creatorsByShares: [],
      userRank: null
    };
    
    const types: ('global' | 'weekly' | 'daily')[] = ['global', 'weekly', 'daily'];
    
    for (const type of types) {
      const key = getLeaderboardKey(type);
      
      // Get top players (reversed for highest score first)
      const topPlayers = await redis.zRange(key, 0, limit - 1, { reverse: true });
      
      if (!topPlayers || topPlayers.length === 0) {
        result[type] = [];
        continue;
      }
      
      // Fetch additional data for each player
      const entries = [];
      for (let i = 0; i < topPlayers.length; i++) {
        const member = topPlayers[i].member;
        const dataKey = `${key}:data:${member}`;
        const dataStr = await redis.get(dataKey);
        
        if (dataStr) {
          const data = JSON.parse(dataStr) as LeaderboardEntry;
          entries.push({
            rank: i + 1,
            username: data.username,
            score: topPlayers[i].score,
            level: data.level,
            coins: data.coins,
            streak: data.streak
          });
        } else {
          // Fallback if no additional data
          entries.push({
            rank: i + 1,
            username: member,
            score: topPlayers[i].score,
            level: 1,
            coins: 0
          });
        }
      }
      
      result[type] = entries;
      
      // Get current user's rank if authenticated
      if (currentUsername) {
        const userRank = await redis.zRank(key, currentUsername, { reverse: true });
        if (userRank !== null && userRank !== undefined) {
          if (!result.userRank) {
            result.userRank = {};
          }
          result.userRank[type] = userRank + 1; // Convert 0-based to 1-based rank
        }
      }
    }
    
    // Get overall creator leaderboard
    const creatorKey = 'hw:leaderboard:creators';
    const topCreators = await redis.zRange(creatorKey, 0, limit - 1, { reverse: true });
    
    // Collect all creator data first
    const allCreatorData: CreatorStats[] = [];
    
    if (topCreators && topCreators.length > 0) {
      for (const entry of topCreators) {
        const dataKey = `${creatorKey}:data:${entry.member}`;
        const dataStr = await redis.get(dataKey);
        
        if (dataStr) {
          const data = JSON.parse(dataStr) as CreatorStats;
          allCreatorData.push(data);
        }
      }
    }
    
    // Sort by overall score (already done by Redis)
    result.creators = allCreatorData.map((data, i) => ({
      rank: i + 1,
      username: data.username,
      totalPlays: data.totalPlays,
      totalUpvotes: data.totalUpvotes,
      totalDownvotes: data.totalDownvotes,
      totalShares: data.totalShares,
      levelCount: data.levelCount,
      score: (data.totalPlays * 10) + (data.totalUpvotes * 50) - (data.totalDownvotes * 20) + (data.totalShares * 30) + (data.levelCount * 100)
    }));
    
    // Sort by plays
    const sortedByPlays = [...allCreatorData].sort((a, b) => b.totalPlays - a.totalPlays);
    result.creatorsByPlays = sortedByPlays.slice(0, limit).map((data, i) => ({
      rank: i + 1,
      username: data.username,
      totalPlays: data.totalPlays,
      totalUpvotes: data.totalUpvotes,
      totalDownvotes: data.totalDownvotes,
      totalShares: data.totalShares,
      levelCount: data.levelCount,
      score: data.totalPlays
    }));
    
    // Sort by upvotes
    const sortedByUpvotes = [...allCreatorData].sort((a, b) => b.totalUpvotes - a.totalUpvotes);
    result.creatorsByUpvotes = sortedByUpvotes.slice(0, limit).map((data, i) => ({
      rank: i + 1,
      username: data.username,
      totalPlays: data.totalPlays,
      totalUpvotes: data.totalUpvotes,
      totalDownvotes: data.totalDownvotes,
      totalShares: data.totalShares,
      levelCount: data.levelCount,
      score: data.totalUpvotes
    }));
    
    // Sort by shares
    const sortedByShares = [...allCreatorData].sort((a, b) => b.totalShares - a.totalShares);
    result.creatorsByShares = sortedByShares.slice(0, limit).map((data, i) => ({
      rank: i + 1,
      username: data.username,
      totalPlays: data.totalPlays,
      totalUpvotes: data.totalUpvotes,
      totalDownvotes: data.totalDownvotes,
      totalShares: data.totalShares,
      levelCount: data.levelCount,
      score: data.totalShares
    }));
    
    // Get current user's ranks in all categories
    if (currentUsername) {
      // Overall rank
      const userCreatorRank = await redis.zRank(creatorKey, currentUsername, { reverse: true });
      if (userCreatorRank !== null && userCreatorRank !== undefined) {
        if (!result.userRank) {
          result.userRank = {};
        }
        result.userRank.creator = userCreatorRank + 1;
      }
      
      // Find user in sorted lists for other ranks
      const userPlayRank = sortedByPlays.findIndex(c => c.username === currentUsername);
      if (userPlayRank !== -1) {
        result.userRank.creatorPlays = userPlayRank + 1;
      }
      
      const userUpvoteRank = sortedByUpvotes.findIndex(c => c.username === currentUsername);
      if (userUpvoteRank !== -1) {
        result.userRank.creatorUpvotes = userUpvoteRank + 1;
      }
      
      const userShareRank = sortedByShares.findIndex(c => c.username === currentUsername);
      if (userShareRank !== -1) {
        result.userRank.creatorShares = userShareRank + 1;
      }
    }
    
    return res.json(result);
  } catch (error) {
    console.error('Failed to get leaderboard:', error);
    return res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Update creator stats when a level is played/voted/shared
router.post('/api/leaderboard/creator-stats', async (req: Request, res: Response) => {
  try {
    const { creatorUsername, action, levelId } = req.body;
    
    if (!creatorUsername || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const creatorKey = 'hw:leaderboard:creators';
    const dataKey = `${creatorKey}:data:${creatorUsername}`;
    
    // Get existing stats or create new
    let stats: CreatorStats;
    const existingStats = await redis.get(dataKey);
    
    if (existingStats) {
      stats = JSON.parse(existingStats);
    } else {
      stats = {
        username: creatorUsername,
        totalPlays: 0,
        totalUpvotes: 0,
        totalDownvotes: 0,
        totalShares: 0,
        levelCount: 0,
        lastUpdated: new Date().toISOString()
      };
    }
    
    // Update stats based on action
    switch (action) {
      case 'play':
        stats.totalPlays++;
        break;
      case 'upvote':
        stats.totalUpvotes++;
        break;
      case 'downvote':
        stats.totalDownvotes++;
        break;
      case 'share':
        stats.totalShares++;
        break;
      case 'create':
        stats.levelCount++;
        break;
      case 'delete':
        stats.levelCount = Math.max(0, stats.levelCount - 1);
        break;
    }
    
    stats.lastUpdated = new Date().toISOString();
    
    // Calculate creator score (weighted formula)
    // Score = (plays * 10) + (upvotes * 50) - (downvotes * 20) + (shares * 30) + (levels * 100)
    const creatorScore = 
      (stats.totalPlays * 10) +
      (stats.totalUpvotes * 50) -
      (stats.totalDownvotes * 20) +
      (stats.totalShares * 30) +
      (stats.levelCount * 100);
    
    // Update Redis
    await redis.zAdd(creatorKey, { score: creatorScore, member: creatorUsername });
    await redis.set(dataKey, JSON.stringify(stats));
    
    return res.json({ success: true, score: creatorScore });
  } catch (error) {
    console.error('Failed to update creator stats:', error);
    return res.status(500).json({ error: 'Failed to update creator stats' });
  }
});

// Clear leaderboard (admin only, for testing)
router.delete('/api/leaderboard/clear/:type', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    
    if (!['global', 'weekly', 'daily'].includes(type)) {
      return res.status(400).json({ error: 'Invalid leaderboard type' });
    }
    
    const key = getLeaderboardKey(type as 'global' | 'weekly' | 'daily');
    
    // Get all members to delete their data keys
    const members = await redis.zRange(key, 0, -1);
    
    if (members && members.length > 0) {
      for (const entry of members) {
        const dataKey = `${key}:data:${entry.member}`;
        await redis.del(dataKey);
      }
    }
    
    // Delete the sorted set
    await redis.del(key);
    
    return res.json({ success: true, message: `${type} leaderboard cleared` });
  } catch (error) {
    console.error('Failed to clear leaderboard:', error);
    return res.status(500).json({ error: 'Failed to clear leaderboard' });
  }
});

// Migration endpoint to initialize creator stats from existing levels
router.post('/api/leaderboard/migrate-creators', async (req: Request, res: Response) => {
  try {
    console.log('Starting creator stats migration...');
    
    const creatorStats: { [key: string]: CreatorStats } = {};
    
    // Get all user lists (we'll iterate through known user keys)
    // First, let's check some common usernames and anonymous
    const potentialUsers = ['anonymous', 'test', 'dev'];
    
    // Also check if we can get the current user
    const currentUser = await reddit.getCurrentUsername();
    if (currentUser) {
      potentialUsers.push(currentUser);
    }
    
    // Check each user's level list
    for (const username of potentialUsers) {
      const userKey = `hw:ulevels:user:${username}`;
      const levelIdsJson = await redis.get(userKey);
      
      if (!levelIdsJson) continue;
      
      try {
        const levelIds = JSON.parse(levelIdsJson);
        console.log(`Found ${levelIds.length} levels for user ${username}`);
        
        for (const levelId of levelIds) {
          const levelKey = `hw:ulevel:${levelId}`;
          const levelData = await redis.get(levelKey);
          
          if (!levelData) continue;
          
          const level = JSON.parse(levelData);
          const author = level.author || username;
          
          // Initialize or update creator stats
          if (!creatorStats[author]) {
            creatorStats[author] = {
              username: author,
              totalPlays: 0,
              totalUpvotes: 0,
              totalDownvotes: 0,
              totalShares: 0,
              levelCount: 0,
              lastUpdated: new Date().toISOString()
            };
          }
          
          // Count this level
          creatorStats[author].levelCount++;
          
          // Add stats from this level
          creatorStats[author].totalPlays += level.playCount || 0;
          creatorStats[author].totalUpvotes += level.upvotes || 0;
          creatorStats[author].totalDownvotes += level.downvotes || 0;
          creatorStats[author].totalShares += level.shares || 0;
        }
      } catch (err) {
        console.error(`Failed to process levels for ${username}:`, err);
      }
    }
    
    // Now save all creator stats to Redis
    const creatorKey = 'hw:leaderboard:creators';
    
    for (const [username, stats] of Object.entries(creatorStats)) {
      const dataKey = `${creatorKey}:data:${username}`;
      
      // Calculate creator score
      const creatorScore = 
        (stats.totalPlays * 10) +
        (stats.totalUpvotes * 50) -
        (stats.totalDownvotes * 20) +
        (stats.totalShares * 30) +
        (stats.levelCount * 100);
      
      // Update Redis
      await redis.zAdd(creatorKey, { score: creatorScore, member: username });
      await redis.set(dataKey, JSON.stringify(stats));
      
      console.log(`Migrated stats for ${username}: ${stats.levelCount} levels, score: ${creatorScore}`);
    }
    
    return res.json({ 
      success: true, 
      message: `Migrated ${Object.keys(creatorStats).length} creators`,
      creators: creatorStats
    });
  } catch (error) {
    console.error('Failed to migrate creator stats:', error);
    return res.status(500).json({ error: 'Failed to migrate creator stats' });
  }
});

export default router;