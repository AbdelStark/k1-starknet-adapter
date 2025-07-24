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

export default router;