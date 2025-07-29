import {
  AbstractSigner,
  IBitcoinWallet,
  SingleAddressBitcoinWallet,
  SwapperFactory,
} from "@atomiqlabs/sdk";
import {
  RpcProviderWithRetries,
  StarknetInitializer,
  StarknetKeypairWallet,
  StarknetSigner,
} from "@atomiqlabs/chain-starknet";
import { StarknetBraavosWallet } from "./braavos/StarknetBraavosWallet";
import {
  SqliteStorageManager,
  SqliteUnifiedStorage,
} from "@atomiqlabs/storage-sqlite";
import { AtomicSwapConfig, validateConfig } from "./atomicConfig";

/**
 * Wrapper class for AtomiqLabs SDK with Starknet integration
 */
export class AtomicSwapper {
  private config: AtomicSwapConfig;
  private factory: any;
  private swapper: any;
  private starknetSigner: StarknetSigner | null = null;
  private bitcoinWallet: SingleAddressBitcoinWallet | null = null;
  private isInitialized = false;
  private tokens: any;

  constructor(config: AtomicSwapConfig) {
    this.config = config;
    validateConfig(config);

    // Initialize SwapperFactory with Starknet support
    // Using type assertion to work around SDK typing issues
    this.factory = new (SwapperFactory as any)([StarknetInitializer]);
    this.tokens = this.factory.Tokens;
  }

  /**
   * Initialize the swapper instance
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Initialize Starknet RPC provider
      const starknetRpc = new RpcProviderWithRetries({
        nodeUrl: this.config.starknetRpcUrl,
      });

      // Create the swapper instance
      this.swapper = this.factory.newSwapper({
        chains: {
          STARKNET: {
            rpcUrl: starknetRpc,
          },
        },
        bitcoinNetwork: this.config.bitcoinNetwork,

        // Use SQLite storage for Node.js environment
        swapStorage: (chainId: string) =>
          new SqliteUnifiedStorage(`CHAIN_${chainId}.sqlite3`),
        chainStorageCtor: (name: string) =>
          new SqliteStorageManager(`STORE_${name}.sqlite3`),

        // Optional configuration
        pricingFeeDifferencePPM: this.config.maxPricingDifferencePPM,
        getRequestTimeout: this.config.getRequestTimeout,
        postRequestTimeout: this.config.postRequestTimeout,

        // Custom endpoints if provided - commented out to use SDK defaults
        ...(this.config.intermediaryUrl && {
          intermediaryUrl: this.config.intermediaryUrl,
        }),
        // ...(this.config.registryUrl && { registryUrl: this.config.registryUrl }),
        // ...(this.config.trustedIntermediaryUrl && { defaultTrustedIntermediaryUrl: this.config.trustedIntermediaryUrl }),
      });

      // Initialize the swapper
      await this.swapper.init();

      // Create Starknet signer if credentials are provided
      if (
        this.config.starknetPrivateKey &&
        this.config.starknetAccountAddress
      ) {
        // Use Braavos signer if configured, otherwise use standard signer
        if (this.config.useBraavosAccount) {
          await this.initializeBraavosFromEnv();
        } else {
          await this.initializeStarknetSigner();
        }
      }

      this.isInitialized = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize atomic swapper: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Initialize Starknet signer
   */
  private async initializeStarknetSigner(): Promise<void> {
    if (
      !this.config.starknetPrivateKey ||
      !this.config.starknetAccountAddress
    ) {
      throw new Error("Starknet credentials not configured");
    }

    try {
      // Create Starknet RPC provider
      const starknetRpc = new RpcProviderWithRetries({
        nodeUrl: this.config.starknetRpcUrl,
      });

      // Create Starknet signer from private key
      this.starknetSigner = new StarknetSigner(
        new StarknetKeypairWallet(starknetRpc, this.config.starknetPrivateKey)
      );
    } catch (error) {
      throw new Error(
        `Failed to initialize Starknet signer: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Initialize Braavos Starknet signer for existing Braavos accounts
   *
   * This method allows using an existing Braavos account instead of creating
   * a new OpenZeppelin account. This is useful when you already have funds
   * and tokens in a Braavos wallet.
   *
   * @param {string} privateKey - Private key of the existing Braavos account
   * @param {string} accountAddress - Address of the existing Braavos account
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * const swapper = new AtomicSwapper(config);
   * await swapper.initializeBraavosStarknetSigner(
   *   '0x1234...', // Your Braavos private key
   *   '0x5678...'  // Your Braavos account address
   * );
   * await swapper.initialize();
   * ```
   */
  async initializeBraavosStarknetSigner(
    privateKey?: string,
    accountAddress?: string
  ): Promise<void> {
    // Use provided keys or fall back to config/env vars
    const braavosPrivateKey = privateKey || this.config.starknetPrivateKey;
    const braavosAccountAddress =
      accountAddress || this.config.starknetAccountAddress;

    if (!braavosPrivateKey || !braavosAccountAddress) {
      throw new Error(
        "Braavos credentials not provided. Please provide privateKey and accountAddress parameters " +
          "or set STARKNET_PRIVATE_KEY and STARKNET_ACCOUNT_ADDRESS environment variables."
      );
    }

    try {
      // Create Starknet RPC provider
      const starknetRpc = new RpcProviderWithRetries({
        nodeUrl: this.config.starknetRpcUrl,
      });

      // Create a Braavos account instance using StarknetBraavosWallet
      const braavosWallet = new StarknetBraavosWallet(
        starknetRpc,
        braavosPrivateKey,
        braavosAccountAddress
      );

      // Create the StarknetSigner with the Braavos wallet
      this.starknetSigner = new StarknetSigner(braavosWallet);

      console.log(`✅ Braavos account initialized: ${braavosAccountAddress}`);
    } catch (error) {
      throw new Error(
        `Failed to initialize Braavos Starknet signer: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Initialize Braavos signer from environment variables
   *
   * Convenience method to initialize a Braavos signer using the same
   * environment variables as the regular signer, but for Braavos accounts.
   *
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * // Set environment variables:
   * // STARKNET_PRIVATE_KEY=0x1234...  (your Braavos private key)
   * // STARKNET_ACCOUNT_ADDRESS=0x5678...  (your Braavos account address)
   *
   * const swapper = new AtomicSwapper(config);
   * await swapper.initializeBraavosFromEnv();
   * await swapper.initialize();
   * ```
   */
  async initializeBraavosFromEnv(): Promise<void> {
    try {
      // Create Starknet RPC provider
      const starknetRpc = new RpcProviderWithRetries({
        nodeUrl: this.config.starknetRpcUrl,
      });

      // Create Braavos wallet from environment variables
      const privateKey = process.env.STARKNET_PRIVATE_KEY;
      const accountAddress = process.env.STARKNET_ACCOUNT_ADDRESS;

      if (!privateKey || !accountAddress) {
        throw new Error(
          "STARKNET_PRIVATE_KEY and STARKNET_ACCOUNT_ADDRESS are required"
        );
      }

      const braavosWallet = new StarknetBraavosWallet(starknetRpc, privateKey, accountAddress);
      this.starknetSigner = new StarknetSigner(braavosWallet);

      console.log(
        `✅ Braavos account initialized from environment: ${accountAddress}`
      );
    } catch (error) {
      throw new Error(
        `Failed to initialize Braavos signer from environment: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Initialize Bitcoin wallet (optional - for BTC -> Starknet swaps)
   */
  private async initializeBitcoinWallet(
    privateKey?: string
  ): Promise<SingleAddressBitcoinWallet> {
    if (!privateKey) {
      privateKey = SingleAddressBitcoinWallet.generateRandomPrivateKey();
    }

    this.bitcoinWallet = new SingleAddressBitcoinWallet(
      this.swapper.bitcoinRpc,
      this.swapper.bitcoinNetwork,
      privateKey
    );

    return this.bitcoinWallet;
  }

  /**
   * Get available tokens for swapping
   */
  getAvailableTokens() {
    return this.tokens;
  }

  /**
   * Get swap limits for a token pair
   */
  getSwapLimits(srcToken: any, dstToken: any) {
    if (!this.isInitialized) {
      throw new Error("Swapper not initialized");
    }

    return this.swapper.getSwapLimits(srcToken, dstToken);
  }

  /**
   * Create a swap quote
   */
  async createSwapQuote(
    srcToken: any,
    dstToken: any,
    amount: bigint,
    exactIn: boolean,
    srcAddress?: string,
    dstAddress?: string,
    options?: any
  ) {
    if (!this.isInitialized) {
      throw new Error("Swapper not initialized");
    }

    try {
      const swap = await this.swapper.swap(
        srcToken,
        dstToken,
        amount,
        exactIn,
        srcAddress,
        dstAddress,
        options
      );

      return swap;
    } catch (error) {
      throw new Error(
        `Failed to create swap quote: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get spendable balance for a token
   */
  async getSpendableBalance(token: any, signer?: AbstractSigner) {
    if (!this.isInitialized) {
      throw new Error("Swapper not initialized");
    }

    const signerToUse = signer || this.starknetSigner;
    if (!signerToUse) {
      throw new Error("Starknet signer not initialized");
    }

    try {
      const balance = await this.swapper.Utils.getSpendableBalance(
        signerToUse,
        token
      );
      return balance;
    } catch (error) {
      throw new Error(
        `Failed to get balance: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get Bitcoin spendable balance
   */
  async getBitcoinSpendableBalance(
    address: string,
    destinationChain: string = "STARKNET"
  ) {
    if (!this.isInitialized) {
      throw new Error("Swapper not initialized");
    }

    try {
      const result = await this.swapper.Utils.getBitcoinSpendableBalance(
        address,
        destinationChain
      );
      return result;
    } catch (error) {
      throw new Error(
        `Failed to get Bitcoin balance: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Parse an address (Lightning invoice, LNURL, Bitcoin address, etc.)
   */
  async parseAddress(address: string) {
    if (!this.isInitialized) {
      throw new Error("Swapper not initialized");
    }

    try {
      const result = await this.swapper.Utils.parseAddress(address);
      return result;
    } catch (error) {
      throw new Error(
        `Failed to parse address: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get refundable swaps
   */
  async getRefundableSwaps(address: string) {
    if (!this.isInitialized) {
      throw new Error("Swapper not initialized");
    }

    try {
      return await this.swapper.getRefundableSwaps("STARKNET", address);
    } catch (error) {
      throw new Error(
        `Failed to get refundable swaps: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get claimable swaps
   */
  async getClaimableSwaps(address: string) {
    if (!this.isInitialized) {
      throw new Error("Swapper not initialized");
    }

    try {
      return await this.swapper.getClaimableSwaps("STARKNET", address);
    } catch (error) {
      throw new Error(
        `Failed to get claimable swaps: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get swap by ID
   */
  async getSwapById(id: string) {
    if (!this.isInitialized) {
      throw new Error("Swapper not initialized");
    }

    try {
      return await this.swapper.getSwapById(id);
    } catch (error) {
      throw new Error(
        `Failed to get swap by ID: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * Get Starknet signer
   */
  getStarknetSigner() {
    if (!this.starknetSigner) {
      throw new Error("Starknet signer not initialized");
    }
    return this.starknetSigner;
  }

  /**
   * Get Starknet address
   */
  getStarknetAddress() {
    if (!this.starknetSigner) {
      throw new Error("Starknet signer not initialized");
    }
    return this.starknetSigner.getAddress();
  }

  /**
   * Get Bitcoin wallet
   */
  getBitcoinWallet() {
    return this.bitcoinWallet;
  }

  /**
   * Create Bitcoin wallet
   */
  async createBitcoinWallet(privateKey?: string) {
    return await this.initializeBitcoinWallet(privateKey);
  }

  /**
   * Execute Starknet to Lightning swap
   */
  async executeStarknetToLightningSwap(
    srcToken: any,
    amount: bigint,
    destination: string,
    exactIn: boolean = true,
    options?: { comment?: string }
  ) {
    if (!this.starknetSigner) {
      throw new Error("Starknet signer not initialized");
    }

    const swap = await this.createSwapQuote(
      srcToken,
      this.tokens.BITCOIN.BTCLN,
      amount,
      exactIn,
      this.starknetSigner.getAddress(),
      destination,
      options
    );

    // For Starknet -> Lightning: commit the swap
    await swap.commit(this.starknetSigner);

    return swap;
  }

  /**
   * Execute Lightning to Starknet swap
   */
  async executeLightningToStarknetSwap(
    dstToken: any,
    amount: bigint,
    exactIn: boolean = true,
    options?: { gasAmount?: bigint }
  ) {
    if (!this.starknetSigner) {
      throw new Error("Starknet signer not initialized");
    }

    const swap = await this.createSwapQuote(
      this.tokens.BITCOIN.BTCLN,
      dstToken,
      amount,
      exactIn,
      undefined,
      this.starknetSigner.getAddress(),
      options
    );

    return swap;
  }

  /**
   * Execute Bitcoin to Starknet swap
   */
  async executeBitcoinToStarknetSwap(
    dstToken: any,
    amount: bigint,
    bitcoinWallet: IBitcoinWallet,
    exactIn: boolean = true,
    options?: { gasAmount?: bigint }
  ) {
    if (!this.starknetSigner) {
      throw new Error("Starknet signer not initialized");
    }

    const swap = await this.createSwapQuote(
      this.tokens.BITCOIN.BTC,
      dstToken,
      amount,
      exactIn,
      undefined,
      this.starknetSigner.getAddress(),
      options
    );

    // Send Bitcoin transaction
    const bitcoinTxId = await swap.sendBitcoinTransaction(bitcoinWallet);

    return { swap, bitcoinTxId };
  }

  /**
   * Execute Starknet to Bitcoin swap
   */
  async executeStarknetToBitcoinSwap(
    srcToken: any,
    amount: bigint,
    bitcoinAddress: string,
    exactIn: boolean = true
  ) {
    if (!this.starknetSigner) {
      throw new Error("Starknet signer not initialized");
    }

    const swap = await this.createSwapQuote(
      srcToken,
      this.tokens.BITCOIN.BTC,
      amount,
      exactIn,
      this.starknetSigner.getAddress(),
      bitcoinAddress
    );

    // Commit the swap
    await swap.commit(this.starknetSigner);

    return swap;
  }

  /**
   * Check if swapper is initialized
   */
  isReady() {
    return this.isInitialized;
  }

  /**
   * Get underlying swapper instance
   */
  getSwapper() {
    if (!this.isInitialized) {
      throw new Error("Swapper not initialized");
    }
    return this.swapper;
  }

  /**
   * Stop the swapper
   */
  async stop() {
    if (this.swapper) {
      await this.swapper.stop();
    }
  }
}
