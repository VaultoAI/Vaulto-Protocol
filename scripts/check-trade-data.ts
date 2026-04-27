/**
 * Check PredictionMarketTrade data to debug cost basis issues.
 * Shows what values are stored vs what should be displayed.
 *
 * Usage: npx tsx scripts/check-trade-data.ts
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
  const trades = await prisma.predictionMarketTrade.findMany({
    where: { status: "FILLED" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  console.log(`\nFound ${trades.length} filled trades:\n`);
  console.log("ID | Event | Side | Amount (intended) | Shares | AvgPrice | CostBasis (stored) | CostBasis (calculated) | Display");
  console.log("-".repeat(140));

  for (const trade of trades) {
    const shares = trade.shares ? Number(trade.shares) : 0;
    const avgPrice = trade.averagePrice ? Number(trade.averagePrice) : 0;
    const storedCostBasis = trade.actualCostBasis ? Number(trade.actualCostBasis) : null;
    const calculatedCostBasis = shares * avgPrice;

    // What will be displayed (same logic as the API)
    let displayAmount: number;
    if (storedCostBasis) {
      displayAmount = storedCostBasis;
    } else if (shares > 0 && avgPrice > 0) {
      displayAmount = calculatedCostBasis;
    } else {
      displayAmount = Number(trade.amount);
    }

    const intendedAmount = Number(trade.amount);
    const diff = Math.abs(displayAmount - intendedAmount);
    const flag = diff > 0.1 ? "" : " ⚠️ SAME AS INTENDED";

    console.log(
      `${trade.id.slice(0, 8)} | ${trade.eventId.slice(0, 20).padEnd(20)} | ${trade.side.padEnd(5)} | ` +
      `$${intendedAmount.toFixed(2).padStart(8)} | ${shares.toFixed(4).padStart(10)} | ` +
      `$${avgPrice.toFixed(4).padStart(8)} | ${storedCostBasis ? '$' + storedCostBasis.toFixed(2) : 'null'.padStart(8)} | ` +
      `$${calculatedCostBasis.toFixed(2).padStart(8)} | $${displayAmount.toFixed(2).padStart(8)}${flag}`
    );
  }

  console.log("\n");

  // Check for trades missing share/price data
  const missingData = trades.filter(t => !t.shares || !t.averagePrice);
  if (missingData.length > 0) {
    console.log(`⚠️  ${missingData.length} trades missing shares or averagePrice - these will show intended amount instead of cost basis`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
