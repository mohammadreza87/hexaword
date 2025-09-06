import express from 'express';
import { context, reddit } from '@devvit/web/server';

export const gameRouter = express.Router();

type GameInitResponse = {
  type: 'game_init';
  postId: string;
  username: string;
  seed: string;
  words: string[];
};

// Simple, static word list for now; replace with server-side generation/dictionary.
const DEFAULT_WORDS = ['LOG', 'EGO', 'GEL', 'OLD', 'LEG', 'GOD', 'DOG', 'LODE', 'GOLD', 'LODGE'];

gameRouter.get<unknown, GameInitResponse | { status: string; message: string }>(
  '/api/game/init',
  async (_req, res): Promise<void> => {
    try {
      const { postId } = context;
      if (!postId) {
        res.status(400).json({ status: 'error', message: 'postId is required' });
        return;
      }

      const username = (await reddit.getCurrentUsername()) ?? 'anonymous';
      // Seed could be derived from postId + day for determinism; keep simple for now.
      const seed = postId;

      res.json({
        type: 'game_init',
        postId,
        username,
        seed,
        words: DEFAULT_WORDS,
      });
    } catch (err) {
      res.status(400).json({ status: 'error', message: 'Failed to init game' });
    }
  }
);

