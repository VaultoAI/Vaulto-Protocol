/**
 * Backfill proceeds for PredictionMarketSale records that were logged with
 * proceeds = 0 because the upstream Vaulto API didn't return a `proceeds`
 * field at sell time.
 *
 * Strategy: for each completed sale, find an incoming USDC transfer to the
 * trading wallet's EOA within ±10 minutes of completedAt and treat that as
 * the auto-sweep delivery (ground truth dollar value the user received).
 *
 * Idempotent: only updates rows where proceeds = 0 AND status = "COMPLETED".
 *
 * Usage:
 *   npx tsx scripts/backfill-sale-proceeds.ts            # dry run
 *   npx tsx scripts/backfill-sale-proceeds.ts --apply    # write updates
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { fetchWalletTransactions } from "../lib/alchemy/transactions";

const APPLY = process.argv.includes("--apply");
// Vaulto's auto-sweep tx is mined in the same block as the sell call, so the
// inflow timestamp lines up almost exactly with sale.completedAt. A tight
// window prevents false matches when multiple sales happen close together.
const WINDOW_MS = 90 * 1000; // ±90 seconds

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error", "warn"] });

interface UsdcInflow {
  txHash: string;
  amount: number;
  timestamp: number; // ms epoch
}

async function loadUsdcInflows(walletAddress: string): Promise<UsdcInflow[]> {
  const txs = await fetchWalletTransactions(walletAddress, { maxCount: 1000 });
  return txs
    .filter(
      (t) =>
        t.type === "deposit" &&
        (t.asset === "USDC" || t.asset === "USDC.e" || t.asset === "USDCE") &&
        typeof t.amount === "number" &&
        t.amount > 0
    )
    .map((t) => ({
      txHash: t.txHash,
      amount: t.amount as number,
      timestamp: new Date(t.timestamp).getTime(),
    }));
}

async function main() {
  console.log(`[backfill-sale-proceeds] mode=${APPLY ? "APPLY" : "DRY-RUN"}`);

  const sales = await prisma.predictionMarketSale.findMany({
    where: {
      status: "COMPLETED",
      proceeds: 0,
    },
    include: {
      tradingWallet: { select: { address: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  if (sales.length === 0) {
    console.log("No sales need backfilling. Done.");
    return;
  }

  console.log(`Found ${sales.length} sales with proceeds=0 to consider.`);

  // Group sales by wallet to amortize Alchemy calls
  const salesByWallet = new Map<string, typeof sales>();
  for (const sale of sales) {
    const addr = sale.tradingWallet.address.toLowerCase();
    if (!salesByWallet.has(addr)) salesByWallet.set(addr, []);
    salesByWallet.get(addr)!.push(sale);
  }

  let matched = 0;
  let updated = 0;
  let skippedNoMatch = 0;
  let skippedAmbiguous = 0;

  for (const [address, walletSales] of salesByWallet) {
    console.log(
      `\n[wallet ${address}] loading USDC inflows for ${walletSales.length} sale(s)...`
    );
    let inflows: UsdcInflow[];
    try {
      inflows = await loadUsdcInflows(address);
    } catch (err) {
      console.error(`  Alchemy fetch failed for ${address}:`, err);
      continue;
    }
    console.log(`  ${inflows.length} USDC inflows fetched.`);

    // Inflow-driven matching: each sweep tx maps to exactly one sale (the one
    // whose completedAt is closest within WINDOW_MS). Sales with no sweep in
    // the window are recorded with proceeds=0 — they genuinely returned no
    // USDC (e.g., position closed for $0).
    const saleAssignments = new Map<string, UsdcInflow>();
    const claimed = new Set<string>(); // sale ids already assigned

    for (const inflow of inflows) {
      let best: typeof walletSales[number] | null = null;
      let bestDt = Infinity;
      for (const sale of walletSales) {
        if (claimed.has(sale.id)) continue;
        const ref = (sale.completedAt ?? sale.createdAt).getTime();
        const dt = Math.abs(inflow.timestamp - ref);
        if (dt <= WINDOW_MS && dt < bestDt) {
          best = sale;
          bestDt = dt;
        }
      }
      if (best) {
        saleAssignments.set(best.id, inflow);
        claimed.add(best.id);
      }
    }

    for (const sale of walletSales) {
      const inflow = saleAssignments.get(sale.id);
      if (!inflow) {
        console.log(
          `  [no-sweep] sale=${sale.id} event=${sale.eventName ?? sale.eventId} completedAt=${sale.completedAt?.toISOString()} — no USDC inflow within ±${WINDOW_MS / 1000}s; treating as $0 proceeds`
        );
        skippedNoMatch++;
        continue;
      }
      matched++;
      const ref = (sale.completedAt ?? sale.createdAt).getTime();
      const dt = (inflow.timestamp - ref) / 1000;
      console.log(
        `  [match] sale=${sale.id} event=${sale.eventName ?? sale.eventId} amount=$${inflow.amount.toFixed(6)} dt=${dt.toFixed(0)}s tx=${inflow.txHash}`
      );

      if (APPLY) {
        const costBasis = sale.costBasis ? Number(sale.costBasis) : null;
        const realizedPnl = costBasis !== null ? inflow.amount - costBasis : 0;
        await prisma.predictionMarketSale.update({
          where: { id: sale.id },
          data: {
            proceeds: inflow.amount,
            usdcReturned: inflow.amount,
            returnFundsTxHash: inflow.txHash,
            realizedPnl,
          },
        });
        updated++;
      }
    }
  }

  console.log(
    `\n[summary] sales=${sales.length} matched=${matched} updated=${updated} no-match=${skippedNoMatch} ambiguous=${skippedAmbiguous}`
  );
  if (!APPLY && matched > 0) {
    console.log("Dry run complete. Re-run with --apply to write updates.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
