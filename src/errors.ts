/**
 * K1 Starknet Adapter - Error Definitions and Handling
 * 
 * This module provides standardized error types, codes, and handling utilities
 * for the K1 Starknet Adapter. It ensures consistent error responses across
 * all API endpoints and proper error categorization for monitoring and debugging.
 * 
 * Error Categories:
 * - Validation errors (4xx) - Client-side issues
 * - Service errors (5xx) - Server-side issues
 * - Network errors (503) - External service failures
 * - Timeout errors (408) - Operation timeouts
 * 
 * @fileoverview Standardized error handling for the API
 * @author K1 Team
 * @version 1.0.0
 */

/**
 * Standard error codes used throughout the application
 * These codes provide consistent error identification for clients and monitoring
 */
export enum ErrorCode {
  // Validation Errors (4xx)
  MISSING_REQUIRED_FIELDS = 'MISSING_REQUIRED_FIELDS',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_TOKEN_ADDRESS = 'INVALID_TOKEN_ADDRESS',
  INVALID_REQUEST_FORMAT = 'INVALID_REQUEST_FORMAT',
  ENDPOINT_NOT_FOUND = 'ENDPOINT_NOT_FOUND',
  
  // Service Errors (5xx)
  SWAP_EXECUTION_FAILED = 'SWAP_EXECUTION_FAILED',
  BALANCE_QUERY_FAILED = 'BALANCE_QUERY_FAILED',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  
  // Resource Not Available (4xx/5xx)
  TOKEN_NOT_FOUND = 'TOKEN_NOT_FOUND',
  LIGHTNING_NOT_AVAILABLE = 'LIGHTNING_NOT_AVAILABLE',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  
  // Network and Timeout Errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  PAYMENT_TIMEOUT = 'PAYMENT_TIMEOUT',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  RPC_CONNECTION_FAILED = 'RPC_CONNECTION_FAILED',
  
  // Rate Limiting
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  
  // Security
  REQUEST_TOO_LARGE = 'REQUEST_TOO_LARGE',
  INVALID_CONTENT_TYPE = 'INVALID_CONTENT_TYPE'
}

/**
 * HTTP status codes mapped to error types
 * Used to ensure consistent status code responses
 */
export const ErrorStatusMap: Record<ErrorCode, number> = {
  // 400 Bad Request
  [ErrorCode.MISSING_REQUIRED_FIELDS]: 400,
  [ErrorCode.INVALID_AMOUNT]: 400,
  [ErrorCode.INVALID_ADDRESS]: 400,
  [ErrorCode.INVALID_TOKEN_ADDRESS]: 400,
  [ErrorCode.INVALID_REQUEST_FORMAT]: 400,
  [ErrorCode.TOKEN_NOT_FOUND]: 400,
  [ErrorCode.INSUFFICIENT_BALANCE]: 400,
  [ErrorCode.INVALID_CONTENT_TYPE]: 400,
  
  // 404 Not Found
  [ErrorCode.ENDPOINT_NOT_FOUND]: 404,
  
  // 408 Request Timeout
  [ErrorCode.PAYMENT_TIMEOUT]: 408,
  [ErrorCode.TIMEOUT_ERROR]: 408,
  
  // 413 Payload Too Large
  [ErrorCode.REQUEST_TOO_LARGE]: 413,
  
  // 429 Too Many Requests
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  
  // 500 Internal Server Error
  [ErrorCode.SWAP_EXECUTION_FAILED]: 500,
  [ErrorCode.BALANCE_QUERY_FAILED]: 500,
  [ErrorCode.CONFIGURATION_ERROR]: 500,
  [ErrorCode.INTERNAL_SERVER_ERROR]: 500,
  
  // 503 Service Unavailable
  [ErrorCode.LIGHTNING_NOT_AVAILABLE]: 503,
  [ErrorCode.NETWORK_ERROR]: 503,
  [ErrorCode.RPC_CONNECTION_FAILED]: 503
};

/**
 * User-friendly error messages for each error code
 * These messages are safe to expose to clients
 */
export const ErrorMessages: Record<ErrorCode, string> = {
  [ErrorCode.MISSING_REQUIRED_FIELDS]: 'Required fields are missing from the request',
  [ErrorCode.INVALID_AMOUNT]: 'Amount must be a positive number',
  [ErrorCode.INVALID_ADDRESS]: 'Address format is invalid',
  [ErrorCode.INVALID_TOKEN_ADDRESS]: 'Token address must be a valid hex string (66 characters starting with 0x)',
  [ErrorCode.INVALID_REQUEST_FORMAT]: 'Request format is invalid',
  [ErrorCode.ENDPOINT_NOT_FOUND]: 'Endpoint not found',
  [ErrorCode.TOKEN_NOT_FOUND]: 'Token not available for swapping',
  [ErrorCode.LIGHTNING_NOT_AVAILABLE]: 'Lightning Network service is currently unavailable',
  [ErrorCode.INSUFFICIENT_BALANCE]: 'Insufficient balance for the requested operation',
  [ErrorCode.SWAP_EXECUTION_FAILED]: 'Atomic swap execution failed',
  [ErrorCode.BALANCE_QUERY_FAILED]: 'Failed to retrieve balance information',
  [ErrorCode.CONFIGURATION_ERROR]: 'System configuration error',
  [ErrorCode.INTERNAL_SERVER_ERROR]: 'An internal server error occurred',
  [ErrorCode.NETWORK_ERROR]: 'Network connectivity issue',
  [ErrorCode.PAYMENT_TIMEOUT]: 'Payment not received within timeout period',
  [ErrorCode.TIMEOUT_ERROR]: 'Operation timed out',
  [ErrorCode.RPC_CONNECTION_FAILED]: 'Failed to connect to blockchain RPC',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 'Rate limit exceeded, please try again later',
  [ErrorCode.REQUEST_TOO_LARGE]: 'Request payload is too large',
  [ErrorCode.INVALID_CONTENT_TYPE]: 'Invalid or missing Content-Type header'
};

/**
 * Custom application error class
 * Provides structured error information for consistent handling
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: any;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message?: string,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message || ErrorMessages[code]);
    
    this.code = code;
    this.statusCode = ErrorStatusMap[code];
    this.isOperational = isOperational;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // Maintain proper stack trace for debugging
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   */
  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
        timestamp: this.timestamp
      }
    };
  }
}

/**
 * Error classification utility
 * Determines error type from error messages or instances
 */
export class ErrorClassifier {
  /**
   * Classify an error and return appropriate AppError
   */
  static classify(error: unknown, fallbackCode: ErrorCode = ErrorCode.INTERNAL_SERVER_ERROR): AppError {
    // If already an AppError, return as-is
    if (error instanceof AppError) {
      return error;
    }

    // If regular Error, analyze message for classification
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // Network-related errors
      if (message.includes('network') || message.includes('connection') || message.includes('econnrefused')) {
        return new AppError(ErrorCode.NETWORK_ERROR, error.message);
      }
      
      // RPC-related errors
      if (message.includes('rpc') || message.includes('node') || message.includes('provider')) {
        return new AppError(ErrorCode.RPC_CONNECTION_FAILED, error.message);
      }
      
      // Timeout-related errors
      if (message.includes('timeout') || message.includes('timed out')) {
        return new AppError(ErrorCode.TIMEOUT_ERROR, error.message);
      }
      
      // Balance-related errors
      if (message.includes('insufficient balance') || message.includes('insufficient funds')) {
        return new AppError(ErrorCode.INSUFFICIENT_BALANCE, error.message);
      }
      
      // Configuration errors
      if (message.includes('config') || message.includes('environment') || message.includes('missing')) {
        return new AppError(ErrorCode.CONFIGURATION_ERROR, error.message);
      }
    }

    // Fallback to generic error
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new AppError(fallbackCode, errorMessage);
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: AppError): boolean {
    const retryableCodes = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT_ERROR,
      ErrorCode.RPC_CONNECTION_FAILED,
      ErrorCode.LIGHTNING_NOT_AVAILABLE
    ];
    
    return retryableCodes.includes(error.code);
  }

  /**
   * Check if error should be logged as critical
   */
  static isCritical(error: AppError): boolean {
    const criticalCodes = [
      ErrorCode.CONFIGURATION_ERROR,
      ErrorCode.INTERNAL_SERVER_ERROR
    ];
    
    return criticalCodes.includes(error.code) || !error.isOperational;
  }
}

/**
 * Utility functions for error response formatting
 */
export class ErrorResponse {
  /**
   * Create standardized error response object
   */
  static create(
    error: AppError | ErrorCode,
    requestId?: string,
    additionalDetails?: any
  ) {
    const appError = error instanceof AppError ? error : new AppError(error);
    
    return {
      success: false,
      error: {
        code: appError.code,
        message: appError.message,
        ...(appError.details && { details: appError.details }),
        ...(additionalDetails && { ...additionalDetails }),
        ...(requestId && { requestId }),
        timestamp: appError.timestamp
      }
    };
  }

  /**
   * Create error response with swap context
   */
  static createSwapError(
    error: AppError | ErrorCode,
    swapId?: string,
    finalState?: number,
    requestId?: string
  ) {
    return ErrorResponse.create(error, requestId, {
      ...(swapId && { swapId }),
      ...(finalState !== undefined && { finalState })
    });
  }
}