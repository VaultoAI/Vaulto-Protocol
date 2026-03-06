import { NextResponse } from "next/server";
import { getPredictionMarkets, getPredictionMarketMetrics } from "@/lib/polymarket/markets";

export const revalidate = 300; // 5 minutes

export async function GET() {
  try {
    const [markets, metrics] = await Promise.all([
      getPredictionMarkets(),
      getPredictionMarketMetrics(),
    ]);
    return NextResponse.json({ markets, metrics });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch prediction markets" },
      { status: 500 }
    );
  }
}
