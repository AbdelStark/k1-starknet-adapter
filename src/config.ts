/**
 * Configuration Management for K1 Starknet Adapter
 * 
 * This module handles all environment variable configuration for the application,
 * providing default values and validation for required settings.
 * 
 * Environment variables are loaded from .env file and process.env, with fallbacks
 * to sensible defaults for non-critical settings.
 * 
 * @fileoverview Application Configuration
 * @author K1 Team
 * @version 1.0.0
 */

import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

/**
 * Application configuration object with all settings
 * 
 * This configuration object centralizes all application settings including:
 * - Server configuration (port, timeouts)
 * - Blockchain settings (Starknet RPC, Bitcoin network)
 * - Authentication credentials (private keys, connection strings)
 * - Service endpoints (Atomiq intermediary)
 * - Operational parameters (gas amounts, pricing tolerances)
 */
export const config = {
  /** HTTP server port - defaults to 3000 if not specified */
  port: process.env.PORT || 3000,
  
  /** Starknet RPC endpoint URL for blockchain interactions */
  starknetRpcUrl: process.env.STARKNET_RPC_URL || 'https://starknet-mainnet.public.blastapi.io/rpc/v0_8',
  
  /** Private key for Starknet account (required for signing transactions) */
  starknetPrivateKey: process.env.STARKNET_PRIVATE_KEY || '',
  
  /** Starknet account address corresponding to the private key */
  starknetAccountAddress: process.env.STARKNET_ACCOUNT_ADDRESS || '',
  
  /** Bitcoin network to use (mainnet/testnet) */
  bitcoinNetwork: process.env.BITCOIN_NETWORK || 'mainnet',
  
  /** Nostr Wallet Connect connection string for Lightning Network operations */
  nwcConnectionString: process.env.NWC_CONNECTION_STRING || '',
  
  /** Atomiq intermediary service URL for atomic swap coordination */
  atomiqIntermediaryUrl: process.env.ATOMIQ_INTERMEDIARY_URL || 'https://84-32-32-132.sslip.io:24000',
  
  /** Default gas amount for Starknet transactions (in wei) */
  defaultGasAmount: process.env.DEFAULT_GAS_AMOUNT || '1000000000000000000',
  
  /** Maximum allowed pricing difference in parts per million (ppm) */
  maxPricingDifferencePpm: parseInt(process.env.MAX_PRICING_DIFFERENCE_PPM || '20000'),
  
  /** Timeout for GET requests to external services (milliseconds) */
  getRequestTimeout: parseInt(process.env.GET_REQUEST_TIMEOUT || '10000'),
  
  /** Timeout for POST requests to external services (milliseconds) */
  postRequestTimeout: parseInt(process.env.POST_REQUEST_TIMEOUT || '10000'),
  
  /** Enable testnet mode for development and testing */
  enableTestnet: process.env.ENABLE_TESTNET === 'true'
};

/**
 * Validates that all required environment variables are present
 * 
 * This function checks for the presence of critical environment variables
 * that are required for the application to function properly. It throws
 * an error if any required variables are missing.
 * 
 * Required variables:
 * - STARKNET_PRIVATE_KEY: For signing Starknet transactions
 * - STARKNET_ACCOUNT_ADDRESS: Account address for Starknet operations
 * - NWC_CONNECTION_STRING: For Lightning Network wallet connectivity
 * 
 * @throws {Error} If any required environment variables are missing
 * 
 * @example
 * ```typescript
 * try {
 *   validateConfig();
 *   console.log('Configuration is valid');
 * } catch (error) {
 *   console.error('Configuration error:', error.message);
 *   process.exit(1);
 * }
 * ```
 */
export function validateConfig(): void {
  const required = [
    'STARKNET_PRIVATE_KEY',
    'STARKNET_ACCOUNT_ADDRESS',
    'NWC_CONNECTION_STRING'
  ];

  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}