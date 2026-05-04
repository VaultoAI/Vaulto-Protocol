/**
 * Backfill graph-derived entry fields on PredictionMarketTrade rows.
 *
 * For each FILLED trade missing entryGraphValuationUsd, fetch historical
 * implied valuation closest to createdAt from /api/implied-valuations/{slug}/history
 * and estimate fair sell value = amount × (1 - currentSpreadPercent/100).
 *
 * Run:
 *   npx tsx scripts/backfill-prediction-trades.ts          # apply
 *   npx tsx scripts/backfill-prediction-trades.ts --dry    # preview only
 */

import "dotenv/config";
import pg from "pg";
import {
  getImpliedValuationSlug,
  type ImpliedValuationHistoryResponse,
} from "../lib/polymarket/implied-valuations";

const DRY = process.argv.includes("--dry");
const BASE = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

interface TradeRow {
  id: string;
  event_id: string;
  company: string | null;
  side: "LONG" | "SHORT";
  amount: string;
  created_at: Date;
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function fetchHistorical(companySlug: string): Promise<ImpliedValuationHistoryResponse | null> {
  try {
    const res = await fetch(`${BASE}/api/implied-valuations/${companySlug}/history?range=ALL`);
    if (!res.ok) return null;
    return (await res.json()) as ImpliedValuationHistoryResponse;
  } catch {
    return null;
  }
}

async function fetchValuation(eventSlug: string): Promise<{ spreadPercent: number } | null> {
  try {
    const res = await fetch(`${BASE}/api/trading/valuation/${eventSlug}`);
    if (!res.ok) return null;
    const data = await res.json();
    // Use long-side spread for LONG, short-side for SHORT — handled per-row.
    return data;
  } catch {
    return null;
  }
}

function nearestValuation(
  history: ImpliedValuationHistoryResponse,
  at: Date
): number | null {
  if (!history.history?.length) return null;
  const target = at.getTime();
  let best = history.history[0];
  let bestDelta = Math.abs(new Date(best.timestamp).getTime() - target);
  for (const point of history.history) {
    const delta = Math.abs(new Date(point.timestamp).getTime() - target);
    if (delta < bestDelta) {
      best = point;
      bestDelta = delta;
    }
  }
  return best.value ?? null;
}

async function main() {
  console.log(`[backfill] mode=${DRY ? "DRY" : "WRITE"} base=${BASE}`);
  const client = await pool.connect();
  try {
    const { rows } = await client.query<TradeRow>(
      `SELECT id, "eventId" as event_id, company, side, amount::text, "createdAt" as created_at
       FROM "PredictionMarketTrade"
       WHERE status = 'FILLED'
         AND "entryGraphValuationUsd" IS NULL
       ORDER BY "createdAt" ASC`
    );

    console.log(`[backfill] ${rows.length} trades to backfill`);

    const histCache = new Map<string, ImpliedValuationHistoryResponse | null>();
    const valCache = new Map<string, any>();

    let updated = 0;
    let skipped = 0;

    for (const row of rows) {
      const companySlug = row.company
        ? getImpliedValuationSlug(row.company)
        : null;
      if (!companySlug) {
        console.warn(`[backfill] no slug for company=${row.company} (trade ${row.id})`);
        skipped++;
        continue;
      }

      if (!histCache.has(companySlug)) {
        histCache.set(companySlug, await fetchHistorical(companySlug));
      }
      const history = histCache.get(companySlug);
      if (!history) {
        console.warn(`[backfill] no history for slug=${companySlug} (trade ${row.id})`);
        skipped++;
        continue;
      }

      const entryGraphValuationUsd = nearestValuation(history, row.created_at);
      if (!entryGraphValuationUsd) {
        skipped++;
        continue;
      }

      if (!valCache.has(row.event_id)) {
        valCache.set(row.event_id, await fetchValuation(row.event_id));
      }
      const val = valCache.get(row.event_id);
      const spreadPercent =
        row.side === "LONG"
          ? val?.slippage?.long?.spreadPercent ?? 5
          : val?.slippage?.short?.spreadPercent ?? 5;

      const amount = parseFloat(row.amount);
      const spreadCostUsd = amount * (spreadPercent / 100);
      const entryFairSellValueUsd = Math.max(0, amount - spreadCostUsd);

      console.log(
        `[backfill] trade=${row.id} ${row.event_id} ${row.side} amount=$${amount.toFixed(2)} ` +
          `→ graph=$${(entryGraphValuationUsd / 1e9).toFixed(2)}B ` +
          `fairSell=$${entryFairSellValueUsd.toFixed(2)} spread=$${spreadCostUsd.toFixed(2)}`
      );

      if (!DRY) {
        await client.query(
          `UPDATE "PredictionMarketTrade"
           SET "entryGraphValuationUsd" = $1,
               "entryFairSellValueUsd" = $2,
               "spreadCostUsd" = $3
           WHERE id = $4`,
          [entryGraphValuationUsd, entryFairSellValueUsd, spreadCostUsd, row.id]
        );
      }
      updated++;
    }

    console.log(`[backfill] done. updated=${updated} skipped=${skipped} dry=${DRY}`);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
