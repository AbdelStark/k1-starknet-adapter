// transferService.ts
import { RpcProvider, Account, uint256 } from 'starknet';
import { config } from './config';

// WBTC token contract address on Starknet
const WBTC_CONTRACT_ADDRESS = '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac'; // same as balanceService

// Load config values
const atmPrivateKey = config.starknetPrivateKey;
const atmAddress = config.starknetAccountAddress;
const k1WalletAddress = config.starknetK1Address;

const provider = new RpcProvider({ nodeUrl: config.starknetRpcUrl });

export async function transferWBTCToK1(amountDecimal: string): Promise<string> {
  const amountBigInt = BigInt(Math.floor(parseFloat(amountDecimal) * 1e8)); // 8 decimals for WBTC
  const amountU256 = uint256.bnToUint256(amountBigInt);

  const atmAccount = new Account(provider, atmAddress, atmPrivateKey);

  const tx = await atmAccount.execute({
    contractAddress: WBTC_CONTRACT_ADDRESS,
    entrypoint: 'transfer',
    calldata: [
      k1WalletAddress,
      amountU256.low,
      amountU256.high
    ]
  });

  console.log('WBTC transfer submitted:', tx.transaction_hash);
  await provider.waitForTransaction(tx.transaction_hash);
  console.log('WBTC transfer confirmed');

  return tx.transaction_hash;
}
