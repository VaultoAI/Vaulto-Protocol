import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { placeEtfOrder } from "@/lib/vaulto-api/etf";

const VAULTO_API_TOKEN = process.env.VAULTO_API_TOKEN || "";

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

    if (!VAULTO_API_TOKEN) {
      return NextResponse.json(
        { error: "API not configured" },
        { status: 500 }
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
      VAULTO_API_TOKEN,
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
