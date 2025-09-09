import express from 'express';
import { context, reddit, redis } from '@devvit/web/server';

const router = express.Router();

type Progress = {
  level: number;
  completedLevels?: number[];
  seed?: string;
  updatedAt: number;
};

const keyForUser = async (): Promise<string | null> => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) return null;
    return `hw:progress:${username}`;
  } catch {
    return null;
  }
};

// Get current user's progress
router.get('/api/progress', async (_req, res) => {
  try {
    const key = await keyForUser();
    if (!key) return res.status(401).json({ status: 'error', message: 'unauthorized' });
    const raw = await redis.get(key);
    if (!raw) return res.json({ level: 1, completedLevels: [], updatedAt: 0 });
    const parsed: Progress = JSON.parse(raw);
    return res.json(parsed);
  } catch (e) {
    return res.status(500).json({ status: 'error', message: 'failed to load progress' });
  }
});

// Save current user's progress
router.post('/api/progress', async (req, res) => {
  try {
    const key = await keyForUser();
    if (!key) return res.status(401).json({ status: 'error', message: 'unauthorized' });
    const body = (typeof req.body === 'string') ? JSON.parse(req.body) : req.body;
    const progress: Progress = {
      level: Number(body?.level) || 1,
      completedLevels: Array.isArray(body?.completedLevels) ? body.completedLevels : [],
      seed: typeof body?.seed === 'string' ? body.seed : undefined,
      updatedAt: Date.now(),
    };
    await redis.set(key, JSON.stringify(progress));
    return res.status(204).end();
  } catch (e) {
    return res.status(500).json({ status: 'error', message: 'failed to save progress' });
  }
});

export default router;

