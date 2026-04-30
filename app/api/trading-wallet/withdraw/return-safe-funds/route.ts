import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { returnFundsAfterSell } from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";

/**
 * POST /api/trading-wallet/withdraw/return-safe-funds
 *
 * Returns all USDC.e funds from the Polymarket Safe wallet back to the
 * EOA trading wallet, converting them to native USDC in the process.
 * This should be called before a full withdrawal to consolidate funds.
 */
export async function POST(request: NextRequest) {
  const LOG_PREFIX = "[Return Safe Funds]";

  try {
    // Verify authentication
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check Vaulto API configuration
    if (!isVaultoApiConfigured()) {
      console.log(`${LOG_PREFIX} Vaulto API not configured, skipping`);
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "Trading API not configured",
      });
    }

    const dbError = requireDatabase();
    if (dbError) return dbError;
    const db = getDb();

    // Get user and trading wallet
    const user = await db.user.findUnique({
      where: { email: session.user.email },
      include: { tradingWallet: true },
    });

    if (!user?.tradingWallet) {
      return NextResponse.json(
        { error: "Trading wallet not found" },
        { status: 404 }
      );
    }

    if (user.tradingWallet.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Trading wallet not active" },
        { status: 400 }
      );
    }

    // Check if user has a Safe wallet address
    if (!user.tradingWallet.safeAddress) {
      console.log(`${LOG_PREFIX} No Safe wallet configured, skipping`);
      return NextResponse.json({
        success: true,
        skipped: true,
        message: "No Polymarket wallet configured",
      });
    }

    // Get Privy token from request headers
    const privyToken = request.headers.get("x-privy-token");
    if (!privyToken) {
      return NextResponse.json(
        { error: "Authentication required. Include x-privy-token header." },
        { status: 400 }
      );
    }

    // Call Vaulto API to return funds with swap to native USDC
    const apiKey = getVaultoApiToken();
    const walletAddress = user.tradingWallet.address;

    console.log(`${LOG_PREFIX} Returning funds from Safe to EOA`);
    console.log(`${LOG_PREFIX} Safe address: ${user.tradingWallet.safeAddress}`);
    console.log(`${LOG_PREFIX} EOA address: ${walletAddress}`);

    const result = await returnFundsAfterSell(
      apiKey,
      privyToken,
      walletAddress,
      true // swapToNative = true to convert USDC.e to native USDC
    );

    if (!result.success) {
      console.error(`${LOG_PREFIX} Failed to return funds:`, result.error);
      return NextResponse.json(
        { error: result.error || "Failed to return funds from Safe wallet" },
        { status: 500 }
      );
    }

    console.log(`${LOG_PREFIX} Funds returned successfully:`, result.amountReturned);

    return NextResponse.json({
      success: true,
      amountReturned: result.amountReturned,
      transactions: result.transactions,
      message: "Funds returned from Polymarket wallet",
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to return Safe funds" },
      { status: 500 }
    );
  }
}
