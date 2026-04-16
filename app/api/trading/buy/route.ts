import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { buyPosition, type BuyPositionResponse } from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";

// Map event slugs to company names for logging
const EVENT_TO_COMPANY: Record<string, string> = {
  "spacex-ipo-closing-market-cap": "SpaceX",
  "openai-ipo-closing-market-cap": "OpenAI",
  "anthropic-ipo-closing-market-cap": "Anthropic",
  "stripe-ipo-closing-market-cap": "Stripe",
  "databricks-ipo-closing-market-cap": "Databricks",
  "discord-ipo-closing-market-cap": "Discord",
  "fannie-mae-ipo-closing-market-cap": "Fannie Mae",
  "freddie-mac-ipo-closing-market-cap": "Freddie Mac",
  "megaeth-market-cap-fdv-one-day-after-launch": "MegaETH",
  "kraken-ipo-closing-market-cap-above": "Kraken",
  "clear-street-group-ipo-closing-market-cap": "Clear Street",
  "strava-ipo-closing-market-cap": "Strava",
};

/**
 * POST /api/trading/buy
 *
 * Proxy route for prediction market trading via Vaulto API.
 * Authenticates user and forwards trade request with x-user-id header.
 */
export async function POST(request: NextRequest) {
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
      return NextResponse.json(
        { error: "Trading wallet not active" },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { eventId, side, amount } = body;

    // Validate eventId
    if (!eventId || typeof eventId !== "string") {
      return NextResponse.json(
        { error: "Invalid eventId" },
        { status: 400 }
      );
    }

    // Validate side
    if (!side || !["LONG", "SHORT"].includes(side)) {
      return NextResponse.json(
        { error: "Invalid side. Must be LONG or SHORT" },
        { status: 400 }
      );
    }

    // Validate amount
    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Invalid amount. Must be a positive number" },
        { status: 400 }
      );
    }

    // Check minimum trade amount
    if (amount < 1) {
      return NextResponse.json(
        { error: "Minimum trade amount is $1" },
        { status: 400 }
      );
    }

    // Extract wallet signature headers
    const walletNonce = request.headers.get("x-wallet-nonce");
    const walletSignature = request.headers.get("x-wallet-signature");

    if (!walletNonce || !walletSignature) {
      return NextResponse.json(
        { error: "Wallet signature required. Include x-wallet-nonce and x-wallet-signature headers." },
        { status: 400 }
      );
    }

    // Execute trade via Vaulto API
    const apiKey = getVaultoApiToken();
    const userId = user.tradingWallet.address;

    const result = await buyPosition(
      { eventId, side, amount },
      apiKey,
      userId,
      { nonce: walletNonce, signature: walletSignature }
    );

    if (!result.success) {
      // Log failed trade attempt
      await db.predictionMarketTrade.create({
        data: {
          tradingWalletId: user.tradingWallet.id,
          eventId,
          eventName: `${EVENT_TO_COMPANY[eventId] || eventId} IPO`,
          company: EVENT_TO_COMPANY[eventId] || null,
          side,
          amount,
          status: "FAILED",
          errorMessage: result.error || "Trade failed",
        },
      });

      return NextResponse.json(
        { error: result.error || "Trade failed" },
        { status: 400 }
      );
    }

    // Calculate total shares from orders
    const totalShares = result.orders?.reduce((sum, o) => sum + o.size, 0) || 0;

    // Log successful trade to database
    await db.predictionMarketTrade.create({
      data: {
        tradingWalletId: user.tradingWallet.id,
        eventId,
        eventName: `${EVENT_TO_COMPANY[eventId] || eventId} IPO`,
        company: EVENT_TO_COMPANY[eventId] || null,
        side,
        amount,
        shares: totalShares,
        averagePrice: result.averagePrice || null,
        positionId: result.positionId || null,
        status: "FILLED",
        filledAt: new Date(),
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Trading Buy] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to place trade" },
      { status: 500 }
    );
  }
}
