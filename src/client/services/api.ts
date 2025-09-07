import { GameInitResponse, isGameInitResponse } from '../../shared/types/api';

export async function getGameInit(level: number = 1): Promise<GameInitResponse> {
  const url = new URL('/api/game/init', window.location.origin);
  url.searchParams.set('level', String(level));
  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) {
    throw new Error(`init request failed: ${res.status}`);
  }
  const data = await res.json();
  if (!isGameInitResponse(data)) {
    throw new Error('init response invalid shape');
  }
  return data;
}

export async function fetchGameDataWithFallback(level: number = 1): Promise<{
  seed: string;
  words: string[];
  postId: string;
  level: number;
  clue?: string;
}> {
  const defaultWords = [
    'GOLFER', 'ATHLETE', 'CAPTAIN', 'PAINTER', 'DESIGNER',
    'DIRECTOR', 'MAGICIAN', 'MUSICIAN', 'BALLERINA', 'PLAYWRIGHT'
  ];

  try {
    const init = await getGameInit(level);
    return {
      seed: init.seed || getLocalSeed(),
      words: init.words?.length ? init.words : defaultWords,
      postId: init.postId || 'unknown',
      level: init.level ?? level,
      clue: init.clue,
    };
  } catch (e) {
    return {
      seed: getLocalSeed(),
      words: defaultWords,
      postId: 'local',
      level,
      clue: 'RANDOM MIX',
    };
  }
}

function getLocalSeed(): string {
  const key = 'hexaword_local_seed';
  let seed = localStorage.getItem(key);
  if (!seed) {
    const today = new Date().toISOString().slice(0, 10);
    seed = `local_${today}`;
    localStorage.setItem(key, seed);
  }
  return seed;
}
