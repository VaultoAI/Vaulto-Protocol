import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { placeEtfOrder } from "@/lib/vaulto-api/etf";
import {
  isVaultoApiConfigured,
  getVaultoApiToken,
  getVaultoApiConfigError,
  getVaultoApiDebugInfo,
} from "@/lib/vaulto-api/config";

/**
 * POST /api/etf/order
 *
 * Proxy to Vaulto-API for placing ETF orders.
 * Authenticates user and extracts tradingWalletId before forwarding.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
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

    if (!user.tradingWallet || user.tradingWallet.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Trading wallet not active" },
        { status: 400 }
      );
    }

    // Check Vaulto API configuration
    if (!isVaultoApiConfigured()) {
      const errorMsg = getVaultoApiConfigError();
      console.error("[ETF Order] Config error:", errorMsg, getVaultoApiDebugInfo());
      return NextResponse.json(
        {
          error: "Service temporarily unavailable",
          ...(process.env.NODE_ENV === "development" && { details: errorMsg }),
        },
        { status: 503 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { symbol, side, type, notionalUsd, qty, limitPrice } = body;

    // Forward to Vaulto-API
    const result = await placeEtfOrder(
      {
        tradingWalletId: user.tradingWallet.id,
        symbol,
        side,
        type,
        notionalUsd,
        qty,
        limitPrice,
      },
      getVaultoApiToken(),
      user.id
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ETF Order] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to place order" },
      { status: 500 }
    );
  }
}
