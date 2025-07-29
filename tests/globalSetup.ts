/**
 * Global Jest setup - runs once before all tests
 * Used for test environment initialization
 */

import fs from 'fs';
import path from 'path';

export default async function globalSetup() {
  console.log('🚀 Setting up test environment...');
  
  // Create test environment file if it doesn't exist
  const testEnvPath = path.join(process.cwd(), '.env.test');
  if (!fs.existsSync(testEnvPath)) {
    const testEnvContent = `# Test Environment Variables
NODE_ENV=test
PORT=3001
LOG_LEVEL=error

# Mock Starknet Configuration for Testing
STARKNET_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
STARKNET_ACCOUNT_ADDRESS=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
STARKNET_RPC_URL=https://starknet-mainnet.public.blastapi.io/rpc/v0_8

# Mock Bitcoin Configuration
BITCOIN_NETWORK=testnet
NWC_CONNECTION_STRING=nostr+walletconnect://test

# Mock Atomiq Configuration  
ATOMIQ_INTERMEDIARY_URL=https://test.example.com:24000
`;
    
    fs.writeFileSync(testEnvPath, testEnvContent);
    console.log('✅ Created .env.test file');
  }
  
  // Create logs directory for test logs
  const testLogsDir = path.join(process.cwd(), 'logs', 'test');
  if (!fs.existsSync(testLogsDir)) {
    fs.mkdirSync(testLogsDir, { recursive: true });
    console.log('✅ Created test logs directory');
  }
  
  // Create coverage directory
  const coverageDir = path.join(process.cwd(), 'coverage');
  if (!fs.existsSync(coverageDir)) {
    fs.mkdirSync(coverageDir, { recursive: true });
    console.log('✅ Created coverage directory');
  }
  
  console.log('✅ Test environment setup complete');
}