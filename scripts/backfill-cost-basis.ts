/**
 * Backfill actualCostBasis for existing PredictionMarketTrade records.
 * Sets actualCostBasis = shares × averagePrice for all trades that have
 * both values but no actualCostBasis.
 *
 * Idempotent - safe to re-run.
 *
 * Usage: npx tsx scripts/backfill-cost-basis.ts
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error", "warn"] });

async function main() {
  // Find all trades that have shares and averagePrice but no actualCostBasis
  const trades = await prisma.predictionMarketTrade.findMany({
    where: {
      shares: { not: null },
      averagePrice: { not: null },
      actualCostBasis: null,
    },
    select: {
      id: true,
      shares: true,
      averagePrice: true,
      eventId: true,
    },
  });

  if (trades.length === 0) {
    console.log("No trades need backfilling. Done.");
    return;
  }

  console.log(`Found ${trades.length} trades to backfill.`);

  let updated = 0;
  for (const trade of trades) {
    const shares = trade.shares ? Number(trade.shares) : 0;
    const avgPrice = trade.averagePrice ? Number(trade.averagePrice) : 0;
    const costBasis = shares * avgPrice;

    if (costBasis > 0) {
      await prisma.predictionMarketTrade.update({
        where: { id: trade.id },
        data: { actualCostBasis: new Prisma.Decimal(costBasis.toFixed(2)) },
      });
      updated++;
      console.log(
        `Updated trade ${trade.id} (${trade.eventId}): ${shares.toFixed(4)} shares × $${avgPrice.toFixed(4)} = $${costBasis.toFixed(2)}`
      );
    } else {
      console.log(`Skipped trade ${trade.id} (${trade.eventId}): cost basis would be 0`);
    }
  }

  console.log(`Done. Updated ${updated} of ${trades.length} trades.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
