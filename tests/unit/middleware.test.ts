/**
 * Unit tests for middleware functions
 * Tests request logging, error handling, validation, and rate limiting
 */

import { Request, Response, NextFunction } from 'express';
import {
  requestLoggerMiddleware,
  errorHandlerMiddleware,
  validateJsonMiddleware,
  validateRequestSizeMiddleware,
  rateLimitMiddleware
} from '../../src/middleware';

// Mock the logger module
jest.mock('../../src/logger', () => ({
  logApiRequest: jest.fn(),
  logApiResponse: jest.fn(),
  createRequestLogger: jest.fn(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  })),
  logError: jest.fn(),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-1234-5678-9012'),
}));

describe('Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: 'GET',
      path: '/test',
      query: {},
      body: {},
      get: jest.fn(),
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' } as any,
    };

    mockRes = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      statusCode: 200,
    };

    mockNext = jest.fn();

    // Mock Date.now for consistent timing
    jest.spyOn(Date, 'now').mockReturnValue(1640995200000); // 2022-01-01T00:00:00.000Z
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('requestLoggerMiddleware', () => {
    it('should add requestId and logger to request object', () => {
      requestLoggerMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockReq.requestId).toBe('mocked-u');
      expect(mockReq.logger).toBeDefined();
      expect(mockReq.startTime).toBe(1640995200000);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should log API request with sanitized data', () => {
      const { logApiRequest } = require('../../src/logger');
      
      // Set method to POST so body gets logged (GET requests don't log body)
      mockReq.method = 'POST';
      mockReq.body = { 
        password: 'secret123',
        normalField: 'normalValue'
      };
      (mockReq.get as jest.Mock).mockReturnValue('TestAgent/1.0');

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(logApiRequest).toHaveBeenCalledWith(
        'POST',
        '/test',
        'mocked-u',
        expect.objectContaining({
          query: {},
          body: expect.objectContaining({
            password: '[REDACTED]',
            normalField: 'normalValue'
          }),
          userAgent: 'TestAgent/1.0',
          ip: '127.0.0.1'
        })
      );
    });

    it('should override res.json to log responses', () => {
      const { logApiResponse } = require('../../src/logger');
      
      // Mock the original json function
      const originalJson = jest.fn();
      mockRes.json = originalJson;
      mockRes.statusCode = 200;

      requestLoggerMiddleware(mockReq as Request, mockRes as Response, mockNext);

      const responseData = { success: true, data: 'test' };
      // Call the overridden json function
      mockRes.json(responseData);

      // Verify the original json was called with the data
      expect(originalJson).toHaveBeenCalledWith(responseData);
      
      // Verify response was logged
      expect(logApiResponse).toHaveBeenCalledWith(
        'GET',
        '/test', 
        'mocked-u',
        200,
        expect.any(Number) // duration
      );
    });
  });

  describe('errorHandlerMiddleware', () => {
    let mockError: Error;

    beforeEach(() => {
      mockError = new Error('Test error');
      mockReq.requestId = 'test-request-123';
    });

    it('should log error and return structured error response', () => {
      const { logError } = require('../../src/logger');

      errorHandlerMiddleware(mockError, mockReq as Request, mockRes as Response, mockNext);

      expect(logError).toHaveBeenCalledWith(
        mockError,
        'API Error - GET /test',
        expect.objectContaining({
          requestId: 'test-request-123',
          method: 'GET',
          path: '/test'
        })
      );

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
            requestId: 'test-request-123',
            timestamp: expect.any(String)
          })
        })
      );
    });

    it('should handle ValidationError with 400 status', () => {
      mockError.name = 'ValidationError';

      errorHandlerMiddleware(mockError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR',
            message: 'Invalid request data'
          })
        })
      );
    });

    it('should handle timeout errors with 408 status', () => {
      mockError.message = 'Request timeout occurred';

      errorHandlerMiddleware(mockError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(408);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: 'TIMEOUT',
            message: 'Request timeout'
          })
        })
      );
    });

    it('should include error details in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      errorHandlerMiddleware(mockError, mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: 'Test error',
            stack: expect.any(String)
          })
        })
      );

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('validateJsonMiddleware', () => {
    it('should pass through for GET requests', () => {
      mockReq.method = 'GET';

      validateJsonMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should validate Content-Type for POST requests', () => {
      mockReq.method = 'POST';
      mockReq.requestId = 'test-123';
      (mockReq.get as jest.Mock).mockReturnValue('text/plain');

      const result = validateJsonMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'INVALID_CONTENT_TYPE',
            message: 'Content-Type must be application/json'
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should pass through for valid JSON Content-Type', () => {
      mockReq.method = 'POST';
      (mockReq.get as jest.Mock).mockReturnValue('application/json');

      validateJsonMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('validateRequestSizeMiddleware', () => {
    it('should pass through for small requests', () => {
      (mockReq.get as jest.Mock).mockReturnValue('1000'); // 1KB

      validateRequestSizeMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject large requests', () => {
      mockReq.requestId = 'test-123';
      (mockReq.get as jest.Mock).mockReturnValue('2000000'); // 2MB

      validateRequestSizeMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(413);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'REQUEST_TOO_LARGE',
            message: 'Request body too large (max 1MB)'
          })
        })
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle missing Content-Length header', () => {
      (mockReq.get as jest.Mock).mockReturnValue(undefined);

      validateRequestSizeMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('rateLimitMiddleware', () => {
    beforeEach(() => {
      // Clear rate limit store before each test
      const { rateLimitStore } = require('../../src/middleware');
      rateLimitStore.clear();
    });

    it('should pass through first request from IP', () => {
      const middleware = rateLimitMiddleware(60000, 5); // 5 requests per minute

      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block requests after rate limit exceeded', () => {
      mockReq.requestId = 'test-123';
      const middleware = rateLimitMiddleware(60000, 2); // 2 requests per minute

      // First request - should pass
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Reset mocks for second request
      jest.clearAllMocks();
      
      // Second request - should pass
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Reset mocks for third request
      jest.clearAllMocks();

      // Third request - should be blocked
      middleware(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests',
            retryAfter: expect.any(Number)
          })
        })
      );
    });

    it('should reset rate limit after window expires', () => {
      const middleware = rateLimitMiddleware(1000, 1); // 1 request per second
      
      // Mock initial time
      const mockDateNow = jest.spyOn(Date, 'now').mockReturnValue(1640995200000);

      // First request
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Move time forward beyond window
      mockDateNow.mockReturnValue(1640995201500); // +1.5 seconds

      // Reset mocks for second request
      jest.clearAllMocks();
      
      // Set the time mock again after clearing mocks
      jest.spyOn(Date, 'now').mockReturnValue(1640995201500);

      // Second request after window - should pass
      middleware(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });
});