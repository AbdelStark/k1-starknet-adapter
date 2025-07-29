#!/usr/bin/env ts-node

/**
 * TypeScript script to test the atomic swap endpoint
 * Provides detailed testing of the main atomic swap functionality
 */

interface TestConfig {
  readonly baseUrl: string;
  readonly testData: {
    readonly amountSats: number;
    readonly lightningDestination: string;
    readonly tokenAddress: string;
    readonly exactIn: boolean;
  };
}

interface AtomicSwapResponse {
  success: boolean;
  swapId?: string;
  inputAmount?: string;
  outputAmount?: string;
  lightningPaymentHash?: string;
  requestId?: string;
  error?: {
    code: string;
    message: string;
    requestId?: string;
    details?: string;
  };
  message?: string;
}

/**
 * Main test configuration
 */
const CONFIG: TestConfig = {
  baseUrl: process.env.TEST_BASE_URL || 'http://localhost:3000',
  testData: {
    amountSats: 442,
    lightningDestination: 'abdel@coinos.io',
    tokenAddress: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac', // WBTC
    exactIn: false
  }
};

/**
 * Test the atomic swap endpoint with comprehensive error handling
 */
async function testAtomicSwapEndpoint(): Promise<void> {
  console.log('🧪 Testing Atomic Swap REST Endpoint');
  console.log('====================================');
  console.log(`Endpoint: ${CONFIG.baseUrl}/api/atomic-swap`);
  console.log('Test data:', JSON.stringify(CONFIG.testData, null, 2));
  console.log('');

  try {
    console.log('📡 Sending POST request...');
    
    const startTime = Date.now();
    const response = await fetch(`${CONFIG.baseUrl}/api/atomic-swap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'K1-Starknet-Adapter-Test-Script/1.0.0'
      },
      body: JSON.stringify(CONFIG.testData)
    });
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`📊 Response received in ${duration}ms`);
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    
    // Log response headers for debugging
    console.log('📋 Response headers:');
    response.headers.forEach((value, key) => {
      console.log(`  ${key}: ${value}`);
    });
    
    const result: AtomicSwapResponse = await response.json();
    
    console.log('📋 Response body:');
    console.log(JSON.stringify(result, null, 2));
    
    // Analyze the response
    if (result.success) {
      console.log('');
      console.log('🎉 SUCCESS! Atomic swap completed via REST API');
      console.log(`📝 Results Summary:`);
      console.log(`   • Swap ID: ${result.swapId}`);
      console.log(`   • Input Amount: ${result.inputAmount}`);
      console.log(`   • Output Amount: ${result.outputAmount}`);
      console.log(`   • Lightning Payment Hash: ${result.lightningPaymentHash}`);
      console.log(`   • Request ID: ${result.requestId}`);
      console.log(`   • Duration: ${duration}ms`);
      
      // Validate response structure
      validateSuccessResponse(result);
      
    } else {
      console.log('');
      console.log('❌ FAILED! Atomic swap unsuccessful');
      console.log(`📝 Error Details:`);
      console.log(`   • Error Code: ${result.error?.code || 'UNKNOWN'}`);
      console.log(`   • Error Message: ${result.error?.message || result.message}`);
      console.log(`   • Request ID: ${result.error?.requestId || 'N/A'}`);
      
      if (result.error?.details) {
        console.log(`   • Additional Details: ${result.error.details}`);
      }
      
      // Log troubleshooting information
      logTroubleshootingInfo(result, response.status);
    }

  } catch (error) {
    console.error('💥 Request failed:', error instanceof Error ? error.message : String(error));
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   • Make sure the server is running with: npm run dev');
    console.log('   • Verify your .env file has the correct environment variables');
    console.log('   • Check server logs for additional error information');
    console.log('   • Ensure you have sufficient balance for the swap');
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.log('   • Network error: Check if the server is accessible');
      console.log(`   • Trying to connect to: ${CONFIG.baseUrl}`);
    }
  }
}

/**
 * Validate the structure of a successful response
 */
function validateSuccessResponse(response: AtomicSwapResponse): void {
  const requiredFields = ['swapId', 'inputAmount', 'outputAmount', 'requestId'];
  const missingFields = requiredFields.filter(field => !response[field as keyof AtomicSwapResponse]);
  
  if (missingFields.length > 0) {
    console.log('');
    console.log('⚠️  Response validation warnings:');
    missingFields.forEach(field => {
      console.log(`   • Missing field: ${field}`);
    });
  } else {
    console.log('✅ Response structure validation passed');
  }
}

/**
 * Log troubleshooting information based on error type
 */
function logTroubleshootingInfo(result: AtomicSwapResponse, statusCode: number): void {
  console.log('');
  console.log('🔧 Troubleshooting Guide:');
  
  switch (result.error?.code) {
    case 'MISSING_REQUIRED_FIELDS':
      console.log('   • Check that all required fields are provided in the request');
      console.log('   • Required: amountSats, lightningDestination, tokenAddress');
      break;
      
    case 'INVALID_AMOUNT':
      console.log('   • Amount must be a positive number');
      console.log('   • Make sure amountSats is greater than 0');
      break;
      
    case 'INVALID_TOKEN_ADDRESS':
      console.log('   • Token address must be a valid hex string');
      console.log('   • Must start with 0x and be 66 characters long');
      break;
      
    case 'TOKEN_NOT_FOUND':
      console.log('   • The specified token address is not available');
      console.log('   • Check available tokens or use a supported token address');
      break;
      
    case 'LIGHTNING_NOT_AVAILABLE':
      console.log('   • Lightning network is currently unavailable');
      console.log('   • Try again later or check intermediary service status');
      break;
      
    case 'PAYMENT_TIMEOUT':
      console.log('   • Lightning payment did not complete within timeout');
      console.log('   • Check Lightning destination and network status');
      break;
      
    case 'INSUFFICIENT_BALANCE':
      console.log('   • Insufficient balance for the swap amount');
      console.log('   • Check your token balance and reduce the amount');
      break;
      
    case 'NETWORK_ERROR':
      console.log('   • Network connectivity issue');
      console.log('   • Check RPC endpoints and internet connection');
      break;
      
    default:
      console.log('   • Generic error occurred');
      console.log('   • Check server logs for more details');
  }
  
  // Status code specific guidance
  if (statusCode === 429) {
    console.log('   • Rate limit exceeded - wait before retrying');
  } else if (statusCode >= 500) {
    console.log('   • Server error - check server health and logs');
  }
}

/**
 * Check if fetch API is available
 */
function checkFetchAvailability(): boolean {
  if (typeof fetch === 'undefined') {
    console.log('❌ This script requires Node.js 18+ for fetch support');
    console.log('💡 Alternatively, install node-fetch: npm install node-fetch');
    return false;
  }
  return true;
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  if (!checkFetchAvailability()) {
    process.exit(1);
  }
  
  try {
    await testAtomicSwapEndpoint();
  } catch (error) {
    console.error('Script execution failed:', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main().catch(console.error);
}

export { testAtomicSwapEndpoint, CONFIG };