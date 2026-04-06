import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { getPositions as getAlpacaPositions, getQuote, type EtfSymbol } from "@/lib/alpaca";

/**
 * GET /api/alpaca/positions
 *
 * Get user's ETF positions with current valuations.
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;
    const db = getDb();

    // Get user and trading wallet
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { tradingWallet: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.tradingWallet) {
      return NextResponse.json({ positions: [] });
    }

    // Get positions from database
    const dbPositions = await db.etfPosition.findMany({
      where: { tradingWalletId: user.tradingWallet.id },
    });

    if (dbPositions.length === 0) {
      return NextResponse.json({ positions: [] });
    }

    // Update positions with current prices
    const positions = await Promise.all(
      dbPositions.map(async (position) => {
        try {
          // Get current quote
          const quote = await getQuote(position.symbol as EtfSymbol);
          const currentPrice = quote.midPrice;
          const qty = position.qty.toNumber();
          const costBasis = position.costBasis.toNumber();
          const marketValue = qty * currentPrice;
          const unrealizedPl = marketValue - costBasis;
          const unrealizedPlPercent = costBasis > 0 ? (unrealizedPl / costBasis) * 100 : 0;

          // Update position in database (synchronous)
          try {
            await db.etfPosition.update({
              where: { id: position.id },
              data: {
                currentPrice,
                marketValue,
                unrealizedPl,
                lastSyncedAt: new Date(),
              },
            });
          } catch (err) {
            console.error(`Failed to update position ${position.id}:`, err);
          }

          return {
            id: position.id,
            symbol: position.symbol,
            qty,
            avgEntryPrice: position.avgEntryPrice.toNumber(),
            currentPrice,
            costBasis,
            marketValue,
            unrealizedPl,
            unrealizedPlPercent,
            lastSyncedAt: new Date().toISOString(),
          };
        } catch (error) {
          // Return stale data if quote fetch fails
          console.error(`Failed to fetch quote for ${position.symbol}:`, error);

          return {
            id: position.id,
            symbol: position.symbol,
            qty: position.qty.toNumber(),
            avgEntryPrice: position.avgEntryPrice.toNumber(),
            currentPrice: position.currentPrice?.toNumber() || null,
            costBasis: position.costBasis.toNumber(),
            marketValue: position.marketValue?.toNumber() || null,
            unrealizedPl: position.unrealizedPl?.toNumber() || null,
            unrealizedPlPercent: position.unrealizedPl && position.costBasis
              ? (position.unrealizedPl.toNumber() / position.costBasis.toNumber()) * 100
              : null,
            lastSyncedAt: position.lastSyncedAt?.toISOString() || null,
          };
        }
      })
    );

    // Calculate totals
    const totalCostBasis = positions.reduce((sum, p) => sum + p.costBasis, 0);
    const totalMarketValue = positions.reduce(
      (sum, p) => sum + (p.marketValue || 0),
      0
    );
    const totalUnrealizedPl = positions.reduce(
      (sum, p) => sum + (p.unrealizedPl || 0),
      0
    );

    return NextResponse.json({
      positions,
      totals: {
        costBasis: totalCostBasis,
        marketValue: totalMarketValue,
        unrealizedPl: totalUnrealizedPl,
        unrealizedPlPercent:
          totalCostBasis > 0 ? (totalUnrealizedPl / totalCostBasis) * 100 : 0,
      },
    });
  } catch (error) {
    console.error("[Alpaca Positions] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch positions" },
      { status: 500 }
    );
  }
}
