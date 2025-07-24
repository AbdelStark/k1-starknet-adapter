import dotenv from 'dotenv';
import { AtomicSwapper } from './atomicSwapper';
import { createDefaultConfig, swapLimits } from './atomicConfig';

dotenv.config();

async function testWBTCAtomicSwap() {
  console.log('🔧 Starting WBTC Atomic Swap Test');
  console.log('================================');

  let swapper: AtomicSwapper | null = null;

  try {
    // Create configuration from environment variables
    console.log('📋 Creating configuration...');
    const config = createDefaultConfig();
    
    console.log('Configuration:');
    console.log(`  - Starknet RPC: ${config.starknetRpcUrl}`);
    console.log(`  - Account: ${config.starknetAccountAddress}`);
    console.log(`  - Bitcoin Network: ${config.bitcoinNetwork}`);
    console.log(`  - Intermediary URL: ${config.intermediaryUrl || 'Default'}`);
    console.log(`  - Max Price Difference PPM: ${config.maxPricingDifferencePPM}`);
    console.log('');

    // Initialize AtomicSwapper
    console.log('🛠️ Initializing AtomicSwapper...');
    swapper = new AtomicSwapper(config);
    await swapper.initialize();
    console.log('✅ AtomicSwapper initialized successfully');
    console.log(`Starknet wallet address: ${swapper.getStarknetAddress()}`);

    // Get available tokens
    console.log('🪙 Getting available tokens...');
    const tokens = swapper.getAvailableTokens();
    console.log('Available token categories:', Object.keys(tokens));
    
    if (tokens.BITCOIN) {
      console.log('Available Bitcoin tokens:', Object.keys(tokens.BITCOIN));
    }

    // Check Starknet tokens
    const swapperInstance = swapper.getSwapper();
    if (swapperInstance.tokens && swapperInstance.tokens.STARKNET) {
      const starknetTokens = swapperInstance.tokens.STARKNET;
      const tokenAddresses = Object.keys(starknetTokens);
      console.log('Available Starknet token addresses:', tokenAddresses);
    }

    // Find suitable tokens for testing
    let sourceToken: any;
    let tokenName = 'Unknown';

    // Common Starknet token addresses (mainnet)
    const tokenMap: { [key: string]: string } = {
      '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7': 'ETH',
      '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d': 'STRK', 
      '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac': 'USDC',
      '0x04daa17763b286d1e59b97c283C0b8C949994C361e426A28F743c67bDfE9a32f': 'WBTC'
    };

    // Look for WBTC first, then other tokens
    const preferredOrder = [
      '0x04daa17763b286d1e59b97c283C0b8C949994C361e426A28F743c67bDfE9a32f', // WBTC
      '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d', // STRK
      '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7', // ETH
      '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac'  // USDC
    ];

    if (swapperInstance.tokens && swapperInstance.tokens.STARKNET) {
      const starknetTokens = swapperInstance.tokens.STARKNET;
      
      for (const address of preferredOrder) {
        if (starknetTokens[address]) {
          sourceToken = starknetTokens[address];
          tokenName = tokenMap[address] || `Token-${address.substring(0, 10)}...`;
          console.log(`✅ Found ${tokenName} token for testing (${address})`);
          break;
        }
      }

      // If none of the preferred tokens are found, use the first available
      if (!sourceToken) {
        const tokenAddresses = Object.keys(starknetTokens);
        if (tokenAddresses.length > 0) {
          const firstAddress = tokenAddresses[0];
          sourceToken = starknetTokens[firstAddress];
          tokenName = tokenMap[firstAddress] || `Token-${firstAddress.substring(0, 10)}...`;
          console.log(`⚠️ Using first available token: ${tokenName} (${firstAddress})`);
        }
      }
    }

    if (!sourceToken) {
      throw new Error('No suitable source token found');
    }

    // Get BTC Lightning token
    const btcLnToken = tokens.BITCOIN.BTCLN;
    console.log('✅ Found BTC Lightning token');

    // Check swap limits
    console.log('📊 Checking swap limits...');
    try {
      const limits = swapper.getSwapLimits(sourceToken, btcLnToken);
      console.log("Swap limits:");
      console.log("  - Input min:", limits.input.min?.toString() || 'N/A');
      console.log("  - Input max:", limits.input.max?.toString() || 'N/A');
      console.log("  - Output min:", limits.output.min?.toString() || 'N/A');
      console.log("  - Output max:", limits.output.max?.toString() || 'N/A');
    } catch (error) {
      console.log('⚠️ Could not retrieve swap limits:', (error as Error).message);
    }

    // Check token balance
    console.log('💰 Checking token balance...');
    try {
      const balance = await swapper.getSpendableBalance(sourceToken);
      console.log(`${tokenName} Balance: ${balance.toString()}`);
    } catch (error) {
      console.log('⚠️ Could not check balance:', (error as Error).message);
    }

    // Test creating a swap quote
    console.log(`\n💱 Testing ${tokenName} -> Lightning swap quote creation...`);
    const lightningDestination = 'chicdeal13@walletofsatoshi.com'; // LNURL-pay example
    const testAmount = 1000n; // Small test amount

    try {
      console.log(`Creating swap quote for ${testAmount.toString()} ${tokenName} units -> Lightning`);
      
      const swap = await swapper.createSwapQuote(
        sourceToken,              // Source token
        btcLnToken,               // Destination: BTC on Lightning
        testAmount,               // Amount
        true,                     // exactIn: true
        swapper.getStarknetAddress(), // Source address
        lightningDestination      // LNURL-pay destination
      );

      console.log('✅ Swap quote created successfully!');
      console.log('Swap details:');
      console.log(`  - Swap ID: ${swap.getId()}`);
      console.log(`  - Input Amount: ${swap.getInputWithoutFee().toString()} ${tokenName} units`);
      console.log(`  - Input with fees: ${swap.getInput().toString()} ${tokenName} units`);
      console.log(`  - Output Amount: ${swap.getOutput().toString()} satoshis`);
      console.log(`  - Fee: ${swap.getFee().amountInSrcToken.toString()} ${tokenName} units`);

      // Fee breakdown
      console.log('Fee breakdown:');
      for (const fee of swap.getFeeBreakdown()) {
        console.log(`  - ${fee.type}: ${fee.fee.amountInSrcToken.toString()} ${tokenName} units`);
      }
      
      try {
        const priceInfo = swap.getPriceInfo();
        console.log('Price information:');
        console.log(`  - Swap Price: ${priceInfo.swapPrice}`);
        console.log(`  - Market Price: ${priceInfo.marketPrice}`);
        console.log(`  - Price Difference: ${priceInfo.difference}%`);
      } catch (error) {
        console.log('⚠️ Could not get price info:', (error as Error).message);
      }

      console.log(`  - Quote expires in: ${(swap.getQuoteExpiry() - Date.now()) / 1000} seconds`);
      console.log(`  - Is paying to non-custodial wallet: ${swap.isPayingToNonCustodialWallet()}`);
      console.log(`  - Is likely to fail: ${swap.willLikelyFail()}`);

      console.log('\n📋 Swap execution flow:');
      console.log('   For Starknet -> Lightning:');
      console.log('   1. Call swap.commit(signer) to initiate on Starknet');
      console.log('   2. Call swap.waitForPayment() to wait for Lightning payment');
      console.log('   3. Handle success/failure and refunds as needed');
      
      console.log('\n   For Lightning -> Starknet:');
      console.log('   1. Pay the Lightning invoice shown in swap.getAddress()');
      console.log('   2. Call swap.waitForPayment() to detect payment');
      console.log('   3. Call swap.commit(signer) and swap.claim(signer) to complete');

      console.log('\n🎉 WBTC/Token Atomic Swap Test completed successfully!');
      console.log('📋 Summary:');
      console.log(`  - Successfully connected to Starknet and AtomiqLabs`);
      console.log(`  - Created swap quote for ${tokenName} -> Lightning`);
      console.log(`  - Swap ID: ${swap.getId()}`);
      console.log(`  - Input: ${swap.getInputWithoutFee().toString()} ${tokenName} units`);
      console.log(`  - Output: ${swap.getOutput().toString()} satoshis`);
      console.log(`  - Ready for execution when needed`);

      // Log swap limits from config
      console.log('\n⚙️ Configured swap limits:');
      console.log(`  - Min Lightning: ${swapLimits.minLightningAmount} sats`);
      console.log(`  - Max Lightning: ${swapLimits.maxLightningAmount} sats`);
      console.log(`  - Min Starknet: ${swapLimits.minStarknetAmount} units`);
      console.log(`  - Max Starknet: ${swapLimits.maxStarknetAmount} units`);

      return {
        success: true,
        swapId: swap.getId(),
        inputAmount: swap.getInputWithoutFee().toString(),
        outputAmount: swap.getOutput().toString(),
        tokenUsed: tokenName,
        tokenAddress: Object.keys(swapperInstance.tokens.STARKNET || {}).find(addr => 
          swapperInstance.tokens.STARKNET[addr] === sourceToken
        ),
        message: `Successfully created ${tokenName} -> Lightning swap quote`
      };

    } catch (swapError) {
      console.error('❌ Failed to create swap quote:', swapError);
      
      return {
        success: false,
        error: `Failed to create swap quote: ${(swapError as Error).message}`,
        tokenUsed: tokenName
      };
    }

  } catch (error) {
    console.error('❌ Atomic Swap Test failed:', error);
    
    if (error instanceof Error) {
      console.error('Error details:', {
        message: error.message,
        stack: error.stack
      });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  } finally {
    // Always clean up
    if (swapper) {
      try {
        await swapper.stop();
        console.log('🛑 Swapper stopped successfully');
      } catch (stopError) {
        console.error('⚠️ Error stopping swapper:', stopError);
      }
    }
  }
}

// Execute test if run directly
if (require.main === module) {
  testWBTCAtomicSwap()
    .then(result => {
      console.log('\n📊 Final Result:', result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Unhandled error:', error);
      process.exit(1);
    });
}

export { testWBTCAtomicSwap };