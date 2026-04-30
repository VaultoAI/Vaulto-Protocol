import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { sellPosition } from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";
import { triggerBackgroundSnapshot } from "@/lib/trading-wallet/portfolio-snapshot";

/**
 * POST /api/trading/sell
 *
 * Proxy route for selling prediction market positions via Vaulto API.
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
    const { positionId, shares, percentage, totalShares, eventId, eventName, company, side, costBasis, avgEntryPrice } = body;

    // Validate positionId
    if (!positionId || typeof positionId !== "string") {
      return NextResponse.json(
        { error: "Invalid positionId" },
        { status: 400 }
      );
    }

    // Validate percentage (optional, 1-100)
    if (percentage !== undefined) {
      if (typeof percentage !== "number" || percentage < 1 || percentage > 100) {
        return NextResponse.json(
          { error: "Percentage must be between 1 and 100" },
          { status: 400 }
        );
      }
    }

    // Validate shares (optional)
    if (shares !== undefined && (typeof shares !== "number" || shares <= 0)) {
      return NextResponse.json(
        { error: "Invalid shares amount" },
        { status: 400 }
      );
    }

    // Validate totalShares (optional, required if shares is provided)
    if (shares !== undefined && totalShares === undefined) {
      return NextResponse.json(
        { error: "totalShares required when selling by shares" },
        { status: 400 }
      );
    }

    if (totalShares !== undefined && (typeof totalShares !== "number" || totalShares <= 0)) {
      return NextResponse.json(
        { error: "Invalid totalShares amount" },
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

    // Execute sell via Vaulto API
    const apiKey = getVaultoApiToken();
    const userId = user.tradingWallet.address;

    // Build auth object based on available credentials
    const tradeAuth = privyToken
      ? { privyToken }
      : { walletSignature: { nonce: walletNonce!, signature: walletSignature! } };

    const result = await sellPosition(
      { positionId, shares, percentage, totalShares },
      apiKey,
      userId,
      tradeAuth
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Sell failed" },
        { status: 400 }
      );
    }

    // Log successful sale to database
    if (result.success) {
      try {
        // Calculate the percentage sold for the record
        const percentageSold = percentage || (shares && totalShares ? Math.round((shares / totalShares) * 100) : 100);
        const sharesSold = result.sharesSold || shares || 0;

        // Calculate cost basis for shares sold if provided
        const saleCostBasis = costBasis !== undefined
          ? (sharesSold / (totalShares || sharesSold)) * costBasis
          : null;

        // Calculate realized P&L if we have cost basis
        const realizedPnl = saleCostBasis !== null
          ? (result.proceeds ?? 0) - saleCostBasis
          : 0;

        await db.predictionMarketSale.create({
          data: {
            tradingWalletId: user.tradingWallet.id,
            positionId,
            eventId: eventId || "",
            eventName: eventName || null,
            company: company || null,
            side: side || "LONG",
            sharesSold,
            percentage: percentageSold,
            proceeds: result.proceeds ?? 0,
            realizedPnl,
            costBasis: saleCostBasis,
            avgEntryPrice: avgEntryPrice || null,
            exitPrice: result.exitPrice || null,
            status: "COMPLETED",
            completedAt: new Date(),
          },
        });
      } catch (logError) {
        // Log error but don't fail the sale - the sale itself succeeded
        console.error("[Trading Sell] Failed to log sale to database:", logError);
      }
    }

    // Auto-sweep is owned by the Vaulto API sell endpoint now: it returns
    // returnFundsTxHash, usdcReturned, and returnFundsError on `result`.
    // No frontend-side coordination needed.
    if (result.returnFundsTxHash) {
      console.log(
        `[Trading Sell] Auto-sweep delivered ${result.usdcReturned} USDC to EOA: ${result.returnFundsTxHash}`,
      );
    } else if (result.returnFundsError) {
      console.warn(`[Trading Sell] Auto-sweep failed: ${result.returnFundsError}`);
    }

    // Trigger portfolio snapshot in background (non-blocking)
    triggerBackgroundSnapshot(
      user.tradingWallet.id,
      user.tradingWallet.address,
      user.tradingWallet.safeAddress,
      user.tradingWallet.chainId
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Trading Sell] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sell position" },
      { status: 500 }
    );
  }
}
