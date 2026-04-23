/**
 * Migration Script: Add Server Signing to Existing Wallets
 *
 * This script migrates existing trading wallets to use server-side signing.
 * It queries wallets where hasServerSigner = false and attempts to add
 * the server authorization key as an additional signer.
 *
 * IMPORTANT: Check if Privy API supports adding signers to existing wallets
 * before running this script. If not supported, existing wallets will
 * continue to use client-side signing.
 *
 * Usage: npx tsx scripts/migrate-wallets-to-server-signing.ts
 */

import * as dotenv from "dotenv";

// Load .env.local explicitly
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrivyClient } from "@privy-io/node";

// Create Prisma client with pg adapter (same as lib/prisma.ts)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Initialize Privy client
function getPrivyClient(): PrivyClient {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error("Missing NEXT_PUBLIC_PRIVY_APP_ID or PRIVY_APP_SECRET");
  }

  return new PrivyClient({ appId, appSecret });
}

// Check if server signing is configured
function isServerSigningConfigured(): boolean {
  return !!(
    process.env.PRIVY_AUTHORIZATION_KEY_ID &&
    process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY &&
    process.env.PRIVY_TRADING_POLICY_ID
  );
}

interface MigrationResult {
  walletId: string;
  address: string;
  success: boolean;
  error?: string;
}

async function migrateWallet(
  privy: PrivyClient,
  visibleWalletId: string,
  walletAddress: string,
  policyId: string,
  signerId: string,
  userId: string
): Promise<MigrationResult> {
  console.log(`\n[Migration] Processing wallet: ${walletAddress}`);

  try {
    // The privyWalletId in our DB might be an address or a DID
    // We need the actual Privy wallet ID to update it
    // Let's try to get the user and find their wallet

    let actualWalletId = visibleWalletId;

    // If the stored ID looks like an address, we need to look up the actual wallet ID
    if (visibleWalletId.startsWith("0x")) {
      console.log(`[Migration] Looking up wallet ID for address ${walletAddress}...`);

      // Get user's wallets from Privy (use '_get' for server-side queries by DID)
      const user = await privy.users()._get(userId);

      // Find the embedded wallet matching this address
      const embeddedWallet = user.linked_accounts.find(
        (account: { type: string; wallet_client_type?: string; address?: string }) =>
          account.type === "wallet" &&
          account.wallet_client_type === "privy" &&
          account.address?.toLowerCase() === walletAddress.toLowerCase()
      );

      if (!embeddedWallet || !("wallet_id" in embeddedWallet)) {
        console.log(`[Migration] Could not find wallet ID in Privy for ${walletAddress}`);
        return {
          walletId: visibleWalletId,
          address: walletAddress,
          success: false,
          error: "Could not find wallet in Privy user data",
        };
      }

      actualWalletId = (embeddedWallet as { wallet_id: string }).wallet_id;
      console.log(`[Migration] Found Privy wallet ID: ${actualWalletId}`);
    }

    // Update the wallet to add the server signer
    console.log(`[Migration] Adding signer ${signerId} to wallet ${actualWalletId}...`);

    await privy.wallets().update(actualWalletId, {
      policy_ids: [policyId],
      additional_signers: [
        {
          signer_id: signerId,
          // Use the same policy for the signer
          override_policy_ids: [policyId],
        },
      ],
    });

    console.log(`[Migration] Successfully added signer to wallet ${walletAddress}`);

    return {
      walletId: actualWalletId,
      address: walletAddress,
      success: true,
    };
  } catch (error) {
    console.error(`[Migration] Failed for wallet ${walletAddress}:`, error);
    return {
      walletId: visibleWalletId,
      address: walletAddress,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function main() {
  console.log("=".repeat(60));
  console.log("Migration: Add Server Signing to Existing Wallets");
  console.log("=".repeat(60));

  // Check configuration
  if (!isServerSigningConfigured()) {
    console.error(
      "\nError: Server signing is not configured. Please set the following environment variables:"
    );
    console.error("  - PRIVY_AUTHORIZATION_KEY_ID");
    console.error("  - PRIVY_AUTHORIZATION_PRIVATE_KEY");
    console.error("  - PRIVY_TRADING_POLICY_ID");
    process.exit(1);
  }

  const policyId = process.env.PRIVY_TRADING_POLICY_ID!;
  const signerId = process.env.PRIVY_AUTHORIZATION_KEY_ID!;

  console.log(`\nPolicy ID: ${policyId}`);
  console.log(`Signer ID: ${signerId}`);

  // Query wallets without server signing, including user info to get Privy user ID
  const walletsToMigrate = await prisma.tradingWallet.findMany({
    where: {
      hasServerSigner: false,
      status: "ACTIVE",
    },
    select: {
      id: true,
      privyWalletId: true,
      address: true,
      userId: true,
      user: {
        select: {
          email: true,
        },
      },
    },
  });

  console.log(`\nFound ${walletsToMigrate.length} wallets to migrate`);

  if (walletsToMigrate.length === 0) {
    console.log("No wallets need migration.");
    await prisma.$disconnect();
    return;
  }

  // Initialize Privy client
  const privy = getPrivyClient();

  // Migration results
  const results: MigrationResult[] = [];

  // Process each wallet
  for (const wallet of walletsToMigrate) {
    // First, get the Privy user ID from the email
    let privyUserId: string | null = null;
    try {
      const email = wallet.user?.email;
      if (email) {
        const privyUser = await privy.users().getByEmailAddress({ address: email });
        privyUserId = privyUser?.id || null;
        if (privyUserId) {
          console.log(`[Migration] Found Privy user ${privyUserId} for ${email}`);
        }
      }
    } catch (e) {
      console.log(`[Migration] Could not find Privy user for wallet ${wallet.address}:`,
        e instanceof Error ? e.message : "Unknown error");
    }

    if (!privyUserId) {
      results.push({
        walletId: wallet.privyWalletId,
        address: wallet.address,
        success: false,
        error: "Could not find Privy user ID",
      });
      continue;
    }

    const result = await migrateWallet(
      privy,
      wallet.privyWalletId,
      wallet.address,
      policyId,
      signerId,
      privyUserId
    );
    results.push(result);

    // If successful, update the database
    if (result.success) {
      await prisma.tradingWallet.update({
        where: { id: wallet.id },
        data: {
          hasServerSigner: true,
          policyId,
          serverSignerId: signerId,
          // Update privyWalletId if we found the actual wallet ID
          ...(result.walletId !== wallet.privyWalletId && {
            privyWalletId: result.walletId,
          }),
        },
      });
      console.log(`[Migration] Updated database for wallet: ${wallet.address}`);
    }
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("Migration Summary");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  console.log(`\nTotal wallets processed: ${results.length}`);
  console.log(`Successful: ${successful.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log("\nFailed migrations:");
    for (const result of failed) {
      console.log(`  - ${result.address}: ${result.error}`);
    }

    console.log("\nNote: Wallets that failed migration will continue to use");
    console.log("client-side signing. This is expected if the Privy API does");
    console.log("not support adding signers to existing wallets.");
  }

  // Alternative approach: For existing wallets, we can support both flows
  console.log("\n" + "=".repeat(60));
  console.log("Alternative Approach");
  console.log("=".repeat(60));
  console.log("\nSince Privy may not support adding signers to existing wallets,");
  console.log("the application supports both client-side and server-side signing:");
  console.log("  - New wallets: Created with server signer (hasServerSigner = true)");
  console.log("  - Existing wallets: Use client-side signing (hasServerSigner = false)");
  console.log("\nThe withdrawal endpoint checks hasServerSigner to determine the flow.");

  await prisma.$disconnect();
  await pool.end();
}

main().catch(async (error) => {
  console.error("Migration failed:", error);
  await prisma.$disconnect();
  await pool.end();
  process.exit(1);
});
