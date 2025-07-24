import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  starknetRpcUrl: process.env.STARKNET_RPC_URL || 'https://starknet-mainnet.public.blastapi.io/rpc/v0_8',
  starknetPrivateKey: process.env.STARKNET_PRIVATE_KEY || '',
  starknetAccountAddress: process.env.STARKNET_ACCOUNT_ADDRESS || '',
  bitcoinNetwork: process.env.BITCOIN_NETWORK || 'mainnet',
  nwcConnectionString: process.env.NWC_CONNECTION_STRING || '',
  atomiqIntermediaryUrl: process.env.ATOMIQ_INTERMEDIARY_URL || 'https://84-32-32-132.sslip.io:24000',
  defaultGasAmount: process.env.DEFAULT_GAS_AMOUNT || '1000000000000000000',
  maxPricingDifferencePpm: parseInt(process.env.MAX_PRICING_DIFFERENCE_PPM || '20000'),
  getRequestTimeout: parseInt(process.env.GET_REQUEST_TIMEOUT || '10000'),
  postRequestTimeout: parseInt(process.env.POST_REQUEST_TIMEOUT || '10000'),
  enableTestnet: process.env.ENABLE_TESTNET === 'true'
};

export function validateConfig() {
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