import express, { Request, Response } from 'express';
import { reddit, redis, context } from '@devvit/web/server';
import { z } from 'zod';
import { updateCreatorStats } from '../utils/updateCreatorStats';

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
  // Stats
  playCount?: number;
  upvotes?: number;
  downvotes?: number;
  shares?: number;
  // Unique user tracking
  playedBy?: string[];
  upvotedBy?: string[];
  downvotedBy?: string[];
  sharedBy?: string[];
};

type StoredUserLevelRecord = Omit<UserLevelRecord, 'status'> & {
  status?: UserLevelRecord['status'];
};

function normalizeLevelRecord(level: StoredUserLevelRecord): UserLevelRecord {
  return {
    ...level,
    status: level.status ?? 'active'
  };
}

const router = express.Router();

// ------- Validation Schemas -------
const CreateLevelSchema = z.object({
  name: z.string().min(1).max(30).optional(),  // Allow shorter names
  clue: z.string().min(3).max(30),
  words: z
    .array(z.string().min(2).max(12))  // Match client's 12 char limit
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

function parseJsonArray<T>(value?: string | null): T[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('Failed to parse JSON array', err);
    return [];
  }
}

async function rebuildGlobalLevelIndex(): Promise<{ ids: string[]; levelMap: Map<string, UserLevelRecord> }> {
  const discoveredLevels = new Map<string, UserLevelRecord>();
  const globalIndexKey = 'hw:ulevels:global:index';
  const userIndexKey = 'hw:ulevels:user:index';

  const usernames = new Set<string>();
  const userIndex = parseJsonArray<string>(await redis.get(userIndexKey));
  for (const name of userIndex) {
    if (typeof name === 'string' && name.trim().length > 0) {
      usernames.add(name.trim());
    }
  }

  // Always consider anonymous levels as a fallback
  usernames.add('anonymous');

  // Attempt to augment with creator leaderboard entries if available
  try {
    const creatorEntries = await redis.zRange('hw:leaderboard:creators', 0, -1);
    for (const entry of creatorEntries || []) {
      const creator = typeof entry === 'string' ? entry : entry?.member;
      if (typeof creator === 'string' && creator.trim().length > 0) {
        usernames.add(creator.trim());
      }
    }
  } catch (err) {
    console.warn('Failed to fetch creator leaderboard during global index rebuild', err);
  }

  for (const username of usernames) {
    const userKey = getUserKey(username === 'anonymous' ? null : username);
    const levelIds = parseJsonArray<string>(await redis.get(userKey));
    for (const id of levelIds) {
      if (typeof id !== 'string' || id.trim().length === 0) continue;
      const levelKey = `hw:ulevel:${id}`;
      const rawLevel = await redis.get(levelKey);
      if (!rawLevel) continue;
      try {
        const record = JSON.parse(rawLevel) as UserLevelRecord;
        if (record && record.id) {
          discoveredLevels.set(record.id, record);
        }
      } catch (err) {
        console.warn(`Failed to parse level ${id} while rebuilding global index`, err);
      }
    }
  }

  const orderedLevels = Array.from(discoveredLevels.values()).sort((a, b) => {
    const aTime = new Date(a.createdAt ?? 0).getTime();
    const bTime = new Date(b.createdAt ?? 0).getTime();
    return aTime - bTime;
  });

  const ids = orderedLevels.map((level) => level.id);

  if (ids.length > 0) {
    await redis.set(globalIndexKey, JSON.stringify(ids));
  }

  return { ids, levelMap: new Map(orderedLevels.map((level) => [level.id, level])) };
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
    console.log('Create level request body:', req.body);
    
    const username = await reddit.getCurrentUsername();
    console.log('Current username:', username);
    
    if (!username) {
      // For development, use a default username if not authenticated
      console.log('No username found, using anonymous for dev');
    }
    
    const effectiveUsername = username || 'anonymous';

    const parsed = CreateLevelSchema.safeParse(req.body);
    if (!parsed.success) {
      console.error('Validation failed:', parsed.error.errors);
      // Format error messages for better readability
      const errorMessages = parsed.error.errors.map(err => 
        `${err.path.join('.')}: ${err.message}`
      ).join(', ');
      return res.status(400).json({ 
        error: { 
          code: 'VALIDATION_ERROR', 
          message: errorMessages || 'Invalid payload', 
          details: parsed.error.errors 
        } 
      });
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
    const seed = `ulevel:${effectiveUsername}:${id}`;
    const record: UserLevelRecord = {
      id,
      author: effectiveUsername,
      name,
      clue: clue,
      words: wordsNorm,
      seed,
      generatorVersion: '1',
      createdAt: new Date().toISOString(),
      visibility: 'private',
      status: 'active',
      // Initialize stats
      playCount: 0,
      upvotes: 0,
      downvotes: 0,
      shares: 0,
      // Initialize unique user tracking
      playedBy: [],
      upvotedBy: [],
      downvotedBy: [],
      sharedBy: []
    };

    // Persist with error handling
    console.log('Saving level with ID:', id);
    try {
      // Store level data
      const levelKey = `hw:ulevel:${id}`;
      const userKey = getUserKey(effectiveUsername);
      
      console.log('Storing level at key:', levelKey);
      await redis.set(levelKey, JSON.stringify(record));
      
      // Instead of rpush, use a different approach - store as JSON array
      console.log('Adding to user list:', userKey);
      const idList = parseJsonArray<string>(await redis.get(userKey));
      idList.push(id);
      await redis.set(userKey, JSON.stringify(idList));

      // Track all users with levels so we can rebuild global indices if needed
      const userIndexKey = 'hw:ulevels:user:index';
      const userIndex = parseJsonArray<string>(await redis.get(userIndexKey));
      if (!userIndex.includes(effectiveUsername)) {
        userIndex.push(effectiveUsername);
        await redis.set(userIndexKey, JSON.stringify(userIndex));
      }

      // Also add to global index for explore feature
      const globalIndexKey = 'hw:ulevels:global:index';
      const globalIds = parseJsonArray<string>(await redis.get(globalIndexKey));
      globalIds.push(id);
      await redis.set(globalIndexKey, JSON.stringify(globalIds));

      console.log('Level saved successfully');
      
      // Update creator stats
      await updateCreatorStats(effectiveUsername, 'create');
    } catch (redisErr) {
      console.error('Redis operation failed:', redisErr);
      console.error('Redis error details:', {
        message: redisErr?.message,
        stack: redisErr?.stack,
        name: redisErr?.name
      });
      return res.status(500).json({ 
        error: { 
          code: 'STORAGE_ERROR', 
          message: 'Failed to save level to storage',
          details: redisErr?.message || 'Unknown Redis error'
        } 
      });
    }

    return res.json(record);
  } catch (err) {
    console.error('Create user level failed:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to create level', details: err.message } });
  }
});

// Migration helper to backfill missing status properties on stored levels
router.post('/api/user-levels/migrate-status', async (_req: Request, res: Response) => {
  try {
    const globalIndexKey = 'hw:ulevels:global:index';
    const globalIdsJson = await redis.get(globalIndexKey);

    if (!globalIdsJson) {
      return res.json({
        success: true,
        message: 'No global index found',
        total: 0,
        updated: 0
      });
    }

    const globalIds: string[] = JSON.parse(globalIdsJson);
    let processed = 0;
    let updated = 0;

    for (const id of globalIds) {
      const levelKey = `hw:ulevel:${id}`;
      const raw = await redis.get(levelKey);
      if (!raw) continue;

      try {
        const storedLevel = JSON.parse(raw) as StoredUserLevelRecord;
        processed += 1;
        if (storedLevel.status == null) {
          const normalized = normalizeLevelRecord(storedLevel);
          await redis.set(levelKey, JSON.stringify(normalized));
          updated += 1;
        }
      } catch (parseErr) {
        console.error(`Failed to migrate level ${id}:`, parseErr);
      }
    }

    return res.json({
      success: true,
      message: 'Migration complete',
      total: processed,
      updated
    });
  } catch (err) {
    console.error('Status migration failed:', err);
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to migrate level statuses',
        details: err.message
      }
    });
  }
});

// Explore levels - search and filter functionality
router.get('/api/user-levels/explore', async (req: Request, res: Response) => {
  try {
    const { search, filter = 'latest' } = req.query;

    // For now, we'll fetch recent levels from a global index
    // First, let's maintain a global index of all levels
    const globalIndexKey = 'hw:ulevels:global:index';
    let globalIds = parseJsonArray<string>(await redis.get(globalIndexKey));
    let cachedLevels: Map<string, UserLevelRecord> | undefined;

    console.log('Global index has', globalIds.length, 'levels');

    if (globalIds.length === 0) {
      console.log('Global index empty - attempting rebuild from existing levels');
      const rebuildResult = await rebuildGlobalLevelIndex();
      globalIds = rebuildResult.ids;
      cachedLevels = rebuildResult.levelMap;
      console.log('Rebuilt global index with', globalIds.length, 'levels');

      if (globalIds.length === 0) {
        console.log('No levels discovered during rebuild, returning empty result');
        return res.json({ levels: [], total: 0 });
      }
    }

    // Fetch all levels (limit to 100 for performance)
    const maxLevels = 100;
    const recentIds = globalIds.slice(-maxLevels).reverse(); // Most recent first

    const allLevels: UserLevelRecord[] = [];
    for (const id of recentIds) {
      try {
        let levelData: UserLevelRecord | undefined;
        if (cachedLevels?.has(id)) {
          levelData = cachedLevels.get(id);
        } else {
          const raw = await redis.get(`hw:ulevel:${id}`);
          if (raw) {
            levelData = JSON.parse(raw);
          }
        }

        if (levelData) {
        const raw = await redis.get(`hw:ulevel:${id}`);
        if (raw) {
          const level = normalizeLevelRecord(JSON.parse(raw));
          // Only include public/active levels
          if (levelData.status === 'active') {
            allLevels.push(levelData);
          }
        }
      } catch (parseErr) {
        console.error(`Failed to parse level ${id}:`, parseErr);
      }
    }

    // Apply search filter if provided
    let filteredLevels = allLevels;
    if (search && typeof search === 'string') {
      const searchLower = search.toLowerCase();
      filteredLevels = allLevels.filter(level => {
        // Search in username, level name, clue, words, and code
        const nameMatch = level.name?.toLowerCase().includes(searchLower);
        const authorMatch = level.author?.toLowerCase().includes(searchLower);
        const clueMatch = level.clue?.toLowerCase().includes(searchLower);
        const wordsMatch = level.words.some(word => word.toLowerCase().includes(searchLower));
        const codeMatch = level.id?.toLowerCase().includes(searchLower);

        return nameMatch || authorMatch || clueMatch || wordsMatch || codeMatch;
      });
    }

    // Apply sorting based on filter
    switch (filter) {
      case 'popular':
        // Sort by play count and upvotes
        filteredLevels.sort((a, b) => {
          const scoreA = (a.playCount || 0) + (a.upvotes || 0) * 2;
          const scoreB = (b.playCount || 0) + (b.upvotes || 0) * 2;
          return scoreB - scoreA;
        });
        break;
      case 'latest':
      default:
        // Already sorted by most recent
        filteredLevels.sort((a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
    }

    // Add computed fields
    const levelsWithStats = filteredLevels.map(level => ({
      ...level,
      code: level.id.slice(-6), // Show last 6 chars as code
      completions: Math.floor((level.playCount || 0) * 0.7), // Estimate completions
      difficulty: level.words.length <= 3 ? 'easy' : level.words.length <= 4 ? 'medium' : 'hard'
    }));

    return res.json({
      levels: levelsWithStats.slice(0, 50), // Limit response to 50 levels
      total: levelsWithStats.length
    });
  } catch (err) {
    console.error('Explore levels failed:', err);
    return res.status(500).json({
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to fetch levels',
        details: err.message
      }
    });
  }
});

// List current user's levels (last N) - MUST BE BEFORE /:id route
router.get('/api/user-levels/mine', async (_req: Request, res: Response) => {
  try {
    const username = await reddit.getCurrentUsername();
    const effectiveUsername = username || 'anonymous';

    const key = getUserKey(effectiveUsername);
    console.log('Fetching user levels for key:', key);
    
    // Get the JSON array of level IDs
    const idsJson = await redis.get(key);
    if (!idsJson) {
      console.log('No levels found for user:', effectiveUsername);
      return res.json({ levels: [] });
    }
    
    const ids = JSON.parse(idsJson);
    console.log('Found level IDs:', ids);
    
    // Get only the latest 50
    const latestIds = ids.slice(-50);
    
    const levels: UserLevelRecord[] = [];
    for (const id of latestIds) {
      try {
        const raw = await redis.get(`hw:ulevel:${id}`);
        if (raw) {
          const parsed = normalizeLevelRecord(JSON.parse(raw));
          levels.push(parsed);
        }
      } catch (parseErr) {
        console.error(`Failed to parse level ${id}:`, parseErr);
      }
    }
    
    // Return newest first
    levels.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return res.json({ levels });
  } catch (err) {
    console.error('List user levels failed:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to load user levels', details: err.message } });
  }
});

// Get a specific level by ID (for sharing) - MUST BE AFTER /mine route
router.get('/api/user-levels/:id/preview', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const levelKey = `hw:ulevel:${id}`;
    const raw = await redis.get(levelKey);

    if (!raw) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Level not found' } });
    }

    const level: UserLevelRecord = JSON.parse(raw);
    const allLetters = (level.words || []).join('').split('');
    const uniqueLetters = Array.from(new Set(allLetters)).sort();

    return res.json({
      level: {
        id: level.id,
        name: level.name,
        clue: level.clue,
        author: level.author,
        words: level.words || [],
        shares: level.shares || 0,
        createdAt: level.createdAt,
        uniqueLetters,
        letterBank: allLetters
      }
    });
    
    const level = normalizeLevelRecord(JSON.parse(raw));
    
    // Increment play count when level is accessed
    level.playCount = (level.playCount || 0) + 1;
    await redis.set(levelKey, JSON.stringify(level));
    
    return res.json({ level });
  } catch (err) {
    console.error('Preview user level failed:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to preview level' } });
  }
});

router.get('/api/user-levels/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const levelKey = `hw:ulevel:${id}`;
    const raw = await redis.get(levelKey);
    
    if (!raw) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Level not found' } });
    }
    
    const level = normalizeLevelRecord(JSON.parse(raw));
    
    // Increment play count when level is accessed
    level.playCount = (level.playCount || 0) + 1;
    await redis.set(levelKey, JSON.stringify(level));
    
    return res.json({ level });
  } catch (err) {
    console.error('Get user level failed:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to load level' } });
  }
});

// Track share for a user level
// Delete a user level
router.delete('/api/user-levels/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const username = await reddit.getCurrentUsername();
    
    if (!username) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Must be logged in to delete levels' } });
    }
    
    // Get the level to verify ownership
    const levelKey = `hw:ulevel:${id}`;
    const raw = await redis.get(levelKey);
    
    if (!raw) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Level not found' } });
    }
    
    const level = normalizeLevelRecord(JSON.parse(raw));
    
    // Check if user owns this level
    if (level.author !== username) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only delete your own levels' } });
    }
    
    // Delete the level
    await redis.del(levelKey);
    
    // Remove from user's level list
    const userKey = getUserKey(username);
    const existingIds = await redis.get(userKey);
    if (existingIds) {
      const idList = JSON.parse(existingIds);
      const filteredList = idList.filter((levelId: string) => levelId !== id);
      await redis.set(userKey, JSON.stringify(filteredList));
    }
    
    console.log(`Deleted level ${id} for user ${username}`);
    
    // Update creator stats
    await updateCreatorStats(username, 'delete');
    
    return res.status(204).end();
  } catch (err) {
    console.error('Delete user level failed:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to delete level' } });
  }
});

// Vote on a user level (allows changing vote)
router.post('/api/user-levels/:id/vote', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { type } = req.body; // 'up' or 'down'
    
    if (type !== 'up' && type !== 'down') {
      return res.status(400).json({ error: { code: 'INVALID_VOTE', message: 'Vote type must be "up" or "down"' } });
    }
    
    const username = await reddit.getCurrentUsername();
    const currentUser = username || `anon_${req.ip}`;
    
    const levelKey = `hw:ulevel:${id}`;
    const raw = await redis.get(levelKey);
    
    if (!raw) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Level not found' } });
    }
    
    const level = normalizeLevelRecord(JSON.parse(raw));
    
    // Initialize arrays if not present
    if (!level.upvotedBy) level.upvotedBy = [];
    if (!level.downvotedBy) level.downvotedBy = [];
    
    // Check if user already voted
    const hasUpvoted = level.upvotedBy.includes(currentUser);
    const hasDownvoted = level.downvotedBy.includes(currentUser);
    
    // Allow changing vote: remove from opposite list if present
    if (type === 'up') {
      // If already upvoted, do nothing
      if (hasUpvoted) {
        return res.json({ 
          success: true, 
          message: 'Already upvoted',
          upvotes: level.upvotes, 
          downvotes: level.downvotes 
        });
      }
      // Remove from downvotes if present
      if (hasDownvoted) {
        level.downvotedBy = level.downvotedBy.filter(u => u !== currentUser);
        level.downvotes = level.downvotedBy.length;
      }
      // Add to upvotes
      level.upvotedBy.push(currentUser);
      level.upvotes = level.upvotedBy.length;
      
      // Update creator stats
      if (level.author) {
        await updateCreatorStats(level.author, 'upvote', id);
      }
    } else {
      // If already downvoted, do nothing
      if (hasDownvoted) {
        return res.json({ 
          success: true, 
          message: 'Already downvoted',
          upvotes: level.upvotes, 
          downvotes: level.downvotes 
        });
      }
      // Remove from upvotes if present
      if (hasUpvoted) {
        level.upvotedBy = level.upvotedBy.filter(u => u !== currentUser);
        level.upvotes = level.upvotedBy.length;
      }
      // Add to downvotes
      level.downvotedBy.push(currentUser);
      level.downvotes = level.downvotedBy.length;
      
      // Update creator stats
      if (level.author) {
        await updateCreatorStats(level.author, 'downvote', id);
      }
    }
    
    await redis.set(levelKey, JSON.stringify(level));
    
    return res.json({ 
      success: true, 
      message: type === 'up' ? 'Upvoted' : 'Downvoted',
      upvotes: level.upvotes, 
      downvotes: level.downvotes 
    });
  } catch (err) {
    console.error('Vote on user level failed:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to vote on level' } });
  }
});

// Share a user level
router.post('/api/user-levels/:id/share', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    
    const username = await reddit.getCurrentUsername();
    const currentUser = username || `anon_${req.ip}`;
    
    const levelKey = `hw:ulevel:${id}`;
    const raw = await redis.get(levelKey);
    
    if (!raw) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Level not found' } });
    }
    
    const level = normalizeLevelRecord(JSON.parse(raw));
    
    // Initialize array if not present
    if (!level.sharedBy) level.sharedBy = [];
    
    // Track unique share
    let isNewShare = false;
    if (!level.sharedBy.includes(currentUser)) {
      level.sharedBy.push(currentUser);
      level.shares = level.sharedBy.length;
      await redis.set(levelKey, JSON.stringify(level));
      isNewShare = true;
    }
    
    // Update creator stats for new shares only
    if (isNewShare && level.author) {
      await updateCreatorStats(level.author, 'share', id);
    }
    
    return res.json({ 
      success: true, 
      shares: level.shares 
    });
  } catch (err) {
    console.error('Share user level failed:', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to share level' } });
  }
});

// Init payload for playing a user level (compatible with /api/game/init)
router.get('/api/user-levels/:id/init', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const levelKey = `hw:ulevel:${id}`;
    const raw = await redis.get(levelKey);
    if (!raw) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Level not found' } });
    const level = normalizeLevelRecord(JSON.parse(raw));
    
    // Get username first
    const username = (await reddit.getCurrentUsername()) || 'anonymous';
    
    // Track unique play (only count first play per user, but allow replays)
    const currentUser = username || `anon_${req.ip}`;
    let isNewPlay = false;
    if (!level.playedBy) level.playedBy = [];
    if (!level.playedBy.includes(currentUser)) {
      level.playedBy.push(currentUser);
      level.playCount = level.playedBy.length;
      await redis.set(levelKey, JSON.stringify(level));
      isNewPlay = true;
    }
    // User can replay the level, but play count stays the same
    
    // Update creator stats for new plays only
    if (isNewPlay && level.author) {
      await updateCreatorStats(level.author, 'play', id);
    }
    
    const postId = context.postId || 'custom';
    return res.json({
      type: 'game_init',
      postId,
      username,
      seed: level.seed,
      words: level.words,
      level: 'custom',
      clue: level.clue,
      name: level.name,
      author: level.author,
      createdAt: level.createdAt
    });
  } catch (err) {
    console.error('User level init failed', err);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to init level' } });
  }
});

export default router;
