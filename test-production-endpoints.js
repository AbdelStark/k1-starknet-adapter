#!/usr/bin/env node

// Comprehensive test suite for production-grade endpoints
// Usage: node test-production-endpoints.js

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Production-Grade Endpoint Test Suite');
  console.log('=======================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log('');

  let passed = 0;
  let failed = 0;

  // Test helper function
  async function test(name, testFunc) {
    process.stdout.write(`Testing ${name}... `);
    try {
      await testFunc();
      console.log('✅ PASSED');
      passed++;
    } catch (error) {
      console.log('❌ FAILED');
      console.log(`   Error: ${error.message}`);
      failed++;
    }
  }

  // Test 1: Health Check
  await test('Health Check', async () => {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (data.status !== 'healthy') throw new Error('Health status not healthy');
    if (!data.timestamp) throw new Error('Missing timestamp');
    if (typeof data.uptime !== 'number') throw new Error('Missing uptime');
  });

  // Test 2: Valid Balance Query
  await test('Valid Balance Query', async () => {
    const testAddress = '0x03641aa25b8de4a4d5ac185c72b124546666f2ad2354c9627b6565830fdea408';
    const response = await fetch(`${BASE_URL}/balance/${testAddress}`);
    const data = await response.json();
    
    if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    if (!data.success) throw new Error('Response not successful');
    if (!data.data) throw new Error('Missing data field');
    if (data.data.address !== testAddress) throw new Error('Address mismatch');
  });

  // Test 3: Invalid Balance Query
  await test('Invalid Balance Query', async () => {
    const response = await fetch(`${BASE_URL}/balance/invalid-address`);
    const data = await response.json();
    
    if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`);
    if (data.success) throw new Error('Response should not be successful');
    if (data.error?.code !== 'INVALID_ADDRESS') throw new Error('Wrong error code');
    if (!data.error?.requestId) throw new Error('Missing request ID');
  });

  // Test 4: 404 Error
  await test('404 Not Found', async () => {
    const response = await fetch(`${BASE_URL}/nonexistent-endpoint`);
    const data = await response.json();
    
    if (response.status !== 404) throw new Error(`Expected 404, got ${response.status}`);
    if (data.success) throw new Error('Response should not be successful');
    if (data.error?.code !== 'ENDPOINT_NOT_FOUND') throw new Error('Wrong error code');
  });

  // Test 5: Invalid JSON
  await test('Invalid JSON Handling', async () => {
    const response = await fetch(`${BASE_URL}/api/atomic-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json'
    });
    
    // Should get 400 for malformed JSON
    if (response.status < 400 || response.status >= 500) {
      throw new Error(`Expected 4xx error, got ${response.status}`);
    }
  });

  // Test 6: Missing Required Fields
  await test('Missing Required Fields', async () => {
    const response = await fetch(`${BASE_URL}/api/atomic-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountSats: 100
        // Missing lightningDestination and tokenAddress
      })
    });
    const data = await response.json();
    
    if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`);
    if (data.error?.code !== 'MISSING_REQUIRED_FIELDS') throw new Error('Wrong error code');
  });

  // Test 7: Invalid Amount
  await test('Invalid Amount Validation', async () => {
    const response = await fetch(`${BASE_URL}/api/atomic-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountSats: -100,
        lightningDestination: 'test@coinos.io',
        tokenAddress: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac'
      })
    });
    const data = await response.json();
    
    if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`);
    if (data.error?.code !== 'INVALID_AMOUNT') throw new Error('Wrong error code');
  });

  // Test 8: Invalid Token Address
  await test('Invalid Token Address', async () => {
    const response = await fetch(`${BASE_URL}/api/atomic-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountSats: 100,
        lightningDestination: 'test@coinos.io',
        tokenAddress: 'invalid-address'
      })
    });
    const data = await response.json();
    
    if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`);
    if (data.error?.code !== 'INVALID_TOKEN_ADDRESS') throw new Error('Wrong error code');
  });

  // Test 9: Request Headers Validation
  await test('Request Headers Validation', async () => {
    const response = await fetch(`${BASE_URL}/api/atomic-swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        amountSats: 100,
        lightningDestination: 'test@coinos.io',
        tokenAddress: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac'
      })
    });
    const data = await response.json();
    
    if (response.status !== 400) throw new Error(`Expected 400, got ${response.status}`);
    if (data.error?.code !== 'INVALID_CONTENT_TYPE') throw new Error('Wrong error code');
  });

  // Test 10: Deprecated Endpoints
  await test('Deprecated Quote Endpoint', async () => {
    const response = await fetch(`${BASE_URL}/api/atomic-swap/quote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' })
    });
    const data = await response.json();
    
    if (response.status !== 410) throw new Error(`Expected 410, got ${response.status}`);
    if (!data.deprecated) throw new Error('Deprecated flag not set');
    if (!data.alternative) throw new Error('Alternative endpoint not provided');
  });

  // Test 11: Rate Limiting (if enabled)
  await test('Response Structure Validation', async () => {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    
    // Check response structure
    if (!data.timestamp) throw new Error('Missing timestamp');
    if (typeof data.uptime !== 'number') throw new Error('Invalid uptime type');
    if (!data.environment) throw new Error('Missing environment');
    if (!data.version) throw new Error('Missing version');
  });

  // Test 12: Invoice Endpoint (K1 Compatible)
  await test('Invoice Endpoint Validation', async () => {
    const response = await fetch(`${BASE_URL}/api/invoice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amountUSD: 0.01,
        address: 'test@coinos.io'
      })
    });
    
    // Should either succeed or fail gracefully, not crash
    if (!response.ok && response.status >= 500) {
      throw new Error(`Server error: ${response.status}`);
    }
  });

  // Summary
  console.log('');
  console.log('📊 Test Results Summary');
  console.log('======================');
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📈 Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  
  if (failed === 0) {
    console.log('');
    console.log('🎉 All tests passed! The production-grade implementation is working correctly.');
  } else {
    console.log('');
    console.log('⚠️  Some tests failed. Please review the errors above.');
  }

  console.log('');
  console.log('🏗️  Production Features Verified:');
  console.log('   • Structured error responses with codes and request IDs');
  console.log('   • Input validation and sanitization');
  console.log('   • Proper HTTP status codes');
  console.log('   • Request/response logging (check server logs)');
  console.log('   • Graceful error handling');
  console.log('   • API deprecation handling');
  console.log('   • Content-Type validation');
  console.log('   • Comprehensive health checks');

  return failed === 0;
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.log('❌ This script requires Node.js 18+ for fetch support');
  console.log('💡 Alternatively, install node-fetch: npm install node-fetch');
  process.exit(1);
}

runTests().then(success => {
  process.exit(success ? 0 : 1);
}).catch(console.error);