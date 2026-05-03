import { NextRequest, NextResponse } from "next/server";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import {
  setupWallet,
  deriveCredentials,
  checkCredentialsStatus,
} from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";
import {
  verifyPrivyToken,
  isValidEthereumAddress,
  resolvePrivyEmail,
} from "@/lib/trading-wallet/privy-server";
import {
  createWalletForExistingUser,
  ensureWalletPolicy,
  getUserWallet,
  isServerSigningConfigured,
} from "@/lib/trading-wallet/server-wallet";
import { DEFAULT_TRADING_CHAIN_ID } from "@/lib/trading-wallet/constants";
import { PrivyClient } from "@privy-io/node";

// Lazy initialization of Privy client
let _privyClient: PrivyClient | null = null;

function getPrivyClient(): PrivyClient {
  if (!_privyClient) {
    const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
    const appSecret = process.env.PRIVY_APP_SECRET;
    if (!appId || !appSecret) {
      throw new Error("Missing Privy configuration");
    }
    _privyClient = new PrivyClient({ appId, appSecret });
  }
  return _privyClient;
}

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

    // Step 1: Verify Privy token
    console.log("[Ensure Credentials] Verifying Privy token...");
    const verifiedUser = await verifyPrivyToken(privyAuthToken);

    if (!verifiedUser) {
      console.error("[Ensure Credentials] Failed to verify Privy token");
      return NextResponse.json(
        { error: "Invalid authentication token", ready: false },
        { status: 401 }
      );
    }

    const privyUserId = verifiedUser.userId;
    console.log("[Ensure Credentials] Token verified for user:", privyUserId);

    // Step 1.5: Get user details from Privy (use _get with user ID for server-side queries)
    const privy = getPrivyClient();
    const privyUser = await privy.users()._get(privyUserId);

    // Resolve email by latest_verified_at across linked accounts so a Privy
    // user with multiple identities (e.g. old direct-email + newer Google OAuth)
    // maps to the most recently authenticated one.
    const email = resolvePrivyEmail(
      privyUser as unknown as { id: string; linked_accounts: Array<{ type: string; [k: string]: unknown }> }
    );
    console.log("[Ensure Credentials] Resolved email:", email);

    // Step 2: Check if user already has an embedded wallet, or create one server-side
    let embeddedWalletAddress: string;
    let privyWalletId: string | null = null;
    let hasServerSigner = false;
    let policyId: string | null = null;
    let serverSignerId: string | null = null;

    // Find existing embedded wallet
    const existingWallet = privyUser.linked_accounts.find(
      (account) =>
        account.type === "wallet" &&
        "wallet_client_type" in account &&
        account.wallet_client_type === "privy" &&
        "chain_type" in account &&
        account.chain_type === "ethereum"
    );

    if (existingWallet && "address" in existingWallet) {
      // User already has an embedded wallet (legacy, previously created,
      // or auto-provisioned by Privy during OAuth despite createOnLogin:"off").
      embeddedWalletAddress = existingWallet.address as string;
      privyWalletId = "wallet_id" in existingWallet ? (existingWallet.wallet_id as string) : null;
      console.log("[Ensure Credentials] Found existing embedded wallet:", embeddedWalletAddress);

      // Auto-provisioned wallets have no trading policy attached. Attach it now
      // so server-side signing works. Idempotent for already-configured wallets.
      if (privyWalletId && isServerSigningConfigured()) {
        try {
          const ensured = await ensureWalletPolicy(privyUserId, privyWalletId);
          hasServerSigner = true;
          policyId = ensured.policyId;
          serverSignerId = ensured.serverSignerId;
          console.log("[Ensure Credentials] Ensured wallet policy:", {
            walletId: privyWalletId,
            policyId,
            alreadyConfigured: ensured.alreadyConfigured,
          });
        } catch (error) {
          console.error("[Ensure Credentials] Failed to attach policy to existing wallet:", error);
          return NextResponse.json(
            { error: "Failed to configure trading wallet policy", ready: false },
            { status: 500 }
          );
        }
      } else if (!privyWalletId) {
        console.warn("[Ensure Credentials] Existing wallet has no wallet_id, cannot attach policy");
      }
    } else {
      // No wallet exists - create one server-side with policy
      console.log("[Ensure Credentials] No embedded wallet found, creating server-side...");

      if (!isServerSigningConfigured()) {
        console.error("[Ensure Credentials] Server signing not configured");
        return NextResponse.json(
          { error: "Server signing not configured. Please contact support.", ready: false },
          { status: 500 }
        );
      }

      try {
        const newWallet = await createWalletForExistingUser(privyUserId);
        embeddedWalletAddress = newWallet.address;
        privyWalletId = newWallet.walletId;
        hasServerSigner = true;
        policyId = newWallet.policyId;
        serverSignerId = process.env.PRIVY_AUTHORIZATION_KEY_ID || null;
        console.log("[Ensure Credentials] Created server wallet:", {
          address: embeddedWalletAddress,
          walletId: privyWalletId,
          policyId,
        });
      } catch (error) {
        console.error("[Ensure Credentials] Failed to create server wallet:", error);
        return NextResponse.json(
          { error: "Failed to create trading wallet", ready: false },
          { status: 500 }
        );
      }
    }

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

    // Step 2: Find or create user in database. Prefer privyUserId lookup — it's
    // the stable identity across email/OAuth re-links. Fall back to email for
    // users created before privyUserId was tracked.
    console.log("[Ensure Credentials] Finding or creating user in database...");
    let user = await db.user.findUnique({
      where: { privyUserId },
      include: { tradingWallet: true },
    });

    if (!user) {
      user = await db.user.findUnique({
        where: { email },
        include: { tradingWallet: true },
      });
    }

    if (!user) {
      console.log("[Ensure Credentials] User not found, creating...");
      user = await db.user.create({
        data: {
          email,
          privyUserId,
          name: email.split("@")[0],
        },
        include: { tradingWallet: true },
      });
      console.log("[Ensure Credentials] Created user:", user.id);
    } else if (user.privyUserId !== privyUserId || user.email !== email) {
      // Backfill privyUserId on legacy rows and pick up email changes
      // (e.g. user re-linked Google with a different address).
      user = await db.user.update({
        where: { id: user.id },
        data: { privyUserId, email },
        include: { tradingWallet: true },
      });
      console.log("[Ensure Credentials] Updated user identity:", {
        id: user.id,
        privyUserId,
        email,
      });
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
        // Create new trading wallet with server signing info if available
        tradingWallet = await db.tradingWallet.create({
          data: {
            userId: user.id,
            privyWalletId: privyWalletId || embeddedWalletAddress,
            address: embeddedWalletAddress,
            chainId: DEFAULT_TRADING_CHAIN_ID,
            status: "ACTIVE",
            hasServerSigner,
            policyId,
            serverSignerId,
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
              hasServerSigner,
              policyId,
            }),
            entityType: "TradingWallet",
            entityId: tradingWallet.id,
            logHash: `tw-ensure-${tradingWallet.id}-${Date.now()}`,
          },
        });

        console.log("[Ensure Credentials] Created trading wallet:", {
          id: tradingWallet.id,
          hasServerSigner,
        });
      }
    } else {
      console.log("[Ensure Credentials] Trading wallet already exists:", tradingWallet.id);

      // Reconcile address with Privy (source of truth) — handles the case where
      // Privy's embedded wallet for this user has changed since the DB row was
      // created. Without this, the DB row would silently hold a stale address.
      const dbAddrLower = tradingWallet.address.toLowerCase();
      const privyAddrLower = embeddedWalletAddress.toLowerCase();
      if (dbAddrLower !== privyAddrLower) {
        const conflictingRow = await db.tradingWallet.findUnique({
          where: { address: embeddedWalletAddress },
        });
        if (conflictingRow && conflictingRow.userId !== user.id) {
          console.error("[Ensure Credentials] Cannot reconcile address: target held by another user", {
            ourUserId: user.id,
            targetAddress: embeddedWalletAddress,
            heldByUserId: conflictingRow.userId,
          });
          return NextResponse.json(
            { error: "Wallet already registered to another account", ready: false },
            { status: 409 }
          );
        }
        if (conflictingRow && conflictingRow.id !== tradingWallet.id) {
          // Same user, stale duplicate row — drop it before updating
          await db.tradingWallet.delete({ where: { id: conflictingRow.id } });
        }
        tradingWallet = await db.tradingWallet.update({
          where: { id: tradingWallet.id },
          data: {
            address: embeddedWalletAddress,
            privyWalletId: privyWalletId || embeddedWalletAddress,
          },
        });
        console.log("[Ensure Credentials] Reconciled wallet address:", {
          from: dbAddrLower,
          to: privyAddrLower,
        });
      }

      // Backfill policy fields on the DB row if we just attached them in Privy
      // but the DB record predates the fix (policyId=null, hasServerSigner=false).
      if (hasServerSigner && policyId && !tradingWallet.hasServerSigner) {
        tradingWallet = await db.tradingWallet.update({
          where: { id: tradingWallet.id },
          data: { hasServerSigner: true, policyId, serverSignerId },
        });
        console.log("[Ensure Credentials] Backfilled policy fields on existing wallet:", tradingWallet.id);
      } else {
        hasServerSigner = tradingWallet.hasServerSigner;
      }
    }

    // For wallets without server signing, skip Vaulto API credential setup
    // These wallets use client-side signing and don't need server credentials
    if (!hasServerSigner) {
      console.log("[Ensure Credentials] Wallet uses client-side signing, skipping Vaulto API setup. Done!");
      return NextResponse.json({ ready: true });
    }

    // Step 4: Check credentials status on Vaulto API (only for server-signed wallets)
    console.log("[Ensure Credentials] Checking credentials status on Vaulto API...");
    const apiKey = getVaultoApiToken();

    // Check if force re-derivation is requested via query param or header
    const forceRederive = request.nextUrl.searchParams.get("force") === "true" ||
                          request.headers.get("x-force-rederive") === "true";

    if (!forceRederive) {
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
    } else {
      console.log("[Ensure Credentials] Force re-derivation requested, skipping credentials check");
    }

    // Step 5: Set up wallet on Vaulto API with retry logic
    // The signer setup can be async, so we may need to retry
    const MAX_SETUP_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;
    let signerSetupComplete = false;

    for (let attempt = 1; attempt <= MAX_SETUP_RETRIES; attempt++) {
      console.log(`[Ensure Credentials] Setting up wallet on Vaulto API (attempt ${attempt}/${MAX_SETUP_RETRIES})...`);
      try {
        // Pass wallet address so Vaulto API can associate credentials with this wallet
        const walletResult = await setupWallet(apiKey, privyAuthToken, embeddedWalletAddress);
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
        // Pass wallet address so Vaulto API can associate credentials with this wallet
        const credResult = await deriveCredentials(apiKey, privyAuthToken, embeddedWalletAddress);
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
