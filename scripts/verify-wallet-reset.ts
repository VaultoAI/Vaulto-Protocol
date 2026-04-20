/**
 * Verify Wallet Reset
 *
 * Verifies that both Privy users and TradingWallet records have been deleted.
 * Run this AFTER delete-privy-users.ts and cleanup-trading-wallets.ts
 *
 * Usage: npx tsx scripts/verify-wallet-reset.ts
 */

import "dotenv/config";
import { PrivyClient } from "@privy-io/node";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Initialize Privy client
const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

if (!appId || !appSecret) {
  console.error(
    "Missing Privy configuration: NEXT_PUBLIC_PRIVY_APP_ID and PRIVY_APP_SECRET are required"
  );
  process.exit(1);
}

const privy = new PrivyClient({ appId, appSecret });

// Initialize Prisma client
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error", "warn"] });

async function main() {
  console.log("\n=== Wallet Reset Verification ===\n");

  let allClear = true;

  // Check Privy users
  console.log("Checking Privy users...");
  let privyUserCount = 0;
  try {
    for await (const _user of privy.users().list()) {
      privyUserCount++;
    }
    console.log(`  Privy users: ${privyUserCount}`);
    if (privyUserCount > 0) {
      console.log("  ⚠️  WARNING: Privy users still exist!");
      allClear = false;
    } else {
      console.log("  ✓ No Privy users remaining");
    }
  } catch (error) {
    console.error("  ✗ Error checking Privy users:", error);
    allClear = false;
  }

  console.log("");

  // Check database records
  console.log("Checking database records...");
  try {
    const tradingWalletCount = await prisma.tradingWallet.count();
    const depositCount = await prisma.deposit.count();
    const withdrawalCount = await prisma.withdrawal.count();
    const etfOrderCount = await prisma.etfOrder.count();
    const etfPositionCount = await prisma.etfPosition.count();
    const userCount = await prisma.user.count();

    console.log(`  TradingWallet: ${tradingWalletCount}`);
    console.log(`  Deposit: ${depositCount}`);
    console.log(`  Withdrawal: ${withdrawalCount}`);
    console.log(`  EtfOrder: ${etfOrderCount}`);
    console.log(`  EtfPosition: ${etfPositionCount}`);
    console.log(`  User (preserved): ${userCount}`);

    if (tradingWalletCount > 0) {
      console.log("\n  ⚠️  WARNING: TradingWallet records still exist!");
      console.log(
        "  Run: CONFIRM_CLEANUP=yes npx tsx scripts/cleanup-trading-wallets.ts"
      );
      allClear = false;
    } else {
      console.log("\n  ✓ No TradingWallet records remaining");
    }

    if (depositCount > 0 || withdrawalCount > 0) {
      console.log("  ⚠️  WARNING: Related records still exist!");
      allClear = false;
    }
  } catch (error) {
    console.error("  ✗ Error checking database:", error);
    allClear = false;
  }

  console.log("\n=== Summary ===\n");

  if (allClear) {
    console.log("✓ RESET COMPLETE");
    console.log("");
    console.log("All Privy users and TradingWallet records have been deleted.");
    console.log("Users will receive new wallets with correct policy on re-login.");
    console.log("");
    console.log("Test the flow:");
    console.log("  1. Log in with an existing account");
    console.log("  2. Verify new embedded wallet is created");
    console.log("  3. Check TradingWallet record in database");
    console.log("  4. Test deposit/withdrawal flows");
    console.log("");
  } else {
    console.log("⚠️  RESET INCOMPLETE");
    console.log("");
    console.log("Some records still exist. Review the warnings above.");
    console.log("");
  }

  await prisma.$disconnect();
  process.exit(allClear ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  prisma.$disconnect();
  process.exit(1);
});
