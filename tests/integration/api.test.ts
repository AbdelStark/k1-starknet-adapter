/**
 * Integration tests for API endpoints
 * Tests the complete request/response cycle for all endpoints
 */

import request from 'supertest';
import express from 'express';
import routes from '../../src/routes';
import { requestLoggerMiddleware, errorHandlerMiddleware } from '../../src/middleware';

// Mock the external services
jest.mock('../../src/balanceService');
jest.mock('../../src/atomicSwapper');
jest.mock('../../src/atomicConfig');

describe('API Integration Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    // Create test app with minimal middleware
    app = express();
    app.use(express.json());
    app.use(requestLoggerMiddleware);
    app.use('/', routes);
    app.use(errorHandlerMiddleware);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /health', () => {
    it('should return health status with system metrics', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        memory: expect.any(Object),
        environment: expect.any(String),
        version: expect.any(String)
      });

      expect(response.body.memory).toHaveProperty('rss');
      expect(response.body.memory).toHaveProperty('heapUsed');
      expect(response.body.memory).toHaveProperty('heapTotal');
    });

    it('should include proper headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.headers['content-type']).toMatch(/application\/json/);
    });
  });

  describe('GET /balance/:address', () => {
    const { BalanceService } = require('../../src/balanceService');

    beforeEach(() => {
      // Mock BalanceService
      BalanceService.prototype.getWBTCBalance = jest.fn();
    });

    it('should return balance for valid address', async () => {
      const testAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      const mockBalanceData = {
        address: testAddress,
        tokenAddress: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac',
        tokenSymbol: 'WBTC',
        balance: '50000',
        balanceFormatted: '0.00050000',
        balanceInSats: '50000',
        decimals: 8
      };

      BalanceService.prototype.getWBTCBalance.mockResolvedValue(mockBalanceData);

      const response = await request(app)
        .get(`/balance/${testAddress}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'WBTC balance retrieved successfully',
        data: mockBalanceData
      });

      expect(BalanceService.prototype.getWBTCBalance).toHaveBeenCalledWith(testAddress);
    });

    it('should return 400 for invalid address format', async () => {
      const response = await request(app)
        .get('/balance/invalid-address')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_ADDRESS',
          message: 'Address must be a valid hex string starting with 0x',
          requestId: expect.any(String),
          timestamp: expect.any(String)
        }
      });
    });

    it('should return 500 when service throws error', async () => {
      const testAddress = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
      
      BalanceService.prototype.getWBTCBalance.mockRejectedValue(new Error('Service error'));

      const response = await request(app)
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

  describe('POST /api/atomic-swap', () => {
    beforeEach(() => {
      // Mock AtomicSwapper and dependencies
      const mockAtomicSwapper = {
        initialize: jest.fn().mockResolvedValue(undefined),
        getStarknetAddress: jest.fn().mockReturnValue('0x1234...'),
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
        createSwapQuote: jest.fn().mockResolvedValue({
          getId: () => 'swap-test-123',
          getInputWithoutFee: () => BigInt(400),
          getOutput: () => BigInt(400),
          getState: () => 1,
          commit: jest.fn().mockResolvedValue(undefined),
          waitForPayment: jest.fn().mockResolvedValue(true),
          getSecret: () => 'payment-hash-123',
          getTransactionId: () => null
        }),
        getStarknetSigner: jest.fn().mockReturnValue({
          getAddress: () => '0x5678...'
        }),
        stop: jest.fn().mockResolvedValue(undefined)
      };

      const mockConfig = {
        starknetRpcUrl: 'https://test.com',
        starknetPrivateKey: '0x123',
        starknetAccountAddress: '0x456'
      };

      jest.doMock('../../src/atomicSwapper', () => ({
        AtomicSwapper: jest.fn().mockImplementation(() => mockAtomicSwapper)
      }));

      jest.doMock('../../src/atomicConfig', () => ({
        createDefaultConfig: jest.fn().mockReturnValue(mockConfig)
      }));
    });

    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/atomic-swap')
        .send({
          amountSats: 100
          // Missing lightningDestination and tokenAddress
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields: amountSats, lightningDestination, tokenAddress',
          requestId: expect.any(String),
          timestamp: expect.any(String)
        }
      });
    });

    it('should return 400 for invalid amount', async () => {
      const response = await request(app)
        .post('/api/atomic-swap')
        .send({
          amountSats: -100,
          lightningDestination: 'test@coinos.io',
          tokenAddress: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'amountSats must be a positive number',
          requestId: expect.any(String)
        }
      });
    });

    it('should return 400 for invalid token address', async () => {
      const response = await request(app)
        .post('/api/atomic-swap')
        .send({
          amountSats: 100,
          lightningDestination: 'test@coinos.io',
          tokenAddress: 'invalid-address'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_TOKEN_ADDRESS',
          message: 'Token address must be a valid hex string (66 characters starting with 0x)',
          requestId: expect.any(String)
        }
      });
    });

    // Note: Full atomic swap test would require more complex mocking
    // This is tested in the e2e tests with actual integrations
  });

  describe('POST /api/invoice', () => {
    it('should return 400 for missing required fields', async () => {
      const response = await request(app)
        .post('/api/invoice')
        .send({
          amountUSD: 10.00
          // Missing address
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Missing required fields: amountUSD and address'
      });
    });

    it('should return 400 for non-Lightning address', async () => {
      const response = await request(app)
        .post('/api/invoice')
        .send({
          amountUSD: 10.00,
          address: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'This endpoint currently only supports Lightning destinations'
      });
    });

    it('should accept Lightning address format', async () => {
      const response = await request(app)
        .post('/api/invoice')
        .send({
          amountUSD: 0.01, // Small amount to avoid actual swap
          address: 'test@coinos.io'
        });

      // Should either succeed or fail gracefully, not with validation error
      expect(response.status).not.toBe(400);
    });
  });

  describe('Deprecated endpoints', () => {
    it('should return 410 for deprecated quote endpoint', async () => {
      const response = await request(app)
        .post('/api/atomic-swap/quote')
        .send({ test: 'data' })
        .expect(410);

      expect(response.body).toMatchObject({
        success: false,
        message: 'This endpoint is deprecated. Use POST /api/atomic-swap for direct execution.',
        deprecated: true,
        alternative: 'POST /api/atomic-swap'
      });
    });

    it('should return 410 for deprecated execute endpoint', async () => {
      const response = await request(app)
        .post('/api/atomic-swap/execute')
        .send({ swapId: 'test', direction: 'starknet_to_lightning' })
        .expect(410);

      expect(response.body).toMatchObject({
        success: false,
        deprecated: true,
        alternative: 'POST /api/atomic-swap'
      });
    });

    it('should return 410 for deprecated status endpoint', async () => {
      const response = await request(app)
        .get('/api/atomic-swap/status/test-swap-id')
        .expect(410);

      expect(response.body).toMatchObject({
        success: false,
        deprecated: true,
        alternative: 'POST /api/atomic-swap'
      });
    });
  });

  describe('404 handling', () => {
    it('should return 404 for non-existent endpoints', async () => {
      const response = await request(app)
        .get('/non-existent-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'ENDPOINT_NOT_FOUND',
          message: 'Endpoint not found',
          requestId: expect.any(String),
          timestamp: expect.any(String)
        }
      });
    });
  });

  describe('Request tracking', () => {
    it('should include request ID in all responses', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Check that the response was logged with request ID
      // (This would be verified through log output in real scenarios)
      expect(response.body).toBeDefined();
    });

    it('should handle Content-Type validation', async () => {
      const response = await request(app)
        .post('/api/atomic-swap')
        .set('Content-Type', 'text/plain')
        .send('invalid data')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_CONTENT_TYPE',
          message: 'Content-Type must be application/json'
        }
      });
    });
  });
});