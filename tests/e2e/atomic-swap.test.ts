/**
 * End-to-end tests for atomic swap functionality
 * Tests the complete atomic swap flow with mocked external services
 */

import request from 'supertest';
import express from 'express';
import { createServer } from 'http';
import { AddressInfo } from 'net';

// Import the full app setup
import { config } from '../../src/config';

// Mock external dependencies to avoid real blockchain calls
jest.mock('../../src/atomicSwapper');
jest.mock('../../src/atomicConfig');
jest.mock('../../src/balanceService');

describe('Atomic Swap E2E Tests', () => {
  let app: express.Application;
  let server: any;
  let baseURL: string;

  beforeAll(async () => {
    // Mock configuration
    jest.doMock('../../src/config', () => ({
      config: {
        port: 0, // Use random port for testing
        starknetRpcUrl: 'https://test-rpc.com',
        starknetPrivateKey: '0x' + '1'.repeat(64),
        starknetAccountAddress: '0x' + '2'.repeat(64),
      },
      validateConfig: jest.fn()
    }));

    // Import and setup the app after mocking
    const { default: routes } = await import('../../src/routes');
    const { 
      requestLoggerMiddleware, 
      errorHandlerMiddleware,
      validateJsonMiddleware,
      validateRequestSizeMiddleware 
    } = await import('../../src/middleware');

    app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use(requestLoggerMiddleware);
    app.use(validateJsonMiddleware);
    app.use(validateRequestSizeMiddleware);
    app.use('/', routes);
    app.use(errorHandlerMiddleware);

    // Start test server
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const port = (server.address() as AddressInfo).port;
        baseURL = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks();
  });

  function setupMocks() {
    // Mock successful atomic swap flow
    const mockSwap = {
      getId: jest.fn().mockReturnValue('e2e-swap-test-123'),
      getInputWithoutFee: jest.fn().mockReturnValue(BigInt(400)),
      getOutput: jest.fn().mockReturnValue(BigInt(400)),
      getState: jest.fn()
        .mockReturnValueOnce(0) // Initial state
        .mockReturnValueOnce(1) // After commit
        .mockReturnValue(2),    // After payment
      commit: jest.fn().mockResolvedValue(undefined),
      waitForPayment: jest.fn().mockResolvedValue(true),
      getSecret: jest.fn().mockReturnValue('payment-hash-e2e-123'),
      getTransactionId: jest.fn().mockReturnValue(null)
    };

    const mockSwapper = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getStarknetAddress: jest.fn().mockReturnValue('0xe2etest1234567890abcdef1234567890abcdef'),
      getAvailableTokens: jest.fn().mockReturnValue({
        STARKNET: {
          'WBTC': { 
            address: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac',
            ticker: 'WBTC'
          }
        },
        BITCOIN: {
          'BTC_LN': { 
            ticker: 'BTC',
            lightning: true 
          }
        }
      }),
      createSwapQuote: jest.fn().mockResolvedValue(mockSwap),
      getStarknetSigner: jest.fn().mockReturnValue({
        getAddress: () => '0xe2esigner1234567890abcdef1234567890abcdef'
      }),
      stop: jest.fn().mockResolvedValue(undefined)
    };

    const mockConfig = {
      starknetRpcUrl: 'https://test-e2e.com',
      starknetPrivateKey: '0x' + '3'.repeat(64),
      starknetAccountAddress: '0x' + '4'.repeat(64),
      bitcoinNetwork: 'testnet',
      intermediaryUrl: 'https://test-intermediary.com:24000'
    };

    const mockBalanceData = {
      address: '0x03641aa25b8de4a4d5ac185c72b124546666f2ad2354c9627b6565830fdea408',
      tokenAddress: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac',
      tokenSymbol: 'WBTC',
      balance: '50000',
      balanceFormatted: '0.00050000',
      balanceInSats: '50000',
      decimals: 8
    };

    // Apply mocks
    jest.doMock('../../src/atomicSwapper', () => ({
      AtomicSwapper: jest.fn().mockImplementation(() => mockSwapper)
    }));

    jest.doMock('../../src/atomicConfig', () => ({
      createDefaultConfig: jest.fn().mockReturnValue(mockConfig)
    }));

    jest.doMock('../../src/balanceService', () => ({
      BalanceService: jest.fn().mockImplementation(() => ({
        getWBTCBalance: jest.fn().mockResolvedValue(mockBalanceData)
      }))
    }));
  }

  describe('Complete Atomic Swap Flow', () => {
    const validSwapRequest = {
      amountSats: 400,
      lightningDestination: 'e2etest@coinos.io',
      tokenAddress: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac',
      exactIn: false
    };

    it('should complete successful atomic swap end-to-end', async () => {
      const response = await request(baseURL)
        .post('/api/atomic-swap')
        .send(validSwapRequest)
        .expect(200);

      // Verify response structure
      expect(response.body).toMatchObject({
        success: true,
        swapId: 'e2e-swap-test-123',
        inputAmount: '400 WBTC',
        outputAmount: '400 BTC',
        tokenUsed: 'WBTC',
        tokenAddress: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac',
        finalState: 2,
        lightningPaymentHash: 'payment-hash-e2e-123',
        transactionId: null,
        lightningDestination: 'e2etest@coinos.io',
        message: '✅ WBTC -> Lightning atomic swap completed successfully!',
        requestId: expect.any(String),
        timestamp: expect.any(String)
      });

      // Verify that all expected service calls were made
      const { AtomicSwapper } = require('../../src/atomicSwapper');
      const swapperInstance = AtomicSwapper.mock.results[0].value;
      
      expect(swapperInstance.initialize).toHaveBeenCalled();
      expect(swapperInstance.getStarknetAddress).toHaveBeenCalled();
      expect(swapperInstance.getAvailableTokens).toHaveBeenCalled();
      expect(swapperInstance.createSwapQuote).toHaveBeenCalledWith(
        expect.objectContaining({ ticker: 'WBTC' }),
        expect.objectContaining({ lightning: true }),
        BigInt(400),
        false,
        expect.any(String),
        'e2etest@coinos.io'
      );
      expect(swapperInstance.stop).toHaveBeenCalled();
    });

    it('should handle swap timeout gracefully', async () => {
      // Mock timeout scenario
      const { AtomicSwapper } = require('../../src/atomicSwapper');
      const mockSwapperTimeout = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getStarknetAddress: jest.fn().mockReturnValue('0xtimeout123'),
        getAvailableTokens: jest.fn().mockReturnValue({
          STARKNET: { 'WBTC': { address: validSwapRequest.tokenAddress, ticker: 'WBTC' }},
          BITCOIN: { 'BTC_LN': { ticker: 'BTC', lightning: true }}
        }),
        createSwapQuote: jest.fn().mockResolvedValue({
          getId: () => 'timeout-swap-123',
          getInputWithoutFee: () => BigInt(400),
          getOutput: () => BigInt(400),
          getState: () => 1, // Stuck in committed state
          commit: jest.fn().mockResolvedValue(undefined),
          waitForPayment: jest.fn().mockResolvedValue(false), // Timeout
        }),
        getStarknetSigner: jest.fn().mockReturnValue({
          getAddress: () => '0xsigner123'
        }),
        stop: jest.fn().mockResolvedValue(undefined)
      };

      AtomicSwapper.mockImplementation(() => mockSwapperTimeout);

      const response = await request(baseURL)
        .post('/api/atomic-swap')
        .send(validSwapRequest)
        .expect(408);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'PAYMENT_TIMEOUT',
          message: 'Lightning payment not received within timeout',
          swapId: 'timeout-swap-123',
          finalState: 1,
          requestId: expect.any(String),
          timestamp: expect.any(String)
        }
      });

      // Verify cleanup was called
      expect(mockSwapperTimeout.stop).toHaveBeenCalled();
    });

    it('should handle token not found error', async () => {
      // Mock scenario where token is not available
      const { AtomicSwapper } = require('../../src/atomicSwapper');
      const mockSwapperNoToken = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getStarknetAddress: jest.fn().mockReturnValue('0xnotoken123'),
        getAvailableTokens: jest.fn().mockReturnValue({
          STARKNET: {}, // No tokens available
          BITCOIN: { 'BTC_LN': { ticker: 'BTC', lightning: true }}
        }),
        stop: jest.fn().mockResolvedValue(undefined)
      };

      AtomicSwapper.mockImplementation(() => mockSwapperNoToken);

      const response = await request(baseURL)
        .post('/api/atomic-swap')
        .send(validSwapRequest)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: expect.stringContaining('Token not found for address'),
          requestId: expect.any(String),
          timestamp: expect.any(String)
        }
      });

      // Verify cleanup was called
      expect(mockSwapperNoToken.stop).toHaveBeenCalled();
    });

    it('should handle Lightning not available error', async () => {
      // Mock scenario where Lightning is not available
      const { AtomicSwapper } = require('../../src/atomicSwapper');
      const mockSwapperNoLN = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getStarknetAddress: jest.fn().mockReturnValue('0xnoln123'),
        getAvailableTokens: jest.fn().mockReturnValue({
          STARKNET: { 'WBTC': { address: validSwapRequest.tokenAddress, ticker: 'WBTC' }},
          BITCOIN: {} // No Lightning available
        }),
        stop: jest.fn().mockResolvedValue(undefined)
      };

      AtomicSwapper.mockImplementation(() => mockSwapperNoLN);

      const response = await request(baseURL)
        .post('/api/atomic-swap')
        .send(validSwapRequest)
        .expect(503);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'LIGHTNING_NOT_AVAILABLE',
          message: 'Lightning BTC token not available',
          requestId: expect.any(String),
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle unexpected errors gracefully', async () => {
      // Mock unexpected error during swap creation
      const { AtomicSwapper } = require('../../src/atomicSwapper');
      const mockSwapperError = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getStarknetAddress: jest.fn().mockReturnValue('0xerror123'),
        getAvailableTokens: jest.fn().mockReturnValue({
          STARKNET: { 'WBTC': { address: validSwapRequest.tokenAddress, ticker: 'WBTC' }},
          BITCOIN: { 'BTC_LN': { ticker: 'BTC', lightning: true }}
        }),
        createSwapQuote: jest.fn().mockRejectedValue(new Error('Network connection failed')),
        stop: jest.fn().mockResolvedValue(undefined)
      };

      AtomicSwapper.mockImplementation(() => mockSwapperError);

      const response = await request(baseURL)
        .post('/api/atomic-swap')
        .send(validSwapRequest)
        .expect(503); // Network error should map to 503

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Atomic swap execution failed',
          requestId: expect.any(String),
          timestamp: expect.any(String)
        }
      });

      // Verify cleanup was attempted
      expect(mockSwapperError.stop).toHaveBeenCalled();
    });
  });

  describe('Health and System Status', () => {
    it('should provide comprehensive health information', async () => {
      const response = await request(baseURL)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        memory: {
          rss: expect.any(Number),
          heapUsed: expect.any(Number),
          heapTotal: expect.any(Number),
          external: expect.any(Number),
          arrayBuffers: expect.any(Number)
        },
        environment: expect.any(String),
        version: expect.any(String)
      });

      // Verify timestamp is recent
      const timestamp = new Date(response.body.timestamp);
      const now = new Date();
      expect(now.getTime() - timestamp.getTime()).toBeLessThan(1000); // Within 1 second
    });
  });

  describe('Balance Service Integration', () => {
    it('should retrieve balance with proper error handling', async () => {
      const testAddress = '0x03641aa25b8de4a4d5ac185c72b124546666f2ad2354c9627b6565830fdea408';
      
      const response = await request(baseURL)
        .get(`/balance/${testAddress}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'WBTC balance retrieved successfully',
        data: {
          address: testAddress,
          tokenAddress: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac',
          tokenSymbol: 'WBTC',
          balance: '50000',
          balanceFormatted: '0.00050000',
          balanceInSats: '50000',
          decimals: 8
        }
      });
    });

    it('should handle balance service errors', async () => {
      // Mock balance service error
      const { BalanceService } = require('../../src/balanceService');
      const mockBalanceService = {
        getWBTCBalance: jest.fn().mockRejectedValue(new Error('RPC connection failed'))
      };
      BalanceService.mockImplementation(() => mockBalanceService);

      const testAddress = '0x03641aa25b8de4a4d5ac185c72b124546666f2ad2354c9627b6565830fdea408';
      
      const response = await request(baseURL)
        .get(`/balance/${testAddress}`)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'BALANCE_QUERY_FAILED',
          message: 'Failed to retrieve balance',
          requestId: expect.any(String),
          timestamp: expect.any(String)
        }
      });
    });
  });
});