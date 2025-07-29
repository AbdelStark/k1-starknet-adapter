# Braavos Account Integration

This document explains how to use your existing Braavos wallet account with the K1 Starknet Adapter instead of creating a new OpenZeppelin account.

## Why Use Braavos Integration?

- **Use Existing Funds**: Keep using your existing Braavos wallet with your WBTC and STRK tokens
- **Familiar Interface**: Continue using the same account you're familiar with
- **No Migration**: No need to transfer tokens between different account types
- **Account Continuity**: Maintain your transaction history and account state

## Prerequisites

1. **Existing Braavos Account**: You must have a deployed Braavos account on Starknet
2. **Private Key Access**: Access to your Braavos account's private key
3. **Account Funding**: Your account should have STRK for fees and WBTC for swaps

## Quick Setup

### 1. Get Your Braavos Credentials

From your Braavos wallet:
1. Open Braavos browser extension or mobile app
2. Go to **Settings** > **Export Private Key**
3. Copy your private key (starts with `0x`)
4. Note your account address (also starts with `0x`)

### 2. Configure Environment Variables

Set these environment variables:

```bash
# Your Braavos account credentials
export STARKNET_PRIVATE_KEY="0x1234..."      # Your Braavos private key
export STARKNET_ACCOUNT_ADDRESS="0x5678..."  # Your Braavos account address

# Enable Braavos mode
export USE_BRAAVOS_ACCOUNT="true"

# Network configuration (optional)
export STARKNET_RPC_URL="https://starknet-sepolia.public.blastapi.io/rpc/v0_8"
```

### 3. Test the Integration

Run the example script to verify everything works:

```bash
npm run braavos-example
```

This will:
- Verify your account is a Braavos account
- Test signer creation
- Show available tokens for swapping
- Demonstrate integration with AtomicSwapper

## Usage Methods

### Method 1: Automatic (Recommended)

Set the environment variable and the system will automatically use Braavos:

```typescript
// Set USE_BRAAVOS_ACCOUNT=true in your environment
const config = createDefaultConfig();
const swapper = new AtomicSwapper(config);
await swapper.initialize(); // Will automatically use Braavos
```

### Method 2: Explicit Configuration

Explicitly enable Braavos in your configuration:

```typescript
const config = createDefaultConfig();
config.useBraavosAccount = true;

const swapper = new AtomicSwapper(config);
await swapper.initialize();
```

### Method 3: Manual Signer Setup

Manually create and set the Braavos signer:

```typescript
const config = createDefaultConfig();
const swapper = new AtomicSwapper(config);

// Set up Braavos signer first
await swapper.initializeBraavosStarknetSigner(
  'your-private-key',
  'your-account-address'
);

// Then initialize the rest
await swapper.initialize();
```

## Atomic Swap Example

Once configured, atomic swaps work exactly the same:

```typescript
// Configure for Braavos
process.env.USE_BRAAVOS_ACCOUNT = 'true';

// Initialize swapper
const config = createDefaultConfig();
const swapper = new AtomicSwapper(config);
await swapper.initialize();

// Perform atomic swap (same as before)
const result = await swapper.executeAtomicSwap({
  amountSats: 1000,
  lightningDestination: 'user@coinos.io',
  tokenAddress: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac', // WBTC
  exactIn: false
});

console.log('Swap completed:', result);
```

## API Usage

The REST API automatically uses Braavos when configured:

```bash
# Set environment variables
export USE_BRAAVOS_ACCOUNT=true
export STARKNET_PRIVATE_KEY="0x..."
export STARKNET_ACCOUNT_ADDRESS="0x..."

# Start server
npm run dev

# Make atomic swap request (same as before)
curl -X POST http://localhost:3000/api/atomic-swap \
  -H "Content-Type: application/json" \
  -d '{
    "amountSats": 1000,
    "lightningDestination": "user@coinos.io",
    "tokenAddress": "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac"
  }'
```

## Troubleshooting

### "Account is not a Braavos account"

This error means the provided address is not a Braavos account. Check:
- You're using the correct account address from your Braavos wallet
- The account is deployed on the network you're connecting to
- You're not mixing up testnet/mainnet addresses

### "Private key does not match account address"

This can happen if:
- You copied the wrong private key
- You're using a different account than intended
- The account was created through a recovery process

### "Account not deployed"

If your account isn't deployed yet:
- Make sure you've made at least one transaction from your Braavos wallet
- Check that you're on the correct network (mainnet vs testnet)

### Balance/Token Issues

If you can't access your tokens:
- Verify your account has STRK for transaction fees
- Check that WBTC tokens are in the correct account
- Ensure you're on the right network

## Security Considerations

⚠️ **Important Security Notes:**

1. **Private Key Security**: Never hardcode private keys in your code
2. **Environment Variables**: Use secure environment variable management
3. **Testing**: Always test with small amounts first
4. **Network**: Double-check you're on the intended network (mainnet/testnet)
5. **Backups**: Keep secure backups of your private key

## Advanced Usage

### Custom Provider Configuration

```typescript
import { RpcProvider } from 'starknet';
import { BraavosStarknetSigner } from './src/braavos/BraavosStarknetSigner';

const provider = new RpcProvider({ 
  nodeUrl: 'https://your-custom-rpc-url' 
});

const signer = await BraavosStarknetSigner.create(
  privateKey,
  accountAddress,
  provider
);
```

### Account Verification

```typescript
import { isBraavosAccount } from './src/braavos/deployBraavos';

const isBraavos = await isBraavosAccount(accountAddress, provider);
if (!isBraavos) {
  throw new Error('Not a Braavos account');
}
```

### Balance Checking

```typescript
const signer = await BraavosStarknetSigner.create(privateKey, address, provider);
const wbtcBalance = await signer.getBalance(WBTC_TOKEN_ADDRESS);
console.log('WBTC Balance:', wbtcBalance);
```

## Migration from OpenZeppelin

If you were previously using OpenZeppelin accounts:

1. **Backup**: Ensure you have backups of both account types
2. **Test**: Test Braavos integration on testnet first
3. **Transfer**: Transfer any remaining tokens from OZ account to Braavos
4. **Switch**: Update environment variables to use Braavos
5. **Verify**: Run tests to ensure everything works

## Support

If you encounter issues:

1. **Run Examples**: Try `npm run braavos-example` first
2. **Check Logs**: Enable debug logging for detailed error messages
3. **Verify Setup**: Double-check all environment variables
4. **Test Network**: Try on testnet first before mainnet

## References

- [Braavos Wallet](https://braavos.app/)
- [Starknet Documentation](https://docs.starknet.io/)
- [AtomiqLabs SDK](https://docs.atomiqlabs.com/)
- [Starknet.js Documentation](https://www.starknetjs.com/)