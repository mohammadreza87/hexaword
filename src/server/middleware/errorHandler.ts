import { Request, Response, NextFunction } from 'express';
import { ApiErrorResponse, ApiErrorCode } from '../../shared/types/api';
import { ZodError } from 'zod';

// Generate unique request ID
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Structured logger
export class Logger {
  private static instance: Logger;
  
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }
  
  private formatLog(level: string, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();
    const log = {
      timestamp,
      level,
      message,
      ...meta
    };
    return JSON.stringify(log);
  }
  
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(this.formatLog('INFO', message, meta));
  }
  
  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatLog('WARN', message, meta));
  }
  
  error(message: string, error?: Error, meta?: Record<string, unknown>): void {
    const errorMeta = error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      ...meta
    } : meta;
    
    console.error(this.formatLog('ERROR', message, errorMeta));
  }
  
  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(this.formatLog('DEBUG', message, meta));
    }
  }
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const requestId = generateRequestId();
  const startTime = Date.now();
  
  // Attach request ID to request and response
  (req as any).requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  const logger = Logger.getInstance();
  
  // Log request
  logger.info('Request received', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.get('user-agent'),
    ip: req.ip
  });
  
  // Log response
  const originalSend = res.send;
  res.send = function(data: any) {
    const duration = Date.now() - startTime;
    
    logger.info('Response sent', {
      requestId,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
    
    return originalSend.call(this, data);
  };
  
  next();
}

// Error handler middleware
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const logger = Logger.getInstance();
  const requestId = (req as any).requestId || generateRequestId();
  
  // Log the error
  logger.error('Request failed', err, {
    requestId,
    method: req.method,
    path: req.path
  });
  
  // Determine error response
  let statusCode = 500;
  let errorCode = ApiErrorCode.INTERNAL_ERROR;
  let message = 'An unexpected error occurred';
  let details: unknown = undefined;
  
  if (err instanceof ZodError) {
    statusCode = 400;
    errorCode = ApiErrorCode.VALIDATION_ERROR;
    message = 'Invalid request data';
    details = err.errors;
  } else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = ApiErrorCode.VALIDATION_ERROR;
    message = err.message;
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
    errorCode = ApiErrorCode.NOT_FOUND;
    message = err.message || 'Resource not found';
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
    errorCode = ApiErrorCode.UNAUTHORIZED;
    message = err.message || 'Unauthorized';
  } else if (err.message && process.env.NODE_ENV === 'development') {
    // In development, show actual error messages
    message = err.message;
  }
  
  const errorResponse: ApiErrorResponse = {
    error: {
      code: errorCode,
      message,
      details,
      requestId,
      timestamp: new Date().toISOString()
    }
  };
  
  res.status(statusCode).json(errorResponse);
}

// Async error wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}