import { 
  GameInitResponse, 
  validateGameInitResponse,
  ApiErrorResponse,
  isApiErrorResponse,
  ApiErrorCode 
} from '../../shared/types/api';

// Exponential backoff retry configuration
interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2
};

class ApiError extends Error {
  constructor(
    message: string,
    public code: ApiErrorCode | string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Response> {
  let lastError: Error | undefined;
  let delay = retryConfig.initialDelay;
  
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }
      
      // Retry on server errors (5xx) or network issues
      if (!response.ok && attempt < retryConfig.maxRetries) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < retryConfig.maxRetries) {
        // Wait with exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * retryConfig.backoffFactor, retryConfig.maxDelay);
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms delay`);
      }
    }
  }
  
  throw lastError || new Error('Request failed after retries');
}

export async function getGameInit(level: number = 1): Promise<GameInitResponse> {
  // IMPORTANT: Use a relative path so Devvit's sandbox/proxy can route requests
  // Building with window.location.origin breaks on reddit.com and yields 404 HTML
  const url = `/api/game/init?level=${encodeURIComponent(level)}`;
  
  try {
    const res = await fetchWithRetry(url, { method: 'GET' });
    
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      
      if (isApiErrorResponse(data)) {
        throw new ApiError(
          data.error.message,
          data.error.code,
          res.status,
          data.error.details
        );
      }
      
      throw new ApiError(
        `Request failed with status ${res.status}`,
        ApiErrorCode.SERVER_ERROR,
        res.status
      );
    }
    
    // Guard against HTML error pages (e.g., reddit.com 404) by checking content-type
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw new ApiError('Invalid response content type', ApiErrorCode.INVALID_RESPONSE, res.status);
    }
    const data = await res.json();
    return validateGameInitResponse(data);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new ApiError('Request timeout', ApiErrorCode.TIMEOUT);
      }
      throw new ApiError(error.message, ApiErrorCode.NETWORK_ERROR);
    }
    
    throw new ApiError('Unknown error occurred', ApiErrorCode.NETWORK_ERROR);
  }
}

export async function fetchGameDataWithFallback(
  level: number = 1,
  onError?: (error: Error) => void
): Promise<{
  seed: string;
  words: string[];
  postId: string;
  level: number | string;
  clue?: string;
  name?: string;
  author?: string;
  levelId?: string;
  shareType?: string;
  letters?: string[];
  palette?: string;
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
      level: (init.level as number | string) ?? level,
      clue: init.clue,
      name: init.name,
      author: init.author,
      levelId: init.levelId,
      shareType: init.shareType,
      letters: init.letters,
      palette: init.palette,
    };
  } catch (error) {
    // Log error for debugging
    console.warn('Failed to fetch game data from server:', error);
    
    // Notify caller about the error
    if (onError) {
      const message = error instanceof ApiError 
        ? `Server unavailable: ${error.message}. Playing offline mode.`
        : 'Unable to connect to server. Playing offline mode.';
      onError(new Error(message));
    }
    
    // Return fallback data for offline play
    return {
      seed: getLocalSeed(),
      words: defaultWords,
      postId: 'local',
      level,
      clue: 'RANDOM MIX',
      shareType: undefined,
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
