import express from 'express';
import { context, reddit } from '@devvit/web/server';
import { GameInitResponse, ApiErrorResponse, ApiErrorCode } from '../../shared/types/api';
import { LevelSelector } from '../services/LevelSelector';
import { LevelRepository } from '../services/LevelRepository';

export const gameRouter = express.Router();

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
  async (req, res): Promise<void> => {
    try {
      const { postId } = context;
      
      // Validate context
      if (!postId) {
        console.error('Missing postId in context');
        res.status(400).json(
          createErrorResponse(
            ApiErrorCode.VALIDATION_ERROR,
            'PostId is required but not found in context'
          )
        );
        return;
      }

      // Get username (optional, don't fail if unavailable)
      let username = 'anonymous';
      try {
        username = (await reddit.getCurrentUsername()) ?? 'anonymous';
      } catch (err) {
        console.warn('Failed to get username:', err);
        // Continue with anonymous
      }
      
      // Determine requested level (default 1)
      const levelParam = Number((req.query?.level as string) ?? '1');
      const level = Number.isFinite(levelParam) && levelParam > 0 ? Math.floor(levelParam) : 1;

      // Deterministic seed: postId + level (optionally add date for daily cycles)
      const seed = `${postId}:${level}`;

      // Try to source words from CSV row for this level; if missing, fallback to seeded picker
      const levelRepo = LevelRepository.getInstance();
      const csvLevel = levelRepo.getLevel(level);

      let words: string[];
      let derivedClue: string | undefined;
      if (csvLevel) {
        // Respect CSV flow: use its word count (capped at 6)
        const count = Math.min(6, csvLevel.numWords || csvLevel.words.length);
        // Deterministically shuffle the row's words with the seed and take first count
        const selector = new LevelSelector();
        const rowPick = selector.pickWords(seed, count, new Set());
        // But constrain to the row's word list only
        const rowSet = new Set(csvLevel.words);
        words = rowPick.words.filter(w => rowSet.has(w)).slice(0, count);
        // If for some reason filtering made it short, top up deterministically from row words
        if (words.length < count) {
          const topUp = csvLevel.words.filter(w => !words.includes(w)).slice(0, count - words.length);
          words = words.concat(topUp);
        }
        derivedClue = csvLevel.clue;
      } else {
        // Fallback: pick exactly 6 deterministically from the global pool
        const selector = new LevelSelector();
        const selection = selector.pickWords(seed, 6);
        words = selection.words;
        derivedClue = selection.clue;
      }

      // Validate words
      try {
        validateWords(words);
      } catch (err) {
        console.error('Word validation failed:', err);
        res.status(500).json(
          createErrorResponse(
            ApiErrorCode.SERVER_ERROR,
            'Failed to prepare word list',
            { originalError: err instanceof Error ? (err as Error).message : 'Unknown error' }
          )
        );
        return;
      }

      // Create and validate response
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
      
      console.log(`Game init successful for post ${postId}, level ${level}, seed: ${seed}`);
      res.json(response);
      
    } catch (err) {
      console.error('Unexpected error in game init:', err);
      
      res.status(500).json(
        createErrorResponse(
          ApiErrorCode.SERVER_ERROR,
          'An unexpected error occurred',
          { 
            error: err instanceof Error ? err.message : 'Unknown error',
            timestamp: new Date().toISOString()
          }
        )
      );
    }
  }
);
