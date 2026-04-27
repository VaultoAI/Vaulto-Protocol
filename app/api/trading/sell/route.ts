import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { sellPosition, returnFundsAfterSell } from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";

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
    const { positionId, shares, percentage, totalShares } = body;

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

    // Optionally return funds from Safe to EOA (non-blocking)
    // Funds will remain in Safe for subsequent trades if this is skipped
    if (privyToken && result.proceeds && result.proceeds > 0) {
      // Fire and forget - don't block the response
      returnFundsAfterSell(apiKey, privyToken, userId, false)
        .then((fundResult) => {
          if (fundResult.success) {
            console.log("[Trading Sell] Funds returned successfully:", fundResult.amountReturned);
          } else {
            console.warn("[Trading Sell] Fund return failed (non-blocking):", fundResult.error);
          }
        })
        .catch((err) => {
          console.error("[Trading Sell] Fund return error (non-blocking):", err);
        });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Trading Sell] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sell position" },
      { status: 500 }
    );
  }
}
