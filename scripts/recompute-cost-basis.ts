/**
 * Recompute cost basis for a single trading wallet using CLOB truth:
 *   buy.actualCostBasis  = shares × averagePrice
 *   sale.costBasis       = sharesSold × avgEntryPrice
 *   sale.realizedPnl     = proceeds − costBasis
 *
 * Graph-snapshot fields (entryFairSellValueUsd, spreadCostUsd, entryGraphValuationUsd)
 * are intentionally left untouched.
 *
 * Usage: npx tsx scripts/recompute-cost-basis.ts
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const TARGET_ADDRESS = "0x6Ecf7305aD2A0a3C991A90C4E80A4908d0bbaa40";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error", "warn"] });

function dec2(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2));
}

function eqDec(a: Prisma.Decimal | null | undefined, b: Prisma.Decimal): boolean {
  if (a == null) return false;
  return new Prisma.Decimal(a).equals(b);
}

async function main() {
  const wallet = await prisma.tradingWallet.findUnique({
    where: { address: TARGET_ADDRESS },
    select: { id: true, userId: true, address: true },
  });

  if (!wallet) {
    throw new Error(`No TradingWallet found for address ${TARGET_ADDRESS}`);
  }

  console.log(`Wallet: ${wallet.address}  id=${wallet.id}  userId=${wallet.userId}`);

  // ---------------- Buys ----------------
  const trades = await prisma.predictionMarketTrade.findMany({
    where: { tradingWalletId: wallet.id },
    select: {
      id: true,
      eventId: true,
      shares: true,
      averagePrice: true,
      actualCostBasis: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\n=== PredictionMarketTrade: ${trades.length} rows ===`);

  const tradeUpdates: Prisma.PrismaPromise<unknown>[] = [];
  let tradeSkipped = 0;
  let tradeUnchanged = 0;

  for (const t of trades) {
    if (t.shares == null || t.averagePrice == null) {
      console.log(`  skip ${t.id} (${t.eventId}) [${t.status}] — missing shares/averagePrice`);
      tradeSkipped++;
      continue;
    }
    const shares = Number(t.shares);
    const avg = Number(t.averagePrice);
    const expected = dec2(shares * avg);

    if (eqDec(t.actualCostBasis, expected)) {
      tradeUnchanged++;
      continue;
    }

    const oldVal = t.actualCostBasis == null ? "null" : `$${Number(t.actualCostBasis).toFixed(2)}`;
    console.log(
      `  fix  ${t.id} (${t.eventId}): ${shares.toFixed(4)} × $${avg.toFixed(6)} = $${expected.toFixed(2)}  (was ${oldVal})`
    );
    tradeUpdates.push(
      prisma.predictionMarketTrade.update({
        where: { id: t.id },
        data: { actualCostBasis: expected },
      })
    );
  }

  if (tradeUpdates.length > 0) {
    await prisma.$transaction(tradeUpdates);
  }
  console.log(
    `Buys: updated=${tradeUpdates.length}  unchanged=${tradeUnchanged}  skipped=${tradeSkipped}`
  );

  // ---------------- Sales ----------------
  const sales = await prisma.predictionMarketSale.findMany({
    where: { tradingWalletId: wallet.id },
    select: {
      id: true,
      eventId: true,
      sharesSold: true,
      avgEntryPrice: true,
      costBasis: true,
      proceeds: true,
      realizedPnl: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\n=== PredictionMarketSale: ${sales.length} rows ===`);

  const saleUpdates: Prisma.PrismaPromise<unknown>[] = [];
  let saleSkipped = 0;
  let saleUnchanged = 0;

  for (const s of sales) {
    if (s.avgEntryPrice == null) {
      console.log(`  skip ${s.id} (${s.eventId}) [${s.status}] — missing avgEntryPrice`);
      saleSkipped++;
      continue;
    }
    const shares = Number(s.sharesSold);
    const avg = Number(s.avgEntryPrice);
    const proceeds = Number(s.proceeds);
    const expectedCost = dec2(shares * avg);
    const expectedPnl = dec2(proceeds - shares * avg);

    const costSame = eqDec(s.costBasis, expectedCost);
    const pnlSame = eqDec(s.realizedPnl, expectedPnl);

    if (costSame && pnlSame) {
      saleUnchanged++;
      continue;
    }

    const oldCost = s.costBasis == null ? "null" : `$${Number(s.costBasis).toFixed(2)}`;
    const oldPnl = `$${Number(s.realizedPnl).toFixed(2)}`;
    console.log(
      `  fix  ${s.id} (${s.eventId}): ${shares.toFixed(4)} × $${avg.toFixed(6)} = $${expectedCost.toFixed(2)}  (was cost=${oldCost}, pnl=${oldPnl})  newPnl=$${expectedPnl.toFixed(2)}`
    );
    saleUpdates.push(
      prisma.predictionMarketSale.update({
        where: { id: s.id },
        data: { costBasis: expectedCost, realizedPnl: expectedPnl },
      })
    );
  }

  if (saleUpdates.length > 0) {
    await prisma.$transaction(saleUpdates);
  }
  console.log(
    `Sales: updated=${saleUpdates.length}  unchanged=${saleUnchanged}  skipped=${saleSkipped}`
  );

  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
