import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { buyPosition, prepareFundsForBuy, type BuyPositionResponse } from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";
import { triggerBackgroundSnapshot } from "@/lib/trading-wallet/portfolio-snapshot";

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

    // Extract auth headers - prefer Privy token, fall back to wallet signature
    const privyToken = request.headers.get("x-privy-token");
    const walletNonce = request.headers.get("x-wallet-nonce");
    const walletSignature = request.headers.get("x-wallet-signature");

    if (!privyToken && (!walletNonce || !walletSignature)) {
      return NextResponse.json(
        { error: "Authentication required. Include x-privy-token header or x-wallet-nonce and x-wallet-signature headers." },
        { status: 400 }
      );
    }

    // Execute trade via Vaulto API
    const apiKey = getVaultoApiToken();
    const userId = user.tradingWallet.address;

    // Prepare funds: send USDC native to Safe, atomically swap+wrap into pUSD on the Safe
    if (privyToken) {
      console.log("[Trading Buy] Preparing funds for trade...");
      const fundResult = await prepareFundsForBuy(
        amount,
        apiKey,
        privyToken,
        userId
      );

      if (!fundResult.ready) {
        console.error("[Trading Buy] Fund preparation failed:", fundResult.error);
        return NextResponse.json(
          { error: fundResult.error || "Failed to prepare funds for trade" },
          { status: 400 }
        );
      }

      console.log("[Trading Buy] Funds prepared successfully:", fundResult.transactions);
    }

    // Build auth object based on available credentials
    const tradeAuth = privyToken
      ? { privyToken }
      : { walletSignature: { nonce: walletNonce!, signature: walletSignature! } };

    const result = await buyPosition(
      { eventId, side, amount },
      apiKey,
      userId,
      tradeAuth
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

    // Log full response structure for debugging
    console.log("[Trading Buy] Full API response:", JSON.stringify(result, null, 2));
    console.log("[Trading Buy] Response keys:", Object.keys(result));

    // Check for nested position object (common Vaulto API pattern)
    const position = result.position || result;

    // Extract shares - check nested position first, then orders array
    const totalShares = result.orders?.reduce((sum, o) => sum + o.size, 0)
      || position.totalShares
      || position.shares
      || result.totalShares
      || result.shares
      || 0;

    // Extract price - check nested position first
    const avgPrice = position.entryPrice
      || position.averagePrice
      || result.averagePrice
      || result.entryPrice
      || result.avgPrice
      || null;

    // Extract cost basis:
    // 1. Check nested position costBasis/totalCost (use "in" to narrow union type)
    // 2. Use top-level totalCost if available
    // 3. Calculate from shares × averagePrice
    // 4. Fall back to intended amount
    const actualCostBasis =
      ("costBasis" in position ? position.costBasis : undefined) ??
      ("totalCost" in position ? position.totalCost : undefined) ??
      result.totalCost ??
      (totalShares && avgPrice ? totalShares * avgPrice : null) ??
      amount;

    console.log("[Trading Buy] Extracted values:", {
      totalShares,
      avgPrice,
      actualCostBasis,
      hasNestedPosition: !!result.position,
      fromTotalCost: !!(("costBasis" in position && position.costBasis) || ("totalCost" in position && position.totalCost) || result.totalCost),
    });

    // Log successful trade to database
    await db.predictionMarketTrade.create({
      data: {
        tradingWalletId: user.tradingWallet.id,
        eventId,
        eventName: `${EVENT_TO_COMPANY[eventId] || eventId} IPO`,
        company: EVENT_TO_COMPANY[eventId] || null,
        side,
        amount,           // Keep original intended amount
        shares: totalShares || null,
        averagePrice: avgPrice,
        actualCostBasis,  // Store actual cost from API or calculated
        positionId: result.positionId ? String(result.positionId) : null,
        status: "FILLED",
        filledAt: new Date(),
      },
    });

    // Trigger portfolio snapshot in background (non-blocking)
    triggerBackgroundSnapshot(
      user.tradingWallet.id,
      user.tradingWallet.address,
      user.tradingWallet.safeAddress,
      user.tradingWallet.chainId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Trading Buy] Error:", error);
    // Log full stack trace for debugging
    if (error instanceof Error) {
      console.error("[Trading Buy] Stack:", error.stack);
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to place trade",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
