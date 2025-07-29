/**
 * Jest setup file for test environment configuration
 * This file runs after the test framework is installed but before tests run
 */

import { config } from 'dotenv';

// Load environment variables for testing
config({ path: '.env.test' });

// Set default test environment variables if not provided
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PORT = process.env.PORT || '3001';
process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'error'; // Minimize logs during testing

// Mock console methods for cleaner test output
const originalConsole = global.console;

// Store original methods for restoration if needed
global.console = {
  ...originalConsole,
  // Keep error and warn for important messages
  log: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  // Keep error and warn
  error: originalConsole.error,
  warn: originalConsole.warn,
};

// Global test timeout
jest.setTimeout(30000);

// Global test hooks
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
});

afterEach(() => {
  // Cleanup after each test
  jest.restoreAllMocks();
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export test utilities for use in tests
export const testUtils = {
  // Helper to restore console for specific tests
  restoreConsole: () => {
    global.console = originalConsole;
  },
  
  // Helper to mock console again
  mockConsole: () => {
    global.console = {
      ...originalConsole,
      log: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      error: originalConsole.error,
      warn: originalConsole.warn,
    };
  },
  
  // Helper to wait for async operations
  wait: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to generate test data
  generateTestAddress: () => '0x' + '0'.repeat(64),
  generateTestSwapId: () => 'test_swap_' + Math.random().toString(36).substr(2, 9),
};