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
      console.log(`[HINT] No existing data for ${key}, creating default`);
      hints = {
        revealHints: 2,
        targetHints: 2,
        freeReveals: 0,
        freeTargets: 0,
        lastUpdated: Date.now()
      };
    } else {
      try {
        hints = JSON.parse(currentData);
        // Ensure all fields exist and are numbers
        if (typeof hints.revealHints !== 'number') hints.revealHints = 0;
        if (typeof hints.targetHints !== 'number') hints.targetHints = 0;
        if (typeof hints.freeReveals !== 'number') hints.freeReveals = 0;
        if (typeof hints.freeTargets !== 'number') hints.freeTargets = 0;
        console.log(`[HINT] Loaded data for ${key}:`, hints);
      } catch (e) {
        console.error(`[HINT ERROR] Failed to parse data for ${key}:`, currentData, e);
        hints = {
          revealHints: 2,
          targetHints: 2,
          freeReveals: 0,
          freeTargets: 0,
          lastUpdated: Date.now()
        };
      }
    }
    
    // Handle different actions
    switch (action) {
      case 'use': {
        // Consume one hint from inventory if available (no coin charge here).
        console.log(`[HINT USE] Type: ${hintType}, Current inventory before use:`, hints);
        if (hintType === 'reveal') {
          if (hints.revealHints <= 0) {
            console.log(`[HINT ERROR] No reveal hints available. Count: ${hints.revealHints}`);
            return res.status(400).json({ error: 'no_reveal_hints' });
          }
          hints.revealHints--;
          console.log(`[HINT SUCCESS] Reveal hint used. New count: ${hints.revealHints}`);
        } else if (hintType === 'target') {
          if (hints.targetHints <= 0) {
            console.log(`[HINT ERROR] No target hints available. Count: ${hints.targetHints}`);
            return res.status(400).json({ error: 'no_target_hints' });
          }
          hints.targetHints--;
          console.log(`[HINT SUCCESS] Target hint used. New count: ${hints.targetHints}`);
        }
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
    const dataToSave = JSON.stringify(hints);
    console.log(`[HINT SAVE] Saving to ${key}:`, dataToSave);
    await redis.set(key, dataToSave);
    
    console.log(`[HINT RESPONSE] Returning:`, hints);
    return res.json(hints);
  } catch (error) {
    console.error('Error updating hints:', error);
    res.status(500).json({ error: 'Failed to update hints' });
  }
});

export default router;
