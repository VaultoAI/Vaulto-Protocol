/**
 * Backfill PredictionMarketSale records for positions that were sold
 * but not logged due to the conditional logging bug.
 *
 * Logic:
 * 1. Get all trading wallets
 * 2. For each wallet:
 *    a. Get all PredictionMarketTrade records (buys) with status = FILLED
 *    b. Get all existing PredictionMarketSale records
 *    c. Get current positions from Vaulto API
 *    d. Identify sold positions: trades that have no matching sale AND no matching current position
 *    e. For these, create PredictionMarketSale records using buy metadata
 *    f. Match with USDC deposits (incoming transfers) to estimate proceeds
 *
 * Usage:
 *   npx tsx scripts/backfill-prediction-sales.ts          # Dry run
 *   npx tsx scripts/backfill-prediction-sales.ts --apply  # Actually create records
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

const VAULTO_API_URL =
  process.env.NEXT_PUBLIC_VAULTO_API_URL ||
  process.env.VAULTO_API_URL ||
  "https://api.vaulto.xyz";
const VAULTO_API_KEY =
  process.env.VAULTO_API_TOKEN || process.env.VAULTO_API_KEY || "";

const DRY_RUN = !process.argv.includes("--apply");

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

interface MissingSale {
  trade: {
    id: string;
    eventId: string;
    eventName: string | null;
    company: string | null;
    side: string;
    shares: Prisma.Decimal | null;
    averagePrice: Prisma.Decimal | null;
    actualCostBasis: Prisma.Decimal | null;
    positionId: string | null;
    filledAt: Date | null;
    createdAt: Date;
  };
  tradingWalletId: string;
  estimatedProceeds: number | null;
  matchedTransfer: {
    txHash: string;
    amount: number;
    timestamp: Date;
  } | null;
}

async function main() {
  console.log(`\n=== Backfill Prediction Sales ===`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "APPLY (will create records)"}\n`);

  if (!VAULTO_API_KEY) {
    console.error("Error: VAULTO_API_TOKEN or VAULTO_API_KEY not set");
    process.exit(1);
  }

  // Get all trading wallets with their trades, sales, and cached transactions
  const wallets = await prisma.tradingWallet.findMany({
    where: {
      status: "ACTIVE",
    },
    include: {
      predictionTrades: {
        where: { status: "FILLED" },
        orderBy: { createdAt: "asc" },
      },
      predictionSales: true,
      cachedTransactions: {
        where: { type: "deposit" }, // Incoming USDC transfers
        orderBy: { blockTimestamp: "asc" },
      },
    },
  });

  console.log(`Found ${wallets.length} active trading wallets\n`);

  const missingSales: MissingSale[] = [];

  for (const wallet of wallets) {
    if (wallet.predictionTrades.length === 0) {
      continue;
    }

    console.log(`\nProcessing wallet ${wallet.address.slice(0, 10)}...`);
    console.log(`  Trades: ${wallet.predictionTrades.length}, Existing sales: ${wallet.predictionSales.length}`);

    // Fetch current positions from Vaulto API
    const currentPositions = await fetchPositions(wallet.address);
    console.log(`  Current positions: ${currentPositions.length}`);

    // Create a set of existing sales by positionId for quick lookup
    const existingSalePositionIds = new Set(
      wallet.predictionSales.map((s) => s.positionId)
    );

    // Create a set of current position eventId+side combos
    const currentPositionKeys = new Set(
      currentPositions.map((p) => `${p.eventSlug}:${p.direction}`)
    );

    // Find trades that don't have a matching sale or current position
    for (const trade of wallet.predictionTrades) {
      const positionKey = `${trade.eventId}:${trade.side}`;
      const hasCurrentPosition = currentPositionKeys.has(positionKey);
      const hasSaleRecord =
        trade.positionId && existingSalePositionIds.has(trade.positionId);

      // Also check if there's a sale by eventId+side
      const hasSaleByEvent = wallet.predictionSales.some(
        (s) => s.eventId === trade.eventId && s.side === trade.side
      );

      if (!hasCurrentPosition && !hasSaleRecord && !hasSaleByEvent) {
        // This trade was likely sold but not logged
        console.log(`  Found missing sale: ${trade.eventId} ${trade.side}`);

        // Try to match with a USDC deposit (incoming transfer) that occurred after the buy
        const tradeTimestamp = trade.filledAt || trade.createdAt;
        const costBasis = trade.actualCostBasis
          ? Number(trade.actualCostBasis)
          : null;

        // Look for USDC deposits after this trade that could be proceeds
        // Filter for amounts within reasonable range (50%-300% of cost basis)
        let matchedTransfer = null;
        let estimatedProceeds = null;

        if (costBasis && costBasis > 0) {
          const minProceeds = costBasis * 0.5; // Allow 50% loss
          const maxProceeds = costBasis * 3.0; // Allow 200% gain

          // Find potential matching transfers
          const potentialMatches = wallet.cachedTransactions.filter((tx) => {
            const amount = tx.amountFormatted;
            const timestamp = tx.blockTimestamp;
            return (
              timestamp > tradeTimestamp &&
              amount >= minProceeds &&
              amount <= maxProceeds
            );
          });

          // Use the first match (closest in time to trade)
          if (potentialMatches.length > 0) {
            const match = potentialMatches[0];
            matchedTransfer = {
              txHash: match.txHash,
              amount: match.amountFormatted,
              timestamp: match.blockTimestamp,
            };
            estimatedProceeds = match.amountFormatted;
          }
        }

        // If no match found, fall back to cost basis (assume break-even)
        if (estimatedProceeds === null && costBasis) {
          estimatedProceeds = costBasis;
          console.log(`    Using cost basis as fallback: $${costBasis.toFixed(2)}`);
        }

        missingSales.push({
          trade: {
            id: trade.id,
            eventId: trade.eventId,
            eventName: trade.eventName,
            company: trade.company,
            side: trade.side,
            shares: trade.shares,
            averagePrice: trade.averagePrice,
            actualCostBasis: trade.actualCostBasis,
            positionId: trade.positionId,
            filledAt: trade.filledAt,
            createdAt: trade.createdAt,
          },
          tradingWalletId: wallet.id,
          estimatedProceeds,
          matchedTransfer,
        });
      }
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`Found ${missingSales.length} missing sale records\n`);

  if (missingSales.length === 0) {
    console.log("No missing sales to backfill. Done.");
    return;
  }

  // Print details
  for (const sale of missingSales) {
    const costBasis = sale.trade.actualCostBasis
      ? Number(sale.trade.actualCostBasis)
      : 0;
    const proceeds = sale.estimatedProceeds ?? costBasis;
    const pnl = proceeds - costBasis;
    const pnlPercent = costBasis > 0 ? ((pnl / costBasis) * 100).toFixed(1) : "0";

    console.log(`\n${sale.trade.eventId} ${sale.trade.side}`);
    console.log(`  Event: ${sale.trade.eventName || "(unknown)"}`);
    console.log(`  Company: ${sale.trade.company || "(unknown)"}`);
    console.log(`  Shares: ${sale.trade.shares?.toFixed(4) ?? "(unknown)"}`);
    console.log(`  Cost Basis: $${costBasis.toFixed(2)}`);
    console.log(`  Est. Proceeds: $${proceeds.toFixed(2)}`);
    console.log(`  Est. P&L: $${pnl.toFixed(2)} (${pnlPercent}%)`);
    if (sale.matchedTransfer) {
      console.log(`  Matched TX: ${sale.matchedTransfer.txHash.slice(0, 16)}... @ ${sale.matchedTransfer.timestamp.toISOString()}`);
    } else {
      console.log(`  Matched TX: (no match - using cost basis as fallback)`);
    }
  }

  // Create records if not dry run
  if (!DRY_RUN) {
    console.log(`\nCreating ${missingSales.length} sale records...`);

    let created = 0;
    let failed = 0;

    for (const sale of missingSales) {
      try {
        const costBasis = sale.trade.actualCostBasis
          ? Number(sale.trade.actualCostBasis)
          : 0;
        const proceeds = sale.estimatedProceeds ?? costBasis;
        const pnl = proceeds - costBasis;
        const shares = sale.trade.shares ? Number(sale.trade.shares) : 0;
        const avgEntry = sale.trade.averagePrice
          ? Number(sale.trade.averagePrice)
          : null;

        // Estimate completion time: use matched transfer timestamp, or 1 day after trade
        const completedAt = sale.matchedTransfer
          ? sale.matchedTransfer.timestamp
          : new Date(
              (sale.trade.filledAt || sale.trade.createdAt).getTime() +
                24 * 60 * 60 * 1000
            );

        await prisma.predictionMarketSale.create({
          data: {
            tradingWalletId: sale.tradingWalletId,
            positionId: sale.trade.positionId || `backfill-${sale.trade.id}`,
            eventId: sale.trade.eventId,
            eventName: sale.trade.eventName,
            company: sale.trade.company,
            side: sale.trade.side,
            sharesSold: new Prisma.Decimal(shares),
            percentage: 100,
            proceeds: new Prisma.Decimal(proceeds.toFixed(2)),
            realizedPnl: new Prisma.Decimal(pnl.toFixed(2)),
            costBasis: costBasis > 0 ? new Prisma.Decimal(costBasis.toFixed(2)) : null,
            avgEntryPrice: avgEntry ? new Prisma.Decimal(avgEntry.toFixed(6)) : null,
            exitPrice: null, // Not known for backfilled sales
            status: "COMPLETED",
            completedAt,
          },
        });

        console.log(`  ✓ Created sale: ${sale.trade.eventId} ${sale.trade.side}`);
        created++;
      } catch (error) {
        console.error(`  ✗ Failed to create sale for ${sale.trade.eventId}:`, error);
        failed++;
      }
    }

    console.log(`\nDone. Created ${created} records, ${failed} failed.`);
  } else {
    console.log(`\nDry run complete. Run with --apply to create records.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
