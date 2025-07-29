# Braavos Account Integration - Quick Start

This guide shows you how to use your existing Braavos wallet with the K1 Starknet Adapter.

## 🚀 Quick Setup (30 seconds)

### 1. Get Your Braavos Credentials

From your Braavos browser extension:
1. Open Braavos wallet
2. Click Settings → Export Private Key  
3. Copy your private key (starts with `0x`)
4. Note your account address (also starts with `0x`)

### 2. Set Environment Variables

```bash
export STARKNET_PRIVATE_KEY="0x1234..."      # Your Braavos private key
export STARKNET_ACCOUNT_ADDRESS="0x5678..."  # Your Braavos account address
export USE_BRAAVOS_ACCOUNT="true"            # Enable Braavos mode
```

### 3. Test It

```bash
npm run braavos-example
```

That's it! Your existing Braavos account will now be used for all atomic swaps.

## 🔄 Using With Atomic Swaps

### REST API (No Code Changes)

```bash
# Start server (will automatically use Braavos account)
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

### TypeScript Code

```typescript
// Option 1: Automatic (using environment variables)
const config = createDefaultConfig();
config.useBraavosAccount = true;  // or set USE_BRAAVOS_ACCOUNT=true

const swapper = new AtomicSwapper(config);
await swapper.initialize();  // Uses Braavos automatically

// Option 2: Manual
const swapper = new AtomicSwapper(config);
await swapper.initializeBraavosFromEnv();  // Use Braavos account
await swapper.initialize();

// Use exactly the same as before
const result = await swapper.executeAtomicSwap({
  amountSats: 1000,
  lightningDestination: 'user@coinos.io',
  tokenAddress: '0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac'
});
```

## ✅ Advantages

- **No Token Transfer**: Keep using your existing WBTC and STRK
- **Same Interface**: All existing code works unchanged  
- **Account Continuity**: Maintain your transaction history
- **Security**: Your private keys stay with you

## ⚡ How It Works

The integration is simple:
1. Instead of creating a new OpenZeppelin account, we use your existing Braavos account
2. The `StarknetKeypairWallet` works with both account types
3. All atomic swap logic remains the same
4. Your Braavos account signs all transactions

## 🔧 Troubleshooting

### "Account not found" error
- Make sure your account is deployed (make at least 1 transaction from Braavos first)
- Verify you're on the correct network (mainnet vs testnet)

### "Insufficient balance" error  
- Check your STRK balance for transaction fees
- Verify WBTC balance for swaps

### Wrong network
- Mainnet: `https://starknet-mainnet.public.blastapi.io/rpc/v0_8`
- Sepolia: `https://starknet-sepolia.public.blastapi.io/rpc/v0_8`

## 🔒 Security Notes

- Never commit private keys to git
- Use environment variables only
- Test with small amounts first
- Keep backups of your private key

## 💡 Migration From OpenZeppelin

If you were using OpenZeppelin accounts before:

```bash
# 1. Transfer any remaining tokens from OZ to Braavos account
# 2. Update environment variables to Braavos credentials  
export STARKNET_PRIVATE_KEY="0x..."     # Braavos private key
export STARKNET_ACCOUNT_ADDRESS="0x..." # Braavos address
export USE_BRAAVOS_ACCOUNT="true"       # Enable Braavos mode

# 3. Restart your application - no code changes needed!
```

## 📞 Support

- Run `npm run braavos-example` to test your setup
- Check logs for detailed error messages
- Verify account deployment status with a Starknet explorer

That's all you need! Your Braavos account will work seamlessly with all existing K1 Starknet Adapter functionality.