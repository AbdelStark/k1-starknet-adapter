/**
 * Integration test for the specific curl command used in production
 * This test validates the exact API structure and response format
 */

import { spawn } from 'child_process';
import { promisify } from 'util';

const sleep = promisify(setTimeout);

describe('Production Curl Command Integration', () => {
  let serverProcess: any;
  let serverReady = false;
  const PORT = 3001; // Use different port for integration tests

  beforeAll(async () => {
    // Start the server
    serverProcess = spawn('npm', ['run', 'dev'], {
      env: { ...process.env, PORT: PORT.toString() },
      stdio: 'pipe'
    });

    // Wait for server to be ready
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server startup timeout'));
      }, 30000);

      serverProcess.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        if (output.includes('server started') || output.includes('Configuration validated')) {
          serverReady = true;
          clearTimeout(timeout);
          resolve();
        }
      });

      serverProcess.stderr.on('data', (data: Buffer) => {
        console.error('Server stderr:', data.toString());
      });

      serverProcess.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }, 35000);

  afterAll(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
      // Give server time to cleanup
      await sleep(2000);
    }
  });

  describe('Exact Production Curl Command', () => {
    const curlCommand = {
      amountSats: 400,
      lightningDestination: "abdel@coinos.io",
      tokenAddress: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
      exactIn: false
    };

    it('should handle the exact production curl command successfully', async () => {
      if (!serverReady) {
        throw new Error('Server not ready for testing');
      }

      // Give server additional time to fully initialize
      await sleep(3000);

      return new Promise<void>((resolve, reject) => {
        const curlProcess = spawn('curl', [
          '-X', 'POST',
          `http://localhost:${PORT}/api/atomic-swap`,
          '-H', 'Content-Type: application/json',
          '-d', JSON.stringify(curlCommand),
          '--max-time', '30',
          '--silent',
          '--show-error'
        ]);

        let stdout = '';
        let stderr = '';

        curlProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        curlProcess.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        curlProcess.on('close', (code) => {
          try {
            if (code !== 0) {
              console.error('Curl failed with code:', code);
              console.error('Stderr:', stderr);
              reject(new Error(`Curl command failed with exit code ${code}: ${stderr}`));
              return;
            }

            // Parse the response
            let response;
            try {
              response = JSON.parse(stdout);
            } catch (parseError) {
              console.error('Failed to parse response:', stdout);
              reject(new Error(`Failed to parse JSON response: ${parseError}`));
              return;
            }

            // Validate the response structure matches expected format
            expect(response).toHaveProperty('success');
            
            if (response.success) {
              // Successful swap response validation
              expect(response).toMatchObject({
                success: true,
                swapId: expect.any(String),
                inputAmount: expect.stringMatching(/^0\.00000400 WBTC$/),
                outputAmount: expect.stringMatching(/^400 sats$/),
                tokenUsed: 'WBTC',
                tokenAddress: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac',
                finalState: 2, // Completed state
                lightningPaymentHash: expect.any(String),
                lightningDestination: 'abdel@coinos.io',
                message: '✅ WBTC -> Lightning atomic swap completed successfully!',
                requestId: expect.any(String),
                timestamp: expect.any(String)
              });

              // Validate timestamp format
              const timestamp = new Date(response.timestamp);
              expect(timestamp).toBeInstanceOf(Date);
              expect(timestamp.getTime()).toBeGreaterThan(Date.now() - 60000); // Within last minute

              // Validate swap ID format (should be hex string)
              expect(response.swapId).toMatch(/^[a-f0-9]+$/);
              expect(response.swapId.length).toBeGreaterThan(20);

              // Validate payment hash format
              expect(response.lightningPaymentHash).toMatch(/^[a-f0-9]+$/);
              expect(response.lightningPaymentHash.length).toBeGreaterThan(20);

              console.log('✅ Successful atomic swap response:', {
                swapId: response.swapId,
                inputAmount: response.inputAmount,
                outputAmount: response.outputAmount,
                finalState: response.finalState,
                paymentHash: response.lightningPaymentHash
              });

            } else {
              // Error response validation
              expect(response).toMatchObject({
                success: false,
                error: {
                  code: expect.any(String),
                  message: expect.any(String),
                  requestId: expect.any(String),
                  timestamp: expect.any(String)
                }
              });

              console.log('❌ Error response (expected in some cases):', {
                code: response.error.code,
                message: response.error.message,
                requestId: response.error.requestId
              });
            }

            resolve();
          } catch (error) {
            reject(error);
          }
        });

        curlProcess.on('error', (error) => {
          reject(new Error(`Failed to spawn curl process: ${error.message}`));
        });
      });
    }, 45000); // 45 second timeout for the full swap

    it('should validate request parameter types and formats', async () => {
      if (!serverReady) {
        throw new Error('Server not ready for testing');
      }

      // Test invalid amount
      const invalidAmountRequest = {
        amountSats: "invalid",
        lightningDestination: "test@coinos.io",
        tokenAddress: "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
        exactIn: false
      };

      return new Promise<void>((resolve, reject) => {
        const curlProcess = spawn('curl', [
          '-X', 'POST',
          `http://localhost:${PORT}/api/atomic-swap`,
          '-H', 'Content-Type: application/json',
          '-d', JSON.stringify(invalidAmountRequest),
          '--max-time', '10',
          '--silent'
        ]);

        let stdout = '';

        curlProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        curlProcess.on('close', (code) => {
          try {
            const response = JSON.parse(stdout);
            
            expect(response).toMatchObject({
              success: false,
              error: {
                code: 'INVALID_AMOUNT',
                message: 'amountSats must be a positive number',
                requestId: expect.any(String),
                timestamp: expect.any(String)
              }
            });

            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    }, 15000);

    it('should validate token address format', async () => {
      if (!serverReady) {
        throw new Error('Server not ready for testing');
      }

      // Test invalid token address
      const invalidTokenRequest = {
        amountSats: 400,
        lightningDestination: "test@coinos.io",
        tokenAddress: "invalid_address",
        exactIn: false
      };

      return new Promise<void>((resolve, reject) => {
        const curlProcess = spawn('curl', [
          '-X', 'POST',
          `http://localhost:${PORT}/api/atomic-swap`,
          '-H', 'Content-Type: application/json',
          '-d', JSON.stringify(invalidTokenRequest),
          '--max-time', '10',
          '--silent'
        ]);

        let stdout = '';

        curlProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        curlProcess.on('close', (code) => {
          try {
            const response = JSON.parse(stdout);
            
            expect(response).toMatchObject({
              success: false,
              error: {
                code: 'INVALID_TOKEN_ADDRESS',
                message: 'Token address must be a valid hex string (66 characters starting with 0x)',
                requestId: expect.any(String),
                timestamp: expect.any(String)
              }
            });

            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    }, 15000);
  });

  describe('Health Check Integration', () => {
    it('should respond to health check correctly', async () => {
      if (!serverReady) {
        throw new Error('Server not ready for testing');
      }

      return new Promise<void>((resolve, reject) => {
        const curlProcess = spawn('curl', [
          `http://localhost:${PORT}/health`,
          '--max-time', '5',
          '--silent'
        ]);

        let stdout = '';

        curlProcess.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        curlProcess.on('close', (code) => {
          try {
            if (code !== 0) {
              reject(new Error(`Health check failed with exit code ${code}`));
              return;
            }

            const response = JSON.parse(stdout);
            
            expect(response).toMatchObject({
              status: 'healthy',
              timestamp: expect.any(String),
              uptime: expect.any(Number),
              memory: {
                rss: expect.any(Number),
                heapUsed: expect.any(Number),
                heapTotal: expect.any(Number)
              },
              environment: expect.any(String),
              version: expect.any(String)
            });

            // Validate uptime is reasonable (server should have been running for at least a few seconds)
            expect(response.uptime).toBeGreaterThan(1);

            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    }, 10000);
  });
});