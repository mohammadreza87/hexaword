import { z } from 'zod';

// ============= Zod Validation Schemas =============

export const GameInitRequestSchema = z.object({
  postId: z.string().optional(),
  subredditId: z.string().optional(),
  level: z.number().int().min(1).max(100).optional()
});

export const GameInitResponseSchema = z.object({
  type: z.literal('game_init'),
  postId: z.string(),
  seed: z.string().min(1),
  words: z.array(z.string().min(3).max(15)).min(1).max(20),
  username: z.string().optional(),
  createdAt: z.string().optional(),
  level: z.number().int().min(1).optional(),
  clue: z.string().min(1).max(100).optional()
});

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
    timestamp: z.string().datetime().optional()
  })
});

// ============= Legacy Types (for compatibility) =============

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

// ============= Game API Types (derived from schemas) =============

export type GameInitRequest = z.infer<typeof GameInitRequestSchema>;
export type GameInitResponse = z.infer<typeof GameInitResponseSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

// ============= Type Guards (using Zod) =============

export function isGameInitResponse(data: unknown): data is GameInitResponse {
  return GameInitResponseSchema.safeParse(data).success;
}

export function isApiErrorResponse(data: unknown): data is ApiErrorResponse {
  return ApiErrorResponseSchema.safeParse(data).success;
}

// ============= Validation Helpers =============

export function validateGameInitResponse(data: unknown): GameInitResponse {
  const result = GameInitResponseSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid game init response: ${result.error.message}`);
  }
  return result.data;
}

export function validateApiErrorResponse(data: unknown): ApiErrorResponse {
  const result = ApiErrorResponseSchema.safeParse(data);
  if (!result.success) {
    throw new Error(`Invalid error response: ${result.error.message}`);
  }
  return result.data;
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
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}
