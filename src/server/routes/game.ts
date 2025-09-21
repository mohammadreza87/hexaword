import express from 'express';
import { context, reddit, redis } from '@devvit/web/server';
import {
  GameInitResponse,
  ApiErrorResponse,
  ApiErrorCode,
  GameInitResponseSchema
} from '../../shared/types/api';
import { LevelSelector } from '../services/LevelSelector';
import { LevelRepository } from '../services/LevelRepository';
import { Logger, asyncHandler } from '../middleware/errorHandler';
import {
  SHARED_LEVEL_REDIS_KEY_PREFIX,
  type SharedLevelPostRecord
} from '../utils/levelShare';

export const gameRouter = express.Router();
const logger = Logger.getInstance();

// Simple, static word list for now; replace with server-side generation/dictionary.
const DEFAULT_WORDS = ['LOG', 'EGO', 'GEL', 'OLD', 'LEG', 'GOD', 'DOG', 'LODE', 'GOLD', 'LODGE'];

/**
 * Validates that words array is valid
 */
function validateWords(words: unknown): string[] {
  if (!Array.isArray(words)) {
    throw new Error('Words must be an array');
  }
  
  const validWords = words.filter(w => 
    typeof w === 'string' && 
    w.length >= 2 && 
    /^[A-Z]+$/i.test(w)
  ).map(w => w.toUpperCase());
  
  if (validWords.length === 0) {
    throw new Error('No valid words provided');
  }
  
  return validWords;
}

/**
 * Creates error response with proper envelope
 */
function createErrorResponse(code: ApiErrorCode, message: string, details?: unknown): ApiErrorResponse {
  return {
    error: {
      code,
      message,
      details
    }
  };
}

gameRouter.get<unknown, GameInitResponse | ApiErrorResponse>(
  '/api/game/init',
  asyncHandler(async (req, res): Promise<void> => {
    const requestId = (req as any).requestId;
    const { postId } = context;
    
    // Validate context
    if (!postId) {
      logger.error('Missing postId in context', undefined, { requestId });
      res.status(400).json(
        createErrorResponse(
          ApiErrorCode.VALIDATION_ERROR,
          'PostId is required but not found in context'
        )
      );
      return;
    }

    logger.info('Processing game init request', { requestId, postId });

    // Get username (optional, don't fail if unavailable)
    let username = 'anonymous';
    try {
      username = (await reddit.getCurrentUsername()) ?? 'anonymous';
    } catch (err) {
      logger.warn('Failed to get username', undefined, { requestId, error: err });
      // Continue with anonymous
    }

    // Check if this post is a shared user level
    const sharedKey = `${SHARED_LEVEL_REDIS_KEY_PREFIX}${postId}`;
    const sharedData = await redis.get(sharedKey);
    if (sharedData) {
      const record = JSON.parse(sharedData) as SharedLevelPostRecord;
      const sharedResponse: GameInitResponse = {
        type: 'game_init',
        postId,
        username,
        seed: record.seed || `shared:${record.levelId}`,
        words: record.words,
        level: record.levelId,
        clue: record.clue,
        createdAt: record.sharedAt,
        name: record.name,
        author: record.author,
        levelId: record.levelId,
        shareType: 'user-level',
        letters: record.letters,
        palette: record.palette
      } as GameInitResponse;

      const validation = GameInitResponseSchema.safeParse(sharedResponse);
      if (!validation.success) {
        logger.error('Shared level response validation failed', undefined, {
          requestId,
          errors: validation.error.errors
        });
        res.status(500).json(
          createErrorResponse(
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to load shared level'
          )
        );
        return;
      }

      res.json(validation.data);
      return;
    }

      // Determine requested level (default 1)
      const levelParam = Number((req.query?.level as string) ?? '1');
      const level = Number.isFinite(levelParam) && levelParam > 0 ? Math.floor(levelParam) : 1;

      // Deterministic seed: postId + level (optionally add date for daily cycles)
      const seed = `${postId}:${level}`;

      // Prefer CSV/JSON repository entries (we use levels.json), fallback to deterministic selection
      const levelRepo = LevelRepository.getInstance();
      const csvLevel = levelRepo.getLevel(level);

      let words: string[];
      let derivedClue: string | undefined;
      if (csvLevel) {
        // Use the level's exact words/clue as defined in the data file
        words = csvLevel.words.map((w) => w.toUpperCase());
        derivedClue = csvLevel.clue;
      } else {
        // Fallback: pick deterministically from the global pool (kept for compatibility)
        const selector = new LevelSelector();
        const selection = selector.pickWords(seed, 6);
        words = selection.words;
        derivedClue = selection.clue;
      }

      // Validate words
      try {
        validateWords(words);
      } catch (err) {
        logger.error('Word validation failed', err as Error, { requestId, postId });
        res.status(500).json(
          createErrorResponse(
            ApiErrorCode.SERVER_ERROR,
            'Failed to prepare word list',
            { originalError: err instanceof Error ? (err as Error).message : 'Unknown error' }
          )
        );
        return;
      }

      // Create response
      const response: GameInitResponse = {
        type: 'game_init',
        postId,
        username,
        seed,
        words,
        level,
        clue: derivedClue,
        createdAt: new Date().toISOString(),
      };
      
      // Validate response with Zod schema
      const validationResult = GameInitResponseSchema.safeParse(response);
      if (!validationResult.success) {
        logger.error('Response validation failed', undefined, { 
          requestId, 
          errors: validationResult.error.errors 
        });
        res.status(500).json(
          createErrorResponse(
            ApiErrorCode.INTERNAL_ERROR,
            'Failed to generate valid response'
          )
        );
        return;
      }
      
      logger.info('Game init successful', { 
        requestId, 
        postId, 
        level, 
        seed,
        wordCount: words.length 
      });
      
      res.json(validationResult.data);
  })
);
