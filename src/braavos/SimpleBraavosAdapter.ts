/**
 * Simple Braavos Account Adapter
 * 
 * This module provides a simplified way to use existing Braavos accounts
 * with the K1 Starknet Adapter. Instead of trying to implement the complex
 * StarknetSigner interface, this adapter works with the existing AtomicSwapper
 * by providing a factory method to create a compatible account.
 * 
 * @fileoverview Simple Braavos Account Integration
 * @author K1 Team
 * @version 1.0.0
 */

import { Account, RpcProvider, num } from 'starknet';

/**
 * Configuration for Braavos account
 */
export interface BraavosAccountConfig {
  privateKey: string;
  accountAddress: string;
  rpcUrl: string;
}

/**
 * Create a Braavos account instance that can be used with AtomicSwapper
 * 
 * This function creates a standard Starknet Account instance using your
 * Braavos credentials. The Account works the same regardless of whether
 * it's an OpenZeppelin or Braavos account.
 * 
 * @param config - Braavos account configuration
 * @returns Promise<Account> - Configured Starknet account
 * 
 * @example
 * ```typescript
 * const account = await createBraavosAccount({
 *   privateKey: '0x1234...',
 *   accountAddress: '0x5678...',
 *   rpcUrl: 'https://starknet-sepolia.public.blastapi.io/rpc/v0_8'
 * });
 * 
 * // Use with contract calls
 * const tx = await account.execute({
 *   contractAddress: '0x...',
 *   entrypoint: 'transfer',
 *   calldata: [recipient, amount_low, amount_high]
 * });
 * ```
 */
export async function createBraavosAccount(config: BraavosAccountConfig): Promise<Account> {
  // Validate configuration
  if (!config.privateKey || !config.accountAddress || !config.rpcUrl) {
    throw new Error('privateKey, accountAddress, and rpcUrl are required');
  }

  // Create RPC provider
  const provider = new RpcProvider({ nodeUrl: config.rpcUrl });

  // Create account instance
  // The Account class works the same for both OpenZeppelin and Braavos accounts
  const account = new Account(
    provider,
    config.accountAddress,
    config.privateKey
  );

  // Verify the account exists and is deployed
  try {
    const nonce = await account.getNonce();
    console.log(`✅ Braavos account verified (nonce: ${nonce})`);
  } catch (error) {
    console.warn('⚠️  Could not verify account deployment:', error instanceof Error ? error.message : error);
  }

  return account;
}

/**
 * Create Braavos account from environment variables
 * 
 * @returns Promise<Account> - Configured Braavos account
 */
export async function createBraavosAccountFromEnv(): Promise<Account> {
  const config = {
    privateKey: process.env.STARKNET_PRIVATE_KEY || '',
    accountAddress: process.env.STARKNET_ACCOUNT_ADDRESS || '',
    rpcUrl: process.env.STARKNET_RPC_URL || 'https://starknet-sepolia.public.blastapi.io/rpc/v0_8'
  };

  if (!config.privateKey || !config.accountAddress) {
    throw new Error(
      'STARKNET_PRIVATE_KEY and STARKNET_ACCOUNT_ADDRESS environment variables are required'
    );
  }

  return createBraavosAccount(config);
}

/**
 * Verify that an address corresponds to a Braavos account
 * 
 * This is a simplified check that attempts to identify Braavos accounts
 * by checking common characteristics.
 * 
 * @param accountAddress - The account address to check
 * @param provider - RPC provider
 * @returns Promise<boolean> - True if likely a Braavos account
 */
export async function isBraavosAccount(
  accountAddress: string,
  provider: RpcProvider
): Promise<boolean> {
  try {
    // Get the contract class hash
    const classHash = await provider.getClassHashAt(accountAddress);
    
    // Known Braavos class hashes (these may change over time)
    const knownBraavosHashes = [
      '0x03131fa018d520a037686ce3efddeab8f28895662f019ca3ca18a626650f7d1e',
      // Add other known Braavos class hashes here
    ];

    return knownBraavosHashes.includes(classHash);
  } catch (error) {
    // If we can't get the class hash, we can't determine the account type
    return false;
  }
}

/**
 * Get basic account information
 * 
 * @param account - The account instance
 * @returns Promise<object> - Account information
 */
export async function getAccountInfo(account: Account): Promise<{
  address: string;
  nonce: string;
  classHash?: string;
}> {
  const address = account.address;
  const nonce = await account.getNonce();
  
  let classHash: string | undefined;
  try {
    // Access the provider through the account's internal structure
    const provider = (account as any).provider;
    if (provider) {
      classHash = await provider.getClassHashAt(address);
    }
  } catch (error) {
    // Class hash retrieval failed
  }

  return {
    address,
    nonce: num.toHex(nonce),
    classHash
  };
}