
import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@devvit/web/server', () => {
  const globalAny = globalThis as Record<string, unknown>;
  const storeKey = '__hexawordTestRedisStore__';
  const store = (globalAny[storeKey] as Map<string, string> | undefined) ?? new Map<string, string>();
  globalAny[storeKey] = store;

  return {
    reddit: {
      getCurrentUsername: vi.fn()
    },
    context: {},
    redis: {
      get: vi.fn(async (key: string) => store.get(key)),
      set: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
        return 'OK';
      }),
      del: vi.fn(async (...keys: string[]) => {
        let removed = 0;
        for (const key of keys) {
          if (store.delete(key)) {
            removed++;
          }
        }
        return removed;
      }),
      zRange: vi.fn(async () => [])
    }
  };
});

import userLevelsRouter from '../server/routes/userLevels';
import { redis } from '@devvit/web/server';

function getRedisStore(): Map<string, string> {
  return (globalThis as Record<string, unknown>)['__hexawordTestRedisStore__'] as Map<string, string>;
}

describe('GET /api/user-levels/explore', () => {
  beforeEach(() => {
    getRedisStore().clear();
  });

  it('returns levels when global index is empty but level records exist', async () => {
    const levelId = 'ul_test_level';
    const createdAt = new Date().toISOString();
    const levelRecord = {
      id: levelId,
      author: 'test-user',
      name: 'Test Level',
      clue: 'Guess me',
      words: ['APPLE'],
      seed: 'seed:test-user',
      generatorVersion: '1',
      createdAt,
      visibility: 'public',
      status: 'active',
      playCount: 0,
      upvotes: 0,
      downvotes: 0,
      shares: 0
    };

    await redis.set(`hw:ulevel:${levelId}`, JSON.stringify(levelRecord));
    await redis.set('hw:ulevels:user:index', JSON.stringify(['test-user']));
    await redis.set('hw:ulevels:user:test-user', JSON.stringify([levelId]));
    await redis.set('hw:ulevels:global:index', JSON.stringify([]));

    const app = express();
    app.use(express.json());
    app.use(userLevelsRouter);

    const response = await request(app).get('/api/user-levels/explore');
    expect(response.status).toBe(200);
    expect(response.body.levels).toHaveLength(1);
    expect(response.body.levels[0].id).toBe(levelId);

    const warmedIndex = await redis.get('hw:ulevels:global:index');
    expect(JSON.parse(warmedIndex ?? '[]')).toEqual([levelId]);

  });
});
