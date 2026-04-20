import { NextRequest, NextResponse } from "next/server";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import {
  setupWallet,
  deriveCredentials,
  checkCredentialsStatus,
} from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";
import {
  verifyPrivyTokenAndGetUserWithWallet,
  isValidEthereumAddress,
} from "@/lib/trading-wallet/privy-server";
import { DEFAULT_TRADING_CHAIN_ID } from "@/lib/trading-wallet/constants";

/**
 * POST /api/trading/ensure-credentials
 *
 * Unified endpoint that atomically ensures trading credentials are set up.
 * This handles the full flow:
 * 1. Verify Privy auth token
 * 2. Extract embedded wallet address from Privy user data
 * 3. Create trading wallet in DB if it doesn't exist (upsert)
 * 4. Check credentials status on Vaulto API
 * 5. Set up wallet + derive credentials if needed
 * 6. Return success/ready status
 *
 * This solves the race condition where credential setup fails because
 * the trading wallet doesn't exist yet in the database.
 */
export async function POST(request: NextRequest) {
  try {
    // Check Vaulto API configuration
    if (!isVaultoApiConfigured()) {
      console.error("[Ensure Credentials] Vaulto API not configured");
      return NextResponse.json(
        { error: "Trading not configured", ready: false },
        { status: 500 }
      );
    }

    // Get Privy auth token from request headers
    const privyAuthToken = request.headers.get("x-privy-token");
    if (!privyAuthToken) {
      return NextResponse.json(
        { error: "Privy authentication token required", ready: false },
        { status: 400 }
      );
    }

    // Step 1: Verify Privy token and extract user info + embedded wallet
    console.log("[Ensure Credentials] Verifying Privy token and extracting user info...");
    const privyUser = await verifyPrivyTokenAndGetUserWithWallet(privyAuthToken);

    if (!privyUser) {
      console.error("[Ensure Credentials] Failed to verify Privy token or extract wallet");
      return NextResponse.json(
        { error: "Invalid authentication token or missing embedded wallet", ready: false },
        { status: 401 }
      );
    }

    const { email, embeddedWalletAddress } = privyUser;
    console.log("[Ensure Credentials] User verified:", { email, embeddedWalletAddress });

    // Validate wallet address format
    if (!isValidEthereumAddress(embeddedWalletAddress)) {
      console.error("[Ensure Credentials] Invalid embedded wallet address:", embeddedWalletAddress);
      return NextResponse.json(
        { error: "Invalid embedded wallet address", ready: false },
        { status: 400 }
      );
    }

    // Check database
    const dbError = requireDatabase();
    if (dbError) return dbError;

    const db = getDb();

    // Step 2: Find or create user in database
    console.log("[Ensure Credentials] Finding or creating user in database...");
    let user = await db.user.findUnique({
      where: { email },
      include: { tradingWallet: true },
    });

    if (!user) {
      console.log("[Ensure Credentials] User not found, creating...");
      user = await db.user.create({
        data: {
          email,
          name: email.split("@")[0],
        },
        include: { tradingWallet: true },
      });
      console.log("[Ensure Credentials] Created user:", user.id);
    }

    // Step 3: Create trading wallet in DB if it doesn't exist
    let tradingWallet = user.tradingWallet;

    if (!tradingWallet) {
      console.log("[Ensure Credentials] No trading wallet found, creating...");

      // Check if this wallet address already exists for another user
      const existingWallet = await db.tradingWallet.findUnique({
        where: { address: embeddedWalletAddress },
      });

      if (existingWallet) {
        if (existingWallet.userId === user.id) {
          // Wallet exists for this user (edge case - should have been in the include)
          tradingWallet = existingWallet;
          console.log("[Ensure Credentials] Found existing wallet for user");
        } else {
          // Wallet belongs to a different user - error
          console.error("[Ensure Credentials] Wallet address belongs to different user:", {
            address: embeddedWalletAddress,
            existingUserId: existingWallet.userId,
            requestingUserId: user.id,
          });
          return NextResponse.json(
            { error: "Wallet already registered to another account", ready: false },
            { status: 409 }
          );
        }
      } else {
        // Create new trading wallet
        tradingWallet = await db.tradingWallet.create({
          data: {
            userId: user.id,
            privyWalletId: embeddedWalletAddress,
            address: embeddedWalletAddress,
            chainId: DEFAULT_TRADING_CHAIN_ID,
            status: "ACTIVE",
          },
        });

        // Create audit log
        await db.auditLog.create({
          data: {
            userId: user.id,
            action: "TRADING_WALLET_CREATED",
            details: JSON.stringify({
              tradingWalletId: tradingWallet.id,
              address: tradingWallet.address,
              chainId: tradingWallet.chainId,
              source: "ensure-credentials",
            }),
            entityType: "TradingWallet",
            entityId: tradingWallet.id,
            logHash: `tw-ensure-${tradingWallet.id}-${Date.now()}`,
          },
        });

        console.log("[Ensure Credentials] Created trading wallet:", tradingWallet.id);
      }
    } else {
      console.log("[Ensure Credentials] Trading wallet already exists:", tradingWallet.id);
    }

    // Step 4: Check credentials status on Vaulto API
    console.log("[Ensure Credentials] Checking credentials status on Vaulto API...");
    const apiKey = getVaultoApiToken();

    try {
      const credStatus = await checkCredentialsStatus(apiKey, tradingWallet.address);
      console.log("[Ensure Credentials] Credentials status:", credStatus);

      if (credStatus.hasCredentials) {
        console.log("[Ensure Credentials] Credentials already configured, done!");
        return NextResponse.json({ ready: true });
      }
    } catch (error) {
      // If credentials check fails, assume no credentials and try to set up
      console.log("[Ensure Credentials] Credentials check failed, will try to set up:", error);
    }

    // Step 5: Set up wallet on Vaulto API with retry logic
    // The signer setup can be async, so we may need to retry
    const MAX_SETUP_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;
    let signerSetupComplete = false;

    for (let attempt = 1; attempt <= MAX_SETUP_RETRIES; attempt++) {
      console.log(`[Ensure Credentials] Setting up wallet on Vaulto API (attempt ${attempt}/${MAX_SETUP_RETRIES})...`);
      try {
        const walletResult = await setupWallet(apiKey, privyAuthToken);
        console.log("[Ensure Credentials] Wallet setup result:", walletResult);

        if (!walletResult.success) {
          console.error("[Ensure Credentials] Wallet setup failed:", walletResult.error);
          return NextResponse.json(
            { error: walletResult.error || "Failed to setup wallet on trading API", ready: false },
            { status: 400 }
          );
        }

        // Check if signer setup is complete
        // The response may include wallet.signerSetupComplete or similar
        const wallet = (walletResult as { wallet?: { signerSetupComplete?: boolean } }).wallet;
        signerSetupComplete = wallet?.signerSetupComplete ?? true; // Assume complete if not specified

        if (signerSetupComplete) {
          console.log("[Ensure Credentials] Signer setup complete");
          break;
        }

        // Signer setup not complete, wait and retry
        if (attempt < MAX_SETUP_RETRIES) {
          console.log(`[Ensure Credentials] Signer setup not complete, waiting ${RETRY_DELAY_MS}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
      } catch (error) {
        console.error("[Ensure Credentials] Wallet setup threw error:", error);
        if (attempt === MAX_SETUP_RETRIES) {
          return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to setup wallet", ready: false },
            { status: 500 }
          );
        }
        // Wait before retry on error
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    // Step 6: Derive credentials with retry logic
    const MAX_DERIVE_RETRIES = 3;
    for (let attempt = 1; attempt <= MAX_DERIVE_RETRIES; attempt++) {
      console.log(`[Ensure Credentials] Deriving credentials on Vaulto API (attempt ${attempt}/${MAX_DERIVE_RETRIES})...`);
      try {
        const credResult = await deriveCredentials(apiKey, privyAuthToken);
        console.log("[Ensure Credentials] Derive credentials result:", credResult);

        if (credResult.success) {
          console.log("[Ensure Credentials] All done! Credentials are ready.");
          return NextResponse.json({ ready: true });
        }

        // If we get here with success: false, log and retry
        console.warn("[Ensure Credentials] Derive credentials returned success: false:", credResult.error);
        if (attempt === MAX_DERIVE_RETRIES) {
          return NextResponse.json(
            { error: credResult.error || "Failed to derive trading credentials", ready: false },
            { status: 400 }
          );
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Unknown error";
        console.error(`[Ensure Credentials] Derive credentials attempt ${attempt} threw error:`, errorMsg);

        // Check if this is the "No valid authorization keys" error - this means signer isn't ready
        if (errorMsg.includes("authorization keys") || errorMsg.includes("signing keys")) {
          if (attempt < MAX_DERIVE_RETRIES) {
            console.log(`[Ensure Credentials] Signer may not be ready, waiting ${RETRY_DELAY_MS}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            continue;
          }
        }

        if (attempt === MAX_DERIVE_RETRIES) {
          return NextResponse.json(
            { error: errorMsg, ready: false },
            { status: 500 }
          );
        }
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
      }
    }

    // If we get here, all retries failed
    return NextResponse.json(
      { error: "Failed to derive credentials after multiple attempts", ready: false },
      { status: 500 }
    );
  } catch (error) {
    console.error("[Ensure Credentials] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to ensure credentials", ready: false },
      { status: 500 }
    );
  }
}
