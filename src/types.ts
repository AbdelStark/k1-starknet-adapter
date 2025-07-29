/**
 * Type definitions for K1 Starknet Adapter API
 * 
 * This file contains all TypeScript interfaces and types used throughout
 * the application for API requests, responses, and internal data structures.
 * 
 * @fileoverview API Type Definitions
 * @author K1 Team
 * @version 1.0.0
 */

/**
 * Invoice request data transfer object
 * Used for K1 backend compatibility - processes Lightning payments from USD amounts
 * 
 * @interface InvoiceDTO
 */
export interface InvoiceDTO {
  /** USD amount to be converted to Lightning payment */
  amountUSD: number;
  
  /** Lightning address, invoice, or LNURL destination */
  address: string;
  
  /** Optional public key for advanced authentication (future use) */
  publicKey?: string;
}

/**
 * Generic result response structure
 * Provides consistent response format across all endpoints
 * 
 * @interface ResultDTO
 */
export interface ResultDTO {
  /** Indicates if the operation was successful */
  success: boolean;
  
  /** Human-readable message describing the result */
  message?: string;
  
  /** Additional data payload (varies by endpoint) */
  data?: any;
}

/**
 * Atomic swap request parameters
 * Used for legacy multi-step swap endpoints (now deprecated)
 * 
 * @interface AtomicSwapRequest
 * @deprecated Use direct /api/atomic-swap endpoint instead
 */
export interface AtomicSwapRequest {
  /** USD amount for the swap */
  amountUSD: number;
  
  /** Lightning address or payment destination */
  lightningAddress: string;
  
  /** Optional Starknet address for reverse swaps */
  starknetAddress?: string;
  
  /** Direction of the atomic swap */
  direction: 'lightning_to_starknet' | 'starknet_to_lightning';
}

/**
 * Atomic swap response data
 * Response format for legacy swap endpoints
 * 
 * @interface AtomicSwapResponse
 * @deprecated Use direct /api/atomic-swap endpoint instead
 */
export interface AtomicSwapResponse {
  /** Indicates if the swap was successful */
  success: boolean;
  
  /** Human-readable status message */
  message: string;
  
  /** Swap-specific data payload */
  data?: {
    /** Unique identifier for the swap transaction */
    swapId?: string;
    
    /** Lightning invoice for payment (if applicable) */
    lightningInvoice?: string;
    
    /** Blockchain transaction ID */
    transactionId?: string;
    
    /** Current state of the swap */
    state?: string;
    
    /** Array of next steps for the user */
    nextSteps?: string[];
  };
}