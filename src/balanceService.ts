import { RpcProvider, Contract } from 'starknet';
import * as fs from 'fs';
import { config } from './config';

// WBTC contract address on Starknet
const WBTC_CONTRACT_ADDRESS = '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac';

// Load WBTC ABI from file
const wbtcAbi = JSON.parse(fs.readFileSync('./compiledContracts/wbtc.abi.json').toString('ascii'));

export interface BalanceResponse {
  address: string;
  tokenAddress: string;
  tokenSymbol: string;
  balance: string;
  balanceFormatted: string;
  balanceInSats: string;
  decimals: number;
}

export class BalanceService {
  private provider: RpcProvider;
  private wbtcContract: Contract;

  constructor() {
    this.provider = new RpcProvider({ nodeUrl: config.starknetRpcUrl });
    this.wbtcContract = new Contract(wbtcAbi, WBTC_CONTRACT_ADDRESS, this.provider);
  }

  async getWBTCBalance(address: string): Promise<BalanceResponse> {
    try {
      console.log(`Querying WBTC balance for address: ${address}`);

      // Validate address format
      if (!this.isValidStarknetAddress(address)) {
        throw new Error('Invalid Starknet address format');
      }

      // Get balance from WBTC contract using the correct method
      const balanceResult = await this.wbtcContract.balance_of(address);
      
      // Get decimals to format the balance properly  
      const decimalsResult = await this.wbtcContract.decimals();
      const decimals = this.parseStarknetNumber(decimalsResult);

      // Get token symbol
      const symbolResult = await this.wbtcContract.symbol();
      
      // Convert balance to BigInt
      const balance = this.uint256ToBigInt(balanceResult);
      const balanceString = balance.toString();
      
      // Format balance to human readable format
      const balanceFormatted = this.formatBalance(balance, decimals);
      
      // Convert WBTC balance to satoshis (1 WBTC = 100,000,000 satoshis)
      const balanceInSats = this.wbtcToSatoshis(balance, decimals);

      console.log(`WBTC balance for ${address}: ${balanceFormatted} WBTC (${balanceInSats} sats)`);

      return {
        address,
        tokenAddress: WBTC_CONTRACT_ADDRESS,
        tokenSymbol: this.feltToString(symbolResult),
        balance: balanceString,
        balanceFormatted,
        balanceInSats,
        decimals
      };

    } catch (error) {
      console.error('Error querying WBTC balance:', error);
      throw error;
    }
  }

  private isValidStarknetAddress(address: string): boolean {
    // Basic validation for Starknet address
    // Should start with 0x and be a valid hex string
    const hexRegex = /^0x[0-9a-fA-F]+$/;
    return hexRegex.test(address) && address.length >= 3 && address.length <= 66;
  }

  private parseStarknetNumber(value: any): number {
    if (typeof value === 'bigint') {
      return Number(value);
    } else if (typeof value === 'number') {
      return value;
    } else if (typeof value === 'string') {
      return parseInt(value, 16);
    }
    // Default to 8 decimals for WBTC if we can't parse
    return 8;
  }

  private uint256ToBigInt(uint256: any): bigint {
    // Handle direct BigInt response (modern Starknet.js)
    if (typeof uint256 === 'bigint') {
      return uint256;
    }
    // Handle Uint256 structure from older Starknet versions
    else if (typeof uint256 === 'object' && uint256.low !== undefined && uint256.high !== undefined) {
      const low = BigInt(uint256.low);
      const high = BigInt(uint256.high);
      return low + (high << 128n);
    } 
    // Handle string or number
    else if (typeof uint256 === 'string' || typeof uint256 === 'number') {
      return BigInt(uint256);
    }
    return BigInt(0);
  }

  private formatBalance(balance: bigint, decimals: number): string {
    const divisor = BigInt(10) ** BigInt(decimals);
    const wholePart = balance / divisor;
    const fractionalPart = balance % divisor;
    
    if (fractionalPart === 0n) {
      return wholePart.toString();
    }
    
    const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
    const trimmedFractional = fractionalStr.replace(/0+$/, '');
    
    if (trimmedFractional === '') {
      return wholePart.toString();
    }
    
    return `${wholePart}.${trimmedFractional}`;
  }

  private wbtcToSatoshis(wbtcBalance: bigint, decimals: number): string {
    // WBTC has 8 decimals, and 1 BTC = 100,000,000 satoshis
    // So 1 WBTC unit (with 8 decimals) = 1 satoshi
    // Therefore, the WBTC balance in its smallest unit is already in satoshis
    
    // If WBTC uses 8 decimals (which it should), then the raw balance is already in satoshis
    if (decimals === 8) {
      return wbtcBalance.toString();
    }
    
    // If for some reason the decimals are different, we need to convert
    const satoshisPerBTC = BigInt(100000000); // 100 million satoshis per BTC
    const wbtcDecimals = BigInt(10) ** BigInt(decimals);
    
    // Convert to satoshis: (wbtcBalance * satoshisPerBTC) / wbtcDecimals
    const satoshis = (wbtcBalance * satoshisPerBTC) / wbtcDecimals;
    
    return satoshis.toString();
  }

  private feltToString(felt: any): string {
    // Convert felt to string for symbol
    if (typeof felt === 'string') {
      return felt;
    } else if (typeof felt === 'number' || typeof felt === 'bigint') {
      // Convert number to ASCII string
      const hex = BigInt(felt).toString(16);
      let str = '';
      for (let i = 0; i < hex.length; i += 2) {
        const byte = hex.substr(i, 2);
        if (byte !== '00') {
          str += String.fromCharCode(parseInt(byte, 16));
        }
      }
      return str || 'WBTC';
    }
    return 'WBTC';
  }
}