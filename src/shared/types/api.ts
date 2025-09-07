export type InitResponse = {
  type: "init";
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: "increment";
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: "decrement";
  postId: string;
  count: number;
};

// ============= Game API Types =============

export interface GameInitRequest {
  postId?: string;
  subredditId?: string;
}

export interface GameInitResponse {
  type: 'game_init';
  postId: string;
  seed: string;
  words: string[];
  username?: string;
  createdAt?: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ============= Type Guards =============

export function isGameInitResponse(data: unknown): data is GameInitResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  
  return (
    obj.type === 'game_init' &&
    typeof obj.postId === 'string' &&
    typeof obj.seed === 'string' &&
    Array.isArray(obj.words) &&
    obj.words.every((w: unknown) => typeof w === 'string')
  );
}

export function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  
  return (
    typeof obj.error === 'object' &&
    obj.error !== null &&
    typeof (obj.error as Record<string, unknown>).code === 'string' &&
    typeof (obj.error as Record<string, unknown>).message === 'string'
  );
}

// ============= API Configuration =============

export interface ApiConfig {
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export const DEFAULT_API_CONFIG: Required<ApiConfig> = {
  baseUrl: '',
  timeout: 5000,
  retries: 3,
  retryDelay: 1000
};

// ============= Error Codes =============

export enum ApiErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  SERVER_ERROR = 'SERVER_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}
