import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { fetchPositions, type PositionsResponse } from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";

/**
 * GET /api/trading/positions
 *
 * Proxy route for fetching user's prediction market positions via Vaulto API.
 */
export async function GET() {
  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check Vaulto API configuration
    if (!isVaultoApiConfigured()) {
      return NextResponse.json(
        { error: "Trading not configured" },
        { status: 500 }
      );
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

    if (!user.tradingWallet || user.tradingWallet.status !== "ACTIVE") {
      // Return empty positions if no active wallet
      const emptyResponse: PositionsResponse = {
        positions: [],
        totals: {
          totalValue: 0,
          totalCost: 0,
          unrealizedPnl: 0,
          unrealizedPnlPercent: 0,
        },
      };
      return NextResponse.json(emptyResponse);
    }

    // Fetch positions via Vaulto API
    const apiKey = getVaultoApiToken();
    const userId = user.tradingWallet.address;

    const result = await fetchPositions(apiKey, userId);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Trading Positions] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch positions" },
      { status: 500 }
    );
  }
}
