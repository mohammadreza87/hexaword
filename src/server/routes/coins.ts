import express from 'express';
import { reddit, redis, context } from '@devvit/web/server';

const router = express.Router();

type CoinData = {
  balance: number;
  totalEarned: number;
  totalSpent: number;
  lastUpdated: number;
};

const COIN_KEY_PREFIX = 'hw:coins:';

// Resolve a per-user coin key. Prefer Reddit username; fallback to Devvit context.userId.
const getCoinKey = async (): Promise<string | null> => {
  try {
    const username = await reddit.getCurrentUsername();
    if (username) return `${COIN_KEY_PREFIX}${username}`;
  } catch {}
  const userId = context.userId;
  if (userId) return `coins:${userId}`;
  return null;
};

// Get current user's coin balance
router.get('/api/coins', async (_req, res) => {
  try {
    const key = await getCoinKey();
    if (!key) {
      return res.status(401).json({ status: 'error', message: 'unauthorized' });
    }
    
    const raw = await redis.get(key);
    
    if (!raw) {
      // New user starts with 100 coins
      const initialData: CoinData = {
        balance: 100,
        totalEarned: 100,
        totalSpent: 0,
        lastUpdated: Date.now()
      };
      await redis.set(key, JSON.stringify(initialData));
      return res.json(initialData);
    }
    
    const coinData: CoinData = JSON.parse(raw);
    return res.json(coinData);
  } catch (e) {
    console.error('Error fetching coins:', e);
    return res.status(500).json({ status: 'error', message: 'failed to load coins' });
  }
});

// Update coin balance
router.post('/api/coins', async (req, res) => {
  try {
    const key = await getCoinKey();
    if (!key) {
      return res.status(401).json({ status: 'error', message: 'unauthorized' });
    }
    
    const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    
    // Get current data
    const currentRaw = await redis.get(key);
    let currentData: CoinData = currentRaw ? JSON.parse(currentRaw) : {
      balance: 100,
      totalEarned: 100,
      totalSpent: 0,
      lastUpdated: Date.now()
    };
    
    // Update based on the action
    if (body.action === 'add') {
      const amount = Number(body.amount) || 0;
      currentData.balance += amount;
      currentData.totalEarned += amount;
    } else if (body.action === 'spend') {
      const amount = Number(body.amount) || 0;
      console.log(`Spend request: ${amount} coins. Current balance: ${currentData.balance}`);
      if (currentData.balance < amount) {
        console.log(`Insufficient coins: ${currentData.balance} < ${amount}`);
        return res.status(400).json({ 
          status: 'error', 
          message: 'insufficient coins',
          balance: currentData.balance 
        });
      }
      currentData.balance -= amount;
      currentData.totalSpent += amount;
      console.log(`Spend successful. New balance: ${currentData.balance}`);
    } else if (body.action === 'set') {
      // Direct set (used for syncing)
      currentData.balance = Number(body.balance) || currentData.balance;
      currentData.totalEarned = Number(body.totalEarned) || currentData.totalEarned;
      currentData.totalSpent = Number(body.totalSpent) || currentData.totalSpent;
    }
    
    currentData.lastUpdated = Date.now();
    
    // Save updated data
    await redis.set(key, JSON.stringify(currentData));
    
    return res.json(currentData);
  } catch (e) {
    console.error('Error updating coins:', e);
    return res.status(500).json({ status: 'error', message: 'failed to update coins' });
  }
});

// Check if user can afford something
router.post('/api/coins/check', async (req, res) => {
  try {
    const key = await getCoinKey();
    if (!key) {
      return res.status(401).json({ status: 'error', message: 'unauthorized' });
    }
    
    const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const cost = Number(body.cost) || 0;
    
    const raw = await redis.get(key);
    const coinData: CoinData = raw ? JSON.parse(raw) : {
      balance: 100,
      totalEarned: 100,
      totalSpent: 0,
      lastUpdated: Date.now()
    };
    
    return res.json({
      canAfford: coinData.balance >= cost,
      balance: coinData.balance,
      cost
    });
  } catch (e) {
    console.error('Error checking coins:', e);
    return res.status(500).json({ status: 'error', message: 'failed to check coins' });
  }
});

export default router;
