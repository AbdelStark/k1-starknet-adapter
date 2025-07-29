import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logApiRequest, logApiResponse, createRequestLogger, logError } from './logger';

// Extend Request interface to include logger and requestId
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      logger: ReturnType<typeof createRequestLogger>;
      startTime: number;
    }
  }
}

// Request ID and logger middleware
export const requestLoggerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Generate unique request ID
  req.requestId = uuidv4().slice(0, 8);
  req.startTime = Date.now();
  
  // Attach request-specific logger
  req.logger = createRequestLogger(req.requestId);
  
  // Log incoming request
  logApiRequest(req.method, req.path, req.requestId, {
    query: req.query,
    body: req.method !== 'GET' ? sanitizeBody(req.body) : undefined,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });

  // Override res.json to log responses
  const originalJson = res.json.bind(res);
  res.json = function(body: any) {
    const duration = Date.now() - req.startTime;
    
    // Log response
    logApiResponse(req.method, req.path, req.requestId, res.statusCode, duration);
    
    // Log response body in debug mode (sanitized)
    req.logger.debug('Response body', {
      statusCode: res.statusCode,
      body: sanitizeResponseBody(body),
      duration
    });
    
    return originalJson(body);
  };

  next();
};

// Error handling middleware
export const errorHandlerMiddleware = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log the error with context
  logError(error, `API Error - ${req.method} ${req.path}`, {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    body: sanitizeBody(req.body),
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress
  });

  // Determine error response based on error type
  let statusCode = 500;
  let message = 'Internal server error';
  let errorCode = 'INTERNAL_ERROR';

  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Invalid request data';
    errorCode = 'VALIDATION_ERROR';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = 'Unauthorized';
    errorCode = 'UNAUTHORIZED';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Resource not found';
    errorCode = 'NOT_FOUND';
  } else if (error.message.includes('timeout')) {
    statusCode = 408;
    message = 'Request timeout';
    errorCode = 'TIMEOUT';
  } else if (error.message.includes('rate limit')) {
    statusCode = 429;
    message = 'Too many requests';
    errorCode = 'RATE_LIMIT';
  }

  // Send error response
  const errorResponse = {
    success: false,
    error: {
      code: errorCode,
      message: message,
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    }
  };

  // Include error details in development
  if (process.env.NODE_ENV === 'development') {
    errorResponse.error = {
      ...errorResponse.error,
      details: error.message,
      stack: error.stack
    } as any;
  }

  res.status(statusCode).json(errorResponse);
};

// Validation middleware
export const validateJsonMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.get('Content-Type');
    if (contentType && !contentType.includes('application/json')) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTENT_TYPE',
          message: 'Content-Type must be application/json',
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        }
      });
    }
  }
  return next();
};

// Request size validation middleware
export const validateRequestSizeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const maxSize = 1024 * 1024; // 1MB
  const contentLength = parseInt(req.get('Content-Length') || '0');
  
  if (contentLength > maxSize) {
    return res.status(413).json({
      success: false,
      error: {
        code: 'REQUEST_TOO_LARGE',
        message: 'Request body too large (max 1MB)',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      }
    });
  }
  
  return next();
};

// Rate limiting helper (simple in-memory implementation)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Export for testing purposes
export { rateLimitStore };

export const rateLimitMiddleware = (
  windowMs: number = 15 * 60 * 1000, // 15 minutes
  maxRequests: number = 100 // 100 requests per window
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const clientId = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    
    const clientData = rateLimitStore.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      // New window or client
      rateLimitStore.set(clientId, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests',
          requestId: req.requestId,
          timestamp: new Date().toISOString(),
          retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
        }
      });
    }
    
    clientData.count++;
    next();
  };
};

// Helper functions to sanitize sensitive data
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveKeys = ['privateKey', 'secret', 'password', 'token', 'key'];
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}

function sanitizeResponseBody(body: any): any {
  if (!body || typeof body !== 'object') return body;
  
  const sanitized = { ...body };
  const sensitiveKeys = ['privateKey', 'secret', 'password', 'token', 'key'];
  
  for (const key of Object.keys(sanitized)) {
    if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    }
  }
  
  return sanitized;
}