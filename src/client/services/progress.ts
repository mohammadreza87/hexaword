export type Progress = {
  level: number;
  completedLevels: number[];
  seed?: string;
  updatedAt: number;
};

const LS_KEY = 'hexaword_progress_v1';

export function loadLocalProgress(): Progress | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (typeof p?.level !== 'number') return null;
    return {
      level: p.level,
      completedLevels: Array.isArray(p.completedLevels) ? p.completedLevels : [],
      seed: typeof p.seed === 'string' ? p.seed : undefined,
      updatedAt: Number(p.updatedAt) || 0,
    };
  } catch {
    return null;
  }
}

export function saveLocalProgress(progress: Progress): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(progress));
  } catch {}
}

export async function fetchRemoteProgress(): Promise<Progress | null> {
  try {
    const res = await fetch('/api/progress', { method: 'GET', credentials: 'include' });
    if (!res.ok) return null;
    
    // Check if response is JSON before parsing
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      throw new Error('Server returned non-JSON response');
    }
    
    const data = await res.json();
    if (typeof data?.level !== 'number') return null;
    return {
      level: data.level,
      completedLevels: Array.isArray(data.completedLevels) ? data.completedLevels : [],
      seed: typeof data.seed === 'string' ? data.seed : undefined,
      updatedAt: Number(data.updatedAt) || Date.now(),
    };
  } catch {
    return null;
  }
}

export async function saveRemoteProgress(progress: Progress): Promise<boolean> {
  try {
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(progress),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Merge strategy: prefer the more recent update based on updatedAt
export function mergeProgress(a: Progress | null, b: Progress | null): Progress | null {
  if (a && b) return a.updatedAt >= b.updatedAt ? a : b;
  return a || b;
}

