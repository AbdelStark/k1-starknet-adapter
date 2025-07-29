import { Router, Request, Response } from 'express';
import { AtomicSwapService } from './atomicSwapSimple';
import { BalanceService } from './balanceService';
import { InvoiceDTO, ResultDTO, AtomicSwapRequest } from './types';

const router = Router();
const atomicSwapService = new AtomicSwapService();
const balanceService = new BalanceService();

// Health check endpoint
router.get('/health', (req: Request, res: Response) => {
  return res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// WBTC Balance endpoint
router.get('/balance/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    console.log(`Balance request for address: ${address}`);
    
    const response = await balanceService.getWBTCBalance(address);
    return res.json(response);
  } catch (error) {
    console.error('Error in balance endpoint:', error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : 'Unknown error occurred'
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
      return res.json(result);
    }

    // Initialize atomic swap service if not already done
    await atomicSwapService.initialize();

    // Determine if this is a Lightning address or Starknet address
    const isLightningAddress = invoice.address.includes('@') || 
                              invoice.address.startsWith('lnbc') || 
                              invoice.address.startsWith('lnurl') ||
                              invoice.address.startsWith('lightning:');

    const swapRequest: AtomicSwapRequest = {
      amountUSD: invoice.amountUSD,
      lightningAddress: invoice.address,
      direction: isLightningAddress ? 'starknet_to_lightning' : 'lightning_to_starknet'
    };

    // Create swap quote
    const quoteResponse = await atomicSwapService.createSwapQuote(swapRequest);
    
    if (!quoteResponse.success) {
      result.message = quoteResponse.message;
      return res.json(result);
    }

    // Execute the swap
    const executeResponse = await atomicSwapService.executeSwap(
      quoteResponse.data!.swapId!, 
      swapRequest.direction
    );

    if (executeResponse.success) {
      result.success = true;
      result.message = 'Payment completed successfully';
      result.data = executeResponse.data;
    } else {
      result.message = executeResponse.message;
    }

  } catch (error) {
    console.error('Error processing invoice:', error);
    result.message = error instanceof Error ? error.message : 'Unknown error occurred';
  }

  return res.json(result);
});

// Atomic swap specific endpoints
router.post('/api/atomic-swap/quote', async (req: Request, res: Response) => {
  try {
    const swapRequest: AtomicSwapRequest = req.body;
    await atomicSwapService.initialize();
    const response = await atomicSwapService.createSwapQuote(swapRequest);
    return res.json(response);
  } catch (error) {
    return res.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

router.post('/api/atomic-swap/execute', async (req: Request, res: Response) => {
  try {
    const { swapId, direction } = req.body;
    await atomicSwapService.initialize();
    const response = await atomicSwapService.executeSwap(swapId, direction);
    return res.json(response);
  } catch (error) {
    return res.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

router.get('/api/atomic-swap/status/:swapId', async (req: Request, res: Response) => {
  try {
    const { swapId } = req.params;
    await atomicSwapService.initialize();
    const response = await atomicSwapService.getSwapStatus(swapId);
    return res.json(response);
  } catch (error) {
    return res.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Direct atomic swap execution endpoint using AtomicSwapper
router.post('/api/atomic-swap', async (req: Request, res: Response) => {
  try {
    const {
      amountSats,
      lightningDestination,
      tokenAddress,
      exactIn = false
    } = req.body;

    // Validate required fields
    if (!amountSats || !lightningDestination || !tokenAddress) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: amountSats, lightningDestination, tokenAddress'
      });
    }

    // Validate amount is a valid number
    const amount = typeof amountSats === 'string' ? parseInt(amountSats) : Number(amountSats);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'amountSats must be a positive number'
      });
    }

    console.log('🚀 Starting atomic swap execution via REST API');
    console.log('Request parameters:', {
      amountSats: amount.toString(),
      lightningDestination,
      tokenAddress,
      exactIn
    });

    // Dynamic import to avoid circular dependencies
    const { AtomicSwapper } = await import('./atomicSwapper');
    const { createDefaultConfig } = await import('./atomicConfig');

    // Create configuration
    const config = createDefaultConfig();
    
    // Initialize AtomicSwapper
    const swapper = new AtomicSwapper(config);
    await swapper.initialize();
    
    console.log('✅ AtomicSwapper initialized');
    console.log(`Starknet wallet address: ${swapper.getStarknetAddress()}`);

    // Get available tokens to find the token info
    const tokens = swapper.getAvailableTokens();
    const starknetTokens = Object.values(tokens.STARKNET || {});
    const tokenInfo = starknetTokens.find((t: any) => t.address === tokenAddress);
    
    if (!tokenInfo) {
      await swapper.stop();
      return res.status(400).json({
        success: false,
        message: `Token not found for address: ${tokenAddress}`
      });
    }

    // Find Lightning BTC token
    const lightningToken = Object.values(tokens.BITCOIN || {}).find((t: any) => t.lightning === true);
    if (!lightningToken) {
      await swapper.stop();
      return res.status(400).json({
        success: false,
        message: 'Lightning BTC token not available'
      });
    }

    console.log(`Using token: ${(tokenInfo as any).ticker} (${(tokenInfo as any).address})`);
    console.log(`Lightning destination: ${lightningDestination}`);

    // Create swap quote (Starknet token -> Lightning BTC)
    console.log('💱 Creating swap quote...');
    const swap = await swapper.createSwapQuote(
      tokenInfo,        // Source token (Starknet token)
      lightningToken,   // Destination token (Lightning BTC)
      BigInt(amount),   // Amount
      exactIn,          // exactIn
      swapper.getStarknetAddress(), // Source address
      lightningDestination          // Destination address
    );

    console.log('✅ Swap quote created successfully!');
    console.log(`Swap ID: ${swap.getId()}`);
    console.log(`Input Amount: ${swap.getInputWithoutFee().toString()}`);
    console.log(`Output Amount: ${swap.getOutput().toString()}`);

    // Execute the atomic swap following the same pattern as the test
    console.log('🚀 Executing atomic swap...');
    console.log('This is a Starknet -> Lightning swap, so we:');
    console.log('1. Commit the swap on Starknet');
    console.log('2. Wait for Lightning payment to complete');

    const signer = swapper.getStarknetSigner();
    console.log(`Using signer address: ${signer.getAddress()}`);

    // Step 1: Commit the swap on Starknet
    console.log('📝 Step 1: Committing swap on Starknet...');
    await swap.commit(signer);
    console.log('✅ Swap committed successfully on Starknet');
    console.log(`Current swap state: ${swap.getState()}`);

    // Step 2: Wait for Lightning payment
    console.log('⚡ Step 2: Waiting for Lightning payment...');
    console.log('The intermediary should now process the Lightning payment...');

    const paymentReceived = await swap.waitForPayment();

    if (!paymentReceived) {
      await swapper.stop();
      return res.status(408).json({
        success: false,
        message: 'Lightning payment not received within timeout',
        swapId: swap.getId(),
        finalState: swap.getState()
      });
    }

    console.log('✅ Lightning payment received successfully!');
    console.log(`Final swap state: ${swap.getState()}`);

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
      message: `✅ ${(tokenInfo as any).ticker} -> Lightning atomic swap completed successfully!`
    };
    
    // Stop the swapper
    await swapper.stop();

    // Return successful response
    return res.json(swapResult);

  } catch (error) {
    console.error('Error in atomic swap execution:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      error: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

export default router;