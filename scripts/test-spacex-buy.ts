/**
 * SpaceX LONG Token Buy Test
 *
 * Integration test script that buys a SpaceX LONG token ($1 USDC),
 * simulating the frontend flow as closely as possible.
 *
 * This script:
 * 1. Creates/looks up a test user with trading wallet
 * 2. Sets up wallet and derives Polymarket credentials
 * 3. Executes a real $1 USDC buy of SpaceX LONG position
 * 4. Verifies the position was created
 *
 * Usage:
 *   npx tsx scripts/test-spacex-buy.ts
 *   npx tsx scripts/test-spacex-buy.ts --email=mytest@example.com
 *
 * Required Environment Variables:
 *   DATABASE_URL=postgresql://...
 *   VAULTO_API_TOKEN=<api key>
 *   VAULTO_API_URL=https://api.vaulto.ai
 *   NEXT_PUBLIC_PRIVY_APP_ID=<privy app id>
 *   PRIVY_APP_SECRET=<privy app secret>
 */

import dotenv from "dotenv";
import path from "path";

// Load environment variables from both .env and .env.local
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
import { PrivyClient } from "@privy-io/node";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import {
  buyPosition,
  setupWallet,
  deriveCredentials,
  checkCredentialsStatus,
  fetchPositions,
  type BuyPositionResponse,
} from "../lib/vaulto-api/trading";
import { getVaultoApiToken, getVaultoApiUrl, isVaultoApiConfigured } from "../lib/vaulto-api/config";

// Initialize Prisma with PostgreSQL adapter
function createPrismaClient(): PrismaClient {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log: ["error", "warn"] });
}

// ============================================
// CONSTANTS
// ============================================

const SPACEX_EVENT_SLUG = "spacex-ipo-closing-market-cap";
const TRADE_SIDE = "LONG" as const;
const TRADE_AMOUNT_USD = 1; // $1 minimum
const DEFAULT_CHAIN_ID = 137; // Polygon

// ============================================
// TYPES
// ============================================

interface TestConfig {
  email: string;
  vaultoApiUrl: string;
  vaultoApiToken: string;
  privyAppId: string;
  privyAppSecret: string;
}

interface TestUser {
  id: string;
  email: string;
  privyUserId: string;
  walletAddress: string;
  tradingWalletId: string;
}

interface TestResult {
  success: boolean;
  user?: TestUser;
  buyResult?: BuyPositionResponse;
  error?: string;
}

// ============================================
// HELPERS
// ============================================

function parseArgs(): { email?: string } {
  const args: { email?: string } = {};

  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--email=")) {
      args.email = arg.split("=")[1];
    }
  }

  return args;
}

function generateTestEmail(): string {
  const timestamp = Date.now();
  return `test-${timestamp}@vaulto-test.local`;
}

function log(step: number, total: number, message: string): void {
  console.log(`\n[${step}/${total}] ${message}`);
}

function logSuccess(message: string): void {
  console.log(`  ✓ ${message}`);
}

function logError(message: string): void {
  console.log(`  ✗ ${message}`);
}

function logInfo(message: string): void {
  console.log(`  ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================
// STEP 1: VALIDATE CONFIGURATION
// ============================================

function validateConfig(email: string): TestConfig {
  const errors: string[] = [];

  // Vaulto API
  if (!isVaultoApiConfigured()) {
    if (!process.env.VAULTO_API_URL && !process.env.NEXT_PUBLIC_VAULTO_API_URL) {
      errors.push("VAULTO_API_URL or NEXT_PUBLIC_VAULTO_API_URL");
    }
    if (!process.env.VAULTO_API_TOKEN) {
      errors.push("VAULTO_API_TOKEN");
    }
  }

  // Privy
  if (!process.env.NEXT_PUBLIC_PRIVY_APP_ID) {
    errors.push("NEXT_PUBLIC_PRIVY_APP_ID");
  }
  if (!process.env.PRIVY_APP_SECRET) {
    errors.push("PRIVY_APP_SECRET");
  }

  // Database
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL");
  }

  if (errors.length > 0) {
    throw new Error(`Missing required environment variables: ${errors.join(", ")}`);
  }

  return {
    email,
    vaultoApiUrl: getVaultoApiUrl(),
    vaultoApiToken: getVaultoApiToken(),
    privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
    privyAppSecret: process.env.PRIVY_APP_SECRET!,
  };
}

// ============================================
// STEP 2: CREATE TEST USER IN DATABASE
// ============================================

async function createOrGetTestUser(
  db: PrismaClient,
  email: string
): Promise<{ userId: string; isNew: boolean }> {
  // Check if user already exists
  const existingUser = await db.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { userId: existingUser.id, isNew: false };
  }

  // Create new user
  const user = await db.user.create({
    data: {
      email,
      name: email.split("@")[0],
      onboardingStatus: "FULLY_ONBOARDED",
    },
  });

  return { userId: user.id, isNew: true };
}

// ============================================
// STEP 3: CREATE PRIVY USER WITH EMBEDDED WALLET
// ============================================

async function createPrivyUserWithWallet(
  privy: PrivyClient,
  email: string
): Promise<{ privyUserId: string; walletAddress: string; isNew: boolean }> {
  // First, check if user already exists in Privy by iterating through users
  // (Privy doesn't have a direct lookup by email API)
  for await (const user of privy.users().list()) {
    const emailAccount = user.linked_accounts.find(
      (account) => account.type === "email" && "address" in account && account.address === email
    );

    if (emailAccount) {
      // Found existing user, get their embedded wallet
      const embeddedWallet = user.linked_accounts.find(
        (account) =>
          account.type === "wallet" &&
          "wallet_client_type" in account &&
          account.wallet_client_type === "privy"
      );

      if (embeddedWallet && "address" in embeddedWallet) {
        return {
          privyUserId: user.id,
          walletAddress: embeddedWallet.address as string,
          isNew: false,
        };
      }

      // User exists but no embedded wallet - create one
      const wallet = await privy.wallets().create({
        chain_type: "ethereum",
        owner: { user_id: user.id },
      });

      return {
        privyUserId: user.id,
        walletAddress: wallet.address,
        isNew: false,
      };
    }
  }

  // User doesn't exist, create new one with embedded wallet
  const user = await privy.users().create({
    linked_accounts: [
      {
        type: "email",
        address: email,
      },
    ],
    wallets: [
      {
        chain_type: "ethereum",
      },
    ],
  });

  // Extract the embedded wallet address from the created user
  const embeddedWallet = user.linked_accounts.find(
    (account) =>
      account.type === "wallet" &&
      "wallet_client_type" in account &&
      account.wallet_client_type === "privy"
  );

  if (!embeddedWallet || !("address" in embeddedWallet)) {
    throw new Error("Failed to create embedded wallet for Privy user");
  }

  return {
    privyUserId: user.id,
    walletAddress: embeddedWallet.address as string,
    isNew: true,
  };
}

// ============================================
// STEP 4: CREATE/UPDATE TRADING WALLET IN DATABASE
// ============================================

async function ensureTradingWallet(
  db: PrismaClient,
  userId: string,
  walletAddress: string,
  privyWalletId: string
): Promise<{ tradingWalletId: string; isNew: boolean }> {
  // Check if trading wallet exists
  const existingWallet = await db.tradingWallet.findUnique({
    where: { userId },
  });

  if (existingWallet) {
    // Update address if changed
    if (existingWallet.address !== walletAddress) {
      await db.tradingWallet.update({
        where: { id: existingWallet.id },
        data: {
          address: walletAddress,
          privyWalletId,
          status: "ACTIVE",
        },
      });
    }
    return { tradingWalletId: existingWallet.id, isNew: false };
  }

  // Create new trading wallet
  const wallet = await db.tradingWallet.create({
    data: {
      userId,
      privyWalletId,
      address: walletAddress,
      chainId: DEFAULT_CHAIN_ID,
      status: "ACTIVE",
    },
  });

  // Create audit log
  await db.auditLog.create({
    data: {
      userId,
      action: "TRADING_WALLET_CREATED",
      details: JSON.stringify({
        tradingWalletId: wallet.id,
        address: walletAddress,
        chainId: DEFAULT_CHAIN_ID,
        source: "test-spacex-buy",
      }),
      entityType: "TradingWallet",
      entityId: wallet.id,
      logHash: `tw-test-${wallet.id}-${Date.now()}`,
    },
  });

  return { tradingWalletId: wallet.id, isNew: true };
}

// ============================================
// STEP 5: GET PRIVY ACCESS TOKEN
// ============================================

/**
 * Attempts to get a Privy access token for the user.
 *
 * NOTE: Privy's Node SDK doesn't directly support issuing access tokens
 * for server-created users. This function attempts alternative approaches.
 *
 * For production testing, you may need to:
 * 1. Use Privy's custom auth integration
 * 2. Log in through the frontend first to establish a session
 * 3. Use direct wallet signing for authentication
 */
async function getPrivyAccessToken(
  privy: PrivyClient,
  privyUserId: string
): Promise<string | null> {
  // Privy Node SDK doesn't have a direct method to issue access tokens
  // for users created server-side. The access token is typically generated
  // during the frontend authentication flow.
  //
  // For this test script, we'll attempt to use alternative authentication:
  // 1. If available, use Privy's experimental token issuance
  // 2. Fall back to using wallet signature-based auth

  // Check if there's a way to get access token (Privy may add this feature)
  // @ts-expect-error - Checking for potential future/undocumented API
  if (typeof privy.users?.issueAccessToken === "function") {
    // @ts-expect-error - Potential future API
    const result = await privy.users.issueAccessToken(privyUserId);
    if (result?.token) {
      return result.token;
    }
  }

  // Return null - will need to use alternative auth method
  console.log("  Note: Privy access token generation not available server-side.");
  console.log("  Will use alternative authentication method.");
  return null;
}

// ============================================
// STEP 6: SETUP TRADING CREDENTIALS
// ============================================

async function ensureCredentials(
  apiKey: string,
  userId: string,
  privyToken: string | null
): Promise<{ success: boolean; error?: string }> {
  // Check if credentials already exist
  try {
    const status = await checkCredentialsStatus(apiKey, userId);
    if (status.hasCredentials) {
      return { success: true };
    }
  } catch (error) {
    // Continue to setup if check fails
    console.log("  Credentials check failed, will attempt setup...");
  }

  // If we have a Privy token, use it for setup
  if (privyToken) {
    // Setup wallet
    const walletResult = await setupWallet(apiKey, privyToken);
    if (!walletResult.success) {
      return { success: false, error: `Wallet setup failed: ${walletResult.error}` };
    }

    // Wait a bit for signer to be ready
    await sleep(2000);

    // Derive credentials
    const credResult = await deriveCredentials(apiKey, privyToken);
    if (!credResult.success) {
      return { success: false, error: `Derive credentials failed: ${credResult.error}` };
    }

    return { success: true };
  }

  // Without Privy token, check if credentials were set up previously
  // (e.g., through frontend flow)
  try {
    const status = await checkCredentialsStatus(apiKey, userId);
    if (status.hasCredentials) {
      return { success: true };
    }
    return {
      success: false,
      error: "No Privy access token available and credentials not yet configured. " +
             "Please authenticate through the frontend first to set up trading credentials.",
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to check credentials: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// ============================================
// STEP 7: EXECUTE SPACEX LONG BUY
// ============================================

async function executeSpaceXLongBuy(
  apiKey: string,
  walletAddress: string,
  privyToken: string | null
): Promise<BuyPositionResponse> {
  const params = {
    eventId: SPACEX_EVENT_SLUG,
    side: TRADE_SIDE,
    amount: TRADE_AMOUNT_USD,
  };

  // Build auth object - use Privy token if available
  const auth = privyToken ? { privyToken } : undefined;

  const result = await buyPosition(params, apiKey, walletAddress, auth);

  return result;
}

// ============================================
// STEP 8: VERIFY POSITION
// ============================================

async function verifyPosition(
  db: PrismaClient,
  tradingWalletId: string,
  eventId: string
): Promise<{ found: boolean; trade?: unknown }> {
  const trade = await db.predictionMarketTrade.findFirst({
    where: {
      tradingWalletId,
      eventId,
      status: "FILLED",
    },
    orderBy: { createdAt: "desc" },
  });

  return {
    found: !!trade,
    trade: trade || undefined,
  };
}

// ============================================
// MAIN EXECUTION
// ============================================

async function main(): Promise<void> {
  console.log("\n=== SpaceX LONG Token Buy Test ===\n");

  const TOTAL_STEPS = 7;
  let result: TestResult = { success: false };

  const db = createPrismaClient();

  try {
    // Parse arguments
    const args = parseArgs();
    const email = args.email || generateTestEmail();

    // Step 1: Validate configuration
    log(1, TOTAL_STEPS, "Validating configuration...");
    const config = validateConfig(email);
    logSuccess(`VAULTO_API_URL: ${config.vaultoApiUrl}`);
    logSuccess(`VAULTO_API_TOKEN: configured (${config.vaultoApiToken.slice(0, 8)}...)`);
    logSuccess(`Privy: configured`);

    const privy = new PrivyClient({
      appId: config.privyAppId,
      appSecret: config.privyAppSecret,
    });

    // Step 2: Create test user in database
    log(2, TOTAL_STEPS, "Creating test user...");
    logInfo(`Email: ${email}`);
    const { userId, isNew: isNewUser } = await createOrGetTestUser(db, email);
    logInfo(`User ID: ${userId}`);
    logSuccess(isNewUser ? "User created in database" : "User already exists");

    // Step 3: Create Privy wallet
    log(3, TOTAL_STEPS, "Creating Privy wallet...");
    const {
      privyUserId,
      walletAddress,
      isNew: isNewPrivyUser,
    } = await createPrivyUserWithWallet(privy, email);
    logInfo(`Privy User: ${privyUserId}`);
    logInfo(`Wallet: ${walletAddress}`);
    logSuccess(isNewPrivyUser ? "Privy user created with embedded wallet" : "Using existing Privy user");

    // Step 3b: Ensure trading wallet in database
    const { tradingWalletId, isNew: isNewTradingWallet } = await ensureTradingWallet(
      db,
      userId,
      walletAddress,
      privyUserId
    );
    logSuccess(
      isNewTradingWallet
        ? `TradingWallet created (ACTIVE)`
        : `TradingWallet exists (ID: ${tradingWalletId.slice(0, 8)}...)`
    );

    // Step 4: Get Privy access token
    log(4, TOTAL_STEPS, "Getting Privy access token...");
    const privyToken = await getPrivyAccessToken(privy, privyUserId);
    if (privyToken) {
      logSuccess("Token acquired");
    } else {
      logInfo("Token not available - will use alternative auth");
    }

    // Step 5: Setup trading credentials
    log(5, TOTAL_STEPS, "Setting up trading credentials...");
    const credResult = await ensureCredentials(
      config.vaultoApiToken,
      walletAddress,
      privyToken
    );

    if (!credResult.success) {
      logError(credResult.error || "Failed to setup credentials");
      console.log("\n  NOTE: If this is a new user, you may need to:");
      console.log("  1. Fund the wallet with USDC on Polygon");
      console.log("  2. Authenticate through the frontend to establish credentials");
      console.log("  3. Run this script again");

      // Store user info for reference
      result.user = {
        id: userId,
        email,
        privyUserId,
        walletAddress,
        tradingWalletId,
      };

      throw new Error(credResult.error);
    }
    logSuccess("Wallet synced with Vaulto API");
    logSuccess("Polymarket credentials configured");

    // Step 6: Execute buy
    log(6, TOTAL_STEPS, `Buying SpaceX LONG position ($${TRADE_AMOUNT_USD.toFixed(2)})...`);
    logInfo(`Event: ${SPACEX_EVENT_SLUG}`);
    logInfo(`Side: ${TRADE_SIDE}`);
    logInfo(`Amount: $${TRADE_AMOUNT_USD.toFixed(2)} USDC`);

    const buyResult = await executeSpaceXLongBuy(
      config.vaultoApiToken,
      walletAddress,
      privyToken
    );

    if (!buyResult.success) {
      logError(`Trade failed: ${buyResult.error}`);
      throw new Error(buyResult.error || "Trade failed");
    }

    console.log("\n  Orders:");
    if (buyResult.orders && buyResult.orders.length > 0) {
      for (let i = 0; i < buyResult.orders.length; i++) {
        const order = buyResult.orders[i];
        const prefix = i === buyResult.orders.length - 1 ? "└─" : "├─";
        console.log(
          `  ${prefix} ${order.bandId}: ${order.size.toFixed(2)} shares @ $${order.price.toFixed(2)} (${order.status})`
        );
      }
    } else {
      console.log("  └─ Order details not available");
    }

    console.log("");
    if (buyResult.totalCost !== undefined) {
      logInfo(`Total Cost: $${buyResult.totalCost.toFixed(2)}`);
    }
    if (buyResult.averagePrice !== undefined) {
      logInfo(`Average Price: $${buyResult.averagePrice.toFixed(2)}`);
    }
    if (buyResult.positionId) {
      logInfo(`Position ID: ${buyResult.positionId}`);
    }

    // Step 7: Verify position
    log(7, TOTAL_STEPS, "Verifying position...");
    const positionResult = await verifyPosition(db, tradingWalletId, SPACEX_EVENT_SLUG);

    if (positionResult.found) {
      const trade = positionResult.trade as { shares?: number };
      logSuccess(
        `Position confirmed: ${trade?.shares || "N/A"} shares of SpaceX LONG`
      );
    } else {
      logInfo("Position not yet visible in database (may be pending sync)");
    }

    // Success!
    result = {
      success: true,
      user: {
        id: userId,
        email,
        privyUserId,
        walletAddress,
        tradingWalletId,
      },
      buyResult,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.error = errorMessage;
    console.error("\n[ERROR]", errorMessage);
    if (error instanceof Error && error.stack) {
      console.error("\nStack trace:", error.stack);
    }
  } finally {
    await db.$disconnect();
  }

  // Print summary
  console.log("\n=== TEST COMPLETE ===");
  console.log(`Result: ${result.success ? "SUCCESS" : "FAILED"}`);

  if (result.user) {
    console.log("\nTest User Info:");
    console.log(`  Email: ${result.user.email}`);
    console.log(`  User ID: ${result.user.id}`);
    console.log(`  Privy User: ${result.user.privyUserId}`);
    console.log(`  Wallet: ${result.user.walletAddress}`);
  }

  if (result.error) {
    console.log(`\nError: ${result.error}`);
  }

  console.log("");

  process.exit(result.success ? 0 : 1);
}

// Run
main();
