import express, { Request, Response } from 'express';
import { redis, context, reddit } from '@devvit/web/server';

export interface DailyRewardData {
  lastClaimTime: number;
  totalSpins: number;
  lastPrize?: any;
  spinTokens: number;
  lastTokenGrant: number;
}

const router = express.Router();

/**
 * Get user's spin tokens
 */
router.get('/api/daily-reward/tokens', async (req: Request, res: Response) => {
  try {
    const userId = context.userId || 'anonymous';
    const key = `daily_reward:${userId}`;
    
    const data = await redis.get(key);
    
    if (!data) {
      // New user gets 1 free token
      const newData: DailyRewardData = {
        lastClaimTime: 0,
        totalSpins: 0,
        spinTokens: 1,
        lastTokenGrant: Date.now()
      };
      await redis.set(key, JSON.stringify(newData), { ex: 2592000 });
      return res.json({ spinTokens: 1, lastTokenGrant: newData.lastTokenGrant });
    }
    
    const rewardData: DailyRewardData = JSON.parse(data);
    
    // Check if 24 hours passed for daily token
    const now = Date.now();
    const timeSinceGrant = now - (rewardData.lastTokenGrant || 0);
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    if (!rewardData.lastTokenGrant || timeSinceGrant >= twentyFourHours) {
      // Grant daily token
      rewardData.spinTokens = (rewardData.spinTokens || 0) + 1;
      rewardData.lastTokenGrant = now;
      await redis.set(key, JSON.stringify(rewardData), { ex: 2592000 });
    }
    
    return res.json({
      spinTokens: rewardData.spinTokens || 0,
      lastTokenGrant: rewardData.lastTokenGrant
    });
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.status(500).json({ error: 'Failed to get tokens' });
  }
});

/**
 * Grant a test token (for development)
 */
router.post('/api/daily-reward/grant-test-token', async (req: Request, res: Response) => {
  try {
    const userId = context.userId || 'anonymous';
    const key = `daily_reward:${userId}`;
    
    const data = await redis.get(key);
    let rewardData: DailyRewardData = data ? JSON.parse(data) : {
      lastClaimTime: 0,
      totalSpins: 0,
      spinTokens: 0,
      lastTokenGrant: 0
    };
    
    // Always grant a test token for development
    rewardData.spinTokens = (rewardData.spinTokens || 0) + 1;
    await redis.set(key, JSON.stringify(rewardData), { ex: 2592000 });
    
    return res.json({ success: true, tokens: rewardData.spinTokens });
  } catch (error) {
    console.error('Error granting test token:', error);
    res.status(500).json({ error: 'Failed to grant test token' });
  }
});

/**
 * Grant a daily token
 */
router.post('/api/daily-reward/grant-token', async (req: Request, res: Response) => {
  try {
    const userId = context.userId || 'anonymous';
    const key = `daily_reward:${userId}`;
    
    const data = await redis.get(key);
    let rewardData: DailyRewardData = data ? JSON.parse(data) : {
      lastClaimTime: 0,
      totalSpins: 0,
      spinTokens: 0,
      lastTokenGrant: 0
    };
    
    const now = Date.now();
    const timeSinceGrant = now - (rewardData.lastTokenGrant || 0);
    const twentyFourHours = 24 * 60 * 60 * 1000;
    
    if (!rewardData.lastTokenGrant || timeSinceGrant >= twentyFourHours) {
      rewardData.spinTokens = (rewardData.spinTokens || 0) + 1;
      rewardData.lastTokenGrant = now;
      await redis.set(key, JSON.stringify(rewardData), { ex: 2592000 });
      return res.json({ success: true, tokens: rewardData.spinTokens });
    }
    
    return res.status(400).json({ 
      error: 'Token already granted today',
      timeRemaining: twentyFourHours - timeSinceGrant
    });
  } catch (error) {
    console.error('Error granting token:', error);
    res.status(500).json({ error: 'Failed to grant token' });
  }
});

/**
 * Check if user can claim daily reward
 */
router.get('/api/daily-reward/check', async (req: Request, res: Response) => {
  try {
    const userId = context.userId || 'anonymous';
    const key = `daily_reward:${userId}`;
    
    const data = await redis.get(key);
    
    if (!data) {
      return res.json({ canClaim: true });
    }
    
    const rewardData: DailyRewardData = JSON.parse(data);
    return res.json({
      canClaim: true, // Let client decide based on time
      lastClaimTime: rewardData.lastClaimTime,
      totalSpins: rewardData.totalSpins || 0
    });
  } catch (error) {
    console.error('Error checking daily reward:', error);
    res.status(500).json({ error: 'Failed to check daily reward' });
  }
});

/**
 * Claim daily reward
 */
router.post('/api/daily-reward/claim', async (req: Request, res: Response) => {
  try {
    const userId = context.userId || 'anonymous';
    let username: string | null = null;
    
    try {
      username = await reddit.getCurrentUsername();
    } catch (err) {
      console.log('Could not get Reddit username:', err);
    }
    
    const key = `daily_reward:${userId}`;
    const { prize } = req.body;
    
    // Get current data
    const currentData = await redis.get(key);
    let rewardData: DailyRewardData;
    
    if (!currentData) {
      // Initialize new user with 1 token
      rewardData = {
        lastClaimTime: 0,
        totalSpins: 0,
        spinTokens: 1,
        lastTokenGrant: Date.now()
      };
      await redis.set(key, JSON.stringify(rewardData), { ex: 2592000 });
    } else {
      rewardData = JSON.parse(currentData);
      // Make sure spinTokens is initialized
      if (rewardData.spinTokens === undefined) {
        rewardData.spinTokens = 1;
      }
    }
    
    // Check if user has tokens
    if (!rewardData.spinTokens || rewardData.spinTokens <= 0) {
      return res.status(400).json({ 
        error: 'No spin tokens available'
      });
    }
    
    const now = Date.now();
    
    // Update reward data - consume a token
    rewardData.lastClaimTime = now;
    rewardData.totalSpins = (rewardData.totalSpins || 0) + 1;
    rewardData.lastPrize = prize;
    rewardData.spinTokens = (rewardData.spinTokens || 1) - 1; // Consume token
    
    // Save with 30 day expiry
    await redis.set(key, JSON.stringify(rewardData), { ex: 2592000 });
    
    // Apply the reward based on type
    if (prize.type === 'coins') {
      // Add coins to user's balance
      // Use the same key format as the coins endpoint
      const coinsKey = username ? `hw:coins:${username}` : `coins:${userId}`;
      const coinsData = await redis.get(coinsKey);
      
      if (coinsData) {
        const coins = JSON.parse(coinsData);
        coins.balance = (coins.balance || 0) + prize.value;
        coins.totalEarned = (coins.totalEarned || 0) + prize.value;
        await redis.set(coinsKey, JSON.stringify(coins));
      } else {
        // Initialize coins if not exists
        await redis.set(coinsKey, JSON.stringify({
          balance: 100 + prize.value,
          totalEarned: 100 + prize.value,
          totalSpent: 0,
          lastUpdated: now
        }));
      }
    } else if (prize.type === 'hints') {
      // Add hints to user's inventory
      // Use the same key format as the hints endpoint
      const hintsKey = username ? `hw:hints:${username}` : `hints:${userId}`;
      const hintsData = await redis.get(hintsKey);
      
      if (hintsData) {
        const hints = JSON.parse(hintsData);
        if (prize.id.includes('target')) {
          hints.targetHints = (hints.targetHints || 0) + prize.value;
        } else {
          hints.revealHints = (hints.revealHints || 0) + prize.value;
        }
        await redis.set(hintsKey, JSON.stringify(hints));
      } else {
        // Initialize hints if not exists
        const newHints = {
          revealHints: prize.id.includes('target') ? 4 : 4 + prize.value,
          targetHints: prize.id.includes('target') ? 4 + prize.value : 4,
          freeReveals: 4,
          freeTargets: 4,
          lastUpdated: now
        };
        await redis.set(hintsKey, JSON.stringify(newHints));
      }
    } else if (prize.type === 'bundle') {
      // Apply bundle rewards - x2 reveal hints + x2 target hints (no coins)
      const hintsKey = username ? `hw:hints:${username}` : `hints:${userId}`;
      
      const hintsData = await redis.get(hintsKey);
      const hints = hintsData ? JSON.parse(hintsData) : { revealHints: 4, targetHints: 4, freeReveals: 4, freeTargets: 4 };
      
      hints.revealHints += 2;
      hints.targetHints += 2;
      hints.lastUpdated = now;
      
      await redis.set(hintsKey, JSON.stringify(hints));
    } else if (prize.type === 'jackpot') {
      // Jackpot! Add 1000 coins
      const coinsKey = username ? `hw:coins:${username}` : `coins:${userId}`;
      const coinsData = await redis.get(coinsKey);
      const coins = coinsData ? JSON.parse(coinsData) : { balance: 100, totalEarned: 100, totalSpent: 0 };
      coins.balance += 1000;
      coins.totalEarned += 1000;
      coins.lastUpdated = Date.now();
      await redis.set(coinsKey, JSON.stringify(coins));
    }
    
    return res.json({
      success: true,
      prize,
      totalSpins: rewardData.totalSpins
    });
  } catch (error) {
    console.error('Error claiming daily reward:', error);
    res.status(500).json({ error: 'Failed to claim reward' });
  }
});

/**
 * Get daily reward history
 */
router.get('/api/daily-reward/history', async (req: Request, res: Response) => {
  try {
    const userId = context.userId || 'anonymous';
    const key = `daily_reward:${userId}`;
    
    const data = await redis.get(key);
    
    if (!data) {
      return res.json({
        lastClaimTime: 0,
        totalSpins: 0
      });
    }
    
    return res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error getting reward history:', error);
    res.status(500).json({ error: 'Failed to get reward history' });
  }
});

export default router;