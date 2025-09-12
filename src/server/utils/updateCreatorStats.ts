import { redis } from '@devvit/web/server';

interface CreatorStats {
  username: string;
  totalPlays: number;
  totalUpvotes: number;
  totalDownvotes: number;
  totalShares: number;
  levelCount: number;
  lastUpdated: string;
}

export async function updateCreatorStats(
  creatorUsername: string, 
  action: 'play' | 'upvote' | 'downvote' | 'share' | 'create' | 'delete',
  levelId?: string
): Promise<void> {
  try {
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
    const creatorScore = 
      (stats.totalPlays * 10) +
      (stats.totalUpvotes * 50) -
      (stats.totalDownvotes * 20) +
      (stats.totalShares * 30) +
      (stats.levelCount * 100);
    
    // Update Redis
    await redis.zAdd(creatorKey, { score: creatorScore, member: creatorUsername });
    await redis.set(dataKey, JSON.stringify(stats));
    
    console.log(`Updated creator stats for ${creatorUsername}: action=${action}, score=${creatorScore}`);
  } catch (error) {
    console.error('Failed to update creator stats:', error);
  }
}