/**
 * Delete All Privy Users
 *
 * Deletes all Privy users to force new wallet creation on re-login.
 * New wallets will be created with the correct policy from Privy Dashboard.
 *
 * IMPORTANT: Run export-privy-users.ts FIRST to create a backup!
 *
 * Usage: CONFIRM_DELETE=yes npx tsx scripts/delete-privy-users.ts
 */

import "dotenv/config";
import { PrivyClient } from "@privy-io/node";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

if (!appId || !appSecret) {
  console.error(
    "Missing Privy configuration: NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET are required"
  );
  process.exit(1);
}

const privy = new PrivyClient({ appId, appSecret });

// Rate limiting delay (ms) to avoid API limits
const RATE_LIMIT_DELAY = 100;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("\n=== Privy User Deletion ===\n");
  console.log(
    "WARNING: This will DELETE ALL Privy users and invalidate their embedded wallets.\n"
  );
  console.log("Users will get NEW wallets with correct policy on re-login.\n");

  // Safety confirmation via environment variable
  if (process.env.CONFIRM_DELETE !== "yes") {
    console.log("To run this deletion, set CONFIRM_DELETE=yes:");
    console.log("");
    console.log("  CONFIRM_DELETE=yes npx tsx scripts/delete-privy-users.ts");
    console.log("");
    console.log("Make sure you have run export-privy-users.ts first for backup!");
    process.exit(1);
  }

  try {
    // First, collect all user IDs
    console.log("Collecting user IDs...");
    const userIds: string[] = [];

    for await (const user of privy.users().list()) {
      userIds.push(user.id);
    }

    console.log(`Found ${userIds.length} user(s) to delete.\n`);

    if (userIds.length === 0) {
      console.log("No users to delete.");
      process.exit(0);
    }

    // Delete users with rate limiting
    let deleted = 0;
    let failed = 0;
    const failures: Array<{ id: string; error: string }> = [];

    console.log("Deleting users...\n");

    for (const userId of userIds) {
      try {
        await privy.users().delete(userId);
        deleted++;
        process.stdout.write(
          `  Progress: ${deleted}/${userIds.length} deleted\r`
        );
      } catch (error) {
        failed++;
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        failures.push({ id: userId, error: errorMessage });
        console.log(`\n  Failed to delete ${userId}: ${errorMessage}`);
      }

      // Rate limit to avoid API limits
      await sleep(RATE_LIMIT_DELAY);
    }

    console.log(`\n\n=== Deletion Complete ===\n`);
    console.log(`Successfully deleted: ${deleted}`);
    console.log(`Failed: ${failed}`);

    if (failures.length > 0) {
      console.log("\nFailed deletions:");
      for (const failure of failures) {
        console.log(`  - ${failure.id}: ${failure.error}`);
      }
    }

    // Verify deletion
    console.log("\nVerifying deletion...");
    let remainingCount = 0;
    for await (const _user of privy.users().list()) {
      remainingCount++;
    }

    console.log(`Remaining users: ${remainingCount}`);

    if (remainingCount === 0) {
      console.log("\nAll Privy users have been deleted.");
      console.log("\nNext steps:");
      console.log(
        "  1. CONFIRM_CLEANUP=yes npx tsx scripts/cleanup-trading-wallets.ts"
      );
      console.log("  2. npx tsx scripts/verify-wallet-reset.ts");
      console.log("");
    } else {
      console.log("\nWARNING: Some users remain. You may need to run again.");
    }

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error("\nError during deletion:", error);
    process.exit(1);
  }
}

main();
