# K1 Starknet Adapter

A Node.js backend in TypeScript that handles atomic swaps between Starknet and Lightning Network using the Atomiq SDK.

## Features

- REST API compatible with K1 backend
- Atomic swaps between Starknet and Lightning Network
- TypeScript implementation with proper error handling
- Health check endpoint
- Configurable via environment variables

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Required environment variables (see `.env` file)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables in `.env` file:
```bash
STARKNET_PRIVATE_KEY=0x...
STARKNET_ACCOUNT_ADDRESS=0x...
NWC_CONNECTION_STRING=nostr+walletconnect://...
STARKNET_RPC_URL=https://starknet-mainnet.public.blastapi.io/rpc/v0_8
BITCOIN_NETWORK=mainnet
ATOMIQ_INTERMEDIARY_URL=https://84-32-32-132.sslip.io:24000
```

3. Build the project:
```bash
npm run build
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## API Endpoints

### Health Check
```bash
GET /health
```

### WBTC Balance Query
```bash
GET /balance/:address
```

Query WBTC balance for any Starknet address:
```bash
curl "http://localhost:3000/balance/0x03641aa25b8de4a4d5ac185c72b124546666f2ad2354c9627b6565830fdea408"
```

Response:
```json
{
  "success": true,
  "message": "WBTC balance retrieved successfully",
  "data": {
    "address": "0x03641aa25b8de4a4d5ac185c72b124546666f2ad2354c9627b6565830fdea408",
    "tokenAddress": "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
    "tokenSymbol": "WBTC",
    "balance": "0",
    "balanceFormatted": "0",
    "balanceInSats": "0",
    "decimals": 8
  }
}
```

**Response Fields:**
- `balance`: Raw balance in WBTC's smallest unit (8 decimals)
- `balanceFormatted`: Human-readable balance (e.g., "1.5" for 1.5 WBTC)
- `balanceInSats`: Balance converted to satoshis (1 WBTC = 100,000,000 sats)
- `decimals`: Token decimal places (8 for WBTC)
- `tokenAddress`: WBTC contract address on Starknet
- `tokenSymbol`: Token symbol ("WBTC")

### Invoice Processing (K1 Compatible)
```bash
POST /api/invoice
Content-Type: application/json

{
  "amountUSD": 10.00,
  "address": "lnbc1000n1p..."
}
```

### Atomic Swap Endpoints

#### Create Quote
```bash
POST /api/atomic-swap/quote
Content-Type: application/json

{
  "amountUSD": 10.00,
  "lightningAddress": "lnbc1000n1p...",
  "direction": "lightning_to_starknet"
}
```

#### Execute Swap
```bash
POST /api/atomic-swap/execute
Content-Type: application/json

{
  "swapId": "swap_123...",
  "direction": "lightning_to_starknet"
}
```

#### Check Status
```bash
GET /api/atomic-swap/status/:swapId
```

## Architecture

- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Atomiq SDK** - Atomic swap functionality
- **Starknet.js** - Starknet blockchain interaction
- **SQLite** - Local storage for swap data

## Current Implementation Status

This implementation provides a working REST API structure with placeholder atomic swap functionality. The Atomiq SDK integration is prepared but needs completion due to TypeScript compatibility issues.

To complete the full integration:

1. Resolve TypeScript compatibility issues with Atomiq SDK
2. Implement actual swap quote generation
3. Add real Lightning invoice creation
4. Complete Starknet transaction handling
5. Add proper error handling and monitoring

## Development

### Scripts
- `npm run build` - Build TypeScript
- `npm run dev` - Start development server
- `npm start` - Start production server
- `npm run lint` - Run linting
- `npm run typecheck` - Type checking

### File Structure
```
src/
├── index.ts              # Main server entry point
├── config.ts             # Configuration management
├── routes.ts             # API route definitions
├── types.ts              # TypeScript type definitions
└── atomicSwapSimple.ts   # Simplified atomic swap service
```