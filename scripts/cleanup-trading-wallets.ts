/**
 * Cleanup TradingWallet and related records from Vaulto-Protocol database
 *
 * IMPORTANT: Run this AFTER cleanup-privy-wallets.ts in Vaulto-API
 *
 * Prisma cascade deletes will automatically remove:
 * - Deposit
 * - Withdrawal
 * - EtfOrder
 * - EtfPosition
 * - CachedTransaction
 * - WalletSyncState
 * - PredictionMarketTrade
 *
 * Usage: npx tsx scripts/cleanup-trading-wallets.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error", "warn"] });

async function main() {
  console.log("\n=== Vaulto-Protocol Trading Wallet Cleanup ===\n");
  console.log(
    "WARNING: This will delete ALL TradingWallet records and related data.\n"
  );

  // Safety confirmation via environment variable
  if (process.env.CONFIRM_CLEANUP !== "yes") {
    console.log("To run this cleanup, set CONFIRM_CLEANUP=yes:");
    console.log("");
    console.log("  CONFIRM_CLEANUP=yes npx tsx scripts/cleanup-trading-wallets.ts");
    console.log("");
    console.log("Make sure you have run cleanup-privy-wallets.ts in Vaulto-API first!");
    process.exit(1);
  }

  try {
    // Count existing records
    const walletCount = await prisma.tradingWallet.count();
    const depositCount = await prisma.deposit.count();
    const withdrawalCount = await prisma.withdrawal.count();
    const etfOrderCount = await prisma.etfOrder.count();
    const etfPositionCount = await prisma.etfPosition.count();
    const cachedTxCount = await prisma.cachedTransaction.count();
    const syncStateCount = await prisma.walletSyncState.count();
    const predictionTradeCount = await prisma.predictionMarketTrade.count();

    console.log("Current record counts:");
    console.log(`  - TradingWallet: ${walletCount}`);
    console.log(`  - Deposit: ${depositCount}`);
    console.log(`  - Withdrawal: ${withdrawalCount}`);
    console.log(`  - EtfOrder: ${etfOrderCount}`);
    console.log(`  - EtfPosition: ${etfPositionCount}`);
    console.log(`  - CachedTransaction: ${cachedTxCount}`);
    console.log(`  - WalletSyncState: ${syncStateCount}`);
    console.log(`  - PredictionMarketTrade: ${predictionTradeCount}`);
    console.log("");

    if (walletCount === 0) {
      console.log("No TradingWallet records found. Nothing to delete.");
      process.exit(0);
    }

    console.log("Starting cleanup...\n");

    // Delete TradingWallets (cascade will handle related records)
    const result = await prisma.tradingWallet.deleteMany({});
    console.log(`Deleted ${result.count} TradingWallet record(s).\n`);

    // Verify cleanup
    const remainingWallets = await prisma.tradingWallet.count();
    const remainingDeposits = await prisma.deposit.count();
    const remainingWithdrawals = await prisma.withdrawal.count();

    console.log("Post-cleanup verification:");
    console.log(`  - TradingWallet: ${remainingWallets}`);
    console.log(`  - Deposit: ${remainingDeposits}`);
    console.log(`  - Withdrawal: ${remainingWithdrawals}`);
    console.log("");

    if (remainingWallets === 0) {
      console.log("=== Cleanup Complete ===\n");
      console.log("All TradingWallet records and related data have been deleted.");
      console.log("");
      console.log("Next steps:");
      console.log("1. Run verify-wallet-policy.ts in Vaulto-API to verify policy config");
      console.log("2. Test login to verify new wallets are created correctly");
      console.log("");
    } else {
      console.log("WARNING: Some records remain. Manual cleanup may be needed.");
    }

    process.exit(0);
  } catch (err) {
    console.error("\nError during cleanup:", err);
    console.error("");
    console.error("Some data may have been deleted. Check database state.");
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
