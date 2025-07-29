import { Router, Request, Response } from 'express';
import { BalanceService } from './balanceService';
import { InvoiceDTO, ResultDTO, AtomicSwapRequest } from './types';
import { logSwapStart, logSwapSuccess, logSwapFailure, createSwapLogger } from './logger';

const router = Router();
const balanceService = new BalanceService();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  req.logger.info('Health check requested');
  
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  };
  
  return res.json(healthData);
});

// WBTC Balance endpoint
router.get('/balance/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    
    // Validate address format
    if (!address || !address.startsWith('0x')) {
      req.logger.warn('Invalid address format provided', { address });
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ADDRESS',
          message: 'Address must be a valid hex string starting with 0x',
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        }
      });
    }
    
    req.logger.info('Balance request initiated', { address });
    
    const balanceData = await balanceService.getWBTCBalance(address);
    
    const response = {
      success: true,
      message: 'WBTC balance retrieved successfully',
      data: balanceData
    };
    
    req.logger.info('Balance request completed successfully', { 
      address, 
      balance: balanceData.balance
    });
    
    return res.json(response);
  } catch (error) {
    req.logger.error('Error in balance endpoint', {
      address: req.params.address,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return res.status(500).json({
      success: false,
      error: {
        code: 'BALANCE_QUERY_FAILED',
        message: 'Failed to retrieve balance',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Main invoice endpoint (compatible with K1 backend)
router.post('/api/invoice', async (req: Request, res: Response) => {
  const result: ResultDTO = { success: false };
  
  try {
    const invoice: InvoiceDTO = req.body;
    console.log('Received invoice request:', invoice);

    // Validate request
    if (!invoice.amountUSD || !invoice.address) {
      result.message = 'Missing required fields: amountUSD and address';
      return res.status(400).json(result);
    }

    // Determine if this is a Lightning address or Starknet address
    const isLightningAddress = invoice.address.includes('@') || 
                              invoice.address.startsWith('lnbc') || 
                              invoice.address.startsWith('lnurl') ||
                              invoice.address.startsWith('lightning:');

    if (!isLightningAddress) {
      result.message = 'This endpoint currently only supports Lightning destinations';
      return res.status(400).json(result);
    }

    // Convert USD amount to approximate satoshis (placeholder conversion rate)
    // In production, you would fetch real-time BTC/USD rates
    const btcUsdRate = 45000; // $45,000 per BTC
    const btcAmount = invoice.amountUSD / btcUsdRate;
    const satoshiAmount = Math.floor(btcAmount * 100000000); // Convert to satoshis

    if (satoshiAmount < 1) {
      result.message = 'Amount too small - minimum 1 satoshi required';
      return res.status(400).json(result);
    }

    // Use WBTC as default token for invoice payments
    const wbtcAddress = '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac';

    // Redirect to the new atomic swap endpoint internally
    const swapRequest = {
      amountSats: satoshiAmount,
      lightningDestination: invoice.address,
      tokenAddress: wbtcAddress,
      exactIn: false
    };

    // Use the same logic as the /api/atomic-swap endpoint
    const { AtomicSwapper } = await import('./atomicSwapper');
    const { createDefaultConfig } = await import('./atomicConfig');

    const config = createDefaultConfig();
    const swapper = new AtomicSwapper(config);
    await swapper.initialize();

    const tokens = swapper.getAvailableTokens();
    const starknetTokens = Object.values(tokens.STARKNET || {});
    const tokenInfo = starknetTokens.find((t: any) => t.address === wbtcAddress);
    
    if (!tokenInfo) {
      await swapper.stop();
      result.message = 'WBTC token not available for invoice payments';
      return res.status(400).json(result);
    }

    const lightningToken = Object.values(tokens.BITCOIN || {}).find((t: any) => t.lightning === true);
    if (!lightningToken) {
      await swapper.stop();
      result.message = 'Lightning network not available';
      return res.status(503).json(result);
    }

    const swap = await swapper.createSwapQuote(
      tokenInfo,
      lightningToken,
      BigInt(satoshiAmount),
      false,
      swapper.getStarknetAddress(),
      invoice.address
    );

    const signer = swapper.getStarknetSigner();
    await swap.commit(signer);
    const paymentReceived = await swap.waitForPayment();

    await swapper.stop();

    if (paymentReceived) {
      result.success = true;
      result.message = 'Payment completed successfully';
      result.data = {
        swapId: swap.getId(),
        amountUSD: invoice.amountUSD,
        amountSats: satoshiAmount,
        destination: invoice.address,
        status: 'completed'
      };
    } else {
      result.message = 'Payment timeout - Lightning payment not received';
    }

  } catch (error) {
    console.error('Error processing invoice:', error);
    result.message = error instanceof Error ? error.message : 'Unknown error occurred';
  }

  return res.json(result);
});

// Legacy atomic swap endpoints (deprecated - use /api/atomic-swap instead)
router.post('/api/atomic-swap/quote', async (req: Request, res: Response) => {
  try {
    return res.status(410).json({
      success: false,
      message: 'This endpoint is deprecated. Use POST /api/atomic-swap for direct execution.',
      deprecated: true,
      alternative: 'POST /api/atomic-swap'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

router.post('/api/atomic-swap/execute', async (req: Request, res: Response) => {
  try {
    return res.status(410).json({
      success: false,
      message: 'This endpoint is deprecated. Use POST /api/atomic-swap for direct execution.',
      deprecated: true,
      alternative: 'POST /api/atomic-swap'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

router.get('/api/atomic-swap/status/:swapId', async (req: Request, res: Response) => {
  try {
    return res.status(410).json({
      success: false,
      message: 'This endpoint is deprecated. Swap status is returned directly from POST /api/atomic-swap.',
      deprecated: true,
      alternative: 'POST /api/atomic-swap'
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Direct atomic swap execution endpoint using AtomicSwapper
router.post('/api/atomic-swap', async (req: Request, res: Response) => {
  let swapId: string | undefined;
  let swapLogger: ReturnType<typeof createSwapLogger> | undefined;
  let swapper: any = null;
  let swapParams: any = {};

  try {
    const {
      amountSats,
      lightningDestination,
      tokenAddress,
      exactIn = false
    } = req.body;

    // Validate required fields
    if (!amountSats || !lightningDestination || !tokenAddress) {
      req.logger.warn('Missing required fields in atomic swap request', { 
        received: { amountSats: !!amountSats, lightningDestination: !!lightningDestination, tokenAddress: !!tokenAddress }
      });
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required fields: amountSats, lightningDestination, tokenAddress',
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate amount is a valid number
    const amount = typeof amountSats === 'string' ? parseInt(amountSats) : Number(amountSats);
    if (isNaN(amount) || amount <= 0) {
      req.logger.warn('Invalid amount provided', { amountSats, parsedAmount: amount });
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_AMOUNT',
          message: 'amountSats must be a positive number',
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate token address format
    if (!tokenAddress.startsWith('0x') || tokenAddress.length !== 66) {
      req.logger.warn('Invalid token address format', { tokenAddress });
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_TOKEN_ADDRESS',
          message: 'Token address must be a valid hex string (66 characters starting with 0x)',
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        }
      });
    }

    swapParams = {
      amountSats: amount,
      lightningDestination,
      tokenAddress,
      exactIn
    };

    req.logger.info('Atomic swap execution initiated', swapParams);

    // Dynamic import to avoid circular dependencies
    const { AtomicSwapper } = await import('./atomicSwapper');
    const { createDefaultConfig } = await import('./atomicConfig');

    // Create configuration
    const config = createDefaultConfig();
    
    // Initialize AtomicSwapper
    swapper = new AtomicSwapper(config);
    await swapper.initialize();
    
    req.logger.info('AtomicSwapper initialized successfully', {
      starknetAddress: swapper.getStarknetAddress()
    });

    // Get available tokens to find the token info
    const tokens = swapper.getAvailableTokens();
    const starknetTokens = Object.values(tokens.STARKNET || {});
    const tokenInfo = starknetTokens.find((t: any) => t.address === tokenAddress);
    
    if (!tokenInfo) {
      req.logger.error('Token not found', { 
        tokenAddress, 
        availableTokens: starknetTokens.map((t: any) => ({ address: t.address, ticker: t.ticker }))
      });
      
      await swapper.stop();
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_NOT_FOUND',
          message: `Token not found for address: ${tokenAddress}`,
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Find Lightning BTC token
    const lightningToken = Object.values(tokens.BITCOIN || {}).find((t: any) => t.lightning === true);
    if (!lightningToken) {
      req.logger.error('Lightning BTC token not available', {
        availableBitcoinTokens: Object.values(tokens.BITCOIN || {}).map((t: any) => ({ ticker: t.ticker, lightning: t.lightning }))
      });
      
      await swapper.stop();
      return res.status(503).json({
        success: false,
        error: {
          code: 'LIGHTNING_NOT_AVAILABLE',
          message: 'Lightning BTC token not available',
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        }
      });
    }

    req.logger.info('Token validation completed', {
      sourceToken: { ticker: (tokenInfo as any).ticker, address: (tokenInfo as any).address },
      destinationToken: { ticker: (lightningToken as any).ticker, lightning: true },
      lightningDestination
    });

    // Create swap quote (Starknet token -> Lightning BTC)
    req.logger.info('Creating swap quote');
    const swap = await swapper.createSwapQuote(
      tokenInfo,        // Source token (Starknet token)
      lightningToken,   // Destination token (Lightning BTC)
      BigInt(amount),   // Amount
      exactIn,          // exactIn
      swapper.getStarknetAddress(), // Source address
      lightningDestination          // Destination address
    );

    swapId = swap.getId();
    if (!swapId) {
      throw new Error('Failed to get swap ID from swap quote');
    }
    
    swapLogger = createSwapLogger(swapId);
    
    // Log swap start event
    logSwapStart(swapId, swapParams);
    
    swapLogger.info('Swap quote created successfully', {
      inputAmount: swap.getInputWithoutFee().toString(),
      outputAmount: swap.getOutput().toString(),
      swapState: swap.getState()
    });

    // Execute the atomic swap following the same pattern as the test
    swapLogger.info('Starting atomic swap execution - Starknet to Lightning');
    swapLogger.info('Step 1: Committing swap on Starknet');

    const signer = swapper.getStarknetSigner();
    swapLogger.debug('Using signer', { signerAddress: signer.getAddress() });

    // Step 1: Commit the swap on Starknet
    await swap.commit(signer);
    swapLogger.info('Swap committed successfully on Starknet', {
      swapState: swap.getState()
    });

    // Step 2: Wait for Lightning payment
    swapLogger.info('Step 2: Waiting for Lightning payment');
    const paymentReceived = await swap.waitForPayment();

    if (!paymentReceived) {
      const timeoutError = new Error('Lightning payment not received within timeout');
      
      if (swapId && swapLogger) {
        logSwapFailure(swapId, timeoutError, swapParams);
        swapLogger.error('Lightning payment timeout', {
          swapState: swap.getState(),
          timeout: 'Payment not received within expected timeframe'
        });
      }
      
      if (swapper) await swapper.stop();
      return res.status(408).json({
        success: false,
        error: {
          code: 'PAYMENT_TIMEOUT',
          message: 'Lightning payment not received within timeout',
          swapId: swapId,
          finalState: swap.getState(),
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        }
      });
    }

    // Payment successful
    swapLogger!.info('Lightning payment received successfully', {
      finalState: swap.getState()
    });

    // Get additional swap details
    const secret = swap.getSecret?.();
    const txId = swap.getTransactionId?.();

    const swapResult = {
      success: true,
      swapId: swap.getId(),
      inputAmount: `${swap.getInputWithoutFee().toString()} ${(tokenInfo as any).ticker}`,
      outputAmount: `${swap.getOutput().toString()} BTC`,
      tokenUsed: (tokenInfo as any).ticker,
      tokenAddress: (tokenInfo as any).address,
      finalState: swap.getState(),
      lightningPaymentHash: secret || null,
      transactionId: txId || null,
      lightningDestination: lightningDestination,
      message: `✅ ${(tokenInfo as any).ticker} -> Lightning atomic swap completed successfully!`,
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    };
    
    // Log successful completion
    logSwapSuccess(swapId!, swapResult);
    
    // Stop the swapper
    await swapper.stop();

    // Return successful response
    return res.json(swapResult);

  } catch (error) {
    // Ensure swapper is cleaned up
    if (swapper) {
      try {
        await swapper.stop();
      } catch (stopError) {
        req.logger.error('Error stopping swapper during cleanup', {
          stopError: stopError instanceof Error ? stopError.message : String(stopError)
        });
      }
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log error with context
    if (swapId) {
      logSwapFailure(swapId, error instanceof Error ? error : new Error(errorMessage), swapParams);
    }
    
    req.logger.error('Atomic swap execution failed', {
      error: errorMessage,
      stack: errorStack,
      swapId,
      swapParams
    });

    // Determine appropriate error code and status
    let statusCode = 500;
    let errorCode = 'SWAP_EXECUTION_FAILED';
    
    if (errorMessage.includes('insufficient balance')) {
      statusCode = 400;
      errorCode = 'INSUFFICIENT_BALANCE';
    } else if (errorMessage.includes('network')) {
      statusCode = 503;
      errorCode = 'NETWORK_ERROR';
    } else if (errorMessage.includes('timeout')) {
      statusCode = 408;
      errorCode = 'TIMEOUT_ERROR';
    }

    return res.status(statusCode).json({
      success: false,
      error: {
        code: errorCode,
        message: 'Atomic swap execution failed',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
        swapId: swapId || undefined,
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;