import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { placeOrder } from "@/lib/alpaca/client";
import { isValidEtfSymbol } from "@/lib/alpaca/constants";
import type { EtfSymbol } from "@/lib/alpaca/constants";

/**
 * POST /api/etf/order
 *
 * Vaulto API route — places ETF orders via Alpaca.
 * Authenticates user and validates trading wallet before executing.
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

    // Parse request body
    const body = await request.json();
    const { symbol, side, type, notionalUsd, qty, limitPrice } = body;

    // Validate symbol
    if (!symbol || !isValidEtfSymbol(symbol)) {
      return NextResponse.json(
        { error: `Invalid ETF symbol: ${symbol}` },
        { status: 400 }
      );
    }

    // Validate side
    if (!side || !["BUY", "SELL"].includes(side)) {
      return NextResponse.json(
        { error: "Invalid order side. Must be BUY or SELL" },
        { status: 400 }
      );
    }

    // Validate type
    if (!type || !["MARKET", "LIMIT"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid order type. Must be MARKET or LIMIT" },
        { status: 400 }
      );
    }

    // Validate amount
    if (notionalUsd === undefined && qty === undefined) {
      return NextResponse.json(
        { error: "Order requires notionalUsd or qty" },
        { status: 400 }
      );
    }

    // Place order via Alpaca
    const result = await placeOrder({
      symbol: symbol.toUpperCase() as EtfSymbol,
      side: side as "BUY" | "SELL",
      type: type as "MARKET" | "LIMIT",
      notional: notionalUsd,
      qty,
      limitPrice,
    });

    if (!result.success || !result.order) {
      return NextResponse.json(
        { error: result.error || "Order placement failed" },
        { status: 400 }
      );
    }

    const alpacaOrder = result.order;

    // Map Alpaca response to frontend EtfOrder shape
    const etfOrder = {
      id: alpacaOrder.id,
      alpacaOrderId: alpacaOrder.id,
      symbol: alpacaOrder.symbol,
      side: side as "BUY" | "SELL",
      type: type as "MARKET" | "LIMIT",
      status: alpacaOrder.status.toUpperCase(),
      statusMessage: null,
      notionalUsd: alpacaOrder.notional ? parseFloat(alpacaOrder.notional) : null,
      qty: alpacaOrder.qty ? parseFloat(alpacaOrder.qty) : null,
      limitPrice: alpacaOrder.limit_price ? parseFloat(alpacaOrder.limit_price) : null,
      filledQty: alpacaOrder.filled_qty ? parseFloat(alpacaOrder.filled_qty) : 0,
      filledAvgPrice: alpacaOrder.filled_avg_price
        ? parseFloat(alpacaOrder.filled_avg_price)
        : null,
      createdAt: alpacaOrder.created_at,
      submittedAt: alpacaOrder.submitted_at,
      filledAt: alpacaOrder.filled_at,
    };

    return NextResponse.json({ success: true, order: etfOrder });
  } catch (error) {
    console.error("[ETF Order] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to place order" },
      { status: 500 }
    );
  }
}
