/**
 * Backfill PredictionMarketSale rows for sells that executed on-chain but
 * never got logged to the database — typically partial-fill FAK orders that
 * the API wrongly treated as full failures (returning HTTP 400 to the
 * frontend, which then skipped the DB insert).
 *
 * Source of truth: Polymarket's public Data API
 *   https://data-api.polymarket.com/activity?user=<safe>&type=TRADE&side=SELL
 * Every actual on-chain fill (full or partial) shows up there. We match each
 * trade against existing PredictionMarketSale rows by (eventId, timestamp ±5m,
 * shares within 10%); anything unmatched gets inserted so the profile
 * Transactions table reflects on-chain reality.
 *
 * Idempotent: re-running won't create duplicates because the matching window
 * catches the rows we just inserted.
 *
 * Usage:
 *   npx tsx scripts/backfill-partial-sells.ts            # dry run
 *   npx tsx scripts/backfill-partial-sells.ts --apply    # write inserts
 *   npx tsx scripts/backfill-partial-sells.ts --wallet=0xabc...  # one wallet
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const WALLET_FILTER = process.argv
  .find((a) => a.startsWith("--wallet="))
  ?.split("=")[1]
  ?.toLowerCase();

// A single sell often fills against multiple makers, producing several TRADE
// rows seconds apart. We treat every fill as its own transaction row so the
// profile shows the same granularity Polymarket does.
const MATCH_WINDOW_MS = 5 * 60 * 1000; // ±5 min for matching against existing rows
const SHARES_TOLERANCE = 0.1; // 10% — partial fills can differ from request

const POLYMARKET_DATA_API_URL = "https://data-api.polymarket.com";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error", "warn"] });

interface PolymarketTrade {
  proxyWallet: string;
  timestamp: number; // unix seconds
  conditionId: string;
  type: "TRADE";
  size: number;
  usdcSize: number;
  transactionHash: string;
  price: number;
  asset: string;
  side: "BUY" | "SELL";
  outcomeIndex: number;
  title: string;
  slug: string;
  icon: string;
  eventSlug: string;
  outcome: string;
}

function extractCompanyFromTitle(title: string): string | null {
  // "Will SpaceX's market cap…" / "Will Discord's market cap…"
  const match = title.match(/Will ([\w.&]+(?:\s\w+)?)['’]s/i);
  return match ? match[1] : null;
}

async function fetchSellActivity(
  safeAddress: string
): Promise<PolymarketTrade[]> {
  // Page through; the API caps `limit` at 500 per request.
  const all: PolymarketTrade[] = [];
  let offset = 0;
  const pageSize = 500;
  while (true) {
    const url = `${POLYMARKET_DATA_API_URL}/activity?user=${safeAddress}&type=TRADE&side=SELL&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Polymarket activity HTTP ${res.status}`);
    }
    const page = (await res.json()) as PolymarketTrade[];
    all.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
    if (offset >= 5000) break; // safety cap
  }
  return all;
}

interface ExistingSale {
  id: string;
  eventId: string;
  sharesSold: number;
  completedAt: Date | null;
  createdAt: Date;
}

async function loadExistingSales(
  tradingWalletId: string
): Promise<ExistingSale[]> {
  const rows = await prisma.predictionMarketSale.findMany({
    where: { tradingWalletId },
    select: {
      id: true,
      eventId: true,
      sharesSold: true,
      completedAt: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    sharesSold: Number(r.sharesSold),
    completedAt: r.completedAt,
    createdAt: r.createdAt,
  }));
}

function isAlreadyLogged(
  trade: PolymarketTrade,
  existing: ExistingSale[]
): ExistingSale | null {
  const tradeMs = trade.timestamp * 1000;
  for (const sale of existing) {
    if (sale.eventId !== trade.eventSlug) continue;
    const ref = (sale.completedAt ?? sale.createdAt).getTime();
    if (Math.abs(ref - tradeMs) > MATCH_WINDOW_MS) continue;
    const shareDiff = Math.abs(sale.sharesSold - trade.size);
    const tolerance = Math.max(0.01, trade.size * SHARES_TOLERANCE);
    if (shareDiff <= tolerance) return sale;
  }
  return null;
}

async function main() {
  console.log(
    `[backfill-partial-sells] mode=${APPLY ? "APPLY" : "DRY-RUN"}${
      WALLET_FILTER ? ` wallet=${WALLET_FILTER}` : ""
    }`
  );

  const wallets = await prisma.tradingWallet.findMany({
    where: WALLET_FILTER
      ? { OR: [{ address: WALLET_FILTER }, { safeAddress: WALLET_FILTER }] }
      : undefined,
    select: { id: true, address: true, safeAddress: true },
  });

  if (wallets.length === 0) {
    console.log("No trading wallets found.");
    return;
  }

  console.log(`Scanning ${wallets.length} trading wallet(s).`);

  let totalTrades = 0;
  let alreadyLogged = 0;
  let inserted = 0;
  let skippedNoSafe = 0;

  for (const wallet of wallets) {
    if (!wallet.safeAddress) {
      skippedNoSafe++;
      continue;
    }
    const safe = wallet.safeAddress;

    let trades: PolymarketTrade[];
    try {
      trades = await fetchSellActivity(safe);
    } catch (err) {
      console.error(
        `  [wallet ${wallet.address} safe ${safe}] activity fetch failed:`,
        err
      );
      continue;
    }

    if (trades.length === 0) continue;
    totalTrades += trades.length;

    const existing = await loadExistingSales(wallet.id);
    console.log(
      `\n[wallet ${wallet.address}] safe=${safe} sell-fills=${trades.length} existing-rows=${existing.length}`
    );

    for (const trade of trades) {
      const match = isAlreadyLogged(trade, existing);
      if (match) {
        alreadyLogged++;
        continue;
      }

      const company = extractCompanyFromTitle(trade.title);
      const completedAt = new Date(trade.timestamp * 1000);
      // Without the original buy record we can't compute realized P&L. Leave
      // costBasis null and realizedPnl 0 rather than fabricate a number.
      const insertData = {
        tradingWalletId: wallet.id,
        positionId: trade.conditionId,
        eventId: trade.eventSlug,
        eventName: trade.title,
        company,
        side: "LONG", // Polymarket positions surface as LONG in this app
        sharesSold: trade.size,
        percentage: 100, // Unknown — assume the fill closed whatever was sold
        proceeds: trade.usdcSize,
        realizedPnl: 0,
        costBasis: null,
        avgEntryPrice: null,
        exitPrice: trade.price,
        usdcReturned: trade.usdcSize,
        returnFundsTxHash: trade.transactionHash,
        status: "COMPLETED" as const,
        completedAt,
        createdAt: completedAt,
      };

      console.log(
        `  [insert] ${completedAt.toISOString()} event=${trade.eventSlug} shares=${trade.size} proceeds=$${trade.usdcSize.toFixed(4)} tx=${trade.transactionHash}`
      );

      if (APPLY) {
        await prisma.predictionMarketSale.create({ data: insertData });
        // Append to in-memory list so subsequent identical fills (rare) match.
        existing.push({
          id: "",
          eventId: insertData.eventId,
          sharesSold: insertData.sharesSold,
          completedAt,
          createdAt: completedAt,
        });
        inserted++;
      } else {
        inserted++;
      }
    }
  }

  console.log(
    `\n[summary] wallets=${wallets.length} skippedNoSafe=${skippedNoSafe} fills=${totalTrades} alreadyLogged=${alreadyLogged} ${APPLY ? "inserted" : "wouldInsert"}=${inserted}`
  );
  if (!APPLY && inserted > 0) {
    console.log("Dry run complete. Re-run with --apply to write inserts.");
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
