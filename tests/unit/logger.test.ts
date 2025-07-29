/**
 * Unit tests for the logging system
 * Tests winston logger configuration, structured logging, and log sanitization
 */

// Mock winston BEFORE importing anything that uses it
const mockLoggerInstance = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  http: jest.fn(),
};

jest.mock('winston', () => ({
  createLogger: jest.fn(() => mockLoggerInstance),
  format: {
    combine: jest.fn(() => 'combined-format'),
    timestamp: jest.fn(() => 'timestamp-format'),
    colorize: jest.fn(() => 'colorize-format'),
    printf: jest.fn(() => 'printf-format'),
    errors: jest.fn(() => 'errors-format'),
    json: jest.fn(() => 'json-format'),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
  addColors: jest.fn(),
}));

// Now import logger after mocking winston
import winston from 'winston';
import logger, { 
  createSwapLogger, 
  createRequestLogger, 
  logError, 
  logSwapStart, 
  logSwapSuccess, 
  logSwapFailure,
  logApiRequest,
  logApiResponse
} from '../../src/logger';

describe('Logger', () => {
  beforeEach(() => {
    // Clear all mock calls before each test
    jest.clearAllMocks();
  });

  describe('createSwapLogger', () => {
    it('should create a swap-specific logger with context', () => {
      const swapId = 'test-swap-123';
      const swapLogger = createSwapLogger(swapId);

      swapLogger.info('Test message', { key: 'value' });

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        `[SWAP:${swapId}] Test message`,
        { key: 'value' }
      );
    });

    it('should handle all log levels', () => {
      const swapId = 'test-swap-123';
      const swapLogger = createSwapLogger(swapId);

      swapLogger.info('Info message');
      swapLogger.error('Error message');
      swapLogger.warn('Warning message');
      swapLogger.debug('Debug message');

      expect(mockLoggerInstance.info).toHaveBeenCalledWith('[SWAP:test-swap-123] Info message', undefined);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith('[SWAP:test-swap-123] Error message', undefined);
      expect(mockLoggerInstance.warn).toHaveBeenCalledWith('[SWAP:test-swap-123] Warning message', undefined);
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith('[SWAP:test-swap-123] Debug message', undefined);
    });
  });

  describe('createRequestLogger', () => {
    it('should create a request-specific logger with context', () => {
      const requestId = 'req-abc123';
      const requestLogger = createRequestLogger(requestId);

      requestLogger.http('HTTP request', { method: 'POST' });

      expect(mockLoggerInstance.http).toHaveBeenCalledWith(
        `[REQ:${requestId}] HTTP request`,
        { method: 'POST' }
      );
    });

    it('should handle all log levels including http', () => {
      const requestId = 'req-abc123';
      const requestLogger = createRequestLogger(requestId);

      requestLogger.info('Info message');
      requestLogger.error('Error message');
      requestLogger.warn('Warning message');
      requestLogger.debug('Debug message');
      requestLogger.http('HTTP message');

      expect(mockLoggerInstance.info).toHaveBeenCalledWith('[REQ:req-abc123] Info message', undefined);
      expect(mockLoggerInstance.error).toHaveBeenCalledWith('[REQ:req-abc123] Error message', undefined);
      expect(mockLoggerInstance.warn).toHaveBeenCalledWith('[REQ:req-abc123] Warning message', undefined);
      expect(mockLoggerInstance.debug).toHaveBeenCalledWith('[REQ:req-abc123] Debug message', undefined);
      expect(mockLoggerInstance.http).toHaveBeenCalledWith('[REQ:req-abc123] HTTP message', undefined);
    });
  });

  describe('logError', () => {
    it('should log error with stack trace and context', () => {
      const error = new Error('Test error');
      error.stack = 'Error: Test error\n    at test.js:1:1';
      const context = 'Test context';
      const meta = { userId: 123 };

      logError(error, context, meta);

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Test context: Test error',
        {
          stack: error.stack,
          name: 'Error',
          userId: 123
        }
      );
    });

    it('should log error without context', () => {
      const error = new Error('Test error');

      logError(error);

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Test error',
        {
          stack: error.stack,
          name: 'Error'
        }
      );
    });
  });

  describe('structured logging helpers', () => {
    beforeEach(() => {
      // Mock Date.now() for consistent timestamps
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2025-01-01T00:00:00.000Z');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should log swap start event', () => {
      const swapId = 'swap-123';
      const params = { amount: 100, token: 'WBTC' };

      logSwapStart(swapId, params);

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        'Atomic swap started',
        {
          swapId,
          params,
          event: 'swap_start',
          timestamp: '2025-01-01T00:00:00.000Z'
        }
      );
    });

    it('should log swap success event', () => {
      const swapId = 'swap-123';
      const result = { success: true, amount: '100 WBTC' };

      logSwapSuccess(swapId, result);

      expect(mockLoggerInstance.info).toHaveBeenCalledWith(
        'Atomic swap completed successfully',
        {
          swapId,
          result,
          event: 'swap_success',
          timestamp: '2025-01-01T00:00:00.000Z'
        }
      );
    });

    it('should log swap failure event', () => {
      const swapId = 'swap-123';
      const error = new Error('Swap failed');
      const params = { amount: 100 };

      logSwapFailure(swapId, error, params);

      expect(mockLoggerInstance.error).toHaveBeenCalledWith(
        'Atomic swap failed',
        {
          swapId,
          error: 'Swap failed',
          stack: error.stack,
          params,
          event: 'swap_failure',
          timestamp: '2025-01-01T00:00:00.000Z'
        }
      );
    });

    it('should log API request', () => {
      const method = 'POST';
      const path = '/api/atomic-swap';
      const requestId = 'req-123';
      const params = { amount: 100 };

      logApiRequest(method, path, requestId, params);

      expect(mockLoggerInstance.http).toHaveBeenCalledWith(
        'API request received',
        {
          method,
          path,
          requestId,
          params,
          event: 'api_request',
          timestamp: '2025-01-01T00:00:00.000Z'
        }
      );
    });

    it('should log API response', () => {
      const method = 'POST';
      const path = '/api/atomic-swap';
      const requestId = 'req-123';
      const statusCode = 200;
      const duration = 1500;

      logApiResponse(method, path, requestId, statusCode, duration);

      expect(mockLoggerInstance.http).toHaveBeenCalledWith(
        'API response sent',
        {
          method,
          path,
          requestId,
          statusCode,
          duration,
          event: 'api_response',
          timestamp: '2025-01-01T00:00:00.000Z'
        }
      );
    });
  });
});