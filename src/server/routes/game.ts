import express from 'express';
import { context, reddit } from '@devvit/web/server';
import { 
  GameInitResponse, 
  ApiErrorResponse, 
  ApiErrorCode,
  GameInitResponseSchema 
} from '../../shared/types/api';
import { LevelSelector } from '../services/LevelSelector';
import { LevelRepository } from '../services/LevelRepository';
import { getCuratedForLevel } from '../services/CuratedLevels';
import { Logger, asyncHandler } from '../middleware/errorHandler';

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
      
      // Determine requested level (default 1)
      const levelParam = Number((req.query?.level as string) ?? '1');
      const level = Number.isFinite(levelParam) && levelParam > 0 ? Math.floor(levelParam) : 1;

      // Deterministic seed: postId + level (optionally add date for daily cycles)
      const seed = `${postId}:${level}`;

      // Curated progression: map any level N onto a curated set via deterministic shuffle
      const curated = getCuratedForLevel(level);
      let words: string[] = curated.words;
      let derivedClue: string | undefined = curated.clue;

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
