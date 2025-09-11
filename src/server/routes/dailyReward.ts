import express, { Request, Response } from 'express';
import { redis, context, reddit } from '@devvit/web/server';
import { z } from 'zod';
import { ApiErrorCode } from '../../shared/types/api';
import { makeRng } from '../../shared/utils/rng';

export interface DailyRewardData {
  lastClaimTime: number;
  totalSpins: number;
  lastPrize?: any;
  spinTokens: number;
  lastTokenGrant: number;
}

const router = express.Router();

// Wheel prize definitions (must match client IDs)
type PrizeDef = { id: string; type: 'coins' | 'hints' | 'bundle' | 'jackpot'; value: number; weight: number };
const PRIZES: PrizeDef[] = [
  { id: 'coins_50', type: 'coins', value: 50, weight: 30 },
  { id: 'coins_100', type: 'coins', value: 100, weight: 25 },
  { id: 'hints_reveal_2', type: 'hints', value: 2, weight: 15 },
  { id: 'coins_250', type: 'coins', value: 250, weight: 12 },
  { id: 'hints_target_2', type: 'hints', value: 2, weight: 8 },
  { id: 'bundle_premium', type: 'bundle', value: 1, weight: 6 },
  { id: 'coins_500', type: 'coins', value: 500, weight: 3 },
  { id: 'jackpot', type: 'jackpot', value: 1000, weight: 1 }
];

function weightedPick(prizes: PrizeDef[]): PrizeDef {
  const total = prizes.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of prizes) { r -= p.weight; if (r <= 0) return p; }
  return prizes[0];
}

function makeSpinKey(userId: string, spinId: string): string {
  return `daily_reward_spin:${userId}:${spinId}`;
}

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
      const TokensResponse = z.object({ spinTokens: z.number().int().nonnegative(), lastTokenGrant: z.number().int().nonnegative() });
      return res.json(TokensResponse.parse({ spinTokens: 1, lastTokenGrant: newData.lastTokenGrant }));
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
    
    const TokensResponse = z.object({ spinTokens: z.number().int().nonnegative(), lastTokenGrant: z.number().int().nonnegative() });
    return res.json(TokensResponse.parse({
      spinTokens: rewardData.spinTokens || 0,
      lastTokenGrant: rewardData.lastTokenGrant
    }));
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.status(500).json({ error: { code: ApiErrorCode.SERVER_ERROR, message: 'Failed to get tokens' } });
  }
});

/**
 * Start a server-authoritative spin: reserves a prize to be claimed.
 */
router.post('/api/daily-reward/spin', async (req: Request, res: Response) => {
  try {
    const userId = context.userId || 'anonymous';
    const key = `daily_reward:${userId}`;
    const data = await redis.get(key);
    let rewardData: DailyRewardData = data ? JSON.parse(data) : {
      lastClaimTime: 0,
      totalSpins: 0,
      spinTokens: 1,
      lastTokenGrant: Date.now()
    };

    if (!rewardData.spinTokens || rewardData.spinTokens <= 0) {
      return res.status(400).json({ error: { code: ApiErrorCode.VALIDATION_ERROR, message: 'No spin tokens available' } });
    }

    // Generate a spinId first
    const spinId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    // Deterministic RNG for auditing: seed with user + date + spinId
    const day = new Date().toISOString().slice(0, 10);
    const rng = makeRng(`${userId}|${day}|${spinId}`);
    // Seeded weighted pick
    const total = PRIZES.reduce((s, p) => s + p.weight, 0);
    let r = rng() * total;
    let prize = PRIZES[0];
    for (const p of PRIZES) { r -= p.weight; if (r <= 0) { prize = p; break; } }
    const spinKey = makeSpinKey(userId, spinId);
    await redis.set(spinKey, JSON.stringify({
      prizeId: prize.id,
      type: prize.type,
      value: prize.value,
      used: false,
      createdAt: Date.now(),
    }), { ex: 600 }); // 10 minutes

    return res.json({ spinId, prizeId: prize.id });
  } catch (error) {
    console.error('Error starting spin:', error);
    res.status(500).json({ error: { code: ApiErrorCode.SERVER_ERROR, message: 'Failed to start spin' } });
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
    res.status(500).json({ error: { code: ApiErrorCode.SERVER_ERROR, message: 'Failed to grant test token' } });
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
    res.status(500).json({ error: { code: ApiErrorCode.SERVER_ERROR, message: 'Failed to grant token' } });
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
    
    const CheckResponse = z.object({
      canClaim: z.boolean(),
      lastClaimTime: z.number().optional(),
      totalSpins: z.number().int().nonnegative().optional()
    });

    if (!data) {
      const payload = { canClaim: true };
      return res.json(CheckResponse.parse(payload));
    }

    const rewardData: DailyRewardData = JSON.parse(data);
    const payload = {
      canClaim: true, // Let client decide based on time
      lastClaimTime: rewardData.lastClaimTime,
      totalSpins: rewardData.totalSpins || 0
    };
    return res.json(CheckResponse.parse(payload));
  } catch (error) {
    console.error('Error checking daily reward:', error);
    res.status(500).json({ error: { code: ApiErrorCode.SERVER_ERROR, message: 'Failed to check daily reward' } });
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
    const ClaimBodySchema = z.object({
      spinId: z.string().min(1).optional(),
      prize: z
        .object({
          id: z.string(),
          type: z.enum(['coins', 'hints', 'bundle', 'jackpot']),
          value: z.number().int().nonnegative(),
        })
        .optional(),
    }).refine((d) => !!d.spinId || !!d.prize, { message: 'spinId or prize required' });
    const parsed = ClaimBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: ApiErrorCode.VALIDATION_ERROR, message: 'Invalid claim body', details: parsed.error.errors } });
    }
    const { spinId, prize } = parsed.data;
    
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
      return res.status(400).json({ error: { code: ApiErrorCode.VALIDATION_ERROR, message: 'No spin tokens available' } });
    }
    
    const now = Date.now();
    
    // Determine final prize
    let finalPrize: any = prize;
    if (spinId) {
      const spinKey = makeSpinKey(userId, spinId);
      const spinRaw = await redis.get(spinKey);
      if (!spinRaw) {
        return res.status(400).json({ error: { code: ApiErrorCode.VALIDATION_ERROR, message: 'Invalid or expired spin token' } });
      }
      const spin = JSON.parse(spinRaw) as { prizeId: string; type: string; value: number; used: boolean; createdAt: number };
      if (spin.used) {
        return res.status(409).json({ error: { code: ApiErrorCode.VALIDATION_ERROR, message: 'Spin token already used' } });
      }
      const def = PRIZES.find(p => p.id === spin.prizeId);
      if (!def) {
        return res.status(400).json({ error: { code: ApiErrorCode.VALIDATION_ERROR, message: 'Unknown prize' } });
      }
      finalPrize = { id: def.id, type: def.type, value: def.value };
      // Mark used (idempotent)
      spin.used = true;
      await redis.set(spinKey, JSON.stringify(spin), { ex: 60 });
    } else if (!prize) {
      return res.status(400).json({ error: { code: ApiErrorCode.VALIDATION_ERROR, message: 'Missing prize or spinId' } });
    }

    // Update reward data - consume a token
    rewardData.lastClaimTime = now;
    rewardData.totalSpins = (rewardData.totalSpins || 0) + 1;
    rewardData.lastPrize = finalPrize;
    rewardData.spinTokens = (rewardData.spinTokens || 1) - 1; // Consume token
    
    // Save with 30 day expiry
    await redis.set(key, JSON.stringify(rewardData), { ex: 2592000 });
    
    // Apply the reward based on type
    if (finalPrize.type === 'coins' || finalPrize.type === 'jackpot') {
      // Add coins to user's balance
      // Use the same key format as the coins endpoint
      const coinsKey = username ? `hw:coins:${username}` : `coins:${userId}`;
      const coinsData = await redis.get(coinsKey);
      
      if (coinsData) {
        const coins = JSON.parse(coinsData);
        coins.balance = (coins.balance || 0) + finalPrize.value;
        coins.totalEarned = (coins.totalEarned || 0) + finalPrize.value;
        await redis.set(coinsKey, JSON.stringify(coins));
      } else {
        // Initialize coins if not exists
        await redis.set(coinsKey, JSON.stringify({
          balance: 200 + finalPrize.value,
          totalEarned: 200 + finalPrize.value,
          totalSpent: 0,
          lastUpdated: now
        }));
      }
    } else if (finalPrize.type === 'hints') {
      // Add hints to user's inventory
      // Use the same key format as the hints endpoint
      const hintsKey = username ? `hw:hints:${username}` : `hints:${userId}`;
      const hintsData = await redis.get(hintsKey);
      
      if (hintsData) {
        const hints = JSON.parse(hintsData);
        if ((finalPrize.id as string).includes('target')) {
          hints.targetHints = (hints.targetHints || 0) + finalPrize.value;
        } else {
          hints.revealHints = (hints.revealHints || 0) + finalPrize.value;
        }
        await redis.set(hintsKey, JSON.stringify(hints));
      } else {
        // Initialize hints if not exists
        const newHints = {
          revealHints: (finalPrize.id as string).includes('target') ? 5 : 5 + finalPrize.value,
          targetHints: (finalPrize.id as string).includes('target') ? 3 + finalPrize.value : 3,
          freeReveals: 5,
          freeTargets: 3,
          lastUpdated: now
        };
        await redis.set(hintsKey, JSON.stringify(newHints));
      }
    } else if (finalPrize.type === 'bundle') {
      // Apply bundle rewards - x3 reveal hints + x2 target hints (premium bundle)
      const hintsKey = username ? `hw:hints:${username}` : `hints:${userId}`;
      
      const hintsData = await redis.get(hintsKey);
      const hints = hintsData ? JSON.parse(hintsData) : { revealHints: 5, targetHints: 3, freeReveals: 5, freeTargets: 3 };
      
      hints.revealHints += 3;
      hints.targetHints += 2;
      hints.lastUpdated = now;
      
      await redis.set(hintsKey, JSON.stringify(hints));
    }
    
    return res.json({
      success: true,
      prize: finalPrize,
      totalSpins: rewardData.totalSpins
    });
  } catch (error) {
    console.error('Error claiming daily reward:', error);
    res.status(500).json({ error: { code: ApiErrorCode.SERVER_ERROR, message: 'Failed to claim reward' } });
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
    
    const HistoryResponse = z.object({
      lastClaimTime: z.number().int().nonnegative(),
      totalSpins: z.number().int().nonnegative(),
      lastPrize: z.any().optional(),
      spinTokens: z.number().int().nonnegative().optional(),
      lastTokenGrant: z.number().int().nonnegative().optional()
    });

    if (!data) {
      return res.json(HistoryResponse.parse({
        lastClaimTime: 0,
        totalSpins: 0
      }));
    }

    return res.json(HistoryResponse.parse(JSON.parse(data)));
  } catch (error) {
    console.error('Error getting reward history:', error);
    res.status(500).json({ error: { code: ApiErrorCode.SERVER_ERROR, message: 'Failed to get reward history' } });
  }
});

export default router;
