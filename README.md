# K1 Starknet Adapter ⚡

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/AbdelStark/k1-starknet-adapter/releases)
[![License](https://img.shields.io/badge/license-ISC-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

A **production-ready** TypeScript backend service that enables seamless atomic swaps between Starknet tokens and Bitcoin Lightning Network payments. Built with enterprise-grade architecture, comprehensive error handling, and full observability.

## 🚀 Key Features

### ⚡ Atomic Swaps
- **Trustless Cross-Chain Swaps**: Direct atomic swaps between Starknet and Lightning Network
- **WBTC & Token Support**: Native support for WBTC and other Starknet tokens
- **Real-Time Execution**: Complete swap execution in a single API call
- **Lightning Integration**: Support for Lightning addresses, invoices, and LNURL

### 🦊 Braavos Wallet Integration
- **Native Braavos Support**: First-class integration with Braavos wallets (default)
- **Existing Account Usage**: Use your existing Braavos accounts with all your funds
- **OpenZeppelin Fallback**: Optional support for OpenZeppelin accounts
- **Smart Detection**: Automatic wallet type detection and handling

### 🏗️ Production-Ready Architecture
- **RESTful API**: Clean HTTP endpoints with comprehensive error handling
- **TypeScript**: Full type safety and excellent developer experience
- **Structured Logging**: JSON logging with request tracking for monitoring
- **Health Monitoring**: Built-in health checks and metrics
- **Security**: Helmet.js security headers and best practices

### 🧪 Quality & Testing
- **Jest Testing**: Complete test suite with TypeScript support
- **End-to-End Tests**: Real atomic swap testing scenarios
- **Integration Tests**: API endpoint and service testing
- **Type Safety**: Strict TypeScript compilation with full type coverage

## 🎯 Quick Start

### Prerequisites
- **Node.js** v18+ with npm
- **Starknet Account** (Braavos recommended)
- **Environment Configuration** (see below)

### Installation

```bash
# Clone the repository
git clone https://github.com/AbdelStark/k1-starknet-adapter.git
cd k1-starknet-adapter

# Install dependencies
npm install

# Build the project
npm run build
```

### Configuration

Create a `.env` file or set environment variables:

```bash
# Required: Starknet Configuration
STARKNET_PRIVATE_KEY=0x1234567890abcdef...    # Your private key
STARKNET_ACCOUNT_ADDRESS=0x0123456789abcdef... # Your account address
STARKNET_RPC_URL=https://starknet-mainnet.public.blastapi.io/rpc/v0_8

# Required: Network Configuration
BITCOIN_NETWORK=mainnet                        # or testnet

# Optional: Wallet Configuration
USE_BRAAVOS_ACCOUNT=true                       # Default: true (recommended)

# Optional: Server Configuration
PORT=3000                                      # Default: 3000
NODE_ENV=production                            # Default: development

# Optional: Advanced Configuration
ATOMIQ_INTERMEDIARY_URL=https://custom-intermediary.com
GET_REQUEST_TIMEOUT=10000                      # Default: 10 seconds
POST_REQUEST_TIMEOUT=10000                     # Default: 10 seconds
MAX_PRICING_DIFFERENCE_PPM=20000               # Default: 2% (20,000 PPM)
```

### Start the Server

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm start
```

Server will be available at `http://localhost:3000`

## 📖 API Documentation

### Base URL
```
http://localhost:3000
```

---

## 🩺 System Endpoints

### Health Check
Get comprehensive system health and metrics.

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-07-29T15:30:45.123Z",
  "uptime": 1234.567,
  "memory": {
    "rss": 52428800,
    "heapTotal": 29360128,
    "heapUsed": 16857392,
    "external": 1089456
  },
  "environment": "production",
  "version": "0.1.0"
}
```

---

## 💰 Balance Queries

### Get Token Balance
Query token balance for any Starknet address.

```bash
curl "http://localhost:3000/balance/0x03641aa25b8de4a4d5ac185c72b124546666f2ad2354c9627b6565830fdea408"
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

---

## ⚡ Atomic Swaps

### Execute Atomic Swap
Perform a complete atomic swap between Starknet tokens and Lightning Network.

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

#### Request Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amountSats` | number | ✅ | Amount in satoshis (e.g., 400 = 0.000004 BTC) |
| `lightningDestination` | string | ✅ | Lightning address, invoice, or LNURL |
| `tokenAddress` | string | ✅ | Starknet token contract address |
| `exactIn` | boolean | ❌ | Whether amount is exact input (default: false) |

#### Common Token Addresses

| Token | Address |
|-------|---------|
| **WBTC** | `0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac` |
| **ETH** | `0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7` |
| **STRK** | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` |

#### Success Response

```json
{
  "success": true,
  "swapId": "df79bbd4a3da8f4c04bcd1642269b9075fe1230acfd123cdb1d4e83ad64ced1c",
  "inputAmount": "0.00000400 WBTC",
  "outputAmount": "400 sats",
  "tokenUsed": "WBTC",
  "tokenAddress": "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
  "finalState": 2,
  "lightningPaymentHash": "5db6ec23326cebdc28c23fec66b56a7794128b5d7870cc4ae448267242e0e2ee",
  "transactionId": null,
  "lightningDestination": "abdel@coinos.io",
  "message": "✅ WBTC -> Lightning atomic swap completed successfully!",
  "requestId": "531e3bf7",
  "timestamp": "2025-07-29T15:07:02.665Z"
}
```

#### Error Response

```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_TIMEOUT",
    "message": "Lightning payment not received within timeout",
    "swapId": "df79bbd4a3da8f4c...",
    "finalState": 1,
    "requestId": "531e3bf7",
    "timestamp": "2025-07-29T15:07:02.665Z"
  }
}
```

#### Response Fields

| Field | Description |
|-------|-------------|
| `swapId` | Unique identifier for the swap transaction |
| `inputAmount` | Formatted input amount with token symbol |
| `outputAmount` | Formatted output amount in satoshis |
| `finalState` | Swap state (0=created, 1=committed, 2=completed) |
| `lightningPaymentHash` | Lightning payment hash for verification |
| `requestId` | Request ID for debugging and support |

---

## 🔄 K1 Backend Compatibility

### Invoice Processing
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

### Technology Stack
- **Express.js** - Web framework with security middleware
- **TypeScript** - Type safety and modern JavaScript features
- **AtomiqLabs SDK** - Production atomic swap functionality
- **Starknet.js** - Starknet blockchain interaction
- **SQLite** - Local storage for swap state management
- **Winston** - Structured logging for production monitoring
- **Jest** - Testing framework with TypeScript support

### Project Structure
```
src/
├── index.ts              # Main server entry point
├── routes.ts             # API route definitions and handlers
├── atomicSwapper.ts      # Core atomic swap functionality
├── atomicConfig.ts       # Atomic swap configuration
├── balanceService.ts     # Token balance query service
├── logger.ts             # Structured logging configuration
├── middleware.ts         # Express middleware (CORS, security, etc.)
├── types.ts              # TypeScript type definitions
├── config.ts             # Application configuration management
├── Utils.ts              # Utility functions
└── braavos/              # Braavos wallet integration
    ├── StarknetBraavosWallet.ts  # Custom Braavos wallet implementation
    └── deployBraavos.ts          # Braavos deployment utilities

tests/
├── unit/                 # Unit tests
├── integration/          # Integration tests  
├── e2e/                  # End-to-end tests
└── setup.ts              # Test configuration

scripts/
└── ts/                   # TypeScript utility scripts
    ├── braavos-example.ts
    ├── test-endpoint.ts
    └── test-production-endpoints.ts
```

---

## 🧪 Development & Testing

### Available Scripts

```bash
# Development
npm run dev              # Start development server with hot reload
npm run build           # Build TypeScript to JavaScript
npm start              # Start production server

# Code Quality
npm run lint           # Run ESLint code linting
npm run typecheck      # Run TypeScript type checking

# Testing
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:integration  # Run integration tests only
npm run test:e2e      # Run end-to-end tests only
npm run atomic-swap-test  # Run atomic swap integration test
```

### Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STARKNET_PRIVATE_KEY` | ✅ | - | Starknet account private key |
| `STARKNET_ACCOUNT_ADDRESS` | ✅ | - | Starknet account address |
| `STARKNET_RPC_URL` | ✅ | mainnet RPC | Starknet RPC endpoint |
| `BITCOIN_NETWORK` | ✅ | mainnet | Bitcoin network (mainnet/testnet) |
| `USE_BRAAVOS_ACCOUNT` | ❌ | true | Use Braavos wallet (set to false for OpenZeppelin) |
| `PORT` | ❌ | 3000 | Server port |
| `NODE_ENV` | ❌ | development | Environment (development/production/test) |
| `ATOMIQ_INTERMEDIARY_URL` | ❌ | SDK default | Custom intermediary URL |
| `GET_REQUEST_TIMEOUT` | ❌ | 10000 | GET request timeout (ms) |
| `POST_REQUEST_TIMEOUT` | ❌ | 10000 | POST request timeout (ms) |
| `MAX_PRICING_DIFFERENCE_PPM` | ❌ | 20000 | Max pricing difference (parts per million) |

### Manual Testing Examples

```bash
# Test with different amounts
curl -X POST http://localhost:3000/api/atomic-swap \
  -H "Content-Type: application/json" \
  -d '{"amountSats": 100, "lightningDestination": "test@coinos.io", "tokenAddress": "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac"}'

# Test with different tokens (ETH)
curl -X POST http://localhost:3000/api/atomic-swap \
  -H "Content-Type: application/json" \
  -d '{"amountSats": 1000, "lightningDestination": "user@wallet.of.satoshi.com", "tokenAddress": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7"}'

# Test balance query
curl "http://localhost:3000/balance/0x03641aa25b8de4a4d5ac185c72b124546666f2ad2354c9627b6565830fdea408"

# Test health endpoint
curl http://localhost:3000/health
```

---

## 🚀 Production Deployment

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy built application
COPY dist/ ./dist/
COPY compiledContracts/ ./compiledContracts/

# Security and performance
RUN addgroup -g 1001 -S nodejs
RUN adduser -S k1adapter -u 1001
USER k1adapter

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

CMD ["npm", "start"]
```

### Environment Setup Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure secure environment secrets management
- [ ] Set up structured log aggregation (ELK, Datadog, etc.)
- [ ] Configure health check monitoring
- [ ] Set up reverse proxy (nginx, Caddy, or cloud load balancer)
- [ ] Configure SSL/TLS certificates
- [ ] Set up error tracking (Sentry, Bugsnag, etc.)
- [ ] Configure metrics collection and alerting

### Monitoring & Observability

```bash
# Health monitoring
curl http://your-domain.com/health

# Structured logs (JSON format)
tail -f logs/server.log | jq '.'

# Performance metrics
curl http://your-domain.com/health | jq '.memory'
```

---

## 🛡️ Security

### Built-in Security Features
- **Helmet.js**: Security headers and protection
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: Request rate limiting middleware
- **Input Validation**: Comprehensive parameter validation
- **Error Handling**: Secure error responses without sensitive data exposure

### Security Best Practices
- Keep private keys secure and never commit them to version control
- Use environment variables or secure secret management
- Enable HTTPS in production with proper SSL certificates
- Regularly update dependencies with `npm audit` and `npm update`
- Monitor logs for suspicious activity
- Implement additional authentication for production use

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Make** your changes with comprehensive tests
4. **Run** the test suite: `npm test`
5. **Run** code quality checks: `npm run lint && npm run typecheck`
6. **Commit** your changes with conventional commit messages
7. **Push** to your branch (`git push origin feature/amazing-feature`)
8. **Open** a Pull Request with detailed description

### Development Guidelines
- Follow TypeScript best practices
- Write comprehensive tests for new features
- Update documentation for API changes
- Use structured commit messages
- Ensure all CI checks pass

---

## 📜 License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.

---

## 🆘 Support & Troubleshooting

### Common Issues

**Q: "Atomic swap timeout" error**  
A: Check your Lightning destination is valid and network connectivity is stable.

**Q: "Token not found" error**  
A: Verify the token address is correct and the token is supported on your network.

**Q: "Insufficient balance" error**  
A: Ensure your Starknet account has enough token balance for the swap amount plus fees.

**Q: Braavos wallet issues**  
A: Set `USE_BRAAVOS_ACCOUNT=false` to use OpenZeppelin accounts instead.

### Getting Help

- 📋 **Issues**: [GitHub Issues](https://github.com/AbdelStark/k1-starknet-adapter/issues)
- 📖 **Documentation**: Check this README and inline code documentation
- 🔍 **Logs**: Check the application logs for detailed error information
- 🧪 **Testing**: Run `npm run atomic-swap-test` to verify your setup

### Diagnostic Commands

```bash
# Check configuration
npm run typecheck

# Test atomic swap integration
npm run atomic-swap-test

# Verify all services
curl http://localhost:3000/health

# Check balance
curl "http://localhost:3000/balance/YOUR_ADDRESS"
```

---

**Production Status**: ✅ **Ready for Production**

This adapter is production-ready with comprehensive error handling, monitoring, logging, and security features. It has been tested with mainnet Starknet and Lightning Network operations.

---

<div align="center">

**Built with ❤️ by the K1 Team**

[🌟 Star this repo](https://github.com/AbdelStark/k1-starknet-adapter) • [🐛 Report Bug](https://github.com/AbdelStark/k1-starknet-adapter/issues) • [💡 Request Feature](https://github.com/AbdelStark/k1-starknet-adapter/issues)

</div>