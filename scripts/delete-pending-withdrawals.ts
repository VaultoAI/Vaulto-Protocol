/**
 * Delete pending withdrawal requests from the database.
 * This removes withdrawals with status: PENDING_APPROVAL, APPROVED, PROCESSING
 *
 * Usage:
 *   npx tsx scripts/delete-pending-withdrawals.ts                     # Delete all pending
 *   npx tsx scripts/delete-pending-withdrawals.ts 0x123...abc         # Delete for specific wallet
 */

import "dotenv/config";
import { PrismaClient, WithdrawalStatus, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error", "warn"] });

async function main() {
  const walletAddress = process.argv[2];

  // Build the where clause
  const whereClause: Prisma.WithdrawalWhereInput = {
    status: {
      in: [
        WithdrawalStatus.PENDING_APPROVAL,
        WithdrawalStatus.APPROVED,
        WithdrawalStatus.PROCESSING,
      ],
    },
  };

  if (walletAddress) {
    // Verify wallet exists
    const wallet = await prisma.tradingWallet.findUnique({
      where: { address: walletAddress },
    });

    if (!wallet) {
      console.error(`No trading wallet found with address: ${walletAddress}`);
      process.exit(1);
    }

    whereClause.tradingWallet = { address: walletAddress };
    console.log(`Filtering by wallet: ${walletAddress}`);
  } else {
    console.log("No wallet specified - will delete ALL pending withdrawals");
  }

  // Find pending withdrawals
  const pendingWithdrawals = await prisma.withdrawal.findMany({
    where: whereClause,
    select: {
      id: true,
      status: true,
      amount: true,
      toAddress: true,
      createdAt: true,
      tradingWallet: {
        select: { address: true },
      },
    },
  });

  if (pendingWithdrawals.length === 0) {
    console.log("No pending withdrawals found. Done.");
    return;
  }

  console.log(`Found ${pendingWithdrawals.length} pending withdrawal(s):`);
  for (const w of pendingWithdrawals) {
    const amountUsdc = Number(w.amount) / 1_000_000;
    console.log(
      `  - ${w.id}: ${amountUsdc} USDC to ${w.toAddress.slice(0, 10)}... (${w.status}) from wallet ${w.tradingWallet.address.slice(0, 10)}...`
    );
  }

  // Delete them
  const result = await prisma.withdrawal.deleteMany({
    where: whereClause,
  });

  console.log(`\nDeleted ${result.count} pending withdrawal(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
