/**
 * Backfill Portfolio Snapshots
 *
 * Creates historical portfolio snapshots based on:
 * - Deposit history
 * - Trade history (cost basis changes)
 * - Current live position values from Vaulto API
 *
 * Usage: npx tsx scripts/backfill-portfolio-snapshots.ts
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { createPublicClient, http, formatUnits } from "viem";
import { polygon } from "viem/chains";

// Initialize Prisma
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error", "warn"] });

// USDC constants
const USDC_ADDRESSES = {
  POLYGON_NATIVE: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
  POLYGON_BRIDGED: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
};
const USDC_DECIMALS = 6;

const ERC20_ABI = [
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// Viem client
const polygonClient = createPublicClient({
  chain: polygon,
  transport: http(process.env.NEXT_PUBLIC_POLYGON_RPC_URL ?? "https://polygon.drpc.org"),
});

// Vaulto API
const VAULTO_API_URL = process.env.VAULTO_API_URL || process.env.NEXT_PUBLIC_VAULTO_API_URL || "https://api.vaulto.xyz";
const VAULTO_API_KEY = process.env.VAULTO_API_TOKEN || process.env.VAULTO_API_KEY || "";

interface Position {
  positionId: number;
  eventSlug: string;
  direction: string;
  totalShares: number;
  entryPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
}

interface PositionsResponse {
  positions: Position[];
  summary?: {
    totalValue: number;
    totalCost: number;
    totalPnl: number;
  };
  totals?: {
    totalValue: number;
    totalCost: number;
    unrealizedPnl: number;
  };
}

async function fetchPositions(walletAddress: string): Promise<PositionsResponse | null> {
  if (!VAULTO_API_KEY) {
    console.log("  No Vaulto API key configured, skipping live positions");
    return null;
  }

  try {
    const response = await fetch(`${VAULTO_API_URL}/api/trading/positions`, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": VAULTO_API_KEY,
        "x-user-id": walletAddress,
      },
    });

    if (!response.ok) {
      console.log("  Failed to fetch positions:", response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.log("  Error fetching positions:", error);
    return null;
  }
}

async function getUsdcBalance(address: string): Promise<number> {
  try {
    const balance = await polygonClient.readContract({
      address: USDC_ADDRESSES.POLYGON_NATIVE as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    return parseFloat(formatUnits(balance, USDC_DECIMALS));
  } catch {
    return 0;
  }
}

async function getUsdcBridgedBalance(address: string): Promise<number> {
  try {
    const balance = await polygonClient.readContract({
      address: USDC_ADDRESSES.POLYGON_BRIDGED as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    return parseFloat(formatUnits(balance, USDC_DECIMALS));
  } catch {
    return 0;
  }
}

interface TimelineEvent {
  timestamp: Date;
  type: "deposit" | "trade" | "sale";
  amount: number;
  description: string;
  // Running totals at this point
  cumulativeDeposits: number;
  cumulativeTradeCost: number;
  positionsCostBasis: number; // Total cost basis of open positions
}

async function main() {
  console.log("Backfilling Portfolio Snapshots...\n");

  // Get wallets with trade activity
  const wallets = await prisma.tradingWallet.findMany({
    where: {
      OR: [
        { predictionTrades: { some: {} } },
        { deposits: { some: { status: "COMPLETED" } } },
      ],
    },
    include: {
      predictionTrades: { orderBy: { createdAt: "asc" } },
      predictionSales: { orderBy: { createdAt: "asc" } },
      deposits: { where: { status: "COMPLETED" }, orderBy: { confirmedAt: "asc" } },
      portfolioSnapshots: true,
    },
  });

  console.log(`Found ${wallets.length} wallets with activity\n`);

  for (const wallet of wallets) {
    console.log(`\n=== Processing wallet ${wallet.id} ===`);
    console.log(`Address: ${wallet.address}`);
    console.log(`Safe: ${wallet.safeAddress || "N/A"}`);

    // Skip if already has snapshots (unless force flag)
    if (wallet.portfolioSnapshots.length > 0) {
      console.log(`  Already has ${wallet.portfolioSnapshots.length} snapshots, skipping`);
      continue;
    }

    // Build timeline of events
    const events: TimelineEvent[] = [];
    let cumulativeDeposits = 0;
    let cumulativeTradeCost = 0;

    // Track position cost basis by event
    const positionCostBasis: Record<string, number> = {};

    // Add deposits to timeline
    for (const deposit of wallet.deposits) {
      if (!deposit.confirmedAt) continue;
      const amount = Number(deposit.amount) / 1e6;
      cumulativeDeposits += amount;

      events.push({
        timestamp: deposit.confirmedAt,
        type: "deposit",
        amount,
        description: `Deposit $${amount.toFixed(2)}`,
        cumulativeDeposits,
        cumulativeTradeCost: 0, // Will be calculated in sort
        positionsCostBasis: 0,
      });
    }

    // Add trades to timeline
    for (const trade of wallet.predictionTrades) {
      if (trade.status !== "FILLED") continue;
      const costBasis = trade.actualCostBasis ? Number(trade.actualCostBasis) : Number(trade.amount);

      // Update position cost basis
      positionCostBasis[trade.eventId] = (positionCostBasis[trade.eventId] || 0) + costBasis;

      events.push({
        timestamp: trade.filledAt || trade.createdAt,
        type: "trade",
        amount: costBasis,
        description: `Buy ${trade.side} ${trade.eventId} - $${costBasis.toFixed(2)}`,
        cumulativeDeposits: 0,
        cumulativeTradeCost: costBasis,
        positionsCostBasis: 0,
      });
    }

    // Add sales to timeline (reduce position cost basis)
    for (const sale of wallet.predictionSales) {
      if (sale.status !== "COMPLETED") continue;
      const proceeds = Number(sale.proceeds);
      const costBasis = sale.costBasis ? Number(sale.costBasis) : 0;

      // Reduce position cost basis proportionally
      if (positionCostBasis[sale.eventId]) {
        const percentage = sale.percentage / 100;
        const reducedCost = positionCostBasis[sale.eventId] * percentage;
        positionCostBasis[sale.eventId] -= reducedCost;
      }

      events.push({
        timestamp: sale.completedAt || sale.createdAt,
        type: "sale",
        amount: proceeds,
        description: `Sell ${sale.eventId} - proceeds $${proceeds.toFixed(2)}`,
        cumulativeDeposits: 0,
        cumulativeTradeCost: -costBasis, // Negative because we're selling
        positionsCostBasis: 0,
      });
    }

    // Sort events by timestamp
    events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    if (events.length === 0) {
      console.log("  No events found, skipping");
      continue;
    }

    // Recalculate running totals after sorting
    cumulativeDeposits = 0;
    cumulativeTradeCost = 0;
    const runningPositionCost: Record<string, number> = {};

    for (const event of events) {
      if (event.type === "deposit") {
        cumulativeDeposits += event.amount;
      } else if (event.type === "trade") {
        cumulativeTradeCost += event.amount;
        // Find the trade to get eventId
        const trade = wallet.predictionTrades.find(
          t => (t.filledAt || t.createdAt).getTime() === event.timestamp.getTime()
        );
        if (trade) {
          runningPositionCost[trade.eventId] = (runningPositionCost[trade.eventId] || 0) + event.amount;
        }
      } else if (event.type === "sale") {
        // Find the sale
        const sale = wallet.predictionSales.find(
          s => (s.completedAt || s.createdAt).getTime() === event.timestamp.getTime()
        );
        if (sale && runningPositionCost[sale.eventId]) {
          const percentage = sale.percentage / 100;
          runningPositionCost[sale.eventId] *= (1 - percentage);
        }
      }

      event.cumulativeDeposits = cumulativeDeposits;
      event.cumulativeTradeCost = cumulativeTradeCost;
      event.positionsCostBasis = Object.values(runningPositionCost).reduce((a, b) => a + b, 0);
    }

    console.log(`  Found ${events.length} events to create snapshots from`);

    // Create snapshots for each event
    let snapshotsCreated = 0;
    for (const event of events) {
      // Calculate balance at this point
      // Cash = deposits - trade costs (what's been spent on positions)
      const cashAtTime = event.cumulativeDeposits - event.cumulativeTradeCost;
      // Position value = cost basis (we don't have historical prices, so use cost)
      const positionsValue = event.positionsCostBasis;
      const totalValue = cashAtTime + positionsValue;

      console.log(`  ${event.timestamp.toISOString()}: ${event.description}`);
      console.log(`    Cash: $${cashAtTime.toFixed(2)}, Positions: $${positionsValue.toFixed(2)}, Total: $${totalValue.toFixed(2)}`);

      await prisma.portfolioSnapshot.create({
        data: {
          tradingWalletId: wallet.id,
          timestamp: event.timestamp,
          eoaUsdcBalance: new Prisma.Decimal(Math.max(0, cashAtTime).toFixed(2)),
          safeUsdceBalance: new Prisma.Decimal(0),
          positionsValue: new Prisma.Decimal(positionsValue.toFixed(2)),
          totalValue: new Prisma.Decimal(Math.max(0, totalValue).toFixed(2)),
        },
      });
      snapshotsCreated++;
    }

    // Create current snapshot with live data
    console.log("\n  Creating current snapshot with live data...");

    const eoaBalance = await getUsdcBalance(wallet.address);
    const safeBalance = wallet.safeAddress ? await getUsdcBridgedBalance(wallet.safeAddress) : 0;

    let positionsValue = 0;
    let positionsSnapshot: Position[] | null = null;

    const positionsData = await fetchPositions(wallet.address);
    if (positionsData) {
      // Handle both API response formats (summary vs totals)
      const summary = positionsData.summary || positionsData.totals;
      positionsValue = summary?.totalValue || 0;
      positionsSnapshot = positionsData.positions;
      console.log(`  Positions from API: $${positionsValue.toFixed(2)}`);
      console.log(`  Positions breakdown:`);
      for (const pos of positionsData.positions) {
        const marketVal = pos.marketValue || (pos as unknown as { currentValue?: number }).currentValue || (pos.totalShares * pos.currentPrice);
        console.log(`    ${pos.eventSlug}: ${pos.totalShares.toFixed(2)} shares @ $${pos.currentPrice.toFixed(4)} = $${marketVal.toFixed(2)}`);
      }
    } else {
      // Fallback to cost basis
      positionsValue = Object.values(runningPositionCost).reduce((a, b) => a + b, 0);
      console.log(`  Using cost basis for positions: $${positionsValue.toFixed(2)}`);
    }

    const totalValue = eoaBalance + safeBalance + positionsValue;
    console.log(`  Current: EOA=$${eoaBalance.toFixed(2)}, Safe=$${safeBalance.toFixed(2)}, Positions=$${positionsValue.toFixed(2)}, Total=$${totalValue.toFixed(2)}`);

    await prisma.portfolioSnapshot.create({
      data: {
        tradingWalletId: wallet.id,
        timestamp: new Date(),
        eoaUsdcBalance: new Prisma.Decimal(eoaBalance.toFixed(2)),
        safeUsdceBalance: new Prisma.Decimal(safeBalance.toFixed(2)),
        positionsValue: new Prisma.Decimal(positionsValue.toFixed(2)),
        totalValue: new Prisma.Decimal(totalValue.toFixed(2)),
        positionsSnapshot: positionsSnapshot ? JSON.parse(JSON.stringify(positionsSnapshot)) : null,
      },
    });
    snapshotsCreated++;

    console.log(`\n  Created ${snapshotsCreated} snapshots`);
  }

  console.log("\n\nDone!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
