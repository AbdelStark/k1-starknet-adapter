import dotenv from "dotenv";
import { AtomicSwapper } from "./atomicSwapper";
import { createDefaultConfig } from "./atomicConfig";

dotenv.config();

const WBTC_ADDRESS =
  "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac";
const LIGHTNING_DESTINATION = "abdel@coinos.io";
const TEST_AMOUNT = 400n;
const EXACT_IN = false;

async function testWBTCAtomicSwap() {
  console.log("🔧 Starting WBTC Atomic Swap Test");
  console.log("================================");

  let swapper: AtomicSwapper | null = null;

  try {
    // Create configuration from environment variables
    console.log("📋 Creating configuration...");
    const config = createDefaultConfig();

    console.log("Configuration:");
    console.log(`  - Starknet RPC: ${config.starknetRpcUrl}`);
    console.log(`  - Account: ${config.starknetAccountAddress}`);
    console.log(`  - Bitcoin Network: ${config.bitcoinNetwork}`);
    console.log(`  - Intermediary URL: ${config.intermediaryUrl || "Default"}`);
    console.log(
      `  - Max Price Difference PPM: ${config.maxPricingDifferencePPM}`
    );
    console.log("");

    // Initialize AtomicSwapper
    console.log("🛠️ Initializing AtomicSwapper...");
    swapper = new AtomicSwapper(config);
    await swapper.initialize();
    console.log("✅ AtomicSwapper initialized successfully");
    console.log(`Starknet wallet address: ${swapper.getStarknetAddress()}`);

    // Get available tokens
    console.log("🪙 Getting available tokens...");
    const tokens = swapper.getAvailableTokens();
    console.log("Available token categories:", Object.keys(tokens));

    if (tokens.BITCOIN) {
      console.log("Available Bitcoin tokens:", Object.keys(tokens.BITCOIN));
    }

    // Check Starknet tokens
    const swapperInstance = swapper.getSwapper();
    if (swapperInstance.tokens && swapperInstance.tokens.STARKNET) {
      const starknetTokens = swapperInstance.tokens.STARKNET;
      const tokenAddresses = Object.keys(starknetTokens);
      console.log("Available Starknet token addresses:", tokenAddresses);
    }

    // Find suitable tokens for testing
    let sourceToken: any;
    let tokenName = "Unknown";

    if (swapperInstance.tokens && swapperInstance.tokens.STARKNET) {
      const starknetTokens = swapperInstance.tokens.STARKNET;

      if (starknetTokens[WBTC_ADDRESS]) {
        sourceToken = starknetTokens[WBTC_ADDRESS];
        tokenName = "WBTC";
        console.log(`✅ Found WBTC token for testing (${WBTC_ADDRESS})`);
      } else {
        console.log(`❌ WBTC token not found at address ${WBTC_ADDRESS}`);
        console.log("Available tokens:", Object.keys(starknetTokens));
        throw new Error("WBTC token not available in the SDK");
      }
    }

    if (!sourceToken) {
      throw new Error("No suitable source token found");
    }

    // Get BTC Lightning token
    const btcLnToken = tokens.BITCOIN.BTCLN;
    console.log("✅ Found BTC Lightning token: ", btcLnToken);

    // Check swap limits
    console.log("📊 Checking swap limits...");
    try {
      const limits = swapper.getSwapLimits(sourceToken, btcLnToken);
      console.log("Swap limits:");
      console.log("  - Input min:", limits.input.min?.toString() || "N/A");
      console.log("  - Input max:", limits.input.max?.toString() || "N/A");
      console.log("  - Output min:", limits.output.min?.toString() || "N/A");
      console.log("  - Output max:", limits.output.max?.toString() || "N/A");
    } catch (error) {
      console.log(
        "⚠️ Could not retrieve swap limits:",
        (error as Error).message
      );
    }

    // Check token balance
    console.log("💰 Checking token balance...");
    try {
      const balance = await swapper.getSpendableBalance(sourceToken);
      console.log(`${tokenName} Balance: ${balance.toString()}`);
    } catch (error) {
      console.log("⚠️ Could not check balance:", (error as Error).message);
    }

    // Test creating a swap quote
    console.log(
      `\n💱 Testing ${tokenName} -> Lightning swap quote creation...`
    );

    try {
      console.log(
        `Creating swap quote for ${TEST_AMOUNT.toString()} ${tokenName} units -> Lightning`
      );

      const swap = await swapper.createSwapQuote(
        sourceToken, // Source token
        btcLnToken, // Destination: BTC on Lightning
        TEST_AMOUNT, // Amount
        EXACT_IN, // exactIn
        swapper.getStarknetAddress(), // Source address
        LIGHTNING_DESTINATION // LNURL-pay destination
      );

      console.log("✅ Swap quote created successfully!");
      console.log("Swap details:");
      console.log(`  - Swap ID: ${swap.getId()}`);
      console.log(
        `  - Input Amount: ${swap
          .getInputWithoutFee()
          .toString()} ${tokenName} units`
      );
      console.log(
        `  - Input with fees: ${swap.getInput().toString()} ${tokenName} units`
      );
      console.log(`  - Output Amount: ${swap.getOutput().toString()} satoshis`);
      console.log(
        `  - Fee: ${swap
          .getFee()
          .amountInSrcToken.toString()} ${tokenName} units`
      );

      // Fee breakdown
      console.log("Fee breakdown:");
      for (const fee of swap.getFeeBreakdown()) {
        console.log(
          `  - ${
            fee.type
          }: ${fee.fee.amountInSrcToken.toString()} ${tokenName} units`
        );
      }

      try {
        const priceInfo = swap.getPriceInfo();
        console.log("Price information:");
        console.log(`  - Swap Price: ${priceInfo.swapPrice}`);
        console.log(`  - Market Price: ${priceInfo.marketPrice}`);
        console.log(`  - Price Difference: ${priceInfo.difference}%`);
      } catch (error) {
        console.log("⚠️ Could not get price info:", (error as Error).message);
      }

      console.log(
        `  - Quote expires in: ${
          (swap.getQuoteExpiry() - Date.now()) / 1000
        } seconds`
      );
      console.log(
        `  - Is paying to non-custodial wallet: ${swap.isPayingToNonCustodialWallet()}`
      );
      console.log(`  - Is likely to fail: ${swap.willLikelyFail()}`);

      // Execute the full swap for Starknet -> Lightning
      console.log("\n🚀 Executing WBTC -> Lightning atomic swap...");
      console.log("This is a Starknet -> Lightning swap, so we:");
      console.log("1. Commit the swap on Starknet");
      console.log("2. Wait for Lightning payment to complete");

      try {
        const signer = swapper.getStarknetSigner();
        console.log(`Using signer address: ${signer.getAddress()}`);

        // Step 1: Commit the swap on Starknet
        console.log("\n📝 Step 1: Committing swap on Starknet...");
        await swap.commit(signer);
        console.log("✅ Swap committed successfully on Starknet");
        console.log(`Current swap state: ${swap.getState()}`);

        // Step 2: Wait for Lightning payment
        console.log("\n⚡ Step 2: Waiting for Lightning payment...");
        console.log(
          "The intermediary should now process the Lightning payment..."
        );

        const paymentReceived = await swap.waitForPayment();

        if (paymentReceived) {
          console.log("✅ Lightning payment received successfully!");
          console.log(`Final swap state: ${swap.getState()}`);

          // Get additional swap details
          const secret = swap.getSecret?.();
          const txId = swap.getTransactionId?.();

          console.log("\n🎉 ATOMIC SWAP COMPLETED SUCCESSFULLY!");
          console.log("================================");
          console.log("📋 Final Swap Results:");
          console.log(`  - Swap ID: ${swap.getId()}`);
          console.log(
            `  - Input Amount: ${swap
              .getInputWithoutFee()
              .toString()} ${tokenName}`
          );
          console.log(
            `  - Output Amount: ${swap.getOutput().toString()} satoshis`
          );
          console.log(`  - Final State: ${swap.getState()}`);
          console.log(`  - Lightning Payment Hash: ${secret || "N/A"}`);
          console.log(`  - Transaction ID: ${txId || "N/A"}`);
          console.log(`  - Lightning Destination: ${LIGHTNING_DESTINATION}`);

          return {
            success: true,
            swapId: swap.getId(),
            inputAmount: swap.getInputWithoutFee().toString(),
            outputAmount: swap.getOutput().toString(),
            tokenUsed: tokenName,
            tokenAddress: WBTC_ADDRESS,
            finalState: swap.getState(),
            lightningPaymentHash: secret || null,
            transactionId: txId || null,
            lightningDestination: LIGHTNING_DESTINATION,
            message: `✅ WBTC -> Lightning atomic swap completed successfully!`,
          };
        } else {
          console.log("❌ Lightning payment not received within timeout");
          console.log(`Current swap state: ${swap.getState()}`);

          return {
            success: false,
            error: "Lightning payment not received within timeout",
            swapId: swap.getId(),
            tokenUsed: tokenName,
            finalState: swap.getState(),
            message: "Swap timed out waiting for Lightning payment",
          };
        }
      } catch (executionError) {
        console.error("❌ Error during swap execution:", executionError);
        console.log(`Current swap state: ${swap.getState()}`);

        return {
          success: false,
          error: `Swap execution failed: ${(executionError as Error).message}`,
          swapId: swap.getId(),
          tokenUsed: tokenName,
          finalState: swap.getState(),
        };
      }
    } catch (swapError) {
      console.error("❌ Failed to create swap quote:", swapError);

      return {
        success: false,
        error: `Failed to create swap quote: ${(swapError as Error).message}`,
        tokenUsed: tokenName,
      };
    }
  } catch (error) {
    console.error("❌ Atomic Swap Test failed:", error);

    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Always clean up
    if (swapper) {
      try {
        await swapper.stop();
        console.log("🛑 Swapper stopped successfully");
      } catch (stopError) {
        console.error("⚠️ Error stopping swapper:", stopError);
      }
    }
  }
}

// Execute test if run directly
if (require.main === module) {
  testWBTCAtomicSwap()
    .then((result) => {
      console.log("\n📊 Final Result:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error("💥 Unhandled error:", error);
      process.exit(1);
    });
}

export { testWBTCAtomicSwap };
