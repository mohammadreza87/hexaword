import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@devvit/web/server', () => {
  const store = new Map<string, string>();

  const redisMock = {
    get: vi.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (key: string) => {
      const existed = store.delete(key);
      return existed ? 1 : 0;
    }),
    zAdd: vi.fn(),
    __reset: () => store.clear()
  };

  return {
    reddit: {
      getCurrentUsername: vi.fn(async () => 'test-user')
    },
    redis: redisMock,
    context: {}
  };
});

import router from '../server/routes/userLevels';
import { redis } from '@devvit/web/server';

type RouterLayer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: (req: unknown, res: unknown, next: () => void) => unknown }>;
  };
};

function getRouteHandler(path: string, method: string) {
  const stack = (router as unknown as { stack: RouterLayer[] }).stack;
  for (const layer of stack) {
    if (layer.route?.path === path && layer.route.methods?.[method.toLowerCase()]) {
      return layer.route.stack[0].handle;
    }
  }
  throw new Error(`Route handler not found for ${method.toUpperCase()} ${path}`);
}

describe('user level explore route', () => {
  const exploreHandler = getRouteHandler('/api/user-levels/explore', 'get');

  beforeEach(async () => {
    (redis as unknown as { __reset: () => void }).__reset();
    await redis.set('hw:ulevels:global:index', JSON.stringify([]));
  });

  it('treats missing status as active when returning explore results', async () => {
    const levelId = 'ul_test_level';
    const levelData = {
      id: levelId,
      author: 'alice',
      clue: 'Sample clue',
      words: ['alpha', 'beta'],
      seed: 'seed',
      generatorVersion: '1',
      createdAt: new Date().toISOString(),
      visibility: 'public'
    };

    await redis.set('hw:ulevels:global:index', JSON.stringify([levelId]));
    await redis.set(`hw:ulevel:${levelId}`, JSON.stringify(levelData));

    const req = { query: {} };
    const json = vi.fn((payload) => payload);
    const res = { json };

    await exploreHandler(req, res, () => {
      throw new Error('next should not be called');
    });

    expect(json).toHaveBeenCalledTimes(1);
    const payload = json.mock.calls[0][0];

    expect(payload.total).toBe(1);
    expect(payload.levels).toHaveLength(1);
    expect(payload.levels[0].status).toBe('active');
    expect(payload.levels[0].id).toBe(levelId);
  });
});
