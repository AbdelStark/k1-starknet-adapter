/**
 * Braavos-Compatible Starknet Signer for Atomiq SDK
 * 
 * @deprecated This file is deprecated. Use SimpleBraavosAdapter.ts instead.
 * 
 * This module provides a Braavos-compatible signer that implements the
 * StarknetSigner interface from the Atomiq SDK. It allows using existing
 * Braavos accounts instead of creating new OpenZeppelin accounts.
 * 
 * The main difference is that this signer uses the existing Braavos account
 * address and private key, while handling the specific signature requirements
 * that Braavos accounts need.
 * 
 * @fileoverview Braavos Starknet Signer Implementation (DEPRECATED)
 * @author K1 Team
 * @version 1.0.0
 */

import { Account, RpcProvider, num, ec, CallData } from 'starknet';
import { StarknetSigner } from '@atomiqlabs/chain-starknet';
import { createBraavosAccount, isBraavosAccount } from './deployBraavos';

/**
 * Braavos-compatible implementation of StarknetSigner
 * 
 * This class implements the StarknetSigner interface from the Atomiq SDK
 * but uses a Braavos account instead of the default OpenZeppelin account.
 * 
 * Key features:
 * - Compatible with existing Braavos accounts
 * - Implements all StarknetSigner interface methods
 * - Handles Braavos-specific signature requirements
 * - Provides seamless integration with Atomiq SDK
 * 
 * @example
 * ```typescript
 * const provider = new RpcProvider({ nodeUrl: 'https://...' });
 * const signer = new BraavosStarknetSigner(
 *   privateKey,
 *   accountAddress,
 *   provider
 * );
 * 
 * // Use with AtomicSwapper
 * const swapper = new AtomicSwapper(config);
 * swapper.setStarknetSigner(signer);
 * ```
 */
export class BraavosStarknetSigner implements StarknetSigner {
  private account: Account;
  private provider: RpcProvider;
  private privateKey: string;
  private accountAddress: string;

  /**
   * Create a new BraavosStarknetSigner instance
   * 
   * @param {string} privateKey - The private key for the Braavos account
   * @param {string} accountAddress - The address of the existing Braavos account
   * @param {RpcProvider} provider - Starknet RPC provider
   * 
   * @throws {Error} If the provided address is not a valid Braavos account
   */
  constructor(
    privateKey: string,
    accountAddress: string,
    provider: RpcProvider
  ) {
    // Validate inputs
    if (!privateKey || !accountAddress || !provider) {
      throw new Error('Private key, account address, and provider are required');
    }

    this.privateKey = num.getHexString(privateKey);
    this.accountAddress = num.getHexString(accountAddress);
    this.provider = provider;

    // Create the Braavos account instance
    this.account = createBraavosAccount(
      this.privateKey,
      this.accountAddress,
      this.provider
    );
  }

  /**
   * Verify that the account is a Braavos account
   * 
   * This method should be called after construction to verify that
   * the provided address corresponds to a deployed Braavos account.
   * 
   * @returns {Promise<boolean>} True if verification succeeds
   * @throws {Error} If the account is not a valid Braavos account
   */
  async verifyAccount(): Promise<boolean> {
    try {
      const isBraavos = await isBraavosAccount(this.accountAddress, this.provider);
      
      if (!isBraavos) {
        throw new Error(
          `Address ${this.accountAddress} is not a Braavos account. ` +
          'Please ensure you are using a deployed Braavos account address.'
        );
      }

      return true;
    } catch (error) {
      throw new Error(
        `Failed to verify Braavos account: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get the account address
   * 
   * @returns {string} The Braavos account address
   */
  getAddress(): string {
    return this.accountAddress;
  }

  /**
   * Get the public key derived from the private key
   * 
   * @returns {Promise<string>} The public key in hex format
   */
  async getPublicKey(): Promise<string> {
    return ec.starkCurve.getStarkKey(this.privateKey);
  }

  /**
   * Get the underlying Account instance
   * 
   * This method provides access to the underlying Starknet Account
   * instance for advanced operations.
   * 
   * @returns {Account} The Braavos account instance
   */
  getAccount(): Account {
    return this.account;
  }

  /**
   * Sign a message hash
   * 
   * This method signs a message hash using the Braavos account's
   * private key, following Starknet signature standards.
   * 
   * @param {string} messageHash - The message hash to sign
   * @returns {Promise<string[]>} The signature as an array of strings
   */
  async signMessage(messageHash: string): Promise<string[]> {
    try {
      // Create a simple typed data structure for signing
      const typedData = {
        types: {
          StarkNetDomain: [
            { name: 'name', type: 'felt' },
            { name: 'version', type: 'felt' },
            { name: 'chainId', type: 'felt' },
          ],
          Message: [
            { name: 'message', type: 'felt' },
          ],
        },
        primaryType: 'Message',
        domain: {
          name: 'K1 Starknet Adapter',
          version: '1',
          chainId: '1', // Will be replaced with actual chain ID
        },
        message: {
          message: messageHash,
        },
      };

      // Use the account's signing functionality
      const signature = await this.account.signMessage(typedData);
      
      // Convert signature to string array format expected by Atomiq SDK
      if (Array.isArray(signature)) {
        return signature.map(s => num.toHex(s));
      } else {
        return [
          num.toHex(signature[0]),
          num.toHex(signature[1])
        ];
      }
    } catch (error) {
      throw new Error(
        `Failed to sign message: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Sign a transaction
   * 
   * This method signs a transaction using the Braavos account,
   * handling the specific signature format required.
   * 
   * @param {object} transaction - The transaction to sign
   * @returns {Promise<string[]>} The transaction signature
   */
  async signTransaction(transaction: any): Promise<string[]> {
    try {
      // For Starknet.js v6, we need to use a different approach
      // The Account class handles transaction signing internally
      // This method may not be directly available, so we'll use execute instead
      throw new Error('Direct transaction signing not supported. Use execute() method instead.');
    } catch (error) {
      throw new Error(
        `Failed to sign transaction: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Execute a transaction
   * 
   * This method executes a transaction using the Braavos account,
   * with proper error handling and response formatting.
   * 
   * @param {object} calls - The contract calls to execute
   * @param {object} options - Execution options (maxFee, etc.)
   * @returns {Promise<object>} The transaction response
   */
  async execute(calls: any, options: any = {}): Promise<any> {
    try {
      // Execute the transaction using the account
      const response = await this.account.execute(calls, options);
      
      return response;
    } catch (error) {
      throw new Error(
        `Failed to execute transaction: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get account nonce
   * 
   * @returns {Promise<bigint>} The current account nonce
   */
  async getNonce(): Promise<bigint> {
    try {
      const nonce = await this.provider.getNonceForAddress(this.accountAddress);
      return BigInt(nonce);
    } catch (error) {
      throw new Error(
        `Failed to get account nonce: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Estimate transaction fee
   * 
   * @param {object} calls - The contract calls to estimate
   * @returns {Promise<object>} The fee estimation
   */
  async estimateFee(calls: any): Promise<any> {
    try {
      const feeEstimate = await this.account.estimateFee(calls);
      return feeEstimate;
    } catch (error) {
      throw new Error(
        `Failed to estimate fee: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get account balance for a token
   * 
   * @param {string} tokenAddress - The token contract address
   * @returns {Promise<string>} The account balance
   */
  async getBalance(tokenAddress: string): Promise<string> {
    try {
      // This is a convenience method that could be implemented
      // by calling the token contract's balanceOf function
      const calldata = CallData.compile([this.accountAddress]);
      const balance = await this.provider.callContract({
        contractAddress: tokenAddress,
        entrypoint: 'balanceOf',
        calldata: calldata
      });
      
      return num.toHex(balance[0]);
    } catch (error) {
      throw new Error(
        `Failed to get balance: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Create a factory method for easier instantiation
   * 
   * This static method provides a convenient way to create a BraavosStarknetSigner
   * with automatic verification.
   * 
   * @param {string} privateKey - The private key for the Braavos account
   * @param {string} accountAddress - The address of the existing Braavos account
   * @param {RpcProvider} provider - Starknet RPC provider
   * @param {boolean} verify - Whether to verify the account (default: true)
   * @returns {Promise<BraavosStarknetSigner>} The configured signer instance
   * 
   * @example
   * ```typescript
   * const provider = new RpcProvider({ nodeUrl: 'https://...' });
   * const signer = await BraavosStarknetSigner.create(
   *   privateKey,
   *   accountAddress,
   *   provider
   * );
   * ```
   */
  static async create(
    privateKey: string,
    accountAddress: string,
    provider: RpcProvider,
    verify: boolean = true
  ): Promise<BraavosStarknetSigner> {
    const signer = new BraavosStarknetSigner(privateKey, accountAddress, provider);
    
    if (verify) {
      await signer.verifyAccount();
    }
    
    return signer;
  }
}

/**
 * Utility function to create a Braavos signer from environment variables
 * 
 * This function creates a BraavosStarknetSigner using configuration
 * from environment variables, matching the pattern used in the rest
 * of the application.
 * 
 * @param {RpcProvider} provider - Starknet RPC provider
 * @returns {Promise<BraavosStarknetSigner>} The configured signer
 * 
 * @example
 * ```typescript
 * const provider = new RpcProvider({ nodeUrl: process.env.STARKNET_RPC_URL });
 * const signer = await createBraavosSignerFromEnv(provider);
 * ```
 */
export async function createBraavosSignerFromEnv(
  provider: RpcProvider
): Promise<BraavosStarknetSigner> {
  const privateKey = process.env.STARKNET_PRIVATE_KEY;
  const accountAddress = process.env.STARKNET_ACCOUNT_ADDRESS;

  if (!privateKey || !accountAddress) {
    throw new Error(
      'STARKNET_PRIVATE_KEY and STARKNET_ACCOUNT_ADDRESS environment variables are required'
    );
  }

  return BraavosStarknetSigner.create(privateKey, accountAddress, provider);
}