#!/usr/bin/env node

// Simple test script to demonstrate the atomic swap endpoint
// Usage: node test-endpoint.js

const ENDPOINT_URL = 'http://localhost:3000/api/atomic-swap';

// Test data - matches the working atomic swap test
const testData = {
  amountSats: 442,  // Same amount as in your working test
  lightningDestination: 'abdel@coinos.io',  // Same destination as in your test
  tokenAddress: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac',  // WBTC address
  exactIn: false
};

async function testAtomicSwapEndpoint() {
  console.log('🧪 Testing Atomic Swap REST Endpoint');
  console.log('====================================');
  console.log('Endpoint:', ENDPOINT_URL);
  console.log('Test data:', JSON.stringify(testData, null, 2));
  console.log('');

  try {
    console.log('📡 Sending POST request...');
    
    const response = await fetch(ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testData)
    });

    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    
    const result = await response.json();
    
    console.log('📋 Response body:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('');
      console.log('🎉 SUCCESS! Atomic swap completed via REST API');
      console.log(`Swap ID: ${result.swapId}`);
      console.log(`Input: ${result.inputAmount}`);
      console.log(`Output: ${result.outputAmount}`);
      console.log(`Lightning Payment Hash: ${result.lightningPaymentHash}`);
    } else {
      console.log('');
      console.log('❌ FAILED! Atomic swap unsuccessful');
      console.log(`Error: ${result.message}`);
    }

  } catch (error) {
    console.error('💥 Request failed:', error.message);
    console.log('');
    console.log('💡 Make sure the server is running with: npm run dev');
    console.log('💡 And that your .env file has the correct environment variables');
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.log('❌ This script requires Node.js 18+ for fetch support');
  console.log('💡 Alternatively, install node-fetch: npm install node-fetch');
  process.exit(1);
}

testAtomicSwapEndpoint().catch(console.error);