import express from 'express';
import { context, reddit } from '@devvit/web/server';
import { GameInitResponse, ApiErrorResponse, ApiErrorCode } from '../../shared/types/api';

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
  async (_req, res): Promise<void> => {
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
      
      // Generate deterministic seed from postId
      // Could enhance with date for daily puzzles: `${postId}_${new Date().toISOString().split('T')[0]}`
      const seed = postId;
      
      // Validate words
      let words: string[];
      try {
        words = validateWords(DEFAULT_WORDS);
      } catch (err) {
        console.error('Word validation failed:', err);
        res.status(500).json(
          createErrorResponse(
            ApiErrorCode.SERVER_ERROR,
            'Failed to prepare word list',
            { originalError: err instanceof Error ? err.message : 'Unknown error' }
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
        createdAt: new Date().toISOString()
      };
      
      console.log(`Game init successful for post ${postId}, seed: ${seed}`);
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

