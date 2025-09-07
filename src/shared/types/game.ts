export type GameInitResponse = {
  type: 'game_init';
  postId: string;
  username: string;
  seed: string;
  words: string[];
};

// Lightweight runtime validator (no external deps)
export function isGameInitResponse(data: unknown): data is GameInitResponse {
  if (!data || typeof data !== 'object') return false;
  const d: any = data;
  return (
    d.type === 'game_init' &&
    typeof d.postId === 'string' &&
    typeof d.username === 'string' &&
    typeof d.seed === 'string' &&
    Array.isArray(d.words) && d.words.every((w: any) => typeof w === 'string')
  );
}
