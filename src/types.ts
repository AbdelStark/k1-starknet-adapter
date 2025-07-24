export interface InvoiceDTO {
  amountUSD: number;
  address: string;
  publicKey?: string;
}

export interface ResultDTO {
  success: boolean;
  message?: string;
  data?: any;
}

export interface AtomicSwapRequest {
  amountUSD: number;
  lightningAddress: string;
  starknetAddress?: string;
  direction: 'lightning_to_starknet' | 'starknet_to_lightning';
}

export interface AtomicSwapResponse {
  success: boolean;
  message: string;
  data?: {
    swapId?: string;
    lightningInvoice?: string;
    transactionId?: string;
    state?: string;
    nextSteps?: string[];
  };
}