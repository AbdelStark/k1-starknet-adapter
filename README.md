# K1 Starknet Adapter

A production-grade Node.js backend in TypeScript that handles atomic swaps between Starknet and Lightning Network using the Atomiq SDK.

## 🚀 Features

- **Production-Ready REST API** - Complete atomic swap execution via HTTP endpoints
- **Starknet ↔ Lightning Swaps** - Seamless cross-chain atomic swaps
- **TypeScript Implementation** - Type-safe with comprehensive error handling
- **Real-time Logging** - Structured logging for monitoring and debugging
- **Health Monitoring** - Built-in health checks and status endpoints
- **Environment Configuration** - Secure configuration via environment variables
- **K1 Backend Compatible** - Drop-in replacement for existing K1 integrations

## 📋 Prerequisites

- **Node.js** v18 or higher
- **npm** or **yarn** package manager
- **Starknet Account** with private key and account address
- **Environment Variables** (see configuration section)

## ⚙️ Installation

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd k1-starknet-adapter
npm install
```

2. **Configure environment variables in `.env` file:**
```bash
# Starknet Configuration
STARKNET_PRIVATE_KEY=0x...
STARKNET_ACCOUNT_ADDRESS=0x...
STARKNET_RPC_URL=https://starknet-mainnet.public.blastapi.io/rpc/v0_8

# Bitcoin/Lightning Configuration
BITCOIN_NETWORK=mainnet
NWC_CONNECTION_STRING=nostr+walletconnect://...

# Atomiq Configuration
ATOMIQ_INTERMEDIARY_URL=https://84-32-32-132.sslip.io:24000

# Server Configuration (Optional)
PORT=3000
NODE_ENV=production
```

3. **Build the project:**
```bash
npm run build
```

## 🏃 Usage

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The server will start on `http://localhost:3000` (or your configured port).

## 📡 API Documentation

### Base URL
```
http://localhost:3000
```

### Authentication
Currently no authentication required. Consider adding API keys for production use.

---

## 🩺 Health & Status Endpoints

### Health Check
Get server health status.

```bash
curl -X GET http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-07-29T12:23:45.123Z"
}
```

---

## 💰 Balance Endpoints

### Get WBTC Balance
Query WBTC balance for any Starknet address.

```bash
curl -X GET "http://localhost:3000/balance/0x03641aa25b8de4a4d5ac185c72b124546666f2ad2354c9627b6565830fdea408"
```

**Response:**
```json
{
  "success": true,
  "message": "WBTC balance retrieved successfully",
  "data": {
    "address": "0x03641aa25b8de4a4d5ac185c72b124546666f2ad2354c9627b6565830fdea408",
    "tokenAddress": "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
    "tokenSymbol": "WBTC",
    "balance": "50000",
    "balanceFormatted": "0.00050000",
    "balanceInSats": "50000",
    "decimals": 8
  }
}
```

**Response Fields:**
- `balance` - Raw balance in WBTC's smallest unit (8 decimals)
- `balanceFormatted` - Human-readable balance (e.g., "1.5" for 1.5 WBTC)
- `balanceInSats` - Balance converted to satoshis (1 WBTC = 100,000,000 sats)
- `decimals` - Token decimal places (8 for WBTC)

---

## ⚡ Atomic Swap Endpoints

### Direct Atomic Swap Execution
**NEW**: Execute complete atomic swap in one request (recommended).

```bash
curl -X POST http://localhost:3000/api/atomic-swap \
  -H "Content-Type: application/json" \
  -d '{
    "amountSats": 400,
    "lightningDestination": "abdel@coinos.io",
    "tokenAddress": "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
    "exactIn": false
  }'
```

**Request Parameters:**
- `amountSats` (required) - Amount in satoshis (e.g., 400 = 0.000004 BTC)
- `lightningDestination` (required) - Lightning address, invoice, or LNURL
- `tokenAddress` (required) - Starknet token contract address
- `exactIn` (optional) - Whether amount is exact input (default: false)

**Success Response:**
```json
{
  "success": true,
  "swapId": "9cb8f75513c664b64cf613854a5212119ad4202a6cbd5bafaf6f6a5c4bbff884",
  "inputAmount": "0.00000400 WBTC",
  "outputAmount": "400 BTC",
  "tokenUsed": "WBTC",
  "tokenAddress": "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
  "finalState": 2,
  "lightningPaymentHash": "55fe6371c5750b3c62b54c54327b0ab94881857d733ab88c5b1c3d7e7a88b168",
  "transactionId": null,
  "lightningDestination": "abdel@coinos.io",
  "message": "✅ WBTC -> Lightning atomic swap completed successfully!"
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Lightning payment not received within timeout",
  "swapId": "9cb8f75513c664b64cf613854a5212119ad4202a6cbd5bafaf6f6a5c4bbff884",
  "finalState": 1
}
```

**Common Token Addresses:**
- **WBTC**: `0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac`
- **ETH**: `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7`
- **STRK**: `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d`

### Advanced: Step-by-Step Swap Process

#### 1. Create Swap Quote
```bash
curl -X POST http://localhost:3000/api/atomic-swap/quote \
  -H "Content-Type: application/json" \
  -d '{
    "amountUSD": 10.00,
    "lightningAddress": "abdel@coinos.io",
    "direction": "starknet_to_lightning"
  }'
```

#### 2. Execute Swap
```bash
curl -X POST http://localhost:3000/api/atomic-swap/execute \
  -H "Content-Type: application/json" \
  -d '{
    "swapId": "9cb8f75513c664b64cf613854a5212119ad4202a6cbd5bafaf6f6a5c4bbff884",
    "direction": "starknet_to_lightning"
  }'
```

#### 3. Check Swap Status
```bash
curl -X GET http://localhost:3000/api/atomic-swap/status/9cb8f75513c664b64cf613854a5212119ad4202a6cbd5bafaf6f6a5c4bbff884
```

---

## 🔄 K1 Backend Compatibility

### Invoice Processing Endpoint
For compatibility with existing K1 integrations.

```bash
curl -X POST http://localhost:3000/api/invoice \
  -H "Content-Type: application/json" \
  -d '{
    "amountUSD": 10.00,
    "address": "abdel@coinos.io"
  }'
```

---

## 🏗️ Architecture

- **Express.js** - Web framework with middleware support
- **TypeScript** - Type safety and modern JavaScript features
- **Atomiq SDK** - Production atomic swap functionality
- **Starknet.js** - Starknet blockchain interaction
- **SQLite** - Local storage for swap state management
- **Structured Logging** - JSON logging for production monitoring

---

## 🔧 Development

### Available Scripts
```bash
npm run build        # Build TypeScript to JavaScript
npm run dev          # Start development server with hot reload
npm start           # Start production server
npm run lint        # Run ESLint code linting
npm run typecheck   # Run TypeScript type checking
npm run atomic-swap-test  # Run atomic swap integration test
```

### Project Structure
```
src/
├── index.ts           # Main server entry point
├── routes.ts          # API route definitions and handlers
├── config.ts          # Configuration management
├── types.ts           # TypeScript type definitions
├── atomicSwapper.ts   # Core atomic swap functionality
├── atomicConfig.ts    # Atomic swap configuration
├── balanceService.ts  # Balance query service
└── atomicSwapTest.ts  # Integration test suite
```

### Environment Variables Reference
| Variable | Required | Description |
|----------|----------|-------------|
| `STARKNET_PRIVATE_KEY` | ✅ | Starknet account private key |
| `STARKNET_ACCOUNT_ADDRESS` | ✅ | Starknet account address |
| `STARKNET_RPC_URL` | ✅ | Starknet RPC endpoint |
| `BITCOIN_NETWORK` | ✅ | Bitcoin network (mainnet/testnet) |
| `ATOMIQ_INTERMEDIARY_URL` | ⚠️ | Custom intermediary URL (optional) |
| `NWC_CONNECTION_STRING` | ⚠️ | Nostr Wallet Connect string (optional) |
| `PORT` | ❌ | Server port (default: 3000) |
| `NODE_ENV` | ❌ | Environment (development/production) |

---

## 🧪 Testing

### Integration Test
Run the complete atomic swap test:
```bash
npm run atomic-swap-test
```

### Endpoint Testing
Use the provided test script:
```bash
node test-endpoint.js
```

### Manual Testing Examples
Test with different amounts and destinations:
```bash
# Small amount test
curl -X POST http://localhost:3000/api/atomic-swap \
  -H "Content-Type: application/json" \
  -d '{"amountSats": 100, "lightningDestination": "test@coinos.io", "tokenAddress": "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac"}'

# Different token test  
curl -X POST http://localhost:3000/api/atomic-swap \
  -H "Content-Type: application/json" \
  -d '{"amountSats": 1000, "lightningDestination": "user@wallet.of.satoshi.com", "tokenAddress": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"}'
```

---

## 🚀 Production Deployment

### Docker Deployment (Recommended)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment Setup
1. Set `NODE_ENV=production`
2. Configure proper logging aggregation
3. Set up health check monitoring
4. Use environment secrets management
5. Configure reverse proxy (nginx/caddy)

### Monitoring
- Health endpoint: `GET /health`
- Structured JSON logs for aggregation
- Error tracking with stack traces
- Swap success/failure metrics

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Run `npm run lint && npm run typecheck`
5. Submit a pull request

---

## 📜 License

ISC License - see LICENSE file for details.

---

## 🆘 Support

For issues and questions:
- Create an issue on GitHub
- Check the logs for detailed error information
- Verify environment configuration
- Test with the integration test suite

---

**Production Status**: ✅ Ready for production use with proper monitoring and error handling.