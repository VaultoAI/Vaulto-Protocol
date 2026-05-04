/**
 * Repull cost-basis data from Polymarket Data API for a single trading wallet,
 * then write CLOB truth onto historical PredictionMarketTrade and
 * PredictionMarketSale rows.
 *
 *   buys:  match each PredictionMarketTrade to its Polymarket BUY fills by
 *          (eventSlug, createdAt ± window). Aggregate fills into shares,
 *          weighted-avg price, and actualCostBasis.
 *   sales: match each PredictionMarketSale to its Polymarket SELL fills by
 *          (eventSlug, completedAt ± window). Set exitPrice. Compute
 *          avgEntryPrice as the running weighted-avg entry across all BUY
 *          fills strictly before this sale's timestamp. costBasis =
 *          sharesSold × avgEntryPrice; realizedPnl = proceeds − costBasis.
 *
 * Source of truth:
 *   https://data-api.polymarket.com/activity?user=<safe>&type=TRADE
 *
 * Usage:
 *   npx tsx scripts/repull-cost-basis-from-polymarket.ts
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const TARGET_ADDRESS = "0x6Ecf7305aD2A0a3C991A90C4E80A4908d0bbaa40";
const POLYMARKET_DATA_API = "https://data-api.polymarket.com";

// Match window between a DB row's timestamp and a polymarket fill timestamp.
const MATCH_WINDOW_MS = 10 * 60 * 1000;
// Tolerance when matching sale share counts to fills (partial fills can vary).
const SHARES_TOLERANCE = 0.1;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter, log: ["error", "warn"] });

interface PolymarketFill {
  timestamp: number; // unix seconds
  conditionId: string;
  size: number;
  usdcSize: number;
  price: number;
  asset: string;
  side: "BUY" | "SELL";
  outcomeIndex: number;
  eventSlug: string;
  transactionHash: string;
}

function dec2(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(2));
}
function dec6(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(6));
}
function dec8(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(8));
}

async function fetchAllActivity(safe: string): Promise<PolymarketFill[]> {
  const all: PolymarketFill[] = [];
  let offset = 0;
  const pageSize = 500;
  while (true) {
    const url = `${POLYMARKET_DATA_API}/activity?user=${safe}&type=TRADE&limit=${pageSize}&offset=${offset}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Polymarket activity HTTP ${res.status}`);
    const page = (await res.json()) as PolymarketFill[];
    all.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
    if (offset >= 5000) break;
  }
  return all;
}

async function main() {
  const wallet = await prisma.tradingWallet.findUnique({
    where: { address: TARGET_ADDRESS },
    select: { id: true, address: true, safeAddress: true, userId: true },
  });
  if (!wallet) throw new Error(`No TradingWallet for ${TARGET_ADDRESS}`);
  if (!wallet.safeAddress) throw new Error(`Wallet ${TARGET_ADDRESS} has no safeAddress`);

  console.log(
    `Wallet ${wallet.address}\n  id=${wallet.id}\n  safe=${wallet.safeAddress}\n  userId=${wallet.userId}`
  );

  const fills = await fetchAllActivity(wallet.safeAddress);
  fills.sort((a, b) => a.timestamp - b.timestamp);
  const buys = fills.filter((f) => f.side === "BUY");
  const sells = fills.filter((f) => f.side === "SELL");
  console.log(`\nPolymarket fills: total=${fills.length} buys=${buys.length} sells=${sells.length}`);

  // ---- Buys ----
  const trades = await prisma.predictionMarketTrade.findMany({
    where: { tradingWalletId: wallet.id },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\n=== PredictionMarketTrade: ${trades.length} rows ===`);

  const tradeUpdates: Prisma.PrismaPromise<unknown>[] = [];
  let tradeMatched = 0;
  let tradeNoMatch = 0;

  for (const t of trades) {
    const tMs = (t.filledAt ?? t.createdAt).getTime();
    const matched = buys.filter(
      (f) =>
        f.eventSlug === t.eventId &&
        Math.abs(f.timestamp * 1000 - tMs) <= MATCH_WINDOW_MS
    );

    if (matched.length === 0) {
      console.log(
        `  NO-MATCH ${t.id} (${t.eventId}) [${t.status}] @ ${(t.filledAt ?? t.createdAt).toISOString()}`
      );
      tradeNoMatch++;
      continue;
    }

    const totalShares = matched.reduce((s, f) => s + f.size, 0);
    const totalUsdc = matched.reduce((s, f) => s + f.usdcSize, 0);
    const avgPrice = totalUsdc / totalShares;
    const costBasis = totalUsdc;

    const shares = dec8(totalShares);
    const avgP = dec6(avgPrice);
    const cb = dec2(costBasis);

    const oldShares = t.shares == null ? "null" : Number(t.shares).toFixed(4);
    const oldAvg = t.averagePrice == null ? "null" : Number(t.averagePrice).toFixed(6);
    const oldCb = t.actualCostBasis == null ? "null" : Number(t.actualCostBasis).toFixed(2);

    console.log(
      `  fix ${t.id} (${t.eventId}) fills=${matched.length}: shares ${oldShares}→${totalShares.toFixed(4)}, avg $${oldAvg}→$${avgPrice.toFixed(6)}, cb $${oldCb}→$${costBasis.toFixed(2)}`
    );

    tradeUpdates.push(
      prisma.predictionMarketTrade.update({
        where: { id: t.id },
        data: { shares, averagePrice: avgP, actualCostBasis: cb },
      })
    );
    tradeMatched++;
  }

  if (tradeUpdates.length > 0) {
    await prisma.$transaction(tradeUpdates);
  }
  console.log(`Buys: matched=${tradeMatched} noMatch=${tradeNoMatch}`);

  // ---- Sales ----
  // Build running cost-basis state per event from chronological fills so each
  // sale gets the avg-entry-price as it stood at the moment of that sale.
  const sales = await prisma.predictionMarketSale.findMany({
    where: { tradingWalletId: wallet.id },
    orderBy: { createdAt: "asc" },
  });
  console.log(`\n=== PredictionMarketSale: ${sales.length} rows ===`);

  // Compute per-event running avg-entry timeline using ALL fills in order.
  // For each SELL fill we record (timestamp, avgEntryAtThatMoment).
  type SellSnapshot = { timestamp: number; avgEntry: number; size: number; usdc: number };
  const sellSnapshotsByEvent = new Map<string, SellSnapshot[]>();

  {
    const eventState = new Map<string, { shares: number; cost: number }>();
    for (const f of fills) {
      const st = eventState.get(f.eventSlug) ?? { shares: 0, cost: 0 };
      if (f.side === "BUY") {
        st.shares += f.size;
        st.cost += f.usdcSize;
        eventState.set(f.eventSlug, st);
      } else {
        const avg = st.shares > 0 ? st.cost / st.shares : 0;
        const arr = sellSnapshotsByEvent.get(f.eventSlug) ?? [];
        arr.push({ timestamp: f.timestamp, avgEntry: avg, size: f.size, usdc: f.usdcSize });
        sellSnapshotsByEvent.set(f.eventSlug, arr);
        // Reduce running state proportionally (avg cost method).
        const reduceShares = Math.min(f.size, st.shares);
        const reduceCost = reduceShares * avg;
        st.shares -= reduceShares;
        st.cost -= reduceCost;
        eventState.set(f.eventSlug, st);
      }
    }
  }

  const saleUpdates: Prisma.PrismaPromise<unknown>[] = [];
  let saleMatched = 0;
  let saleNoMatch = 0;

  for (const s of sales) {
    const sMs = (s.completedAt ?? s.createdAt).getTime();
    const sharesSold = Number(s.sharesSold);
    const proceeds = Number(s.proceeds);

    const candidates = (sellSnapshotsByEvent.get(s.eventId) ?? []).filter(
      (snap) => Math.abs(snap.timestamp * 1000 - sMs) <= MATCH_WINDOW_MS
    );

    // Prefer a snapshot whose size matches sharesSold within tolerance; else
    // pick the closest in time.
    let chosen: SellSnapshot | null = null;
    if (candidates.length > 0) {
      const sizeMatch = candidates.find(
        (c) => Math.abs(c.size - sharesSold) <= Math.max(0.01, sharesSold * SHARES_TOLERANCE)
      );
      chosen =
        sizeMatch ??
        candidates.reduce((best, c) =>
          Math.abs(c.timestamp * 1000 - sMs) < Math.abs(best.timestamp * 1000 - sMs) ? c : best
        );
    }

    if (!chosen) {
      console.log(
        `  NO-MATCH ${s.id} (${s.eventId}) [${s.status}] @ ${(s.completedAt ?? s.createdAt).toISOString()} sharesSold=${sharesSold}`
      );
      saleNoMatch++;
      continue;
    }

    const avgEntry = chosen.avgEntry;
    const exitPrice = chosen.size > 0 ? chosen.usdc / chosen.size : 0;
    const costBasis = sharesSold * avgEntry;
    const realizedPnl = proceeds - costBasis;

    const oldCb = s.costBasis == null ? "null" : Number(s.costBasis).toFixed(2);
    const oldEntry = s.avgEntryPrice == null ? "null" : Number(s.avgEntryPrice).toFixed(6);
    const oldExit = s.exitPrice == null ? "null" : Number(s.exitPrice).toFixed(6);
    const oldPnl = Number(s.realizedPnl).toFixed(2);

    console.log(
      `  fix ${s.id} (${s.eventId}): entry $${oldEntry}→$${avgEntry.toFixed(6)}, exit $${oldExit}→$${exitPrice.toFixed(6)}, cb $${oldCb}→$${costBasis.toFixed(2)}, pnl $${oldPnl}→$${realizedPnl.toFixed(2)}`
    );

    saleUpdates.push(
      prisma.predictionMarketSale.update({
        where: { id: s.id },
        data: {
          avgEntryPrice: dec6(avgEntry),
          exitPrice: dec6(exitPrice),
          costBasis: dec2(costBasis),
          realizedPnl: dec2(realizedPnl),
        },
      })
    );
    saleMatched++;
  }

  if (saleUpdates.length > 0) {
    await prisma.$transaction(saleUpdates);
  }
  console.log(`Sales: matched=${saleMatched} noMatch=${saleNoMatch}`);

  console.log("\nDone.");
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
