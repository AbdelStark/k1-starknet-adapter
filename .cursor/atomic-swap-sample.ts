import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { nwc } from "@getalby/sdk";
import { AtomicSwapper } from "./swapper.js";
import { createDefaultConfig, AtomicSwapConfig } from "./config.js";
import {
  humanReadableToSatoshis,
  starknetTokenToHumanReadable,
  humanReadableToStarknetToken,
  formatSwapState,
  calculateSwapProgress,
  getSwapStatusDescription,
  getNextSteps,
  formatErrorMessage,
} from "./utils.js";
import { schnorr } from "@noble/curves/secp256k1";
import { bytesToHex } from "@noble/hashes/utils";

/**
 * Atomic swaps tool for Lightning <-> Starknet
 */
export class AtomicSwapsTool {
  private swapper: AtomicSwapper;
  private activeSwaps: Map<string, any> = new Map();
  private config: AtomicSwapConfig;
  private nwcClient: nwc.NWCClient;
  private nwcConnectionString?: string;

  constructor(
    config: AtomicSwapConfig = createDefaultConfig(),
    nwcClientOrConnectionString: nwc.NWCClient | string
  ) {
    console.log("AtomicSwapsTool constructor - config:", {
      starknetRpcUrl: config.starknetRpcUrl,
      starknetAccountAddress: config.starknetAccountAddress,
      hasPrivateKey: !!config.starknetPrivateKey,
      bitcoinNetwork: config.bitcoinNetwork,
    });
    this.config = config;
    this.swapper = new AtomicSwapper(config);

    if (typeof nwcClientOrConnectionString === "string") {
      this.nwcConnectionString = nwcClientOrConnectionString;
      console.log(
        "AtomicSwapsTool creating NWC client from connection string:",
        this.nwcConnectionString?.substring(0, 50) + "..."
      );

      // Log the exact connection string and derived pubkey for debugging
      try {
        const url = new URL(this.nwcConnectionString);
        const secret = url.searchParams.get("secret");
        const relay = url.searchParams.get("relay");
        const pubkeyFromUrl = url.pathname.replace("//", "");

        if (secret) {
          try {
            const secretBytes = new Uint8Array(Buffer.from(secret, "hex"));
            const pubkeyBytes = schnorr.getPublicKey(secretBytes);
            const derivedPubkey = bytesToHex(pubkeyBytes);
            console.log(`[AtomicSwapsTool] Connection analysis:`);
            console.log(`  - Wallet pubkey from URL: ${pubkeyFromUrl}`);
            console.log(`  - Derived app pubkey: ${derivedPubkey}`);
            console.log(`  - Relay: ${relay}`);
            console.log(`  - Secret: ${secret.substring(0, 8)}...`);
          } catch (keyError) {
            console.warn(
              `[AtomicSwapsTool] Failed to derive pubkey from secret:`,
              keyError
            );
          }
        }
      } catch (parseError) {
        console.warn(
          `[AtomicSwapsTool] Failed to parse connection string:`,
          parseError
        );
      }

      this.nwcClient = new nwc.NWCClient({
        nostrWalletConnectUrl: this.nwcConnectionString,
      });
    } else {
      console.log("AtomicSwapsTool using passed NWC client");
      this.nwcClient = nwcClientOrConnectionString;
    }
  }

  /**
   * Initialize the atomic swaps tool
   */
  async initialize(): Promise<void> {
    console.log("[AtomicSwapsTool] Initializing...");
    await this.swapper.initialize();

    // If we created our own NWC client, give it time to connect
    if (this.nwcConnectionString) {
      console.log("[AtomicSwapsTool] Waiting for NWC client to connect...");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Reduced to 1 second

      // Test the connection with retries - but don't fail if it doesn't work
      let connected = false;
      const maxRetries = 2; // Reduced retries

      for (let i = 0; i < maxRetries; i++) {
        try {
          const info = await this.nwcClient.getInfo();
          console.log(
            `[AtomicSwapsTool] ✅ NWC client connected successfully after ${
              i + 1
            } attempts`
          );
          console.log(`[AtomicSwapsTool] Wallet info - alias: ${info.alias}`);
          connected = true;
          break;
        } catch (error) {
          console.warn(
            `[AtomicSwapsTool] ❌ NWC connection test attempt ${
              i + 1
            }/${maxRetries} failed:`,
            (error as Error).message
          );
          if (i < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500)); // Reduced wait time
          }
        }
      }

      if (!connected) {
        console.warn(
          "[AtomicSwapsTool] ⚠️ NWC client connection failed after all retries - will try again during actual operations"
        );
      }
    } else {
      console.log(
        "[AtomicSwapsTool] Using passed NWC client, testing connection..."
      );
      try {
        const info = await this.nwcClient.getInfo();
        console.log(
          `[AtomicSwapsTool] ✅ Passed NWC client working - alias: ${info.alias}`
        );
      } catch (error) {
        console.warn(
          "[AtomicSwapsTool] ❌ Passed NWC client connection test failed:",
          (error as Error).message
        );
        console.warn(
          "[AtomicSwapsTool] Will try to use NWC client during actual operations"
        );
      }
    }

    console.log("[AtomicSwapsTool] Initialization complete");
  }

  /**
   * Register the tool with MCP server
   */
  registerTool(server: McpServer): void {
    server.registerTool(
      "starknet_lightning_atomic_swaps",
      {
        title: "Starknet Lightning Atomic Swaps",
        description:
          "Execute trustless atomic swaps between Lightning Network and Starknet using AtomiqLabs",
        inputSchema: {
          action: z
            .enum([
              "quote",
              "execute",
              "swap",
              "status",
              "refund",
              "claim",
              "limits",
              "balance",
              "parse_address",
              "list_swaps",
            ])
            .describe("Action to perform"),

          // Common parameters
          direction: z
            .enum(["lightning_to_starknet", "starknet_to_lightning"])
            .describe("Direction of the swap")
            .optional(),

          // Quote and execute parameters
          amount: z
            .string()
            .describe(
              "Amount to swap (in human readable format, e.g., '0.001' for BTC or '1.5' for STRK)"
            )
            .optional(),
          exact_in: z
            .boolean()
            .describe(
              "Whether amount is exact input (true) or exact output (false)"
            )
            .default(true)
            .optional(),

          // Addresses
          lightning_invoice: z
            .string()
            .describe(
              "Lightning invoice for payment (for starknet_to_lightning)"
            )
            .optional(),
          lightning_address: z
            .string()
            .describe(
              "Lightning address or LNURL for payment (for starknet_to_lightning)"
            )
            .optional(),
          starknet_address: z
            .string()
            .describe(
              "Starknet address for receiving funds (for lightning_to_starknet)"
            )
            .optional(),

          // Swap management
          swap_id: z
            .string()
            .describe("Swap ID for status, refund, or claim operations")
            .optional(),

          // Options
          gas_amount: z
            .string()
            .describe("Gas amount for Starknet transactions (in STRK)")
            .optional(),
          comment: z
            .string()
            .describe("Comment for LNURL-pay payments")
            .optional(),
          auto_pay: z
            .boolean()
            .describe("Automatically pay Lightning invoices (default: true)")
            .default(true)
            .optional(),

          // Parse address
          address: z
            .string()
            .describe(
              "Address to parse (Lightning invoice, LNURL, Bitcoin address, etc.)"
            )
            .optional(),
        },
        outputSchema: {
          success: z.boolean(),
          message: z.string().optional(),
          data: z.any().optional(),
          error: z.any().optional(),
        },
      },
      async (params) => {
        try {
          console.log(
            "AtomicSwapsTool received params:",
            JSON.stringify(params, null, 2)
          );

          // Ensure swapper is initialized
          if (!this.swapper.isReady()) {
            console.log("Swapper not ready, initializing...");
            await this.initialize();
          }

          const result = await this.handleAction(params);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  result,
                  (key, value) =>
                    typeof value === "bigint" ? value.toString() : value,
                  2
                ),
              },
            ],
            structuredContent: JSON.parse(
              JSON.stringify(result, (key, value) =>
                typeof value === "bigint" ? value.toString() : value
              )
            ),
          };
        } catch (error) {
          console.error("AtomicSwapsTool error:", error);
          const errorResult = {
            success: false,
            error: {
              code: "OPERATION_FAILED",
              message: formatErrorMessage(
                error instanceof Error ? error : new Error(String(error))
              ),
              details: error instanceof Error ? { stack: error.stack } : {},
              recovery_suggestion: this.getRecoverySuggestion(
                error instanceof Error ? error : new Error(String(error))
              ),
            },
          };

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  errorResult,
                  (key, value) =>
                    typeof value === "bigint" ? value.toString() : value,
                  2
                ),
              },
            ],
            structuredContent: JSON.parse(
              JSON.stringify(errorResult, (key, value) =>
                typeof value === "bigint" ? value.toString() : value
              )
            ),
          };
        }
      }
    );
  }

  /**
   * Handle different actions
   */
  private async handleAction(params: any): Promise<any> {
    switch (params.action) {
      case "quote":
        return await this.handleQuote(params);
      case "execute":
        return await this.handleExecute(params);
      case "swap":
        return await this.handleSwap(params);
      case "status":
        return await this.handleStatus(params);
      case "refund":
        return await this.handleRefund(params);
      case "claim":
        return await this.handleClaim(params);
      case "limits":
        return await this.handleLimits(params);
      case "balance":
        return await this.handleBalance(params);
      case "parse_address":
        return await this.handleParseAddress(params);
      case "list_swaps":
        return await this.handleListSwaps(params);
      default:
        throw new Error(`Unknown action: ${params.action}`);
    }
  }

  /**
   * Handle quote creation
   */
  private async handleQuote(params: any): Promise<any> {
    if (!params.direction) {
      throw new Error("Direction is required for quote");
    }
    if (!params.amount) {
      throw new Error("Amount is required for quote");
    }

    const tokens = this.swapper.getAvailableTokens();
    let srcToken, dstToken, amount: bigint;
    let srcAddress, dstAddress;

    if (params.direction === "lightning_to_starknet") {
      srcToken = tokens.BITCOIN.BTCLN;
      dstToken = tokens.STARKNET.STRK;
      amount = humanReadableToSatoshis(params.amount);
      dstAddress = params.starknet_address || this.swapper.getStarknetAddress();
    } else {
      srcToken = tokens.STARKNET.STRK;
      dstToken = tokens.BITCOIN.BTCLN;
      amount = humanReadableToStarknetToken(params.amount);
      srcAddress = this.swapper.getStarknetAddress();
      dstAddress = params.lightning_invoice || params.lightning_address;

      if (!dstAddress) {
        throw new Error(
          "Lightning invoice or address is required for starknet_to_lightning"
        );
      }
    }

    const options: any = {};
    if (params.gas_amount) {
      options.gasAmount = humanReadableToStarknetToken(params.gas_amount);
    }
    if (params.comment) {
      options.comment = params.comment;
    }

    const swap = await this.swapper.createSwapQuote(
      srcToken,
      dstToken,
      amount,
      params.exact_in ?? true,
      srcAddress,
      dstAddress,
      options
    );

    // Store swap for future reference
    const swapId = swap.getId();
    this.activeSwaps.set(swapId, swap);

    const priceInfo = swap.getPriceInfo();

    return {
      success: true,
      message: "Quote created successfully",
      data: {
        id: swapId,
        direction: params.direction,
        input_amount: swap.getInputWithoutFee().toString(),
        output_amount: swap.getOutput().toString(),
        input_token:
          params.direction === "lightning_to_starknet" ? "BTC" : "STRK",
        output_token:
          params.direction === "lightning_to_starknet" ? "STRK" : "BTC",
        fee_amount: swap.getFee().amountInSrcToken.toString(),
        exchange_rate: priceInfo.swapPrice,
        expiry: swap.getQuoteExpiry(),
        security_deposit: swap.getSecurityDeposit?.()?.toString(),
        price_info: {
          swap_price: priceInfo.swapPrice,
          market_price: priceInfo.marketPrice,
          price_difference: priceInfo.difference,
        },
      },
    };
  }

  /**
   * Handle swap execution
   */
  private async handleExecute(params: any): Promise<any> {
    if (!params.swap_id) {
      throw new Error("Swap ID is required for execution");
    }

    const swap =
      this.activeSwaps.get(params.swap_id) ||
      (await this.swapper.getSwapById(params.swap_id));

    if (!swap) {
      throw new Error(`Swap with ID ${params.swap_id} not found`);
    }

    let result: any;
    const signer = this.swapper.getStarknetSigner();

    // Execute based on swap type
    if (params.direction === "lightning_to_starknet") {
      // For Lightning -> Starknet: we need to wait for Lightning payment
      result = {
        success: true,
        message:
          "Lightning invoice created. Please pay the invoice to complete the swap.",
        data: {
          swap_id: params.swap_id,
          state: formatSwapState(swap.getState()),
          lightning_invoice: swap.getAddress(),
          lightning_hyperlink: swap.getHyperlink(),
          next_steps: getNextSteps(swap.getState(), params.direction),
        },
      };
    } else {
      // For Starknet -> Lightning: commit the swap
      await swap.commit(signer);

      // Wait for payment to complete
      const paymentReceived = await swap.waitForPayment();

      if (paymentReceived) {
        result = {
          success: true,
          message: "Swap executed successfully",
          data: {
            swap_id: params.swap_id,
            state: formatSwapState(swap.getState()),
            lightning_payment_hash: swap.getSecret?.(),
            next_steps: getNextSteps(swap.getState(), params.direction),
          },
        };
      } else {
        result = {
          success: false,
          message: "Payment not received within timeout",
          data: {
            swap_id: params.swap_id,
            state: formatSwapState(swap.getState()),
            next_steps: getNextSteps(swap.getState(), params.direction),
          },
        };
      }
    }

    return result;
  }

  /**
   * Handle status checking
   */
  private async handleStatus(params: any): Promise<any> {
    if (!params.swap_id) {
      throw new Error("Swap ID is required for status check");
    }

    const swap =
      this.activeSwaps.get(params.swap_id) ||
      (await this.swapper.getSwapById(params.swap_id));

    if (!swap) {
      throw new Error(`Swap with ID ${params.swap_id} not found`);
    }

    const state = swap.getState();
    const direction = params.direction || "lightning_to_starknet";

    return {
      success: true,
      message: "Swap status retrieved",
      data: {
        swap_id: params.swap_id,
        state: formatSwapState(state),
        direction: direction,
        progress: {
          current_step: calculateSwapProgress(state, direction),
          total_steps: 100,
          step_description: getSwapStatusDescription(state, direction),
        },
        created_at: swap.getCreatedAt?.() || Date.now(),
        updated_at: Date.now(),
        can_refund: swap.canRefund?.() || false,
        can_claim: swap.canClaim?.() || false,
        error: state < 0 ? formatSwapState(state) : undefined,
      },
    };
  }

  /**
   * Handle refund operations
   */
  private async handleRefund(params: any): Promise<any> {
    if (!params.swap_id) {
      throw new Error("Swap ID is required for refund");
    }

    const swap =
      this.activeSwaps.get(params.swap_id) ||
      (await this.swapper.getSwapById(params.swap_id));

    if (!swap) {
      throw new Error(`Swap with ID ${params.swap_id} not found`);
    }

    const signer = this.swapper.getStarknetSigner();
    await swap.refund(signer);

    return {
      success: true,
      message: "Swap refunded successfully",
      data: {
        swap_id: params.swap_id,
        state: formatSwapState(swap.getState()),
        transaction_id: swap.getTransactionId?.(),
      },
    };
  }

  /**
   * Handle claim operations
   */
  private async handleClaim(params: any): Promise<any> {
    if (!params.swap_id) {
      throw new Error("Swap ID is required for claim");
    }

    const swap =
      this.activeSwaps.get(params.swap_id) ||
      (await this.swapper.getSwapById(params.swap_id));

    if (!swap) {
      throw new Error(`Swap with ID ${params.swap_id} not found`);
    }

    const signer = this.swapper.getStarknetSigner();

    if (swap.canCommit()) {
      await swap.commit(signer);
    }
    await swap.claim(signer);

    return {
      success: true,
      message: "Swap claimed successfully",
      data: {
        swap_id: params.swap_id,
        state: formatSwapState(swap.getState()),
        transaction_id: swap.getTransactionId?.(),
      },
    };
  }

  /**
   * Handle limits checking
   */
  private async handleLimits(params: any): Promise<any> {
    if (!params.direction) {
      throw new Error("Direction is required for limits check");
    }

    const tokens = this.swapper.getAvailableTokens();
    let srcToken, dstToken;

    if (params.direction === "lightning_to_starknet") {
      srcToken = tokens.BITCOIN.BTCLN;
      dstToken = tokens.STARKNET.STRK;
    } else {
      srcToken = tokens.STARKNET.STRK;
      dstToken = tokens.BITCOIN.BTCLN;
    }

    const limits = this.swapper.getSwapLimits(srcToken, dstToken);

    return {
      success: true,
      message: "Swap limits retrieved",
      data: {
        direction: params.direction,
        input_limits: {
          min: limits.input.min?.toString() || "0",
          max: limits.input.max?.toString() || "0",
          token: params.direction === "lightning_to_starknet" ? "BTC" : "STRK",
        },
        output_limits: {
          min: limits.output.min?.toString() || "0",
          max: limits.output.max?.toString() || "0",
          token: params.direction === "lightning_to_starknet" ? "STRK" : "BTC",
        },
      },
    };
  }

  /**
   * Handle balance checking
   */
  private async handleBalance(params: any): Promise<any> {
    const tokens = this.swapper.getAvailableTokens();
    const strkToken = tokens.STARKNET.STRK;

    const balance = await this.swapper.getSpendableBalance(strkToken);

    return {
      success: true,
      message: "Balance retrieved",
      data: {
        token: "STRK",
        balance: balance.toString(),
        spendable_balance: balance.toString(),
        human_readable_balance: starknetTokenToHumanReadable(balance),
        network: "starknet",
      },
    };
  }

  /**
   * Handle address parsing
   */
  private async handleParseAddress(params: any): Promise<any> {
    if (!params.address) {
      throw new Error("Address is required for parsing");
    }

    const parsed = await this.swapper.parseAddress(params.address);

    return {
      success: true,
      message: `Successfully parsed address of type: ${parsed.type}`,
      data: parsed,
    };
  }

  /**
   * Handle listing swaps
   */
  private async handleListSwaps(params: any): Promise<any> {
    const address = this.swapper.getStarknetAddress();

    const refundableSwaps = await this.swapper.getRefundableSwaps(address);
    const claimableSwaps = await this.swapper.getClaimableSwaps(address);

    return {
      success: true,
      message: `Found ${refundableSwaps.length} refundable and ${claimableSwaps.length} claimable swaps`,
      data: {
        refundable_swaps: refundableSwaps.map((swap: any) => ({
          id: swap.getId(),
          state: formatSwapState(swap.getState()),
          can_refund: true,
        })),
        claimable_swaps: claimableSwaps.map((swap: any) => ({
          id: swap.getId(),
          state: formatSwapState(swap.getState()),
          can_claim: true,
        })),
        active_swaps: Array.from(this.activeSwaps.keys()),
      },
    };
  }

  /**
   * Handle complete swap flow (quote + execute + monitor)
   */
  private async handleSwap(params: any): Promise<any> {
    if (!params.direction) {
      throw new Error("Direction is required for swap");
    }
    if (!params.amount) {
      throw new Error("Amount is required for swap");
    }

    console.log("Starting complete swap flow...");

    // Step 1: Create quote
    const quoteResult = await this.handleQuote(params);
    console.log("Quote result:", quoteResult);
    if (!quoteResult.success) {
      return quoteResult;
    }

    const swapId = quoteResult.data.id;
    console.log("Quote created successfully, swap ID:", swapId);

    // Step 2: Execute based on direction
    if (params.direction === "lightning_to_starknet") {
      return await this.handleLightningToStarknetSwap(swapId, params);
    } else {
      return await this.handleStarknetToLightningSwap(swapId, params);
    }
  }

  /**
   * Handle Lightning to Starknet swap flow
   */
  private async handleLightningToStarknetSwap(
    swapId: string,
    params: any
  ): Promise<any> {
    const swap = this.activeSwaps.get(swapId);
    if (!swap) {
      throw new Error(`Swap with ID ${swapId} not found`);
    }

    console.log("Executing Lightning to Starknet swap...");

    const lightningInvoice = swap.getAddress();
    console.log("Lightning invoice generated:", lightningInvoice);

    // If auto_pay is enabled, automatically pay the invoice
    if (params.auto_pay !== false) {
      try {
        console.log("[AtomicSwapsTool] Auto-paying Lightning invoice...");

        // Verify NWC client is still connected before payment
        try {
          const info = await this.nwcClient.getInfo();
          console.log(
            `[AtomicSwapsTool] ✅ NWC client verified before payment - alias: ${info.alias}`
          );
        } catch (error) {
          console.error(
            `[AtomicSwapsTool] ❌ NWC client verification failed before payment:`,
            (error as Error).message
          );
          return {
            success: false,
            message: `NWC client verification failed before payment: ${
              (error as Error).message
            }`,
            data: {
              swap_id: swapId,
              state: formatSwapState(swap.getState()),
              lightning_invoice: lightningInvoice,
              starknet_address: params.starknet_address,
              progress: calculateSwapProgress(
                swap.getState(),
                "lightning_to_starknet"
              ),
              status_description: getSwapStatusDescription(
                swap.getState(),
                "lightning_to_starknet"
              ),
              next_steps: [
                "Pay the invoice manually using your wallet",
                "Check your Lightning wallet balance",
                "Verify NWC connection is still active",
              ],
            },
          };
        }

        // Pay the invoice using NWC client (same pattern as working pay_invoice tool)
        let processedResult: any;
        try {
          // Get the amount from the swap object - handle BigInt safely
          const amountSatsBigInt = swap.getInputWithoutFee();
          const amountSats = parseInt(amountSatsBigInt.toString());
          const amountMillisats = amountSats * 1000;

          console.log("Payment details:", {
            invoice: lightningInvoice,
            amount_sats: amountSats,
            amount_millisats: amountMillisats,
          });

          const { fees_paid, preimage, ...paymentResult } =
            await this.nwcClient.payInvoice({
              invoice: lightningInvoice,
              amount: amountMillisats, // Amount in millisats like the working tool
              metadata: {
                swap_id: swapId,
                direction: "lightning_to_starknet",
                service: "atomiqlabs",
              },
            });

          console.log("Lightning invoice payment result:", {
            fees_paid,
            preimage,
            ...paymentResult,
          });

          // Create result object similar to working pay_invoice tool
          processedResult = {
            ...paymentResult,
            preimage: preimage || "", // Handle missing preimage like the working tool
            fees_paid_in_sats:
              typeof fees_paid === "number"
                ? Math.ceil(fees_paid / 1000)
                : undefined,
          };

          console.log("Lightning invoice paid successfully:", processedResult);
        } catch (nwcError) {
          console.error("NWC payment failed:", nwcError);
          // If NWC payment fails, still try to check if the swap progresses
          // as the payment might succeed externally
          processedResult = {
            preimage: "",
            fees_paid_in_sats: undefined,
            payment_error:
              nwcError instanceof Error ? nwcError.message : String(nwcError),
          };
          console.log(
            "Payment failed, will monitor swap for external payment:",
            processedResult
          );
        }

        console.log("Waiting for payment to be received...");

        try {
          // Use the SDK's built-in waitForPayment method (with timeout)
          const paymentReceived = await swap.waitForPayment();
          console.log("waitForPayment result:", paymentReceived);

          if (paymentReceived) {
            console.log("Payment received successfully");

            // Now commit and claim the swap following SDK pattern
            const signer = this.swapper.getStarknetSigner();

            console.log("Committing swap...");
            console.log("Signer address:", signer.getAddress());
            await swap.commit(signer);

            console.log("Claiming swap...");
            await swap.claim(signer);

            return {
              success: true,
              message: "Lightning to Starknet swap completed successfully",
              data: {
                swap_id: swapId,
                state: formatSwapState(swap.getState()),
                lightning_payment_hash: processedResult.preimage,
                transaction_id: swap.getTransactionId?.(),
                payment_result: processedResult,
                next_steps: [
                  "Swap completed successfully! STRK tokens should be in your wallet.",
                ],
              },
            };
          } else {
            console.log("Payment not received within timeout");
            return {
              success: false,
              message: "Payment not received within timeout period",
              data: {
                swap_id: swapId,
                state: formatSwapState(swap.getState()),
                lightning_payment_hash: processedResult.preimage,
                payment_result: processedResult,
                next_steps: [
                  "Check if payment was made",
                  "Try claiming manually if payment succeeded",
                ],
              },
            };
          }
        } catch (waitError) {
          console.error("Error waiting for payment:", waitError);

          // Fallback to manual state checking if waitForPayment fails
          console.log("Falling back to manual state monitoring...");

          const signer = this.swapper.getStarknetSigner();
          const maxAttempts = 60; // 60 seconds timeout
          let attempts = 0;

          while (attempts < maxAttempts) {
            const state = swap.getState();
            console.log(
              `Swap state check (${attempts + 1}/${maxAttempts}):`,
              formatSwapState(state)
            );

            // Check if the swap has progressed (state 1 = COMMITTED means payment received)
            if (state === 1) {
              console.log(
                "Swap state changed to COMMITTED - payment received by AtomiqLabs"
              );
            }

            if (state === 2 || state === 3) {
              // SOFT_CLAIMED or CLAIMED
              // Try to claim if not fully claimed
              if (state === 2) {
                try {
                  console.log("Attempting to claim swap...");
                  await swap.claim(signer);
                  console.log("Swap claimed successfully");
                } catch (error) {
                  console.warn("Claim attempt failed:", error);
                }
              }

              return {
                success: true,
                message: "Lightning to Starknet swap completed successfully",
                data: {
                  swap_id: swapId,
                  state: formatSwapState(swap.getState()),
                  lightning_payment_hash: processedResult.preimage,
                  transaction_id: swap.getTransactionId?.(),
                  payment_result: processedResult,
                  next_steps: [
                    "Swap completed successfully! STRK tokens should be in your wallet.",
                  ],
                },
              };
            }

            // Also check for negative states (failures)
            if (state < 0) {
              console.error(
                "Swap entered error state:",
                formatSwapState(state)
              );
              return {
                success: false,
                message: `Swap failed with state: ${formatSwapState(state)}`,
                data: {
                  swap_id: swapId,
                  state: formatSwapState(state),
                  lightning_payment_hash: processedResult.preimage,
                  payment_result: processedResult,
                  next_steps: ["Swap failed - check logs for details"],
                },
              };
            }

            await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second
            attempts++;
          }

          // If we get here, the swap didn't complete in time
          const isPaymentSuccessful =
            processedResult.preimage && processedResult.preimage !== "";
          const message = isPaymentSuccessful
            ? "Lightning payment successful but swap did not complete within timeout"
            : processedResult.payment_error
            ? `Lightning payment failed: ${processedResult.payment_error}. Swap may still complete if payment was made externally.`
            : "Swap monitoring timed out - check if payment was made externally";

          return {
            success: false,
            message,
            data: {
              swap_id: swapId,
              state: formatSwapState(swap.getState()),
              lightning_payment_hash: processedResult.preimage,
              payment_result: processedResult,
              next_steps: isPaymentSuccessful
                ? ["Check swap status or try claiming manually"]
                : [
                    "Pay the invoice manually if payment failed",
                    "Check swap status periodically",
                  ],
            },
          };
        }
      } catch (error) {
        console.error("Error paying Lightning invoice:", error);

        // Check if this is a payment verification failure
        if (
          error instanceof Error &&
          error.message.includes("no preimage received")
        ) {
          return {
            success: false,
            message:
              "Lightning payment verification failed - payment may not have been made",
            data: {
              swap_id: swapId,
              state: formatSwapState(swap.getState()),
              lightning_invoice: lightningInvoice,
              error_details: {
                type: "payment_verification_failed",
                message: error.message,
                suggestion:
                  "Payment may have failed - please check your Lightning wallet",
              },
              next_steps: [
                "Check your Lightning wallet for failed payments",
                "Verify you have sufficient balance (needed: ~300 sats)",
                "Try paying the invoice manually if needed",
              ],
            },
          };
        }

        return {
          success: false,
          message: `Failed to pay Lightning invoice: ${
            error instanceof Error ? error.message : String(error)
          }`,
          data: {
            swap_id: swapId,
            state: formatSwapState(swap.getState()),
            lightning_invoice: lightningInvoice,
            next_steps: [
              "Try paying the invoice manually",
              "Check your Lightning wallet balance",
            ],
          },
        };
      }
    }

    // If auto_pay is disabled, just return the invoice for manual payment
    return {
      success: true,
      message:
        "Lightning to Starknet swap initiated. Please pay the invoice to complete the swap.",
      data: {
        swap_id: swapId,
        state: formatSwapState(swap.getState()),
        lightning_invoice: lightningInvoice,
        lightning_hyperlink:
          swap.getHyperlink?.() || `lightning:${lightningInvoice}`,
        next_steps: [
          "Pay the Lightning invoice using your wallet",
          "The swap will automatically complete once payment is confirmed",
          "You will receive STRK tokens in your Starknet wallet",
        ],
        payment_required: true,
        invoice_details: {
          invoice: lightningInvoice,
          amount_sats: swap.getInputWithoutFee().toString(),
          expiry: swap.getQuoteExpiry(),
        },
      },
    };
  }

  /**
   * Handle Starknet to Lightning swap flow
   */
  private async handleStarknetToLightningSwap(
    swapId: string,
    params: any
  ): Promise<any> {
    const swap = this.activeSwaps.get(swapId);
    if (!swap) {
      throw new Error(`Swap with ID ${swapId} not found`);
    }

    console.log("Executing Starknet to Lightning swap...");

    try {
      const signer = this.swapper.getStarknetSigner();

      console.log("Signer address:", signer.getAddress());
      // Commit the swap on Starknet
      console.log("Committing swap on Starknet...");
      await swap.commit(signer);

      // Wait for Lightning payment to complete
      console.log("Waiting for Lightning payment to complete...");
      const paymentReceived = await swap.waitForPayment();

      if (paymentReceived) {
        return {
          success: true,
          message: "Starknet to Lightning swap completed successfully",
          data: {
            swap_id: swapId,
            state: formatSwapState(swap.getState()),
            lightning_payment_hash: swap.getSecret?.(),
            transaction_id: swap.getTransactionId?.(),
            next_steps: ["Swap completed successfully"],
          },
        };
      } else {
        return {
          success: false,
          message: "Lightning payment not received within timeout",
          data: {
            swap_id: swapId,
            state: formatSwapState(swap.getState()),
            next_steps: ["Try refunding the swap if it failed"],
          },
        };
      }
    } catch (error) {
      console.error("Error in Starknet to Lightning swap:", error);
      return {
        success: false,
        message: `Swap failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
        data: {
          swap_id: swapId,
          state: formatSwapState(swap.getState()),
          next_steps: ["Try refunding the swap if it failed"],
        },
      };
    }
  }

  /**
   * Get recovery suggestion for errors
   */
  private getRecoverySuggestion(error: Error): string {
    const message = error.message;

    if (message.includes("not initialized")) {
      return "Ensure all required environment variables are set (STARKNET_PRIVATE_KEY, STARKNET_ACCOUNT_ADDRESS, etc.)";
    }

    if (message.includes("insufficient")) {
      return "Check your balance and ensure you have enough funds for the swap";
    }

    if (message.includes("expired")) {
      return "Create a new swap quote as the current one has expired";
    }

    if (message.includes("network")) {
      return "Check your network connection and try again";
    }

    return "Please check the error details and try again";
  }
}

/**
 * Register the atomic swaps tool with the MCP server
 */
export function registerAtomicSwapsTool(
  server: McpServer,
  nwcClientOrConnectionString: nwc.NWCClient | string
): void {
  try {
    console.log("Registering atomic swaps tool...");
    const tool = new AtomicSwapsTool(
      createDefaultConfig(),
      nwcClientOrConnectionString
    );
    tool.registerTool(server);
    console.log("Atomic swaps tool registered successfully");
  } catch (error) {
    console.error("Error registering atomic swaps tool:", error);
    throw error;
  }
}
