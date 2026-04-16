import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { sellPosition } from "@/lib/vaulto-api/trading";
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
    const { positionId, shares } = body;

    // Validate positionId
    if (!positionId || typeof positionId !== "string") {
      return NextResponse.json(
        { error: "Invalid positionId" },
        { status: 400 }
      );
    }

    // Validate shares (optional)
    if (shares !== undefined && (typeof shares !== "number" || shares <= 0)) {
      return NextResponse.json(
        { error: "Invalid shares amount" },
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
      { positionId, shares },
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

    return NextResponse.json(result);
  } catch (error) {
    console.error("[Trading Sell] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sell position" },
      { status: 500 }
    );
  }
}
