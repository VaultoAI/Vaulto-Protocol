import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { getPositions } from "@/lib/alpaca/client";

/**
 * GET /api/etf/positions
 *
 * Vaulto API route — fetches user's ETF positions via Alpaca.
 */
export async function GET() {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;
    const db = getDb();

    // Get user
    const user = await db.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch positions from Alpaca
    const alpacaPositions = await getPositions();

    // Map to frontend EtfPosition shape
    const positions = alpacaPositions.map((p) => ({
      id: `${p.symbol}-position`,
      symbol: p.symbol,
      qty: p.qty,
      avgEntryPrice: p.avgEntryPrice,
      currentPrice: p.currentPrice,
      costBasis: p.costBasis,
      marketValue: p.marketValue,
      unrealizedPl: p.unrealizedPl,
      unrealizedPlPercent: p.unrealizedPlPercent,
      lastSyncedAt: new Date().toISOString(),
    }));

    // Calculate totals
    const totals = {
      costBasis: positions.reduce((sum, p) => sum + p.costBasis, 0),
      marketValue: positions.reduce((sum, p) => sum + p.marketValue, 0),
      unrealizedPl: positions.reduce((sum, p) => sum + p.unrealizedPl, 0),
      unrealizedPlPercent: 0,
    };

    if (totals.costBasis > 0) {
      totals.unrealizedPlPercent = (totals.unrealizedPl / totals.costBasis) * 100;
    }

    return NextResponse.json({ positions, totals });
  } catch (error) {
    console.error("[ETF Positions] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch positions" },
      { status: 500 }
    );
  }
}
