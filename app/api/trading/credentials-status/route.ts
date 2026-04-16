import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requireDatabase, getDb } from "@/lib/onboarding/db";
import { checkCredentialsStatus } from "@/lib/vaulto-api/trading";
import { getVaultoApiToken, isVaultoApiConfigured } from "@/lib/vaulto-api/config";

/**
 * GET /api/trading/credentials-status
 *
 * Check if the current user has trading credentials configured on Vaulto API.
 */
export async function GET() {
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
      return NextResponse.json({ hasCredentials: false });
    }

    // Check credentials status on Vaulto API
    const apiKey = getVaultoApiToken();
    const result = await checkCredentialsStatus(apiKey, user.tradingWallet.address);

    return NextResponse.json({ hasCredentials: result.hasCredentials });
  } catch (error) {
    console.error("[Credentials Status] Error:", error);
    // If we can't check, assume no credentials
    return NextResponse.json({ hasCredentials: false });
  }
}
