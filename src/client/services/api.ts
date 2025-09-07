import { GameInitResponse, isGameInitResponse } from '../../shared/types/api';

export async function getGameInit(): Promise<GameInitResponse> {
  const res = await fetch('/api/game/init', { method: 'GET' });
  if (!res.ok) {
    throw new Error(`init request failed: ${res.status}`);
  }
  const data = await res.json();
  if (!isGameInitResponse(data)) {
    throw new Error('init response invalid shape');
  }
  return data;
}

export async function fetchGameDataWithFallback(): Promise<{
  seed: string;
  words: string[];
  postId: string;
}> {
  const defaultWords = [
    'GOLFER', 'ATHLETE', 'CAPTAIN', 'PAINTER', 'DESIGNER',
    'DIRECTOR', 'MAGICIAN', 'MUSICIAN', 'BALLERINA', 'PLAYWRIGHT'
  ];

  try {
    const init = await getGameInit();
    return {
      seed: init.seed || getLocalSeed(),
      words: init.words?.length ? init.words : defaultWords,
      postId: init.postId || 'unknown',
    };
  } catch (e) {
    return {
      seed: getLocalSeed(),
      words: defaultWords,
      postId: 'local',
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
