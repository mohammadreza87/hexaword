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
      // New user - give them free hints
      const initialData: HintData = {
        revealHints: 5,
        targetHints: 3,
        freeReveals: 5,
        freeTargets: 3,
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
        revealHints: 5,
        targetHints: 3,
        freeReveals: 5,
        freeTargets: 3,
        lastUpdated: Date.now()
      };
    } else {
      hints = JSON.parse(currentData);
    }
    
    // Handle different actions
    switch (action) {
      case 'use':
        if (hintType === 'reveal' && hints.revealHints > 0) {
          hints.revealHints--;
        } else if (hintType === 'target' && hints.targetHints > 0) {
          hints.targetHints--;
        }
        break;
        
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
        // Reset to initial state
        hints = {
          revealHints: 5,
          targetHints: 3,
          freeReveals: 5,
          freeTargets: 3,
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