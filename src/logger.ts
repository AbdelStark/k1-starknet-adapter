import winston from 'winston';
import { config } from './config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define log colors for console output
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Add colors to winston
winston.addColors(colors);

// Define log format for development
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define log format for production (JSON)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define which transports to use based on environment
const transports = [];

// Console transport (always enabled for development)
if (process.env.NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      format: devFormat
    })
  );
} else {
  // Production console output in JSON format
  transports.push(
    new winston.transports.Console({
      format: prodFormat
    })
  );
}

// File transports for production
if (process.env.NODE_ENV === 'production') {
  // Error log file
  transports.push(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: prodFormat
    })
  );

  // Combined log file
  transports.push(
    new winston.transports.File({
      filename: 'logs/combined.log',
      format: prodFormat
    })
  );
}

// Create the logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  levels,
  transports,
  // Handle uncaught exceptions and rejections
  exceptionHandlers: [
    new winston.transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Atomic swap specific logger with context
export const createSwapLogger = (swapId: string) => {
  return {
    info: (message: string, meta?: any) => logger.info(`[SWAP:${swapId}] ${message}`, meta),
    error: (message: string, meta?: any) => logger.error(`[SWAP:${swapId}] ${message}`, meta),
    warn: (message: string, meta?: any) => logger.warn(`[SWAP:${swapId}] ${message}`, meta),
    debug: (message: string, meta?: any) => logger.debug(`[SWAP:${swapId}] ${message}`, meta),
  };
};

// Request logger with context
export const createRequestLogger = (requestId: string) => {
  return {
    info: (message: string, meta?: any) => logger.info(`[REQ:${requestId}] ${message}`, meta),
    error: (message: string, meta?: any) => logger.error(`[REQ:${requestId}] ${message}`, meta),
    warn: (message: string, meta?: any) => logger.warn(`[REQ:${requestId}] ${message}`, meta),
    debug: (message: string, meta?: any) => logger.debug(`[REQ:${requestId}] ${message}`, meta),
    http: (message: string, meta?: any) => logger.http(`[REQ:${requestId}] ${message}`, meta),
  };
};

// Error logging helper
export const logError = (error: Error, context?: string, meta?: any) => {
  const message = context ? `${context}: ${error.message}` : error.message;
  logger.error(message, {
    stack: error.stack,
    name: error.name,
    ...meta
  });
};

// Structured logging helpers
export const logSwapStart = (swapId: string, params: any) => {
  logger.info('Atomic swap started', {
    swapId,
    params,
    event: 'swap_start',
    timestamp: new Date().toISOString()
  });
};

export const logSwapSuccess = (swapId: string, result: any) => {
  logger.info('Atomic swap completed successfully', {
    swapId,
    result,
    event: 'swap_success',
    timestamp: new Date().toISOString()
  });
};

export const logSwapFailure = (swapId: string, error: Error, params?: any) => {
  logger.error('Atomic swap failed', {
    swapId,
    error: error.message,
    stack: error.stack,
    params,
    event: 'swap_failure',
    timestamp: new Date().toISOString()
  });
};

export const logApiRequest = (method: string, path: string, requestId: string, params?: any) => {
  logger.http('API request received', {
    method,
    path,
    requestId,
    params,
    event: 'api_request',
    timestamp: new Date().toISOString()
  });
};

export const logApiResponse = (method: string, path: string, requestId: string, statusCode: number, duration: number) => {
  logger.http('API response sent', {
    method,
    path,
    requestId,
    statusCode,
    duration,
    event: 'api_response',
    timestamp: new Date().toISOString()
  });
};

export default logger;