import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { deriveCredentials } from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";

/**
 * POST /api/trading/derive-credentials
 *
 * Proxy route to derive Polymarket API credentials from wallet signature.
 * This creates the trading credentials needed for prediction market trades.
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

    if (!user.tradingWallet) {
      return NextResponse.json(
        { error: "Trading wallet not found. Please create a trading wallet first." },
        { status: 400 }
      );
    }

    // Get Privy auth token from request headers
    const privyAuthToken = request.headers.get("x-privy-token");
    if (!privyAuthToken) {
      return NextResponse.json(
        { error: "Privy authentication token required" },
        { status: 400 }
      );
    }

    // Call Vaulto API to derive credentials - pass wallet address for credential association
    const apiKey = getVaultoApiToken();
    const result = await deriveCredentials(apiKey, privyAuthToken, user.tradingWallet.address);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to derive credentials" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Derive Credentials] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to derive credentials" },
      { status: 500 }
    );
  }
}
