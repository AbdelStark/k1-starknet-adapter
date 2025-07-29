#!/usr/bin/env ts-node

/**
 * Braavos Account Integration Example
 * 
 * This script demonstrates how to use existing Braavos accounts with the
 * K1 Starknet Adapter instead of creating new OpenZeppelin accounts.
 * 
 * Prerequisites:
 * 1. You must have an existing Braavos wallet with your private key
 * 2. Your Braavos account must be deployed on the target network
 * 3. Your account should have WBTC tokens for testing atomic swaps
 * 
 * Usage:
 * 1. Set your Braavos credentials in environment variables
 * 2. Run: npm run braavos-example
 * 
 * @fileoverview Braavos Integration Example
 * @author K1 Team
 * @version 1.0.0
 */

import { AtomicSwapper } from '../../src/atomicSwapper';
import { createDefaultConfig } from '../../src/atomicConfig';
import { createBraavosAccount, isBraavosAccount, getAccountInfo } from '../../src/braavos/SimpleBraavosAdapter';
import { RpcProvider } from 'starknet';

/**
 * Example configuration for Braavos integration
 */
interface BraavosExampleConfig {
  readonly privateKey: string;
  readonly accountAddress: string;
  readonly rpcUrl: string;
  readonly testMode: boolean;
}

/**
 * Get configuration from environment variables or use defaults
 */
function getExampleConfig(): BraavosExampleConfig {
  return {
    privateKey: process.env.STARKNET_PRIVATE_KEY || '',
    accountAddress: process.env.STARKNET_ACCOUNT_ADDRESS || '',
    rpcUrl: process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_8',
    testMode: process.env.NODE_ENV !== 'production'
  };
}

/**
 * Verify that the provided credentials correspond to a Braavos account
 */
async function verifyBraavosAccount(config: BraavosExampleConfig): Promise<void> {
  console.log('🔍 Verifying Braavos account...');
  
  console.log('📍 Account address:', config.accountAddress);
  
  // Check if the account is actually a Braavos account
  const provider = new RpcProvider({ nodeUrl: config.rpcUrl });
  const isBraavos = await isBraavosAccount(config.accountAddress, provider);
  
  if (isBraavos) {
    console.log('✅ Confirmed: This is a Braavos account');
  } else {
    console.log('❌ WARNING: This does not appear to be a Braavos account');
    console.log('   It might be an OpenZeppelin account or not deployed yet');
    console.log('   The integration will still work as long as the private key is correct');
  }
}

/**
 * Example 1: Basic Braavos Signer Creation
 */
async function example1_BasicBraavosSignerCreation(): Promise<void> {
  console.log('\n🚀 Example 1: Basic Braavos Signer Creation');
  console.log('=============================================');
  
  const config = getExampleConfig();
  
  if (!config.privateKey || !config.accountAddress) {
    console.log('❌ Missing STARKNET_PRIVATE_KEY or STARKNET_ACCOUNT_ADDRESS');
    console.log('   Please set these environment variables to run this example');
    return;
  }
  
  try {
    // Create Braavos account
    const account = await createBraavosAccount({
      privateKey: config.privateKey,
      accountAddress: config.accountAddress,
      rpcUrl: config.rpcUrl
    });
    
    console.log('✅ Braavos account created successfully');
    
    // Get account info
    const accountInfo = await getAccountInfo(account);
    console.log('📍 Account address:', accountInfo.address);
    console.log('🔢 Account nonce:', accountInfo.nonce);
    if (accountInfo.classHash) {
      console.log('🏛️  Class hash:', accountInfo.classHash);
    }
    
  } catch (error) {
    console.error('❌ Failed to create Braavos account:', error instanceof Error ? error.message : error);
  }
}

/**
 * Example 2: Using Braavos with AtomicSwapper
 */
async function example2_BraavosWithAtomicSwapper(): Promise<void> {
  console.log('\n🚀 Example 2: Using Braavos with AtomicSwapper');
  console.log('===============================================');
  
  const config = getExampleConfig();
  
  if (!config.privateKey || !config.accountAddress) {
    console.log('❌ Missing credentials - skipping this example');
    return;
  }
  
  try {
    // Create atomic swapper configuration
    const swapperConfig = createDefaultConfig();
    swapperConfig.useBraavosAccount = true; // Enable Braavos mode
    
    // Create AtomicSwapper instance
    const swapper = new AtomicSwapper(swapperConfig);
    
    // Initialize with Braavos account (this will use env vars)
    console.log('🔄 Initializing AtomicSwapper with Braavos account...');
    await swapper.initialize();
    
    console.log('✅ AtomicSwapper initialized with Braavos account');
    
    // Get available tokens
    const tokens = swapper.getAvailableTokens();
    console.log('🪙 Available tokens for swapping:');
    
    if (tokens && tokens.STARKNET) {
      const starknetTokens = Object.values(tokens.STARKNET);
      starknetTokens.forEach((token: any) => {
        console.log(`   • ${token.symbol} (${token.address})`);
      });
    } else {
      console.log('   No tokens available or not properly initialized');
    }
    
    // Get Starknet address being used
    const starknetAddress = swapper.getStarknetAddress();
    console.log('📍 Starknet address in use:', starknetAddress);
    
  } catch (error) {
    console.error('❌ Failed to initialize AtomicSwapper with Braavos:', error instanceof Error ? error.message : error);
  }
}

/**
 * Example 3: Manual Braavos Signer Integration
 */
async function example3_ManualBraavosIntegration(): Promise<void> {
  console.log('\n🚀 Example 3: Manual Braavos Signer Integration');
  console.log('================================================');
  
  const config = getExampleConfig();
  
  if (!config.privateKey || !config.accountAddress) {
    console.log('❌ Missing credentials - skipping this example');
    return;
  }
  
  try {
    // Create atomic swapper with regular config
    const swapperConfig = createDefaultConfig();
    const swapper = new AtomicSwapper(swapperConfig);
    
    // Manually initialize Braavos signer before regular initialization
    console.log('🔄 Manually setting up Braavos signer...');
    await swapper.initializeBraavosStarknetSigner(
      config.privateKey,
      config.accountAddress
    );
    
    // Now initialize the rest of the swapper
    console.log('🔄 Completing AtomicSwapper initialization...');
    await swapper.initialize();
    
    console.log('✅ AtomicSwapper initialized with manual Braavos setup');
    console.log('📍 Using account:', swapper.getStarknetAddress());
    
  } catch (error) {
    console.error('❌ Failed manual Braavos integration:', error instanceof Error ? error.message : error);
  }
}

/**
 * Display configuration and setup instructions
 */
function displaySetupInstructions(): void {
  console.log('📋 Braavos Integration Setup Instructions');
  console.log('==========================================');
  console.log('');
  console.log('To use your existing Braavos account with K1 Starknet Adapter:');
  console.log('');
  console.log('1. 🔑 Set your Braavos account credentials:');
  console.log('   export STARKNET_PRIVATE_KEY="0x1234..."  # Your Braavos private key');
  console.log('   export STARKNET_ACCOUNT_ADDRESS="0x5678..."  # Your Braavos account address');
  console.log('');
  console.log('2. 🌐 Configure network (optional):');
  console.log('   export STARKNET_RPC_URL="https://starknet-sepolia.public.blastapi.io/rpc/v0_8"');
  console.log('');
  console.log('3. 🚀 Enable Braavos mode:');
  console.log('   export USE_BRAAVOS_ACCOUNT="true"');
  console.log('');
  console.log('4. 💰 Ensure your Braavos account has:');
  console.log('   • Sufficient STRK for transaction fees');
  console.log('   • WBTC tokens if you want to test atomic swaps');
  console.log('');
  console.log('5. 🔍 Find your credentials:');
  console.log('   • Open your Braavos wallet');
  console.log('   • Go to Settings > Export Private Key');
  console.log('   • Copy your private key and account address');
  console.log('');
  console.log('6. ⚠️  Security reminders:');
  console.log('   • Never share your private key');
  console.log('   • Use environment variables, not hardcoded values');
  console.log('   • Test with small amounts first');
  console.log('');
}

/**
 * Main execution function
 */
async function main(): Promise<void> {
  console.log('🎯 K1 Starknet Adapter - Braavos Integration Examples');
  console.log('======================================================');
  
  const config = getExampleConfig();
  
  // Show setup instructions
  displaySetupInstructions();
  
  // Check if we have the required configuration
  if (!config.privateKey || !config.accountAddress) {
    console.log('❌ Missing required environment variables');
    console.log('   Please set STARKNET_PRIVATE_KEY and STARKNET_ACCOUNT_ADDRESS');
    console.log('   Run this script again after setting them up');
    return;
  }
  
  console.log('✅ Configuration loaded:');
  console.log('   🔑 Private key: [REDACTED]');
  console.log('   📍 Account:', config.accountAddress);
  console.log('   🌐 RPC URL:', config.rpcUrl);
  console.log('   🧪 Test mode:', config.testMode);
  
  // Verify the account
  try {
    await verifyBraavosAccount(config);
  } catch (error) {
    console.error('❌ Account verification failed:', error instanceof Error ? error.message : error);
  }
  
  // Run examples
  await example1_BasicBraavosSignerCreation();
  await example2_BraavosWithAtomicSwapper();
  await example3_ManualBraavosIntegration();
  
  console.log('\n🎉 Examples completed!');
  console.log('');
  console.log('💡 Next steps:');
  console.log('   • Test with a small atomic swap');
  console.log('   • Monitor transaction fees and gas usage');
  console.log('   • Integrate into your application');
  console.log('');
}

/**
 * Error handling wrapper
 */
async function runWithErrorHandling(): Promise<void> {
  try {
    await main();
  } catch (error) {
    console.error('💥 Script failed:', error instanceof Error ? error.message : error);
    console.error('Stack trace:', error instanceof Error ? error.stack : undefined);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  runWithErrorHandling().catch(console.error);
}

export { main as runBraavosExample };