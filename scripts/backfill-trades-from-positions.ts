/**
 * Backfill PredictionMarketTrade records with share/price data from positions API.
 *
 * This script fetches current positions for each user and updates their trade
 * records with the correct shares, averagePrice, and actualCostBasis values.
 *
 * Usage: npx tsx scripts/backfill-trades-from-positions.ts
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

const VAULTO_API_URL = process.env.NEXT_PUBLIC_VAULTO_API_URL || process.env.VAULTO_API_URL || "https://api.vaulto.xyz";
const VAULTO_API_KEY = process.env.VAULTO_API_TOKEN || process.env.VAULTO_API_KEY || "";

interface VaultoPosition {
  positionId: number;
  eventSlug: string;
  direction: "LONG" | "SHORT";
  totalShares: number;
  entryPrice: number;
  costBasis?: number;
  totalCost?: number;
}

async function fetchPositions(walletAddress: string): Promise<VaultoPosition[]> {
  try {
    const response = await fetch(`${VAULTO_API_URL}/api/trading/positions`, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": VAULTO_API_KEY,
        "x-user-id": walletAddress,
      },
    });

    if (!response.ok) {
      console.log(`  Failed to fetch positions for ${walletAddress}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.positions || [];
  } catch (error) {
    console.log(`  Error fetching positions for ${walletAddress}:`, error);
    return [];
  }
}

async function main() {
  // Find all trades missing share data
  const tradesNeedingUpdate = await prisma.predictionMarketTrade.findMany({
    where: {
      status: "FILLED",
      OR: [
        { shares: null },
        { shares: new Prisma.Decimal(0) },
        { averagePrice: null },
        { averagePrice: new Prisma.Decimal(0) },
      ],
    },
    include: {
      tradingWallet: {
        select: { address: true },
      },
    },
  });

  if (tradesNeedingUpdate.length === 0) {
    console.log("No trades need backfilling. Done.");
    return;
  }

  console.log(`Found ${tradesNeedingUpdate.length} trades needing backfill.\n`);

  // Group trades by wallet
  const tradesByWallet = new Map<string, typeof tradesNeedingUpdate>();
  for (const trade of tradesNeedingUpdate) {
    const address = trade.tradingWallet.address;
    if (!tradesByWallet.has(address)) {
      tradesByWallet.set(address, []);
    }
    tradesByWallet.get(address)!.push(trade);
  }

  let updated = 0;
  let notFound = 0;

  for (const [walletAddress, trades] of tradesByWallet) {
    console.log(`Processing wallet ${walletAddress.slice(0, 10)}... (${trades.length} trades)`);

    const positions = await fetchPositions(walletAddress);
    console.log(`  Found ${positions.length} current positions`);

    for (const trade of trades) {
      // Find matching position by eventId and side
      const matchingPosition = positions.find(
        (p) => p.eventSlug === trade.eventId && p.direction === trade.side
      );

      if (matchingPosition) {
        const shares = matchingPosition.totalShares;
        const avgPrice = matchingPosition.entryPrice;
        const costBasis = matchingPosition.costBasis || matchingPosition.totalCost || (shares * avgPrice);

        await prisma.predictionMarketTrade.update({
          where: { id: trade.id },
          data: {
            shares: new Prisma.Decimal(shares),
            averagePrice: new Prisma.Decimal(avgPrice),
            actualCostBasis: new Prisma.Decimal(costBasis.toFixed(2)),
          },
        });

        console.log(`  ✓ Updated ${trade.eventId} ${trade.side}: ${shares.toFixed(4)} shares @ $${avgPrice.toFixed(4)} = $${costBasis.toFixed(2)}`);
        updated++;
      } else {
        console.log(`  ✗ No matching position for ${trade.eventId} ${trade.side} (position may have been closed)`);
        notFound++;
      }
    }
  }

  console.log(`\nDone. Updated ${updated} trades, ${notFound} had no matching position.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
