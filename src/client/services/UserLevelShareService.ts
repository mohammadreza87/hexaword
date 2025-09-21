export interface UserLevelShareOptions {
  levelId: string;
  levelName?: string;
  clue: string;
}

export interface UserLevelShareResult {
  postId: string;
  url: string;
  letters: string[];
  palette?: string;
}

export async function shareUserLevelToReddit(options: UserLevelShareOptions): Promise<UserLevelShareResult> {
  const title = options.levelName
    ? `Play "${options.levelName}" - HexaWord Community Level`
    : `HexaWord Community Level: ${options.clue}`;

  const response = await fetch('/api/share/user-level', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      levelId: options.levelId,
      title
    })
  });

  let data: any = null;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error('Server returned an unexpected response');
  }

  if (!response.ok || data?.status !== 'success') {
    throw new Error(data?.message || 'Failed to publish level');
  }

  // Track the share for creator stats, but ignore failures
  try {
    await fetch(`/api/user-levels/${encodeURIComponent(options.levelId)}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.warn('Failed to track level share:', err);
  }

  return {
    postId: data.postId,
    url: data.url,
    letters: data.letters ?? [],
    palette: data?.splash?.palette
  };
}
