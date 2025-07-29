import { BitcoinNetwork } from "@atomiqlabs/sdk";

/**
 * Configuration interface for atomic swaps
 */
export interface AtomicSwapConfig {
  // Network configuration
  starknetRpcUrl: string;
  bitcoinNetwork: BitcoinNetwork;
  
  // Wallet configuration
  starknetPrivateKey?: string;
  starknetAccountAddress?: string;
  
  // AtomiqLabs configuration
  intermediaryUrl?: string;
  registryUrl?: string;
  trustedIntermediaryUrl?: string;
  
  // Timeout configuration
  getRequestTimeout: number;
  postRequestTimeout: number;
  
  // Swap configuration
  maxPricingDifferencePPM: bigint;
  defaultGasAmount?: bigint;
  
  // Security configuration
  enableTestnet: boolean;
  
  // Account type configuration
  useBraavosAccount?: boolean;
}

/**
 * Create configuration from environment variables
 */
export function createDefaultConfig(): AtomicSwapConfig {
  return {
    starknetRpcUrl: process.env.STARKNET_RPC_URL || "https://starknet-mainnet.public.blastapi.io/rpc/v0_7",
    bitcoinNetwork: process.env.BITCOIN_NETWORK === "testnet" ? BitcoinNetwork.TESTNET : BitcoinNetwork.MAINNET,
    starknetPrivateKey: process.env.STARKNET_PRIVATE_KEY,
    starknetAccountAddress: process.env.STARKNET_ACCOUNT_ADDRESS,
    intermediaryUrl: process.env.ATOMIQ_INTERMEDIARY_URL,
    registryUrl: process.env.ATOMIQ_REGISTRY_URL,
    trustedIntermediaryUrl: process.env.ATOMIQ_TRUSTED_INTERMEDIARY_URL,
    getRequestTimeout: parseInt(process.env.GET_REQUEST_TIMEOUT || "10000"),
    postRequestTimeout: parseInt(process.env.POST_REQUEST_TIMEOUT || "10000"),
    maxPricingDifferencePPM: BigInt(process.env.MAX_PRICING_DIFFERENCE_PPM || "20000"),
    defaultGasAmount: process.env.DEFAULT_GAS_AMOUNT ? BigInt(process.env.DEFAULT_GAS_AMOUNT) : BigInt("1000000000000000000"), // 1 STRK
    enableTestnet: process.env.ENABLE_TESTNET === "true",
    useBraavosAccount: process.env.USE_BRAAVOS_ACCOUNT !== "false" // Default to true, set to "false" to disable
  };
}

/**
 * Default configuration values
 */
export const defaultConfig: AtomicSwapConfig = createDefaultConfig();

/**
 * Validate configuration and throw errors for missing required values
 */
export function validateConfig(config: AtomicSwapConfig): void {
  console.log("Validating config with env vars:", {
    STARKNET_RPC_URL: process.env.STARKNET_RPC_URL,
    STARKNET_PRIVATE_KEY: process.env.STARKNET_PRIVATE_KEY ? "[REDACTED]" : undefined,
    STARKNET_ACCOUNT_ADDRESS: process.env.STARKNET_ACCOUNT_ADDRESS
  });
  
  console.log("Config object:", {
    starknetRpcUrl: config.starknetRpcUrl,
    starknetPrivateKey: config.starknetPrivateKey ? "[REDACTED]" : undefined,
    starknetAccountAddress: config.starknetAccountAddress
  });
  
  if (!config.starknetRpcUrl) {
    throw new Error("STARKNET_RPC_URL is required");
  }
  
  if (!config.starknetPrivateKey) {
    throw new Error("STARKNET_PRIVATE_KEY is required for swap operations");
  }
  
  if (!config.starknetAccountAddress) {
    throw new Error("STARKNET_ACCOUNT_ADDRESS is required for swap operations");
  }
  
  if (config.maxPricingDifferencePPM < 0n || config.maxPricingDifferencePPM > 1000000n) {
    throw new Error("MAX_PRICING_DIFFERENCE_PPM must be between 0 and 1000000");
  }
  
  if (config.getRequestTimeout < 1000 || config.getRequestTimeout > 60000) {
    throw new Error("GET_REQUEST_TIMEOUT must be between 1000 and 60000 milliseconds");
  }
  
  if (config.postRequestTimeout < 1000 || config.postRequestTimeout > 60000) {
    throw new Error("POST_REQUEST_TIMEOUT must be between 1000 and 60000 milliseconds");
  }
}

/**
 * Network-specific configuration
 */
export const networkConfig = {
  mainnet: {
    starknet: {
      rpcUrl: "https://starknet-mainnet.public.blastapi.io/rpc/v0_7",
      chainId: "SN_MAIN"
    },
    bitcoin: BitcoinNetwork.MAINNET
  },
  testnet: {
    starknet: {
      rpcUrl: "https://starknet-sepolia.public.blastapi.io/rpc/v0_7",
      chainId: "SN_SEPOLIA"
    },
    bitcoin: BitcoinNetwork.TESTNET
  }
};

/**
 * Get network-specific configuration
 */
export function getNetworkConfig(network: "mainnet" | "testnet") {
  return networkConfig[network];
}

/**
 * Swap limits configuration
 */
export const swapLimits = {
  // Minimum amounts in satoshis
  minLightningAmount: 1000n, // 1000 sats
  maxLightningAmount: 100000000n, // 1 BTC
  
  // Minimum amounts in Starknet token base units
  minStarknetAmount: 1000000000000000n, // 0.001 STRK
  maxStarknetAmount: 100000000000000000000n, // 100 STRK
  
  // Timeouts
  swapTimeoutMs: 3600000, // 1 hour
  paymentTimeoutMs: 1800000, // 30 minutes
  claimTimeoutMs: 300000, // 5 minutes
};