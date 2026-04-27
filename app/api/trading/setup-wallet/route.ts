import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { setupWallet } from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";

/**
 * POST /api/trading/setup-wallet
 *
 * Proxy route to set up/sync Privy wallet on Vaulto API.
 * This registers the user's wallet for trading operations.
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

    // Call Vaulto API to setup wallet - pass wallet address for credential association
    const apiKey = getVaultoApiToken();
    const result = await setupWallet(apiKey, privyAuthToken, user.tradingWallet.address);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to setup wallet" },
        { status: 400 }
      );
    }

    // Save the Safe wallet address to the database if returned
    if (result.polymarketAddress && user.tradingWallet) {
      await db.tradingWallet.update({
        where: { id: user.tradingWallet.id },
        data: { safeAddress: result.polymarketAddress },
      });
    }

    return NextResponse.json({
      success: true,
      walletId: result.walletId,
      walletAddress: result.walletAddress,
      polymarketAddress: result.polymarketAddress,
    });
  } catch (error) {
    console.error("[Setup Wallet] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to setup wallet" },
      { status: 500 }
    );
  }
}
