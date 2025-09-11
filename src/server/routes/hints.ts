import express, { Request, Response } from 'express';
import { redis, reddit } from '@devvit/web/server';

export interface HintData {
  revealHints: number;
  targetHints: number;
  freeReveals: number;
  freeTargets: number;
  lastUpdated: number;
}

const router = express.Router();

/**
 * Get hint inventory for a user
 */
router.get('/api/hints', async (req: Request, res: Response) => {
  try {
    const username = await reddit.getCurrentUsername();
    const key = username ? `hw:hints:${username}` : `hints:anonymous`;
    
    const data = await redis.get(key);
    
    if (!data) {
      // New user - one-time free hints (constant economy)
      const initialData: HintData = {
        revealHints: 2,
        targetHints: 2,
        freeReveals: 0,
        freeTargets: 0,
        lastUpdated: Date.now()
      };
      
      await redis.set(key, JSON.stringify(initialData));
      return res.json(initialData);
    }
    
    return res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error loading hints:', error);
    res.status(500).json({ error: 'Failed to load hints' });
  }
});

/**
 * Update hint inventory
 */
router.post('/api/hints', async (req: Request, res: Response) => {
  try {
    const username = await reddit.getCurrentUsername();
    const key = username ? `hw:hints:${username}` : `hints:anonymous`;
    const { action, hintType, count } = req.body;
    
    // Get current data
    const currentData = await redis.get(key);
    let hints: HintData;
    
    if (!currentData) {
      hints = {
        revealHints: 2,
        targetHints: 2,
        freeReveals: 0,
        freeTargets: 0,
        lastUpdated: Date.now()
      };
    } else {
      hints = JSON.parse(currentData);
    }
    
    // Handle different actions
    switch (action) {
      case 'use': {
        // Server-authoritative spend before consuming a hint (constant pricing)
        const cost = hintType === 'reveal' ? 50 : 100;
        const coinKey = username ? `hw:coins:${username}` : null;
        if (!coinKey) {
          return res.status(401).json({ error: 'unauthorized' });
        }
        const coinRaw = await redis.get(coinKey);
        let coins = coinRaw ? JSON.parse(coinRaw) : { balance: 100, totalEarned: 100, totalSpent: 0, lastUpdated: Date.now() };
        if (coins.balance < cost) {
          return res.status(400).json({ error: 'insufficient_coins', balance: coins.balance, cost });
        }
        if (hintType === 'reveal') {
          if (hints.revealHints <= 0) return res.status(400).json({ error: 'no_reveal_hints' });
          hints.revealHints--;
        } else if (hintType === 'target') {
          if (hints.targetHints <= 0) return res.status(400).json({ error: 'no_target_hints' });
          hints.targetHints--;
        }
        coins.balance -= cost;
        coins.totalSpent += cost;
        coins.lastUpdated = Date.now();
        await redis.set(coinKey, JSON.stringify(coins));
        break;
      }
        
      case 'add':
        if (hintType === 'reveal') {
          hints.revealHints += count || 1;
        } else if (hintType === 'target') {
          hints.targetHints += count || 1;
        }
        break;
        
      case 'set':
        // Set inventory directly
        if (req.body.revealHints !== undefined) {
          hints.revealHints = req.body.revealHints;
        }
        if (req.body.targetHints !== undefined) {
          hints.targetHints = req.body.targetHints;
        }
        break;
        
      case 'reset':
        // Reset to initial state (constant economy defaults)
        hints = {
          revealHints: 2,
          targetHints: 2,
          freeReveals: 0,
          freeTargets: 0,
          lastUpdated: Date.now()
        };
        break;
    }
    
    hints.lastUpdated = Date.now();
    await redis.set(key, JSON.stringify(hints));
    
    return res.json(hints);
  } catch (error) {
    console.error('Error updating hints:', error);
    res.status(500).json({ error: 'Failed to update hints' });
  }
});

export default router;
