import express, { Request, Response } from 'express';
import { reddit, redis, context } from '@devvit/web/server';
import { z } from 'zod';

// Minimal profanity blocklist (expand as needed)
const PROFANITY = [
  'fuck', 'shit', 'bitch', 'cunt', 'asshole', 'nigger', 'faggot', 'slut', 'whore'
];

type UserLevelRecord = {
  id: string;
  author: string;
  name?: string;
  clue: string;
  words: string[];
  seed: string;
  generatorVersion: string;
  createdAt: string;
  visibility: 'private' | 'public';
  status: 'active' | 'pending' | 'rejected';
};

const router = express.Router();

// ------- Validation Schemas -------
const CreateLevelSchema = z.object({
  name: z.string().min(3).max(30).optional(),
  clue: z.string().min(3).max(30),
  words: z
    .array(z.string().min(2).max(8))
    .min(1)
    .max(6)
});

function hasProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return PROFANITY.some((word) => lower.includes(word));
}

function normalizeWord(w: string): string {
  return (w || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
}

function buildId(): string {
  return `ul_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getUserKey(username?: string | null): string {
  return username ? `hw:ulevels:user:${username}` : `hw:ulevels:user:anonymous`;
}

// Try simple solvability: ensure words share at least one common letter overall
function basicSolvability(words: string[]): boolean {
  const sets = words.map((w) => new Set(w.split('')));
  const all = new Set<string>();
  for (const s of sets) for (const ch of s) all.add(ch);
  // Each word should share a letter with at least one other
  for (let i = 0; i < sets.length; i++) {
    let shares = false;
    for (let j = 0; j < sets.length; j++) {
      if (i === j) continue;
      for (const ch of sets[i]) {
        if (sets[j].has(ch)) { shares = true; break; }
      }
      if (shares) break;
    }
    if (!shares) return false;
  }
  return true;
}

// ------- Routes -------

// Create a user level
router.post('/api/user-levels', async (req: Request, res: Response) => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    const parsed = CreateLevelSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid payload', details: parsed.error.errors } });
    }

    const clue = parsed.data.clue.trim();
    const name = parsed.data.name?.trim();
    const wordsNorm = Array.from(
      new Set(parsed.data.words.map(normalizeWord).filter((w) => w.length >= 2))
    );

    if (hasProfanity(clue) || (name && hasProfanity(name)) || wordsNorm.some(hasProfanity)) {
      return res.status(400).json({ error: { code: 'CONTENT_REJECTED', message: 'Content contains inappropriate words' } });
    }

    if (wordsNorm.length < 1 || wordsNorm.length > 6) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Must provide between 1 and 6 words' } });
    }

    // Basic solvability check
    if (!basicSolvability(wordsNorm)) {
      return res.status(400).json({ error: { code: 'UNSOLVABLE', message: 'Words do not share enough letters for intersections' } });
    }

    // Assign id and seed
    const id = buildId();
    const seed = `ulevel:${username}:${id}`;
    const record: UserLevelRecord = {
      id,
      author: username,
      name,
      clue: clue,
      words: wordsNorm,
      seed,
      generatorVersion: '1',
      createdAt: new Date().toISOString(),
      visibility: 'private',
      status: 'active'
    };

    // Persist
    await redis.set(`hw:ulevel:${id}`, JSON.stringify(record));
    await redis.rpush(getUserKey(username), id);

    return res.json(record);
  } catch (err) {
    console.error('Create user level failed', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create level' } });
  }
});

// List current user's levels (last N)
router.get('/api/user-levels/mine', async (_req: Request, res: Response) => {
  try {
    const username = await reddit.getCurrentUsername();
    if (!username) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }
    const key = getUserKey(username);
    const ids = await redis.lrange(key, -50, -1); // latest up to 50
    const levels: UserLevelRecord[] = [];
    for (const id of ids) {
      const raw = await redis.get(`hw:ulevel:${id}`);
      if (raw) levels.push(JSON.parse(raw));
    }
    // Return newest first
    levels.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return res.json({ levels });
  } catch (err) {
    console.error('List user levels failed', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to load user levels' } });
  }
});

// Init payload for playing a user level (compatible with /api/game/init)
router.get('/api/user-levels/:id/init', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const raw = await redis.get(`hw:ulevel:${id}`);
    if (!raw) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Level not found' } });
    const level: UserLevelRecord = JSON.parse(raw);
    const postId = context.postId || 'custom';
    const username = (await reddit.getCurrentUsername()) || 'anonymous';
    return res.json({
      type: 'game_init',
      postId,
      username,
      seed: level.seed,
      words: level.words,
      level: 'custom',
      clue: level.clue,
      createdAt: level.createdAt
    });
  } catch (err) {
    console.error('User level init failed', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to init level' } });
  }
});

export default router;
